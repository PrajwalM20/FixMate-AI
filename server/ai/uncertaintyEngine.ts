import type { ApplianceSlug, DiagnosisHypothesis } from '../../src/types/domain.ts';
import { CAUSE_DEFINITIONS, FACT_VOCABULARY } from './knowledgeGraph.ts';
import type { InferenceResult, PerceptBundle, UncertaintyAssessment } from './types.ts';

function labelForFact(factId: string): string {
  return (
    FACT_VOCABULARY.find((f) => f.id === factId)?.label ??
    factId.replace(/_/g, ' ')
  );
}

/**
 * Uncertainty Reasoning & Cause Ranking Engine
 *
 * Computes a transparent, inspectable rule-based evidence score (distinct from
 * statistical probability) considering matched symptoms, fired KB rules,
 * observation reliability, contradictory evidence, and missing information.
 */
export class UncertaintyEngine {
  assess(
    applianceCategory: ApplianceSlug,
    percepts: PerceptBundle,
    inference: InferenceResult
  ): UncertaintyAssessment {
    const workingMemory = new Set(inference.workingMemoryFacts);
    const reliabilityByFact = new Map<string, number>();
    for (const obs of percepts.observedFacts) {
      reliabilityByFact.set(obs.factId, obs.reliability);
    }

    const candidates = CAUSE_DEFINITIONS.filter(
      (c) =>
        inference.candidateCauseIds.includes(c.id) ||
        (c.applianceCategory === applianceCategory &&
          (c.requiredFacts.some((rf) => workingMemory.has(rf)) ||
            c.supportingFacts.some((sf) => workingMemory.has(sf))))
    );

    const scoredHypotheses: DiagnosisHypothesis[] = candidates.map((cause) => {
      const matchedRequired = cause.requiredFacts.filter((f) => workingMemory.has(f));
      const matchedSupporting = cause.supportingFacts.filter((f) => workingMemory.has(f));
      const matchedContradictions = cause.contradictoryFacts.filter((f) => workingMemory.has(f));
      const missingRequired = cause.requiredFacts.filter((f) => !workingMemory.has(f));
      const missingSupporting = cause.supportingFacts.filter((f) => !workingMemory.has(f));

      // Reliability-weighted positive evidence
      const reqWeight = matchedRequired.reduce(
        (sum, f) => sum + 0.32 * (reliabilityByFact.get(f) ?? 0.85),
        0
      );
      const supWeight = matchedSupporting.reduce(
        (sum, f) => sum + 0.14 * (reliabilityByFact.get(f) ?? 0.85),
        0
      );

      // Rule support boost
      const ruleBonus = Math.min(0.2, inference.matchedRuleIds.length * 0.05);

      // Penalties for missing and contradictory evidence
      const missingPenalty = missingRequired.length * 0.25 + missingSupporting.length * 0.04;
      const contradictionPenalty =
        matchedContradictions.length * 0.35 + percepts.contradictoryCues.length * 0.15;

      const rawScore =
        cause.basePriorWeight * 0.35 +
        reqWeight +
        supWeight +
        ruleBonus -
        missingPenalty -
        contradictionPenalty;

      const boundedScore = Number(Math.max(0.08, Math.min(0.92, rawScore)).toFixed(2));

      const scoreLabel =
        boundedScore >= 0.65
          ? 'Moderate-Strong Rule Support'
          : boundedScore >= 0.4
            ? 'Moderate Rule Support'
            : 'Low / Tentative Evidence';

      const supportingObservations = [
        ...matchedRequired.map(labelForFact),
        ...matchedSupporting.map(labelForFact),
      ];

      const contradictoryObservations = [
        ...matchedContradictions.map((f) => `Conflicts with: ${labelForFact(f)}`),
        ...percepts.contradictoryCues,
      ];

      const missingInformation = [
        ...cause.missingInfoPrompts,
        ...percepts.missingInformation,
      ].slice(0, 5);

      const uncertaintyReasons: string[] = [];
      if (missingSupporting.length > 0 || missingInformation.length > 0) {
        uncertaintyReasons.push(
          `${missingSupporting.length} supporting indicator(s) are unverified without physical inspection or follow-up answers`
        );
      }
      if (contradictoryObservations.length > 0) {
        uncertaintyReasons.push('conflicting evidence reduced the rule score');
      }
      if (percepts.hasVisualEvidence && percepts.observedFacts.every((f) => f.source !== 'user_text')) {
        uncertaintyReasons.push('external photos cannot confirm internal electrical/mechanical faults');
      }
      if (uncertaintyReasons.length === 0) {
        uncertaintyReasons.push('non-invasive observation cannot definitively isolate internal components');
      }

      return {
        causeId: cause.id,
        faultTitle: cause.faultTitle,
        possibleCause: cause.possibleCause,
        explanation: cause.explanation,
        matchScore: boundedScore,
        scoreLabel,
        supportingObservations: Array.from(new Set(supportingObservations)).slice(0, 8),
        contradictoryObservations: Array.from(new Set(contradictoryObservations)).slice(0, 5),
        missingInformation: Array.from(new Set(missingInformation)).slice(0, 5),
        uncertaintyReason: `Rule-based score (${boundedScore}): ${uncertaintyReasons.join('; ')}.`,
        riskLevel: cause.riskLevel,
        requiresProfessional: cause.requiresProfessional,
      };
    });

    scoredHypotheses.sort((a, b) => b.matchScore - a.matchScore);

    const topScore = scoredHypotheses[0]?.matchScore ?? 0.15;
    const insufficientEvidence =
      scoredHypotheses.length === 0 ||
      topScore < 0.35 ||
      (inference.matchedRuleIds.length === 0 && percepts.canonicalFactIds.length <= 1);

    const allMissing = Array.from(
      new Set([
        ...percepts.missingInformation,
        ...(scoredHypotheses[0]?.missingInformation ?? []),
      ])
    ).slice(0, 10);

    const allContradictions = Array.from(
      new Set([
        ...percepts.contradictoryCues,
        ...(scoredHypotheses[0]?.contradictoryObservations ?? []),
      ])
    ).slice(0, 10);

    const uncertaintySummary = insufficientEvidence
      ? 'Evidence is currently insufficient or ambiguous to narrow down a single probable cause. Additional follow-up details or technician inspection are recommended rather than forcing a diagnosis.'
      : `Top candidate has a rule-based support score of ${topScore} (out of 1.0). Scores reflect knowledge-base rule alignment and missing/conflicting evidence—not a calibrated statistical probability.`;

    return {
      hypotheses: scoredHypotheses.slice(0, 10),
      confidenceScore: topScore,
      scoreDisclaimer:
        'Rule-based evidence score (0.00–1.00) derived from matched rules, observation reliability, contradictions, and missing facts—not a statistical probability.',
      insufficientEvidence,
      missingEvidence: allMissing,
      contradictoryEvidence: allContradictions,
      uncertaintySummary,
    };
  }
}

export const uncertaintyEngine = new UncertaintyEngine();
