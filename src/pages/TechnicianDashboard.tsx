import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  Receipt,
  ShieldAlert,
  Star,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DashboardShell } from '../components/DashboardShell.tsx';
import { EASE_OUT_EXPO, StaggerGroup, StaggerItem } from '../components/MotionPrimitives.tsx';
import { RiskIndicator, StatusText } from '../components/StatusLabel.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { SAMPLE_APPLIANCE_CATEGORIES } from '../data/sampleKnowledgeBase.ts';
import {
  createQuotation,
  fetchApplianceCategories,
  submitTechnicianReviewResponse,
  subscribeOpenRepairRequests,
  subscribeTechnicianBookings,
  subscribeTechnicianQuotations,
  subscribeTechnicianReviews,
  updateBookingStatus,
  updateTechnicianProfileDoc,
} from '../services/firestoreService.ts';
import type {
  ApplianceCategory,
  ApplianceSlug,
  AvailabilityStatus,
  BookingRecord,
  BookingStatus,
  QuotationRecord,
  RepairRequest,
  ReviewRecord,
} from '../types/domain.ts';

interface QuoteFormTarget {
  requestId: string;
  bookingId?: string;
  customerId: string;
  title: string;
}

export function TechnicianDashboard() {
  const { firebaseUser, technicianProfile, isSuspended, getAuthToken } = useAuth();
  const [categories, setCategories] = useState<ApplianceCategory[]>(SAMPLE_APPLIANCE_CATEGORIES);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [openRequests, setOpenRequests] = useState<RepairRequest[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);

  // Editable technician profile form
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [serviceArea, setServiceArea] = useState('');
  const [experienceYears, setExperienceYears] = useState('0');
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('available');
  const [serviceCategories, setServiceCategories] = useState<ApplianceSlug[]>([]);
  const [skillsInput, setSkillsInput] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Itemized Quotation Form state
  const [quoteTarget, setQuoteTarget] = useState<QuoteFormTarget | null>(null);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [laborCharge, setLaborCharge] = useState('500');
  const [partsCost, setPartsCost] = useState('350');
  const [additionalCharges, setAdditionalCharges] = useState('0');
  const [estimatedCompletionTime, setEstimatedCompletionTime] = useState('Same day (2-3 hours)');
  const [proposedWorkDescription, setProposedWorkDescription] = useState('');
  const [partsDescription, setPartsDescription] = useState('');
  const [laborDescription, setLaborDescription] = useState('');
  const [sendingQuote, setSendingQuote] = useState(false);

  // Rejection reason state
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Review reply state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!technicianProfile) return;
    setDisplayName(technicianProfile.displayName);
    setBio(technicianProfile.bio || '');
    setServiceArea(technicianProfile.serviceArea);
    setExperienceYears(String(technicianProfile.experienceYears));
    setAvailabilityStatus(technicianProfile.availabilityStatus);
    setServiceCategories(technicianProfile.serviceCategories || []);
    setSkillsInput((technicianProfile.skills || []).join(', '));
  }, [technicianProfile]);

  useEffect(() => {
    let active = true;
    fetchApplianceCategories()
      .then((res) => {
        if (active && res.items.length > 0) setCategories(res.items);
      })
      .catch(() => {
        // retain fallback categories
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unsubBookings = subscribeTechnicianBookings(firebaseUser.uid, setBookings);
    const unsubRequests = subscribeOpenRepairRequests(setOpenRequests);
    const unsubQuotes = subscribeTechnicianQuotations(firebaseUser.uid, setQuotations);
    const unsubReviews = subscribeTechnicianReviews(firebaseUser.uid, setReviews);
    return () => {
      unsubBookings();
      unsubRequests();
      unsubQuotes();
      unsubReviews();
    };
  }, [firebaseUser]);

  const toggleCategory = (slug: ApplianceSlug) => {
    setServiceCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || isSuspended) return;
    setFeedback(null);
    if (serviceCategories.length === 0) {
      setFeedback({ type: 'err', text: 'Select at least one service category.' });
      return;
    }
    setSavingProfile(true);
    try {
      await updateTechnicianProfileDoc(firebaseUser.uid, {
        displayName,
        bio,
        serviceArea,
        experienceYears: Number(experienceYears) || 0,
        availabilityStatus,
        serviceCategories,
        skills: skillsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setFeedback({ type: 'ok', text: 'Technician profile and availability saved.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBookingTransition = async (
    booking: BookingRecord,
    nextStatus: BookingStatus,
    reason?: string
  ) => {
    if (!firebaseUser || isSuspended) return;
    setFeedback(null);
    try {
      const token = await getAuthToken();
      if (token) {
        const res = await fetch('/api/bookings/validate-transition', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            currentStatus: booking.status,
            nextStatus,
            actorRole: 'technician',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.allowed) {
          throw new Error(data.error || 'Transition rejected by server policy.');
        }
      }

      await updateBookingStatus(booking.id, nextStatus, booking.requestId, {
        rejectionReason: reason,
        actorId: firebaseUser.uid,
        actorRole: 'technician',
      });
      setRejectingBookingId(null);
      setRejectionReason('');
      setFeedback({
        type: 'ok',
        text: `Booking updated to ${nextStatus.replace(/_/g, ' ')}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update booking.',
      });
    }
  };

  const totalQuotePreview = useMemo(() => {
    const l = Number(laborCharge) || 0;
    const p = Number(partsCost) || 0;
    const a = Number(additionalCharges) || 0;
    return Math.max(0, Number((l + p + a).toFixed(2)));
  }, [laborCharge, partsCost, additionalCharges]);

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !quoteTarget || isSuspended) return;
    setSendingQuote(true);
    setFeedback(null);
    try {
      const token = await getAuthToken();
      const payload = {
        laborCharge: Number(laborCharge) || 0,
        partsCost: Number(partsCost) || 0,
        additionalCharges: Number(additionalCharges) || 0,
        estimatedCost: totalQuotePreview,
        currency,
        estimatedCompletionTime,
        proposedWorkDescription,
        partsDescription,
        laborDescription,
      };

      if (token) {
        const res = await fetch('/api/quotations/validate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || !data.valid) {
          throw new Error(data.error || 'Invalid quotation details.');
        }
      }

      await createQuotation({
        requestId: quoteTarget.requestId,
        bookingId: quoteTarget.bookingId,
        customerId: quoteTarget.customerId,
        technicianId: firebaseUser.uid,
        technicianName: technicianProfile?.displayName || 'Verified Technician',
        ...payload,
      });

      setFeedback({ type: 'ok', text: `Itemized quotation submitted for ${quoteTarget.title}.` });
      setQuoteTarget(null);
      setProposedWorkDescription('');
      setPartsDescription('');
      setLaborDescription('');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to submit quotation.',
      });
    } finally {
      setSendingQuote(false);
    }
  };

  const handleReviewReply = async (reviewId: string) => {
    const text = (replyDrafts[reviewId] ?? '').trim();
    if (text.length < 2) {
      setFeedback({ type: 'err', text: 'Reply must be at least 2 characters.' });
      return;
    }
    setFeedback(null);
    try {
      await submitTechnicianReviewResponse(reviewId, text);
      setReplyDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      setFeedback({ type: 'ok', text: 'Reply published on customer review.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to publish review response.',
      });
    }
  };

  const isVerified = technicianProfile?.verificationStatus === 'verified';
  const relevantOpenRequests = openRequests.filter((r) =>
    serviceCategories.includes(r.applianceCategory)
  );
  const activeJobs = bookings.filter((b) =>
    ['requested', 'pending', 'accepted', 'quotation_submitted', 'confirmed', 'in_progress'].includes(
      b.status
    )
  );
  const completedJobs = bookings.filter((b) =>
    ['completed', 'rejected', 'cancelled'].includes(b.status)
  );
  const liveRatingAvg = useMemo(() => {
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Number((sum / reviews.length).toFixed(1));
  }, [reviews]);

  return (
    <DashboardShell title="Technician Workbench" breadcrumb="Dashboard / Technician">
      {/* Verification Status Banner */}
      {technicianProfile && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${
            isVerified
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : technicianProfile.verificationStatus === 'rejected' ||
                  technicianProfile.verificationStatus === 'suspended'
                ? 'bg-red-50 border-red-200 text-red-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          {isVerified ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-700" />
          ) : technicianProfile.verificationStatus === 'rejected' ||
            technicianProfile.verificationStatus === 'suspended' ? (
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-700" />
          ) : (
            <Clock className="w-5 h-5 shrink-0 mt-0.5 text-amber-700" />
          )}
          <div>
            <p className="font-semibold capitalize">
              Verification Status: {technicianProfile.verificationStatus}
            </p>
            <p className="text-xs mt-0.5">
              {isVerified
                ? 'Your profile is active and visible to customers for repair bookings and quotation submissions.'
                : technicianProfile.verificationStatus === 'suspended'
                  ? 'Your technician profile is currently suspended and hidden from customer discovery.'
                  : 'An administrator must verify your profile before you appear in customer booking lists or submit quotations.'}
            </p>
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`mb-5 p-3.5 rounded-xl border text-xs ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Metrics Strip */}
      <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Incoming Open Requests</p>
          <p className="font-mono text-3xl font-semibold text-slate-900 mt-2 tabular-nums">
            {relevantOpenRequests.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Matching your categories</p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Active Bookings</p>
          <p className="font-mono text-3xl font-semibold text-blue-600 mt-2 tabular-nums">
            {activeJobs.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">Assigned customer visits</p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Submitted Quotes</p>
          <p className="font-mono text-3xl font-semibold text-slate-900 mt-2 tabular-nums">
            {quotations.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {quotations.filter((q) => q.status === 'accepted').length} approved
          </p>
        </StaggerItem>
        <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-medium text-slate-500">Verified Rating</p>
          <p className="font-mono text-3xl font-semibold text-amber-700 mt-2 tabular-nums">
            {reviews.length > 0 ? `${liveRatingAvg}/5` : 'New'}
          </p>
          <p className="text-xs text-slate-500 mt-1">{reviews.length} customer reviews</p>
        </StaggerItem>
      </StaggerGroup>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Profile, Skills, Service Categories, Availability */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 h-fit">
          <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
            <Wrench className="w-5 h-5 text-blue-600" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Profile, Skills & Availability
            </h2>
          </div>

          <form onSubmit={handleSaveProfile} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Availability Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['available', 'busy', 'offline'] as AvailabilityStatus[]).map((st) => (
                  <button
                    key={st}
                    type="button"
                    disabled={isSuspended}
                    onClick={() => setAvailabilityStatus(st)}
                    className={`py-2 text-xs font-semibold rounded-lg border capitalize transition-colors ${
                      availabilityStatus === st
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Area
                </label>
                <input
                  type="text"
                  required
                  value={serviceArea}
                  onChange={(e) => setServiceArea(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Experience (yrs)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Service Categories
              </span>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const checked = serviceCategories.includes(cat.slug);
                  return (
                    <label
                      key={cat.slug}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer ${
                        checked
                          ? 'bg-blue-50 border-blue-300 text-blue-900 font-medium'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCategory(cat.slug)}
                        className="accent-blue-600"
                      />
                      <span className="truncate">{cat.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Technical Skills (comma-separated)
              </label>
              <input
                type="text"
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bio & Certifications
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile || isSuspended}
              className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Technician Profile'}
            </button>
          </form>
        </section>

        {/* Right: Bookings, Shared Diagnoses, Quotations, Reviews */}
        <div className="lg:col-span-7 space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <ClipboardList className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Incoming Bookings & Active Jobs
              </h2>
            </div>

            <div className="mt-4">
              {activeJobs.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No assigned customer bookings at the moment.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activeJobs.map((b) => (
                    <div key={b.id} className="py-4 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {b.customerName} ·{' '}
                          <span className="capitalize">
                            {b.applianceCategory.replace(/_/g, ' ')}
                          </span>
                        </p>
                        <StatusText status={b.status} />
                      </div>
                      <p className="text-xs text-slate-600">
                        {b.scheduledDate} · {b.timeSlot} · {b.serviceAddress}
                      </p>
                      {b.notes && (
                        <p className="text-xs text-slate-500">Customer Note: {b.notes}</p>
                      )}

                      {b.diagnosisSharedWithPermission && b.sharedDiagnosisSummary ? (
                        <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-200 text-xs text-slate-800 space-y-1">
                          <p className="font-semibold text-blue-900 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5" />
                            Customer-Shared AI Diagnosis Summary
                          </p>
                          <p className="leading-relaxed">{b.sharedDiagnosisSummary}</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-slate-500">
                          AI diagnosis report not shared by customer for this booking.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {(b.status === 'requested' || b.status === 'pending') && (
                          <>
                            <button
                              type="button"
                              disabled={isSuspended}
                              onClick={() => void handleBookingTransition(b, 'accepted')}
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
                            >
                              Accept Request
                            </button>
                            <button
                              type="button"
                              disabled={isSuspended}
                              onClick={() =>
                                setRejectingBookingId(
                                  rejectingBookingId === b.id ? null : b.id
                                )
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50 rounded-md"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {b.status === 'accepted' && isVerified && (
                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() =>
                              setQuoteTarget({
                                requestId: b.requestId,
                                bookingId: b.id,
                                customerId: b.customerId,
                                title: `${b.customerName} (${b.applianceCategory.replace(/_/g, ' ')})`,
                              })
                            }
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md"
                          >
                            Submit Itemized Quotation
                          </button>
                        )}

                        {b.status === 'quotation_submitted' && (
                          <span className="text-xs font-medium text-amber-700">
                            Quotation sent — awaiting customer approval
                          </span>
                        )}

                        {(b.status === 'confirmed' || b.status === 'accepted') && (
                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() => void handleBookingTransition(b, 'in_progress')}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-900 border border-slate-300 hover:bg-slate-50 rounded-md"
                          >
                            Start Repair (In Progress)
                          </button>
                        )}

                        {b.status === 'in_progress' && (
                          <button
                            type="button"
                            disabled={isSuspended}
                            onClick={() => void handleBookingTransition(b, 'completed')}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                          >
                            Mark Completed
                          </button>
                        )}
                      </div>

                      {rejectingBookingId === b.id && (
                        <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2">
                          <input
                            type="text"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Optional reason for rejecting (e.g., outside service zone)"
                            className="w-full px-3 py-1.5 text-xs border border-red-200 rounded-md bg-white"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void handleBookingTransition(b, 'rejected', rejectionReason)
                              }
                              className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md"
                            >
                              Confirm Reject & Release Slot
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectingBookingId(null)}
                              className="px-3 py-1.5 text-xs font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Open Requests Seeking Technicians */}
            <div className="mt-6 pt-5 border-t border-slate-200">
              <h3 className="text-xs font-semibold text-slate-500 mb-2">
                Open Requests Seeking Technician
              </h3>
              {relevantOpenRequests.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No open requests matching your selected service categories.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {relevantOpenRequests.map((req) => (
                    <div key={req.id} className="py-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 capitalize">
                          {req.applianceCategory.replace(/_/g, ' ')}
                        </span>
                        <RiskIndicator level={req.riskLevel} />
                      </div>
                      <p className="text-sm font-semibold text-slate-900">{req.symptomSummary}</p>
                      <p className="text-xs text-slate-600 line-clamp-2">{req.symptomDetails}</p>
                      {isVerified && !isSuspended && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuoteTarget({
                              requestId: req.id,
                              customerId: req.customerId,
                              title: req.symptomSummary,
                            })
                          }
                          className="text-xs font-semibold text-blue-600 hover:text-blue-700 pt-1"
                        >
                          Submit Itemized Quotation
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Itemized Quotation Modal / Panel */}
          <AnimatePresence>
            {quoteTarget && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                className="bg-white border border-blue-200 rounded-xl p-6 space-y-4"
              >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900">
                    Submit Itemized Repair Quotation
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{quoteTarget.title}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setQuoteTarget(null)}
                  className="text-xs text-slate-500 hover:text-slate-900"
                >
                  Close
                </button>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Provide transparent estimated charges. Final costs may adjust only after on-site
                  physical inspection and explicit customer approval.
                </span>
              </div>

              <form onSubmit={handleSubmitQuote} className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as 'INR' | 'USD')}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="INR">INR</option>
                      <option value="USD">USD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Labour Charge
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={laborCharge}
                      onChange={(e) => setLaborCharge(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Est. Parts Cost
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={partsCost}
                      onChange={(e) => setPartsCost(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Extra Charges
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={additionalCharges}
                      onChange={(e) => setAdditionalCharges(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">Estimated Quotation Total</span>
                  <span className="font-mono text-base font-bold text-blue-700 tabular-nums">
                    {currency} {totalQuotePreview.toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimated Completion Time
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={estimatedCompletionTime}
                    onChange={(e) => setEstimatedCompletionTime(e.target.value)}
                    placeholder="e.g., 2–3 hours on-site"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Description of Proposed Work
                  </label>
                  <textarea
                    rows={2}
                    required
                    minLength={5}
                    maxLength={1000}
                    value={proposedWorkDescription}
                    onChange={(e) => setProposedWorkDescription(e.target.value)}
                    placeholder="Outline planned diagnostic checks, component replacements, and safety testing..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Parts Breakdown
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={partsDescription}
                      onChange={(e) => setPartsDescription(e.target.value)}
                      placeholder="e.g., OEM PTC start relay"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Labor & Testing Scope
                    </label>
                    <input
                      type="text"
                      required
                      minLength={2}
                      value={laborDescription}
                      onChange={(e) => setLaborDescription(e.target.value)}
                      placeholder="Installation, continuity & load check"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={sendingQuote || totalQuotePreview <= 0}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                >
                  {sendingQuote ? 'Validating & Sending...' : 'Send Itemized Quotation'}
                </button>
              </form>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Submitted Quotations Status */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Your Submitted Quotations
              </h2>
            </div>
            {quotations.length === 0 ? (
              <p className="py-5 text-xs text-slate-500">No quotations submitted yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <div key={q.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900 font-mono tabular-nums">
                        {q.currency} {q.estimatedCost.toLocaleString()}
                      </p>
                      <p className="text-slate-600 truncate max-w-md">
                        {q.proposedWorkDescription || q.partsDescription}
                      </p>
                    </div>
                    <StatusText status={q.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Customer Reviews & Responses */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Verified Customer Reviews
              </h2>
            </div>
            {reviews.length === 0 ? (
              <p className="py-5 text-xs text-slate-500">
                Customer ratings and reviews appear here once bookings are completed.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {reviews.map((rev) => (
                  <div key={rev.id} className="py-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{rev.customerName}</span>
                      <span className="font-mono font-semibold text-amber-700 tabular-nums">
                        {rev.rating} / 5 Stars
                      </span>
                    </div>
                    <p className="text-slate-700">{rev.comment}</p>
                    {rev.technicianResponse ? (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="font-semibold text-blue-700 text-[11px]">Your Response</p>
                        <p className="text-slate-700 mt-0.5">{rev.technicianResponse}</p>
                      </div>
                    ) : (
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          value={replyDrafts[rev.id] ?? ''}
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [rev.id]: e.target.value }))
                          }
                          placeholder="Write a single professional response..."
                          className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => void handleReviewReply(rev.id)}
                          className="px-3 py-1.5 font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                        >
                          Reply
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Booking History */}
          <section className="bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 pb-4 border-b border-slate-100">
              Booking History
            </h2>
            {completedJobs.length === 0 ? (
              <p className="py-5 text-xs text-slate-500">
                Completed, rejected, and cancelled bookings will appear here.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {completedJobs.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {b.customerName} ·{' '}
                        <span className="capitalize">
                          {b.applianceCategory.replace(/_/g, ' ')}
                        </span>
                      </p>
                      <p className="text-slate-500">
                        {b.scheduledDate} · {b.timeSlot}
                      </p>
                    </div>
                    <StatusText status={b.status} />
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
