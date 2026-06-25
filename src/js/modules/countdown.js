let latestDropPublishedAt = null;
const DROP_INTERVAL_MS = 72 * 60 * 60 * 1000;

export function startRaidCountdown(elements) {
  updateRaidCountdown(elements);
  window.setInterval(() => updateRaidCountdown(elements), 60 * 1000);
}

export function setLatestDropPublishedAt(elements, value) {
  const date = value ? new Date(value) : null;
  latestDropPublishedAt = date && !Number.isNaN(date.getTime()) ? date : null;
  updateRaidCountdown(elements);
}

function updateRaidCountdown(elements) {
  if (!elements.raidCountdown && !elements.mobileRaidCountdown) return;
  const now = new Date();
  const nextDrop = getNextDropDate(now, latestDropPublishedAt);
  const diffMs = Math.max(0, nextDrop - now);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const countdownLabel = `Next Lekke Drop in: ${days} Days ${hours} Hours`;
  if (elements.raidCountdown) elements.raidCountdown.textContent = countdownLabel;
  if (elements.mobileRaidCountdown) {
    elements.mobileRaidCountdown.textContent = countdownLabel;
  }
}

function getNextDropDate(now, latestPublishedAt = null) {
  if (latestPublishedAt) {
    return new Date(latestPublishedAt.getTime() + DROP_INTERVAL_MS);
  }
  return new Date(now.getTime() + DROP_INTERVAL_MS);
}
