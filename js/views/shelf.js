// Bookshelf: covers standing on wooden-ish shelves, 3 per plank,
// with search, sorting and filters on top.
import { screenHeader, esc } from "../ui.js";
import { getAllBooks } from "../db.js";
import { takeJustAdded, filterAndSort, usedGenres, SORTS, STATUSES, FORMATS, NO_GENRE } from "../books.js";
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
const state = { query: "", sort: "nieuwste", status: "alle", format: "alle", genre: "alle", ...loadSaved() };

// Used by Home and the detail screen: open the shelf showing one genre.
export function showGenreOnShelf(genre) {
  Object.assign(state, { query: "", status: "alle", format: "alle", genre });
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
            </a>`).join("")}
        </div>`).join("")}
    </div>`;
}

export async function render(root) {
  releaseCovers();
  const books = await getAllBooks();
  const justAdded = takeJustAdded();

  if (books.length === 0) {
    root.innerHTML = `
      ${screenHeader({ eyebrow: "0 boeken", title: "Boekenkast", eyebrowIcon: "bookmark" })}
      <div class="card empty">
        ${emptyShelfArt}
        <h2>Je boekenkast is nog leeg</h2>
        <p>Voeg je eerste boek toe en zie je plank langzaam vollopen.</p>
        <a class="btn btn-primary" href="#/toevoegen">Eerste boek toevoegen</a>
      </div>`;
    return;
  }

  root.innerHTML = `
    ${screenHeader({ eyebrow: `<span class="eyebrow-text"></span>`, title: "Boekenkast", eyebrowIcon: "bookmark" })}

    <div class="shelf-tools">
      <label class="search">
        ${icon("search")}
        <input type="search" name="query" value="${esc(state.query)}" placeholder="Zoek op titel of auteur"
          enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false">
        <button type="button" class="search-clear" aria-label="Zoekopdracht wissen" ${state.query ? "" : "hidden"}>${icon("close", "icon-sm")}</button>
      </label>
      <div class="pills"></div>
    </div>

    <div class="shelf-results"></div>
  `;

  const eyebrow = root.querySelector(".eyebrow-text");
  const pills = root.querySelector(".pills");
  const results = root.querySelector(".shelf-results");
  const search = root.querySelector('input[name="query"]');
  const clear = root.querySelector(".search-clear");

  function update(animateId = null) {
    releaseCovers();
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

    eyebrow.textContent = filtered
      ? `${shown.length} van ${books.length} boeken`
      : books.length === 1 ? "1 boek" : `${books.length} boeken`;

    pills.innerHTML = `
      ${pillSelect("sort", SORTS, state.sort, false)}
      ${genres.length ? pillSelect("genre", genreOptions, state.genre, true) : ""}
      ${pillSelect("status", { alle: "Alle leesstatussen", ...STATUSES }, state.status, true)}
      ${pillSelect("format", { alle: "Alle soorten", ...FORMATS }, state.format, true)}
      ${filtered ? `<button type="button" class="pill-reset js-reset">${icon("close", "icon-sm")} Wis</button>` : ""}
    `;

    results.innerHTML = shown.length
      ? bookcaseHTML(shown, animateId)
      : `<div class="card empty no-results">
           <h2>Niets gevonden</h2>
           <p>Geen boeken die hierbij passen.</p>
           <button type="button" class="btn btn-ghost js-reset">Alles weer tonen</button>
         </div>`;
  }

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
    if (!e.target.closest(".js-reset")) return;
    Object.assign(state, { query: "", status: "alle", format: "alle", genre: "alle" });
    search.value = "";
    clear.hidden = true;
    save();
    update();
  });

  update(justAdded);
}
