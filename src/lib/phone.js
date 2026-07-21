import { isValidPhoneNumber, parsePhoneNumberFromString } from "libphonenumber-js";
import { countries } from "../data/countries.js";

export function phoneCountryCode(country) {
  const value = String(country || "").trim();
  const selected = countries.find((item) => item.value === value || item.code === value);
  const code = selected?.code || value;

  if (!code) return undefined;
  if (code === "SO-SL") return "SO";

  return /^[A-Z]{2}$/.test(code) ? code : undefined;
}

export function validatePhoneNumberForCountry(value, country) {
  const code = phoneCountryCode(country);
  const raw = String(value || "").trim();

  if (!raw || !code) return false;

  try {
    const parsed = parsePhoneNumberFromString(raw, code);
    return Boolean(parsed?.isValid() && parsed.country === code && isValidPhoneNumber(raw, code));
  } catch {
    return false;
  }
}

export function normalizePhoneNumberForCountry(value, country) {
  const code = phoneCountryCode(country);
  const parsed = parsePhoneNumberFromString(String(value || "").trim(), code);

  if (!parsed?.isValid() || parsed.country !== code) return null;

  return parsed.number;
}

export function phoneValidationMessage(country) {
  const selected = countries.find((item) => item.value === country || item.code === country);
  const label = selected?.value || "the selected country";

  return `Enter a valid phone number for ${label}.`;
}

export function parseManageOnePhone(phoneNumber, country) {
  const code = phoneCountryCode(country);
  const parsed = parsePhoneNumberFromString(String(phoneNumber || "").trim(), code);

  if (!parsed?.isValid()) return null;

  return {
    areacode: parsed.countryCallingCode,
    phone: parsed.nationalNumber
  };
}
