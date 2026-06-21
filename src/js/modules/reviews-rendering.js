import { getReviewTypes } from "./reviews-storage.js";
import { escapeAttr, escapeHtml, formatNumber } from "./interface-formatting.js";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "product-review", label: "Products" },
  { value: "deal-win", label: "Wins" },
  { value: "retailer-request", label: "Requests" },
  { value: "price-issue", label: "Price issues" },
  { value: "alert-feedback", label: "Alerts" },
];

export function renderReviewPage(reviews, state, elements) {
  renderStats(reviews, elements);
  renderTabs(state.filter, elements.tabs);
  renderList(filterReviews(reviews, state.filter), elements.list, state);
}

export function renderTypeOptions(select) {
  if (!select) return;
  select.innerHTML = [
    `<option value="">Choose review type</option>`,
    ...getReviewTypes().map(
      (type) =>
        `<option value="${escapeAttr(type.value)}">${escapeHtml(type.label)}</option>`,
    ),
  ].join("");
}

function renderStats(reviews, elements) {
  const localReviews = reviews.filter((review) => review.source !== "seed");
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;
  const topProvince =
    topValue(reviews.map((review) => review.province)) || "South Africa";
  const topType =
    labelForType(topValue(reviews.map((review) => review.type))) || "Deal wins";

  elements.total.textContent = formatNumber(reviews.length);
  elements.average.textContent = average ? `${average.toFixed(1)}/5` : "0/5";
  elements.province.textContent = topProvince;
  elements.saved.textContent = formatNumber(localReviews.length);
  elements.type.textContent = topType;
}

function renderTabs(activeFilter, container) {
  container.innerHTML = FILTERS.map(
    (filter) => `
        <button class="review-tab${filter.value === activeFilter ? " is-active" : ""}" type="button" data-filter="${escapeAttr(filter.value)}">
            ${escapeHtml(filter.label)}
        </button>
    `,
  ).join("");
}

function renderList(reviews, container, state = {}) {
  if (!reviews.length) {
    container.innerHTML = `<p class="review-empty">No reviews in this view yet. Add the first one and help shape the next LekkerDeal feature.</p>`;
    return;
  }

  container.innerHTML = reviews
    .map(
      (review) => `
        <article class="review-card" data-review-id="${escapeAttr(review.id)}">
            <header class="review-card-top">
                <address class="review-author">
                    <strong>${escapeHtml(review.name)}</strong>
                    <span>${escapeHtml(review.province)} | ${formatReviewDate(review.createdAt)}</span>
                </address>
                <span class="review-score">${review.rating}/5</span>
            </header>
            <p class="review-comment">${escapeHtml(review.comment)}</p>
            <div class="review-actions-row">
                <button type="button" data-review-action="like">Like ${formatNumber(review.likes || 0)}</button>
                <button type="button" data-review-action="dislike">Dislike ${formatNumber(review.dislikes || 0)}</button>
                ${isOwnReview(review, state.user) ? `
                    <button type="button" data-review-action="edit">Edit</button>
                    <button type="button" data-review-action="delete">Delete</button>
                ` : ""}
            </div>
            ${renderReplies(review, state.user)}
            <form class="review-reply-form" data-review-reply-form>
                <input name="reply" type="text" maxlength="280" placeholder="Reply to this review" />
                <button type="submit">Reply</button>
            </form>
            <footer class="review-tags">
                <span>${escapeHtml(labelForType(review.type))}</span>
                ${review.retailer ? `<span>${escapeHtml(review.retailer)}</span>` : ""}
                <span>${escapeHtml(sourceLabel(review.source))}</span>
            </footer>
        </article>
    `,
    )
    .join("");
}

function filterReviews(reviews, filter) {
  if (filter === "all") return reviews;
  return reviews.filter((review) => review.type === filter);
}

function renderReplies(review, user) {
  const replies = Array.isArray(review.replies) ? review.replies : [];
  if (!replies.length) return `<div class="review-replies" hidden></div>`;
  return `
    <div class="review-replies">
      ${replies
        .map(
          (reply) => `
            <article class="review-reply" data-reply-id="${escapeAttr(reply.id || reply._id || "")}">
              <strong>${escapeHtml(reply.authorName || "LekkerDeal shopper")}</strong>
              <p>${escapeHtml(reply.body || "")}</p>
              <nav class="review-reply-actions" aria-label="Reply actions">
                <button type="button" data-reply-action="like">Like ${formatNumber(reply.likes || 0)}</button>
                <button type="button" data-reply-action="dislike">Dislike ${formatNumber(reply.dislikes || 0)}</button>
                ${isOwnReply(reply, user) ? `
                  <button type="button" data-reply-action="edit">Edit</button>
                  <button type="button" data-reply-action="delete">Delete</button>
                ` : ""}
              </nav>
            </article>
          `,
        )
        .join("")}
    </div>
  `;
}

function isOwnReview(review, user) {
  const userId = user?.id || user?._id;
  return Boolean(userId && review.userId && String(userId) === String(review.userId));
}

function isOwnReply(reply, user) {
  const userId = user?.id || user?._id;
  return Boolean(userId && reply.userId && String(userId) === String(reply.userId));
}

function sourceLabel(source) {
  if (source === "seed") return "Example";
  if (source === "api") return "Public review";
  return "Saved on this device";
}

function topValue(values) {
  const counts = new Map();
  values
    .filter(Boolean)
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function labelForType(value) {
  return getReviewTypes().find((type) => type.value === value)?.label || "";
}

function formatReviewDate(value) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
