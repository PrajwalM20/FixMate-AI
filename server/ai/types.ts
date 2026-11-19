import type {
  ApplianceSlug,
  BfsLevelSummary,
  BfsPathNode,
  DiagnosisHypothesis,
  FollowUpTurn,
  InferenceTraceStep,
  NextRecommendedAction,
  RiskLevel,
  UrgencyLevel,
} from '../../src/types/domain.ts';

export interface InlineImageInput {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64Data: string;
  name?: string;
}

export interface AgentInput {
  requestId?: string;
  customerId: string;
  applianceCategory: ApplianceSlug;
  applianceBrand?: string;
  applianceModel?: string;
  symptomSummary: string;
  symptomDetails: string;
  imageUrls: string[];
  inlineImages?: InlineImageInput[];
  followUpAnswers?: Record<string, string>;
  priorFacts?: string[];
  conversationHistory?: FollowUpTurn[];
}

export interface GeminiPerceptionOutput {
  problemSummary: string;
  userReportedSymptoms: string[];
  imageObservations: string[];
  matchedFactIds: string[];
  detectedWarningSigns: string[];
  missingInformation: string[];
  contradictoryCues: string[];
  followUpQuestions: string[];
}

export interface GeminiCallMeta {
  status: 'ok' | 'api_error' | 'malformed_response' | 'missing_api_key' | 'skipped';
  model: string;
  errorMessage?: string;
}

export interface ObservedFact {
  factId: string;
  source: 'user_text' | 'gemini_nlu' | 'gemini_vision' | 'follow_up_answer';
  reliability: number; // 1.0 text_direct, 0.85 gemini_nlu, 0.70 image_visual
  evidenceText: string;
}

export interface PerceptBundle {
  observedFacts: ObservedFact[];
  canonicalFactIds: string[];
  userSymptoms: string[];
  imageObservations: string[];
  extractedObservations: string[];
  hazardCuesDetected: string[];
  contradictoryCues: string[];
  missingInformation: string[];
  followUpQuestions: string[];
  problemSummary: string;
  hasVisualEvidence: boolean;
  geminiMeta: GeminiCallMeta;
}

export interface InferenceResult {
  initialFacts: string[];
  workingMemoryFacts: string[];
  inferenceTrace: InferenceTraceStep[];
  matchedRuleIds: string[];
  candidateCauseIds: string[];
  inferenceMode: 'forward_chaining_v1';
}

export interface GraphVisualEdge {
  from: string;
  to: string;
  reason: string;
  onSelectedPath: boolean;
}

export interface GraphVisualNode {
  nodeId: string;
  label: string;
  nodeType: 'start' | 'check' | 'cause' | 'goal_safe' | 'goal_escalate';
  level: number;
  onSelectedPath: boolean;
}

export interface SearchPlan {
  selectedPath: BfsPathNode[];
  exploredLevels: BfsLevelSummary[];
  graphNodes: GraphVisualNode[];
  graphEdges: GraphVisualEdge[];
  recommendedSteps: string[];
  searchStrategyNote: string;
  visitedCount: number;
}

export interface UncertaintyAssessment {
  hypotheses: DiagnosisHypothesis[];
  confidenceScore: number;
  scoreDisclaimer: string;
  insufficientEvidence: boolean;
  missingEvidence: string[];
  contradictoryEvidence: string[];
  uncertaintySummary: string;
}

export interface SafetyDecision {
  riskLevel: RiskLevel;
  urgencyLevel: UrgencyLevel;
  nextRecommendedAction: NextRecommendedAction;
  requiresProfessional: boolean;
  safetyWarnings: string[];
  filteredSafeSteps: string[];
  escalationReason: string;
  safetyOverrideApplied: boolean;
}

export interface AgentDiagnosticOutput {
  requestId?: string;
  applianceCategory: ApplianceSlug;
  problemSummary: string;
  summary: string;
  observations: string[];
  imageObservations: string[];
  userSymptoms: string[];
  imageUrls: string[];
  followUpQuestions: string[];
  matchedKnowledgeIds: string[];
  hypotheses: DiagnosisHypothesis[];
  missingEvidence: string[];
  contradictoryEvidence: string[];
  inferenceTrace: InferenceTraceStep[];
  bfsSearchPath: BfsPathNode[];
  bfsExploredLevels: BfsLevelSummary[];
  graphVisualization: {
    nodes: GraphVisualNode[];
    edges: GraphVisualEdge[];
  };
  recommendedSteps: string[];
  riskLevel: RiskLevel;
  urgencyLevel: UrgencyLevel;
  safetyWarnings: string[];
  requiresProfessional: boolean;
  nextRecommendedAction: NextRecommendedAction;
  escalationReason: string;
  confidenceScore: number;
  scoreDisclaimer: string;
  engineMode: 'gemini_hybrid' | 'phase1_deterministic_stub';
  geminiMeta: GeminiCallMeta;
  workingMemoryFacts: string[];
  pipelineTrace: {
    perception: PerceptBundle;
    inference: InferenceResult;
    searchStrategyNote: string;
    uncertaintySummary: string;
    safetyOverrideApplied: boolean;
  };
}
