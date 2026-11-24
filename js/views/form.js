// Book form: add a book (by hand or after scanning) and edit a book.
import { icon } from "../icons.js";
import { screenHeader, toast, esc } from "../ui.js";
import { getAllBooks, saveBook } from "../db.js";
import { FORMATS, CONDITIONS, STATUSES, makeBook, parsePrice, priceToInput, markJustAdded, allGenres, cleanGenres, takeDraft } from "../books.js";
import { coverHTML } from "../cover.js";
import { shrinkImage } from "../image.js";
import { noteChange } from "../backup.js";

// Today's date as "2026-11-24", in the phone's own time zone.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A row of pill-shaped choices (one can be picked).
function choices(name, options, selected) {
  return `
    <div class="chips" role="radiogroup">
      ${Object.entries(options).map(([value, label]) => `
        <label class="chip">
          <input type="radio" name="${name}" value="${value}" ${value === selected ? "checked" : ""}>
          <span>${label}</span>
        </label>`).join("")}
    </div>`;
}

// A genre pill that can be switched on and off (several allowed).
function genreChip(name, checked) {
  return `
    <label class="chip">
      <input type="checkbox" name="genres" value="${esc(name)}" ${checked ? "checked" : ""}>
      <span>${esc(name)}</span>
    </label>`;
}

// #/toevoegen/handmatig → form for a new book (pre-filled if it came from the scanner)
export function render(root) {
  return renderForm(root, { book: takeDraft() ?? {} });
}

// Shared form. With `book.id` it edits that book, otherwise it adds a new one.
export async function renderForm(root, { book }) {
  const isEdit = Boolean(book.id);
  const allBooks = await getAllBooks();
  const stores = [...new Set(allBooks.map((b) => b.store).filter(Boolean))].sort();
  const bookGenres = cleanGenres(book.genres);
  const selectedGenres = new Set(bookGenres.map((g) => g.toLocaleLowerCase("nl")));
  // the book's own genres are always offered, even if they're not used elsewhere
  const genreOptions = cleanGenres([...allGenres(allBooks), ...bookGenres]);

  const header = isEdit
    ? screenHeader({ eyebrow: "Bewerken", title: "Boek bewerken", eyebrowIcon: "pen", back: `#/boek/${encodeURIComponent(book.id)}` })
    : book.fromScan
      ? screenHeader({ eyebrow: book.title ? "Gevonden" : "Niet gevonden", title: book.title ? "Klopt dit?" : "Vul zelf aan", eyebrowIcon: "barcode", back: "#/toevoegen/scan" })
      : screenHeader({ eyebrow: "Nieuw op de plank", title: "Zelf invullen", eyebrowIcon: "pen", back: "#/toevoegen" });

  let cover = book.cover ?? null; // Blob, web link or null — changed by the photo buttons

  root.innerHTML = `
    ${header}

    <form class="book-form" novalidate autocomplete="off">
      <div class="card cover-picker">
        <div class="cover-preview"></div>
        <div class="cover-actions">
          <span class="field-label">Cover</span>
          <label class="btn btn-ghost btn-small">
            ${icon("camera", "icon-sm")} Foto maken of kiezen
            <input type="file" accept="image/*" class="cover-file visually-hidden">
          </label>
          <button type="button" class="link-btn cover-remove">Cover weghalen</button>
        </div>
      </div>

      <div class="card field-group">
        <label class="field">
          <span class="field-label">Titel <span class="req">*</span></span>
          <input name="title" type="text" required value="${esc(book.title)}" placeholder="Bijv. De Hobbit" autocapitalize="sentences">
        </label>
        <label class="field">
          <span class="field-label">Auteur</span>
          <input name="author" type="text" value="${esc(book.author)}" placeholder="Bijv. J.R.R. Tolkien" autocapitalize="words">
        </label>
      </div>

      <div class="card field-group">
        <div class="field-row">
          <label class="field">
            <span class="field-label">Prijs</span>
            <span class="input-prefix">
              <span aria-hidden="true">€</span>
              <input name="price" type="text" inputmode="decimal" value="${priceToInput(book.priceCents)}" placeholder="0,00">
            </span>
          </label>
          <label class="field">
            <span class="field-label">Gekocht op</span>
            <input name="purchaseDate" type="date" value="${isEdit ? book.purchaseDate ?? "" : today()}">
          </label>
        </div>
        <label class="field">
          <span class="field-label">Waar gekocht</span>
          <input name="store" type="text" list="store-list" value="${esc(book.store)}" placeholder="Bijv. Boekhandel, De Slegte, Vinted">
          <datalist id="store-list">${stores.map((s) => `<option value="${esc(s)}">`).join("")}</datalist>
        </label>
      </div>

      <div class="card field-group">
        <div class="field">
          <span class="field-label">Soort</span>
          ${choices("format", FORMATS, book.format ?? "paperback")}
        </div>
        <div class="field">
          <span class="field-label">Staat</span>
          ${choices("condition", CONDITIONS, book.condition ?? "nieuw")}
        </div>
        <div class="field">
          <span class="field-label">Leesstatus</span>
          ${choices("status", STATUSES, book.status ?? "wil-lezen")}
        </div>
      </div>

      <div class="card field-group">
        <div class="field">
          <span class="field-label">Genre <span class="field-hint">kies er een of meer</span></span>
          <div class="chips genre-chips">
            ${genreOptions.map((g) => genreChip(g, selectedGenres.has(g.toLocaleLowerCase("nl")))).join("")}
            <button type="button" class="chip-add">${icon("plus", "icon-sm")} Eigen genre</button>
          </div>
          <div class="genre-new" hidden>
            <input type="text" placeholder="Bijv. Cozy mystery" autocapitalize="sentences" enterkeyhint="done" aria-label="Nieuw genre">
            <button type="button" class="btn btn-primary">Voeg toe</button>
          </div>
        </div>
      </div>

      <div class="card field-group">
        <label class="field">
          <span class="field-label">Notities</span>
          <textarea name="notes" rows="3" placeholder="Gekregen van oma, gesigneerd, mooie editie…">${esc(book.notes)}</textarea>
        </label>
        <details class="more" ${book.pages || book.year || book.isbn ? "open" : ""}>
          <summary>Meer gegevens ${icon("chevron", "icon-sm")}</summary>
          <div class="field-row">
            <label class="field">
              <span class="field-label">Pagina's</span>
              <input name="pages" type="text" inputmode="numeric" value="${book.pages ?? ""}">
            </label>
            <label class="field">
              <span class="field-label">Jaar</span>
              <input name="year" type="text" inputmode="numeric" value="${book.year ?? ""}">
            </label>
          </div>
          <label class="field">
            <span class="field-label">ISBN</span>
            <input name="isbn" type="text" inputmode="numeric" value="${esc(book.isbn)}">
          </label>
        </details>
      </div>

      <button class="btn btn-primary btn-block btn-save" type="submit">
        ${icon("check")} ${isEdit ? "Wijzigingen opslaan" : "In mijn kast zetten"}
      </button>
    </form>
  `;

  // "Terug" while editing also swaps back to the book's info screen
  if (isEdit) {
    root.querySelector(".back-link").addEventListener("click", (e) => {
      e.preventDefault();
      location.replace(`#/boek/${encodeURIComponent(book.id)}`);
    });
  }

  // ---- Cover: preview, own photo, remove ----
  const preview = root.querySelector(".cover-preview");
  const removeBtn = root.querySelector(".cover-remove");
  function showCover() {
    const f = root.querySelector("form");
    preview.innerHTML = coverHTML({
      title: f.elements.title.value || "Titel",
      author: f.elements.author.value,
      cover,
    });
    removeBtn.hidden = !cover;
  }
  root.querySelector(".cover-file").addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same photo again still works
    if (!file) return;
    try {
      cover = await shrinkImage(file);
      showCover();
    } catch {
      toast("Deze foto kon ik niet openen");
    }
  });
  removeBtn.addEventListener("click", () => { cover = null; showCover(); });
  // the made-up cover shows the title as you type it
  ["title", "author"].forEach((name) =>
    root.querySelector(`[name="${name}"]`).addEventListener("input", () => { if (!cover) showCover(); })
  );
  showCover();

  // "+ Eigen genre": shows a small input; the new genre appears as a switched-on pill
  const addBtn = root.querySelector(".chip-add");
  const newBox = root.querySelector(".genre-new");
  const newInput = newBox.querySelector("input");
  addBtn.addEventListener("click", () => {
    newBox.hidden = false;
    newInput.focus();
  });
  function addOwnGenre() {
    let [name] = cleanGenres([newInput.value]);
    if (!name) return newInput.focus();
    name = name[0].toLocaleUpperCase("nl") + name.slice(1); // "memoir" → "Memoir"
    const existing = [...root.querySelectorAll('input[name="genres"]')]
      .find((cb) => cb.value.toLocaleLowerCase("nl") === name.toLocaleLowerCase("nl"));
    if (existing) {
      existing.checked = true;
    } else {
      addBtn.insertAdjacentHTML("beforebegin", genreChip(name, true));
    }
    newInput.value = "";
    newBox.hidden = true;
  }
  newBox.querySelector("button").addEventListener("click", addOwnGenre);
  newInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); addOwnGenre(); } // don't submit the whole form
  });

  const form = root.querySelector("form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    if (!data.title.trim()) {
      const input = form.elements.title;
      input.closest(".field").classList.add("invalid");
      input.focus();
      toast("Vul een titel in");
      return;
    }
    if (data.price.trim() && parsePrice(data.price) === null) {
      toast("Die prijs snap ik niet helemaal");
      form.elements.price.focus();
      return;
    }

    let saved;
    try {
      const genres = new FormData(form).getAll("genres");
      saved = makeBook({ ...data, genres, cover, priceCents: parsePrice(data.price) }, book);
      await saveBook(saved);
      await noteChange();
    } catch (err) {
      console.error(err);
      toast(`Opslaan lukte niet: ${err.message || err}`);
      return;
    }

    // replace() swaps the form for the next screen, so the form never stays in the history
    if (isEdit) {
      toast("Opgeslagen ✨");
      location.replace(`#/boek/${encodeURIComponent(saved.id)}`);
    } else {
      markJustAdded(saved.id);
      toast("In je kast gezet ✨");
      location.replace("#/kast");
    }
  });

  form.elements.title.addEventListener("input", (e) => e.target.closest(".field").classList.remove("invalid"));
}
