/** Extract plaintext from PDF in the browser — requires pdfjs-dist. */
export async function extractPdfText(file: File): Promise<string> {
  const pages = await extractPdfPages(file);
  return pages.join("\n\n").replace(/\s+/g, " ").trim();
}

export type PdfExtractMeta = {
  fileName: string;
  pageCount: number;
  wordCount: number;
  pdfTitle?: string;
  author?: string;
};

type RawTextPiece = { x: number; y: number; str: string; hasEOL: boolean; h: number };

function pieceFromItem(item: unknown): RawTextPiece | null {
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const str = typeof o.str === "string" ? o.str : "";
  if (!str.trim() && !o.hasEOL) return null;
  const tr = o.transform;
  if (!Array.isArray(tr) || tr.length < 6) {
    return str.trim()
      ? { x: 0, y: 0, str, hasEOL: !!o.hasEOL, h: 12 }
      : o.hasEOL
        ? { x: 0, y: 0, str: "", hasEOL: true, h: 12 }
        : null;
  }
  const h = typeof o.height === "number" && o.height > 0 ? o.height : Math.abs(tr[3]) || 12;
  return {
    x: tr[4] as number,
    y: tr[5] as number,
    str,
    hasEOL: !!o.hasEOL,
    h
  };
}

/** Cluster glyphs by baseline Y, order left→right, top→bottom (richer structure than flattening PDF strings). */
function layoutPageText(pieces: RawTextPiece[]): string {
  const usable = pieces.filter((p) => p.str.trim() || p.hasEOL);
  if (usable.length === 0) return "";
  const hs = usable.map((p) => p.h).sort((a, b) => a - b);
  const medianH = hs[Math.floor(hs.length / 2)] ?? 12;
  const lineThreshold = Math.max(2.5, medianH * 0.85);

  const byLine: RawTextPiece[][] = [];
  for (const p of usable) {
    let found = false;
    for (const line of byLine) {
      const y0 = line[0]!.y;
      if (Math.abs(p.y - y0) <= lineThreshold) {
        line.push(p);
        found = true;
        break;
      }
    }
    if (!found) byLine.push([p]);
  }
  byLine.sort((a, b) => b[0]!.y - a[0]!.y);
  for (const line of byLine) line.sort((a, b) => a.x - b.x);

  const outLines: string[] = [];
  for (const line of byLine) {
    const buf: string[] = [];
    for (const item of line) {
      const t = item.str.trim();
      if (t) buf.push(t);
      if (item.hasEOL && buf.length) {
        outLines.push(buf.join(" ").replace(/\s+/g, " "));
        buf.length = 0;
      }
    }
    if (buf.length) outLines.push(buf.join(" ").replace(/\s+/g, " "));
  }
  const out = outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (out.length < 40 && usable.some((p) => p.str.trim())) {
    return usable
      .slice()
      .sort((a, b) => b.y - a.y || a.x - b.x)
      .map((p) => p.str.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return out;
}

async function getPdfDoc(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  return doc;
}

/** Per-page text with layout-aware reconstruction (headings and lists read more naturally). */
export async function extractPdfPages(file: File): Promise<string[]> {
  const { pages } = await extractPdfForSyllabus(file);
  return pages;
}

/** Full syllabus extraction plus metadata for UI / provenance banner. */
export async function extractPdfForSyllabus(file: File): Promise<{ pages: string[]; meta: PdfExtractMeta }> {
  const doc = await getPdfDoc(file);
  const pageCount = doc.numPages;

  let pdfTitle: string | undefined;
  let author: string | undefined;
  try {
    const m = await doc.getMetadata().catch(() => null);
    if (m?.info && typeof m.info === "object") {
      const info = m.info as Record<string, unknown>;
      if (typeof info.Title === "string" && info.Title.trim()) pdfTitle = info.Title.trim();
      if (typeof info.Author === "string" && info.Author.trim()) author = info.Author.trim();
    }
  } catch {
    /* ignore metadata */
  }

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const pieces: RawTextPiece[] = [];
    for (const item of tc.items) {
      const p = pieceFromItem(item);
      if (p) pieces.push(p);
    }
    pages.push(layoutPageText(pieces));
  }

  const full = pages.join("\n");
  const wordCount = full.trim() ? full.trim().split(/\s+/).length : 0;

  await doc.destroy().catch(() => {});

  return {
    pages,
    meta: {
      fileName: file.name,
      pageCount,
      wordCount,
      pdfTitle,
      author
    }
  };
}

export async function readTextFile(file: File): Promise<string> {
  return await file.text();
}
