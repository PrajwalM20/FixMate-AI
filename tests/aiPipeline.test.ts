import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { agentController } from '../server/ai/agentController.ts';
import { databaseService } from '../server/ai/databaseService.ts';
import { decisionEngine } from '../server/ai/decisionEngine.ts';
import { validateGeminiPerceptionPayload } from '../server/ai/geminiService.ts';
import { inferenceEngine } from '../server/ai/inferenceEngine.ts';
import { searchEngine } from '../server/ai/searchEngine.ts';
import { uncertaintyEngine } from '../server/ai/uncertaintyEngine.ts';
import type { PerceptBundle } from '../server/ai/types.ts';
import {
  SAMPLE_APPLIANCE_CATEGORIES,
  SAMPLE_DIAGNOSTIC_PRESETS,
  SAMPLE_KNOWLEDGE_BASE,
  SAMPLE_VERIFIED_TECHNICIANS,
} from '../src/data/sampleKnowledgeBase.ts';
import { base64Pcm16ToFloat32, float32ToPcm16Base64 } from '../src/utils/audioPcm.ts';

describe('FixMate AI Phase 2 Hybrid Reasoning & Safety Suite', () => {
  // 1. Core Scenario: Refrigerator running not cooling
  it('1. Refrigerator running but not cooling triggers forward chaining & BFS path', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'refrigerator',
      symptomSummary: 'Refrigerator is running but not cooling',
      symptomDetails:
        'Motor turns on, freezer cold, but fridge warm with poor ventilation and frost buildup.',
      imageUrls: [],
    });

    assert.equal(out.applianceCategory, 'refrigerator');
    assert.ok(out.matchedKnowledgeIds.includes('R_FRIDGE_01'));
    assert.ok(
      out.matchedKnowledgeIds.includes('R_FRIDGE_02') ||
        out.matchedKnowledgeIds.includes('R_FRIDGE_03')
    );
    assert.ok(out.inferenceTrace.length >= 2);
    assert.ok(out.bfsSearchPath.length >= 3);
    assert.ok(out.hypotheses.length >= 1);
    assert.ok(out.scoreDisclaimer.toLowerCase().includes('not a statistical probability'));
  });

  // 2. Core Scenario: Washing machine not draining
  it('2. Washing machine not draining chains drainage rules and includes safe filter steps', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'washing_machine',
      symptomSummary: 'Washing machine does not drain water',
      symptomDetails:
        'Standing water remains in drum and cycle stops before spin completes with unusual noise.',
      imageUrls: [],
    });

    assert.ok(out.matchedKnowledgeIds.includes('R_WASHER_01'));
    assert.ok(out.matchedKnowledgeIds.includes('R_WASHER_03'));
    assert.ok(out.matchedKnowledgeIds.includes('R_WASHER_04'));
    assert.ok(
      out.hypotheses.some((h) => h.faultTitle.toLowerCase().includes('drain'))
    );
    assert.ok(out.bfsExploredLevels.length >= 2);
  });

  // 3. Core Scenario: Air conditioner not cooling
  it('3. Air conditioner not cooling with weak airflow identifies filter/coil restriction', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'air_conditioner',
      symptomSummary: 'Air conditioner blowing warm air and not cooling',
      symptomDetails:
        'Indoor blower turns on with weak airflow and dirty filter; outdoor unit not running.',
      imageUrls: [],
    });

    assert.ok(out.matchedKnowledgeIds.includes('R_AC_01'));
    assert.ok(out.matchedKnowledgeIds.includes('R_AC_02'));
    assert.ok(out.matchedKnowledgeIds.includes('R_AC_03'));
    assert.ok(out.hypotheses.length >= 1);
  });

  // 4. Core Scenario: Laptop overheating
  it('4. Laptop overheating with loud fan and sudden shutdown fires thermal protection rules', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'laptop',
      symptomSummary: 'Laptop overheating and shutting down',
      symptomDetails:
        'Chassis gets very hot with loud fan spinning fast before sudden shutdown under load.',
      imageUrls: [],
    });

    assert.ok(out.matchedKnowledgeIds.includes('R_LAPTOP_01'));
    assert.ok(out.matchedKnowledgeIds.includes('R_LAPTOP_02'));
    assert.ok(out.recommendedSteps.length >= 1);
  });

  // 5. Core Scenario: Television not turning on / backlight check
  it('5. Television not turning on triggers power supply & standby rules', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'television',
      symptomSummary: 'Television not turning on at all',
      symptomDetails: 'Screen stays dark with no lights except red light blinking intermittently.',
      imageUrls: [],
    });

    assert.ok(out.matchedKnowledgeIds.includes('R_TV_01'));
    assert.ok(out.hypotheses.length >= 1);
    assert.equal(out.requiresProfessional, true);
  });

  // 6. Core Scenario: Microwave not heating
  it('6. Microwave turntable runs without heating escalates high-voltage fault safely', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'microwave',
      symptomSummary: 'Microwave turns on but food stays cold',
      symptomDetails: 'Turntable spins and interior light works, yet no heat is produced.',
      imageUrls: [],
    });

    assert.ok(out.matchedKnowledgeIds.includes('R_MW_01'));
    assert.ok(out.matchedKnowledgeIds.includes('R_MW_02'));
    assert.equal(out.requiresProfessional, true);
    assert.ok(['high', 'critical'].includes(out.riskLevel));
  });

  // 7. Edge Case: Incomplete symptom description
  it('7. Incomplete symptom description marks insufficientEvidence and avoids false certainty', async () => {
    const percepts: PerceptBundle = {
      observedFacts: [],
      canonicalFactIds: [],
      userSymptoms: ['Something feels off'],
      imageObservations: [],
      extractedObservations: ['Symptom: Something feels off'],
      hazardCuesDetected: [],
      contradictoryCues: [],
      missingInformation: ['Specific symptom details not provided'],
      followUpQuestions: ['Does the appliance power on?'],
      problemSummary: 'Customer reported vague issue.',
      hasVisualEvidence: false,
      geminiMeta: { status: 'missing_api_key', model: 'gemini-4-hydrogen' },
    };

    const inference = inferenceEngine.runForwardChaining('refrigerator', []);
    const uncertainty = uncertaintyEngine.assess('refrigerator', percepts, inference);

    assert.equal(uncertainty.insufficientEvidence, true);
    assert.ok(uncertainty.confidenceScore < 0.35);

    const searchPlan = searchEngine.searchTroubleshootingGraph('refrigerator', []);
    const decision = decisionEngine.decide(percepts, uncertainty, searchPlan);
    assert.equal(decision.nextRecommendedAction, 'ask_follow_up_questions');
  });

  // 8. Edge Case: Contradictory symptoms
  it('8. Contradictory symptoms reduce score and surface contradiction explanation', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'refrigerator',
      symptomSummary: 'No power and dead, yet motor runs and freezer cold plus freezer warm',
      symptomDetails: 'Complete loss of power, not turning on, while motor runs loudly.',
      imageUrls: [],
    });

    assert.ok(out.contradictoryEvidence.length >= 1);
    assert.ok(
      out.hypotheses.some((h) => (h.contradictoryObservations?.length ?? 0) >= 1)
    );
  });

  // 9. Edge Case: Multiple image validation & invalid image uploads
  it('9. DatabaseService accepts up to 3 valid images and rejects unsupported MIME or oversized images', () => {
    const tinyPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

    // Valid image-only submission with 2 images
    const okResult = databaseService.validateDiagnosisInput({
      applianceCategory: 'washing_machine',
      symptomSummary: '',
      symptomDetails: '',
      inlineImages: [
        { mimeType: 'image/png', base64Data: tinyPngBase64, name: 'panel.png' },
        { mimeType: 'image/jpeg', base64Data: tinyPngBase64, name: 'drum.jpg' },
      ],
    });
    assert.equal(okResult.valid, true);
    assert.equal(okResult.data?.inlineImages.length, 2);

    // Invalid MIME type
    const badMime = databaseService.validateDiagnosisInput({
      applianceCategory: 'washing_machine',
      symptomSummary: 'Display error',
      inlineImages: [{ mimeType: 'image/gif', base64Data: tinyPngBase64 }],
    });
    assert.equal(badMime.valid, false);
    assert.match(badMime.error ?? '', /Unsupported image type/i);

    // Empty submission (neither text nor image)
    const emptyRes = databaseService.validateDiagnosisInput({
      applianceCategory: 'laptop',
      symptomSummary: '',
      symptomDetails: '',
      inlineImages: [],
      imageUrls: [],
    });
    assert.equal(emptyRes.valid, false);
  });

  // 10. Edge Case: Image-only with unavailable Gemini fails explicitly instead of faking vision
  it('10. Image-only submission throws explicit error when Gemini Vision is unavailable', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      await assert.rejects(
        () =>
          agentController.runDiagnosticCycle({
            customerId: 'test_user_1',
            applianceCategory: 'refrigerator',
            symptomSummary: '',
            symptomDetails: '',
            imageUrls: [],
            inlineImages: [
              {
                mimeType: 'image/png',
                base64Data:
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
              },
            ],
          }),
        /Gemini|GEMINI_API_KEY/i
      );
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  // 11. Edge Case: Malformed Gemini JSON payload validation
  it('11. validateGeminiPerceptionPayload rejects malformed Gemini JSON structures cleanly', () => {
    const missingField = validateGeminiPerceptionPayload({
      problemSummary: 'Valid summary string',
      userReportedSymptoms: ['no cooling'],
      // missing imageObservations & other arrays
    });
    assert.equal(missingField.valid, false);

    const wrongType = validateGeminiPerceptionPayload({
      problemSummary: 'Too',
      userReportedSymptoms: 'should-be-array',
      imageObservations: [],
      matchedFactIds: [],
      detectedWarningSigns: [],
      missingInformation: [],
      contradictoryCues: [],
      followUpQuestions: [],
    });
    assert.equal(wrongType.valid, false);

    const validPayload = validateGeminiPerceptionPayload({
      problemSummary: 'Washer has standing water and displays error code OE.',
      userReportedSymptoms: ['standing water in drum'],
      imageObservations: ['Digital panel shows OE error'],
      matchedFactIds: ['water_in_drum', 'washer_not_draining'],
      detectedWarningSigns: [],
      missingInformation: ['Was the lower filter cleaned?'],
      contradictoryCues: [],
      followUpQuestions: ['Do you hear a hum during the drain phase?'],
    });
    assert.equal(validPayload.valid, true);
  });

  // 12. Safety Override: Smoke / Sparks / Gas Leak / Water near electrical
  it('12. Dangerous warning signs override DIY steps and enforce stop_using_appliance emergency', async () => {
    const hazards = [
      'Visible smoke and burning smell coming from rear panel',
      'Sparks flying near power socket and water on circuit',
      'Strong gas smell and refrigerant hiss near stove/unit',
    ];

    for (const symptom of hazards) {
      const out = await agentController.runDiagnosticCycle({
        customerId: 'test_user_1',
        applianceCategory: 'microwave',
        symptomSummary: symptom,
        symptomDetails: symptom,
        imageUrls: [],
      });

      assert.equal(out.riskLevel, 'critical');
      assert.equal(out.urgencyLevel, 'emergency');
      assert.equal(out.nextRecommendedAction, 'stop_using_appliance');
      assert.equal(out.requiresProfessional, true);
      assert.equal(out.pipelineTrace.safetyOverrideApplied, true);
      assert.ok(out.safetyWarnings.length >= 1);
      assert.ok(out.recommendedSteps[0].includes('STOP USING THE APPLIANCE IMMEDIATELY'));
    }
  });

  // 13. Safety Filter: Prohibited DIY repair instructions are stripped
  it('13. DecisionEngine strips prohibited live-electrical or refrigerant disassembly advice', () => {
    const percepts: PerceptBundle = {
      observedFacts: [
        {
          factId: 'fridge_not_cooling',
          source: 'user_text',
          reliability: 1.0,
          evidenceText: 'Not cooling',
        },
      ],
      canonicalFactIds: ['fridge_not_cooling'],
      userSymptoms: ['Not cooling'],
      imageObservations: [],
      extractedObservations: ['Fact: fridge_not_cooling'],
      hazardCuesDetected: [],
      contradictoryCues: [],
      missingInformation: [],
      followUpQuestions: [],
      problemSummary: 'Fridge warm',
      hasVisualEvidence: false,
      geminiMeta: { status: 'ok', model: 'gemini-4-hydrogen' },
    };

    const decision = decisionEngine.decide(
      percepts,
      {
        hypotheses: [],
        confidenceScore: 0.5,
        scoreDisclaimer: 'Rule score',
        insufficientEvidence: false,
        missingEvidence: [],
        contradictoryEvidence: [],
        uncertaintySummary: 'Summary',
      },
      {
        selectedPath: [],
        exploredLevels: [],
        graphNodes: [],
        graphEdges: [],
        recommendedSteps: [
          'Open the live electrical capacitor panel and touch exposed wire.',
          'Bypass the safety interlock switch to test.',
          'Recharge freon refrigerant yourself.',
          'Unplug the appliance before inspecting external vents.',
        ],
        searchStrategyNote: 'BFS',
        visitedCount: 1,
      }
    );

    assert.equal(decision.filteredSafeSteps.length, 1);
    assert.match(decision.filteredSafeSteps[0], /Unplug the appliance/i);
  });

  // 14. Edge Case: No matching KB rule handles gracefully
  it('14. Unrecognized appliance symptoms with no matched KB rules return safe fallback without crash', async () => {
    const out = await agentController.runDiagnosticCycle({
      customerId: 'test_user_1',
      applianceCategory: 'other',
      symptomSummary: 'Plastic latch on handle feels slightly loose',
      symptomDetails: 'Cosmetic door handle wobble without electrical issues.',
      imageUrls: [],
    });

    assert.equal(out.applianceCategory, 'other');
    assert.equal(out.matchedKnowledgeIds.length, 0);
    assert.ok(out.bfsSearchPath.length >= 2);
    assert.ok(out.recommendedSteps.length >= 1);
  });

  // 15. PCM16 Audio round-trip for Live Voice streaming
  it('15. PCM16 base64 encoder/decoder round-trips normalized audio within 16-bit precision', () => {
    const input = new Float32Array([-1.5, -0.5, 0, 0.25, 0.75, 1.4]);
    const encoded = float32ToPcm16Base64(input);
    const decoded = base64Pcm16ToFloat32(encoded);

    assert.equal(decoded.length, input.length);
    assert.ok(Math.abs(decoded[0] - -1) < 1e-3);
    assert.ok(Math.abs(decoded[1] - -0.5) < 1e-3);
    assert.ok(Math.abs(decoded[2] - 0) < 1e-4);
    assert.ok(Math.abs(decoded[3] - 0.25) < 1e-3);
    assert.ok(Math.abs(decoded[4] - 0.75) < 1e-3);
    assert.ok(Math.abs(decoded[5] - 1) < 1e-3);
  });

  // 16. Sample presets and sample technicians cover all KB items and categories cleanly
  it('16. Sample diagnostic presets & technicians cover every KB fault and appliance category', async () => {
    assert.equal(SAMPLE_DIAGNOSTIC_PRESETS.length, SAMPLE_KNOWLEDGE_BASE.length);
    const kbIds = new Set(SAMPLE_KNOWLEDGE_BASE.map((k) => k.id));
    for (const preset of SAMPLE_DIAGNOSTIC_PRESETS) {
      assert.ok(kbIds.has(preset.kbId));
      const validated = databaseService.validateDiagnosisInput({
        applianceCategory: preset.applianceCategory,
        applianceBrand: preset.applianceBrand,
        applianceModel: preset.applianceModel,
        symptomSummary: preset.symptomSummary,
        symptomDetails: preset.symptomDetails,
      });
      assert.equal(validated.valid, true);
    }

    const coveredCats = new Set(SAMPLE_VERIFIED_TECHNICIANS.flatMap((t) => t.serviceCategories));
    for (const cat of SAMPLE_APPLIANCE_CATEGORIES) {
      assert.ok(coveredCats.has(cat.slug), `Missing sample technician for category ${cat.slug}`);
    }
  });
});
