import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Calendar,
  Cpu,
  Database,
  Layers,
  MessageSquareWarning,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { DashboardShell } from '../components/DashboardShell.tsx';
import { StaggerGroup, StaggerItem, TabPanel } from '../components/MotionPrimitives.tsx';
import { RiskIndicator, StatusText } from '../components/StatusLabel.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import {
  adminFetchAllBookings,
  adminFetchAllCategories,
  adminFetchAllComplaints,
  adminFetchAllDiagnoses,
  adminFetchAllQuotations,
  adminFetchAllRepairRequests,
  adminFetchAllTechnicians,
  adminFetchAllUsers,
  adminSaveCategory,
  adminSeedSampleCatalogAndKB,
  adminSetTechnicianVerification,
  adminSetUserAccountStatus,
  adminToggleCategoryActive,
  adminUpdateComplaintStatus,
  adminUpdateRepairRequestStatus,
  adminUpdateUserRole,
  updateBookingStatus,
} from '../services/firestoreService.ts';
import type {
  AccountStatus,
  ApplianceCategory,
  ApplianceSlug,
  BookingRecord,
  BookingStatus,
  ComplaintRecord,
  ComplaintStatus,
  DiagnosisRecord,
  QuotationRecord,
  RepairRequest,
  RepairRequestStatus,
  TechnicianProfile,
  UserProfile,
  UserRole,
  VerificationStatus,
} from '../types/domain.ts';

type AdminTab =
  | 'overview'
  | 'users'
  | 'technicians'
  | 'requests'
  | 'bookings'
  | 'diagnoses'
  | 'complaints'
  | 'categories';

export function AdminDashboard() {
  const { firebaseUser } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [technicians, setTechnicians] = useState<TechnicianProfile[]>([]);
  const [requests, setRequests] = useState<RepairRequest[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisRecord[]>([]);
  const [quotations, setQuotations] = useState<QuotationRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [categories, setCategories] = useState<ApplianceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [seeding, setSeeding] = useState(false);

  // Category creation form
  const [newCatSlug, setNewCatSlug] = useState<ApplianceSlug>('other');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatSafety, setNewCatSafety] = useState('');

  // Complaint notes drafts
  const [complaintNotesDraft, setComplaintNotesDraft] = useState<Record<string, string>>({});

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t, r, b, d, q, cmp, c] = await Promise.all([
        adminFetchAllUsers(),
        adminFetchAllTechnicians(),
        adminFetchAllRepairRequests(),
        adminFetchAllBookings(),
        adminFetchAllDiagnoses(),
        adminFetchAllQuotations(),
        adminFetchAllComplaints(),
        adminFetchAllCategories(),
      ]);
      setUsers(u);
      setTechnicians(t);
      setRequests(r);
      setBookings(b);
      setDiagnoses(d);
      setQuotations(q);
      setComplaints(cmp);
      setCategories(c);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load admin records.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleSeedSampleData = async () => {
    setSeeding(true);
    setFeedback(null);
    try {
      const counts = await adminSeedSampleCatalogAndKB();
      setFeedback({
        type: 'ok',
        text: `Synced ${counts.categoriesCount} appliance categories, ${counts.kbCount} fault knowledge frames, and ${counts.techniciansCount} verified technician profiles to Firestore.`,
      });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Seeding failed.',
      });
    } finally {
      setSeeding(false);
    }
  };

  const handleRoleChange = async (uid: string, role: UserRole) => {
    setFeedback(null);
    try {
      await adminUpdateUserRole(uid, role);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, role } : u)));
      setFeedback({ type: 'ok', text: `Updated user role to ${role}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Role update failed.',
      });
    }
  };

  const handleAccountStatus = async (uid: string, accountStatus: AccountStatus) => {
    if (uid === firebaseUser?.uid && accountStatus === 'suspended') {
      setFeedback({ type: 'err', text: 'Cannot suspend the active administrator session.' });
      return;
    }
    setFeedback(null);
    try {
      await adminSetUserAccountStatus(uid, accountStatus);
      setUsers((prev) => prev.map((u) => (u.uid === uid ? { ...u, accountStatus } : u)));
      setFeedback({ type: 'ok', text: `User account marked as ${accountStatus}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update account status.',
      });
    }
  };

  const handleTechVerification = async (techId: string, status: VerificationStatus) => {
    setFeedback(null);
    try {
      await adminSetTechnicianVerification(techId, status);
      setTechnicians((prev) =>
        prev.map((t) => (t.uid === techId ? { ...t, verificationStatus: status } : t))
      );
      setFeedback({ type: 'ok', text: `Technician status updated to ${status}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Verification update failed.',
      });
    }
  };

  const handleRequestStatus = async (reqId: string, status: RepairRequestStatus) => {
    setFeedback(null);
    try {
      await adminUpdateRepairRequestStatus(reqId, status);
      setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status } : r)));
      setFeedback({ type: 'ok', text: `Repair request ${reqId} updated to ${status}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Status update failed.',
      });
    }
  };

  const handleAdminBookingStatus = async (booking: BookingRecord, status: BookingStatus) => {
    setFeedback(null);
    try {
      await updateBookingStatus(booking.id, status, booking.requestId, {
        actorId: firebaseUser?.uid,
        actorRole: 'admin',
      });
      setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, status } : b)));
      setFeedback({ type: 'ok', text: `Booking ${booking.id} updated to ${status}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Booking update failed.',
      });
    }
  };

  const handleComplaintUpdate = async (c: ComplaintRecord, status: ComplaintStatus) => {
    setFeedback(null);
    try {
      const notes = complaintNotesDraft[c.id] ?? c.adminNotes ?? '';
      await adminUpdateComplaintStatus(c.id, status, notes);
      setComplaints((prev) =>
        prev.map((item) =>
          item.id === c.id ? { ...item, status, adminNotes: notes } : item
        )
      );
      setFeedback({ type: 'ok', text: `Complaint ${c.id} updated to ${status}.` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Complaint update failed.',
      });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      const id = `cat_${newCatSlug}`;
      await adminSaveCategory({
        id,
        slug: newCatSlug,
        name: newCatName.trim(),
        description: newCatDesc.trim(),
        safetyNotice: newCatSafety.trim(),
        commonFaultsCount: 0,
        isActive: true,
      });
      setNewCatName('');
      setNewCatDesc('');
      setNewCatSafety('');
      setFeedback({ type: 'ok', text: 'Service category saved to Firestore.' });
      await loadAll();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save category.',
      });
    }
  };

  const pendingTechs = technicians.filter((t) => t.verificationStatus === 'pending');
  const openComplaints = complaints.filter(
    (c) => c.status === 'open' || c.status === 'investigating'
  );

  return (
    <DashboardShell
      title="Admin Operations Console"
      breadcrumb="Dashboard / Admin"
      action={
        <button
          type="button"
          disabled={seeding}
          onClick={() => void handleSeedSampleData()}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <Database className="w-3.5 h-3.5" />
          {seeding ? 'Syncing...' : 'Sync Platform Catalog'}
        </button>
      }
    >
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

      {/* Segmented Section Tabs */}
      <div className="mb-6 flex flex-wrap gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {(
          [
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: `Users (${users.length})` },
            { id: 'technicians', label: `Technicians (${technicians.length})` },
            { id: 'requests', label: `Requests (${requests.length})` },
            { id: 'bookings', label: `Bookings (${bookings.length})` },
            { id: 'diagnoses', label: `Diagnoses (${diagnoses.length})` },
            { id: 'complaints', label: `Complaints (${complaints.length})` },
            { id: 'categories', label: `Categories (${categories.length})` },
          ] as { id: AdminTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <TabPanel activeKey={activeTab}>
      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Registered Users</span>
                <Users className="w-4 h-4" />
              </div>
              <p className="font-mono text-3xl font-semibold text-slate-900 mt-2 tabular-nums">
                {users.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {users.filter((u) => u.accountStatus === 'suspended').length} suspended
              </p>
            </StaggerItem>
            <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Technician Queue</span>
                <ShieldCheck className="w-4 h-4" />
              </div>
              <p className="font-mono text-3xl font-semibold text-amber-700 mt-2 tabular-nums">
                {pendingTechs.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {technicians.filter((t) => t.verificationStatus === 'verified').length} verified
                active
              </p>
            </StaggerItem>
            <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Bookings &amp; Quotes</span>
                <Calendar className="w-4 h-4" />
              </div>
              <p className="font-mono text-3xl font-semibold text-blue-600 mt-2 tabular-nums">
                {bookings.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">{quotations.length} quotations logged</p>
            </StaggerItem>
            <StaggerItem className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">Open Complaints</span>
                <MessageSquareWarning className="w-4 h-4" />
              </div>
              <p className="font-mono text-3xl font-semibold text-red-700 mt-2 tabular-nums">
                {openComplaints.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">{diagnoses.length} AI diagnoses stored</p>
            </StaggerItem>
          </StaggerGroup>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Activity className="w-5 h-5 text-blue-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Recent Platform Activity
                </h2>
              </div>
              {requests.length === 0 && bookings.length === 0 && complaints.length === 0 ? (
                <p className="text-xs text-slate-500 py-4">
                  No activity recorded in Firestore yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {bookings.slice(0, 4).map((b) => (
                    <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          Booking: {b.customerName} → {b.technicianName}
                        </p>
                        <p className="text-slate-500 capitalize">
                          {b.applianceCategory.replace(/_/g, ' ')} · {b.scheduledDate} ({b.timeSlot})
                        </p>
                      </div>
                      <StatusText status={b.status} />
                    </div>
                  ))}
                  {requests.slice(0, 4).map((r) => (
                    <div key={r.id} className="py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{r.symptomSummary}</p>
                        <p className="text-slate-500 capitalize">
                          {r.customerName} · {r.applianceCategory.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <StatusText status={r.status} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Layers className="w-5 h-5 text-blue-600" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Marketplace Governance
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                All KPIs and records shown in this console reflect live Firestore documents.
                Administrators verify technician applications, suspend abusive accounts, monitor
                diagnosis safety escalations, inspect bookings, and resolve customer complaints.
              </p>
              <div className="pt-2 space-y-2 text-xs text-slate-700">
                <p className="flex justify-between">
                  <span>Active Appliance Categories:</span>
                  <span className="font-mono font-semibold">
                    {categories.filter((c) => c.isActive).length}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Completed Bookings:</span>
                  <span className="font-mono font-semibold">
                    {bookings.filter((b) => b.status === 'completed').length}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Accepted Quotations:</span>
                  <span className="font-mono font-semibold">
                    {quotations.filter((q) => q.status === 'accepted').length}
                  </span>
                </p>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Users Management */}
      {activeTab === 'users' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            User Management & Account Controls
          </h2>
          {loading ? (
            <p className="text-xs text-slate-500">Loading users...</p>
          ) : users.length === 0 ? (
            <p className="text-xs text-slate-500">No registered users in Firestore yet.</p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 pl-4 text-right">Account Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const suspended = u.accountStatus === 'suspended';
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-900">{u.displayName}</td>
                      <td className="py-3 px-4 text-slate-600">{u.email}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            suspended ? 'text-red-700' : 'text-emerald-700'
                          }`}
                        >
                          {u.accountStatus || 'active'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={u.role}
                          onChange={(e) => void handleRoleChange(u.uid, e.target.value as UserRole)}
                          className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                        >
                          <option value="customer">customer</option>
                          <option value="technician">technician</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="py-3 pl-4 text-right">
                        {suspended ? (
                          <button
                            type="button"
                            onClick={() => void handleAccountStatus(u.uid, 'active')}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 rounded-md"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={u.uid === firebaseUser?.uid}
                            onClick={() => void handleAccountStatus(u.uid, 'suspended')}
                            className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-40 rounded-md"
                          >
                            Suspend
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Technician Verification & Suspension */}
      {activeTab === 'technicians' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            Technician Verification & Suspension Queue
          </h2>
          {technicians.length === 0 ? (
            <p className="text-xs text-slate-500">No technician profiles registered yet.</p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Technician</th>
                  <th className="py-3 px-4">Service Area</th>
                  <th className="py-3 px-4">Categories</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 pl-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicians.map((t) => (
                  <tr key={t.uid} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{t.displayName}</p>
                      <p className="text-xs text-slate-500">{t.experienceYears} yrs experience</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">{t.serviceArea}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {t.serviceCategories.join(', ')}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={t.verificationStatus} />
                    </td>
                    <td className="py-3 pl-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleTechVerification(t.uid, 'verified')}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTechVerification(t.uid, 'rejected')}
                        className="px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-md"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleTechVerification(t.uid, 'suspended')}
                        className="px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-300 hover:bg-amber-50 rounded-md"
                      >
                        Suspend
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Repair Requests */}
      {activeTab === 'requests' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            Repair Request Management
          </h2>
          {requests.length === 0 ? (
            <p className="text-xs text-slate-500">No repair requests recorded yet.</p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Customer & Category</th>
                  <th className="py-3 px-4">Symptom Summary</th>
                  <th className="py-3 px-4">Risk</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 pl-4 text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">{r.customerName}</p>
                      <p className="text-xs text-slate-500 capitalize">
                        {r.applianceCategory.replace(/_/g, ' ')}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 max-w-xs truncate">
                      {r.symptomSummary}
                    </td>
                    <td className="py-3 px-4">
                      <RiskIndicator level={r.riskLevel} />
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={r.status} />
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <select
                        value={r.status}
                        onChange={(e) =>
                          void handleRequestStatus(r.id, e.target.value as RepairRequestStatus)
                        }
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="draft">draft</option>
                        <option value="diagnosed">diagnosed</option>
                        <option value="technician_requested">technician_requested</option>
                        <option value="booked">booked</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* Bookings Monitor */}
      {activeTab === 'bookings' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 overflow-x-auto">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            Marketplace Booking Monitor
          </h2>
          {bookings.length === 0 ? (
            <p className="text-xs text-slate-500">No bookings recorded yet.</p>
          ) : (
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Customer & Technician</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Diagnosis Shared</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 pl-4 text-right">Admin Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <p className="font-medium text-slate-900">
                        {b.customerName} → {b.technicianName}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        {b.applianceCategory.replace(/_/g, ' ')} · {b.serviceAddress}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700 whitespace-nowrap">
                      {b.scheduledDate} · {b.timeSlot}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      {b.diagnosisSharedWithPermission ? 'Opted in' : 'Not shared'}
                    </td>
                    <td className="py-3 px-4">
                      <StatusText status={b.status} />
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <select
                        value={b.status}
                        onChange={(e) =>
                          void handleAdminBookingStatus(b, e.target.value as BookingStatus)
                        }
                        className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
                      >
                        <option value="requested">requested</option>
                        <option value="pending">pending</option>
                        <option value="accepted">accepted</option>
                        <option value="rejected">rejected</option>
                        <option value="quotation_submitted">quotation_submitted</option>
                        <option value="confirmed">confirmed</option>
                        <option value="in_progress">in_progress</option>
                        <option value="completed">completed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {/* AI Diagnoses Inspector */}
      {activeTab === 'diagnoses' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Cpu className="w-5 h-5 text-blue-600" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              AI Diagnosis Telemetry & Safety Oversight
            </h2>
          </div>
          {diagnoses.length === 0 ? (
            <p className="text-xs text-slate-500">No AI diagnoses stored yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {diagnoses.map((d) => (
                <div key={d.id} className="py-4 space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 capitalize">
                      {d.applianceCategory.replace(/_/g, ' ')} ·{' '}
                      <span className="font-mono text-slate-500">{d.engineMode}</span>
                    </span>
                    <RiskIndicator level={d.riskLevel} />
                  </div>
                  <p className="text-slate-700 leading-relaxed">{d.summary}</p>
                  <p className="text-slate-500">
                    Top Cause: {d.hypotheses[0]?.faultTitle ?? 'Unresolved'} · Score:{' '}
                    <span className="font-mono font-semibold">
                      {Math.round(d.confidenceScore * 100)}%
                    </span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Complaints & Disputes Resolution */}
      {activeTab === 'complaints' && (
        <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <MessageSquareWarning className="w-5 h-5 text-red-600" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Customer Complaints & Disputes
            </h2>
          </div>
          {complaints.length === 0 ? (
            <p className="text-xs text-slate-500">No complaints reported yet.</p>
          ) : (
            <div className="space-y-4">
              {complaints.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-900">{c.subject}</p>
                      <p className="text-slate-500 capitalize">
                        Reported by {c.reporterName} ({c.reporterRole}) ·{' '}
                        {c.category.replace(/_/g, ' ')}
                        {c.bookingId ? ` · Booking ${c.bookingId}` : ''}
                      </p>
                    </div>
                    <StatusText status={c.status} />
                  </div>
                  <p className="text-slate-700 leading-relaxed">{c.description}</p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-200">
                    <input
                      type="text"
                      value={complaintNotesDraft[c.id] ?? c.adminNotes ?? ''}
                      onChange={(e) =>
                        setComplaintNotesDraft((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="Administrator investigation or resolution notes..."
                      className="flex-1 px-3 py-1.5 border border-slate-300 rounded-md bg-white"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleComplaintUpdate(c, 'investigating')}
                        className="px-2.5 py-1.5 font-semibold text-blue-700 border border-blue-200 bg-white hover:bg-blue-50 rounded-md"
                      >
                        Investigate
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleComplaintUpdate(c, 'resolved')}
                        className="px-2.5 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                      >
                        Resolve
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleComplaintUpdate(c, 'dismissed')}
                        className="px-2.5 py-1.5 font-semibold text-slate-700 border border-slate-300 bg-white hover:bg-slate-100 rounded-md"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Service Categories */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
              Firestore Service Categories
            </h2>
            {categories.length === 0 ? (
              <div className="py-6 text-xs text-slate-500">
                No categories in Firestore yet. Click &ldquo;Sync Platform Catalog&rdquo;
                above to populate all 7 standard appliance categories, 12 knowledge base fault frames, and 4 verified technician profiles.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <div key={c.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {c.name}{' '}
                        <span className="font-mono text-xs text-slate-400">({c.slug})</span>
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">{c.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void adminToggleCategoryActive(c.id, !c.isActive).then(loadAll)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md border whitespace-nowrap ${
                        c.isActive
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : 'bg-slate-100 border-slate-300 text-slate-600'
                      }`}
                    >
                      {c.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
              Add / Update Category
            </h2>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Slug
                </label>
                <select
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value as ApplianceSlug)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  <option value="refrigerator">refrigerator</option>
                  <option value="washing_machine">washing_machine</option>
                  <option value="air_conditioner">air_conditioner</option>
                  <option value="laptop">laptop</option>
                  <option value="television">television</option>
                  <option value="microwave">microwave</option>
                  <option value="other">other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g., Refrigerator"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  required
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Safety Notice
                </label>
                <input
                  type="text"
                  required
                  value={newCatSafety}
                  onChange={(e) => setNewCatSafety(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Save Service Category
              </button>
            </form>
          </section>
        </div>
      )}
      </TabPanel>
    </DashboardShell>
  );
}
