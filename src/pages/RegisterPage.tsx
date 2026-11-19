import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Footer } from '../components/Footer.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { SAMPLE_APPLIANCE_CATEGORIES } from '../data/sampleKnowledgeBase.ts';
import type { ApplianceSlug } from '../types/domain.ts';

export function RegisterPage() {
  const {
    firebaseUser,
    profile,
    needsEmailVerification,
    registerWithEmail,
    loginWithGoogle,
    authError,
    clearAuthError,
  } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<'customer' | 'technician'>('customer');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Technician onboarding fields
  const [serviceArea, setServiceArea] = useState('');
  const [experienceYears, setExperienceYears] = useState('3');
  const [selectedCategories, setSelectedCategories] = useState<ApplianceSlug[]>([
    'refrigerator',
    'washing_machine',
  ]);
  const [skillsText, setSkillsText] = useState('Inverter Compressor Diagnostics, PCB Testing');
  const [bio, setBio] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    clearAuthError();
  }, [clearAuthError]);

  useEffect(() => {
    if (firebaseUser && !needsEmailVerification && profile) {
      const target =
        profile.role === 'admin'
          ? '/admin'
          : profile.role === 'technician'
            ? '/technician'
            : '/dashboard';
      navigate(target, { replace: true });
    }
  }, [firebaseUser, needsEmailVerification, profile, navigate]);

  const toggleCategory = (slug: ApplianceSlug) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((c) => c !== slug) : [...prev, slug]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (displayName.trim().length < 2) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!email.trim() || password.length < 6) {
      setLocalError('Please enter a valid email and a password of at least 6 characters.');
      return;
    }
    if (role === 'technician' && !serviceArea.trim()) {
      setLocalError('Technicians must provide a primary service area.');
      return;
    }
    if (role === 'technician' && selectedCategories.length === 0) {
      setLocalError('Select at least one appliance category you service.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerWithEmail({
        email,
        password,
        displayName,
        role,
        phone,
        address,
        serviceArea,
        experienceYears: Number(experienceYears) || 0,
        serviceCategories: selectedCategories,
        skills: skillsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        bio,
      });
      if (res.requiresVerification) {
        setVerificationSent(true);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      await loginWithGoogle(role);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Google registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayError = localError || authError;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-xl p-8">
          <p className="text-xs font-semibold text-blue-600 mb-1">Create Account</p>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Register on FixMate AI
          </h1>
          <p className="text-sm text-slate-600 mt-1.5">
            Choose whether you are registering as a homeowner/customer or an appliance repair technician.
          </p>

          {/* Role Selector */}
          <div className="mt-6 grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setRole('customer')}
              className={`py-2.5 text-sm font-semibold rounded-md transition-colors ${
                role === 'customer'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Customer Account
            </button>
            <button
              type="button"
              onClick={() => setRole('technician')}
              className={`py-2.5 text-sm font-semibold rounded-md transition-colors ${
                role === 'technician'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Technician Account
            </button>
          </div>

          {displayError && (
            <div className="mt-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{displayError}</span>
            </div>
          )}

          {verificationSent ? (
            <div className="mt-6 p-6 rounded-xl bg-emerald-50 border border-emerald-200 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5" />
                Verification Email Sent
              </div>
              <p className="text-xs text-emerald-900 leading-relaxed">
                We sent a verification link to <span className="font-semibold">{email}</span>. Open your inbox, verify your email address, and then continue to your dashboard.
              </p>
              <Link
                to={role === 'technician' ? '/technician' : '/dashboard'}
                className="inline-block px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
              >
                Continue to Verification Check
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Alex Mercer"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alex@example.com"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Password (min 6 chars)
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Phone Number (optional)
                    </label>
                    <input
                      id="reg-phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    City / Service Address (optional)
                  </label>
                  <input
                    id="reg-address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Bengaluru, Karnataka"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {role === 'technician' && (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <p className="text-xs font-semibold text-slate-900">
                      Technician Onboarding Details (Reviewed by Admin before listing)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="tech-area" className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Primary Service Area
                        </label>
                        <input
                          id="tech-area"
                          type="text"
                          required
                          value={serviceArea}
                          onChange={(e) => setServiceArea(e.target.value)}
                          placeholder="Indiranagar & Koramangala"
                          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label htmlFor="tech-exp" className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Years of Experience
                        </label>
                        <input
                          id="tech-exp"
                          type="number"
                          min={0}
                          max={60}
                          value={experienceYears}
                          onChange={(e) => setExperienceYears(e.target.value)}
                          className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-2">
                        Supported Appliance Categories
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SAMPLE_APPLIANCE_CATEGORIES.map((cat) => {
                          const checked = selectedCategories.includes(cat.slug);
                          return (
                            <label
                              key={cat.slug}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs cursor-pointer ${
                                checked
                                  ? 'bg-blue-50 border-blue-300 text-blue-800 font-medium'
                                  : 'bg-white border-slate-200 text-slate-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCategory(cat.slug)}
                                className="accent-blue-600"
                              />
                              <span>{cat.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="tech-skills" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Technical Skills (comma-separated)
                      </label>
                      <input
                        id="tech-skills"
                        type="text"
                        value={skillsText}
                        onChange={(e) => setSkillsText(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>

                    <div>
                      <label htmlFor="tech-bio" className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Short Bio / Certifications
                      </label>
                      <textarea
                        id="tech-bio"
                        rows={2}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Certified HVAC and inverter appliance specialist..."
                        className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
                >
                  {submitting
                    ? 'Creating Account...'
                    : `Create ${role === 'technician' ? 'Technician' : 'Customer'} Account`}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">or register instantly</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={handleGoogleSignUp}
                className="w-full py-2.5 px-4 text-sm font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 rounded-lg transition-colors"
              >
                Continue with Google as {role === 'technician' ? 'Technician' : 'Customer'}
              </button>

              <p className="mt-6 text-center text-xs text-slate-600">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">
                  Sign in
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
