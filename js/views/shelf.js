// Bookshelf: covers standing on wooden-ish shelves, 3 per plank,
// with search, sorting and filters on top.
import { screenHeader, esc } from "../ui.js";
import { getAllBooks } from "../db.js";
import { takeJustAdded, filterAndSort, usedGenres, isOwned, preferWishlist, SORTS, STATUSES, FORMATS, NO_GENRE } from "../books.js";
import { formatEuro } from "../format.js";
import { icon } from "../icons.js";
import { coverHTML, releaseCovers } from "../cover.js";

const PER_SHELF = 3;

const emptyShelfArt = `
  <svg class="empty-art" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M14 92h92"/>
    <path d="M18 92v8M102 92v8"/>
    <rect x="30" y="46" width="13" height="46" rx="2"/>
    <rect x="45" y="38" width="11" height="54" rx="2"/>
    <path d="M33 54h7M33 84h7M48 46h5M48 84h5"/>
    <path d="m60 52 11-3 11 40-11 3z"/>
    <path d="M90 30c.4 3.4 2.2 5.2 5.6 5.6-3.4.4-5.2 2.2-5.6 5.6-.4-3.4-2.2-5.2-5.6-5.6 3.4-.4 5.2-2.2 5.6-5.6z"/>
    <path d="M24 26c.3 2.2 1.4 3.3 3.6 3.6-2.2.3-3.3 1.4-3.6 3.6-.3-2.2-1.4-3.3-3.6-3.6 2.2-.3 3.3-1.4 3.6-3.6z"/>
  </svg>`;

// Search, sort and filter choices. They stay while the app is open;
// sort and filters are also remembered for next time.
const SAVED_KEY = "shelf-view";
// list: "kast" (books you own) or "verlanglijst" (books you want)
const state = { list: "kast", query: "", sort: "nieuwste", status: "alle", format: "alle", genre: "alle", ...loadSaved() };

// Used by Home and the detail screen: open the shelf showing one genre.
export function showGenreOnShelf(genre, list = "kast") {
  Object.assign(state, { list, query: "", status: "alle", format: "alle", genre });
}

// Used by the reading goal card: open the shelf showing the books you've read.
export function showReadOnShelf() {
  Object.assign(state, { list: "kast", query: "", status: "gelezen", format: "alle", genre: "alle" });
}

// Open the shelf on "Mijn kast" or "Verlanglijst" (filters cleared).
export function showListOnShelf(list) {
  Object.assign(state, { list, query: "", status: "alle", format: "alle", genre: "alle" });
}

function loadSaved() {
  try {
    const { sort, status, format } = JSON.parse(localStorage.getItem(SAVED_KEY)) ?? {};
    return {
      ...(sort in SORTS && { sort }),
      ...((status === "alle" || status in STATUSES) && { status }),
      ...((format === "alle" || format in FORMATS) && { format }),
    };
  } catch { return {}; }
}
function save() {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify({ sort: state.sort, status: state.status, format: state.format }));
  } catch { /* private mode: just don't remember */ }
}

// A pill-shaped dropdown. On iPhone it opens the native picker wheel.
function pillSelect(name, options, value, isFilter) {
  const active = isFilter && value !== "alle";
  return `
    <label class="pill-select ${active ? "active" : ""}">
      <select name="${name}" aria-label="${esc(options.alle ?? "Sorteren")}">
        ${Object.entries(options).map(([v, label]) => `<option value="${v}" ${v === value ? "selected" : ""}>${esc(label)}</option>`).join("")}
      </select>
      <span>${esc(options[value])}</span>
      ${icon("chevronDown", "icon-sm")}
    </label>`;
}

function bookcaseHTML(books, justAdded) {
  const shelves = [];
  for (let i = 0; i < books.length; i += PER_SHELF) shelves.push(books.slice(i, i + PER_SHELF));
  return `
    <div class="bookcase">
      ${shelves.map((shelf) => `
        <div class="shelf">
          ${shelf.map((book) => `
            <a class="shelf-book ${book.id === justAdded ? "just-added" : ""}" href="#/boek/${encodeURIComponent(book.id)}" aria-label="${esc(book.title)}">
              ${coverHTML(book)}
              ${isOwned(book) ? "" : `<span class="wish-badge" aria-label="Op je verlanglijst">${icon("heart", "icon-sm")}</span>`}
            </a>`).join("")}
        </div>`).join("")}
    </div>`;
}

const wishArt = `
  <svg class="empty-art" viewBox="0 0 120 120" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="34" y="34" width="44" height="62" rx="4"/>
    <path d="M42 34v62"/>
    <path d="M60 74s-10-6.2-10-13.2a5.4 5.4 0 0 1 10-3 5.4 5.4 0 0 1 10 3C70 67.8 60 74 60 74z"/>
    <path d="M92 26c.4 3.4 2.2 5.2 5.6 5.6-3.4.4-5.2 2.2-5.6 5.6-.4-3.4-2.2-5.2-5.6-5.6 3.4-.4 5.2-2.2 5.6-5.6z"/>
    <path d="M24 82c.3 2.2 1.4 3.3 3.6 3.6-2.2.3-3.3 1.4-3.6 3.6-.3-2.2-1.4-3.3-3.6-3.6 2.2-.3 3.3-1.4 3.6-3.6z"/>
  </svg>`;

const booksLabel = (n) => (n === 1 ? "1 boek" : `${n} boeken`);

export async function render(root) {
  releaseCovers();
  const all = await getAllBooks();
  const lists = { kast: all.filter(isOwned), verlanglijst: all.filter((b) => !isOwned(b)) };
  const justAdded = takeJustAdded();

  root.innerHTML = `
    ${screenHeader({ eyebrow: `<span class="eyebrow-text"></span>`, title: "Boekenkast", eyebrowIcon: "bookmark" })}

    <div class="shelf-switch" role="tablist" aria-label="Kast of verlanglijst">
      <button type="button" role="tab" data-list="kast">${icon("shelf", "icon-sm")} Mijn kast <span class="count">${lists.kast.length}</span></button>
      <button type="button" role="tab" data-list="verlanglijst">${icon("heart", "icon-sm")} Verlanglijst <span class="count">${lists.verlanglijst.length}</span></button>
    </div>

    <div class="shelf-tools">
      <label class="search">
        ${icon("search")}
        <input type="search" name="query" value="${esc(state.query)}" placeholder="Zoek op titel of auteur"
          enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false">
        <button type="button" class="search-clear" aria-label="Zoekopdracht wissen" ${state.query ? "" : "hidden"}>${icon("close", "icon-sm")}</button>
      </label>
      <div class="pills"></div>
      <button type="button" class="link-btn add-wish js-add-wish">${icon("plus", "icon-sm")} Boek toevoegen aan verlanglijst</button>
    </div>

    <div class="shelf-results"></div>
  `;

  const eyebrow = root.querySelector(".eyebrow-text");
  const tools = root.querySelector(".shelf-tools");
  const pills = root.querySelector(".pills");
  const results = root.querySelector(".shelf-results");
  const search = root.querySelector('input[name="query"]');
  const clear = root.querySelector(".search-clear");
  const addWish = root.querySelector(".add-wish");

  function update(animateId = null) {
    releaseCovers();
    const onWishlist = state.list === "verlanglijst";
    const books = lists[state.list];

    root.querySelectorAll("[data-list]").forEach((b) => b.setAttribute("aria-selected", b.dataset.list === state.list));
    tools.hidden = books.length === 0;
    addWish.hidden = !onWishlist;

    // the wishlist has no reading status (you don't have the book yet)
    if (onWishlist) state.status = "alle";

    const genres = usedGenres(books);
    const genreOptions = { alle: "Alle genres" };
    for (const g of genres) genreOptions[g] = g;
    if (books.some((b) => !b.genres?.length)) genreOptions[NO_GENRE] = "Zonder genre";
    // a genre picked from Home may be spelled differently; find the matching option
    if (!(state.genre in genreOptions)) {
      state.genre = genres.find((g) => g.toLocaleLowerCase("nl") === state.genre.toLocaleLowerCase("nl")) ?? "alle";
    }
    const shown = filterAndSort(books, state);
    const filtered = state.query || state.status !== "alle" || state.format !== "alle" || state.genre !== "alle";

    const wishTotal = onWishlist ? books.reduce((sum, b) => sum + (b.priceCents ?? 0), 0) : 0;
    eyebrow.textContent = filtered
      ? `${shown.length} van ${books.length} boeken`
      : onWishlist && wishTotal
        ? `${booksLabel(books.length)} · zo'n ${formatEuro(wishTotal)}`
        : booksLabel(books.length);

    pills.innerHTML = `
      ${pillSelect("sort", SORTS, state.sort, false)}
      ${genres.length ? pillSelect("genre", genreOptions, state.genre, true) : ""}
      ${onWishlist ? "" : pillSelect("status", { alle: "Alle leesstatussen", ...STATUSES }, state.status, true)}
      ${pillSelect("format", { alle: "Alle soorten", ...FORMATS }, state.format, true)}
      ${filtered ? `<button type="button" class="pill-reset js-reset">${icon("close", "icon-sm")} Wis</button>` : ""}
    `;

    if (books.length === 0) {
      results.innerHTML = onWishlist
        ? `<div class="card empty">
             ${wishArt}
             <h2>Je verlanglijst is nog leeg</h2>
             <p>Zet hier boeken die je nog wilt kopen. Handig om in de boekwinkel even te checken ♡</p>
             <button type="button" class="btn btn-primary js-add-wish">Boek toevoegen aan verlanglijst</button>
           </div>`
        : `<div class="card empty">
             ${emptyShelfArt}
             <h2>Je boekenkast is nog leeg</h2>
             <p>Voeg je eerste boek toe en zie je plank langzaam vollopen.</p>
             <a class="btn btn-primary" href="#/toevoegen">Eerste boek toevoegen</a>
           </div>`;
      return;
    }

    results.innerHTML = shown.length
      ? bookcaseHTML(shown, animateId)
      : `<div class="card empty no-results">
           <h2>Niets gevonden</h2>
           <p>Geen boeken die hierbij passen.</p>
           <button type="button" class="btn btn-ghost js-reset">Alles weer tonen</button>
         </div>`;
  }

  root.querySelector(".shelf-switch").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-list]");
    if (!btn || btn.dataset.list === state.list) return;
    state.list = btn.dataset.list;
    update();
  });

  search.addEventListener("input", () => {
    state.query = search.value;
    clear.hidden = !search.value;
    update();
  });
  // "Search" on the iPhone keyboard just closes the keyboard
  search.addEventListener("keydown", (e) => { if (e.key === "Enter") search.blur(); });
  clear.addEventListener("click", () => {
    search.value = state.query = "";
    clear.hidden = true;
    update();
  });

  pills.addEventListener("change", (e) => {
    state[e.target.name] = e.target.value;
    save();
    update();
  });
  root.addEventListener("click", (e) => {
    if (e.target.closest(".js-add-wish")) {
      preferWishlist(); // the add-book form will start on "Op mijn verlanglijst"
      location.hash = "#/toevoegen";
      return;
    }
    if (!e.target.closest(".js-reset")) return;
    Object.assign(state, { query: "", status: "alle", format: "alle", genre: "alle" });
    search.value = "";
    clear.hidden = true;
    save();
    update();
  });

  update(justAdded);
}
