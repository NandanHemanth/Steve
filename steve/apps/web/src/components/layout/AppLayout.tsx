import { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, GraduationCap, LayoutDashboard, LogOut, Settings, User, X, Target } from "lucide-react";
import { useAuth } from "../auth/useAuth";
import { SteveLogo } from "../branding/SteveLogo";

const NAV_ITEMS = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/courses/new", icon: BookOpen, label: "AI Tutor" },
  { to: "/app/academic", icon: GraduationCap, label: "Course Planner" },
  { to: "/app/career-fit", icon: Target, label: "Career Fit" },
  { to: "/app/profile", icon: User, label: "My Profile" },
  { to: "/app/settings", icon: Settings, label: "Settings" }
] as const;

const CLOSE_MS = 300;
const SIDEBAR_W = 260;

export function AppLayout() {
  const { user, signOutAll } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  }, []);
  const openSidebar = useCallback(() => { clearTimer(); setOpen(true); }, [clearTimer]);
  const scheduledClose = useCallback(() => { clearTimer(); closeTimer.current = setTimeout(() => setOpen(false), CLOSE_MS); }, [clearTimer]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <div className="min-h-screen bg-[#f4f6fb] text-slate-900">
      {/* Top header — Coursera-style: white, slim, app name center or left */}
      <motion.header
        initial={false}
        className="fixed left-0 right-0 top-0 z-[180] flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6"
        style={{ boxShadow: "0 1px 0 0 #e2e8f0" }}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen((o) => !o)}
            onMouseEnter={openSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0056D2]/30"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <Link to="/app/dashboard" className="block focus:outline-none" onClick={() => setOpen(false)}>
            <SteveLogo variant="compact" />
          </Link>
        </div>

        {/* Center quick-access pill nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.slice(0, 4).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
                  isActive
                    ? "bg-[#F2F7FF] font-semibold text-[#0056D2]"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden max-w-[200px] truncate text-right text-xs text-slate-500 sm:block">{user?.email}</div>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0056D2] text-xs font-bold text-white">
            {user?.email?.[0]?.toUpperCase() ?? "S"}
          </div>
        </div>
      </motion.header>

      {/* Invisible hover zone when closed */}
      {!open && (
        <div className="fixed bottom-0 left-0 top-14 z-[170] w-3" onMouseEnter={openSidebar} />
      )}

      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[155] bg-slate-900/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
            onMouseEnter={scheduledClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar panel */}
      <AnimatePresence>
        {open && (
          <motion.aside
            key="sidebar"
            initial={{ x: -SIDEBAR_W }}
            animate={{ x: 0 }}
            exit={{ x: -SIDEBAR_W }}
            transition={{ type: "spring", stiffness: 340, damping: 36 }}
            style={{ width: SIDEBAR_W }}
            className="fixed bottom-0 left-0 top-14 z-[160] flex flex-col overflow-y-auto border-r border-slate-200 bg-white"
            onMouseEnter={openSidebar}
            onMouseLeave={scheduledClose}
          >
            {/* User block */}
            <div className="border-b border-slate-100 px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0056D2] text-sm font-bold text-white">
                    {user?.email?.[0]?.toUpperCase() ?? "S"}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">Student</div>
                    <div className="truncate text-xs text-slate-500">{user?.email}</div>
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4">
              <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Navigation</div>
              <ul className="space-y-0.5">
                {NAV_ITEMS.map(({ to, icon: Icon, label }, i) => (
                  <motion.li
                    key={to}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 + i * 0.04, duration: 0.25 }}
                  >
                    <NavLink
                      to={to}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                          isActive
                            ? "bg-[#F2F7FF] font-semibold text-[#0056D2]"
                            : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition ${isActive ? "bg-[#0056D2] text-white" : "bg-slate-100 text-slate-600 group-hover:bg-slate-200"}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          {label}
                          {isActive && (
                            <motion.span layoutId="sidebar-active-dot" className="ml-auto h-1.5 w-1.5 rounded-full bg-[#0056D2]" />
                          )}
                        </>
                      )}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </nav>

            {/* Footer */}
            <div className="border-t border-slate-100 px-3 py-3">
              <div className="mb-2 rounded-xl bg-[#F2F7FF] px-3 py-2.5">
                <div className="text-[11px] font-semibold text-[#0056D2]">STEVE Platform</div>
                <div className="mt-0.5 text-[10px] leading-relaxed text-slate-500">AI tutor · planner · profile</div>
              </div>
              <button
                onClick={async () => { await signOutAll(); nav("/"); }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-700"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100">
                  <LogOut className="h-4 w-4" />
                </span>
                Sign out
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="pt-14">
        <motion.div
          key="page-content"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
        >
          <div className="min-h-[calc(100dvh-3.5rem-3rem)] w-full min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-7">
            <Outlet />
          </div>
        </motion.div>
      </main>
    </div>
  );
}

