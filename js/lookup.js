// Looks up a book by ISBN on free services (no account or key needed):
// 1. Open Library (book record)  2. Open Library (search, fills gaps)  3. Google Books (backup)
// Returns { isbn, title, author, pages, year, coverUrl } or null if nobody knows the book.

// "978-90-…" → "97890…". Also accepts old 10-digit ISBNs (may end in X).
export function cleanIsbn(text) {
  return String(text ?? "").toUpperCase().replace(/[^0-9X]/g, "");
}

export function isValidIsbn(isbn) {
  if (/^97[89]\d{10}$/.test(isbn)) {
    const sum = [...isbn].reduce((s, d, i) => s + Number(d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0;
  }
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((s, d, i) => s + (d === "X" ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0;
  }
  return false;
}

const yearFrom = (text) => {
  const m = String(text ?? "").match(/\b(1[5-9]\d\d|20\d\d)\b/);
  return m ? Number(m[1]) : null;
};

async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000); // don't wait forever on bad wifi
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function openLibraryRecord(isbn) {
  const data = await getJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const b = data?.[`ISBN:${isbn}`];
  if (!b) return null;
  return {
    title: [b.title, b.subtitle].filter(Boolean).join(": "),
    author: (b.authors ?? []).map((a) => a.name).join(", "),
    pages: b.number_of_pages ?? null,
    year: yearFrom(b.publish_date),
    coverUrl: b.cover?.large ?? b.cover?.medium ?? null,
  };
}

async function openLibrarySearch(isbn) {
  const data = await getJson(
    `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,number_of_pages_median,first_publish_year,cover_i&limit=1`
  );
  const d = data?.docs?.[0];
  if (!d) return null;
  return {
    title: d.title,
    author: (d.author_name ?? []).join(", "),
    pages: d.number_of_pages_median ?? null,
    year: d.first_publish_year ?? null,
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
  };
}

async function googleBooks(isbn) {
  const data = await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
  const v = data?.items?.[0]?.volumeInfo;
  if (!v) return null;
  const img = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail;
  return {
    title: [v.title, v.subtitle].filter(Boolean).join(": "),
    author: (v.authors ?? []).join(", "),
    pages: v.pageCount ?? null,
    year: yearFrom(v.publishedDate),
    // https, and without the curled-page effect
    coverUrl: img ? img.replace(/^http:/, "https:").replace("&edge=curl", "") : null,
  };
}

// Combines answers: the first source wins, later sources only fill empty fields.
export async function lookupIsbn(isbn) {
  const result = { isbn, title: "", author: "", pages: null, year: null, coverUrl: null };
  const isComplete = () => result.title && result.author && result.pages && result.year && result.coverUrl;

  for (const source of [openLibraryRecord, openLibrarySearch, googleBooks]) {
    const found = await source(isbn);
    if (found) {
      for (const key of ["title", "author", "pages", "year", "coverUrl"]) {
        if (!result[key] && found[key]) result[key] = found[key];
      }
    }
    if (isComplete()) break;
  }
  return result.title ? result : null;
}
