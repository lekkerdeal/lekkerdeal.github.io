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
  const register = () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  };
  if (document.readyState === "complete") {
    register();
  } else {
    window.addEventListener("load", register, { once: true });
  }
}

let networkStatusInitialized = false;
let networkWasOffline = !navigator.onLine;
let networkStatusTimer = 0;

export function initializeNetworkStatus() {
  if (networkStatusInitialized) return;
  networkStatusInitialized = true;
  window.addEventListener("offline", showOfflineStatus);
  window.addEventListener("online", handleNetworkRestored);
  window.addEventListener("lekkedeal:offline-data", showOfflineStatus);
  window.addEventListener("lekkedeal:fresh-data", hideNetworkStatus);
  if (!navigator.onLine) showOfflineStatus();
}

function showOfflineStatus() {
  networkWasOffline = true;
  showNetworkStatus("Offline.", "offline");
}

function handleNetworkRestored() {
  if (!networkWasOffline) return;
  networkWasOffline = false;
  showNetworkStatus("Back online · updating content", "online");
  window.dispatchEvent(new CustomEvent("lekkedeal:network-restored"));
  window.clearTimeout(networkStatusTimer);
  networkStatusTimer = window.setTimeout(hideNetworkStatus, 2800);
}

function showNetworkStatus(message, state) {
  const status = ensureNetworkStatus();
  window.clearTimeout(networkStatusTimer);
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = false;
}

function hideNetworkStatus() {
  if (!navigator.onLine) return;
  networkWasOffline = false;
  const status = document.getElementById("networkStatus");
  if (status) status.hidden = true;
}

function ensureNetworkStatus() {
  let status = document.getElementById("networkStatus");
  if (status) return status;
  status = document.createElement("p");
  status.id = "networkStatus";
  status.className = "network-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.hidden = true;
  document.body.append(status);
  return status;
}

let deferredInstallPrompt = null;
let installControllerInitialized = false;

export function initializePwaInstallation() {
  if (installControllerInitialized) {
    updateInstallButtons();
    return;
  }
  installControllerInitialized = true;
  window.addEventListener("beforeinstallprompt", captureInstallPrompt);
  window.addEventListener("appinstalled", handleAppInstalled);
  window.addEventListener("lekkedeal:install-requested", handleInstallRequest);
  updateInstallButtons();
}

function captureInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallButtons();
}

async function handleInstallRequest() {
  if (isInstalled()) {
    showInstallMessage("LekkeDeal is already installed on this device.");
    updateInstallButtons();
    return;
  }

  if (!deferredInstallPrompt) {
    showInstallMessage(installInstructions());
    return;
  }

  setInstallButtonsBusy(true);
  const prompt = deferredInstallPrompt;
  deferredInstallPrompt = null;
  try {
    await prompt.prompt();
    await prompt.userChoice;
  } finally {
    setInstallButtonsBusy(false);
    updateInstallButtons();
  }
}

function handleAppInstalled() {
  deferredInstallPrompt = null;
  updateInstallButtons();
  showInstallMessage("LekkeDeal was installed successfully.");
}

function updateInstallButtons() {
  const installed = isInstalled();
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.disabled = installed;
    button.textContent = installed ? "Web-app installed" : "Install web-app";
  });
}

function setInstallButtonsBusy(isBusy) {
  document.querySelectorAll("[data-install-app]").forEach((button) => {
    button.disabled = isBusy;
    button.textContent = isBusy ? "Opening install..." : "Install web-app";
  });
}

function isInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function installInstructions() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (isIos) {
    return "In Safari, tap Share and then Add to Home Screen to install LekkeDeal.";
  }
  return "Open your browser menu and choose Install app or Add to Home screen. Installation is available only over HTTPS in a supported browser.";
}

function showInstallMessage(message) {
  let dialog = document.getElementById("pwaInstallDialog");
  if (!dialog) {
    dialog = document.createElement("dialog");
    dialog.id = "pwaInstallDialog";
    dialog.className = "pwa-install-dialog";
    dialog.innerHTML = `
      <article>
        <button type="button" aria-label="Close install message" data-close-install-message>&times;</button>
        <h2>Install LekkeDeal</h2>
        <p></p>
      </article>
    `;
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog || event.target.closest("[data-close-install-message]")) {
        dialog.close();
      }
    });
    document.body.append(dialog);
  }
  dialog.querySelector("p").textContent = message;
  if (!dialog.open) dialog.showModal();
}
