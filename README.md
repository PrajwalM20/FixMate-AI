# FixMate AI — Diagnose Smarter. Repair Better.

FixMate AI is a full-stack AI-powered appliance troubleshooting and verified technician repair marketplace built for the **VTU BCS516B (Artificial Intelligence)** academic syllabus.

The platform combines **Gemini multimodal perception** (for natural-language symptom extraction and visual inspection of uploaded appliance photos) with **server-side coded classical AI engines**—structured Knowledge Representation, Forward-Chaining Rule Inference, Breadth-First Search (BFS) Troubleshooting State-Space Planning, Heuristic Reasoning Under Uncertainty, and Safety Override Policies—connected to a real-time **Firebase** customer, technician, and admin repair marketplace.

---

## Core Architecture & Features

### 1. Hybrid AI Diagnostic Pipeline (Server-Side)
- **Multimodal Perception (`server/ai/geminiService.ts`)**: Uses `@google/genai` (`gemini-2.5-flash`) exclusively on the backend to extract visible appliance cues and normalized symptom facts from text + up to 3 uploaded images (JPEG/PNG/WebP). Images are treated strictly as supporting evidence—never as proof of hidden internal faults.
- **Knowledge Representation (`server/ai/knowledgeGraph.ts`, `server/ai/knowledgeBaseService.ts`)**: Typed ontology covering 7 appliance categories (`refrigerator`, `washing_machine`, `air_conditioner`, `laptop`, `television`, `microwave`, `other`), observable facts, causal rules (`IF-THEN`), cause hypotheses, missing-evidence prompts, and state-space graph edges.
- **Forward-Chaining Rule Engine (`server/ai/inferenceEngine.ts`)**: Iterative fixed-point working-memory deduction over canonical facts, emitting an auditable `inferenceTrace`.
- **BFS Troubleshooting Planner (`server/ai/searchPlanner.ts`)**: Explores the appliance troubleshooting graph using an explicit FIFO queue (`Breadth-First Search`) to find the shortest safe diagnostic check path and render an interactive SVG state-space visualization.
- **Uncertainty & Safety Scoring (`server/ai/uncertaintyEngine.ts`)**: Computes heuristic evidence scores (`0.05–0.95`) with supporting, missing, and contradictory evidence explanations plus deterministic hazard escalation (`stop_using_appliance` for burning smell, sparks, gas/refrigerant, shock, microwave housing).

### 2. Full-Stack Repair Marketplace (Customer / Technician / Admin)
- **Role-Based Authentication**: Firebase Authentication with verified-email enforcement, Google Sign-In, password reset, and `Customer` / `Technician` / `Admin` portals.
- **Rule-Based Technician Discovery (`/technicians`)**: Matches and ranks only administrator-verified, non-suspended technicians using transparent weighted heuristics (`category 0.35`, `location 0.25`, `availability 0.15`, `live customer rating 0.15`, `experience 0.10`). Any preview data when zero real technicians exist is explicitly labeled `DEMO DATA`.
- **Double-Booking Prevention**: Atomic Firestore `runTransaction` reserving deterministic `/bookingSlots/{slotKey}` documents alongside `/bookings/{bookingId}` plus server-side `/api/bookings/validate`.
- **State-Machine Booking Lifecycle**: Enforces valid transitions (`requested -> accepted -> quotation_submitted -> confirmed -> in_progress -> completed`, or `rejected` / `cancelled`) via server validation and `firestore.rules`.
- **Itemized Quotation System**: Technicians submit itemized labour, parts, extra charges, completion time, and proposed work; customers compare quotations side-by-side and accept/reject them with explicit estimate disclaimers.
- **Verified Reviews & Complaints**: Strictly one review per completed booking (`rev_${bookingId}`), single technician response, and customer dispute/complaint resolution in the Admin Console.

---

## Tech Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, Lucide Icons, Motion
- **Backend**: Node.js, Express (`server.ts`), TypeScript (`tsx`)
- **AI SDK**: `@google/genai` (server-side only)
- **Database, Auth & Storage**: Firebase Firestore, Firebase Authentication, Firebase Storage
- **Security**: `jose` JWKS ID token verification, sliding-window rate limiting (`server/middleware/rateLimit.ts`), ESLint-verified `firestore.rules`

---

## Environment Variables

Copy `.env.example` to `.env` for local development (never commit secrets):

| Variable | Required | Purpose |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes (for Gemini multimodal perception) | Server-side Gemini API key (`@google/genai`). Never exposed to frontend. |
| `APP_URL` | Optional | Public URL where the app is hosted. |
| `PORT` | Optional (default `3000`) | HTTP port bound by Express server. |

Firebase client configuration is stored in `firebase-applet-config.json`.

---

## Local Setup & Commands

```bash
# 1. Install dependencies
npm install

# 2. Run TypeScript check
npm run lint

# 3. Lint Firestore Security Rules
npx eslint firestore.rules

# 4. Run Phase 2 AI & Phase 3 Marketplace unit tests
node --test tests/aiPipeline.test.ts tests/marketplace.test.ts

# 5. Start full-stack dev server (Express + Vite middleware on port 3000)
npm run dev

# 6. Build production bundle & run production server
npm run build
npm start
```

---

## Backend API Summary

| Method & Path | Auth | Description |
| :--- | :--- | :--- |
| `GET /api/health` | Public | Server health and release status check |
| `GET /api/ai/architecture` | Public | VTU BCS516B agent architecture & Gemini status manifest |
| `GET /api/knowledge-base` | Public | Structured appliance categories and fault knowledge entries |
| `POST /api/technicians/recommend` | Public | Rule-based weighted technician matching & ranking |
| `POST /api/ai/diagnose` | Bearer Token | Multimodal perception + Forward Chaining + BFS + Uncertainty + Safety |
| `POST /api/ai/followup` | Bearer Token | Interactive follow-up diagnostic re-evaluation |
| `POST /api/bookings/validate` | Bearer Token | Server-side slot conflict & booking payload validation |
| `POST /api/bookings/validate-transition` | Bearer Token | Actor-aware booking state-machine validation |
| `POST /api/quotations/validate` | Bearer Token | Itemized quotation arithmetic & schema validation |
| `POST /api/admin/validate-kb-entry` | Admin Bearer | Validates draft knowledge base entries |

---

## Documentation
- `/docs/AI_IMPLEMENTATION.md` — Deep dive into the VTU BCS516B Hybrid AI pipeline
- `/docs/DEPLOYMENT.md` — Cloud Run & Firebase deployment guide
- `/docs/PROJECT_REPORT_CONTENT.md` — Complete 23-section academic project report
- `/security_spec.md` — Security invariants & threat model for Firestore rules
