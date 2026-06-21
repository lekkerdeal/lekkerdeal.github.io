import { POWER_CATEGORIES } from "./application-config.js";
import { cleanValue, normalizeText, titleCase } from "./text-sanitization.js";

export function normalizeDeal(deal, index) {
  const currentPrice = parsePrice(deal.current_price ?? deal.price_text);
  const oldPrice = parsePrice(deal.old_price ?? deal.old_price_text);
  const normalized = {
    ...deal,
    retailer: cleanValue(
      deal.retailer || titleCase(deal.site_key || "Unknown retailer"),
    ),
    site_key: cleanValue(
      deal.site_key || normalizeText(deal.retailer || "unknown"),
    ),
    title: cleanValue(deal.title || "Untitled deal"),
    brand: cleanValue(deal.brand),
    model: cleanValue(deal.model),
    original_category: cleanValue(deal.category || "Other"),
    category: getPowerCategory(deal),
    current_price: currentPrice,
    old_price: oldPrice,
    price_text: cleanValue(deal.price_text),
    old_price_text: cleanValue(deal.old_price_text),
    image_url: cleanValue(deal.image_url),
    product_url: cleanValue(deal.product_url),
    stock_status: cleanStockStatus(deal.stock_status),
    scraped_at: cleanValue(deal.scraped_at),
    source_page: cleanValue(deal.source_page),
    _sourceIndex: index,
  };

  normalized.discount_percent = getDiscountPercent(normalized);
  normalized.discount_amount = getDiscountAmount(normalized);
  normalized._dealId = getDealId(normalized);
  normalized._productKey = getProductReviewKey(normalized);
  normalized._searchText = normalizeText(
    [
      normalized.title,
      normalized.brand,
      normalized.model,
      normalized.retailer,
      normalized.category,
    ]
      .filter(Boolean)
      .join(" "),
  );

  return normalized;
}

export function cleanStockStatus(value) {
  const raw = normalizeText(value || "");
  if (!raw) return "unknown";
  if (raw.includes("out")) return "out_of_stock";
  if (raw.includes("stock") || raw.includes("available")) return "in_stock";
  return raw;
}

export function isValidDeal(deal) {
  return Boolean(deal.title);
}

export function formatPrice(value) {
  const price = parsePrice(value);
  if (!Number.isFinite(price)) return "Price unavailable";
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: price % 1 === 0 ? 0 : 2,
  }).format(price);
}

export function parsePrice(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  let cleaned = String(value)
    .replace(/[^0-9.,-]/g, "")
    .replace(/\s+/g, "");
  if (!cleaned) return null;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    cleaned =
      parts[parts.length - 1].length === 3
        ? parts.join("")
        : cleaned.replace(",", ".");
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDiscountPercent(deal) {
  const existing = Number(deal.discount_percent);
  if (Number.isFinite(existing) && existing > 0) return Math.round(existing);
  if (
    Number.isFinite(deal.current_price) &&
    Number.isFinite(deal.old_price) &&
    deal.old_price > deal.current_price
  ) {
    return Math.round(
      ((deal.old_price - deal.current_price) / deal.old_price) * 100,
    );
  }
  return 0;
}

export function getDiscountAmount(deal) {
  const existing = Number(deal.discount_amount);
  if (Number.isFinite(existing) && existing > 0) return existing;
  if (
    Number.isFinite(deal.current_price) &&
    Number.isFinite(deal.old_price) &&
    deal.old_price > deal.current_price
  ) {
    return deal.old_price - deal.current_price;
  }
  return 0;
}

export function formatDate(dateString) {
  if (!dateString) return "Date unavailable";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(dateString) {
  if (!dateString) return "Last updated unavailable";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Last updated unavailable";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function getPowerCategory(deal) {
  const source = normalizeText(
    [deal.category, deal.title, deal.brand, deal.model]
      .filter(Boolean)
      .join(" "),
  );

  if (
    /\b(tv|laptop|computer|desktop|monitor|phone|smartphone|tablet|gaming|console|headphone|speaker|camera|router|ssd|hdd|keyboard|mouse|printer|tech)\b/.test(
      source,
    )
  ) {
    return "Tech";
  }
  if (
    /\b(fridge|freezer|washing|dishwasher|microwave|kettle|toaster|air fryer|oven|stove|vacuum|appliance|dryer)\b/.test(
      source,
    )
  ) {
    return "Appliances";
  }
  if (
    /\b(tool|tools|diy|drill|saw|grinder|paint|garden|builder|hardware|ladder|workbench|cement|plumbing)\b/.test(
      source,
    )
  ) {
    return "DIY";
  }
  if (
    /\b(fashion|shoe|sneaker|shirt|dress|jacket|jean|watch|bag|clothing|apparel|wear)\b/.test(
      source,
    )
  ) {
    return "Fashion";
  }
  if (
    /\b(baby|cot|crib|stroller|pram|nappy|diaper|feeding|toddler|kids|child)\b/.test(
      source,
    )
  ) {
    return "Baby";
  }
  if (
    /\b(grocery|food|cleaning|detergent|toilet|paper|soap|shampoo|essential|home|furniture|bed|linen)\b/.test(
      source,
    )
  ) {
    return "Essentials";
  }
  return POWER_CATEGORIES.includes(cleanValue(deal.category))
    ? cleanValue(deal.category)
    : "Essentials";
}

export function getDealId(deal) {
  return (
    deal.product_url ||
    `${deal.site_key}-${normalizeText(deal.title)}-${deal._sourceIndex}`
  );
}

export function getProductReviewKey(deal) {
  const identity = [deal.brand, deal.model, deal.title]
    .filter(Boolean)
    .join(" ");
  return normalizeText(identity).slice(0, 160);
}
