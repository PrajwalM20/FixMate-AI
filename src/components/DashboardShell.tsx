import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  Cpu,
  LayoutDashboard,
  LogOut,
  Search,
  ShieldCheck,
  UserCog,
  Wrench,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAuth } from '../context/AuthContext.tsx';
import { EASE_OUT_EXPO } from './MotionPrimitives.tsx';
import {
  markAllNotificationsRead,
  markNotificationRead,
  subscribeUserNotifications,
} from '../services/firestoreService.ts';
import type { NotificationRecord } from '../types/domain.ts';

interface DashboardShellProps {
  title: string;
  breadcrumb: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardShell({
  title,
  breadcrumb,
  action,
  children,
}: DashboardShellProps) {
  const { firebaseUser, profile, isSuspended, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);

  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unsub = subscribeUserNotifications(firebaseUser.uid, setNotifications);
    return () => unsub();
  }, [firebaseUser]);

  const unreadNotifications = notifications.filter((n) => !n.read);
  const unreadCount = unreadNotifications.length;

  const navItems = [
    ...(profile?.role === 'customer'
      ? [
          { label: 'Customer Overview', to: '/dashboard', icon: LayoutDashboard },
          { label: 'AI Diagnosis', to: '/diagnose', icon: Cpu },
          { label: 'Find Technicians', to: '/technicians', icon: Search },
        ]
      : []),
    ...(profile?.role === 'technician'
      ? [
          { label: 'Technician Workbench', to: '/technician', icon: Wrench },
          { label: 'AI Knowledge Preview', to: '/diagnose', icon: Cpu },
        ]
      : []),
    ...(profile?.role === 'admin'
      ? [
          { label: 'Admin Console', to: '/admin', icon: ShieldCheck },
          { label: 'Technician Directory', to: '/technicians', icon: Search },
          { label: 'AI Diagnosis', to: '/diagnose', icon: Cpu },
        ]
      : []),
    { label: 'Profile & Settings', to: '/profile', icon: UserCog },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleNotificationClick = async (n: NotificationRecord) => {
    if (!n.read) {
      await markNotificationRead(n.id);
    }
    if (n.linkPath) {
      setNotifOpen(false);
      navigate(n.linkPath);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Workspace Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              to="/"
              className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
            >
              FixMate AI
            </Link>
            <span className="hidden sm:inline text-slate-300">/</span>
            <span className="hidden sm:inline text-sm text-slate-600 truncate">
              {breadcrumb}
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            <button
              type="button"
              onClick={() => setNotifOpen((prev) => !prev)}
              aria-label="Open notifications"
              className="relative p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg bg-white transition-colors inline-flex items-center"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="ml-1.5 text-xs font-mono font-semibold text-blue-600 tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {action}

            <AnimatePresence>
              {notifOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                  className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-4 z-50"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <span className="text-sm font-semibold text-slate-900">
                      Notifications ({unreadCount} unread)
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            void markAllNotificationsRead(unreadNotifications.map((n) => n.id))
                          }
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      No notifications yet.
                    </p>
                  ) : (
                    <ul className="space-y-2 max-h-72 overflow-y-auto">
                      {notifications.slice(0, 12).map((n) => (
                        <li
                          key={n.id}
                          className={`p-2.5 rounded-lg border text-xs ${
                            n.read
                              ? 'bg-white border-slate-100 text-slate-600'
                              : 'bg-blue-50/50 border-blue-200 text-slate-900'
                          }`}
                        >
                          <p className="font-semibold">{n.title}</p>
                          <p className="mt-0.5 text-slate-600">{n.message}</p>
                          <div className="mt-1.5 flex items-center gap-3">
                            {n.linkPath && (
                              <button
                                type="button"
                                onClick={() => void handleNotificationClick(n)}
                                className="text-blue-600 hover:underline font-medium"
                              >
                                Open
                              </button>
                            )}
                            {!n.read && (
                              <button
                                type="button"
                                onClick={() => void markNotificationRead(n.id)}
                                className="text-slate-600 hover:text-slate-900 hover:underline font-medium"
                              >
                                Mark read
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Sidebar + Main Viewport */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-64 shrink-0">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-6">
            <div className="pb-4 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {profile?.displayName || firebaseUser?.email}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 capitalize">
                {profile?.role || 'customer'} account
              </p>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-100 space-y-1">
              <Link
                to="/services"
                className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Supported Appliances
              </Link>
              <Link
                to="/contact"
                className="block px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Help & Support
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        <motion.main
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: EASE_OUT_EXPO }}
          className="flex-1 min-w-0"
        >
          {isSuspended && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-300 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
              <div className="text-xs text-red-900">
                <p className="font-semibold">Account Suspended by Platform Administration</p>
                <p className="mt-1 leading-relaxed">
                  Marketplace actions (creating bookings, submitting quotations, or editing service
                  profiles) are disabled while your account is suspended. Please contact support for
                  review.
                </p>
              </div>
            </div>
          )}

          <div className="mb-6">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {title}
            </h1>
          </div>
          {children}
        </motion.main>
      </div>
    </div>
  );
}
