import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Cpu, ImagePlus, Info, Sparkles, Trash2 } from 'lucide-react';
import {
  DiagnosisReportView,
  type DiagnosisReportData,
  type GraphVisualEdgeUI,
  type GraphVisualNodeUI,
} from '../components/DiagnosisReportView.tsx';
import { Footer } from '../components/Footer.tsx';
import { LiveVoiceAssistant } from '../components/LiveVoiceAssistant.tsx';
import { EASE_OUT_EXPO, Reveal } from '../components/MotionPrimitives.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { RiskIndicator } from '../components/StatusLabel.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  SAMPLE_APPLIANCE_CATEGORIES,
  SAMPLE_DIAGNOSTIC_PRESETS,
  type SampleDiagnosticPreset,
} from '../data/sampleKnowledgeBase.ts';
import {
  createNotification,
  createRepairRequest,
  fetchApplianceCategories,
  saveDiagnosisAndUpdateRequest,
  updateDiagnosisWithFollowUp,
  uploadApplianceImage,
} from '../services/firestoreService.ts';
import {
  VALIDATION_LIMITS,
  type ApplianceCategory,
  type ApplianceSlug,
  type FollowUpTurn,
} from '../types/domain.ts';

interface AttachedImageItem {
  id: string;
  name: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  base64Data: string;
  previewDataUrl: string;
  storageUrl?: string;
}

interface DiagnosticApiResponse extends DiagnosisReportData {
  escalationReason: string;
  scoreDisclaimer: string;
  workingMemoryFacts: string[];
  graphVisualization: {
    nodes: GraphVisualNodeUI[];
    edges: GraphVisualEdgeUI[];
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read uploaded image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed reading image file.'));
    reader.readAsDataURL(file);
  });
}

export function DiagnosisWorkspacePage() {
  const { firebaseUser, profile, needsEmailVerification, getAuthToken } = useAuth();
  const [searchParams] = useSearchParams();
  const initialCat = (searchParams.get('category') as ApplianceSlug) || 'refrigerator';

  const [categories, setCategories] = useState<ApplianceCategory[]>(SAMPLE_APPLIANCE_CATEGORIES);
  const [applianceCategory, setApplianceCategory] = useState<ApplianceSlug>(
    SAMPLE_APPLIANCE_CATEGORIES.some((c) => c.slug === initialCat) ? initialCat : 'refrigerator'
  );
  const [applianceBrand, setApplianceBrand] = useState('');
  const [applianceModel, setApplianceModel] = useState('');
  const [symptomSummary, setSymptomSummary] = useState('');
  const [symptomDetails, setSymptomDetails] = useState('');
  const [initialDurationAnswer, setInitialDurationAnswer] = useState('');
  const [initialEnvironmentAnswer, setInitialEnvironmentAnswer] = useState('');
  const [activeSampleId, setActiveSampleId] = useState<string>('');
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  const [attachments, setAttachments] = useState<AttachedImageItem[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosticApiResponse | null>(null);
  const [savedRequestId, setSavedRequestId] = useState<string | null>(null);
  const [savedDiagnosisId, setSavedDiagnosisId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<FollowUpTurn[]>([]);

  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const applySamplePreset = useCallback((preset: SampleDiagnosticPreset) => {
    setApplianceCategory(preset.applianceCategory);
    setApplianceBrand(preset.applianceBrand);
    setApplianceModel(preset.applianceModel);
    setSymptomSummary(preset.symptomSummary);
    setSymptomDetails(preset.symptomDetails);
    setInitialDurationAnswer(preset.durationAnswer);
    setInitialEnvironmentAnswer(preset.envAnswer);
    setActiveSampleId(preset.kbId);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;
    fetchApplianceCategories()
      .then((res) => {
        if (active && res.items.length > 0) {
          setCategories(res.items);
        }
      })
      .catch(() => {
        // retain sample fallback
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const paramCat = searchParams.get('category') as ApplianceSlug | null;
    const paramSampleId = searchParams.get('sampleId');
    if (paramSampleId) {
      const matched = SAMPLE_DIAGNOSTIC_PRESETS.find((p) => p.kbId === paramSampleId);
      if (matched) {
        applySamplePreset(matched);
        return;
      }
    }
    if (paramCat && SAMPLE_APPLIANCE_CATEGORIES.some((c) => c.slug === paramCat)) {
      setApplianceCategory(paramCat);
    }
  }, [searchParams, applySamplePreset]);

  const selectedCatMeta = categories.find((c) => c.slug === applianceCategory);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    if (!firebaseUser) {
      setError('Please sign in first to attach diagnostic images.');
      e.target.value = '';
      return;
    }

    if (attachments.length + files.length > 3) {
      setError('You can attach up to 3 images per diagnostic session.');
      e.target.value = '';
      return;
    }

    setError(null);
    setStorageNotice(null);
    setUploadingImage(true);

    try {
      const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
      const added: AttachedImageItem[] = [];

      for (const file of files) {
        if (!allowedTypes.has(file.type)) {
          throw new Error(`Unsupported image type "${file.type}". Use JPEG, PNG, or WebP.`);
        }
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`"${file.name}" exceeds the 5 MB limit.`);
        }

        const dataUrl = await readFileAsDataUrl(file);
        const base64Data = dataUrl.split(',')[1] ?? '';
        if (!base64Data) {
          throw new Error(`Could not encode "${file.name}".`);
        }

        let storageUrl: string | undefined;
        try {
          storageUrl = await uploadApplianceImage(firebaseUser.uid, file);
        } catch (storageErr) {
          console.warn('Firebase Storage upload skipped:', storageErr);
          setStorageNotice(
            'Photo prepared for Gemini Vision analysis. Cloud Storage archival URL was skipped due to storage configuration.'
          );
        }

        added.push({
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          mimeType: file.type as AttachedImageItem['mimeType'],
          base64Data,
          previewDataUrl: dataUrl,
          storageUrl,
        });
      }

      setAttachments((prev) => [...prev, ...added]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process image upload.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const handleRunDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFollowUpError(null);

    if (!firebaseUser) {
      setError('Please sign in to run and save a diagnostic session.');
      return;
    }
    if (needsEmailVerification) {
      setError('Please verify your email address before saving repair diagnostics.');
      return;
    }

    const trimmedSummary = symptomSummary.trim();
    const trimmedDetails = symptomDetails.trim();
    const hasImages = attachments.length > 0;
    const hasText = trimmedSummary.length >= 3 || trimmedDetails.length >= 5;

    if (!hasImages && !hasText) {
      setError(
        'Provide either a symptom description (at least 3–5 characters) or upload at least one appliance photo.'
      );
      return;
    }
    if (trimmedSummary.length > VALIDATION_LIMITS.SYMPTOM_SUMMARY_MAX) {
      setError(`Symptom summary cannot exceed ${VALIDATION_LIMITS.SYMPTOM_SUMMARY_MAX} characters.`);
      return;
    }

    const effectiveSummary =
      trimmedSummary.length >= 3
        ? trimmedSummary
        : trimmedDetails.slice(0, 120) ||
          `Visual inspection for ${selectedCatMeta?.name || applianceCategory}`;

    const followUpAnswers: Record<string, string> = {};
    if (initialDurationAnswer.trim()) {
      followUpAnswers['When issue started / frequency'] = initialDurationAnswer.trim();
    }
    if (initialEnvironmentAnswer.trim()) {
      followUpAnswers['Visible lights, noises, or error codes'] = initialEnvironmentAnswer.trim();
    }

    const imageUrls = attachments
      .map((a) => a.storageUrl)
      .filter((u): u is string => Boolean(u));
    const inlineImages = attachments.map((a) => ({
      mimeType: a.mimeType,
      base64Data: a.base64Data,
      name: a.name,
    }));

    setRunning(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Unable to obtain authentication token.');
      }

      // 1. Create the repair request in Firestore
      const reqId = await createRepairRequest({
        customerId: firebaseUser.uid,
        customerName: profile?.displayName || firebaseUser.email || 'Customer',
        applianceCategory,
        applianceBrand,
        applianceModel,
        symptomSummary: effectiveSummary,
        symptomDetails: trimmedDetails,
        imageUrls,
      });

      // 2. Call Phase 2 Hybrid AgentController endpoint
      const response = await fetch('/api/ai/diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: reqId,
          applianceCategory,
          applianceBrand,
          applianceModel,
          symptomSummary: effectiveSummary,
          symptomDetails: trimmedDetails,
          imageUrls,
          inlineImages,
          followUpAnswers:
            Object.keys(followUpAnswers).length > 0 ? followUpAnswers : undefined,
        }),
      });

      const data = (await response.json()) as DiagnosticApiResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Diagnostic request failed.');
      }

      const initialTurn: FollowUpTurn[] = [
        {
          role: 'agent',
          message: data.summary,
          extractedFacts: data.workingMemoryFacts?.slice(0, 8),
          timestamp: new Date().toISOString(),
        },
      ];

      // 3. Persist full Phase 2 diagnosis result & update request in Firestore
      const diagId = await saveDiagnosisAndUpdateRequest({
        requestId: reqId,
        customerId: firebaseUser.uid,
        applianceCategory,
        observations: data.observations,
        imageObservations: data.imageObservations,
        userSymptoms: data.userSymptoms,
        imageUrls,
        matchedKnowledgeIds: data.matchedKnowledgeIds,
        hypotheses: data.hypotheses,
        followUpQuestions: data.followUpQuestions,
        missingEvidence: data.missingEvidence,
        contradictoryEvidence: data.contradictoryEvidence,
        inferenceTrace: data.inferenceTrace,
        bfsSearchPath: data.bfsSearchPath,
        bfsExploredLevels: data.bfsExploredLevels,
        recommendedSteps: data.recommendedSteps,
        safetyWarnings: data.safetyWarnings,
        riskLevel: data.riskLevel,
        urgencyLevel: data.urgencyLevel,
        nextRecommendedAction: data.nextRecommendedAction,
        confidenceScore: data.confidenceScore,
        requiresProfessional: data.requiresProfessional,
        engineMode: data.engineMode,
        summary: data.summary,
        followUpConversation: initialTurn,
      });

      try {
        await createNotification({
          userId: firebaseUser.uid,
          relatedRequestId: reqId,
          title: 'AI Diagnosis Completed',
          message: `${selectedCatMeta?.name || applianceCategory}: ${data.hypotheses[0]?.faultTitle || 'Assessment saved'}`,
          type: 'diagnosis',
          linkPath: '/dashboard',
        });
      } catch (notifErr) {
        console.warn('Diagnosis notification skipped:', notifErr);
      }

      setSavedRequestId(reqId);
      setSavedDiagnosisId(diagId);
      setConversation(initialTurn);
      setResult({ ...data, id: diagId, requestId: reqId, followUpConversation: initialTurn });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Diagnostic pipeline error.');
    } finally {
      setRunning(false);
    }
  };

  const handleFollowUpSubmit = async (message: string) => {
    if (!result || !firebaseUser) return;
    setFollowUpError(null);
    setSubmittingFollowUp(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Authentication token expired. Please sign in again.');
      }

      const imageUrls = attachments
        .map((a) => a.storageUrl)
        .filter((u): u is string => Boolean(u));
      const inlineImages = attachments.map((a) => ({
        mimeType: a.mimeType,
        base64Data: a.base64Data,
        name: a.name,
      }));

      const userTurn: FollowUpTurn = {
        role: 'user',
        message,
        timestamp: new Date().toISOString(),
      };
      const nextHistory = [...conversation, userTurn];

      const response = await fetch('/api/ai/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: savedRequestId ?? undefined,
          applianceCategory,
          applianceBrand,
          applianceModel,
          symptomSummary:
            symptomSummary.trim() || result.problemSummary || 'Follow-up appliance diagnostic',
          symptomDetails: symptomDetails.trim(),
          imageUrls,
          inlineImages,
          priorFacts: result.workingMemoryFacts,
          conversationHistory: nextHistory,
          followUpMessage: message,
        }),
      });

      const data = (await response.json()) as DiagnosticApiResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Follow-up evaluation failed.');
      }

      const agentTurn: FollowUpTurn = {
        role: 'agent',
        message: data.summary,
        extractedFacts: data.workingMemoryFacts?.slice(0, 8),
        timestamp: new Date().toISOString(),
      };
      const updatedConversation = [...nextHistory, agentTurn];

      if (savedDiagnosisId && savedRequestId) {
        await updateDiagnosisWithFollowUp(savedDiagnosisId, savedRequestId, {
          observations: data.observations,
          imageObservations: data.imageObservations,
          userSymptoms: data.userSymptoms,
          imageUrls,
          matchedKnowledgeIds: data.matchedKnowledgeIds,
          hypotheses: data.hypotheses,
          followUpQuestions: data.followUpQuestions,
          missingEvidence: data.missingEvidence,
          contradictoryEvidence: data.contradictoryEvidence,
          inferenceTrace: data.inferenceTrace,
          bfsSearchPath: data.bfsSearchPath,
          bfsExploredLevels: data.bfsExploredLevels,
          recommendedSteps: data.recommendedSteps,
          safetyWarnings: data.safetyWarnings,
          riskLevel: data.riskLevel,
          urgencyLevel: data.urgencyLevel,
          nextRecommendedAction: data.nextRecommendedAction,
          confidenceScore: data.confidenceScore,
          requiresProfessional: data.requiresProfessional,
          engineMode: data.engineMode,
          summary: data.summary,
          followUpConversation: updatedConversation,
        });
      }

      setConversation(updatedConversation);
      setResult({
        ...data,
        id: savedDiagnosisId ?? undefined,
        requestId: savedRequestId ?? undefined,
        followUpConversation: updatedConversation,
      });
    } catch (err) {
      setFollowUpError(
        err instanceof Error ? err.message : 'Unable to process follow-up update.'
      );
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold text-blue-600 mb-1">
              Hybrid AI Troubleshooting Agent · Gemini Multimodal + Rule Engine
            </p>
            <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
              AI Diagnosis Workspace
            </h1>
            <p className="text-sm text-slate-600 mt-1.5 max-w-3xl">
              Submit text symptoms, appliance photos, or both. FixMate AI combines Gemini perception with forward-chaining inference, Breadth-First Search troubleshooting, uncertainty scoring, and safety overrides.
            </p>
          </div>
          {firebaseUser && (
            <Link
              to={profile?.role === 'technician' ? '/technician' : '/dashboard'}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              Return to Dashboard
            </Link>
          )}
        </div>

        {!firebaseUser && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-blue-900">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
              <span>
                Sign in with your verified account to run multimodal diagnostics and persist reports to Firestore.
              </span>
            </div>
            <Link
              to="/login"
              state={{ from: '/diagnose' }}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg whitespace-nowrap shrink-0 text-center"
            >
              Sign In to Diagnose
            </Link>
          </div>
        )}

        {firebaseUser && needsEmailVerification && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-950">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>
                Verify your email address before saving AI diagnostics or starting Live Voice troubleshooting.
              </span>
            </div>
            <Link
              to="/verify-email"
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg whitespace-nowrap shrink-0 text-center"
            >
              Complete Email Verification
            </Link>
          </div>
        )}

        {/* Real-Time Gemini Live Voice Assistant Banner */}
        <div className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 bg-white border border-slate-200 rounded-xl px-5 py-3.5">
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Prefer speaking hands-free?</span>{' '}
              Talk directly with FixMate Live Voice Assistant and import the spoken symptoms into the intake form.
            </div>
            <button
              type="button"
              onClick={() => setShowVoicePanel((prev) => !prev)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 whitespace-nowrap shrink-0"
            >
              {showVoicePanel ? 'Hide Live Voice Assistant' : 'Open Live Voice Assistant'}
            </button>
          </div>

          <AnimatePresence>
            {showVoicePanel && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              >
                <LiveVoiceAssistant
                  applianceCategory={applianceCategory}
                  initialContext={symptomSummary || symptomDetails}
                  getAuthToken={getAuthToken}
                  disabled={!firebaseUser || needsEmailVerification}
                  onApplyTranscript={(summary, details) => {
                    if (summary) setSymptomSummary(summary);
                    if (details) setSymptomDetails(details);
                    setActiveSampleId('');
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Reveal className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Multimodal Intake Form */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <h2 className="font-display text-lg font-bold text-slate-900">
                01. Describe Symptoms &amp; Upload Photos
              </h2>
            </div>

            {/* 1-Click Common Fault Presets */}
            <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Quick-Fill Common Fault Case (1-Click)
                </span>
                {activeSampleId && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSampleId('');
                      setApplianceBrand('');
                      setApplianceModel('');
                      setSymptomSummary('');
                      setSymptomDetails('');
                      setInitialDurationAnswer('');
                      setInitialEnvironmentAnswer('');
                    }}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Clear Preset
                  </button>
                )}
              </div>
              <select
                aria-label="Load a common appliance fault scenario"
                value={activeSampleId}
                onChange={(e) => {
                  const chosen = SAMPLE_DIAGNOSTIC_PRESETS.find((p) => p.kbId === e.target.value);
                  if (chosen) applySamplePreset(chosen);
                }}
                className="w-full px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white text-slate-800"
              >
                <option value="">Select from 12 common appliance fault scenarios...</option>
                {SAMPLE_DIAGNOSTIC_PRESETS.map((preset) => (
                  <option key={preset.kbId} value={preset.kbId}>
                    [{preset.applianceCategory.replace(/_/g, ' ').toUpperCase()}] {preset.label}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SAMPLE_DIAGNOSTIC_PRESETS.filter(
                  (p) => p.applianceCategory === applianceCategory
                ).map((preset) => (
                  <button
                    key={preset.kbId}
                    type="button"
                    onClick={() => applySamplePreset(preset)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                      activeSampleId === preset.kbId
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}
            {storageNotice && (
              <div className="mt-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                {storageNotice}
              </div>
            )}

            <form onSubmit={handleRunDiagnosis} className="mt-5 space-y-4">
              <div>
                <label htmlFor="diag-category" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Appliance Category
                </label>
                <select
                  id="diag-category"
                  value={applianceCategory}
                  onChange={(e) => setApplianceCategory(e.target.value as ApplianceSlug)}
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
                {selectedCatMeta && (
                  <p className="mt-1.5 text-xs text-amber-800 bg-amber-50 border border-amber-200/70 rounded-lg p-2.5">
                    Safety note: {selectedCatMeta.safetyNotice}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="diag-brand" className="block text-xs font-semibold text-slate-700 mb-1">
                    Brand (optional)
                  </label>
                  <input
                    id="diag-brand"
                    type="text"
                    value={applianceBrand}
                    onChange={(e) => setApplianceBrand(e.target.value)}
                    placeholder="e.g., LG, Bosch"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="diag-model" className="block text-xs font-semibold text-slate-700 mb-1">
                    Model (optional)
                  </label>
                  <input
                    id="diag-model"
                    type="text"
                    value={applianceModel}
                    onChange={(e) => setApplianceModel(e.target.value)}
                    placeholder="e.g., GL-T372"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="diag-summary" className="block text-xs font-semibold text-slate-700 mb-1">
                  Symptom Summary {attachments.length > 0 ? '(optional when photo uploaded)' : ''}
                </label>
                <input
                  id="diag-summary"
                  type="text"
                  maxLength={300}
                  value={symptomSummary}
                  onChange={(e) => setSymptomSummary(e.target.value)}
                  placeholder="e.g., Refrigerator running continuously but not cooling"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label htmlFor="diag-details" className="block text-xs font-semibold text-slate-700 mb-1">
                  Observable Symptoms & Timeline {attachments.length > 0 ? '(optional)' : ''}
                </label>
                <textarea
                  id="diag-details"
                  rows={3}
                  maxLength={3000}
                  value={symptomDetails}
                  onChange={(e) => setSymptomDetails(e.target.value)}
                  placeholder="Describe noises, error codes, frost, water leaks, smells, or overheating..."
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {/* Optional Pre-Check Follow-Up Questions */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
                <p className="text-xs font-semibold text-slate-800">
                  Quick Context Checks (optional, improves scoring)
                </p>
                <div>
                  <label htmlFor="diag-duration" className="block text-[11px] font-medium text-slate-600 mb-1">
                    When did it start / does it happen continuously?
                  </label>
                  <input
                    id="diag-duration"
                    type="text"
                    value={initialDurationAnswer}
                    onChange={(e) => setInitialDurationAnswer(e.target.value)}
                    placeholder="e.g., Started yesterday evening after a power flicker"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                </div>
                <div>
                  <label htmlFor="diag-env" className="block text-[11px] font-medium text-slate-600 mb-1">
                    Any visible error codes, warning lights, smoke, or odors?
                  </label>
                  <input
                    id="diag-env"
                    type="text"
                    value={initialEnvironmentAnswer}
                    onChange={(e) => setInitialEnvironmentAnswer(e.target.value)}
                    placeholder="e.g., No burning smell, display shows E2"
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                  />
                </div>
              </div>

              {/* Multimodal Image Upload */}
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Upload Appliance Photos (up to 3 · text-only, image-only, or combined)
                </span>
                <label className="flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer">
                  <ImagePlus className="w-4 h-4 text-blue-600" />
                  <span>
                    {uploadingImage
                      ? 'Preparing image for analysis...'
                      : 'Upload JPEG / PNG / WebP (max 5 MB each)'}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={uploadingImage}
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {attachments.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {attachments.map((img, idx) => (
                      <div
                        key={img.id}
                        className="relative rounded-lg overflow-hidden border border-slate-200 aspect-square bg-slate-100"
                      >
                        <img
                          src={img.previewDataUrl}
                          alt={`Uploaded appliance visual ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Remove ${img.name}`}
                          onClick={() => handleRemoveAttachment(img.id)}
                          className="absolute top-1 right-1 p-1 bg-white/95 rounded text-red-600 hover:bg-white shadow-xs"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={running || uploadingImage || !firebaseUser}
                className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
              >
                {running ? 'Running Hybrid AI Pipeline...' : 'Run AI Diagnostic Assessment'}
              </button>
            </form>
          </section>

          {/* Right: Structured Diagnostic Output */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    02. Diagnostic Agent Report
                  </h2>
                  {savedRequestId && (
                    <p className="font-mono text-[11px] text-slate-500">
                      Record: {savedRequestId}
                    </p>
                  )}
                </div>
              </div>
              {result && <RiskIndicator level={result.riskLevel} />}
            </div>

            {!result ? (
              <div className="py-16 text-center max-w-md mx-auto">
                <p className="text-sm font-semibold text-slate-900">
                  Awaiting Symptom or Photo Input
                </p>
                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  Submit text, images, or both to execute Gemini Multimodal Perception → Forward Chaining Rule Inference → BFS Troubleshooting Search → Uncertainty Scoring → Safety Decision Engine.
                </p>
              </div>
            ) : (
              <motion.div
                key={result.id ?? result.summary}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
              >
                <DiagnosisReportView
                  report={result}
                  onSubmitFollowUp={handleFollowUpSubmit}
                  submittingFollowUp={submittingFollowUp}
                  followUpError={followUpError}
                />
              </motion.div>
            )}
          </section>
        </Reveal>
      </main>

      <Footer />
    </div>
  );
}

