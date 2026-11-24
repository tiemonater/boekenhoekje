// Book detail: big cover, all the info, edit and delete.
// Wishlist books also get a "Gekocht!" button that moves them into your collection.
// Address: #/boek/<id>  (#/boek/<id>/bewerken = edit form, #/boek/<id>/gekocht = open "Gekocht!" straight away)
import { icon } from "../icons.js";
import { screenHeader, toast, esc, confirmSheet } from "../ui.js";
import { getBook, deleteBook, saveBook } from "../db.js";
import { FORMATS, CONDITIONS, STATUSES, isOwned, makeBook, parsePrice, priceToInput, markJustAdded } from "../books.js";
import { formatEuro, formatDate, todayISO } from "../format.js";
import { coverHTML, releaseCovers } from "../cover.js";
import * as bookForm from "./form.js";
import { showGenreOnShelf, showListOnShelf } from "./shelf.js";
import { noteChange } from "../backup.js";

// Hide the tab bar while editing.
export const showTabbar = (params) => params[1] !== "bewerken";

export async function render(root, params) {
  const [id, mode] = params;
  const book = id ? await getBook(decodeURIComponent(id)) : null;

  if (!book) {
    root.innerHTML = `
      ${screenHeader({ eyebrow: "Boekenkast", title: "Niet gevonden", back: "#/kast" })}
      <div class="card empty">
        <h2>Dit boek staat niet (meer) in je kast</h2>
        <p>Misschien is het verwijderd.</p>
        <a class="btn btn-primary" href="#/kast">Naar mijn kast</a>
      </div>`;
    return;
  }

  if (mode === "bewerken") return bookForm.renderForm(root, { book });

  releaseCovers();
  const owned = isOwned(book);
  const list = owned ? "kast" : "verlanglijst";
  const rows = [
    ["coin", owned ? "Prijs" : "Prijs (ongeveer)", book.priceCents != null ? formatEuro(book.priceCents) : null],
    ["calendar", "Gekocht op", owned && formatDate(book.purchaseDate)],
    ["check", "Uitgelezen op", owned && formatDate(book.finishedAt)],
    ["shop", owned ? "Waar gekocht" : "Waar te koop", book.store],
    ["book", "Soort", FORMATS[book.format]],
    ["sparkle", "Staat", owned && CONDITIONS[book.condition]],
    ["pages", "Pagina's", book.pages],
    ["clock", "Verschenen", book.year],
    ["barcode", "ISBN", book.isbn],
  ].filter(([, , value]) => value);

  root.innerHTML = `
    ${screenHeader({ eyebrow: owned ? "Uit mijn kast" : "Op mijn verlanglijst", title: "", eyebrowIcon: owned ? "bookmark" : "heart", back: "#/kast" })}

    <section class="detail-hero">
      ${coverHTML(book, "cover-large")}
      <h1 class="detail-title">${esc(book.title)}</h1>
      ${book.author ? `<p class="detail-author">${esc(book.author)}</p>` : ""}
      <div class="detail-badges">
        ${book.priceCents != null ? `<span class="badge badge-rose">${owned ? "" : "± "}${formatEuro(book.priceCents)}</span>` : ""}
        ${owned
          ? `<span class="badge">${icon("bookmark", "icon-sm")}${STATUSES[book.status]}</span>`
          : `<span class="badge">${icon("heart", "icon-sm")}Op mijn verlanglijst</span>`}
      </div>
      ${book.genres?.length ? `
        <div class="detail-genres" aria-label="Genres">
          ${book.genres.map((g) => `<a class="genre-tag" href="#/kast" data-genre="${esc(g)}">${icon("tag", "icon-sm")}${esc(g)}</a>`).join("")}
        </div>` : ""}
    </section>

    <div class="card info-list">
      ${rows.map(([ic, label, value]) => `
        <div class="info-row">
          ${icon(ic, "icon-sm")}
          <span class="info-label">${label}</span>
          <span class="info-value">${esc(value)}</span>
        </div>`).join("")}
    </div>

    ${book.notes ? `
      <div class="card notes section-gap">
        <div class="field-label">Notities</div>
        <p>${esc(book.notes)}</p>
      </div>` : ""}

    <div class="detail-actions">
      ${owned ? "" : `<button class="btn btn-primary btn-block btn-bought" type="button" data-action="bought">${icon("gift")} Gekocht!</button>`}
      <a class="btn ${owned ? "btn-primary" : "btn-ghost"} btn-block" href="#/boek/${encodeURIComponent(book.id)}/bewerken">${icon("pen")} Bewerken</a>
      <button class="btn btn-ghost btn-block btn-danger" type="button" data-action="delete">${icon("trash")} Verwijderen</button>
    </div>
  `;

  // Tapping a genre shows all books of that genre on the shelf
  root.querySelectorAll("[data-genre]").forEach((a) =>
    a.addEventListener("click", () => showGenreOnShelf(a.dataset.genre, list))
  );

  // Open the edit form in place of this screen (not on top of it),
  // so after saving we land back on a single info screen.
  root.querySelector('a[href$="/bewerken"]').addEventListener("click", (e) => {
    e.preventDefault();
    location.replace(e.currentTarget.getAttribute("href"));
  });

  root.querySelector('[data-action="delete"]').addEventListener("click", async () => {
    const yes = await confirmSheet({
      title: "Boek verwijderen?",
      text: `"${book.title}" verdwijnt uit je ${owned ? "kast" : "verlanglijst"}. Dit kun je niet ongedaan maken.`,
      confirmLabel: "Ja, verwijderen",
      cancelLabel: "Toch niet",
    });
    if (!yes) return;
    await deleteBook(book.id);
    await noteChange();
    toast(owned ? "Verwijderd uit je kast" : "Verwijderd van je verlanglijst");
    showListOnShelf(list);
    location.replace("#/kast");
  });

  // ---- "Gekocht!": wishlist → collection ----
  async function bought() {
    const answer = await boughtSheet(book);
    if (!answer) return;
    const moved = makeBook({ ...book, ...answer, owned: true, purchaseDate: todayISO(), status: "wil-lezen" }, book);
    await saveBook(moved);
    await noteChange();
    markJustAdded(moved.id); // it drops onto the shelf with the usual animation
    showListOnShelf("kast");
    toast("Gefeliciteerd met je nieuwe boek! ✨");
    location.replace("#/kast");
  }
  root.querySelector('[data-action="bought"]')?.addEventListener("click", bought);
  root.openBought = owned ? null : bought; // used by mounted() for #/boek/<id>/gekocht
}

// #/boek/<id>/gekocht (from the scanner): open "Gekocht!" right away
export function mounted(root, params) {
  if (params[1] !== "gekocht") return;
  history.replaceState(null, "", `#/boek/${params[0]}`); // so reopening the app doesn't ask again
  root.openBought?.();
}

// Pop-up asking what you paid and where, when a wishlist book is bought.
function boughtSheet(book) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "sheet-backdrop";
    wrap.innerHTML = `
      <form class="sheet bought-sheet" role="dialog" aria-modal="true" aria-labelledby="bought-title" novalidate>
        <h2 id="bought-title">Gekocht! ${icon("sparkle", "icon-sm")}</h2>
        <p>${esc(book.title)} verhuist naar je kast.</p>
        <div class="field-row">
          <label class="field">
            <span class="field-label">Betaald</span>
            <span class="input-prefix">
              <span aria-hidden="true">€</span>
              <input name="price" type="text" inputmode="decimal" value="${priceToInput(book.priceCents)}" placeholder="0,00">
            </span>
          </label>
          <label class="field">
            <span class="field-label">Waar</span>
            <input name="store" type="text" value="${esc(book.store)}" placeholder="Winkel">
          </label>
        </div>
        <div class="field">
          <span class="field-label">Staat</span>
          <div class="chips">
            ${Object.entries(CONDITIONS).map(([v, label]) => `
              <label class="chip"><input type="radio" name="condition" value="${v}" ${v === (book.condition ?? "nieuw") ? "checked" : ""}><span>${label}</span></label>`).join("")}
          </div>
        </div>
        <button class="btn btn-primary btn-block" type="submit">${icon("check")} In mijn kast zetten</button>
        <button class="btn btn-ghost btn-block" type="button" data-answer="cancel">Annuleren</button>
      </form>`;
    document.body.append(wrap);
    requestAnimationFrame(() => wrap.classList.add("open"));

    const close = (answer) => {
      wrap.classList.remove("open");
      setTimeout(() => wrap.remove(), 300);
      resolve(answer);
    };
    const form = wrap.querySelector("form");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const price = form.elements.price.value;
      if (price.trim() && parsePrice(price) === null) {
        toast("Die prijs snap ik niet helemaal");
        return;
      }
      close({ priceCents: parsePrice(price), store: form.elements.store.value, condition: form.elements.condition.value });
    });
    wrap.addEventListener("click", (e) => {
      if (e.target === wrap || e.target.closest('[data-answer="cancel"]')) close(null);
    });
  });
}
