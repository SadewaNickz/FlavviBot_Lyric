const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Kuroshiro = require('kuroshiro').default || require('kuroshiro');
const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');

let kuroshiro = null;
let initPromise = null;

// Cache sesi lirik per message ID untuk fitur tombol toggle
const lyricsSessions = new Map();

/**
 * Inisialisasi Kuroshiro (hanya sekali saat pertama dipakai)
 */
async function getKuroshiro() {
  if (kuroshiro) return kuroshiro;
  if (!initPromise) {
    initPromise = (async () => {
      const instance = new Kuroshiro();
      await instance.init(new KuromojiAnalyzer());
      kuroshiro = instance;
      return instance;
    })();
  }
  return await initPromise;
}

/**
 * Cek apakah teks mengandung huruf Jepang (Kanji, Hiragana, Katakana)
 * @param {string} text
 * @returns {boolean}
 */
function hasJapanese(text) {
  if (!text) return false;
  // Regex untuk Hiragana (\u3040-\u309f), Katakana (\u30a0-\u30ff), Kanji (\u4e00-\u9faf)
  return /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf]/.test(text);
}

/**
 * Ubah teks atau lirik (termasuk timestamp [mm:ss]) ke Romaji (alfabet latin)
 * @param {string} text
 * @returns {Promise<string>}
 */
async function toRomaji(text) {
  if (!text || !hasJapanese(text)) return text;

  const ks = await getKuroshiro();
  const lines = text.split('\n');
  const convertedLines = [];

  for (const line of lines) {
    if (!hasJapanese(line)) {
      convertedLines.push(line);
      continue;
    }

    // Deteksi timestamp synced lyrics: [00:35.71] atau [00:35]
    const match = line.match(/^(\[\d{1,2}:\d{2}(?:\.\d{1,3})?\]\s*)(.*)/);
    if (match) {
      const timestamp = match[1];
      const lyricText = match[2];

      if (lyricText.trim()) {
        const romaji = await ks.convert(lyricText, { to: 'romaji', mode: 'spaced' });
        convertedLines.push(timestamp + romaji.replace(/\s+/g, ' ').trim());
      } else {
        convertedLines.push(line);
      }
    } else {
      const romaji = await ks.convert(line, { to: 'romaji', mode: 'spaced' });
      convertedLines.push(romaji.replace(/\s+/g, ' ').trim());
    }
  }

  return convertedLines.join('\n');
}

/**
 * Siapkan data lirik — OTOMATIS ubah ke Romaji jika terdeteksi bahasa Jepang
 * @param {object} lyricsData
 * @returns {Promise<{ currentLyrics: object, originalLyrics: object, romajiLyrics: object|null, hasJapanese: boolean, isRomaji: boolean }>}
 */
async function prepareLyricsData(lyricsData) {
  if (!lyricsData) return null;

  const rawLyrics = lyricsData.syncedLyrics || lyricsData.plainLyrics || '';
  const isJp = hasJapanese(rawLyrics);

  if (!isJp) {
    return {
      currentLyrics: lyricsData,
      originalLyrics: lyricsData,
      romajiLyrics: null,
      hasJapanese: false,
      isRomaji: false,
    };
  }

  console.log(`[Romaji] Japanese lyrics detected for "${lyricsData.trackName}". Converting automatically to Romaji...`);

  // Konversi otomatis ke Romaji
  const romajiSynced = lyricsData.syncedLyrics ? await toRomaji(lyricsData.syncedLyrics) : null;
  const romajiPlain = lyricsData.plainLyrics ? await toRomaji(lyricsData.plainLyrics) : null;

  const romajiLyrics = {
    ...lyricsData,
    syncedLyrics: romajiSynced,
    plainLyrics: romajiPlain,
  };

  return {
    currentLyrics: romajiLyrics, // Default langsung Romaji (alfabet)!
    originalLyrics: lyricsData,
    romajiLyrics: romajiLyrics,
    hasJapanese: true,
    isRomaji: true,
  };
}

/**
 * Buat tombol toggle Romaji / Kanji
 * @param {boolean} isRomaji
 * @returns {ActionRowBuilder}
 */
function createRomajiButton(isRomaji) {
  const button = new ButtonBuilder()
    .setCustomId('toggle_romaji')
    .setLabel(isRomaji ? '🇯🇵 Tampilkan Kanji Asli' : '🔤 Ubah ke Romaji (Alfabet)')
    .setStyle(isRomaji ? ButtonStyle.Secondary : ButtonStyle.Primary);

  return new ActionRowBuilder().addComponents(button);
}

/**
 * Simpan sesi lirik ke memory
 */
function saveLyricsSession(messageId, session) {
  if (!messageId || !session) return;
  lyricsSessions.set(messageId, session);

  // Bersihkan cache jika terlalu besar (> 100 sesi)
  if (lyricsSessions.size > 100) {
    const firstKey = lyricsSessions.keys().next().value;
    lyricsSessions.delete(firstKey);
  }
}

/**
 * Hapus sesi lirik dari memory (misal saat pesan lirik dihapus)
 * @param {string} messageId
 */
function deleteLyricsSession(messageId) {
  if (!messageId) return;
  lyricsSessions.delete(messageId);
}

/**
 * Handler saat tombol toggle diklik
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleRomajiToggle(interaction) {
  const { createLyricsEmbeds } = require('../utils/formatLyrics');
  const session = lyricsSessions.get(interaction.message.id);

  if (!session) {
    return await interaction.reply({
      content: '⚠️ Sesi lirik ini sudah kedaluwarsa. Silakan ketik `/lyrics` lagi untuk memuat ulang.',
      ephemeral: true,
    });
  }

  // Toggle mode
  session.isRomaji = !session.isRomaji;
  const targetLyrics = session.isRomaji ? session.romajiLyrics : session.originalLyrics;
  const embeds = createLyricsEmbeds(targetLyrics, true, session.isRomaji);
  const buttonRow = createRomajiButton(session.isRomaji);

  await interaction.update({
    embeds: [embeds[0]],
    components: [buttonRow],
  });
}

module.exports = {
  hasJapanese,
  toRomaji,
  getKuroshiro,
  prepareLyricsData,
  createRomajiButton,
  saveLyricsSession,
  deleteLyricsSession,
  handleRomajiToggle,
};
