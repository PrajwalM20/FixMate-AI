import { useEffect, useState } from 'react';
import { CheckCircle2, HelpCircle, Send } from 'lucide-react';
import { Footer } from '../components/Footer.tsx';
import { Reveal, StaggerGroup, StaggerItem } from '../components/MotionPrimitives.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { submitContactInquiry } from '../services/firestoreService.ts';

const FAQS = [
  {
    q: 'How does FixMate AI diagnose appliance faults?',
    a: 'FixMate AI runs a server-side hybrid pipeline combining Gemini multimodal vision/NLU and optional Live Voice intake with forward-chaining rule inference, Breadth-First Search (BFS) troubleshooting paths, uncertainty scoring, and strict safety gating.',
  },
  {
    q: 'Are DIY troubleshooting steps safe for high-voltage appliances?',
    a: 'No internal disassembly is ever recommended for high-voltage or sealed systems such as microwaves, AC refrigerant lines, or television power boards. Risk gating automatically flags critical hazards for certified technician service.',
  },
  {
    q: 'How are repair technicians verified?',
    a: 'Technicians register with their service categories, experience, and service area. Accounts remain in "pending" status until reviewed and approved by an Administrator in the Admin Console.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Visit the Sign In page and select "Forgot password?", or trigger a password reset email directly from your Profile & Settings page.',
  },
];

export function ContactHelpPage() {
  const { firebaseUser, profile } = useAuth();
  const [name, setName] = useState(profile?.displayName || '');
  const [email, setEmail] = useState(profile?.email || firebaseUser?.email || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.displayName && !name) {
      setName(profile.displayName);
    }
    const resolvedEmail = profile?.email || firebaseUser?.email;
    if (resolvedEmail && !email) {
      setEmail(resolvedEmail);
    }
  }, [profile?.displayName, profile?.email, firebaseUser?.email, name, email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2 || !email.includes('@') || subject.trim().length < 3 || message.trim().length < 10) {
      setError('Please complete all fields with valid details (message at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const id = await submitContactInquiry({
        name,
        email,
        subject,
        message,
        userId: firebaseUser?.uid,
      });
      setSubmittedId(id);
      setSubject('');
      setMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send inquiry.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <Reveal className="max-w-2xl mb-10">
          <p className="text-xs font-semibold text-blue-600 mb-2">Support &amp; Documentation</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Contact &amp; Help Center
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-600">
            Review common safety and platform questions or send an inquiry directly to the FixMate AI support team.
          </p>
        </Reveal>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* FAQs */}
          <StaggerGroup className="lg:col-span-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <HelpCircle className="w-5 h-5 text-blue-600" />
              <h2 className="font-display text-xl font-bold text-slate-900">
                Frequently Asked Questions
              </h2>
            </div>
            {FAQS.map((item) => (
              <StaggerItem key={item.q} className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-900">{item.q}</h3>
                <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">{item.a}</p>
              </StaggerItem>
            ))}
          </StaggerGroup>

          {/* Contact Form */}
          <section className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-slate-900 pb-4 border-b border-slate-100">
              Send Support Inquiry
            </h2>

            {error && (
              <div className="mt-4 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            {submittedId ? (
              <div className="mt-6 p-5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  Inquiry Received
                </div>
                <p className="text-xs text-emerald-900">
                  Your support message has been saved to Firestore (Reference:{' '}
                  <span className="font-mono">{submittedId}</span>).
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedId(null)}
                  className="mt-2 text-xs font-semibold text-blue-600 hover:underline"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="contact-name" className="block text-xs font-semibold text-slate-700 mb-1">
                      Your Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label htmlFor="contact-email" className="block text-xs font-semibold text-slate-700 mb-1">
                      Email Address
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="contact-subject" className="block text-xs font-semibold text-slate-700 mb-1">
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Technician verification, account help, or bug report"
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <div>
                  <label htmlFor="contact-message" className="block text-xs font-semibold text-slate-700 mb-1">
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    rows={4}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe how we can help..."
                    className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Sending...' : 'Submit Inquiry'}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
