import { Router } from "express";
import { sendContactEnquiry } from "./mailer.js";

export const enquiryTypes = ["Cloud infrastructure & pricing", "Migration to HTG Clouds", "Enterprise solutions", "Partnerships", "Other enquiry"];

export function createContactRouter({ send = sendContactEnquiry, now = Date.now } = {}) {
  const router = Router();
  const attempts = new Map();
  router.post("/", async (request, response) => {
    const timestamp = now();
    for (const [key, entry] of attempts) if (entry.until <= timestamp) attempts.delete(key);
    const key = request.ip;
    const entry = attempts.get(key) || { count: 0, until: timestamp + 15 * 60 * 1000 };
    if (entry.count >= 5 || (!attempts.has(key) && attempts.size >= 10000)) {
      response.set("Retry-After", "900");
      return response.status(429).json({ error: "Too many enquiries. Please try again later or email support@htgclouds.com." });
    }
    entry.count++;
    attempts.set(key, entry);
    const body = request.body || {};
    const limits = { fullName: 120, email: 254, company: 160, phone: 40, enquiryType: 80, message: 5000 };
    const data = {};
    for (const [field, limit] of Object.entries(limits)) {
      if (body[field] !== undefined && typeof body[field] !== "string") return response.status(400).json({ error: "Please check your enquiry details." });
      data[field] = (body[field] || "").trim();
      if (data[field].length > limit) return response.status(400).json({ error: "One or more fields are too long." });
    }
    if (!data.fullName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || /[\r\n]/.test(data.email) || !enquiryTypes.includes(data.enquiryType) || !data.message) {
      return response.status(400).json({ error: "Enter your name, a valid email, enquiry type, and message." });
    }
    if (body.website) return response.status(400).json({ error: "Unable to submit this enquiry." });
    try {
      await send(data);
      return response.json({ ok: true });
    } catch {
      return response.status(503).json({ error: "We couldn’t send your enquiry. Please email support@htgclouds.com or try again later." });
    }
  });
  return router;
}
