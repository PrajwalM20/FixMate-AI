import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, CheckCircle2, Cpu, Mic, ShieldCheck, Wrench } from 'lucide-react';
import { Footer } from '../components/Footer.tsx';
import {
  EASE_OUT_EXPO,
  Reveal,
  StaggerGroup,
  StaggerItem,
} from '../components/MotionPrimitives.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { ResilientImage } from '../components/ResilientImage.tsx';
import { SAMPLE_APPLIANCE_CATEGORIES, SAMPLE_KNOWLEDGE_BASE } from '../data/sampleKnowledgeBase.ts';
import { fetchApplianceCategories, fetchKnowledgeBase } from '../services/firestoreService.ts';

export function LandingPage() {
  const [categories, setCategories] = useState(SAMPLE_APPLIANCE_CATEGORIES);
  const [kbCount, setKbCount] = useState(SAMPLE_KNOWLEDGE_BASE.length);

  useEffect(() => {
    let active = true;
    Promise.all([fetchApplianceCategories(), fetchKnowledgeBase()])
      .then(([catRes, kbRes]) => {
        if (!active) return;
        if (catRes.items.length > 0) setCategories(catRes.items);
        if (kbRes.items.length > 0) setKbCount(kbRes.items.length);
      })
      .catch(() => {
        // retain curated default catalog
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        {/* Hero Split Section */}
        <section className="bg-white border-b border-slate-200 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.36, ease: EASE_OUT_EXPO }}
                className="lg:col-span-6 flex flex-col justify-center"
              >
                <p className="text-xs font-semibold tracking-wide text-blue-600 mb-3">
                  Intelligent Appliance Troubleshooting Platform
                </p>
                <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-slate-900 leading-[1.08] text-balance">
                  Diagnose Smarter. Repair Better.
                </h1>
                <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                  Describe appliance symptoms, upload fault photos, speak live with our voice diagnostic assistant, follow safety-gated checks, and book verified repair specialists on demand.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Link
                    to="/diagnose"
                    className="group inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all whitespace-nowrap shrink-0"
                  >
                    Start AI Diagnosis
                    <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    to="/technicians"
                    className="inline-flex items-center px-5 py-3 text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Find Technicians
                  </Link>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                  <span>Safety-Gated Escalation</span>
                  <span aria-hidden="true">·</span>
                  <span>Multimodal &amp; Live Voice Intake</span>
                  <span aria-hidden="true">·</span>
                  <span>Verified Service Marketplace</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.42, delay: 0.08, ease: EASE_OUT_EXPO }}
                className="lg:col-span-6"
              >
                <div className="h-full min-h-[320px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                  <ResilientImage
                    src="/src/assets/images/hero_appliance_diagnostic_1795021203685.jpg"
                    alt="Modern kitchen with stainless steel refrigerator, washing machine, and diagnostic tablet"
                    className="w-full h-full object-cover"
                    fallbackLabel="FixMate AI Smart Home Diagnostic Suite"
                  />
                </div>
              </motion.div>
            </div>

            {/* Full-Width 4-Column Architectural Capabilities Strip */}
            <StaggerGroup className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 lg:grid-cols-4 gap-6">
              <StaggerItem>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {categories.length}
                </p>
                <p className="text-sm font-medium text-slate-700 mt-1">Appliance Categories</p>
                <p className="text-xs text-slate-500 mt-0.5">Refrigerators to microwaves</p>
              </StaggerItem>
              <StaggerItem>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  {kbCount}
                </p>
                <p className="text-sm font-medium text-slate-700 mt-1">Structured Fault Frames</p>
                <p className="text-xs text-slate-500 mt-0.5">Verified troubleshooting rules</p>
              </StaggerItem>
              <StaggerItem>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  9
                </p>
                <p className="text-sm font-medium text-slate-700 mt-1">Diagnostic Modules</p>
                <p className="text-xs text-slate-500 mt-0.5">Live Voice, Vision, BFS &amp; Safety</p>
              </StaggerItem>
              <StaggerItem>
                <p className="font-mono text-2xl font-semibold text-slate-900 tabular-nums">
                  3
                </p>
                <p className="text-sm font-medium text-slate-700 mt-1">Role-Protected Portals</p>
                <p className="text-xs text-slate-500 mt-0.5">Customer, Technician, Admin</p>
              </StaggerItem>
            </StaggerGroup>
          </div>
        </section>

        {/* Section 2: Intelligent Troubleshooting Pipeline */}
        <section className="py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              <Reveal className="lg:col-span-5">
                <p className="text-xs font-semibold text-blue-600 mb-2">
                  How FixMate AI Works
                </p>
                <h2 className="font-display text-3xl font-bold text-slate-900 tracking-tight text-balance">
                  Structured Reasoning Before Dispatch
                </h2>
                <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">
                  Instead of generic chat guesses, FixMate AI separates symptom perception, knowledge retrieval, deterministic rule inference, and hazard gating into transparent stages.
                </p>

                <div className="mt-8 rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <ResilientImage
                    src="/src/assets/images/technician_diagnostic_lab_1795021204799.jpg"
                    alt="Certified appliance technician testing an inverter control board with a multimeter"
                    className="w-full aspect-[4/3] object-cover"
                    fallbackLabel="Technician Verification Workbench"
                  />
                </div>
              </Reveal>

              <StaggerGroup className="lg:col-span-7 divide-y divide-slate-200 bg-white border border-slate-200 rounded-xl">
                <StaggerItem className="p-6 sm:p-8">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    01. Multimodal &amp; Live Voice Intake
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Select an appliance category, describe observable symptoms or speak via the real-time voice assistant, and upload up to 3 photos. Multimodal perception extracts structured facts and detects immediate electrical or thermal hazard cues.
                  </p>
                </StaggerItem>
                <StaggerItem className="p-6 sm:p-8">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    02. Knowledge Frame &amp; Rule Inference
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Observations are grounded against structured fault rules to produce ranked hypotheses, missing evidence checks, and interactive follow-up questions with clear confidence scoring.
                  </p>
                </StaggerItem>
                <StaggerItem className="p-6 sm:p-8">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    03. Safety-Bounded Action Paths
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Breadth-first diagnostic search isolates safe external checks (vent clearance, drain traps, breaker resets) from high-voltage or refrigerant faults requiring certified technician escalation.
                  </p>
                </StaggerItem>
                <StaggerItem className="p-6 sm:p-8">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    04. Verified Technician Booking &amp; Quotes
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    Reserve conflict-free appointment slots with verified specialists, attach your diagnostic summary with explicit consent, compare itemized quotations, and track service completion end to end.
                  </p>
                </StaggerItem>
              </StaggerGroup>
            </div>
          </div>
        </section>

        {/* Section 3: Supported Appliances & Environments */}
        <section className="py-16 bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
              <div>
                <p className="text-xs font-semibold text-blue-600 mb-2">
                  Supported Categories
                </p>
                <h2 className="font-display text-3xl font-bold text-slate-900 tracking-tight">
                  Coverage Across Home &amp; Computing Devices
                </h2>
              </div>
              <Link
                to="/services"
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
              >
                View all {categories.length} categories
                <ArrowRight className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </Reveal>

            <StaggerGroup className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
              <StaggerItem hoverLift className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <ResilientImage
                  src="/src/assets/images/appliance_kitchen_suite_1795021204920.jpg"
                  alt="Modern refrigerator, washing machine, and microwave suite"
                  className="w-full aspect-[4/3] object-cover"
                  fallbackLabel="Major Home Appliances"
                />
                <div className="p-6 bg-white border-t border-slate-200">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    Major Kitchen, Laundry &amp; Climate Systems
                  </h3>
                  <p className="text-sm text-slate-600 mt-1.5">
                    Refrigerators, washing machines, air conditioners, and microwave ovens with strict high-voltage and refrigerant safety checks.
                  </p>
                </div>
              </StaggerItem>

              <StaggerItem hoverLift className="lg:col-span-6 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <ResilientImage
                  src="/src/assets/images/laptop_tv_diagnostics_1795021205410.jpg"
                  alt="Minimalist desk with aluminum laptop and flat-screen television"
                  className="w-full aspect-[4/3] object-cover"
                  fallbackLabel="Computing & Display Systems"
                />
                <div className="p-6 bg-white border-t border-slate-200">
                  <h3 className="font-display text-lg font-semibold text-slate-900">
                    Computing, Display &amp; Everyday Electronics
                  </h3>
                  <p className="text-sm text-slate-600 mt-1.5">
                    Laptop thermal/power faults, smart television backlight diagnostics, and general household electrical appliances.
                  </p>
                </div>
              </StaggerItem>
            </StaggerGroup>

            <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.slice(0, 4).map((cat) => (
                <StaggerItem key={cat.id} hoverLift>
                  <Link
                    to={`/diagnose?category=${cat.slug}`}
                    className="group block h-full p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-colors"
                  >
                    <p className="font-display text-base font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                      {cat.name}
                    </p>
                    <p className="text-xs text-slate-600 mt-1.5 line-clamp-2">
                      {cat.description}
                    </p>
                    <p className="text-xs font-medium text-blue-600 mt-3 inline-flex items-center gap-1">
                      Diagnose
                      <ArrowRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
                    </p>
                  </Link>
                </StaggerItem>
              ))}
            </StaggerGroup>
          </div>
        </section>

        {/* Section 4: Platform Trust & Instant Onboarding */}
        <section className="py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <Reveal>
              <div className="bg-slate-900 text-white rounded-2xl p-8 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-8">
                  <p className="text-xs font-semibold text-blue-400 mb-2">
                    Complete Repair &amp; Diagnostic Platform
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
                    From Symptom Intake to Verified On-Site Repair
                  </h2>
                  <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl">
                    FixMate AI unifies vision-enabled fault triage, real-time voice guidance, transparent hazard warnings, conflict-free appointment scheduling, itemized repair quotations, and verified specialist reviews in one platform.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-6 text-xs text-slate-300">
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-blue-400" />
                      Hybrid Rule &amp; Vision Engine
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-blue-400" />
                      Real-Time Live Voice
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-blue-400" />
                      Hard Safety Gating
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Wrench className="w-4 h-4 text-blue-400" />
                      Verified Technicians
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-blue-400" />
                      Itemized Quotations
                    </span>
                  </div>
                </div>
                <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3 lg:items-end">
                  <Link
                    to="/register"
                    className="px-5 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors text-center whitespace-nowrap"
                  >
                    Create Free Account
                  </Link>
                  <Link
                    to="/technicians"
                    className="px-5 py-3 text-sm font-semibold text-slate-200 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors text-center whitespace-nowrap"
                  >
                    Browse Verified Technicians
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
