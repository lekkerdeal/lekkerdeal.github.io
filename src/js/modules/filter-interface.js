import {
  POWER_CATEGORIES,
  RETAILER_LOGO_PATHS,
} from "./application-config.js";
import { cleanValue } from "./text-sanitization.js";
import { escapeAttr, escapeHtml, uniqueSorted } from "./interface-formatting.js";

const RETAILER_LOGOS_BY_KEY = Object.fromEntries(
  Object.entries(RETAILER_LOGO_PATHS).map(([retailer, path]) => [
    logoLookupKey(retailer),
    path,
  ]),
);

export function buildFilterOptions({
  deals,
  retailerFilter,
  categoryFilter,
  retailerChips,
  renderBreakdowns,
}) {
  const retailers = uniqueSorted(deals.map((deal) => deal.retailer));
  const categories = POWER_CATEGORIES.filter((category) =>
    deals.some((deal) => deal.category === category),
  );

  fillSelect(retailerFilter, "All Retailers", retailers);
  fillSelect(categoryFilter, "All Categories", categories);

  retailerChips.innerHTML = [
    chipTemplate("All", ""),
    ...retailers.map((retailer) => chipTemplate(retailer, retailer)),
  ].join("");

  renderBreakdowns(retailers, categories);
}

export function fillSelect(select, defaultLabel, values) {
  select.innerHTML = [
    `<option value="">${escapeHtml(defaultLabel)}</option>`,
    ...values.map(
      (value) =>
        `<option value="${escapeAttr(value)}">${escapeHtml(value)}</option>`,
    ),
  ].join("");
}

function chipTemplate(label, value) {
  const logoUrl = getRetailerLogoUrl(value);
  const initials = value ? getRetailerInitials(label) : "LD";
  const logo = logoUrl
    ? `<img class="chip-logo" src="${escapeAttr(logoUrl)}" alt="" loading="lazy" decoding="async">`
    : "";

  return `
        <li>
            <button class="chip logo-chip" type="button" data-retailer="${escapeAttr(value)}" aria-label="${escapeAttr(value ? `${label} deals` : "All retailers")}">
                <span class="chip-logo-frame">
                    ${logo}
                    <span class="chip-fallback" ${logo ? "hidden" : ""}>${escapeHtml(initials)}</span>
                </span>
                <span class="chip-label">${escapeHtml(label)}</span>
            </button>
        </li>
    `;
}

function getRetailerLogoUrl(retailer) {
  if (!retailer) return "assets/icon.png";
  return RETAILER_LOGO_PATHS[retailer] || RETAILER_LOGOS_BY_KEY[logoLookupKey(retailer)] || "";
}

function logoLookupKey(value) {
  return cleanValue(value).replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function getRetailerInitials(label) {
  return (
    cleanValue(label)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("") || "LD"
  );
}
