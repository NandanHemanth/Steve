import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { chatText as groqChat } from "../lib/groqClient";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, GraduationCap, LayoutList, MessageSquare, Sparkles } from "lucide-react";
import { loadJson, saveJson, storageKeys } from "../lib/storage";
import { useProfile } from "../lib/useProfile";
import { IntelligentProfilePanel } from "../components/planner/IntelligentProfilePanel";
import { SmartRecommender, type RecommendedCourse } from "../components/planner/SmartRecommender";
import { MyCoursePlan } from "../components/planner/MyCoursePlan";
import { RequirementValidator } from "../components/planner/RequirementValidator";
import { ALL_PROGRAMS, getCourseById } from "../data/stevensData";

type Tab = "recommend" | "plan" | "validate" | "advisor";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "recommend", label: "Smart Recommender", icon: Sparkles },
  { id: "plan", label: "My Course Plan", icon: LayoutList },
  { id: "validate", label: "Requirement Validator", icon: GraduationCap },
  { id: "advisor", label: "AI Advisor", icon: MessageSquare }
];

function AcademicAdvisorChat({ profile }: { profile: StudentProfile }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!draft.trim()) return;
    const msg = draft.trim();
    setDraft("");
    setMessages((prev) => [...prev, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const sys = `You are STEVE, an intelligent academic advisor for graduate students at Stevens Institute of Technology. Student profile: ${JSON.stringify(profile)}. Answer concisely, specifically, and reference real Stevens courses when relevant.`;
      const text = await groqChat(sys, msg);
      setMessages((prev) => [...prev, { role: "assistant", text }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[60vh] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">AI Academic Advisor</div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">Ask STEVE anything: course selection, prerequisites, career paths, credit planning…</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-[#0056D2] text-white"
                  : "border border-slate-200 bg-slate-50 text-slate-900"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-500">
              <span className="inline-flex gap-1">
                <span className="animate-bounce">.</span><span className="animate-bounce [animation-delay:0.15s]">.</span><span className="animate-bounce [animation-delay:0.3s]">.</span>
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="flex gap-2 border-t border-slate-100 p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask a question…"
          className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#0056D2]/25"
        />
        <button
          type="button"
          onClick={send}
          disabled={loading || !draft.trim()}
          className="rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A5BD8] disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export function AcademicHubPage() {
  const [tab, setTab] = useState<Tab>("recommend");

  const { profile, updateProfile, setProfile } = useProfile();

  const [activeProgramKey, setActiveProgramKey] = useState<string>(
    () => {
      if (profile.programName) {
        const m = ALL_PROGRAMS.find((p) => p.label.toLowerCase().includes(profile.programName!.toLowerCase()));
        if (m) return m.key;
      }
      return ALL_PROGRAMS[0]?.key ?? "";
    }
  );

  const [plan, setPlan] = useState<RecommendedCourse[]>(() => {
    const saved = loadJson<RecommendedCourse[]>(storageKeys.aiCoursePlan, []);
    return Array.isArray(saved) ? saved : [];
  });
  const [accepted, setAccepted] = useState<Set<string>>(new Set(plan.map((r) => r.courseId)));
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const savePlan = (next: RecommendedCourse[]) => {
    setPlan(next);
    saveJson(storageKeys.aiCoursePlan, next);
  };

  const accept = useCallback((rec: RecommendedCourse) => {
    // Check if adding this course exceeds the 4-course or 12-credit limit
    const program = ALL_PROGRAMS.find(p => p.key === activeProgramKey);
    const newCourse = program?.courses.find(c => c.id === rec.courseId);
    const newCredits = newCourse?.credits ?? 3;
    
    const currentCredits = plan.reduce((sum, r) => {
      const c = program?.courses.find(x => x.id === r.courseId);
      return sum + (c?.credits ?? 3);
    }, 0);

    if (plan.length >= 4) {
      alert("Plan limit reached: You can accept a maximum of 4 courses per semester.");
      return;
    }
    if (currentCredits + newCredits > 12) {
      alert(`Credit limit reached: Adding this course would exceed the 12-credit maximum (Total: ${currentCredits + newCredits} cr).`);
      return;
    }

    const currentPlan = plan.filter((r) => r.courseId !== rec.courseId);
    setAccepted((prev) => new Set([...prev, rec.courseId]));
    setRejected((prev) => { const n = new Set(prev); n.delete(rec.courseId); return n; });
    savePlan([...currentPlan, rec]);
  }, [plan, activeProgramKey]);

  const reject = useCallback((courseId: string) => {
    setRejected((prev) => new Set([...prev, courseId]));
    setAccepted((prev) => { const n = new Set(prev); n.delete(courseId); return n; });
    savePlan(plan.filter((r) => r.courseId !== courseId));
  }, [plan]);

  const removeFromPlan = useCallback((courseId: string) => {
    setAccepted((prev) => { const n = new Set(prev); n.delete(courseId); return n; });
    savePlan(plan.filter((r) => r.courseId !== courseId));
  }, [plan]);

  const addToPlan = useCallback((courseId: string) => {
    if (accepted.has(courseId)) return;
    
    const program = ALL_PROGRAMS.find(p => p.key === activeProgramKey);
    const catalog = getCourseById(activeProgramKey, courseId);
    const newCredits = catalog?.credits ?? 3;
    
    const currentCredits = plan.reduce((sum, r) => {
      const c = program?.courses.find(x => x.id === r.courseId);
      return sum + (c?.credits ?? 3);
    }, 0);

    if (plan.length >= 4) {
      alert("Plan limit reached: You can accept a maximum of 4 courses per semester.");
      return;
    }
    if (currentCredits + newCredits > 12) {
      alert(`Credit limit reached: Adding this course would exceed the 12-credit maximum.`);
      return;
    }

    const rec: RecommendedCourse = {
      courseId,
      reason: "Added manually from Requirement Validator.",
      semester: profile.currentSemester || "Fall 2026",
      category: catalog?.poolKey?.includes("core") ? "Core" : "Elective",
      bucketKey: catalog?.poolKey
    };
    setAccepted((prev) => new Set([...prev, courseId]));
    savePlan([...plan, rec]);
    setTab("plan");
  }, [accepted, plan, activeProgramKey, profile.currentSemester]);

  return (
    <div className="min-h-full">
      {/* Breadcrumb */}
      <div className="text-sm text-slate-600">
        <Link to="/app/dashboard" className="text-[#0056D2] hover:underline">Dashboard</Link>
        {" / "}
        <span className="font-medium text-slate-800">AI Course Planner</span>
      </div>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            <GraduationCap className="h-3.5 w-3.5 text-[#0056D2]" aria-hidden />
            AI Course Planner
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Intelligent Course Planner</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-700">
            Get a personalized, constraint-aware course plan based on your career goals, background, and program requirements.
          </p>
        </div>
        <Link
          to="/app/courses/new"
          className="inline-flex items-center gap-2 rounded-xl bg-[#0056D2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A5BD8]"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          New AI course
        </Link>
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Intelligent Profile Panel */}
        <IntelligentProfilePanel profile={profile} onChange={updateProfile} />

        {/* Main planner area */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className="relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition"
              >
                {tab === id && (
                  <motion.span
                    layoutId="active-tab"
                    className="absolute inset-0 rounded-xl bg-white shadow-sm"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                  />
                )}
                <span className={`relative flex items-center gap-2 ${tab === id ? "text-[#0056D2]" : "text-slate-600 hover:text-slate-900"}`}>
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Tab content with slide animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              {tab === "recommend" && (
                <SmartRecommender
                  profile={profile}
                  onAccept={(rec) => { setActiveProgramKey((prev) => prev); accept(rec); }}
                  onReject={reject}
                  accepted={accepted}
                  rejected={rejected}
                />
              )}
              {tab === "plan" && (
                <MyCoursePlan
                  plan={plan}
                  profile={profile}
                  onRemove={removeFromPlan}
                  onRegenerate={() => setTab("recommend")}
                  programKey={activeProgramKey}
                />
              )}
              {tab === "validate" && (
                <RequirementValidator
                  plan={plan}
                  profile={profile}
                  onAddToPlan={addToPlan}
                  programKey={activeProgramKey}
                />
              )}
              {tab === "advisor" && (
                <AcademicAdvisorChat profile={profile} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
