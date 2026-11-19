# FixMate AI — Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Identity Integrity**: Every user-owned document (`users`, `technicians`, `repairRequests`, `diagnoses`, `bookings`, `quotations`, `reviews`, `notifications`) MUST bind its owner UID field (`uid`, `customerId`, `technicianId`, `userId`) to `request.auth.uid` on creation and preserve immutability on update.
2. **No Self-Assigned Privilege Escalation**: A newly registered user cannot set `role: "admin"` on `/users/{userId}` (unless bootstrapped admin email with `email_verified == true`), nor can a user modify their own `role` field on update.
3. **Technician Verification Gate**: A technician creating `/technicians/{uid}` MUST initialize `verificationStatus == "pending"`, `ratingAvg == 0`, and `completedJobs == 0`. Only an Admin can transition `verificationStatus` to `"verified"` or `"rejected"`.
4. **PII Isolation**: `/users/{userId}` contains private PII (`email`, `phone`, `address`) and is strictly readable only by the document owner (`request.auth.uid == userId`) or an Admin. Public technician discovery queries `/technicians` instead, which contains no email/phone/home address.
5. **Relational Existence**: Creating a `/diagnoses/{diagnosisId}` document requires `exists(/databases/$(database)/documents/repairRequests/$(incoming().requestId))`. Creating a `/bookings/{bookingId}` document requires an existing `repairRequest` and existing `technician`. Creating a `/reviews/{reviewId}` requires an existing `booking` in `'completed'` status owned by the reviewer.
6. **Terminal State Locking**: Once a `repairRequests`, `bookings`, or `quotations` document reaches a terminal state (`completed`, `cancelled`, `rejected`, `expired`), non-admin writes are denied.
7. **Temporal Integrity & Path Hardening**: All `createdAt` and `updatedAt` fields must match `request.time`. All document IDs are validated with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)

1. **Self-Admin Escalation**: Authenticated customer attempts `POST /users/{uid}` with `{ role: "admin" }`. -> **DENIED**
2. **Role Tampering on Update**: Authenticated customer attempts `PATCH /users/{uid}` changing `{ role: "technician" }`. -> **DENIED**
3. **Shadow Ghost Field Injection**: Authenticated customer attempts `POST /repairRequests/{id}` including `{ isApproved: true, shadowFlag: 1 }`. -> **DENIED** (`hasOnly` check)
4. **Technician Self-Verification**: Authenticated technician attempts `POST /technicians/{uid}` with `{ verificationStatus: "verified" }` or `PATCH` changing `verificationStatus`. -> **DENIED**
5. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts to create a `repairRequest`. -> **DENIED**
6. **Admin Email Spoof**: Authenticated user with `email: "prajwalm1122@gmail.com"` and `email_verified: false` attempts admin read/write on `/users`. -> **DENIED**
7. **PII Cross-User Read**: Customer A attempts `GET /users/{customerB_uid}`. -> **DENIED**
8. **Blanket List Scraping**: Customer A attempts `LIST /repairRequests` without `where('customerId', '==', auth.uid)` or tries reading all bookings. -> **DENIED**
9. **Orphaned Diagnosis Write**: Customer attempts `POST /diagnoses/{id}` referencing a non-existent `requestId`. -> **DENIED** (`exists()` check)
10. **Terminal State Mutation**: Customer attempts `PATCH /bookings/{id}` when `existing().status == "completed"`. -> **DENIED**
11. **Oversized String / ID Poisoning**: Attacker attempts `POST /repairRequests/{1.5KB_id}` or injects a 50KB `symptomDetails` string. -> **DENIED** (`isValidId` + `.size()` limits)
12. **Client Timestamp Forgery**: Customer attempts `POST /repairRequests/{id}` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time`. -> **DENIED**
