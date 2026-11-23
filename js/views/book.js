// Book detail: big cover, all the info, edit and delete.
// Address: #/boek/<id>  (and #/boek/<id>/bewerken for the edit form)
import { icon } from "../icons.js";
import { screenHeader, toast, esc, confirmSheet } from "../ui.js";
import { getBook, deleteBook } from "../db.js";
import { FORMATS, CONDITIONS, STATUSES } from "../books.js";
import { formatEuro, formatDate } from "../format.js";
import { coverHTML, releaseCovers } from "../cover.js";
import * as bookForm from "./form.js";
import { showGenreOnShelf } from "./shelf.js";

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
  const rows = [
    ["coin", "Prijs", book.priceCents != null ? formatEuro(book.priceCents) : null],
    ["calendar", "Gekocht op", formatDate(book.purchaseDate)],
    ["shop", "Waar gekocht", book.store],
    ["book", "Soort", FORMATS[book.format]],
    ["sparkle", "Staat", CONDITIONS[book.condition]],
    ["pages", "Pagina's", book.pages],
    ["clock", "Verschenen", book.year],
    ["barcode", "ISBN", book.isbn],
  ].filter(([, , value]) => value);

  root.innerHTML = `
    ${screenHeader({ eyebrow: "Uit mijn kast", title: "", eyebrowIcon: "bookmark", back: "#/kast" })}

    <section class="detail-hero">
      ${coverHTML(book, "cover-large")}
      <h1 class="detail-title">${esc(book.title)}</h1>
      ${book.author ? `<p class="detail-author">${esc(book.author)}</p>` : ""}
      <div class="detail-badges">
        ${book.priceCents != null ? `<span class="badge badge-rose">${formatEuro(book.priceCents)}</span>` : ""}
        <span class="badge">${icon("bookmark", "icon-sm")}${STATUSES[book.status]}</span>
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
      <a class="btn btn-primary btn-block" href="#/boek/${encodeURIComponent(book.id)}/bewerken">${icon("pen")} Bewerken</a>
      <button class="btn btn-ghost btn-block btn-danger" type="button" data-action="delete">${icon("trash")} Verwijderen</button>
    </div>
  `;

  // Tapping a genre shows all books of that genre on the shelf
  root.querySelectorAll("[data-genre]").forEach((a) =>
    a.addEventListener("click", () => showGenreOnShelf(a.dataset.genre))
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
      text: `"${book.title}" verdwijnt uit je kast. Dit kun je niet ongedaan maken.`,
      confirmLabel: "Ja, verwijderen",
      cancelLabel: "Toch niet",
    });
    if (!yes) return;
    await deleteBook(book.id);
    toast("Verwijderd uit je kast");
    location.replace("#/kast");
  });
}
