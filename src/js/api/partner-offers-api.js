import { apiRequest, jsonBody } from "./client.js";

export function submitVehicleTrackerQuote(payload) {
  return apiRequest("/affiliates/vehicle-tracker/leads", { method: "POST", body: jsonBody(payload) });
}
