const { createWorker } = require('tesseract.js');

/**
 * OCR Service — mengekstrak teks dari gambar
 * Digunakan saat FlaviBot mengirim "Now Playing" sebagai image
 */

let worker = null;

/**
 * Inisialisasi OCR worker (lazy loading)
 */
async function getWorker() {
  if (!worker) {
    console.log('[OCR] Initializing Tesseract worker...');
    worker = await createWorker('eng');
    console.log('[OCR] Worker ready');
  }
  return worker;
}

/**
 * Ekstrak teks dari URL gambar
 * @param {string} imageUrl - URL gambar
 * @returns {Promise<string|null>} Extracted text atau null
 */
async function extractTextFromImage(imageUrl) {
  try {
    const w = await getWorker();
    const { data: { text } } = await w.recognize(imageUrl);

    if (!text || text.trim().length < 3) return null;

    console.log('[OCR] Extracted text:', text.trim().substring(0, 100));
    return text.trim();
  } catch (error) {
    console.error('[OCR] Error:', error.message);
    return null;
  }
}

/**
 * Parse song info dari OCR text
 * @param {string} ocrText - Raw OCR text
 * @returns {{ title: string, artist: string|null } | null}
 */
function parseSongFromOCR(ocrText) {
  if (!ocrText) return null;

  const lines = ocrText
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2);

  if (lines.length === 0) return null;

  // OCR dari FlaviBot "Now Playing" biasanya memiliki:
  // - Judul lagu di baris yang paling prominent
  // - Artis di baris berikutnya

  // Coba cari baris dengan separator " - " (Artist - Title)
  for (const line of lines) {
    const separators = [' - ', ' – ', ' — '];
    for (const sep of separators) {
      const idx = line.indexOf(sep);
      if (idx > 0) {
        const artist = line.substring(0, idx).trim();
        const title = line.substring(idx + sep.length).trim();
        if (artist.length >= 2 && title.length >= 2) {
          return { title, artist };
        }
      }
    }
  }

  // Fallback: ambil baris terpanjang sebagai title
  // dan baris kedua terpanjang sebagai artist
  const sortedByLength = [...lines].sort((a, b) => b.length - a.length);

  if (sortedByLength.length >= 2) {
    return {
      title: sortedByLength[0],
      artist: sortedByLength[1],
    };
  }

  return {
    title: sortedByLength[0],
    artist: null,
  };
}

/**
 * Cleanup worker saat bot shutdown
 */
async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    console.log('[OCR] Worker terminated');
  }
}

module.exports = {
  extractTextFromImage,
  parseSongFromOCR,
  terminateWorker,
};
