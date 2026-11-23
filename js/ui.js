// Small shared UI helpers.
import { icon } from "./icons.js";

let toastTimer;

// Short message that slides in at the top of the screen.
export function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    document.body.append(el);
  }
  el.textContent = message;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// Soft pop-up from the bottom asking "are you sure?". Resolves true/false.
export function confirmSheet({ title, text, confirmLabel = "Ja", cancelLabel = "Annuleren" }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "sheet-backdrop";
    wrap.innerHTML = `
      <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="sheet-title">
        <h2 id="sheet-title">${esc(title)}</h2>
        <p>${esc(text)}</p>
        <button class="btn btn-primary btn-block" data-answer="yes">${esc(confirmLabel)}</button>
        <button class="btn btn-ghost btn-block" data-answer="no">${esc(cancelLabel)}</button>
      </div>`;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add("open"));

    const close = (answer) => {
      wrap.classList.remove("open");
      setTimeout(() => wrap.remove(), 300);
      resolve(answer);
    };
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) return close(false);
      const btn = e.target.closest("[data-answer]");
      if (btn) close(btn.dataset.answer === "yes");
    });
  });
}

// Makes text safe to put inside HTML (so a title like "<b>" shows as text).
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// Header used at the top of every screen. `back` = address for a back button.
export function screenHeader({ eyebrow, title, eyebrowIcon = "sparkle", back = null }) {
  return `
    <header class="screen-header">
      <div>
        ${back ? `<a class="back-link" href="${back}">${icon("chevronLeft", "icon-sm")}Terug</a>` : ""}
        <div class="eyebrow">${icon(eyebrowIcon, "icon-sm")}${eyebrow}</div>
        ${title ? `<h1>${title}</h1>` : ""}
      </div>
    </header>`;
}
