import type { AuditResult, IssueCategory } from "@/lib/audit/types";

type PdfLine = {
  text: string;
  size?: number;
  color?: [number, number, number];
  bold?: boolean;
  gapAfter?: number;
};

const categoryOrder: IssueCategory[] = [
  "Performance",
  "SEO",
  "Accessibility",
  "Security",
  "Technical health",
  "Platform risk"
];

function ascii(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function pdfEscape(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number) {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

class PdfBuilder {
  private pages: string[] = [];
  private current: string[] = [];
  private y = 760;

  addCover(result: AuditResult) {
    this.current.push("0.055 0.463 0.431 rg 0 702 612 90 re f");
    this.text("Website audit report", 48, 748, 24, [255, 255, 255], true);
    this.text("Prepared by Dimaso", 48, 718, 13, [230, 255, 251], false);
    this.y = 660;
    this.addLine({ text: result.universal.finalUrl, size: 18, bold: true, gapAfter: 12 });
    this.addLine({ text: `Generated: ${new Date(result.auditedAt).toLocaleString("en-US")}`, size: 10, color: [96, 112, 128] });
    this.addLine({ text: `Overall score: ${result.scores.overall}/100`, size: 16, bold: true, color: [15, 118, 110], gapAfter: 16 });
  }

  addSection(title: string) {
    this.ensureSpace(54);
    this.current.push("0.941 0.965 0.961 rg 42 " + (this.y - 8) + " 528 30 re f");
    this.text(title, 52, this.y, 15, [23, 33, 43], true);
    this.y -= 44;
  }

  addLine(line: PdfLine) {
    const size = line.size ?? 10;
    const maxChars = size >= 14 ? 58 : 88;
    const color = line.color ?? [23, 33, 43];
    for (const wrapped of wrapText(line.text, maxChars)) {
      this.ensureSpace(size + 10);
      this.text(wrapped, 48, this.y, size, color, line.bold);
      this.y -= size + 4;
    }
    this.y -= line.gapAfter ?? 2;
  }

  addKeyValue(label: string, value: unknown) {
    this.addLine({ text: `${label}: ${ascii(value)}`, size: 10 });
  }

  finish() {
    this.flushPage();

    const objects: string[] = [];
    const pageKids: number[] = [];
    const catalogId = 1;
    const pagesId = 2;
    const fontRegularId = 3;
    const fontBoldId = 4;
    let nextId = 5;

    for (const content of this.pages) {
      const pageId = nextId++;
      const contentId = nextId++;
      pageKids.push(pageId);
      objects[pageId] =
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`;
      objects[contentId] = `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`;
    }

    objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId] = `<< /Type /Pages /Kids [${pageKids.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageKids.length} >>`;
    objects[fontRegularId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
    objects[fontBoldId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (let id = 1; id < objects.length; id += 1) {
      offsets[id] = Buffer.byteLength(pdf, "utf8");
      pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let id = 1; id < objects.length; id += 1) {
      pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return new Uint8Array(Buffer.from(pdf, "utf8"));
  }

  private ensureSpace(needed: number) {
    if (this.y - needed < 56) {
      this.flushPage();
      this.y = 750;
    }
  }

  private flushPage() {
    if (this.current.length === 0) return;
    this.text("by Dimaso", 500, 32, 9, [96, 112, 128], true);
    this.pages.push(this.current.join("\n"));
    this.current = [];
  }

  private text(text: string, x: number, y: number, size: number, color: [number, number, number], bold = false) {
    const [r, g, b] = color.map((item) => (item / 255).toFixed(3));
    this.current.push(`${r} ${g} ${b} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${pdfEscape(text)}) Tj ET`);
  }
}

export function createAuditPdf(result: AuditResult) {
  const pdf = new PdfBuilder();
  pdf.addCover(result);

  pdf.addSection("Score overview");
  pdf.addKeyValue("Overall", `${result.scores.overall}/100`);
  for (const category of categoryOrder) {
    pdf.addKeyValue(category, `${result.scores.categories[category]}/100`);
  }

  pdf.addSection("Audit facts");
  pdf.addKeyValue("Final URL", result.universal.finalUrl);
  pdf.addKeyValue("HTTP status", result.universal.statusCode);
  pdf.addKeyValue("Platform", `${result.platform.platform} (${result.platform.confidence})`);
  pdf.addKeyValue("Title", result.universal.title ?? "Missing");
  pdf.addKeyValue("Meta description", result.universal.metaDescription ?? "Missing");
  pdf.addKeyValue("H1 count", result.universal.h1Count);
  pdf.addKeyValue("Images missing alt", `${result.universal.imagesMissingAlt}/${result.universal.imagesTotal}`);
  pdf.addKeyValue("Links", `${result.universal.internalLinks} internal, ${result.universal.externalLinks} external`);

  pdf.addSection("Summary");
  for (const line of result.summary.split(/\n+/).filter(Boolean).slice(0, 24)) {
    pdf.addLine({ text: line, size: 10 });
  }

  pdf.addSection("Issues");
  if (result.issues.length === 0) {
    pdf.addLine({ text: "No issues detected by the v0.1 public checks." });
  } else {
    for (const issue of result.issues.slice(0, 18)) {
      pdf.addLine({ text: `${issue.severity.toUpperCase()} - ${issue.title}`, size: 11, bold: true, color: [185, 28, 28] });
      pdf.addLine({ text: `${issue.category}. ${issue.recommendation}`, size: 9, color: [51, 65, 85], gapAfter: 6 });
    }
  }

  if (result.wordpress) {
    pdf.addSection("WordPress public fingerprints");
    pdf.addLine({ text: result.wordpress.note, color: [96, 112, 128] });
    if (result.wordpress.themeSlug) pdf.addKeyValue("Theme", result.wordpress.themeSlug);
    for (const plugin of result.wordpress.plugins.slice(0, 14)) {
      pdf.addLine({ text: `${plugin.name}: ${plugin.status}`, size: 11, bold: true });
      pdf.addLine({
        text: `Detected ${plugin.detectedVersion ?? "unknown"} / latest public ${plugin.latestKnownVersion ?? "unknown"}. ${plugin.note}`,
        size: 9,
        color: [51, 65, 85]
      });
      for (const asset of (plugin.assets ?? []).slice(0, 3)) {
        pdf.addLine({ text: `${asset.fileType}: ${asset.url} (ver ${asset.detectedVersion ?? "unknown"})`, size: 8, color: [96, 112, 128] });
      }
    }
  }

  pdf.addSection("Security and performance");
  pdf.addKeyValue("Missing security headers", result.securityHeaders.missing.join(", ") || "none");
  pdf.addKeyValue("PageSpeed status", result.pageSpeed.status);
  if (result.pageSpeed.mobile) pdf.addKeyValue("Mobile performance", result.pageSpeed.mobile.performance ?? "n/a");
  if (result.pageSpeed.desktop) pdf.addKeyValue("Desktop performance", result.pageSpeed.desktop.performance ?? "n/a");

  return pdf.finish();
}
