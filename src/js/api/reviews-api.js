import { apiRequest, jsonBody } from "./client.js";

export async function fetchReviews(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "")
      query.set(key, value);
  });
  const data = await apiRequest(
    `/reviews${query.toString() ? `?${query}` : ""}`,
  );
  return data.reviews || [];
}

export async function createReview(review) {
  const data = await apiRequest("/reviews", {
    method: "POST",
    body: jsonBody(toApiReview(review)),
  });
  return data.review;
}

export async function fetchReviewCounts({ dealIds = [], productKeys = [] } = {}) {
  const data = await apiRequest("/reviews/counts", {
    method: "POST",
    body: jsonBody({ dealIds, productKeys }),
  });
  return {
    deals: data.deals || [],
    products: data.products || [],
  };
}

export async function updateReview(reviewId, review) {
  const data = await apiRequest(`/reviews/${encodeURIComponent(reviewId)}`, {
    method: "PATCH",
    body: jsonBody(toApiReview(review)),
  });
  return data.review;
}

export async function deleteReview(reviewId) {
  return apiRequest(`/reviews/${encodeURIComponent(reviewId)}`, {
    method: "DELETE",
  });
}

export async function reactToReview(reviewId, reaction) {
  const data = await apiRequest(
    `/reviews/${encodeURIComponent(reviewId)}/reactions`,
    {
      method: "POST",
      body: jsonBody({ reaction }),
    },
  );
  return data.review;
}

export async function createReviewReply(reviewId, body) {
  const data = await apiRequest("/comments", {
    method: "POST",
    body: jsonBody({
      targetType: "review",
      targetId: reviewId,
      body,
      visibility: "public",
    }),
  });
  return data.comment;
}

export async function updateReviewReply(commentId, body) {
  const data = await apiRequest(`/comments/${encodeURIComponent(commentId)}`, {
    method: "PATCH",
    body: jsonBody({ body }),
  });
  return data.comment;
}

export async function deleteReviewReply(commentId) {
  return apiRequest(`/comments/${encodeURIComponent(commentId)}`, {
    method: "DELETE",
  });
}

export async function reactToReviewReply(commentId, reaction) {
  const data = await apiRequest(
    `/comments/${encodeURIComponent(commentId)}/reactions`,
    {
      method: "POST",
      body: jsonBody({ reaction }),
    },
  );
  return data.comment;
}

function toApiReview(review) {
  return {
    dealId: review.dealId,
    productKey: review.productKey,
    dealTitle: review.dealTitle,
    retailer: review.retailer,
    reviewType: review.type,
    rating: review.rating,
    comment: review.comment,
    visibility: "public",
  };
}
