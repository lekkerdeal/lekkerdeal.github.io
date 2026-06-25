import { injectIconSprite } from "./modules/icons.js";
import {
  cleanValue,
  normalizeText,
  sanitizeSearchText,
} from "./modules/text-sanitization.js";
import {
  AUTO_LOAD_BATCH_LIMIT,
  DATA_URL,
  DEALS_REFRESH_INTERVAL_MS,
  PAGE_SIZE,
  SEARCH_DEBOUNCE_MS,
  WORKER_URL,
} from "./modules/application-config.js";
import {
  closeMobileFilters as closeFiltersPanel,
  initializeNetworkStatus,
  initializePwaInstallation,
  registerServiceWorker,
  setupScrollHeader,
  toggleMobileFilters as toggleFiltersPanel,
} from "./modules/application-shell.js";
import {
  bindCaptureInputSanitizers,
  dismissDataCaptureModal,
  handleDataCaptureSubmit as submitDataCapture,
  handleViewDealClick as gateViewDealClick,
  loadCaptureState as initializeCaptureState,
} from "./modules/data-capture-modal.js";
import {
  formatDateTime,
  isValidDeal,
  normalizeDeal,
  parsePrice,
} from "./modules/deal-normalization.js";
import { buildFilterOptions as buildFilterOptionsView } from "./modules/filter-interface.js";
import {
  noImagePlaceholderTemplate,
  preloadImage,
  warmImageCache,
} from "./modules/image-handling.js";
import {
  breakdownTemplate,
  dealCardTemplate,
  priceCheckTemplate,
} from "./modules/templates.js";
import {
  deleteSavedDealFromAccount,
  fetchSavedDeals,
  saveDealToAccount,
} from "./api/saved-deals-api.js";
import { fetchReviewCounts } from "./api/reviews-api.js";
import {
  getCurrentUser,
  initAuthUi,
  onAuthChange,
  openAuthModal,
} from "./modules/authentication-interface.js";
import * as authenticationInterface from "./modules/authentication-interface.js";
import { logoutAccount } from "./api/authentication-api.js";
import { isAuthenticated } from "./api/client.js";
import { buildPriceCheckGroups } from "./modules/price-checks.js";
import * as savedDealsStorage from "./modules/saved-deals-storage.js";
import { getDealReviewCounts } from "./modules/reviews-storage.js";
import {
  countBy,
  cssEscape,
  escapeHtml,
  formatNumber,
  uniqueSorted,
} from "./modules/interface-formatting.js";
import { loadHtmlPartials } from "./modules/html-partials.js";
import { cacheDomElementReferences } from "./modules/dom-element-references.js";
import {
  setLatestDropPublishedAt,
  startRaidCountdown,
} from "./modules/countdown.js";
import {
  closeImageViewer,
  fitDealImage,
  handleImageViewerBackdrop,
  openImageViewer,
} from "./modules/image-viewer.js";
import { handleShareDeal } from "./modules/share.js";
import { initPrivateSubmissionModals } from "./modules/private-submissions-interface.js";

const state = {
  allDeals: [],
  filteredDeals: [],
  dealById: new Map(),
  savedDeals: new Set(),
  savedProductKeys: new Set(),
  user: null,
  reviewCounts: {
    deals: new Map(),
    products: new Map(),
  },
  visibleCount: PAGE_SIZE,
  activeRetailer: "",
  filterWorker: null,
  workerReady: false,
  filterRequestId: 0,
  infiniteObserver: null,
  autoLoadBatches: 0,
  viewDealClicks: 0,
  sharedDealId: "",
  sharedDealHandled: false,
  searchDebounceTimer: null,
  searchScrollTimer: null,
  searchFallbackNotice: "",
  searchFallbackActive: false,
  dataUpdatedAt: "",
  dataSnapshot: "",
  offlineData: false,
  filters: {
    search: "",
    retailer: "",
    category: "",
    minDiscount: 0,
    minPrice: "",
    maxPrice: "",
    stock: "",
    savedOnly: false,
    sort: "discount-desc",
  },
};

const els = {};

await loadHtmlPartials();

function initializeApplication() {
  injectIconSprite();
  state.sharedDealId = getSharedDealIdFromLocation();
  cacheDomElementReferences(els);
  bindEvents();
  loadSavedDeals();
  initAccount();
  initPrivateSubmissionModals({
    resolveDealById: (dealId) => state.dealById.get(dealId),
  });
  initializePwaInstallation();
  initializeNetworkStatus();
  initializeCaptureState(state, els);
  registerServiceWorker();
  setupDealWorker();
  startRaidCountdown(els);
  setupInfiniteScroll();
  setupScrollHeader();
  window.addEventListener("lekkedeal:network-restored", () => loadDeals());
  loadDeals();
  window.setInterval(
    () => loadDeals({ onlyIfChanged: true, showLoadingIndicator: false }),
    DEALS_REFRESH_INTERVAL_MS,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication, {
    once: true,
  });
} else {
  initializeApplication();
}

async function initAccount() {
  state.user = await initAuthUi();
  updateMobileAccountButton();
  syncMobileAuthButtons(state.user);
  onAuthChange(async (user) => {
    state.user = user;
    updateMobileAccountButton();
    syncMobileAuthButtons(user);
    await loadSavedDealsFromApi();
    applyFilters(false);
  });
  await loadSavedDealsFromApi();
}

function bindEvents() {
  els.globalSearch.addEventListener("input", (event) => {
    setSearch(event.target.value, "global");
  });

  els.retailerFilter.addEventListener("change", (event) => {
    state.filters.retailer = event.target.value;
    state.activeRetailer = event.target.value;
    applyFilters();
  });

  els.categoryFilter.addEventListener("change", (event) => {
    state.filters.category = event.target.value;
    applyFilters();
  });

  els.discountFilter.addEventListener("input", (event) => {
    state.filters.minDiscount = Number(event.target.value) || 0;
    els.discountOutput.textContent = `${state.filters.minDiscount}%`;
    applyFilters();
  });

  els.minPriceFilter.addEventListener("input", (event) => {
    state.filters.minPrice = event.target.value;
    applyFilters();
  });

  els.maxPriceFilter.addEventListener("input", (event) => {
    state.filters.maxPrice = event.target.value;
    applyFilters();
  });

  els.stockFilter.addEventListener("change", (event) => {
    state.filters.stock = event.target.value;
    applyFilters();
  });

  els.savedOnlyFilter.addEventListener("change", (event) => {
    state.filters.savedOnly = event.target.checked;
    applyFilters();
  });

  els.sortSelect.addEventListener("change", (event) => {
    state.filters.sort = event.target.value;
    applyFilters();
  });

  els.mobileFiltersToggle?.addEventListener("click", () =>
    toggleFiltersPanel(els),
  );
  els.resetFiltersButton.addEventListener("click", resetFilters);
  els.closeFiltersButton?.addEventListener("click", () =>
    closeFiltersPanel(els),
  );
  els.mobileMenuButton?.addEventListener("click", openMobileMenu);
  els.mobileMenuClose?.addEventListener("click", closeMobileMenu);
  document.addEventListener("click", handleMobileMenuOutsideClick);
  els.mobileSavedButton?.addEventListener("click", () => {
    closeMobileMenu();
    showSavedDeals();
  });
  els.mobileLoginButton?.addEventListener("click", () => {
    closeMobileMenu();
    openAuthModal("login");
  });
  els.mobileRegisterButton?.addEventListener("click", () => {
    closeMobileMenu();
    openAuthModal("register");
  });
  document.getElementById("desktopLoginButton")?.addEventListener("click", () => {
    openAuthModal("login");
  });
  document
    .getElementById("desktopRegisterButton")
    ?.addEventListener("click", () => {
      openAuthModal("register");
    });
  document
    .getElementById("desktopAccountButton")
    ?.addEventListener("click", () => {
      openAuthModal("account");
    });
  els.mobileAccountButton?.addEventListener("click", () => {
    closeMobileMenu();
    openAuthModal("account");
  });
  els.mobileLogoutButton?.addEventListener("click", () => {
    closeMobileMenu();
    logoutFromMobileMenu();
  });
  els.mobileInstallButton?.addEventListener("click", () => {
    closeMobileMenu();
    window.dispatchEvent(new CustomEvent("lekkedeal:install-requested"));
  });
  els.mobileNavDrawer?.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (link) closeMobileMenu();
  });
  els.loadMoreButton?.addEventListener("click", () => showMoreDeals("manual"));
  els.dataCaptureForm?.addEventListener("submit", (event) =>
    submitDataCapture(event, els),
  );
  els.dataCaptureClose?.addEventListener("click", () =>
    dismissDataCaptureModal(els),
  );
  els.dataCaptureModal?.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismissDataCaptureModal(els);
  });
  bindCaptureInputSanitizers(els);
  els.imageViewerClose?.addEventListener("click", () => closeImageViewer(els));
  els.imageViewer?.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeImageViewer(els);
  });
  els.imageViewer?.addEventListener("click", (event) =>
    handleImageViewerBackdrop(event, els),
  );
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!els.dataCaptureModal?.hidden) {
      dismissDataCaptureModal(els);
      return;
    }
    if (!els.imageViewer?.hidden) {
      closeImageViewer(els);
      return;
    }
    closeMobileMenu();
  });

  els.savedHeaderButton.addEventListener("click", showSavedDeals);
  els.savedHeroButton?.addEventListener("click", showSavedDeals);
  els.bestDiscountsButton?.addEventListener("click", showBestDiscounts);
  els.viewPriceChecksButton.addEventListener("click", showBestDiscounts);
  els.priceCheckList.addEventListener("click", (event) => {
    const dealLink = event.target.closest("[data-view-deal]");
    if (dealLink) handleViewDealClick(event);
  });
  els.sideAllCategoriesButton.addEventListener("click", () => setCategory(""));

  els.retailerChips.addEventListener("click", (event) => {
    const button = event.target.closest("[data-retailer]");
    if (!button) return;
    setRetailer(button.dataset.retailer);
  });

  els.retailerChips.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const frame = image.closest(".chip-logo-frame");
      const fallback = frame?.querySelector(".chip-fallback");
      image.hidden = true;
      if (fallback) fallback.hidden = false;
    },
    true,
  );

  els.categoryBreakdown.addEventListener("click", (event) => {
    const button = event.target.closest("[data-category]");
    if (!button) return;
    setCategory(button.dataset.category);
  });

  els.dealsGrid.addEventListener("click", (event) => {
    const shareButton = event.target.closest("[data-share-id]");
    if (shareButton) {
      handleShareDeal(event, shareButton.dataset.shareId, state);
      return;
    }

    const dealLink = event.target.closest("[data-view-deal]");
    if (dealLink) {
      handleViewDealClick(event);
      return;
    }

    const imageZoomButton = event.target.closest("[data-image-zoom-id]");
    if (imageZoomButton) {
      openImageViewer(imageZoomButton.dataset.imageZoomId, {
        dealById: state.dealById,
        els,
      });
      return;
    }

    const button = event.target.closest("[data-save-id]");
    if (!button) return;
    toggleSaved(button.dataset.saveId);
  });

  els.dealsGrid.addEventListener(
    "pointerover",
    (event) => {
      const card = event.target.closest(".deal-card[data-image-url]");
      if (!card) return;
      preloadImage(card.dataset.imageUrl);
    },
    { passive: true },
  );

  els.dealsGrid.addEventListener(
    "load",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      fitDealImage(image);
    },
    true,
  );

  els.dealsGrid.addEventListener(
    "error",
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      image.replaceWith(noImagePlaceholderTemplate(true));
    },
    true,
  );
}

function handleViewDealClick(event) {
  gateViewDealClick(event, state, els);
}

function setupInfiniteScroll() {
  if (!("IntersectionObserver" in window)) {
    window.addEventListener(
      "scroll",
      () => {
        const nearBottom =
          window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 700;
        if (nearBottom && canAutoLoadMore()) showMoreDeals("auto");
      },
      { passive: true },
    );
    return;
  }
  state.infiniteObserver = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      if (canAutoLoadMore()) {
        showMoreDeals("auto");
      }
    },
    { rootMargin: "700px 0px" },
  );
}

function observeInfiniteSentinel() {
  if (!state.infiniteObserver || !els.infiniteSentinel) return;
  state.infiniteObserver.disconnect();
  if (canAutoLoadMore()) {
    state.infiniteObserver.observe(els.infiniteSentinel);
  }
}

function canAutoLoadMore() {
  return (
    state.visibleCount < state.filteredDeals.length &&
    state.autoLoadBatches < AUTO_LOAD_BATCH_LIMIT
  );
}

function setupDealWorker() {
  if (!("Worker" in window)) return;
  try {
    state.filterWorker = new Worker(WORKER_URL);
    state.filterWorker.addEventListener("message", handleWorkerMessage);
    state.filterWorker.addEventListener("error", (error) => {
      console.warn("Deal worker disabled", error.message || error);
      state.workerReady = false;
      state.filterWorker?.terminate();
      state.filterWorker = null;
      applyFiltersOnMain();
    });
  } catch (error) {
    console.warn("Deal worker unavailable", error);
    state.filterWorker = null;
  }
}

function handleWorkerMessage(event) {
  const { type, requestId, dealIds } = event.data || {};
  if (type === "ready") {
    state.workerReady = true;
    applyFilters(false);
    return;
  }

  if (type !== "filtered" || requestId !== state.filterRequestId) return;
  const filteredDeals = dealIds
    .map((dealId) => state.dealById.get(dealId))
    .filter(Boolean);
  applyFilterResult(filteredDeals);
}

async function loadDeals({
  onlyIfChanged = false,
  showLoadingIndicator = true,
} = {}) {
  if (showLoadingIndicator) showLoading(true);
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const responseText = await response.text();
    if (onlyIfChanged && responseText === state.dataSnapshot) return;

    const responseUpdatedAt = normalizeResponseDate(
      response.headers.get("last-modified"),
    );
    state.offlineData = response.headers.get("X-LekkeDeal-Offline") === "true";
    window.dispatchEvent(
      new CustomEvent(
        state.offlineData ? "lekkedeal:offline-data" : "lekkedeal:fresh-data",
      ),
    );
    const rawDeals = JSON.parse(responseText);
    if (!Array.isArray(rawDeals)) {
      throw new Error("all_deals.json must contain an array");
    }

    state.dataSnapshot = responseText;
    state.dataUpdatedAt = responseUpdatedAt;
    state.allDeals = rawDeals.map(normalizeDeal).filter(isValidDeal);
    state.dealById = new Map(
      state.allDeals.map((deal) => [deal._dealId, deal]),
    );
    pruneStaleSavedDealIds();
    state.reviewCounts = getDealReviewCounts();

    buildFilterOptions();
    updateStaticStats();
    updateSavedCount();
    warmImageCache(state.allDeals.slice(0, 36));
    state.filterWorker?.postMessage({ type: "init", deals: state.allDeals });
    applyFilters();
    refreshReviewCountsFromApi();
  } catch (error) {
    console.error("Could not load LekkeDeal data", error);
    if (!showLoadingIndicator && state.allDeals.length) return;
    state.allDeals = [];
    state.filteredDeals = [];
    state.dataSnapshot = "";
    state.dataUpdatedAt = "";
    state.offlineData = false;
    showLoading(false);
    renderEmptyState(
      "Could not load deals.",
      "Make sure webapp/frontend/data/all_deals.json exists and run the app through a web server.",
    );
    updateStaticStats();
  }
}

function loadSavedDeals() {
  state.savedDeals = savedDealsStorage.loadSavedDeals();
  state.savedProductKeys =
    savedDealsStorage.loadSavedProductKeys?.() || new Set();
}

async function toggleSaved(dealId) {
  const deal = state.dealById.get(dealId);
  if (!deal) return;
  const wasSaved = isDealSaved(deal);

  if (isAuthenticated()) {
    try {
      if (wasSaved) {
        await deleteSavedDealFromAccount(dealId, deal._productKey);
        state.savedDeals.delete(dealId);
        if (deal._productKey) state.savedProductKeys.delete(deal._productKey);
      } else {
        await saveDealToAccount(deal);
        state.savedDeals.add(dealId);
        if (deal._productKey) state.savedProductKeys.add(deal._productKey);
      }
      persistSavedDealsMirror();
      updateSavedCount();
      applyFilters(false);
      return;
    } catch (error) {
      if (error.status === 401) {
        openAuthModal("login");
        return;
      }
      console.warn(
        "Backend saved deal sync failed, using local fallback",
        error,
      );
    }
  }

  savedDealsStorage.toggleSavedDeal(state.savedDeals, dealId);
  if (deal._productKey) {
    if (wasSaved) {
      state.savedProductKeys.delete(deal._productKey);
    } else {
      state.savedProductKeys.add(deal._productKey);
    }
    savedDealsStorage.persistSavedProductKeys?.(state.savedProductKeys);
  }
  updateSavedCount();
  applyFilters(false);
}

async function loadSavedDealsFromApi() {
  if (!isAuthenticated()) return;
  try {
    const savedDeals = await fetchSavedDeals();
    state.savedDeals = new Set(
      savedDeals.map((item) => item.dealId).filter(Boolean),
    );
    state.savedProductKeys = new Set(
      savedDeals
        .map((item) => item.productKey || item.snapshot?.productKey)
        .filter(Boolean),
    );
    persistSavedDealsMirror();
    updateSavedCount();
  } catch (error) {
    console.warn("Could not load account saved deals", error);
  }
}

function persistSavedDealsMirror() {
  savedDealsStorage.persistSavedDeals(state.savedDeals);
  savedDealsStorage.persistSavedProductKeys?.(state.savedProductKeys);
}

function updateSavedCount() {
  const count = state.allDeals.length
    ? state.allDeals.filter((deal) => isDealSaved(deal)).length
    : state.savedDeals.size;
  if (els.savedCount) els.savedCount.textContent = count;
  if (els.mobileSavedCount) els.mobileSavedCount.textContent = count;
}

function pruneStaleSavedDealIds() {
  if (!state.allDeals.length || !state.savedDeals.size) return;
  const liveDealIds = new Set(state.allDeals.map((deal) => deal._dealId));
  const beforeSize = state.savedDeals.size;
  state.savedDeals = new Set(
    [...state.savedDeals].filter((dealId) => liveDealIds.has(dealId)),
  );
  if (state.savedDeals.size !== beforeSize) {
    persistSavedDealsMirror();
  }
}

function isDealSaved(deal) {
  return Boolean(
    deal &&
      (state.savedDeals.has(deal._dealId) ||
        (deal._productKey && state.savedProductKeys.has(deal._productKey))),
  );
}

function updateMobileAccountButton() {
  if (!els.mobileAccountButton) return;
  const labelElement = els.mobileAccountButton.querySelector(
    "[data-auth-user-label]",
  );
  if (labelElement) labelElement.textContent = state.user ? "Profile" : "Account";
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
  state.user = null;
  updateMobileAccountButton();
  syncMobileAuthButtons(null);
}

function openMobileMenu() {
  if (!els.mobileNavDrawer || !els.mobileMenuButton) return;
  els.mobileNavDrawer.hidden = false;
  els.mobileMenuButton.setAttribute("aria-expanded", "true");
  document.body.classList.add("mobile-menu-open");
}

function closeMobileMenu() {
  if (!els.mobileNavDrawer || !els.mobileMenuButton) return;
  els.mobileNavDrawer.hidden = true;
  els.mobileMenuButton.setAttribute("aria-expanded", "false");
  document.body.classList.remove("mobile-menu-open");
}

function handleMobileMenuOutsideClick(event) {
  if (!els.mobileNavDrawer || els.mobileNavDrawer.hidden) return;
  if (els.mobileNavDrawer.contains(event.target)) return;
  if (els.mobileMenuButton?.contains(event.target)) return;
  closeMobileMenu();
}

function setSearch(value, source) {
  const safeValue = sanitizeSearchText(value);
  if (source !== "global") els.globalSearch.value = safeValue;
  window.clearTimeout(state.searchDebounceTimer);
  if (!safeValue) {
    commitSearch(safeValue);
    return;
  }
  state.searchDebounceTimer = window.setTimeout(() => {
    commitSearch(safeValue);
  }, SEARCH_DEBOUNCE_MS);
}

function commitSearch(value) {
  state.filters.search = value;
  applyFilters();
  queueSearchResultsFocus(value);
}

function queueSearchResultsFocus(value) {
  window.clearTimeout(state.searchScrollTimer);
  if (value.length < 2) return;
  state.searchScrollTimer = window.setTimeout(() => {
    document
      .getElementById("deals")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 280);
}
function setRetailer(retailer) {
  state.filters.retailer = retailer;
  state.activeRetailer = retailer;
  els.retailerFilter.value = retailer;
  applyFilters();
}

function setCategory(category) {
  state.filters.category = category;
  els.categoryFilter.value = category;
  applyFilters();
}

function showSavedDeals() {
  state.filters.savedOnly = true;
  els.savedOnlyFilter.checked = true;
  applyFilters();
  document.getElementById("deals").scrollIntoView({ block: "start" });
}

function showBestDiscounts() {
  state.filters.sort = "discount-desc";
  els.sortSelect.value = "discount-desc";
  applyFilters();
  document.getElementById("deals").scrollIntoView({ block: "start" });
}

function resetFilters() {
  state.filters = {
    search: "",
    retailer: "",
    category: "",
    minDiscount: 0,
    minPrice: "",
    maxPrice: "",
    stock: "",
    savedOnly: false,
    sort: "discount-desc",
  };
  state.activeRetailer = "";
  window.clearTimeout(state.searchDebounceTimer);
  window.clearTimeout(state.searchScrollTimer);
  els.globalSearch.value = "";
  els.retailerFilter.value = "";
  els.categoryFilter.value = "";
  els.discountFilter.value = "0";
  els.discountOutput.textContent = "0%";
  els.minPriceFilter.value = "";
  els.maxPriceFilter.value = "";
  els.stockFilter.value = "";
  els.savedOnlyFilter.checked = false;
  els.sortSelect.value = "discount-desc";
  applyFilters();
}

function buildFilterOptions() {
  buildFilterOptionsView({
    deals: state.allDeals,
    retailerFilter: els.retailerFilter,
    categoryFilter: els.categoryFilter,
    retailerChips: els.retailerChips,
    renderBreakdowns,
  });
}

function updateStaticStats() {
  const total = state.allDeals.length;
  const retailers = new Set(state.allDeals.map((deal) => deal.retailer)).size;
  const discountDeals = state.allDeals.filter(
    (deal) => deal.discount_percent > 0,
  );
  const averageDiscount = discountDeals.length
    ? Math.round(
        discountDeals.reduce((sum, deal) => sum + deal.discount_percent, 0) /
          discountDeals.length,
      )
    : 0;
  const best = [...state.allDeals].sort(
    (a, b) => b.discount_percent - a.discount_percent,
  )[0];
  const latest = [...state.allDeals]
    .filter((deal) => deal.scraped_at)
    .sort((a, b) => new Date(b.scraped_at) - new Date(a.scraped_at))[0];

  if (els.headerTotalDeals)
    els.headerTotalDeals.textContent = formatNumber(total);
  if (els.statTotalDeals) els.statTotalDeals.textContent = formatNumber(total);
  if (els.statRetailers) els.statRetailers.textContent = retailers;
  if (els.statAverageDiscount)
    els.statAverageDiscount.textContent = `${averageDiscount}%`;
  if (els.statBestDiscount)
    els.statBestDiscount.textContent = best
      ? `${best.discount_percent}%`
      : "0%";
  if (els.statBestDiscountRetailer)
    els.statBestDiscountRetailer.textContent = best
      ? `${best.retailer} deal`
      : "Waiting for data";
  const lastUpdatedAt = state.dataUpdatedAt || latest?.scraped_at;
  const lastUpdatedText = lastUpdatedAt
    ? `${state.offlineData ? "Stored deals · updated" : "Updated"} ${formatDateTime(lastUpdatedAt)}`
    : "Updated time unavailable";
  setLatestDropPublishedAt(els, lastUpdatedAt);
  if (els.lastUpdated) els.lastUpdated.textContent = lastUpdatedText;
  if (els.headerLastUpdated) {
    els.headerLastUpdated.textContent = lastUpdatedText;
  }
  if (els.mobileLastUpdated) els.mobileLastUpdated.textContent = lastUpdatedText;
}

function normalizeResponseDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function applyFilters(resetVisible = true) {
  if (resetVisible) {
    state.visibleCount = PAGE_SIZE;
    state.autoLoadBatches = 0;
  }

  if (state.workerReady && state.filterWorker) {
    state.filterWorker.postMessage({
      type: "filter",
      requestId: ++state.filterRequestId,
      filters: state.filters,
      savedIds: [...state.savedDeals],
      savedProductKeys: [...state.savedProductKeys],
    });
    return;
  }

  applyFiltersOnMain();
}

function applyFiltersOnMain() {
  const filters = state.filters;
  const search = normalizeText(filters.search);
  const minDiscount = Number(filters.minDiscount) || 0;
  const minPrice = parsePrice(filters.minPrice);
  const maxPrice = parsePrice(filters.maxPrice);

  const filteredDeals = state.allDeals.filter((deal) => {
    if (search && !deal._searchText.includes(search)) return false;
    if (filters.retailer && deal.retailer !== filters.retailer) return false;
    if (filters.category && deal.category !== filters.category) return false;
    if (minDiscount && deal.discount_percent < minDiscount) return false;
    if (
      Number.isFinite(minPrice) &&
      (!Number.isFinite(deal.current_price) || deal.current_price < minPrice)
    )
      return false;
    if (
      Number.isFinite(maxPrice) &&
      (!Number.isFinite(deal.current_price) || deal.current_price > maxPrice)
    )
      return false;
    if (
      filters.stock &&
      normalizedStockForFilter(deal.stock_status) !== filters.stock
    )
      return false;
    if (filters.savedOnly && !isDealSaved(deal)) return false;
    return true;
  });

  sortDeals(filteredDeals, filters.sort);
  applyFilterResult(filteredDeals);
}

function applyFilterResult(filteredDeals) {
  const expanded = expandSearchWhenEmpty(filteredDeals);
  state.filteredDeals = expanded.deals;
  state.searchFallbackNotice = expanded.notice;
  state.searchFallbackActive = expanded.isExpanded;
  updateActiveChips();
  updateResultSummary();
  renderPriceChecks();
  renderDeals();
}

function expandSearchWhenEmpty(filteredDeals) {
  const search = normalizeText(state.filters.search);
  if (filteredDeals.length || !search) {
    return { deals: filteredDeals, notice: "", isExpanded: false };
  }

  if (state.filters.savedOnly) {
    return {
      deals: [],
      notice: `Search result not found in saved deals for "${cleanValue(state.filters.search)}".`,
      isExpanded: false,
    };
  }

  const expandedDeals = state.allDeals.filter((deal) =>
    deal._searchText.includes(search),
  );
  sortDeals(expandedDeals, state.filters.sort);

  if (!expandedDeals.length) {
    return {
      deals: [],
      notice: `Search result not found for "${cleanValue(state.filters.search)}".`,
      isExpanded: false,
    };
  }

  return {
    deals: expandedDeals,
    notice: buildExpandedSearchNotice(expandedDeals),
    isExpanded: true,
  };
}

function buildExpandedSearchNotice(deals) {
  const filterParts = [];
  if (state.filters.retailer) filterParts.push(state.filters.retailer);
  if (state.filters.category) filterParts.push(state.filters.category);
  if (Number(state.filters.minDiscount) > 0)
    filterParts.push(`${state.filters.minDiscount}%+ discount`);
  if (
    cleanValue(state.filters.minPrice) ||
    cleanValue(state.filters.maxPrice)
  ) {
    const min = cleanValue(state.filters.minPrice) || "0";
    const max = cleanValue(state.filters.maxPrice) || "any";
    filterParts.push(`R${min}-R${max}`);
  }
  if (state.filters.stock)
    filterParts.push(stockStatusLabel(state.filters.stock));

  const retailers = uniqueSorted(deals.map((deal) => deal.retailer)).slice(
    0,
    4,
  );
  const retailerText = retailers.length
    ? ` Found from ${retailers.join(", ")}${new Set(deals.map((deal) => deal.retailer)).size > retailers.length ? " and more" : ""}.`
    : "";
  const filterText = filterParts.length
    ? ` in ${filterParts.join(", ")}`
    : " with the selected filters";
  return `No exact match for "${cleanValue(state.filters.search)}"${filterText}. Showing broader search results.${retailerText}`;
}
function normalizedStockForFilter(stockStatus) {
  if (stockStatus === "in_stock" || stockStatus === "out_of_stock")
    return stockStatus;
  return "unknown";
}

function sortDeals(deals, sort) {
  const collator = new Intl.Collator("en-ZA");
  const byNewest = (a, b) => safeDate(b.scraped_at) - safeDate(a.scraped_at);
  const sorters = {
    "discount-desc": (a, b) =>
      b.discount_percent - a.discount_percent || byNewest(a, b),
    "price-asc": (a, b) =>
      comparablePrice(a, "asc") - comparablePrice(b, "asc"),
    "price-desc": (a, b) =>
      comparablePrice(b, "desc") - comparablePrice(a, "desc"),
    newest: byNewest,
    "retailer-asc": (a, b) =>
      collator.compare(a.retailer, b.retailer) ||
      collator.compare(a.title, b.title),
    "title-asc": (a, b) => collator.compare(a.title, b.title),
  };
  deals.sort(sorters[sort] || sorters["discount-desc"]);
}

function safeDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function comparablePrice(deal, direction) {
  if (Number.isFinite(deal.current_price)) return deal.current_price;
  return direction === "asc"
    ? Number.POSITIVE_INFINITY
    : Number.NEGATIVE_INFINITY;
}

function updateActiveChips() {
  els.retailerChips.querySelectorAll("[data-retailer]").forEach((button) => {
    button.classList.toggle(
      "is-active",
      button.dataset.retailer === state.activeRetailer,
    );
  });
}

function updateResultSummary() {
  const total = state.filteredDeals.length;
  const shown = Math.min(total, state.visibleCount);
  if (els.searchScopeNotice) {
    els.searchScopeNotice.hidden = !state.searchFallbackNotice;
    els.searchScopeNotice.textContent = state.searchFallbackNotice || "";
  }
  if (state.searchFallbackNotice) {
    els.resultSummary.textContent = total
      ? `Showing ${formatNumber(shown)} of ${formatNumber(total)} broader result${total === 1 ? "" : "s"}`
      : "";
    els.renderCount.textContent = total
      ? `${formatNumber(total)} broader result${total === 1 ? "" : "s"}`
      : "";
  } else {
    els.resultSummary.textContent = total
      ? `Showing ${formatNumber(shown)} of ${formatNumber(total)} deals`
      : "";
    els.renderCount.textContent = "";
  }
  if (els.visibleDealCount)
    els.visibleDealCount.textContent = `${formatNumber(total)} visible now`;
}

function renderDeals() {
  showLoading(false);
  els.dealsGrid.innerHTML = "";
  els.emptyState.hidden = true;

  if (!state.filteredDeals.length) {
    if (state.searchFallbackNotice) {
      renderEmptyState("Search result not found.", state.searchFallbackNotice);
    } else {
      els.emptyState.hidden = true;
    }
    updateLoadMoreButton();
    observeInfiniteSentinel();
    return;
  }

  const visibleDeals = state.filteredDeals.slice(0, state.visibleCount);
  els.dealsGrid.innerHTML = visibleDeals
    .map((deal, index) => renderDealCard(deal, index))
    .join("");
  warmImageCache(visibleDeals.slice(0, 18));
  updateLoadMoreButton();
  observeInfiniteSentinel();
  maybeRevealSharedDeal();
}

function updateLoadMoreButton() {
  if (!els.loadMoreButton) return;
  const remaining = Math.max(
    0,
    state.filteredDeals.length - state.visibleCount,
  );
  if (!remaining) {
    els.loadMoreButton.hidden = true;
    els.loadMoreButton.textContent = "";
    return;
  }
  const shouldShow = remaining > 0 && !canAutoLoadMore();
  els.loadMoreButton.hidden = !shouldShow;
  els.loadMoreButton.textContent = shouldShow
    ? `Load more deals (${formatNumber(remaining)} left)`
    : "";
}

function renderDealCard(deal, index) {
  return dealCardTemplate(
    deal,
    index,
    isDealSaved(deal),
    stockStatusLabel(deal.stock_status),
    getReviewCountForDeal(deal),
  );
}

function getReviewCountForDeal(deal) {
  const dealCount = state.reviewCounts.deals?.get(deal._dealId) || 0;
  const productCount = state.reviewCounts.products?.get(deal._productKey) || 0;
  return Math.max(dealCount, productCount);
}

async function refreshReviewCountsFromApi() {
  if (!state.allDeals.length) return;
  try {
    const counts = await fetchReviewCounts({
      dealIds: state.allDeals.map((deal) => deal._dealId).filter(Boolean),
      productKeys: state.allDeals
        .map((deal) => deal._productKey)
        .filter(Boolean),
    });
    state.reviewCounts = mergeReviewCounts(getDealReviewCounts(), counts);
    renderDeals();
  } catch (error) {
    if (error.code === "API_OFFLINE") return;
    console.warn("Could not load review counts", error);
  }
}

function mergeReviewCounts(localCounts, apiCounts) {
  return {
    deals: mergeCountRows(localCounts.deals, apiCounts.deals),
    products: mergeCountRows(localCounts.products, apiCounts.products),
  };
}

function mergeCountRows(localMap, apiRows) {
  const merged = new Map(localMap);
  (apiRows || []).forEach((row) => {
    if (!row?.key) return;
    merged.set(row.key, Math.max(merged.get(row.key) || 0, Number(row.count) || 0));
  });
  return merged;
}

function getSharedDealIdFromLocation() {
  const params = new URLSearchParams(window.location.search);
  return cleanValue(params.get("deal"));
}

function stockStatusLabel(stockStatus) {
  if (stockStatus === "in_stock") return "In stock";
  if (stockStatus === "out_of_stock") return "Out of stock";
  return "Stock unknown";
}

function showMoreDeals(mode = "manual") {
  if (mode === "auto") state.autoLoadBatches += 1;
  state.visibleCount = Math.min(
    state.filteredDeals.length,
    state.visibleCount + PAGE_SIZE,
  );
  updateResultSummary();
  renderDeals();
}

function renderEmptyState(title, body) {
  els.emptyState.hidden = false;
  els.emptyState.innerHTML = `<h3>${escapeHtml(title)}</h3><p>${escapeHtml(body)}</p>`;
}

function showLoading(isLoading) {
  els.loadingState.hidden = true;
}

function renderPriceChecks() {
  const groups = buildPriceCheckGroups(state.filteredDeals);
  els.priceCheckList.innerHTML = groups.length
    ? groups.slice(0, 6).map(priceCheckTemplate).join("")
    : `<section class="empty-state"><h3>No price checks yet.</h3><p>More overlapping products will appear here as scraped data grows.</p></section>`;
}

function maybeRevealSharedDeal() {
  const dealId = state.sharedDealId;
  if (!dealId || state.sharedDealHandled) return;

  const dealIndex = state.filteredDeals.findIndex(
    (deal) => deal._dealId === dealId,
  );
  if (dealIndex === -1) return;

  if (dealIndex >= state.visibleCount) {
    state.visibleCount = Math.ceil((dealIndex + 1) / PAGE_SIZE) * PAGE_SIZE;
    renderDeals();
    return;
  }

  const selector = `.deal-card[data-deal-id="${cssEscape(dealId)}"]`;
  const card = els.dealsGrid.querySelector(selector);
  if (!card) return;

  state.sharedDealHandled = true;
  requestAnimationFrame(() => {
    card.classList.add("is-spotlight");
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => card.classList.remove("is-spotlight"), 3600);
  });
}

function renderBreakdowns(retailers, categories) {
  const categoryCounts = countBy(
    state.allDeals,
    (deal) => deal.category || "Other",
  );

  els.categoryBreakdown.innerHTML = categories
    .map((category) =>
      breakdownTemplate(
        category,
        categoryCounts.get(category) || 0,
        "category",
      ),
    )
    .join("");
}
