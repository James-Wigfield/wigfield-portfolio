export type Plan = {
  id: string;
  name: string;
  price: string;
  blurb: string;
  perks: string[];
  available: boolean;
};

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: "Free",
    blurb: "Everything you need to get up and running.",
    perks: ["Up to 3 agents", "1 MCP connector", "Community support"],
    available: true,
  },
  {
    id: "growth",
    name: "Growth",
    price: "$49/mo",
    blurb: "For teams building momentum.",
    perks: ["Up to 15 agents", "5 MCP connectors", "Priority support"],
    available: false,
  },
  {
    id: "scale",
    name: "Scale",
    price: "$199/mo",
    blurb: "Heavier tooling for serious volume.",
    perks: ["Unlimited agents", "Unlimited connectors", "SSO & audit logs"],
    available: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Let's talk",
    blurb: "Custom builds for the whole group.",
    perks: ["Everything in Scale", "Dedicated support", "Custom contracts"],
    available: false,
  },
];

// Shared by the public form's select AND the HQ lead forms' datalists, so
// leads standardise on one vocabulary wherever they come from. Granular
// where our market actually is (trades and local operators), grouped by
// family, "Other" last.
export const INDUSTRIES = [
  "Building & Construction",
  "Electrical",
  "Plumbing & Gas",
  "HVAC & Refrigeration",
  "Landscaping & Gardening",
  "Cleaning Services",
  "Automotive & Mechanical",
  "Mining & Resources",
  "Transport & Logistics",
  "Manufacturing & Fabrication",
  "Wholesale & Distribution",
  "Retail",
  "E-commerce",
  "Cafes & Restaurants",
  "Hospitality & Venues",
  "Tourism & Events",
  "Real Estate & Property Management",
  "Recruitment & Labour Hire",
  "Accounting & Bookkeeping",
  "Legal Services",
  "Financial Services & Insurance",
  "Marketing & Creative",
  "IT & Technology",
  "Healthcare & Allied Health",
  "Fitness & Wellbeing",
  "Education & Training",
  "Agriculture & Farming",
  "Not-for-profit & Community",
  "Other",
];

/** Common contact roles at the businesses we sell to - datalist suggestions
    on the lead forms; free text is always accepted. */
export const CONTACT_ROLES = [
  "Owner",
  "Co-owner / Partner",
  "Managing Director",
  "Director",
  "General Manager",
  "Operations Manager",
  "Financial Manager",
  "Office Manager",
  "Accountant",
  "Bookkeeper",
  "Sales Manager",
  "Marketing Manager",
  "Project Manager",
  "IT Manager",
  "Administration",
];

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];
