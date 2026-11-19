import type { ApplianceSlug, InferenceTraceStep } from '../../src/types/domain.ts';
import { CAUSE_DEFINITIONS, KNOWLEDGE_RULES } from './knowledgeGraph.ts';
import type { InferenceResult } from './types.ts';

const MAX_FORWARD_CHAINING_ITERATIONS = 15;

/**
 * Forward Chaining Inference Engine
 *
 * Accepts canonical observed facts, iteratively matches IF/THEN rules in
 * KNOWLEDGE_RULES, infers new facts into working memory until fixed point or
 * iteration limit, and records a complete inspectable inference trace.
 * Never claims a rule proves a physical fault—reports candidate possibilities.
 */
export class InferenceEngine {
  runForwardChaining(
    applianceCategory: ApplianceSlug,
    initialFacts: string[]
  ): InferenceResult {
    const workingMemory = new Set<string>(initialFacts);
    const firedRules = new Set<string>();
    const inferenceTrace: InferenceTraceStep[] = [];
    const candidateCauseIdSet = new Set<string>();

    const applicableRules = KNOWLEDGE_RULES.filter(
      (rule) => rule.applianceCategory === applianceCategory || rule.applianceCategory === 'any'
    );

    let iteration = 0;
    let progress = true;

    while (progress && iteration < MAX_FORWARD_CHAINING_ITERATIONS) {
      progress = false;
      iteration += 1;

      for (const rule of applicableRules) {
        if (firedRules.has(rule.id)) continue;

        const allAntecedentsMet = rule.antecedents.every((fact) => workingMemory.has(fact));
        const noNegationsPresent =
          !rule.negatedAntecedents ||
          rule.negatedAntecedents.every((neg) => !workingMemory.has(neg));

        if (allAntecedentsMet && noNegationsPresent) {
          firedRules.add(rule.id);

          if (!workingMemory.has(rule.consequentFact)) {
            workingMemory.add(rule.consequentFact);
            progress = true;
          }

          if (rule.suggestedCauseId) {
            candidateCauseIdSet.add(rule.suggestedCauseId);
          }

          inferenceTrace.push({
            step: inferenceTrace.length + 1,
            ruleId: rule.id,
            matchedFacts: [...rule.antecedents],
            inferredFact: rule.consequentFact,
            reason: rule.description,
          });
        }
      }
    }

    // Also include category causes whose requiredFacts overlap workingMemory
    for (const cause of CAUSE_DEFINITIONS) {
      if (
        (cause.applianceCategory === applianceCategory || cause.applianceCategory === 'other') &&
        (cause.requiredFacts.some((rf) => workingMemory.has(rf)) ||
          cause.supportingFacts.some((sf) => workingMemory.has(sf)))
      ) {
        candidateCauseIdSet.add(cause.id);
      }
    }

    return {
      initialFacts: [...initialFacts],
      workingMemoryFacts: Array.from(workingMemory),
      inferenceTrace: inferenceTrace.slice(0, 25),
      matchedRuleIds: Array.from(firedRules),
      candidateCauseIds: Array.from(candidateCauseIdSet),
      inferenceMode: 'forward_chaining_v1',
    };
  }
}

export const inferenceEngine = new InferenceEngine();
