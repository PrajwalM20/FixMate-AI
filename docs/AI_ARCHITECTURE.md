# FixMate AI — Academic AI Architecture Specification

**Course Alignment:** VTU BCS516B — Artificial Intelligence  
**System:** FixMate AI (Appliance Troubleshooting & Repair Assistance Platform)  
**Phase:** Phase 1 — Architectural Foundation, Knowledge Representation & Deterministic Interfaces  

---

## 1. Intelligent Agent Architecture

FixMate AI is modeled as a **Goal-Based and Utility-Aware Intelligent Agent** operating over a partially observable, stochastic, sequential, and discrete physical troubleshooting environment.

### PEAS Task Environment Specification
- **Performance Measure:** Diagnostic accuracy, minimization of user safety risk (electrical/gas/thermal hazards), reduction of unnecessary technician dispatches, and concise step efficiency.
- **Environment:** Home appliance fault states, user-reported symptoms, sensor/error codes, optional appliance photographs, and verified technician availability.
- **Actuators:** Structured diagnostic explanations, ranked cause hypotheses, interactive follow-up clarification queries, safe DIY step sequences, hazard warnings, and professional technician dispatch recommendations.
- **Sensors:** Natural language symptom descriptions, appliance category/brand/model metadata, structured follow-up answers, and uploaded image evidence (stored in Firebase Storage).

### Agent Processing Pipeline (Modular Backend Architecture)
All backend AI services live under `server/ai/` with strictly decoupled interfaces:
1. **Agent Controller (`server/ai/agentController.ts`)**: Orchestrates the Sense → Perceive → Retrieve → Infer → Search → Evaluate → Act cycle, tracks session state, and coordinates persistence.
2. **Perception Service (`server/ai/perceptionService.ts`)**: Extracts structured symptom tokens, error codes, severity cues, and (in Phase 2) visual defect features from uploaded appliance images.
3. **Knowledge Base Service (`server/ai/knowledgeBaseService.ts`)**: Queries structured fault frames stored in Firestore `knowledgeBase` and curated domain rules.
4. **Inference Engine (`server/ai/inferenceEngine.ts`)**: Matches extracted percepts against fault frames using rule-based forward/backward chaining interfaces.
5. **Search Engine (`server/ai/searchEngine.ts`)**: Explores troubleshooting action paths modeled as a state-space graph from observed symptoms to verified resolution or safe escalation.
6. **Uncertainty & Decision Engine (`server/ai/uncertaintyEngine.ts`)**: Computes belief scores over competing fault hypotheses, evaluates safety risk, and applies Expected Utility / decision-theoretic thresholds to decide DIY vs. professional escalation.
7. **Gemini Integration Service (`server/ai/geminiService.ts`)**: Server-side adapter boundary for `@google/genai` multimodal perception and natural-language synthesis (Phase 2).
8. **Database Service (`server/ai/databaseService.ts`)**: Handles validated read/write payloads and server-side audit boundaries.

---

## 2. Agent Inputs, Internal Processing, and Outputs

| Stage | Input | Internal Representation | Output |
| :--- | :--- | :--- | :--- |
| **1. Perception** | Raw symptom text, appliance category, optional image URLs | `PerceptBundle` (normalized symptom keywords, severity indicators, image references) | Structured observations list |
| **2. Knowledge Retrieval** | `applianceCategory`, `observations` | `KnowledgeFrame[]` (fault schemas from Firestore `knowledgeBase`) | Candidate fault entries |
| **3. Inference** | `PerceptBundle` + `KnowledgeFrame[]` | Rule-based matching & Horn-clause premise evaluation | Candidate `FaultHypothesis[]` |
| **4. Troubleshooting Search** | Initial symptom state + safe check operators | State-space tree / troubleshooting path nodes | Ordered `TroubleshootingStep[]` |
| **5. Uncertainty & Decision** | Hypothesis weights + safety hazard flags | Posterior belief distribution + risk matrix (`low`, `medium`, `high`, `critical`) | `confidenceScore`, `requiresProfessional`, `riskLevel` |
| **6. Action Synthesis** | Ranked hypotheses + safe steps + escalation flag | `DiagnosticReport` | Structured diagnosis saved to Firestore `diagnoses` |

---

## 3. Knowledge Representation Approach

FixMate AI uses a **Hybrid Frame-Based & Propositional Rule Representation** stored in the Firestore `knowledgeBase` collection.

Each `KnowledgeBaseEntry` acts as a structured **Semantic Frame** with explicit slots:
- `applianceCategory`: Domain partition (`refrigerator`, `washing_machine`, `air_conditioner`, `laptop`, `television`, `microwave`, `other`)
- `faultTitle`: Target fault predicate (e.g., `Evaporator Coil Frost Buildup`)
- `observableSymptoms`: Set of observable evidence predicates ($E_1, E_2, \dots, E_n$)
- `possibleCauses`: Root causal factors ($C_1, C_2, \dots, C_m$)
- `followUpQuestions`: Information-gain queries to disambiguate competing hypotheses
- `safeTroubleshootingSteps`: Pre-validated, non-hazardous operator actions
- `riskLevel`: Safety constraint label (`low | medium | high | critical`)
- `requiresProfessional`: Hard escalation constraint (e.g., high-voltage magnetron or refrigerant leaks)

This schema allows deterministic rule inference in Phase 1 and Retrieval-Augmented Grounding (RAG) with Gemini in Phase 2 without changing the database schema.

---

## 4. Planned Inference and Search Algorithms

### Phase 1 (Current Architectural Foundation)
- Interfaces, type contracts, and transparent **deterministic Phase 1 stub pipeline** (`engineMode: "phase1_deterministic_stub"`) that matches structured symptoms against the sample knowledge base and explicitly labels results as Phase 1 rule-matched baseline diagnostics.

### Phase 2 (Planned Algorithmic Implementation)
- **Forward Chaining (Data-Driven Inference):** Starting from extracted `PerceptBundle` symptoms, fire Horn-style rules (`IF symptom_A AND symptom_B THEN suspect_fault_X`) to populate active hypotheses.
- **Backward Chaining (Goal-Driven Verification):** Given top candidate fault $H_k$, select unanswered `followUpQuestions` to verify missing premises and prune invalid hypotheses.
- **Heuristic State-Space Search ($A^*$ / Best-First Search):** Model troubleshooting steps as state transitions where:
  - $g(n)$ = cumulative user effort, time, and risk cost of prior checks
  - $h(n)$ = estimated remaining diagnostic steps weighted by fault likelihood and information gain
  - Goal test = Fault isolated safely or escalation threshold triggered.

---

## 5. Perception and Natural-Language Understanding (NLU)

In real-world appliance repair, users describe symptoms informally (e.g., *"fridge makes clicking noise every 2 minutes and freezer is warm"*).
- **Textual NLU (Phase 2 via Gemini):** Maps unstructured colloquial descriptions to canonical knowledge-base symptom predicates, extracts appliance brand/model entities, and detects urgent hazard cues (burning smell, sparking, gas odor, water near live mains).
- **Visual Perception (Phase 2 via Gemini Multimodal):** Inspects user-uploaded images (ice buildup, error code LEDs, burnt PCB capacitors, leaking seals) stored in Firebase Storage to supplement textual percepts with visual observations.

---

## 6. Handling Uncertainty and Risk

Diagnostic environments are inherently uncertain because multiple faults share overlapping symptoms (e.g., *washer not draining* could be a clogged coin trap, kinked hose, or failed drain pump).

Planned Phase 2 uncertainty model:
- **Bayesian Belief Updating / Certainty Factors:** Compute posterior probability $P(H_i \mid E_1, \dots, E_k)$ across candidate causes using symptom likelihoods and prior fault frequencies.
- **Information Gain (Entropy Reduction):** Rank `followUpQuestions` by expected reduction in Shannon entropy $H(\text{Fault})$ so the agent asks the most discriminating question next.
- **Safety-First Decision Theory:** Even if a DIY step is theoretically possible, if $Risk(H_i) \in \{\text{high}, \text{critical}\}$ (e.g., microwave high-voltage capacitor, AC refrigerant line, gas leak), the **Utility & Decision Engine** overrides DIY steps and enforces `requiresProfessional = true`.

---

## 7. Mapping to VTU BCS516B Course Outcomes

| VTU BCS516B Syllabus Module / Course Outcome | FixMate AI Component & Implementation |
| :--- | :--- |
| **CO1: Foundations of AI & Intelligent Agents** — Understand agent architectures, PEAS descriptions, and task environments. | `AgentController` (`server/ai/agentController.ts`) & PEAS architecture modeling partially observable household troubleshooting. |
| **CO2: Problem Solving by Searching** — Formulate problems as state spaces and apply uninformed/heuristic search ($BFS$, $DFS$, $A^*$). | `SearchEngine` (`server/ai/searchEngine.ts`) modeling troubleshooting sequences as cost- and risk-bounded state-space graphs. |
| **CO3: Knowledge Representation & Logic** — Represent domain knowledge using propositional/first-order logic, frames, and rule inference. | `KnowledgeBaseService` & `InferenceEngine` (`knowledgeBase` Firestore frames, forward/backward chaining rule interfaces). |
| **CO4: Reasoning Under Uncertainty** — Apply probability theory, Bayes' rule, Bayesian networks, and decision theory under incomplete information. | `UncertaintyEngine` (`server/ai/uncertaintyEngine.ts`) computing hypothesis confidence scores, entropy-based follow-up selection, and risk escalation thresholds. |
| **CO5: Perception, NLP & Applied AI Systems** — Integrate natural-language understanding and visual perception into real-world intelligent systems. | `PerceptionService` + `GeminiIntegrationService` (`server/ai/perceptionService.ts`, `server/ai/geminiService.ts`) connecting Firebase Storage imagery and NLU to grounded knowledge frames. |
