import { SITE_URL } from "./application-config.js";
import { formatPrice } from "./deal-normalization.js";

export async function handleShareDeal(event, dealId, { dealById }) {
  event.preventDefault();
  const deal = dealById.get(dealId);
  if (!deal) return;

  const price = formatPrice(deal.current_price);
  const shareUrl = buildDealSiteUrl(deal);
  const shareText = `${deal.title} - ${price} - ${deal.retailer}. See this deal on LekkeDeal.`;
  const shareData = {
    title: `${deal.title} | LekkeDeal`,
    text: shareText,
    url: shareUrl,
  };

  if (
    navigator.share &&
    (!navigator.canShare || navigator.canShare(shareData))
  ) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.warn("Native share failed, falling back", error);
    }
  }

  const fallbackText = `${shareText} ${shareUrl}`;
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(fallbackText);
      window.alert("Deal link copied. You can now paste and share it.");
      return;
    } catch (error) {
      console.warn("Clipboard copy failed", error);
    }
  }

  const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(fallbackText)}`;
  window.open(fallbackUrl, "_blank", "noopener,noreferrer");
}

function buildDealSiteUrl(deal) {
  const target = new URL(SITE_URL);
  target.searchParams.set("deal", deal._dealId);
  return target.toString();
}
