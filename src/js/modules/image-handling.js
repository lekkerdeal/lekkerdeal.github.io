import { PLACEHOLDER_IMAGE_RE } from "./application-config.js";
import { cleanValue } from "./text-sanitization.js";

export function usableImageUrl(imageUrl) {
  const cleaned = cleanValue(imageUrl);
  if (
    !cleaned ||
    cleaned.startsWith("data:") ||
    PLACEHOLDER_IMAGE_RE.test(cleaned)
  )
    return "";
  return cleaned;
}

export function noImagePlaceholderTemplate(isNode = false) {
  const html = `<span class="no-image-art" role="img" aria-label="No product image available"></span>`;
  if (!isNode) return html;
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function warmImageCache(deals) {
  const urls = [
    ...new Set(
      deals.map((deal) => usableImageUrl(deal.image_url)).filter(Boolean),
    ),
  ];
  const warm = () => urls.forEach(preloadImage);
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warm, { timeout: 1200 });
  } else {
    window.setTimeout(warm, 80);
  }
}

export function preloadImage(imageUrl) {
  const url = usableImageUrl(imageUrl);
  if (!url) return;
  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.src = url;
}
