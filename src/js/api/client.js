const TOKEN_KEY = "lekkedeal_auth_token";

export function getApiBaseUrl() {
  return window.LEKKEDEAL_CONFIG?.API_BASE_URL || "http://127.0.0.1:4100/api";
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function isAuthenticated() {
  return Boolean(getAuthToken());
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (options.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    const apiError = new Error(
      "LekkeDeal API is offline. Start the backend server and try again.",
    );
    apiError.status = 0;
    apiError.code = "API_OFFLINE";
    apiError.cause = error;
    throw apiError;
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.ok === false) {
    const error = new Error(
      payload.error?.message || `API request failed with ${response.status}`,
    );
    error.status = response.status;
    error.code = payload.error?.code || "API_ERROR";
    error.field = payload.error?.field || "";
    error.details = payload.error?.details || null;
    throw error;
  }

  return payload.data || payload;
}

export function jsonBody(payload) {
  return JSON.stringify(payload || {});
}
