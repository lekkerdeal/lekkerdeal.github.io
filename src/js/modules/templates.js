import { formatDate, formatPrice } from "./deal-normalization.js";
import { noImagePlaceholderTemplate, usableImageUrl } from "./image-handling.js";
import { safeHttpUrl } from "./text-sanitization.js";
import { escapeAttr, escapeHtml, formatNumber } from "./interface-formatting.js";

export function icon(name) {
  return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-${escapeAttr(name)}"></use></svg>`;
}

export function dealCardTemplate(
  deal,
  index,
  isSaved,
  stockLabel,
  reviewCount = 0,
) {
  const discount =
    deal.discount_percent > 0 ? `${deal.discount_percent}% OFF` : "Deal";
  const oldPrice = deal.old_price
    ? `<span class="old-price">Was ${formatPrice(deal.old_price)}</span>`
    : "";
  const saving = deal.discount_amount
    ? `<span class="saving">Save ${formatPrice(deal.discount_amount)}</span>`
    : "";
  const model = [deal.brand, deal.model].filter(Boolean).join(" | ");
  const stockClass =
    deal.stock_status === "out_of_stock" ? "out-of-stock" : "in-stock";
  const linkClass = deal.product_url ? "deal-link" : "deal-link is-disabled";
  const directUrl = safeHttpUrl(deal.product_url);
  const linkAttrs = directUrl
    ? `href="${escapeAttr(directUrl)}" target="_blank" rel="noopener noreferrer" data-view-deal="${escapeAttr(deal._dealId)}"`
    : `href="#" aria-disabled="true"`;
  const imageUrl = usableImageUrl(deal.image_url);
  const reviewUrl = buildReviewUrl(deal);
  const seeReviews =
    reviewCount > 0
      ? `<a class="see-reviews-link" href="${escapeAttr(reviewUrl)}#reviewList">${icon("star")} Product reviews (${formatNumber(reviewCount)})</a>`
      : "";

  return `
        <article class="deal-card ${imageUrl ? "" : "has-no-image"}" data-image-url="${escapeAttr(imageUrl || "")}" data-deal-id="${escapeAttr(deal._dealId)}">
            <figure class="image-wrap">
                <span class="discount-badge">${escapeHtml(discount)}</span>
                ${imageTemplate(deal, index)}
            </figure>
            <section class="deal-content">
                <header class="deal-meta-row">
                    <span class="retailer-badge">${escapeHtml(deal.retailer)}</span>
                    <span class="category-badge">${escapeHtml(deal.category || "Other")}</span>
                </header>
                <h3 class="deal-title">${escapeHtml(deal.title)}</h3>
                <p class="deal-model">${escapeHtml(model || deal.site_key || "")}</p>
                <p class="price-stack">
                    <span class="current-price">${formatPrice(deal.current_price)}</span>
                    ${oldPrice}
                    ${saving}
                </p>
                <footer class="deal-footer-row">
                    <span class="stock ${stockClass}">${icon(deal.stock_status === "in_stock" ? "check" : "box")}${escapeHtml(stockLabel)}</span>
                    <span class="date-chip">${icon("calendar")}${escapeHtml(formatDate(deal.scraped_at))}</span>
                </footer>
                ${seeReviews}
                <nav class="deal-actions" aria-label="Deal actions">
                    <a class="${linkClass}" ${linkAttrs}>View Deal ${icon("external")}</a>
                    <a class="review-action-button" href="${escapeAttr(reviewUrl)}#reviewForm" aria-label="Add a review for ${escapeAttr(deal.title)}" title="Add review">${icon("star")}</a>
                    <button class="share-button" type="button" data-share-id="${escapeAttr(deal._dealId)}" aria-label="Share ${escapeAttr(deal.title)}" title="Share">${icon("share")}</button>
                    <button class="share-button report-deal-button" type="button" data-report-deal-id="${escapeAttr(deal._dealId)}" aria-label="Report ${escapeAttr(deal.title)}" title="Report deal">${icon("alert")}</button>
                    <button class="save-button inline-save ${isSaved ? "is-saved" : ""}" type="button" data-save-id="${escapeAttr(deal._dealId)}" aria-label="${isSaved ? "Unsave" : "Save"} ${escapeAttr(deal.title)}">
                        ${icon(isSaved ? "heart" : "heart-outline")}
                    </button>
                </nav>
            </section>
        </article>
    `;
}

function buildReviewUrl(deal) {
  const params = new URLSearchParams();
  params.set("deal", deal._dealId);
  params.set("product", deal._productKey || "");
  params.set("title", deal.title);
  params.set("retailer", deal.retailer);
  return `reviews.html?${params.toString()}`;
}

export function imageTemplate(deal, index = 0) {
  const imageUrl = usableImageUrl(deal.image_url);
  if (!imageUrl) return noImagePlaceholderTemplate();

  const priority = index < 12 ? "high" : "auto";
  const loading = index < 12 ? "eager" : "lazy";
  return `
        <button class="image-zoom-button" type="button" data-image-zoom-id="${escapeAttr(deal._dealId)}" aria-label="Open full product image for ${escapeAttr(deal.title)}">
            <img class="product-image" src="${escapeAttr(imageUrl)}" alt="${escapeAttr(deal.title)}" loading="${loading}" decoding="async" fetchpriority="${priority}" referrerpolicy="no-referrer" draggable="false">
            <span class="zoom-hint">Tap to zoom</span>
        </button>
    `;
}

export function priceCheckTemplate(group) {
  const best = group.best;
  const spread =
    group.spread > 0 ? formatPrice(group.spread) : "Single listed offer";
  const directUrl = safeHttpUrl(best.product_url);
  const link = directUrl
    ? `<a class="mini-link" href="${escapeAttr(directUrl)}" target="_blank" rel="noopener noreferrer" data-view-deal="${escapeAttr(best._dealId)}">View best deal</a>`
    : "";

  return `
        <article class="price-check-item">
            <h3>${escapeHtml(group.title)}</h3>
            <strong>${formatPrice(best.current_price)} at ${escapeHtml(best.retailer)}</strong>
            <span>${group.count} retailer offer${group.count === 1 ? "" : "s"}</span>
            <small>Price spread: ${escapeHtml(spread)}</small>
            ${link}
        </article>
    `;
}

export function breakdownTemplate(label, count, type) {
  const dataAttr = type === "retailer" ? "data-retailer" : "data-category";
  return `
        <article class="breakdown-item">
            <button type="button" ${dataAttr}="${escapeAttr(label)}">${escapeHtml(label)}</button>
            <span>${formatNumber(count)}</span>
        </article>
    `;
}
