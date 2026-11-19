import { decisionEngine } from './decisionEngine.ts';
import { geminiService } from './geminiService.ts';
import { inferenceEngine } from './inferenceEngine.ts';
import { perceptionService } from './perceptionService.ts';
import { searchEngine } from './searchEngine.ts';
import type { AgentDiagnosticOutput, AgentInput } from './types.ts';
import { uncertaintyEngine } from './uncertaintyEngine.ts';

/**
 * Intelligent Troubleshooting Agent Controller (Phase 2 Hybrid Architecture)
 *
 * Orchestrates:
 * 1. Gemini Multimodal & NLU Perception + Deterministic Backup (PerceptionService)
 * 2. Iterative Forward Chaining Rule Inference (InferenceEngine)
 * 3. Queue-Based Breadth-First Search over Troubleshooting Graph (SearchEngine)
 * 4. Transparent Evidence-Based Uncertainty Scoring (UncertaintyEngine)
 * 5. Hard Safety-Override Decision Engine (DecisionEngine)
 */
export class AgentController {
  async runDiagnosticCycle(input: AgentInput): Promise<AgentDiagnosticOutput> {
    // 1. Perception (Gemini NLU / Vision + Canonical Fact Extraction)
    const percepts = await perceptionService.perceive(input);

    // 2. Forward Chaining Inference
    const inference = inferenceEngine.runForwardChaining(
      input.applianceCategory,
      percepts.canonicalFactIds
    );

    // 3. Breadth-First Search (BFS) Troubleshooting Path Exploration
    const searchPlan = searchEngine.searchTroubleshootingGraph(
      input.applianceCategory,
      inference.workingMemoryFacts
    );

    // 4. Uncertainty Reasoning & Hypothesis Ranking
    const uncertainty = uncertaintyEngine.assess(
      input.applianceCategory,
      percepts,
      inference
    );

    // 5. Safety & Decision Engine
    const decision = decisionEngine.decide(percepts, uncertainty, searchPlan);

    // Build human-readable summary
    const topHypothesis = uncertainty.hypotheses[0];
    const summary = decision.safetyOverrideApplied
      ? `SAFETY WARNING: ${decision.safetyWarnings[0]} ${decision.escalationReason}`
      : uncertainty.insufficientEvidence
        ? `${percepts.problemSummary} ${uncertainty.uncertaintySummary}`
        : `${percepts.problemSummary} Top rule-supported possibility: "${
            topHypothesis?.faultTitle ?? 'General Inspection'
          }" (rule score: ${uncertainty.confidenceScore}). ${decision.escalationReason}`;

    const followUpQuestions = Array.from(
      new Set([
        ...percepts.followUpQuestions,
        ...(topHypothesis?.missingInformation ?? []),
      ])
    ).slice(0, 6);

    return {
      requestId: input.requestId,
      applianceCategory: input.applianceCategory,
      problemSummary: percepts.problemSummary,
      summary,
      observations: percepts.extractedObservations,
      imageObservations: percepts.imageObservations,
      userSymptoms: percepts.userSymptoms,
      imageUrls: input.imageUrls,
      followUpQuestions,
      matchedKnowledgeIds: inference.matchedRuleIds,
      hypotheses: uncertainty.hypotheses,
      missingEvidence: uncertainty.missingEvidence,
      contradictoryEvidence: uncertainty.contradictoryEvidence,
      inferenceTrace: inference.inferenceTrace,
      bfsSearchPath: searchPlan.selectedPath,
      bfsExploredLevels: searchPlan.exploredLevels,
      graphVisualization: {
        nodes: searchPlan.graphNodes,
        edges: searchPlan.graphEdges,
      },
      recommendedSteps: decision.filteredSafeSteps,
      riskLevel: decision.riskLevel,
      urgencyLevel: decision.urgencyLevel,
      safetyWarnings: decision.safetyWarnings,
      requiresProfessional: decision.requiresProfessional,
      nextRecommendedAction: decision.nextRecommendedAction,
      escalationReason: decision.escalationReason,
      confidenceScore: uncertainty.confidenceScore,
      scoreDisclaimer: uncertainty.scoreDisclaimer,
      engineMode: percepts.geminiMeta.status === 'ok' ? 'gemini_hybrid' : 'phase1_deterministic_stub',
      geminiMeta: percepts.geminiMeta,
      workingMemoryFacts: inference.workingMemoryFacts,
      pipelineTrace: {
        perception: percepts,
        inference,
        searchStrategyNote: searchPlan.searchStrategyNote,
        uncertaintySummary: uncertainty.uncertaintySummary,
        safetyOverrideApplied: decision.safetyOverrideApplied,
      },
    };
  }

  getArchitectureManifest() {
    return {
      system: 'FixMate AI Hybrid Troubleshooting Agent',
      phase: 'Phase 3 — Live Voice + Gemini Multimodal + Coded Reasoning Engine + Marketplace',
      modules: [
        {
          name: 'AgentController',
          status: 'active_hybrid_orchestrator',
          phase2Target: 'Orchestrates Perception -> Forward Chaining -> BFS -> Uncertainty -> Safety',
        },
        {
          name: 'GeminiIntegrationService',
          status: 'active_gemini_4_hydrogen',
          phase2Target: 'Server-side multimodal vision & NLU JSON extraction with schema validation',
        },
        {
          name: 'GeminiLiveVoiceService',
          status: 'active_gemini_3_8_live',
          phase2Target: 'Real-time 16kHz/24kHz bidirectional voice troubleshooting over WebSocket',
        },
        {
          name: 'PerceptionService',
          status: 'active_hybrid_perceptor',
          phase2Target: 'Combines Gemini observations with canonical fact vocabulary & reliability tags',
        },
        {
          name: 'KnowledgeBaseService',
          status: 'active_structured_kb',
          phase2Target: 'Facts, IF/THEN rules, causes, and state-space troubleshooting graphs',
        },
        {
          name: 'InferenceEngine',
          status: 'active_forward_chaining',
          phase2Target: 'Iterative working-memory forward chaining with inspectable rule trace',
        },
        {
          name: 'SearchEngine',
          status: 'active_bfs_graph_search',
          phase2Target: 'FIFO queue Breadth-First Search with visited tracking & path reconstruction',
        },
        {
          name: 'UncertaintyEngine',
          status: 'active_evidence_scorer',
          phase2Target: 'Rule-based evidence, contradiction, and missing-information scoring',
        },
        {
          name: 'DecisionEngine',
          status: 'active_safety_override',
          phase2Target: 'Hazard overrides, forbidden-repair filtering, and next-action selection',
        },
      ],
      geminiStatus: geminiService.getStatus(),
    };
  }
}

export const agentController = new AgentController();
