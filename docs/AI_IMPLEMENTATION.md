# FixMate AI — Phase 2 Hybrid AI Implementation Guide

**Academic Alignment:** VTU BCS516B Artificial Intelligence  
**System:** FixMate AI (*Diagnose Smarter. Repair Better.*)  
**Architecture Pattern:** Hybrid AI Troubleshooting Agent (LLM Multimodal Perception + Coded Knowledge-Based Reasoning)

---

## 1. Architectural Separation: Perception vs. Coded Reasoning

A central design requirement of FixMate AI is that **Gemini is never used as a standalone black-box diagnostician**. Instead, the platform implements a five-stage modular pipeline inside `/server/ai/`:

1. **Multimodal Perception & NLU** (`geminiService.ts`, `perceptionService.ts`)
2. **Knowledge Representation** (`knowledgeGraph.ts`, `knowledgeBaseService.ts`)
3. **Rule-Based Forward Chaining Inference** (`inferenceEngine.ts`)
4. **Breadth-First Search (BFS) Path Exploration** (`searchEngine.ts`)
5. **Uncertainty Reasoning & Safety Decision Engine** (`uncertaintyEngine.ts`, `decisionEngine.ts`)

Orchestrated end-to-end by `AgentController` (`server/ai/agentController.ts`).

| Responsibility | Handled By | Why |
|---|---|---|
| Reading unstructured customer descriptions & follow-up updates | Gemini NLU (`gemini-4-hydrogen`) + Deterministic Lexical Matcher | Extracts normalized symptoms without hallucinating hidden faults |
| Inspecting uploaded JPEG/PNG/WebP photos | Gemini Vision (`gemini-4-hydrogen`, server-side inlineData) | Extracts **visible cues only** (error codes, frost, water, scorch marks) — never treats images as proof of internal faults |
| Mapping observations to candidate causes | `InferenceEngine` (Forward Chaining over `KNOWLEDGE_RULES`) | Auditable, deterministic step-by-step `inferenceTrace` |
| Choosing the troubleshooting check sequence | `SearchEngine` (FIFO Queue BFS over `TROUBLESHOOTING_GRAPHS`) | Level-by-level state-space exploration avoiding cycles |
| Ranking causes & reporting missing/conflicting info | `UncertaintyEngine` | Transparent rule-based score `[0.08..0.92]` with explicit non-statistical disclaimer |
| Enforcing safety stops & technician escalation | `DecisionEngine` | Hard overrides (`stop_using_appliance`, `emergency`) cannot be bypassed by LLM output |

---

## 2. Intelligent Agent Formulation (VTU BCS516B)

FixMate AI implements a **Knowledge-Based Goal & Utility Hybrid Agent**:

- **Percepts ($P$):** Appliance category, brand/model, symptom summary, detailed text, up to 3 uploaded appliance photos (`inlineImages` or allowlisted Firebase Storage URLs), follow-up answers, and conversation history.
- **Internal State ($S$):** Working memory of canonical fact IDs (`workingMemoryFacts`), source reliability tags (`user_text: 1.0`, `follow_up_answer: 0.95`, `gemini_nlu: 0.85`, `gemini_vision: 0.70`), and conversation turn history (`FollowUpTurn[]`).
- **Reasoning Rules ($R$):** Structured IF/THEN rules (`KNOWLEDGE_RULES`) and state-space troubleshooting graphs (`TROUBLESHOOTING_GRAPHS`) across all 7 appliance categories (`refrigerator`, `washing_machine`, `air_conditioner`, `laptop`, `television`, `microwave`, `other`).
- **Actions ($A$):** One of five discrete recommendations selected by `DecisionEngine`:
  - `safe_external_checks`
  - `ask_follow_up_questions`
  - `continue_diagnosis`
  - `contact_qualified_technician`
  - `stop_using_appliance` (Emergency Safety Override)

---

## 3. Multimodal Perception & NLP Pipeline

### Server-Side Gemini Integration (`server/ai/geminiService.ts`)
- Executed exclusively on Node.js (`@google/genai` SDK, model `gemini-4-hydrogen`, custom header `User-Agent: 'aistudio-build'`).
- Enforces structured JSON output via `responseMimeType: 'application/json'` and `responseSchema` (`Type.OBJECT`) with fields: `problemSummary`, `userReportedSymptoms`, `imageObservations`, `matchedFactIds`, `detectedWarningSigns`, `missingInformation`, `contradictoryCues`, and `followUpQuestions`.
- Every Gemini response passes through `validateGeminiPerceptionPayload()`. Invalid JSON or missing schema fields return an explicit `malformed_response` status rather than crashing or silently faking Gemini output.
- If `GEMINI_API_KEY` is missing or an API call fails:
  - **Text / Text+Image submissions:** `PerceptionService` transparently records `geminiMeta.status` (`missing_api_key` or `api_error`) and proceeds with `extractDeterministicFacts()` so coded reasoning still runs honestly.
  - **Image-only submissions with no text:** `PerceptionService` throws an explicit error so the client does not invent fake visual observations.

---

## 4. Knowledge Representation (`server/ai/knowledgeGraph.ts`)

Knowledge is encoded in four structured registries:
1. **`HAZARD_FACTS`**: Critical safety triggers (`hazard_smoke`, `hazard_burning_smell`, `hazard_sparks`, `hazard_exposed_wiring`, `hazard_gas_leak`, `hazard_water_near_electrical`, `hazard_severe_overheating`).
2. **`FACT_VOCABULARY`**: Canonical observable facts (e.g., `appliance_running`, `fridge_not_cooling`, `water_in_drum`, `drain_cycle_incomplete`, `ac_weak_airflow`, `laptop_overheating`, `microwave_no_heat`).
3. **`KNOWLEDGE_RULES`**: Propositional IF/THEN rules with `antecedents`, optional `negatedAntecedents`, `consequentFact`, human-readable `description`, and optional `suggestedCauseId`.
4. **`CAUSE_DEFINITIONS` & `TROUBLESHOOTING_GRAPHS`**: Ranked cause definitions with required/supporting/contradictory facts, missing-evidence prompts, safe DIY steps, and directed troubleshooting state graphs.

---

## 5. Forward Chaining Inference Engine (`server/ai/inferenceEngine.ts`)

### Algorithm & Pseudocode

```text
FUNCTION runForwardChaining(category, initialFacts):
  workingMemory ← Set(initialFacts)
  firedRules ← Set()
  inferenceTrace ← []
  applicableRules ← filter KNOWLEDGE_RULES by (category or 'any')
  iteration ← 0

  DO
    progress ← false
    iteration ← iteration + 1
    FOR EACH rule IN applicableRules:
      IF rule.id NOT IN firedRules:
        IF all(f IN workingMemory for f IN rule.antecedents)
           AND all(neg NOT IN workingMemory for neg IN rule.negatedAntecedents):
          firedRules.add(rule.id)
          IF rule.consequentFact NOT IN workingMemory:
            workingMemory.add(rule.consequentFact)
            progress ← true
          APPEND {step, ruleId, matchedFacts, inferredFact, reason} TO inferenceTrace
  WHILE progress AND iteration < 15

  RETURN { workingMemoryFacts, inferenceTrace, matchedRuleIds, candidateCauseIds }
```

### Example Multi-Step Trace (Washing Machine)
- **Input Facts:** `water_in_drum`, `drain_cycle_incomplete`, `unusual_noise`
- **Step 1 (`R_WASHER_01`):** `water_in_drum` ∧ `drain_cycle_incomplete` → `investigate_drainage_system`
- **Step 2 (`R_WASHER_03`):** `investigate_drainage_system` → `drainage_obstruction_possible` (Candidate: Drain Filter/Hose Blockage)
- **Step 3 (`R_WASHER_04`):** `investigate_drainage_system` ∧ `unusual_noise` → `drain_pump_impeller_possible` (Candidate: Drain Pump Failure/Jam)

All inferred conclusions are explicitly framed as **possible causes**, never physical proof.

---

## 6. Breadth-First Search (BFS) Troubleshooting Path (`server/ai/searchEngine.ts`)

`SearchEngine.searchTroubleshootingGraph()` explores the appliance's directed state-space graph level-by-level starting from `startNodeId` using a FIFO queue and a `visited` Set to prevent cycles. Outgoing edges at each depth are ordered by overlap with `workingMemoryFacts` so fact-supported branches are prioritized at the same BFS level.

### Pseudocode

```text
FUNCTION searchTroubleshootingGraph(category, workingMemoryFacts):
  queue ← [{ nodeId: startNodeId, level: 0, viaReason: "Initial problem state" }]
  visited ← Set([startNodeId])
  parentMap ← Map()

  WHILE queue IS NOT EMPTY:
    current ← queue.shift()   // FIFO dequeue
    RECORD current IN exploredLevels[current.level]

    IF current IS goal_safe OR goal_escalate:
      UPDATE bestGoalNodeId BY fact-weighted edge alignment

    outgoing ← SORT outgoing edges of current BY matched facts DESC
    FOR EACH edge IN outgoing:
      IF edge.to NOT IN visited:
        visited.add(edge.to)
        parentMap[edge.to] ← { parentId: current.nodeId, reason: edge.reason }
        queue.push({ nodeId: edge.to, level: current.level + 1, viaReason: edge.reason })

  RECONSTRUCT shortest path from startNodeId to bestGoalNodeId via parentMap
  RETURN { selectedPath, exploredLevels, graphNodes, graphEdges, recommendedSteps }
```

### BFS Flow Diagram

```text
[Level 0: Start State]
        │
        ├──(Edge: check vents / filter)──► [Level 1: Safe External Check]
        │                                         │
        │                                         └──► [Level 2: Candidate Cause] ──► [Level 3: Goal Safe / Escalate]
        │
        └──(Edge: hazard / no power)─────► [Level 1: Power / Hazard Gate] ──► [Level 2: Goal Escalate]
```

---

## 7. Reasoning Under Uncertainty (`server/ai/uncertaintyEngine.ts`)

Each candidate cause $c$ receives a transparent **Rule-Based Evidence Score** bounded to $[0.08, 0.92]$:

$$\text{RawScore}(c) = 0.35 \cdot w_{\text{prior}} + \sum_{f \in R_{\text{matched}}} 0.32 \cdot r(f) + \sum_{f \in S_{\text{matched}}} 0.14 \cdot r(f) + \min(0.20, 0.05 \cdot |M_{\text{rules}}|) - P_{\text{missing}} - P_{\text{contradict}}$$

where:
- $r(f)$ is source reliability (`1.0` direct user text, `0.95` follow-up answer, `0.85` Gemini NLU, `0.70` image-only perception).
- $P_{\text{missing}} = 0.25 \cdot |\text{missingRequired}| + 0.04 \cdot |\text{missingSupporting}|$.
- $P_{\text{contradict}} = 0.35 \cdot |\text{matchedContradictions}| + 0.15 \cdot |\text{perceptionContradictions}|$.
- **Insufficient Evidence Flag:** Triggered when `hypotheses.length === 0`, `topScore < 0.35`, or minimal facts matched (`matchedRuleIds.length === 0 && canonicalFactIds.length <= 1`).
- **Explicit Limitation:** Every assessment includes `scoreDisclaimer` stating that scores measure KB rule alignment—not calibrated statistical failure probabilities.

---

## 8. Safety & Decision Engine (`server/ai/decisionEngine.ts`)

1. **Hazard Detection:** Checks `HAZARD_FACTS` and Gemini `detectedWarningSigns`.
2. **Hard Safety Override:** If any severe hazard is active (smoke, burning smell, sparks, exposed wiring, gas leak, water near electrical parts, severe overheating), the engine discards normal DIY steps and forces:
   - `riskLevel: 'critical'`
   - `urgencyLevel: 'emergency'`
   - `nextRecommendedAction: 'stop_using_appliance'`
   - `requiresProfessional: true`
   - `safetyOverrideApplied: true`
3. **Instruction Filtering:** Strips any step matching `PROHIBITED_ADVICE_PATTERNS` (opening live electrical panels, bypassing safety interlocks/fuses, handling refrigerants, disassembling magnetrons).

---

## 9. Sample Input & Output Trace

**Input:** Refrigerator — *"Running continuously, buzzing/clicking every few minutes, freezer is also warm."*

1. **Perception:** Extracts `appliance_running`, `fridge_not_cooling`, `freezer_warm`, `compressor_clicking`, `unusual_noise`.
2. **Forward Chaining:**
   - `R_FRIDGE_01`: `appliance_running` + `fridge_not_cooling` → `cooling_system_issue_possible`
   - `R_FRIDGE_05`: `compressor_clicking` + `fridge_not_cooling` → `compressor_start_circuit_suspect` (`cause_fridge_compressor_relay`)
   - `R_FRIDGE_06`: `cooling_system_issue_possible` + `unusual_noise` → `collect_additional_cooling_info`
3. **BFS Search Path:** `L0: Refrigerator Cooling Issue` → `L1: Check Rear Airflow & Compressor Area (Unplugged)` → `L2: Suspect Start Relay / Compressor Overload` → `L3: Escalate to Sealed-System Technician`.
4. **Decision:** `riskLevel: 'high'`, `urgencyLevel: 'urgent'`, `nextRecommendedAction: 'contact_qualified_technician'`, `requiresProfessional: true`.
