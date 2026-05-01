import PptxGenJS from "pptxgenjs";
import type { SlideCard } from "../tutor/slideDeck";

export type DiagramSpec = {
  title?: string;
  nodes: { id: string; label: string; x: number; y: number }[];
  edges: { from: string; to: string; label?: string }[];
};

export async function exportSlidesToPptx(args: { title: string; slides: SlideCard[]; diagram?: DiagramSpec }) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "STEVE";

  const THEME = {
    ink: "0F172A",
    muted: "334155",
    line: "E2E8F0",
    accent: "0056D2",
    accentSoft: "F2F7FF",
    bg: "FFFFFF",
    bgSoft: "F8FAFC"
  } as const;

  const W = 13.33; // wide layout inches
  const H = 7.5;

  const addChrome = (s: PptxGenJS.Slide, opts: { header?: string; sub?: string; page?: string }) => {
    s.background = { color: THEME.bgSoft };
    // top bar
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: 0.78, fill: { color: THEME.bg } });
    s.addShape(pptx.ShapeType.rect, { x: 0, y: 0.78, w: W, h: 0.06, fill: { color: THEME.accent } });
    if (opts.header) {
      s.addText(opts.header, { x: 0.7, y: 0.18, w: 10.9, h: 0.5, fontFace: "Aptos", fontSize: 18, bold: true, color: THEME.ink });
    }
    if (opts.sub) {
      s.addText(opts.sub, { x: 0.7, y: 0.52, w: 10.9, h: 0.3, fontFace: "Aptos", fontSize: 11, color: THEME.muted });
    }
    if (opts.page) {
      s.addText(opts.page, { x: 11.8, y: 0.26, w: 1.3, h: 0.3, fontFace: "Aptos", fontSize: 11, color: THEME.muted, align: "right" });
    }
    // subtle footer line
    s.addShape(pptx.ShapeType.rect, { x: 0.7, y: 7.15, w: 11.93, h: 0.01, fill: { color: THEME.line } });
    s.addText("STEVE", { x: 0.7, y: 7.2, w: 2, h: 0.25, fontFace: "Aptos", fontSize: 10, color: THEME.muted });
  };

  // Title slide (more designed)
  {
    const s = pptx.addSlide();
    s.background = { color: THEME.bgSoft };
    // big accent panel
    s.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.15, w: 11.8, h: 4.9, fill: { color: THEME.bg }, line: { color: THEME.line, width: 1 } });
    s.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.15, w: 11.8, h: 0.18, fill: { color: THEME.accent } });
    s.addText(args.title, { x: 1.3, y: 2.0, w: 10.8, h: 1.2, fontFace: "Aptos", fontSize: 40, bold: true, color: THEME.ink });
    s.addText("Generated from your course material", {
      x: 1.3,
      y: 3.3,
      w: 10.8,
      h: 0.5,
      fontFace: "Aptos",
      fontSize: 16,
      color: THEME.muted
    });
    // three “pills”
    const pill = (x: number, label: string) => {
      s.addShape(pptx.ShapeType.roundRect, { x, y: 4.25, w: 3.5, h: 0.58, fill: { color: THEME.accentSoft }, line: { color: "BBD3FF", width: 1 } });
      s.addText(label, { x: x + 0.2, y: 4.38, w: 3.1, h: 0.35, fontFace: "Aptos", fontSize: 12, bold: true, color: THEME.accent, align: "center" });
    };
    pill(1.3, "Slides");
    pill(5.0, "Practice prompts");
    pill(8.7, "Exportable deck");
    s.addText(new Date().toLocaleDateString(), { x: 1.3, y: 5.15, w: 10.8, h: 0.3, fontFace: "Aptos", fontSize: 11, color: THEME.muted });
  }

  const maxSlides = Math.min(args.slides.length, 14);
  for (const [idx, slide] of args.slides.slice(0, maxSlides).entries()) {
    const s = pptx.addSlide();
    addChrome(s, { header: slide.title, sub: "Key takeaways", page: `${idx + 1}/${maxSlides}` });

    // card body
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.8,
      y: 1.15,
      w: 11.75,
      h: 5.85,
      fill: { color: THEME.bg },
      line: { color: THEME.line, width: 1 }
    });
    // accent stripe
    s.addShape(pptx.ShapeType.rect, { x: 0.8, y: 1.15, w: 0.12, h: 5.85, fill: { color: THEME.accent } });

    const bullets = (slide.bullets ?? []).map((b) => b.trim()).filter(Boolean);
    const topBullets = bullets.slice(0, 6);
    const extra = bullets.slice(6, 12);

    const bulletText = topBullets.length ? topBullets.map((b) => `• ${b}`).join("\n") : "• (No bullets)";
    s.addText(bulletText, {
      x: 1.25,
      y: 1.55,
      w: 7.4,
      h: 5.2,
      fontFace: "Aptos",
      fontSize: 18,
      color: THEME.ink,
      valign: "top"
    });

    // right callout panel for “examples / prompts”
    s.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 1.55, w: 3.35, h: 2.0, fill: { color: THEME.accentSoft }, line: { color: "BBD3FF", width: 1 } });
    s.addText("Try this", { x: 9.2, y: 1.7, w: 3.0, h: 0.3, fontFace: "Aptos", fontSize: 12, bold: true, color: THEME.accent });
    const prompt = bullets.find((b) => b.length >= 18)?.slice(0, 120) ?? "Write one concrete example from your syllabus that fits this slide.";
    s.addText(prompt, { x: 9.2, y: 2.05, w: 3.0, h: 1.35, fontFace: "Aptos", fontSize: 11, color: THEME.ink, valign: "top" });

    // bottom-right “more” box
    if (extra.length) {
      s.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 3.75, w: 3.35, h: 3.0, fill: { color: THEME.bg }, line: { color: THEME.line, width: 1 } });
      s.addText("More points", { x: 9.2, y: 3.9, w: 3.0, h: 0.3, fontFace: "Aptos", fontSize: 12, bold: true, color: THEME.muted });
      s.addText(extra.map((b) => `• ${b}`).join("\n"), {
        x: 9.2,
        y: 4.25,
        w: 3.0,
        h: 2.4,
        fontFace: "Aptos",
        fontSize: 11,
        color: THEME.ink,
        valign: "top"
      });
    } else {
      // add a simple icon tile for visual balance
      s.addShape(pptx.ShapeType.roundRect, { x: 9.0, y: 3.75, w: 3.35, h: 3.0, fill: { color: THEME.bg }, line: { color: THEME.line, width: 1 } });
      s.addShape(pptx.ShapeType.ellipse, { x: 10.2, y: 4.55, w: 1.0, h: 1.0, fill: { color: THEME.accentSoft }, line: { color: THEME.accent, width: 1 } });
      s.addText("Key idea", { x: 9.2, y: 3.95, w: 3.0, h: 0.3, fontFace: "Aptos", fontSize: 12, bold: true, color: THEME.muted });
      s.addText("Summarize this slide in 1 sentence.", { x: 9.2, y: 5.65, w: 3.0, h: 0.6, fontFace: "Aptos", fontSize: 11, color: THEME.ink });
    }
  }

  // Add a diagram slide if provided.
  if (args.diagram?.nodes?.length) {
    const s = pptx.addSlide();
    addChrome(s, { header: args.diagram.title ?? "Module diagram", sub: "Relationships across the module", page: "Diagram" });
    s.addShape(pptx.ShapeType.roundRect, { x: 0.8, y: 1.15, w: 11.75, h: 5.85, fill: { color: THEME.bg }, line: { color: THEME.line, width: 1 } });

    const ox = 0.6;
    const oy = 1.25;
    const dw = 12.2;
    const dh = 5.9;

    const nodeById = new Map(args.diagram.nodes.map((n) => [n.id, n]));
    // edges first (behind)
    for (const e of args.diagram.edges ?? []) {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) continue;
      const x1 = ox + a.x * dw;
      const y1 = oy + a.y * dh;
      const x2 = ox + b.x * dw;
      const y2 = oy + b.y * dh;
      s.addShape(pptx.ShapeType.line, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: "94A3B8", width: 1.25 } });
      if (e.label) {
        s.addText(e.label, { x: (x1 + x2) / 2 - 0.7, y: (y1 + y2) / 2 - 0.2, w: 1.4, h: 0.4, fontFace: "Aptos", fontSize: 10, color: "334155" });
      }
    }
    for (const n of args.diagram.nodes) {
      const x = ox + n.x * dw - 1.05;
      const y = oy + n.y * dh - 0.4;
      s.addShape(pptx.ShapeType.roundRect, { x, y, w: 2.1, h: 0.8, fill: { color: THEME.accentSoft }, line: { color: THEME.accent, width: 1 } });
      s.addText(n.label, { x: x + 0.12, y: y + 0.18, w: 1.86, h: 0.48, fontFace: "Aptos", fontSize: 12, color: THEME.ink, align: "center" });
    }
  }

  const blob = (await pptx.write({ outputType: "blob" })) as Blob;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${args.title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "module"}.pptx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

