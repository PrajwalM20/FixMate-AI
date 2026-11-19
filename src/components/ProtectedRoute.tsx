import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { MailCheck, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import type { UserRole } from '../types/domain.ts';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const {
    firebaseUser,
    profile,
    loading,
    needsEmailVerification,
    resendVerificationEmail,
    refreshVerificationStatus,
    logout,
  } = useAuth();
  const location = useLocation();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-900">Verifying session permissions...</p>
          <p className="text-xs text-slate-500 mt-1">Loading authenticated account profile</p>
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (needsEmailVerification) {
    const handleRefresh = async () => {
      setChecking(true);
      setStatusMessage(null);
      try {
        const verified = await refreshVerificationStatus();
        if (!verified) {
          setStatusMessage('Email is not verified yet. Please click the link sent to your inbox.');
        }
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : 'Unable to check status.');
      } finally {
        setChecking(false);
      }
    };

    const handleResend = async () => {
      setStatusMessage(null);
      try {
        await resendVerificationEmail();
        setStatusMessage('Verification email re-sent. Please check your inbox and spam folder.');
      } catch (err) {
        setStatusMessage(err instanceof Error ? err.message : 'Unable to send email.');
      }
    };

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 text-blue-600 mb-4">
            <MailCheck className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-xl font-bold text-slate-900">
              Verify Your Email Address
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            For account security and Firestore permission enforcement, please verify{' '}
            <span className="font-semibold text-slate-900">{firebaseUser.email}</span> before
            accessing dashboards or submitting diagnostic requests.
          </p>
          {statusMessage && (
            <div className="mb-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              {statusMessage}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={checking}
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
              I Verified — Continue
            </button>
            <button
              type="button"
              onClick={handleResend}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Resend Email
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    const homeRoute =
      profile.role === 'admin'
        ? '/admin'
        : profile.role === 'technician'
          ? '/technician'
          : '/dashboard';

    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-3 text-red-600 mb-3">
            <ShieldAlert className="w-6 h-6 shrink-0" />
            <h1 className="font-display text-xl font-bold text-slate-900">
              Role Permission Required
            </h1>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            Your account is signed in with the{' '}
            <span className="font-semibold text-slate-900 capitalize">{profile.role}</span> role.
            This workspace requires <span className="font-semibold text-slate-900">{allowedRoles.join(' or ')}</span> privileges, which are enforced by server and Firestore security rules.
          </p>
          <Link
            to={homeRoute}
            className="inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Go to Your Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
