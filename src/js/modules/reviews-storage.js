import { ALLOWED_PROVINCES } from "./application-config.js";
import { cleanValue, sanitizeProvince, titleCase } from "./text-sanitization.js";

const REVIEWS_KEY = "lekkedeal_reviews_v1";
const MAX_COMMENT_LENGTH = 280;

export const REVIEW_TYPES = [
  { value: "product-review", label: "Product review" },
  { value: "deal-win", label: "Deal win" },
  { value: "retailer-request", label: "Retailer request" },
  { value: "price-issue", label: "Price issue" },
  { value: "alert-feedback", label: "Alert feedback" },
  { value: "general", label: "General" },
];

const SEED_REVIEWS = [
  {
    id: "seed-1",
    name: "Thabo",
    province: "Gauteng",
    type: "deal-win",
    rating: 5,
    retailer: "Makro",
    comment:
      "Found a better appliance price than I had in my cart. The discount sorting is the part I use first.",
    createdAt: "2026-06-16T09:15:00.000Z",
    source: "seed",
  },
  {
    id: "seed-2",
    name: "Ayesha",
    province: "Western Cape",
    type: "retailer-request",
    rating: 4,
    retailer: "Takealot",
    comment:
      "Please add more baby and grocery specials. A saved alert per category would be useful.",
    createdAt: "2026-06-15T17:40:00.000Z",
    source: "seed",
  },
  {
    id: "seed-3",
    name: "Lerato",
    province: "KwaZulu-Natal",
    type: "alert-feedback",
    rating: 5,
    retailer: "Builders",
    comment:
      "The location info matters. I want alerts that know when a deal is worth checking near me.",
    createdAt: "2026-06-14T12:05:00.000Z",
    source: "seed",
  },
];

export function getReviewTypes() {
  return REVIEW_TYPES;
}

export function loadReviews() {
  const saved = readLocalReviews();
  return [...saved, ...SEED_REVIEWS].sort(sortNewest);
}

export function getDealReviewCounts() {
  const counts = {
    deals: new Map(),
    products: new Map(),
  };
  readLocalReviews().forEach((review) => {
    if (review.dealId) {
      counts.deals.set(
        review.dealId,
        (counts.deals.get(review.dealId) || 0) + 1,
      );
    }
    if (review.productKey) {
      counts.products.set(
        review.productKey,
        (counts.products.get(review.productKey) || 0) + 1,
      );
    }
  });
  return counts;
}

export function saveReview(review) {
  const saved = readLocalReviews();
  const next = [review, ...saved].slice(0, 100);
  localStorage.setItem(REVIEWS_KEY, JSON.stringify(next));
  return review;
}

export function buildReviewFromForm(form, user = {}) {
  const data = new FormData(form);
  const name = cleanValue(user.username || "").slice(0, 40);
  const province = sanitizeProvince(data.get("province"), ALLOWED_PROVINCES);
  const type = sanitizeType(data.get("type"));
  const rating = sanitizeRating(data.get("rating"));
  const retailer = sanitizeOptionalText(data.get("retailer"), 42);
  const comment = sanitizeComment(data.get("comment"));
  const dealId = cleanValue(data.get("dealId")).slice(0, 500);
  const productKey = sanitizeProductKey(data.get("productKey"));
  const dealTitle = sanitizeOptionalText(data.get("dealTitle"), 140);
  const consent = data.get("consent") === "on";

  const errors = [];
  if (!name || name.length < 2)
    errors.push("Login with a username before posting.");
  if (!province) errors.push("Choose one of the 9 South African provinces.");
  if (!type) errors.push("Choose what kind of review this is.");
  if (!rating) errors.push("Choose a rating.");
  if (comment.length < 12)
    errors.push("Write a little more so the feedback is useful.");
  if (!consent) errors.push("Confirm that LekkeDeal may store this review.");

  if (errors.length) return { errors };

  return {
    review: {
      id: createReviewId(),
      name,
      province,
      type,
      rating,
      retailer,
      comment,
      dealId,
      productKey,
      dealTitle,
      createdAt: new Date().toISOString(),
      source: "web",
    },
    errors: [],
  };
}

function readLocalReviews() {
  try {
    const parsed = JSON.parse(localStorage.getItem(REVIEWS_KEY) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeStoredReview).filter(Boolean).sort(sortNewest);
  } catch (error) {
    console.warn("Reviews failed to load", error);
    return [];
  }
}

function normalizeStoredReview(review) {
  if (!review || typeof review !== "object") return null;
  const name = cleanValue(review.name).slice(0, 40);
  const province = sanitizeProvince(review.province, ALLOWED_PROVINCES);
  const type = sanitizeType(review.type);
  const rating = sanitizeRating(review.rating);
  const comment = sanitizeComment(review.comment);
  if (!name || !province || !type || !rating || !comment) return null;
  return {
    id: cleanValue(review.id) || createReviewId(),
    name,
    province,
    type,
    rating,
    retailer: sanitizeOptionalText(review.retailer, 42),
    comment,
    dealId: cleanValue(review.dealId).slice(0, 500),
    productKey: sanitizeProductKey(review.productKey),
    dealTitle: sanitizeOptionalText(review.dealTitle, 140),
    createdAt: safeDate(review.createdAt),
    source: cleanValue(review.source) || "web",
  };
}

function sanitizeType(value) {
  const type = cleanValue(value);
  return REVIEW_TYPES.some((item) => item.value === type) ? type : "";
}

function sanitizeRating(value) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
}

function sanitizeComment(value) {
  return cleanValue(value)
    .replace(/[<>`{}[\]\\]/g, "")
    .slice(0, MAX_COMMENT_LENGTH);
}

function sanitizeOptionalText(value, maxLength) {
  return titleCase(
    cleanValue(value)
      .replace(/[<>`{}[\]\\]/g, "")
      .slice(0, maxLength),
  );
}

function sanitizeProductKey(value) {
  return cleanValue(value)
    .replace(/[^a-z0-9 ]/gi, "")
    .slice(0, 160);
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
}

function sortNewest(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function createReviewId() {
  return `review-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}
