import { motion } from "framer-motion";
import {
  ArrowRight, BarChart3, BookOpen, BrainCircuit, CheckCircle2,
  GraduationCap, LayoutDashboard, Sparkles, Star, Target, Eye, ShieldCheck, Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import { SteveLogo } from "../components/branding/SteveLogo";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }
});

const FEATURES = [
  {
    icon: BrainCircuit,
    title: "AI Intelligent Tutor",
    desc: "Transform any syllabus into a full interactive course. STEVE builds modules, pacing, flashcards, and quizzes tuned to your unique learning style.",
    color: "bg-blue-500"
  },
  {
    icon: Target,
    title: "Career Fit & Bridge",
    desc: "Compare your resume against any Job Description. Identify critical skill gaps and instantly generate 'Bridge Courses' to master them.",
    color: "bg-indigo-500"
  },
  {
    icon: Eye,
    title: "Adaptive Accessibility",
    desc: "CV-powered analytics track your focus, stress, and engagement. Get real-time feedback to optimize your study sessions and well-being.",
    color: "bg-emerald-500"
  },
  {
    icon: GraduationCap,
    title: "Stevens Smart Planner",
    desc: "Navigate your Master's program with ease. STEVE handles prerequisites, credit limits, and course recommendations automatically.",
    color: "bg-purple-500"
  },
  {
    icon: LayoutDashboard,
    title: "Intelligent Profile",
    desc: "Set your career goals and background once. The entire platform adapts its recommendations and course difficulty to match your trajectory.",
    color: "bg-cyan-500"
  },
  {
    icon: ShieldCheck,
    title: "Local-First Privacy",
    desc: "Your data stays on your device. We use cutting-edge local processing to ensure your learning journey remains private and secure.",
    color: "bg-rose-500"
  }
];

const STATS = [
  { value: "95%", label: "Accuracy in Skill Gap Detection" },
  { value: "30+", label: "Integrated Stevens Programs" },
  { value: "5s", label: "To Generate a Custom Lesson" },
  { value: "100%", label: "Privacy-Focused & Local" }
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* ── Nav ── */}
      <nav className="fixed top-0 z-[100] w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-xl transition-all duration-300">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="hover:opacity-90 transition-opacity">
            <SteveLogo variant="default" />
          </Link>
          <div className="hidden items-center gap-10 text-sm font-semibold text-slate-600 lg:flex">
            {["Features", "Career Intelligence", "Accessibility", "Stevens Hub"].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="hover:text-[#0056D2] transition-colors relative group">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#0056D2] transition-all group-hover:w-full" />
              </a>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hidden sm:block text-sm font-bold text-slate-700 hover:text-slate-900 transition">Sign in</Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-[#0056D2] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#0047B3] shadow-lg shadow-blue-500/25 transition-all hover:scale-105 active:scale-95"
            >
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero Section ── */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Abstract background elements */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full opacity-30">
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-blue-400/20 blur-[120px] animate-pulse" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
          </div>
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <div className="text-left order-2 lg:order-1">
              <motion.div
                {...fadeUp(0)}
                className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/50 px-4 py-1.5 text-xs font-bold text-[#0056D2] uppercase tracking-wider mb-8"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Revolutionizing Student Success
              </motion.div>
              
              <motion.h1 
                {...fadeUp(0.1)}
                className="text-5xl font-[900] tracking-tight text-slate-900 sm:text-7xl lg:text-[5.5rem] leading-[1.05]"
              >
                The AI Operating System <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#0056D2] via-[#4F46E5] to-[#8B5CF6]">
                  for Every Stevens Student.
                </span>
              </motion.h1>
              
              <motion.p 
                {...fadeUp(0.2)}
                className="mt-8 max-w-2xl text-xl leading-relaxed text-slate-600"
              >
                STEVE isn't just a tutor. It's a career-matching, course-planning, and emotion-aware 
                intelligence suite built specifically for the Stevens Institute of Technology.
              </motion.p>

              <motion.div 
                {...fadeUp(0.3)}
                className="mt-12 flex flex-wrap items-center gap-5"
              >
                <Link
                  to="/login"
                  className="group relative inline-flex items-center gap-3 rounded-full bg-slate-900 px-8 py-4 text-lg font-bold text-white transition-all hover:bg-black hover:scale-105 active:scale-95 shadow-xl shadow-slate-900/20"
                >
                  Launch Steve 🚀
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/app/dashboard"
                  className="inline-flex items-center gap-3 rounded-full border-2 border-slate-200 bg-white px-8 py-4 text-lg font-bold text-slate-900 transition-all hover:border-slate-900 hover:bg-slate-50"
                >
                  Explore the Hub
                </Link>
              </motion.div>
            </div>

            <div className="flex justify-center lg:justify-end order-1 lg:order-2 mb-12 lg:mb-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ duration: 1, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="relative"
              >
                <div className="absolute inset-0 -m-20 rounded-full bg-blue-400/10 blur-[120px] animate-pulse" />
                <SteveLogo variant="hero" className="relative drop-shadow-[0_32px_64px_rgba(0,86,210,0.25)] scale-[1.2] sm:scale-[1.5] lg:scale-[1.9] xl:scale-[2.1] transition-transform duration-500 hover:scale-[2.2]" />
              </motion.div>
            </div>
          </div>

          {/* Large Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 relative mx-auto max-w-6xl"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10 h-32 bottom-0" />
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_32px_80px_-16px_rgba(0,0,0,0.12)] overflow-hidden">
              <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100 aspect-[16/9]">
                <img 
                  src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=2070&auto=format&fit=crop" 
                  alt="Steve Platform Interface" 
                  className="w-full h-full object-cover opacity-80 mix-blend-multiply grayscale hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-br from-[#0056D2]/20 to-purple-500/20 pointer-events-none" />
                
                {/* Floating UI Elements */}
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-10 right-10 w-64 p-4 bg-white/90 backdrop-blur rounded-2xl shadow-2xl border border-white"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Eye className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Accessibility</div>
                      <div className="text-sm font-bold text-slate-900">Focus: 92%</div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full w-[92%] bg-emerald-500" />
                  </div>
                </motion.div>

                <motion.div 
                  animate={{ y: [0, 10, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                  className="absolute bottom-10 left-10 w-72 p-4 bg-white/90 backdrop-blur rounded-2xl shadow-2xl border border-white"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Target className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Career Fit</div>
                      <div className="text-sm font-bold text-slate-900">Match Score: 88%</div>
                    </div>
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed font-medium">
                    Identified 2 missing skills: Python (Intermediate) & PyTorch.
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Strip ── */}
      <div className="bg-slate-900 py-12 overflow-hidden relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <motion.div 
                key={stat.label}
                {...fadeUp(i * 0.1)}
                className="text-center"
              >
                <div className="text-4xl font-black text-white mb-2">{stat.value}</div>
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Core Features Grid ── */}
      <section id="features" className="py-32 bg-white relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mb-20">
            <motion.div {...fadeUp(0)} className="text-[#0056D2] font-bold uppercase tracking-widest text-sm mb-4">Core Ecosystem</motion.div>
            <motion.h2 {...fadeUp(0.1)} className="text-4xl font-black text-slate-900 sm:text-5xl mb-6">
              One platform. <br />Infinite Academic Growth.
            </motion.h2>
            <motion.p {...fadeUp(0.2)} className="text-xl text-slate-600 leading-relaxed">
              We've consolidated everything a Stevens student needs into a single, cohesive, 
              and intelligent experience. No more manual catalog searching or generic study guides.
            </motion.p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((feature, i) => (
              <motion.div
                key={feature.title}
                {...fadeUp(i * 0.1)}
                whileHover={{ y: -8 }}
                className="group p-8 rounded-[2.5rem] bg-white border border-slate-200 hover:border-[#0056D2]/20 hover:shadow-[0_24px_48px_-12px_rgba(0,86,210,0.12)] transition-all duration-300"
              >
                <div className={`h-14 w-14 ${feature.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-current/20 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-4">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed text-base font-medium">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Career Fit Showcase Section ── */}
      <section id="career-intelligence" className="py-32 bg-slate-50 border-y border-slate-200 overflow-hidden relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <motion.div {...fadeUp(0)}>
              <div className="text-indigo-600 font-bold uppercase tracking-widest text-sm mb-4">Career Bridge</div>
              <h2 className="text-4xl font-black text-slate-900 sm:text-5xl mb-8 leading-[1.1]">
                Bridge the Gap Between <br />
                <span className="text-indigo-600 italic">Resume</span> & <span className="text-indigo-600 italic">Reality.</span>
              </h2>
              <div className="space-y-8">
                {[
                  { 
                    title: "Instant JD Matching", 
                    desc: "Paste any Job Description. Our AI performs a deep audit of your resume to find exactly what's missing." 
                  },
                  { 
                    title: "Automated Bridge Courses", 
                    desc: "With one click, STEVE generates a custom syllabus to master your identified skill gaps." 
                  },
                  { 
                    title: "Interview Danger Zones", 
                    desc: "Get warned about difficult questions the recruiter might ask based on your specific gaps." 
                  }
                ].map((item, i) => (
                  <div key={i} className="flex gap-5">
                    <div className="h-7 w-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                      <div className="h-2 w-2 rounded-full bg-indigo-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 mb-1 text-lg">{item.title}</h4>
                      <p className="text-slate-600 font-medium leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 100 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative"
            >
              <div className="rounded-[3rem] overflow-hidden border-[12px] border-white shadow-[0_48px_96px_-24px_rgba(79,70,229,0.3)]">
                <img 
                  src="https://images.unsplash.com/photo-1586281380349-632531db7ed4?q=80&w=2070&auto=format&fit=crop" 
                  alt="Career Match Mockup" 
                  className="w-full grayscale hover:grayscale-0 transition-all duration-700"
                />
              </div>
              {/* Decorative elements */}
              <div className="absolute -top-10 -right-10 h-40 w-40 bg-indigo-500/10 blur-3xl rounded-full" />
              <div className="absolute -bottom-10 -left-10 h-60 w-60 bg-blue-500/10 blur-3xl rounded-full" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonial ── */}
      <section className="py-32 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative p-12 lg:p-20 rounded-[4rem] bg-slate-900 overflow-hidden text-center">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-blue-500 blur-[120px] rounded-full" />
            </div>
            
            <div className="relative z-10">
              <div className="flex justify-center gap-1 mb-8">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-6 w-6 text-amber-400 fill-amber-400" />
                ))}
              </div>
              <blockquote className="text-2xl lg:text-4xl font-medium text-white italic leading-tight mb-10 max-w-4xl mx-auto">
                "STEVE is the first academic tool that actually <span className="text-blue-400 font-bold">understands</span> what I'm trying to achieve. It connected my Stevens courses directly to my career goals at PayPal."
              </blockquote>
              <div className="flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-slate-800 border-2 border-slate-700 mb-4 overflow-hidden">
                  <div className="w-full h-full bg-[#0056D2] flex items-center justify-center font-black text-white">AN</div>
                </div>
                <div className="text-lg font-bold text-white">Abhishek Nandan</div>
                <div className="text-slate-400 font-medium">MS Applied AI · Class of 2026</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-50 border-t border-slate-200 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <SteveLogo variant="default" className="mb-6 scale-125 origin-left" />
              <p className="text-slate-500 font-medium max-w-md leading-relaxed text-lg">
                The most advanced intelligence suite for the Stevens Institute of Technology. 
                Built with precision, local-first privacy, and an obsession with student success.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-xs">Platform</h4>
              <ul className="space-y-4 font-semibold text-slate-600">
                <li><Link to="/app/dashboard" className="hover:text-[#0056D2] transition-colors">Dashboard</Link></li>
                <li><Link to="/app/career-fit" className="hover:text-[#0056D2] transition-colors">Career Bridge</Link></li>
                <li><Link to="/app/courses/new" className="hover:text-[#0056D2] transition-colors">AI Tutor</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 mb-6 uppercase tracking-widest text-xs">Account</h4>
              <ul className="space-y-4 font-semibold text-slate-600">
                <li><Link to="/login" className="hover:text-[#0056D2] transition-colors">Sign In</Link></li>
                <li><Link to="/app/profile" className="hover:text-[#0056D2] transition-colors">My Profile</Link></li>
                <li><Link to="/app/settings" className="hover:text-[#0056D2] transition-colors">Settings</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-slate-200 flex flex-wrap justify-between items-center gap-4 text-sm font-bold text-slate-400">
            <div>© 2026 Steve Platform. Developed for Stevens Institute of Technology.</div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-slate-900">Privacy</a>
              <a href="#" className="hover:text-slate-900">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
