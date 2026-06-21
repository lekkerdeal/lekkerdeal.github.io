export function cleanValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

export function normalizeText(text) {
  return cleanValue(text)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(
      /\b(new|deal|deals|special|sale|offer|offers|the|and|with|for|black|white)\b/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function titleCase(text) {
  return cleanValue(text)
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function titleCaseSingleWord(text) {
  const value = cleanValue(text);
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
    : "";
}

export function sanitizeSearchText(value) {
  return cleanValue(value)
    .replace(/[<>`{}[\]\\]/g, "")
    .slice(0, 120);
}

export function sanitizePhone(value) {
  return cleanValue(value).replace(/\s+/g, "").replace(/\D/g, "").slice(0, 10);
}

export function isValidPhone(value) {
  return /^0\d{9}$/.test(cleanValue(value));
}

export function sanitizeProvince(value, allowedProvinces) {
  const key = cleanValue(value)
    .replace(/[^a-z]/gi, "")
    .toLowerCase();
  return (
    [...allowedProvinces].find(
      (province) => province.replace(/[^a-z]/gi, "").toLowerCase() === key,
    ) || ""
  );
}

export function sanitizeName(value) {
  return cleanValue(value)
    .replace(/[^\p{L}\p{M}]/gu, "")
    .slice(0, 40);
}

export function isValidName(value) {
  return /^[\p{L}\p{M}]{2,40}$/u.test(cleanValue(value));
}

export function sanitizeCity(value) {
  return cleanValue(value)
    .replace(/[^\p{L}\p{M} ]/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
}

export function isValidCity(value) {
  const city = cleanValue(value);
  return (
    city.length >= 2 &&
    city.length <= 60 &&
    /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u.test(city)
  );
}

export function safeHttpUrl(value) {
  const raw = cleanValue(value);
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.origin);
    if (!["http:", "https:"].includes(url.protocol)) return "";
    return url.toString();
  } catch (error) {
    return "";
  }
}
