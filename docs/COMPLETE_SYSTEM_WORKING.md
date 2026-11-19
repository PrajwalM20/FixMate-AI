# FixMate AI — Complete System Architecture & Working Manual

**Tagline:** *Diagnose Smarter. Repair Better.*

FixMate AI is a full-stack appliance troubleshooting and verified technician marketplace platform. It pairs **multimodal Gemini perception** and **real-time bidirectional live voice** with a transparent, deterministic **symbolic reasoning pipeline** (forward chaining inference, Breadth-First Search over appliance state graphs, rule-based uncertainty scoring, and hard safety overrides), backed by **Firebase Authentication**, **Cloud Firestore** with transactional slot locking, and **Firebase Storage**.

---

## Table of Contents

1. [Executive Platform Overview](#1-executive-platform-overview)
2. [Complete Technology Stack](#2-complete-technology-stack)
3. [System Architecture & Network Topology](#3-system-architecture--network-topology)
4. [Frontend Architecture, Routes & Motion System](#4-frontend-architecture-routes--motion-system)
5. [Authentication, Email Verification & Multi-Layer RBAC](#5-authentication-email-verification--multi-layer-rbac)
6. [Hybrid AI Diagnostic Pipeline (End-to-End Working)](#6-hybrid-ai-diagnostic-pipeline-end-to-end-working)
7. [Real-Time Live Voice Troubleshooting](#7-real-time-live-voice-troubleshooting)
8. [Verified Technician Marketplace & Booking Workflow](#8-verified-technician-marketplace--booking-workflow)
9. [Firestore Data Model & Security Rules](#9-firestore-data-model--security-rules)
10. [API Reference, Environment, Testing & Deployment](#10-api-reference-environment-testing--deployment)

---

## 1. Executive Platform Overview

FixMate AI supports seven appliance verticals (`refrigerator`, `washing_machine`, `air_conditioner`, `laptop`, `television`, `microwave`, and `other`) across three distinct role portals (`customer`, `technician`, `admin`):

1. **Multimodal Intake & Live Voice**: Customers submit symptom text, up to 3 appliance photographs (JPEG/PNG/WebP, inline or uploaded to Firebase Storage), or start a live 16kHz/24kHz voice session (`LiveVoiceAssistant`) and transfer the captured transcript directly into the diagnosis form.
2. **Explainable Hybrid Reasoning**: Every diagnostic request executes a five-stage server-side pipeline that separates **perception** (Gemini JSON extraction + lexical backup) from **reasoning** (rule chaining, BFS search, uncertainty scoring, and safety enforcement), returning inspectable inference steps, graph search paths, missing facts, and contradictory cues rather than black-box answers.
3. **Interactive Follow-Up Loop**: Customers can answer clarifying questions directly inside `DiagnosisReportView` or from `CustomerDashboard`, preserving prior facts and conversation history to recompute hypotheses and scores cleanly.
4. **End-to-End Repair Marketplace**: Customers filter verified technicians ranked by weighted compatibility heuristics, book non-overlapping appointment slots protected by Firestore transactions, opt in to share AI reports, compare itemized quotations, and submit verified post-repair reviews. Technicians manage profiles, availability, jobs, quotations, and review replies; administrators oversee accounts, verify/suspend technicians, manage categories, and resolve disputes.

---

## 2. Complete Technology Stack

| Layer | Technology / Library | Version | Purpose in FixMate AI |
| :--- | :--- | :--- | :--- |
| **UI Framework** | React + React DOM | `19.0.1` | Component-based SPA UI with strict TypeScript |
| **Language** | TypeScript | `7.0.2` (`~`) | End-to-end type safety across `src/` and `server/` |
| **Routing** | `react-router-dom` | `7.18.5` | Client-side navigation, query params, and `ProtectedRoute` RBAC |
| **Styling** | Tailwind CSS + `@tailwindcss/vite` | `4.3.3` | Utility-first styling (`Plus Jakarta Sans`, `Inter`, `JetBrains Mono`) |
| **Animation** | `motion` (`motion/react`) | `12.23.24` | Hardware-accelerated reveals, staggers, layout tabs, and modals |
| **Icons** | `lucide-react` | `0.546.0` | Crisp 1.5px stroke technical and UI iconography |
| **Build Tool** | Vite + `@vitejs/plugin-react` | `8.3.0` / `6.1.1` | Fast bundling, ESM resolution, and Express middleware integration |
| **Backend Server** | Node.js + Express + `http` | Express `4.21.2` | Single-port (`3000`) REST API, WebSocket host, and Vite/static host |
| **WebSockets** | `ws` | `8.23.0` | Dedicated `/api/live-voice` WebSocket relay leaving Vite HMR intact |
| **AI SDK** | `@google/genai` | `2.4.0` | Server-only access to `gemini-4-hydrogen` and `gemini-3.8-live` |
| **Token Auth** | `jose` | `6.2.17` | Server-side Firebase ID Token JWKS verification (zero IAM roles needed) |
| **Firebase SDK** | `firebase` | `13.4.0` | Firebase Auth, Cloud Firestore (named DB), and Firebase Storage |
| **Security Linting** | `@firebase/eslint-plugin-security-rules` | `0.0.2` | Firestore security rule verification |
| **Runtime & Env** | `tsx` + `dotenv` | `4.21.0` / `17.2.3` | Direct TypeScript execution of `server.ts` and secret loading |
| **Testing** | Node Built-in Test Runner (`node:test`) | Built-in | Unit & integration tests (`tests/aiPipeline.test.ts`, `tests/marketplace.test.ts`) |

---

## 3. System Architecture & Network Topology

FixMate AI runs on a unified HTTP + WebSocket server bound to `0.0.0.0:3000`:
- **Development (`NODE_ENV !== 'production'`)**: `server.ts` creates a single Node `http.Server`, attaches the `LiveVoice` WebSocket server on `/api/live-voice`, mounts Express `/api/*` routes, and delegates remaining HTTP traffic to Vite's `middlewareMode`.
- **Production (`NODE_ENV === 'production'`)**: `server.ts` serves prebuilt static assets from `dist/` with SPA fallback to `dist/index.html` alongside `/api/*` and `/api/live-voice`.
- **Secret Isolation**: `GEMINI_API_KEY` is read exclusively in `server/ai/*.ts`. The frontend never imports `@google/genai` or handles raw API keys.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        Browser Client (React 19 SPA)                       │
│  Pages • AuthContext • DiagnosisWorkspace • LiveVoiceAssistant • Dashboards │
└───────┬──────────────────────────┬─────────────────────────────┬───────────┘
        │ HTTPS / SDK              │ REST JSON + Bearer JWT      │ WSS (/api/live-voice)
        ▼                          ▼                             ▼
┌───────────────────┐    ┌───────────────────────────────────────────────────┐
│ Firebase Services │    │         Node.js + Express Server (port 3000)      │
│ • Auth (Email/    │    │ • jose JWKS verifyFirebaseIdToken & requireAdmin  │
│   Google OAuth)   │    │ • Sliding-window Rate Limiters (apiLimiter/aiLim) │
│ • Firestore (12   │    │ • AgentController (5-stage AI Pipeline)           │
│   collections +   │    │ • Marketplace validators & TechnicianMatcher      │
│   slot locks)     │    │ • LiveVoiceService (ws <-> Google GenAI Live)     │
│ • Storage (photos)│    └──────────┬────────────────────────────┬───────────┘
└───────────────────┘               │ @google/genai              │ @google/genai Live
                                    ▼                            ▼
                       ┌─────────────────────────┐  ┌─────────────────────────┐
                       │   Gemini Multimodal     │  │    Gemini Live Audio    │
                       │   `gemini-4-hydrogen`   │  │   `gemini-3.8-live`     │
                       │ (JSON schema percepts)  │  │ (16kHz in / 24kHz out)  │
                       └─────────────────────────┘  └─────────────────────────┘
```

---

## 4. Frontend Architecture, Routes & Motion System

### 4.1 Directory Layout (`src/`)
- `src/pages/`: Public pages (`LandingPage`, `ServicesPage`, `TechnicianDiscoveryPage`, `DiagnosisWorkspacePage`, `ContactHelpPage`, `LoginPage`, `RegisterPage`) and role-protected dashboards (`CustomerDashboard`, `TechnicianDashboard`, `AdminDashboard`, `ProfileSettingsPage`).
- `src/components/`: `Navbar`, `Footer`, `DashboardShell`, `DiagnosisReportView`, `LiveVoiceAssistant`, `MotionPrimitives`, `ProtectedRoute`, `ErrorBoundary`, `StatusLabel`.
- `src/context/AuthContext.tsx`: Firebase Auth session state, email verification enforcement, Firestore user/technician profile sync, token retrieval, and automatic admin catalog synchronization.
- `src/services/firestoreService.ts`: Typed Firestore CRUD, real-time `onSnapshot` subscriptions, atomic slot-locking `runTransaction` calls, Firebase Storage image uploads, and cross-user notification dispatch.
- `src/data/sampleKnowledgeBase.ts`: Canonical defaults for the 7 `SAMPLE_APPLIANCE_CATEGORIES`, 12 `SAMPLE_KNOWLEDGE_BASE` fault frames, 12 `SAMPLE_DIAGNOSTIC_PRESETS` (1-click intake cases), and 4 `VERIFIED_TECHNICIANS_DIRECTORY` technician records (`tech_arjun_nair`, `tech_meera_kulkarni`, `tech_vikram_deshmukh`, `tech_rohan_iyer`).

### 4.2 Application Route Table

| Route | Component | Access Control | Key Responsibilities |
| :--- | :--- | :--- | :--- |
| `/` | `LandingPage` | Public | Hero workspace launch, workflow preview, 6 fault verticals, safety CTA |
| `/services` | `ServicesPage` | Public | 7 appliance verticals, live Firestore knowledge base fault library & risk/safety rules |
| `/diagnose` | `DiagnosisWorkspacePage` | Public (Save/Run requires verified login) | Quick fault presets, Live Voice assistant, multi-image uploader, 5-stage report viewer |
| `/technicians` | `TechnicianDiscoveryPage` | Public browse; booking requires verified auth | Weighted technician ranking, category/location/availability filters, reviews, slot booking |
| `/contact` | `ContactHelpPage` | Public | Safety escalation guide, FAQ accordion, persistent Firestore inquiry form |
| `/login` | `LoginPage` | Public | Email/password sign-in, Google OAuth popup, Firebase password reset |
| `/register` | `RegisterPage` | Public | Customer or Technician onboarding (skills, service area, categories) + email verification |
| `/dashboard` | `CustomerDashboard` | `customer` or `admin` | Repair history, inline report follow-ups, booking timeline, quote comparison, reviews, disputes |
| `/technician` | `TechnicianDashboard` | `technician` or `admin` | Verification banner, availability toggle, shared diagnosis inspection, itemized quoting, review replies |
| `/admin` | `AdminDashboard` | `admin` (`isBootstrappedAdmin` / `admins`) | Catalog sync, user role/suspension controls, technician approval/suspension, dispute resolution |
| `/profile` | `ProfileSettingsPage` | Any signed-in verified user | Update display name, phone, address, password change |
| `/about`, `*` | Redirect | Public | Clean `<Navigate to="/" replace />` fallback |

### 4.3 Motion & Design System
- **Accessibility**: `App.tsx` wraps the entire tree in `<MotionConfig reducedMotion="user">` so OS reduced-motion preferences are honored automatically.
- **Compositor-Only Primitives (`src/components/MotionPrimitives.tsx`)**: Uses exponential ease-out (`[0.16, 1, 0.3, 1]`) exclusively on GPU-composited `transform` and `opacity` properties:
  - `Reveal`: Scroll-triggered (`viewport={{ once: true, amount: 0.15 }}`) subtle upward fade.
  - `StaggerGroup` & `StaggerItem`: Coordinated stagger (`0.05s`) across KPI strips, technician cards, and category grids.
  - `TabPanel`: Clean crossfade (`AnimatePresence mode="wait"`) between Admin Console sections.
  - `ModalFrame`: Animated backdrop + spring-less crisp card entry for technician profiles and booking drawers.
  - `Navbar`: `layoutId="navbar-active-indicator"` active underline plus animated mobile drawer.

---

## 5. Authentication, Email Verification & Multi-Layer RBAC

1. **Firebase Authentication + Email Verification**:
   - Email/password registrations trigger `sendEmailVerification` immediately. `ProtectedRoute` and backend `verifyFirebaseIdToken` block diagnostic or booking writes until `emailVerified === true` (Google sign-in accounts are pre-verified by provider claim).
2. **Firestore Profile Auto-Provisioning (`AuthContext.tsx`)**:
   - On sign-in, `ensureFirestoreProfile` creates or reconciles `users/{uid}` and (for technician sign-ups) `technicians/{uid}` with `verificationStatus: 'pending'`.
   - `prajwalm1122@gmail.com` is recognized as the bootstrapped administrator (`isBootstrappedAdmin()` in `firestore.rules`, `requireAdmin` in `server/middleware/auth.ts`, and `AuthContext.tsx`). When verified, signing in automatically triggers a background sync (`adminSeedSampleCatalogAndKB()`) so all 7 appliance categories, 12 knowledge frames, and 4 verified technicians are populated in Firestore.
3. **Server-Side Cryptographic Token Verification (`server/middleware/auth.ts`)**:
   - All protected REST routes (`requireAuth`) and WebSocket handshakes extract the Firebase ID token and verify its signature, issuer (`https://securetoken.google.com/{projectId}`), audience (`projectId`), expiry, and `email_verified === true` claim against Google's public JWKS (`https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com`) using `jose`.
4. **Rate Limiting (`server/middleware/rateLimit.ts`)**:
   - General `/api/*` routes enforce a sliding-window limit of **120 requests/minute**.
   - Compute/AI routes (`/api/ai/diagnose`, `/api/ai/followup`) enforce **25 requests/minute**, returning standard `Retry-After` headers and HTTP `429` when exceeded.

---

## 6. Hybrid AI Diagnostic Pipeline (End-to-End Working)

Requests hit `POST /api/ai/diagnose` (initial run) or `POST /api/ai/followup` (iterative refinement) and are validated by `DatabaseService.validateDiagnosisInput` (requiring either valid symptom text or up to 3 JPEG/PNG/WebP images <= 5 MB; payload body cap 16 MB).

`AgentController.runDiagnosticCycle` then executes five sequential stages:

### Stage 1: Multimodal Perception & Fact Grounding (`PerceptionService` + `GeminiIntegrationService`)
- **Server-Side Multimodal Call**: `geminiService.perceiveSymptomsAndImages` invokes **`gemini-4-hydrogen`** with strict `responseMimeType: 'application/json'` and `responseSchema`.
  - If `imageUrls` are provided instead of `inlineImages`, only `https:` URLs hosted on `firebasestorage.googleapis.com` or `storage.googleapis.com` are fetched (SSRF protection).
  - System instructions forbid treating external images as proof of internal electrical/mechanical faults or inventing unseen symptoms.
  - Payload validation (`validateGeminiPerceptionPayload`) rejects malformed outputs. If an **image-only** submission runs while `GEMINI_API_KEY` is missing or fails, the pipeline throws an explicit error rather than fabricating vision findings.
- **Deterministic Grounding & Vocabulary Mapping**: `extractDeterministicFacts` scans text and follow-up answers against controlled `FACT_VOCABULARY` and `HAZARD_FACTS` (e.g. noticing both `no_power` and `appliance_running`, or `freezer_cold` and `freezer_warm`).
- **Reliability Tagging**: Facts carry provenance tags (`user_text` = `1.0`, `follow_up_answer` = `0.95`, `gemini_nlu` = `0.85`, `gemini_vision`-only = `0.70`), setting `engineMode` to `gemini_hybrid` or `phase1_deterministic_stub`.

### Stage 2: Forward Chaining Rule Inference (`InferenceEngine`)
- Filters `KNOWLEDGE_RULES` to the active `applianceCategory` or `'any'`.
- Runs up to `MAX_FORWARD_CHAINING_ITERATIONS = 15` fixed-point iterations: whenever a rule's `antecedents` are all in `workingMemory` and zero `negatedAntecedents` exist, its `consequentFact` is inferred into working memory, `candidateCauseIds` are expanded, and an inspectable `InferenceTraceStep` (`step`, `ruleId`, `matchedFacts`, `inferredFact`, `reason`) is logged.

### Stage 3: Queue-Based Breadth-First Search (`SearchEngine`)
- Loads the category state graph from `TROUBLESHOOTING_GRAPHS` (`start` -> `check` -> `cause` -> `goal_safe` / `goal_escalate`).
- Uses an explicit FIFO queue and `visited` set (preventing cycles), prioritizing outgoing edges with higher overlap against `workingMemoryFacts`.
- Evaluates terminal `goal_safe` vs. `goal_escalate` nodes and reconstructs the shortest parent-linked path (`bfsSearchPath`), per-depth exploration summary (`bfsExploredLevels`), and full visual graph (`graphVisualization.nodes` and `.edges`) for interactive UI rendering.

### Stage 4: Evidence-Based Uncertainty Reasoning (`UncertaintyEngine`)
- Scores each candidate cause transparently (bounded `[0.08, 0.92]`):

$$\text{rawScore} = (0.35 \times \text{basePrior}) + \sum_{\text{req}} 0.32 \cdot r_f + \sum_{\text{sup}} 0.14 \cdot r_f + \min(0.20, 0.05 \times |\text{firedRules}|) - (0.25 \cdot |\text{missingReq}| + 0.04 \cdot |\text{missingSup}|) - (0.35 \cdot |\text{contradictions}| + 0.15 \cdot |\text{cueConflicts}|)$$

- Classifies score labels (`Moderate-Strong Rule Support` $\ge 0.65$, `Moderate Rule Support` $\ge 0.40$, else `Low / Tentative Evidence`), flags `insufficientEvidence` when top score $< 0.35$ or evidence is sparse, and appends an explicit disclaimer that scores represent rule alignment rather than statistical probabilities.

### Stage 5: Safety Overrides & Final Action Routing (`DecisionEngine`)
- **Emergency Hazard Override**: If any `HAZARD_FACTS` key or warning sign (`smoke`, `burning`, `sparks`, `exposed_wiring`, `gas_leak`, `water_near_electrical`, `electric_shock`) is detected, `DecisionEngine` immediately forces:
  - `riskLevel = 'critical'`
  - `urgencyLevel = 'emergency'`
  - `nextRecommendedAction = 'stop_using_appliance'`
  - `requiresProfessional = true`
  - Replaces troubleshooting steps with four emergency shut-off/evacuation instructions.
- **Prohibited Instruction Filtering**: Every non-emergency step is regex-filtered (`PROHIBITED_ADVICE_PATTERNS`) to strip instructions about opening live electrical/capacitor panels, bypassing safety interlocks, handling refrigerants, or disassembling microwave magnetrons.
- **Action Routing**: Selects between `ask_follow_up_questions`, `contact_qualified_technician`, `continue_diagnosis`, and `safe_external_checks`.

---

## 7. Real-Time Live Voice Troubleshooting

`LiveVoiceAssistant.tsx` (`src/components/`) and `server/ai/liveVoiceService.ts` implement full-duplex spoken diagnostics over WebSocket (`/api/live-voice`):

1. **Handshake & Upgrade Routing**: `attachLiveVoiceServer` intercepts HTTP `upgrade` requests matching `/api/live-voice` (leaving Vite's WebSocket path completely untouched) and cryptographically validates the `?token=` Firebase ID Token.
2. **Upstream Gemini Live Connection**: Opens `ai.live.connect` against **`gemini-3.8-live`** with `Modality.AUDIO`, bidirectional input/output audio transcription enabled, prebuilt voice selection (`Zephyr`, `Puck`, `Charon`, `Kore`, `Fenrir`), and a safety-first appliance-scoped system instruction.
3. **Browser Audio Capture & Playback (`src/utils/audioPcm.ts`)**:
   - **Capture**: Acquires microphone audio with `echoCancellation` and `noiseSuppression` at `16000 Hz`, converts Float32 PCM frames to base64 Int16 (`float32ToPcm16Base64`), and streams JSON `{ audio }` chunks (honoring client Mute state). Also supports sending typed error codes (`{ text }`) mid-call.
   - **Gapless Playback & Barge-In**: Decodes incoming 24kHz PCM16 audio (`base64Pcm16ToFloat32`) into scheduled `AudioBufferSourceNode` queues. When Gemini sends `{ type: 'interrupted' }` (barge-in), active audio buffers stop and flush immediately.
4. **Structured Handoff**: Clicking **Apply Voice Notes to Diagnosis Form** merges user/assistant transcript turns directly into `Symptom Summary` and `Observable Details` so the user can attach photos and persist a formal hybrid report.

---

## 8. Verified Technician Marketplace & Booking Workflow

### 8.1 Rule-Based Technician Matching (`server/ai/technicianMatcher.ts`)
`POST /api/technicians/recommend` filters strictly to `verificationStatus === 'verified'` technicians and computes a transparent weighted score $[0, 1]$ with human-readable `matchReasons`:
- **Category Compatibility (`0.35`)**: Exact category (`1.0`), general `other` (`0.45`), mismatch (`0.0`).
- **Service Location (`0.25`)**: Tokenized area overlap against `serviceArea` (`0.50–1.0` match, `0.80` if unspecified).
- **Availability Status (`0.15`)**: `available` (`1.0`), `busy` (`0.35`), `offline` (`0.0`).
- **Customer Rating (`0.15`)**: Aggregated from live `reviews` (`liveRatingAvg / 5`, or `0.65` baseline for newly verified pros).
- **Experience Years (`0.10`)**: Scaled `min(1, experienceYears / 10)` plus an optional `+0.05` skill keyword alignment bonus.

### 8.2 Transactional Slot Locking & State Machine (`server/services/marketplaceService.ts`, `src/services/firestoreService.ts`)
- **Double-Booking Prevention**: Each booking computes a deterministic slot key:
  `slot_${technicianId}_${scheduledDate}_${normalizedTimeSlot}` (max 128 chars).
  Inside `createBooking`, a Firestore `runTransaction` verifies `bookingSlots/{slotKey}` is either absent or `released`, atomically reserves the lock, writes `bookings/{bookingId}`, and updates `repairRequests/{requestId}` status to `booked`. Firestore Security Rules enforce this lock atomically with `existsAfter(...)` & `getAfter(...)`.
- **Booking Lifecycle State Machine (`validateBookingTransition`)**:
  - `requested` / `pending` -> `accepted` (Technician/Admin), `rejected` (Technician/Admin, releases slot), `cancelled` (Customer/Admin, releases slot)
  - `accepted` -> `quotation_submitted`, `in_progress`, `cancelled`
  - `quotation_submitted` -> `confirmed` (Customer accepts quotation), `cancelled`, `rejected`
  - `confirmed` -> `in_progress`, `cancelled`
  - `in_progress` -> `completed` (Technician/Admin)
  - `completed` / `rejected` / `cancelled` -> **Terminal locked states**.
- **Itemized Quotations**: Technicians submit itemized `laborCharge + partsCost + additionalCharges = estimatedCost` validated by `validateQuotationPayload` (`POST /api/quotations/validate`). Accepting a quotation atomically transitions the quote to `accepted`, linked booking to `confirmed`, and repair request to `booked`.
- **Verified Reviews**: One deterministic review (`rev_${bookingId}`) per `completed` booking, with one-time technician reply support.

---

## 9. Firestore Data Model & Security Rules

Configured against project `gen-lang-client-0173928992` (database `ai-studio-82033c6f-189d-453f-8b7e-96daf889b477`). Default deny (`match /{document=**}`) wraps all collections; non-suspended verified auth and strict field whitelists/types/timestamps are validated per collection:

| Collection | Document ID Format | Purpose | Key Access & Integrity Rules |
| :--- | :--- | :--- | :--- |
| `users` | `{uid}` | User account profile & RBAC role | Verified owner updates profile fields only; only admin edits roles or suspends |
| `admins` | `{uid}` | Admin allowlist alongside bootstrapped email | Bootstrapped/existing admins only |
| `technicians` | `{uid}` | Public skill profile, area, stats | Publicly readable only when `verificationStatus == 'verified'`; rating/jobs immutable to self |
| `repairRequests` | `req_*` | Customer appliance ticket | Customer owner, assigned tech, open pool (`technician_requested`), or admin |
| `diagnoses` | `diag_*` | Stored 5-stage AI report & follow-up log | Linked to owned `repairRequest`; customer updates trace/conversation, admin full |
| `bookings` | `book_*` | Scheduled service visit & shared report | Requires verified technician + atomic `bookingSlots/{slotKey}` reservation |
| `bookingSlots` | `slot_{tech}_{date}_{slot}` | Concurrency lock preventing double-booking | Transactional `reserved`/`released` lock synced with booking status |
| `quotations` | `quote_*` | Itemized estimate (`labor`, `parts`, `extra`) | Verified tech creates `pending`; customer approves/rejects; immutable after decision |
| `reviews` | `rev_{bookingId}` | Post-completion rating (1–5) & comment | Requires `booking.status == 'completed'`; tech can write single reply once |
| `notifications` | `notif_*` | Real-time bell alerts across parties | Cross-user creation verified against shared active `bookingId` or `requestId` |
| `complaints` | `cmp_*` | Service/pricing/safety dispute tickets | Reporter creates `open`; admin investigates, resolves, or dismisses with notes |
| `applianceCategories` | `cat_*` | Active vertical taxonomy & safety notices | Active items public read; admin write only |
| `knowledgeBase` | `kb_*` | Structured fault frames | Public read; admin write only |
| `contactInquiries` | `inq_*` | Public Contact/Help submissions | Anyone can create with `status: 'new'`; admin read/review only |

*(Plus `test/connection` read-only ping doc used by `src/lib/firebase.ts` on startup to detect offline configuration.)*

---

## 10. API Reference, Environment, Testing & Deployment

### 10.1 Server REST & WebSocket Endpoints

| Method & Path | Auth | Middleware / Rate Limit | Description |
| :--- | :--- | :--- | :--- |
| `GET /api/health` | Public | `apiLimiter` (120/min) | Server health & timestamp check |
| `GET /api/ai/architecture` | Public | `apiLimiter` | Active AI agent modules & Gemini config status |
| `GET /api/knowledge-base` | Public | `apiLimiter` | Appliance categories & fault frame definitions |
| `POST /api/technicians/recommend` | Public | `apiLimiter` | Deterministic weighted technician ranking |
| `POST /api/ai/diagnose` | Verified JWT | `aiLimiter` (25/min) + `requireAuth` | Full 5-stage multimodal & symbolic diagnosis |
| `POST /api/ai/followup` | Verified JWT | `aiLimiter` (25/min) + `requireAuth` | Follow-up Q&A re-evaluation with conversation memory |
| `POST /api/bookings/validate` | Verified JWT | `apiLimiter` + `requireAuth` | Slot format, address & conflict pre-flight check |
| `POST /api/bookings/validate-transition` | Verified JWT | `apiLimiter` + `requireAuth` | Role-aware booking state transition guard |
| `POST /api/quotations/validate` | Verified JWT | `apiLimiter` + `requireAuth` | Itemized cost sum & string-bound validator |
| `POST /api/admin/validate-kb-entry` | Admin JWT | `apiLimiter` + `requireAuth` + `requireAdmin` | Knowledge frame schema pre-validation |
| `WS /api/live-voice` | Verified JWT (`?token=`) | `verifyFirebaseIdToken` | Full-duplex `gemini-3.8-live` audio/text bridge |

### 10.2 Environment Variables (`.env.example`)
- `GEMINI_API_KEY`: Server-side Gemini API key (configured via AI Studio Secrets; never prefixed with `VITE_`).
- `APP_URL`: Runtime Cloud Run / origin URL injected by AI Studio.
- `PORT`: Listening port (defaults to `3000`).
- `DISABLE_HMR`: Set to `true` in AI Studio preview to disable Vite WebSocket HMR cleanly.

### 10.3 Automated Test Suite, Lint & Build Commands

| Command | Scope | What It Verifies |
| :--- | :--- | :--- |
| `node --test tests/aiPipeline.test.ts` | 16 unit/integration specs | Forward chaining, BFS pathing, edge cases (insufficient/contradictory evidence), image mime/size checks, emergency safety overrides, PCM16 round-trip, catalog consistency |
| `node --test tests/marketplace.test.ts` | 6 marketplace specs | Technician filtering/ranking, double-booking detection, booking state-machine RBAC, itemized quotation math, HTTP 429 rate limiting |
| `npm run lint` (`tsc --noEmit`) | TypeScript compiler check | Type safety & JSX integrity across frontend and server |
| `npm run build` (`vite build`) | Production bundle | Compiles Vite SPA assets into `dist/` and copies `src/assets` |
| `npm run dev` / `npm start` | Server startup | `tsx server.ts` (dev) or `node server.ts` (prod) on port `3000` |
