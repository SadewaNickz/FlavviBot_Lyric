const config = require('../config');

/**
 * Service untuk fetch lirik dari LRCLIB API
 * LRCLIB: gratis, tanpa API key, support synced lyrics (LRC)
 * Docs: https://lrclib.net/docs
 */

const headers = {
  'User-Agent': config.lrclibUserAgent,
};

/**
 * Cari lirik berdasarkan query string (fleksibel)
 * @param {string} query - Judul lagu, artis, atau kombinasi
 * @returns {Promise<Array>} Array of results
 */
async function searchLyrics(query) {
  try {
    const url = `${config.lrclibBaseUrl}/api/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) return [];
      throw new Error(`LRCLIB search error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[LRCLIB] Search error:', error.message);
    return [];
  }
}

/**
 * Ambil lirik dengan detail spesifik (lebih akurat)
 * @param {string} trackName - Nama lagu
 * @param {string} artistName - Nama artis
 * @param {string} [albumName] - Nama album (opsional)
 * @param {number} [duration] - Durasi dalam detik (opsional)
 * @returns {Promise<object|null>} Lyrics object atau null
 */
async function getLyrics(trackName, artistName, albumName, duration) {
  try {
    const params = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
    });

    if (albumName) params.append('album_name', albumName);
    if (duration) params.append('duration', duration.toString());

    const url = `${config.lrclibBaseUrl}/api/get?${params.toString()}`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`LRCLIB get error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[LRCLIB] Get error:', error.message);
    return null;
  }
}

/**
 * Cari lirik terbaik — coba getLyrics dulu, lalu searchLyrics sebagai fallback
 * Prioritas: synced lyrics > plain lyrics
 * @param {string} trackName
 * @param {string} [artistName]
 * @returns {Promise<object|null>} { trackName, artistName, albumName, syncedLyrics, plainLyrics }
 */
async function findBestLyrics(trackName, artistName) {
  // 1. Coba endpoint spesifik jika ada artis
  if (artistName) {
    const exact = await getLyrics(trackName, artistName);
    if (exact && (exact.syncedLyrics || exact.plainLyrics)) {
      return {
        trackName: exact.trackName || trackName,
        artistName: exact.artistName || artistName,
        albumName: exact.albumName || null,
        duration: exact.duration || null,
        syncedLyrics: exact.syncedLyrics || null,
        plainLyrics: exact.plainLyrics || null,
      };
    }

    // Coba jika nama artis & judul tertukar
    const reversed = await getLyrics(artistName, trackName);
    if (reversed && (reversed.syncedLyrics || reversed.plainLyrics)) {
      return {
        trackName: reversed.trackName || artistName,
        artistName: reversed.artistName || trackName,
        albumName: reversed.albumName || null,
        duration: reversed.duration || null,
        syncedLyrics: reversed.syncedLyrics || null,
        plainLyrics: reversed.plainLyrics || null,
      };
    }
  }

  // 2. Fallback: search endpoint dengan artis + judul
  const query = artistName ? `${artistName} ${trackName}` : trackName;
  let results = await searchLyrics(query);

  // Jika tidak ada hasil dan ada artis, coba search judul saja
  if (results.length === 0 && artistName) {
    results = await searchLyrics(trackName);
  }

  if (results.length === 0) return null;

  // Pilih result yang punya synced lyrics, kalau ada
  const withSynced = results.find(r => r.syncedLyrics);
  const best = withSynced || results[0];

  if (!best.syncedLyrics && !best.plainLyrics) return null;

  return {
    trackName: best.trackName || trackName,
    artistName: best.artistName || artistName || 'Unknown',
    albumName: best.albumName || null,
    duration: best.duration || null,
    syncedLyrics: best.syncedLyrics || null,
    plainLyrics: best.plainLyrics || null,
  };
}

module.exports = {
  searchLyrics,
  getLyrics,
  findBestLyrics,
};
