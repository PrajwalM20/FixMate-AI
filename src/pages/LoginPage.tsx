import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, KeyRound, Mail } from 'lucide-react';
import { Footer } from '../components/Footer.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';

export function LoginPage() {
  const {
    firebaseUser,
    profile,
    needsEmailVerification,
    loginWithEmail,
    loginWithGoogle,
    sendPasswordReset,
    authError,
    clearAuthError,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectState = (location.state as { from?: string } | null)?.from;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  useEffect(() => {
    if (firebaseUser && !needsEmailVerification && profile) {
      const target =
        redirectState ||
        (profile.role === 'admin'
          ? '/admin'
          : profile.role === 'technician'
            ? '/technician'
            : '/dashboard');
      navigate(target, { replace: true });
    }
  }, [firebaseUser, needsEmailVerification, profile, navigate, redirectState]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError('Please enter both email and password.');
      return;
    }
    setSubmitting(true);
    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSent(null);
    if (!email.trim()) {
      setLocalError('Enter your account email to receive a password reset link.');
      return;
    }
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setResetSent(`Password reset email sent to ${email.trim()}. Check your inbox.`);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
          <p className="text-xs font-semibold text-blue-600 mb-1">FixMate AI Account</p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {resetMode ? 'Reset Your Password' : 'Sign In to FixMate AI'}
          </h1>
          <p className="text-sm text-slate-600 mt-1.5">
            {resetMode
              ? 'We will send a Firebase password recovery link to your registered email.'
              : 'Access your repair diagnostics, technician bookings, or admin console.'}
          </p>

          {displayError && (
            <div className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {resetSent && (
            <div className="mt-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{resetSent}</span>
            </div>
          )}

          {resetMode ? (
            <form onSubmit={handleReset} className="mt-6 space-y-4">
              <div>
                <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="reset-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
              >
                {submitting ? 'Sending Reset Link...' : 'Send Password Reset Email'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setResetMode(false);
                  setLocalError(null);
                }}
                className="w-full text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetMode(true);
                        setLocalError(null);
                      }}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {submitting ? 'Signing In...' : 'Sign In'}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">or</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogle}
                className="w-full py-2.5 px-4 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors"
              >
                Continue with Google
              </button>

              <p className="mt-6 text-center text-xs text-slate-600">
                New to FixMate AI?{' '}
                <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
                  Create an account
                </Link>
              </p>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
