import { GoogleGenAI, Type } from '@google/genai';
import type { ApplianceSlug, FollowUpTurn } from '../../src/types/domain.ts';
import { FACT_VOCABULARY, HAZARD_FACTS } from './knowledgeGraph.ts';
import type { GeminiCallMeta, GeminiPerceptionOutput, InlineImageInput } from './types.ts';

const GEMINI_MODEL = 'gemini-4-hydrogen';

const ALLOWED_STORAGE_HOSTS = new Set([
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
]);

function createClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function fetchAllowlistedStorageImage(url: string): Promise<InlineImageInput | null> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !ALLOWED_STORAGE_HOSTS.has(parsed.hostname)) {
      return null;
    }
    const res = await fetch(url);
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    if (!['image/jpeg', 'image/png', 'image/webp'].some((t) => contentType.startsWith(t))) {
      return null;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) return null;
    const mimeType = contentType.startsWith('image/png')
      ? 'image/png'
      : contentType.startsWith('image/webp')
        ? 'image/webp'
        : 'image/jpeg';
    return { mimeType, base64Data: buf.toString('base64') };
  } catch {
    return null;
  }
}

export function validateGeminiPerceptionPayload(raw: unknown): {
  valid: boolean;
  data?: GeminiPerceptionOutput;
  error?: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Gemini response is not a JSON object.' };
  }
  const obj = raw as Record<string, unknown>;

  const asStringArray = (val: unknown, field: string): string[] | null => {
    if (!Array.isArray(val)) return null;
    const cleaned = val
      .filter((x): x is string => typeof x === 'string')
      .map((s) => s.trim())
      .filter(Boolean);
    if (cleaned.length !== val.length && val.some((x) => typeof x !== 'string')) {
      throw new Error(`Field ${field} must contain strings.`);
    }
    return cleaned.slice(0, 15);
  };

  try {
    if (typeof obj.problemSummary !== 'string' || obj.problemSummary.trim().length < 5) {
      return { valid: false, error: 'Missing or invalid problemSummary in Gemini JSON.' };
    }
    const userReportedSymptoms = asStringArray(obj.userReportedSymptoms, 'userReportedSymptoms');
    const imageObservations = asStringArray(obj.imageObservations, 'imageObservations');
    const matchedFactIds = asStringArray(obj.matchedFactIds, 'matchedFactIds');
    const detectedWarningSigns = asStringArray(obj.detectedWarningSigns, 'detectedWarningSigns');
    const missingInformation = asStringArray(obj.missingInformation, 'missingInformation');
    const contradictoryCues = asStringArray(obj.contradictoryCues, 'contradictoryCues');
    const followUpQuestions = asStringArray(obj.followUpQuestions, 'followUpQuestions');

    if (
      !userReportedSymptoms ||
      !imageObservations ||
      !matchedFactIds ||
      !detectedWarningSigns ||
      !missingInformation ||
      !contradictoryCues ||
      !followUpQuestions
    ) {
      return { valid: false, error: 'One or more required arrays missing in Gemini JSON.' };
    }

    return {
      valid: true,
      data: {
        problemSummary: obj.problemSummary.trim().slice(0, 600),
        userReportedSymptoms,
        imageObservations,
        matchedFactIds,
        detectedWarningSigns,
        missingInformation,
        contradictoryCues,
        followUpQuestions,
      },
    };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Schema validation failed.',
    };
  }
}

export class GeminiIntegrationService {
  getStatus() {
    return {
      service: 'GeminiIntegrationService',
      phase: 'Phase 2 Live Server-Side Multimodal & NLU Integration',
      model: GEMINI_MODEL,
      readyForPhase2: true,
      serverKeyPresent: Boolean(process.env.GEMINI_API_KEY?.trim()),
    };
  }

  async perceiveSymptomsAndImages(params: {
    applianceCategory: ApplianceSlug;
    applianceBrand?: string;
    applianceModel?: string;
    symptomSummary: string;
    symptomDetails: string;
    imageUrls: string[];
    inlineImages?: InlineImageInput[];
    followUpAnswers?: Record<string, string>;
    conversationHistory?: FollowUpTurn[];
  }): Promise<{
    perception: GeminiPerceptionOutput | null;
    meta: GeminiCallMeta;
  }> {
    const ai = createClient();
    if (!ai) {
      return {
        perception: null,
        meta: {
          status: 'missing_api_key',
          model: GEMINI_MODEL,
          errorMessage:
            'GEMINI_API_KEY is not configured on the server. Configure it in Settings > Secrets to enable Gemini multimodal perception.',
        },
      };
    }

    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];

    if (params.inlineImages && params.inlineImages.length > 0) {
      for (const img of params.inlineImages.slice(0, 3)) {
        imageParts.push({
          inlineData: {
            mimeType: img.mimeType,
            data: img.base64Data,
          },
        });
      }
    } else if (params.imageUrls && params.imageUrls.length > 0) {
      for (const url of params.imageUrls.slice(0, 3)) {
        const fetched = await fetchAllowlistedStorageImage(url);
        if (fetched) {
          imageParts.push({
            inlineData: {
              mimeType: fetched.mimeType,
              data: fetched.base64Data,
            },
          });
        }
      }
    }

    const factVocabList = FACT_VOCABULARY.map((f) => `${f.id}: ${f.label}`).join('\n');
    const hazardVocabList = Object.entries(HAZARD_FACTS)
      .map(([id, h]) => `${id}: ${h.label}`)
      .join('\n');

    const followUpBlock =
      params.followUpAnswers && Object.keys(params.followUpAnswers).length > 0
        ? `\nUser answers to follow-up questions:\n${Object.entries(params.followUpAnswers)
            .map(([q, a]) => `- Q: ${q}\n  A: ${a}`)
            .join('\n')}`
        : '';

    const historyBlock =
      params.conversationHistory && params.conversationHistory.length > 0
        ? `\nPrior conversation turns:\n${params.conversationHistory
            .map((t) => `[${t.role.toUpperCase()}]: ${t.message}`)
            .join('\n')}`
        : '';

    const prompt = `Analyze the following appliance troubleshooting submission as a perception & NLU extractor.
Appliance Category: ${params.applianceCategory}
Brand/Model: ${[params.applianceBrand, params.applianceModel].filter(Boolean).join(' ') || 'Not specified'}
Symptom Summary: ${params.symptomSummary || 'Not provided (check images)'}
Detailed Description: ${params.symptomDetails || 'Not provided (check images)'}${followUpBlock}${historyBlock}

Canonical Fact IDs (pick ONLY those clearly supported by user text, answers, or visible evidence):
${factVocabList}

Hazard Fact IDs (pick ONLY if explicitly reported or visibly evident):
${hazardVocabList}

Rules:
1. Never treat an image as proof of an internal mechanical or electrical fault; only report visible features (display codes, frost, water, dust, scorch marks, indicator lights, damaged cords).
2. Do not invent symptoms that were not reported or visible.
3. If details are sparse or ambiguous, populate missingInformation and generate 2-4 concise, non-hazardous followUpQuestions.
4. If the user's description contradicts itself or the image, list it in contradictoryCues.`;

    try {
      const contents =
        imageParts.length > 0
          ? { parts: [...imageParts, { text: prompt }] }
          : prompt;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents,
        config: {
          systemInstruction:
            'You are FixMate AI Perception Module. Extract structured observations, canonical fact IDs, visible image cues, missing details, contradictions, and safe follow-up questions as valid JSON matching the schema. Never recommend opening live electrical parts or handling refrigerants/gas.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problemSummary: {
                type: Type.STRING,
                description: 'Concise 1-2 sentence neutral summary of the reported appliance problem.',
              },
              userReportedSymptoms: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Normalized list of symptoms explicitly mentioned by the user.',
              },
              imageObservations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Visible features observed in uploaded images (empty array if no images).',
              },
              matchedFactIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Canonical Fact IDs and Hazard Fact IDs supported by input.',
              },
              detectedWarningSigns: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Any dangerous warning signs detected (smoke, burning smell, sparks, exposed wiring, gas leak, water near electrical, severe overheating).',
              },
              missingInformation: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Key diagnostic facts that are currently unknown or missing.',
              },
              contradictoryCues: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Any conflicting statements or visual contradictions.',
              },
              followUpQuestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2-4 targeted, safe diagnostic questions for the customer.',
              },
            },
            required: [
              'problemSummary',
              'userReportedSymptoms',
              'imageObservations',
              'matchedFactIds',
              'detectedWarningSigns',
              'missingInformation',
              'contradictoryCues',
              'followUpQuestions',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        return {
          perception: null,
          meta: {
            status: 'malformed_response',
            model: GEMINI_MODEL,
            errorMessage: 'Gemini returned non-JSON output.',
          },
        };
      }

      const validated = validateGeminiPerceptionPayload(parsedJson);
      if (!validated.valid || !validated.data) {
        return {
          perception: null,
          meta: {
            status: 'malformed_response',
            model: GEMINI_MODEL,
            errorMessage: validated.error || 'Gemini JSON failed schema validation.',
          },
        };
      }

      return {
        perception: validated.data,
        meta: {
          status: 'ok',
          model: GEMINI_MODEL,
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gemini API call failed.';
      console.error('Gemini perception error:', msg);
      return {
        perception: null,
        meta: {
          status: 'api_error',
          model: GEMINI_MODEL,
          errorMessage: msg,
        },
      };
    }
  }
}

export const geminiService = new GeminiIntegrationService();
