import { submitVehicleTrackerQuote } from "../api/partner-offers-api.js";

export function initializePartnerOffers() {
  initializeCottonCarousel();
  const openButtons = [...document.querySelectorAll("[data-open-vehicle-tracker]")];
  const closeButton = document.getElementById("closeVehicleTracker");
  const modal = document.getElementById("vehicleTrackerModal");
  const form = document.getElementById("vehicleTrackerForm");
  const status = document.getElementById("vehicleTrackerStatus");
  if (!openButtons.length || !closeButton || !modal || !form || !status) return;

  openButtons.forEach((button) => button.addEventListener("click", () => modal.showModal()));
  closeButton.addEventListener("click", () => modal.close());
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.close();
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = form.querySelector('[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    status.className = "partner-modal__status";
    status.textContent = "Sending your request...";
    try {
      await submitVehicleTrackerQuote({
        firstName: data.get("firstName"), lastName: data.get("lastName"),
        phoneNumber: data.get("phoneNumber"), acceptTerms: data.get("acceptTerms") === "on",
      });
      form.reset();
      status.classList.add("is-success");
      status.textContent = "Your quote request was sent successfully.";
    } catch (error) {
      status.classList.add("is-error");
      status.textContent = error.message || "Your request could not be sent. Please try again.";
    } finally { button.disabled = false; }
  });
}

function initializeCottonCarousel() {
  const carousel = document.querySelector("[data-cotton-carousel]");
  if (!carousel) return;
  const slides = [...carousel.querySelectorAll(".cotton-carousel__slides img")];
  let index = 0;
  let timer = null;
  const show = (nextIndex) => {
    index = (nextIndex + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === index));
  };
  const stop = () => { window.clearInterval(timer); timer = null; };
  const start = () => {
    stop();
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setInterval(() => show(index + 1), 4500);
    }
  };
  carousel.querySelector("[data-cotton-previous]")?.addEventListener("click", () => { show(index - 1); start(); });
  carousel.querySelector("[data-cotton-next]")?.addEventListener("click", () => { show(index + 1); start(); });
  carousel.addEventListener("mouseenter", stop);
  carousel.addEventListener("mouseleave", start);
  carousel.addEventListener("focusin", stop);
  carousel.addEventListener("focusout", start);
  start();
}
