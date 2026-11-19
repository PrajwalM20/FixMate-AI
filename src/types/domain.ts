export type UserRole = 'customer' | 'technician' | 'admin';
export type AccountStatus = 'active' | 'suspended';

export type ApplianceSlug =
  | 'refrigerator'
  | 'washing_machine'
  | 'air_conditioner'
  | 'laptop'
  | 'television'
  | 'microwave'
  | 'other';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type UrgencyLevel = 'routine' | 'soon' | 'urgent' | 'emergency';
export type NextRecommendedAction =
  | 'safe_external_checks'
  | 'ask_follow_up_questions'
  | 'continue_diagnosis'
  | 'stop_using_appliance'
  | 'contact_qualified_technician';

export type AvailabilityStatus = 'available' | 'busy' | 'offline';
export type VerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export type RepairRequestStatus =
  | 'draft'
  | 'diagnosed'
  | 'technician_requested'
  | 'booked'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type BookingStatus =
  | 'requested'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'quotation_submitted'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type QuotationStatus = 'pending' | 'accepted' | 'rejected' | 'expired';

export type ComplaintCategory =
  | 'service_quality'
  | 'pricing_dispute'
  | 'safety_concern'
  | 'no_show'
  | 'other';

export type ComplaintStatus = 'open' | 'investigating' | 'resolved' | 'dismissed';

// Synchronized verbatim with firebase-blueprint.json limits
export const VALIDATION_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  SLUG_PATTERN: /^[a-z0-9_]+$/,
  NAME_MAX: 100,
  EMAIL_MAX: 150,
  PHONE_MAX: 30,
  ADDRESS_MAX: 250,
  BIO_MAX: 1000,
  SYMPTOM_SUMMARY_MIN: 3,
  SYMPTOM_SUMMARY_MAX: 300,
  SYMPTOM_DETAILS_MIN: 0,
  SYMPTOM_DETAILS_MAX: 3000,
  IMAGE_URLS_MAX: 5,
  NOTES_MAX: 1000,
} as const;

export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  requested: ['accepted', 'rejected', 'cancelled'],
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['quotation_submitted', 'confirmed', 'in_progress', 'rejected', 'cancelled'],
  quotation_submitted: ['confirmed', 'rejected', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['completed'],
  rejected: [],
  completed: [],
  cancelled: [],
};

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  accountStatus?: AccountStatus;
  phone?: string;
  address?: string;
  photoURL?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface TechnicianProfile {
  uid: string;
  displayName: string;
  bio?: string;
  serviceCategories: ApplianceSlug[];
  skills: string[];
  experienceYears: number;
  serviceArea: string;
  availabilityStatus: AvailabilityStatus;
  verificationStatus: VerificationStatus;
  ratingAvg: number;
  completedJobs: number;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface RepairRequest {
  id: string;
  customerId: string;
  customerName: string;
  applianceCategory: ApplianceSlug;
  applianceBrand?: string;
  applianceModel?: string;
  symptomSummary: string;
  symptomDetails: string;
  imageUrls: string[];
  status: RepairRequestStatus;
  assignedTechnicianId?: string;
  latestDiagnosisId?: string;
  riskLevel: RiskLevel;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface InferenceTraceStep {
  step: number;
  ruleId: string;
  matchedFacts: string[];
  inferredFact: string;
  reason: string;
}

export interface BfsPathNode {
  nodeId: string;
  label: string;
  nodeType: 'start' | 'check' | 'cause' | 'goal_safe' | 'goal_escalate';
  level: number;
  transitionReason: string;
}

export interface BfsLevelSummary {
  level: number;
  visitedNodes: { nodeId: string; label: string; nodeType: string }[];
}

export interface DiagnosisHypothesis {
  causeId?: string;
  faultTitle: string;
  possibleCause: string;
  explanation?: string;
  matchScore: number;
  scoreLabel?: string;
  supportingObservations?: string[];
  contradictoryObservations?: string[];
  missingInformation?: string[];
  uncertaintyReason?: string;
  riskLevel: RiskLevel;
  requiresProfessional: boolean;
}

export interface FollowUpTurn {
  role: 'user' | 'agent';
  message: string;
  extractedFacts?: string[];
  timestamp: string;
}

export interface DiagnosisRecord {
  id: string;
  requestId: string;
  customerId: string;
  applianceCategory: ApplianceSlug;
  observations: string[];
  imageObservations?: string[];
  userSymptoms?: string[];
  imageUrls?: string[];
  matchedKnowledgeIds: string[];
  hypotheses: DiagnosisHypothesis[];
  followUpQuestions?: string[];
  missingEvidence?: string[];
  contradictoryEvidence?: string[];
  inferenceTrace?: InferenceTraceStep[];
  bfsSearchPath?: BfsPathNode[];
  bfsExploredLevels?: BfsLevelSummary[];
  recommendedSteps: string[];
  safetyWarnings?: string[];
  riskLevel: RiskLevel;
  urgencyLevel?: UrgencyLevel;
  nextRecommendedAction?: NextRecommendedAction;
  confidenceScore: number;
  requiresProfessional: boolean;
  engineMode: 'phase1_deterministic_stub' | 'gemini_hybrid';
  summary: string;
  followUpConversation?: FollowUpTurn[];
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BookingRecord {
  id: string;
  requestId: string;
  diagnosisId?: string;
  diagnosisSharedWithPermission?: boolean;
  sharedDiagnosisSummary?: string;
  customerId: string;
  technicianId: string;
  customerName: string;
  technicianName: string;
  applianceCategory: string;
  scheduledDate: string;
  timeSlot: string;
  slotKey?: string;
  serviceAddress: string;
  status: BookingStatus;
  notes?: string;
  rejectionReason?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface BookingSlotLock {
  id: string;
  bookingId: string;
  technicianId: string;
  customerId: string;
  scheduledDate: string;
  timeSlot: string;
  status: 'reserved' | 'released';
  createdAt: unknown;
  updatedAt: unknown;
}

export interface QuotationRecord {
  id: string;
  requestId: string;
  bookingId?: string;
  customerId: string;
  technicianId: string;
  technicianName?: string;
  laborCharge?: number;
  partsCost?: number;
  additionalCharges?: number;
  estimatedCost: number;
  currency: 'USD' | 'INR';
  estimatedCompletionTime?: string;
  proposedWorkDescription?: string;
  partsDescription: string;
  laborDescription: string;
  status: QuotationStatus;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ReviewRecord {
  id: string;
  bookingId: string;
  customerId: string;
  technicianId: string;
  customerName: string;
  rating: number;
  comment: string;
  technicianResponse?: string;
  technicianRespondedAt?: unknown;
  createdAt: unknown;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  senderId?: string;
  relatedBookingId?: string;
  relatedRequestId?: string;
  title: string;
  message: string;
  type: 'info' | 'diagnosis' | 'booking' | 'quotation' | 'review' | 'verification' | 'alert';
  read: boolean;
  linkPath?: string;
  createdAt: unknown;
}

export interface ComplaintRecord {
  id: string;
  reporterId: string;
  reporterName: string;
  reporterRole: UserRole;
  bookingId?: string;
  technicianId?: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
  status: ComplaintStatus;
  adminNotes?: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export interface ApplianceCategory {
  id: string;
  slug: ApplianceSlug;
  name: string;
  description: string;
  commonFaultsCount: number;
  isActive: boolean;
  safetyNotice: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface KnowledgeBaseEntry {
  id: string;
  applianceCategory: ApplianceSlug;
  faultTitle: string;
  observableSymptoms: string[];
  possibleCauses: string[];
  followUpQuestions: string[];
  safeTroubleshootingSteps: string[];
  riskLevel: RiskLevel;
  requiresProfessional: boolean;
  isSampleData: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string;
  status: 'new' | 'reviewed';
  createdAt: unknown;
}

export interface TechnicianMatchResult {
  technician: TechnicianProfile;
  matchScore: number; // 0..1
  matchReasons: string[];
  liveRatingAvg: number;
  reviewCount: number;
}
