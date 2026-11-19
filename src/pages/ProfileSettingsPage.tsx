import { useEffect, useState } from 'react';
import { KeyRound, LogOut, Save, UserCheck } from 'lucide-react';
import { DashboardShell } from '../components/DashboardShell.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function ProfileSettingsPage() {
  const { firebaseUser, profile, updateProfileFields, sendPasswordReset, logout } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName || '');
    setPhone(profile.phone || '');
    setAddress(profile.address || '');
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (displayName.trim().length < 2) {
      setFeedback({ type: 'err', text: 'Display name must be at least 2 characters.' });
      return;
    }
    setSaving(true);
    try {
      await updateProfileFields({ displayName, phone, address });
      setFeedback({ type: 'ok', text: 'Profile settings saved to Firestore and Firebase Auth.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to save profile.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!firebaseUser?.email) return;
    setFeedback(null);
    try {
      await sendPasswordReset(firebaseUser.email);
      setFeedback({
        type: 'ok',
        text: `Password reset email sent to ${firebaseUser.email}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to send reset email.',
      });
    }
  };

  return (
    <DashboardShell title="Profile & Settings" breadcrumb="Account / Settings">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 pb-4 border-b border-slate-100">
            Personal Details
          </h2>

          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email Address (read-only)
              </label>
              <input
                type="email"
                disabled
                value={profile?.email || firebaseUser?.email || ''}
                className="w-full px-3 py-2.5 text-sm border border-slate-200 bg-slate-50 text-slate-500 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Service Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, neighborhood, city"
                  className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </section>

        <section className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <UserCheck className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-lg font-bold">Account Security</h2>
            </div>

            <div className="text-xs text-slate-600 space-y-1.5">
              <p>
                Assigned Role:{' '}
                <span className="font-semibold text-slate-900 capitalize">
                  {profile?.role || 'customer'}
                </span>
              </p>
              <p>
                Email Verification:{' '}
                <span className="font-semibold text-emerald-700">
                  {firebaseUser?.emailVerified ? 'Verified' : 'Pending'}
                </span>
              </p>
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 border border-slate-300 hover:bg-slate-50 rounded-lg"
              >
                <KeyRound className="w-4 h-4" />
                Send Password Reset Email
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-lg"
              >
                <LogOut className="w-4 h-4" />
                Sign Out of Session
              </button>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
