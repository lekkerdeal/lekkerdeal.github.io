export async function loadHtmlPartials(root = document) {
  const partials = [...root.querySelectorAll("[data-html-partial]")];
  if (!partials.length) return;

  await Promise.all(
    partials.map(async (element) => {
      const partialPath = element.dataset.htmlPartial;
      const response = await fetch(partialPath);
      if (!response.ok) {
        throw new Error(`Unable to load HTML partial: ${partialPath}`);
      }
      element.outerHTML = await response.text();
    }),
  );
}
