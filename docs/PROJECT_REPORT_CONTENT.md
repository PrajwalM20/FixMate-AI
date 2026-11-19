# FixMate AI: Intelligent Appliance Troubleshooting and Repair Marketplace Platform
**Academic Project Report Content (VTU BCS516B — Artificial Intelligence)**  
**Tagline:** *Diagnose Smarter. Repair Better.*

---

## 1. Title & Project Overview
**Project Title:** FixMate AI — Hybrid AI Appliance Troubleshooting & Verified Technician Repair Marketplace  
**Course Alignment:** Visvesvaraya Technological University (VTU) — BCS516B Artificial Intelligence  
**Summary:** FixMate AI is a full-stack web application that bridges the gap between everyday household appliance failures, safe homeowner self-checks, and certified professional repair dispatch. It combines **Gemini multimodal perception** (`@google/genai`) with **transparent, server-side classical Artificial Intelligence engines**—structured Knowledge Representation, Forward-Chaining Rule Inference, Breadth-First Search (BFS) State-Space Planning, Reasoning Under Uncertainty, and Safety Override Policies—integrated with a real-time Firebase customer, technician, and admin repair marketplace.

---

## 2. Abstract
Modern household and electronic appliances frequently fail with ambiguous symptoms that confuse non-technical users and risk unsafe DIY attempts. Relying solely on black-box generative chatbots introduces hallucination risks, lacks auditable reasoning traces, and fails to enforce electrical or thermal safety boundaries. FixMate AI addresses this problem through a **Hybrid Intelligent Agent Architecture**. Natural-language descriptions and appliance images submitted by the user are first processed by a server-side Gemini multimodal perception module, which acts strictly as a *percept sensor* extracting canonical observations, visible warning signs, and missing context without issuing an authoritative final diagnosis. These percepts feed a deterministic **Knowledge Graph**, an iterative **Forward-Chaining Inference Engine**, a **Breadth-First Search (BFS) Troubleshooting Planner**, and a **Heuristic Uncertainty & Safety Gate**. When physical intervention or hazard escalation is required, the customer transitions seamlessly into a role-based **Repair Marketplace** backed by Firebase Authentication, Firestore security rules, atomic booking-slot locking, itemized quotation comparison, verified reviews, and admin governance.

---

## 3. Problem Statement
Homeowners facing malfunctioning refrigerators, washing machines, air conditioners, laptops, televisions, or microwaves encounter three systemic challenges:
1. **Unstructured Diagnostics & Safety Hazards:** Users either guess internal faults blindly (risking high-voltage shock, refrigerant exposure, or fire) or rely on unverified chatbots that lack safety overrides and explainable logic.
2. **Opaque Repair Pricing & Double Booking:** Discovering trustworthy technicians, sharing fault context accurately, preventing overlapping appointment slots, and comparing itemized repair estimates are fragmented across informal phone calls.
3. **Lack of Academic Transparency:** Few consumer tools demonstrate end-to-end classical AI foundations (PEAS formulation, production rules, state-space search, and uncertainty handling) working alongside modern multimodal perception.

---

## 4. Objectives
1. Design and deploy a **responsive, full-stack RBAC platform** supporting **Customer**, **Technician**, and **Admin** workflows backed by Firebase Auth, Firestore, and Storage.
2. Build a **Hybrid AI Diagnosis Engine** (`POST /api/ai/diagnose`, `POST /api/ai/followup`) separating **Gemini multimodal perception** from **server-side coded reasoning engines**.
3. Implement structured **Knowledge Representation** across 7 appliance categories with canonical facts, IF-THEN rules, fault hypotheses, safety constraints, and state-space graphs.
4. Implement **Forward-Chaining Rule Inference** with an auditable rule-firing trace and **Breadth-First Search (BFS)** with shortest-path troubleshooting visualization.
5. Quantify diagnostic ambiguity using **Heuristic Uncertainty Scoring** (supporting, missing, and contradictory evidence) and deterministic **Safety Hazard Escalation**.
6. Deliver a complete **Technician Marketplace** featuring rule-based matching, atomic slot-locked bookings, state-machine transitions, itemized quotation comparison, completed-job-gated reviews, and admin oversight.

---

## 5. Existing System vs. Proposed System

| Dimension | Existing / Traditional Systems | Proposed System (FixMate AI) |
| :--- | :--- | :--- |
| **Fault Diagnosis** | Generic search engines or ungrounded LLM chatbots prone to hallucinations | Hybrid AI: Gemini perception feeds coded Forward Chaining, BFS, and Uncertainty engines |
| **Explainability** | Black-box text responses with no rule trace | Full `inferenceTrace`, BFS path SVG graph, and supporting/missing/contradictory evidence |
| **Safety Handling** | Passive disclaimers buried in text | Deterministic Safety Override Gate triggers `stop_using_appliance` on critical hazards |
| **Technician Discovery** | Unverified directory listings | Admin-verified active technicians ranked transparently via weighted heuristics |
| **Booking Integrity** | Manual calls prone to double booking | Atomic Firestore `runTransaction` with `/bookingSlots/{slotKey}` locks & state machine |
| **Quotations & Reviews** | Informal verbal quotes and unverified reviews | Itemized quotes (`labor`, `parts`, `extra`) + 1 verified review strictly per completed booking |

---

## 6. System Architecture
FixMate AI follows a **Three-Tier Full-Stack Architecture**:
1. **Presentation Layer (React 19 + TypeScript + Vite + Tailwind CSS):** Public pages, Diagnosis Workspace, Technician Discovery (`/technicians`), Customer Portal (`/dashboard`), Technician Workbench (`/technician`), and Admin Console (`/admin`).
2. **Application & AI Logic Layer (Node.js + Express in `server.ts`):** Verifies Firebase ID tokens via JWKS (`jose`), enforces sliding-window rate limits (`server/middleware/rateLimit.ts`), invokes Gemini safely with `GEMINI_API_KEY`, runs classical AI algorithms (`server/ai/*`), and validates marketplace workflows (`server/services/marketplaceService.ts`).
3. **Persistence & Security Layer (Firebase Firestore, Auth & Storage):** Stores user profiles, technician profiles, repair requests, diagnoses, bookings, atomic slot locks, quotations, reviews, complaints, categories, and notifications protected by `firestore.rules`.

```
[Customer Browser (React + Firebase Client SDK)]
      │
      ├─── Direct Auth / Storage / Real-time Firestore Listeners (protected by firestore.rules)
      │
      └─── Authenticated HTTPS JSON + Bearer ID Token ──▶ [Express Backend (server.ts)]
                                                              ├── Rate Limiter & JWKS Auth
                                                              ├── Gemini Perception (sensor only)
                                                              ├── Knowledge Graph & Forward Chaining
                                                              ├── BFS Search Planner & Uncertainty Engine
                                                              ├── Safety Override Gate
                                                              └── Rule-Based Technician Matcher & Validators
```

---

## 7. Modules & User Roles
1. **Customer Role:** Submits text/image repair requests, executes hybrid AI diagnosis and interactive follow-up dialogue, browses verified technicians, opts in to share AI diagnosis reports, reserves non-conflicting slots, compares/accepts/rejects itemized quotations, leaves verified reviews on completed bookings, and files complaints.
2. **Technician Role:** Registers with skills/categories/service area, awaits admin verification, manages availability (`available`/`busy`/`offline`), inspects customer-shared diagnosis summaries, accepts/rejects booking requests, submits itemized quotations, updates job progress (`in_progress` -> `completed`), and replies to customer reviews.
3. **Admin Role:** Verifies, rejects, or suspends technicians; manages user roles and account suspensions; monitors repair requests, bookings, and AI safety escalations; resolves customer complaints; and seeds/toggles appliance categories and sample knowledge base entries.

---

## 8. AI Agent Design (PEAS, Agent Type, Environment)
- **Agent Type:** **Goal-Based + Utility-Informed Hybrid Diagnostic Agent** (acts safely to isolate actionable external checks or escalate hazardous internal faults).
- **PEAS Formulation:**
  - **Performance Measure:** Diagnostic hypothesis accuracy/coverage, shortest safe check sequence (BFS depth), zero unsafe DIY instructions on critical hazards, transparent uncertainty communication.
  - **Environment:** Partially observable, stochastic, sequential, discrete/continuous household appliance domain (user descriptions, photos, dynamic follow-up answers).
  - **Actuators:** Structured diagnosis report, follow-up clarifying questions, visual BFS state-space graph, safe troubleshooting instructions, safety stop overrides, technician booking escalation.
  - **Sensors:** Multimodal user text input, uploaded appliance photos (parsed via Gemini sensor), structured follow-up answers, appliance category selector.

---

## 9. Knowledge Representation Design
Implemented in `server/ai/knowledgeGraph.ts` and `server/ai/knowledgeBaseService.ts`, FixMate AI models domain knowledge using structured frames and production rules:
- **Appliance Category Ontology:** 7 categories (`refrigerator`, `washing_machine`, `air_conditioner`, `laptop`, `television`, `microwave`, `other`).
- **Canonical Facts (`FactId`):** Normalized symptom tokens (e.g., `fridge_warm`, `freezer_cold`, `standing_water_drum`, `sparks_in_cavity`, `outdoor_unit_not_running`).
- **Production Rules (`InferenceRule`):** Explicit `IF conditions[] THEN inferredFact` rules with rule IDs (`R_FR_01`, `R_WM_01`, `R_AC_03`, etc.) and human-readable reasons.
- **Fault Hypotheses (`KnowledgeHypothesisNode`):** Stores `requiredFacts`, `optionalFacts`, `contradictoryFacts`, `missingInfoPrompts`, `riskLevel`, and `requiresProfessional`.
- **State-Space Graphs (`SearchGraphNode`):** Directed diagnostic check graphs rooted at `start`, branching through safe `check` nodes toward `goal_safe` or `goal_escalate` leaf nodes.

---

## 10. Reasoning & Search Algorithms

### A. Coded Classical AI Algorithms vs. Gemini API (Clear Distinction)
| Component | Implementation Type | File | Role |
| :--- | :--- | :--- | :--- |
| **Multimodal Percept Extractor** | **External LLM API** (`@google/genai` `gemini-2.5-flash`) | `server/ai/geminiService.ts` | Extracts visible cues & symptom facts from text/images |
| **Knowledge Graph & Ontology** | **Coded Data Structure** | `server/ai/knowledgeGraph.ts` | Stores canonical facts, rules, hypotheses & state graphs |
| **Forward-Chaining Engine** | **Coded Classical AI Algorithm** | `server/ai/inferenceEngine.ts` | Fixed-point iterative deduction over working memory |
| **BFS Troubleshooting Planner** | **Coded Classical AI Algorithm** | `server/ai/searchPlanner.ts` | FIFO queue breadth-first shortest safe path search |
| **Uncertainty & Safety Gate** | **Coded Heuristic & Rule Policy** | `server/ai/uncertaintyEngine.ts` | Computes evidence scores (`0.05–0.95`) & hazard overrides |
| **Technician Recommendation** | **Coded Weighted Heuristic Matcher** | `server/ai/technicianMatcher.ts` | Ranks verified technicians using transparent weights |

### B. Pseudocode — Forward-Chaining Inference (`inferenceEngine.ts`)
```text
FUNCTION runForwardChaining(initialFacts, categoryRules):
  workingMemory <- SET(initialFacts)
  trace <- []
  changed <- TRUE
  step <- 1
  WHILE changed IS TRUE:
    changed <- FALSE
    FOR EACH rule IN categoryRules:
      IF rule.inferredFact NOT IN workingMemory
         AND ALL cond IN rule.conditions ARE IN workingMemory:
        ADD rule.inferredFact TO workingMemory
        APPEND { step, rule.id, rule.conditions, rule.inferredFact, rule.reason } TO trace
        step <- step + 1
        changed <- TRUE
  RETURN { workingMemory, trace }
```

### C. Pseudocode — Breadth-First Search Planner (`searchPlanner.ts`)
```text
FUNCTION runBfsTroubleshootingSearch(graph, workingMemory, isCriticalHazard):
  queue <- [ { nodeId: graph.rootId, path: [rootNode] } ]
  visited <- SET(graph.rootId)
  exploredLevels <- MAP()
  WHILE queue IS NOT EMPTY:
    current <- POP_FRONT(queue)
    RECORD current.node AT exploredLevels[current.depth]
    IF current.node.type == 'goal_escalate' AND isCriticalHazard:
      RETURN { selectedPath: current.path, exploredLevels }
    IF current.node.type IN ['goal_safe', 'goal_escalate']:
      RETURN { selectedPath: current.path, exploredLevels }
    FOR EACH edge IN current.node.edges:
      IF edge.targetId NOT IN visited AND edgeSatisfied(edge, workingMemory):
        ADD edge.targetId TO visited
        PUSH_BACK(queue, { nodeId: edge.targetId, path: current.path + [edge.target] })
  RETURN { selectedPath: bestFallbackPath, exploredLevels }
```

### D. Pseudocode — Heuristic Uncertainty Scoring (`uncertaintyEngine.ts`)
```text
FUNCTION scoreHypothesis(hypothesis, workingMemory):
  matchedReq <- COUNT(f IN hypothesis.requiredFacts WHERE f IN workingMemory)
  reqRatio <- matchedReq / MAX(1, LENGTH(hypothesis.requiredFacts))
  optBonus <- 0.15 * (COUNT(f IN hypothesis.optionalFacts WHERE f IN workingMemory) / MAX(1, LENGTH(optionalFacts)))
  contraCount <- COUNT(f IN hypothesis.contradictoryFacts WHERE f IN workingMemory)
  penalty <- 0.25 * contraCount
  rawScore <- (0.80 * reqRatio) + optBonus - penalty
  RETURN CLAMP(rawScore, 0.05, 0.95)
```

### E. Pseudocode — Rule-Based Technician Matching (`technicianMatcher.ts`)
```text
FUNCTION rankTechnicians(technicians, reviews, criteria):
  verified <- FILTER(technicians, t -> t.verificationStatus == 'verified')
  FOR EACH tech IN verified:
    sCat  <- matchesCategory(tech, criteria.category)        // weight 0.35
    sLoc  <- tokenOverlap(tech.serviceArea, criteria.loc)  // weight 0.25
    sAvl  <- availabilityWeight(tech.availabilityStatus)   // weight 0.15
    sRate <- bayesianOrLiveRating(tech, reviews)           // weight 0.15
    sExp  <- MIN(1, tech.experienceYears / 10)             // weight 0.10
    score <- 0.35*sCat + 0.25*sLoc + 0.15*sAvl + 0.15*sRate + 0.10*sExp + skillBonus
  RETURN SORT_DESC(scoredResults, by: [score, liveRating, experienceYears])
```

---

## 11. Multimodal Gemini Integration
Located in `server/ai/geminiService.ts`, Gemini (`gemini-2.5-flash`) is invoked strictly server-side using `process.env.GEMINI_API_KEY`. It receives the user's description, appliance category, and up to 3 base64 images (`inlineData`) and returns structured JSON matching a strict schema (`observedSymptoms`, `visualObservations`, `warningIndicators`, `missingContext`, `followUpQuestions`, `preliminaryNarrative`). If the API key is absent or rate-limited, `agentController.ts` records `geminiMeta.status` transparently and executes the full coded deterministic pipeline cleanly without failing.

---

## 12. Safety & Ethical Considerations
- **Visual Non-Proof Constraint:** Prompt instructions and UI notices explicitly remind users that appliance photographs cannot prove internal electrical or refrigerant faults.
- **Deterministic Safety Overrides:** Keywords/facts indicating burning odors, electrical arcing/sparks, chassis electric shocks, gas/refrigerant leaks, or microwave cabinet opening immediately override DIY steps with `stop_using_appliance`.
- **Estimate Transparency:** UI disclaimers clearly state that both AI diagnoses and technician quotations are preliminary estimates subject to physical inspection and customer approval.
- **No Fabricated Marketplace Data:** No fake real-world technician profiles or fake reviews are stored; demo previews are explicitly labeled `DEMO DATA`.

---

## 13. Database Design (Firebase Firestore)
- `/users/{userId}` — Private user identity, role (`customer`/`technician`/`admin`), and `accountStatus` (`active`/`suspended`).
- `/technicians/{technicianId}` — Public specialist profile, categories, skills, experience, service area, availability, verification status.
- `/repairRequests/{requestId}` — Customer problem submissions, images, status, risk level, linked diagnosis ID.
- `/diagnoses/{diagnosisId}` — Multimodal observations, matched knowledge IDs, ranked hypotheses, forward-chaining trace, BFS path/levels, safety warnings, follow-up conversation turns.
- `/bookings/{bookingId}` — Scheduled repair appointments, opt-in `sharedDiagnosisSummary`, state-machine `status`, `slotKey`.
- `/bookingSlots/{slotKey}` — Deterministic reservation locks (`reserved`/`released`) updated atomically with bookings inside `runTransaction`.
- `/quotations/{quotationId}` — Itemized labour, parts, additional fees, total estimate, completion time, proposed work, approval status.
- `/reviews/{reviewId}` — Deterministic ID `rev_${bookingId}` enforcing strictly one review per completed booking, plus optional `technicianResponse`.
- `/complaints/{complaintId}` — Customer/technician dispute reports managed by admins.
- `/notifications/{notificationId}` — Targeted alerts with relational sender validation.
- `/applianceCategories/{categoryId}`, `/knowledgeBase/{entryId}`, `/contactInquiries/{inquiryId}`, `/admins/{userId}`.

---

## 14. Security & Privacy Implementation
- **API Key Isolation:** `GEMINI_API_KEY` is read only on the Node.js server; never bundled into Vite (`VITE_*`).
- **Cryptographic Auth Middleware (`server/middleware/auth.ts`):** Verifies Firebase ID tokens against Google's public JWKS (`jose`) and enforces `email_verified === true`.
- **Rate Limiting (`server/middleware/rateLimit.ts`):** Protects `/api/ai/*` (25 req/min) and `/api/*` (120 req/min) with HTTP `429` + `Retry-After`.
- **Zero-Trust `firestore.rules`:** ESLint-verified (`@firebase/eslint-plugin-security-rules`) rules enforcing master gates, `isValid[Entity]()` blueprints, `affectedKeys().hasOnly()` action isolation, PII protection on `/users`, `existsAfter`/`getAfter` slot lock atomicity on `/bookings`, terminal state locks, and suspension enforcement (`isNotSuspended()`).

---

## 15. UI/UX & System Workflows
- **Diagnostic Workflow:** Select Appliance -> Enter Symptoms / Upload Photos / Answer Pre-checks -> Submit to `/api/ai/diagnose` -> Inspect Safety Banner, Ranked Hypotheses, Forward-Chaining Trace, Visual BFS SVG Graph, Safe Steps -> Continue Interactive Follow-Up -> Click **Find & Book Verified Technician**.
- **Marketplace Workflow:** Browse `/technicians` -> Filter by category/location/availability -> Inspect Match Score & Verified Reviews -> Request Booking with opt-in Diagnosis Sharing & Available Slot -> Technician Accepts & Sends Itemized Quote -> Customer Compares & Approves Quote (`confirmed`) -> Technician Marks `in_progress` -> `completed` -> Customer Submits 1 Verified Review -> Technician Replies.

---

## 16. Implementation Details
- **Backend Entry (`server.ts`):** Unified Express server binding `process.env.PORT || 3000`, mounting Vite dev middleware in development and serving `dist/` in production.
- **Atomic Booking Transactions (`src/services/firestoreService.ts`):** `createBooking` checks `/bookingSlots/{slotKey}` and writes `/bookings/{id}`, `/bookingSlots/{slotKey}`, and `/repairRequests/{requestId}` atomically inside `runTransaction`, releasing slots automatically on `rejected` or `cancelled` transitions.
- **Live Computed Ratings:** Instead of trusting client-writable `ratingAvg` counters, ratings are computed dynamically from verified documents in `/reviews`.

---

## 17. Testing & Validation
Automated test suites executed via Node.js built-in test runner (`node --test`):
1. `tests/aiPipeline.test.ts` (14 unit & integration tests): Covers multimodal normalization, refrigerator/washer/AC/laptop/TV/microwave forward-chaining rules, BFS shortest-path queue search, uncertainty penalty & missing evidence, critical hazard overrides (`burning smell`, `sparks`), and follow-up re-evaluation.
2. `tests/marketplace.test.ts` (6 unit & integration tests): Covers verified-only technician filtering, weighted heuristic ranking, booking slot conflict detection & post-cancel re-booking, booking state-machine transitions & role RBAC, itemized quotation arithmetic validation, and rate-limiter HTTP `429` enforcement.
3. Static & Rule Validation: TypeScript compiler (`tsc --noEmit`), Vite production build (`vite build`), and `@firebase/eslint-plugin-security-rules` (`npx eslint firestore.rules`).

---

## 18. Results & Screenshots Plan
*Recommended screenshots to attach in the final bound academic submission:*
1. Landing Page & Supported Appliances Catalog (`/`, `/services`).
2. AI Diagnosis Workspace (`/diagnose`) showing uploaded photo preview, safety override banner, ranked hypotheses, Forward-Chaining trace, and BFS SVG graph.
3. Verified Technician Discovery (`/technicians`) displaying rule-based Match Score % and open time slots.
4. Customer Portal (`/dashboard`) showing active booking timeline and side-by-side Quotation Comparison.
5. Technician Workbench (`/technician`) showing customer-shared diagnosis summary and itemized quotation builder.
6. Admin Operations Console (`/admin`) showing technician verification queue, booking monitor, and complaint resolution.

---

## 19. Advantages
1. **Auditable Explainable AI:** Every diagnostic output shows exact matched facts, fired rules, and BFS graph steps.
2. **Safety-First Design:** Deterministic hazard overrides prevent dangerous troubleshooting advice.
3. **Zero-Trust Marketplace Integrity:** Double-booking locks, state-machine RBAC, single-review-per-booking constraints, and itemized quote math checks work together across frontend, Express API, and Firestore rules.
4. **Graceful Resilience:** Classical AI inference and BFS planning continue operating even if Gemini API quotas are exhausted.

---

## 20. Limitations
1. Rule-based knowledge coverage is bounded to the curated fault ontology (7 categories, 12+ fault rules) rather than an exhaustive OEM service manual corpus.
2. Heuristic match scores and Bayesian rating weights are educational confidence indicators, not calibrated statistical probabilities.
3. Rate limiting uses in-memory sliding windows per server instance; multi-replica production scaling would require Redis-backed rate limiting.
4. Payment settlement is intentionally excluded; financial settlements happen offline after physical inspection.

---

## 21. Future Enhancements
1. **Probabilistic Bayesian Networks / Belief Updating:** Replace heuristic confidence weights with calibrated conditional probability tables learned from closed repair outcomes.
2. **Dynamic Knowledge Base Authoring:** Allow verified senior technicians and admins to author new production rules directly in Firestore with automated cycle detection.
3. **Real-Time Technician Geolocation & Dispatch Routing:** Integrate Google Maps Platform distance matrix calculations into the rule-based technician matcher.
4. **In-App Encrypted Messaging & Warranty Tracking:** Add real-time chat between booked customers and technicians plus post-repair warranty logs.

---

## 22. Conclusion
FixMate AI successfully demonstrates how classical Artificial Intelligence principles from **VTU BCS516B**—Knowledge Representation, Forward-Chaining Inference, Breadth-First State-Space Search, Reasoning Under Uncertainty, and Safety-Constrained Agents—can be harmoniously combined with modern Gemini multimodal perception inside a secure, production-ready repair marketplace. Rather than delegating decisions to an opaque LLM, FixMate AI keeps reasoning transparent, verifiable, safe, and directly actionable for homeowners, technicians, and platform administrators.

---

## 23. References
1. Russell, S., & Norvig, P. *Artificial Intelligence: A Modern Approach* (4th Edition). Pearson.
2. Visvesvaraya Technological University (VTU). *BCS516B: Artificial Intelligence* Syllabus & Course Outcomes.
3. Google AI for Developers. *Gemini API & `@google/genai` TypeScript SDK Documentation*.
4. Firebase Documentation. *Cloud Firestore Security Rules, Transactions, and Authentication*.
5. Express.js & React TypeScript Official Documentation.
