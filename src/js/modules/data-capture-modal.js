import {
  ALLOWED_PROVINCES,
  CAPTURE_DELAY_MS,
  CAPTURE_DISMISSED_KEY,
  CAPTURE_KEY,
  VIEW_CLICK_KEY,
} from "./application-config.js";
import {
  isValidCity,
  isValidName,
  isValidPhone,
  sanitizeCity,
  sanitizeName,
  sanitizePhone,
  sanitizeProvince,
  titleCase,
  titleCaseSingleWord,
} from "./text-sanitization.js";

export function bindCaptureInputSanitizers(els) {
  els.nameInput?.addEventListener("input", () => {
    els.nameInput.value = sanitizeName(els.nameInput.value);
  });
  els.nameInput?.addEventListener("blur", () => {
    els.nameInput.value = titleCaseSingleWord(
      sanitizeName(els.nameInput.value),
    );
  });
  els.whatsappPhone?.addEventListener("input", () => {
    els.whatsappPhone.value = sanitizePhone(els.whatsappPhone.value);
  });
  els.cityInput?.addEventListener("input", () => {
    els.cityInput.value = sanitizeCity(els.cityInput.value);
  });
  els.cityInput?.addEventListener("blur", () => {
    els.cityInput.value = titleCase(sanitizeCity(els.cityInput.value));
  });
}

export function loadCaptureState(state, els) {
  state.viewDealClicks = Number(localStorage.getItem(VIEW_CLICK_KEY)) || 0;
  if (!hasCapturedUserData()) {
    window.setTimeout(() => showDataCaptureModal(els), CAPTURE_DELAY_MS);
  }
}

export function hasCapturedUserData() {
  try {
    const data = JSON.parse(localStorage.getItem(CAPTURE_KEY) || "null");
    return Boolean(
      data?.alertConsentFromAccount ||
        (data?.name &&
          data?.whatsappPhone &&
          data?.provinceCity &&
          data?.city &&
          data?.popiaConsent),
    );
  } catch (error) {
    return false;
  }
}

export function markAlertConsentCapturedFromAccount(user = {}) {
  localStorage.setItem(
    CAPTURE_KEY,
    JSON.stringify({
      name: user.displayName || user.username || "Account",
      whatsappPhone: user.phoneNumber || "",
      provinceCity: user.province || "",
      city: user.city || "",
      popiaConsent: Boolean(user.popiaConsentAt) || true,
      alertConsentFromAccount: true,
      capturedAt: new Date().toISOString(),
    }),
  );
  sessionStorage.removeItem(CAPTURE_DISMISSED_KEY);
}

export function showDataCaptureModal(els) {
  if (
    !els.dataCaptureModal ||
    hasCapturedUserData() ||
    hasDismissedCaptureThisSession()
  )
    return false;
  openDialogElement(els.dataCaptureModal);
  window.setTimeout(() => els.nameInput?.focus(), 50);
  return true;
}

export function dismissDataCaptureModal(els) {
  if (!els.dataCaptureModal) return;
  sessionStorage.setItem(CAPTURE_DISMISSED_KEY, "true");
  closeDialogElement(els.dataCaptureModal);
}

export function hasDismissedCaptureThisSession() {
  return sessionStorage.getItem(CAPTURE_DISMISSED_KEY) === "true";
}

export function handleDataCaptureSubmit(event, els) {
  event.preventDefault();
  if (!els.dataCaptureForm.reportValidity()) return;

  const name = titleCaseSingleWord(sanitizeName(els.nameInput.value));
  const whatsappPhone = sanitizePhone(els.whatsappPhone.value);
  const provinceCity = sanitizeProvince(
    els.provinceCity.value,
    ALLOWED_PROVINCES,
  );
  const city = titleCase(sanitizeCity(els.cityInput.value));

  if (!isValidName(name)) {
    reportFieldError(
      els.nameInput,
      "Enter your first name using letters only, no spaces.",
    );
    return;
  }

  if (!isValidPhone(whatsappPhone)) {
    reportFieldError(
      els.whatsappPhone,
      "Enter a 10 digit WhatsApp number starting with 0.",
    );
    return;
  }

  if (!provinceCity) {
    reportFieldError(els.provinceCity, "Choose a province.");
    return;
  }

  if (!isValidCity(city)) {
    reportFieldError(
      els.cityInput,
      "Enter your city using letters and spaces only.",
    );
    return;
  }

  els.nameInput.value = name;
  els.whatsappPhone.value = whatsappPhone;
  els.provinceCity.value = provinceCity;
  els.cityInput.value = city;

  localStorage.setItem(
    CAPTURE_KEY,
    JSON.stringify({
      name,
      whatsappPhone,
      provinceCity,
      city,
      popiaConsent: Boolean(els.popiaConsent.checked),
      capturedAt: new Date().toISOString(),
    }),
  );
  closeDialogElement(els.dataCaptureModal);
}

export function handleViewDealClick(event, state, els) {
  if (hasCapturedUserData()) return;

  state.viewDealClicks += 1;
  localStorage.setItem(VIEW_CLICK_KEY, String(state.viewDealClicks));

  if (state.viewDealClicks >= 3) {
    const didShowModal = showDataCaptureModal(els);
    if (didShowModal) event.preventDefault();
  }
}

function reportFieldError(field, message) {
  field.setCustomValidity(message);
  field.reportValidity();
  field.setCustomValidity("");
}

function openDialogElement(dialog) {
  dialog.hidden = false;
  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
  }
}

function closeDialogElement(dialog) {
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  }
  dialog.hidden = true;
}
