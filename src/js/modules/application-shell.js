export function setupScrollHeader() {
  const update = () => {
    document.body.classList.toggle("has-scrolled", window.scrollY > 72);
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}

export function toggleMobileFilters(els) {
  const layout = document.querySelector(".catalog-layout");
  if (!layout || !els.mobileFiltersToggle) return;
  const isOpen = layout.classList.toggle("is-filters-open");
  els.mobileFiltersToggle.setAttribute("aria-expanded", String(isOpen));
}

export function closeMobileFilters(els) {
  const layout = document.querySelector(".catalog-layout");
  if (!layout || !els.mobileFiltersToggle) return;
  layout.classList.remove("is-filters-open");
  els.mobileFiltersToggle.setAttribute("aria-expanded", "false");
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
