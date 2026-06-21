import { formatPrice } from "./deal-normalization.js";
import { usableImageUrl } from "./image-handling.js";
import { safeHttpUrl } from "./text-sanitization.js";

export function fitDealImage(image) {
  const width = image.naturalWidth || 1;
  const height = image.naturalHeight || 1;
  const ratio = width / height;
  const wrap = image.closest(".image-wrap");
  if (!wrap) return;

  wrap.classList.remove(
    "image-panoramic",
    "image-wide",
    "image-tall",
    "image-square",
    "image-standard",
  );

  if (ratio >= 2.7) {
    wrap.classList.add("image-panoramic");
  } else if (ratio >= 1.55) {
    wrap.classList.add("image-wide");
  } else if (ratio <= 0.62) {
    wrap.classList.add("image-tall");
  } else if (ratio >= 0.85 && ratio <= 1.18) {
    wrap.classList.add("image-square");
  } else {
    wrap.classList.add("image-standard");
  }

  image.classList.add("is-fitted");
}

export function openImageViewer(dealId, { dealById, els }) {
  const deal = dealById.get(dealId);
  if (!deal || !els.imageViewer || !els.imageViewerImage) return;
  const imageUrl = usableImageUrl(deal.image_url);
  if (!imageUrl) return;

  openDialogElement(els.imageViewer);
  els.imageViewerImage.src = imageUrl;
  els.imageViewerImage.alt = deal.title;
  els.imageViewerTitle.textContent = deal.title;
  els.imageViewerRetailer.textContent = deal.retailer || "Retailer";
  els.imageViewerPrice.textContent = formatPrice(deal.current_price);

  const safeProductUrl = safeHttpUrl(deal.product_url);
  if (safeProductUrl) {
    els.imageViewerLink.hidden = false;
    els.imageViewerLink.href = safeProductUrl;
    els.imageViewerLink.setAttribute("data-view-deal", deal._dealId);
  } else {
    els.imageViewerLink.hidden = true;
    els.imageViewerLink.removeAttribute("href");
    els.imageViewerLink.removeAttribute("data-view-deal");
  }

  document.body.classList.add("modal-open");
}

export function closeImageViewer(els) {
  if (!els.imageViewer) return;
  closeDialogElement(els.imageViewer);
  if (els.imageViewerImage) {
    els.imageViewerImage.removeAttribute("src");
    els.imageViewerImage.alt = "";
  }
  document.body.classList.remove("modal-open");
}

export function handleImageViewerBackdrop(event, els) {
  if (event.target === els.imageViewer) {
    closeImageViewer(els);
  }
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
