import { pricingCatalog, type BillingPeriod, type PricingSku } from "./pricingCatalog";

const HOURS_PER_MONTH = 730;
const MONTHS_PER_YEAR = 12;

export type EstimateItemInput = {
  serviceId: string;
  skuId: string;
  quantity?: number;
  capacityGb?: number;
  billingPeriod?: BillingPeriod | string | null;
};

export type EstimateLine = {
  serviceId: string;
  serviceName: string;
  skuId: string;
  skuName: string;
  billingPeriod: BillingPeriod;
  quantity: number;
  unitLabel: string;
  unitPrice: number | null;
  subtotal: number;
  contactSales: boolean;
};

export type EstimateTotals = {
  billingPeriod: BillingPeriod;
  subtotal: number;
  formattedSubtotal: string;
  lines: EstimateLine[];
  contactSalesItems: EstimateLine[];
};

export function normalizeBillingPeriod(period?: BillingPeriod | string | null): BillingPeriod {
  const normalized = String(period || pricingCatalog.defaultBillingPeriod).toLowerCase();

  if (normalized === "hour" || normalized === "hourly") return "hourly";
  if (normalized === "year" || normalized === "annual" || normalized === "annually" || normalized === "yearly") {
    return "yearly";
  }

  return "monthly";
}

export function formatPrice(value: number | null | undefined, currency = pricingCatalog.currency): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "Contact sales";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: value >= 1 ? 2 : 6,
    maximumFractionDigits: value >= 1 ? 2 : 6
  }).format(value);
}

export function calculateItemSubtotal(item: EstimateItemInput): EstimateLine {
  const billingPeriod = normalizeBillingPeriod(item.billingPeriod);
  const service = pricingCatalog.services[item.serviceId];

  if (!service) {
    throw new Error(`Unknown pricing service: ${item.serviceId}`);
  }

  const sku = service.skus.find((entry) => entry.id === item.skuId);
  if (!sku) {
    throw new Error(`Unknown pricing SKU '${item.skuId}' for service '${item.serviceId}'`);
  }

  const quantity = resolveQuantity(item, sku, service.defaultQuantity);
  const unitPrice = sku.contactSales ? null : resolveUnitPrice(sku, billingPeriod);
  const subtotal = unitPrice === null ? 0 : roundCurrency(unitPrice * quantity);

  return {
    serviceId: service.id,
    serviceName: service.name,
    skuId: sku.id,
    skuName: sku.name,
    billingPeriod,
    quantity,
    unitLabel: sku.unitLabel,
    unitPrice,
    subtotal,
    contactSales: Boolean(sku.contactSales || unitPrice === null)
  };
}

export function calculateEstimateTotals(
  items: EstimateItemInput[],
  billingPeriod: BillingPeriod | string | null = pricingCatalog.defaultBillingPeriod
): EstimateTotals {
  const normalizedBillingPeriod = normalizeBillingPeriod(billingPeriod);
  const lines = items.map((item) =>
    calculateItemSubtotal({
      ...item,
      billingPeriod: item.billingPeriod || normalizedBillingPeriod
    })
  );
  const subtotal = roundCurrency(
    lines.reduce((sum, line) => sum + (line.contactSales ? 0 : line.subtotal), 0)
  );

  return {
    billingPeriod: normalizedBillingPeriod,
    subtotal,
    formattedSubtotal: formatPrice(subtotal),
    lines,
    contactSalesItems: lines.filter((line) => line.contactSales)
  };
}

function resolveQuantity(item: EstimateItemInput, sku: PricingSku, defaultQuantity: number): number {
  if (sku.unit === "gb") return positiveNumber(item.capacityGb ?? item.quantity ?? defaultQuantity);
  return positiveNumber(item.quantity ?? defaultQuantity);
}

function resolveUnitPrice(sku: PricingSku, billingPeriod: BillingPeriod): number | null {
  const prices = sku.prices || {};
  const directPrice = prices[billingPeriod];
  if (typeof directPrice === "number") return directPrice;

  if (billingPeriod === "hourly") {
    if (typeof prices.monthly === "number") return prices.monthly / HOURS_PER_MONTH;
    if (typeof prices.yearly === "number") return prices.yearly / MONTHS_PER_YEAR / HOURS_PER_MONTH;
  }

  if (billingPeriod === "monthly") {
    if (typeof prices.hourly === "number") return prices.hourly * HOURS_PER_MONTH;
    if (typeof prices.yearly === "number") return prices.yearly / MONTHS_PER_YEAR;
  }

  if (billingPeriod === "yearly") {
    if (typeof prices.monthly === "number") return prices.monthly * MONTHS_PER_YEAR;
    if (typeof prices.hourly === "number") return prices.hourly * HOURS_PER_MONTH * MONTHS_PER_YEAR;
  }

  return null;
}

function positiveNumber(value: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000;
}
