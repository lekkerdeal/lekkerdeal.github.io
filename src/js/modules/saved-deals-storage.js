import {
  LEGACY_SAVED_KEY,
  SAVED_KEY,
  SAVED_PRODUCT_KEYS_KEY,
} from "./application-config.js";

export function loadSavedDeals() {
  try {
    const savedRaw =
      localStorage.getItem(SAVED_KEY) ||
      localStorage.getItem(LEGACY_SAVED_KEY) ||
      "[]";
    const rawSaved = JSON.parse(savedRaw);
    return new Set(Array.isArray(rawSaved) ? rawSaved : []);
  } catch (error) {
    console.warn("Saved deals could not be loaded", error);
    return new Set();
  }
}

export function persistSavedDeals(savedDeals) {
  localStorage.setItem(SAVED_KEY, JSON.stringify([...savedDeals]));
}

export function loadSavedProductKeys() {
  try {
    const rawSaved = JSON.parse(
      localStorage.getItem(SAVED_PRODUCT_KEYS_KEY) || "[]",
    );
    return new Set(Array.isArray(rawSaved) ? rawSaved : []);
  } catch (error) {
    console.warn("Saved product keys could not be loaded", error);
    return new Set();
  }
}

export function persistSavedProductKeys(savedProductKeys) {
  localStorage.setItem(
    SAVED_PRODUCT_KEYS_KEY,
    JSON.stringify([...savedProductKeys]),
  );
}

export function toggleSavedDeal(savedDeals, dealId) {
  if (savedDeals.has(dealId)) {
    savedDeals.delete(dealId);
  } else {
    savedDeals.add(dealId);
  }
  persistSavedDeals(savedDeals);
}
