import { motion } from "framer-motion";
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CheckCircle2,
  GraduationCap, LayoutDashboard, Sparkles, Star, Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import { SteveLogo } from "../components/branding/SteveLogo";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 22 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.52, delay, ease: [0.22, 1, 0.36, 1] }
});

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "AI Intelligent Tutor",
    desc: "Upload your syllabus once. STEVE auto-builds modules, pacing, flashcards, quizzes, and a capstone game tuned to your placement score."
  },
  {
    icon: GraduationCap,
    title: "AI Course Planner",
    desc: "Pick your Stevens Masters program. STEVE recommends 3–4 courses for your current semester, respecting credit limits and prerequisites."
  },
  {
    icon: LayoutDashboard,
    title: "Intelligent Profile",
    desc: "Set your career goals, background, and semester once. Every recommendation adapts automatically — no repetitive setup."
  },
  {
    icon: BarChart3,
    title: "Progress Analytics",
    desc: "Track streaks, completion rates, and overdue bundles across all your AI tutor tracks in one dashboard."
  },
  {
    icon: Sparkles,
    title: "Placement Quiz",
    desc: "STEVE drafts MCQs from your source material to calibrate difficulty — beginner, intermediate, or advanced."
  },
  {
    icon: BookOpen,
    title: "PPTX & PDF Export",
    desc: "Download slide decks, notes, and infographics from any module — ready to share or present."
  }
];

const STATS = [
  { value: "3 min", label: "to generate a full course" },
  { value: "30+", label: "Stevens courses in catalog" },
  { value: "9–12", label: "credits per semester (enforced)" },
  { value: "100%", label: "local — your data stays on-device" }
];

const HOW = [
  { step: "01", title: "Build your profile", desc: "Enter your program, semester, career interests, and background. STEVE uses this everywhere." },
  { step: "02", title: "Upload or paste", desc: "Drop a syllabus PDF or paste your notes into the AI Tutor. Deep text extraction happens automatically." },
  { step: "03", title: "Generate", desc: "STEVE builds a personalized course plan or tutor track in seconds — matched to your goals." },
  { step: "04", title: "Learn & adjust", desc: "Accept courses, complete lessons, track streaks, and regenerate anytime." }
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* ── Nav ───────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/">
            <SteveLogo variant="default" />
          </Link>
          <div className="hidden items-center gap-8 text-sm font-medium text-slate-600 sm:flex">
            <a href="#features" className="hover:text-slate-900 transition">Features</a>
            <a href="#how" className="hover:text-slate-900 transition">How it works</a>
            <a href="#stats" className="hover:text-slate-900 transition">Platform</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-semibold text-slate-700 hover:text-slate-900 transition">Sign in</Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-bold text-white hover:bg-[#0047B3] transition"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#1A1366]">
        {/* Animated background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <motion.div
            className="absolute -top-32 -left-32 h-[500px] w-[500px] rounded-full bg-[#0056D2]/40 blur-[120px]"
            animate={{ scale: [1, 1.15, 1], x: [0, 20, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/3 -right-24 h-[400px] w-[400px] rounded-full bg-purple-600/30 blur-[100px]"
            animate={{ scale: [1, 1.2, 1], y: [0, -20, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-cyan-500/20 blur-[80px]"
            animate={{ x: [0, 30, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 pb-0 pt-14 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center">

            {/* Logo — large, centered, glowing */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="absolute inset-0 -m-8 rounded-full bg-white/10 blur-2xl" />
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <SteveLogo variant="hero" className="relative mx-auto brightness-[5] drop-shadow-[0_0_32px_rgba(255,255,255,0.4)]" />
              </motion.div>
            </motion.div>

            {/* Category pills */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="mt-8 flex flex-wrap justify-center gap-2"
            >
              {[
                { label: "AI Tutor", color: "bg-blue-500/20 text-blue-200 border-blue-500/30" },
                { label: "Course Planner", color: "bg-purple-500/20 text-purple-200 border-purple-500/30" },
                { label: "Intelligent Profile", color: "bg-cyan-500/20 text-cyan-200 border-cyan-500/30" },
                { label: "Stevens Catalog", color: "bg-emerald-500/20 text-emerald-200 border-emerald-500/30" },
                { label: "Progress Analytics", color: "bg-amber-500/20 text-amber-200 border-amber-500/30" }
              ].map((p, i) => (
                <motion.span
                  key={p.label}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.18 + i * 0.06 }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.color}`}
                >
                  {p.label}
                </motion.span>
              ))}
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 max-w-4xl text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.75rem]"
            >
              Your AI Academic
              <span className="block bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, #60A5FA, #A78BFA, #38BDF8)" }}>
                Co-pilot at Stevens
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-blue-100"
            >
              STEVE combines an AI tutor, smart course planner, and personalized profile —
              all tuned to your Stevens program, semester, and career goals.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.45 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
            >
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-bold text-[#1A1366] transition hover:bg-blue-50"
              >
                Get started free <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                to="/app/dashboard"
                className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-7 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
              >
                View demo
              </Link>
            </motion.div>

            {/* Trust pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.48 }}
              className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-blue-200"
            >
              {["Free to use", "No credit card", "Local-first — your data stays on device"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />{t}
                </span>
              ))}
            </motion.div>

            {/* Hero UI mockup — floats at bottom of dark section */}
            <motion.div
              initial={{ opacity: 0, y: 48 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="mt-14 w-full max-w-5xl"
            >
              <div className="overflow-hidden rounded-t-2xl border border-white/10 bg-white/5 backdrop-blur-sm" style={{ boxShadow: "0 -8px 40px 0 rgba(96,165,250,0.15)" }}>
                {/* Window chrome */}
                <div className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  <div className="ml-3 rounded-md border border-white/10 bg-white/5 px-3 py-0.5 text-[11px] text-blue-200">
                    localhost:5173/app/dashboard
                  </div>
                </div>
                {/* Dashboard mock */}
                <div className="grid grid-cols-[180px_1fr] divide-x divide-white/10">
                  <div className="space-y-1 p-3">
                    {["Dashboard", "AI Tutor", "Course Planner", "My Profile", "Settings"].map((item, i) => (
                      <div key={item} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium ${i === 0 ? "bg-white/15 text-white" : "text-blue-200"}`}>
                        <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-blue-300" : "bg-white/20"}`} />
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="p-5">
                    <div className="mb-4 text-sm font-bold text-white">Good morning, Abhishek 👋</div>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[["Active courses", "3", "bg-blue-500/20"], ["Avg completion", "74%", "bg-purple-500/20"], ["Lessons done", "42/57", "bg-cyan-500/20"], ["Streak", "5 days", "bg-emerald-500/20"]].map(([k, v, bg]) => (
                        <div key={k} className={`rounded-xl border border-white/10 ${bg} p-3`}>
                          <div className="text-[9px] font-semibold uppercase tracking-wide text-blue-200">{k}</div>
                          <div className="mt-1 text-base font-bold text-white">{v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="mb-2 text-xs font-bold text-blue-200">MS Applied AI — Spring 2026</div>
                      <div className="space-y-1.5">
                        {[["AAI 595", "Applied Machine Learning", "Accepted"], ["EE 605", "Probability & Stochastic Processes", "Accepted"], ["AAI 646", "Pattern Recognition", "Pending"]].map(([code, name, status]) => (
                          <div key={code} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-xs">
                            <span className="font-bold text-blue-300 mr-2">{code}</span>
                            <span className="flex-1 text-white/80">{name}</span>
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${status === "Accepted" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>{status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Stats ─────────────────────────────────────────── */}
      <section id="stats" className="border-y border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="text-center"
              >
                <div className="text-3xl font-extrabold text-[#0056D2]">{s.value}</div>
                <div className="mt-1 text-sm text-slate-600">{s.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section id="features" className="bg-white py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-[#0056D2]">Everything you need</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              One platform. All your academic needs.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600">
              From uploading a syllabus to planning your full semester — STEVE handles it in minutes, not hours.
            </p>
          </motion.div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                whileHover={{ y: -4, transition: { duration: 0.15 } }}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2F7FF]">
                  <f.icon className="h-6 w-6 text-[#0056D2]" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────── */}
      <section id="how" className="bg-[#F8FAFC] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} className="text-center"
          >
            <div className="text-xs font-bold uppercase tracking-widest text-[#0056D2]">How it works</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Up and running in 4 steps
            </h2>
          </motion.div>

          <div className="relative mt-14">
            {/* Connecting line */}
            <div className="absolute left-6 top-8 hidden h-[calc(100%-4rem)] w-px bg-slate-200 lg:left-1/2 lg:block" />

            <div className="space-y-8 lg:space-y-0">
              {HOW.map((h, i) => (
                <motion.div
                  key={h.step}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -24 : 24 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`relative flex items-start gap-5 lg:w-5/12 ${i % 2 === 0 ? "lg:ml-0" : "lg:ml-auto"} lg:mb-12`}
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#0056D2] text-sm font-extrabold text-white">
                    {h.step}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{h.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{h.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonial / trust strip ─────────────────────── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-[#0056D2]/15 bg-[#F2F7FF] p-8 text-center">
            <div className="flex justify-center gap-0.5 mb-4">
              {Array.from({length: 5}).map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <blockquote className="mx-auto max-w-2xl text-lg font-medium leading-relaxed text-slate-800">
              "STEVE helped me plan my Spring 2026 semester in under 5 minutes — it knew my program requirements and auto-filled everything from my profile. Way better than manually checking the Stevens catalog."
            </blockquote>
            <div className="mt-4 text-sm font-semibold text-slate-600">
              MS Applied AI student · Stevens Institute of Technology
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────── */}
      <section className="bg-[#0056D2] py-20">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <motion.h2
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-extrabold text-white sm:text-4xl"
          >
            Ready to plan your semester smarter?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.08 }}
            className="mx-auto mt-4 max-w-xl text-base text-blue-100"
          >
            Get your AI course plan and tutor tracks in minutes. Free, local-first, and built specifically for Stevens grad students.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ delay: 0.14 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-bold text-[#0056D2] hover:bg-blue-50 transition"
            >
              Get started free <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              to="/app/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/40 px-6 py-3 text-base font-semibold text-white hover:bg-white/10 transition"
            >
              Explore demo
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SteveLogo variant="default" />
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500">
              <Link to="/login" className="hover:text-slate-900 transition">Sign in</Link>
              <Link to="/app/dashboard" className="hover:text-slate-900 transition">Dashboard</Link>
              <Link to="/app/courses/new" className="hover:text-slate-900 transition">AI Tutor</Link>
              <Link to="/app/academic" className="hover:text-slate-900 transition">Course Planner</Link>
            </div>
            <div className="text-xs text-slate-400">STEVE — Education Intelligence Platform · Stevens Institute of Technology</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
