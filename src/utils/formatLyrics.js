const { EmbedBuilder } = require('discord.js');
const config = require('../config');

/**
 * Utility untuk memformat lirik agar tampil bagus di Discord embed
 * Prioritas: synced lyrics (LRC) > plain lyrics
 */

/**
 * Format synced lyrics (LRC) menjadi string yang readable
 * Format LRC: [mm:ss.xx] Baris lirik
 *
 * @param {string} syncedLyrics - Raw LRC string
 * @returns {string} Formatted lyrics
 */
function formatSyncedLyrics(syncedLyrics) {
  if (!syncedLyrics) return '';

  const lines = syncedLyrics.split('\n');
  const formatted = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Parse timestamp: [mm:ss.xx] atau [mm:ss]
    const match = trimmed.match(/^\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]\s*(.*)/);
    if (match) {
      const minutes = match[1];
      const seconds = match[2];
      const text = match[4] || '';

      // Format: ⏱ mm:ss │ lirik
      if (text.trim()) {
        formatted.push(`\`${minutes.padStart(2, '0')}:${seconds}\` ${text}`);
      } else {
        // Baris instrumental/kosong
        formatted.push(`\`${minutes.padStart(2, '0')}:${seconds}\` ♪ ...`);
      }
    } else {
      // Baris tanpa timestamp
      if (trimmed.length > 0) {
        formatted.push(trimmed);
      }
    }
  }

  return formatted.join('\n');
}

/**
 * Format plain lyrics
 * @param {string} plainLyrics
 * @returns {string}
 */
function formatPlainLyrics(plainLyrics) {
  if (!plainLyrics) return '';
  // Bersihkan baris kosong berlebih
  return plainLyrics
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

/**
 * Split lirik menjadi beberapa bagian jika melebihi batas karakter Discord
 * @param {string} text - Formatted lyrics
 * @param {number} maxChars - Max characters per part
 * @returns {string[]} Array of parts
 */
function splitLyrics(text, maxChars = config.maxEmbedChars) {
  if (text.length <= maxChars) return [text];

  const parts = [];
  const lines = text.split('\n');
  let current = '';

  for (const line of lines) {
    if ((current + '\n' + line).length > maxChars) {
      if (current) parts.push(current);
      current = line;
    } else {
      current = current ? current + '\n' + line : line;
    }
  }
  if (current) parts.push(current);

  return parts;
}

/**
 * Format durasi detik → mm:ss
 */
function formatDuration(seconds) {
  if (!seconds) return null;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Buat Discord embed(s) untuk menampilkan lirik
 * @param {object} lyricsData - Data dari LRCLIB
 * @param {boolean} preferSynced - Prioritas synced lyrics
 * @returns {EmbedBuilder[]}
 */
function createLyricsEmbeds(lyricsData, preferSynced = true, isRomaji = false) {
  const { trackName, artistName, albumName, duration, syncedLyrics, plainLyrics } = lyricsData;

  // Tentukan lirik mana yang dipakai
  let lyrics;
  let isSynced = false;

  if (preferSynced && syncedLyrics) {
    lyrics = formatSyncedLyrics(syncedLyrics);
    isSynced = true;
  } else if (plainLyrics) {
    lyrics = formatPlainLyrics(plainLyrics);
  } else if (syncedLyrics) {
    lyrics = formatSyncedLyrics(syncedLyrics);
    isSynced = true;
  } else {
    return [
      new EmbedBuilder()
        .setColor(config.embedColors.warning)
        .setTitle('⚠️ Lirik Tidak Ditemukan')
        .setDescription(`Tidak ada lirik untuk **${trackName}**${artistName ? ` — ${artistName}` : ''}`)
        .setTimestamp(),
    ];
  }

  // Split jika terlalu panjang
  const parts = splitLyrics(lyrics);
  const embeds = [];

  for (let i = 0; i < parts.length; i++) {
    const embed = new EmbedBuilder()
      .setColor(isSynced ? config.embedColors.synced : config.embedColors.primary)
      .setTimestamp();

    // Header hanya di embed pertama
    if (i === 0) {
      const typeIcon = isSynced ? '🎵' : '📝';
      let typeLabel = isSynced ? 'Synced Lyrics' : 'Lyrics';
      if (isRomaji) typeLabel += ' (Romaji)';
      embed.setTitle(`${typeIcon} ${trackName}`);

      // Info lagu — taruh di atas lirik dalam description
      const infoLines = [];
      if (artistName) infoLines.push(`🎤 **${artistName}**`);
      if (albumName) infoLines.push(`💿 ${albumName}`);
      if (duration) infoLines.push(`⏱ ${formatDuration(duration)}`);
      infoLines.push(`📋 ${typeLabel}`);

      const infoHeader = infoLines.join('  •  ');
      embed.setDescription(`${infoHeader}\n\n${parts[i]}`);
    } else {
      embed.setDescription(parts[i]);
    }

    // Footer di bagian terakhir
    if (i === parts.length - 1) {
      const pageInfo = parts.length > 1 ? ` • Halaman ${i + 1}/${parts.length}` : '';
      embed.setFooter({ text: `Powered by LRCLIB${pageInfo}` });
    } else {
      embed.setFooter({ text: `Halaman ${i + 1}/${parts.length} — lanjut di bawah ⬇️` });
    }

    embeds.push(embed);
  }

  return embeds;

}

/**
 * Buat embed error
 */
function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor(config.embedColors.error)
    .setTitle('❌ Error')
    .setDescription(message)
    .setTimestamp();
}

/**
 * Buat embed "sedang mencari"
 */
function createSearchingEmbed(query) {
  return new EmbedBuilder()
    .setColor(config.embedColors.primary)
    .setTitle('🔍 Mencari Lirik...')
    .setDescription(`Sedang mencari lirik untuk: **${query}**`)
    .setTimestamp();
}

/**
 * Buat embed "tidak ditemukan"
 */
function createNotFoundEmbed(query) {
  return new EmbedBuilder()
    .setColor(config.embedColors.warning)
    .setTitle('😔 Lirik Tidak Ditemukan')
    .setDescription(
      `Tidak dapat menemukan lirik untuk: **${query}**\n\n` +
      '**Tips:**\n' +
      '• Coba tulis judul lagu yang lebih spesifik\n' +
      '• Tambahkan nama artis, misal: `/lyrics Bohemian Rhapsody Queen`\n' +
      '• Pastikan ejaan sudah benar'
    )
    .setTimestamp();
}

module.exports = {
  formatSyncedLyrics,
  formatPlainLyrics,
  splitLyrics,
  createLyricsEmbeds,
  createErrorEmbed,
  createSearchingEmbed,
  createNotFoundEmbed,
};
