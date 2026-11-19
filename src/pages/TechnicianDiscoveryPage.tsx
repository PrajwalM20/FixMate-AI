import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Wrench,
  X,
} from 'lucide-react';
import { Footer } from '../components/Footer.tsx';
import {
  ModalFrame,
  Reveal,
  StaggerGroup,
  StaggerItem,
} from '../components/MotionPrimitives.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  SAMPLE_APPLIANCE_CATEGORIES,
  VERIFIED_TECHNICIANS_DIRECTORY,
} from '../data/sampleKnowledgeBase.ts';
import {
  createBooking,
  fetchApplianceCategories,
  getTechnicianProfile,
  listAllReviews,
  listTechnicianBookedSlots,
  listVerifiedTechnicians,
  subscribeCustomerBookings,
  subscribeCustomerDiagnoses,
  subscribeCustomerRepairRequests,
} from '../services/firestoreService.ts';
import type {
  ApplianceCategory,
  ApplianceSlug,
  BookingRecord,
  BookingSlotLock,
  DiagnosisRecord,
  RepairRequest,
  ReviewRecord,
  TechnicianMatchResult,
  TechnicianProfile,
} from '../types/domain.ts';

const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '10:00 AM - 12:00 PM',
  '02:00 PM - 04:00 PM',
  '04:00 PM - 06:00 PM',
];

const DIRECTORY_FALLBACK: TechnicianProfile[] = VERIFIED_TECHNICIANS_DIRECTORY.map((t) => ({
  ...t,
  createdAt: null,
  updatedAt: null,
}));

export function TechnicianDiscoveryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { firebaseUser, profile, isSuspended, getAuthToken } = useAuth();

  const initialCategory = (searchParams.get('category') || 'all') as ApplianceSlug | 'all';
  const initialRequestId = searchParams.get('requestId') || '';

  const [categories, setCategories] = useState<ApplianceCategory[]>(SAMPLE_APPLIANCE_CATEGORIES);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [reviews, setReviews] = useState<ReviewRecord[]>([]);
  const [rankedResults, setRankedResults] = useState<TechnicianMatchResult[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<ApplianceSlug | 'all'>(initialCategory);
  const [locationQuery, setLocationQuery] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  // Customer requests/diagnoses for booking flow
  const [customerRequests, setCustomerRequests] = useState<RepairRequest[]>([]);
  const [customerDiagnoses, setCustomerDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [customerBookings, setCustomerBookings] = useState<BookingRecord[]>([]);

  // Inspected profile modal & booking drawer
  const [selectedTechMatch, setSelectedTechMatch] = useState<TechnicianMatchResult | null>(null);
  const [bookingTech, setBookingTech] = useState<TechnicianProfile | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState(initialRequestId);
  const [shareDiagnosis, setShareDiagnosis] = useState(true);
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [timeSlot, setTimeSlot] = useState(TIME_SLOTS[1]);
  const [bookedSlotsForDate, setBookedSlotsForDate] = useState<BookingSlotLock[]>([]);
  const [serviceAddress, setServiceAddress] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [submittingBooking, setSubmittingBooking] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const paramCat = searchParams.get('category') as ApplianceSlug | null;
    const paramReq = searchParams.get('requestId');
    if (paramCat) setCategoryFilter(paramCat);
    if (paramReq) setSelectedRequestId(paramReq);
  }, [searchParams]);

  useEffect(() => {
    if (profile?.address && !serviceAddress) {
      setServiceAddress(profile.address);
    }
  }, [profile?.address, serviceAddress]);

  useEffect(() => {
    let mounted = true;
    Promise.all([listVerifiedTechnicians(), listAllReviews(), fetchApplianceCategories()])
      .then(([techs, revs, catRes]) => {
        if (!mounted) return;
        setTechnicians(techs.length > 0 ? techs : DIRECTORY_FALLBACK);
        setReviews(revs);
        if (catRes.items.length > 0) setCategories(catRes.items);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed loading verified technicians:', err);
        if (mounted) {
          setTechnicians(DIRECTORY_FALLBACK);
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unsubReqs = subscribeCustomerRepairRequests(firebaseUser.uid, (reqs) => {
      setCustomerRequests(reqs);
      if (!selectedRequestId && reqs.length > 0) {
        const eligible = reqs.find((r) =>
          ['diagnosed', 'technician_requested', 'draft'].includes(r.status)
        );
        if (eligible) setSelectedRequestId(eligible.id);
      }
    });
    const unsubDiags = subscribeCustomerDiagnoses(firebaseUser.uid, setCustomerDiagnoses);
    const unsubBookings = subscribeCustomerBookings(firebaseUser.uid, setCustomerBookings);
    return () => {
      unsubReqs();
      unsubDiags();
      unsubBookings();
    };
  }, [firebaseUser, selectedRequestId]);

  const activeRequest = useMemo(
    () => customerRequests.find((r) => r.id === selectedRequestId) ?? null,
    [customerRequests, selectedRequestId]
  );

  const activeDiagnosis = useMemo(() => {
    if (!activeRequest) return null;
    return (
      customerDiagnoses.find((d) => d.id === activeRequest.latestDiagnosisId) ??
      customerDiagnoses.find((d) => d.requestId === activeRequest.id) ??
      null
    );
  }, [activeRequest, customerDiagnoses]);

  // Run rule-based ranking via backend endpoint
  const runRecommendation = useCallback(async () => {
    const sourceList = technicians.length > 0 ? technicians : DIRECTORY_FALLBACK;

    try {
      const res = await fetch('/api/technicians/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicians: sourceList,
          reviews,
          applianceCategory: categoryFilter,
          locationQuery,
          onlyAvailable,
          symptomKeywords:
            activeDiagnosis?.observations ??
            (activeRequest ? [activeRequest.symptomSummary] : []),
        }),
      });
      if (!res.ok) throw new Error('Recommendation request failed');
      const data = await res.json();
      setRankedResults(data.results ?? []);
    } catch {
      const filtered = sourceList.filter((t) => {
        if (onlyAvailable && t.availabilityStatus !== 'available') return false;
        if (categoryFilter !== 'all' && !t.serviceCategories.includes(categoryFilter)) return false;
        if (
          locationQuery.trim() &&
          !t.serviceArea.toLowerCase().includes(locationQuery.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      });
      setRankedResults(
        filtered.map((t) => ({
          technician: t,
          matchScore: 0.78,
          matchReasons: [`Serves ${t.serviceArea}`],
          liveRatingAvg: t.ratingAvg,
          reviewCount: 0,
        }))
      );
    }
  }, [
    technicians,
    reviews,
    categoryFilter,
    locationQuery,
    onlyAvailable,
    activeDiagnosis,
    activeRequest,
  ]);

  useEffect(() => {
    void runRecommendation();
  }, [runRecommendation]);

  useEffect(() => {
    if (!bookingTech || !scheduledDate) {
      setBookedSlotsForDate([]);
      return;
    }
    listTechnicianBookedSlots(bookingTech.uid, scheduledDate)
      .then(setBookedSlotsForDate)
      .catch(() => setBookedSlotsForDate([]));
  }, [bookingTech, scheduledDate]);

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

  const visibleReviewsForSelected = useMemo(() => {
    if (!selectedTechMatch) return [];
    return reviews.filter((r) => r.technicianId === selectedTechMatch.technician.uid);
  }, [reviews, selectedTechMatch]);

  const handleOpenBooking = (tech: TechnicianProfile) => {
    setFeedback(null);
    if (!firebaseUser) {
      navigate('/login');
      return;
    }
    setBookingTech(tech);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !bookingTech) return;
    setFeedback(null);

    if (isSuspended) {
      setFeedback({
        type: 'err',
        text: 'Your account is suspended and cannot create new repair bookings.',
      });
      return;
    }
    if (!activeRequest) {
      setFeedback({
        type: 'err',
        text: 'Please complete an AI diagnosis request first so the booking links to a valid appliance issue.',
      });
      return;
    }
    if (reservedSlotNames.has(timeSlot)) {
      setFeedback({
        type: 'err',
        text: 'That appointment slot is already reserved. Please select an open slot.',
      });
      return;
    }

    setSubmittingBooking(true);
    try {
      const liveProfile = await getTechnicianProfile(bookingTech.uid);
      if (!liveProfile || liveProfile.verificationStatus !== 'verified') {
        throw new Error(
          `${bookingTech.displayName}'s live booking calendar is not initialized in Firestore yet. Sign in once as Administrator to sync the verified provider directory, or select an already registered technician.`
        );
      }

      const token = await getAuthToken();
      if (!token) throw new Error('Authentication required.');

      const validateRes = await fetch('/api/bookings/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          technicianId: bookingTech.uid,
          scheduledDate,
          timeSlot,
          serviceAddress,
          existingBookings: customerBookings,
        }),
      });
      const validateData = await validateRes.json();
      if (!validateRes.ok || !validateData.valid) {
        throw new Error(validateData.error || 'Booking validation failed.');
      }

      const diagnosisSummary = activeDiagnosis
        ? `${activeDiagnosis.summary} | Top cause: ${
            activeDiagnosis.hypotheses[0]?.faultTitle ?? 'Pending physical check'
          } (Risk: ${activeDiagnosis.riskLevel})`
        : activeRequest.symptomSummary;

      await createBooking({
        requestId: activeRequest.id,
        diagnosisId: activeDiagnosis?.id,
        diagnosisSharedWithPermission: shareDiagnosis && Boolean(activeDiagnosis),
        sharedDiagnosisSummary:
          shareDiagnosis && activeDiagnosis ? diagnosisSummary : undefined,
        customerId: firebaseUser.uid,
        technicianId: bookingTech.uid,
        customerName: profile?.displayName || firebaseUser.email || 'Customer',
        technicianName: bookingTech.displayName,
        applianceCategory: activeRequest.applianceCategory,
        scheduledDate,
        timeSlot,
        serviceAddress,
        notes: bookingNotes,
      });

      setFeedback({
        type: 'ok',
        text: `Booking requested with ${bookingTech.displayName} for ${scheduledDate} (${timeSlot}). Track status and quotations in your Customer Portal.`,
      });
      setBookingTech(null);
      setBookingNotes('');
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to create booking.',
      });
    } finally {
      setSubmittingBooking(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <Reveal>
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-mono font-semibold text-blue-600 uppercase tracking-wider">
                Verified Service Marketplace
              </p>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight mt-1">
                Find Verified Repair Technicians
              </h1>
              <p className="text-sm text-slate-600 mt-2 max-w-2xl">
                Connect with background-verified appliance engineers ranked transparently by specialty, service zone coverage, live availability, and repair track record.
              </p>
            </div>
            <Link
              to="/diagnose"
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Run AI Diagnosis First
            </Link>
          </div>
        </Reveal>

        {/* Search & Filter Toolbar */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 mb-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Appliance Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ApplianceSlug | 'all')}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="all">All Supported Appliances</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-5">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Service Location / Area
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={locationQuery}
                onChange={(e) => setLocationQuery(e.target.value)}
                placeholder="City, neighborhood, or service zone..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="md:col-span-3 flex items-center justify-between gap-3 py-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyAvailable}
                onChange={(e) => setOnlyAvailable(e.target.checked)}
                className="accent-blue-600"
              />
              Available now only
            </label>
          </div>
        </section>

        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl border text-xs flex items-start gap-2.5 ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.type === 'ok' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-700" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
            )}
            <div className="flex-1">
              <p>{feedback.text}</p>
              {feedback.type === 'ok' && (
                <Link
                  to="/dashboard"
                  className="inline-block mt-1.5 font-semibold text-emerald-900 underline"
                >
                  Go to Customer Portal
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Active Request Context Banner for Signed-In Customers */}
        {firebaseUser && customerRequests.length > 0 && (
          <section className="mb-6 bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-slate-700">
              <span className="font-semibold text-slate-900">Ranking Context:</span>{' '}
              Matching technicians against your selected repair request for transparent scheduling.
            </div>
            <select
              value={selectedRequestId}
              onChange={(e) => setSelectedRequestId(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white max-w-sm"
            >
              <option value="">Select a repair request...</option>
              {customerRequests.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.applianceCategory.replace(/_/g, ' ')} — {r.symptomSummary}
                </option>
              ))}
            </select>
          </section>
        )}

        {/* Technician Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-white border border-slate-200 rounded-xl p-6" />
            ))}
          </div>
        ) : rankedResults.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
            <Wrench className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              No Matching Verified Technicians Found
            </h2>
            <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
              Try broadening your location search or selecting &ldquo;All Supported Appliances&rdquo;.
            </p>
          </div>
        ) : (
          <StaggerGroup className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rankedResults.map((match) => {
              const t = match.technician;
              const displayedRating =
                match.reviewCount > 0
                  ? match.liveRatingAvg.toFixed(1)
                  : t.ratingAvg > 0
                    ? t.ratingAvg.toFixed(1)
                    : 'New';

              return (
                <StaggerItem key={t.uid} hoverLift className="h-full">
                  <article className="h-full bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-xl p-6 flex flex-col justify-between space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-mono font-semibold text-blue-700 tabular-nums">
                            Match Score: {Math.round(match.matchScore * 100)}%
                          </p>
                          <h2 className="font-display text-lg font-bold text-slate-900 mt-0.5">
                            {t.displayName}
                          </h2>
                        </div>
                        <span
                          className={`text-xs font-semibold capitalize ${
                            t.availabilityStatus === 'available'
                              ? 'text-emerald-700'
                              : t.availabilityStatus === 'busy'
                                ? 'text-amber-700'
                                : 'text-slate-500'
                          }`}
                        >
                          {t.availabilityStatus}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {t.serviceArea}
                        </span>
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {t.experienceYears} yrs exp
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="inline-flex items-center gap-1 font-semibold text-slate-900 tabular-nums">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {displayedRating}
                        </span>
                        <span className="text-slate-500 tabular-nums">
                          {t.completedJobs > 0
                            ? `${t.completedJobs} jobs`
                            : `${match.reviewCount} review${match.reviewCount === 1 ? '' : 's'}`}
                          {match.reviewCount > 0 ? ` · ${match.reviewCount} verified reviews` : ''}
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Verified
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                        {t.bio || 'Verified household and electronic appliance service technician.'}
                      </p>

                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-700 mb-1">
                          Categories &amp; Skills
                        </p>
                        <p className="text-xs text-slate-600 capitalize">
                          {t.serviceCategories.map((c) => c.replace(/_/g, ' ')).join(' · ')}
                        </p>
                        {t.skills.length > 0 && (
                          <p className="text-[11px] text-slate-500 mt-1">
                            {t.skills.slice(0, 4).join(' · ')}
                          </p>
                        )}
                      </div>

                      {match.matchReasons.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <p className="text-[11px] font-semibold text-slate-700 mb-1">
                            Ranking Highlights
                          </p>
                          <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600">
                            {match.matchReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTechMatch(match)}
                        className="flex-1 py-2 px-3 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Profile &amp; Reviews
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenBooking(t)}
                        className="flex-1 py-2 px-3 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap"
                      >
                        Request Booking
                      </button>
                    </div>
                  </article>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        )}

        {/* Technician Profile & Reviews Modal */}
        <ModalFrame
          open={Boolean(selectedTechMatch)}
          onClose={() => setSelectedTechMatch(null)}
          maxWidthClass="max-w-2xl"
        >
          {selectedTechMatch && (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-mono font-semibold text-blue-700">
                    Match Score: {Math.round(selectedTechMatch.matchScore * 100)}%
                  </p>
                  <h2 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                    {selectedTechMatch.technician.displayName}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {selectedTechMatch.technician.serviceArea} ·{' '}
                    {selectedTechMatch.technician.experienceYears} years experience ·{' '}
                    {selectedTechMatch.technician.completedJobs} completed jobs
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedTechMatch(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <p className="leading-relaxed">
                  {selectedTechMatch.technician.bio ||
                    'Verified FixMate AI repair specialist.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-900 mb-1">Supported Categories</p>
                    <p className="capitalize">
                      {selectedTechMatch.technician.serviceCategories
                        .map((c) => c.replace(/_/g, ' '))
                        .join(', ')}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="font-semibold text-slate-900 mb-1">Verified Skills</p>
                    <p>
                      {selectedTechMatch.technician.skills.join(', ') || 'General diagnostics'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 mb-3">
                  Customer Reviews ({visibleReviewsForSelected.length})
                </h3>
                {visibleReviewsForSelected.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Rating average: {selectedTechMatch.technician.ratingAvg.toFixed(1)}/5 across{' '}
                    {selectedTechMatch.technician.completedJobs} completed service jobs. New on-platform written reviews will appear here once submitted.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visibleReviewsForSelected.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-900">{rev.customerName}</span>
                          <span className="font-mono font-semibold text-amber-700 tabular-nums">
                            {rev.rating} / 5 Stars
                          </span>
                        </div>
                        <p className="text-slate-700">{rev.comment}</p>
                        {rev.technicianResponse && (
                          <div className="mt-2 p-2.5 rounded bg-white border border-slate-200">
                            <p className="font-semibold text-[11px] text-blue-700">
                              Technician Response
                            </p>
                            <p className="text-slate-700 mt-0.5">{rev.technicianResponse}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTechMatch(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const tech = selectedTechMatch.technician;
                    setSelectedTechMatch(null);
                    handleOpenBooking(tech);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  Book Appointment
                </button>
              </div>
            </div>
          )}
        </ModalFrame>

        {/* Booking Request Modal */}
        <ModalFrame
          open={Boolean(bookingTech)}
          onClose={() => setBookingTech(null)}
          maxWidthClass="max-w-lg"
        >
          {bookingTech && (
            <div className="p-6 space-y-4">
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    Request Repair Booking
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Technician: <span className="font-semibold">{bookingTech.displayName}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingTech(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {customerRequests.length === 0 ? (
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                  <p className="font-semibold">No Repair Request Selected</p>
                  <p>
                    Run an AI appliance diagnosis first so your booking is linked to a structured
                    appliance fault record.
                  </p>
                  <Link
                    to="/diagnose"
                    className="inline-block px-3 py-1.5 bg-blue-600 text-white font-semibold rounded-md"
                  >
                    Open AI Diagnosis Workspace
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleConfirmBooking} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Linked Appliance Repair Request
                    </label>
                    <select
                      required
                      value={selectedRequestId}
                      onChange={(e) => setSelectedRequestId(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Choose a request...</option>
                      {customerRequests.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.applianceCategory.replace(/_/g, ' ')} — {r.symptomSummary}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeDiagnosis && (
                    <label className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50/70 border border-blue-200 text-xs text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={shareDiagnosis}
                        onChange={(e) => setShareDiagnosis(e.target.checked)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span>
                        <strong>Share AI diagnosis report with technician</strong> (grants explicit
                        permission to include your symptom summary, risk level, and top inferred
                        cause in this booking).
                      </span>
                    </label>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Appointment Date
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
                        Time Slot (Live Availability)
                      </label>
                      <select
                        value={timeSlot}
                        onChange={(e) => setTimeSlot(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
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

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Service Address
                    </label>
                    <input
                      type="text"
                      required
                      minLength={5}
                      maxLength={250}
                      value={serviceAddress}
                      onChange={(e) => setServiceAddress(e.target.value)}
                      placeholder="Apartment, street, landmark, city"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Notes for Technician (optional)
                    </label>
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Gate instructions, preferred contact window, or appliance serial details..."
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Disclaimer: AI diagnosis and upcoming technician quotations are preliminary
                    estimates. Final repair charges require physical inspection and your explicit
                    approval.
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setBookingTech(null)}
                      className="px-4 py-2 text-xs font-semibold text-slate-700 border border-slate-300 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingBooking || reservedSlotNames.has(timeSlot)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {submittingBooking ? 'Reserving Slot...' : 'Submit Booking Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </ModalFrame>
      </main>

      <Footer />
    </div>
  );
}
