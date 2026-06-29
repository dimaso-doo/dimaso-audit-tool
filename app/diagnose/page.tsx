"use client";

import { FormEvent, useEffect, useState } from "react";
import type { DiagnosisResult } from "@/lib/diagnosis/types";
import type { OrganizationType, PrimaryGoal } from "@/config/organizationProfiles";

type PdfLinks = {
  downloadUrl: string;
  viewUrl: string;
  filename: string;
  objectUrl: string;
};

const organizationOptions: Array<{ value: OrganizationType; label: string }> = [
  { value: "ngo", label: "NGO / network" },
  { value: "membership", label: "Membership" },
  { value: "service_business", label: "Service business" },
  { value: "ecommerce", label: "Ecommerce" },
  { value: "healthcare", label: "Healthcare" },
  { value: "education", label: "Education" },
  { value: "travel", label: "Travel / booking" },
  { value: "local_business", label: "Local business" },
  { value: "saas", label: "SaaS" },
  { value: "unknown", label: "Unknown" }
];

const goalOptions: Array<{ value: PrimaryGoal; label: string }> = [
  { value: "leads", label: "Generate leads" },
  { value: "ecommerce", label: "Sell products" },
  { value: "resources", label: "Publish resources" },
  { value: "members", label: "Manage members" },
  { value: "donations", label: "Collect donations" },
  { value: "events", label: "Promote events" },
  { value: "bookings", label: "Take bookings" },
  { value: "credibility", label: "Improve credibility" },
  { value: "rebuild", label: "Prepare for rebuild" },
  { value: "unknown", label: "Unknown" }
];

export default function DiagnosePage() {
  const [url, setUrl] = useState("https://example.com");
  const [organizationType, setOrganizationType] = useState<OrganizationType>("service_business");
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>("leads");
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
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
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, organizationType, primaryGoal })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Diagnosis failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Diagnosis failed.");
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
      const response = await fetch("/api/diagnose/report-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(result)
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "PDF generation failed.");
      }

      const host = new URL(result.site.finalUrl).hostname.replace(/[^a-z0-9.-]/gi, "-");
      const filename = `dimaso-diagnosis-${host}.pdf`;
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
            <span>Dimaso Diagnosis Engine</span>
          </div>
          <span className="badge">Consulting diagnosis MVP v0.1</span>
        </div>
      </header>

      <div className="content">
        <section className="intro diagnose-intro">
          <div>
            <h1>Website Diagnosis & Rebuild Scope Engine</h1>
            <p className="lead">
              Diagnose whether a public website needs optimization, maintenance, content restructuring, a rebuild, or a platform build.
            </p>
          </div>
          <form className="diagnosis-form" onSubmit={submit}>
            <label>
              <span>Website URL</span>
              <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" />
            </label>
            <label>
              <span>Organization type</span>
              <select value={organizationType} onChange={(event) => setOrganizationType(event.target.value as OrganizationType)}>
                {organizationOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Main website goal</span>
              <select value={primaryGoal} onChange={(event) => setPrimaryGoal(event.target.value as PrimaryGoal)}>
                {goalOptions.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="form-hint">These fields tune the diagnosis: expected pages, workflows, feature gaps, and rebuild scope.</p>
            <button disabled={loading}>{loading ? "Diagnosing..." : "Run diagnosis"}</button>
          </form>
        </section>

        {error ? <div className="error">{error}</div> : null}

        {result ? (
          <>
            <section className="report-actions no-print">
              <div>
                <strong>Diagnosis report</strong>
                <span>Generate a client-ready PDF diagnosis and internal Dimaso brief.</span>
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

            <section className="summary-grid">
              <div className="metric">
                <span>Recommendation</span>
                <strong className="word-score">{result.rebuildRecommendation.decision.replace(/_/g, " ")}</strong>
              </div>
              {Object.entries(result.scores).map(([label, score]) => (
                <div className="metric" key={label}>
                  <span>{label.replace(/[A-Z]/g, " $&")}</span>
                  <strong>{score}</strong>
                </div>
              ))}
            </section>

            <section className="section columns">
              <Panel title="Executive Diagnosis" icon="ED">
                <p>{result.clientReport.executiveDiagnosis}</p>
                <p className="muted">{result.rebuildRecommendation.why}</p>
              </Panel>
              <Panel title="Internal Dimaso Brief" icon="DB">
                <Fact label="Lead quality" value={result.internalDimasoBrief.leadQuality} />
                <Fact label="Service type" value={result.internalDimasoBrief.recommendedServiceType} />
                <Fact label="Scope" value={result.internalDimasoBrief.likelyProjectScope} />
              </Panel>
            </section>

            <section className="section columns">
              <Panel title="Main Website Problems" icon="P">
                <List items={result.clientReport.mainWebsiteProblems} />
              </Panel>
              <Panel title="Business Impact" icon="BI">
                <List items={result.clientReport.businessImpact} />
              </Panel>
            </section>

            <section className="section columns">
              <Panel title="Content & Navigation Issues" icon="IA">
                <List items={result.informationArchitecture.problems} empty="No major IA problems detected publicly." />
                <p className="muted">Suggested nav: {result.informationArchitecture.suggestedTopLevelNavigation.join(", ")}</p>
              </Panel>
              <Panel title="Workflow / Operational Issues" icon="WF">
                <List items={result.workflowAudit.filter((item) => item.status !== "present").map((item) => `${item.workflow}: ${item.recommendation}`)} />
              </Panel>
            </section>

            <section className="section columns">
              <Panel title="Feature Gap Analysis" icon="FG">
                <Fact label="Missing critical" value={result.featureGapAnalysis.missingCriticalFeatures.join(", ") || "None obvious"} />
                <Fact label="Good existing" value={result.featureGapAnalysis.goodExistingFeatures.join(", ") || "Needs review"} />
              </Panel>
              <Panel title="Scope Estimate" icon="SE">
                <Fact label="Complexity" value={result.scopeEstimate.complexity} />
                <Fact label="Timeline" value={result.scopeEstimate.estimatedTimeline} />
                <Fact label="Dimaso fit" value={result.scopeEstimate.dimasoFit} />
              </Panel>
            </section>

            <section className="section">
              <Panel title="Content Inventory" icon="CI">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>URL</th>
                        <th>Title</th>
                        <th>Words</th>
                        <th>Recommendation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.contentInventory.pages.slice(0, 25).map((page) => (
                        <tr key={page.url}>
                          <td>{page.pageType}</td>
                          <td>{page.url}</td>
                          <td>{page.title ?? "Missing"}</td>
                          <td>{page.wordCount}</td>
                          <td>{page.recommendation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            </section>

            <section className="section columns">
              <Panel title="7-Day Actions" icon="7">
                <List items={result.roadmap.sevenDay} />
              </Panel>
              <Panel title="30-Day Actions" icon="30">
                <List items={result.roadmap.thirtyDay} />
              </Panel>
            </section>

            <section className="section columns">
              <Panel title="90-Day Roadmap" icon="90">
                <List items={result.roadmap.ninetyDay} />
              </Panel>
              <Panel title="Requires Access to Confirm" icon="A">
                <List items={result.clientReport.requiresAccessToConfirm} empty="No access-gated confirmations detected." />
              </Panel>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="section-title">
        <span className="section-icon">{icon}</span>
        <div>
          <h2>{title}</h2>
          <p>Diagnosis output</p>
        </div>
      </div>
      {children}
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

function List({ items, empty = "No items detected." }: { items: string[]; empty?: string }) {
  return items.length ? (
    <ul className="report-list">
      {items.slice(0, 12).map((item, index) => (
        <li key={`${item}-${index}`}>{item}</li>
      ))}
    </ul>
  ) : (
    <p className="muted">{empty}</p>
  );
}
