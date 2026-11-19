import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <p className="font-display text-lg font-bold text-slate-900">FixMate AI</p>
            <p className="text-sm text-slate-600 mt-2 max-w-md leading-relaxed">
              Diagnose Smarter. Repair Better. Structured appliance troubleshooting, safety-first guidance, and verified technician dispatch.
            </p>
            <p className="text-xs text-slate-500 mt-4">
              Hybrid AI Diagnostics · Safety-First Home Appliance Troubleshooting &amp; Repair
            </p>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900 mb-3">Platform</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link to="/services" className="hover:text-blue-600 transition-colors">
                  Supported Appliances
                </Link>
              </li>
              <li>
                <Link to="/diagnose" className="hover:text-blue-600 transition-colors">
                  AI Diagnosis Workspace
                </Link>
              </li>
              <li>
                <Link to="/technicians" className="hover:text-blue-600 transition-colors">
                  Find Verified Technicians
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-blue-600 transition-colors">
                  Contact & Help
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-900 mb-3">Access</p>
            <ul className="space-y-2 text-sm text-slate-600">
              <li>
                <Link to="/login" className="hover:text-blue-600 transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-blue-600 transition-colors">
                  Create Account
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-blue-600 transition-colors">
                  Customer Portal
                </Link>
              </li>
              <li>
                <Link to="/technician" className="hover:text-blue-600 transition-colors">
                  Technician Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} FixMate AI. Hybrid AI Troubleshooting & Repair Marketplace.</p>
          <p>Built for structured fault diagnosis and safe homeowner repair workflows.</p>
        </div>
      </div>
    </footer>
  );
}
