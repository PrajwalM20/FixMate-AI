import { SAMPLE_APPLIANCE_CATEGORIES, SAMPLE_KNOWLEDGE_BASE } from '../../src/data/sampleKnowledgeBase.ts';
import type { ApplianceCategory, ApplianceSlug, KnowledgeBaseEntry } from '../../src/types/domain.ts';
import type { PerceptBundle } from './types.ts';

export interface KnowledgeMatch {
  entry: KnowledgeBaseEntry;
  overlapScore: number;
  matchedSymptoms: string[];
}

/**
 * Knowledge Base Service
 *
 * Retrieves structured fault frames matching an appliance category and scores
 * observable symptom overlap. Uses the structured appliance knowledge base
 * while remaining schema-compatible with Firestore `knowledgeBase`.
 */
export class KnowledgeBaseService {
  getCategories(): ApplianceCategory[] {
    return SAMPLE_APPLIANCE_CATEGORIES;
  }

  getAllEntries(): KnowledgeBaseEntry[] {
    return SAMPLE_KNOWLEDGE_BASE;
  }

  queryCandidates(category: ApplianceSlug, percepts: PerceptBundle): KnowledgeMatch[] {
    const categoryEntries = SAMPLE_KNOWLEDGE_BASE.filter(
      (entry) => entry.applianceCategory === category
    );

    const tokenSet = new Set(
      [...percepts.userSymptoms, ...percepts.extractedObservations, ...percepts.canonicalFactIds]
        .join(' ')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3)
    );

    const scored: KnowledgeMatch[] = categoryEntries.map((entry) => {
      const matchedSymptoms: string[] = [];
      let hits = 0;

      for (const symptom of entry.observableSymptoms) {
        const symptomWords = symptom
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length >= 3);

        const wordMatches = symptomWords.filter((w) => tokenSet.has(w));
        if (wordMatches.length > 0) {
          hits += wordMatches.length;
          matchedSymptoms.push(symptom);
        }
      }

      const maxPossible = Math.max(entry.observableSymptoms.length * 2, 1);
      const overlapScore = Math.min(1, Number((hits / maxPossible).toFixed(2)));

      return {
        entry,
        overlapScore,
        matchedSymptoms,
      };
    });

    return scored.sort((a, b) => b.overlapScore - a.overlapScore);
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();
