export type OrganizationType =
  | "ngo"
  | "membership"
  | "service_business"
  | "ecommerce"
  | "healthcare"
  | "education"
  | "travel"
  | "local_business"
  | "saas"
  | "unknown";

export type PrimaryGoal =
  | "leads"
  | "ecommerce"
  | "resources"
  | "members"
  | "donations"
  | "events"
  | "bookings"
  | "credibility"
  | "rebuild"
  | "unknown";

export const organizationProfiles: Record<OrganizationType, { expectedFeatures: string[]; suggestedNav: string[] }> = {
  ngo: {
    expectedFeatures: ["donation", "resource_library", "events", "newsletter", "partners", "reports"],
    suggestedNav: ["About", "Programs", "Resources", "Events", "Get Involved", "Donate", "Contact"]
  },
  membership: {
    expectedFeatures: ["member_directory", "join", "events", "resource_library", "login", "working_groups"],
    suggestedNav: ["About", "Membership", "Directory", "Resources", "Events", "Committees", "Contact"]
  },
  service_business: {
    expectedFeatures: ["services", "lead_form", "phone_email", "testimonials", "case_studies", "booking"],
    suggestedNav: ["Services", "Work", "About", "Pricing", "Resources", "Contact"]
  },
  ecommerce: {
    expectedFeatures: ["products", "categories", "cart", "checkout", "shipping_returns", "reviews"],
    suggestedNav: ["Shop", "Categories", "Best Sellers", "About", "Shipping & Returns", "Contact"]
  },
  healthcare: {
    expectedFeatures: ["services", "booking", "locations", "insurance", "trust", "contact"],
    suggestedNav: ["Services", "Providers", "Locations", "Book", "Resources", "Contact"]
  },
  education: {
    expectedFeatures: ["programs", "resources", "events", "application", "faculty", "contact"],
    suggestedNav: ["Programs", "Admissions", "Resources", "Events", "About", "Contact"]
  },
  travel: {
    expectedFeatures: ["booking", "destinations", "itineraries", "reviews", "inquiry_form"],
    suggestedNav: ["Destinations", "Trips", "Book", "Reviews", "About", "Contact"]
  },
  local_business: {
    expectedFeatures: ["services", "local_area", "phone_email", "reviews", "booking"],
    suggestedNav: ["Services", "Reviews", "About", "Service Area", "Contact"]
  },
  saas: {
    expectedFeatures: ["product", "pricing", "demo", "docs", "integrations", "security"],
    suggestedNav: ["Product", "Pricing", "Resources", "Integrations", "Security", "Demo"]
  },
  unknown: {
    expectedFeatures: ["clear_offer", "contact", "tracking", "trust"],
    suggestedNav: ["About", "Services", "Resources", "Contact"]
  }
};
