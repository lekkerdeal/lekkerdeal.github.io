export const DATA_URL = `data/all_deals.json?v=${Date.now()}`;
export const DEALS_REFRESH_INTERVAL_MS = 60 * 1000;
export const SAVED_KEY = "lekkedeal_saved_deals";
export const SAVED_PRODUCT_KEYS_KEY = "lekkedeal_saved_product_keys";
export const LEGACY_SAVED_KEY = `deal${"raiders"}_saved_deals`;
export const CAPTURE_KEY = "lekkedeal_data_capture";
export const VIEW_CLICK_KEY = "lekkedeal_view_deal_clicks";
export const CAPTURE_DISMISSED_KEY = "lekkedeal_capture_dismissed_session";
export const CAPTURE_DELAY_MS = 5 * 60 * 1000;
export const SITE_URL = "https://lekkedeal.co.za/";
export const PAGE_SIZE = 24;
export const AUTO_LOAD_BATCH_LIMIT = 0;
export const WORKER_URL = "src/js/dealFilteringWorker.js";
export const SEARCH_DEBOUNCE_MS = 160;
export const PLACEHOLDER_IMAGE_RE = /\/sample\.[a-f0-9]+\.png(?:$|\?)/i;
export const POWER_CATEGORIES = [
  "Tech",
  "Appliances",
  "DIY",
  "Fashion",
  "Baby",
  "Essentials",
];
export const PROVINCE_OPTIONS = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "Northern Cape",
  "North West",
  "Western Cape",
];
export const ALLOWED_PROVINCES = new Set(PROVINCE_OPTIONS);
export const RETAILER_LOGO_PATHS = {
  Builders: "assets/retailers/icons/builders.ico",
  "Computer Mania": "assets/retailers/icons/computer-mania.svg",
  DirectDeals: "assets/retailers/directdeals.svg",
  EveryMonday: "assets/retailers/icons/everymonday.jpg",
  ExpertStores: "assets/retailers/icons/expertstores.ico",
  FirstShop: "assets/retailers/icons/firstshop.png",
  GeeWiz: "assets/retailers/icons/geewiz.ico",
  "HiFi Corp": "assets/retailers/icons/hifi-corp.webp",
  Incredible: "assets/retailers/icons/incredible.webp",
  "Leroy Merlin": "assets/retailers/icons/leroy-merlin.png",
  Loot: "assets/retailers/icons/loot.ico",
  Makro: "assets/retailers/icons/makro.webp",
  OneDayOnly: "assets/retailers/icons/onedayonly.ico",
  Tafelberg: "assets/retailers/icons/tafelberg.ico",
  Woolworths: "assets/retailers/icons/woolworths.png",
  Wootware: "assets/retailers/icons/wootware.ico",
};
