export type ServiceModule = {
  id: string;
  title: string;
  description: string;
  whenRecommended: string[];
  complexity: "low" | "medium" | "high";
  typicalDeliverables: string[];
  accessRequired: string[];
  clientFacingDescription: string;
  internalNotes: string;
};

export const serviceCatalog: ServiceModule[] = [
  {
    id: "discovery-ia",
    title: "Discovery, planning and IA",
    description: "Clarify goals, audiences, page structure, and decision criteria.",
    whenRecommended: ["unclear_navigation", "content_restructure", "full_rebuild"],
    complexity: "medium",
    typicalDeliverables: ["Stakeholder workshop", "IA map", "content priorities", "implementation plan"],
    accessRequired: ["Analytics", "CMS page list"],
    clientFacingDescription: "Align the website around clear audiences, journeys, and measurable outcomes.",
    internalNotes: "Use this to de-risk larger rebuilds and scope migration."
  },
  {
    id: "ux-content",
    title: "UX/UI and content structure",
    description: "Improve templates, messaging hierarchy, and conversion paths.",
    whenRecommended: ["weak_cta", "weak_offer", "content_restructure"],
    complexity: "medium",
    typicalDeliverables: ["Wireframes", "UI direction", "content blocks", "CTA system"],
    accessRequired: ["Brand assets", "content owner input"],
    clientFacingDescription: "Make the site easier to understand and act on.",
    internalNotes: "Good fit for optimization sprint or rebuild phase one."
  },
  {
    id: "cms-content-model",
    title: "CMS implementation and structured content architecture",
    description: "Build maintainable CMS templates, fields, and content models.",
    whenRecommended: ["platform_build", "resource_library", "events", "directory"],
    complexity: "high",
    typicalDeliverables: ["CMS setup", "custom fields", "templates", "editor documentation"],
    accessRequired: ["CMS/admin", "hosting"],
    clientFacingDescription: "Give the team a maintainable publishing system instead of one-off pages.",
    internalNotes: "Bundle custom post types/content models here."
  },
  {
    id: "workflows",
    title: "Forms, notifications and operational workflows",
    description: "Improve lead, registration, booking, donation, and membership workflows.",
    whenRecommended: ["workflow_gap", "forms", "crm"],
    complexity: "medium",
    typicalDeliverables: ["Form mapping", "notifications", "CRM/list routing", "testing checklist"],
    accessRequired: ["CMS", "email/CRM", "form plugin"],
    clientFacingDescription: "Reduce manual work and make important user actions reliable.",
    internalNotes: "Often turns an audit into maintenance or build scope."
  },
  {
    id: "resource-events",
    title: "Resource library and events / conference hub",
    description: "Design searchable resources, publications, events, and conference content.",
    whenRecommended: ["ngo", "membership", "resources", "events"],
    complexity: "high",
    typicalDeliverables: ["Resource templates", "filters", "event archive", "migration plan"],
    accessRequired: ["CMS", "content inventory"],
    clientFacingDescription: "Make knowledge, events, and publications discoverable over time.",
    internalNotes: "Strong Dimaso fit for NGOs, networks, education, and member orgs."
  },
  {
    id: "migration-seo",
    title: "Content migration, redirects and technical SEO",
    description: "Move, consolidate, rewrite, and redirect existing content safely.",
    whenRecommended: ["full_rebuild", "content_restructure", "migration_risk"],
    complexity: "high",
    typicalDeliverables: ["Migration spreadsheet", "redirect map", "SEO QA", "launch checklist"],
    accessRequired: ["CMS", "Search Console", "analytics"],
    clientFacingDescription: "Preserve value while cleaning up content and URLs.",
    internalNotes: "Keep pricing internal; scope depends on inventory size."
  },
  {
    id: "analytics-accessibility-performance",
    title: "Analytics, accessibility and performance optimization",
    description: "Improve measurement, accessibility basics, and technical speed signals.",
    whenRecommended: ["tracking_gap", "accessibility", "performance"],
    complexity: "medium",
    typicalDeliverables: ["Tracking plan", "GA/GTM setup", "accessibility fixes", "performance checklist"],
    accessRequired: ["GTM/GA", "CMS", "hosting"],
    clientFacingDescription: "Make the website easier to measure, use, and maintain.",
    internalNotes: "Useful as optimization sprint or care plan setup."
  },
  {
    id: "care-plan",
    title: "Security, hosting review, training and maintenance / care plan",
    description: "Ongoing updates, monitoring, support, documentation, and training.",
    whenRecommended: ["maintenance_takeover", "wordpress", "security_headers"],
    complexity: "low",
    typicalDeliverables: ["Care plan", "training docs", "monthly checklist", "monitoring setup"],
    accessRequired: ["CMS", "hosting", "DNS where relevant"],
    clientFacingDescription: "Keep the site healthy after improvements or rebuild.",
    internalNotes: "Good recurring revenue fit."
  }
];
