import { apiRequest, jsonBody, setAuthToken } from "./client.js";

export async function requestRegistrationOtp(phoneNumber) {
  return apiRequest("/auth/register/request-otp", {
    method: "POST",
    body: jsonBody({ phoneNumber }),
  });
}

export async function registerAccount(payload) {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: jsonBody(payload),
  });
  setAuthToken(data.token);
  return data.user;
}

export async function loginAccount(payload) {
  const data = await apiRequest("/auth/login", {
    method: "POST",
    body: jsonBody(payload),
  });
  setAuthToken(data.token);
  return data.user;
}

export async function requestPasswordResetOtp(phoneNumber) {
  return apiRequest("/auth/password/request-reset-otp", {
    method: "POST",
    body: jsonBody({ phoneNumber }),
  });
}

export async function verifyPasswordResetOtp(payload) {
  return apiRequest("/auth/password/verify-reset-otp", {
    method: "POST",
    body: jsonBody(payload),
  });
}

export async function resetPassword(payload) {
  const data = await apiRequest("/auth/password/reset", {
    method: "POST",
    body: jsonBody(payload),
  });
  return data.user;
}

export async function fetchMe() {
  const data = await apiRequest("/auth/me");
  return data.user;
}

export async function updateCurrentUser(payload) {
  const data = await apiRequest("/auth/me", {
    method: "PATCH",
    body: jsonBody(payload),
  });
  return data.user;
}

export async function deleteCurrentUserWithPassword(password) {
  await apiRequest("/auth/account/password", {
    method: "DELETE",
    body: jsonBody({ password }),
  });
}

export function logoutAccount() {
  setAuthToken("");
}
