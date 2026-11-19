import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';
import { ContactHelpPage } from './pages/ContactHelpPage.tsx';
import { CustomerDashboard } from './pages/CustomerDashboard.tsx';
import { DiagnosisWorkspacePage } from './pages/DiagnosisWorkspacePage.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { ServicesPage } from './pages/ServicesPage.tsx';
import { TechnicianDashboard } from './pages/TechnicianDashboard.tsx';
import { TechnicianDiscoveryPage } from './pages/TechnicianDiscoveryPage.tsx';

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Pages */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/about" element={<Navigate to="/" replace />} />
              <Route path="/services" element={<ServicesPage />} />
              <Route path="/technicians" element={<TechnicianDiscoveryPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/contact" element={<ContactHelpPage />} />
              <Route path="/diagnose" element={<DiagnosisWorkspacePage />} />

              {/* Role-Protected Portals */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['customer', 'admin']}>
                    <CustomerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/technician"
                element={
                  <ProtectedRoute allowedRoles={['technician', 'admin']}>
                    <TechnicianDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileSettingsPage />
                  </ProtectedRoute>
                }
              />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
