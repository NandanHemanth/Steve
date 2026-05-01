import "dotenv/config";
import cors from "cors";
import express from "express";
import { z } from "zod";
import { appendUserMessages, clearUserMemory, getUserMemory } from "./memory.js";
import { groqChatWithRotation } from "./groq.js";
import { buildAdvisorStevensContext } from "./stevensAdvisorContext.js";
import { stevensCourses, stevensEvents, stevensPolicies, stevensPrograms, stevensServices } from "./stevensData.js";

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "steve-api" });
});

app.get("/stevens/services", (_req, res) => {
  res.json({ services: stevensServices });
});

app.get("/stevens/events", (_req, res) => {
  res.json({ events: stevensEvents });
});

app.get("/stevens/policies", (_req, res) => {
  res.json({ policies: stevensPolicies });
});

app.get("/stevens/courses", (req, res) => {
  const q = String(req.query.q ?? "").toLowerCase().trim();
  const tag = String(req.query.tag ?? "").toLowerCase().trim();
  const filtered = stevensCourses.filter((c) => {
    const matchesQ =
      !q ||
      c.code.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q);
    const matchesTag = !tag || c.tags.some((t) => t.toLowerCase() === tag);
    return matchesQ && matchesTag;
  });
  res.json({ courses: filtered });
});

app.get("/stevens/programs", (_req, res) => {
  res.json({ programs: stevensPrograms });
});

const ChatRequestSchema = z.object({
  userId: z.string().min(1),
  groqKeys: z.array(z.string()).max(5).optional(),
  model: z.string().default("llama-3.3-70b-versatile"),
  message: z.string().min(1),
  system: z.string().optional(),
  profile: z.record(z.string(), z.unknown()).optional()
});

app.post("/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const { userId, message, model, system, profile } = parsed.data;
  const keys =
    parsed.data.groqKeys && parsed.data.groqKeys.length > 0
      ? parsed.data.groqKeys
      : (process.env.GROQ_KEYS ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  try {
    const mem = getUserMemory(userId);

    const catalogBlock = buildAdvisorStevensContext(profile as Record<string, unknown> | undefined);

    const systemPrompt = [
      "You are STEVE: a premium, professional academic and campus life assistant for Stevens Institute of Technology students.",
      "Be concise, specific, and action-oriented.",
      "Personalize recommendations to the student's major, GPA, workload comfort, gaps/strengths, career target, planned/completed courses, and F‑1 status when visible in the profile JSON.",
      catalogBlock,
      "Never invent course codes or faculty names. Follow STRICT_RULES in the catalog block.",
      "Never fabricate university policies; cite rule-of-thumb from profile context only.",
      "Return a structured response as ONLY valid JSON inside a single markdown ```json block. No extra text outside the block.",
      "Schema:",
      "{",
      '  "title": string,',
      '  "answer": string,',
      '  "keyPoints": string[],',
      '  "risks": string[],',
      '  "recommendedPlan": string[],',
      '  "nextSteps": string[],',
      '  "options": string[]',
      "}",
      "Rules:",
      "- options must be 3-5 short clickable strings (<90 chars).",
      "- recommendedPlan bullets must reference real codes from authoritativeCodes whenever suggesting courses.",
      "- If a section is not applicable, use an empty array.",
      system ? `Extra instructions: ${system}` : "",
      profile ? `Student profile JSON (includes planner):\n${JSON.stringify(profile)}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");

    const groqMessages = [
      { role: "system" as const, content: systemPrompt },
      ...mem.messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: message }
    ];

    const result = await groqChatWithRotation({
      keys,
      request: {
        model,
        messages: groqMessages,
        temperature: 0.4
      }
    });

    appendUserMessages(userId, [
      { role: "user", content: message, ts: Date.now() },
      { role: "assistant", content: result.content, ts: Date.now() }
    ]);

    res.json({
      content: result.content,
      usedKeyIndex: result.usedKeyIndex,
      memoryCount: getUserMemory(userId).messages.length
    });
  } catch (err: any) {
    res.status(err?.status ?? 500).json({
      error: err?.message ?? "Unknown error",
      details: err?.details ?? null
    });
  }
});

const MemoryActionSchema = z.object({
  userId: z.string().min(1)
});

app.get("/memory/:userId", (req, res) => {
  const userId = req.params.userId ?? "";
  if (!userId) return res.status(400).json({ error: "Missing userId" });
  res.json(getUserMemory(userId));
});

app.post("/memory/clear", (req, res) => {
  const parsed = MemoryActionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid request" });
  clearUserMemory(parsed.data.userId);
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 8787);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`STEVE API running on http://localhost:${port}`);
});

