import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Cpu,
  FileSearch,
  MessageSquareWarning,
  Plus,
  Receipt,
  Search,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import { DashboardShell } from '../components/DashboardShell.tsx';
import { DiagnosisReportView } from '../components/DiagnosisReportView.tsx';
import { EASE_OUT_EXPO, StaggerGroup, StaggerItem } from '../components/MotionPrimitives.tsx';
import { RiskIndicator, StatusText } from '../components/StatusLabel.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  createBooking,
  listTechnicianBookedSlots,
  listVerifiedTechnicians,
  respondToQuotation,
  submitComplaint,
  submitReview,
  subscribeAllReviews,
  subscribeCustomerBookings,
  subscribeCustomerDiagnoses,
  subscribeCustomerQuotations,
  subscribeCustomerRepairRequests,
  subscribeReporterComplaints,
  updateBookingStatus,
  updateDiagnosisWithFollowUp,
} from '../services/firestoreService.ts';
import type {
  BookingRecord,
  BookingSlotLock,
  ComplaintCategory,
  ComplaintRecord,
  DiagnosisRecord,
  FollowUpTurn,
  QuotationRecord,
  RepairRequest,
  ReviewRecord,
  TechnicianProfile,
} from '../types/domain.ts';

const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '10:00 AM - 12:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
];

const BOOKING_TIMELINE: { key: string; label: string }[] = [
  { key: 'requested', label: 'Requested' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'quotation_submitted', label: 'Quoted' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
];

function BookingTimelineBar({ status }: { status: BookingRecord['status'] }) {
  if (status === 'rejected' || status === 'cancelled') {
    return (
      <p className="text-[11px] font-semibold text-red-700 capitalize">
        Booking closed ({status})
      </p>
    );
  }
  const normalized = status === 'pending' ? 'requested' : status;
  const activeIdx = Math.max(
    0,
    BOOKING_TIMELINE.findIndex((step) => step.key === normalized)
  );
  return (
    <div className="grid grid-cols-6 gap-1 pt-1">
      {BOOKING_TIMELINE.map((step, idx) => {
        const done = idx <= activeIdx;
        return (
          <div key={step.key} className="space-y-1">
            <div
              className={`h-1.5 rounded-full ${
                done ? 'bg-blue-600' : 'bg-slate-200'
              }`}
            />
            <p
              className={`text-[10px] truncate ${
                done ? 'text-slate-900 font-semibold' : 'text-slate-400'
              }`}
            >
              {step.label}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function CustomerDashboard() {
  const { firebaseUser, profile, isSuspended, getAuthToken } = useAuth();
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Full report inspector state
  const [inspectedRequestId, setInspectedRequestId] = useState<string | null>(null);
  const [submittingFollowUp, setSubmittingFollowUp] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  // Booking drawer state
  const [bookingTargetReq, setBookingTargetReq] = useState<RepairRequest | null>(null);
  const [selectedTechId, setSelectedTechId] = useState('');
  const [shareDiagnosis, setShareDiagnosis] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date(Date.now() + 86400000);
    return d.toISOString().slice(0, 10);
  });
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[1]);
  const [bookedSlotsForDate, setBookedSlotsForDate] = useState<BookingSlotLock[]>([]);
  const [serviceAddress, setServiceAddress] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);

  // Review state
  const [reviewBooking, setReviewBooking] = useState<BookingRecord | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Complaint state
  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintBookingId, setComplaintBookingId] = useState('');
  const [complaintCategory, setComplaintCategory] =
    useState<ComplaintCategory>('service_quality');
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  useEffect(() => {
    if (profile?.address && !serviceAddress) {
      setServiceAddress(profile.address);
    }
  }, [profile?.address, serviceAddress]);

  useEffect(() => {
    if (!firebaseUser) return;
    let mounted = true;
    const unsubReqs = subscribeCustomerRepairRequests(
      firebaseUser.uid,
      (items) => {
        if (!mounted) return;
        setRequests(items);
        setLoading(false);
      },
      () => {
        if (mounted) setLoading(false);
      }
    );
    const unsubDiags = subscribeCustomerDiagnoses(firebaseUser.uid, (items) => {
      if (mounted) setDiagnoses(items);
    });
    const unsubBookings = subscribeCustomerBookings(firebaseUser.uid, (items) => {
      if (mounted) setBookings(items);
    });
    const unsubQuotes = subscribeCustomerQuotations(firebaseUser.uid, (items) => {
      if (mounted) setQuotations(items);
    });
    const unsubReviews = subscribeAllReviews((items) => {
      if (mounted) setReviews(items);
    });
    const unsubComplaints = subscribeReporterComplaints(firebaseUser.uid, (items) => {
      if (mounted) setComplaints(items);
    });

    listVerifiedTechnicians()
      .then((items) => {
        if (mounted) {
          setTechnicians(items);
          if (items.length > 0) {
            setSelectedTechId((prev) => prev || items[0].uid);
          }
        }
      })
      .catch((err) => console.error('Failed loading technicians:', err));

    return () => {
      mounted = false;
      unsubReqs();
      unsubDiags();
      unsubBookings();
      unsubQuotes();
      unsubReviews();
      unsubComplaints();
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!bookingTargetReq || !selectedTechId || !scheduledDate) {
      setBookedSlotsForDate([]);
      return;
    }
    listTechnicianBookedSlots(selectedTechId, scheduledDate)
      .then(setBookedSlotsForDate)
      .catch(() => setBookedSlotsForDate([]));
  }, [bookingTargetReq, selectedTechId, scheduledDate]);

  const reservedSlotNames = useMemo(
    () => new Set(bookedSlotsForDate.map((s) => s.timeSlot)),
    [bookedSlotsForDate]
  );

  useEffect(() => {
    if (reservedSlotNames.has(timeSlot)) {
      const firstOpen = TIME_SLOTS.find((slot) => !reservedSlotNames.has(slot));
      if (firstOpen) setTimeSlot(firstOpen);
    }
  }, [reservedSlotNames, timeSlot]);

  const reviewedBookingIds = useMemo(() => {
    return new Set(reviews.map((r) => r.bookingId));
  }, [reviews]);

  const reviewsByBookingId = useMemo(() => {
    const map = new Map<string, ReviewRecord>();
    for (const r of reviews) {
      map.set(r.bookingId, r);
    }
    return map;
  }, [reviews]);

  const activeBookings = bookings.filter((b) =>
    ['requested', 'pending', 'accepted', 'quotation_submitted', 'confirmed', 'in_progress'].includes(
      b.status
    )
  );
  const completedBookings = bookings.filter((b) => b.status === 'completed');
  const closedBookings = bookings.filter((b) => ['rejected', 'cancelled'].includes(b.status));
  const pendingQuotationsCount = quotations.filter((q) => q.status === 'pending').length;

  const handleBookTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !bookingTargetReq) return;
    setActionError(null);
    setActionSuccess(null);

    if (isSuspended) {
      setActionError('Your account is suspended and cannot create bookings.');
      return;
    }
    const tech = technicians.find((t) => t.uid === selectedTechId);
    if (!tech) {
      setActionError('Please select a verified technician.');
      return;
    }
    if (serviceAddress.trim().length < 5) {
      setActionError('Please enter a valid service address (at least 5 characters).');
      return;
    }
    if (reservedSlotNames.has(timeSlot)) {
      setActionError('This time slot is already reserved. Please select another slot.');
      return;
    }

    setSubmittingBooking(true);
    try {
      const token = await getAuthToken();
      if (token) {
        const valRes = await fetch('/api/bookings/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            technicianId: tech.uid,
            scheduledDate,
            timeSlot,
            serviceAddress,
            existingBookings: bookings,
          }),
        });
        const valData = await valRes.json();
        if (!valRes.ok || !valData.valid) {
          throw new Error(valData.error || 'Booking validation failed.');
        }
      }

      const linkedDiag =
        diagnoses.find((d) => d.id === bookingTargetReq.latestDiagnosisId) ??
        diagnoses.find((d) => d.requestId === bookingTargetReq.id) ??
        null;

      const sharedSummary = linkedDiag
        ? `${linkedDiag.summary} | Top cause: ${
            linkedDiag.hypotheses[0]?.faultTitle ?? 'Pending check'
          } (Risk: ${linkedDiag.riskLevel})`
        : bookingTargetReq.symptomSummary;

      await createBooking({
        requestId: bookingTargetReq.id,
        diagnosisId: linkedDiag?.id,
        diagnosisSharedWithPermission: shareDiagnosis && Boolean(linkedDiag),
        sharedDiagnosisSummary:
          shareDiagnosis && linkedDiag ? sharedSummary : undefined,
        customerId: firebaseUser.uid,
        technicianId: tech.uid,
        customerName: profile?.displayName || firebaseUser.email || 'Customer',
        technicianName: tech.displayName,
        applianceCategory: bookingTargetReq.applianceCategory,
        scheduledDate,
        timeSlot,
        serviceAddress,
        notes: bookingNotes,
      });

      setActionSuccess(`Booking requested with ${tech.displayName} for ${scheduledDate} (${timeSlot}).`);
      setBookingTargetReq(null);
      setBookingNotes('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to create booking.');
    } finally {
      setSubmittingBooking(false);
    }
  };

  const handleCancelBooking = async (booking: BookingRecord) => {
    if (!firebaseUser) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await updateBookingStatus(booking.id, 'cancelled', booking.requestId, {
        actorId: firebaseUser.uid,
        actorRole: 'customer',
      });
      setActionSuccess('Booking cancelled and appointment slot released.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel booking.');
    }
  };

  const handleQuotationDecision = async (
    quote: QuotationRecord,
    decision: 'accepted' | 'rejected'
  ) => {
    if (!firebaseUser) return;
    setActionError(null);
    setActionSuccess(null);
    try {
      await respondToQuotation({
        quotationId: quote.id,
        decision,
        customerId: firebaseUser.uid,
        technicianId: quote.technicianId,
        bookingId: quote.bookingId,
        requestId: quote.requestId,
      });
      setActionSuccess(
        decision === 'accepted'
          ? 'Quotation approved. Linked repair booking is now confirmed.'
          : 'Quotation declined.'
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update quotation status.');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !reviewBooking) return;
    if (reviewBooking.status !== 'completed') {
      setActionError('Reviews can only be submitted after the booking is marked completed.');
      return;
    }
    if (reviewedBookingIds.has(reviewBooking.id)) {
      setActionError('A review has already been submitted for this completed repair.');
      return;
    }
    if (reviewComment.trim().length < 3) {
      setActionError('Please add a brief review comment.');
      return;
    }
    setActionError(null);
    try {
      await submitReview({
        bookingId: reviewBooking.id,
        customerId: firebaseUser.uid,
        technicianId: reviewBooking.technicianId,
        customerName: profile?.displayName || 'Customer',
        rating,
        comment: reviewComment,
      });
      setActionSuccess('Verified review submitted. Thank you for your feedback.');
      setReviewBooking(null);
      setReviewComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit review.');
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setActionError(null);
    setSubmittingComplaint(true);
    try {
      const selectedBooking = bookings.find((b) => b.id === complaintBookingId);
      await submitComplaint({
        reporterId: firebaseUser.uid,
        reporterName: profile?.displayName || firebaseUser.email || 'Customer',
        reporterRole: 'customer',
        bookingId: selectedBooking?.id,
        technicianId: selectedBooking?.technicianId,
        category: complaintCategory,
        subject: complaintSubject,
        description: complaintDesc,
      });
      setActionSuccess('Complaint submitted for administrator review.');
      setComplaintOpen(false);
      setComplaintSubject('');
      setComplaintDesc('');
      setComplaintBookingId('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to submit complaint.');
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const inspectedRequest = requests.find((r) => r.id === inspectedRequestId) ?? null;
  const inspectedDiagnosis = inspectedRequest
    ? diagnoses.find((d) => d.id === inspectedRequest.latestDiagnosisId) ??
      diagnoses.find((d) => d.requestId === inspectedRequest.id) ??
      null
    : null;

  const handleDashboardFollowUp = async (message: string) => {
    if (!firebaseUser || !inspectedRequest || !inspectedDiagnosis) return;
    setFollowUpError(null);
    setSubmittingFollowUp(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Unable to obtain authentication token.');

      const existingHistory = inspectedDiagnosis.followUpConversation ?? [];
      const userTurn: FollowUpTurn = {
        role: 'user',
        message,
        timestamp: new Date().toISOString(),
      };
      const nextHistory = [...existingHistory, userTurn];

      const response = await fetch('/api/ai/followup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId: inspectedRequest.id,
          applianceCategory: inspectedRequest.applianceCategory,
          applianceBrand: inspectedRequest.applianceBrand,
          applianceModel: inspectedRequest.applianceModel,
          symptomSummary: inspectedRequest.symptomSummary,
          symptomDetails: [
            inspectedRequest.symptomDetails,
            ...existingHistory
              .filter((t) => t.role === 'user')
              .map((t) => `Previous update: ${t.message}`),
          ]
            .filter(Boolean)
            .join('\n'),
          imageUrls: inspectedRequest.imageUrls ?? [],
          conversationHistory: nextHistory,
          followUpMessage: message,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Follow-up re-evaluation failed.');
      }

      const agentTurn: FollowUpTurn = {
        role: 'agent',
        message: data.summary,
        extractedFacts: data.workingMemoryFacts?.slice(0, 8),
        timestamp: new Date().toISOString(),
      };
      const updatedConversation = [...nextHistory, agentTurn];

      await updateDiagnosisWithFollowUp(
        inspectedDiagnosis.id,
        inspectedRequest.id,
        {
          observations: data.observations,
          imageObservations: data.imageObservations,
          userSymptoms: data.userSymptoms,
          imageUrls: inspectedRequest.imageUrls ?? [],
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
        },
        inspectedRequest.status
      );
    } catch (err) {
      setFollowUpError(err instanceof Error ? err.message : 'Unable to submit follow-up.');
    } finally {
      setSubmittingFollowUp(false);
    }
  };

  return (
    <DashboardShell
      title="Customer Repair Portal"
      breadcrumb="Dashboard / Customer"
      action={
        <div className="flex items-center gap-2">
          <Link
            to="/technicians"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Search className="w-3.5 h-3.5" />
            Find Technicians
          </Link>
          <Link
            to="/diagnose"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Start New Diagnosis
          </Link>
        </div>
      }
    >
      {actionError && (
        <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {actionSuccess}
        </div>
      )}

      {/* KPI Metrics Row */}
      <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Repair Requests</p>
          <p className="font-mono text-3xl font-semibold text-slate-900 mt-2 tabular-nums">
            {requests.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">{diagnoses.length} AI diagnosis reports</p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Active Bookings</p>
          <p className="font-mono text-3xl font-semibold text-blue-600 mt-2 tabular-nums">
            {activeBookings.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Scheduled or in progress</p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Pending Quotations</p>
          <p className="font-mono text-3xl font-semibold text-amber-700 mt-2 tabular-nums">
            {pendingQuotationsCount}
          </p>
          <p className="text-xs text-slate-500 mt-1">{quotations.length} total quotes received</p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Completed Repairs</p>
          <p className="font-mono text-3xl font-semibold text-emerald-700 mt-2 tabular-nums">
            {completedBookings.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Eligible for verified review</p>
        </StaggerItem>
      </StaggerGroup>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Requests, Quotations, History */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Your Repair Requests & Diagnoses
                </h2>
              </div>
              <Link
                to="/diagnose"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
              >
                New Diagnosis
              </Link>
            </div>

            {loading ? (
              <div className="py-8 space-y-3">
                <div className="h-16 bg-slate-100 rounded-lg" />
                <div className="h-16 bg-slate-100 rounded-lg" />
              </div>
            ) : requests.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium text-slate-900">No repair requests yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Describe an appliance issue in the AI Diagnosis Workspace to receive structured
                  causes and safe troubleshooting steps.
                </p>
                <Link
                  to="/diagnose"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Start First Diagnosis
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {requests.map((req) => {
                  const diag =
                    diagnoses.find((d) => d.id === req.latestDiagnosisId) ??
                    diagnoses.find((d) => d.requestId === req.id);
                  return (
                    <div key={req.id} className="py-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-800 capitalize">
                            {req.applianceCategory.replace(/_/g, ' ')}
                          </span>
                          <span aria-hidden="true">·</span>
                          <StatusText status={req.status} />
                        </div>
                        <RiskIndicator level={req.riskLevel} />
                      </div>

                      <p className="text-sm font-semibold text-slate-900">
                        {req.symptomSummary}
                      </p>
                      {diag && (
                        <p className="text-xs text-slate-600 leading-relaxed">{diag.summary}</p>
                      )}

                      <div className="pt-1 flex flex-wrap items-center gap-4">
                        {diag && (
                          <button
                            type="button"
                            onClick={() => {
                              setFollowUpError(null);
                              setInspectedRequestId(
                                inspectedRequestId === req.id ? null : req.id
                              );
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900 hover:text-blue-700"
                          >
                            <FileSearch className="w-3.5 h-3.5 text-blue-600" />
                            {inspectedRequestId === req.id
                              ? 'Hide Full AI Report'
                              : 'Inspect AI Report & Follow Up'}
                          </button>
                        )}
                        {['diagnosed', 'technician_requested'].includes(req.status) && (
                          <>
                            <button
                              type="button"
                              onClick={() => setBookingTargetReq(req)}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              Quick Schedule
                            </button>
                            <Link
                              to={`/technicians?category=${encodeURIComponent(
                                req.applianceCategory
                              )}&requestId=${encodeURIComponent(req.id)}`}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-blue-700"
                            >
                              Compare Recommended Technicians
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Stored Hybrid AI Diagnosis Report Inspector */}
          <AnimatePresence>
            {inspectedRequest && inspectedDiagnosis && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.22, ease: EASE_OUT_EXPO }}
                className="bg-white border border-blue-200 rounded-xl p-6"
              >
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-blue-600">
                      Stored Hybrid AI Report ·{' '}
                      {inspectedRequest.applianceCategory.replace(/_/g, ' ')}
                    </p>
                    <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                      {inspectedRequest.symptomSummary}
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Close report inspector"
                    onClick={() => setInspectedRequestId(null)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <DiagnosisReportView
                  report={inspectedDiagnosis}
                  onSubmitFollowUp={handleDashboardFollowUp}
                  submittingFollowUp={submittingFollowUp}
                  followUpError={followUpError}
                  onBookTechnician={
                    ['diagnosed', 'technician_requested'].includes(inspectedRequest.status)
                      ? () => setBookingTargetReq(inspectedRequest)
                      : undefined
                  }
                />
              </motion.section>
            )}
          </AnimatePresence>

          {/* Quotation Comparison & Approval Panel */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-blue-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Repair Quotations & Comparison
                </h2>
              </div>
              <span className="font-mono text-xs text-slate-500 tabular-nums">
                {quotations.length} received
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                AI diagnoses and technician quotations are preliminary estimates. Final charges may
                change after physical inspection and explicit customer approval.
              </span>
            </div>

            {quotations.length === 0 ? (
              <p className="py-4 text-xs text-slate-500">
                Technician quotations submitted for your repair requests or bookings will appear
                side-by-side here for comparison and approval.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {quotations.map((q) => {
                  const linkedReq = requests.find((r) => r.id === q.requestId);
                  return (
                    <article
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col justify-between space-y-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-900">
                            {q.technicianName || 'Verified Technician'}
                          </span>
                          <StatusText status={q.status} />
                        </div>

                        {linkedReq && (
                          <p className="text-[11px] text-slate-500 truncate">
                            For: {linkedReq.symptomSummary}
                          </p>
                        )}

                        <p className="font-mono text-xl font-bold text-slate-900 tabular-nums">
                          {q.currency} {q.estimatedCost.toLocaleString()}
                        </p>

                        {(q.laborCharge !== undefined || q.partsCost !== undefined) && (
                          <div className="text-[11px] text-slate-600 space-y-0.5 border-t border-slate-200 pt-2 tabular-nums">
                            <div className="flex justify-between">
                              <span>Labour charges:</span>
                              <span className="font-mono">
                                {q.currency} {(q.laborCharge ?? 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Estimated parts:</span>
                              <span className="font-mono">
                                {q.currency} {(q.partsCost ?? 0).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Additional service fees:</span>
                              <span className="font-mono">
                                {q.currency} {(q.additionalCharges ?? 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}

                        {q.estimatedCompletionTime && (
                          <p className="text-[11px] text-slate-700">
                            <span className="font-semibold">Est. Completion:</span>{' '}
                            {q.estimatedCompletionTime}
                          </p>
                        )}
                        {q.proposedWorkDescription && (
                          <p className="text-xs text-slate-700 leading-relaxed">
                            {q.proposedWorkDescription}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-600">
                          <span className="font-semibold">Parts:</span> {q.partsDescription}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          <span className="font-semibold">Labor:</span> {q.laborDescription}
                        </p>
                      </div>

                      {q.status === 'pending' && (
                        <div className="pt-3 border-t border-slate-200 flex gap-2">
                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() => void handleQuotationDecision(q, 'accepted')}
                            className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg"
                          >
                            Accept Quote
                          </button>
                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() => void handleQuotationDecision(q, 'rejected')}
                            className="flex-1 py-2 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-lg"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {/* Completed Repair History & Verified Reviews */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 pb-4 border-b border-slate-100">
              Completed Repairs & Verified Reviews
            </h2>
            {completedBookings.length === 0 && closedBookings.length === 0 ? (
              <p className="py-6 text-xs text-slate-500">
                Completed, rejected, and cancelled bookings will appear here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedBookings.map((b) => {
                  const existingReview = reviewsByBookingId.get(b.id);
                  return (
                    <div key={b.id} className="py-4 space-y-2">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 capitalize">
                            {b.applianceCategory.replace(/_/g, ' ')} · {b.technicianName}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {b.scheduledDate} · {b.timeSlot}
                          </p>
                        </div>
                        {existingReview ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            Rated {existingReview.rating}/5
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() => setReviewBooking(b)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
                          >
                            <Star className="w-3.5 h-3.5" />
                            Leave Review
                          </button>
                        )}
                      </div>
                      {existingReview && (
                        <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1">
                          <p>&ldquo;{existingReview.comment}&rdquo;</p>
                          {existingReview.technicianResponse && (
                            <p className="text-[11px] text-blue-800 pt-1 border-t border-slate-200">
                              <span className="font-semibold">Technician reply:</span>{' '}
                              {existingReview.technicianResponse}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {closedBookings.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800 capitalize">
                        {b.applianceCategory.replace(/_/g, ' ')} · {b.technicianName}
                      </p>
                      <p className="text-slate-500">
                        {b.scheduledDate} · {b.timeSlot}
                        {b.rejectionReason ? ` · Reason: ${b.rejectionReason}` : ''}
                      </p>
                    </div>
                    <StatusText status={b.status} />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Active Bookings, Quick Booking, Review & Complaint Filing */}
        <div className="lg:col-span-5 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Active Bookings
                </h2>
              </div>
              <Link
                to="/technicians"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Browse Technicians
              </Link>
            </div>

            {activeBookings.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-900">No active bookings</p>
                <p className="text-xs text-slate-500 mt-1">
                  After diagnosing an issue, find a verified technician or click &ldquo;Quick
                  Schedule&rdquo; on any request.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {activeBookings.map((b) => (
                  <div key={b.id} className="py-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{b.technicianName}</p>
                      <StatusText status={b.status} />
                    </div>
                    <p className="text-xs text-slate-600 capitalize">
                      {b.applianceCategory.replace(/_/g, ' ')} · {b.scheduledDate} ({b.timeSlot})
                    </p>
                    <p className="text-xs text-slate-500">{b.serviceAddress}</p>
                    <BookingTimelineBar status={b.status} />
                    {['requested', 'pending', 'accepted', 'quotation_submitted', 'confirmed'].includes(
                      b.status
                    ) && (
                      <div className="pt-1 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void handleCancelBooking(b)}
                          className="text-xs font-semibold text-red-600 hover:text-red-700"
                        >
                          Cancel Booking
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Book Technician Form */}
          <AnimatePresence>
            {bookingTargetReq && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="bg-white border border-blue-200 rounded-xl p-6"
              >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Schedule Technician Visit
                </h3>
                <button
                  type="button"
                  onClick={() => setBookingTargetReq(null)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Request: <span className="font-semibold">{bookingTargetReq.symptomSummary}</span>
              </p>

              {technicians.length === 0 ? (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-2">
                  <p>
                    No verified technicians are registered yet. Register a technician account and
                    verify it in the Admin Console to enable bookings.
                  </p>
                  <Link
                    to="/technicians"
                    className="inline-block font-semibold text-amber-900 underline"
                  >
                    View Technician Directory
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleBookTechnician} className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Verified Technician
                    </label>
                    <select
                      value={selectedTechId}
                      onChange={(e) => setSelectedTechId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    >
                      {technicians.map((t) => (
                        <option key={t.uid} value={t.uid}>
                          {t.displayName} ({t.serviceArea}) — {t.availabilityStatus}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().slice(0, 10)}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Time Slot
                      </label>
                      <select
                        value={timeSlot}
                        onChange={(e) => setTimeSlot(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      >
                        {TIME_SLOTS.map((slot) => {
                          const taken = reservedSlotNames.has(slot);
                          return (
                            <option key={slot} value={slot} disabled={taken}>
                              {slot} {taken ? '(Reserved)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareDiagnosis}
                      onChange={(e) => setShareDiagnosis(e.target.checked)}
                      className="mt-0.5 accent-blue-600"
                    />
                    <span>Share AI diagnosis report summary with this technician</span>
                  </label>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Service Address
                    </label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      value={serviceAddress}
                      onChange={(e) => setServiceAddress(e.target.value)}
                      placeholder="Apartment, street, city"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Notes for Technician (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingBooking || isSuspended || reservedSlotNames.has(timeSlot)}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                  >
                    {submittingBooking ? 'Reserving Slot...' : 'Confirm Booking Request'}
                  </button>
                </form>
              )}
              </motion.section>
            )}
          </AnimatePresence>

          {/* Verified Review Submission */}
          <AnimatePresence>
            {reviewBooking && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="bg-white border border-slate-200 rounded-xl p-6"
              >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Rate {reviewBooking.technicianName}
                </h3>
                <button
                  type="button"
                  onClick={() => setReviewBooking(null)}
                  className="text-xs text-slate-500"
                >
                  Close
                </button>
              </div>
              <form onSubmit={handleReviewSubmit} className="mt-4 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rating (1-5)
                  </label>
                  <select
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n} Stars
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Review Comment
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={3}
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    placeholder="Share how the diagnosis and repair went..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Submit Verified Review
                </button>
              </form>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Complaint & Dispute Resolution */}
          <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <MessageSquareWarning className="w-5 h-5 text-slate-700" />
                <h2 className="font-display text-base font-bold text-slate-900">
                  Disputes & Complaints
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setComplaintOpen((prev) => !prev)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                {complaintOpen ? 'Cancel' : 'Report Issue'}
              </button>
            </div>

            {complaintOpen && (
              <form onSubmit={handleComplaintSubmit} className="space-y-3 pb-3 border-b border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Related Booking (optional)
                  </label>
                  <select
                    value={complaintBookingId}
                    onChange={(e) => setComplaintBookingId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="">General platform complaint</option>
                    {bookings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.technicianName} · {b.scheduledDate} ({b.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Issue Category
                  </label>
                  <select
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value as ComplaintCategory)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="service_quality">Service Quality</option>
                    <option value="pricing_dispute">Pricing / Quotation Dispute</option>
                    <option value="safety_concern">Safety Concern</option>
                    <option value="no_show">Technician No-Show</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={180}
                    value={complaintSubject}
                    onChange={(e) => setComplaintSubject(e.target.value)}
                    placeholder="Brief summary of the issue"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    required
                    minLength={10}
                    maxLength={2000}
                    value={complaintDesc}
                    onChange={(e) => setComplaintDesc(e.target.value)}
                    placeholder="Describe what happened so an administrator can review..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submittingComplaint || isSuspended}
                  className="w-full py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg"
                >
                  {submittingComplaint ? 'Submitting...' : 'Submit Complaint to Admin'}
                </button>
              </form>
            )}

            {complaints.length === 0 ? (
              <p className="text-xs text-slate-500">No complaints or disputes filed.</p>
            ) : (
              <div className="space-y-2.5">
                {complaints.map((c) => (
                  <div key={c.id} className="p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{c.subject}</span>
                      <StatusText status={c.status} />
                    </div>
                    <p className="text-slate-600">{c.description}</p>
                    {c.adminNotes && (
                      <p className="text-[11px] text-blue-800 pt-1 border-t border-slate-100">
                        <span className="font-semibold">Admin Resolution Note:</span> {c.adminNotes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}
