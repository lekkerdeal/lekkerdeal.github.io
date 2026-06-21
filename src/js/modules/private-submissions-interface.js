import {
  createContactMessage,
  createDealReport,
  createRetailerCollaborationRequest,
} from "../api/submissions-api.js";
import { isAuthenticated } from "../api/client.js";
import { openAuthModal } from "./authentication-interface.js";
import { cleanValue, sanitizePhone } from "./text-sanitization.js";

let getDealById = () => null;
let isInitialized = false;

export function initPrivateSubmissionModals({ resolveDealById } = {}) {
  if (typeof resolveDealById === "function") getDealById = resolveDealById;
  if (isInitialized) return;
  injectSubmissionModals();
  bindSubmissionEvents();
  isInitialized = true;
}

export function openDealReportModal(dealId = "") {
  if (!isAuthenticated()) {
    openAuthModal("login");
    return;
  }
  const deal = getDealById(dealId) || {};
  const modal = document.getElementById("dealReportModal");
  const form = document.getElementById("dealReportForm");
  if (!modal || !form) return;
  form.reset();
  form.elements.dealId.value = deal._dealId || dealId;
  form.elements.productKey.value = deal._productKey || "";
  form.elements.dealTitle.value = deal.title || "";
  form.elements.retailer.value = deal.retailer || "";
  setSubmissionStatus("dealReportStatus", "");
  openDialog(modal);
}

function openRetailerCollaborationModal() {
  if (!isAuthenticated()) {
    openAuthModal("login");
    return;
  }
  const modal = document.getElementById("retailerCollaborationModal");
  const form = document.getElementById("retailerCollaborationForm");
  if (!modal || !form) return;
  form.reset();
  setSubmissionStatus("retailerCollaborationStatus", "");
  openDialog(modal);
}

function injectSubmissionModals() {
  if (document.getElementById("dealReportModal")) return;
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <dialog class="private-submission-modal" id="dealReportModal" hidden>
        <article class="private-submission-card">
          <button class="private-submission-close" type="button" data-close-private-submission aria-label="Close report form">&times;</button>
          <h2>Report a deal</h2>
          <p>Tell us what looks wrong. Your account details are attached privately for follow-up.</p>
          <form id="dealReportForm" class="private-submission-form">
            <input name="dealId" type="hidden">
            <input name="productKey" type="hidden">
            <input name="dealTitle" type="hidden">
            <input name="retailer" type="hidden">
            <label>
              <span>Comment</span>
              <textarea name="comment" maxlength="500" required placeholder="Price issue, wrong retailer link, expired deal, misleading info..."></textarea>
            </label>
            <button type="submit">Send report</button>
            <p class="private-submission-status" id="dealReportStatus" aria-live="polite"></p>
          </form>
        </article>
      </dialog>
      <dialog class="private-submission-modal" id="retailerCollaborationModal" hidden>
        <article class="private-submission-card">
          <button class="private-submission-close" type="button" data-close-private-submission aria-label="Close retailer collaboration form">&times;</button>
          <h2>Onboard my store</h2>
          <p>For retailers who want LekkeDeal to monitor and index their public specials for shoppers.</p>
          <form id="retailerCollaborationForm" class="private-submission-form">
            <label>
              <span>Business name</span>
              <input name="businessName" maxlength="120" required>
            </label>
            <label>
              <span>Website URL</span>
              <input name="websiteUrl" type="url" maxlength="300" placeholder="https://example.co.za" required>
            </label>
            <label>
              <span>What do you offer?</span>
              <input name="offerType" maxlength="120" placeholder="Tech, appliances, fashion, daily deals..." required>
            </label>
            <label>
              <span>Notes</span>
              <textarea name="notes" maxlength="500" placeholder="Tell us about discount frequency, product categories, or catalogue pages."></textarea>
            </label>
            <label class="private-submission-consent">
              <input name="dataAccessConsent" type="checkbox" required>
              <span>I confirm that I am authorised to request LekkeDeal to access, monitor, index and display publicly available offer information from this store website for deal discovery and referral purposes.</span>
            </label>
            <button type="submit">Onboard my store</button>
            <p class="private-submission-status" id="retailerCollaborationStatus" aria-live="polite"></p>
          </form>
        </article>
      </dialog>
      <dialog class="private-submission-modal" id="contactMessageModal" hidden>
        <article class="private-submission-card">
          <button class="private-submission-close" type="button" data-close-private-submission aria-label="Close contact form">&times;</button>
          <h2>Contact LekkeDeal</h2>
          <p>Send us a message. You do not need an account for this form.</p>
          <form id="contactMessageForm" class="private-submission-form">
            <label>
              <span>Name</span>
              <input name="name" maxlength="80" required>
            </label>
            <label>
              <span>Phone number</span>
              <input name="phoneNumber" inputmode="numeric" maxlength="10" pattern="0[0-9]{9}" required>
            </label>
            <label>
              <span>Subject</span>
              <input name="subject" maxlength="120" required>
            </label>
            <label>
              <span>Message</span>
              <textarea name="message" maxlength="4000" required placeholder="Maximum 500 words."></textarea>
            </label>
            <button type="submit">Send message</button>
            <p class="private-submission-status" id="contactMessageStatus" aria-live="polite"></p>
          </form>
        </article>
      </dialog>
      <dialog class="private-submission-modal terms-modal" id="termsModal" hidden>
        <article class="private-submission-card terms-card">
          <button class="private-submission-close" type="button" data-close-private-submission aria-label="Close terms">&times;</button>
          <h2>Terms &amp; Conditions</h2>
          <section class="terms-content">
            <p>These Terms &amp; Conditions govern your use of LekkeDeal, including our website, app, deal listings, retailer links, alerts and community features. By accessing or using LekkeDeal, you agree to these Terms.</p>
            <h3>1. What LekkeDeal Does</h3>
            <p>LekkeDeal helps shoppers discover South African deals, specials, price drops, retailer offers, product information and retailer links.</p>
            <p>LekkeDeal is a deal-discovery platform. Unless we clearly state otherwise, LekkeDeal is not the seller, supplier, manufacturer, courier, payment provider or warranty provider for products listed on the platform.</p>
            <p>Any purchase you make is made directly with the relevant retailer and is subject to that retailer's terms, policies and processes.</p>
            <h3>2. Deal Accuracy and Availability</h3>
            <p>Prices, discounts, stock availability, delivery fees, product specifications, promotions and retailer information may change without notice.</p>
            <p>LekkeDeal does not guarantee that any listed price, discount, product detail, stock level or promotion will remain available or accurate at the time you visit the retailer's website.</p>
            <p>You must confirm all final details, including the total price, delivery costs, stock availability, warranty terms and return policy, directly with the retailer before completing a purchase.</p>
            <h3>3. Retailer Links, Affiliate Links and Sponsored Content</h3>
            <p>LekkeDeal may link to third-party retailer websites.</p>
            <p>Some links may be affiliate, referral, tracking or sponsored links. LekkeDeal may earn commission, referral value or other compensation when you visit or purchase through certain links.</p>
            <p>This does not increase the price you pay unless clearly disclosed otherwise.</p>
            <p>LekkeDeal is not responsible for a retailer's products, pricing, customer service, delivery, returns, refunds, warranties or any dispute between you and that retailer.</p>
            <h3>4. Accounts, Reviews and User Content</h3>
            <p>Where LekkeDeal allows you to create an account, save deals, post reviews, replies, store requests or reports, you are responsible for the information and content you submit.</p>
            <p>You may not submit content that is unlawful, misleading, abusive, defamatory, fraudulent, spammy, irrelevant, discriminatory or harmful to other users, retailers or LekkeDeal.</p>
            <p>By posting public content on LekkeDeal, you grant LekkeDeal a non-exclusive, royalty-free licence to display, reproduce, moderate and use that content for operating and improving the platform.</p>
            <h3>5. Privacy and POPIA</h3>
            <p>LekkeDeal processes personal information in accordance with applicable South African law, including the Protection of Personal Information Act 4 of 2013 (POPIA).</p>
            <p>Our Privacy Policy explains what information we collect, why we collect it, how we use it, who we may share it with, how long we retain it and how you may exercise your privacy rights.</p>
            <p>Where required, LekkeDeal will obtain your consent before processing your personal information for a particular purpose.</p>
            <h3>6. Alerts and Marketing Communications</h3>
            <p>You may choose to receive deal alerts through email, WhatsApp, SMS or other supported channels.</p>
            <p>Marketing communications are optional. By actively opting in, you consent to receive the selected communications from LekkeDeal.</p>
            <p>You may unsubscribe or withdraw your consent at any time by contacting LekkeDeal.</p>
            <h3>7. Retailer Collaboration and Site Monitoring</h3>
            <p>Retailers may submit requests for LekkeDeal to list, update, monitor, index or display publicly available offer information from their websites.</p>
            <p>A retailer submitting such a request confirms that it has authority to do so and that the information supplied is accurate.</p>
            <p>LekkeDeal may remove, change or decline retailer listings where information appears inaccurate, misleading, outdated, unlawful or unsuitable for the platform.</p>
            <h3>8. Prohibited Use</h3>
            <p>You may not misuse LekkeDeal forms, accounts or communications; impersonate another person or business; submit false, misleading or unlawful content; interfere with, attack, disrupt or attempt unauthorised access to LekkeDeal; scrape, copy or reproduce LekkeDeal content at scale without permission; or use LekkeDeal in a manner that harms shoppers, retailers, LekkeDeal or other users.</p>
            <h3>9. Moderation</h3>
            <p>LekkeDeal may remove, hide, restrict or review content that we reasonably believe is abusive, misleading, unlawful, defamatory, duplicated, irrelevant, spammy or harmful to the shopping experience.</p>
            <p>We may suspend or terminate access to LekkeDeal where a user repeatedly or seriously breaches these Terms.</p>
            <h3>10. Intellectual Property</h3>
            <p>LekkeDeal's name, logo, branding, design, software, text, databases and original content belong to LekkeDeal or its licensors.</p>
            <p>You may use LekkeDeal for personal and lawful shopping purposes only. You may not copy, reproduce, distribute, sell or commercially exploit LekkeDeal content without written permission.</p>
            <p>Retailer names, logos, product images and trademarks remain the property of their respective owners.</p>
            <h3>11. Disclaimer and Liability</h3>
            <p>LekkeDeal provides deal information as general shopping guidance.</p>
            <p>We do not guarantee uninterrupted access to the platform, perfect data accuracy, retailer performance, stock availability, delivery outcomes, product quality or savings.</p>
            <p>To the fullest extent permitted by law, LekkeDeal will not be liable for loss arising from your use of retailer websites, retailer purchases, inaccurate third-party information, unavailable deals or decisions made in reliance on platform content.</p>
            <p>Nothing in these Terms excludes or limits any liability or consumer right that cannot lawfully be excluded or limited.</p>
            <h3>12. Changes to These Terms</h3>
            <p>LekkeDeal may update these Terms from time to time.</p>
            <p>The latest version will be published on the platform. Continued use of LekkeDeal after changes take effect means you accept the revised Terms.</p>
            <h3>13. Governing Law</h3>
            <p>These Terms are governed by the laws of the Republic of South Africa.</p>
            <h3>14. Contact Us</h3>
            <p>For questions, complaints, privacy requests or retailer enquiries, use the <a href="#" data-contact-form>Contact LekkeDeal</a> form.</p>
          </section>
        </article>
      </dialog>
    `,
  );
}

function bindSubmissionEvents() {
  document.addEventListener("click", (event) => {
    const reportButton = event.target.closest("[data-report-deal-id]");
    if (reportButton) {
      event.preventDefault();
      openDealReportModal(reportButton.dataset.reportDealId);
      return;
    }
    const collabLink = event.target.closest("[data-retailer-collaboration]");
    if (collabLink) {
      event.preventDefault();
      openRetailerCollaborationModal();
      return;
    }
    const contactLink = event.target.closest("[data-contact-form]");
    if (contactLink) {
      event.preventDefault();
      closeDialog(contactLink.closest("dialog"));
      openContactMessageModal();
      return;
    }
    const termsLink = event.target.closest("[data-terms-modal]");
    if (termsLink) {
      event.preventDefault();
      openTermsModal();
      return;
    }
    if (event.target.closest("[data-close-private-submission]")) {
      closeDialog(event.target.closest("dialog"));
    }
  });
  document.getElementById("dealReportForm")?.addEventListener("submit", handleDealReportSubmit);
  document
    .getElementById("retailerCollaborationForm")
    ?.addEventListener("submit", handleRetailerCollaborationSubmit);
  document
    .getElementById("contactMessageForm")
    ?.addEventListener("submit", handleContactMessageSubmit);
  document.addEventListener("input", (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.name === "phoneNumber") input.value = sanitizePhone(input.value);
  });
}

function openContactMessageModal() {
  const modal = document.getElementById("contactMessageModal");
  const form = document.getElementById("contactMessageForm");
  if (!modal || !form) return;
  form.reset();
  setSubmissionStatus("contactMessageStatus", "");
  openDialog(modal);
}

function openTermsModal() {
  const modal = document.getElementById("termsModal");
  if (!modal) return;
  openDialog(modal);
}

async function handleDealReportSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.busy === "true") return;
  const data = formData(form);
  try {
    setFormBusy(form, true);
    await createDealReport(data);
    form.reset();
    setSubmissionStatus(
      "dealReportStatus",
      "Report sent. We will respond within 14 days.",
    );
  } catch (error) {
    setSubmissionStatus("dealReportStatus", error.message || "Could not send report.", true);
  } finally {
    setFormBusy(form, false);
  }
}

async function handleRetailerCollaborationSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.busy === "true") return;
  const data = formData(form);
  try {
    setFormBusy(form, true);
    await createRetailerCollaborationRequest({
      ...data,
      dataAccessConsent: form.elements.dataAccessConsent.checked,
    });
    form.reset();
    setSubmissionStatus(
      "retailerCollaborationStatus",
      "Request sent. We will respond within 14 days.",
    );
  } catch (error) {
    setSubmissionStatus(
      "retailerCollaborationStatus",
      error.message || "Could not send request.",
      true,
    );
  } finally {
    setFormBusy(form, false);
  }
}

async function handleContactMessageSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.busy === "true") return;
  const data = formData(form);
  if (wordCount(data.message) > 500) {
    setSubmissionStatus("contactMessageStatus", "Message must be 500 words or fewer.", true);
    return;
  }
  try {
    setFormBusy(form, true);
    await createContactMessage(data);
    form.reset();
    setSubmissionStatus(
      "contactMessageStatus",
      "Message sent. We will respond within 30 days.",
    );
  } catch (error) {
    setSubmissionStatus(
      "contactMessageStatus",
      error.message || "Could not send message.",
      true,
    );
  } finally {
    setFormBusy(form, false);
  }
}

function formData(form) {
  return Object.fromEntries(
    [...new FormData(form)].map(([key, value]) => [key, cleanValue(value)]),
  );
}

function setFormBusy(form, isBusy) {
  form.dataset.busy = String(isBusy);
  form.querySelectorAll("button, input, textarea").forEach((control) => {
    control.disabled = isBusy;
  });
}

function setSubmissionStatus(id, message, isError = false) {
  const status = document.getElementById(id);
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "var(--red)" : "var(--green)";
}

function wordCount(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function openDialog(dialog) {
  dialog.hidden = false;
  if (typeof dialog.showModal === "function" && !dialog.open) {
    dialog.showModal();
    return;
  }
  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.close === "function" && dialog.open) dialog.close();
  dialog.removeAttribute("open");
  dialog.hidden = true;
}
