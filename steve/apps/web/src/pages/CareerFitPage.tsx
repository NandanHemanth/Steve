import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Target, AlertTriangle, Lightbulb, ChevronRight, CheckCircle2, ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import { chatJson } from "../lib/groqClient";
import { loadJson, saveJson, storageKeys } from "../lib/storage";

// Worker is copied to /public so it's served at the root path - reliable for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface MissingSkill {
  skill: string;
  importance: "High" | "Medium" | "Low";
  context: string;
}

interface AnalysisResult {
  fitScore: number;
  matchSummary: string;
  missingSkills: MissingSkill[];
  interviewDangerZones: string[];
  resumeEnhancements: string[];
}

export function CareerFitPage() {
  const navigate = useNavigate();

  // Load persisted state
  const saved = loadJson<any>(storageKeys.careerFit, {});

  const [jdText, setJdText] = useState(saved.jdText || "");
  const [resumeText, setResumeText] = useState(saved.resumeText || "");
  const [resumeName, setResumeName] = useState(saved.resumeName || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(saved.result || null);
  const [error, setError] = useState("");

  // Persist state on change
  useEffect(() => {
    saveJson(storageKeys.careerFit, { jdText, resumeText, resumeName, result });
  }, [jdText, resumeText, resumeName, result]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }

    setResumeName(file.name);
    setError("");
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(" ");
        text += pageText + "\n";
      }
      setResumeText(text);
    } catch (err: any) {
      console.error(err);
      setError("Failed to parse PDF. Please ensure it's a readable text PDF. Details: " + (err.message || String(err)));
    }
  };

  const analyzeFit = async () => {
    if (!jdText.trim()) {
      setError("Please paste a Job Description.");
      return;
    }
    if (!resumeText.trim()) {
      setError("Please upload your Resume.");
      return;
    }

    setIsAnalyzing(true);
    setError("");

    const systemPrompt = `You are an elite technical recruiter and career coach.
Scan the ENTIRE Job Description (JD) provided, including the company overview, responsibilities, and qualifications sections. 
Your task is to identify EVERY SINGLE requirement mentioned—including technical skills, soft skills, leadership qualities (like mentoring), years of experience, and educational requirements.

Compare this exhaustive list of requirements against the candidate's Resume text.
Identify ALL gaps where the candidate's resume does not explicitly demonstrate or meet the JD's criteria.

Return ONLY a valid JSON object matching this exact structure:
{
  "fitScore": number (0 to 100),
  "matchSummary": "A brief 2-sentence summary of their overall fit.",
  "missingSkills": [
    {
      "skill": "Name of the missing requirement (e.g., 'Advanced Data Science Modeling', '3+ Years Data Science Exp', 'Mentorship', 'Data Quality Management')",
      "importance": "High" | "Medium" | "Low",
      "context": "Briefly state where/why this was mentioned in the JD"
    }
  ],
  "interviewDangerZones": [
    "A specific, difficult interview question they might struggle with due to their identified gaps."
  ],
  "resumeEnhancements": [
    "A specific, actionable suggestion to reword or improve their resume based on their existing experience to better match the JD."
  ]
}`;

    const userPrompt = `JOB DESCRIPTION:\n${jdText}\n\n---\n\nRESUME:\n${resumeText}`;

    try {
      const res = await chatJson(systemPrompt, userPrompt) as AnalysisResult;
      setResult(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLearnSkill = (skill: string) => {
    // Redirect to course builder with pre-filled prompt
    const prompt = `Create a crash course on ${skill} tailored for someone applying to a job that requires it. Focus on practical application and interview readiness.`;
    navigate(`/app/courses/new?prompt=${encodeURIComponent(prompt)}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-[#0056D2]" />
            Career Fit & Skill Bridge
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Compare your resume against any Job Description to instantly identify gaps and generate personalized learning paths to bridge them.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Col: Inputs */}
        <div className="space-y-6">
          {/* JD Input */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Job Description
              </label>
            </div>
            <textarea
              className="w-full h-48 p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0056D2]/20 focus:border-[#0056D2] transition resize-none bg-slate-50"
              placeholder="Paste the full job description here..."
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
            />
          </div>

          {/* Resume Upload */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Upload className="h-4 w-4 text-slate-400" />
                Your Resume (PDF)
              </label>
            </div>
            
            <input 
              type="file" 
              accept=".pdf" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            {!resumeName ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-50 transition"
              >
                <div className="h-10 w-10 bg-[#F2F7FF] rounded-full flex items-center justify-center mb-3">
                  <Upload className="h-5 w-5 text-[#0056D2]" />
                </div>
                <div className="text-sm font-medium text-slate-700">Click to upload resume</div>
                <div className="text-xs text-slate-400 mt-1">PDF format only</div>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-[#F2F7FF] border border-[#0056D2]/20 rounded-xl">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-[#0056D2]" />
                  <div className="text-sm font-medium text-slate-800 truncate max-w-[200px]">
                    {resumeName}
                  </div>
                </div>
                <button 
                  onClick={() => { setResumeName(""); setResumeText(""); }}
                  className="text-xs text-slate-500 hover:text-slate-700 font-medium"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          <button
            onClick={analyzeFit}
            disabled={isAnalyzing || !jdText || !resumeText}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0056D2] hover:bg-[#0047b3] disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition shadow-sm"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Analyzing Fit...
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                Analyze Career Fit
              </>
            )}
          </button>
        </div>

        {/* Right Col: Results */}
        <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative min-h-[500px]">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 text-slate-400"
              >
                <Target className="h-16 w-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-slate-600 mb-2">Awaiting Analysis</h3>
                <p className="text-sm max-w-sm">Provide a job description and your resume, then click analyze to see your fit score, missing skills, and interview danger zones.</p>
              </motion.div>
            ) : (
              <motion.div 
                key="results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 overflow-y-auto p-6 space-y-6 custom-scrollbar"
              >
                {/* Score Header */}
                <div className="flex items-start gap-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="relative flex items-center justify-center shrink-0">
                    <svg className="w-20 h-20 transform -rotate-90">
                      <circle cx="40" cy="40" r="36" fill="transparent" stroke="#e2e8f0" strokeWidth="6" />
                      <circle 
                        cx="40" cy="40" r="36" fill="transparent" 
                        stroke={result.fitScore >= 80 ? "#10B981" : result.fitScore >= 60 ? "#F59E0B" : "#EF4444"} 
                        strokeWidth="6" 
                        strokeDasharray={226} 
                        strokeDashoffset={226 - (226 * result.fitScore) / 100}
                        className="transition-all duration-1000 ease-out"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center">
                      <span className="text-xl font-bold text-slate-800">{result.fitScore}%</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Match Score</h3>
                    <p className="text-sm text-slate-700 leading-relaxed">{result.matchSummary}</p>
                  </div>
                </div>

                {/* Missing Skills (The Core Feature) */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                    Identified Skill Gaps
                  </h3>
                  {result.missingSkills.length === 0 ? (
                    <div className="p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm border border-emerald-100 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      No critical skill gaps identified!
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {result.missingSkills.map((gap, i) => (
                        <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-slate-800">{gap.skill}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                                  gap.importance === 'High' ? 'bg-red-100 text-red-700' : 
                                  gap.importance === 'Medium' ? 'bg-amber-100 text-amber-700' : 
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {gap.importance} Priority
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 leading-relaxed">{gap.context}</p>
                            </div>
                            <button
                              onClick={() => handleLearnSkill(gap.skill)}
                              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-[#0056D2] hover:bg-[#0047b3] text-white text-xs font-medium rounded-lg transition"
                            >
                              Learn This <ArrowRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interview Danger Zones */}
                {result.interviewDangerZones?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Target className="h-4 w-4 text-red-500" />
                      Interview Danger Zones
                    </h3>
                    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
                      {result.interviewDangerZones.map((q, i) => (
                        <div key={i} className="flex gap-3 text-sm text-slate-700 border-b border-slate-100 last:border-0 pb-3 last:pb-0">
                          <span className="text-red-400 font-bold shrink-0">Q:</span>
                          <p>{q}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resume Enhancements */}
                {result.resumeEnhancements?.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-emerald-500" />
                      Resume Enhancements
                    </h3>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 space-y-3 shadow-sm">
                      {result.resumeEnhancements.map((tip, i) => (
                        <div key={i} className="flex gap-3 text-sm text-slate-700 border-b border-emerald-100/50 last:border-0 pb-3 last:pb-0">
                          <ChevronRight className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                          <p>{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
