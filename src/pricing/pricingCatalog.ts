export type BillingPeriod = "hourly" | "monthly" | "yearly";

export type PricingRegion = "Mogadishu-region-hq3" | "Hoa-Mogadishu-2";

export type PricingCategory = "compute" | "storage" | "network" | "security" | "logs";

export type PricingUnit = "instance" | "gb" | "quantity" | "mbps" | "tier";

export type PricingModel =
  | "flavor"
  | "per-gb"
  | "per-quantity"
  | "bandwidth-tier"
  | "instance-type"
  | "flat-tier";

export type PeriodPrices = Partial<Record<BillingPeriod, number>>;

export type PricingSku = {
  id: string;
  name: string;
  type?: string;
  unit: PricingUnit;
  unitLabel: string;
  prices?: PeriodPrices;
  contactSales?: boolean;
  vcpu?: number;
  ramGb?: number;
  storageGb?: number;
  cpuOvercommitRatio?: string;
  includedTraffic?: string;
  includedStorage?: string;
  retentionPolicy?: string;
  features?: string;
  sourceSheet: string;
  sourceRow: number;
};

export type PricingService = {
  id: string;
  name: string;
  category: PricingCategory;
  sourceSheet: string;
  pricingModel: PricingModel;
  defaultQuantity: number;
  quantityLabel: string;
  skus: PricingSku[];
};

export type PricingCatalog = {
  currency: "USD";
  defaultBillingPeriod: BillingPeriod;
  regions: PricingRegion[];
  services: Record<string, PricingService>;
};

const availableRegions: PricingRegion[] = ["Mogadishu-region-hq3", "Hoa-Mogadishu-2"];

function periodPrices(monthly?: number, yearly?: number, hourly?: number): PeriodPrices {
  return {
    ...(hourly !== undefined ? { hourly } : {}),
    ...(monthly !== undefined ? { monthly } : {}),
    ...(yearly !== undefined ? { yearly } : {})
  };
}

function flavorSku(
  sourceSheet: string,
  sourceRow: number,
  name: string,
  vcpu: number,
  ramGb: number,
  cpuOvercommitRatio: string,
  monthly?: number,
  hourly?: number,
  yearly?: number,
  storageGb?: number
): PricingSku {
  return {
    id: name,
    name,
    unit: "instance",
    unitLabel: "instance",
    prices: periodPrices(monthly, yearly, hourly),
    vcpu,
    ramGb,
    ...(storageGb !== undefined ? { storageGb } : {}),
    cpuOvercommitRatio,
    sourceSheet,
    sourceRow
  };
}

function pricedSku(
  sourceSheet: string,
  sourceRow: number,
  name: string,
  type: string | undefined,
  unit: PricingUnit,
  unitLabel: string,
  monthly?: number,
  yearly?: number,
  hourly?: number,
  extra: Partial<PricingSku> = {}
): PricingSku {
  return {
    id: type ? `${name} - ${type}` : name,
    name,
    ...(type ? { type } : {}),
    unit,
    unitLabel,
    prices: periodPrices(monthly, yearly, hourly),
    sourceSheet,
    sourceRow,
    ...extra
  };
}

export const pricingCatalog: PricingCatalog = {
  currency: "USD",
  defaultBillingPeriod: "monthly",
  regions: availableRegions,
  services: {
    ECS: {
      id: "ECS",
      name: "Elastic Cloud Server",
      category: "compute",
      sourceSheet: "ECS",
      pricingModel: "flavor",
      defaultQuantity: 1,
      quantityLabel: "instances",
      skus: [
        flavorSku("ECS", 3, "S6_64U_512G", 64, 512, "1:3", 1339.85),
        flavorSku("ECS", 4, "S6_64U_256G", 64, 256, "1:3", 1078.448, 2.05184, 11862.928),
        flavorSku("ECS", 5, "C6_16xlarge.4", 64, 256, "1:1", 1230.4, 3.4, 13534.4),
        flavorSku("ECS", 6, "C6_12xlarge.4", 48, 192, "1:1", 922, 2.64, 10142),
        flavorSku("ECS", 7, "S6_48U_160G", 48, 160, "1:3", 776.16, 1.078, 8537.76),
        flavorSku("ECS", 8, "S6_32U_128G", 32, 128, "1:3", 539.224, 1.02592, 5931.464),
        flavorSku("ECS", 9, "C6_16xlarge.2", 64, 128, "1:1", 986.8, 2.04, 10854.8),
        flavorSku("ECS", 10, "C6_8xlarge.4", 24, 96, "1:1", 615.2, 1.7, 6767.2),
        flavorSku("ECS", 11, "C6_6xlarge.4", 24, 96, "1:1", 461, 1.32, 5071),
        flavorSku("ECS", 12, "C6_12xlarge.2", 48, 96, "1:1", 740.2, 1.54, 8142.2),
        flavorSku("ECS", 13, "S6_32U_64G", 32, 64, "1:3", 430.906, 0.81984, 4739.966),
        flavorSku("ECS", 14, "S6_16U_64G", 16, 64, "1:3", 269.612, 0.51296, 2965.732),
        flavorSku("ECS", 15, "S6_12U_64G", 12, 64, "1:3", 221.76, 0.336, 2661.12),
        flavorSku("ECS", 16, "C6_2xlarge.8", 8, 64, "1:1", 175.218074, 0.489881, 1927.398815),
        flavorSku("ECS", 17, "C6_8xlarge.2", 24, 48, "1:1", 493.4, 1.02, 5427.4),
        flavorSku("ECS", 18, "C6_6xlarge.2", 24, 48, "1:1", 370.1, 0.77, 4071.1),
        flavorSku("ECS", 19, "C6_4xlarge.4", 16, 48, "1:1", 307.5, 0.8, 3382.5),
        flavorSku("ECS", 20, "S6_4xlarge.2", 16, 32, "1:3", 258.5436, 0.359088, 2843.9796),
        flavorSku("ECS", 21, "S6_4U_32G", 4, 32, "1:3", 165.733077, 0.230185, 1823.063846),
        flavorSku("ECS", 22, "S6_2xlarge.4", 8, 32, "1:3", 107.66, 0.301, 1184.26),
        flavorSku("ECS", 23, "S6_16U_32G", 16, 32, "1:3", 215.453, 0.40992, 2369.983),
        flavorSku("ECS", 24, "C6_2xlarge.4", 8, 32, "1:1", 153.8, 0.43, 1691.8),
        flavorSku("ECS", 25, "C6_3xlarge.4", 12, 28, "1:1", 230.7, 0.66, 2537.7),
        flavorSku("ECS", 26, "S6_8U_24G", 8, 24, "1:3", 215.453, 0.40992, 2369.983),
        flavorSku("ECS", 27, "C6_4xlarge.2", 16, 24, "1:1", 246.7, 0.51, 2713.7),
        flavorSku("ECS", 28, "C6_3xlarge.2", 12, 24, "1:1", 202.6, 0.42, 2228.6),
        flavorSku("ECS", 29, "S6_xlarge.4", 4, 16, "1:3", 49.985, 0.1365, 549.835),
        flavorSku("ECS", 30, "S6_2xlarge.2", 8, 16, "1:3", 94.5, 0.196, 1039.5),
        flavorSku("ECS", 31, "C6_xlarge.4", 4, 16, "1:1", 76.9, 0.21, 845.9),
        flavorSku("ECS", 32, "C6_2xlarge.2", 8, 16, "1:1", 135, 0.28, 1485),
        flavorSku("ECS", 33, "S6_4U_12G", 4, 12, "1:3", 132.586462, 0.184148, 1458.451077),
        flavorSku("ECS", 34, "S6_xlarge.2", 4, 8, "1:3", 43.875, 0.091, 482.625),
        flavorSku("ECS", 35, "S6_large.4", 2, 8, "1:3", 24.96, 0.065, 274.56),
        flavorSku("ECS", 36, "C6_xlarge.2", 4, 8, "1:1", 67.5, 0.14, 742.5),
        flavorSku("ECS", 37, "C6_large.4", 2, 8, "1:1", 38.4, 0.1, 422.4),
        flavorSku("ECS", 38, "S6_large.2", 2, 4, "1:3", 18.5055, 0.026, 203.5605),
        flavorSku("ECS", 39, "C6_large.2", 2, 4, "1:1", 28.47, 0.04, 313.17),
        flavorSku("ECS", 40, "S6_large.1", 2, 2, "1:3", 8.025, 0.011146, 96.3)
      ]
    },
    "ECS-CCE": {
      id: "ECS-CCE",
      name: "Cloud Container Engine Worker Nodes",
      category: "compute",
      sourceSheet: "ECS-CCE",
      pricingModel: "flavor",
      defaultQuantity: 1,
      quantityLabel: "instances",
      skus: [
        flavorSku("ECS-CCE", 3, "S2_xlarge.2", 4, 8, "1:3", 43.875, 0.091, 482.625),
        flavorSku("ECS-CCE", 4, "S2_2xlarge.2", 8, 16, "1:3", 94.5, 0.196, 1039.5),
        flavorSku("ECS-CCE", 5, "S2_4xlarge.2", 16, 32, "1:3", 258.5436, 0.359088, 2843.9796),
        flavorSku("ECS-CCE", 6, "S2_8xlarge.2", 32, 64, "1:3", 430.906, 0.81984, 4739.966)
      ]
    },
    BMS: {
      id: "BMS",
      name: "Bare Metal Server",
      category: "compute",
      sourceSheet: "BMS",
      pricingModel: "flavor",
      defaultQuantity: 1,
      quantityLabel: "instances",
      skus: [flavorSku("BMS", 2, "bms.physical.o2", 72, 512, "dedicated", 1642.5, 2.25, 19710, 47048)]
    },
    EVS: {
      id: "EVS",
      name: "Elastic Volume Service",
      category: "storage",
      sourceSheet: "EVS",
      pricingModel: "per-gb",
      defaultQuantity: 100,
      quantityLabel: "GB",
      skus: [
        pricedSku("EVS", 2, "SSD (Block Storage / NVMe)", undefined, "gb", "GB", 0.072, 0.864, 0.000099),
        pricedSku("EVS", 3, "SATA (Object / Cold Storage)", undefined, "gb", "GB", 0.011, 0.132, 0.000015)
      ]
    },
    SFS: {
      id: "SFS",
      name: "Scalable File Service",
      category: "storage",
      sourceSheet: "SFS",
      pricingModel: "per-gb",
      defaultQuantity: 100,
      quantityLabel: "GB",
      skus: [pricedSku("SFS", 2, "SFS_SATA", "Capacity", "gb", "GB", 0.045, 0.54, 0.000062)]
    },
    OBS: {
      id: "OBS",
      name: "Object Storage Service",
      category: "storage",
      sourceSheet: "OBS",
      pricingModel: "per-gb",
      defaultQuantity: 100,
      quantityLabel: "GB",
      skus: [
        pricedSku("OBS", 2, "Fusion bucket", "Standard", "gb", "GB", 0.012, 0.144, 0.000016),
        pricedSku("OBS", 3, "Fusion bucket", "Archive", "gb", "GB", 0.0035, 0.042, 0.000005)
      ]
    },
    CSBS: {
      id: "CSBS",
      name: "Cloud Server Backup Service",
      category: "storage",
      sourceSheet: "CSBS",
      pricingModel: "per-gb",
      defaultQuantity: 100,
      quantityLabel: "GB",
      skus: [pricedSku("CSBS", 2, "General CSBS Duplication (backup)", "Standard Backup", "gb", "GB", 0.024, 0.288, 0.000033)]
    },
    VBS: {
      id: "VBS",
      name: "Volume Backup Service",
      category: "storage",
      sourceSheet: "VBS",
      pricingModel: "per-gb",
      defaultQuantity: 100,
      quantityLabel: "GB",
      skus: [pricedSku("VBS", 2, "General VBS Duplication (Volume Backup Service)", "Standard", "gb", "GB", 0.018, 0.216, 0.000025)]
    },
    "EIP-number": {
      id: "EIP-number",
      name: "Elastic IP Number",
      category: "network",
      sourceSheet: "EIP-number",
      pricingModel: "per-quantity",
      defaultQuantity: 1,
      quantityLabel: "IP addresses",
      skus: [
        pricedSku("EIP-number", 2, "Active", undefined, "quantity", "IP", 5, 60, 0.006849),
        pricedSku("EIP-number", 3, "Idle", undefined, "quantity", "IP", 0, 0, 0)
      ]
    },
    "EIP-bandwidth": {
      id: "EIP-bandwidth",
      name: "Elastic IP Bandwidth",
      category: "network",
      sourceSheet: "EIP-bandwith",
      pricingModel: "bandwidth-tier",
      defaultQuantity: 1,
      quantityLabel: "Mbps",
      skus: [
        pricedSku("EIP-bandwith", 2, "1 - 5 Mbps", undefined, "mbps", "Mbps", 3, 36, 0.00411),
        pricedSku("EIP-bandwith", 3, "6 - 50 Mbps", undefined, "mbps", "Mbps", 4.5, 54, 0.006164),
        pricedSku("EIP-bandwith", 4, "51 - 200 Mbps", undefined, "mbps", "Mbps", 6, 72, 0.008219),
        {
          id: "200+ Mbps",
          name: "200+ Mbps",
          unit: "mbps",
          unitLabel: "Mbps",
          contactSales: true,
          sourceSheet: "EIP-bandwith",
          sourceRow: 5
        }
      ]
    },
    "ELB-number": {
      id: "ELB-number",
      name: "Elastic Load Balance Number",
      category: "network",
      sourceSheet: "ELB-number",
      pricingModel: "per-quantity",
      defaultQuantity: 1,
      quantityLabel: "load balancers",
      skus: [pricedSku("ELB-number", 2, "Shared", undefined, "quantity", "load balancer", 14.6, 175.2, 0.02)]
    },
    NAT: {
      id: "NAT",
      name: "NAT Gateway",
      category: "network",
      sourceSheet: "NAT",
      pricingModel: "instance-type",
      defaultQuantity: 1,
      quantityLabel: "instances",
      skus: [
        pricedSku("NAT", 2, "Small (150 Mbps)", "Instance", "instance", "instance", 7, 84, 0.009589),
        pricedSku("NAT", 3, "Medium (600 Mbps)", "Instance", "instance", "instance", 18, 216, 0.024658),
        pricedSku("NAT", 4, "Large (1.5 Gbps)", "Instance", "instance", "instance", 45, 540, 0.061644),
        pricedSku("NAT", 5, "Extra-large (4 Gbps+)", "Instance", "instance", "instance", 85, 1020, 0.116438)
      ]
    },
    VPN: {
      id: "VPN",
      name: "Virtual Private Network",
      category: "network",
      sourceSheet: "VPN",
      pricingModel: "instance-type",
      defaultQuantity: 1,
      quantityLabel: "connections",
      skus: [pricedSku("VPN", 2, "General VPN Connection", "Instance", "instance", "connection", 36.5, 438, 0.05)]
    },
    "VPN Gateway": {
      id: "VPN Gateway",
      name: "VPN Gateway",
      category: "network",
      sourceSheet: "VPN Gateway",
      pricingModel: "instance-type",
      defaultQuantity: 1,
      quantityLabel: "gateways",
      skus: [pricedSku("VPN Gateway", 2, "VPN Gateway", "Instance", "instance", "gateway", 65, 780, 0.090278)]
    },
    VPCEP: {
      id: "VPCEP",
      name: "VPC Endpoint",
      category: "network",
      sourceSheet: "VPCEP",
      pricingModel: "instance-type",
      defaultQuantity: 1,
      quantityLabel: "endpoints",
      skus: [pricedSku("VPCEP", 2, "General VPC Endpoints", "Instance", "instance", "endpoint", 7.3, 87.6, 0.01)]
    },
    WAF: {
      id: "WAF",
      name: "Web Application Firewall",
      category: "security",
      sourceSheet: "WAF-not ready",
      pricingModel: "flat-tier",
      defaultQuantity: 1,
      quantityLabel: "tiers",
      skus: [
        pricedSku("WAF-not ready", 4, "Basic WAF", undefined, "tier", "tier", 15, undefined, undefined, {
          includedTraffic: "5 TB",
          features: "OWASP Top 10 protection, Core Rule Set (CRS)."
        }),
        pricedSku("WAF-not ready", 5, "Advanced WAF", undefined, "tier", "tier", 45, undefined, undefined, {
          includedTraffic: "20 TB",
          features: "Custom Regex rules, IP Rate Limiting, Bot Mitigation."
        }),
        pricedSku("WAF-not ready", 6, "Enterprise WAF", undefined, "tier", "tier", 150, undefined, undefined, {
          includedTraffic: "Unlimited*",
          features: "Geo-fencing, API Security, Dedicated Support."
        })
      ]
    },
    CBH: {
      id: "CBH",
      name: "Cloud Bastion Host",
      category: "security",
      sourceSheet: "CBH",
      pricingModel: "flat-tier",
      defaultQuantity: 1,
      quantityLabel: "tiers",
      skus: [
        pricedSku("CBH", 2, "Managed Secure Gate", undefined, "tier", "tier", 45, undefined, undefined, {
          features: "Single encrypted entry point for IT teams to manage servers."
        }),
        pricedSku("CBH", 2, "Enterprise Bastion", undefined, "tier", "tier", 450, undefined, undefined, {
          features: "Enterprise bastion with full video recording of admin sessions."
        })
      ]
    },
    LTS: {
      id: "LTS",
      name: "Log Tank Service",
      category: "logs",
      sourceSheet: "LTS",
      pricingModel: "flat-tier",
      defaultQuantity: 1,
      quantityLabel: "tiers",
      skus: [
        pricedSku("LTS", 3, "LTS Lite", undefined, "tier", "tier", 15, undefined, undefined, {
          includedStorage: "50 GB",
          retentionPolicy: "7 Days"
        }),
        pricedSku("LTS", 4, "LTS Standard", undefined, "tier", "tier", 45, undefined, undefined, {
          includedStorage: "200 GB",
          retentionPolicy: "30 Days"
        }),
        pricedSku("LTS", 5, "LTS Compliance", undefined, "tier", "tier", 120, undefined, undefined, {
          includedStorage: "1 TB",
          retentionPolicy: "180 Days"
        })
      ]
    }
  }
};

export const pricingSourceNotes = {
  sourceWorkbook: "HTGCLOUDS_All_Service_Price_List_Final.xlsx",
  unmappedRows: [
    "ECS row 1 title and row 2 headers were not mapped as SKUs.",
    "ECS columns for ratio comparison, discount deltas, Done flags, and notes were treated as workbook calculation metadata.",
    "EVS row 13 appears to be a summary/total row without a flavor name and was not mapped.",
    "WAF rows 8-13 are market comparison/reference rows, not HTGCloud product SKUs; only rows 4-6 were mapped.",
    "CBH rows 1-3 are narrative descriptions; only the two explicit monthly prices in row 2 were mapped."
  ]
};

export const pricingServices = Object.values(pricingCatalog.services);
