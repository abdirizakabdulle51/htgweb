import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import { fileURLToPath } from "url";

const teal = "#009ba3";
const ink = "#101828";
const muted = "#667085";
const line = "#1f2937";
const defaultSellerProfile = {
  legalName: "HTG Clouds",
  addressLines: [
    "Airport road, Next to Ali Jimale Masque",
    "Wadajir District",
    "mogadishu BN 00000",
    "Somalia"
  ],
  phone: "+252 61 5558484",
  email: "Mohamed.hussein@htgclouds.com",
  website: "https://htgclouds.com/",
  slogan: "Built for us, Ready for the World.",
  bankName: "SALAAM SOMALI BANK",
  bankAccountNumber: "33111777",
  bankAccountName: "HTG CLOUDS LIMITED",
  bankLocation: "MOGADISHU - SOMALIA",
  currencyNote: "All fees are listed in USD",
  paymentInstructions: "PLEASE PAY BILLS ON DUE DATE BY DEPOSITING IT TO OUR SALAAM SOMALI BANK ACCOUNT.",
  footerText: "+252 61 5558484 | Mohamed.hussein@htgclouds.com | https://htgclouds.com/"
};
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const logoSvg = loadLogoSvg();

export async function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const sellerProfile = sellerProfileFromInvoice(invoice);

    drawInvoicePage(doc, invoice, sellerProfile);
    doc.addPage();
    drawBankDetailsPage(doc, sellerProfile);

    doc.end();
  });
}

export function invoicePdfFilename(invoiceNumber) {
  const clean = String(invoiceNumber || "invoice")
    .trim()
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${clean || "invoice"}.pdf`;
}

function drawInvoicePage(doc, invoice, sellerProfile) {
  drawHeader(doc, sellerProfile);

  const left = 56;
  const right = 338;
  const titleTop = 198;
  const invoiceNumber = displayInvoiceNumber(invoice.invoiceNumber);

  doc.font("Helvetica").fontSize(22).fillColor(teal).text(`Invoice ${invoiceNumber}`, left, titleTop, { width: 280 });

  drawBillTo(doc, invoice, right, titleTop - 3);
  drawMeta(doc, invoice, left, 278);
  drawLineItems(doc, invoice.lineItems || [], left, 348);
  drawTotal(doc, invoice, 324, 572);
  drawPaymentInstructions(doc, invoice, sellerProfile, left, 662);
  drawFooter(doc, sellerProfile, "Page 1 / 2");
}

function drawBankDetailsPage(doc, sellerProfile) {
  drawHeader(doc, sellerProfile);

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(muted)
    .text(`BANK = ${sellerProfile.bankName}`, 56, 292)
    .text(`ACCOUNT # = ${sellerProfile.bankAccountNumber}`, 56, 310)
    .text(`ACC. NAME = ${sellerProfile.bankAccountName}`, 56, 328)
    .text(sellerProfile.bankLocation, 56, 346)
    .text(sellerProfile.currencyNote, 56, 364);

  drawFooter(doc, sellerProfile, "Page 2 / 2");
}

function drawHeader(doc, sellerProfile) {
  if (logoSvg) {
    SVGtoPDF(doc, logoSvg, 56, 58, { width: 76 });
  } else {
    doc.font("Helvetica-Bold").fontSize(10).fillColor(teal).text("HTGCLOUDS", 56, 62);
  }

  sellerProfile.addressLines.slice(0, 5).forEach((addressLine, index) => {
    doc.font("Helvetica").fontSize(10).fillColor(ink).text(addressLine, 56, 98 + index * 16, { width: 220 });
  });

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(teal)
    .text(sellerProfile.slogan, 360, 65, { width: 180, align: "right" });
}

function drawBillTo(doc, invoice, x, y) {
  const recipientEmail = invoice.billingEmail || invoice.contactEmail || "";
  const lines = [
    invoice.companyName || invoice.customerName || "Customer",
    invoice.contactName,
    recipientEmail,
    invoice.billingAddress
  ].filter(Boolean);

  doc.font("Helvetica-Bold").fontSize(8).fillColor(teal).text("BILL TO", x, y, { width: 185 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(ink).text(lines[0] || "Customer", x, y + 17, { width: 185 });

  if (lines.length > 1) {
    doc.font("Helvetica").fontSize(9).fillColor(ink).text(lines.slice(1).join("\n"), x, y + 34, {
      width: 185,
      lineGap: 2
    });
  }
}

function drawMeta(doc, invoice, x, y) {
  const columns = [
    ["Invoice Date", formatDate(invoice.issueDate || invoice.createdAt)],
    ["Due Date", formatDate(invoice.dueDate)],
    ["Source", invoice.sourceMonth || "-"],
    ["Reference", invoice.sourceReference || "-"]
  ];

  columns.forEach(([label, value], index) => {
    const columnX = x + index * 98;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(teal).text(label, columnX, y, { width: 82 });
    doc.font("Helvetica").fontSize(9).fillColor(ink).text(String(value || "-"), columnX, y + 15, { width: 92 });
  });
}

function drawLineItems(doc, items, x, y) {
  const qtyX = 360;
  const priceX = 420;
  const amountX = 488;

  doc.font("Helvetica-Bold").fontSize(9).fillColor(ink);
  doc.text("Description", x, y);
  doc.text("Quantity", qtyX, y, { width: 50, align: "right" });
  doc.text("Unit Price", priceX, y, { width: 55, align: "right" });
  doc.text("Amount", amountX, y, { width: 55, align: "right" });
  doc.moveTo(x, y + 18).lineTo(544, y + 18).lineWidth(0.8).strokeColor(line).stroke();

  let rowY = y + 31;
  items.slice(0, 12).forEach((item) => {
    const name = item.itemName || item.description || "Invoice item";
    const category = item.serviceCategory || item.category || "";
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || item.rate || 0);
    const amount = Number(item.monthlyTotal ?? item.amount ?? quantity * unitPrice);

    doc.font("Helvetica-Bold").fontSize(9).fillColor(ink).text(name, x, rowY, { width: 290 });
    doc.font("Helvetica").fontSize(9).fillColor(ink).text(category, x, rowY + 15, { width: 290 });
    doc.text(formatNumber(quantity), qtyX, rowY, { width: 50, align: "right" });
    doc.text(formatRate(unitPrice), priceX, rowY, { width: 55, align: "right" });
    doc.text(formatMoney(amount), amountX, rowY, { width: 55, align: "right" });

    rowY += 43;
  });
}

function drawTotal(doc, invoice, x, y) {
  doc.moveTo(x, y).lineTo(544, y).lineWidth(0.8).strokeColor(line).stroke();
  doc.font("Helvetica-Bold").fontSize(9).fillColor(teal).text("Total", x, y + 16);
  doc.text(formatMoney(Number(invoice.totalAmount ?? invoice.balanceDue ?? 0)), 448, y + 16, { width: 96, align: "right" });
}

function drawPaymentInstructions(doc, invoice, sellerProfile, x, y) {
  const invoiceNumber = displayInvoiceNumber(invoice.invoiceNumber);
  const month = amountDueMonth(invoice.sourceMonth || invoice.issueDate || invoice.createdAt);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(ink)
    .text("Payment Communication: ", x, y, { continued: true })
    .font("Helvetica-Bold")
    .text(invoiceNumber)
    .font("Helvetica")
    .text("on this account: ", x, y + 16, { continued: true })
    .font("Helvetica-Bold")
    .text(sellerProfile.bankAccountNumber)
    .font("Helvetica")
    .fillColor(muted)
    .text(`Amount Due ${month}`, x, y + 38)
    .font("Helvetica-Bold")
    .fillColor(muted)
    .text(sellerProfile.paymentInstructions, x, y + 58, { width: 300, lineGap: 2 });
}

function drawFooter(doc, sellerProfile, pageText) {
  const y = 760;
  doc.moveTo(56, y).lineTo(544, y).lineWidth(0.8).strokeColor(line).stroke();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ink).text(sellerProfile.footerText, 56, y + 14, { width: 390 });
  doc.text(pageText, 492, y + 14, { width: 52, align: "right" });
}

function sellerProfileFromInvoice(invoice = {}) {
  const addressLines = Array.isArray(invoice.sellerAddressLines)
    ? invoice.sellerAddressLines.map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  const footerText = valueOrDefault(invoice.sellerFooterText, "") || [
    valueOrDefault(invoice.sellerPhone, defaultSellerProfile.phone),
    valueOrDefault(invoice.sellerEmail, defaultSellerProfile.email),
    valueOrDefault(invoice.sellerWebsite, defaultSellerProfile.website)
  ].filter(Boolean).join(" | ");

  return {
    legalName: valueOrDefault(invoice.sellerLegalName, defaultSellerProfile.legalName),
    addressLines: addressLines.length > 0 ? addressLines : defaultSellerProfile.addressLines,
    phone: valueOrDefault(invoice.sellerPhone, defaultSellerProfile.phone),
    email: valueOrDefault(invoice.sellerEmail, defaultSellerProfile.email),
    website: valueOrDefault(invoice.sellerWebsite, defaultSellerProfile.website),
    slogan: valueOrDefault(invoice.sellerSlogan, defaultSellerProfile.slogan),
    bankName: valueOrDefault(invoice.sellerBankName, defaultSellerProfile.bankName),
    bankAccountNumber: valueOrDefault(invoice.sellerBankAccountNumber, defaultSellerProfile.bankAccountNumber),
    bankAccountName: valueOrDefault(invoice.sellerBankAccountName, defaultSellerProfile.bankAccountName),
    bankLocation: valueOrDefault(invoice.sellerBankLocation, defaultSellerProfile.bankLocation),
    currencyNote: valueOrDefault(invoice.sellerCurrencyNote, defaultSellerProfile.currencyNote),
    paymentInstructions: valueOrDefault(invoice.sellerPaymentInstructions, defaultSellerProfile.paymentInstructions),
    footerText: footerText || defaultSellerProfile.footerText
  };
}

function valueOrDefault(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function displayInvoiceNumber(invoiceNumber) {
  const value = String(invoiceNumber || "INV").trim();
  const match = value.match(/^INV-(\d{4})-(\d+)$/i);
  return match ? `INV/${match[1]}/${match[2]}` : value.replace(/-/g, "/");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Mogadishu",
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

function amountDueMonth(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-");
    return monthYearLabel(new Date(Date.UTC(Number(year), Number(month) - 1, 1)), "UTC");
  }

  const date = value ? new Date(value) : new Date();
  return monthYearLabel(date, "Africa/Mogadishu");
}

function monthYearLabel(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value || "";
  const year = parts.find((part) => part.type === "year")?.value || "";
  return [month, year].filter(Boolean).join(", ");
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatRate(value) {
  return new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 3 }).format(Number(value || 0));
}

function formatMoney(value) {
  return `$ ${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0))}`;
}

function loadLogoSvg() {
  try {
    return fs.readFileSync(path.join(currentDir, "assets", "Logo.svg"), "utf8");
  } catch (error) {
    console.warn("[INVOICE PDF] Logo SVG could not be loaded; falling back to text header.", error);
    return null;
  }
}
