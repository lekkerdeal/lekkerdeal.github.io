let deals = [];

self.addEventListener("message", (event) => {
  const { type } = event.data || {};
  if (type === "init") {
    deals = Array.isArray(event.data.deals) ? event.data.deals : [];
    self.postMessage({ type: "ready" });
    return;
  }

  if (type === "filter") {
    const {
      requestId,
      filters = {},
      savedIds = [],
      savedProductKeys = [],
    } = event.data;
    const saved = new Set(savedIds);
    const savedProducts = new Set(savedProductKeys);
    const filteredDeals = filterDeals(deals, filters, saved, savedProducts);
    sortDeals(filteredDeals, filters.sort);
    self.postMessage({
      type: "filtered",
      requestId,
      dealIds: filteredDeals.map((deal) => deal._dealId),
    });
  }
});

function filterDeals(sourceDeals, filters, saved, savedProducts) {
  const search = normalizeText(filters.search);
  const minDiscount = Number(filters.minDiscount) || 0;
  const minPrice = parsePrice(filters.minPrice);
  const maxPrice = parsePrice(filters.maxPrice);

  return sourceDeals.filter((deal) => {
    if (search && !deal._searchText.includes(search)) return false;
    if (filters.retailer && deal.retailer !== filters.retailer) return false;
    if (filters.category && deal.category !== filters.category) return false;
    if (minDiscount && deal.discount_percent < minDiscount) return false;
    if (
      Number.isFinite(minPrice) &&
      (!Number.isFinite(deal.current_price) || deal.current_price < minPrice)
    )
      return false;
    if (
      Number.isFinite(maxPrice) &&
      (!Number.isFinite(deal.current_price) || deal.current_price > maxPrice)
    )
      return false;
    if (
      filters.stock &&
      normalizedStockForFilter(deal.stock_status) !== filters.stock
    )
      return false;
    if (
      filters.savedOnly &&
      !saved.has(deal._dealId) &&
      !(deal._productKey && savedProducts.has(deal._productKey))
    )
      return false;
    return true;
  });
}

function sortDeals(items, sort) {
  const collator = new Intl.Collator("en-ZA");
  const byNewest = (a, b) => safeDate(b.scraped_at) - safeDate(a.scraped_at);
  const sorters = {
    "discount-desc": (a, b) =>
      b.discount_percent - a.discount_percent || byNewest(a, b),
    "price-asc": (a, b) =>
      comparablePrice(a, "asc") - comparablePrice(b, "asc"),
    "price-desc": (a, b) =>
      comparablePrice(b, "desc") - comparablePrice(a, "desc"),
    newest: byNewest,
    "retailer-asc": (a, b) =>
      collator.compare(a.retailer, b.retailer) ||
      collator.compare(a.title, b.title),
    "title-asc": (a, b) => collator.compare(a.title, b.title),
  };
  items.sort(sorters[sort] || sorters["discount-desc"]);
}

function parsePrice(value) {
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

function normalizeText(text) {
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

function cleanValue(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function normalizedStockForFilter(stockStatus) {
  if (stockStatus === "in_stock" || stockStatus === "out_of_stock")
    return stockStatus;
  return "unknown";
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function comparablePrice(deal, direction) {
  if (Number.isFinite(deal.current_price)) return deal.current_price;
  return direction === "asc"
    ? Number.POSITIVE_INFINITY
    : Number.NEGATIVE_INFINITY;
}
