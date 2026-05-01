/** One slide card for UI + storage */
export type SlideCard = { title: string; bullets: string[] };

function asObj(x: unknown): Record<string, unknown> | null {
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

/** Collect bullets from common LLM alternate shapes */
function bulletsFromSlideObject(o: Record<string, unknown>): string[] {
  const pickStrings = (v: unknown): string[] => {
    if (!v) return [];
    if (typeof v === "string") return v.trim() ? [v.trim()] : [];
    if (Array.isArray(v)) return v.map((x) => String(x)).map((s) => s.trim()).filter(Boolean);
    return [];
  };

  let b = pickStrings(o.bullets);
  if (b.length) return b;

  const points = pickStrings(o.points);
  if (points.length) return points;

  const content = pickStrings(o.content);
  if (content.length) return content;

  const bodyItems = Array.isArray(o.body) ? pickStrings(o.body) : [];
  if (bodyItems.length) return bodyItems;
  const bodyStr = pickStrings(o.body as unknown);
  if (bodyStr.length) return bodyStr;

  const takeaways = pickStrings(o.takeaways);
  if (takeaways.length) return takeaways;

  const notes = pickStrings(o.notes);
  if (notes.length) return notes;

  return [];
}

/** Parse slides from one array-like field returned by models */
export function slidesFromUnknownArray(raw: unknown): SlideCard[] {
  if (!Array.isArray(raw)) return [];
  const out: SlideCard[] = [];
  for (const item of raw) {
    const o = asObj(item);
    if (!o) continue;
    const title = String(o.title ?? o.heading ?? o.name ?? "Slide").trim() || "Slide";
    let bullets = bulletsFromSlideObject(o);
    /** Sometimes model nests bullets under nested slide */
    const inner = asObj(o.slide);
    if (!bullets.length && inner) {
      bullets = bulletsFromSlideObject(inner);
    }
    out.push({ title, bullets });
  }
  return out;
}

/** Try slide-like structures from top-level payload */
export function coerceSlideDeckFromPayload(payload: Record<string, unknown>): SlideCard[] {
  const keys = ["slides", "pages", "deck", "slide_deck"] as const;
  for (const k of keys) {
    const part = slidesFromUnknownArray(payload[k]);
    if (part.length) return part;
  }

  /** Single slide as whole payload */
  if (typeof payload.title === "string" || typeof payload.heading === "string") {
    const o = payload;
    const title = String(o.title ?? o.heading ?? "Slide").trim() || "Slide";
    let bullets = bulletsFromSlideObject(o);
    if (bullets.length) return [{ title, bullets }];
  }

  /** Flat bullets list at payload root */
  if (Array.isArray(payload.bullet_points)) {
    const bullets = bulletsFromSlideObject({ bullets: payload.bullet_points });
    if (bullets.length) {
      const t = typeof payload.slide_title === "string" ? payload.slide_title.trim() : "Key ideas";
      return [{ title: t || "Key ideas", bullets }];
    }
  }

  return [];
}

export function ensureNonEmptyDeck(deck: SlideCard[], lessonTitle: string): SlideCard[] {
  const sanitize = deck
    .map((s) => ({
      title: (s.title || "Slide").trim() || "Slide",
      bullets: (s.bullets ?? []).map((x) => String(x).trim()).filter(Boolean)
    }))
    .filter((s) => s.title !== "" || (s.bullets?.length ?? 0) > 0);

  if (!sanitize.length) {
    return [
      {
        title: lessonTitle,
        bullets: [
          "Identify the core definition or goal of this topic in one sentence.",
          "Note two prerequisites or assumptions the material relies on.",
          "Write one realistic application or example you'd use this for."
        ]
      }
    ];
  }

  return sanitize.map((s) => ({
    title: s.title,
    bullets:
      s.bullets.length > 0
        ? s.bullets
        : [
            `Summarize "${s.title}" in your own words (2–3 sentences).`,
            `List three terms from "${s.title}" you should memorize.`,
            `What is one misconception students often have about "${s.title}"?`
          ]
  }));
}
