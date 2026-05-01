import { signInWithPopup } from "firebase/auth";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, BrainCircuit, GraduationCap, Sparkles } from "lucide-react";
import { useAuth } from "../components/auth/useAuth";
import { SteveLogo } from "../components/branding/SteveLogo";
import { auth, firebaseReady, googleProvider } from "../lib/firebase";

const FEATURES = [
  { icon: BrainCircuit, label: "AI Intelligent Tutor" },
  { icon: GraduationCap, label: "AI Course Planner" },
  { icon: BookOpen, label: "Stevens Catalog" },
  { icon: Sparkles, label: "Personalized Profile" }
];

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

export function LoginPage() {
  const { user, signInDemo } = useAuth();
  const nav = useNavigate();
  const [demoUser, setDemoUser] = useState("Steve123");
  const [demoPass, setDemoPass] = useState("steve@2026");
  const [demoError, setDemoError] = useState<string | null>(null);
  const [showDemo, setShowDemo] = useState(false);

  if (user) {
    queueMicrotask(() => nav("/app/dashboard"));
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel (dark, branded) ── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#1A1366] px-10 py-10 lg:flex lg:w-[45%]">
        {/* Background orbs */}
        <div className="pointer-events-none absolute inset-0">
          <motion.div
            className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-blue-500/30 blur-[80px]"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <motion.div
            className="absolute bottom-16 right-0 h-56 w-56 rounded-full bg-purple-600/25 blur-[70px]"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 10, repeat: Infinity }}
          />
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "40px 40px" }} />
        </div>

        {/* Logo */}
        <div className="relative">
          <Link to="/">
            <SteveLogo variant="default" className="brightness-[10] opacity-90" />
          </Link>
        </div>

        {/* Center content */}
        <div className="relative">
          <motion.h2
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="text-3xl font-extrabold leading-snug text-white"
          >
            Your AI academic<br />co-pilot at Stevens
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-4 text-base leading-relaxed text-blue-200"
          >
            Plan your semester, generate tutor tracks from your syllabus, and track progress — all in one place.
          </motion.p>

          <div className="mt-8 space-y-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.label}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.08 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-blue-300" />
                </div>
                <span className="text-sm font-medium text-blue-100">{f.label}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative text-xs text-blue-300">
          Stevens Institute of Technology · Education Intelligence Platform
        </div>
      </div>

      {/* ── Right panel (light, form) ── */}
      <div className="flex flex-1 flex-col items-center justify-center bg-[#F8FAFC] px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 lg:hidden">
          <SteveLogo variant="default" className="mx-auto" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-[400px]"
        >
          <div className="text-center">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Welcome back</h1>
            <p className="mt-1.5 text-sm text-slate-500">Sign in to continue to STEVE</p>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Google */}
            <div className="p-6">
              <button
                disabled={!firebaseReady}
                onClick={async () => {
                  if (!auth || !googleProvider) return;
                  await signInWithPopup(auth, googleProvider);
                  nav("/app/dashboard");
                }}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <GoogleIcon />
                Continue with Google
              </button>
              {!firebaseReady && (
                <p className="mt-2 text-center text-xs text-amber-700">
                  Firebase not configured — use Demo login below.
                </p>
              )}

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-xs font-medium text-slate-400">or</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              {/* Demo login toggle */}
              {!showDemo ? (
                <button
                  type="button"
                  onClick={() => setShowDemo(true)}
                  className="w-full rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-[#0056D2] hover:text-[#0056D2]"
                >
                  Use Demo Login (hackathon)
                </button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="space-y-3"
                >
                  <div className="rounded-xl border border-[#0056D2]/20 bg-[#F2F7FF] px-3 py-2 text-xs text-[#0056D2]">
                    <span className="font-bold">Demo credentials:</span> Steve123 / steve@2026
                  </div>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-600">Username</span>
                    <input
                      value={demoUser}
                      onChange={(e) => setDemoUser(e.target.value)}
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                    />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-slate-600">Password</span>
                    <input
                      value={demoPass}
                      onChange={(e) => setDemoPass(e.target.value)}
                      type="password"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
                    />
                  </label>
                  {demoError && <p className="text-xs text-red-600">{demoError}</p>}
                  <button
                    type="button"
                    onClick={() => {
                      setDemoError(null);
                      const ok = signInDemo(demoUser.trim(), demoPass);
                      if (!ok) { setDemoError("Invalid demo credentials."); return; }
                      nav("/app/dashboard");
                    }}
                    className="w-full rounded-xl bg-[#0056D2] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#0047B3]"
                  >
                    Sign in with Demo
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDemo(false)}
                    className="flex w-full items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back
                  </button>
                </motion.div>
              )}
            </div>

            {/* Footer note */}
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 text-center text-xs text-slate-500">
              Your profile data is stored locally in your browser.
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <Link to="/" className="font-semibold text-[#0056D2] hover:underline">Learn about STEVE</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
