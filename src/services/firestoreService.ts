import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  SAMPLE_APPLIANCE_CATEGORIES,
  SAMPLE_KNOWLEDGE_BASE,
  VERIFIED_TECHNICIANS_DIRECTORY,
} from '../data/sampleKnowledgeBase.ts';
import { db, storage } from '../lib/firebase.ts';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors.ts';
import {
  ALLOWED_BOOKING_TRANSITIONS,
  VALIDATION_LIMITS,
  type AccountStatus,
  type ApplianceCategory,
  type AvailabilityStatus,
  type BfsLevelSummary,
  type BfsPathNode,
  type BookingRecord,
  type BookingSlotLock,
  type BookingStatus,
  type ComplaintCategory,
  type ComplaintRecord,
  type ComplaintStatus,
  type ContactInquiry,
  type DiagnosisRecord,
  type FollowUpTurn,
  type InferenceTraceStep,
  type KnowledgeBaseEntry,
  type NextRecommendedAction,
  type NotificationRecord,
  type QuotationRecord,
  type RepairRequest,
  type RepairRequestStatus,
  type ReviewRecord,
  type TechnicianProfile,
  type UrgencyLevel,
  type UserProfile,
  type UserRole,
  type VerificationStatus,
} from '../types/domain.ts';

function sanitizeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

function clampStr(val: string | undefined, max: number): string {
  return (val ?? '').trim().slice(0, max);
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        clean[k] = stripUndefined(v);
      }
    }
    return clean as T;
  }
  return value;
}

function clampStringList(list: string[] | undefined, maxItems: number, maxLen = 400): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim().slice(0, maxLen))
    .slice(0, maxItems);
}

function timestampToMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  if (typeof ts === 'string') return Date.parse(ts) || 0;
  if (typeof ts === 'object') {
    const maybe = ts as { toMillis?: () => number; seconds?: number };
    if (typeof maybe.toMillis === 'function') return maybe.toMillis();
    if (typeof maybe.seconds === 'number') return maybe.seconds * 1000;
  }
  return 0;
}

function sortByCreatedDesc<T extends { createdAt?: unknown }>(items: T[]): T[] {
  return [...items].sort((a, b) => timestampToMs(b.createdAt) - timestampToMs(a.createdAt));
}

export function buildBookingSlotKey(
  technicianId: string,
  scheduledDate: string,
  timeSlot: string
): string {
  const safeTech = technicianId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeDate = scheduledDate.replace(/[^0-9-]/g, '');
  const safeSlot = timeSlot
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `slot_${safeTech}_${safeDate}_${safeSlot}`.slice(0, 128);
}

async function trySendNotification(params: {
  userId: string;
  senderId?: string;
  relatedBookingId?: string;
  relatedRequestId?: string;
  title: string;
  message: string;
  type: NotificationRecord['type'];
  linkPath?: string;
}): Promise<void> {
  try {
    await createNotification(params);
  } catch (err) {
    console.warn('Non-blocking notification creation skipped:', err);
  }
}

// ---------------------------------------------------------------------------
// Image Storage Upload
// ---------------------------------------------------------------------------
export async function uploadApplianceImage(uid: string, file: File): Promise<string> {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are supported.');
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('Image size must be 5 MB or less.');
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const storageRef = ref(storage, `repair-images/${uid}/${Date.now()}_${safeName}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

// ---------------------------------------------------------------------------
// Users & Technicians
// ---------------------------------------------------------------------------
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createUserProfile(params: {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
  phone?: string;
  address?: string;
  photoURL?: string;
}): Promise<void> {
  const path = `users/${params.uid}`;
  try {
    const payload: Record<string, unknown> = {
      uid: params.uid,
      displayName: clampStr(params.displayName, VALIDATION_LIMITS.NAME_MAX) || 'FixMate User',
      email: clampStr(params.email, VALIDATION_LIMITS.EMAIL_MAX),
      role: params.role,
      accountStatus: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.phone) payload.phone = clampStr(params.phone, VALIDATION_LIMITS.PHONE_MAX);
    if (params.address) payload.address = clampStr(params.address, VALIDATION_LIMITS.ADDRESS_MAX);
    if (params.photoURL) payload.photoURL = clampStr(params.photoURL, 500);

    await setDoc(doc(db, 'users', params.uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateUserProfileDoc(
  uid: string,
  updates: { displayName: string; phone?: string; address?: string }
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName: clampStr(updates.displayName, VALIDATION_LIMITS.NAME_MAX),
      phone: clampStr(updates.phone, VALIDATION_LIMITS.PHONE_MAX),
      address: clampStr(updates.address, VALIDATION_LIMITS.ADDRESS_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createTechnicianProfile(params: {
  uid: string;
  displayName: string;
  bio?: string;
  serviceCategories: TechnicianProfile['serviceCategories'];
  skills: string[];
  experienceYears: number;
  serviceArea: string;
}): Promise<void> {
  const path = `technicians/${params.uid}`;
  try {
    await setDoc(doc(db, 'technicians', params.uid), {
      uid: params.uid,
      displayName: clampStr(params.displayName, VALIDATION_LIMITS.NAME_MAX) || 'Technician',
      bio: clampStr(params.bio, VALIDATION_LIMITS.BIO_MAX),
      serviceCategories: params.serviceCategories.slice(0, 10),
      skills: params.skills.slice(0, 15),
      experienceYears: Math.max(0, Math.min(80, Number(params.experienceYears) || 0)),
      serviceArea: clampStr(params.serviceArea, 120) || 'Metro Service Zone',
      availabilityStatus: 'available',
      verificationStatus: 'pending',
      ratingAvg: 0,
      completedJobs: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getTechnicianProfile(uid: string): Promise<TechnicianProfile | null> {
  const path = `technicians/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'technicians', uid));
    return snap.exists() ? (snap.data() as TechnicianProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function updateTechnicianProfileDoc(
  uid: string,
  updates: {
    displayName: string;
    bio: string;
    serviceCategories: TechnicianProfile['serviceCategories'];
    skills: string[];
    experienceYears: number;
    serviceArea: string;
    availabilityStatus: AvailabilityStatus;
  }
): Promise<void> {
  const path = `technicians/${uid}`;
  try {
    await updateDoc(doc(db, 'technicians', uid), {
      displayName: clampStr(updates.displayName, VALIDATION_LIMITS.NAME_MAX),
      bio: clampStr(updates.bio, VALIDATION_LIMITS.BIO_MAX),
      serviceCategories: updates.serviceCategories.slice(0, 10),
      skills: updates.skills.slice(0, 15),
      experienceYears: Math.max(0, Math.min(80, Number(updates.experienceYears) || 0)),
      serviceArea: clampStr(updates.serviceArea, 120),
      availabilityStatus: updates.availabilityStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function listVerifiedTechnicians(): Promise<TechnicianProfile[]> {
  const path = 'technicians';
  try {
    const q = query(
      collection(db, 'technicians'),
      where('verificationStatus', '==', 'verified')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as TechnicianProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

// ---------------------------------------------------------------------------
// Repair Requests & Diagnoses
// ---------------------------------------------------------------------------
export async function createRepairRequest(params: {
  customerId: string;
  customerName: string;
  applianceCategory: RepairRequest['applianceCategory'];
  applianceBrand?: string;
  applianceModel?: string;
  symptomSummary: string;
  symptomDetails: string;
  imageUrls: string[];
}): Promise<string> {
  const id = sanitizeId('req');
  const path = `repairRequests/${id}`;
  try {
    const summaryFallback = `Visual inspection for ${params.applianceCategory.replace(/_/g, ' ')}`;
    const clampedSummary = clampStr(params.symptomSummary, VALIDATION_LIMITS.SYMPTOM_SUMMARY_MAX);
    const payload: Record<string, unknown> = {
      id,
      customerId: params.customerId,
      customerName: clampStr(params.customerName, VALIDATION_LIMITS.NAME_MAX) || 'Customer',
      applianceCategory: params.applianceCategory,
      symptomSummary: clampedSummary.length >= 3 ? clampedSummary : summaryFallback,
      symptomDetails: clampStr(params.symptomDetails, VALIDATION_LIMITS.SYMPTOM_DETAILS_MAX),
      imageUrls: clampStringList(params.imageUrls, VALIDATION_LIMITS.IMAGE_URLS_MAX, 1000),
      status: 'draft',
      riskLevel: 'low',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.applianceBrand) payload.applianceBrand = clampStr(params.applianceBrand, 80);
    if (params.applianceModel) payload.applianceModel = clampStr(params.applianceModel, 80);

    await setDoc(doc(db, 'repairRequests', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export interface SaveDiagnosisParams {
  requestId: string;
  customerId: string;
  applianceCategory: RepairRequest['applianceCategory'];
  observations: string[];
  imageObservations?: string[];
  userSymptoms?: string[];
  imageUrls?: string[];
  matchedKnowledgeIds: string[];
  hypotheses: DiagnosisRecord['hypotheses'];
  followUpQuestions?: string[];
  missingEvidence?: string[];
  contradictoryEvidence?: string[];
  inferenceTrace?: InferenceTraceStep[];
  bfsSearchPath?: BfsPathNode[];
  bfsExploredLevels?: BfsLevelSummary[];
  recommendedSteps: string[];
  safetyWarnings?: string[];
  riskLevel: DiagnosisRecord['riskLevel'];
  urgencyLevel?: UrgencyLevel;
  nextRecommendedAction?: NextRecommendedAction;
  confidenceScore: number;
  requiresProfessional: boolean;
  engineMode: DiagnosisRecord['engineMode'];
  summary: string;
  followUpConversation?: FollowUpTurn[];
}

function buildDiagnosisDocumentFields(
  params: Omit<SaveDiagnosisParams, 'requestId' | 'customerId' | 'applianceCategory'>
) {
  const safeSummary = clampStr(params.summary, 2000);
  return stripUndefined({
    observations: clampStringList(params.observations, 25, 400),
    imageObservations: clampStringList(params.imageObservations, 15, 400),
    userSymptoms: clampStringList(params.userSymptoms, 20, 400),
    imageUrls: clampStringList(params.imageUrls, 5, 1000),
    matchedKnowledgeIds: clampStringList(params.matchedKnowledgeIds, 15, 120),
    hypotheses: (params.hypotheses ?? []).slice(0, 10),
    followUpQuestions: clampStringList(params.followUpQuestions, 10, 300),
    missingEvidence: clampStringList(params.missingEvidence, 15, 300),
    contradictoryEvidence: clampStringList(params.contradictoryEvidence, 10, 300),
    inferenceTrace: (params.inferenceTrace ?? []).slice(0, 25),
    bfsSearchPath: (params.bfsSearchPath ?? []).slice(0, 20),
    bfsExploredLevels: (params.bfsExploredLevels ?? []).slice(0, 10),
    recommendedSteps: clampStringList(params.recommendedSteps, 15, 400),
    safetyWarnings: clampStringList(params.safetyWarnings, 10, 400),
    riskLevel: params.riskLevel,
    urgencyLevel: params.urgencyLevel ?? 'soon',
    nextRecommendedAction: params.nextRecommendedAction ?? 'safe_external_checks',
    confidenceScore: Math.max(0, Math.min(1, Number(params.confidenceScore) || 0)),
    requiresProfessional: Boolean(params.requiresProfessional),
    engineMode: params.engineMode,
    summary: safeSummary.length >= 5 ? safeSummary : 'Structured diagnostic evaluation completed.',
    followUpConversation: (params.followUpConversation ?? []).slice(-30),
  });
}

export async function saveDiagnosisAndUpdateRequest(params: SaveDiagnosisParams): Promise<string> {
  const diagId = sanitizeId('diag');
  const diagPath = `diagnoses/${diagId}`;
  try {
    const fields = buildDiagnosisDocumentFields(params);
    await setDoc(doc(db, 'diagnoses', diagId), {
      id: diagId,
      requestId: params.requestId,
      customerId: params.customerId,
      applianceCategory: params.applianceCategory,
      ...fields,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'repairRequests', params.requestId), {
      latestDiagnosisId: diagId,
      riskLevel: params.riskLevel,
      status: params.requiresProfessional ? 'technician_requested' : 'diagnosed',
      updatedAt: serverTimestamp(),
    });

    return diagId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, diagPath);
  }
}

export async function updateDiagnosisWithFollowUp(
  diagnosisId: string,
  requestId: string,
  params: Omit<SaveDiagnosisParams, 'requestId' | 'customerId' | 'applianceCategory'>,
  currentRequestStatus?: RepairRequestStatus
): Promise<void> {
  const diagPath = `diagnoses/${diagnosisId}`;
  try {
    const fields = buildDiagnosisDocumentFields(params);
    await updateDoc(doc(db, 'diagnoses', diagnosisId), {
      observations: fields.observations,
      imageObservations: fields.imageObservations,
      userSymptoms: fields.userSymptoms,
      matchedKnowledgeIds: fields.matchedKnowledgeIds,
      hypotheses: fields.hypotheses,
      followUpQuestions: fields.followUpQuestions,
      missingEvidence: fields.missingEvidence,
      contradictoryEvidence: fields.contradictoryEvidence,
      inferenceTrace: fields.inferenceTrace,
      bfsSearchPath: fields.bfsSearchPath,
      bfsExploredLevels: fields.bfsExploredLevels,
      recommendedSteps: fields.recommendedSteps,
      safetyWarnings: fields.safetyWarnings,
      riskLevel: fields.riskLevel,
      urgencyLevel: fields.urgencyLevel,
      nextRecommendedAction: fields.nextRecommendedAction,
      confidenceScore: fields.confidenceScore,
      requiresProfessional: fields.requiresProfessional,
      engineMode: fields.engineMode,
      summary: fields.summary,
      followUpConversation: fields.followUpConversation,
      updatedAt: serverTimestamp(),
    });

    if (
      requestId &&
      (!currentRequestStatus || ['draft', 'diagnosed', 'technician_requested'].includes(currentRequestStatus))
    ) {
      await updateDoc(doc(db, 'repairRequests', requestId), {
        riskLevel: params.riskLevel,
        status: params.requiresProfessional ? 'technician_requested' : 'diagnosed',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, diagPath);
  }
}

export function subscribeCustomerRepairRequests(
  customerId: string,
  onData: (items: RepairRequest[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'repairRequests';
  const q = query(
    collection(db, 'repairRequests'),
    where('customerId', '==', customerId)
  );
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as RepairRequest))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCustomerDiagnoses(
  customerId: string,
  onData: (items: DiagnosisRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'diagnoses';
  const q = query(
    collection(db, 'diagnoses'),
    where('customerId', '==', customerId)
  );
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as DiagnosisRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeOpenRepairRequests(
  onData: (items: RepairRequest[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'repairRequests';
  const q = query(
    collection(db, 'repairRequests'),
    where('status', '==', 'technician_requested')
  );
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as RepairRequest))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ---------------------------------------------------------------------------
// Bookings, Slot Locks, Quotations & Reviews
// ---------------------------------------------------------------------------
export async function listTechnicianBookedSlots(
  technicianId: string,
  scheduledDate?: string
): Promise<BookingSlotLock[]> {
  const path = 'bookingSlots';
  try {
    const q = query(
      collection(db, 'bookingSlots'),
      where('status', '==', 'reserved')
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => d.data() as BookingSlotLock)
      .filter(
        (slot) =>
          slot.technicianId === technicianId &&
          (!scheduledDate || slot.scheduledDate === scheduledDate)
      );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createBooking(params: {
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
  serviceAddress: string;
  notes?: string;
}): Promise<string> {
  const id = sanitizeId('book');
  const slotKey = buildBookingSlotKey(
    params.technicianId,
    params.scheduledDate,
    params.timeSlot
  );
  const path = `bookings/${id}`;

  try {
    await runTransaction(db, async (tx) => {
      const slotRef = doc(db, 'bookingSlots', slotKey);
      const bookingRef = doc(db, 'bookings', id);
      const requestRef = doc(db, 'repairRequests', params.requestId);
      const techRef = doc(db, 'technicians', params.technicianId);

      const [slotSnap, techSnap, reqSnap] = await Promise.all([
        tx.get(slotRef),
        tx.get(techRef),
        tx.get(requestRef),
      ]);

      if (!techSnap.exists()) {
        throw new Error('Selected technician profile could not be found.');
      }
      const techData = techSnap.data() as TechnicianProfile;
      if (techData.verificationStatus !== 'verified') {
        throw new Error('Only active verified technicians can receive repair bookings.');
      }

      if (!reqSnap.exists()) {
        throw new Error('Selected repair request could not be found.');
      }

      if (slotSnap.exists()) {
        const existingSlot = slotSnap.data() as BookingSlotLock;
        if (existingSlot.status === 'reserved') {
          throw new Error(
            'This technician is already booked for that date and time slot. Please pick another slot.'
          );
        }
      }

      const bookingPayload = stripUndefined({
        id,
        requestId: params.requestId,
        diagnosisId: params.diagnosisId ? clampStr(params.diagnosisId, 128) : undefined,
        diagnosisSharedWithPermission: Boolean(params.diagnosisSharedWithPermission),
        sharedDiagnosisSummary:
          params.diagnosisSharedWithPermission && params.sharedDiagnosisSummary
            ? clampStr(params.sharedDiagnosisSummary, 2000)
            : undefined,
        customerId: params.customerId,
        technicianId: params.technicianId,
        customerName: clampStr(params.customerName, VALIDATION_LIMITS.NAME_MAX),
        technicianName: clampStr(params.technicianName, VALIDATION_LIMITS.NAME_MAX),
        applianceCategory: clampStr(params.applianceCategory, 60),
        scheduledDate: clampStr(params.scheduledDate, 40),
        timeSlot: clampStr(params.timeSlot, 60),
        slotKey,
        serviceAddress: clampStr(params.serviceAddress, VALIDATION_LIMITS.ADDRESS_MAX),
        status: 'requested' as BookingStatus,
        notes: params.notes ? clampStr(params.notes, VALIDATION_LIMITS.NOTES_MAX) : undefined,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      tx.set(bookingRef, bookingPayload);

      if (slotSnap.exists()) {
        tx.update(slotRef, {
          bookingId: id,
          customerId: params.customerId,
          status: 'reserved',
          updatedAt: serverTimestamp(),
        });
      } else {
        tx.set(slotRef, {
          id: slotKey,
          bookingId: id,
          technicianId: params.technicianId,
          customerId: params.customerId,
          scheduledDate: clampStr(params.scheduledDate, 40),
          timeSlot: clampStr(params.timeSlot, 60),
          status: 'reserved',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      tx.update(requestRef, {
        assignedTechnicianId: params.technicianId,
        status: 'booked',
        updatedAt: serverTimestamp(),
      });
    });

    await trySendNotification({
      userId: params.technicianId,
      senderId: params.customerId,
      relatedBookingId: id,
      title: 'New Repair Booking Request',
      message: `${params.customerName} requested a ${params.applianceCategory.replace(/_/g, ' ')} visit on ${params.scheduledDate} (${params.timeSlot}).`,
      type: 'booking',
      linkPath: '/technician',
    });

    return id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already booked')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateBookingStatus(
  bookingId: string,
  status: BookingStatus,
  requestId?: string,
  options?: {
    rejectionReason?: string;
    notes?: string;
    actorId?: string;
    actorRole?: UserRole;
  }
): Promise<void> {
  const path = `bookings/${bookingId}`;
  try {
    let existingBooking: BookingRecord | null = null;

    await runTransaction(db, async (tx) => {
      const bookingRef = doc(db, 'bookings', bookingId);
      const snap = await tx.get(bookingRef);
      if (!snap.exists()) {
        throw new Error('Booking record not found.');
      }

      existingBooking = snap.data() as BookingRecord;
      const allowed = ALLOWED_BOOKING_TRANSITIONS[existingBooking.status] ?? [];
      if (options?.actorRole !== 'admin' && !allowed.includes(status)) {
        throw new Error(
          `Cannot transition booking from "${existingBooking.status}" to "${status}".`
        );
      }

      const updateFields: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (options?.rejectionReason) {
        updateFields.rejectionReason = clampStr(options.rejectionReason, 500);
      }
      if (options?.notes) {
        updateFields.notes = clampStr(options.notes, VALIDATION_LIMITS.NOTES_MAX);
      }

      tx.update(bookingRef, updateFields);

      if ((status === 'rejected' || status === 'cancelled') && existingBooking.slotKey) {
        const slotRef = doc(db, 'bookingSlots', existingBooking.slotKey);
        const slotSnap = await tx.get(slotRef);
        if (slotSnap.exists() && (slotSnap.data() as BookingSlotLock).bookingId === bookingId) {
          tx.update(slotRef, {
            status: 'released',
            updatedAt: serverTimestamp(),
          });
        }
      }

      const targetReqId = requestId || existingBooking.requestId;
      if (targetReqId) {
        if (status === 'in_progress' || status === 'completed') {
          tx.update(doc(db, 'repairRequests', targetReqId), {
            status,
            updatedAt: serverTimestamp(),
          });
        } else if (
          (status === 'cancelled' || status === 'rejected') &&
          options?.actorRole !== 'technician'
        ) {
          tx.update(doc(db, 'repairRequests', targetReqId), {
            status: 'technician_requested',
            updatedAt: serverTimestamp(),
          });
        }
      }
    });

    if (existingBooking && options?.actorId) {
      const b = existingBooking as BookingRecord;
      const recipientId =
        options.actorId === b.customerId ? b.technicianId : b.customerId;
      const label = status.replace(/_/g, ' ');
      await trySendNotification({
        userId: recipientId,
        senderId: options.actorId,
        relatedBookingId: bookingId,
        title: `Booking ${label}`,
        message: `Booking for ${b.applianceCategory.replace(/_/g, ' ')} on ${b.scheduledDate} is now "${label}".`,
        type: 'booking',
        linkPath: options.actorId === b.customerId ? '/technician' : '/dashboard',
      });
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Cannot transition booking')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeCustomerBookings(
  customerId: string,
  onData: (items: BookingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, 'bookings'), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as BookingRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeTechnicianBookings(
  technicianId: string,
  onData: (items: BookingRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'bookings';
  const q = query(collection(db, 'bookings'), where('technicianId', '==', technicianId));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as BookingRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createQuotation(params: {
  requestId: string;
  bookingId?: string;
  customerId: string;
  technicianId: string;
  technicianName?: string;
  laborCharge?: number;
  partsCost?: number;
  additionalCharges?: number;
  estimatedCost?: number;
  currency: 'USD' | 'INR';
  estimatedCompletionTime?: string;
  proposedWorkDescription?: string;
  partsDescription: string;
  laborDescription: string;
}): Promise<string> {
  const id = sanitizeId('quote');
  const path = `quotations/${id}`;
  try {
    const laborCharge = Math.max(0, Number(params.laborCharge ?? params.estimatedCost ?? 0));
    const partsCost = Math.max(0, Number(params.partsCost ?? 0));
    const additionalCharges = Math.max(0, Number(params.additionalCharges ?? 0));
    const computedTotal = Number((laborCharge + partsCost + additionalCharges).toFixed(2));
    const estimatedCost =
      params.estimatedCost !== undefined &&
      params.laborCharge === undefined &&
      params.partsCost === undefined
        ? Math.max(0, Number(params.estimatedCost))
        : computedTotal;

    const batch = writeBatch(db);
    const quotePayload = stripUndefined({
      id,
      requestId: params.requestId,
      bookingId: params.bookingId ? clampStr(params.bookingId, 128) : undefined,
      customerId: params.customerId,
      technicianId: params.technicianId,
      technicianName: params.technicianName
        ? clampStr(params.technicianName, VALIDATION_LIMITS.NAME_MAX)
        : undefined,
      laborCharge,
      partsCost,
      additionalCharges,
      estimatedCost,
      currency: params.currency,
      estimatedCompletionTime: params.estimatedCompletionTime
        ? clampStr(params.estimatedCompletionTime, 100)
        : undefined,
      proposedWorkDescription: params.proposedWorkDescription
        ? clampStr(params.proposedWorkDescription, 1000)
        : undefined,
      partsDescription: clampStr(params.partsDescription, 500),
      laborDescription: clampStr(params.laborDescription, 500),
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'quotations', id), quotePayload);

    if (params.bookingId) {
      const bookingSnap = await getDoc(doc(db, 'bookings', params.bookingId));
      if (bookingSnap.exists() && (bookingSnap.data() as BookingRecord).status === 'accepted') {
        batch.update(doc(db, 'bookings', params.bookingId), {
          status: 'quotation_submitted',
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    await trySendNotification({
      userId: params.customerId,
      senderId: params.technicianId,
      relatedBookingId: params.bookingId,
      relatedRequestId: params.requestId,
      title: 'New Repair Quotation Received',
      message: `${params.technicianName || 'Your technician'} submitted an estimated quotation of ${params.currency} ${estimatedCost.toLocaleString()}.`,
      type: 'quotation',
      linkPath: '/dashboard',
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function respondToQuotation(params: {
  quotationId: string;
  decision: 'accepted' | 'rejected';
  customerId: string;
  technicianId: string;
  bookingId?: string;
  requestId?: string;
}): Promise<void> {
  const path = `quotations/${params.quotationId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'quotations', params.quotationId), {
      status: params.decision,
      updatedAt: serverTimestamp(),
    });

    if (params.decision === 'accepted' && params.bookingId) {
      const bookingSnap = await getDoc(doc(db, 'bookings', params.bookingId));
      if (bookingSnap.exists()) {
        const bStatus = (bookingSnap.data() as BookingRecord).status;
        if (bStatus === 'accepted' || bStatus === 'quotation_submitted') {
          batch.update(doc(db, 'bookings', params.bookingId), {
            status: 'confirmed',
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    await batch.commit();

    await trySendNotification({
      userId: params.technicianId,
      senderId: params.customerId,
      relatedBookingId: params.bookingId,
      relatedRequestId: params.requestId,
      title: params.decision === 'accepted' ? 'Quotation Approved' : 'Quotation Declined',
      message:
        params.decision === 'accepted'
          ? 'The customer approved your repair quotation and confirmed the repair.'
          : 'The customer declined the submitted quotation.',
      type: 'quotation',
      linkPath: '/technician',
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeCustomerQuotations(
  customerId: string,
  onData: (items: QuotationRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'quotations';
  const q = query(collection(db, 'quotations'), where('customerId', '==', customerId));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as QuotationRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeTechnicianQuotations(
  technicianId: string,
  onData: (items: QuotationRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'quotations';
  const q = query(collection(db, 'quotations'), where('technicianId', '==', technicianId));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as QuotationRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function listAllReviews(): Promise<ReviewRecord[]> {
  const path = 'reviews';
  try {
    const q = query(collection(db, 'reviews'), where('rating', '>=', 1));
    const snap = await getDocs(q);
    return sortByCreatedDesc(snap.docs.map((d) => d.data() as ReviewRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function subscribeAllReviews(
  onData: (items: ReviewRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'reviews';
  const q = query(collection(db, 'reviews'), where('rating', '>=', 1));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as ReviewRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeTechnicianReviews(
  technicianId: string,
  onData: (items: ReviewRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'reviews';
  const q = query(collection(db, 'reviews'), where('rating', '>=', 1));
  return onSnapshot(
    q,
    (snap) =>
      onData(
        sortByCreatedDesc(
          snap.docs
            .map((d) => d.data() as ReviewRecord)
            .filter((r) => r.technicianId === technicianId)
        )
      ),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function submitReview(params: {
  bookingId: string;
  customerId: string;
  technicianId: string;
  customerName: string;
  rating: number;
  comment: string;
}): Promise<string> {
  // Deterministic ID guarantees strictly 1 review per completed booking
  const id = `rev_${params.bookingId}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128);
  const path = `reviews/${id}`;
  try {
    await setDoc(doc(db, 'reviews', id), {
      id,
      bookingId: params.bookingId,
      customerId: params.customerId,
      technicianId: params.technicianId,
      customerName: clampStr(params.customerName, VALIDATION_LIMITS.NAME_MAX),
      rating: Math.max(1, Math.min(5, Math.round(params.rating))),
      comment: clampStr(params.comment, 1000),
      createdAt: serverTimestamp(),
    });

    await trySendNotification({
      userId: params.technicianId,
      senderId: params.customerId,
      relatedBookingId: params.bookingId,
      title: 'New Customer Review',
      message: `${params.customerName} left a ${Math.max(1, Math.min(5, Math.round(params.rating)))}-star review on a completed repair.`,
      type: 'review',
      linkPath: '/technician',
    });

    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function submitTechnicianReviewResponse(
  reviewId: string,
  responseText: string
): Promise<void> {
  const path = `reviews/${reviewId}`;
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {
      technicianResponse: clampStr(responseText, 800),
      technicianRespondedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export async function createNotification(params: {
  userId: string;
  senderId?: string;
  relatedBookingId?: string;
  relatedRequestId?: string;
  title: string;
  message: string;
  type: NotificationRecord['type'];
  linkPath?: string;
}): Promise<void> {
  const id = sanitizeId('notif');
  const path = `notifications/${id}`;
  try {
    const payload = stripUndefined({
      id,
      userId: params.userId,
      senderId: params.senderId,
      relatedBookingId: params.relatedBookingId,
      relatedRequestId: params.relatedRequestId,
      title: clampStr(params.title, 140),
      message: clampStr(params.message, 500),
      type: params.type,
      read: false,
      linkPath: params.linkPath ? clampStr(params.linkPath, 200) : undefined,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'notifications', id), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeUserNotifications(
  userId: string,
  onData: (items: NotificationRecord[]) => void
): Unsubscribe {
  const path = 'notifications';
  const q = query(collection(db, 'notifications'), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as NotificationRecord))),
    (error) => handleFirestoreError(error, OperationType.LIST, path)
  );
}

export async function markNotificationRead(id: string): Promise<void> {
  const path = `notifications/${id}`;
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(unreadIds: string[]): Promise<void> {
  if (unreadIds.length === 0) return;
  const path = 'notifications';
  try {
    const batch = writeBatch(db);
    for (const id of unreadIds.slice(0, 100)) {
      batch.update(doc(db, 'notifications', id), { read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ---------------------------------------------------------------------------
// Complaints / Disputes
// ---------------------------------------------------------------------------
export async function submitComplaint(params: {
  reporterId: string;
  reporterName: string;
  reporterRole: UserRole;
  bookingId?: string;
  technicianId?: string;
  category: ComplaintCategory;
  subject: string;
  description: string;
}): Promise<string> {
  const id = sanitizeId('cmp');
  const path = `complaints/${id}`;
  try {
    const payload = stripUndefined({
      id,
      reporterId: params.reporterId,
      reporterName: clampStr(params.reporterName, VALIDATION_LIMITS.NAME_MAX),
      reporterRole: params.reporterRole,
      bookingId: params.bookingId ? clampStr(params.bookingId, 128) : undefined,
      technicianId: params.technicianId ? clampStr(params.technicianId, 128) : undefined,
      category: params.category,
      subject: clampStr(params.subject, 180),
      description: clampStr(params.description, 2000),
      status: 'open' as ComplaintStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'complaints', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeReporterComplaints(
  reporterId: string,
  onData: (items: ComplaintRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'complaints';
  const q = query(collection(db, 'complaints'), where('reporterId', '==', reporterId));
  return onSnapshot(
    q,
    (snap) => onData(sortByCreatedDesc(snap.docs.map((d) => d.data() as ComplaintRecord))),
    (error) => {
      if (onError) onError(error);
      else handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ---------------------------------------------------------------------------
// Public Catalog & Knowledge Base
// ---------------------------------------------------------------------------
export async function fetchApplianceCategories(): Promise<{
  items: ApplianceCategory[];
  fromFirestore: boolean;
}> {
  const path = 'applianceCategories';
  try {
    const q = query(collection(db, 'applianceCategories'), where('isActive', '==', true));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return {
        items: snap.docs.map((d) => d.data() as ApplianceCategory),
        fromFirestore: true,
      };
    }
    return { items: SAMPLE_APPLIANCE_CATEGORIES, fromFirestore: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchKnowledgeBase(): Promise<{
  items: KnowledgeBaseEntry[];
  fromFirestore: boolean;
}> {
  const path = 'knowledgeBase';
  try {
    const q = query(
      collection(db, 'knowledgeBase'),
      where('riskLevel', 'in', ['low', 'medium', 'high', 'critical'])
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      return {
        items: snap.docs.map((d) => d.data() as KnowledgeBaseEntry),
        fromFirestore: true,
      };
    }
    return { items: SAMPLE_KNOWLEDGE_BASE, fromFirestore: false };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function submitContactInquiry(params: {
  name: string;
  email: string;
  subject: string;
  message: string;
  userId?: string;
}): Promise<string> {
  const id = sanitizeId('inq');
  const path = `contactInquiries/${id}`;
  try {
    const payload: Record<string, unknown> = {
      id,
      name: clampStr(params.name, 100),
      email: clampStr(params.email, 150),
      subject: clampStr(params.subject, 180),
      message: clampStr(params.message, 2000),
      status: 'new',
      createdAt: serverTimestamp(),
    };
    if (params.userId) payload.userId = params.userId;
    await setDoc(doc(db, 'contactInquiries', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// ---------------------------------------------------------------------------
// Admin Operations (Enforced by Firestore Rules)
// ---------------------------------------------------------------------------
export async function adminFetchAllUsers(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllTechnicians(): Promise<TechnicianProfile[]> {
  const path = 'technicians';
  try {
    const snap = await getDocs(collection(db, 'technicians'));
    return snap.docs.map((d) => d.data() as TechnicianProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllRepairRequests(): Promise<RepairRequest[]> {
  const path = 'repairRequests';
  try {
    const snap = await getDocs(collection(db, 'repairRequests'));
    return snap.docs.map((d) => d.data() as RepairRequest);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllBookings(): Promise<BookingRecord[]> {
  const path = 'bookings';
  try {
    const snap = await getDocs(collection(db, 'bookings'));
    return snap.docs.map((d) => d.data() as BookingRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllDiagnoses(): Promise<DiagnosisRecord[]> {
  const path = 'diagnoses';
  try {
    const snap = await getDocs(collection(db, 'diagnoses'));
    return snap.docs.map((d) => d.data() as DiagnosisRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllQuotations(): Promise<QuotationRecord[]> {
  const path = 'quotations';
  try {
    const snap = await getDocs(collection(db, 'quotations'));
    return snap.docs.map((d) => d.data() as QuotationRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllComplaints(): Promise<ComplaintRecord[]> {
  const path = 'complaints';
  try {
    const snap = await getDocs(collection(db, 'complaints'));
    return snap.docs.map((d) => d.data() as ComplaintRecord);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminFetchAllCategories(): Promise<ApplianceCategory[]> {
  const path = 'applianceCategories';
  try {
    const snap = await getDocs(collection(db, 'applianceCategories'));
    return snap.docs.map((d) => d.data() as ApplianceCategory);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminUpdateUserRole(uid: string, role: UserRole): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      role,
      updatedAt: serverTimestamp(),
    });

    const adminMarkerRef = doc(db, 'admins', uid);
    if (role === 'admin') {
      await setDoc(adminMarkerRef, {
        uid,
        grantedAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(adminMarkerRef);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSetUserAccountStatus(
  uid: string,
  accountStatus: AccountStatus
): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      accountStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSetTechnicianVerification(
  technicianId: string,
  verificationStatus: VerificationStatus
): Promise<void> {
  const path = `technicians/${technicianId}`;
  try {
    await updateDoc(doc(db, 'technicians', technicianId), {
      verificationStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateRepairRequestStatus(
  requestId: string,
  status: RepairRequestStatus
): Promise<void> {
  const path = `repairRequests/${requestId}`;
  try {
    await updateDoc(doc(db, 'repairRequests', requestId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminUpdateComplaintStatus(
  complaintId: string,
  status: ComplaintStatus,
  adminNotes?: string
): Promise<void> {
  const path = `complaints/${complaintId}`;
  try {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: serverTimestamp(),
    };
    if (adminNotes !== undefined) {
      updateData.adminNotes = clampStr(adminNotes, 1000);
    }
    await updateDoc(doc(db, 'complaints', complaintId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSaveCategory(
  category: Omit<ApplianceCategory, 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `applianceCategories/${category.id}`;
  try {
    const catRef = doc(db, 'applianceCategories', category.id);
    const existingSnap = await getDoc(catRef);
    if (existingSnap.exists()) {
      await updateDoc(catRef, {
        slug: category.slug,
        name: category.name,
        description: category.description,
        commonFaultsCount: category.commonFaultsCount,
        isActive: category.isActive,
        safetyNotice: category.safetyNotice,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(catRef, {
        ...category,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function adminToggleCategoryActive(id: string, isActive: boolean): Promise<void> {
  const path = `applianceCategories/${id}`;
  try {
    await updateDoc(doc(db, 'applianceCategories', id), {
      isActive,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminSeedSampleCatalogAndKB(): Promise<{
  categoriesCount: number;
  kbCount: number;
  techniciansCount: number;
}> {
  const path = 'applianceCategories + knowledgeBase + technicians';
  try {
    const [catSnaps, kbSnaps, techSnaps] = await Promise.all([
      Promise.all(
        SAMPLE_APPLIANCE_CATEGORIES.map((cat) =>
          getDoc(doc(db, 'applianceCategories', cat.id))
        )
      ),
      Promise.all(
        SAMPLE_KNOWLEDGE_BASE.map((kb) => getDoc(doc(db, 'knowledgeBase', kb.id)))
      ),
      Promise.all(
        VERIFIED_TECHNICIANS_DIRECTORY.map((tech) =>
          getDoc(doc(db, 'technicians', tech.uid))
        )
      ),
    ]);

    const batch = writeBatch(db);

    SAMPLE_APPLIANCE_CATEGORIES.forEach((cat, idx) => {
      const refDoc = doc(db, 'applianceCategories', cat.id);
      if (catSnaps[idx]?.exists()) {
        batch.update(refDoc, {
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          commonFaultsCount: cat.commonFaultsCount,
          isActive: cat.isActive,
          safetyNotice: cat.safetyNotice,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(refDoc, {
          ...cat,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    SAMPLE_KNOWLEDGE_BASE.forEach((kb, idx) => {
      const refDoc = doc(db, 'knowledgeBase', kb.id);
      if (kbSnaps[idx]?.exists()) {
        batch.update(refDoc, {
          applianceCategory: kb.applianceCategory,
          faultTitle: kb.faultTitle,
          observableSymptoms: kb.observableSymptoms,
          possibleCauses: kb.possibleCauses,
          followUpQuestions: kb.followUpQuestions,
          safeTroubleshootingSteps: kb.safeTroubleshootingSteps,
          riskLevel: kb.riskLevel,
          requiresProfessional: kb.requiresProfessional,
          isSampleData: kb.isSampleData,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(refDoc, {
          ...kb,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    VERIFIED_TECHNICIANS_DIRECTORY.forEach((tech, idx) => {
      const refDoc = doc(db, 'technicians', tech.uid);
      if (techSnaps[idx]?.exists()) {
        batch.update(refDoc, {
          displayName: tech.displayName,
          bio: tech.bio,
          serviceCategories: tech.serviceCategories,
          skills: tech.skills,
          experienceYears: tech.experienceYears,
          serviceArea: tech.serviceArea,
          availabilityStatus: tech.availabilityStatus,
          verificationStatus: tech.verificationStatus,
          ratingAvg: tech.ratingAvg,
          completedJobs: tech.completedJobs,
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.set(refDoc, {
          ...tech,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    });

    await batch.commit();
    return {
      categoriesCount: SAMPLE_APPLIANCE_CATEGORIES.length,
      kbCount: SAMPLE_KNOWLEDGE_BASE.length,
      techniciansCount: VERIFIED_TECHNICIANS_DIRECTORY.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
