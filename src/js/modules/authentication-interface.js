import {
  deleteCurrentUserWithPassword,
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestPasswordResetOtp,
  requestRegistrationOtp,
  resetPassword,
  updateCurrentUser,
  verifyPasswordResetOtp,
} from "../api/authentication-api.js";
import { getAuthToken } from "../api/client.js";
import { ALLOWED_PROVINCES } from "./application-config.js";
import {
  cleanValue,
  sanitizeCity,
  sanitizePhone,
  titleCase,
} from "./text-sanitization.js";
import { markAlertConsentCapturedFromAccount } from "./data-capture-modal.js";

const authState = {
  user: null,
  listeners: new Set(),
};
const OTP_COOLDOWN_MS = 5 * 60 * 1000;
const OTP_COOLDOWN_STORAGE_PREFIX = "lekkerdeal_otp_cooldown_until_";
const otpCooldownTimers = new Map();
const REGISTER_LOCK_KEY = "lekkerdeal_register_lock_until";
const REGISTER_ATTEMPTS_KEY = "lekkerdeal_register_failed_otp_attempts";
const REGISTER_LOCK_MS = 24 * 60 * 60 * 1000;
const PROVINCE_OPTIONS = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
].filter((province) => ALLOWED_PROVINCES.has(province));
let pendingRegisterPayload = null;
let hasPendingRegistrationOtp = false;

export async function initAuthUi({ mountButton } = {}) {
  injectAuthModal();
  bindAuthEvents();
  if (mountButton) mountAccountButton(mountButton);
  await hydrateUser();
  updateAuthUi();
  return authState.user;
}

export function getCurrentUser() {
  return authState.user;
}

export function onAuthChange(listener) {
  authState.listeners.add(listener);
  return () => authState.listeners.delete(listener);
}

export function openAuthModal(mode = "login") {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  setAuthMode(mode);
  openDialogElement(modal);
}

export function logoutCurrentUser() {
  logoutAccount();
  authState.user = null;
  updateAuthUi();
  notifyAuthChange();
}

async function hydrateUser() {
  if (!getAuthToken()) return;
  try {
    authState.user = await fetchMe();
    syncAlertConsentCapture(authState.user);
  } catch (error) {
    console.warn("Could not restore session", error);
    logoutAccount();
    authState.user = null;
  }
}

function mountAccountButton(target) {
  const button = document.createElement("button");
  button.className = "account-button";
  button.id = "accountButton";
  button.type = "button";
  button.innerHTML = profileIconMarkup();
  button.addEventListener("click", () => {
    if (authState.user) {
      showAuthStatus(
        `Signed in as ${authState.user.displayName || authState.user.username}.`,
      );
      openAuthModal("account");
      return;
    }
    openAuthModal("login");
  });
  target.append(button);
}

function injectAuthModal() {
  if (document.getElementById("authModal")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
        <dialog class="auth-modal" id="authModal" hidden aria-labelledby="authTitle">
            <article class="auth-card">
                <button class="auth-close" id="authClose" type="button" aria-label="Close account modal">&times;</button>
                <img class="auth-logo" src="assets/logo.png" alt="LekkerDeal">
                <h2 id="authTitle">Account</h2>
                <p class="auth-copy">Save deals, post reviews, and manage alerts with your phone number and password.</p>
                <nav class="auth-tabs" aria-label="Account form options">
                    <button type="button" data-auth-mode="login">Login</button>
                    <button type="button" data-auth-mode="register">Register</button>
                    <button type="button" data-auth-mode="reset">Reset</button>
                </nav>
                <form class="auth-form" id="authLoginForm" data-auth-panel="login">
                    <label class="auth-floating-field">
                        <input name="phoneNumber" inputmode="numeric" autocomplete="tel" placeholder=" " maxlength="10" pattern="0[0-9]{9}" required>
                        <span>Phone number</span>
                    </label>
                    <label class="auth-floating-field">
                        <input name="password" type="password" autocomplete="current-password" placeholder=" " minlength="1" maxlength="128" required>
                        <span>Password</span>
                    </label>
                    <button type="submit">Login</button>
                </form>
                <form class="auth-form" id="authRegisterDetailsForm" data-auth-panel="register" data-register-step="details">
                    <label class="auth-floating-field">
                        <input name="phoneNumber" inputmode="numeric" autocomplete="tel" placeholder=" " maxlength="10" pattern="0[0-9]{9}" required>
                        <span>Phone number</span>
                    </label>
                    <label class="auth-floating-field">
                        <input name="username" autocomplete="username" placeholder=" " minlength="3" maxlength="32" pattern="[A-Za-z0-9_]{3,32}" required>
                        <span>Username</span>
                    </label>
                    <label class="auth-floating-field">
                        <input name="password" type="password" autocomplete="new-password" placeholder=" " minlength="8" maxlength="128" required>
                        <span>Password</span>
                    </label>
                    <label class="auth-floating-field">
                        <input name="confirmPassword" type="password" autocomplete="new-password" placeholder=" " minlength="8" maxlength="128" required>
                        <span>Confirm password</span>
                    </label>
                    <label class="auth-floating-field">
                        <select name="province" required>
                            <option value=""></option>
                            ${provinceOptionsTemplate()}
                        </select>
                        <span>Province</span>
                    </label>
                    <label class="auth-floating-field">
                        <input name="city" placeholder=" " maxlength="60" pattern="[A-Za-z ]{2,60}" required>
                        <span>City</span>
                    </label>
                    <label class="auth-check"><input name="marketingConsent" type="checkbox"> Send me WhatsApp/SMS deal alerts</label>
                    <button class="otp-submit-button" type="submit" data-otp-purpose="registration" data-default-label="Create account">Create account</button>
                    <button class="auth-secondary-button" type="button" id="authRegisterEnterOtp" hidden>Enter OTP</button>
                </form>
                <form class="auth-form" id="authRegisterOtpForm" data-auth-panel="register" data-register-step="otp" hidden>
                    <p class="auth-step-copy">Enter the OTP we sent to finish creating your account.</p>
                    <label class="auth-floating-field">
                        <input name="code" inputmode="numeric" autocomplete="one-time-code" placeholder=" " maxlength="6" pattern="[0-9]{4,6}" required>
                        <span>OTP code</span>
                    </label>
                    <button type="submit">Verify and create</button>
                    <button class="auth-secondary-button" type="button" id="authRegisterBack">Edit details</button>
                </form>
                <form class="auth-form" id="authResetOtpForm" data-auth-panel="reset" data-reset-step="request">
                    <label class="auth-floating-field">
                        <input name="phoneNumber" inputmode="numeric" autocomplete="tel" placeholder=" " maxlength="10" pattern="0[0-9]{9}" required>
                        <span>Phone number</span>
                    </label>
                    <button class="otp-submit-button" type="submit" data-otp-purpose="reset" data-default-label="Send reset OTP">Send reset OTP</button>
                </form>
                <form class="auth-form" id="authResetVerifyForm" data-auth-panel="reset" data-reset-step="verify" hidden>
                    <label class="auth-floating-field">
                        <input name="code" inputmode="numeric" placeholder=" " maxlength="6" pattern="[0-9]{4,6}" required>
                        <span>OTP code</span>
                    </label>
                    <button type="submit">Verify OTP</button>
                </form>
                <form class="auth-form" id="authResetPasswordForm" data-auth-panel="reset" data-reset-step="password" hidden>
                    <label class="auth-floating-field">
                        <input name="password" type="password" autocomplete="new-password" placeholder=" " minlength="8" maxlength="128" required>
                        <span>New password</span>
                    </label>
                    <label class="auth-floating-field">
                        <input name="confirmPassword" type="password" autocomplete="new-password" placeholder=" " minlength="8" maxlength="128" required>
                        <span>Confirm new password</span>
                    </label>
                    <button type="submit">Reset password</button>
                </form>
                <section class="auth-form" data-auth-panel="account">
                    <header class="account-profile-head">
                        <span class="account-avatar" aria-hidden="true">${profileIconMarkup()}</span>
                        <span>
                            <strong id="authAccountName">Account</strong>
                            <small id="authAccountSummary">Not logged in.</small>
                        </span>
                    </header>
                    <nav class="profile-action-grid" aria-label="Profile actions">
                        <button type="button" data-profile-action="personalDeals">Personal deals</button>
                        <button type="button" data-profile-action="reviews">Reviews</button>
                        <button type="button" data-profile-action="savedDeals">Saved deals</button>
                        <button type="button" data-profile-action="resetPassword">Reset password</button>
                    </nav>
                    <form class="account-details-form" id="authAccountDetailsForm">
                        <label class="auth-floating-field">
                            <input name="username" autocomplete="username" placeholder=" " minlength="3" maxlength="32" pattern="[A-Za-z0-9_]{3,32}" required>
                            <span>Username</span>
                        </label>
                        <label class="auth-floating-field">
                            <select name="province" required>
                                <option value=""></option>
                                ${provinceOptionsTemplate()}
                            </select>
                            <span>Province</span>
                        </label>
                        <label class="auth-floating-field">
                            <input name="city" placeholder=" " maxlength="60" pattern="[A-Za-z ]{2,60}" required>
                            <span>City</span>
                        </label>
                        <label class="auth-check"><input name="marketingConsent" type="checkbox"> Send me WhatsApp/SMS deal alerts</label>
                        <span class="account-inline-actions">
                            <button type="submit">Update details</button>
                            <button class="danger-link-button" id="authDeleteStart" type="button">Delete account</button>
                        </span>
                    </form>
                    <section class="account-danger-zone" aria-label="Delete account">
                        <section class="delete-confirm-row" id="authDeleteConfirmRow" hidden>
                            <p>Are you sure?</p>
                            <button class="danger-confirm-button" id="authDeleteYes" type="button">Yes</button>
                            <button class="auth-secondary-button" id="authDeleteNo" type="button">No</button>
                        </section>
                        <form class="auth-form delete-password-form" id="authDeletePasswordForm" hidden>
                            <label class="auth-floating-field">
                                <input name="password" type="password" autocomplete="current-password" placeholder=" " minlength="1" maxlength="128" required>
                                <span>Password</span>
                            </label>
                            <button class="danger-confirm-button" type="submit">Delete my account</button>
                        </form>
                    </section>
                    <button id="authLogout" type="button">Logout</button>
                </section>
                <p class="auth-status" id="authStatus" aria-live="polite"></p>
            </article>
        </dialog>
    `,
  );
}

function bindAuthEvents() {
  document
    .getElementById("authClose")
    ?.addEventListener("click", closeAuthModal);
  document.getElementById("authModal")?.addEventListener("click", (event) => {
    if (event.target.id === "authModal") closeAuthModal();
  });
  document.getElementById("authModal")?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeAuthModal();
  });
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.addEventListener("click", () =>
      setAuthMode(button.dataset.authMode),
    );
  });
  document
    .getElementById("authLoginForm")
    ?.addEventListener("submit", handleLogin);
  document
    .getElementById("authRegisterDetailsForm")
    ?.addEventListener("submit", handleRegisterDetails);
  document
    .getElementById("authRegisterOtpForm")
    ?.addEventListener("submit", handleRegisterOtpSubmit);
  document
    .getElementById("authRegisterBack")
    ?.addEventListener("click", () => setRegisterStep("details"));
  document
    .getElementById("authRegisterEnterOtp")
    ?.addEventListener("click", handleRegisterEnterOtp);
  document
    .getElementById("authResetOtpForm")
    ?.addEventListener("submit", handleResetOtp);
  document
    .getElementById("authResetVerifyForm")
    ?.addEventListener("submit", handleResetOtpVerify);
  document
    .getElementById("authResetPasswordForm")
    ?.addEventListener("submit", handleResetPassword);
  document
    .getElementById("authAccountDetailsForm")
    ?.addEventListener("submit", handleUpdateAccountDetails);
  document.querySelectorAll("[data-profile-action]").forEach((button) => {
    button.addEventListener("click", () => handleProfileAction(button.dataset.profileAction));
  });
  document
    .getElementById("authDeleteStart")
    ?.addEventListener("click", showDeleteConfirmation);
  document
    .getElementById("authDeleteYes")
    ?.addEventListener("click", showDeletePasswordForm);
  document
    .getElementById("authDeleteNo")
    ?.addEventListener("click", resetDeleteConfirmation);
  document
    .getElementById("authDeletePasswordForm")
    ?.addEventListener("submit", handleDeleteAccount);
  bindAuthInputSanitizers();
  document.getElementById("authLogout")?.addEventListener("click", () => {
    logoutCurrentUser();
    showAuthStatus("Logged out.");
    setAuthMode("login");
  });
  restoreOtpCooldowns();
}

async function handleLogin(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await runAuthAction(async () => {
    authState.user = await loginAccount({
      phoneNumber: sanitizePhone(data.phoneNumber),
      password: data.password,
    });
    closeAuthModal();
  }, "Logging in...", "Logged in.");
}

async function handleRegisterDetails(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (isRegisterLocked()) {
    showAuthStatus(registerLockMessage(), true);
    return;
  }
  if (!validateMatchingPasswords(form)) return;
  if (!form.reportValidity()) return;
  const data = formData(form);
  const phoneNumber = sanitizePhone(data.phoneNumber);
  const hasMarketingConsent = data.marketingConsent === "on";
  const button = form.querySelector("[data-otp-purpose='registration']");

  pendingRegisterPayload = {
    phoneNumber,
    username: sanitizeUsername(data.username),
    displayName: sanitizeUsername(data.username),
    password: data.password,
    province: sanitizeProvinceInput(data.province),
    city: titleCase(sanitizeCity(data.city)),
    marketingConsent: hasMarketingConsent,
    alertPreferences: {
      channels: hasMarketingConsent ? ["whatsapp"] : [],
      alertsEnabled: hasMarketingConsent,
    },
  };

  if (isOtpCooldownActive("registration")) {
    hasPendingRegistrationOtp = true;
    updateRegisterNavigation();
    setRegisterStep("otp");
    showAuthStatus("Use the OTP already sent to finish creating your account.");
    return;
  }

  const wasSent = await runOtpRequest({
    button,
    purpose: "registration",
    sendingMessage: "Sending registration OTP...",
    successMessage: "Registration OTP sent.",
    action: async () => {
      const result = await requestRegistrationOtp(phoneNumber);
      return result;
    },
  });
  if (wasSent) {
    hasPendingRegistrationOtp = true;
    updateRegisterNavigation();
    setRegisterStep("otp");
    showAuthStatus("OTP sent. Enter it to finish creating your account.");
  } else if (button && !isOtpCooldownActive("registration")) {
    pendingRegisterPayload = null;
  }
}

function handleRegisterEnterOtp() {
  if (!pendingRegisterPayload || !hasPendingRegistrationOtp) {
    showAuthStatus("Create account first so we can send the OTP.", true);
    return;
  }
  setRegisterStep("otp");
  showAuthStatus("Enter the OTP we sent to finish creating your account.");
}

async function handleRegisterOtpSubmit(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);

  if (isRegisterLocked()) {
    showAuthStatus(registerLockMessage(), true);
    setRegisterStep("details");
    return;
  }
  if (!pendingRegisterPayload) {
    showAuthStatus("Start again so we can confirm the account details.", true);
    setRegisterStep("details");
    return;
  }

  try {
    showAuthStatus("Checking OTP...");
    authState.user = await registerAccount({
      ...pendingRegisterPayload,
      code: sanitizeOtp(data.code),
    });
    if (pendingRegisterPayload.marketingConsent) {
      syncAlertConsentCapture(authState.user);
    }
    pendingRegisterPayload = null;
    hasPendingRegistrationOtp = false;
    updateRegisterNavigation();
    clearRegisterLock();
    updateAuthUi();
    notifyAuthChange();
    showAuthStatus("Account created.");
    closeAuthModal();
  } catch (error) {
    if (error?.code === "OTP_INVALID" || error?.code === "OTP_EXPIRED") {
      const failure = recordRegisterOtpFailure();
      if (failure.locked) {
        pendingRegisterPayload = null;
        hasPendingRegistrationOtp = false;
        updateRegisterNavigation();
        setRegisterStep("details");
        showAuthStatus(registerLockMessage(), true);
        return;
      }
      showAuthStatus(
        `Incorrect OTP. You have ${failure.attemptsRemaining} ${failure.attemptsRemaining === 1 ? "try" : "tries"} left.`,
        true,
      );
      return;
    }
    showAuthStatus(error.message || "Could not create account.", true);
  }
}

async function handleResetOtp(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const phoneNumber = sanitizePhone(data.phoneNumber);
  const button = event.currentTarget.querySelector("[data-otp-purpose]");
  const wasSent = await runOtpRequest({
    button,
    purpose: "reset",
    sendingMessage: "Sending reset OTP...",
    successMessage: "Password reset OTP sent.",
    action: async () => {
      const result = await requestPasswordResetOtp(phoneNumber);
      localStorage.setItem("lekkerdeal_pending_reset_phone", phoneNumber);
      return result;
    },
  });
  if (wasSent) {
    setResetStep("verify");
  }
}

async function handleResetOtpVerify(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  const phoneNumber =
    localStorage.getItem("lekkerdeal_pending_reset_phone") || "";
  await runAuthAction(
    async () => {
      const result = await verifyPasswordResetOtp({
        phoneNumber,
        code: sanitizeOtp(data.code),
      });
      sessionStorage.setItem(
        "lekkerdeal_password_reset_token",
        result.resetToken || "",
      );
      setResetStep("password");
    },
    "Checking OTP...",
    "OTP verified. Enter your new password.",
  );
}

async function handleResetPassword(event) {
  event.preventDefault();
  if (!validateMatchingPasswords(event.currentTarget)) return;
  const data = formData(event.currentTarget);
  const resetToken =
    sessionStorage.getItem("lekkerdeal_password_reset_token") || "";
  await runAuthAction(async () => {
    await resetPassword({
      resetToken,
      password: data.password,
    });
    localStorage.removeItem("lekkerdeal_pending_reset_phone");
    sessionStorage.removeItem("lekkerdeal_password_reset_token");
    logoutAccount();
    authState.user = null;
    setAuthMode("login");
  }, "Resetting password...", "Password reset complete. Login with your new password.");
}

async function handleUpdateAccountDetails(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await runAuthAction(async () => {
    authState.user = await updateCurrentUser({
      username: sanitizeUsername(data.username),
      displayName: sanitizeUsername(data.username),
      province: sanitizeProvinceInput(data.province),
      city: titleCase(sanitizeCity(data.city)),
      marketingConsent: data.marketingConsent === "on",
      alertPreferences: {
        channels: data.marketingConsent === "on" ? ["whatsapp"] : [],
        alertsEnabled: data.marketingConsent === "on",
      },
    });
    syncAlertConsentCapture(authState.user);
    syncAccountDetailsForm();
  }, "Saving account details...", "Account details updated.");
}

function handleProfileAction(action) {
  if (action === "savedDeals") {
    closeAuthModal();
    document.getElementById("savedHeaderButton")?.click();
    return;
  }
  if (action === "reviews") {
    window.location.href = "reviews.html";
    return;
  }
  if (action === "resetPassword") {
    setAuthMode("reset");
    return;
  }
  if (action === "personalDeals") {
    closeAuthModal();
    window.location.hash = "deals";
    document.getElementById("deals")?.scrollIntoView({ behavior: "smooth" });
  }
}

function showDeleteConfirmation() {
  document.getElementById("authDeleteConfirmRow").hidden = false;
  document.getElementById("authDeletePasswordForm").hidden = true;
}

function showDeletePasswordForm() {
  document.getElementById("authDeleteConfirmRow").hidden = true;
  document.getElementById("authDeletePasswordForm").hidden = false;
}

function resetDeleteConfirmation() {
  document.getElementById("authDeleteConfirmRow").hidden = true;
  document.getElementById("authDeletePasswordForm").hidden = true;
}

async function handleDeleteAccount(event) {
  event.preventDefault();
  const data = formData(event.currentTarget);
  await runAuthAction(async () => {
    await deleteCurrentUserWithPassword(data.password);
    logoutAccount();
    authState.user = null;
    closeAuthModal();
  }, "Deleting account...", "Account deleted.");
}

async function runAuthAction(action, loadingMessage, successMessage) {
  try {
    showAuthStatus(loadingMessage, false, true);
    await action();
    updateAuthUi();
    notifyAuthChange();
    showAuthStatus(successMessage);
  } catch (error) {
    showAuthStatus(error.message || "Something went wrong.", true);
  }
}

async function runOtpRequest({
  button,
  purpose,
  sendingMessage,
  successMessage,
  action,
}) {
  if (!button || isOtpCooldownActive(purpose)) return false;
  const defaultLabel = button.dataset.defaultLabel || button.textContent;

  try {
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = "Sending...";
    showAuthStatus(sendingMessage);
    const result = await action();
    const serverCooldown = Date.parse(result?.cooldownUntil || "");
    const fallbackCooldown = Date.now() + OTP_COOLDOWN_MS;
    startOtpCooldown(
      purpose,
      Number.isFinite(serverCooldown)
        ? Math.max(serverCooldown, fallbackCooldown)
        : fallbackCooldown,
    );
    showAuthStatus(`${successMessage} You can request another code in 5:00.`);
    return true;
  } catch (error) {
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = defaultLabel;
    showAuthStatus(otpErrorMessage(error), true);
    return false;
  }
}

function otpErrorMessage(error) {
  if (error?.code === "PHONE_ALREADY_REGISTERED") {
    return "That phone number already has an account. Login or use Reset instead.";
  }
  if (error?.code === "ACCOUNT_NOT_FOUND") {
    return "No account was found for that phone number. Register first.";
  }
  if (error?.code === "OTP_COOLDOWN_ACTIVE") {
    return "That OTP is still active. Please wait before requesting another one.";
  }
  return error?.message || "Could not send OTP.";
}

function restoreOtpCooldowns() {
  document.querySelectorAll("[data-otp-purpose]").forEach((button) => {
    const purpose = button.dataset.otpPurpose;
    const cooldownUntil = Number(
      localStorage.getItem(cooldownStorageKey(purpose)) || 0,
    );
    if (cooldownUntil > Date.now()) startOtpCooldown(purpose, cooldownUntil);
  });
}

function startOtpCooldown(purpose, cooldownUntil) {
  localStorage.setItem(cooldownStorageKey(purpose), String(cooldownUntil));
  window.clearInterval(otpCooldownTimers.get(purpose));
  updateOtpCooldownButton(purpose, cooldownUntil);
  const timer = window.setInterval(() => {
    updateOtpCooldownButton(purpose, cooldownUntil);
  }, 1000);
  otpCooldownTimers.set(purpose, timer);
}

function updateOtpCooldownButton(purpose, cooldownUntil) {
  const button = document.querySelector(`[data-otp-purpose="${purpose}"]`);
  if (!button) return;
  const remainingMs = cooldownUntil - Date.now();
  if (remainingMs <= 0) {
    window.clearInterval(otpCooldownTimers.get(purpose));
    otpCooldownTimers.delete(purpose);
    localStorage.removeItem(cooldownStorageKey(purpose));
    button.disabled = false;
    button.classList.remove("is-loading");
    button.textContent = button.dataset.defaultLabel || "Send OTP";
    return;
  }

  button.disabled = true;
  button.classList.remove("is-loading");
  button.textContent = `Try again in ${formatCountdown(remainingMs)}`;
}

function isOtpCooldownActive(purpose) {
  return Number(localStorage.getItem(cooldownStorageKey(purpose)) || 0) > Date.now();
}

function cooldownStorageKey(purpose) {
  return `${OTP_COOLDOWN_STORAGE_PREFIX}${purpose}`;
}

function formatCountdown(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setAuthMode(mode) {
  const titles = {
    login: "Account",
    register: "Create Account",
    reset: "Reset Account",
    account: "Account",
  };
  const title = document.getElementById("authTitle");
  if (title) title.textContent = titles[mode] || "Account";
  const tabs = document.querySelector(".auth-tabs");
  if (tabs) tabs.hidden = mode === "account";
  const copy = document.querySelector(".auth-copy");
  if (copy) {
    copy.hidden = mode === "account";
  }
  document.querySelectorAll("[data-auth-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.authPanel !== mode;
  });
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.authMode === mode);
  });
  if (mode === "reset") setResetStep("request");
  if (mode === "register") {
    if (!hasPendingRegistrationOtp) pendingRegisterPayload = null;
    setRegisterStep("details");
    updateRegisterNavigation();
  }
  if (mode === "account") {
    resetDeleteConfirmation();
    syncAccountDetailsForm();
  }
  updateAuthUi();
}

function setRegisterStep(step) {
  document.querySelectorAll("[data-register-step]").forEach((panel) => {
    panel.hidden = panel.dataset.registerStep !== step;
  });
  if (step === "details" && isRegisterLocked()) {
    showAuthStatus(registerLockMessage(), true);
  }
  updateRegisterNavigation();
}

function updateRegisterNavigation() {
  const enterOtpButton = document.getElementById("authRegisterEnterOtp");
  if (!enterOtpButton) return;
  enterOtpButton.hidden = !hasPendingRegistrationOtp || !pendingRegisterPayload;
}

function setResetStep(step) {
  document.querySelectorAll("[data-reset-step]").forEach((panel) => {
    panel.hidden = panel.dataset.resetStep !== step;
  });
}

function provinceOptionsTemplate() {
  return PROVINCE_OPTIONS.map(
    (province) => `<option value="${province}">${province}</option>`,
  ).join("");
}

function getRegisterLockRemainingMs() {
  const lockUntil = Number(localStorage.getItem(REGISTER_LOCK_KEY) || 0);
  const remainingMs = lockUntil - Date.now();
  if (remainingMs <= 0) {
    clearRegisterLock();
    return 0;
  }
  return remainingMs;
}

function isRegisterLocked() {
  return getRegisterLockRemainingMs() > 0;
}

function registerLockMessage() {
  const remainingMs = getRegisterLockRemainingMs();
  const waitHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return `Too many incorrect OTP attempts. Try creating an account again in about ${waitHours} hour${waitHours === 1 ? "" : "s"}.`;
}

function recordRegisterOtpFailure() {
  const attempts =
    Number(localStorage.getItem(REGISTER_ATTEMPTS_KEY) || 0) + 1;
  if (attempts >= 5) {
    localStorage.setItem(
      REGISTER_LOCK_KEY,
      String(Date.now() + REGISTER_LOCK_MS),
    );
    localStorage.removeItem(REGISTER_ATTEMPTS_KEY);
    return { locked: true, attemptsRemaining: 0 };
  }
  localStorage.setItem(REGISTER_ATTEMPTS_KEY, String(attempts));
  return { locked: false, attemptsRemaining: 5 - attempts };
}

function clearRegisterLock() {
  localStorage.removeItem(REGISTER_LOCK_KEY);
  localStorage.removeItem(REGISTER_ATTEMPTS_KEY);
}

function updateAuthUi() {
  const accountButton = document.getElementById("accountButton");
  if (accountButton) {
    accountButton.innerHTML = authState.user ? profileIconMarkup() : "Login";
    accountButton.setAttribute(
      "aria-label",
      authState.user ? "Open profile" : "Login",
    );
  }
  document.querySelectorAll(".desktop-auth-button.is-account[data-auth-logged-in]").forEach((button) => {
    button.innerHTML = profileIconMarkup();
    button.setAttribute("aria-label", "Open profile");
    button.setAttribute("title", "Profile");
  });
  document.querySelectorAll(".mobile-auth-button.is-account[data-auth-logged-in]").forEach((button) => {
    button.innerHTML = `${profileIconMarkup()}<span data-auth-user-label>Profile</span>`;
    button.style.color = "#000000";
  });
  const accountName = document.getElementById("authAccountName");
  if (accountName) {
    accountName.textContent = authState.user
      ? authState.user.displayName || authState.user.username || "Account"
      : "Account";
  }
  const summary = document.getElementById("authAccountSummary");
  if (summary) {
    summary.textContent = authState.user
      ? `${authState.user.phoneNumber} | ${authState.user.city || "South Africa"}`
      : "Not logged in.";
  }
  syncAccountDetailsForm();
  document.querySelectorAll("[data-auth-logged-in]").forEach((element) => {
    element.hidden = !authState.user;
  });
  document.querySelectorAll("[data-auth-logged-out]").forEach((element) => {
    element.hidden = Boolean(authState.user);
  });
  document.querySelectorAll("[data-auth-user-label]").forEach((element) => {
    if (element.closest(".mobile-auth-button.is-account")) {
      element.textContent = "Profile";
      return;
    }
    element.textContent = authState.user
      ? authState.user.displayName || authState.user.username || "Account"
      : "Account";
  });
}

function syncAccountDetailsForm() {
  const form = document.getElementById("authAccountDetailsForm");
  if (!form || !authState.user) return;
  form.elements.username.value = authState.user.username || "";
  form.elements.province.value = sanitizeProvinceInput(authState.user.province);
  form.elements.city.value = titleCase(sanitizeCity(authState.user.city || ""));
  form.elements.marketingConsent.checked =
    authState.user.alertPreferences?.alertsEnabled === true ||
    Boolean(authState.user.marketingConsentAt);
}

function profileIconMarkup() {
  return `<svg class="ui-icon profile-icon" aria-hidden="true"><use href="#icon-user"></use></svg>`;
}


function syncAlertConsentCapture(user) {
  if (
    user?.marketingConsentAt ||
    user?.alertPreferences?.alertsEnabled === true ||
    user?.alertPreferences?.consentedAt
  ) {
    markAlertConsentCapturedFromAccount(user);
  }
}

function showAuthStatus(message, isError = false, isLoading = false) {
  const status = document.getElementById("authStatus");
  if (!status) return;
  status.innerHTML = "";
  if (isLoading) {
    const spinner = document.createElement("span");
    spinner.className = "auth-status-spinner";
    spinner.setAttribute("aria-hidden", "true");
    status.append(spinner);
  }
  status.append(document.createTextNode(message || ""));
  status.classList.toggle("is-loading", isLoading);
  status.style.color = isError ? "var(--red)" : "var(--green)";
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (modal) closeDialogElement(modal);
}

function openDialogElement(dialog) {
  dialog.hidden = false;
  dialog.classList.add("is-open");
  document.body.classList.add("auth-modal-open");
  try {
    if (typeof dialog.showModal === "function" && !dialog.open) {
      dialog.showModal();
      return;
    }
  } catch (error) {
    console.warn("Falling back to standard auth modal display", error);
  }
  dialog.setAttribute("open", "");
}

function closeDialogElement(dialog) {
  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  }
  dialog.removeAttribute("open");
  dialog.classList.remove("is-open");
  document.body.classList.remove("auth-modal-open");
  dialog.hidden = true;
}

function notifyAuthChange() {
  authState.listeners.forEach((listener) => listener(authState.user));
}

function formData(form) {
  return Object.fromEntries(
    [...new FormData(form)].map(([key, value]) => [
      key,
      key === "password" ? String(value) : cleanValue(value),
    ]),
  );
}

function bindAuthInputSanitizers() {
  document.querySelectorAll(".auth-form input").forEach((input) => {
    input.addEventListener("input", () => sanitizeAuthInput(input));
    input.addEventListener("blur", () => sanitizeAuthInput(input, true));
  });
  ["authRegisterDetailsForm", "authResetPasswordForm"].forEach((formId) => {
    const form = document.getElementById(formId);
    form?.querySelectorAll("input[type='password']").forEach((input) => {
      input.addEventListener("input", () => validateMatchingPasswords(form));
      input.addEventListener("blur", () => validateMatchingPasswords(form));
    });
  });
}

function sanitizeAuthInput(input, shouldTitleCase = false) {
  const field = input.name;
  if (field === "password") return;
  if (field === "confirmPassword") return;
  if (field === "phoneNumber") {
    input.value = sanitizePhone(input.value);
    return;
  }
  if (field === "code") {
    input.value = sanitizeOtp(input.value);
    return;
  }
  if (field === "username") {
    input.value = sanitizeUsername(input.value);
    return;
  }
  if (field === "city") {
    input.value = shouldTitleCase
      ? titleCase(sanitizeCity(input.value))
      : sanitizeCity(input.value);
    return;
  }
  if (field === "province") {
    input.value = shouldTitleCase
      ? titleCase(sanitizeCity(input.value))
      : sanitizeCity(input.value);
  }
}

function sanitizeProvinceInput(value) {
  return PROVINCE_OPTIONS.includes(value) ? value : "";
}

function sanitizeOtp(value) {
  return cleanValue(value).replace(/\D/g, "").slice(0, 6);
}

function sanitizeUsername(value) {
  return cleanValue(value).replace(/[^A-Za-z0-9_]/g, "").slice(0, 32);
}

function validateMatchingPasswords(form) {
  const password = form?.elements?.password;
  const confirmPassword = form?.elements?.confirmPassword;
  if (!password || !confirmPassword) return true;

  const message =
    confirmPassword.value && password.value !== confirmPassword.value
      ? "Passwords do not match."
      : "";
  confirmPassword.setCustomValidity(message);
  if (message && document.activeElement !== confirmPassword) {
    confirmPassword.reportValidity();
  }
  return !message;
}
