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
  Maximize2,
  Menu,
  MousePointerClick,
  Radio,
  Server,
  Shield,
  ShieldCheck,
  SlidersVertical,
  Star,
  X,
  Zap
} from "lucide-react";
import {
  getCurrentUser as getAuthUser,
  logout as logoutUser,
  resendVerificationEmail,
  resetPassword,
  saveOnboarding,
  signInWithPassword,
  signUp,
  verifyEmail
} from "./lib/auth";
import { pricingCatalog, pricingServices } from "./pricing/pricingCatalog";
import {
  calculateEstimateTotals,
  calculateItemSubtotal,
  formatPrice,
  normalizeBillingPeriod
} from "./pricing/pricingEngine";
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

const productCategories = [
  { label: "Compute", icon: Server },
  { label: "Storage", icon: HardDrive },
  { label: "Network", icon: Globe2 },
  { label: "Databases", icon: Database },
  { label: "Application", icon: Boxes },
  { label: "Management Tools", icon: Radio },
  { label: "Security and Compliance", icon: ShieldCheck }
];

const productMenuItems = {
  Compute: [
    {
      name: "Elastic Cloud Server",
      text: "Cloud servers that can be automatically accessed and flexibly scaled.",
      path: "/products/compute/elastic-cloud-server"
    },
    {
      name: "Cloud Container Engine",
      text: "Experience enterprise-class, managed Kubernetes service.",
      path: "/products/compute/cloud-container-engine"
    },
    {
      name: "Image Management Service",
      text: "Provide comprehensive image management capabilities.",
      path: "/products/compute/image-management-service"
    },
    {
      name: "Bare Metal Server",
      text: "High performance and high security cloud based physical server.",
      path: "/products/compute/bare-metal-server"
    },
    {
      name: "Auto Scaling",
      text: "Adapt compute resources to changing demand.",
      path: "/products/compute/auto-scaling"
    }
  ],
  Storage: [
    { name: "Elastic Volume Service", text: "Persistent block storage for cloud servers.", path: "#" },
    { name: "Object Storage Service", text: "Durable object storage for cloud-native data.", path: "#" },
    { name: "Scalable File Service", text: "Shared file storage for distributed workloads.", path: "#" }
  ],
  Network: [
    { name: "Virtual Private Cloud", text: "Private isolated networks for cloud resources.", path: "#" },
    { name: "Elastic IP", text: "Public IP connectivity for internet-facing workloads.", path: "#" },
    { name: "Elastic Load Balance", text: "Traffic distribution for resilient applications.", path: "#" }
  ],
  Databases: [
    { name: "Relational Database Service", text: "Managed relational databases with backup and recovery.", path: "#" },
    { name: "GaussDB", text: "Enterprise-grade managed database service.", path: "#" }
  ],
  Application: [
    { name: "Simple Message Notification", text: "Reliable message delivery for applications.", path: "#" },
    { name: "ROMA Connect", text: "Integration service for enterprise applications.", path: "#" }
  ],
  "Management Tools": [
    { name: "Log Tank Service", text: "Centralized log collection, search, and retention.", path: "#" },
    { name: "Application Operation Management", text: "Observe and operate production workloads.", path: "#" }
  ],
  "Security and Compliance": [
    { name: "Web Application Firewall", text: "Protect web applications from common attacks.", path: "#" },
    { name: "Cloud Bastion Host", text: "Secure administrative access and audit controls.", path: "#" }
  ]
};

const productFeaturedServices = {
  Compute: {
    icon: Server,
    name: "Elastic Cloud Server",
    path: "/products/compute/elastic-cloud-server"
  },
  Storage: {
    icon: Cloud,
    name: "Object Storage Service (OBS)",
    path: "#"
  },
  Network: {
    icon: Globe2,
    name: "Virtual Private Cloud (VPC)",
    path: "#"
  },
  Databases: {
    icon: Database,
    name: "Relational Database Service (RDS)",
    path: "#"
  },
  Application: {
    icon: Boxes,
    name: "Cloud Container Engine (CCE)",
    path: "#"
  },
  "Management Tools": {
    icon: Radio,
    name: "Cloud Monitoring",
    path: "#"
  },
  "Security and Compliance": {
    icon: ShieldCheck,
    name: "Security Center",
    path: "#"
  }
};

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

const pricingTabs = ["Compute", "Storage", "Networking", "Database"];

const pricingTabServices = {
  Compute: ["ECS", "ECS-CCE", "BMS"],
  Storage: ["EVS", "SFS", "OBS", "CSBS", "VBS"],
  Networking: ["EIP-number", "EIP-bandwidth", "ELB-number", "NAT", "VPN", "VPN Gateway", "VPCEP"],
  Database: ["database-contact", "CSBS", "VBS"]
};

const pricingServiceDescriptions = {
  ECS: "Flexible virtual servers for web apps, APIs, enterprise workloads, and production systems.",
  "ECS-CCE": "Compute worker nodes for managed Kubernetes and cloud-native container workloads.",
  BMS: "Dedicated physical compute for performance-sensitive and security-conscious workloads.",
  EVS: "Block storage volumes for cloud servers, databases, and persistent application data.",
  SFS: "Shared file storage for applications that need scalable, multi-instance access.",
  OBS: "Object storage buckets for backups, archives, static assets, and application data.",
  CSBS: "Cloud server backup storage for protected snapshots and operational recovery.",
  VBS: "Volume backup storage for restoring disks and protecting critical block volumes.",
  "EIP-number": "Public IP address pricing for internet-facing workloads and services.",
  "EIP-bandwidth": "Bandwidth tier pricing for public connectivity and traffic throughput.",
  "ELB-number": "Load balancer instances for distributing application traffic reliably.",
  NAT: "NAT gateway instances for secure outbound connectivity from private networks.",
  VPN: "Site-to-site VPN connections for encrypted private network access.",
  "VPN Gateway": "VPN gateway instances for resilient hybrid connectivity.",
  VPCEP: "Private endpoint connectivity for accessing services inside isolated networks."
};

const pricingIconByCategory = {
  compute: Server,
  storage: HardDrive,
  network: Globe2,
  security: Shield,
  logs: Radio
};

const pricingFaqs = [
  {
    question: "How is HTGCloud pricing calculated?",
    answer:
      "Pricing is calculated from the services you configure, including compute flavor, storage capacity, network units, billing period, and quantity."
  },
  {
    question: "Can I estimate monthly cloud costs before signing up?",
    answer:
      "Yes. Use the HTGCloud pricing calculator to estimate monthly cost from the same catalog used on this pricing page."
  },
  {
    question: "Do prices vary by region?",
    answer:
      "The current catalog supports Mogadishu-region-hq3 and Hoa-Mogadishu-2. Region-specific pricing can be added to the catalog as commercial rates evolve."
  },
  {
    question: "Are yearly plans available?",
    answer:
      "Many compute, storage, and network services include yearly rates. Services without a yearly value show the available billing period or Contact Sales."
  },
  {
    question: "What does Contact Sales mean?",
    answer:
      "Contact Sales means the catalog marks that tier as quoted or custom, so it is itemized but excluded from numeric totals until a price is confirmed."
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
  if (path === "/products/compute/elastic-cloud-server") return <ElasticCloudServerPage />;
  if (path === "/products/compute/cloud-container-engine") return <CloudContainerEnginePage />;
  if (path === "/products/compute/image-management-service") return <ImageManagementServicePage />;
  if (path === "/products/compute/bare-metal-server") return <BareMetalServerPage />;
  if (path === "/products/compute/auto-scaling") return <AutoScalingPage />;
  if (path === "/pricing/calculator") return <PricingCalculatorPage />;
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
  const [isProductMenuOpen, setProductMenuOpen] = useState(false);

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
        {navItems.map((item) =>
          item.label === "Products" ? (
            <div
              className="product-nav-wrap"
              key={item.label}
              onMouseEnter={() => setProductMenuOpen(true)}
              onMouseLeave={() => setProductMenuOpen(false)}
            >
              <button className="nav-link-button" type="button" aria-expanded={isProductMenuOpen}>
                {item.label}
                <ChevronDown size={12} strokeWidth={2.4} />
              </button>
              {isProductMenuOpen && <ProductsMegaMenu />}
            </div>
          ) : (
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
          )
        )}
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

function ProductsMegaMenu() {
  const [activeCategory, setActiveCategory] = useState("Compute");
  const products = productMenuItems[activeCategory] || productMenuItems.Compute;
  const featuredService = productFeaturedServices[activeCategory] || productFeaturedServices.Compute;
  const FeaturedIcon = featuredService.icon;

  return (
    <div className="products-mega" role="menu" aria-label="Products">
      <aside className="mega-categories">
        {productCategories.map(({ label, icon: Icon }) => (
          <button
            className={activeCategory === label ? "active" : ""}
            key={label}
            type="button"
            onMouseEnter={() => setActiveCategory(label)}
            onFocus={() => setActiveCategory(label)}
          >
            <Icon size={22} />
            <span>{label}</span>
            <ChevronDown size={16} />
          </button>
        ))}
      </aside>
      <section className="mega-products">
        {products.map((product) => (
          <a
            key={product.name}
            href={product.path}
            onClick={(event) => {
              if (product.path === "#") {
                event.preventDefault();
                return;
              }
              event.preventDefault();
              navigateTo(product.path);
            }}
          >
            <strong>{product.name}</strong>
            <span>{product.text}</span>
          </a>
        ))}
      </section>
      <aside className="mega-featured">
        <span>Featured Service</span>
        <a
          className="mega-featured-card"
          href={featuredService.path}
          onClick={(event) => {
            if (featuredService.path === "#") {
              event.preventDefault();
              return;
            }
            event.preventDefault();
            navigateTo(featuredService.path);
          }}
        >
          <span className="mega-featured-icon" aria-hidden="true">
            <FeaturedIcon size={30} />
          </span>
          <strong>{featuredService.name}</strong>
        </a>
      </aside>
    </div>
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

const ecsBenefits = [
  {
    icon: SlidersVertical,
    title: "High Performance",
    text: "Powered by latest-generation processors and NVMe SSDs for lightning-fast computing and storage."
  },
  {
    icon: Maximize2,
    title: "Automatic Scaling",
    text: "Adjust compute resources to changing demand."
  },
  {
    icon: Shield,
    title: "Secure and Reliable",
    text: "Enterprise-grade cloud infrastructure built for performance, scalability, and peace of mind."
  },
  {
    icon: MousePointerClick,
    title: "Flexible Customization",
    text: "Choose CPU, memory, storage, and networking options to fit your workload."
  }
];

const ecsWorkloadRows = [
  ["OS-Level Control", true, true, true, true],
  ["Virtual Servers", true, true, true, true],
  ["Flexible Scaling", true, true, true, false],
  ["Persistent Storage", true, true, true, true],
  ["Network Isolation", true, true, true, true],
  ["High Availability Options", true, false, true, false],
  ["Cost Efficient", true, true, true, true]
];

const ecsStorageCards = [
  {
    title: "Scalable Block Storage",
    text: "EVS delivers scalable block storage for cloud and bare metal servers, providing persistent, high-performance storage that adapts to evolving infrastructure needs."
  },
  {
    title: "Flexible Disk Configuration",
    text: "EVS supports both system disks and data disks, enabling servers to boot reliably and store application data securely."
  },
  {
    title: "Security & Lifecycle Control",
    text: "Encryption with supported algorithms protects sensitive information, while full lifecycle management ensures consistent performance and reliability."
  },
  {
    title: "Cloud & Backup Use Cases",
    text: "EVS is ideal for storing application data independently from compute resources, running system disks for cloud servers, and implementing data protection strategies."
  }
];

const ecsWorkloadCards = [
  {
    icon: Globe2,
    title: "Web Applications",
    description:
      "Deploy modern websites, APIs, and SaaS platforms with reliable performance and scalable infrastructure.",
    examples: ["WordPress", "React Applications", "Node.js APIs", "Laravel Applications"],
    capabilities: ["Auto Scaling", "SSD Storage", "Public Networking"]
  },
  {
    icon: Code2,
    title: "Development & Testing",
    description:
      "Create isolated environments for development, QA, staging, and continuous integration workflows.",
    examples: ["CI/CD Pipelines", "QA Environments", "Staging Servers", "Sandbox Projects"],
    capabilities: ["Fast Provisioning", "Snapshots", "Flexible Scaling"]
  },
  {
    icon: Shield,
    title: "Enterprise Systems",
    description:
      "Run business-critical applications requiring security, reliability, and high availability.",
    examples: ["ERP Systems", "CRM Platforms", "Internal Applications", "Databases"],
    capabilities: ["High Availability", "Private Networks", "Security Groups"]
  },
  {
    icon: Server,
    title: "Batch Processing",
    description:
      "Process scheduled workloads, reports, analytics jobs, and automation tasks efficiently.",
    examples: ["ETL Jobs", "Scheduled Reports", "Automation Tasks", "Data Processing"],
    capabilities: ["Large Compute Capacity", "Scheduled Execution", "Cost Efficient"]
  }
];

const ecsEnterpriseKpis = [
  ["99.99%", "Enterprise SLA"],
  ["Multi-AZ", "Architecture"],
  ["NVMe SSD", "Storage"],
  ["Auto Scaling", "Enabled"]
];

const ecsEnterpriseCapabilities = [
  {
    title: "Performance",
    points: ["Latest-generation CPUs", "Optimized networking", "Predictable compute performance"]
  },
  {
    title: "Availability",
    points: ["Multi-AZ deployment", "Automatic recovery", "Snapshot protection"]
  },
  {
    title: "Security",
    points: ["Security groups", "VPC isolation", "Encrypted storage"]
  },
  {
    title: "Scalability",
    points: ["Auto scaling", "Load balancing", "API-driven provisioning"]
  }
];

const ecsFaqs = [
  {
    question: "What is Elastic Cloud Server (ECS)?",
    answer: "Elastic Cloud Server (ECS) provides scalable virtual servers with configurable CPU, memory, storage, and networking for production workloads."
  },
  {
    question: "Can I resize ECS resources later?",
    answer: "Yes. ECS is designed for flexible scaling, allowing teams to adjust compute resources as workload requirements change."
  },
  {
    question: "Does ECS support persistent storage?",
    answer: "Yes. ECS works with scalable block storage so data can persist independently from server lifecycle operations."
  },
  {
    question: "Is ECS suitable for enterprise systems?",
    answer: "Yes. ECS supports network isolation, high availability options, security controls, and enterprise-grade reliability."
  },
  {
    question: "How is ECS pricing calculated?",
    answer: "ECS pricing is based on the selected flavor, billing period, and number of server instances."
  }
];

function ElasticCloudServerPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Deploy scalable cloud servers with HTGClouds Elastic Cloud Server for secure, reliable, and high-performance infrastructure.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Elastic Cloud Server (ECS) | HTGClouds";
    metaDescription.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        metaDescription.setAttribute("content", previousDescription);
      } else if (createdDescription) {
        metaDescription.remove();
      }
    };
  }, []);

  return (
    <main className="product-page ecs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Products</span> Elastic Cloud Server
          </div>
          <h1>Elastic Cloud Server (ECS)</h1>
          <p>
            Flexible, scalable cloud server solutions designed to power your
            applications with enterprise-grade performance and reliability.
          </p>
          <div className="ecs-trust-chips" aria-label="ECS platform capabilities">
            {["Enterprise Grade", "Auto Scaling", "NVMe SSD", "API Driven", "Multi AZ"].map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <div className="ecs-actions">
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Get a Demo
            </a>
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Contact Sales
            </a>
          </div>
          <div className="ecs-stats">
            <div>
              <strong>99.99%</strong>
              <span>Enterprise SLA</span>
            </div>
            <div>
              <strong>ISO 27001</strong>
              <span>Certified</span>
            </div>
            <div>
              <strong>24/7</strong>
              <span>Support</span>
            </div>
          </div>
        </div>
        <EcsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading">
          <h2>Why Choose ECS?</h2>
          <p>Enterprise-grade cloud infrastructure built for performance, scalability, and peace of mind.</p>
        </div>
        <div className="ecs-benefit-grid">
          {ecsBenefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span>
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-workloads">
        <div className="ecs-section-heading centered">
          <h2>Built for Every Workload</h2>
          <p>Deploy, scale, and manage cloud infrastructure for web applications, enterprise systems, development environments, and batch processing workloads.</p>
        </div>
        <div className="ecs-workload-grid">
          {ecsWorkloadCards.map(({ icon: Icon, title, description, examples, capabilities }) => (
            <article className="ecs-workload-card" key={title}>
              <div className="ecs-workload-card-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="ecs-workload-card-list">
                <span>Examples</span>
                <ul>
                  {examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>
              <div className="ecs-workload-capabilities">
                {capabilities.map((capability) => (
                  <span key={capability}>
                    <CircleCheck size={14} />
                    {capability}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-enterprise-proof">
        <div className="ecs-section-heading centered">
          <h2>Why Enterprises Choose HTGClouds ECS</h2>
          <p>Enterprise-grade compute infrastructure designed for performance, availability, security, and scale.</p>
        </div>
        <div className="ecs-kpi-strip">
          {ecsEnterpriseKpis.map(([value, label]) => (
            <div key={value}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
        <div className="ecs-capability-panel">
          {ecsEnterpriseCapabilities.map((capability) => (
            <article key={capability.title}>
              <h3>{capability.title}</h3>
              <ul>
                {capability.points.map((point) => (
                  <li key={point}>
                    <CircleCheck size={15} />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <EcsFaq />
      <EcsCta />
      <Footer />
    </main>
  );
}

function EcsHeroVisual() {
  return (
    <div className="ecs-visual">
      <img src="/images/products/ecs/ecs-hero.png" alt="" />
    </div>
  );
}

function EcsStorageIllustration({ index }) {
  if (index === 0) {
    return (
      <div className="ecs-storage-visual visual-1" aria-hidden="true">
        <span className="storage-label label-left">Block Storage</span>
        <span className="storage-label label-top">Bare Metal</span>
        <span className="storage-label label-right">Servers</span>
        <span className="storage-orbit orbit-1" />
        <span className="storage-orbit orbit-2" />
        <span className="storage-core"><HardDrive size={22} /></span>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div className="ecs-storage-visual visual-2" aria-hidden="true">
        <span className="disk-row row-one">
          <span className="disk-icon"><HardDrive size={18} /></span>
          <span><strong>System Disks</strong><em>Operating system</em></span>
        </span>
        <span className="disk-row row-two">
          <span className="disk-icon"><HardDrive size={18} /></span>
          <span><strong>Data Disks</strong><em>System logs</em></span>
        </span>
      </div>
    );
  }

  if (index === 2) {
    return (
      <div className="ecs-storage-visual visual-3" aria-hidden="true">
        <span className="secure-banner"><CircleCheck size={13} /> Data Secured</span>
        <span className="secure-row">Sources <i /></span>
        <span className="secure-row">Files <i /></span>
      </div>
    );
  }

  return (
    <div className="ecs-storage-visual visual-4" aria-hidden="true">
      <span className="volume-tabs"><strong>Volumes</strong><em>Instances</em></span>
      <span className="volume-row"><b>Volume-A1</b><i>SSD - 100GB</i></span>
      <span className="volume-value">68</span>
      <span className="volume-slider"><i /></span>
      <span className="volume-capacity">68/100 GB</span>
    </div>
  );
}

function EcsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Elastic Cloud Server (ECS).</p>
      </div>
      <div className="pricing-faq-list">
        {ecsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function EcsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Ready to Optimize Your Infrastructure?</h2>
      </div>
      <div>
        <p>
          HTGClouds empowers businesses with scalable compute infrastructure,
          secure networking, and reliable performance.
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

const cceBenefits = [
  {
    icon: Cloud,
    title: "Fully Managed Kubernetes",
    text: "Manage Kubernetes cluster lifecycle, including control plane operations, upgrades, and core add-ons, with reduced operational overhead."
  },
  {
    icon: SlidersVertical,
    title: "Built-in Scalability",
    text: "Scale containerized workloads using horizontal pod autoscaling and scheduled scaling policies based on workload demand."
  },
  {
    icon: Shield,
    title: "High Availability Architecture",
    text: "Deploy clusters across multiple nodes and availability zones to maintain service continuity."
  },
  {
    icon: ShieldCheck,
    title: "Secure Container Runtime",
    text: "Run workloads using containerd and secure runtime options designed to isolate and protect container resources."
  }
];

const cceWorkloads = [
  {
    icon: Boxes,
    title: "Microservices Platforms",
    description: "Run distributed microservices with Kubernetes-native orchestration, service discovery, and scaling.",
    examples: ["API services", "Service mesh applications", "Distributed application platforms"],
    capabilities: ["Orchestration", "Service Discovery", "Scaling"]
  },
  {
    icon: Code2,
    title: "Cloud-Native Applications",
    description: "Deploy modern applications built with containers, Kubernetes, and automated delivery workflows.",
    examples: ["Web applications", "SaaS platforms", "CI/CD workloads"],
    capabilities: ["Containers", "Kubernetes", "Automated Delivery"]
  },
  {
    icon: Server,
    title: "Enterprise Container Platforms",
    description: "Operate production Kubernetes environments with consistency, control, and integrated cloud services.",
    examples: ["Enterprise platforms", "Internal business applications", "Production Kubernetes clusters"],
    capabilities: ["Control", "Integrated Services", "Production Ready"]
  },
  {
    icon: Zap,
    title: "Batch & Scheduled Jobs",
    description: "Run containerized batch jobs and scheduled workloads with Kubernetes-native job management.",
    examples: ["Data processing", "Scheduled tasks", "Background workers"],
    capabilities: ["Job Management", "Scheduled Runs", "Containerized Workers"]
  }
];

const cceCapabilities = [
  {
    icon: Cloud,
    title: "Managed Kubernetes Clusters",
    description: "Create and operate Kubernetes clusters with lifecycle management for production workloads."
  },
  {
    icon: Code2,
    title: "Kubernetes-Native APIs",
    description: "Use standard Kubernetes APIs and tools to deploy and manage applications."
  },
  {
    icon: Boxes,
    title: "Container Runtime Support",
    description: "Run workloads using containerd and Kubernetes-native runtime capabilities."
  },
  {
    icon: SlidersVertical,
    title: "Horizontal Pod Autoscaling",
    description: "Automatically scale pods based on workload demand and resource utilization."
  },
  {
    icon: Globe2,
    title: "Integrated Networking",
    description: "Use container networks, service networks, Kubernetes service IPs, and load balancing integration."
  },
  {
    icon: HardDrive,
    title: "Persistent Storage Integration",
    description: "Connect workloads to EVS, SFS, OBS, local volumes, and Kubernetes StorageClass."
  }
];

const cceFaqs = [
  {
    question: "What is Cloud Container Engine (CCE)?",
    answer: "Cloud Container Engine is a managed Kubernetes service for deploying, scaling, and operating containerized applications."
  },
  {
    question: "What workloads are suitable for CCE?",
    answer: "CCE is suitable for microservices, cloud-native applications, enterprise container platforms, and containerized batch workloads."
  },
  {
    question: "Which container runtime is supported?",
    answer: "CCE supports containerd and Kubernetes-native runtimes."
  },
  {
    question: "Does CCE support autoscaling?",
    answer: "Yes. CCE supports horizontal pod autoscaling and scheduled scaling policies."
  },
  {
    question: "Is CCE suitable for production workloads?",
    answer: "Yes. CCE is designed to support production Kubernetes environments with high availability, scalability, and operational control."
  }
];

function CloudContainerEnginePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Deploy, scale, and operate containerized applications with HTGClouds Cloud Container Engine, a managed Kubernetes service built for cloud-native workloads.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Cloud Container Engine (CCE) | HTGClouds";
    metaDescription.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        metaDescription.setAttribute("content", previousDescription);
      } else if (createdDescription) {
        metaDescription.remove();
      }
    };
  }, []);

  return (
    <main className="product-page ecs-page cce-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Managed Kubernetes Service</span>
          </div>
          <h1>Cloud Container Engine (CCE)</h1>
          <p>
            Deploy, scale, and operate containerized applications with fully managed
            Kubernetes clusters. Cloud Container Engine provides managed Kubernetes
            infrastructure for cloud-native workloads, helping teams run containers
            with built-in scalability, high availability, and operational control.
          </p>
          <div className="ecs-trust-chips" aria-label="CCE platform capabilities">
            {["Managed Kubernetes", "Container Orchestration", "Auto Scaling", "High Availability", "Secure Runtime"].map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <div className="ecs-actions">
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Get Started
            </a>
            <a href="/pricing" onClick={(event) => { event.preventDefault(); navigateTo("/pricing"); }}>
              View Pricing
            </a>
          </div>
          <div className="ecs-stats">
            <div>
              <strong>Managed Kubernetes</strong>
              <span>Cluster Lifecycle Management</span>
            </div>
            <div>
              <strong>Auto Scaling</strong>
              <span>Horizontal Pod Autoscaling</span>
            </div>
            <div>
              <strong>Production Ready</strong>
              <span>High Availability Architecture</span>
            </div>
          </div>
        </div>
        <CceHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading">
          <h2>Why Choose CCE?</h2>
          <p>Enterprise-ready Kubernetes infrastructure designed for production container workloads.</p>
        </div>
        <div className="ecs-benefit-grid">
          {cceBenefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span>
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-workloads">
        <div className="ecs-section-heading centered">
          <h2>Built for Container Workloads</h2>
          <p>Cloud Container Engine supports modern application delivery across microservices, cloud-native platforms, enterprise systems, and scheduled workloads.</p>
        </div>
        <div className="ecs-workload-grid">
          {cceWorkloads.map(({ icon: Icon, title, description, examples, capabilities }) => (
            <article className="ecs-workload-card" key={title}>
              <div className="ecs-workload-card-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="ecs-workload-card-list">
                <span>Examples</span>
                <ul>
                  {examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>
              <div className="ecs-workload-capabilities">
                {capabilities.map((capability) => (
                  <span key={capability}>
                    <CircleCheck size={14} />
                    {capability}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <CceArchitectureWorkflow />

      <section className="ecs-section ecs-enterprise-proof">
        <div className="ecs-section-heading centered">
          <h2>Core Capabilities</h2>
          <p>Create, operate, scale, network, and store containerized workloads with managed Kubernetes infrastructure.</p>
        </div>
        <div className="as-capability-card-grid cce-capability-card-grid">
          {cceCapabilities.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span>
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <CceFaq />
      <CceCta />
      <Footer />
    </main>
  );
}

function CceHeroVisual() {
  return (
    <div className="ecs-visual cce-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Cloud Container Engine managed Kubernetes illustration">
        <rect x="74" y="78" width="372" height="364" rx="34" fill="#f5fbfb" />
        <circle cx="260" cy="188" r="62" fill="#23b8be" opacity="0.16" />
        <circle cx="260" cy="188" r="44" fill="#11161b" />
        <path d="M260 150 l34 19 v38 l-34 20 l-34 -20 v-38 z" fill="none" stroke="#ffffff" strokeWidth="8" strokeLinejoin="round" />
        <path d="M260 150 v37 l34 20 M260 187 l-34 20" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
        {[142, 222, 302].map((x) => (
          <g key={x}>
            <rect x={x} y="308" width="62" height="70" rx="14" fill="#ffffff" stroke="#d7edf0" strokeWidth="2" />
            <circle cx={x + 31} cy="334" r="13" fill="#23b8be" opacity="0.22" />
            <path d={`M${x + 19} 354 h24 M${x + 19} 366 h24`} stroke="#23b8be" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
        <path d="M260 232 v42 M173 274 h174" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 10" />
        <rect x="150" y="108" width="220" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="135" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">Managed Kubernetes</text>
      </svg>
    </div>
  );
}

function CceArchitectureWorkflow() {
  return (
    <section className="ecs-section cce-architecture-section">
      <div className="ecs-section-heading centered">
        <h2>How CCE Works</h2>
        <p>Run containerized applications on managed Kubernetes clusters with integrated compute, networking, storage, and scaling.</p>
      </div>
      <div className="cce-architecture-layout">
        <div className="cce-architecture-diagram" aria-label="Cloud Container Engine workflow">
          <svg className="cce-diagram-svg" viewBox="0 0 760 640" role="img" aria-labelledby="cceDiagramTitle">
            <title id="cceDiagramTitle">Developer pipeline to CCE, Kubernetes cluster, worker nodes, and containerized applications with connected cloud services</title>
            <defs>
              <marker id="cceArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#98a0a6" />
              </marker>
            </defs>
            <g className="cce-main-flow">
              <rect x="80" y="38" width="300" height="76" rx="18" fill="#ffffff" />
              <text x="230" y="84" textAnchor="middle">Developer / CI-CD Pipeline</text>
              <path d="M230 116 V154" markerEnd="url(#cceArrow)" />

              <rect x="80" y="164" width="300" height="76" rx="18" fill="#eafafa" />
              <text x="230" y="210" textAnchor="middle">Cloud Container Engine (CCE)</text>
              <path d="M230 242 V280" markerEnd="url(#cceArrow)" />

              <rect x="80" y="290" width="300" height="76" rx="18" fill="#ffffff" />
              <text x="230" y="336" textAnchor="middle">Kubernetes Cluster</text>
              <path d="M230 368 V406" markerEnd="url(#cceArrow)" />

              <rect x="80" y="416" width="300" height="76" rx="18" fill="#ffffff" />
              <text x="230" y="462" textAnchor="middle">Worker Nodes</text>
              <path d="M230 494 V532" markerEnd="url(#cceArrow)" />

              <rect x="80" y="542" width="300" height="76" rx="18" fill="#11161b" />
              <text x="230" y="588" textAnchor="middle" className="cce-dark-label">Containerized Applications</text>
            </g>

            <g className="cce-connected-services">
              <text x="565" y="68" textAnchor="middle" className="cce-services-title">Connected Services</text>
              {[
                ["ECS", 110, Server],
                ["ELB", 188, Globe2],
                ["EVS", 266, HardDrive],
                ["SFS", 344, Cloud],
                ["OBS", 422, Database],
                ["Auto Scaling", 500, Zap]
              ].map(([label, y, Icon]) => (
                <g key={label}>
                  <rect x="470" y={y} width="190" height="50" rx="14" fill="#ffffff" />
                  <foreignObject x="488" y={y + 13} width="24" height="24">
                    <Icon size={22} color="#126f73" />
                  </foreignObject>
                  <text x="535" y={y + 32}>{label}</text>
                </g>
              ))}
              <path d="M462 202 H386" markerEnd="url(#cceArrow)" />
              <path d="M462 344 H386" markerEnd="url(#cceArrow)" />
              <path d="M462 500 H386" markerEnd="url(#cceArrow)" />
            </g>
          </svg>
        </div>
        <div className="cce-architecture-copy">
          <div>
            <h3>Overview</h3>
            <p>
              Cloud Container Engine is a managed Kubernetes service that handles
              cluster lifecycle management while allowing teams to deploy and operate
              containerized applications using standard Kubernetes APIs.
            </p>
          </div>
          <div>
            <h3>Advantages</h3>
            <article>
              <h4>Managed Operations</h4>
              <p>Reduce operational overhead by relying on managed Kubernetes lifecycle operations, upgrades, and core add-ons.</p>
            </article>
            <article>
              <h4>Cloud-Native Scalability</h4>
              <p>Scale applications using Kubernetes-native autoscaling and scheduled scaling policies.</p>
            </article>
            <article>
              <h4>Integrated Cloud Services</h4>
              <p>Connect container workloads with compute, networking, storage, and load balancing services.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function CceFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Cloud Container Engine (CCE).</p>
      </div>
      <div className="pricing-faq-list">
        {cceFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CceCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Build and Scale Cloud-Native Applications</h2>
      </div>
      <div>
        <p>Get started with Cloud Container Engine - managed Kubernetes built for real-world container workloads.</p>
        <a
          href="/signup"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/signup");
          }}
        >
          Get Started
        </a>
      </div>
    </section>
  );
}

const bmsBenefits = [
  {
    icon: Server,
    title: "Dedicated Physical Servers",
    text: "Each BMS instance runs on exclusive physical hardware with no virtualization overhead, ensuring predictable performance and full resource control."
  },
  {
    icon: Zap,
    title: "High Computing Performance",
    text: "Supports x86 and Arm-based processors for databases, business systems, and HPC workloads."
  },
  {
    icon: Shield,
    title: "Hardware-Level Isolation",
    text: "Physical isolation improves security and workload separation for sensitive environments."
  },
  {
    icon: Cloud,
    title: "Cloud-Based Management",
    text: "Provision, start, stop, restart, and manage servers through the HTGClouds platform."
  }
];

const bmsOverviewHighlights = [
  "Automated provisioning and OS installation",
  "Integration with networking and block storage",
  "Centralized lifecycle management",
  "Monitoring and operational visibility"
];

const bmsCapabilities = [
  {
    icon: Server,
    title: "Dedicated Physical Servers",
    description: "Exclusive hardware access with single-tenant infrastructure and predictable performance."
  },
  {
    icon: SlidersVertical,
    title: "Automated Lifecycle Management",
    description: "Automate provisioning, OS installation, and start, stop, restart, and delete operations."
  },
  {
    icon: HardDrive,
    title: "Storage Integration",
    description: "Use EVS disk support with online attach, detach, and capacity expansion."
  },
  {
    icon: Globe2,
    title: "Secure Networking",
    description: "Integrate with VPC networking, security groups, and Elastic IP support."
  },
  {
    icon: Radio,
    title: "Monitoring & Operations",
    description: "Manage resources through the cloud console with monitoring and operational visibility."
  }
];

const bmsUseCases = [
  {
    icon: Database,
    title: "Core Databases",
    description: "Run performance-sensitive databases with predictable compute and I/O performance.",
    capabilities: ["Predictable Compute", "I/O Performance", "Dedicated Hardware"]
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Application Systems",
    description: "Support critical business systems requiring dedicated infrastructure.",
    capabilities: ["Business Critical", "Dedicated Infrastructure", "Operational Control"]
  },
  {
    icon: Zap,
    title: "High-Performance Computing (HPC)",
    description: "Execute compute-intensive workloads using direct hardware access.",
    capabilities: ["Compute Intensive", "Direct Hardware", "High Performance"]
  },
  {
    icon: Boxes,
    title: "Batch Processing",
    description: "Process large-scale workloads with consistent performance and resource availability.",
    capabilities: ["Large Scale", "Consistent Performance", "Resource Availability"]
  }
];

const bmsFaqs = [
  {
    question: "What is Bare Metal Server (BMS)?",
    answer: "BMS is a cloud service that provides dedicated physical servers with cloud-based provisioning and management."
  },
  {
    question: "How is BMS different from virtual servers?",
    answer: "BMS offers exclusive access to physical hardware without virtualization overhead, providing higher performance and isolation."
  },
  {
    question: "What workloads are suitable for BMS?",
    answer: "BMS is suitable for databases, enterprise application systems, and high-performance computing workloads."
  },
  {
    question: "Does BMS support cloud networking and storage?",
    answer: "Yes. BMS integrates with VPC networking and EVS block storage services."
  },
  {
    question: "Can I manage BMS through the cloud console?",
    answer: "Yes. BMS supports full lifecycle management and monitoring through the cloud management console."
  }
];

function BareMetalServerPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Dedicated physical servers with cloud-style provisioning, high computing performance, hardware-level isolation, and operational control for enterprise workloads.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Bare Metal Server (BMS) | HTGClouds";
    metaDescription.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        metaDescription.setAttribute("content", previousDescription);
      } else if (createdDescription) {
        metaDescription.remove();
      }
    };
  }, []);

  return (
    <main className="product-page ecs-page bms-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Dedicated Physical Infrastructure</span>
          </div>
          <h1>Bare Metal Server (BMS)</h1>
          <p>
            Dedicated physical servers with cloud-style provisioning and management.
            Bare Metal Server (BMS) provides exclusive access to physical servers,
            delivering high computing performance, hardware-level isolation, and
            operational control for performance-sensitive and security-critical workloads.
          </p>
          <div className="ecs-trust-chips" aria-label="BMS platform capabilities">
            {["Dedicated Hardware", "High Performance", "Hardware Isolation", "Cloud Management", "Enterprise Ready"].map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <div className="ecs-actions">
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Get Started
            </a>
            <a href="/pricing" onClick={(event) => { event.preventDefault(); navigateTo("/pricing"); }}>
              View Pricing
            </a>
          </div>
          <div className="ecs-stats">
            <div>
              <strong>Dedicated Hardware</strong>
              <span>Exclusive physical resources with no virtualization overhead.</span>
            </div>
            <div>
              <strong>Enterprise Performance</strong>
              <span>Predictable performance for demanding workloads.</span>
            </div>
            <div>
              <strong>Hardware Isolation</strong>
              <span>Enhanced security and workload separation.</span>
            </div>
          </div>
        </div>
        <BmsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading">
          <h2>Why Choose BMS?</h2>
          <p>Dedicated infrastructure designed for performance, isolation, and enterprise workloads.</p>
        </div>
        <div className="ecs-benefit-grid">
          {bmsBenefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span>
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section bms-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Product Overview</h2>
          <p>Bare Metal Server (BMS) combines the performance and security of traditional physical servers with the flexibility and automation of cloud resource management.</p>
        </div>
        <div className="ecs-workload-capabilities bms-overview-highlights">
          {bmsOverviewHighlights.map((highlight) => (
            <span key={highlight}>
              <CircleCheck size={14} />
              {highlight}
            </span>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-enterprise-proof">
        <div className="ecs-section-heading centered">
          <h2>Core Capabilities</h2>
          <p>Operate dedicated physical servers with cloud-based lifecycle, storage, networking, monitoring, and operational control.</p>
        </div>
        <div className="as-capability-card-grid bms-capability-card-grid">
          {bmsCapabilities.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span>
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-workloads">
        <div className="ecs-section-heading centered">
          <h2>Use Cases</h2>
          <p>Dedicated physical infrastructure for databases, enterprise systems, high-performance computing, and large-scale batch workloads.</p>
        </div>
        <div className="ecs-workload-grid">
          {bmsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
            <article className="ecs-workload-card" key={title}>
              <div className="ecs-workload-card-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="ecs-workload-capabilities">
                {capabilities.map((capability) => (
                  <span key={capability}>
                    <CircleCheck size={14} />
                    {capability}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <BmsHowItWorks />
      <BmsFaq />
      <BmsCta />
      <Footer />
    </main>
  );
}

function BmsHeroVisual() {
  return (
    <div className="ecs-visual bms-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Bare Metal Server dedicated infrastructure illustration">
        <rect x="74" y="78" width="372" height="364" rx="34" fill="#f5fbfb" />
        <rect x="168" y="122" width="184" height="244" rx="26" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <rect x="194" y="154" width="132" height="54" rx="12" fill="#11161b" />
        <path d="M214 181 h92" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeDasharray="10 10" />
        {[232, 272, 312].map((y) => (
          <g key={y}>
            <rect x="194" y={y} width="132" height="34" rx="8" fill="#eafafa" stroke="#ccebee" />
            <circle cx="214" cy={y + 17} r="5" fill="#23b8be" />
            <path d={`M232 ${y + 17} h70`} stroke="#7fcfd3" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
        <path d="M160 394 h200" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" />
        <path d="M210 394 v-28 M310 394 v-28" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" />
        <rect x="154" y="104" width="212" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="131" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">Dedicated Hardware</text>
      </svg>
    </div>
  );
}

function BmsHowItWorks() {
  return (
    <section className="ecs-section bms-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Provision dedicated physical servers through HTGClouds while maintaining cloud-style management, monitoring, and lifecycle operations.</p>
      </div>
      <div className="bms-how-layout">
        <div className="bms-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations requiring dedicated infrastructure can provision physical servers through HTGClouds while maintaining cloud-style management, monitoring, and lifecycle operations.</p>
        </div>
        <div className="bms-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Dedicated Hardware</h4>
            <p>Access exclusive physical resources with no virtualization overhead.</p>
          </article>
          <article>
            <h4>Predictable Performance</h4>
            <p>Maintain consistent performance for business-critical applications.</p>
          </article>
          <article>
            <h4>Cloud Operations</h4>
            <p>Manage physical servers through a centralized cloud platform.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function BmsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Bare Metal Server (BMS).</p>
      </div>
      <div className="pricing-faq-list">
        {bmsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function BmsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Deploy Dedicated Physical Infrastructure</h2>
      </div>
      <div>
        <p>Get started with Bare Metal Server and combine dedicated hardware performance with cloud-based control and management.</p>
        <div className="as-cta-actions">
          <a
            href="/signup"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/signup");
            }}
          >
            Get Started
          </a>
          <a
            href="/signup"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/signup");
            }}
          >
            Contact Sales
          </a>
        </div>
      </div>
    </section>
  );
}

const autoScalingBenefits = [
  {
    icon: Zap,
    title: "Automatic Resource Adjustment",
    text: "Automatically add or remove cloud servers based on demand to maintain application performance without manual intervention."
  },
  {
    icon: SlidersVertical,
    title: "Flexible Scaling Policies",
    text: "Scale infrastructure using metric-based, scheduled, or event-triggered policies aligned with business requirements."
  },
  {
    icon: Shield,
    title: "High Availability Support",
    text: "Distribute workloads across availability zones to improve resilience and minimize service disruptions."
  },
  {
    icon: MousePointerClick,
    title: "Cost Optimization",
    text: "Reduce infrastructure costs by automatically scaling down unused resources during periods of low demand."
  }
];

const autoScalingWorkloads = [
  {
    icon: Globe2,
    title: "Web Applications",
    description: "Automatically scale application servers during traffic spikes while maintaining a consistent user experience.",
    examples: ["Public websites", "SaaS platforms", "APIs"],
    capabilities: ["Automatic Scaling", "High Availability", "Elastic Capacity"]
  },
  {
    icon: Boxes,
    title: "E-Commerce Platforms",
    description: "Increase capacity during promotional campaigns and seasonal traffic peaks.",
    examples: ["Online stores", "Flash sales", "Digital marketplaces"],
    capabilities: ["Scheduled Policies", "Elastic Capacity", "Cost Optimized"]
  },
  {
    icon: Code2,
    title: "Batch & Scheduled Workloads",
    description: "Provision resources only when required for background processing and scheduled operations.",
    examples: ["Data processing", "Scheduled reporting", "ETL workloads"],
    capabilities: ["Scheduled Policies", "Elastic Capacity", "Cost Optimized"]
  },
  {
    icon: Server,
    title: "Enterprise Systems",
    description: "Maintain reliable performance for business-critical applications.",
    examples: ["ERP systems", "Internal applications", "Enterprise platforms"],
    capabilities: ["High Availability", "Multi-AZ Support", "Health Management"]
  }
];

const autoScalingCapabilities = [
  {
    icon: Zap,
    title: "Dynamic Scaling",
    description: "Automatically increase or reduce ECS capacity as workload demand changes."
  },
  {
    icon: SlidersVertical,
    title: "Scheduled Scaling",
    description: "Prepare capacity ahead of known traffic patterns, recurring jobs, and business events."
  },
  {
    icon: ShieldCheck,
    title: "Health Management",
    description: "Monitor instances and replace unhealthy servers to help maintain application availability."
  },
  {
    icon: Server,
    title: "ECS Integration",
    description: "Work directly with Elastic Cloud Server to provision scalable compute capacity."
  },
  {
    icon: Globe2,
    title: "Load Balancer Integration",
    description: "Distribute traffic across scaled instances using Elastic Load Balance integration."
  },
  {
    icon: Boxes,
    title: "Multi-AZ Resilience",
    description: "Scale across availability zones to improve resilience for production workloads."
  }
];

const autoScalingFaqs = [
  {
    question: "What is Auto Scaling?",
    answer: "Auto Scaling automatically adjusts the number of cloud servers based on predefined scaling policies and workload demand."
  },
  {
    question: "Which resources can Auto Scaling manage?",
    answer: "Auto Scaling manages Elastic Cloud Servers (ECS) within scaling groups."
  },
  {
    question: "How are scaling actions triggered?",
    answer: "Scaling actions can be triggered using performance metrics, schedules, or predefined business events."
  },
  {
    question: "Does Auto Scaling support high availability?",
    answer: "Yes. Auto Scaling supports multi-availability zone deployments for improved service availability."
  },
  {
    question: "Is Auto Scaling suitable for production workloads?",
    answer: "Yes. Auto Scaling is designed for production environments requiring dynamic capacity management and high availability."
  }
];

function AutoScalingPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Automatically scale cloud server capacity based on demand. Improve application availability, performance, and cost efficiency with HTGClouds Auto Scaling.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Auto Scaling (AS) | HTGClouds";
    metaDescription.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        metaDescription.setAttribute("content", previousDescription);
      } else if (createdDescription) {
        metaDescription.remove();
      }
    };
  }, []);

  return (
    <main className="product-page ecs-page as-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Automated Resource Management</span>
          </div>
          <h1>Auto Scaling (AS)</h1>
          <p>
            Automatically adjust compute resources to match application demand. Auto Scaling
            helps maintain application performance and cost efficiency by automatically increasing
            or decreasing cloud server capacity based on predefined scaling policies and real-time
            workload requirements.
          </p>
          <div className="ecs-trust-chips" aria-label="Auto Scaling platform capabilities">
            {["Automatic Scaling", "High Availability", "Scheduled Policies", "Cost Optimized", "Elastic Capacity"].map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <div className="ecs-actions">
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Get Started
            </a>
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Contact Sales
            </a>
          </div>
          <div className="ecs-stats">
            <div>
              <strong>Automatic Scaling</strong>
              <span>Dynamic Capacity Management</span>
            </div>
            <div>
              <strong>Multi-AZ Support</strong>
              <span>Enterprise Availability</span>
            </div>
            <div>
              <strong>Cost Efficient</strong>
              <span>Pay Only for Resources Used</span>
            </div>
          </div>
        </div>
        <AutoScalingHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading">
          <h2>Why Choose Auto Scaling?</h2>
          <p>Elastic resource management designed for modern cloud applications with dynamic and unpredictable workloads.</p>
        </div>
        <div className="ecs-benefit-grid">
          {autoScalingBenefits.map(({ icon: Icon, title, text }) => (
            <article key={title}>
              <span>
                <Icon size={18} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-workloads">
        <div className="ecs-section-heading centered">
          <h2>Built for Dynamic Workloads</h2>
          <p>Auto Scaling helps organizations maintain performance, availability, and efficiency across a wide range of cloud workloads.</p>
        </div>
        <div className="ecs-workload-grid">
          {autoScalingWorkloads.map(({ icon: Icon, title, description, examples, capabilities }) => (
            <article className="ecs-workload-card" key={title}>
              <div className="ecs-workload-card-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="ecs-workload-card-list">
                <span>Examples</span>
                <ul>
                  {examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>
              <div className="ecs-workload-capabilities">
                {capabilities.map((capability) => (
                  <span key={capability}>
                    <CircleCheck size={14} />
                    {capability}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <AutoScalingArchitecture />

      <section className="ecs-section ecs-enterprise-proof">
        <div className="ecs-section-heading centered">
          <h2>Core Capabilities</h2>
          <p>Manage scaling groups, policies, health checks, integrations, and availability for automated infrastructure scaling.</p>
        </div>
        <div className="as-capability-card-grid">
          {autoScalingCapabilities.map(({ icon: Icon, title, description }) => (
            <article key={title}>
              <span>
                <Icon size={22} />
              </span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <AutoScalingFaq />
      <AutoScalingCta />
      <Footer />
    </main>
  );
}

function AutoScalingHeroVisual() {
  return (
    <div className="ecs-visual as-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Auto Scaling service illustration">
        <rect x="74" y="78" width="372" height="364" rx="34" fill="#f5fbfb" />
        <path d="M138 340 h244" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="10 12" />
        <path d="M158 288 c20 -64 62 -98 112 -98 c52 0 80 41 96 98" fill="none" stroke="#23b8be" strokeWidth="16" strokeLinecap="round" />
        <path d="M366 288 l-2 -56 l48 30 z" fill="#23b8be" />
        {[132, 214, 296].map((x, index) => (
          <g key={x}>
            <rect x={x} y={318 - index * 26} width="58" height="68" rx="12" fill="#ffffff" stroke="#d7edf0" strokeWidth="2" />
            <path d={`M${x + 16} ${342 - index * 26} h26 M${x + 16} ${356 - index * 26} h26`} stroke="#23b8be" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
        <circle cx="260" cy="190" r="58" fill="#11161b" />
        <path d="M232 190 h56 M260 162 v56" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
        <rect x="164" y="108" width="192" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="135" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">Scaling Group</text>
      </svg>
    </div>
  );
}

function AutoScalingArchitecture() {
  return (
    <section className="ecs-section as-architecture-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Automatically scale ECS capacity based on workload demand while maintaining application performance.</p>
      </div>
      <div className="as-architecture-layout">
        <div className="as-architecture-diagram" aria-label="Auto Scaling architecture workflow">
          <svg className="as-diagram-svg" viewBox="0 0 1200 690" role="img" aria-labelledby="asDiagramTitle">
            <title id="asDiagramTitle">Elastic Load Balance, Object Storage, and Auto Scaling feed ECS instances and output processed data to Object Storage</title>
            <defs>
              <marker id="asArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#98a0a6" />
              </marker>
              <filter id="asSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#0f1a20" floodOpacity="0.08" />
              </filter>
            </defs>

            <g className="as-service-source">
              <rect x="84" y="128" width="74" height="74" rx="18" fill="#1574f6" />
              <path d="M121 145 L97 188 H145 Z M121 145 V180 M97 188 L121 180 L145 188" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <text x="121" y="252" textAnchor="middle">Elastic Load Balance</text>
              <text x="121" y="284" textAnchor="middle">(ELB)</text>

              <rect x="84" y="330" width="74" height="74" rx="18" fill="#23bf5a" />
              <path d="M96 370 C105 346, 126 346, 134 362 C144 356, 158 364, 156 378 C155 391, 144 397, 132 397 H108 C94 397, 88 386, 96 370 Z" fill="#fff" />
              <path d="M121 386 V360 M109 372 L121 360 L133 372" fill="none" stroke="#23bf5a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="121" y="456" textAnchor="middle">Object Storage Service</text>
              <text x="121" y="488" textAnchor="middle">(OBS)</text>

              <rect x="84" y="532" width="74" height="74" rx="18" fill="#08aade" />
              <path d="M98 582 C104 548, 111 548, 117 582 C123 616, 130 616, 136 582 C142 548, 149 548, 155 582" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
              <text x="121" y="656" textAnchor="middle">Auto Scaling</text>
            </g>

            <text x="330" y="164" textAnchor="middle" className="as-flow-label">Keep loads balanced</text>
            <text x="330" y="365" textAnchor="middle" className="as-flow-label">Raw data</text>
            <text x="346" y="568" textAnchor="middle" className="as-flow-label">Keep workloads stable</text>
            <path d="M176 166 H432" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />
            <path d="M176 368 H432" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />
            <path d="M176 570 H432" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />

            <g className="as-ecs-group" filter="url(#asSoftShadow)">
              <rect x="450" y="76" width="220" height="562" rx="18" fill="#f8f9f9" />

              {[118, 292, 500].map((y) => (
                <g key={y}>
                  <rect x="524" y={y} width="72" height="72" rx="17" fill="#ff5335" />
                  <path d={`M535 ${y + 47} C542 ${y + 30}, 556 ${y + 31}, 561 ${y + 42} C567 ${y + 31}, 586 ${y + 36}, 586 ${y + 51} C586 ${y + 61}, 577 ${y + 65}, 566 ${y + 65} H545 C534 ${y + 65}, 529 ${y + 58}, 535 ${y + 47} Z`} fill="#fff" />
                  <path d={`M548 ${y + 54} H572`} stroke="#ff5335" strokeWidth="3" strokeLinecap="round" />
                </g>
              ))}

              <text x="560" y="236" textAnchor="middle">Elastic Cloud Server</text>
              <text x="560" y="268" textAnchor="middle">(ECS)</text>
              <text x="560" y="410" textAnchor="middle">Elastic Cloud Server</text>
              <text x="560" y="442" textAnchor="middle">(ECS)</text>
              <text x="560" y="618" textAnchor="middle">Elastic Cloud Server</text>
              <text x="560" y="650" textAnchor="middle">(ECS)</text>
              <text x="560" y="482" textAnchor="middle" className="as-ellipsis">...</text>
            </g>

            <path d="M690 166 H742 C772 166 780 196 780 230 V334 C780 358 798 368 828 368" fill="none" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />
            <path d="M690 368 H828" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />
            <path d="M690 570 H742 C772 570 780 540 780 506 V402 C780 378 798 368 828 368" fill="none" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />
            <text x="930" y="348" textAnchor="middle" className="as-flow-label">Processed data</text>
            <path d="M918 368 H1016" stroke="#98a0a6" strokeWidth="2.6" markerEnd="url(#asArrow)" />

            <g className="as-output-obs" filter="url(#asSoftShadow)">
              <rect x="1040" y="330" width="74" height="74" rx="18" fill="#23bf5a" />
              <path d="M1052 370 C1061 346, 1082 346, 1090 362 C1100 356, 1114 364, 1112 378 C1111 391, 1100 397, 1088 397 H1064 C1050 397, 1044 386, 1052 370 Z" fill="#fff" />
              <path d="M1077 386 V360 M1065 372 L1077 360 L1089 372" fill="none" stroke="#23bf5a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="1077" y="456" textAnchor="middle">Object Storage Service</text>
              <text x="1077" y="488" textAnchor="middle">(OBS)</text>
            </g>
          </svg>
        </div>
        <div className="as-architecture-copy">
          <div>
            <h3>Scenario</h3>
            <p>
              Automatically launch compute instances for scheduled workloads and release them
              when tasks finish. Capacity can also scale up or down automatically based on
              workload demand.
            </p>
          </div>
          <div>
            <h3>Advantages</h3>
            <article>
              <strong>Flexible Scaling</strong>
              <p>Adjust capacity manually or use scheduled, recurring, or alarm-based scaling policies.</p>
            </article>
            <article>
              <strong>Cost Efficient</strong>
              <p>Instances are added only when needed, helping optimize performance and cost. Pay only for the resources you use.</p>
            </article>
            <article>
              <strong>Multiple Instance Types</strong>
              <p>Run workloads across different instance types to improve performance and resource utilization.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function AutoScalingFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Auto Scaling.</p>
      </div>
      <div className="pricing-faq-list">
        {autoScalingFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function AutoScalingCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Scale Automatically. Operate Efficiently.</h2>
      </div>
      <div>
        <p>Automatically adjust cloud resources to match changing demand while maintaining performance and optimizing costs.</p>
        <div className="as-cta-actions">
          <a
            href="/signup"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/signup");
            }}
          >
            Get Started
          </a>
          <a
            href="/signup"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/signup");
            }}
          >
            Contact Sales
          </a>
        </div>
      </div>
    </section>
  );
}

const imsCoreCapabilities = [
  {
    icon: HardDrive,
    title: "Centralized Image Management",
    description: "Manage public, private, and shared images from a single service to support consistent cloud server provisioning.",
    benefits: ["Version Control", "Team Sharing", "Image Catalog"]
  },
  {
    icon: Maximize2,
    title: "Flexible Image Creation",
    description: "Create private images from existing cloud servers or import external image files to support customized environments.",
    benefits: ["Version History", "Rollback", "Governance"]
  },
  {
    icon: Shield,
    title: "Secure Image Handling",
    description: "Optional system-managed encryption is supported when creating private images to protect image data.",
    benefits: ["High Availability", "DR Ready", "Global Distribution"]
  },
  {
    icon: MousePointerClick,
    title: "Efficient Deployment",
    description: "Use images to quickly create cloud servers in batches, supporting repeatable deployments and system upgrades.",
    benefits: ["Faster Provisioning", "Consistency", "Reduced Errors"]
  }
];

const imsDeploymentScenarios = [
  {
    icon: Cloud,
    title: "Golden Image Management",
    description: "Create and maintain approved golden images that standardize operating systems, software, and baseline configuration.",
    examples: ["Ubuntu Templates", "Approved Images", "Private Catalog", "Shared Images"],
    capabilities: ["Version Control", "Team Sharing", "Image Catalog"]
  },
  {
    icon: Code2,
    title: "Development & Testing",
    description: "Provision repeatable development, QA, staging, and sandbox environments from trusted image versions.",
    examples: ["QA Environments", "Staging Servers", "Sandbox Projects", "Test Clusters"],
    capabilities: ["Fast Provisioning", "Rollback", "Consistency"]
  },
  {
    icon: Shield,
    title: "Enterprise Operations",
    description: "Govern image lifecycles for production systems with consistent security posture and operational control.",
    examples: ["ERP Images", "CRM Platforms", "Internal Systems", "Production Baselines"],
    capabilities: ["Governance", "Secure Images", "Audit Ready"]
  },
  {
    icon: Globe2,
    title: "Multi-Region Deployment",
    description: "Replicate standardized images across regions so workloads can be deployed close to users and recovery targets.",
    examples: ["Mogadishu Region", "Hoa-Mogadishu-2", "DR Sites", "Regional Rollouts"],
    capabilities: ["High Availability", "DR Ready", "Replication"]
  }
];

const imsFaqs = [
  {
    question: "What is Image Management Service (IMS)?",
    answer: "Image Management Service (IMS) helps teams create, import, manage, share, and use cloud images for consistent server provisioning."
  },
  {
    question: "Can I create private images from existing servers?",
    answer: "Yes. IMS supports creating private images from existing cloud servers so teams can reuse configured operating systems and software stacks."
  },
  {
    question: "Does IMS support image sharing?",
    answer: "Yes. IMS supports sharing images across approved teams or tenants to standardize deployment environments."
  },
  {
    question: "How does IMS help with batch deployment?",
    answer: "Reusable images allow teams to provision multiple cloud servers with the same configuration, reducing setup time and operational drift."
  },
  {
    question: "Can imported images be used to migrate workloads?",
    answer: "Yes. Imported images can support workload migration by bringing existing server images into the HTGClouds environment."
  }
];

function ImageManagementServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Create, manage, replicate, and deploy cloud images with HTGClouds Image Management Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Image Management Service (IMS) | HTGClouds";
    metaDescription.setAttribute("content", description);

    return () => {
      document.title = previousTitle;
      if (previousDescription) {
        metaDescription.setAttribute("content", previousDescription);
      } else if (createdDescription) {
        metaDescription.remove();
      }
    };
  }, []);

  return (
    <main className="product-page ims-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">Centralized Image Management</div>
          <h1>Image Management Service (IMS)</h1>
          <p>
            Image Management Service (IMS) enables you to create, manage, share,
            and use cloud images to provision Elastic Cloud Servers with consistent
            operating systems, software, and configurations.
          </p>
          <div className="ecs-trust-chips" aria-label="IMS platform capabilities">
            {["Enterprise Grade", "Secure & Encrypted", "Multi Region", "API Driven", "Highly Available"].map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
          <div className="ecs-actions">
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Get a Demo
            </a>
            <a href="/signup" onClick={(event) => { event.preventDefault(); navigateTo("/signup"); }}>
              Contact Sales
            </a>
          </div>
          <div className="ecs-stats">
            <div>
              <strong>99.99% SLA</strong>
              <span>Enterprise Reliability</span>
            </div>
            <div>
              <strong>Multi-Region Replication</strong>
              <span>Image Availability</span>
            </div>
            <div>
              <strong>Automated Deployment</strong>
              <span>Faster Provisioning</span>
            </div>
          </div>
        </div>
        <ImsHeroVisual />
      </section>

      <section className="ecs-section ims-core-section">
        <div className="ecs-section-heading">
          <h2>Why Choose IMS?</h2>
          <p>Reliable image management designed for standardized deployments and operational efficiency.</p>
        </div>
        <div className="ims-core-grid">
          {imsCoreCapabilities.map(({ icon: Icon, title, description, benefits }) => (
            <article className="ims-core-block" key={title}>
              <span className="ims-core-icon" aria-hidden="true">
                <Icon size={24} />
              </span>
              <div className="ims-core-content">
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="ims-core-chips">
                  {benefits.map((benefit) => (
                    <span key={benefit}>
                      <CircleCheck size={14} />
                      {benefit}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="ecs-section ecs-workloads">
        <div className="ecs-section-heading centered">
          <h2>Built for Every Deployment Scenario</h2>
          <p>Create, manage, replicate, and deploy standardized cloud images across development, production, and multi-region environments.</p>
        </div>
        <div className="ecs-workload-grid">
          {imsDeploymentScenarios.map(({ icon: Icon, title, description, examples, capabilities }) => (
            <article className="ecs-workload-card" key={title}>
              <div className="ecs-workload-card-icon">
                <Icon size={22} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="ecs-workload-card-list">
                <span>Examples</span>
                <ul>
                  {examples.map((example) => (
                    <li key={example}>{example}</li>
                  ))}
                </ul>
              </div>
              <div className="ecs-workload-capabilities">
                {capabilities.map((capability) => (
                  <span key={capability}>
                    <CircleCheck size={14} />
                    {capability}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <ImsArchitectureWorkflow />

      <ImsFaq />
      <ImsCta />
      <Footer />
    </main>
  );
}

function ImsHeroVisual() {
  return (
    <div className="ecs-visual">
      <img src="/images/products/ims/ims-golden-repository.png" alt="" />
    </div>
  );
}

function ImsArchitectureWorkflow() {
  return (
    <section className="ecs-section ims-architecture-section">
      <div className="ecs-section-heading centered ims-architecture-heading">
        <h2>How IMS Works</h2>
        <p>Import, manage, and deploy standardized cloud images across ECS environments.</p>
      </div>
      <div className="ims-architecture-layout">
        <div className="ims-architecture-diagram" aria-label="Image Management Service architecture workflow">
          <svg className="ims-architecture-svg" viewBox="0 0 1000 620" role="img" aria-labelledby="ims-architecture-title">
            <title id="ims-architecture-title">Image file to OBS, IMS, ECS, and Auto Scaling workflow</title>
            <defs>
              <marker id="imsArrow" markerWidth="10" markerHeight="12" refX="9" refY="6" orient="auto" markerUnits="strokeWidth">
                <path d="M 0 1 L 10 6 L 0 11 z" fill="#9aa0a6" />
              </marker>
            </defs>

            <g className="ims-svg-lines" fill="none" stroke="#9aa0a6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9">
              <path d="M138 220 L138 278" markerEnd="url(#imsArrow)" />
              <path d="M212 340 L335 340" markerEnd="url(#imsArrow)" />
              <path d="M452 340 L575 340" markerEnd="url(#imsArrow)" />
              <path d="M452 340 C545 340 532 176 592 176 L612 176" markerEnd="url(#imsArrow)" />
              <path d="M452 340 C545 340 532 504 592 504 L612 504" markerEnd="url(#imsArrow)" />
              <path d="M886 340 L845 340" markerEnd="url(#imsArrow)" />
            </g>

            <g className="ims-svg-node image-file">
              <rect x="106" y="84" width="64" height="64" rx="12" fill="#ff9825" />
              <path d="M129 103 h22 l9 9 v28 h-31 z" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
              <path d="M150 103 v11 h10" fill="none" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
              <path d="M136 118 h17 M136 129 h17" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
              <text x="138" y="194" textAnchor="middle">Image File</text>
            </g>

            <g className="ims-svg-node obs">
              <rect x="100" y="303" width="76" height="76" rx="15" fill="#24bf5d" />
              <path d="M117 347 c0 -13 11 -23 24 -20 c4 -10 19 -10 25 0 c10 1 18 9 18 20 c0 12 -9 21 -23 21 h-36 c-5 0 -8 -4 -8 -10 z" fill="#fff" />
              <path d="M139 363 v-25 M139 338 l-13 13 M139 338 l13 13" fill="none" stroke="#24bf5d" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <text x="138" y="426" textAnchor="middle">Object Storage</text>
              <text x="138" y="458" textAnchor="middle">Service (OBS)</text>
            </g>

            <g className="ims-svg-node ims">
              <rect x="364" y="303" width="76" height="76" rx="15" fill="#9551e6" />
              <rect x="386" y="321" width="35" height="41" rx="4" fill="#fff" />
              <path d="M393 321 h32 c5 0 9 4 9 9 v33" fill="none" stroke="#fff" strokeWidth="4" />
              <path d="M399 321 h32 c5 0 9 4 9 9 v33" fill="none" stroke="#fff" strokeWidth="4" opacity="0.55" />
              <path d="M395 349 c0 -7 6 -12 12 -11 c2 -5 9 -5 12 0 c5 1 9 5 9 11 c0 6 -5 10 -11 10 h-17 c-3 0 -5 -2 -5 -5 z" fill="#9551e6" />
              <text x="402" y="426" textAnchor="middle">Image Management</text>
              <text x="402" y="458" textAnchor="middle">Service (IMS)</text>
            </g>

            <g className="ims-svg-ecs-panel">
              <rect x="612" y="48" width="235" height="540" rx="15" fill="#fafbfb" />
              <path d="M664 48 h183 v46 h-183 c-11 0 -20 -9 -20 -20 v-26 z" fill="#eef6ff" />
              <text x="756" y="80" textAnchor="middle" className="panel-title">Enterprise apps</text>

              {[132, 302, 472].map((y) => (
                <g className="ims-svg-ecs" key={y}>
                  <rect x="692" y={y} width="76" height="76" rx="15" fill="#ff5638" />
                  <path d={`M710 ${y + 47} c0 -10 8 -18 18 -16 c3 -8 14 -8 18 0 c8 1 15 7 15 16 c0 9 -7 16 -18 16 h-27 c-4 0 -7 -3 -7 -8 z`} fill="#fff" />
                  <path d={`M720 ${y + 51} h28 M720 ${y + 60} h37`} stroke="#ff5638" strokeWidth="4" strokeLinecap="round" />
                  <text x="730" y={y + 120} textAnchor="middle">Elastic Cloud Server</text>
                  <text x="730" y={y + 152} textAnchor="middle">(ECS)</text>
                </g>
              ))}
            </g>

            <g className="ims-svg-node scaling">
              <rect x="890" y="303" width="76" height="76" rx="15" fill="#11aee5" />
              <path d="M906 354 c12 -35 18 -35 30 0 s18 35 30 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
              <path d="M906 326 c12 35 18 35 30 0 s18 -35 30 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
              <text x="928" y="426" textAnchor="middle">Auto Scaling</text>
            </g>
          </svg>
        </div>

        <div className="ims-architecture-copy">
          <div>
            <h3>Introduction</h3>
            <p>
              By importing existing images, you can quickly migrate your data and applications to the cloud.
              A variety of image file formats are supported, including VHD, VMDK, QCOW2, and RAW.
            </p>
          </div>
          <div>
            <h3>Advantages</h3>
            <article>
              <h4>Easy Import</h4>
              <p>Private images can be easily imported to migrate workloads.</p>
            </article>
            <article>
              <h4>Unified Deployment</h4>
              <p>Using identical images across servers allows you to deploy workloads in batches.</p>
            </article>
            <article>
              <h4>High Durability</h4>
              <p>Redundant storage of your images ensures 99.999999999% data durability.</p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

function ImsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Image Management Service.</p>
      </div>
      <div className="pricing-faq-list">
        {imsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ImsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Ready to Standardize Your Cloud Images?</h2>
      </div>
      <div>
        <p>
          HTGClouds helps teams create reusable, secure images for faster,
          more consistent cloud server deployments.
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

function PricingPage() {
  const [activeTab, setActiveTab] = useState("Compute");
  const activeServices = getPricingTabItems(activeTab);

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
        <div className="pricing-hero-actions">
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
          <a
            className="button pricing-secondary-button"
            href="/pricing/calculator"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing/calculator");
            }}
          >
            Estimate Monthly Cost
          </a>
        </div>
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
          {activeServices.map((item) => (
            <PricingServiceCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <PricingFaq />
      <PricingCta />
      <Footer />
    </main>
  );
}

function getPricingTabItems(tab) {
  return pricingTabServices[tab].map((serviceId) => {
    if (serviceId === "database-contact") {
      return {
        id: serviceId,
        name: "Managed Database Services",
        description:
          "Managed PostgreSQL, MySQL, and enterprise database services are available through custom commercial plans.",
        category: "database",
        contactSales: true,
        rows: [["RDS PostgreSQL", "Managed database", "Contact Sales", "Contact Sales"], ["RDS MySQL", "Managed database", "Contact Sales", "Contact Sales"]],
        columns: ["Service", "Type", "Monthly", "Yearly"],
        summary: "Contact Sales",
        detail: "Custom database plans"
      };
    }

    const service = pricingCatalog.services[serviceId];
    return {
      id: service.id,
      name: service.name,
      description: pricingServiceDescriptions[service.id] || "Production-ready HTGCloud infrastructure service.",
      category: service.category,
      service,
      rows: buildPricingRows(service),
      columns: getPricingColumns(service),
      summary: getServiceStartingPrice(service),
      detail: getServicePricingDetail(service)
    };
  });
}

function PricingServiceCard({ item }) {
  const Icon = item.contactSales ? Database : pricingIconByCategory[item.category] || Cloud;

  return (
    <article className="pricing-card">
      <div className="pricing-card-copy">
        <div className="pricing-icon">
          <Icon size={20} />
        </div>
        <h2>{item.name}</h2>
        <p>{item.description}</p>
        <div className="pricing-starting">
          <span>Starting from</span>
          <strong>{item.summary}</strong>
          <small>{item.detail}</small>
        </div>
        <a
          href="/pricing/calculator"
          onClick={(event) => {
            event.preventDefault();
            navigateTo("/pricing/calculator");
          }}
        >
          Estimate in Calculator <span aria-hidden="true">-&gt;</span>
        </a>
      </div>
      <details className="pricing-details">
        <summary>View Pricing Details</summary>
        <PricingTable
          label={item.contactSales ? "Availability" : "Catalog rates"}
          columns={item.columns}
          rows={item.rows}
        />
      </details>
    </article>
  );
}

function getPricingColumns(service) {
  if (service.pricingModel === "flavor") return ["Flavor", "Example specs", "Monthly", "Yearly"];
  if (service.pricingModel === "per-gb") return ["Type", "Unit", "Monthly", "Yearly"];
  if (service.pricingModel === "bandwidth-tier") return ["Tier", "Unit", "Monthly", "Yearly"];
  return ["Type", "Unit", "Monthly", "Yearly"];
}

function buildPricingRows(service) {
  const sortedSkus = [...service.skus].sort((a, b) => getComparableSkuPrice(a) - getComparableSkuPrice(b));
  return sortedSkus.slice(0, 6).map((sku) => [
    getSkuDisplayName(sku),
    getSkuPricingUnit(service, sku),
    formatSkuPeriodPrice(sku, "monthly"),
    formatSkuPeriodPrice(sku, "yearly")
  ]);
}

function getComparableSkuPrice(sku) {
  if (sku.contactSales) return Number.POSITIVE_INFINITY;
  return sku.prices?.monthly ?? sku.prices?.yearly ?? sku.prices?.hourly ?? Number.POSITIVE_INFINITY;
}

function getServiceStartingPrice(service) {
  const pricedSkus = service.skus.filter((sku) => !sku.contactSales && sku.prices);
  if (pricedSkus.length === 0) return "Contact Sales";
  const lowest = pricedSkus.reduce((best, sku) => (getComparableSkuPrice(sku) < getComparableSkuPrice(best) ? sku : best));
  const period = lowest.prices?.monthly !== undefined ? "monthly" : lowest.prices?.yearly !== undefined ? "yearly" : "hourly";
  const price = lowest.prices?.[period];
  return `${formatPrice(price)}${getPeriodSuffix(period)}`;
}

function getServicePricingDetail(service) {
  if (service.pricingModel === "flavor") {
    const sku = service.skus
      .filter((entry) => !entry.contactSales)
      .sort((a, b) => getComparableSkuPrice(a) - getComparableSkuPrice(b))[0];
    if (sku?.vcpu !== undefined && sku?.ramGb !== undefined) return `${sku.vcpu} vCPU • ${sku.ramGb} GB RAM example`;
  }
  if (service.pricingModel === "per-gb") return `Per ${service.quantityLabel || "GB"} capacity`;
  if (service.pricingModel === "bandwidth-tier") return "Per Mbps tier";
  if (service.pricingModel === "per-quantity") return `Per ${service.quantityLabel}`;
  return service.quantityLabel;
}

function getSkuDisplayName(sku) {
  return sku.type ? `${sku.name} (${sku.type})` : sku.name;
}

function getSkuPricingUnit(service, sku) {
  if (sku.vcpu !== undefined && sku.ramGb !== undefined) {
    const storage = sku.storageGb !== undefined ? ` • ${sku.storageGb} GB storage` : "";
    return `${sku.vcpu} vCPU • ${sku.ramGb} GB RAM${storage}`;
  }
  if (sku.includedStorage) return `${sku.includedStorage} included`;
  if (sku.includedTraffic) return `${sku.includedTraffic} traffic`;
  if (sku.retentionPolicy) return sku.retentionPolicy;
  if (service.pricingModel === "per-gb") return `Per ${sku.unitLabel}`;
  if (sku.unit === "mbps") return `Per ${sku.unitLabel}`;
  return `Per ${sku.unitLabel}`;
}

function formatSkuPeriodPrice(sku, period) {
  if (sku.contactSales) return "Contact Sales";
  const price = sku.prices?.[period];
  if (price === undefined) return "-";
  return `${formatPrice(price)}${getPeriodSuffix(period)}`;
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

const calculatorCategories = [
  { id: "compute", label: "Compute" },
  { id: "storage", label: "Storage" },
  { id: "network", label: "Network" },
  { id: "security", label: "Security" },
  { id: "logs", label: "Logs" }
];

const calculatorBillingPeriods = ["hourly", "monthly", "yearly"];

function getCalculatorServices(category) {
  return pricingServices.filter((service) => service.category === category);
}

function getQuantityField(service) {
  return service.pricingModel === "per-gb" ? "capacityGb" : "quantity";
}

function getPricingModelLabel(service) {
  if (service.pricingModel === "flavor") return "Flavor based";
  if (service.pricingModel === "per-gb") return "GB capacity";
  if (service.pricingModel === "bandwidth-tier") return "Bandwidth tiers";
  if (service.pricingModel === "flat-tier") return "Tier based";
  if (service.pricingModel === "instance-type") return "Instance based";
  return "Quantity based";
}

function getSkuFamily(service, sku) {
  if (service.pricingModel === "flavor") {
    if (service.id === "BMS" || sku.cpuOvercommitRatio === "dedicated") {
      return {
        id: "dedicated-bare-metal",
        label: "Dedicated Bare Metal",
        description: "Physical compute for performance-sensitive workloads."
      };
    }

    const ramPerCpu = sku.vcpu ? sku.ramGb / sku.vcpu : 0;
    if (sku.name.startsWith("C") || sku.cpuOvercommitRatio === "1:1") {
      return {
        id: "compute-optimized",
        label: "Compute Optimized",
        description: "Balanced CPU performance for demanding applications."
      };
    }

    if (ramPerCpu >= 6) {
      return {
        id: "memory-optimized",
        label: "Memory Optimized",
        description: "Higher memory density for data-heavy workloads."
      };
    }

    return {
      id: "general-purpose",
      label: "General Purpose",
      description: "Everyday compute for web, app, and platform services."
    };
  }

  if (service.pricingModel === "per-gb") {
    if (service.id === "OBS") return { id: "object-storage", label: "Object Storage", description: "Durable object capacity for cloud data." };
    if (service.id === "SFS") return { id: "file-storage", label: "File Storage", description: "Shared file capacity for distributed systems." };
    if (service.id === "CSBS" || service.id === "VBS") return { id: "backup-storage", label: "Backup Storage", description: "Protected backup capacity for recovery." };
    return { id: "block-storage", label: "Block Storage", description: "Persistent disk capacity for cloud servers." };
  }

  if (service.pricingModel === "bandwidth-tier") {
    return { id: "bandwidth-tier", label: "Bandwidth Tiers", description: "Select public network throughput." };
  }

  if (service.pricingModel === "flat-tier") {
    if (sku.name.toLowerCase().includes("basic")) return { id: "basic", label: "Basic", description: "Entry service tier for evaluation." };
    if (sku.name.toLowerCase().includes("advanced")) return { id: "advanced", label: "Advanced", description: "Expanded controls for production use." };
    if (sku.name.toLowerCase().includes("enterprise")) return { id: "enterprise", label: "Enterprise", description: "Highest service tier for critical teams." };
    return { id: "managed-tier", label: "Managed Tier", description: "Packaged service capability." };
  }

  if (service.id.includes("EIP")) return { id: "public-network", label: "Public Network", description: "Public IP and traffic resources." };
  if (service.id.includes("ELB")) return { id: "load-balancing", label: "Load Balancing", description: "Traffic distribution resources." };
  if (service.id.includes("VPN")) return { id: "private-connectivity", label: "Private Connectivity", description: "Secure network connectivity." };

  return { id: "service-option", label: "Service Options", description: "Available pricing options." };
}

function getSkuFamilies(service, billingPeriod = pricingCatalog.defaultBillingPeriod) {
  const groupMap = new Map();

  service.skus.forEach((sku) => {
    const family = getSkuFamily(service, sku);
    if (!groupMap.has(family.id)) {
      groupMap.set(family.id, { ...family, skus: [] });
    }
    groupMap.get(family.id).skus.push(sku);
  });

  return Array.from(groupMap.values()).map((family) => {
    const pricedLines = family.skus.map((sku) =>
      calculateItemSubtotal({
        serviceId: service.id,
        skuId: sku.id,
        quantity: 1,
        capacityGb: 1,
        billingPeriod
      })
    );
    const numericPrices = pricedLines
      .filter((line) => !line.contactSales && line.unitPrice !== null)
      .map((line) => line.unitPrice);
    const startingPrice = numericPrices.length
      ? formatPrice(Math.min(...numericPrices))
      : "Contact Sales";

    return { ...family, startingPrice };
  });
}

function getFilteredSkus(skus, query) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return skus;

  return skus.filter((sku) => {
    const searchable = [
      getFriendlySkuTitle(sku),
      sku.name,
      sku.type,
      sku.features,
      sku.vcpu !== undefined ? `${sku.vcpu} vcpu` : "",
      sku.ramGb !== undefined ? `${sku.ramGb} gb ram` : "",
      sku.cpuOvercommitRatio ? `cpu ratio ${sku.cpuOvercommitRatio}` : ""
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

function getFriendlySkuTitle(sku) {
  if (sku.vcpu !== undefined && sku.ramGb !== undefined) {
    return `${sku.vcpu} vCPU • ${sku.ramGb} GB RAM`;
  }
  if (sku.type) return sku.type;
  return sku.name;
}

function getSkuDetailLine(sku) {
  const details = [];
  if (sku.storageGb !== undefined) details.push(`${sku.storageGb} GB storage`);
  if (sku.cpuOvercommitRatio) details.push(`CPU Ratio ${sku.cpuOvercommitRatio}`);
  if (sku.includedTraffic) details.push(`${sku.includedTraffic} traffic`);
  if (sku.includedStorage) details.push(`${sku.includedStorage} included`);
  if (sku.retentionPolicy) details.push(`${sku.retentionPolicy} retention`);
  if (sku.features) details.push(sku.features);
  return details.join(" • ");
}

function getPeriodSuffix(period) {
  if (period === "hourly") return "/hr";
  if (period === "yearly") return "/yr";
  return "/mo";
}

function PricingCalculatorPage() {
  const [activeCategory, setActiveCategory] = useState("compute");
  const [selectedServiceId, setSelectedServiceId] = useState("ECS");
  const [selectedSkuId, setSelectedSkuId] = useState(pricingCatalog.services.ECS.skus[0].id);
  const [selectedFamilyId, setSelectedFamilyId] = useState(getSkuFamily(pricingCatalog.services.ECS, pricingCatalog.services.ECS.skus[0]).id);
  const [skuSearch, setSkuSearch] = useState("");
  const [region, setRegion] = useState(pricingCatalog.regions[0]);
  const [billingPeriod, setBillingPeriod] = useState(pricingCatalog.defaultBillingPeriod);
  const [amount, setAmount] = useState(pricingCatalog.services.ECS.defaultQuantity);
  const [estimateItems, setEstimateItems] = useState([]);

  const selectedService = pricingCatalog.services[selectedServiceId] || pricingServices[0];
  const selectedSku = selectedService.skus.find((sku) => sku.id === selectedSkuId) || selectedService.skus[0];
  const familyGroups = getSkuFamilies(selectedService, billingPeriod);
  const activeFamily = familyGroups.find((family) => family.id === selectedFamilyId) || familyGroups[0];
  const visibleSkus = getFilteredSkus(activeFamily?.skus || selectedService.skus, skuSearch);
  const quantityField = getQuantityField(selectedService);
  const previewLine = calculateItemSubtotal({
    serviceId: selectedService.id,
    skuId: selectedSku.id,
    quantity: quantityField === "quantity" ? amount : undefined,
    capacityGb: quantityField === "capacityGb" ? amount : undefined,
    billingPeriod
  });
  const estimateTotals = calculateEstimateTotals(estimateItems);

  function selectCategory(categoryId) {
    const servicesInCategory = getCalculatorServices(categoryId);
    const nextService = servicesInCategory[0];
    setActiveCategory(categoryId);
    if (nextService) selectService(nextService.id);
  }

  function selectService(serviceId) {
    const service = pricingCatalog.services[serviceId];
    if (!service) return;
    setSelectedServiceId(service.id);
    const firstFamily = getSkuFamilies(service, billingPeriod)[0];
    const firstSku = firstFamily?.skus[0] || service.skus[0];
    setSelectedFamilyId(firstFamily?.id || getSkuFamily(service, firstSku).id);
    setSelectedSkuId(firstSku.id);
    setSkuSearch("");
    setAmount(service.defaultQuantity);
  }

  function selectFamily(family) {
    const firstSku = family.skus[0];
    setSelectedFamilyId(family.id);
    if (firstSku) setSelectedSkuId(firstSku.id);
  }

  function addToEstimate() {
    setEstimateItems((current) => [
      ...current,
      {
        id: `${selectedService.id}-${selectedSku.id}-${Date.now()}`,
        serviceId: selectedService.id,
        skuId: selectedSku.id,
        region,
        billingPeriod,
        quantity: quantityField === "quantity" ? amount : undefined,
        capacityGb: quantityField === "capacityGb" ? amount : undefined
      }
    ]);
  }

  function updateEstimateAmount(itemId, value) {
    const parsed = Number(value);
    setEstimateItems((current) =>
      current.map((item) => {
        if (item.id !== itemId) return item;
        const service = pricingCatalog.services[item.serviceId];
        const field = getQuantityField(service);
        return {
          ...item,
          [field]: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
        };
      })
    );
  }

  function removeEstimateItem(itemId) {
    setEstimateItems((current) => current.filter((item) => item.id !== itemId));
  }

  return (
    <main className="pricing-page calculator-page">
      <Navigation />
      <section className="calculator-hero">
        <span>Pricing Calculator</span>
        <h1>Estimate HTGCloud Infrastructure Costs</h1>
        <p>
          Configure compute, storage, network, security, and logging services
          using the HTGClouds pricing catalog.
        </p>
      </section>

      <section className="calculator-shell">
        <aside className="calculator-panel calculator-categories" aria-label="Pricing service categories">
          <h2>Services</h2>
          {calculatorCategories.map((category) => (
            <button
              key={category.id}
              className={activeCategory === category.id ? "active" : ""}
              type="button"
              onClick={() => selectCategory(category.id)}
            >
              {category.label}
              <span>{getCalculatorServices(category.id).length}</span>
            </button>
          ))}
        </aside>

        <section className="calculator-panel calculator-config">
          <div className="calculator-section-heading">
            <span>{selectedService.category}</span>
            <h2>Configure {selectedService.name}</h2>
          </div>

          <section className="service-picker" aria-label="Choose service">
            <div className="config-subheading">
              <span>Service</span>
              <strong>Choose a cloud service</strong>
            </div>
            <div className="service-choice-grid">
              {getCalculatorServices(activeCategory).map((service) => (
                <button
                  className={selectedService.id === service.id ? "selected" : ""}
                  key={service.id}
                  type="button"
                  onClick={() => selectService(service.id)}
                >
                  <span>{service.id}</span>
                  <strong>{service.name}</strong>
                  <small>{getPricingModelLabel(service)}</small>
                </button>
              ))}
            </div>
          </section>

          <div className="calculator-grid-two">
            <label>
              Region
              <select value={region} onChange={(event) => setRegion(event.target.value)}>
                {pricingCatalog.regions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Billing Period
              <select
                value={billingPeriod}
                onChange={(event) => setBillingPeriod(normalizeBillingPeriod(event.target.value))}
              >
                {calculatorBillingPeriods.map((period) => (
                  <option key={period} value={period}>
                    {period[0].toUpperCase() + period.slice(1)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className="family-selector" aria-label="Choose instance family">
            <div className="config-subheading">
              <span>{selectedService.pricingModel === "flavor" ? "Instance family" : "Pricing family"}</span>
              <strong>{selectedService.pricingModel === "flavor" ? "Start with a workload profile" : "Choose a pricing option group"}</strong>
            </div>
            <div className="family-card-grid">
              {familyGroups.map((family) => (
                <button
                  className={activeFamily?.id === family.id ? "selected" : ""}
                  key={family.id}
                  type="button"
                  onClick={() => selectFamily(family)}
                >
                  <strong>{family.label}</strong>
                  <span>{family.description}</span>
                  <small>{family.skus.length} option{family.skus.length === 1 ? "" : "s"} from {family.startingPrice}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="instance-selector" aria-label="Choose instance type">
            <div className="config-subheading">
              <span>{selectedService.pricingModel === "flavor" ? "Instance type" : "Type / Tier"}</span>
              <strong>Select an exact configuration</strong>
            </div>
            <input
              aria-label="Search instance type"
              className="instance-search"
              placeholder="Search instance type..."
              type="search"
              value={skuSearch}
              onChange={(event) => setSkuSearch(event.target.value)}
            />
            <div className="instance-card-grid">
              {visibleSkus.length === 0 ? (
                <div className="instance-empty">No matching configurations.</div>
              ) : (
                visibleSkus.map((sku) => (
                  <InstanceOptionCard
                    key={sku.id}
                    billingPeriod={billingPeriod}
                    selected={selectedSku.id === sku.id}
                    service={selectedService}
                    sku={sku}
                    onSelect={() => setSelectedSkuId(sku.id)}
                  />
                ))
              )}
            </div>
          </section>

          <SkuPreview sku={selectedSku} service={selectedService} billingPeriod={billingPeriod} region={region} />

          <label>
            {quantityField === "capacityGb" ? "Capacity (GB)" : selectedService.quantityLabel}
            <input
              min="0"
              type="number"
              value={amount}
              onChange={(event) => setAmount(Number(event.target.value))}
            />
          </label>

          <div className="calculator-preview-total">
            <span>Preview subtotal</span>
            <strong>{previewLine.contactSales ? "Contact Sales" : formatPrice(previewLine.subtotal)}</strong>
          </div>

          <button className="calculator-add-button" type="button" onClick={addToEstimate}>
            Add to Estimate
          </button>
        </section>

        <aside className="calculator-panel calculator-summary">
          <div className="calculator-summary-top">
            <div>
              <span>Live Estimate</span>
              <h2>{estimateItems.length} Services Selected</h2>
              {estimateTotals.contactSalesItems.length > 0 && (
                <p>{estimateTotals.contactSalesItems.length} contact-sales item(s) excluded from numeric total.</p>
              )}
            </div>
            <button type="button" onClick={() => setEstimateItems([])}>
              Reset
            </button>
          </div>

          <div className="estimate-scroll">
            <div className="estimate-list">
              {estimateItems.length === 0 ? (
                <div className="estimate-empty">No services added yet.</div>
              ) : (
                estimateItems.map((item) => (
                  <EstimateItem
                    key={item.id}
                    item={item}
                    onRemove={() => removeEstimateItem(item.id)}
                    onAmountChange={(value) => updateEstimateAmount(item.id, value)}
                  />
                ))
              )}
            </div>
          </div>

          <div className="estimate-summary-footer">
            <span>Estimated total</span>
            <strong>{estimateTotals.formattedSubtotal}</strong>
            <small>{estimateItems.length} Services Selected</small>
          </div>
        </aside>
      </section>
      <Footer />
    </main>
  );
}

function InstanceOptionCard({ sku, service, billingPeriod, selected, onSelect }) {
  const priceLine = calculateItemSubtotal({
    serviceId: service.id,
    skuId: sku.id,
    quantity: 1,
    capacityGb: 1,
    billingPeriod
  });
  const detailLine = getSkuDetailLine(sku);

  return (
    <button
      className={`instance-card${selected ? " selected" : ""}`}
      type="button"
      onClick={onSelect}
    >
      <span>{service.pricingModel === "flavor" ? "Instance" : "Option"}</span>
      <strong>{getFriendlySkuTitle(sku)}</strong>
      <div className="instance-specs">
        {sku.vcpu !== undefined && <small>{sku.vcpu} vCPU</small>}
        {sku.ramGb !== undefined && <small>{sku.ramGb} GB RAM</small>}
        {sku.storageGb !== undefined && <small>{sku.storageGb} GB storage</small>}
        {sku.cpuOvercommitRatio && <small>CPU Ratio {sku.cpuOvercommitRatio}</small>}
        {sku.unit === "gb" && <small>Per GB</small>}
        {sku.unit === "mbps" && <small>Per Mbps</small>}
        {sku.unit === "quantity" && <small>Per {sku.unitLabel}</small>}
        {sku.unit === "tier" && <small>{sku.unitLabel}</small>}
      </div>
      {detailLine && <p>{detailLine}</p>}
      <b>{priceLine.contactSales ? "Contact Sales" : `Starting ${formatPrice(priceLine.unitPrice)}${getPeriodSuffix(priceLine.billingPeriod)}`}</b>
      <em>{selected ? "Selected" : "Select"}</em>
    </button>
  );
}

function SkuPreview({ sku, service, billingPeriod, region }) {
  const serviceId = service.id;
  const priceLine = calculateItemSubtotal({
    serviceId,
    skuId: sku.id,
    quantity: 1,
    capacityGb: 1,
    billingPeriod
  });

  return (
    <div className="sku-preview">
      <div className="selected-config-head">
        <div>
          <span>Selected Configuration</span>
          <strong>{getFriendlySkuTitle(sku)}</strong>
        </div>
        <b>{priceLine.contactSales ? "Contact Sales" : `${formatPrice(priceLine.unitPrice)}${getPeriodSuffix(priceLine.billingPeriod)}`}</b>
      </div>
      <dl className="selected-config-list">
        <div>
          <dt>Service</dt>
          <dd>{service.name}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{region}</dd>
        </div>
        <div>
          <dt>Billing</dt>
          <dd>{billingPeriod}</dd>
        </div>
        {sku.vcpu !== undefined && (
          <div>
            <dt>vCPU</dt>
            <dd>{sku.vcpu}</dd>
          </div>
        )}
        {sku.ramGb !== undefined && (
          <div>
            <dt>RAM</dt>
            <dd>{sku.ramGb} GB</dd>
          </div>
        )}
        {sku.storageGb !== undefined && (
          <div>
            <dt>Storage</dt>
            <dd>{sku.storageGb} GB</dd>
          </div>
        )}
        {sku.cpuOvercommitRatio && (
          <div>
            <dt>CPU Ratio</dt>
            <dd>{sku.cpuOvercommitRatio}</dd>
          </div>
        )}
      </dl>
      {service.id === "WAF" && <p>Preview pricing from the WAF sheet. Confirm production readiness before quoting.</p>}
      {sku.features && <p>{sku.features}</p>}
    </div>
  );
}

function EstimateItem({ item, onRemove, onAmountChange }) {
  const service = pricingCatalog.services[item.serviceId];
  const sku = service.skus.find((entry) => entry.id === item.skuId);
  const line = calculateItemSubtotal(item);
  const field = getQuantityField(service);
  const amount = field === "capacityGb" ? item.capacityGb : item.quantity;

  return (
    <article className="estimate-item">
      <div className="estimate-item-head">
        <div>
          <h3>{service.name}</h3>
          <p>{sku ? getFriendlySkuTitle(sku) : item.skuId}</p>
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${service.name}`}>
          <X size={16} />
        </button>
      </div>
      <dl>
        <div>
          <dt>Billing</dt>
          <dd>{line.billingPeriod}</dd>
        </div>
        <div>
          <dt>Quantity</dt>
          <dd>{line.quantity} {line.unitLabel}</dd>
        </div>
      </dl>
      <label>
        {field === "capacityGb" ? "GB capacity" : service.quantityLabel}
        <input
          min="0"
          type="number"
          value={amount ?? service.defaultQuantity}
          onChange={(event) => onAmountChange(event.target.value)}
        />
      </label>
      <div className="estimate-unit-price">
        <span>Subtotal</span>
        <strong>{line.contactSales ? "Contact Sales" : formatPrice(line.subtotal)}</strong>
      </div>
    </article>
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
  const [message, setMessage] = useState("");

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
    setError("");
    setMessage("");
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

  async function handleResend() {
    setError("");
    setMessage("");

    try {
      const data = await resendVerificationEmail(pendingEmail);
      setMessage(data.message || "New verification code generated");
    } catch (error) {
      setError(error.message || "Could not resend verification code.");
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
        {message && <p className="auth-terms">{message}</p>}
        <button className="auth-submit" type="submit">
          Verify Email
        </button>
        <p className="auth-terms">
          Didn't receive the code? <button type="button" onClick={handleResend}>Resend email</button>
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
