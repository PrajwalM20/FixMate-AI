import assert from 'node:assert/strict';
import test from 'node:test';
import { rankTechniciansForRequest } from '../server/ai/technicianMatcher.ts';
import { createRateLimiter } from '../server/middleware/rateLimit.ts';
import {
  buildBookingSlotKey,
  checkBookingSlotConflict,
  validateBookingTransition,
  validateQuotationPayload,
} from '../server/services/marketplaceService.ts';
import type { BookingRecord, ReviewRecord, TechnicianProfile } from '../src/types/domain.ts';

function makeTech(overrides: Partial<TechnicianProfile>): TechnicianProfile {
  return {
    uid: 'tech_1',
    displayName: 'Technician One',
    bio: 'Appliance repair specialist',
    serviceCategories: ['washing_machine'],
    skills: ['Drain Pump Clearing', 'Belt Replacement'],
    experienceYears: 6,
    serviceArea: 'Indiranagar, Bengaluru',
    availabilityStatus: 'available',
    verificationStatus: 'verified',
    ratingAvg: 0,
    completedJobs: 0,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

test('1. Technician matching excludes non-verified and suspended providers', () => {
  const techs: TechnicianProfile[] = [
    makeTech({ uid: 't_verified', verificationStatus: 'verified' }),
    makeTech({ uid: 't_pending', verificationStatus: 'pending' }),
    makeTech({ uid: 't_rejected', verificationStatus: 'rejected' }),
    makeTech({ uid: 't_suspended', verificationStatus: 'suspended' }),
  ];

  const ranked = rankTechniciansForRequest(techs, [], {
    applianceCategory: 'washing_machine',
  });

  assert.equal(ranked.rankingMethod, 'rule_based_weighted_heuristics');
  assert.equal(ranked.results.length, 1);
  assert.equal(ranked.results[0].technician.uid, 't_verified');
});

test('2. Technician matching prioritizes category, location, availability, and live reviews', () => {
  const techs: TechnicianProfile[] = [
    makeTech({
      uid: 't_mismatch',
      displayName: 'Remote Busy Tech',
      serviceCategories: ['laptop'],
      serviceArea: 'Whitefield',
      availabilityStatus: 'busy',
      experienceYears: 10,
    }),
    makeTech({
      uid: 't_best',
      displayName: 'Local Washer Tech',
      serviceCategories: ['washing_machine'],
      serviceArea: 'Indiranagar, Bengaluru',
      availabilityStatus: 'available',
      experienceYears: 5,
    }),
  ];

  const reviews: Pick<ReviewRecord, 'technicianId' | 'rating'>[] = [
    { technicianId: 't_best', rating: 5 },
    { technicianId: 't_best', rating: 4 },
  ];

  const ranked = rankTechniciansForRequest(techs, reviews, {
    applianceCategory: 'washing_machine',
    locationQuery: 'Indiranagar',
    symptomKeywords: ['drain', 'pump'],
  });

  assert.equal(ranked.results[0].technician.uid, 't_best');
  assert.equal(ranked.results[0].liveRatingAvg, 4.5);
  assert.equal(ranked.results[0].reviewCount, 2);
  assert.ok(ranked.results[0].matchScore > ranked.results[1].matchScore);
});

test('3. Booking slot conflict detection prevents double booking and allows released slots', () => {
  const existing: Pick<
    BookingRecord,
    'id' | 'technicianId' | 'scheduledDate' | 'timeSlot' | 'status'
  >[] = [
    {
      id: 'book_active',
      technicianId: 'tech_1',
      scheduledDate: '2026-12-01',
      timeSlot: '10:00 AM - 12:00 PM',
      status: 'confirmed',
    },
    {
      id: 'book_cancelled',
      technicianId: 'tech_1',
      scheduledDate: '2026-12-02',
      timeSlot: '10:00 AM - 12:00 PM',
      status: 'cancelled',
    },
  ];

  const conflictRes = checkBookingSlotConflict(
    {
      technicianId: 'tech_1',
      scheduledDate: '2026-12-01',
      timeSlot: '10:00 AM - 12:00 PM',
      serviceAddress: '123 MG Road, Bengaluru',
    },
    existing
  );
  assert.equal(conflictRes.valid, false);
  assert.equal(conflictRes.conflict, true);

  const allowedAfterCancel = checkBookingSlotConflict(
    {
      technicianId: 'tech_1',
      scheduledDate: '2026-12-02',
      timeSlot: '10:00 AM - 12:00 PM',
      serviceAddress: '123 MG Road, Bengaluru',
    },
    existing
  );
  assert.equal(allowedAfterCancel.valid, true);
  assert.equal(allowedAfterCancel.conflict, false);
  assert.equal(
    allowedAfterCancel.slotKey,
    buildBookingSlotKey('tech_1', '2026-12-02', '10:00 AM - 12:00 PM')
  );
});

test('4. Booking state-machine validation enforces valid lifecycle and actor RBAC', () => {
  assert.equal(
    validateBookingTransition({
      currentStatus: 'requested',
      nextStatus: 'accepted',
      actorRole: 'technician',
    }).allowed,
    true
  );

  // Customer cannot accept a booking
  assert.equal(
    validateBookingTransition({
      currentStatus: 'requested',
      nextStatus: 'accepted',
      actorRole: 'customer',
    }).allowed,
    false
  );

  // Cannot skip directly from requested to completed
  assert.equal(
    validateBookingTransition({
      currentStatus: 'requested',
      nextStatus: 'completed',
      actorRole: 'technician',
    }).allowed,
    false
  );

  // Customer confirms after quotation submitted
  assert.equal(
    validateBookingTransition({
      currentStatus: 'quotation_submitted',
      nextStatus: 'confirmed',
      actorRole: 'customer',
    }).allowed,
    true
  );

  // Terminal state lock
  assert.equal(
    validateBookingTransition({
      currentStatus: 'completed',
      nextStatus: 'cancelled',
      actorRole: 'admin',
    }).allowed,
    false
  );
});

test('5. Itemized quotation validation checks math and required fields', () => {
  const valid = validateQuotationPayload({
    laborCharge: 500,
    partsCost: 350,
    additionalCharges: 50,
    estimatedCost: 900,
    currency: 'INR',
    estimatedCompletionTime: '2 hours',
    proposedWorkDescription: 'Replace OEM drain pump and flush filter housing.',
    partsDescription: 'OEM drain pump motor assembly',
    laborDescription: 'Disassembly, swap, leak & spin test',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.estimatedCost, 900);

  const mismatched = validateQuotationPayload({
    laborCharge: 500,
    partsCost: 350,
    additionalCharges: 0,
    estimatedCost: 999,
    currency: 'INR',
    estimatedCompletionTime: '2 hours',
    proposedWorkDescription: 'Replace OEM drain pump and flush filter housing.',
    partsDescription: 'OEM drain pump motor assembly',
    laborDescription: 'Disassembly, swap, leak & spin test',
  });
  assert.equal(mismatched.valid, false);
});

test('6. Rate limiter enforces sliding-window threshold with HTTP 429', () => {
  const limiter = createRateLimiter({ windowMs: 60000, maxRequests: 2, keyPrefix: 'test' });
  let nextCount = 0;
  let lastStatus = 200;
  const headers: Record<string, string> = {};

  const mockReq = {
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
  } as never;

  const mockRes = {
    setHeader(name: string, val: string) {
      headers[name] = val;
    },
    status(code: number) {
      lastStatus = code;
      return {
        json() {
          return undefined;
        },
      };
    },
  } as never;

  limiter(mockReq, mockRes, () => {
    nextCount += 1;
  });
  limiter(mockReq, mockRes, () => {
    nextCount += 1;
  });
  limiter(mockReq, mockRes, () => {
    nextCount += 1;
  });

  assert.equal(nextCount, 2);
  assert.equal(lastStatus, 429);
  assert.ok(Number(headers['Retry-After']) >= 1);
});
