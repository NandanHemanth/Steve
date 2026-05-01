import jsPDF from "jspdf";
import type { SlideCard } from "../tutor/slideDeck";
import type { DiagramSpec } from "./pptxExport";

export async function exportSlidesToPdf(args: { title: string; slides: SlideCard[]; diagram?: DiagramSpec }) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();

  const margin = 44;
  const titleSize = 26;
  const bodySize = 14;

  const addHeader = (t: string) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(titleSize);
    pdf.text(t, margin, margin);
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, margin + 10, W - margin, margin + 10);
  };

  // Title page
  addHeader(args.title);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.text("Generated from your course material.", margin, margin + 42);

  for (const s of args.slides.slice(0, 10)) {
    pdf.addPage();
    addHeader(s.title);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(bodySize);

    const bullets = (s.bullets ?? []).slice(0, 9).map((b) => b.trim()).filter(Boolean);
    let y = margin + 44;
    const maxW = W - margin * 2;
    for (const b of bullets) {
      const lines = pdf.splitTextToSize(`• ${b}`, maxW);
      pdf.text(lines, margin, y);
      y += lines.length * 18 + 4;
      if (y > H - margin) break;
    }
  }

  if (args.diagram?.nodes?.length) {
    pdf.addPage();
    addHeader(args.diagram.title ?? "Module diagram");
    const ox = margin;
    const oy = margin + 30;
    const dw = W - margin * 2;
    const dh = H - margin - oy;

    const nodeById = new Map(args.diagram.nodes.map((n) => [n.id, n]));
    pdf.setDrawColor(148, 163, 184);
    for (const e of args.diagram.edges ?? []) {
      const a = nodeById.get(e.from);
      const b = nodeById.get(e.to);
      if (!a || !b) continue;
      const x1 = ox + a.x * dw;
      const y1 = oy + a.y * dh;
      const x2 = ox + b.x * dw;
      const y2 = oy + b.y * dh;
      pdf.line(x1, y1, x2, y2);
    }

    for (const n of args.diagram.nodes) {
      const x = ox + n.x * dw;
      const y = oy + n.y * dh;
      const bw = 150;
      const bh = 42;
      pdf.setFillColor(242, 247, 255);
      pdf.setDrawColor(37, 99, 235);
      pdf.roundedRect(x - bw / 2, y - bh / 2, bw, bh, 8, 8, "FD");
      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(12);
      pdf.text(n.label.slice(0, 42), x, y + 4, { align: "center" });
    }
  }

  pdf.save(`${args.title.replace(/[^\w\- ]+/g, "").slice(0, 60) || "module"}.pdf`);
}

