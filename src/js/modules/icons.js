export async function injectIconSprite(url = "src/components/icons.svg") {
  if (document.querySelector(".icon-sprite")) return;
  try {
    const response = await fetch(url);
    if (!response.ok) return;
    const sprite = await response.text();
    document.body.insertAdjacentHTML("afterbegin", sprite);
  } catch (error) {
    console.warn("Icon sprite failed to load", error);
  }
}
