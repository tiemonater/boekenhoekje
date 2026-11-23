// Book rules: the choices, how a book is built, and price helpers.

export const FORMATS = {
  hardcover: "Hardcover",
  paperback: "Paperback",
  anders: "Anders",
};

export const CONDITIONS = {
  nieuw: "Nieuw",
  tweedehands: "Tweedehands",
};

export const STATUSES = {
  "wil-lezen": "Wil ik lezen",
  "aan-het-lezen": "Aan het lezen",
  gelezen: "Gelezen",
};

// Ready-made genres. Your own genres are added next to these.
export const GENRES = [
  "Roman", "Literatuur", "Thriller", "Fantasy", "Sciencefiction", "Romance",
  "Feelgood", "Young Adult", "Klassieker", "Historisch", "Non-fictie",
  "Biografie", "Poëzie", "Kinderboek",
];

export const NO_GENRE = "zonder"; // filter value for books without a genre

// Tidies a list of genres: trims, removes empties and double entries
// ("fantasy" and "Fantasy" count as the same; the first spelling wins).
export function cleanGenres(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list ?? []) {
    const name = String(raw ?? "").trim().replace(/\s+/g, " ");
    const key = name.toLocaleLowerCase("nl");
    if (name && !seen.has(key)) { seen.add(key); out.push(name); }
  }
  return out;
}

// Genres actually used in the collection, A–Z.
export function usedGenres(books) {
  return cleanGenres(books.flatMap((b) => b.genres ?? []))
    .sort((a, b) => a.localeCompare(b, "nl", { sensitivity: "base" }));
}

// Ready-made genres plus any own genres from the collection.
export function allGenres(books) {
  const own = usedGenres(books).filter(
    (g) => !GENRES.some((d) => d.toLocaleLowerCase("nl") === g.toLocaleLowerCase("nl"))
  );
  return [...GENRES, ...own];
}

// Builds a complete, tidy book object from form data.
// `existing` is passed when editing, so id and createdAt stay the same.
export function makeBook(data, existing = {}) {
  const now = new Date().toISOString();
  return {
    id: existing.id ?? newId(),
    isbn: clean(data.isbn),
    title: clean(data.title),
    author: clean(data.author),
    // image Blob (own photo / downloaded copy), a web link to a cover, or null
    cover: "cover" in data ? data.cover ?? null : existing.cover ?? null,
    priceCents: data.priceCents ?? null,
    purchaseDate: data.purchaseDate || null,     // "2026-11-24"
    store: clean(data.store),
    format: data.format in FORMATS ? data.format : "paperback",
    condition: data.condition in CONDITIONS ? data.condition : "nieuw",
    status: data.status in STATUSES ? data.status : "wil-lezen",
    genres: cleanGenres(data.genres ?? existing.genres ?? []),
    pages: toWholeNumber(data.pages),
    year: toWholeNumber(data.year),
    notes: clean(data.notes),
    createdAt: existing.createdAt ?? now,
    updatedAt: now,
  };
}

// ---- Search, sort and filter (bookshelf) ----

export const SORTS = {
  nieuwste: "Nieuwste eerst",
  oudste: "Oudste eerst",
  titel: "Titel A–Z",
  auteur: "Auteur A–Z",
  genre: "Genre A–Z",
  "prijs-hoog": "Prijs hoog–laag",
  "prijs-laag": "Prijs laag–hoog",
};

// "Café" → "cafe", so searching works without accents or capitals.
const plain = (text) => String(text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Sort authors by surname: "Jane Austen" → "austen jane".
const surnameKey = (author) => {
  const words = plain(author).trim().split(/\s+/);
  return words.length > 1 ? `${words.at(-1)} ${words.slice(0, -1).join(" ")}` : words[0] ?? "";
};

const compareText = (a, b) => a.localeCompare(b, "nl", { sensitivity: "base", numeric: true });

const sorters = {
  nieuwste: (a, b) => b.createdAt.localeCompare(a.createdAt),
  oudste: (a, b) => a.createdAt.localeCompare(b.createdAt),
  titel: (a, b) => compareText(a.title, b.title),
  auteur: (a, b) => compareText(surnameKey(a.author), surnameKey(b.author)) || compareText(a.title, b.title),
  // by the book's first genre; books without a genre go last
  genre: (a, b) => {
    const ga = a.genres?.[0], gb = b.genres?.[0];
    if (!ga || !gb) return (!ga) - (!gb) || compareText(a.title, b.title);
    return compareText(ga, gb) || compareText(a.title, b.title);
  },
  // books without a price go last in both directions
  "prijs-hoog": (a, b) => byPrice(a, b, -1),
  "prijs-laag": (a, b) => byPrice(a, b, 1),
};

function byPrice(a, b, direction) {
  if (a.priceCents == null || b.priceCents == null) {
    return (a.priceCents == null) - (b.priceCents == null) || compareText(a.title, b.title);
  }
  return direction * (a.priceCents - b.priceCents) || compareText(a.title, b.title);
}

// filters: { query, sort, status, format } — "alle" means no filter.
export function filterAndSort(books, { query = "", sort = "nieuwste", status = "alle", format = "alle", genre = "alle" }) {
  const words = plain(query).split(/\s+/).filter(Boolean);
  const genreKey = plain(genre);
  return books
    .filter((b) => status === "alle" || b.status === status)
    .filter((b) => format === "alle" || b.format === format)
    .filter((b) => {
      if (genre === "alle") return true;
      if (genre === NO_GENRE) return !b.genres?.length;
      return (b.genres ?? []).some((g) => plain(g) === genreKey);
    })
    .filter((b) => {
      if (!words.length) return true;
      const haystack = plain(`${b.title} ${b.author}`);
      return words.every((w) => haystack.includes(w));
    })
    .sort(sorters[sort] ?? sorters.nieuwste);
}

// Numbers for the Home screen.
// Books without a price count as books, but not in the average.
export function computeStats(books, year = new Date().getFullYear()) {
  const priced = books.filter((b) => b.priceCents != null);
  const totalCents = priced.reduce((sum, b) => sum + b.priceCents, 0);

  let priciest = null;
  for (const b of priced) if (!priciest || b.priceCents > priciest.priceCents) priciest = b;

  // "This year" uses the purchase date, or the date it was added if that's empty.
  const spentThisYearCents = priced
    .filter((b) => (b.purchaseDate || b.createdAt || "").startsWith(String(year)))
    .reduce((sum, b) => sum + b.priceCents, 0);

  return {
    count: books.length,
    totalCents,
    averageCents: priced.length ? Math.round(totalCents / priced.length) : 0,
    priciest,
    spentThisYearCents,
  };
}

// Per genre: how many books and what they're worth, biggest first.
// A book with two genres counts in both. Books without a genre form their own group.
export function genreStats(books) {
  const groups = new Map();
  const add = (key, name, book) => {
    const g = groups.get(key) ?? { name, count: 0, totalCents: 0, isNone: key === NO_GENRE };
    g.count += 1;
    g.totalCents += book.priceCents ?? 0;
    groups.set(key, g);
  };
  for (const book of books) {
    const genres = cleanGenres(book.genres);
    if (!genres.length) add(NO_GENRE, "Zonder genre", book);
    for (const name of genres) add(name.toLocaleLowerCase("nl"), name, book);
  }
  const list = [...groups.values()].sort(
    (a, b) => a.isNone - b.isNone || b.count - a.count || b.totalCents - a.totalCents || compareText(a.name, b.name)
  );
  return {
    list,
    hasMultiGenreBooks: books.some((b) => (b.genres?.length ?? 0) > 1),
  };
}

// "12,50" / "12.50" / "€ 12" → 1250 cents. Empty → null.
export function parsePrice(text) {
  const raw = String(text ?? "").replace(/[^\d,.]/g, "");
  if (!raw) return null;
  // The last , or . is the decimal separator; others are thousand separators.
  const lastSep = Math.max(raw.lastIndexOf(","), raw.lastIndexOf("."));
  const normal = lastSep === -1
    ? raw
    : raw.slice(0, lastSep).replace(/[,.]/g, "") + "." + raw.slice(lastSep + 1);
  const value = Number(normal);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

// 1250 → "12,50" (for putting a price back into an input field)
export function priceToInput(cents) {
  return cents == null ? "" : (cents / 100).toFixed(2).replace(".", ",");
}

// A unique id for each book. crypto.randomUUID only exists on https/localhost,
// so on the iPhone test address (http://192.168…) we build one ourselves.
function newId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function clean(value) {
  return String(value ?? "").trim();
}

function toWholeNumber(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// A half-filled book from the scanner, waiting for the form to pick it up.
let draft = null;
export const setDraft = (book) => { draft = book; };
export function takeDraft() {
  const d = draft;
  draft = null;
  return d;
}

// Remembers the book that was just added, so the shelf can animate it.
let justAddedId = null;
export const markJustAdded = (id) => { justAddedId = id; };
export function takeJustAdded() {
  const id = justAddedId;
  justAddedId = null;
  return id;
}
