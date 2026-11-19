import { VALIDATION_LIMITS } from '../../src/types/domain.ts';
import type { ApplianceSlug, FollowUpTurn, RiskLevel } from '../../src/types/domain.ts';
import type { InlineImageInput } from './types.ts';

export interface ValidatedDiagnosisRequestPayload {
  requestId?: string;
  applianceCategory: ApplianceSlug;
  applianceBrand?: string;
  applianceModel?: string;
  symptomSummary: string;
  symptomDetails: string;
  imageUrls: string[];
  inlineImages: InlineImageInput[];
  followUpAnswers?: Record<string, string>;
  priorFacts?: string[];
  conversationHistory?: FollowUpTurn[];
}

const ALLOWED_CATEGORIES: ReadonlySet<string> = new Set([
  'refrigerator',
  'washing_machine',
  'air_conditioner',
  'laptop',
  'television',
  'microwave',
  'other',
]);

const ALLOWED_RISK_LEVELS: ReadonlySet<string> = new Set([
  'low',
  'medium',
  'high',
  'critical',
]);

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class DatabaseService {
  validateDiagnosisInput(body: unknown): {
    valid: boolean;
    error?: string;
    data?: ValidatedDiagnosisRequestPayload;
  } {
    if (!body || typeof body !== 'object') {
      return { valid: false, error: 'Request payload must be a JSON object.' };
    }

    const record = body as Record<string, unknown>;
    const applianceCategory = String(record.applianceCategory ?? '');
    if (!ALLOWED_CATEGORIES.has(applianceCategory)) {
      return { valid: false, error: 'Invalid applianceCategory.' };
    }

    const symptomSummary =
      typeof record.symptomSummary === 'string' ? record.symptomSummary.trim() : '';
    const symptomDetails =
      typeof record.symptomDetails === 'string' ? record.symptomDetails.trim() : '';

    const rawImages = Array.isArray(record.imageUrls) ? record.imageUrls : [];
    if (rawImages.length > VALIDATION_LIMITS.IMAGE_URLS_MAX) {
      return {
        valid: false,
        error: `At most ${VALIDATION_LIMITS.IMAGE_URLS_MAX} image URLs are allowed.`,
      };
    }
    const imageUrls = rawImages
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .slice(0, VALIDATION_LIMITS.IMAGE_URLS_MAX);

    const rawInline = Array.isArray(record.inlineImages) ? record.inlineImages : [];
    if (rawInline.length > 3) {
      return { valid: false, error: 'At most 3 uploaded image payloads can be analyzed per turn.' };
    }

    const inlineImages: InlineImageInput[] = [];
    for (const item of rawInline) {
      if (!item || typeof item !== 'object') {
        return { valid: false, error: 'Invalid image payload format.' };
      }
      const imgObj = item as Record<string, unknown>;
      const mime = String(imgObj.mimeType ?? '');
      const base64Data = typeof imgObj.base64Data === 'string' ? imgObj.base64Data.trim() : '';
      if (!ALLOWED_IMAGE_MIME_TYPES.has(mime)) {
        return {
          valid: false,
          error: `Unsupported image type "${mime}". Only JPEG, PNG, and WebP images are permitted.`,
        };
      }
      if (!base64Data || base64Data.length > 7 * 1024 * 1024) {
        return {
          valid: false,
          error: 'Image payload is empty or exceeds the 5 MB limit.',
        };
      }
      inlineImages.push({
        mimeType: mime as InlineImageInput['mimeType'],
        base64Data,
        name: typeof imgObj.name === 'string' ? imgObj.name.slice(0, 80) : undefined,
      });
    }

    const hasAnyImage = imageUrls.length > 0 || inlineImages.length > 0;
    const hasAnyText = symptomSummary.length >= 3 || symptomDetails.length >= 5;

    if (!hasAnyImage && !hasAnyText) {
      return {
        valid: false,
        error: 'Provide either a symptom description or at least one appliance image.',
      };
    }

    if (symptomSummary.length > VALIDATION_LIMITS.SYMPTOM_SUMMARY_MAX) {
      return {
        valid: false,
        error: `symptomSummary cannot exceed ${VALIDATION_LIMITS.SYMPTOM_SUMMARY_MAX} characters.`,
      };
    }
    if (symptomDetails.length > VALIDATION_LIMITS.SYMPTOM_DETAILS_MAX) {
      return {
        valid: false,
        error: `symptomDetails cannot exceed ${VALIDATION_LIMITS.SYMPTOM_DETAILS_MAX} characters.`,
      };
    }

    const effectiveSummary =
      symptomSummary.length >= 3
        ? symptomSummary
        : symptomDetails.slice(0, 120) || `Visual inspection for ${applianceCategory.replace(/_/g, ' ')}`;

    const requestId =
      typeof record.requestId === 'string' && VALIDATION_LIMITS.ID_PATTERN.test(record.requestId)
        ? record.requestId.slice(0, VALIDATION_LIMITS.ID_MAX)
        : undefined;

    const applianceBrand =
      typeof record.applianceBrand === 'string' ? record.applianceBrand.trim().slice(0, 80) : undefined;
    const applianceModel =
      typeof record.applianceModel === 'string' ? record.applianceModel.trim().slice(0, 80) : undefined;

    const priorFacts = Array.isArray(record.priorFacts)
      ? record.priorFacts.filter((x): x is string => typeof x === 'string').slice(0, 40)
      : undefined;

    const conversationHistory = Array.isArray(record.conversationHistory)
      ? (record.conversationHistory as FollowUpTurn[]).slice(-20)
      : undefined;

    return {
      valid: true,
      data: {
        requestId,
        applianceCategory: applianceCategory as ApplianceSlug,
        applianceBrand,
        applianceModel,
        symptomSummary: effectiveSummary,
        symptomDetails,
        imageUrls,
        inlineImages,
        followUpAnswers:
          record.followUpAnswers && typeof record.followUpAnswers === 'object'
            ? (record.followUpAnswers as Record<string, string>)
            : undefined,
        priorFacts,
        conversationHistory,
      },
    };
  }

  validateKnowledgeBaseDraft(body: unknown): { valid: boolean; error?: string } {
    if (!body || typeof body !== 'object') {
      return { valid: false, error: 'Payload must be an object.' };
    }
    const r = body as Record<string, unknown>;
    if (typeof r.faultTitle !== 'string' || r.faultTitle.trim().length < 3 || r.faultTitle.length > 160) {
      return { valid: false, error: 'faultTitle must be 3-160 characters.' };
    }
    if (!ALLOWED_CATEGORIES.has(String(r.applianceCategory))) {
      return { valid: false, error: 'Invalid applianceCategory.' };
    }
    if (!ALLOWED_RISK_LEVELS.has(String(r.riskLevel as RiskLevel))) {
      return { valid: false, error: 'Invalid riskLevel.' };
    }
    return { valid: true };
  }
}

export const databaseService = new DatabaseService();
