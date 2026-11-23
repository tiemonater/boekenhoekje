# Libraries

## html5-qrcode 2.3.8
Source: https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js
Original sha512: r6rDA7W6ZeQhvl8S7yRVQUKVHdexq+GAlNkNNqVC7YyIV+NwqCTJe2hDWCiffTyRNOeGEzRRJ9ifvRm/HCzGYg==

**Local change:** the ZXing hint `TRY_HARDER` is switched on
(`o.set(E.DecodeHintType.TRY_HARDER,!0)` instead of `!1`).
Without it, ZXing only checks ~15 rows in the middle of the image and never
rotates it, which made book barcodes on iPhone very hard to read.
Re-apply this change if the library is ever updated.
