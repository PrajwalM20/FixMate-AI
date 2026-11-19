import type { NextRecommendedAction, RiskLevel, UrgencyLevel } from '../../src/types/domain.ts';
import { CAUSE_DEFINITIONS, HAZARD_FACTS } from './knowledgeGraph.ts';
import type {
  PerceptBundle,
  SafetyDecision,
  SearchPlan,
  UncertaintyAssessment,
} from './types.ts';

const PROHIBITED_ADVICE_PATTERNS = [
  /open (?:the )?(?:live|electrical|rear|control|power|capacitor|panel)/i,
  /bypass (?:the )?(?:safety|interlock|fuse|switch|breaker)/i,
  /handle refrigerant|recharge freon|open refrigerant/i,
  /touch exposed wire|splice live/i,
  /disassemble (?:the )?magnetron|open microwave cabinet/i,
];

const RISK_RANK: Record<RiskLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/**
 * Decision-Making & Safety Engine
 *
 * Enforces hard safety overrides over all AI/KB outputs whenever dangerous
 * warning signs are present (smoke, burning smell, sparks, exposed wiring,
 * gas leak, water near electricals, severe overheating).
 */
export class DecisionEngine {
  decide(
    percepts: PerceptBundle,
    uncertainty: UncertaintyAssessment,
    searchPlan: SearchPlan
  ): SafetyDecision {
    const activeHazardKeys = percepts.canonicalFactIds.filter((id) => id in HAZARD_FACTS);
    const hasSevereHazard =
      activeHazardKeys.length > 0 || percepts.hazardCuesDetected.length > 0;

    const safetyWarnings: string[] = [];
    for (const hKey of activeHazardKeys) {
      if (HAZARD_FACTS[hKey]) {
        safetyWarnings.push(HAZARD_FACTS[hKey].warning);
      }
    }
    if (safetyWarnings.length === 0 && percepts.hazardCuesDetected.length > 0) {
      safetyWarnings.push(
        `High-risk warning sign(s) detected: ${percepts.hazardCuesDetected.join(', ')}. Stop using the appliance immediately if safe to do so.`
      );
    }

    // Determine risk level
    let riskLevel: RiskLevel = 'low';
    let requiresProfessional = false;

    for (const h of uncertainty.hypotheses) {
      if (RISK_RANK[h.riskLevel] > RISK_RANK[riskLevel]) {
        riskLevel = h.riskLevel;
      }
      if (h.requiresProfessional) {
        requiresProfessional = true;
      }
    }

    if (hasSevereHazard) {
      riskLevel = 'critical';
      requiresProfessional = true;
    }

    // Collect safe steps from top matched cause + BFS plan, strictly filtering unsafe instructions
    const topCauseDef = uncertainty.hypotheses[0]?.causeId
      ? CAUSE_DEFINITIONS.find((c) => c.id === uncertainty.hypotheses[0].causeId)
      : undefined;

    const rawSteps = [
      ...(topCauseDef?.safeSteps ?? []),
      ...searchPlan.recommendedSteps,
    ];

    const filteredSafeSteps = Array.from(new Set(rawSteps))
      .filter((step) => !PROHIBITED_ADVICE_PATTERNS.some((pat) => pat.test(step)))
      .slice(0, 12);

    // Emergency / Hazard Override
    if (hasSevereHazard) {
      const emergencySteps = [
        'STOP USING THE APPLIANCE IMMEDIATELY. Disconnect mains power at the breaker or wall switch only if safe to reach without touching water or exposed conductors.',
        'Keep people and pets away from the hazard area. If gas odor or active smoke/fire is present, evacuate and contact local emergency services.',
        'Do NOT open panels, bypass safety switches, or attempt DIY repairs on electrical, gas, or refrigerant parts.',
        'Contact a certified repair technician for physical on-site safety inspection.',
      ];

      return {
        riskLevel: 'critical',
        urgencyLevel: 'emergency',
        nextRecommendedAction: 'stop_using_appliance',
        requiresProfessional: true,
        safetyWarnings,
        filteredSafeSteps: emergencySteps,
        escalationReason:
          'Safety Override Active: Dangerous warning signs override DIY troubleshooting. Discontinue use and arrange qualified professional or emergency response.',
        safetyOverrideApplied: true,
      };
    }

    // Non-emergency decision routing
    let nextRecommendedAction: NextRecommendedAction = 'safe_external_checks';
    let urgencyLevel: UrgencyLevel = 'routine';
    let escalationReason =
      'Safe external checks can be performed first; contact a qualified technician if the issue persists.';

    if (uncertainty.insufficientEvidence && percepts.followUpQuestions.length > 0) {
      nextRecommendedAction = 'ask_follow_up_questions';
      urgencyLevel = riskLevel === 'high' ? 'urgent' : 'soon';
      escalationReason =
        'Evidence is incomplete or ambiguous. Answer the follow-up questions below to narrow down the fault safely.';
    } else if (requiresProfessional || riskLevel === 'high' || riskLevel === 'critical') {
      nextRecommendedAction = 'contact_qualified_technician';
      urgencyLevel = riskLevel === 'critical' ? 'emergency' : 'urgent';
      escalationReason =
        'Matched fault patterns involve internal, high-voltage, or sealed components requiring a qualified technician.';
    } else if (percepts.contradictoryCues.length > 0) {
      nextRecommendedAction = 'continue_diagnosis';
      urgencyLevel = 'soon';
      escalationReason =
        'Contradictory symptoms detected. Clarify observations via follow-up questions before taking action.';
    } else if (filteredSafeSteps.length > 0) {
      nextRecommendedAction = 'safe_external_checks';
      urgencyLevel = riskLevel === 'medium' ? 'soon' : 'routine';
    }

    if (filteredSafeSteps.length === 0) {
      filteredSafeSteps.push(
        'Unplug the appliance before inspecting external vents, hoses, or user-accessible filters.',
        'If the symptom persists or involves internal parts, book a verified technician.'
      );
    }

    return {
      riskLevel,
      urgencyLevel,
      nextRecommendedAction,
      requiresProfessional,
      safetyWarnings,
      filteredSafeSteps,
      escalationReason,
      safetyOverrideApplied: false,
    };
  }
}

export const decisionEngine = new DecisionEngine();
