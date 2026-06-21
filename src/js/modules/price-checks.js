import { normalizeText } from "./text-sanitization.js";

export function buildPriceCheckGroups(deals) {
  const groupMap = new Map();

  deals.forEach((deal) => {
    const key = groupKey(deal);
    if (!key) return;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key).push(deal);
  });

  const groups = [...groupMap.values()]
    .filter((items) => items.length > 1)
    .map((items) => {
      const sorted = [...items].sort(
        (a, b) => comparablePrice(a) - comparablePrice(b),
      );
      const best = sorted[0];
      const pricedItems = sorted.filter((item) =>
        Number.isFinite(item.current_price),
      );
      const highest = pricedItems[pricedItems.length - 1] || best;
      return {
        title: best.title,
        best,
        count: sorted.length,
        spread:
          Number.isFinite(highest.current_price) &&
          Number.isFinite(best.current_price)
            ? highest.current_price - best.current_price
            : 0,
        discount: best.discount_percent,
      };
    })
    .sort((a, b) => b.spread - a.spread || b.discount - a.discount);

  if (groups.length) return groups;

  return [...deals]
    .filter((deal) => deal.discount_amount > 0 || deal.discount_percent > 0)
    .sort(
      (a, b) =>
        b.discount_amount - a.discount_amount ||
        b.discount_percent - a.discount_percent,
    )
    .slice(0, 6)
    .map((deal) => ({
      title: deal.title,
      best: deal,
      count: 1,
      spread: 0,
      discount: deal.discount_percent,
    }));
}

function groupKey(deal) {
  const brandModel = normalizeText(
    [deal.brand, deal.model].filter(Boolean).join(" "),
  );
  if (brandModel.length > 5) return `bm:${brandModel}`;

  const tokens = normalizeText(deal.title)
    .split(" ")
    .filter((token) => token.length > 2 && !/^\d+$/.test(token))
    .slice(0, 6);
  if (tokens.length < 3) return "";
  return `title:${tokens.join(" ")}`;
}

function comparablePrice(deal) {
  return Number.isFinite(deal.current_price)
    ? deal.current_price
    : Number.POSITIVE_INFINITY;
}
