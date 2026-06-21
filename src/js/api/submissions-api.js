import { apiRequest, jsonBody } from "./client.js";

export async function createDealReport(payload) {
  const data = await apiRequest("/submissions/deal-reports", {
    method: "POST",
    body: jsonBody(payload),
  });
  return data.report;
}

export async function createContactMessage(payload) {
  const data = await apiRequest("/submissions/contact-messages", {
    method: "POST",
    body: jsonBody(payload),
  });
  return data.contactMessage;
}

export async function createRetailerCollaborationRequest(payload) {
  const data = await apiRequest("/submissions/retailer-collaboration-requests", {
    method: "POST",
    body: jsonBody(payload),
  });
  return data.request;
}
