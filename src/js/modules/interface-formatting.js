import { cleanValue } from "./text-sanitization.js";

export function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export function countBy(items, picker) {
  const counts = new Map();
  items.forEach((item) => {
    const key = picker(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return counts;
}

export function formatNumber(value) {
  const number = Number(value) || 0;
  if (Math.abs(number) < 1000)
    return new Intl.NumberFormat("en-ZA").format(number);
  return new Intl.NumberFormat("en-ZA", {
    notation: "compact",
    maximumFractionDigits: number < 10000 ? 1 : 0,
  }).format(number);
}

export function escapeHtml(value) {
  return cleanValue(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttr(value) {
  return escapeHtml(value);
}

export function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(value);
  return String(value).replace(/([ #;?%&,.+*~\':"!^$\[\]()=>|\/@])/g, "\\$1");
}
