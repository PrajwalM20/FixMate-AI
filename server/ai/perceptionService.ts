import { geminiService } from './geminiService.ts';
import { FACT_VOCABULARY, HAZARD_FACTS } from './knowledgeGraph.ts';
import type { AgentInput, ObservedFact, PerceptBundle } from './types.ts';

const VALID_FACT_IDS = new Set([
  ...FACT_VOCABULARY.map((f) => f.id),
  ...Object.keys(HAZARD_FACTS),
]);

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function extractDeterministicFacts(text: string): {
  facts: ObservedFact[];
  hazards: string[];
  contradictions: string[];
} {
  const norm = normalizeText(text);
  const facts: ObservedFact[] = [];
  const hazards: string[] = [];
  const seen = new Set<string>();

  for (const [hazardId, def] of Object.entries(HAZARD_FACTS)) {
    if (def.keywords.some((kw) => norm.includes(normalizeText(kw)))) {
      if (!seen.has(hazardId)) {
        seen.add(hazardId);
        facts.push({
          factId: hazardId,
          source: 'user_text',
          reliability: 1.0,
          evidenceText: def.label,
        });
      }
      hazards.push(def.label);
    }
  }

  for (const desc of FACT_VOCABULARY) {
    if (desc.keywords.some((kw) => norm.includes(normalizeText(kw)))) {
      if (!seen.has(desc.id)) {
        seen.add(desc.id);
        facts.push({
          factId: desc.id,
          source: 'user_text',
          reliability: 1.0,
          evidenceText: desc.label,
        });
      }
    }
  }

  const contradictions: string[] = [];
  if (seen.has('no_power') && seen.has('appliance_running')) {
    contradictions.push(
      'Input mentions both complete loss of power and active motor/fan/light operation.'
    );
  }
  if (seen.has('freezer_cold') && seen.has('freezer_warm')) {
    contradictions.push('Input mentions the freezer being both cold and warm.');
  }

  return { facts, hazards, contradictions };
}

export class PerceptionService {
  async perceive(input: AgentInput): Promise<PerceptBundle> {
    const combinedText = [
      input.symptomSummary,
      input.symptomDetails,
      ...(input.followUpAnswers
        ? Object.entries(input.followUpAnswers).map(([q, a]) => `${q} ${a}`)
        : []),
    ]
      .filter(Boolean)
      .join(' ');

    const hasImages =
      (input.inlineImages && input.inlineImages.length > 0) ||
      (input.imageUrls && input.imageUrls.length > 0);

    // Run deterministic lexical fact extraction as reliable ground truth
    const det = extractDeterministicFacts(combinedText);

    // Call Gemini server-side multimodal & NLU perception
    const geminiResult = await geminiService.perceiveSymptomsAndImages({
      applianceCategory: input.applianceCategory,
      applianceBrand: input.applianceBrand,
      applianceModel: input.applianceModel,
      symptomSummary: input.symptomSummary,
      symptomDetails: input.symptomDetails,
      imageUrls: input.imageUrls,
      inlineImages: input.inlineImages,
      followUpAnswers: input.followUpAnswers,
      conversationHistory: input.conversationHistory,
    });

    // If image-only submission has no meaningful text and Gemini failed, throw an explicit error
    if (!combinedText.trim() && hasImages && !geminiResult.perception) {
      throw new Error(
        geminiResult.meta.errorMessage ||
          'Image-only analysis requires Gemini Vision, which failed or is unavailable.'
      );
    }

    const factMap = new Map<string, ObservedFact>();

    // Preserve prior session facts if continuing follow-up conversation
    for (const priorId of input.priorFacts ?? []) {
      if (VALID_FACT_IDS.has(priorId)) {
        factMap.set(priorId, {
          factId: priorId,
          source: 'follow_up_answer',
          reliability: 0.95,
          evidenceText: `Prior confirmed fact: ${priorId.replace(/_/g, ' ')}`,
        });
      }
    }

    // Add deterministic facts from direct user text
    for (const f of det.facts) {
      factMap.set(f.factId, f);
    }

    // Merge Gemini-perceived canonical facts (respecting controlled vocabulary)
    const gemini = geminiResult.perception;
    if (gemini) {
      for (const factId of gemini.matchedFactIds) {
        if (VALID_FACT_IDS.has(factId) && !factMap.has(factId)) {
          const isHazard = factId in HAZARD_FACTS;
          const desc = FACT_VOCABULARY.find((v) => v.id === factId);
          factMap.set(factId, {
            factId,
            source: hasImages && !combinedText.trim() ? 'gemini_vision' : 'gemini_nlu',
            reliability: hasImages && !combinedText.trim() ? 0.7 : 0.85,
            evidenceText:
              desc?.label || HAZARD_FACTS[factId]?.label || factId.replace(/_/g, ' '),
          });
          if (isHazard && HAZARD_FACTS[factId]) {
            det.hazards.push(HAZARD_FACTS[factId].label);
          }
        }
      }
    }

    const observedFacts = Array.from(factMap.values());
    const canonicalFactIds = observedFacts.map((f) => f.factId);

    const userSymptoms = Array.from(
      new Set([
        ...(gemini?.userReportedSymptoms ?? []),
        ...(input.symptomSummary.trim() ? [input.symptomSummary.trim()] : []),
      ])
    ).slice(0, 20);

    const imageObservations = (gemini?.imageObservations ?? []).slice(0, 15);

    const hazardCuesDetected = Array.from(
      new Set([...det.hazards, ...(gemini?.detectedWarningSigns ?? [])])
    ).slice(0, 10);

    const contradictoryCues = Array.from(
      new Set([...det.contradictions, ...(gemini?.contradictoryCues ?? [])])
    ).slice(0, 10);

    const missingInformation = (gemini?.missingInformation ?? []).slice(0, 15);
    const followUpQuestions = (gemini?.followUpQuestions ?? []).slice(0, 10);

    const extractedObservations = Array.from(
      new Set([
        ...userSymptoms.map((s) => `Symptom: ${s}`),
        ...imageObservations.map((o) => `Visual cue: ${o}`),
        ...observedFacts.map((f) => `Fact [${f.factId}]: ${f.evidenceText}`),
      ])
    ).slice(0, 25);

    const problemSummary =
      gemini?.problemSummary ||
      `Customer reported ${input.applianceCategory.replace(/_/g, ' ')} issue: ${
        input.symptomSummary || 'visual image inspection'
      }.`;

    return {
      observedFacts,
      canonicalFactIds,
      userSymptoms,
      imageObservations,
      extractedObservations,
      hazardCuesDetected,
      contradictoryCues,
      missingInformation,
      followUpQuestions,
      problemSummary,
      hasVisualEvidence: Boolean(hasImages),
      geminiMeta: geminiResult.meta,
    };
  }
}

export const perceptionService = new PerceptionService();
