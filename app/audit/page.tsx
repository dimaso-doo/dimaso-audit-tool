"use client";

import { FormEvent, useEffect, useState } from "react";
import type { AuditResult } from "@/lib/audit/types";

type PdfLinks = {
  downloadUrl: string;
  viewUrl: string;
  filename: string;
  objectUrl: string;
};

export default function AuditPage() {
  const [url, setUrl] = useState("https://example.com");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLinks, setPdfLinks] = useState<PdfLinks | null>(null);

  useEffect(() => {
    return () => {
      if (pdfLinks?.objectUrl) URL.revokeObjectURL(pdfLinks.objectUrl);
    };
  }, [pdfLinks]);

  function clearPdfLinks() {
    setPdfLinks((current) => {
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      return null;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    clearPdfLinks();

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Audit failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Audit failed.");
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!result) return;
    setPdfLoading(true);
    setError(null);
    clearPdfLinks();

    try {
      const response = await fetch("/api/audit/report-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "PDF generation failed.");
      }

      const host = new URL(result.universal.finalUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
      const filename = `dimaso-audit-${host}.pdf`;
      const blob = new Blob([await response.arrayBuffer()], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      setPdfLinks({
        downloadUrl: objectUrl,
        viewUrl: objectUrl,
        filename,
        objectUrl
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="mark">D</span>
            <span>Dimaso Audit Tool</span>
          </div>
          <span className="badge">External audit MVP v0.1</span>
        </div>
      </header>

      <div className="content">
        <section className="intro">
          <div>
            <h1>Public website audit</h1>
            <p className="lead">
              Run a public-access audit for technical health, SEO basics, security headers, platform fingerprints, and optional PageSpeed data.
            </p>
          </div>
          <form className="form" onSubmit={submit}>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
            <button disabled={loading}>{loading ? "Auditing..." : "Run audit"}</button>
          </form>
        </section>

        {error ? <div className="error">{error}</div> : null}

        {result ? (
          <>
            <section className="report-actions no-print">
              <div>
                <strong>Audit report</strong>
                <span>Generate a client-ready PDF from the current audit result.</span>
              </div>
              <button type="button" onClick={downloadPdf} disabled={pdfLoading}>
                {pdfLoading ? "Preparing..." : pdfLinks ? "Regenerate PDF" : "Generate PDF"}
              </button>
              {pdfLinks ? (
                <div className="pdf-links">
                  <a href={pdfLinks.viewUrl} target="_blank" rel="noreferrer">
                    Open PDF
                  </a>
                  <a href={pdfLinks.downloadUrl} download={pdfLinks.filename}>
                    Download PDF
                  </a>
                  <span>{pdfLinks.filename}</span>
                </div>
              ) : null}
            </section>

            <section className="print-cover">
              <p className="print-kicker">Website audit report</p>
              <h1>{result.universal.finalUrl}</h1>
              <p>Prepared by Dimaso</p>
              <p>Generated {new Date(result.auditedAt).toLocaleString()}</p>
            </section>

            <section className="summary-grid" aria-label="Scores">
              <div className="metric">
                <span>Overall</span>
                <strong>{result.scores.overall}</strong>
              </div>
              {Object.entries(result.scores.categories).map(([label, score]) => (
                <div className="metric" key={label}>
                  <span>{label}</span>
                  <strong>{score}</strong>
                </div>
              ))}
            </section>

            <section className="section columns">
              <div className="panel">
                <SectionTitle icon="F" title="Audit facts" subtitle="Public homepage signals" />
                <div className="facts">
                  <Fact label="Final URL" value={result.universal.finalUrl} />
                  <Fact label="HTTP status" value={String(result.universal.statusCode)} />
                  <Fact label="HTTPS" value={result.universal.https ? "Yes" : "No"} />
                  <Fact label="Platform" value={`${result.platform.platform} (${result.platform.confidence})`} />
                  <Fact label="Title" value={result.universal.title || "Missing"} />
                  <Fact label="Meta description" value={result.universal.metaDescription || "Missing"} />
                  <Fact label="H1 count" value={String(result.universal.h1Count)} />
                  <Fact label="Canonical" value={result.universal.canonical || "Missing"} />
                  <Fact label="Open Graph tags" value={String(result.universal.openGraphTags)} />
                  <Fact label="Internal links" value={String(result.universal.internalLinks)} />
                  <Fact label="External links" value={String(result.universal.externalLinks)} />
                  <Fact label="Broken checked links" value={String(result.universal.brokenLinks.length)} />
                  <Fact label="Images missing alt" value={`${result.universal.imagesMissingAlt}/${result.universal.imagesTotal}`} />
                  <Fact label="CSS files" value={String(result.universal.cssFiles)} />
                  <Fact label="JS files" value={String(result.universal.jsFiles)} />
                  <Fact label="Tracking tools" value={String(result.tracking.detected.length)} />
                  <Fact label="Schema types" value={String(result.schema.detectedTypes.length)} />
                  <Fact label="Forms" value={String(result.forms.forms.length)} />
                </div>
              </div>

              <div className="panel">
                <SectionTitle icon="B" title="Business Impact Summary" subtitle="Prioritized explanation" />
                <p className="report-brand">by Dimaso</p>
                <p className="pre">{result.summary}</p>
                <div className="tag-row">
                  {result.platform.evidence.map((item) => (
                    <span className="tag" key={item}>
                      {item}
                    </span>
                  ))}
                </div>
                {result.platformNote ? <p className="muted">{result.platformNote}</p> : null}
                <p className="muted">{result.pageSpeed.message ?? `PageSpeed status: ${result.pageSpeed.status}`}</p>
              </div>
            </section>

            <section className="section columns">
              <div className="panel">
                <SectionTitle icon="C" title="Conversion Blockers" subtitle="CTAs, forms, contact paths, and trust signals" />
                <div className="facts">
                  <Fact label="CTA count" value={String(result.conversion.ctaCount)} />
                  <Fact label="Contact options" value={result.conversion.contactOptions.join(", ") || "None detected"} />
                  <Fact label="Offer clarity" value={result.conversion.offerClarity} />
                  <Fact label="Trust signals" value={result.conversion.trustSignals.join(", ") || "None detected"} />
                  <Fact label="Weak buttons" value={String(result.conversion.weakButtons.length)} />
                  <Fact label="Forms" value={String(result.conversion.formsCount)} />
                </div>
                <List items={result.conversion.ctaTexts} empty="No clear CTA text detected." />
              </div>
              <div className="panel">
                <SectionTitle icon="SEO" title="SEO Growth Blockers" subtitle="Metadata, headings, sitemap, schema, and indexation basics" />
                <div className="facts">
                  <Fact label="Title" value={result.universal.title ? "Present" : "Missing"} />
                  <Fact label="Meta description" value={result.universal.metaDescription ? "Present" : "Missing"} />
                  <Fact label="Canonical" value={result.universal.canonical ? "Present" : "Missing"} />
                  <Fact label="robots.txt" value={result.universal.robotsTxtExists ? "Found" : "Missing"} />
                  <Fact label="sitemap.xml" value={result.universal.sitemapXmlExists ? "Found" : "Missing"} />
                  <Fact label="Schema" value={result.schema.detectedTypes.join(", ") || "None detected"} />
                </div>
              </div>
            </section>

            <section className="section columns">
              <div className="panel">
                <SectionTitle icon="T" title="Tracking / Analytics Gaps" subtitle="Public analytics and consent hints" />
                <List items={result.tracking.detected.map((tracker) => `${tracker.name}: ${tracker.evidence.join(", ")}`)} empty="No supported tracking tools detected." />
                <p className="muted">Consent hints: {result.tracking.consentHints.join(", ") || "none detected"}</p>
              </div>
              <div className="panel">
                <SectionTitle icon="P" title="Performance Notes" subtitle="Optional PageSpeed data" />
                <Fact label="Status" value={result.pageSpeed.status} />
                {result.pageSpeed.mobile ? <Fact label="Mobile performance" value={String(result.pageSpeed.mobile.performance ?? "n/a")} /> : null}
                {result.pageSpeed.desktop ? <Fact label="Desktop performance" value={String(result.pageSpeed.desktop.performance ?? "n/a")} /> : null}
                <p className="muted">{result.pageSpeed.message ?? "Scores are from Google PageSpeed when the API key is configured."}</p>
              </div>
            </section>

            <section className="section">
              <SectionTitle icon="I" title="Issues" subtitle="Findings, confidence, and recommendations" />
              <div className="issues">
                {result.issues.length ? (
                  result.issues.map((issue, index) => (
                    <article className={`issue ${issue.severity}`} key={`${issue.title}-${index}`}>
                      <div className="issue-title">
                        <span>{issue.title}</span>
                        <span className="tag">{issue.severity}</span>
                      </div>
                      <p>{issue.recommendation}</p>
                      <p className="muted"><strong>Business impact:</strong> {issue.businessImpact}</p>
                      <List items={issue.evidence} empty="No evidence captured." />
                      <div className="tag-row">
                        <span className="tag">{issue.category}</span>
                        <span className="tag">{issue.confidence} confidence</span>
                        <span className="tag">{issue.source}</span>
                        <span className="tag">{issue.requiresAccess ? "requires access" : "public"}</span>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="panel">No issues detected by the v0.1 public checks.</div>
                )}
              </div>
            </section>

            {result.wordpress ? (
              <section className="section">
                <div className="panel">
                  <SectionTitle icon="WP" title="WordPress Assumptions" subtitle="Plugin, theme, and asset traces visible without admin access" />
                  <p className="muted">{result.wordpress.note}</p>
                  <div className="tag-row">
                    {result.wordpress.detectedTraces.map((trace) => (
                      <span className="tag" key={trace}>
                        {trace}
                      </span>
                    ))}
                    {result.wordpress.themeSlug ? <span className="tag">Theme: {result.wordpress.themeSlug}</span> : null}
                  </div>
                  <div className="plugins">
                    {result.wordpress.plugins.length ? (
                      result.wordpress.plugins.map((plugin) => (
                        <div className="plugin" key={plugin.slug}>
                          <strong>{plugin.name}</strong>
                          <div className="tag-row">
                            <span className="tag">{plugin.slug}</span>
                            <span className="tag">Detected: {plugin.detectedVersion ?? "unknown"}</span>
                            <span className="tag">Latest public: {plugin.latestKnownVersion ?? "unknown"}</span>
                            <span className="tag">{plugin.status}</span>
                          </div>
                          <p className="muted">{plugin.note}</p>
                          {(plugin.assets ?? []).length ? (
                            <div className="asset-evidence">
                              {(plugin.assets ?? []).map((asset) => (
                                <div className="asset-row" key={asset.url}>
                                  <span className="tag">{asset.fileType}</span>
                                  <span className="asset-url">{asset.url}</span>
                                  <span className="tag">ver: {asset.detectedVersion ?? "unknown"}</span>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="muted">No public plugin asset traces were detected.</p>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            <section className="section columns">
              <div className="panel">
                <SectionTitle icon="H" title="Security Observations" subtitle="HTTP response hardening checks" />
                <div className="tag-row">
                  {result.securityHeaders.present.map((header) => (
                    <span className="tag" key={header}>
                      {header}
                    </span>
                  ))}
                </div>
                <p className="muted">Missing: {result.securityHeaders.missing.join(", ") || "none"}</p>
              </div>
              <div className="panel">
                <SectionTitle icon="PL" title="Platform-Specific Notes" subtitle="What can and cannot be confirmed externally" />
                <p>{result.platformNote ?? "WordPress public fingerprinting is based on visible traces only."}</p>
                <p className="muted">Detected platform: {result.platform.platform} ({result.platform.confidence})</p>
              </div>
            </section>

            <section className="section columns">
              <div className="panel">
                <SectionTitle icon="7" title="7-Day Action Plan" subtitle="Fastest visible fixes" />
                <List items={result.actionPlan.sevenDay} empty="No urgent public actions detected." />
              </div>
              <div className="panel">
                <SectionTitle icon="30" title="30-Day Action Plan" subtitle="Follow-up improvements" />
                <List items={result.actionPlan.thirtyDay} empty="No follow-up actions detected." />
              </div>
            </section>

            <section className="section">
              <div className="panel">
                <SectionTitle icon="A" title="Requires Access For Confirmation" subtitle="Items that need admin, analytics, CMS, or server access" />
                <List items={result.actionPlan.requiresAccess} empty="No access-gated confirmations were detected." />
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function SectionTitle({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="section-title">
      <span className="section-icon">{icon}</span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="fact">
      <div className="label">{label}</div>
      <div>{value}</div>
    </div>
  );
}

function List({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? (
    <ul className="report-list">
      {items.slice(0, 12).map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="muted">{empty}</p>
  );
}
