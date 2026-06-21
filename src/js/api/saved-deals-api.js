import { apiRequest, jsonBody } from "./client.js";

export async function fetchSavedDeals() {
  const data = await apiRequest("/saved-deals");
  return data.savedDeals || [];
}

export async function saveDealToAccount(deal) {
  return apiRequest("/saved-deals", {
    method: "POST",
    body: jsonBody({ snapshot: dealToSnapshot(deal) }),
  });
}

export async function deleteSavedDealFromAccount(dealId, productKey = "") {
  const params = new URLSearchParams();
  if (productKey) params.set("productKey", productKey);
  const query = params.toString();
  return apiRequest(`/saved-deals/${encodeURIComponent(dealId)}${query ? `?${query}` : ""}`, {
    method: "DELETE",
  });
}

function dealToSnapshot(deal) {
  return {
    dealId: deal._dealId,
    productKey: deal._productKey,
    title: deal.title,
    retailer: deal.retailer,
    category: deal.category,
    productUrl: deal.product_url,
    imageUrl: deal.image_url,
    currentPrice: deal.current_price,
    oldPrice: deal.old_price,
    discountPercent: deal.discount_percent,
    scrapedAt: deal.scraped_at,
  };
}
