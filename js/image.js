// Makes cover images small enough to store comfortably on the phone.
// An iPhone photo is 3–5 MB; a cover of 700 px tall is about 60–120 KB.

const MAX_SIZE = 700;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Afbeelding kon niet geladen worden")); };
    img.src = url; // Safari turns the photo the right way up by itself
  });
}

export async function shrinkImage(blob) {
  const img = await loadImage(blob);
  const scale = Math.min(1, MAX_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((out) => resolve(out ?? blob), "image/jpeg", 0.85));
}

// Downloads a cover from the internet and keeps a small copy.
// Returns null if the site doesn't allow it (then we keep just the link).
export async function downloadCover(url) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/") || blob.size < 1000) return null; // empty placeholder image
    return await shrinkImage(blob);
  } catch {
    return null;
  }
}
