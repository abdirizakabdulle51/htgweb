import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Boxes,
  ChevronDown,
  CircleCheck,
  Cloud,
  Code2,
  Database,
  Globe2,
  HardDrive,
  Menu,
  Radio,
  Server,
  ShieldCheck,
  Star,
  X,
  Zap
} from "lucide-react";
import {
  getCurrentUser as getAuthUser,
  logout as logoutUser,
  resetPassword,
  saveOnboarding,
  signInWithPassword,
  signUp,
  verifyEmail
} from "./lib/auth";
import "./styles.css";

const logoPath = "/logo.png";
const authPanelPath = "/auth-side-panel.png";
const FAVORITES_KEY = "htgclouds_favorite_services";

const authCountries = [
  {
    value: "Kenya",
    code: "KE",
    phoneCode: "+254",
    phonePlaceholder: "+254 712 123456"
  },
  {
    value: "Somalia",
    code: "SO",
    phoneCode: "+252",
    phonePlaceholder: "+252 61 1234567"
  },
  {
    value: "United Arab Emirates",
    code: "AE",
    phoneCode: "+971",
    phonePlaceholder: "+971 50 123 4567"
  },
  {
    value: "United Kingdom",
    code: "GB",
    phoneCode: "+44",
    phonePlaceholder: "+44 7400 123456"
  },
  {
    value: "United States",
    code: "US",
    phoneCode: "+1",
    phonePlaceholder: "+1 (415) 123-4567"
  }
];

function getAuthCountry(value) {
  return authCountries.find((country) => country.value === value);
}

function navigateTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new Event("popstate"));
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function getCurrentUser() {
  return getAuthUser();
}

const navItems = [
  { label: "Products", hasMenu: true },
  { label: "Solutions", hasMenu: true },
  { label: "About us" },
  { label: "Why HTG Clouds" },
  { label: "Pricing", path: "/pricing" }
];

const services = [
  {
    icon: Server,
    title: "Compute",
    text: "Elastic Cloud Servers with dedicated performance, scalable architecture, and high-speed storage."
  },
  {
    icon: Boxes,
    title: "Containers",
    text: "Managed Kubernetes platform built for resilient, distributed applications."
  },
  {
    icon: HardDrive,
    title: "Storage",
    text: "Highly durable object and block storage with automated backup and replication."
  },
  {
    icon: Globe2,
    title: "Networking",
    text: "Isolated Virtual Private Cloud, Load Balancer, Elastic IP, and secure private connectivity."
  },
  {
    icon: ShieldCheck,
    title: "Security",
    text: "Web Application Firewall, firewall protection, IAM, and encryption across all layers."
  },
  {
    icon: Database,
    title: "Database",
    text: "Managed relational databases with replication, failover, and automated recovery."
  }
];

const metrics = [
  {
    value: "99.99%",
    title: "Service Level Agreement",
    text: "Reliable infrastructure backed by resilient architecture."
  },
  {
    value: "Availability",
    title: "Zone Redundancy",
    text: "Fault isolation and automatic failover for production systems."
  },
  {
    value: "Optimized",
    title: "Network Backbone",
    text: "Low-latency connectivity designed for performance-sensitive workloads."
  },
  {
    value: "24/7",
    title: "Infrastructure Monitoring",
    text: "Real-time visibility with proactive operational oversight."
  }
];

const useCases = [
  {
    title: "SaaS Applications",
    text: "Build and scale multi-tenant SaaS products with automatic scaling, user management, and billing integration.",
    image: "/use-case-saas.png"
  },
  {
    title: "APIs & Microservices",
    text: "Deploy serverless APIs and microservices with global distribution, automatic load balancing, and sub-50ms latency.",
    image: "/use-case-apis.png"
  },
  {
    title: "Startups",
    text: "Focus on product-market fit while we handle infrastructure, scaling, and security.",
    image: "/use-case-startups.png"
  },
  {
    title: "Enterprise Apps",
    text: "Enterprise-grade security, compliance, and support.",
    image: "/use-case-enterprise.png"
  }
];

const footerColumns = [
  ["Company", "About", "Careers", "Contact"],
  ["Developers", "Documentation", "API Reference"],
  ["Resources", "Pricing", "Blog", "Reports", "Status"],
  ["Legal", "Privacy Policy", "Terms of Service"]
];

const pricingTabs = ["Compute", "Storage", "Networking", "Database & Backups"];

const computePricingSections = [
  {
    icon: Server,
    title: "General Purpose Compute",
    description:
      "Designed with a balanced CPU-to-RAM ratio for web services, enterprise applications, and production APIs.",
    rows: [
      ["GP-1", "2 GB", "1", "1 TB", "$0.025/hr"],
      ["GP-2", "4 GB", "2", "2 TB", "$0.045/hr"],
      ["GP-4", "8 GB", "4", "4 TB", "$0.090/hr"],
      ["GP-8", "16 GB", "8", "5 TB", "$0.180/hr"]
    ]
  },
  {
    icon: Boxes,
    title: "Compute Optimised",
    description:
      "Optimized for data analysis, batch processing, and high-throughput workloads that need sustained vCPU performance.",
    rows: [
      ["CO-2", "4 GB", "2", "2 TB", "$0.055/hr"],
      ["CO-4", "8 GB", "4", "4 TB", "$0.110/hr"],
      ["CO-8", "16 GB", "8", "5 TB", "$0.215/hr"],
      ["CO-16", "32 GB", "16", "8 TB", "$0.420/hr"]
    ]
  },
  {
    icon: HardDrive,
    title: "Memory Optimised",
    description:
      "Built for high-frequency computing, caching layers, databases, and parallel workloads that need larger memory footprints.",
    rows: [
      ["MO-2", "8 GB", "2", "2 TB", "$0.070/hr"],
      ["MO-4", "16 GB", "4", "4 TB", "$0.140/hr"],
      ["MO-8", "32 GB", "8", "5 TB", "$0.280/hr"],
      ["MO-16", "64 GB", "16", "8 TB", "$0.560/hr"]
    ]
  }
];

const categoryPricing = {
  Storage: {
    icon: HardDrive,
    title: "Storage Pricing",
    description: "Durable cloud storage for objects, block volumes, backups, and recovery data.",
    columns: ["Service", "Included Storage", "Transfer", "Price"],
    rows: [
      ["Object Storage", "100 GB", "1 TB outbound", "$0.018/GB/mo"],
      ["Block Storage", "50 GB volume", "Regional", "$0.080/GB/mo"],
      ["Backup Storage", "100 GB", "Encrypted", "$0.025/GB/mo"]
    ]
  },
  Networking: {
    icon: Globe2,
    title: "Networking Pricing",
    description: "Predictable pricing for public connectivity, traffic balancing, and secure network access.",
    columns: ["Service", "Included Usage", "Transfer", "Price"],
    rows: [
      ["Elastic IP", "1 IPv4 address", "Metered outbound", "$0.006/hr"],
      ["Load Balancer", "1 listener", "2 TB included", "$0.030/hr"],
      ["VPN", "Site-to-site tunnel", "Encrypted traffic", "$0.050/hr"],
      ["Data Transfer", "Regional egress", "Per GB", "$0.035/GB"]
    ]
  },
  "Database & Backups": {
    icon: Database,
    title: "Database & Backup Pricing",
    description: "Managed relational databases and protected snapshot storage for production systems.",
    columns: ["Service", "Included Capacity", "Transfer", "Price"],
    rows: [
      ["RDS PostgreSQL", "2 vCPU / 4 GB", "Backup included", "$0.075/hr"],
      ["RDS MySQL", "2 vCPU / 4 GB", "Backup included", "$0.070/hr"],
      ["Backup Service", "100 GB", "Encrypted", "$0.030/GB/mo"],
      ["Snapshot Storage", "100 GB", "Regional", "$0.020/GB/mo"]
    ]
  }
};

const pricingFaqs = [
  {
    question: "How is HTGClouds billing calculated?",
    answer:
      "Billing is calculated from the resources you run, measured by hourly compute usage, storage capacity, data transfer, and optional managed services."
  },
  {
    question: "Can I estimate monthly usage?",
    answer:
      "Yes. You can estimate monthly usage by multiplying hourly rates by expected runtime and adding storage, transfer, database, and backup usage."
  },
  {
    question: "Do you support prepaid billing?",
    answer:
      "Prepaid billing is planned for eligible business accounts. For now, pricing is shown transparently with mock rates for planning."
  },
  {
    question: "Are there hidden fees?",
    answer:
      "No. HTGClouds is designed around clear infrastructure pricing with no hidden platform fees in the displayed service categories."
  },
  {
    question: "Can I upgrade resources later?",
    answer:
      "Yes. Cloud resources are designed to scale as requirements grow, including compute size, storage capacity, and network services."
  }
];

const consolePrimaryNav = [
  { type: "item", label: "Home", path: "/dashboard", icon: "H" },
  { type: "header", label: "Favorites" },
  { type: "item", label: "Favorites", path: "/services?category=Favorites", icon: "★", category: "Favorites" },
  { type: "header", label: "Basic Cloud Services" },
  { type: "item", label: "Compute", path: "/services?category=Compute", icon: "C", category: "Compute" },
  { type: "item", label: "Storage", path: "/services?category=Storage", icon: "S", category: "Storage" },
  { type: "item", label: "Network", path: "/services?category=Network", icon: "N", category: "Network" },
  { type: "header", label: "Database" },
  { type: "item", label: "Database", path: "/services?category=Database", icon: "DB", category: "Database" },
  { type: "header", label: "Enterprise Application" },
  {
    type: "item",
    label: "Enterprise Application",
    path: "/services?category=Enterprise%20Application",
    icon: "EA",
    category: "Enterprise Application"
  },
  { type: "item", label: "Application", path: "/services?category=Application", icon: "A", category: "Application" },
  { type: "header", label: "Management Services" },
  {
    type: "item",
    label: "Management & Deployment",
    path: "/services?category=Management%20%26%20Deployment",
    icon: "MD",
    category: "Management & Deployment"
  },
  { type: "header", label: "Security Services" },
  { type: "item", label: "Security", path: "/services?category=Security", icon: "SE", category: "Security" },
  { type: "header", label: "Enterprise Intelligence Services" },
  {
    type: "item",
    label: "Enterprise Intelligence",
    path: "/services?category=Enterprise%20Intelligence",
    icon: "EI",
    category: "Enterprise Intelligence"
  },
  { type: "header", label: "Other" },
  {
    type: "item",
    label: "Monitoring & Logs",
    path: "/services?category=Monitoring%20%26%20Logs",
    icon: "M",
    category: "Monitoring & Logs"
  }
];

const consoleSecondaryNav = [
  { type: "item", label: "Billing", path: "/services?category=Billing", icon: "B", category: "Billing" },
  { type: "item", label: "Settings", path: "/services?category=Settings", icon: "ST", category: "Settings" },
  { type: "item", label: "API", path: "/services?category=API", icon: "API", category: "API" }
];

const serviceGroups = [
  {
    title: "Compute",
    accent: "var(--brand-dark)",
    services: [
      "Elastic Cloud Server",
      "Bare Metal Server",
      "Cloud Container Engine",
      "Auto Scaling",
      "Image Management Service"
    ]
  },
  {
    title: "Storage",
    accent: "var(--brand-dark)",
    services: [
      "Object Storage Service 3.0",
      "Elastic Volume Service",
      "Cloud Server Backup Service",
      "Volume Backup Service",
      "Scalable File Service",
      "Cloud Server Disaster Recovery"
    ]
  },
  {
    title: "Network",
    accent: "var(--brand-dark)",
    services: [
      "Cloud Domain Name Service",
      "VPC Endpoint",
      "Virtual Private Cloud",
      "Elastic Load Balance",
      "Cloud Connect",
      "Virtual Private Network",
      "Elastic IP",
      "Network ACL",
      "Direct Connect"
    ]
  },
  {
    title: "Database",
    accent: "var(--brand-dark)",
    services: ["GaussDB", "Relational Database Service", "Data Replication Service"]
  },
  {
    title: "Enterprise Application",
    accent: "var(--brand-dark)",
    services: ["Workspace", "AppStream"]
  },
  {
    title: "Application",
    accent: "var(--brand-dark)",
    services: [
      "Simple Message Notification",
      "ROMA Connect",
      "Distributed Cache Service",
      "Software Repository for Container"
    ]
  },
  {
    title: "Monitoring & Logs",
    accent: "var(--brand-dark)",
    services: ["Monitoring Dashboard", "Metrics", "Alerts", "Logs"]
  },
  {
    title: "Management & Deployment",
    accent: "var(--brand-dark)",
    services: ["Application Operation Management", "Log Tank Service", "Recycle Bin"]
  },
  {
    title: "Security",
    accent: "var(--brand-dark)",
    services: [
      "Cloud Bastion Host",
      "Web Application Firewall",
      "SecMaster",
      "CFW for HCS",
      "Security Index Service",
      "Database Audit Service",
      "Edge Firewall",
      "Host Security Service"
    ]
  },
  {
    title: "Enterprise Intelligence",
    accent: "var(--brand-dark)",
    services: ["Data Warehouse Service", "MapReduce Service"]
  }
];

function getConsoleContext(user) {
  return {
    projectName:
      user?.projectName ||
      "My First Project",
    region:
      user?.selectedRegion ||
      "US-East",
    organization:
      user?.organizationName ||
      user?.company ||
      user?.fullName ||
      "HTGClouds"
  };
}

function readFavorites() {
  return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
}

function writeFavorites(favorites) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

function getAllServiceEntries() {
  return serviceGroups.flatMap((group) =>
    group.services.map((service) => ({
      name: service,
      group: group.title,
      accent: group.accent
    }))
  );
}

function App() {
  const [route, setRoute] = useState(window.location.pathname + window.location.search);
  const path = route.split("?")[0];

  useEffect(() => {
    const handleRoute = () => setRoute(window.location.pathname + window.location.search);
    window.addEventListener("popstate", handleRoute);
    return () => window.removeEventListener("popstate", handleRoute);
  }, []);

  if (path === "/signup") return <SignUpPage />;
  if (path === "/signin") return <SignInPage />;
  if (path === "/verify-email") return <VerifyEmailPage />;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/reset-password") return <ResetPasswordPage />;
  if (path === "/recovery-link-sent") return <RecoveryLinkSentPage />;
  if (path === "/onboarding") return <OnboardingPage />;
  if (path === "/dashboard") return <DashboardRoute />;
  if (path === "/services") return <ServicesRoute />;
  if (path === "/pricing") return <PricingPage />;

  return (
    <main>
      <Navigation />
      <Hero />
      <LogoCloud />
      <Services />
      <Infrastructure />
      <Reliability />
      <UseCases />
      <Testimonials />
      <Footer />
    </main>
  );
}

function RouteRedirect({ to }) {
  useEffect(() => {
    navigateTo(to);
  }, [to]);

  return null;
}

function ReplacePath({ to, children }) {
  useEffect(() => {
    if (window.location.pathname + window.location.search !== to) {
      window.history.replaceState({}, "", to);
      window.dispatchEvent(new Event("popstate"));
    }
  }, [to]);

  return children;
}

function DashboardRoute() {
  const { user, loading } = useCurrentUser();
  if (loading) return null;
  if (!user) {
    return (
      <ReplacePath to="/signin">
        <SignInPage />
      </ReplacePath>
    );
  }
  if (!user.onboardingCompleted) {
    return (
      <ReplacePath to="/onboarding">
        <OnboardingWizard user={user} />
      </ReplacePath>
    );
  }

  return <DashboardPage user={user} />;
}

function ServicesRoute() {
  const { user, loading } = useCurrentUser();
  if (loading) return null;
  if (!user) {
    return (
      <ReplacePath to="/signin">
        <SignInPage />
      </ReplacePath>
    );
  }
  if (!user.onboardingCompleted) {
    return (
      <ReplacePath to="/onboarding">
        <OnboardingWizard user={user} />
      </ReplacePath>
    );
  }

  return <ServicesPage user={user} />;
}

function useCurrentUser() {
  const [state, setState] = useState({ user: null, loading: true });

  useEffect(() => {
    let active = true;
    getCurrentUser().then((user) => {
      if (active) setState({ user, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function Navigation() {
  return (
    <header className="site-header">
      <a
        className="brand"
        href="/"
        aria-label="HTGClouds home"
        onClick={(event) => {
          event.preventDefault();
          navigateTo("/");
        }}
      >
        <img src={logoPath} alt="HTGClouds" />
      </a>
      <nav className="desktop-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.path || "#"}
            onClick={(event) => {
              if (!item.path) return;
              event.preventDefault();
              navigateTo(item.path);
            }}
          >
            {item.label}
            {item.hasMenu && <ChevronDown size={12} strokeWidth={2.4} />}
          </a>
        ))}
      </nav>
      <div className="nav-actions">
        <a
          className="button button-dark"
          href="/signup"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/signup");
          }}
        >
          Start for Free
        </a>
        <a
          className="signin"
          href="/signin"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/signin");
          }}
        >
          Sign In
        </a>
        <button className="menu-button" aria-label="Open navigation">
          <Menu size={20} />
        </button>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero-shell">
      <div className="cloud-left" />
      <div className="cloud-right" />
      <div className="hero-content">
        <h1>Enterprise Cloud Infrastructure Without Compromise</h1>
        <p>
          HTGClouds provides high-performance cloud infrastructure that supports
          production workloads at any scale, from fast-growing startups to large
          enterprises.
        </p>
        <a
          className="button button-dark hero-cta"
          href="/signup"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/signup");
          }}
        >
          Start Free Trial
        </a>
        <div className="trust-row">
          <span>
            <Zap size={14} /> Multi-AZ Architecture
          </span>
          <span>
            <CircleCheck size={14} /> 99.99% SLA
          </span>
          <span>
            <ShieldCheck size={14} /> Enterprise Security
          </span>
        </div>
      </div>
      <DocumentationPreview />
    </section>
  );
}

function PricingPage() {
  const [activeTab, setActiveTab] = useState("Compute");

  return (
    <main className="pricing-page">
      <Navigation />
      <section className="pricing-hero">
        <span>Pricing</span>
        <h1>Affordable, High-Performance Cloud VPS</h1>
        <p>
          HTGClouds provides reliable cloud infrastructure with transparent
          pricing for compute, storage, networking, databases, and backups.
        </p>
        <a
          className="button button-dark"
          href="/signup"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/signup");
          }}
        >
          Start Free Trial
        </a>
      </section>

      <section className="pricing-shell">
        <aside className="pricing-tabs" aria-label="Pricing categories">
          {pricingTabs.map((tab) => (
            <button
              className={activeTab === tab ? "active" : ""}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </aside>
        <div className="pricing-panels">
          {activeTab === "Compute" ? (
            computePricingSections.map((section) => (
              <PricingComputeCard key={section.title} section={section} />
            ))
          ) : (
            <PricingCategoryPanel category={categoryPricing[activeTab]} />
          )}
        </div>
      </section>

      <PricingFaq />
      <PricingCta />
      <Footer />
    </main>
  );
}

function PricingComputeCard({ section }) {
  const Icon = section.icon;

  return (
    <article className="pricing-card">
      <div className="pricing-card-copy">
        <div className="pricing-icon">
          <Icon size={20} />
        </div>
        <h2>{section.title}</h2>
        <p>{section.description}</p>
        <a href="#">Learn more <span aria-hidden="true">-&gt;</span></a>
      </div>
      <PricingTable
        label="Base rate"
        columns={["Name", "Memory", "vCore", "Network", "Price per hour"]}
        rows={section.rows}
      />
    </article>
  );
}

function PricingCategoryPanel({ category }) {
  const Icon = category.icon;

  return (
    <article className="pricing-card pricing-card-single">
      <div className="pricing-card-copy">
        <div className="pricing-icon">
          <Icon size={20} />
        </div>
        <h2>{category.title}</h2>
        <p>{category.description}</p>
        <a href="#">Learn more <span aria-hidden="true">-&gt;</span></a>
      </div>
      <PricingTable label="Base rate" columns={category.columns} rows={category.rows} />
    </article>
  );
}

function PricingTable({ label, columns, rows }) {
  return (
    <div className="pricing-table-wrap">
      <h3>{label}</h3>
      <div className="pricing-table-scroll">
        <table className="pricing-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.join("-")}>
                {row.map((cell, index) => (
                  <td key={`${cell}-${index}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingFaq() {
  return (
    <section className="pricing-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds pricing.</p>
      </div>
      <div className="pricing-faq-list">
        {pricingFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function PricingCta() {
  return (
    <section className="pricing-cta">
      <div>
        <h2>Ready to Optimize Your Network?</h2>
      </div>
      <div>
        <p>
          HTGClouds empowers businesses and telecom operators with secure,
          scalable cloud infrastructure.
        </p>
        <a
          href="/signup"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/signup");
          }}
        >
          Start Free Trial
        </a>
      </div>
    </section>
  );
}

function DocumentationPreview() {
  return (
    <div className="docs-preview" aria-label="Developer documentation preview">
      <aside className="docs-sidebar">
        <span>Developer documentation</span>
        {["Quickstart", "Install the SDK", "Authenticate requests", "Deploy to Acme", "Concepts", "Guides"].map(
          (item) => (
            <small key={item}>{item}</small>
          )
        )}
      </aside>
      <section className="docs-main">
        <div className="crumbs">ACME API / API REFERENCE / SECURITY</div>
        <h2>Auth tokens</h2>
        <p>
          Manage the tokens used to authenticate requests to the Acme API. Create
          and rotate tokens for users and services accessing clusters and
          workloads.
        </p>
        <h3>The AuthToken object</h3>
        <div className="code-card">
          <code>{`backend: "custom"`}</code>
        </div>
      </section>
      <aside className="docs-toc">
        <strong>The AuthToken object</strong>
        <span>GET Get an auth token</span>
        <span>PATCH Update an auth token</span>
        <span>POST Regenerate an auth token</span>
      </aside>
    </div>
  );
}

function LogoCloud() {
  return (
    <section className="logo-cloud" aria-label="Trusted companies">
      <p>From visionary startups to industry leaders.</p>
      <div>
        {["ssPay", "fliuz", "ferry", "BNY", "pingpong", "AtoB", "Gynger"].map(
          (name) => (
            <span key={name}>{name}</span>
          )
        )}
      </div>
    </section>
  );
}

function Services() {
  return (
    <section className="section services">
      <div className="section-heading">
        <h2>Production-Ready Cloud Services</h2>
        <p>
          Deploy, secure, and scale with a complete suite of enterprise-grade
          cloud services.
        </p>
      </div>
      <div className="service-grid">
        {services.map(({ icon: Icon, title, text }) => (
          <article className="service-card" key={title}>
            <div className="icon-tile">
              <Icon size={20} />
            </div>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Infrastructure() {
  return (
    <section className="section suite">
      <h2>Complete Cloud Infrastructure Suite</h2>
      <div className="suite-grid">
        <article className="security-panel">
          <h3>Security Embedded Across Every Layer</h3>
          <p>
            Provision infrastructure through Console, API, or Terraform.
            Standardize environments, reduce manual configuration.
          </p>
          <ul>
            <li>Encryption at rest and in transit</li>
            <li>Role-based identity and access control</li>
            <li>Network segmentation and firewall enforcement</li>
            <li>Web Application Firewall and DDoS protection</li>
            <li>Enterprise-grade backup and disaster recovery</li>
          </ul>
          <div className="compliance-orbit">
            <span>GDPR</span>
            <span>SOC Type 2</span>
            <span>HIPAA</span>
            <span>ISO</span>
            <div>
              <Cloud size={34} fill="currentColor" />
            </div>
          </div>
        </article>
        <div className="suite-stack">
          <article className="info-panel deploy-panel">
            <div>
              <h3>Deploy at Enterprise Speed</h3>
              <p>
                Standardize environments, reduce manual configuration, and scale
                on demand.
              </p>
              <ul>
                <li>Dedicated VPC environments</li>
                <li>Auto scaling and load balancing</li>
                <li>Infrastructure as Code support</li>
                <li>Integrated monitoring and observability</li>
              </ul>
              <a href="#">View Deployment Guide</a>
            </div>
            <div className="mini-dashboard">
              <div className="dashboard-head">
                <span>Deployment Speed</span>
                <b>V2.3</b>
              </div>
              <div className="speed-metrics">
                <span>
                  MAX in Minutes <b>14.0</b>
                </span>
                <em>vs</em>
                <span>
                  MIN in Minutes <b>0.8</b>
                </span>
              </div>
            </div>
          </article>
          <article className="info-panel pricing-panel">
            <div>
              <h3>Transparent Pricing. Enterprise Flexibility</h3>
              <p>
                Predictable pricing models with no hidden infrastructure charges.
                Scale resources as needed or secure dedicated enterprise
                agreements.
              </p>
              <a href="#">Explore our Pricing</a>
            </div>
            <div className="control-panel">
              <div className="tabs">
                <span>vCPU</span>
                <span>RAM</span>
              </div>
              <label>
                vCPU performance <b>100%</b>
                <input type="range" min="2" max="80" defaultValue="54" />
              </label>
              <div className="toggle-row">
                Spending limit <span />
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

function Reliability() {
  return (
    <section className="section reliability">
      <h2>Built for Continuous Uptime</h2>
      <div className="metric-grid">
        {metrics.map((metric) => (
          <article key={metric.value}>
            <h3>{metric.value}</h3>
            <strong>{metric.title}</strong>
            <p>{metric.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function UseCases() {
  return (
    <section className="section use-cases">
      <h2>Built for every use case</h2>
      <div className="use-case-grid">
        {useCases.map((item) => (
          <article className="use-case-card" key={item.title}>
            <img src={item.image} alt={`${item.title} use case`} />
            <div className="sr-only">
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="section testimonials">
      <h2>Trusted by Leading Businesses</h2>
      <p>
        Join the companies that rely on HTGClouds for their mission-critical
        connectivity needs.
      </p>
      <div className="testimonial-grid">
        {[1, 2, 3].map((item) => (
          <article className="testimonial-card" key={item}>
            <div className="stars" aria-label="Five star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={14} fill="currentColor" />
              ))}
            </div>
            <blockquote>
              "HTG Clouds has been instrumental in supporting our rapid growth.
              The 99.9% uptime SLA is not just a promise - they consistently
              deliver."
            </blockquote>
            <div className="author">
              <span className="avatar">OD</span>
              <span>
                <strong>Olivia Davis</strong>
                CTO @ Telecom Solutions
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function AuthLayout({ children, compact = false }) {
  return (
    <main className={`auth-page${compact ? " auth-page-compact" : ""}`}>
      <section className="auth-shell">
        <div className="auth-form-panel">{children}</div>
        <aside className="auth-side" aria-label="HTGClouds customer trust panel">
          <img src={authPanelPath} alt="" />
        </aside>
      </section>
    </main>
  );
}

function AuthHeader({ title, subtitle, actionText, actionPath, actionLabel }) {
  return (
    <header className="auth-header">
      <a
        className="auth-logo"
        href="/"
        onClick={(event) => {
          event.preventDefault();
          navigateTo("/");
        }}
      >
        <img src={logoPath} alt="HTGClouds" />
      </a>
      <h1>{title}</h1>
      {subtitle && (
        <p>
          {subtitle}{" "}
          {actionPath && (
            <a
              href={actionPath}
              onClick={(event) => {
                event.preventDefault();
                navigateTo(actionPath);
              }}
            >
              {actionText}
            </a>
          )}
        </p>
      )}
      {actionLabel && <p>{actionLabel}</p>}
    </header>
  );
}

function SignUpPage() {
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    country: "",
    phone: "",
    company: ""
  });
  const [error, setError] = useState("");
  const selectedCountry = getAuthCountry(form.country);
  const phonePlaceholder = selectedCountry?.phonePlaceholder || "+1 (415) 123-4567";

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!form.fullName || !form.email || !form.password || !form.company) {
      setError("Please complete the required fields.");
      return;
    }

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    const email = form.email.trim().toLowerCase();
    try {
      await signUp({
        ...form,
        email,
        countryCode: selectedCountry?.code || "",
        phoneCountryCode: selectedCountry?.phoneCode || ""
      });
      navigateTo(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card auth-card-wide" onSubmit={handleSubmit}>
        <AuthHeader
          title="Welcome to HTGClouds"
          subtitle="Already have an account?"
          actionText="Sign In"
          actionPath="/signin"
        />
        <label>
          Full Name
          <input
            required
            value={form.fullName}
            onChange={(event) => updateField("fullName", event.target.value)}
            placeholder="Enter your full name"
          />
        </label>
        <label>
          Work Email
          <input
            required
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="Enter your work email"
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => updateField("password", event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        <div className="auth-field-row">
          <label>
            Country
            <select
              value={form.country}
              onChange={(event) => updateField("country", event.target.value)}
            >
              <option value="">Select country</option>
              {authCountries.map((country) => (
                <option
                  key={country.code}
                  value={country.value}
                  data-country-code={country.code}
                  data-phone-code={country.phoneCode}
                >
                  {country.value}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phone Number
            <input
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              placeholder={phonePlaceholder}
            />
          </label>
        </div>
        <label>
          Company Name
          <input
            required
            value={form.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder="Enter your company name"
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" type="submit">
          Create Account
        </button>
        <p className="auth-terms">
          By creating an account, you agree to our <a href="#">Privacy policy</a>
        </p>
      </form>
    </AuthLayout>
  );
}

function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSignIn(event) {
    event.preventDefault();
    console.log("[SIGNIN] Button clicked");
    setError("");

    try {
      console.log("[SIGNIN] Sending request");
      const data = await signInWithPassword(email, password);
      console.log("[SIGNIN] Response received", {
        success: data.success,
        emailVerified: data.emailVerified,
        onboardingCompleted: data.onboardingCompleted
      });

      if (!data.emailVerified) {
        throw new Error("Please verify your email before signing in.");
      }

      const redirectTarget = data.onboardingCompleted ? "/dashboard" : "/onboarding";
      console.log(`[SIGNIN] Redirecting to ${redirectTarget}`);
      navigateTo(redirectTarget);
    } catch (error) {
      console.error("[SIGNIN] Failed", error);
      setError(error.message || "Email or password is incorrect.");
      return;
    }
  }

  return (
    <AuthLayout compact>
      <form className="auth-card" onSubmit={handleSignIn}>
        <AuthHeader
          title="Welcome to HTGClouds"
          subtitle="Don't have an account?"
          actionText="Sign Up"
          actionPath="/signup"
        />
        <label>
          Work Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your work email"
          />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        <a
          className="forgot-link"
          href="/forgot-password"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/forgot-password");
          }}
        >
          Forgot password?
        </a>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" type="submit">
          Sign In
        </button>
        <p className="demo-hint">Demo: demo@htgclouds.com / password123</p>
      </form>
    </AuthLayout>
  );
}

function VerifyEmailPage() {
  const pendingEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("email") || "";
  }, []);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");

  function updateDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setCode((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit) {
      const nextInput = document.querySelector(`[data-code-index="${index + 1}"]`);
      nextInput?.focus();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const joined = code.join("");
    if (joined.length !== 6) {
      setError("Enter any 6-digit verification code.");
      return;
    }

    try {
      const data = await verifyEmail({ email: pendingEmail, code: joined });
      console.log("[AUTH] verification success");
      console.log("[AUTH] onboarding status", data.onboardingCompleted);
      const redirectTarget = data.onboardingCompleted ? "/dashboard" : "/onboarding";
      console.log("[AUTH] redirect target", redirectTarget);
      navigateTo(redirectTarget);
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-card auth-card-centered" onSubmit={handleSubmit}>
        <AuthHeader title="Verify your email" actionLabel={`We sent a verification code to ${pendingEmail || "your email"}`} />
        <label className="code-label">Verification Code</label>
        <div className="code-inputs">
          {code.map((digit, index) => (
            <input
              key={index}
              data-code-index={index}
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(event) => updateDigit(index, event.target.value)}
              aria-label={`Verification digit ${index + 1}`}
            />
          ))}
        </div>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" type="submit">
          Verify Email
        </button>
        <p className="auth-terms">
          Didn't receive the code? <button type="button">Resend email</button>
        </p>
      </form>
    </AuthLayout>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    navigateTo(`/recovery-link-sent?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  return (
    <AuthLayout compact>
      <form className="auth-card" onSubmit={handleSubmit}>
        <AuthHeader
          title="Reset Password"
          actionLabel="Please create a new password 8+ characters long to access your account."
        />
        <label>
          Work Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Enter your work email"
          />
        </label>
        <button className="auth-submit" type="submit">
          Reset Password
        </button>
      </form>
    </AuthLayout>
  );
}

function RecoveryLinkSentPage() {
  const pendingEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("email") || "";
  }, []);

  return (
    <AuthLayout compact>
      <div className="auth-card auth-card-centered">
        <AuthHeader
          title="Recovery link sent!"
          actionLabel="If the email exists in our system, you'll receive a reset email shortly. Can't find it? Check your spam folder."
        />
        <button
          className="auth-submit"
          type="button"
          onClick={() => navigateTo(`/reset-password?email=${encodeURIComponent(pendingEmail)}`)}
        >
          Continue
        </button>
      </div>
    </AuthLayout>
  );
}

function ResetPasswordPage() {
  const pendingEmail = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("email") || "";
  }, []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await resetPassword({ email: pendingEmail, password });
      navigateTo("/signin");
    } catch (error) {
      setError(error.message);
    }
  }

  return (
    <AuthLayout compact>
      <form className="auth-card" onSubmit={handleSubmit}>
        <AuthHeader
          title="Reset Password"
          actionLabel="Please create a new password 8+ characters long to access your account."
        />
        <label>
          Password
          <input
            required
            type="password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        <label>
          Confirm new password
          <input
            required
            type="password"
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="At least 8 characters"
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="auth-submit" type="submit">
          Reset Password
        </button>
      </form>
    </AuthLayout>
  );
}

function ConsoleLayout({ activePath, children, user }) {
  const { user: loadedUser } = useCurrentUser();
  const context = getConsoleContext(user || loadedUser);
  const activeCategory =
    new URLSearchParams(window.location.search).get("category") || "Compute";

  return (
    <main className="console-app">
      <aside className="console-sidebar">
        <div className="project-selector">
          <span className="project-mark" />
          <div>
            <strong>{context.projectName}</strong>
            <small>{context.region}</small>
          </div>
          <button type="button" aria-label="Switch project">
            <Boxes size={16} />
          </button>
        </div>
        <nav className="console-nav" aria-label="Console navigation">
          {consolePrimaryNav.map((item, index) => (
            <ConsoleNavItem
              key={`${item.type}-${item.label}-${index}`}
              item={item}
              activePath={activePath}
              activeCategory={activeCategory}
            />
          ))}
        </nav>
        <nav className="console-nav console-nav-bottom" aria-label="Console utilities">
          {consoleSecondaryNav.map((item) => (
            <ConsoleNavItem
              key={item.label}
              item={item}
              activePath={activePath}
              activeCategory={activeCategory}
            />
          ))}
        </nav>
      </aside>
      <section className="console-main">
        <ConsoleTopBar context={context} />
        <div className="console-content">{children}</div>
      </section>
    </main>
  );
}

function ConsoleNavItem({ item, activePath, activeCategory }) {
  if (item.type === "header") {
    return <div className="console-nav-section">{item.label}</div>;
  }

  const active =
    (item.label === "Home" && activePath === "/dashboard") ||
    (activePath === "/services" && item.category === activeCategory);
  return (
    <a
      className={`console-nav-item${active ? " active" : ""}`}
      href={item.path}
      onClick={(event) => {
        event.preventDefault();
        navigateTo(item.path);
      }}
    >
      <span>{item.icon}</span>
      {item.label}
      {["Compute", "Network", "Storage", "Database"].includes(item.label) && (
        <ChevronDown size={13} />
      )}
    </a>
  );
}

function ConsoleTopBar({ context }) {
  const [open, setOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const createItems = ["Compute", "Storage", "Network", "Database"];

  async function handleLogout() {
    await logoutUser();
    setUserMenuOpen(false);
    navigateTo("/signin");
  }

  return (
    <header className="console-topbar">
      <div className="console-breadcrumb">
        <span>{context.organization}</span>
        <strong>{context.projectName}</strong>
      </div>
      <div className="console-actions">
        <div className="create-menu">
          <button className="create-button" type="button" onClick={() => setOpen(!open)}>
            Create
          </button>
          {open && (
            <div className="create-dropdown">
              {createItems.map((item) => (
                <a
                  key={item}
                  href={`/services?category=${encodeURIComponent(item)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    setOpen(false);
                    navigateTo(`/services?category=${encodeURIComponent(item)}`);
                  }}
                >
                  <span>{item.slice(0, 1)}</span>
                  {item}
                </a>
              ))}
            </div>
          )}
        </div>
        <button type="button" aria-label="Help">?</button>
        <button type="button" aria-label="Notifications">!</button>
        <div className="user-menu">
          <button
            className="user-avatar-button"
            type="button"
            aria-label="User menu"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <span>{context.organization.slice(0, 1).toUpperCase()}</span>
            <ChevronDown size={15} />
          </button>
          {userMenuOpen && (
            <div className="create-dropdown user-dropdown">
              <button type="button" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function DashboardPage({ user }) {
  const { user: loadedUser } = useCurrentUser();
  const context = getConsoleContext(user || loadedUser);
  const quickActions = [
    {
      title: "Compute",
      text: "Spin up powerful, customizable servers with full control over your infrastructure.",
      action: "Create Cluster",
      icon: "C"
    },
    {
      title: "Storage",
      text: "Provision resilient object and block storage for production cloud workloads.",
      action: "Create Storage",
      icon: "S"
    },
    {
      title: "Networking",
      text: "Protect your resources with customizable private networks and firewall rules.",
      action: "Create VPC Network",
      icon: "N",
      category: "Network"
    }
  ];

  return (
    <ConsoleLayout activePath="/dashboard" user={user || loadedUser}>
      <section className="console-card dashboard-home">
        <div className="console-title-row">
          <div>
            <h1>Home</h1>
            <p>
              {context.organization} · {context.region}
            </p>
          </div>
        </div>
        <div className="setup-grid">
          <article className="setup-card">
            <div className="setup-illustration" aria-hidden="true">
              <div />
              <span />
            </div>
            <div>
              <h2>Finalize your setup</h2>
              <p>
                Add a payment method to seamlessly spin up your first resource.
                Still exploring? Check out our docs to learn more about what you
                can accomplish with HTG Clouds.
              </p>
              <button type="button">Add Payment</button>
            </div>
          </article>
          <div className="balance-stack">
            {["Current Balance", "Upcoming Charges"].map((label) => (
              <article className="balance-card" key={label}>
                <h3>{label}</h3>
                <strong>$0.00</strong>
                <a href="#">View Breakdown</a>
              </article>
            ))}
          </div>
        </div>
        <section className="quick-actions">
          <h2>Quick Actions</h2>
          <div className="quick-action-grid">
            {quickActions.map((item) => (
              <article className="quick-action-card" key={item.title}>
                <div className="quick-image">
                  <span>{item.icon}</span>
                </div>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
                <a
                  href={`/services?category=${encodeURIComponent(item.category || item.title)}`}
                  onClick={(event) => {
                    event.preventDefault();
                    navigateTo(`/services?category=${encodeURIComponent(item.category || item.title)}`);
                  }}
                >
                  {item.action}
                </a>
              </article>
            ))}
          </div>
        </section>
      </section>
    </ConsoleLayout>
  );
}

function ServicesPage({ user }) {
  const selectedCategory =
    new URLSearchParams(window.location.search).get("category") || "Compute";
  const selectedGroup = serviceGroups.find((group) => group.title === selectedCategory);
  const [favorites, setFavorites] = useState(readFavorites);
  const utilityGroups = {
    Billing: {
      title: "Billing",
      accent: "var(--brand-dark)",
      services: ["Billing Order Service"]
    },
    Settings: {
      title: "Settings",
      accent: "var(--brand-dark)",
      services: ["Project Settings", "Access Management", "Organization Profile"]
    },
    API: {
      title: "API",
      accent: "var(--brand-dark)",
      services: ["API Credentials", "API Explorer", "Access Keys"]
    }
  };
  const favoriteEntries = getAllServiceEntries().filter((entry) =>
    favorites.includes(entry.name)
  );
  const activeGroup =
    selectedCategory === "Favorites"
      ? { title: "Favorites", accent: "var(--brand-dark)", entries: favoriteEntries }
      : selectedGroup
        ? {
            title: selectedGroup.title,
            accent: selectedGroup.accent,
            entries: selectedGroup.services.map((service) => ({
              name: service,
              group: selectedGroup.title,
              accent: selectedGroup.accent
            }))
          }
        : utilityGroups[selectedCategory]
          ? {
              title: utilityGroups[selectedCategory].title,
              accent: utilityGroups[selectedCategory].accent,
              entries: utilityGroups[selectedCategory].services.map((service) => ({
                name: service,
                group: utilityGroups[selectedCategory].title,
                accent: utilityGroups[selectedCategory].accent
              }))
            }
          : {
              title: serviceGroups[0].title,
              accent: serviceGroups[0].accent,
              entries: serviceGroups[0].services.map((service) => ({
                name: service,
                group: serviceGroups[0].title,
                accent: serviceGroups[0].accent
              }))
            };

  function toggleFavorite(serviceName) {
    setFavorites((current) => {
      const next = current.includes(serviceName)
        ? current.filter((item) => item !== serviceName)
        : [...current, serviceName];
      writeFavorites(next);
      return next;
    });
  }

  return (
    <ConsoleLayout activePath="/services" user={user}>
      <section className="service-catalog console-card">
        <div className="service-catalog-header">
          <div>
            <h1>{activeGroup.title}</h1>
            <p>
              Select a category from the HTGClouds sidebar to view its available
              cloud services.
            </p>
          </div>
          <input aria-label="Search services" placeholder={`Search ${activeGroup.title}`} />
        </div>
        <section
          className="service-group"
          id={activeGroup.title.toLowerCase().replaceAll(" ", "-")}
        >
          {activeGroup.title === "Favorites" && activeGroup.entries.length === 0 ? (
            <div className="empty-favorites">No favorite services yet.</div>
          ) : (
            <div className="catalog-grid">
              {activeGroup.entries.map((service) => {
                const isFavorite = favorites.includes(service.name);
                return (
                  <article
                    className={`catalog-service-card${isFavorite ? " selected" : ""}`}
                    key={`${service.group}-${service.name}`}
                    tabIndex={0}
                    role="link"
                    aria-label={`${service.name} service`}
                  >
                    <span
                      className="catalog-icon"
                      style={{ "--service-accent": service.accent }}
                    >
                      {service.name
                        .split(" ")
                        .map((word) => word[0])
                        .join("")
                        .slice(0, 2)}
                    </span>
                    <div>
                      <h3>{service.name}</h3>
                      <p>{getServiceDescription(service.name, service.group)}</p>
                    </div>
                    <button
                      className={`favorite-star${isFavorite ? " active" : ""}`}
                      type="button"
                      aria-label={
                        isFavorite
                          ? `Remove ${service.name} from favorites`
                          : `Add ${service.name} to favorites`
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleFavorite(service.name);
                      }}
                    >
                      <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </ConsoleLayout>
  );
}

function getServiceDescription(service, group) {
  const lowerGroup = group.toLowerCase();
  if (lowerGroup.includes("compute")) return "Deploy scalable compute resources for cloud-native workloads.";
  if (lowerGroup.includes("storage")) return "Store, protect, and recover critical cloud data.";
  if (lowerGroup.includes("network")) return "Connect, isolate, and secure traffic across your cloud estate.";
  if (lowerGroup.includes("database")) return "Run managed data services with replication and recovery.";
  if (lowerGroup.includes("security")) return "Strengthen access, inspection, and threat protection.";
  if (lowerGroup.includes("management")) return "Operate, observe, and govern resources across projects.";
  if (lowerGroup.includes("intelligence")) return "Analyze and process enterprise data at scale.";
  if (service.includes("Billing")) return "View orders and billing operations for your cloud account.";
  return "Launch and manage this service from the HTGClouds console.";
}

function OnboardingPage() {
  const { user, loading } = useCurrentUser();

  if (loading) return null;

  if (!user) {
    return (
      <ReplacePath to="/signin">
        <SignInPage />
      </ReplacePath>
    );
  }

  if (user.onboardingCompleted) {
    return (
      <ReplacePath to="/dashboard">
        <DashboardPage user={user} />
      </ReplacePath>
    );
  }

  return <OnboardingWizard user={user} />;
}

function OnboardingWizard({ user }) {
  const context = getConsoleContext(user);
  const products = [
    { name: "Elastic Cloud Server", code: "EC", text: "Scalable virtual machines for production workloads." },
    { name: "Storage", code: "S", text: "Durable object and block storage for cloud data." },
    { name: "Bare Metal Server", code: "BM", text: "Dedicated compute for performance-sensitive systems." },
    { name: "Database", code: "D", text: "Managed relational databases with backup and recovery." }
  ];
  const usageOptions = ["Work", "School", "Personal"];
  const providerOptions = ["Yes", "No"];
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    organizationName: user?.company || context.organization,
    projectName: context.projectName,
    selectedRegion: context.region,
    useCase: "Work",
    alreadyUsesCloudProvider: "No",
    productsInterest: []
  });

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function toggleProduct(product) {
    setForm((current) => ({
      ...current,
      productsInterest: current.productsInterest.includes(product)
        ? current.productsInterest.filter((item) => item !== product)
        : [...current.productsInterest, product]
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (step < 3) {
      setStep((current) => current + 1);
      return;
    }

    console.log("[AUTH] onboarding status", false);
    await saveOnboarding(form);
    console.log("[AUTH] onboarding status", true);
    console.log("[AUTH] redirect target", "/dashboard");
    navigateTo("/dashboard");
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-backdrop" aria-hidden="true">
        <DashboardPage />
      </div>
      <form className="onboarding-card" onSubmit={handleSubmit}>
        <div className="onboarding-preview" aria-hidden="true">
          <span />
          <strong />
          <em />
        </div>

        {step > 0 && (
          <div className="onboarding-progress">
            <span>Step {step} of 3</span>
            <div aria-hidden="true">
              {[1, 2, 3].map((item) => (
                <strong className={item <= step ? "active" : ""} key={item} />
              ))}
            </div>
          </div>
        )}

        {step === 0 && (
          <section className="onboarding-step">
            <h1>Welcome to HTG Cloud</h1>
            <p>
              We&apos;ll tailor your console experience in a few quick steps so
              the right cloud services are ready when you reach your dashboard.
            </p>
          </section>
        )}

        {step === 1 && (
          <section className="onboarding-step">
            <h1>What would you like to use HTG Clouds for?</h1>
            <p>Help us tune your starting workspace.</p>
            <div className="onboarding-choice-row">
              {usageOptions.map((option) => (
                <button
                  className={form.useCase === option ? "selected" : ""}
                  key={option}
                  type="button"
                  onClick={() => updateField("useCase", option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="onboarding-step">
            <h1>Do you already use another cloud provider?</h1>
            <p>We&apos;ll use this to shape migration and setup suggestions.</p>
            <div className="onboarding-choice-row compact">
              {providerOptions.map((option) => (
                <button
                  className={form.alreadyUsesCloudProvider === option ? "selected" : ""}
                  key={option}
                  type="button"
                  onClick={() => updateField("alreadyUsesCloudProvider", option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="onboarding-step">
            <h1>Which products are you interested in trying?</h1>
            <p>Choose one or more services. We&apos;ll surface these first in your console.</p>
            <div className="product-interest-grid">
              {products.map((product) => {
                const selected = form.productsInterest.includes(product.name);
                return (
                  <button
                    className={selected ? "selected" : ""}
                    key={product.name}
                    type="button"
                    onClick={() => toggleProduct(product.name)}
                  >
                    <span>{product.code}</span>
                    <strong>{product.name}</strong>
                    <small>{product.text}</small>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <div className="onboarding-actions">
          {step > 1 && (
            <button type="button" onClick={() => setStep((current) => current - 1)}>
              Back
            </button>
          )}
          <button className="onboarding-primary" type="submit">
            {step === 0 ? "Get Started" : step === 3 ? "Finish Setup" : "Next"}
          </button>
        </div>
      </form>
    </main>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-brand">
        <img src={logoPath} alt="HTGClouds" />
        <p>
          Secure, high-performance cloud platform built to support
          mission-critical business operation
        </p>
      </div>
      <div className="footer-links">
        {footerColumns.map(([heading, ...items]) => (
          <div key={heading}>
            <h3>{heading}</h3>
            {items.map((item) => (
              <a key={item} href="#">
                {item}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="footer-bottom">
        <span>© 2026 HTG Clouds. All rights reserved.</span>
        <div>
          <Code2 size={16} />
          <Radio size={16} />
          <X size={16} />
        </div>
      </div>
    </footer>
  );
}

export default App;

if (typeof document !== "undefined") {
  const root = document.getElementById("root");
  if (root) {
    createRoot(root).render(<App />);
  }
}
