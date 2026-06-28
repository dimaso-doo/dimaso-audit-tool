"use client";

import { FormEvent, useState } from "react";
import type { AuditResult } from "@/lib/audit/types";

const scoreLabels = ["Performance", "SEO", "Accessibility", "Security", "Technical health", "Platform risk"] as const;

export default function AuditPage() {
  const [url, setUrl] = useState("https://example.com");
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

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

    try {
      const form = document.createElement("form");
      const input = document.createElement("input");
      form.method = "POST";
      form.action = "/api/audit/report-pdf";
      form.target = "_blank";
      form.style.display = "none";
      input.type = "hidden";
      input.name = "auditResult";
      input.value = JSON.stringify(result);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
      form.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
    } finally {
      window.setTimeout(() => setPdfLoading(false), 800);
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
                {pdfLoading ? "Preparing..." : "Download PDF"}
              </button>
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
              {scoreLabels.map((label) => (
                <div className="metric" key={label}>
                  <span>{label}</span>
                  <strong>{result.scores.categories[label]}</strong>
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
                </div>
              </div>

              <div className="panel">
                <SectionTitle icon="S" title="Summary" subtitle="Prioritized explanation" />
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
                  <SectionTitle icon="WP" title="WordPress public fingerprints" subtitle="Plugin, theme, and asset traces visible without admin access" />
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
                <SectionTitle icon="H" title="Security headers" subtitle="HTTP response hardening checks" />
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
                <SectionTitle icon="P" title="PageSpeed" subtitle="Google Lighthouse field and lab metrics" />
                <Fact label="Status" value={result.pageSpeed.status} />
                {result.pageSpeed.mobile ? <Fact label="Mobile performance" value={String(result.pageSpeed.mobile.performance ?? "n/a")} /> : null}
                {result.pageSpeed.desktop ? <Fact label="Desktop performance" value={String(result.pageSpeed.desktop.performance ?? "n/a")} /> : null}
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
