import {
  ALLOWED_BOOKING_TRANSITIONS,
  type BookingRecord,
  type BookingStatus,
  type UserRole,
} from '../../src/types/domain.ts';

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

export interface BookingConflictCheckResult {
  valid: boolean;
  conflict: boolean;
  slotKey?: string;
  error?: string;
}

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  'requested',
  'pending',
  'accepted',
  'quotation_submitted',
  'confirmed',
  'in_progress',
]);

export function checkBookingSlotConflict(
  candidate: {
    technicianId?: unknown;
    scheduledDate?: unknown;
    timeSlot?: unknown;
    serviceAddress?: unknown;
  },
  existingBookings: Pick<
    BookingRecord,
    'id' | 'technicianId' | 'scheduledDate' | 'timeSlot' | 'status'
  >[]
): BookingConflictCheckResult {
  const technicianId =
    typeof candidate.technicianId === 'string' ? candidate.technicianId.trim() : '';
  const scheduledDate =
    typeof candidate.scheduledDate === 'string' ? candidate.scheduledDate.trim() : '';
  const timeSlot = typeof candidate.timeSlot === 'string' ? candidate.timeSlot.trim() : '';
  const serviceAddress =
    typeof candidate.serviceAddress === 'string' ? candidate.serviceAddress.trim() : '';

  if (!technicianId || !/^[a-zA-Z0-9_-]+$/.test(technicianId)) {
    return { valid: false, conflict: false, error: 'Valid technicianId is required.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    return { valid: false, conflict: false, error: 'Scheduled date must use YYYY-MM-DD format.' };
  }
  if (timeSlot.length < 3 || timeSlot.length > 60) {
    return { valid: false, conflict: false, error: 'A valid time slot is required.' };
  }
  if (serviceAddress.length < 5 || serviceAddress.length > 250) {
    return {
      valid: false,
      conflict: false,
      error: 'Service address must be between 5 and 250 characters.',
    };
  }

  const slotKey = buildBookingSlotKey(technicianId, scheduledDate, timeSlot);
  const conflictMatch = existingBookings.find(
    (b) =>
      b.technicianId === technicianId &&
      b.scheduledDate === scheduledDate &&
      b.timeSlot.toLowerCase() === timeSlot.toLowerCase() &&
      ACTIVE_BOOKING_STATUSES.has(b.status)
  );

  if (conflictMatch) {
    return {
      valid: false,
      conflict: true,
      slotKey,
      error: `Selected time slot (${scheduledDate} · ${timeSlot}) is already reserved for this technician.`,
    };
  }

  return {
    valid: true,
    conflict: false,
    slotKey,
  };
}

export interface TransitionValidationResult {
  allowed: boolean;
  error?: string;
}

export function validateBookingTransition(params: {
  currentStatus: BookingStatus;
  nextStatus: BookingStatus;
  actorRole: UserRole;
}): TransitionValidationResult {
  const { currentStatus, nextStatus, actorRole } = params;
  const allowedTargets = ALLOWED_BOOKING_TRANSITIONS[currentStatus] ?? [];

  if (!allowedTargets.includes(nextStatus)) {
    return {
      allowed: false,
      error: `Invalid booking transition from "${currentStatus}" to "${nextStatus}".`,
    };
  }

  if (actorRole === 'admin') {
    return { allowed: true };
  }

  if (actorRole === 'customer') {
    const customerAllowed =
      nextStatus === 'cancelled' ||
      (nextStatus === 'confirmed' &&
        (currentStatus === 'accepted' || currentStatus === 'quotation_submitted'));
    if (!customerAllowed) {
      return {
        allowed: false,
        error: `Customers cannot transition a booking from "${currentStatus}" to "${nextStatus}".`,
      };
    }
    return { allowed: true };
  }

  if (actorRole === 'technician') {
    const techAllowed =
      ((currentStatus === 'requested' || currentStatus === 'pending') &&
        (nextStatus === 'accepted' || nextStatus === 'rejected')) ||
      (currentStatus === 'accepted' &&
        (nextStatus === 'quotation_submitted' || nextStatus === 'in_progress')) ||
      (currentStatus === 'confirmed' && nextStatus === 'in_progress') ||
      (currentStatus === 'in_progress' && nextStatus === 'completed');

    if (!techAllowed) {
      return {
        allowed: false,
        error: `Technicians cannot transition a booking from "${currentStatus}" to "${nextStatus}".`,
      };
    }
    return { allowed: true };
  }

  return { allowed: false, error: 'Unauthorized actor role.' };
}

export interface QuotationValidationResult {
  valid: boolean;
  estimatedCost?: number;
  error?: string;
}

export function validateQuotationPayload(payload: Record<string, unknown>): QuotationValidationResult {
  const laborCharge = Number(payload.laborCharge ?? 0);
  const partsCost = Number(payload.partsCost ?? 0);
  const additionalCharges = Number(payload.additionalCharges ?? 0);
  const currency = payload.currency;
  const estimatedCompletionTime =
    typeof payload.estimatedCompletionTime === 'string'
      ? payload.estimatedCompletionTime.trim()
      : '';
  const proposedWorkDescription =
    typeof payload.proposedWorkDescription === 'string'
      ? payload.proposedWorkDescription.trim()
      : '';
  const partsDescription =
    typeof payload.partsDescription === 'string' ? payload.partsDescription.trim() : '';
  const laborDescription =
    typeof payload.laborDescription === 'string' ? payload.laborDescription.trim() : '';

  if (
    !Number.isFinite(laborCharge) ||
    !Number.isFinite(partsCost) ||
    !Number.isFinite(additionalCharges) ||
    laborCharge < 0 ||
    partsCost < 0 ||
    additionalCharges < 0
  ) {
    return { valid: false, error: 'Charge amounts must be valid non-negative numbers.' };
  }

  const total = Number((laborCharge + partsCost + additionalCharges).toFixed(2));
  if (total <= 0 || total > 1000000) {
    return { valid: false, error: 'Total quotation estimate must be greater than 0.' };
  }

  if (payload.estimatedCost !== undefined) {
    const provided = Number(payload.estimatedCost);
    if (!Number.isFinite(provided) || Math.abs(provided - total) > 0.05) {
      return {
        valid: false,
        error: 'Estimated total must equal labor charges + parts cost + additional charges.',
      };
    }
  }

  if (currency !== 'USD' && currency !== 'INR') {
    return { valid: false, error: 'Currency must be USD or INR.' };
  }
  if (estimatedCompletionTime.length < 2 || estimatedCompletionTime.length > 100) {
    return { valid: false, error: 'Estimated completion time must be 2–100 characters.' };
  }
  if (proposedWorkDescription.length < 5 || proposedWorkDescription.length > 1000) {
    return { valid: false, error: 'Proposed work description must be 5–1000 characters.' };
  }
  if (partsDescription.length < 2 || partsDescription.length > 500) {
    return { valid: false, error: 'Parts description must be 2–500 characters.' };
  }
  if (laborDescription.length < 2 || laborDescription.length > 500) {
    return { valid: false, error: 'Labor description must be 2–500 characters.' };
  }

  return { valid: true, estimatedCost: total };
}
