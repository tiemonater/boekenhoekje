// Draws a book cover: the real image if there is one,
// otherwise a pretty made-up cover with the title.
import { esc } from "./ui.js";
import { icon } from "./icons.js";

const TONES = 5; // matches --cover-0 … --cover-4 in theme.css
let objectUrls = [];

// Same title always gets the same color.
function toneFor(text) {
  let hash = 0;
  for (const ch of text) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return hash % TONES;
}

export function coverHTML(book, extraClass = "") {
  if (book.cover instanceof Blob) {
    const url = URL.createObjectURL(book.cover);
    objectUrls.push(url);
    return `<div class="cover ${extraClass}"><img src="${url}" alt="" loading="lazy"></div>`;
  }
  if (typeof book.cover === "string" && /^https:\/\//.test(book.cover)) {
    // a cover on the internet; if it can't load (offline), the made-up cover shows instead
    return `
      <div class="cover cover-made tone-${toneFor(book.title || "?")} ${extraClass}">
        <span class="cover-title">${esc(book.title)}</span>
        <span class="cover-author">${esc(book.author)}</span>
        <img class="cover-web" src="${esc(book.cover)}" alt="" loading="lazy" onerror="this.remove()">
      </div>`;
  }
  return `
    <div class="cover cover-made tone-${toneFor(book.title || "?")} ${extraClass}">
      <span class="cover-title">${esc(book.title)}</span>
      ${icon("sparkle", "icon-sm cover-sparkle")}
      <span class="cover-author">${esc(book.author)}</span>
    </div>`;
}

// Frees memory used by images of the previous screen.
export function releaseCovers() {
  objectUrls.forEach((url) => URL.revokeObjectURL(url));
  objectUrls = [];
}
