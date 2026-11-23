// Camera barcode scanner (html5-qrcode library, kept in lib/ so it works offline).
// Safari has no built-in barcode reader, so the library reads the camera image itself.

let libPromise;

function loadLibrary() {
  if (window.__Html5QrcodeLibrary__) return Promise.resolve(window.__Html5QrcodeLibrary__);
  libPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "lib/html5-qrcode.min.js";
    script.onload = () => resolve(window.__Html5QrcodeLibrary__);
    script.onerror = () => { libPromise = null; reject(new Error("Scanner kon niet laden")); };
    document.head.append(script);
  });
  return libPromise;
}

// Starts the camera inside the element with id `elementId`.
// Calls onIsbn(isbn) once a book barcode (978/979…) is read.
// Returns a stop() function.
export async function startScanner(elementId, onIsbn) {
  const lib = await loadLibrary();
  const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = lib;
  const scanner = new Html5Qrcode(elementId, {
    formatsToSupport: [F.EAN_13],
    verbose: false,
    useBarCodeDetectorIfSupported: true,
  });

  let done = false;
  await scanner.start(
    { facingMode: "environment" },
    {
      fps: 12,
      // a wide, low box: barcodes are wide
      qrbox: (w, h) => ({ width: Math.floor(Math.min(w * 0.86, 340)), height: Math.floor(Math.min(h * 0.42, 150)) }),
      aspectRatio: 1.1,
    },
    (text) => {
      if (done) return;
      const code = text.replace(/\D/g, "");
      if (!/^97[89]\d{10}$/.test(code)) return; // not a book barcode (e.g. a price sticker)
      done = true;
      onIsbn(code);
    },
    () => {} // "nothing found in this frame" — happens many times per second
  );

  return async function stop() {
    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch { /* already stopped */ }
  };
}
