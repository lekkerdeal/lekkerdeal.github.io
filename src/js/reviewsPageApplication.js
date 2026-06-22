import { injectIconSprite } from "./modules/icons.js";
import { buildReviewFromForm, loadReviews } from "./modules/reviews-storage.js";
import {
  renderReviewPage,
  renderTypeOptions,
} from "./modules/reviews-rendering.js";
import {
  createReview,
  createReviewReply,
  deleteReviewReply,
  deleteReview,
  fetchReviews,
  reactToReview,
  reactToReviewReply,
  updateReviewReply,
  updateReview,
} from "./api/reviews-api.js";
import { isAuthenticated } from "./api/client.js";
import {
  getCurrentUser,
  initAuthUi,
  onAuthChange,
  openAuthModal,
} from "./modules/authentication-interface.js";
import * as authenticationInterface from "./modules/authentication-interface.js";
import { logoutAccount } from "./api/authentication-api.js";
import { loadHtmlPartials } from "./modules/html-partials.js";
import { initPrivateSubmissionModals } from "./modules/private-submissions-interface.js";
import {
  initializeNetworkStatus,
  initializePwaInstallation,
  registerServiceWorker,
} from "./modules/application-shell.js";

const state = {
  reviews: [],
  filter: "all",
  dealContext: null,
  user: null,
  isPostingReview: false,
  pendingReplies: new Set(),
  pendingActions: new Set(),
};

const elements = {};

document.addEventListener("DOMContentLoaded", initReviewsPage);

async function initReviewsPage() {
  await injectIconSprite();
  await loadHtmlPartials();
  injectReviewEditDialog();
  bindElements();
  initializePwaInstallation();
  initializeNetworkStatus();
  registerServiceWorker();
  initPrivateSubmissionModals();
  const user = await initAuthUi({
    mountButton: document.querySelector(".review-actions"),
  });
  state.user = user;
  syncMobileAuthButtons(user);
  onAuthChange((nextUser) => {
    state.user = nextUser;
    syncMobileAuthButtons(nextUser);
    render();
  });
  fillProfileFields();
  state.dealContext = getDealContext();
  applyDealContext();
  renderTypeOptions(elements.typeSelect);
  applyReviewTypeDefault();
  bindEvents();
  await loadReviewFeed();
  render();
}

function bindElements() {
  elements.form = document.querySelector("#reviewForm");
  elements.typeSelect = document.querySelector("#reviewType");
  elements.tabs = document.querySelector("#reviewTabs");
  elements.list = document.querySelector("#reviewList");
  elements.status = document.querySelector("#reviewStatus");
  elements.total = document.querySelector("#reviewTotal");
  elements.average = document.querySelector("#reviewAverage");
  elements.province = document.querySelector("#reviewProvinceStat");
  elements.saved = document.querySelector("#reviewSaved");
  elements.type = document.querySelector("#reviewTopType");
  elements.context = document.querySelector("#reviewContext");
  elements.dealId = document.querySelector("#reviewDealId");
  elements.productKey = document.querySelector("#reviewProductKey");
  elements.dealTitle = document.querySelector("#reviewDealTitle");
  elements.retailer = document.querySelector("input[name='retailer']");
  elements.provinceInput = document.querySelector("select[name='province']");
  elements.mobileMenuButton = document.querySelector("#reviewMobileMenuButton");
  elements.mobileMenuClose = document.querySelector("#reviewMobileMenuClose");
  elements.mobileNavDrawer = document.querySelector("#reviewMobileNavDrawer");
  if (elements.mobileNavDrawer?.parentElement !== document.body) {
    document.body.append(elements.mobileNavDrawer);
  }
  elements.mobileLoginButton = document.querySelector("#reviewMobileLoginButton");
  elements.mobileRegisterButton = document.querySelector(
    "#reviewMobileRegisterButton",
  );
  elements.mobileAccountButton = document.querySelector("#reviewMobileAccountButton");
  elements.mobileLogoutButton = document.querySelector("#reviewMobileLogoutButton");
  elements.mobileInstallButton = document.querySelector(
    "#reviewMobileInstallButton",
  );
}

function bindEvents() {
  elements.form?.addEventListener("submit", handleSubmit);
  elements.mobileMenuButton?.addEventListener("click", openMobileMenu);
  elements.mobileMenuClose?.addEventListener("click", closeMobileMenu);
  elements.mobileLoginButton?.addEventListener("click", () => {
    closeMobileMenu();
    openAuthModal("login");
  });
  elements.mobileRegisterButton?.addEventListener("click", () => {
    closeMobileMenu();
    openAuthModal("register");
  });
  elements.mobileAccountButton?.addEventListener("click", () => {
    closeMobileMenu();
    openAuthModal("account");
  });
  elements.mobileLogoutButton?.addEventListener("click", () => {
    closeMobileMenu();
    logoutFromMobileMenu();
  });
  elements.mobileInstallButton?.addEventListener("click", () => {
    closeMobileMenu();
    window.dispatchEvent(new CustomEvent("lekkedeal:install-requested"));
  });
  elements.mobileNavDrawer?.addEventListener("click", (event) => {
    if (
      event.target.closest(
        "a[href], [data-report-deal-id], [data-retailer-collaboration], [data-contact-form]",
      )
    ) {
      closeMobileMenu();
    }
  });
  window.addEventListener("resize", positionReviewDrawer);
  window.visualViewport?.addEventListener("resize", positionReviewDrawer);
  window.visualViewport?.addEventListener("scroll", positionReviewDrawer);
  document.addEventListener("click", handleMobileMenuOutsideClick);
  window.addEventListener("lekkedeal:network-restored", async () => {
    await loadReviewFeed();
    render();
  });
  elements.tabs?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    state.filter = button.dataset.filter;
    render();
  });
  elements.list?.addEventListener("click", handleReviewAction);
  elements.list?.addEventListener("click", handleReplyAction);
  elements.list?.addEventListener("submit", handleReviewReplySubmit);
}

function openMobileMenu() {
  if (!elements.mobileNavDrawer || !elements.mobileMenuButton) return;
  elements.mobileNavDrawer.hidden = false;
  positionReviewDrawer();
  elements.mobileMenuButton.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
}

function closeMobileMenu() {
  if (!elements.mobileNavDrawer || !elements.mobileMenuButton) return;
  elements.mobileNavDrawer.hidden = true;
  elements.mobileMenuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

function positionReviewDrawer() {
  const drawer = elements.mobileNavDrawer;
  if (!drawer || drawer.hidden) return;
  const viewport = window.visualViewport;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const drawerWidth = Math.min(304, Math.max(210, viewportWidth - 20));

  drawer.style.setProperty("--review-drawer-left", `${viewportLeft + viewportWidth - drawerWidth}px`);
  drawer.style.setProperty("--review-drawer-top", `${viewportTop}px`);
  drawer.style.setProperty("--review-drawer-width", `${drawerWidth}px`);
  drawer.style.setProperty("--review-drawer-height", `${viewportHeight}px`);
}

function handleMobileMenuOutsideClick(event) {
  if (!elements.mobileNavDrawer || elements.mobileNavDrawer.hidden) return;
  if (elements.mobileNavDrawer.contains(event.target)) return;
  if (elements.mobileMenuButton?.contains(event.target)) return;
  closeMobileMenu();
}

function syncMobileAuthButtons(user) {
  document.querySelectorAll("[data-auth-logged-in]").forEach((element) => {
    element.hidden = !user;
  });
  document.querySelectorAll("[data-auth-logged-out]").forEach((element) => {
    element.hidden = Boolean(user);
  });
  document.querySelectorAll("[data-auth-user-label]").forEach((element) => {
    if (element.closest(".mobile-auth-button.is-account")) {
      element.textContent = user ? "Profile" : "Account";
      return;
    }
    element.textContent = user
      ? user.displayName || user.username || "Account"
      : "Account";
  });
}

function logoutFromMobileMenu() {
  if (typeof authenticationInterface.logoutCurrentUser === "function") {
    authenticationInterface.logoutCurrentUser();
    return;
  }
  logoutAccount();
  syncMobileAuthButtons(null);
}

async function handleSubmit(event) {
  event.preventDefault();
  if (state.isPostingReview) return;
  if (!isAuthenticated()) {
    setStatus(
      "Login or create an account before posting a public review.",
      true,
    );
    openAuthModal("login");
    return;
  }

  const result = buildReviewFromForm(elements.form, getCurrentUser());

  if (result.errors.length) {
    setStatus(result.errors[0], true);
    return;
  }
  if (hasDuplicateReview(result.review)) {
    setStatus("You have already reviewed this product.", true);
    return;
  }

  try {
    state.isPostingReview = true;
    setFormBusy(elements.form, true);
    await createReview(result.review);
    await loadReviewFeed();
  } catch (error) {
    setStatus(error.message || "Could not post review.", true);
    return;
  } finally {
    state.isPostingReview = false;
    setFormBusy(elements.form, false);
  }

  state.filter = "all";
  elements.form.reset();
  applyDealContext();
  setStatus("Review posted.", false);
  render();
}

async function handleReviewAction(event) {
  const button = event.target.closest("[data-review-action]");
  if (!button) return;
  const reviewId = button.closest("[data-review-id]")?.dataset.reviewId;
  if (!reviewId) return;

  if (!isAuthenticated()) {
    openAuthModal("login");
    return;
  }

  const action = button.dataset.reviewAction;
  const actionKey = `review:${reviewId}:${action}`;
  if (state.pendingActions.has(actionKey)) return;
  try {
    state.pendingActions.add(actionKey);
    button.disabled = true;
    if (action === "like" || action === "dislike") {
      await reactToReview(reviewId, action);
    } else if (action === "delete") {
      await deleteReview(reviewId);
    } else if (action === "edit") {
      const review = state.reviews.find((item) => item.id === reviewId);
      if (!review) return;
      const nextComment = await openReviewEditDialog({
        title: "Edit review",
        label: "Review",
        value: review.comment,
      });
      if (!nextComment || nextComment.trim() === review.comment) return;
      await updateReview(reviewId, { ...review, comment: nextComment.trim() });
    }
    await loadReviewFeed();
    render();
  } catch (error) {
    setStatus(error.message || "Could not update review.", true);
  } finally {
    state.pendingActions.delete(actionKey);
    button.disabled = false;
  }
}

async function handleReviewReplySubmit(event) {
  const form = event.target.closest("[data-review-reply-form]");
  if (!form) return;
  event.preventDefault();
  if (!isAuthenticated()) {
    openAuthModal("login");
    return;
  }
  const reviewId = form.closest("[data-review-id]")?.dataset.reviewId;
  const body = new FormData(form).get("reply")?.toString().trim();
  if (!reviewId || !body || body.length < 2) return;
  if (state.pendingReplies.has(reviewId)) return;
  try {
    state.pendingReplies.add(reviewId);
    setFormBusy(form, true);
    await createReviewReply(reviewId, body);
    form.reset();
    await loadReviewFeed();
    render();
  } catch (error) {
    setStatus(error.message || "Could not post reply.", true);
  } finally {
    state.pendingReplies.delete(reviewId);
    setFormBusy(form, false);
  }
}

async function handleReplyAction(event) {
  const button = event.target.closest("[data-reply-action]");
  if (!button) return;
  const replyId = button.closest("[data-reply-id]")?.dataset.replyId;
  if (!replyId) return;
  if (!isAuthenticated()) {
    openAuthModal("login");
    return;
  }
  const action = button.dataset.replyAction;
  const actionKey = `reply:${replyId}:${action}`;
  if (state.pendingActions.has(actionKey)) return;
  try {
    state.pendingActions.add(actionKey);
    button.disabled = true;
    if (action === "like" || action === "dislike") {
      await reactToReviewReply(replyId, action);
    } else if (action === "delete") {
      await deleteReviewReply(replyId);
    } else if (action === "edit") {
      const reply = findReply(replyId);
      if (!reply) return;
      const nextBody = await openReviewEditDialog({
        title: "Edit reply",
        label: "Reply",
        value: reply.body || "",
      });
      if (!nextBody || nextBody.trim() === reply.body) return;
      await updateReviewReply(replyId, nextBody.trim());
    }
    await loadReviewFeed();
    render();
  } catch (error) {
    setStatus(error.message || "Could not update reply.", true);
  } finally {
    state.pendingActions.delete(actionKey);
    button.disabled = false;
  }
}

async function loadReviewFeed() {
  try {
    const params = state.dealContext?.productKey
      ? { productKey: state.dealContext.productKey, limit: 100 }
      : { limit: 100 };
    state.reviews = (await fetchReviews(params)).map(normalizeApiReview);
  } catch (error) {
    console.warn("Review API unavailable, using local reviews", error);
    state.reviews = loadReviews();
  }
}

function render() {
  const reviews = state.dealContext
    ? state.reviews.filter(
        (review) =>
          review.dealId === state.dealContext.dealId ||
          Boolean(
            state.dealContext.productKey &&
            review.productKey === state.dealContext.productKey,
          ),
      )
    : state.reviews;
  renderReviewPage(reviews, state, elements);
}

function hasDuplicateReview(review) {
  const userId = state.user?.id || state.user?._id;
  if (!userId) return false;
  return state.reviews.some((item) => {
    if (String(item.userId) !== String(userId)) return false;
    if (review.productKey) return item.productKey === review.productKey;
    if (review.dealId) return item.dealId === review.dealId;
    return false;
  });
}

function findReply(replyId) {
  for (const review of state.reviews) {
    const reply = (review.replies || []).find(
      (item) => String(item.id || item._id) === String(replyId),
    );
    if (reply) return reply;
  }
  return null;
}

function setFormBusy(form, isBusy) {
  form?.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = isBusy;
  });
}

function setStatus(message, isError) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "var(--red)" : "var(--green)";
}

function injectReviewEditDialog() {
  if (document.getElementById("reviewEditDialog")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <dialog class="review-edit-dialog" id="reviewEditDialog" hidden>
        <article class="review-edit-card">
          <button class="review-edit-close" id="reviewEditClose" type="button" aria-label="Close edit form">&times;</button>
          <h2 id="reviewEditTitle">Edit</h2>
          <form id="reviewEditForm" class="review-edit-form">
            <label>
              <span id="reviewEditLabel">Comment</span>
              <textarea id="reviewEditTextarea" maxlength="280" required></textarea>
            </label>
            <menu class="review-edit-actions">
              <button class="review-edit-cancel" id="reviewEditCancel" type="button">Cancel</button>
              <button class="review-edit-save" type="submit">Save</button>
            </menu>
          </form>
        </article>
      </dialog>
    `,
  );
}

function openReviewEditDialog({ title, label, value }) {
  return new Promise((resolve) => {
    const dialog = document.getElementById("reviewEditDialog");
    const form = document.getElementById("reviewEditForm");
    const textarea = document.getElementById("reviewEditTextarea");
    const titleElement = document.getElementById("reviewEditTitle");
    const labelElement = document.getElementById("reviewEditLabel");
    const closeButton = document.getElementById("reviewEditClose");
    const cancelButton = document.getElementById("reviewEditCancel");
    if (!dialog || !form || !textarea) {
      resolve("");
      return;
    }

    let isResolved = false;
    const cleanup = () => {
      form.removeEventListener("submit", handleSubmit);
      closeButton?.removeEventListener("click", handleCancel);
      cancelButton?.removeEventListener("click", handleCancel);
      dialog.removeEventListener("cancel", handleCancel);
      dialog.removeEventListener("click", handleBackdropClick);
    };
    const finish = (nextValue = "") => {
      if (isResolved) return;
      isResolved = true;
      cleanup();
      closeDialog(dialog);
      resolve(nextValue);
    };
    const handleSubmit = (event) => {
      event.preventDefault();
      const nextValue = textarea.value.trim();
      if (nextValue.length < 2) return;
      finish(nextValue);
    };
    const handleCancel = (event) => {
      event?.preventDefault();
      finish("");
    };
    const handleBackdropClick = (event) => {
      if (event.target === dialog) finish("");
    };

    titleElement.textContent = title;
    labelElement.textContent = label;
    textarea.value = value || "";
    form.addEventListener("submit", handleSubmit);
    closeButton?.addEventListener("click", handleCancel);
    cancelButton?.addEventListener("click", handleCancel);
    dialog.addEventListener("cancel", handleCancel);
    dialog.addEventListener("click", handleBackdropClick);
    openDialog(dialog);
    textarea.focus();
    textarea.select();
  });
}

function openDialog(dialog) {
  dialog.hidden = false;
  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  dialog.removeAttribute("open");
  dialog.hidden = true;
}

function getDealContext() {
  const params = new URLSearchParams(window.location.search);
  const dealId = (params.get("deal") || "").trim();
  if (!dealId) return null;
  return {
    dealId,
    productKey: (params.get("product") || "").trim().slice(0, 160),
    title: (params.get("title") || "Selected deal").trim().slice(0, 140),
    retailer: (params.get("retailer") || "").trim().slice(0, 42),
  };
}

function applyDealContext() {
  if (!state.dealContext) return;
  elements.dealId.value = state.dealContext.dealId;
  elements.productKey.value = state.dealContext.productKey;
  elements.dealTitle.value = state.dealContext.title;
  elements.retailer.value = state.dealContext.retailer;
  elements.context.hidden = false;
  elements.context.textContent = "";
  const title = document.createElement("strong");
  const product = document.createElement("span");
  const retailer = document.createElement("small");
  title.textContent = "Reviewing this deal";
  product.textContent = state.dealContext.title;
  retailer.textContent = state.dealContext.retailer;
  elements.context.append(title, product);
  if (state.dealContext.retailer) elements.context.append(retailer);
}

function applyReviewTypeDefault() {
  if (state.dealContext && elements.typeSelect) {
    elements.typeSelect.value = "product-review";
  }
}

function fillProfileFields() {
  const user = getCurrentUser();
  if (!user) return;
  if (elements.provinceInput && user.province)
    elements.provinceInput.value = user.province;
}

function normalizeApiReview(review) {
  return {
    id: review._id || review.id,
    userId: String(review.userId || ""),
    name: review.authorName || "LekkeDeal shopper",
    province: review.authorProvince || "",
    type: review.reviewType || "general",
    rating: Number(review.rating) || 5,
    retailer: review.retailer || "",
    comment: review.comment || "",
    dealId: review.dealId || "",
    productKey: review.productKey || "",
    dealTitle: review.dealTitle || "",
    likes: Number(review.likes) || 0,
    dislikes: Number(review.dislikes) || 0,
    replies: Array.isArray(review.replies)
      ? review.replies.map(normalizeApiReply)
      : [],
    createdAt: review.createdAt || new Date().toISOString(),
    source: "api",
  };
}

function normalizeApiReply(reply) {
  return {
    id: reply._id || reply.id,
    userId: String(reply.userId || ""),
    authorName: reply.authorName || "LekkeDeal shopper",
    body: reply.body || "",
    likes: Number(reply.likes ?? reply.likedBy?.length) || 0,
    dislikes: Number(reply.dislikes ?? reply.dislikedBy?.length) || 0,
  };
}
