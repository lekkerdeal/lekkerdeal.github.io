export function startRaidCountdown(elements) {
  updateRaidCountdown(elements);
  window.setInterval(() => updateRaidCountdown(elements), 60 * 1000);
}

function updateRaidCountdown(elements) {
  if (!elements.raidCountdown && !elements.mobileRaidCountdown) return;
  const now = new Date();
  const nextDrop = getNextDropDate(now);
  const diffMs = Math.max(0, nextDrop - now);
  const days = Math.floor(diffMs / 86400000);
  const hours = Math.floor((diffMs % 86400000) / 3600000);
  const countdownLabel = `Next Lekke Drop in: ${days} Days ${hours} Hours`;
  if (elements.raidCountdown) elements.raidCountdown.textContent = countdownLabel;
  if (elements.mobileRaidCountdown) {
    elements.mobileRaidCountdown.textContent = countdownLabel;
  }
}

function getNextDropDate(now) {
  const dropDays = [2, 5];
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(now);
    candidate.setDate(now.getDate() + offset);
    candidate.setHours(9, 0, 0, 0);
    if (dropDays.includes(candidate.getDay()) && candidate > now) {
      return candidate;
    }
  }

  const fallback = new Date(now);
  fallback.setDate(now.getDate() + 1);
  fallback.setHours(9, 0, 0, 0);
  return fallback;
}
