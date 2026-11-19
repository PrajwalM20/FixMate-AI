import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Search } from 'lucide-react';
import { Footer } from '../components/Footer.tsx';
import { Reveal, StaggerGroup, StaggerItem } from '../components/MotionPrimitives.tsx';
import { Navbar } from '../components/Navbar.tsx';
import { RiskIndicator } from '../components/StatusLabel.tsx';
import { fetchApplianceCategories, fetchKnowledgeBase } from '../services/firestoreService.ts';
import type { ApplianceCategory, ApplianceSlug, KnowledgeBaseEntry } from '../types/domain.ts';

export function ServicesPage() {
  const [categories, setCategories] = useState<ApplianceCategory[]>([]);
  const [entries, setEntries] = useState<KnowledgeBaseEntry[]>([]);
  const [fromFirestore, setFromFirestore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'all' | ApplianceSlug>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([fetchApplianceCategories(), fetchKnowledgeBase()])
      .then(([catRes, kbRes]) => {
        if (!active) return;
        setCategories(catRes.items);
        setEntries(kbRes.items);
        setFromFirestore(catRes.fromFirestore && kbRes.fromFirestore);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load catalog');
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return entries.filter((item) => {
      const catMatch = selectedCategory === 'all' || item.applianceCategory === selectedCategory;
      if (!catMatch) return false;
      if (!q) return true;
      return (
        item.faultTitle.toLowerCase().includes(q) ||
        item.observableSymptoms.some((s) => s.toLowerCase().includes(q)) ||
        item.possibleCauses.some((c) => c.toLowerCase().includes(q))
      );
    });
  }, [entries, selectedCategory, searchTerm]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-8 border-b border-slate-200">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-blue-600 mb-2">
              Services & Supported Appliances
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
              Appliance Catalog & Fault Knowledge Base
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600">
              Browse supported household and electronic appliance categories, safety notices, and structured fault frames.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Catalog source:{' '}
              {fromFirestore
                ? 'Live Cloud Knowledge Base'
                : 'Verified Standard Knowledge Base'}
            </p>
          </div>
          <Link
            to="/diagnose"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Start Custom Diagnosis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Appliance Categories Grid */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            Supported Categories
          </h2>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-36 bg-white border border-slate-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <StaggerItem
                  key={cat.id}
                  hoverLift
                  className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-slate-900">
                        {cat.name}
                      </h3>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        {cat.commonFaultsCount} faults
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed">
                      {cat.description}
                    </p>
                    <p className="mt-3 text-xs text-amber-800 bg-amber-50/70 border border-amber-200/80 rounded-lg p-2.5">
                      {cat.safetyNotice}
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory(cat.slug)}
                      className="text-xs font-semibold text-slate-700 hover:text-blue-600"
                    >
                      Filter KB
                    </button>
                    <Link
                      to={`/diagnose?category=${cat.slug}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 inline-flex items-center gap-1"
                    >
                      Diagnose
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </StaggerItem>
              ))}
            </StaggerGroup>
          )}
        </section>

        {/* Knowledge Base Filter & Entries */}
        <section className="mt-12">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-xl font-bold text-slate-900">
                Knowledge Base Fault Frames
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {filteredEntries.length} of {entries.length} structured fault frames
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search symptoms or causes..."
                  className="pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 w-full sm:w-64"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value as 'all' | ApplianceSlug)}
                aria-label="Filter by appliance category"
                className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredEntries.length === 0 && !loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
              <p className="text-sm font-medium text-slate-900">No matching fault frames found</p>
              <p className="text-xs text-slate-500 mt-1">
                Try clearing your search filter or launch a custom diagnosis in the AI Workspace.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('all');
                  setSearchTerm('');
                }}
                className="mt-4 px-4 py-2 text-xs font-semibold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <Reveal className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredEntries.map((entry) => (
                <article
                  key={entry.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 transition-colors rounded-xl p-6 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-700 capitalize">
                          {entry.applianceCategory.replace(/_/g, ' ')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.isSampleData ? 'Standard Frame' : 'Cloud KB'}</span>
                      </div>
                      <RiskIndicator level={entry.riskLevel} />
                    </div>

                    <h3 className="font-display text-lg font-bold text-slate-900 mt-2">
                      {entry.faultTitle}
                    </h3>

                    <div className="mt-4 space-y-3 text-xs">
                      <div>
                        <p className="font-semibold text-slate-700 mb-1">Observable Symptoms</p>
                        <p className="text-slate-600">
                          {entry.observableSymptoms.join(' · ')}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 mb-1">Possible Causes</p>
                        <ul className="list-disc pl-4 text-slate-600 space-y-0.5">
                          {entry.possibleCauses.map((cause) => (
                            <li key={cause}>{cause}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-700 mb-1">Safe Troubleshooting Steps</p>
                        <ol className="list-decimal pl-4 text-slate-600 space-y-1">
                          {entry.safeTroubleshootingSteps.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700">
                      {entry.requiresProfessional ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Professional Inspection Recommended
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Safe DIY Checks Available
                        </>
                      )}
                    </span>

                    <Link
                      to={`/diagnose?category=${entry.applianceCategory}&sampleId=${encodeURIComponent(entry.id)}`}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0"
                    >
                      Run in Workspace
                    </Link>
                  </div>
                </article>
              ))}
            </Reveal>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
