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
  Lock,
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
    { name: "Elastic Volume Service", text: "Persistent block storage for cloud servers.", path: "/products/storage/elastic-volume-service" },
    { name: "Object Storage Service", text: "Durable object storage for cloud-native data.", path: "/products/storage/object-storage-service" },
    { name: "Scalable File Service", text: "Shared file storage for distributed workloads.", path: "/products/storage/scalable-file-service" },
    { name: "Cloud Server Backup Service", text: "Online backup and recovery for cloud servers.", path: "/products/storage/cloud-server-backup-service" },
    { name: "Volume Backup Service", text: "Disk-level backup and point-in-time recovery.", path: "/products/storage/volume-backup-service" }
  ],
  Network: [
    { name: "Virtual Private Cloud", text: "Private isolated networks for cloud resources.", path: "/products/network/virtual-private-cloud" },
    { name: "Elastic IP", text: "Public IP connectivity for internet-facing workloads.", path: "/products/network/elastic-ip" },
    { name: "Elastic Load Balance", text: "Traffic distribution for resilient applications.", path: "/products/network/elastic-load-balance" },
    { name: "Virtual Private Network", text: "Encrypted connectivity for hybrid cloud networks.", path: "/products/network/virtual-private-network" },
    { name: "Domain Name Service", text: "Authoritative DNS hosting and domain resolution.", path: "/products/network/domain-name-service" }
  ],
  Databases: [
    { name: "RDS for MySQL", text: "Fully managed MySQL-compatible database service.", path: "/products/database/rds-for-mysql" },
    { name: "Data Replication Service", text: "Database migration, synchronization, and replication.", path: "/products/database/data-replication-service" },
    { name: "GaussDB", text: "Enterprise-grade distributed database service.", path: "/products/database/gaussdb" }
  ],
  Application: [
    { name: "Simple Message Notification", text: "Reliable message delivery for applications.", path: "/products/application/simple-message-notification" },
    { name: "ROMA Connect", text: "Integration service for enterprise applications.", path: "/products/application/roma-connect" }
  ],
  "Management Tools": [
    { name: "Log Tank Service", text: "Centralized log collection, search, and retention.", path: "#" },
    { name: "Application Operation Management", text: "Observe and operate production workloads.", path: "#" }
  ],
  "Security and Compliance": [
    { name: "Web Application Firewall", text: "Protect web applications from common attacks.", path: "/products/security/web-application-firewall" },
    { name: "Cloud Bastion Host", text: "Secure administrative access and audit controls.", path: "/products/security/cloud-bastion-host" }
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
    path: "/products/network/virtual-private-cloud"
  },
  Databases: {
    icon: Database,
    name: "Relational Database Service (RDS)",
    path: "/products/database/rds-for-mysql"
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
  if (path === "/products/storage/elastic-volume-service") return <ElasticVolumeServicePage />;
  if (path === "/products/storage/object-storage-service") return <ObjectStorageServicePage />;
  if (path === "/products/storage/scalable-file-service") return <ScalableFileServicePage />;
  if (path === "/products/storage/cloud-server-backup-service") return <CloudServerBackupServicePage />;
  if (path === "/products/storage/volume-backup-service") return <VolumeBackupServicePage />;
  if (path === "/products/network/virtual-private-cloud") return <VirtualPrivateCloudPage />;
  if (path === "/products/network/elastic-ip") return <ElasticIpPage />;
  if (path === "/products/network/elastic-load-balance") return <ElasticLoadBalancePage />;
  if (path === "/products/network/virtual-private-network") return <VirtualPrivateNetworkPage />;
  if (path === "/products/network/domain-name-service") return <DomainNameServicePage />;
  if (path === "/products/database/rds-for-mysql") return <RdsForMysqlPage />;
  if (path === "/products/database/data-replication-service") return <DataReplicationServicePage />;
  if (path === "/products/database/gaussdb") return <GaussDbPage />;
  if (path === "/products/application/simple-message-notification") return <SimpleMessageNotificationPage />;
  if (path === "/products/application/roma-connect") return <RomaConnectPage />;
  if (path === "/products/security/web-application-firewall") return <WebApplicationFirewallPage />;
  if (path === "/products/security/cloud-bastion-host") return <CloudBastionHostPage />;
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

const evsBenefits = [
  {
    icon: HardDrive,
    title: "Persistent Storage",
    text: "Keep data available regardless of server lifecycle events. Volumes remain attached to your business, not individual compute instances."
  },
  {
    icon: Maximize2,
    title: "Capacity Expansion",
    text: "Expand storage capacity as requirements grow without rebuilding infrastructure or migrating workloads."
  },
  {
    icon: ShieldCheck,
    title: "Data Protection",
    text: "Reduce operational risk with snapshots, backup integration, and encryption capabilities designed for production environments."
  },
  {
    icon: Radio,
    title: "Enterprise Reliability",
    text: "Built for production workloads with dependable performance, durability, and operational stability."
  }
];

const evsOverviewHighlights = [
  "Reliable block storage for cloud workloads",
  "Flexible capacity management",
  "Secure data protection",
  "Snapshot and backup integration",
  "Centralized monitoring and lifecycle management"
];

const evsCapabilities = [
  {
    icon: HardDrive,
    title: "Persistent Block Storage",
    description: "Deliver reliable storage volumes for applications, databases, and production systems."
  },
  {
    icon: Maximize2,
    title: "Flexible Capacity Expansion",
    description: "Increase storage capacity as business requirements evolve without disrupting workloads."
  },
  {
    icon: Server,
    title: "System and Data Disk Support",
    description: "Use EVS volumes for operating systems, application data, and business-critical information."
  },
  {
    icon: ShieldCheck,
    title: "Snapshot & Backup Protection",
    description: "Create recovery points and integrate with backup services to improve resilience."
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Protect sensitive information using encryption and security controls."
  },
  {
    icon: Radio,
    title: "Lifecycle Management",
    description: "Monitor, manage, and optimize storage resources through a centralized management experience."
  }
];

const evsUseCases = [
  {
    icon: Cloud,
    title: "Cloud Application Storage",
    description: "Provide persistent storage for applications running on Elastic Cloud Servers.",
    capabilities: ["Persistent Storage", "Cloud Workloads", "Application Data"]
  },
  {
    icon: Database,
    title: "Database Workloads",
    description: "Store structured and transactional data with reliable block-level performance.",
    capabilities: ["Block Performance", "Transactional Data", "Reliable Storage"]
  },
  {
    icon: Boxes,
    title: "Business Systems",
    description: "Support ERP, CRM, financial systems, and internal business applications.",
    capabilities: ["Enterprise Apps", "Business Critical", "Operational Control"]
  },
  {
    icon: ShieldCheck,
    title: "Backup & Recovery",
    description: "Protect critical workloads through snapshots and backup integration.",
    capabilities: ["Snapshots", "Backup Integration", "Recovery Points"]
  }
];

const evsFaqs = [
  {
    question: "What is Elastic Volume Service (EVS)?",
    answer: "EVS is a persistent block storage service designed for cloud servers and enterprise workloads."
  },
  {
    question: "Can EVS be used for operating systems and application data?",
    answer: "Yes. EVS supports both system disks and data disks."
  },
  {
    question: "Can storage capacity be expanded?",
    answer: "Yes. EVS supports capacity expansion to accommodate growing workloads."
  },
  {
    question: "How is data protected?",
    answer: "EVS supports snapshots, backup integration, and optional encryption."
  },
  {
    question: "Which services integrate with EVS?",
    answer: "EVS integrates with Elastic Cloud Servers, Bare Metal Servers, backup services, monitoring services, and cloud management tools."
  }
];

function ElasticVolumeServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Deploy persistent block storage for cloud applications, databases, and business-critical workloads with HTGClouds Elastic Volume Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Elastic Volume Service (EVS) | HTGClouds";
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
    <main className="product-page ecs-page evs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Enterprise Block Storage</span>
          </div>
          <h1>Elastic Volume Service (EVS)</h1>
          <p>
            Persistent block storage built for cloud applications, databases, and
            business-critical workloads. Elastic Volume Service delivers reliable,
            high-performance storage for <a href="/products/compute/elastic-cloud-server" onClick={(event) => { event.preventDefault(); navigateTo("/products/compute/elastic-cloud-server"); }}>Elastic Cloud Servers</a> and <a href="/products/compute/bare-metal-server" onClick={(event) => { event.preventDefault(); navigateTo("/products/compute/bare-metal-server"); }}>Bare Metal Servers</a>.
            Scale capacity on demand, protect data with snapshots and backups, and
            maintain operational flexibility as workloads grow.
          </p>
          <div className="ecs-trust-chips" aria-label="EVS platform capabilities">
            {["Persistent Storage", "Capacity Expansion", "Snapshot Protection", "Disk Encryption"].map((chip) => (
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
        </div>
        <EvsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered evs-benefits-heading">
          <h2>Why Choose EVS?</h2>
          <p>Reliable block storage designed to support cloud infrastructure, enterprise applications, and data-intensive workloads.</p>
        </div>
        <div className="ecs-benefit-grid">
          {evsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section evs-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Storage Built for Modern Cloud Infrastructure</h2>
          <p>Elastic Volume Service provides persistent block storage for virtual machines and dedicated servers. Whether supporting operating systems, databases, business applications, or critical production workloads, EVS delivers the flexibility, durability, and operational control required by modern cloud environments. Estimate capacity costs with the <a href="/pricing/calculator" onClick={(event) => { event.preventDefault(); navigateTo("/pricing/calculator"); }}>pricing calculator</a>.</p>
        </div>
        <div className="ecs-workload-capabilities evs-overview-highlights">
          {evsOverviewHighlights.map((highlight) => (
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
          <p>Reliable storage services for persistent data, capacity growth, data protection, security, and lifecycle operations.</p>
        </div>
        <div className="as-capability-card-grid evs-capability-card-grid">
          {evsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Persistent block storage for applications, databases, business systems, and protected recovery workflows.</p>
        </div>
        <div className="ecs-workload-grid">
          {evsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <EvsHowItWorks />
      <EvsFaq />
      <EvsCta />
      <Footer />
    </main>
  );
}

function EvsHeroVisual() {
  return (
    <div className="ecs-visual evs-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Elastic Volume Service persistent storage illustration">
        <rect x="70" y="76" width="380" height="368" rx="34" fill="#f4fbfb" />
        <rect x="142" y="124" width="236" height="272" rx="28" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <rect x="178" y="164" width="164" height="56" rx="14" fill="#11161b" />
        <text x="260" y="199" textAnchor="middle" fill="#ffffff" fontSize="20" fontWeight="500">EVS Volume</text>
        {[246, 296, 346].map((y, index) => (
          <g key={y}>
            <rect x="166" y={y} width="188" height="32" rx="16" fill={index === 1 ? "#dcf7f7" : "#eefafa"} stroke="#ccebee" />
            <circle cx="188" cy={y + 16} r="6" fill="#23b8be" />
            <path d={`M208 ${y + 16} h118`} stroke="#8bd5d9" strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}
        <path d="M118 252 h-42 M444 252 h-42 M260 396 v46" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 10" />
        <rect x="44" y="214" width="86" height="76" rx="18" fill="#e7f8f8" stroke="#ccebee" />
        <path d="M66 252 h42 M87 231 v42" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <rect x="390" y="214" width="86" height="76" rx="18" fill="#e7f8f8" stroke="#ccebee" />
        <path d="M414 250 h38 M414 266 h30 M414 234 h22" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <rect x="192" y="424" width="136" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="451" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Protected Data</text>
      </svg>
    </div>
  );
}

function EvsHowItWorks() {
  return (
    <section className="ecs-section evs-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Attach persistent EVS volumes to cloud servers, expand capacity as workloads grow, and protect critical information with snapshots and backups.</p>
      </div>
      <div className="evs-how-layout">
        <div className="evs-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations attach EVS volumes to cloud servers to provide persistent storage for operating systems, applications, and business data.</p>
          <p>As workloads grow, storage capacity can be expanded while snapshots and backup services provide protection against failures and operational mistakes.</p>
        </div>
        <div className="evs-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Independent Data Persistence</h4>
            <p>Storage remains available even when compute resources change.</p>
          </article>
          <article>
            <h4>Elastic Capacity</h4>
            <p>Scale storage as business requirements evolve.</p>
          </article>
          <article>
            <h4>Reliable Protection</h4>
            <p>Use snapshots, backups, and encryption to secure critical information.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function EvsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Elastic Volume Service (EVS).</p>
      </div>
      <div className="pricing-faq-list">
        {evsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function EvsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Reliable Storage for Modern Cloud Workloads</h2>
      </div>
      <div>
        <p>Deploy scalable, secure, and persistent block storage for applications, databases, and business-critical systems.</p>
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

const obsBenefits = [
  {
    icon: Cloud,
    title: "Massive Scale Without Limits",
    text: "Store billions of objects and petabytes of data without managing infrastructure or storage capacity planning."
  },
  {
    icon: ShieldCheck,
    title: "Secure by Design",
    text: "Protect business-critical data using identity controls, secure access policies, and encrypted transmission."
  },
  {
    icon: Database,
    title: "Cost-Efficient Storage",
    text: "Pay only for what you store while optimizing storage costs across active, backup, and archive workloads."
  },
  {
    icon: SlidersVertical,
    title: "Simplified Data Management",
    text: "Manage data through the cloud console, APIs, SDKs, and lifecycle policies that automate storage operations."
  }
];

const obsOverviewHighlights = [
  "Virtually unlimited storage capacity",
  "Secure object access",
  "Lifecycle automation",
  "Distributed architecture",
  "Cost-efficient data storage",
  "API-driven operations"
];

const obsCapabilities = [
  {
    icon: Cloud,
    title: "Massive Object Storage",
    description: "Store large volumes of unstructured data without capacity constraints."
  },
  {
    icon: Maximize2,
    title: "Elastic Scalability",
    description: "Automatically scale storage capacity as applications and data requirements grow."
  },
  {
    icon: ShieldCheck,
    title: "Secure Access Control",
    description: "Protect data using authentication, permissions, and encrypted communications."
  },
  {
    icon: SlidersVertical,
    title: "Lifecycle Management",
    description: "Automate retention, movement, and management of stored data throughout its lifecycle."
  },
  {
    icon: Code2,
    title: "Multi-Interface Access",
    description: "Access and manage data through APIs, SDKs, CLI tools, and the cloud console."
  },
  {
    icon: Shield,
    title: "High Durability",
    description: "Built on distributed storage architecture designed to protect and preserve data."
  }
];

const obsUseCases = [
  {
    icon: Boxes,
    title: "Enterprise Data Storage",
    description: "Store files, application assets, and business content for enterprise systems and cloud applications.",
    capabilities: ["Business Content", "Application Assets", "Enterprise Files"]
  },
  {
    icon: ShieldCheck,
    title: "Backup & Archiving",
    description: "Protect critical information using cost-efficient storage for backup and long-term retention.",
    capabilities: ["Backup Storage", "Archive Workloads", "Retention"]
  },
  {
    icon: Globe2,
    title: "Media Storage & Distribution",
    description: "Store images, videos, audio files, and digital assets for websites, applications, and content platforms.",
    capabilities: ["Images", "Videos", "Digital Assets"]
  },
  {
    icon: Code2,
    title: "Application Data Repositories",
    description: "Provide scalable storage for modern cloud-native applications and business services.",
    capabilities: ["Cloud Native", "Application Data", "Scalable Storage"]
  }
];

const obsFaqs = [
  {
    question: "What is Object Storage Service (OBS)?",
    answer: "OBS is a cloud storage service that provides scalable object storage for unstructured data."
  },
  {
    question: "What types of data can be stored in OBS?",
    answer: "Images, videos, backups, archives, documents, application data, logs, and other unstructured content."
  },
  {
    question: "Is OBS suitable for backup and archiving?",
    answer: "Yes. OBS is commonly used for backup, long-term retention, and archive workloads."
  },
  {
    question: "How is data accessed?",
    answer: "Data can be accessed securely using APIs, SDKs, command-line tools, or the cloud console."
  },
  {
    question: "Does OBS support secure data transmission?",
    answer: "Yes. OBS supports secure communication using HTTPS."
  }
];

function ObjectStorageServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Store, protect, and access massive volumes of data with secure, durable, and highly scalable HTGClouds Object Storage Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Object Storage Service (OBS) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page obs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Scalable Object Storage</span>
          </div>
          <h1>Object Storage Service (OBS)</h1>
          <p>
            Store, protect, and access massive volumes of data with secure,
            durable, and highly scalable object storage. Object Storage Service
            (OBS) provides cloud-native storage for images, videos, backups,
            archives, application data, and business content. Scale seamlessly
            as data grows while maintaining security, durability, and cost efficiency.
          </p>
          <div className="ecs-trust-chips" aria-label="OBS platform capabilities">
            {["Massive Scalability", "High Durability", "Secure Access", "Lifecycle Management"].map((chip) => (
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
        </div>
        <ObsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose OBS?</h2>
          <p>Built for organizations that need secure, scalable, and cost-efficient storage for growing data volumes.</p>
        </div>
        <div className="ecs-benefit-grid">
          {obsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section obs-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Store Any Amount of Data</h2>
          <p>Object Storage Service is designed for unstructured data such as documents, images, videos, backups, application content, logs, and archives. Using a distributed storage architecture, OBS provides elastic scalability, high durability, and reliable access for modern cloud applications and enterprise workloads.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {obsOverviewHighlights.map((highlight) => (
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
          <p>Secure, scalable, and durable object storage for growing cloud-native and enterprise data requirements.</p>
        </div>
        <div className="as-capability-card-grid obs-capability-card-grid">
          {obsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Object storage for enterprise content, backups, media assets, and application data repositories.</p>
        </div>
        <div className="ecs-workload-grid">
          {obsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <ObsHowItWorks />
      <ObsFaq />
      <ObsCta />
      <Footer />
    </main>
  );
}

function ObsHeroVisual() {
  return (
    <div className="ecs-visual obs-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Object Storage Service scalable object storage illustration">
        <rect x="70" y="76" width="380" height="368" rx="34" fill="#f4fbfb" />
        <rect x="132" y="128" width="256" height="238" rx="30" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <path d="M180 206 C194 170, 226 170, 240 198 C260 184, 294 198, 296 228 C298 260, 272 276, 240 276 H190 C162 276, 148 248, 180 206 Z" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        {[178, 222, 266].map((x, index) => (
          <g key={x}>
            <rect x={x} y={304 + index * 14} width="74" height="32" rx="10" fill={index === 1 ? "#dcf7f7" : "#eefafa"} stroke="#ccebee" />
            <circle cx={x + 18} cy={320 + index * 14} r="5" fill="#23b8be" />
            <path d={`M${x + 32} ${320 + index * 14} h28`} stroke="#8bd5d9" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
        <path d="M150 390 h220" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 10" />
        <rect x="108" y="386" width="84" height="54" rx="18" fill="#e7f8f8" stroke="#ccebee" />
        <rect x="218" y="386" width="84" height="54" rx="18" fill="#e7f8f8" stroke="#ccebee" />
        <rect x="328" y="386" width="84" height="54" rx="18" fill="#e7f8f8" stroke="#ccebee" />
        <text x="150" y="420" textAnchor="middle" fill="#126f73" fontSize="16" fontWeight="500">Images</text>
        <text x="260" y="420" textAnchor="middle" fill="#126f73" fontSize="16" fontWeight="500">Backups</text>
        <text x="370" y="420" textAnchor="middle" fill="#126f73" fontSize="16" fontWeight="500">Archives</text>
        <rect x="164" y="104" width="192" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="131" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Object Storage</text>
      </svg>
    </div>
  );
}

function ObsHowItWorks() {
  return (
    <section className="ecs-section obs-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Upload data into storage buckets where it is securely stored, managed, and accessed through APIs, applications, or cloud management tools.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations upload data into storage buckets where it is securely stored, managed, and accessed through APIs, applications, or cloud management tools.</p>
          <p>As data volumes grow, storage scales automatically without infrastructure planning or capacity management.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Unlimited Growth</h4>
            <p>Scale storage seamlessly as business requirements evolve.</p>
          </article>
          <article>
            <h4>Secure Data Access</h4>
            <p>Control access through authentication, permissions, and encrypted communication.</p>
          </article>
          <article>
            <h4>Operational Simplicity</h4>
            <p>Manage large-scale storage environments without maintaining storage infrastructure.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function ObsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Object Storage Service (OBS).</p>
      </div>
      <div className="pricing-faq-list">
        {obsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ObsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Store and Scale Data with Confidence</h2>
      </div>
      <div>
        <p>Build applications, protect business data, and manage growing storage requirements with secure, durable, and cost-efficient object storage.</p>
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

const sfsBenefits = [
  {
    icon: Boxes,
    title: "Shared Access Without Complexity",
    text: "Enable multiple cloud servers to access the same files simultaneously without deploying or managing storage infrastructure."
  },
  {
    icon: Maximize2,
    title: "Scale as Data Grows",
    text: "Expand file system capacity seamlessly as storage requirements increase, without disrupting applications."
  },
  {
    icon: ShieldCheck,
    title: "Built for High Availability",
    text: "Support business-critical workloads with resilient storage architecture designed for continuous access and operational reliability."
  },
  {
    icon: Radio,
    title: "Fully Managed Operations",
    text: "Focus on applications and data while HTGClouds manages storage infrastructure, availability, and operational complexity."
  }
];

const sfsOverviewHighlights = [
  "Shared access across multiple servers",
  "Elastic storage growth",
  "High availability architecture",
  "Simplified operations",
  "Centralized file management",
  "Cloud-native scalability"
];

const sfsCapabilities = [
  {
    icon: Boxes,
    title: "Shared File Systems",
    description: "Provide centralized storage that can be accessed by multiple servers simultaneously."
  },
  {
    icon: Server,
    title: "Multi-Server Access",
    description: "Enable concurrent read and write operations across distributed application environments."
  },
  {
    icon: Maximize2,
    title: "Elastic Capacity Scaling",
    description: "Expand storage resources as business and application requirements evolve."
  },
  {
    icon: ShieldCheck,
    title: "High Availability Architecture",
    description: "Maintain access to critical data through resilient and distributed storage infrastructure."
  },
  {
    icon: Code2,
    title: "Standard File Protocol Support",
    description: "Use industry-standard file access methods for application compatibility and integration."
  },
  {
    icon: Radio,
    title: "Centralized Management",
    description: "Create, mount, manage, and monitor file systems through a unified cloud platform."
  }
];

const sfsUseCases = [
  {
    icon: Cloud,
    title: "Shared Application Storage",
    description: "Provide centralized storage for applications running across multiple cloud servers.",
    capabilities: ["Shared Storage", "Multiple Servers", "Application Data"]
  },
  {
    icon: Globe2,
    title: "Content Management & Media Processing",
    description: "Store, process, and share images, videos, and digital content across teams and applications.",
    capabilities: ["Media Workflows", "Team Sharing", "Digital Content"]
  },
  {
    icon: Code2,
    title: "Development & Analytics Platforms",
    description: "Support development environments, testing systems, and analytics workloads requiring shared file access.",
    capabilities: ["Dev Environments", "Analytics", "Shared Files"]
  },
  {
    icon: Database,
    title: "Enterprise Collaboration Workloads",
    description: "Enable departments, services, and business applications to access common datasets efficiently.",
    capabilities: ["Collaboration", "Common Datasets", "Business Apps"]
  }
];

const sfsFaqs = [
  {
    question: "What is Scalable File Service (SFS)?",
    answer: "SFS is a fully managed file storage service that provides shared file systems for cloud workloads."
  },
  {
    question: "Can multiple servers access the same file system?",
    answer: "Yes. Multiple Elastic Cloud Servers can mount and access the same file system concurrently."
  },
  {
    question: "Does SFS support capacity expansion?",
    answer: "Yes. Storage capacity can be expanded as requirements grow."
  },
  {
    question: "What protocol does SFS support?",
    answer: "SFS supports standard NFS-based file access."
  },
  {
    question: "Is SFS suitable for production workloads?",
    answer: "Yes. SFS is designed for business-critical workloads requiring shared access and high availability."
  }
];

function ScalableFileServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Enable shared file storage for applications, teams, and workloads with HTGClouds Scalable File Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Scalable File Service (SFS) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page sfs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Managed Shared File Storage</span>
          </div>
          <h1>Scalable File Service (SFS)</h1>
          <p>
            Fully managed shared file storage built for applications, teams, and
            workloads that require concurrent access to the same data. Scalable
            File Service (SFS) provides elastic file systems that can be mounted
            by multiple cloud servers simultaneously, enabling shared storage for
            enterprise applications, content platforms, analytics workloads, and
            collaborative environments.
          </p>
          <div className="ecs-trust-chips" aria-label="SFS platform capabilities">
            {["Shared File Access", "Elastic Capacity", "High Availability", "Managed Service"].map((chip) => (
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
        </div>
        <SfsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose SFS?</h2>
          <p>Shared file storage designed for organizations that need scalable, highly available, and easy-to-manage storage across multiple servers and applications.</p>
        </div>
        <div className="ecs-benefit-grid">
          {sfsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section sfs-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Shared Storage for Modern Applications</h2>
          <p>Scalable File Service provides centralized file storage that can be accessed concurrently by multiple cloud servers. Whether supporting business applications, media workflows, development environments, or analytics platforms, SFS delivers the flexibility of shared storage with the simplicity of a fully managed cloud service.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {sfsOverviewHighlights.map((highlight) => (
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
          <p>Managed shared file storage for distributed access, elastic growth, high availability, and centralized operations.</p>
        </div>
        <div className="as-capability-card-grid sfs-capability-card-grid">
          {sfsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Shared file storage for applications, media workflows, development platforms, analytics, and enterprise collaboration.</p>
        </div>
        <div className="ecs-workload-grid">
          {sfsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <SfsHowItWorks />
      <SfsFaq />
      <SfsCta />
      <Footer />
    </main>
  );
}

function SfsHeroVisual() {
  return (
    <div className="ecs-visual sfs-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Scalable File Service shared file storage illustration">
        <rect x="70" y="76" width="380" height="368" rx="34" fill="#f4fbfb" />
        <rect x="160" y="150" width="200" height="150" rx="28" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <path d="M190 202 h140 M190 236 h104" stroke="#23b8be" strokeWidth="8" strokeLinecap="round" />
        <path d="M190 176 h58 l18 22 h64" fill="none" stroke="#11161b" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M260 300 v48 M164 348 h192" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 10" />
        {[116, 224, 332].map((x) => (
          <g key={x}>
            <rect x={x} y="344" width="72" height="64" rx="16" fill="#e7f8f8" stroke="#ccebee" />
            <path d={`M${x + 18} 370 h36 M${x + 18} 386 h26`} stroke="#23b8be" strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}
        <rect x="154" y="104" width="212" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="131" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Shared File System</text>
      </svg>
    </div>
  );
}

function SfsHowItWorks() {
  return (
    <section className="ecs-section sfs-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Create shared file systems that can be mounted by multiple cloud servers while capacity scales as requirements grow.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations create shared file systems that can be mounted by multiple cloud servers simultaneously.</p>
          <p>Applications, users, and services access the same data repository while storage capacity scales automatically as requirements grow.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Shared Data Access</h4>
            <p>Enable multiple servers and applications to access the same files at the same time.</p>
          </article>
          <article>
            <h4>Seamless Scalability</h4>
            <p>Increase storage capacity without rebuilding infrastructure or interrupting workloads.</p>
          </article>
          <article>
            <h4>Simplified Management</h4>
            <p>Eliminate storage infrastructure complexity with a fully managed file storage service.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function SfsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Scalable File Service (SFS).</p>
      </div>
      <div className="pricing-faq-list">
        {sfsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SfsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Shared Storage for Scalable Applications</h2>
      </div>
      <div>
        <p>Enable collaboration, simplify operations, and provide reliable shared storage for cloud-native and enterprise workloads.</p>
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

const csbsBenefits = [
  {
    icon: ShieldCheck,
    title: "Backup Without Downtime",
    text: "Create consistent backups while applications and services remain online, eliminating the need for maintenance windows or service interruptions."
  },
  {
    icon: Zap,
    title: "Recover Faster",
    text: "Reduce downtime with efficient backup and recovery workflows designed to restore systems and data quickly."
  },
  {
    icon: Shield,
    title: "Built-In Data Protection",
    text: "Protect backup data through encryption, durable storage, and secure retention practices."
  },
  {
    icon: Radio,
    title: "Strengthen Business Continuity",
    text: "Improve operational resilience by ensuring critical systems can recover from accidental deletion, failures, or unexpected disruptions."
  }
];

const csbsOverviewHighlights = [
  "Online backup without downtime",
  "Fast recovery capabilities",
  "Incremental backup efficiency",
  "Secure encrypted storage",
  "Business continuity support",
  "Simplified backup management"
];

const csbsCapabilities = [
  {
    icon: ShieldCheck,
    title: "Online Backup Protection",
    description: "Create consistent backups while cloud servers continue running normally."
  },
  {
    icon: SlidersVertical,
    title: "Incremental Backup & Recovery",
    description: "Reduce backup windows and accelerate recovery using incremental technologies."
  },
  {
    icon: Zap,
    title: "Fast Data Restoration",
    description: "Recover workloads quickly when failures, corruption, or data loss occur."
  },
  {
    icon: Shield,
    title: "Encrypted Backup Storage",
    description: "Protect sensitive information through secure backup encryption."
  },
  {
    icon: Database,
    title: "Durable Backup Infrastructure",
    description: "Store backup data across resilient storage infrastructure designed for long-term reliability."
  },
  {
    icon: Radio,
    title: "Centralized Backup Management",
    description: "Manage backup operations, recovery processes, and protection policies through a unified platform."
  }
];

const csbsUseCases = [
  {
    icon: ShieldCheck,
    title: "Data Backup & Recovery",
    description: "Protect business data and rapidly restore services after accidental deletion, corruption, or infrastructure failures.",
    capabilities: ["Data Backup", "Fast Restore", "Failure Recovery"]
  },
  {
    icon: Radio,
    title: "Business Continuity",
    description: "Support operational resilience by maintaining recoverable copies of critical systems and workloads.",
    capabilities: ["Recoverable Copies", "Critical Systems", "Continuity"]
  },
  {
    icon: Shield,
    title: "Disaster Recovery Readiness",
    description: "Improve preparedness for unexpected disruptions through reliable backup and restoration capabilities.",
    capabilities: ["Preparedness", "Restoration", "Resilience"]
  },
  {
    icon: Server,
    title: "Rapid Environment Provisioning",
    description: "Use backup data to create images and accelerate deployment of new cloud servers.",
    capabilities: ["Backup Images", "New Servers", "Faster Deployment"]
  }
];

const csbsFaqs = [
  {
    question: "What is Cloud Server Backup Service (CSBS)?",
    answer: "CSBS is a cloud service that provides online backup and recovery for cloud server workloads."
  },
  {
    question: "Does CSBS require shutting down cloud servers?",
    answer: "No. Backups can be created while cloud servers and applications remain online."
  },
  {
    question: "Does CSBS support incremental backups?",
    answer: "Yes. CSBS supports incremental backup and incremental recovery."
  },
  {
    question: "Is backup data encrypted?",
    answer: "Yes. Backup data for encrypted disks is automatically encrypted and securely stored."
  },
  {
    question: "Can backups be used to deploy new cloud servers?",
    answer: "Yes. Backup data can be used to create images and accelerate deployment of new cloud servers."
  }
];

function CloudServerBackupServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Protect critical cloud workloads with automated backup, rapid recovery, and business continuity from HTGClouds Cloud Server Backup Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Cloud Server Backup Service (CSBS) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page csbs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Cloud Backup & Recovery</span>
          </div>
          <h1>Cloud Server Backup Service (CSBS)</h1>
          <p>
            Protect critical cloud workloads with automated backup, rapid recovery,
            and business continuity built into your infrastructure. Cloud Server
            Backup Service (CSBS) helps organizations safeguard cloud server data
            through consistent online backups, secure storage, and efficient recovery
            capabilities without disrupting running applications or business operations.
          </p>
          <div className="ecs-trust-chips" aria-label="CSBS platform capabilities">
            {["Online Backup", "Fast Recovery", "Encrypted Protection", "Business Continuity"].map((chip) => (
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
        </div>
        <CsbsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose CSBS?</h2>
          <p>Built for organizations that need reliable backup, rapid recovery, and continuous protection for business-critical workloads.</p>
        </div>
        <div className="ecs-benefit-grid">
          {csbsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section csbs-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Reliable Backup for Cloud Infrastructure</h2>
          <p>Cloud Server Backup Service provides online backup and recovery for cloud servers, helping organizations protect data, improve recoverability, and maintain operational continuity. Whether safeguarding production workloads, development environments, or business applications, CSBS delivers dependable backup protection without disrupting operations.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {csbsOverviewHighlights.map((highlight) => (
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
          <p>Cloud backup and recovery capabilities for online protection, fast restoration, encrypted storage, and centralized backup operations.</p>
        </div>
        <div className="as-capability-card-grid csbs-capability-card-grid">
          {csbsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Backup and recovery services for data protection, continuity, disaster readiness, and rapid provisioning.</p>
        </div>
        <div className="ecs-workload-grid">
          {csbsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <CsbsHowItWorks />
      <CsbsFaq />
      <CsbsCta />
      <Footer />
    </main>
  );
}

function CsbsHeroVisual() {
  return (
    <div className="ecs-visual csbs-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Cloud Server Backup Service backup and recovery illustration">
        <rect x="70" y="76" width="380" height="368" rx="34" fill="#f4fbfb" />
        <rect x="154" y="132" width="212" height="146" rx="28" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <path d="M200 204 C212 172, 242 174, 254 198 C274 184, 308 198, 308 230 C308 252, 288 264, 262 264 H210 C184 264, 172 236, 200 204 Z" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        <path d="M238 228 h46 M261 205 v46" stroke="#23b8be" strokeWidth="8" strokeLinecap="round" />
        <path d="M260 278 v52" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 10" />
        <rect x="166" y="330" width="188" height="68" rx="20" fill="#e7f8f8" stroke="#ccebee" />
        <path d="M196 364 h92 M196 382 h122" stroke="#23b8be" strokeWidth="6" strokeLinecap="round" />
        <circle cx="326" cy="364" r="16" fill="#11161b" />
        <path d="M319 364 l5 5 l10 -12" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="154" y="104" width="212" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="131" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Backup Recovery</text>
      </svg>
    </div>
  );
}

function CsbsHowItWorks() {
  return (
    <section className="ecs-section csbs-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Create automated backups of cloud server disks while applications remain online, then restore data quickly when recovery is needed.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations create automated backups of cloud server disks while applications remain online.</p>
          <p>Backup data is securely stored and can be restored quickly when recovery is needed, helping minimize downtime and maintain business continuity.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Continuous Protection</h4>
            <p>Safeguard workloads without disrupting business operations.</p>
          </article>
          <article>
            <h4>Rapid Recovery</h4>
            <p>Restore systems and data efficiently after failures or data loss events.</p>
          </article>
          <article>
            <h4>Operational Resilience</h4>
            <p>Improve business continuity through reliable backup and recovery workflows.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function CsbsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Cloud Server Backup Service (CSBS).</p>
      </div>
      <div className="pricing-faq-list">
        {csbsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CsbsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Protect Data and Recover with Confidence</h2>
      </div>
      <div>
        <p>Reduce downtime, strengthen business continuity, and safeguard critical workloads with automated cloud backup and recovery.</p>
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

const vbsBenefits = [
  {
    icon: ShieldCheck,
    title: "Backup Without Interruption",
    text: "Create backups while systems remain online, avoiding downtime and maintaining application availability."
  },
  {
    icon: Zap,
    title: "Recover to Any Backup Point",
    text: "Restore data from available backup points to minimize disruption and accelerate recovery."
  },
  {
    icon: Shield,
    title: "Built for Data Resilience",
    text: "Protect critical workloads through encrypted storage, durable backup infrastructure, and cross-availability-zone protection."
  },
  {
    icon: Radio,
    title: "Simplified Recovery Operations",
    text: "Reduce operational complexity with centralized backup management and streamlined recovery workflows."
  }
];

const vbsOverviewHighlights = [
  "Online backup without downtime",
  "Point-in-time recovery",
  "Incremental backup efficiency",
  "Cross-AZ protection",
  "Secure encrypted storage",
  "Simplified management"
];

const vbsCapabilities = [
  {
    icon: HardDrive,
    title: "Online Disk Backup",
    description: "Protect cloud disks while applications and services remain available."
  },
  {
    icon: SlidersVertical,
    title: "Incremental Backup & Recovery",
    description: "Reduce backup windows and accelerate restoration using incremental technologies."
  },
  {
    icon: Zap,
    title: "Point-in-Time Recovery",
    description: "Restore data to available backup points to recover from failures and operational errors."
  },
  {
    icon: ShieldCheck,
    title: "Cross-AZ Protection",
    description: "Improve resilience through backup storage and recovery capabilities across availability zones."
  },
  {
    icon: Shield,
    title: "Encrypted Backup Storage",
    description: "Protect sensitive data using secure encryption and storage mechanisms."
  },
  {
    icon: Radio,
    title: "Centralized Backup Management",
    description: "Manage protection policies, backup operations, and recovery workflows from a unified platform."
  }
];

const vbsUseCases = [
  {
    icon: ShieldCheck,
    title: "Data Backup & Recovery",
    description: "Protect cloud disk data and restore systems quickly after failures, corruption, or accidental deletion.",
    capabilities: ["Disk Backup", "Fast Restore", "Failure Recovery"]
  },
  {
    icon: Radio,
    title: "Business Continuity",
    description: "Maintain reliable data protection without impacting production operations.",
    capabilities: ["Online Protection", "Production Ready", "Continuity"]
  },
  {
    icon: Shield,
    title: "Disaster Recovery Preparedness",
    description: "Strengthen resilience through secure backups and rapid restoration capabilities.",
    capabilities: ["Secure Backups", "Rapid Restore", "Resilience"]
  },
  {
    icon: HardDrive,
    title: "Rapid Environment Replication",
    description: "Create new volumes and replicate cloud environments using backup data.",
    capabilities: ["New Volumes", "Backup Data", "Environment Replication"]
  }
];

const vbsFaqs = [
  {
    question: "What is Volume Backup Service (VBS)?",
    answer: "VBS is a cloud service that provides online backup and recovery for cloud storage volumes."
  },
  {
    question: "Does VBS require stopping cloud servers?",
    answer: "No. Backups are performed while services remain online."
  },
  {
    question: "Does VBS support incremental backups?",
    answer: "Yes. VBS supports incremental backup and incremental recovery."
  },
  {
    question: "Can I restore data to a previous backup point?",
    answer: "Yes. VBS supports restoration from available backup points."
  },
  {
    question: "Is backup data securely protected?",
    answer: "Yes. Encrypted backups are automatically secured and protected across availability zones."
  }
];

function VolumeBackupServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Protect cloud storage volumes with disk-level backup, point-in-time recovery, and encrypted cross-AZ resilience from HTGClouds Volume Backup Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Volume Backup Service (VBS) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page vbs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Disk Backup & Recovery</span>
          </div>
          <h1>Volume Backup Service (VBS)</h1>
          <p>
            Protect cloud disks with automated backups, rapid recovery, and
            point-in-time restoration designed for business-critical workloads.
            Volume Backup Service (VBS) provides online backup and recovery for
            cloud storage volumes, helping organizations protect data from
            accidental deletion, system failures, malware, and operational
            mistakes without disrupting running services.
          </p>
          <div className="ecs-trust-chips" aria-label="VBS platform capabilities">
            {["Online Backup", "Point-in-Time Recovery", "Cross-AZ Protection", "Encrypted Storage"].map((chip) => (
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
        </div>
        <VbsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose VBS?</h2>
          <p>Disk-level data protection built for reliability, recovery, and operational resilience.</p>
        </div>
        <div className="ecs-benefit-grid">
          {vbsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section vbs-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Reliable Protection for Cloud Storage Volumes</h2>
          <p>Volume Backup Service provides backup and recovery for cloud disks, helping organizations maintain data integrity, recover quickly from failures, and strengthen business continuity strategies. Whether protecting production systems, development environments, or critical business applications, VBS delivers dependable recovery capabilities with minimal operational overhead.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {vbsOverviewHighlights.map((highlight) => (
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
          <p>Disk-level backup and recovery capabilities for online protection, point-in-time restoration, encrypted storage, and centralized backup operations.</p>
        </div>
        <div className="as-capability-card-grid vbs-capability-card-grid">
          {vbsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Volume backup services for disk recovery, continuity, disaster preparedness, and rapid environment replication.</p>
        </div>
        <div className="ecs-workload-grid">
          {vbsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <VbsHowItWorks />
      <VbsFaq />
      <VbsCta />
      <Footer />
    </main>
  );
}

function VbsHeroVisual() {
  return (
    <div className="ecs-visual vbs-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Volume Backup Service disk backup and recovery illustration">
        <rect x="74" y="76" width="372" height="368" rx="34" fill="#f4fbfb" />
        <rect x="140" y="120" width="240" height="116" rx="26" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <rect x="184" y="152" width="152" height="52" rx="18" fill="#e7f8f8" />
        <path d="M212 176 h74 M212 194 h54" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <circle cx="318" cy="178" r="18" fill="#11161b" />
        <path d="M311 178 l5 5 l11 -13" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M260 236 v54" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeDasharray="9 10" />
        <rect x="154" y="292" width="212" height="92" rx="24" fill="#ffffff" stroke="#d7edf0" strokeWidth="3" />
        <ellipse cx="260" cy="326" rx="58" ry="18" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        <path d="M202 326 v24 c0 10 26 18 58 18 s58 -8 58 -18 v-24" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        <path d="M194 406 h132" stroke="#23b8be" strokeWidth="6" strokeLinecap="round" />
        <path d="M260 390 v32" stroke="#23b8be" strokeWidth="6" strokeLinecap="round" />
        <rect x="178" y="92" width="164" height="42" rx="21" fill="#e7f8f8" />
        <text x="260" y="119" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Point-in-Time Backup</text>
      </svg>
    </div>
  );
}

function VbsHowItWorks() {
  return (
    <section className="ecs-section vbs-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Create online backups of cloud storage volumes while applications remain operational, then restore data to available recovery points when needed.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations create online backups of cloud storage volumes while applications remain operational.</p>
          <p>Backup data is securely stored and can be restored to available recovery points whenever recovery is required.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Continuous Data Protection</h4>
            <p>Safeguard critical storage volumes without disrupting workloads.</p>
          </article>
          <article>
            <h4>Flexible Recovery</h4>
            <p>Restore data quickly using available backup points and recovery options.</p>
          </article>
          <article>
            <h4>Improved Resilience</h4>
            <p>Strengthen operational continuity through secure and durable backup infrastructure.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function VbsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Volume Backup Service (VBS).</p>
      </div>
      <div className="pricing-faq-list">
        {vbsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function VbsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Protect Storage Volumes with Confidence</h2>
      </div>
      <div>
        <p>Reduce risk, accelerate recovery, and strengthen data resilience with secure cloud volume backup and recovery.</p>
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

const vpcHeroFeatures = [
  {
    icon: ShieldCheck,
    title: "Secure Network Isolation",
    text: "Deploy applications inside dedicated virtual networks with complete separation from other cloud environments."
  },
  {
    icon: SlidersVertical,
    title: "Flexible Architecture",
    text: "Create custom CIDR ranges, subnets, route tables, and gateways that match your infrastructure requirements."
  },
  {
    icon: Zap,
    title: "High-Speed Connectivity",
    text: "Connect cloud workloads, Internet-facing services, and private environments through reliable networking services."
  }
];

const vpcBenefits = [
  {
    icon: ShieldCheck,
    title: "Complete Network Isolation",
    text: "Create logically isolated virtual networks with independent routing and access controls to securely separate workloads."
  },
  {
    icon: SlidersVertical,
    title: "Flexible Network Design",
    text: "Build custom network topologies using configurable CIDR blocks, subnets, route tables, and gateways."
  },
  {
    icon: Globe2,
    title: "Enterprise Connectivity",
    text: "Connect cloud resources to the Internet, private networks, and hybrid environments through secure networking services."
  },
  {
    icon: Radio,
    title: "Production-Ready Performance",
    text: "Support business-critical workloads with reliable, scalable, and high-performance cloud networking."
  }
];

const vpcOverviewHighlights = [
  "Build isolated virtual networks",
  "Create public and private subnets",
  "Configure routing policies",
  "Manage inbound and outbound traffic",
  "Segment applications across multiple tiers",
  "Integrate networking with cloud security services"
];

const vpcCapabilities = [
  {
    icon: Cloud,
    title: "Isolated Virtual Networks",
    description: "Deploy resources inside dedicated virtual cloud networks with complete logical separation."
  },
  {
    icon: SlidersVertical,
    title: "Custom Address Management",
    description: "Define CIDR blocks and subnet structures that align with application and organizational requirements."
  },
  {
    icon: Radio,
    title: "Advanced Routing Control",
    description: "Configure route tables and gateways to manage traffic flow between cloud resources and external networks."
  },
  {
    icon: Boxes,
    title: "Network Segmentation",
    description: "Separate application tiers, databases, and services using subnet-based architectures."
  },
  {
    icon: Globe2,
    title: "Cloud Service Integration",
    description: "Integrate seamlessly with EIP, NAT Gateway, ELB, Security Groups, and Network ACLs."
  },
  {
    icon: MousePointerClick,
    title: "Visualized Network Management",
    description: "Manage and monitor networking resources through intuitive cloud management tools."
  }
];

const vpcUseCases = [
  {
    icon: ShieldCheck,
    title: "Secure Application Environments",
    description: "Deploy backend systems and databases in isolated private subnets while controlling access through security policies.",
    capabilities: ["Private Subnets", "Security Policies", "Protected Backends"]
  },
  {
    icon: Globe2,
    title: "Web Application Hosting",
    description: "Expose public applications through Internet gateways and load balancing services while protecting internal resources.",
    capabilities: ["Public Apps", "Internet Gateway", "Load Balancing"]
  },
  {
    icon: Boxes,
    title: "Multi-Tier Architectures",
    description: "Separate web, application, and database layers using segmented networking environments.",
    capabilities: ["Web Tier", "App Tier", "Database Tier"]
  },
  {
    icon: Zap,
    title: "High-Traffic Workloads",
    description: "Support scalable applications by integrating VPC with Auto Scaling and Load Balancing services.",
    capabilities: ["Auto Scaling", "Traffic Control", "Scalable Apps"]
  }
];

const vpcFaqs = [
  {
    question: "What is a Virtual Private Cloud?",
    answer: "A Virtual Private Cloud is a logically isolated virtual network where cloud resources can be securely deployed and managed."
  },
  {
    question: "Can I create multiple subnets?",
    answer: "Yes. VPC supports flexible subnet creation and network segmentation."
  },
  {
    question: "How does VPC improve security?",
    answer: "VPC combines network isolation, routing control, security groups, and network ACLs to help protect cloud resources."
  },
  {
    question: "Can VPC connect to the Internet?",
    answer: "Yes. VPC integrates with Elastic IPs, NAT Gateways, and routing services to enable Internet connectivity."
  },
  {
    question: "Is VPC suitable for production workloads?",
    answer: "Yes. VPC is designed to support secure, scalable, and production-ready cloud architectures."
  }
];

function VirtualPrivateCloudPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Build isolated virtual networks with secure connectivity, subnet design, routing control, and cloud-native networking from HTGClouds Virtual Private Cloud.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Virtual Private Cloud (VPC) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page network-product-page vpc-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Cloud Networking</span>
          </div>
          <h1>Virtual Private Cloud (VPC)</h1>
          <p>
            Build secure cloud environments with complete control over networking,
            connectivity, and traffic management. Virtual Private Cloud (VPC)
            provides isolated virtual networks where applications, databases, and
            cloud resources can operate securely while remaining connected to the
            services and users that matter most.
          </p>
          <div className="ecs-trust-chips" aria-label="VPC platform capabilities">
            {["Network Isolation", "Flexible Subnet Design", "Secure Connectivity", "Intelligent Routing", "Cloud-Native Networking"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {vpcHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <VpcHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose VPC?</h2>
          <p>Virtual Private Cloud provides the networking foundation for modern cloud applications. Whether you're deploying web applications, databases, enterprise systems, or multi-tier architectures, VPC delivers the isolation, flexibility, and connectivity required for production environments.</p>
        </div>
        <div className="ecs-benefit-grid">
          {vpcBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section vpc-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Networking Foundation for Cloud Infrastructure</h2>
          <p>Virtual Private Cloud enables organizations to create secure and isolated cloud networking environments while maintaining full control over traffic management and resource communication.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {vpcOverviewHighlights.map((highlight) => (
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
          <p>Cloud networking capabilities for isolated environments, custom addressing, routing control, segmentation, service integration, and visualized management.</p>
        </div>
        <div className="as-capability-card-grid vpc-capability-card-grid">
          {vpcCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Secure networking foundations for application environments, public services, multi-tier systems, and scalable high-traffic workloads.</p>
        </div>
        <div className="ecs-workload-grid">
          {vpcUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <VpcHowItWorks />
      <VpcFaq />
      <VpcCta />
      <Footer />
    </main>
  );
}

function VpcHeroVisual() {
  return (
    <div className="ecs-visual vpc-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Virtual Private Cloud networking illustration">
        <defs>
          <linearGradient id="vpcCloudGradient" x1="120" y1="90" x2="420" y2="420" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8fbfb" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <rect x="64" y="72" width="392" height="376" rx="36" fill="url(#vpcCloudGradient)" stroke="#d4eef1" strokeWidth="3" />
        <path d="M160 186 C176 144, 216 146, 235 176 C260 148, 316 164, 318 210 C356 214, 380 238, 380 270 C380 308, 348 330, 300 330 H180 C136 330, 112 306, 116 270 C120 230, 136 206, 160 186 Z" fill="#ffffff" stroke="#bde7eb" strokeWidth="4" />
        <text x="248" y="210" textAnchor="middle" fill="#126f73" fontSize="22" fontWeight="500">VPC</text>

        <rect x="126" y="238" width="116" height="72" rx="18" fill="#e7f8f8" stroke="#9fdfe4" strokeWidth="3" />
        <text x="184" y="264" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Public Subnet</text>
        <rect x="152" y="276" width="26" height="20" rx="5" fill="#23b8be" />
        <rect x="190" y="276" width="26" height="20" rx="5" fill="#23b8be" opacity="0.75" />

        <rect x="278" y="238" width="116" height="72" rx="18" fill="#f7fbfb" stroke="#d7edf0" strokeWidth="3" />
        <text x="336" y="264" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Private Subnet</text>
        <ellipse cx="322" cy="288" rx="20" ry="8" fill="#23b8be" opacity="0.35" />
        <path d="M302 288 v14 c0 5 9 9 20 9 s20 -4 20 -9 v-14" fill="#dff8f8" stroke="#23b8be" strokeWidth="3" />
        <rect x="354" y="276" width="22" height="22" rx="6" fill="#11161b" opacity="0.92" />

        <rect x="116" y="126" width="92" height="48" rx="16" fill="#ffffff" stroke="#d7edf0" />
        <text x="162" y="156" textAnchor="middle" fill="#11161b" fontSize="13" fontWeight="500">Gateway</text>
        <path d="M208 150 h48" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="302" y="126" width="104" height="48" rx="16" fill="#ffffff" stroke="#d7edf0" />
        <text x="354" y="156" textAnchor="middle" fill="#11161b" fontSize="13" fontWeight="500">Route Table</text>
        <path d="M318 174 l-32 40 M354 174 v42" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" />

        <circle cx="260" cy="374" r="34" fill="#e7f8f8" stroke="#9fdfe4" strokeWidth="3" />
        <path d="M260 346 l24 10 v18 c0 19 -10 31 -24 38 c-14 -7 -24 -19 -24 -38 v-18 z" fill="#23b8be" />
        <path d="M249 374 l8 8 l17 -22" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="260" y="430" textAnchor="middle" fill="#126f73" fontSize="16" fontWeight="500">Security Controls</text>

        <path d="M184 310 C188 346, 218 366, 226 374 M336 310 C332 346, 302 366, 294 374" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="8 8" />
      </svg>
    </div>
  );
}

function VpcHowItWorks() {
  return (
    <section className="ecs-section vpc-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Create isolated virtual networks, divide resources into subnets, and control traffic through route tables, gateways, and security mechanisms.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization creates a Virtual Private Cloud and divides resources into multiple subnets.</p>
          <p>Public-facing applications are deployed within public subnets while databases and backend services remain protected in private subnets. Traffic flows through configurable route tables, security groups, and gateways, providing secure communication between users, applications, and cloud resources.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Complete Isolation</h4>
            <p>Protect workloads through dedicated virtual networking environments.</p>
          </article>
          <article>
            <h4>Flexible Architecture</h4>
            <p>Design networking layouts that support both simple and complex cloud deployments.</p>
          </article>
          <article>
            <h4>Secure Connectivity</h4>
            <p>Control communication through routing policies, gateways, and layered security mechanisms.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function VpcFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Virtual Private Cloud (VPC).</p>
      </div>
      <div className="pricing-faq-list">
        {vpcFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function VpcCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Build Secure Cloud Networks with HTGCloud</h2>
      </div>
      <div>
        <p>Create isolated, scalable, and high-performance cloud networking environments designed for modern applications and enterprise workloads.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const elbHeroFeatures = [
  {
    icon: ShieldCheck,
    title: "High Availability by Design",
    text: "Automatically detect unhealthy backend servers and route traffic to healthy instances to maintain service continuity."
  },
  {
    icon: Zap,
    title: "Elastic Traffic Handling",
    text: "Scale application delivery seamlessly during traffic surges without manual traffic management."
  },
  {
    icon: Radio,
    title: "Enterprise-Grade Performance",
    text: "Support high-concurrency workloads with fast traffic distribution and reliable backend connectivity."
  }
];

const elbBenefits = [
  {
    icon: ShieldCheck,
    title: "High Availability Architecture",
    text: "Cluster-based deployment combined with health monitoring ensures traffic is always directed to healthy backend resources."
  },
  {
    icon: Zap,
    title: "Elastic Scalability",
    text: "Automatically adapt to traffic fluctuations and growing workloads without disrupting application availability."
  },
  {
    icon: Radio,
    title: "Intelligent Failover",
    text: "Detect backend failures in real time and redirect traffic automatically to maintain service continuity."
  },
  {
    icon: SlidersVertical,
    title: "Cost-Efficient Operations",
    text: "Integrate with Auto Scaling to optimize infrastructure utilization and reduce unnecessary resource costs."
  }
];

const elbOverviewHighlights = [
  "Distribute traffic across multiple backend servers",
  "Improve application availability",
  "Increase fault tolerance",
  "Support traffic spikes",
  "Simplify traffic management",
  "Improve user experience consistency"
];

const elbCapabilities = [
  {
    icon: Globe2,
    title: "Intelligent Traffic Distribution",
    description: "Automatically distribute requests across multiple backend servers to optimize application performance."
  },
  {
    icon: ShieldCheck,
    title: "Health Monitoring & Automatic Failover",
    description: "Continuously monitor backend health and reroute traffic away from unhealthy instances."
  },
  {
    icon: Zap,
    title: "Elastic Scaling Integration",
    description: "Work seamlessly with Auto Scaling services to adjust backend capacity based on workload demand."
  },
  {
    icon: Cloud,
    title: "High Availability Deployment",
    description: "Provide resilient application delivery through distributed and cluster-based load balancing architecture."
  },
  {
    icon: MousePointerClick,
    title: "Fast Service Deployment",
    description: "Accelerate application launches and infrastructure updates with simplified traffic management."
  },
  {
    icon: Radio,
    title: "Centralized Traffic Management",
    description: "Monitor, manage, and optimize traffic distribution through a unified cloud management experience."
  }
];

const elbUseCases = [
  {
    icon: Globe2,
    title: "High-Traffic Websites",
    description: "Distribute large volumes of traffic across multiple backend resources to improve performance and reliability.",
    capabilities: ["Large Traffic", "Backend Pools", "Reliable Delivery"]
  },
  {
    icon: Boxes,
    title: "E-Commerce Platforms",
    description: "Maintain responsive shopping experiences during seasonal spikes, promotions, and peak demand periods.",
    capabilities: ["Peak Demand", "Promotions", "Responsive Apps"]
  },
  {
    icon: Radio,
    title: "Video & Media Platforms",
    description: "Handle unpredictable traffic patterns while delivering consistent performance to users.",
    capabilities: ["Traffic Spikes", "Media Delivery", "Consistent Performance"]
  },
  {
    icon: ShieldCheck,
    title: "Enterprise & Government Systems",
    description: "Ensure stable service delivery for mission-critical business applications through automated fault handling and resilient traffic distribution.",
    capabilities: ["Mission Critical", "Fault Handling", "Resilient Routing"]
  }
];

const elbFaqs = [
  {
    question: "What is Elastic Load Balance (ELB)?",
    answer: "Elastic Load Balance is a cloud service that distributes incoming traffic across multiple backend servers to improve availability, scalability, and performance."
  },
  {
    question: "Does ELB support automatic failover?",
    answer: "Yes. ELB continuously monitors backend health and automatically routes traffic away from unhealthy instances."
  },
  {
    question: "Can ELB handle traffic spikes?",
    answer: "Yes. ELB is designed to distribute traffic efficiently and works with Auto Scaling to support sudden traffic increases."
  },
  {
    question: "Does ELB integrate with Auto Scaling?",
    answer: "Yes. ELB integrates with Auto Scaling services to dynamically adjust backend capacity based on workload demand."
  },
  {
    question: "Is ELB suitable for production workloads?",
    answer: "Yes. ELB is designed for high-availability production environments requiring resilient and scalable traffic management."
  }
];

function ElasticLoadBalancePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Distribute application traffic across backend servers with high availability, automatic failover, and elastic scalability from HTGClouds Elastic Load Balance.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Elastic Load Balance (ELB) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page network-product-page elb-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Application Traffic Management</span>
          </div>
          <h1>Elastic Load Balance (ELB)</h1>
          <p>
            Deliver reliable application performance, maintain service availability,
            and scale seamlessly with intelligent traffic distribution. Elastic Load
            Balance (ELB) automatically distributes incoming traffic across multiple
            backend servers, helping applications handle traffic spikes, improve
            fault tolerance, and maintain consistent user experiences.
          </p>
          <div className="ecs-trust-chips" aria-label="ELB platform capabilities">
            {["Intelligent Traffic Distribution", "High Availability Architecture", "Automatic Failover", "Elastic Scalability", "Production-Ready Performance"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {elbHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <ElbHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose ELB?</h2>
          <p>Elastic Load Balance helps organizations deliver highly available applications by intelligently distributing traffic across multiple backend services. Whether supporting customer-facing platforms, enterprise systems, or large-scale digital services, ELB provides the performance, scalability, and fault tolerance needed for production workloads.</p>
        </div>
        <div className="ecs-benefit-grid">
          {elbBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section elb-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Reliable Traffic Distribution for Modern Applications</h2>
          <p>Elastic Load Balance separates user traffic from backend infrastructure, creating a flexible and resilient application delivery layer.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {elbOverviewHighlights.map((highlight) => (
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
          <p>Load balancing capabilities for intelligent traffic distribution, health monitoring, failover, scaling integration, and centralized traffic operations.</p>
        </div>
        <div className="as-capability-card-grid elb-capability-card-grid">
          {elbCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Resilient traffic distribution for websites, commerce platforms, media workloads, and enterprise systems.</p>
        </div>
        <div className="ecs-workload-grid">
          {elbUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <ElbHowItWorks />
      <ElbFaq />
      <ElbCta />
      <Footer />
    </main>
  );
}

function ElbHeroVisual() {
  return (
    <div className="ecs-visual elb-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Elastic Load Balance traffic distribution illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <circle cx="260" cy="246" r="62" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M228 250 h64 M260 218 v64 M238 232 l44 36 M282 232 l-44 36" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="260" y="330" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">ELB</text>

        <rect x="104" y="130" width="100" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="154" y="164" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Users</text>
        <path d="M204 158 C238 158 238 214 218 224" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        {[126, 220, 314].map((y, index) => (
          <g key={y}>
            <rect x="328" y={y} width="94" height="58" rx="18" fill={index === 1 ? "#e7f8f8" : "#ffffff"} stroke="#d7edf0" />
            <rect x="354" y={y + 18} width="42" height="24" rx="7" fill="#23b8be" opacity={index === 2 ? "0.7" : "1"} />
            <path d={`M322 ${y + 29} C300 ${y + 29} 294 246 326 246`} stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
          </g>
        ))}

        <rect x="104" y="316" width="118" height="62" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <path d="M134 346 h58 M163 326 v40" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="163" y="404" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Health Checks</text>

        <path d="M222 346 C238 336 244 316 250 294" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
      </svg>
    </div>
  );
}

function ElbHowItWorks() {
  return (
    <section className="ecs-section elb-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Distribute application requests across healthy backend servers while automated health checks maintain resilient service delivery.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization deploys multiple backend application servers behind Elastic Load Balance.</p>
          <p>As users access the application, ELB automatically distributes requests across available backend resources. Health checks continuously monitor server status and automatically redirect traffic if a backend instance becomes unavailable.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Continuous Availability</h4>
            <p>Maintain service uptime through intelligent traffic routing and automated failover.</p>
          </article>
          <article>
            <h4>Seamless Scalability</h4>
            <p>Handle traffic growth efficiently without redesigning application architecture.</p>
          </article>
          <article>
            <h4>Operational Simplicity</h4>
            <p>Reduce infrastructure complexity by automating traffic distribution and backend resource management.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function ElbFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Elastic Load Balance (ELB).</p>
      </div>
      <div className="pricing-faq-list">
        {elbFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ElbCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Deliver Reliable Application Performance at Scale</h2>
      </div>
      <div>
        <p>Improve application availability, simplify traffic management, and support business growth with intelligent cloud load balancing.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const eipHeroFeatures = [
  {
    icon: Globe2,
    title: "Dedicated Public Connectivity",
    text: "Assign stable public IP addresses to cloud resources and maintain reliable Internet access."
  },
  {
    icon: SlidersVertical,
    title: "Flexible Bandwidth Control",
    text: "Scale bandwidth up or down instantly to match application traffic and business demand."
  },
  {
    icon: Radio,
    title: "Cost-Efficient Networking",
    text: "Optimize network costs through shared bandwidth and flexible billing options."
  }
];

const eipBenefits = [
  {
    icon: Globe2,
    title: "Independent Public IP Resources",
    text: "Allocate and manage public IP addresses independently from cloud resources, enabling greater operational flexibility."
  },
  {
    icon: SlidersVertical,
    title: "Elastic Bandwidth Management",
    text: "Adjust bandwidth dynamically to support changing application requirements without service interruptions."
  },
  {
    icon: Boxes,
    title: "Shared Bandwidth Efficiency",
    text: "Improve utilization and reduce costs by allowing multiple Elastic IPs to share a common bandwidth pool."
  },
  {
    icon: Radio,
    title: "Flexible Cost Control",
    text: "Choose billing models that align with application usage patterns and business requirements."
  }
];

const eipOverviewHighlights = [
  "Enable Internet access for cloud resources",
  "Expose applications and services publicly",
  "Support remote administration",
  "Centralize Internet connectivity",
  "Manage public networking resources efficiently",
  "Optimize bandwidth utilization"
];

const eipCapabilities = [
  {
    icon: Globe2,
    title: "Static Public IP Allocation",
    description: "Provide dedicated public IP addresses that remain stable and reliable for cloud workloads."
  },
  {
    icon: MousePointerClick,
    title: "Flexible Resource Association",
    description: "Bind and unbind Elastic IPs from supported cloud resources as business requirements evolve."
  },
  {
    icon: SlidersVertical,
    title: "Elastic Bandwidth Scaling",
    description: "Increase or decrease bandwidth capacity dynamically without service disruption."
  },
  {
    icon: Boxes,
    title: "Shared Bandwidth Pools",
    description: "Allow multiple Elastic IPs to share available bandwidth for greater efficiency and cost savings."
  },
  {
    icon: Zap,
    title: "Rapid Service Activation",
    description: "Deploy and configure public connectivity quickly through the cloud management platform."
  },
  {
    icon: Radio,
    title: "Centralized Network Management",
    description: "Manage IP resources, bandwidth, and connectivity settings through a unified cloud interface."
  }
];

const eipUseCases = [
  {
    icon: Server,
    title: "Internet Access for Cloud Servers",
    description: "Provide secure Internet connectivity for Elastic Cloud Servers and cloud-hosted applications.",
    capabilities: ["Cloud Servers", "Internet Access", "Secure Connectivity"]
  },
  {
    icon: Globe2,
    title: "Public Application Exposure",
    description: "Expose web applications, APIs, and digital services through dedicated public IP addresses.",
    capabilities: ["Web Apps", "APIs", "Public Services"]
  },
  {
    icon: ShieldCheck,
    title: "Centralized Internet Egress",
    description: "Use Elastic IP together with NAT Gateway services to provide controlled Internet access across private cloud environments.",
    capabilities: ["NAT Gateway", "Controlled Egress", "Private Networks"]
  },
  {
    icon: Boxes,
    title: "Multi-Service Connectivity",
    description: "Support multiple applications and cloud services through flexible public networking resources.",
    capabilities: ["Multiple Apps", "Cloud Services", "Flexible Networking"]
  }
];

const eipFaqs = [
  {
    question: "What is Elastic IP (EIP)?",
    answer: "Elastic IP is a cloud networking service that provides static public IP addresses for cloud resources."
  },
  {
    question: "Which resources can an EIP be associated with?",
    answer: "Elastic IPs can be associated with Elastic Cloud Servers, Load Balancers, and NAT Gateways."
  },
  {
    question: "Can bandwidth be adjusted after allocation?",
    answer: "Yes. Bandwidth can be increased or decreased dynamically based on business requirements."
  },
  {
    question: "Does EIP support shared bandwidth?",
    answer: "Yes. Multiple Elastic IPs can share a common bandwidth pool to improve efficiency and reduce costs."
  },
  {
    question: "Is EIP suitable for production environments?",
    answer: "Yes. Elastic IP is designed for production workloads that require reliable and stable public connectivity."
  }
];

function ElasticIpPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Deliver stable public Internet connectivity for cloud workloads with static IP addresses, elastic bandwidth, and flexible resource binding from HTGClouds Elastic IP.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Elastic IP (EIP) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page network-product-page eip-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Public Cloud Connectivity</span>
          </div>
          <h1>Elastic IP (EIP)</h1>
          <p>
            Deliver secure, stable, and flexible Internet connectivity for cloud
            workloads with dedicated public IP addresses designed for modern cloud
            environments. Elastic IP (EIP) provides static public IP addresses
            that can be independently allocated and dynamically associated with
            cloud resources.
          </p>
          <div className="ecs-trust-chips" aria-label="EIP platform capabilities">
            {["Static Public IP Addresses", "Elastic Bandwidth Scaling", "Flexible Resource Binding", "Shared Bandwidth Support", "Production-Ready Connectivity"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {eipHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <EipHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose EIP?</h2>
          <p>Elastic IP provides a flexible and reliable way to connect cloud workloads to the Internet. By separating public IP addresses from underlying resources, organizations gain greater control over connectivity, resource management, and network costs.</p>
        </div>
        <div className="ecs-benefit-grid">
          {eipBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section eip-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Stable Internet Access for Cloud Resources</h2>
          <p>Elastic IP enables cloud workloads to communicate securely with users, applications, and services across the Internet.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {eipOverviewHighlights.map((highlight) => (
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
          <p>Public connectivity capabilities for static addressing, elastic bandwidth, shared bandwidth pools, flexible binding, and centralized network management.</p>
        </div>
        <div className="as-capability-card-grid eip-capability-card-grid">
          {eipCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Public Internet connectivity for cloud servers, exposed applications, controlled egress, and multi-service networking.</p>
        </div>
        <div className="ecs-workload-grid">
          {eipUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <EipHowItWorks />
      <EipFaq />
      <EipCta />
      <Footer />
    </main>
  );
}

function EipHeroVisual() {
  return (
    <div className="ecs-visual eip-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Elastic IP public connectivity illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <circle cx="260" cy="238" r="70" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M230 238 h60 M260 208 v60" stroke="#23b8be" strokeWidth="8" strokeLinecap="round" />
        <rect x="208" y="312" width="104" height="44" rx="22" fill="#e7f8f8" />
        <text x="260" y="340" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">EIP</text>

        <rect x="102" y="130" width="108" height="64" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="156" y="167" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Internet</text>
        <path d="M210 162 C238 170 232 214 214 224" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="318" y="130" width="108" height="64" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <rect x="344" y="152" width="56" height="24" rx="7" fill="#23b8be" />
        <text x="372" y="214" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Cloud Server</text>
        <path d="M318 162 C290 172 292 214 306 226" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="102" y="338" width="118" height="60" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <path d="M132 368 h58" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="161" y="422" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Bandwidth</text>
        <path d="M220 368 C242 356 250 342 254 356" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="318" y="338" width="118" height="60" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <path d="M348 368 h58 M377 348 v40" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="377" y="422" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">NAT Gateway</text>
        <path d="M318 368 C294 356 276 344 266 354" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
      </svg>
    </div>
  );
}

function EipHowItWorks() {
  return (
    <section className="ecs-section eip-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Allocate a static public IP address, associate it with a supported cloud resource, and adjust bandwidth as connectivity requirements evolve.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization allocates an Elastic IP and associates it with a cloud resource such as an Elastic Cloud Server, Load Balancer, or NAT Gateway.</p>
          <p>The resource immediately gains public Internet connectivity through the assigned static IP address. As networking requirements evolve, bandwidth can be adjusted dynamically and the Elastic IP can be reassigned to other cloud resources when needed.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Stable Public Access</h4>
            <p>Maintain consistent Internet connectivity through dedicated static public IP addresses.</p>
          </article>
          <article>
            <h4>Flexible Resource Management</h4>
            <p>Move public connectivity between supported cloud resources without redesigning infrastructure.</p>
          </article>
          <article>
            <h4>Optimized Network Costs</h4>
            <p>Improve bandwidth utilization through shared bandwidth capabilities and flexible billing models.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function EipFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Elastic IP (EIP).</p>
      </div>
      <div className="pricing-faq-list">
        {eipFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function EipCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Connect Cloud Resources to the Internet with Confidence</h2>
      </div>
      <div>
        <p>Deliver reliable public connectivity, optimize bandwidth utilization, and simplify cloud networking with Elastic IP.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const vpnHeroFeatures = [
  {
    icon: ShieldCheck,
    title: "Secure Encrypted Communication",
    text: "Protect data in transit using industry-standard encryption and authentication technologies."
  },
  {
    icon: Cloud,
    title: "Hybrid Cloud Integration",
    text: "Connect on-premises infrastructure and cloud resources through secure networking tunnels."
  },
  {
    icon: Globe2,
    title: "Cross-Region Connectivity",
    text: "Enable secure communication between distributed cloud environments and regional deployments."
  }
];

const vpnBenefits = [
  {
    icon: ShieldCheck,
    title: "Enterprise-Grade Security",
    text: "Protect communication using strong encryption, authentication, and industry-standard security protocols."
  },
  {
    icon: Cloud,
    title: "Hybrid Cloud Connectivity",
    text: "Extend existing data centers and enterprise networks into the cloud while maintaining secure communication channels."
  },
  {
    icon: Globe2,
    title: "Cross-Region Interconnection",
    text: "Enable secure communication between geographically distributed cloud environments and workloads."
  },
  {
    icon: Zap,
    title: "Fast and Cost-Efficient Deployment",
    text: "Establish secure connectivity quickly using Internet-based encrypted tunnels without the complexity of dedicated network circuits."
  }
];

const vpnOverviewHighlights = [
  "Connect cloud and on-premises environments",
  "Build hybrid cloud architectures",
  "Enable secure cross-region communication",
  "Protect sensitive business traffic",
  "Extend enterprise applications into the cloud",
  "Simplify secure network integration"
];

const vpnCapabilities = [
  {
    icon: ShieldCheck,
    title: "IPsec-Based Secure Connectivity",
    description: "Establish encrypted VPN tunnels using industry-standard IPsec protocols."
  },
  {
    icon: Cloud,
    title: "Hybrid Cloud Networking",
    description: "Connect cloud workloads with on-premises infrastructure through secure communication channels."
  },
  {
    icon: Globe2,
    title: "Cross-Region VPC Connectivity",
    description: "Enable private communication between VPCs located in different geographic regions."
  },
  {
    icon: Shield,
    title: "Advanced Encryption & Authentication",
    description: "Protect data using enterprise-grade encryption and authentication mechanisms."
  },
  {
    icon: Boxes,
    title: "Flexible Network Topologies",
    description: "Support one-to-one and one-to-many connectivity models for diverse deployment requirements."
  },
  {
    icon: Radio,
    title: "Centralized VPN Management",
    description: "Provision, manage, and monitor VPN gateways and connections through a unified cloud platform."
  }
];

const vpnUseCases = [
  {
    icon: Cloud,
    title: "Hybrid Cloud Integration",
    description: "Extend enterprise infrastructure into the cloud while maintaining secure communication with on-premises environments.",
    capabilities: ["Hybrid Cloud", "Data Centers", "Secure Channels"]
  },
  {
    icon: Globe2,
    title: "Cross-Region Application Connectivity",
    description: "Connect applications and services deployed across multiple cloud regions.",
    capabilities: ["Multi-Region", "Private Access", "Distributed Apps"]
  },
  {
    icon: ShieldCheck,
    title: "Secure Branch Connectivity",
    description: "Enable secure communication between branch offices and cloud-hosted applications.",
    capabilities: ["Branch Offices", "Cloud Apps", "Encrypted Tunnels"]
  },
  {
    icon: Boxes,
    title: "Enterprise Application Extension",
    description: "Extend internal business applications into cloud environments without exposing services directly to the public Internet.",
    capabilities: ["Internal Apps", "Private Services", "Enterprise Access"]
  }
];

const vpnFaqs = [
  {
    question: "What type of VPN is supported?",
    answer: "HTGCloud VPN supports secure IPsec-based VPN connectivity."
  },
  {
    question: "Can VPN connect a VPC to an on-premises data center?",
    answer: "Yes. VPN enables secure communication between cloud environments and local infrastructure."
  },
  {
    question: "Can VPN connect two VPCs?",
    answer: "Yes. VPN supports secure communication between VPCs located in different regions."
  },
  {
    question: "Is VPN suitable for enterprise workloads?",
    answer: "Yes. VPN uses enterprise-grade encryption and authentication technologies suitable for production environments."
  },
  {
    question: "How quickly can VPN be deployed?",
    answer: "VPN connections can be provisioned and activated rapidly through the cloud platform."
  }
];

function VirtualPrivateNetworkPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Create secure IPsec VPN connectivity between cloud resources, data centers, branch offices, and distributed environments with HTGClouds Virtual Private Network.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Virtual Private Network (VPN) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page network-product-page vpn-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Secure Hybrid Connectivity</span>
          </div>
          <h1>Virtual Private Network (VPN)</h1>
          <p>
            Extend your network securely across cloud and on-premises environments
            with encrypted connectivity designed for enterprise workloads. Virtual
            Private Network (VPN) provides secure, encrypted communication between
            your Virtual Private Cloud (VPC), on-premises infrastructure, branch
            offices, and cloud environments.
          </p>
          <div className="ecs-trust-chips" aria-label="VPN platform capabilities">
            {["Secure IPsec Encryption", "Hybrid Cloud Connectivity", "Cross-Region Networking", "Enterprise-Grade Security", "Rapid Deployment"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {vpnHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <VpnHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose VPN?</h2>
          <p>Virtual Private Network provides a secure and cost-effective way to connect cloud resources with external environments. Whether supporting hybrid cloud architectures, branch connectivity, or cross-region communication, VPN delivers enterprise-grade security without requiring dedicated network infrastructure.</p>
        </div>
        <div className="ecs-benefit-grid">
          {vpnBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section vpn-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Connect Cloud and Enterprise Networks Securely</h2>
          <p>Virtual Private Network enables organizations to create encrypted communication paths between cloud resources and external networks.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {vpnOverviewHighlights.map((highlight) => (
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
          <p>Secure networking capabilities for IPsec tunnels, hybrid connectivity, cross-region communication, encryption, flexible topologies, and centralized VPN operations.</p>
        </div>
        <div className="as-capability-card-grid vpn-capability-card-grid">
          {vpnCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Secure encrypted connectivity for hybrid cloud, cross-region workloads, branch offices, and enterprise application extension.</p>
        </div>
        <div className="ecs-workload-grid">
          {vpnUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <VpnHowItWorks />
      <VpnFaq />
      <VpnCta />
      <Footer />
    </main>
  );
}

function VpnHeroVisual() {
  return (
    <div className="ecs-visual vpn-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Virtual Private Network encrypted connectivity illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <rect x="116" y="140" width="112" height="90" rx="24" fill="#ffffff" stroke="#d7edf0" />
        <text x="172" y="178" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Data Center</text>
        <rect x="146" y="192" width="52" height="22" rx="6" fill="#23b8be" />
        <rect x="292" y="140" width="112" height="90" rx="24" fill="#ffffff" stroke="#d7edf0" />
        <text x="348" y="178" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">VPC</text>
        <rect x="322" y="192" width="52" height="22" rx="6" fill="#23b8be" opacity="0.8" />
        <path d="M228 186 C258 156 292 156 322 186" stroke="#23b8be" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="10 10" />
        <path d="M228 200 C258 230 292 230 322 200" stroke="#23b8be" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="10 10" />

        <circle cx="260" cy="292" r="46" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M260 254 l32 14 v25 c0 25 -14 42 -32 52 c-18 -10 -32 -27 -32 -52 v-25 z" fill="#23b8be" />
        <path d="M247 292 l9 9 l20 -26" fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <text x="260" y="370" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Encrypted Tunnel</text>

        <rect x="116" y="360" width="112" height="54" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="172" y="392" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Branch Office</text>
        <rect x="292" y="360" width="112" height="54" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="348" y="392" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Region</text>
        <path d="M172 360 C190 330 220 310 226 302 M348 360 C330 330 300 310 294 302" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
      </svg>
    </div>
  );
}

function VpnHowItWorks() {
  return (
    <section className="ecs-section vpn-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Deploy a VPN gateway and establish encrypted tunnels between VPCs, data centers, branch offices, and distributed cloud environments.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization deploys a VPN gateway within its Virtual Private Cloud and establishes an encrypted tunnel to an on-premises data center or another VPC.</p>
          <p>Traffic between environments is encrypted before transmission and securely delivered through the VPN connection, enabling protected communication across public networks.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Secure Data Transmission</h4>
            <p>Protect sensitive information through encrypted communication channels.</p>
          </article>
          <article>
            <h4>Seamless Hybrid Integration</h4>
            <p>Connect cloud and on-premises environments as part of a unified network architecture.</p>
          </article>
          <article>
            <h4>Rapid Deployment</h4>
            <p>Establish enterprise-grade secure connectivity quickly without deploying dedicated infrastructure.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function VpnFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Virtual Private Network (VPN).</p>
      </div>
      <div className="pricing-faq-list">
        {vpnFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function VpnCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Build Secure Hybrid Cloud Connectivity</h2>
      </div>
      <div>
        <p>Connect cloud resources, data centers, and distributed environments with secure, encrypted networking designed for modern enterprises.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const dnsHeroFeatures = [
  {
    icon: Globe2,
    title: "Reliable Domain Resolution",
    text: "Ensure applications and cloud services remain reachable through highly available DNS infrastructure."
  },
  {
    icon: Zap,
    title: "High-Performance Query Processing",
    text: "Deliver low-latency DNS responses for websites, applications, and cloud services worldwide."
  },
  {
    icon: ShieldCheck,
    title: "Secure DNS Architecture",
    text: "Protect critical DNS infrastructure through isolated services and built-in DDoS protection."
  }
];

const dnsBenefits = [
  {
    icon: Cloud,
    title: "Highly Available Resolution",
    text: "Distributed DNS infrastructure ensures stable and continuous domain resolution for business-critical applications."
  },
  {
    icon: Zap,
    title: "High Performance at Scale",
    text: "Handle large volumes of DNS requests with fast query processing and low-latency responses."
  },
  {
    icon: Shield,
    title: "Internal DNS Services",
    text: "Enable secure and efficient name resolution for resources operating inside private cloud environments."
  },
  {
    icon: ShieldCheck,
    title: "Built-In Security Protection",
    text: "Protect DNS services against large-scale attacks through integrated security and DDoS protection mechanisms."
  }
];

const dnsOverviewHighlights = [
  "Host and manage domain names",
  "Configure DNS records",
  "Enable public and private name resolution",
  "Improve application availability",
  "Simplify service discovery",
  "Enhance user access reliability"
];

const dnsCapabilities = [
  {
    icon: Globe2,
    title: "Authoritative DNS Hosting",
    description: "Host and manage domain names through highly available authoritative DNS infrastructure."
  },
  {
    icon: SlidersVertical,
    title: "Advanced Record Management",
    description: "Create and manage DNS records through an intuitive cloud management platform."
  },
  {
    icon: Zap,
    title: "High-Performance Resolution",
    description: "Support large-scale DNS workloads with low-latency query processing."
  },
  {
    icon: Shield,
    title: "Internal DNS Services",
    description: "Provide secure name resolution for cloud resources operating within private networks."
  },
  {
    icon: ShieldCheck,
    title: "Built-In DDoS Protection",
    description: "Protect DNS infrastructure from large-scale attacks and service disruptions."
  },
  {
    icon: Radio,
    title: "Centralized DNS Management",
    description: "Manage domains, records, and DNS configurations from a unified cloud console."
  }
];

const dnsUseCases = [
  {
    icon: Globe2,
    title: "Public Website Hosting",
    description: "Ensure websites and customer-facing applications remain accessible through reliable DNS resolution.",
    capabilities: ["Public Domains", "Websites", "Reliable Access"]
  },
  {
    icon: Shield,
    title: "Internal Service Discovery",
    description: "Enable cloud resources to communicate securely through private DNS resolution within virtual networks.",
    capabilities: ["Private DNS", "Service Discovery", "Internal Networks"]
  },
  {
    icon: Boxes,
    title: "Multi-Environment Operations",
    description: "Manage development, testing, and production environments through centralized DNS management.",
    capabilities: ["Development", "Testing", "Production"]
  },
  {
    icon: ShieldCheck,
    title: "Service Failover & Business Continuity",
    description: "Redirect traffic to backup services during outages and maintain application availability without changing IP addresses.",
    capabilities: ["Failover", "Continuity", "Availability"]
  }
];

const dnsFaqs = [
  {
    question: "What is Domain Name Service (DNS)?",
    answer: "DNS is a cloud service that provides authoritative domain name resolution and DNS management."
  },
  {
    question: "Can DNS be used for internal cloud resources?",
    answer: "Yes. DNS supports private name resolution for cloud resources operating within internal networks."
  },
  {
    question: "Does DNS support high availability?",
    answer: "Yes. DNS uses distributed infrastructure to deliver highly available domain resolution."
  },
  {
    question: "Is DNS protected against attacks?",
    answer: "Yes. DNS includes built-in DDoS protection and security mechanisms to help maintain service stability."
  },
  {
    question: "Is DNS suitable for production environments?",
    answer: "Yes. DNS is designed for enterprise and production workloads requiring reliable and secure domain resolution."
  }
];

function DomainNameServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Deliver fast, secure, and highly available domain name resolution for cloud applications and infrastructure with HTGClouds Domain Name Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Domain Name Service (DNS) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page network-product-page dns-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Cloud DNS Management</span>
          </div>
          <h1>Domain Name Service (DNS)</h1>
          <p>
            Deliver fast, secure, and highly available domain name resolution for
            cloud applications, services, and infrastructure. Domain Name Service
            (DNS) provides authoritative DNS hosting and intelligent domain
            resolution, enabling users and applications to reliably access cloud
            resources through domain names.
          </p>
          <div className="ecs-trust-chips" aria-label="DNS platform capabilities">
            {["Authoritative DNS Hosting", "High Availability Resolution", "Low-Latency Performance", "Internal DNS Support", "Built-In DDoS Protection"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {dnsHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <DnsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose DNS?</h2>
          <p>Domain Name Service provides the foundation for reliable application access by ensuring users and systems can consistently locate cloud resources. Whether managing public websites, internal services, or enterprise environments, DNS delivers performance, security, and operational simplicity.</p>
        </div>
        <div className="ecs-benefit-grid">
          {dnsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section dns-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Enterprise DNS for Cloud Applications</h2>
          <p>Domain Name Service enables organizations to host domains, manage DNS records, and provide reliable access to applications and cloud resources.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {dnsOverviewHighlights.map((highlight) => (
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
          <p>DNS capabilities for authoritative hosting, record management, low-latency resolution, internal DNS, DDoS protection, and centralized operations.</p>
        </div>
        <div className="as-capability-card-grid dns-capability-card-grid">
          {dnsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Reliable name resolution for public websites, internal services, multi-environment operations, and service failover.</p>
        </div>
        <div className="ecs-workload-grid">
          {dnsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <DnsHowItWorks />
      <DnsFaq />
      <DnsCta />
      <Footer />
    </main>
  );
}

function DnsHeroVisual() {
  return (
    <div className="ecs-visual dns-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Domain Name Service resolution illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <circle cx="260" cy="244" r="72" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M220 244 h80 M260 204 v80" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <circle cx="260" cy="244" r="28" fill="#e7f8f8" stroke="#23b8be" strokeWidth="4" />
        <text x="260" y="344" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">DNS</text>

        <rect x="92" y="130" width="126" height="56" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="155" y="164" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">example.com</text>
        <path d="M218 158 C244 166 234 212 218 224" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="308" y="130" width="118" height="56" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="367" y="164" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Records</text>
        <path d="M308 158 C282 166 286 212 302 224" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="104" y="348" width="116" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="162" y="382" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Private DNS</text>
        <path d="M220 377 C240 354 248 326 252 306" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="302" y="348" width="116" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="360" y="382" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Cloud Apps</text>
        <path d="M302 377 C282 354 272 326 268 306" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <path d="M260 214 l18 8 v16 c0 14 -7 24 -18 30 c-11 -6 -18 -16 -18 -30 v-16 z" fill="#23b8be" opacity="0.92" />
      </svg>
    </div>
  );
}

function DnsHowItWorks() {
  return (
    <section className="ecs-section dns-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Host domains, create DNS records, and direct users to the right cloud resources through reliable distributed resolution.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization hosts its domains using HTGCloud DNS and creates DNS records that point users to cloud applications and services.</p>
          <p>When users access a domain name, DNS resolves the request and directs traffic to the appropriate cloud resource. Distributed DNS infrastructure ensures fast, reliable, and highly available resolution even during traffic spikes or infrastructure events.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Reliable Application Access</h4>
            <p>Ensure users can consistently reach websites, applications, and services.</p>
          </article>
          <article>
            <h4>Faster Service Discovery</h4>
            <p>Improve response times through optimized DNS resolution infrastructure.</p>
          </article>
          <article>
            <h4>Operational Simplicity</h4>
            <p>Manage domains and DNS records from a centralized cloud platform.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function DnsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Domain Name Service (DNS).</p>
      </div>
      <div className="pricing-faq-list">
        {dnsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function DnsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Keep Applications Reachable Around the Clock</h2>
      </div>
      <div>
        <p>Deliver reliable domain resolution, improve application accessibility, and simplify DNS management with HTGCloud DNS.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const rdsHeroFeatures = [
  {
    icon: ShieldCheck,
    title: "Production-Ready Reliability",
    text: "Deploy highly available MySQL databases with automatic failover and built-in redundancy."
  },
  {
    icon: Radio,
    title: "Intelligent Operations",
    text: "Reduce administrative effort through automated monitoring, diagnostics, and optimization tools."
  },
  {
    icon: Maximize2,
    title: "Scale with Confidence",
    text: "Expand compute and storage resources as application workloads grow without disrupting operations."
  }
];

const rdsBenefits = [
  {
    icon: ShieldCheck,
    title: "High Availability & Reliability",
    text: "Multi-copy storage and hot standby architecture help ensure business continuity and rapid recovery from failures."
  },
  {
    icon: Zap,
    title: "High Performance at Scale",
    text: "An enhanced MySQL engine is optimized for high concurrency, fast response times, and demanding workloads."
  },
  {
    icon: Radio,
    title: "Automated Operations & Maintenance",
    text: "Built-in management tools provide monitoring, diagnostics, capacity analysis, and optimization recommendations."
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    text: "Protect critical business data through encryption, access controls, and enterprise-grade security capabilities."
  }
];

const rdsOverviewHighlights = [
  "Deploy databases in minutes",
  "Scale resources on demand",
  "Automate backups",
  "Enable automatic failover",
  "Simplify monitoring and maintenance",
  "Improve database reliability"
];

const rdsCapabilities = [
  {
    icon: Database,
    title: "Fully Managed MySQL Compatibility",
    description: "Run existing MySQL applications without code modifications."
  },
  {
    icon: ShieldCheck,
    title: "High Availability Architecture",
    description: "Maintain application continuity through automatic failover and standby database deployment."
  },
  {
    icon: Shield,
    title: "Automated Backup & Recovery",
    description: "Protect data with automated backups and point-in-time recovery capabilities."
  },
  {
    icon: Zap,
    title: "High-Concurrency Performance",
    description: "Support demanding workloads through an optimized MySQL engine and scalable infrastructure."
  },
  {
    icon: Radio,
    title: "Intelligent DBA Assistant",
    description: "Monitor performance, analyze slow queries, and identify optimization opportunities automatically."
  },
  {
    icon: Lock,
    title: "Enterprise Data Protection",
    description: "Protect business data through encryption, secure access controls, and operational safeguards."
  }
];

const rdsUseCases = [
  {
    icon: Boxes,
    title: "E-Commerce Platforms",
    description: "Support transaction-heavy applications with stable performance during traffic peaks.",
    capabilities: ["Transactions", "Traffic Peaks", "Stable Performance"]
  },
  {
    icon: Cloud,
    title: "SaaS Applications",
    description: "Deliver reliable database services for multi-tenant cloud applications.",
    capabilities: ["Multi-Tenant", "Cloud Apps", "Reliable Service"]
  },
  {
    icon: Zap,
    title: "Mobile Applications & Games",
    description: "Provide fast response times and scalable database infrastructure for growing user bases.",
    capabilities: ["Fast Response", "User Growth", "Scalable Database"]
  },
  {
    icon: Globe2,
    title: "IoT Platforms",
    description: "Handle large numbers of concurrent connections and continuously growing data volumes.",
    capabilities: ["Concurrent Connections", "Growing Data", "IoT Workloads"]
  }
];

const rdsFaqs = [
  {
    question: "What is RDS for MySQL?",
    answer: "RDS for MySQL is a fully managed relational database service compatible with native MySQL."
  },
  {
    question: "Is RDS compatible with existing MySQL applications?",
    answer: "Yes. Applications can migrate without requiring code changes."
  },
  {
    question: "Does RDS support automatic failover?",
    answer: "Yes. High availability architecture includes automatic failover capabilities."
  },
  {
    question: "Can data be restored to a specific point in time?",
    answer: "Yes. Point-in-time recovery is supported."
  },
  {
    question: "Is RDS suitable for production workloads?",
    answer: "Yes. RDS is designed for enterprise-grade production environments."
  }
];

function RdsForMysqlPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Deploy fully managed MySQL-compatible databases with high availability, automated backups, intelligent operations, and enterprise security from HTGClouds RDS.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "RDS for MySQL | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page database-product-page rds-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Managed Relational Database</span>
          </div>
          <h1>RDS for MySQL</h1>
          <p>
            Build reliable, scalable, and highly available applications with a
            fully managed MySQL-compatible database service. RDS for MySQL removes
            the complexity of database administration by automating deployment,
            backup, monitoring, maintenance, and scaling.
          </p>
          <div className="ecs-trust-chips" aria-label="RDS for MySQL platform capabilities">
            {["Fully Managed MySQL", "High Availability Architecture", "Automated Backup & Recovery", "Intelligent Database Operations", "Enterprise-Grade Security"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {rdsHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <RdsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose RDS for MySQL?</h2>
          <p>RDS for MySQL eliminates routine database management tasks, allowing teams to focus on building applications instead of maintaining infrastructure.</p>
        </div>
        <div className="ecs-benefit-grid">
          {rdsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section rds-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Managed MySQL Designed for Growth</h2>
          <p>RDS for MySQL provides a fully managed database environment that simplifies deployment, operation, scaling, and protection of MySQL workloads.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {rdsOverviewHighlights.map((highlight) => (
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
          <p>Managed database capabilities for MySQL compatibility, high availability, automated recovery, performance, intelligent operations, and enterprise data protection.</p>
        </div>
        <div className="as-capability-card-grid rds-capability-card-grid">
          {rdsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Managed MySQL for e-commerce platforms, SaaS products, mobile applications, games, and IoT data platforms.</p>
        </div>
        <div className="ecs-workload-grid">
          {rdsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <RdsHowItWorks />
      <RdsFaq />
      <RdsCta />
      <Footer />
    </main>
  );
}

function RdsHeroVisual() {
  return (
    <div className="ecs-visual rds-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="RDS for MySQL managed database illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <ellipse cx="260" cy="194" rx="84" ry="28" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M176 194 v92 c0 16 38 30 84 30 s84 -14 84 -30 v-92" fill="#e7f8f8" stroke="#9fdfe4" strokeWidth="4" />
        <ellipse cx="260" cy="286" rx="84" ry="28" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        <text x="260" y="248" textAnchor="middle" fill="#126f73" fontSize="28" fontWeight="500">MySQL</text>

        <rect x="106" y="124" width="104" height="54" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="158" y="157" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Backup</text>
        <path d="M210 152 C228 160 230 180 218 194" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="310" y="124" width="104" height="54" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="362" y="157" textAnchor="middle" fill="#11161b" fontSize="14" fontWeight="500">Failover</text>
        <path d="M310 152 C292 160 290 180 302 194" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="116" y="354" width="118" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="175" y="388" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Monitoring</text>
        <path d="M234 382 C250 360 254 336 256 314" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <rect x="286" y="354" width="118" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
        <text x="345" y="388" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Security</text>
        <path d="M286 382 C270 360 266 336 264 314" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />

        <path d="M260 326 l24 10 v18 c0 18 -10 30 -24 38 c-14 -8 -24 -20 -24 -38 v-18 z" fill="#23b8be" />
        <path d="M249 354 l8 8 l17 -22" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function RdsHowItWorks() {
  return (
    <section className="ecs-section rds-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Deploy a managed MySQL database instance while HTGCloud automates provisioning, backups, monitoring, failover, and maintenance.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization deploys a managed MySQL database instance through HTGCloud RDS.</p>
          <p>The platform automatically handles provisioning, backups, monitoring, failover, and maintenance while applications connect using standard MySQL protocols.</p>
          <p>As demand grows, compute and storage resources can be scaled with minimal operational effort.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Reduced Administrative Overhead</h4>
            <p>Automate routine database management tasks.</p>
          </article>
          <article>
            <h4>Increased Availability</h4>
            <p>Protect applications through built-in redundancy and failover capabilities.</p>
          </article>
          <article>
            <h4>Faster Growth</h4>
            <p>Scale database resources as business requirements evolve.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function RdsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds RDS for MySQL.</p>
      </div>
      <div className="pricing-faq-list">
        {rdsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function RdsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Run MySQL Without the Operational Complexity</h2>
      </div>
      <div>
        <p>Deploy reliable, scalable, and secure MySQL databases while HTGCloud manages the infrastructure behind the scenes.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const drsHeroFeatures = [
  {
    icon: Zap,
    title: "Migrate Without Business Disruption",
    text: "Move databases to the cloud using online migration technologies that keep applications running."
  },
  {
    icon: Radio,
    title: "Real-Time Synchronization",
    text: "Maintain near real-time data consistency across systems, regions, and environments."
  },
  {
    icon: ShieldCheck,
    title: "Disaster Recovery Readiness",
    text: "Replicate critical databases continuously to support business continuity and rapid recovery."
  }
];

const drsBenefits = [
  {
    icon: Zap,
    title: "Online Migration with Minimal Downtime",
    text: "Reduce migration risk through incremental replication technologies that allow production services to remain available during migration."
  },
  {
    icon: Radio,
    title: "Real-Time Data Synchronization",
    text: "Keep databases synchronized with low-latency replication designed for modern business applications."
  },
  {
    icon: MousePointerClick,
    title: "Continuous Monitoring & Visibility",
    text: "Monitor migration progress, replication latency, logs, and consistency metrics from a unified platform."
  },
  {
    icon: SlidersVertical,
    title: "Lower Operational Complexity",
    text: "Reduce manual DBA effort and infrastructure management through automated migration and replication services."
  }
];

const drsOverviewHighlights = [
  "Migrate databases to the cloud",
  "Synchronize data between systems",
  "Build disaster recovery environments",
  "Monitor replication centrally",
  "Validate consistency automatically",
  "Minimize operational risk"
];

const drsCapabilities = [
  {
    icon: Database,
    title: "Online Database Migration",
    description: "Move databases with minimal service interruption through incremental replication technology."
  },
  {
    icon: Radio,
    title: "Real-Time Data Synchronization",
    description: "Maintain continuous synchronization between production, analytics, and disaster recovery systems."
  },
  {
    icon: ShieldCheck,
    title: "Disaster Recovery Replication",
    description: "Create standby database environments that support rapid recovery and business continuity."
  },
  {
    icon: MousePointerClick,
    title: "Database Recording & Playback",
    description: "Capture production workloads and replay them in target environments for validation and testing."
  },
  {
    icon: SlidersVertical,
    title: "Advanced Monitoring & Validation",
    description: "Track replication latency, migration progress, and consistency through centralized monitoring tools."
  },
  {
    icon: Shield,
    title: "Secure Data Movement",
    description: "Protect sensitive information using auditing, filtering, and controlled replication workflows."
  }
];

const drsUseCases = [
  {
    icon: Cloud,
    title: "Cloud Migration",
    description: "Move databases from on-premises environments or external platforms into HTGCloud with minimal downtime.",
    capabilities: ["Cloud Adoption", "Minimal Downtime", "Online Migration"]
  },
  {
    icon: Radio,
    title: "Real-Time Data Synchronization",
    description: "Maintain consistent data across operational, reporting, and analytics systems.",
    capabilities: ["Low Latency", "Analytics", "Consistent Data"]
  },
  {
    icon: ShieldCheck,
    title: "Disaster Recovery",
    description: "Replicate business-critical databases to standby environments for rapid recovery during outages.",
    capabilities: ["Standby Database", "Rapid Recovery", "Continuity"]
  },
  {
    icon: MousePointerClick,
    title: "Database Testing & Validation",
    description: "Replay production workloads in testing environments to validate upgrades, migrations, and performance.",
    capabilities: ["Replay", "Validation", "Performance Testing"]
  }
];

const drsFaqs = [
  {
    question: "What is Data Replication Service (DRS)?",
    answer: "DRS is a managed service that provides database migration, synchronization, and replication capabilities."
  },
  {
    question: "Can DRS migrate databases without downtime?",
    answer: "Yes. DRS supports online migration using incremental replication technologies to minimize business interruption."
  },
  {
    question: "Does DRS support real-time synchronization?",
    answer: "Yes. DRS supports low-latency real-time synchronization between databases."
  },
  {
    question: "Can DRS be used for disaster recovery?",
    answer: "Yes. DRS supports continuous replication to standby databases for disaster recovery scenarios."
  },
  {
    question: "Does DRS provide monitoring and visibility?",
    answer: "Yes. DRS provides centralized monitoring of migration progress, latency, logs, and consistency."
  }
];

function DataReplicationServicePage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Migrate databases, synchronize data in real time, and build disaster recovery replication with HTGClouds Data Replication Service.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Data Replication Service (DRS) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page database-product-page drs-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Database Migration & Replication</span>
          </div>
          <h1>Data Replication Service (DRS)</h1>
          <p>
            Accelerate cloud adoption, maintain data consistency, and simplify
            disaster recovery with a fully managed database migration and replication
            platform. Data Replication Service (DRS) enables organizations to migrate
            databases, synchronize data in real time, and build resilient disaster
            recovery architectures with minimal business disruption.
          </p>
          <div className="ecs-trust-chips" aria-label="DRS platform capabilities">
            {["Online Database Migration", "Real-Time Data Synchronization", "Disaster Recovery Replication", "Minimal Downtime", "Enterprise Data Consistency"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {drsHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <DrsHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose DRS?</h2>
          <p>Data Replication Service removes the complexity of database migration, synchronization, and disaster recovery by providing a centralized platform for secure and controlled data movement.</p>
        </div>
        <div className="ecs-benefit-grid">
          {drsBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section drs-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Enterprise Data Movement Made Simple</h2>
          <p>Data Replication Service enables organizations to move, synchronize, and protect data across cloud and on-premises environments while maintaining consistency and availability.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {drsOverviewHighlights.map((highlight) => (
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
          <p>Database replication capabilities for online migration, real-time synchronization, disaster recovery, workload replay, monitoring, and secure data movement.</p>
        </div>
        <div className="as-capability-card-grid drs-capability-card-grid">
          {drsCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Managed data movement for cloud migration, real-time synchronization, disaster recovery, and database testing.</p>
        </div>
        <div className="ecs-workload-grid">
          {drsUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <DrsHowItWorks />
      <DrsFaq />
      <DrsCta />
      <Footer />
    </main>
  );
}

function DrsHeroVisual() {
  return (
    <div className="ecs-visual drs-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Data Replication Service database migration and synchronization illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <ellipse cx="166" cy="210" rx="58" ry="22" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M108 210 v72 c0 13 26 24 58 24 s58 -11 58 -24 v-72" fill="#e7f8f8" stroke="#9fdfe4" strokeWidth="4" />
        <text x="166" y="262" textAnchor="middle" fill="#126f73" fontSize="16" fontWeight="500">Source</text>
        <ellipse cx="354" cy="210" rx="58" ry="22" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M296 210 v72 c0 13 26 24 58 24 s58 -11 58 -24 v-72" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        <text x="354" y="262" textAnchor="middle" fill="#126f73" fontSize="16" fontWeight="500">Target</text>

        <path d="M228 232 C258 204 292 204 322 232" stroke="#23b8be" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="10 10" />
        <path d="M322 232 l-14 -2 l8 -12" fill="none" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M292 288 C262 318 228 318 198 288" stroke="#23b8be" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="10 10" />
        <path d="M198 288 l14 2 l-8 12" fill="none" stroke="#23b8be" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx="260" cy="352" r="38" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M244 352 h32 M260 336 v32" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="260" y="416" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Replication</text>

        <rect x="146" y="118" width="228" height="46" rx="23" fill="#e7f8f8" />
        <text x="260" y="147" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Real-Time Sync</text>
      </svg>
    </div>
  );
}

function DrsHowItWorks() {
  return (
    <section className="ecs-section drs-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Connect source and target databases, perform initial transfer, and continuously replicate incremental changes in real time.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization configures DRS to connect a source database and a target database.</p>
          <p>DRS performs an initial data transfer and then continuously replicates incremental changes in real time. During migration, applications remain online while data consistency and replication progress are monitored automatically.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Reduced Downtime</h4>
            <p>Keep applications available during migration and synchronization activities.</p>
          </article>
          <article>
            <h4>Improved Data Consistency</h4>
            <p>Ensure source and target systems remain synchronized through continuous replication.</p>
          </article>
          <article>
            <h4>Lower Migration Risk</h4>
            <p>Monitor and validate replication processes through built-in consistency and auditing tools.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function DrsFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Data Replication Service (DRS).</p>
      </div>
      <div className="pricing-faq-list">
        {drsFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function DrsCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Migrate and Synchronize Data with Confidence</h2>
      </div>
      <div>
        <p>Accelerate cloud adoption, simplify database modernization, and maintain business continuity with intelligent data replication services.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const gaussDbHeroFeatures = [
  {
    icon: Database,
    title: "Built for Enterprise Scale",
    text: "Support mission-critical applications with distributed architecture designed for growth and resilience."
  },
  {
    icon: Zap,
    title: "High-Concurrency Performance",
    text: "Handle demanding transactional workloads with strong consistency and optimized performance."
  },
  {
    icon: ShieldCheck,
    title: "Security by Design",
    text: "Protect sensitive business data through advanced security controls, encryption, and access management."
  }
];

const gaussDbBenefits = [
  {
    icon: Maximize2,
    title: "Distributed Scalability",
    text: "Expand database capacity horizontally as workloads grow while maintaining consistent performance."
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Reliability",
    text: "Deploy across multiple availability zones to improve resilience and support business continuity."
  },
  {
    icon: Zap,
    title: "High-Concurrency Processing",
    text: "Support demanding transactional systems with distributed transaction capabilities and optimized query performance."
  },
  {
    icon: Shield,
    title: "Advanced Security Controls",
    text: "Protect data through encryption, dynamic masking, row-level access control, and confidential computing technologies."
  }
];

const gaussDbOverviewHighlights = [
  "Run mission-critical applications",
  "Scale infrastructure elastically",
  "Support distributed transactions",
  "Store and analyze massive datasets",
  "Improve application availability",
  "Strengthen data security and governance"
];

const gaussDbCapabilities = [
  {
    icon: Database,
    title: "Distributed Relational Architecture",
    description: "Support enterprise applications through a distributed database architecture designed for scale and resilience."
  },
  {
    icon: Radio,
    title: "Distributed Transactions",
    description: "Maintain strong consistency across distributed workloads while supporting complex business operations."
  },
  {
    icon: Maximize2,
    title: "Elastic Horizontal Scaling",
    description: "Expand database capacity seamlessly as applications and data volumes grow."
  },
  {
    icon: ShieldCheck,
    title: "Cross-Availability Zone Deployment",
    description: "Improve resilience and availability through multi-zone deployment capabilities."
  },
  {
    icon: Lock,
    title: "Enterprise Security Framework",
    description: "Protect sensitive information through encryption, dynamic masking, row-level access controls, and confidential computing support."
  },
  {
    icon: Code2,
    title: "Open Ecosystem Integration",
    description: "Integrate with DRS and modern database tooling while maintaining compatibility with mainstream open-source ecosystems."
  }
];

const gaussDbUseCases = [
  {
    icon: ShieldCheck,
    title: "Enterprise Core Systems",
    description: "Support banking, government, telecom, ERP, CRM, and other business-critical platforms.",
    capabilities: ["Core Systems", "Mission Critical", "Business Platforms"]
  },
  {
    icon: Zap,
    title: "High-Concurrency Transaction Processing",
    description: "Run large-scale transactional applications requiring strong consistency and reliable performance.",
    capabilities: ["Transactions", "Strong Consistency", "High Concurrency"]
  },
  {
    icon: Database,
    title: "Large-Scale Data Platforms",
    description: "Store and query massive datasets across rapidly growing business environments.",
    capabilities: ["Massive Data", "Query Scale", "Growth"]
  },
  {
    icon: Cloud,
    title: "Digital Transformation Initiatives",
    description: "Modernize legacy database infrastructure with a distributed cloud-native database platform.",
    capabilities: ["Modernization", "Cloud Native", "Legacy Migration"]
  }
];

const gaussDbFaqs = [
  {
    question: "What is GaussDB?",
    answer: "GaussDB is a distributed relational database designed for enterprise-scale, high-concurrency, and mission-critical workloads."
  },
  {
    question: "Does GaussDB support distributed transactions?",
    answer: "Yes. GaussDB supports distributed transactions while maintaining strong consistency across nodes."
  },
  {
    question: "Can GaussDB scale as data volume grows?",
    answer: "Yes. GaussDB supports elastic horizontal scaling and massive storage growth."
  },
  {
    question: "Is GaussDB suitable for enterprise core systems?",
    answer: "Yes. GaussDB is designed for finance, government, telecom, e-commerce, and other mission-critical environments."
  },
  {
    question: "What security features does GaussDB provide?",
    answer: "GaussDB includes encryption, dynamic data masking, row-level access control, and confidential computing capabilities."
  }
];

function GaussDbPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Run mission-critical applications on HTGClouds GaussDB, a distributed relational database built for enterprise scale, strong consistency, and security.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "GaussDB | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page database-product-page gaussdb-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Enterprise Distributed Database</span>
          </div>
          <h1>GaussDB</h1>
          <p>
            Power high-concurrency workloads, massive data growth, and
            business-critical systems with a distributed relational database
            engineered for enterprise scale. GaussDB is a cloud-native distributed
            relational database designed for organizations that demand performance,
            scalability, security, and reliability at scale.
          </p>
          <div className="ecs-trust-chips" aria-label="GaussDB platform capabilities">
            {["Distributed Database Architecture", "Elastic Horizontal Scaling", "Enterprise-Grade Security", "Cross-Availability Zone Resilience", "Massive Data Capacity"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {gaussDbHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <GaussDbHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose GaussDB?</h2>
          <p>GaussDB combines distributed architecture, strong consistency, and enterprise security to help organizations run large-scale applications without sacrificing performance or reliability.</p>
        </div>
        <div className="ecs-benefit-grid">
          {gaussDbBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section gaussdb-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Distributed Database for Modern Enterprises</h2>
          <p>GaussDB provides a distributed relational database platform capable of supporting high-volume transactions, large-scale data storage, and enterprise application modernization.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {gaussDbOverviewHighlights.map((highlight) => (
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
          <p>Enterprise database capabilities for distributed architecture, strong consistency, elastic scaling, multi-zone resilience, security, and ecosystem integration.</p>
        </div>
        <div className="as-capability-card-grid gaussdb-capability-card-grid">
          {gaussDbCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Distributed relational database services for core systems, high-concurrency transaction processing, large-scale data platforms, and digital transformation.</p>
        </div>
        <div className="ecs-workload-grid">
          {gaussDbUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <GaussDbHowItWorks />
      <GaussDbFaq />
      <GaussDbCta />
      <Footer />
    </main>
  );
}

function GaussDbHeroVisual() {
  return (
    <div className="ecs-visual gaussdb-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="GaussDB distributed enterprise database illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <circle cx="260" cy="250" r="58" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <ellipse cx="260" cy="230" rx="42" ry="14" fill="#e7f8f8" stroke="#23b8be" strokeWidth="4" />
        <path d="M218 230 v38 c0 9 19 16 42 16 s42 -7 42 -16 v-38" fill="#dff8f8" stroke="#23b8be" strokeWidth="4" />
        <text x="260" y="328" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">GaussDB</text>

        {[
          [150, 150, "Node A"],
          [370, 150, "Node B"],
          [150, 354, "Node C"],
          [370, 354, "Node D"]
        ].map(([cx, cy, label]) => (
          <g key={label}>
            <rect x={cx - 50} y={cy - 30} width="100" height="60" rx="18" fill="#ffffff" stroke="#d7edf0" />
            <circle cx={cx} cy={cy - 5} r="12" fill="#23b8be" opacity="0.9" />
            <text x={cx} y={cy + 22} textAnchor="middle" fill="#56616b" fontSize="13" fontWeight="500">{label}</text>
            <path d={`M${cx < 260 ? cx + 50 : cx - 50} ${cy} C ${cx < 260 ? cx + 88 : cx - 88} ${cy} ${cx < 260 ? 214 : 306} 250 ${cx < 260 ? 218 : 302} 250`} stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
          </g>
        ))}

        <path d="M260 188 l26 11 v20 c0 20 -11 34 -26 42 c-15 -8 -26 -22 -26 -42 v-20 z" fill="#11161b" opacity="0.92" />
        <path d="M248 220 l8 8 l18 -24" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function GaussDbHowItWorks() {
  return (
    <section className="ecs-section gaussdb-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Deploy GaussDB as a distributed relational database foundation, then scale capacity as enterprise workloads and data volumes grow.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization deploys GaussDB as the database foundation for a large-scale enterprise application.</p>
          <p>The distributed architecture automatically spreads workloads across multiple nodes while maintaining transaction consistency and data reliability. As business demand grows, additional capacity can be added through elastic scaling without disrupting operations.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Enterprise Scalability</h4>
            <p>Support growing workloads through distributed architecture and elastic expansion.</p>
          </article>
          <article>
            <h4>Strong Consistency</h4>
            <p>Maintain reliable transactional integrity across distributed environments.</p>
          </article>
          <article>
            <h4>Long-Term Growth</h4>
            <p>Handle increasing data volumes and user demand without requiring major architectural changes.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function GaussDbFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds GaussDB.</p>
      </div>
      <div className="pricing-faq-list">
        {gaussDbFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function GaussDbCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Build the Future on an Enterprise-Scale Database</h2>
      </div>
      <div>
        <p>Run mission-critical applications with confidence using a distributed database platform designed for performance, security, and long-term growth.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const smnHeroFeatures = [
  {
    icon: Radio,
    title: "Notify Multiple Recipients Instantly",
    text: "Publish a message once and deliver it to multiple subscribers across different communication channels."
  },
  {
    icon: Globe2,
    title: "Multi-Channel Communication",
    text: "Reach users through email, SMS, and HTTPS endpoints using a single notification service."
  },
  {
    icon: ShieldCheck,
    title: "Built for Reliability",
    text: "Ensure critical notifications are delivered through resilient messaging infrastructure and retry mechanisms."
  }
];

const smnBenefits = [
  {
    icon: Radio,
    title: "Topic-Based Message Distribution",
    text: "Simplify communication by publishing messages once and automatically distributing them to multiple subscribers."
  },
  {
    icon: Globe2,
    title: "Multi-Protocol Delivery",
    text: "Deliver notifications through email, SMS, and HTTPS integrations without maintaining separate communication systems."
  },
  {
    icon: ShieldCheck,
    title: "Reliable Notification Infrastructure",
    text: "Reduce the risk of missed notifications through built-in delivery reliability and retry mechanisms."
  },
  {
    icon: Code2,
    title: "Fast Application Integration",
    text: "Integrate notification capabilities into applications and cloud services through lightweight APIs and management tools."
  }
];

const smnOverviewHighlights = [
  "Create notification topics",
  "Manage subscribers centrally",
  "Deliver alerts and events",
  "Send notifications through multiple channels",
  "Automate operational communications",
  "Integrate messaging into applications"
];

const smnCapabilities = [
  {
    icon: Radio,
    title: "Topic-Based Messaging",
    description: "Organize notifications using topics and distribute messages efficiently to multiple subscribers."
  },
  {
    icon: Globe2,
    title: "Multi-Channel Delivery",
    description: "Deliver notifications through email, SMS, and HTTPS endpoints using a single platform."
  },
  {
    icon: SlidersVertical,
    title: "Message Templates",
    description: "Create reusable notification templates to standardize communication and simplify message management."
  },
  {
    icon: Code2,
    title: "Application & Cloud Integration",
    description: "Integrate notification workflows into cloud services, business applications, and automation systems."
  },
  {
    icon: Shield,
    title: "Access Control & Permissions",
    description: "Manage publishing permissions and topic access through centralized security controls."
  },
  {
    icon: ShieldCheck,
    title: "Reliable Message Delivery",
    description: "Improve notification success rates through resilient delivery infrastructure and retry capabilities."
  }
];

const smnUseCases = [
  {
    icon: Code2,
    title: "Application Notifications",
    description: "Send user alerts, status updates, and system notifications directly from applications.",
    capabilities: ["User Alerts", "Status Updates", "System Notices"]
  },
  {
    icon: Radio,
    title: "Cloud Operations Alerts",
    description: "Notify administrators about infrastructure events, incidents, and operational changes.",
    capabilities: ["Incidents", "Events", "Operations"]
  },
  {
    icon: Boxes,
    title: "Business Process Automation",
    description: "Trigger automated notifications for approvals, transactions, and workflow events.",
    capabilities: ["Approvals", "Transactions", "Workflows"]
  },
  {
    icon: Globe2,
    title: "Third-Party Service Integration",
    description: "Connect external systems and services through HTTPS-based notification delivery.",
    capabilities: ["HTTPS Delivery", "External Systems", "Service Integration"]
  }
];

const smnFaqs = [
  {
    question: "What is Simple Message Notification (SMN)?",
    answer: "SMN is a cloud notification service that delivers messages to multiple subscribers through topic-based messaging."
  },
  {
    question: "Which delivery channels are supported?",
    answer: "SMN supports email, SMS, and HTTPS notification delivery."
  },
  {
    question: "How does message distribution work?",
    answer: "Messages are published to topics and automatically delivered to all confirmed subscribers."
  },
  {
    question: "Can SMN use reusable message templates?",
    answer: "Yes. SMN supports message templates for consistent and repeatable notifications."
  },
  {
    question: "Is SMN suitable for production applications?",
    answer: "Yes. SMN is designed for reliable notification delivery in enterprise and production environments."
  }
];

function SimpleMessageNotificationPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Send reliable multi-channel notifications through topics, email, SMS, and HTTPS endpoints with HTGClouds Simple Message Notification.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Simple Message Notification (SMN) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page application-product-page smn-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Application Messaging</span>
          </div>
          <h1>Simple Message Notification (SMN)</h1>
          <p>
            Keep users informed, automate communication, and respond to events in
            real time with a scalable cloud notification service. Simple Message
            Notification (SMN) enables applications, cloud services, and business
            systems to send notifications to multiple recipients through a unified
            messaging platform.
          </p>
          <div className="ecs-trust-chips" aria-label="SMN platform capabilities">
            {["Multi-Channel Notifications", "Topic-Based Messaging", "Email, SMS & HTTPS Delivery", "Reliable Event Distribution", "Application & Cloud Integration"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {smnHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <SmnHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose SMN?</h2>
          <p>Simple Message Notification provides a centralized notification platform that helps applications and cloud services communicate important events in real time. Whether sending operational alerts, business notifications, or system updates, SMN delivers messages quickly, reliably, and at scale.</p>
        </div>
        <div className="ecs-benefit-grid">
          {smnBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section smn-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Unified Notification Platform for Modern Applications</h2>
          <p>SMN provides a scalable messaging platform that enables applications, cloud services, and enterprise systems to deliver notifications through multiple communication channels.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {smnOverviewHighlights.map((highlight) => (
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
          <p>Notification capabilities for topic-based messaging, multi-channel delivery, templates, integrations, access control, and reliable message delivery.</p>
        </div>
        <div className="as-capability-card-grid smn-capability-card-grid">
          {smnCapabilities.map(({ icon: Icon, title, description }) => (
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
          <p>Reliable notifications for applications, operations, business processes, and third-party service integrations.</p>
        </div>
        <div className="ecs-workload-grid">
          {smnUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <SmnHowItWorks />
      <SmnFaq />
      <SmnCta />
      <Footer />
    </main>
  );
}

function SmnHeroVisual() {
  return (
    <div className="ecs-visual smn-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Simple Message Notification topic and subscriber illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <circle cx="260" cy="246" r="58" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M230 246 h60 M260 216 v60" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="260" y="330" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">Topic</text>

        {[
          [150, 150, "Email"],
          [370, 150, "SMS"],
          [150, 360, "HTTPS"],
          [370, 360, "Apps"]
        ].map(([cx, cy, label]) => (
          <g key={label}>
            <rect x={cx - 50} y={cy - 30} width="100" height="60" rx="18" fill="#ffffff" stroke="#d7edf0" />
            <circle cx={cx} cy={cy - 6} r="12" fill="#23b8be" opacity="0.9" />
            <text x={cx} y={cy + 22} textAnchor="middle" fill="#56616b" fontSize="13" fontWeight="500">{label}</text>
            <path d={`M${cx < 260 ? cx + 50 : cx - 50} ${cy} C ${cx < 260 ? cx + 86 : cx - 86} ${cy} ${cx < 260 ? 204 : 316} 246 ${cx < 260 ? 202 : 318} 246`} stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
          </g>
        ))}

        <rect x="174" y="106" width="172" height="44" rx="22" fill="#e7f8f8" />
        <text x="260" y="134" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Publish Once</text>
      </svg>
    </div>
  );
}

function SmnHowItWorks() {
  return (
    <section className="ecs-section smn-how-section">
      <div className="ecs-section-heading centered">
        <h2>How It Works</h2>
        <p>Publish messages to an SMN topic and automatically distribute them to subscribed recipients across supported delivery channels.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An application publishes a notification to an SMN topic whenever an important event occurs.</p>
          <p>SMN automatically distributes the message to all subscribed recipients through email, SMS, or HTTPS endpoints. Administrators can manage subscriptions, monitor delivery, and update notification workflows through a centralized platform.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Faster Communication</h4>
            <p>Deliver important information instantly across multiple communication channels.</p>
          </article>
          <article>
            <h4>Operational Visibility</h4>
            <p>Keep teams informed about system events, incidents, and business activities in real time.</p>
          </article>
          <article>
            <h4>Simplified Notification Management</h4>
            <p>Manage messaging, subscribers, and delivery channels from a single service.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function SmnFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Simple Message Notification (SMN).</p>
      </div>
      <div className="pricing-faq-list">
        {smnFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function SmnCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Deliver Notifications with Confidence</h2>
      </div>
      <div>
        <p>Connect applications, users, and cloud services through a reliable messaging platform designed for modern digital operations.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const romaHeroFeatures = [
  {
    icon: Boxes,
    title: "Connect Everything",
    text: "Integrate applications, databases, cloud services, and devices through a unified platform."
  },
  {
    icon: Radio,
    title: "Real-Time Data Exchange",
    text: "Synchronize information across systems with reliable and scalable integration services."
  },
  {
    icon: Zap,
    title: "Accelerate Innovation",
    text: "Reduce custom development effort and launch connected digital services faster."
  }
];

const romaBenefits = [
  {
    icon: Boxes,
    title: "Unified Integration Platform",
    text: "Manage APIs, applications, messages, devices, and data integrations from a single platform."
  },
  {
    icon: Radio,
    title: "Real-Time Connectivity",
    text: "Enable reliable communication between cloud services, enterprise systems, and business applications."
  },
  {
    icon: Zap,
    title: "Accelerated Digital Transformation",
    text: "Reduce integration complexity and launch connected services faster."
  },
  {
    icon: ShieldCheck,
    title: "Enterprise Reliability",
    text: "Support mission-critical integration workloads with secure and scalable infrastructure."
  }
];

const romaOverviewHighlights = [
  "Integrate enterprise applications",
  "Connect cloud and on-premises systems",
  "Synchronize data across platforms",
  "Publish and manage APIs",
  "Process business events",
  "Connect IoT devices and gateways",
  "Automate integration workflows"
];

const romaCapabilities = [
  {
    icon: Database,
    title: "Data Integration",
    description: "Connect databases, applications, and business systems to synchronize and transform information across environments."
  },
  {
    icon: Code2,
    title: "API Integration & Management",
    description: "Expose, secure, publish, and monitor APIs through a centralized management platform."
  },
  {
    icon: Cloud,
    title: "Service Integration",
    description: "Connect distributed applications and business services through reusable integration flows."
  },
  {
    icon: Radio,
    title: "Message Integration",
    description: "Support event-driven architectures using messaging and asynchronous communication services."
  },
  {
    icon: Globe2,
    title: "Device Integration",
    description: "Connect IoT devices, gateways, sensors, and industrial systems through standardized connectivity frameworks."
  },
  {
    icon: Boxes,
    title: "Composite Applications",
    description: "Build integrated business applications that orchestrate multiple systems and services through a unified workflow layer."
  }
];

const romaUseCases = [
  {
    icon: Boxes,
    title: "Enterprise System Integration",
    description: "Connect ERP, CRM, HR, finance, and operational systems to improve business efficiency.",
    capabilities: ["ERP", "CRM", "Operations"]
  },
  {
    icon: Radio,
    title: "Payment Platform Integration",
    description: "Integrate payment services, merchant platforms, reconciliation systems, and business applications.",
    capabilities: ["Payments", "Merchants", "Reconciliation"]
  },
  {
    icon: Code2,
    title: "API Economy Platforms",
    description: "Publish and manage APIs for partners, customers, and internal development teams.",
    capabilities: ["Partners", "Customers", "API Management"]
  },
  {
    icon: Globe2,
    title: "IoT and Smart Operations",
    description: "Connect devices, sensors, and operational systems for monitoring and automation.",
    capabilities: ["Devices", "Sensors", "Automation"]
  }
];

const romaFaqs = [
  {
    question: "What is ROMA Connect?",
    answer: "ROMA Connect is a cloud integration platform that connects applications, APIs, data sources, services, and devices."
  },
  {
    question: "What integration types are supported?",
    answer: "ROMA Connect supports data integration, API integration, service integration, message integration, and device integration."
  },
  {
    question: "Can ROMA Connect connect cloud and on-premises systems?",
    answer: "Yes. ROMA Connect supports hybrid integration scenarios across cloud and on-premises environments."
  },
  {
    question: "Is ROMA Connect suitable for enterprise workloads?",
    answer: "Yes. ROMA Connect is designed for enterprise integration and digital transformation initiatives."
  },
  {
    question: "Can ROMA Connect reduce custom integration development?",
    answer: "Yes. ROMA Connect provides reusable integration services, centralized governance, and workflow automation capabilities."
  }
];

function RomaConnectPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Connect applications, APIs, data, cloud services, and devices through a unified integration platform with HTGCloud ROMA Connect.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "ROMA Connect | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page application-product-page roma-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Enterprise Integration Platform</span>
          </div>
          <h1>ROMA Connect</h1>
          <p>
            ROMA Connect is a full-stack integration platform that enables
            organizations to connect applications, APIs, databases, cloud services,
            and devices through a centralized integration layer. Build integrated
            digital ecosystems, automate workflows, and accelerate enterprise
            connectivity with secure and scalable integration services.
          </p>
          <div className="ecs-trust-chips" aria-label="ROMA Connect platform capabilities">
            {["Data Integration", "API Integration", "Service Integration", "Message Integration", "Device Connectivity"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {romaHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <RomaHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose ROMA Connect?</h2>
          <p>A unified integration platform designed to connect business systems, applications, APIs, data sources, and devices across modern enterprise environments.</p>
        </div>
        <div className="ecs-benefit-grid">
          {romaBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section roma-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Enterprise Integration Without Complexity</h2>
          <p>ROMA Connect helps organizations connect business systems, cloud applications, databases, devices, and services through reusable integration assets and centralized management.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {romaOverviewHighlights.map((highlight) => (
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
          <p>Enterprise integration capabilities for data, APIs, services, messages, devices, and composite business applications.</p>
        </div>
        <div className="as-capability-card-grid roma-capability-card-grid">
          {romaCapabilities.map(({ icon: Icon, title, description }) => (
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
          <h2>Common Use Cases</h2>
          <p>Integration services for enterprise systems, payment platforms, API economy platforms, and smart operations.</p>
        </div>
        <div className="ecs-workload-grid">
          {romaUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <RomaHowItWorks />
      <RomaFaq />
      <RomaCta />
      <Footer />
    </main>
  );
}

function RomaHeroVisual() {
  return (
    <div className="ecs-visual roma-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="ROMA Connect integration hub illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <circle cx="260" cy="250" r="62" fill="#ffffff" stroke="#9fdfe4" strokeWidth="4" />
        <path d="M232 250 h56 M260 222 v56" stroke="#23b8be" strokeWidth="7" strokeLinecap="round" />
        <text x="260" y="334" textAnchor="middle" fill="#126f73" fontSize="20" fontWeight="500">Integration Hub</text>

        {[
          [148, 144, "Apps"],
          [372, 144, "APIs"],
          [148, 362, "Data"],
          [372, 362, "Devices"]
        ].map(([cx, cy, label]) => (
          <g key={label}>
            <rect x={cx - 54} y={cy - 30} width="108" height="60" rx="18" fill="#ffffff" stroke="#d7edf0" />
            <circle cx={cx} cy={cy - 7} r="12" fill="#23b8be" opacity="0.9" />
            <text x={cx} y={cy + 22} textAnchor="middle" fill="#56616b" fontSize="13" fontWeight="500">{label}</text>
            <path d={`M${cx < 260 ? cx + 54 : cx - 54} ${cy} C ${cx < 260 ? cx + 90 : cx - 90} ${cy} ${cx < 260 ? 200 : 320} 250 ${cx < 260 ? 198 : 322} 250`} stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
          </g>
        ))}

        <rect x="178" y="104" width="164" height="44" rx="22" fill="#e7f8f8" />
        <text x="260" y="132" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Workflows</text>
        <path d="M260 148 C260 180 260 190 260 216" stroke="#23b8be" strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray="8 8" />
      </svg>
    </div>
  );
}

function RomaHowItWorks() {
  return (
    <section className="ecs-section roma-how-section">
      <div className="ecs-section-heading centered">
        <h2>How ROMA Connect Works</h2>
        <p>ROMA Connect acts as the integration layer between applications, APIs, data sources, cloud services, and devices.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>Organizations can manage integrations through a centralized platform while automating workflows and enabling secure communication across systems.</p>
          <p>Reusable integration assets reduce development effort and help teams connect enterprise applications, APIs, data sources, cloud services, and devices at scale.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Benefits</h3>
          <article>
            <h4>Faster Integration Delivery</h4>
            <p>Reduce development effort through reusable integration services and centralized management.</p>
          </article>
          <article>
            <h4>Centralized Governance</h4>
            <p>Manage APIs, integrations, assets, connectivity policies, and workflows from a single platform.</p>
          </article>
          <article>
            <h4>Scalable Enterprise Connectivity</h4>
            <p>Automate workflows and connect business systems across modern enterprise environments.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function RomaFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds ROMA Connect.</p>
      </div>
      <div className="pricing-faq-list">
        {romaFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function RomaCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Build Connected Digital Experiences</h2>
      </div>
      <div>
        <p>Connect systems, applications, APIs, data, and devices through a unified integration platform designed for modern enterprises.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const wafHeroFeatures = [
  {
    icon: ShieldCheck,
    title: "Stop Attacks Before They Reach Your Applications",
    text: "Inspect and block malicious HTTP and HTTPS traffic before it impacts your business services."
  },
  {
    icon: SlidersVertical,
    title: "Adaptive Security Policies",
    text: "Protect different applications using customizable rules, IP controls, and traffic management policies."
  },
  {
    icon: Lock,
    title: "Built for Always-On Protection",
    text: "Deliver continuous application security without changing application code or infrastructure."
  }
];

const wafBenefits = [
  {
    icon: ShieldCheck,
    title: "Intelligent Threat Detection",
    text: "Identify and block common web attacks including SQL injection, cross-site scripting (XSS), malicious requests, and automated threats before they reach application servers."
  },
  {
    icon: Radio,
    title: "Real-Time Traffic Inspection",
    text: "Continuously analyze HTTP and HTTPS traffic to detect abnormal behavior and enforce security policies instantly."
  },
  {
    icon: SlidersVertical,
    title: "Flexible Protection Policies",
    text: "Customize protection rules, access controls, rate limits, and security policies to meet the needs of different applications and business environments."
  },
  {
    icon: Cloud,
    title: "Seamless Cloud Security",
    text: "Deploy transparent protection that integrates with existing cloud infrastructure without requiring application modifications."
  }
];

const wafOverviewHighlights = [
  "Protect websites and web applications",
  "Secure HTTP and HTTPS APIs",
  "Block common web attacks",
  "Monitor application traffic",
  "Reduce service disruptions",
  "Improve application availability"
];

const wafCapabilities = [
  {
    icon: Shield,
    title: "Application-Layer Protection",
    description: "Protect web applications against SQL injection, cross-site scripting (XSS), malicious requests, and other common application-layer attacks."
  },
  {
    icon: Radio,
    title: "Intelligent Traffic Inspection",
    description: "Inspect HTTP and HTTPS requests in real time to identify threats before they reach backend systems."
  },
  {
    icon: SlidersVertical,
    title: "Custom Security Policies",
    description: "Create flexible protection rules, IP allowlists, blocklists, and rate-limiting policies tailored to application requirements."
  },
  {
    icon: Code2,
    title: "API Protection",
    description: "Secure RESTful APIs and web services against unauthorized access, abuse, and malicious traffic."
  },
  {
    icon: MousePointerClick,
    title: "Security Monitoring & Attack Visibility",
    description: "Monitor traffic patterns, review attack logs, and gain visibility into security events through centralized reporting."
  },
  {
    icon: Cloud,
    title: "Cloud-Native Deployment",
    description: "Protect applications using a transparent cloud-based security architecture without modifying application code."
  }
];

const wafUseCases = [
  {
    icon: Globe2,
    title: "Public Website Protection",
    description: "Defend corporate websites, customer portals, and online services against common web attacks and malicious traffic.",
    capabilities: ["Websites", "Customer Portals", "Malicious Traffic"]
  },
  {
    icon: Code2,
    title: "API Security",
    description: "Protect business APIs from injection attacks, abuse, and unauthorized requests while maintaining application performance.",
    capabilities: ["HTTP APIs", "Access Control", "Abuse Prevention"]
  },
  {
    icon: Boxes,
    title: "Enterprise Business Applications",
    description: "Secure internal and customer-facing applications that support critical business operations.",
    capabilities: ["Internal Apps", "Business Systems", "Policy Control"]
  },
  {
    icon: Lock,
    title: "E-Commerce Platforms",
    description: "Protect online stores, payment portals, and digital services while maintaining secure and uninterrupted customer experiences.",
    capabilities: ["Online Stores", "Payment Portals", "Availability"]
  }
];

const wafFaqs = [
  {
    question: "What is Web Application Firewall (WAF)?",
    answer: "Web Application Firewall is a cloud security service that protects web applications by inspecting and filtering HTTP and HTTPS traffic."
  },
  {
    question: "What attacks does WAF protect against?",
    answer: "WAF protects against common application-layer attacks including SQL injection, cross-site scripting (XSS), malicious requests, and other web threats."
  },
  {
    question: "Does WAF require application changes?",
    answer: "No. WAF provides transparent protection without requiring modifications to application code."
  },
  {
    question: "Can WAF protect APIs?",
    answer: "Yes. WAF secures HTTP and HTTPS APIs using intelligent traffic inspection and customizable security policies."
  },
  {
    question: "Is WAF suitable for production environments?",
    answer: "Yes. WAF is designed to protect enterprise and production web applications with scalable cloud-native security."
  }
];

function WebApplicationFirewallPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Protect websites, APIs, and business applications from modern cyber threats with HTGClouds Web Application Firewall.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Web Application Firewall (WAF) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page security-product-page waf-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Security and Compliance</span>
          </div>
          <h1>Web Application Firewall (WAF)</h1>
          <p>
            Web Application Firewall (WAF) is an enterprise-grade security service
            that protects web applications by inspecting, filtering, and blocking
            malicious HTTP and HTTPS traffic before it reaches your infrastructure.
            Designed for modern digital businesses, WAF helps organizations reduce
            security risks, maintain application availability, and safeguard customer
            experiences without requiring application code changes.
          </p>
          <div className="ecs-trust-chips" aria-label="WAF platform capabilities">
            {["Intelligent Web Threat Protection", "Real-Time Traffic Inspection", "Advanced Attack Prevention", "Flexible Security Policies", "Cloud-Native Deployment"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {wafHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <WafHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose WAF?</h2>
          <p>Web Application Firewall delivers intelligent application-layer protection that helps organizations defend against modern cyber threats while maintaining a fast, reliable user experience.</p>
        </div>
        <div className="ecs-benefit-grid">
          {wafBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section smn-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Enterprise Web Security for Modern Applications</h2>
          <p>WAF provides centralized protection for websites, APIs, and web applications by inspecting incoming traffic, blocking malicious requests, and helping organizations maintain secure and highly available online services.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {wafOverviewHighlights.map((highlight) => (
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
          <p>Cloud-native web protection for application-layer attacks, API abuse, security policies, traffic inspection, monitoring, and transparent deployment.</p>
        </div>
        <div className="as-capability-card-grid smn-capability-card-grid">
          {wafCapabilities.map(({ icon: Icon, title, description }) => (
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
          <h2>Common Use Cases</h2>
          <p>Protect public websites, APIs, enterprise applications, and e-commerce platforms with centralized application-layer security.</p>
        </div>
        <div className="ecs-workload-grid">
          {wafUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <WafHowItWorks />
      <WafFaq />
      <WafCta />
      <Footer />
    </main>
  );
}

function WafHeroVisual() {
  return (
    <div className="ecs-visual waf-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Web Application Firewall protection illustration">
        <rect x="62" y="74" width="396" height="372" rx="38" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <rect x="118" y="134" width="284" height="244" rx="26" fill="#ffffff" stroke="#c8ebee" strokeWidth="3" />
        <rect x="118" y="134" width="284" height="58" rx="26" fill="#e8f8f9" />
        <circle cx="152" cy="164" r="7" fill="#23b8be" />
        <circle cx="176" cy="164" r="7" fill="#9fdfe4" />
        <circle cx="200" cy="164" r="7" fill="#c8ebee" />
        <text x="260" y="169" textAnchor="middle" fill="#126f73" fontSize="18" fontWeight="500">Protected App</text>

        <path d="M260 226 C296 238 326 236 350 226 V270 C350 318 318 344 260 362 C202 344 170 318 170 270 V226 C194 236 224 238 260 226Z" fill="#ffffff" stroke="#23b8be" strokeWidth="5" />
        <path d="M230 274 l22 22 l46 -56" fill="none" stroke="#23b8be" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />

        <g opacity="0.95">
          <rect x="60" y="216" width="92" height="50" rx="16" fill="#fff7f5" stroke="#ffd3c7" />
          <text x="106" y="247" textAnchor="middle" fill="#ff5630" fontSize="13" fontWeight="500">Blocked</text>
          <path d="M152 242 H188" stroke="#ff725f" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 8" />
          <path d="M184 234 l10 8 l-10 8" fill="none" stroke="#ff725f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g>
          <rect x="368" y="216" width="92" height="50" rx="16" fill="#eefafa" stroke="#bdecef" />
          <text x="414" y="247" textAnchor="middle" fill="#126f73" fontSize="13" fontWeight="500">Allowed</text>
          <path d="M332 242 H368" stroke="#23b8be" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 8" />
          <path d="M364 234 l10 8 l-10 8" fill="none" stroke="#23b8be" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <rect x="154" y="406" width="212" height="44" rx="22" fill="#e7f8f8" />
        <text x="260" y="434" textAnchor="middle" fill="#126f73" fontSize="17" fontWeight="500">Policy Enforcement</text>
      </svg>
    </div>
  );
}

function WafHowItWorks() {
  return (
    <section className="ecs-section smn-how-section">
      <div className="ecs-section-heading centered">
        <h2>How WAF Works</h2>
        <p>All incoming HTTP and HTTPS traffic passes through Web Application Firewall before reaching application servers.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization publishes a website and several APIs through HTGCloud.</p>
          <p>All incoming HTTP and HTTPS traffic is routed through WAF, where requests are inspected in real time. Malicious traffic is automatically identified and blocked based on predefined and custom security policies before reaching application servers.</p>
          <p>Administrators monitor attacks, adjust protection rules, and maintain application security through a centralized management platform.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Proactive Threat Prevention</h4>
            <p>Stop attacks before they impact applications and business operations.</p>
          </article>
          <article>
            <h4>Continuous Visibility</h4>
            <p>Monitor web traffic, attack activity, and security events from a centralized dashboard.</p>
          </article>
          <article>
            <h4>Simplified Security Operations</h4>
            <p>Protect multiple applications using centralized policy management without changing application code.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function WafFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Web Application Firewall (WAF).</p>
      </div>
      <div className="pricing-faq-list">
        {wafFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function WafCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Secure Your Applications with Enterprise-Grade Protection</h2>
      </div>
      <div>
        <p>Protect websites, APIs, and business applications with intelligent web security designed to stop modern cyber threats before they reach your infrastructure.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
          </a>
        </div>
      </div>
    </section>
  );
}

const cbhHeroFeatures = [
  {
    icon: ShieldCheck,
    title: "Centralize Administrator Access",
    text: "Provide secure access to cloud infrastructure through a single controlled gateway instead of exposing production servers directly."
  },
  {
    icon: MousePointerClick,
    title: "Complete Operational Visibility",
    text: "Monitor, record, and audit every administrative session to improve security and simplify compliance."
  },
  {
    icon: Lock,
    title: "Protect Critical Infrastructure",
    text: "Reduce security risks through centralized authentication, controlled permissions, and secure credential management."
  }
];

const cbhBenefits = [
  {
    icon: ShieldCheck,
    title: "Centralized Access Management",
    text: "Control administrator access through a single secure entry point while minimizing direct exposure of production resources."
  },
  {
    icon: SlidersVertical,
    title: "Fine-Grained Permission Management",
    text: "Assign users, roles, and permissions to ensure administrators can only access authorized systems and perform approved operations."
  },
  {
    icon: Radio,
    title: "Complete Audit & Session Recording",
    text: "Record login activity, administrative commands, and user sessions to support forensic analysis, operational reviews, and compliance reporting."
  },
  {
    icon: Server,
    title: "Secure Operations at Scale",
    text: "Enable secure remote administration across multiple cloud servers while protecting credentials and maintaining operational governance."
  }
];

const cbhOverviewHighlights = [
  "Centralize administrator access",
  "Control privileged operations",
  "Secure production servers",
  "Record administrative sessions",
  "Audit login activity",
  "Protect administrator credentials",
  "Improve compliance readiness"
];

const cbhCapabilities = [
  {
    icon: Shield,
    title: "Centralized Access Gateway",
    description: "Route all administrator connections through a secure gateway that protects production infrastructure from direct exposure."
  },
  {
    icon: SlidersVertical,
    title: "Role-Based Access Control",
    description: "Grant precise permissions based on organizational roles while limiting unnecessary administrative privileges."
  },
  {
    icon: Radio,
    title: "Session Monitoring & Recording",
    description: "Monitor active administrator sessions and maintain detailed recordings for security investigations and compliance audits."
  },
  {
    icon: Code2,
    title: "Operation Command Auditing",
    description: "Capture administrative commands and operational activities to provide complete visibility into infrastructure changes."
  },
  {
    icon: Lock,
    title: "Secure Credential Management",
    description: "Protect sensitive credentials through centralized authentication and controlled access workflows."
  },
  {
    icon: Boxes,
    title: "Unified Security Management",
    description: "Manage users, permissions, audit records, and operational policies from a centralized management console."
  }
];

const cbhUseCases = [
  {
    icon: Server,
    title: "Production Server Administration",
    description: "Provide secure administrator access to mission-critical production environments without exposing backend infrastructure.",
    capabilities: ["Production Access", "Secure Gateway", "Server Operations"]
  },
  {
    icon: ShieldCheck,
    title: "Regulatory Compliance",
    description: "Maintain comprehensive audit logs and session records to support regulatory requirements and internal governance policies.",
    capabilities: ["Audit Trails", "Session Records", "Governance"]
  },
  {
    icon: Boxes,
    title: "Enterprise IT Operations",
    description: "Manage administrator access across multiple cloud servers through centralized authentication and authorization.",
    capabilities: ["Centralized Access", "Role Control", "Cloud Servers"]
  },
  {
    icon: Globe2,
    title: "Managed Service Operations",
    description: "Secure operational access for IT teams supporting multiple customers, departments, or business units.",
    capabilities: ["Multiple Teams", "Customer Operations", "Access Governance"]
  }
];

const cbhFaqs = [
  {
    question: "What is Cloud Bastion Host (CBH)?",
    answer: "Cloud Bastion Host is a privileged access management service that provides centralized administrator access, operation control, and auditing for cloud infrastructure."
  },
  {
    question: "How does CBH improve security?",
    answer: "CBH reduces direct server exposure by routing administrator access through a secure gateway with centralized authentication and authorization."
  },
  {
    question: "Can CBH record administrator activities?",
    answer: "Yes. CBH records login events, administrator commands, and complete operation sessions for auditing and compliance."
  },
  {
    question: "Is CBH suitable for compliance-driven organizations?",
    answer: "Yes. CBH provides detailed audit trails, session recording, and centralized access governance to help organizations meet regulatory and internal compliance requirements."
  },
  {
    question: "Can CBH manage access across multiple servers?",
    answer: "Yes. CBH centrally manages privileged access to multiple cloud servers from a unified management platform."
  }
];

function CloudBastionHostPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const description = "Secure privileged access to critical cloud infrastructure with HTGClouds Cloud Bastion Host.";
    let metaDescription = document.querySelector('meta[name="description"]');
    const previousDescription = metaDescription?.getAttribute("content");
    const createdDescription = !metaDescription;

    if (!metaDescription) {
      metaDescription = document.createElement("meta");
      metaDescription.setAttribute("name", "description");
      document.head.appendChild(metaDescription);
    }

    document.title = "Cloud Bastion Host (CBH) | HTGClouds";
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
    <main className="product-page ecs-page storage-product-page security-product-page cbh-page">
      <Navigation />
      <section className="ecs-hero">
        <div className="ecs-hero-copy">
          <div className="ecs-kicker">
            <span>Security and Compliance</span>
          </div>
          <h1>Cloud Bastion Host (CBH)</h1>
          <p>
            Cloud Bastion Host (CBH) is an enterprise privileged access management
            service that provides secure, centralized access to cloud servers while
            eliminating direct exposure of critical infrastructure. Through unified
            authentication, fine-grained authorization, session monitoring, and
            complete operation auditing, CBH helps organizations strengthen security,
            simplify operational governance, and meet regulatory compliance
            requirements.
          </p>
          <div className="ecs-trust-chips" aria-label="CBH platform capabilities">
            {["Centralized Privileged Access", "Fine-Grained Permission Control", "Session Recording & Auditing", "Secure Remote Operations", "Enterprise Compliance"].map((chip) => (
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
          <div className="vpc-hero-feature-grid">
            {cbhHeroFeatures.map(({ icon: Icon, title, text }) => (
              <article key={title}>
                <span>
                  <Icon size={16} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
        <CbhHeroVisual />
      </section>

      <section className="ecs-section ecs-benefits-section">
        <div className="ecs-section-heading centered storage-benefits-heading">
          <h2>Why Choose CBH?</h2>
          <p>Cloud Bastion Host helps organizations secure privileged access, reduce operational risk, and maintain complete visibility across cloud infrastructure without increasing administrative complexity.</p>
        </div>
        <div className="ecs-benefit-grid">
          {cbhBenefits.map(({ icon: Icon, title, text }) => (
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

      <section className="ecs-section smn-overview-section">
        <div className="ecs-section-heading centered">
          <h2>Enterprise Privileged Access Management for Cloud Operations</h2>
          <p>Cloud Bastion Host provides organizations with a centralized platform for managing administrator access, controlling operational permissions, monitoring privileged sessions, and maintaining complete audit trails.</p>
        </div>
        <div className="ecs-workload-capabilities storage-overview-highlights">
          {cbhOverviewHighlights.map((highlight) => (
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
          <p>Privileged access management capabilities for secure gateways, role-based access, session recording, operation auditing, credential protection, and centralized security management.</p>
        </div>
        <div className="as-capability-card-grid smn-capability-card-grid">
          {cbhCapabilities.map(({ icon: Icon, title, description }) => (
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
          <h2>Common Use Cases</h2>
          <p>Secure privileged access for production server administration, compliance programs, enterprise IT operations, and managed service teams.</p>
        </div>
        <div className="ecs-workload-grid">
          {cbhUseCases.map(({ icon: Icon, title, description, capabilities }) => (
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

      <CbhHowItWorks />
      <CbhFaq />
      <CbhCta />
      <Footer />
    </main>
  );
}

function CbhHeroVisual() {
  return (
    <div className="ecs-visual cbh-hero-visual" aria-hidden="true">
      <svg viewBox="0 0 520 520" role="img" aria-label="Cloud Bastion Host secure access illustration">
        <rect x="64" y="72" width="392" height="376" rx="36" fill="#f4fbfb" stroke="#d4eef1" strokeWidth="3" />
        <rect x="164" y="136" width="192" height="232" rx="28" fill="#ffffff" stroke="#c8ebee" strokeWidth="3" />
        <rect x="188" y="164" width="144" height="56" rx="18" fill="#e7f8f8" />
        <text x="260" y="199" textAnchor="middle" fill="#126f73" fontSize="17" fontWeight="500">Access Gateway</text>

        <path d="M260 250 c34 0 62 26 62 58 v32 h-124 v-32 c0-32 28-58 62-58Z" fill="#ffffff" stroke="#23b8be" strokeWidth="5" />
        <rect x="214" y="296" width="92" height="78" rx="18" fill="#23b8be" />
        <circle cx="260" cy="326" r="12" fill="#ffffff" />
        <path d="M260 336 v18" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" />

        <g>
          <rect x="72" y="186" width="98" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
          <text x="121" y="220" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Admins</text>
          <path d="M170 216 H210" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 8" />
          <path d="M206 208 l10 8 l-10 8" fill="none" stroke="#23b8be" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g>
          <rect x="350" y="178" width="98" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
          <text x="399" y="212" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Servers</text>
          <path d="M314 216 H350" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 8" />
          <path d="M346 208 l10 8 l-10 8" fill="none" stroke="#23b8be" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        <g>
          <rect x="72" y="326" width="98" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
          <text x="121" y="360" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Audit</text>
          <path d="M170 354 H214" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 8" />
        </g>

        <g>
          <rect x="350" y="326" width="98" height="58" rx="18" fill="#ffffff" stroke="#d7edf0" />
          <text x="399" y="360" textAnchor="middle" fill="#56616b" fontSize="14" fontWeight="500">Policies</text>
          <path d="M306 354 H350" stroke="#23b8be" strokeWidth="4" strokeLinecap="round" strokeDasharray="7 8" />
        </g>

        <rect x="164" y="400" width="192" height="44" rx="22" fill="#e7f8f8" />
        <text x="260" y="428" textAnchor="middle" fill="#126f73" fontSize="17" fontWeight="500">Session Recording</text>
      </svg>
    </div>
  );
}

function CbhHowItWorks() {
  return (
    <section className="ecs-section smn-how-section">
      <div className="ecs-section-heading centered">
        <h2>How CBH Works</h2>
        <p>Instead of allowing administrators to connect directly to production servers, Cloud Bastion Host acts as a secure gateway for all privileged access.</p>
      </div>
      <div className="storage-how-layout">
        <div className="storage-scenario-panel">
          <h3>Scenario</h3>
          <p>An organization manages hundreds of production cloud servers across multiple environments.</p>
          <p>Instead of allowing administrators to connect directly to servers, all privileged access is routed through Cloud Bastion Host. CBH authenticates users, verifies permissions, records administrative sessions, audits every operation, and securely manages privileged access through a centralized platform.</p>
          <p>Security teams gain complete visibility while administrators continue working through a controlled and efficient operational workflow.</p>
        </div>
        <div className="storage-advantages-panel">
          <h3>Advantages</h3>
          <article>
            <h4>Stronger Infrastructure Security</h4>
            <p>Reduce attack surfaces by eliminating direct administrative access to production resources.</p>
          </article>
          <article>
            <h4>Complete Operational Accountability</h4>
            <p>Maintain detailed records of every login, command, and privileged session for security investigations and compliance.</p>
          </article>
          <article>
            <h4>Simplified Administration</h4>
            <p>Manage administrator identities, permissions, and operational policies from one centralized security platform.</p>
          </article>
        </div>
      </div>
    </section>
  );
}

function CbhFaq() {
  return (
    <section className="pricing-faq ecs-faq">
      <div>
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about HTGClouds Cloud Bastion Host (CBH).</p>
      </div>
      <div className="pricing-faq-list">
        {cbhFaqs.map((item, index) => (
          <details key={item.question} open={index === 0}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function CbhCta() {
  return (
    <section className="pricing-cta ecs-cta">
      <div>
        <h2>Secure Privileged Access Across Your Cloud Environment</h2>
      </div>
      <div>
        <p>Protect production infrastructure with centralized administrator access, intelligent permission management, and comprehensive operational auditing built for enterprise security.</p>
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
            href="/pricing"
            onClick={(event) => {
              event.preventDefault();
              navigateTo("/pricing");
            }}
          >
            View Pricing
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
