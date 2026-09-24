const config = require('../config');
const { parseFlaviBotEmbed, isPlaybackEndMessage } = require('../utils/parseEmbed');
const { findBestLyrics } = require('../services/lrclib');
const { extractTextFromImage, parseSongFromOCR } = require('../services/ocr');
const {
  createLyricsEmbeds,
  createErrorEmbed,
  createSearchingEmbed,
  createNotFoundEmbed,
} = require('../utils/formatLyrics');
const {
  prepareLyricsData,
  createRomajiButton,
  saveLyricsSession,
  deleteLyricsSession,
} = require('../services/romaji');

// Cooldown map — mencegah spam
const cooldowns = new Map();

// Simpan lagu terakhir per guild untuk command /lyrics tanpa query
const lastDetected = new Map();

// Simpan judul lagu terakhir per guild — mencegah duplikasi lirik
const lastSongTitle = new Map();

// Simpan pesan lirik per guild agar bisa dihapus saat lagu ganti / antrean berhenti
// guildId -> { channelId: string, ids: string[] }
const lyricsMessages = new Map();

/**
 * Catat ID pesan lirik agar bisa dibersihkan nanti
 */
function trackLyricsMessage(guildId, channelId, messageId) {
  if (!guildId || !channelId || !messageId) return;
  const entry = lyricsMessages.get(guildId) || { channelId, ids: [] };
  entry.channelId = channelId;
  entry.ids.push(messageId);
  lyricsMessages.set(guildId, entry);
}

/**
 * Hapus semua pesan lirik lagu sebelumnya untuk guild ini
 * @param {string} guildId
 * @param {import('discord.js').Client} client
 */
async function clearLyricsMessages(guildId, client) {
  const entry = lyricsMessages.get(guildId);
  if (!entry || entry.ids.length === 0) {
    lyricsMessages.delete(guildId);
    return;
  }

  lyricsMessages.delete(guildId);

  const channel = client.channels.cache.get(entry.channelId)
    || await client.channels.fetch(entry.channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    for (const id of entry.ids) deleteLyricsSession(id);
    return;
  }

  for (const id of entry.ids) {
    try {
      await channel.messages.delete(id);
    } catch (_) {
      // Pesan sudah hilang / tidak bisa dihapus — abaikan
    }
    deleteLyricsSession(id);
  }
}

/**
 * Process pesan dari FlaviBot — dipakai oleh messageCreate DAN messageUpdate
 * @param {import('discord.js').Message} message
 */
async function processFlaviBotMessage(message) {
  // Skip jika bukan dari FlaviBot (atau bot lain jika ID belum diset)
  if (config.flavibotId && message.author.id !== config.flavibotId) return;
  if (!config.flavibotId && !message.author.bot) return;

  const guildId = message.guildId;
  const now = Date.now();

  // Jika FlaviBot menandakan pemutaran berhenti (keluar voice / antrean habis),
  // hapus lirik lagu sebelumnya agar tidak tertinggal di chat
  if (isPlaybackEndMessage(message)) {
    console.log(`[AutoDetect] Playback ended in guild ${guildId} — clearing lyrics`);
    await clearLyricsMessages(guildId, message.client);
    lastSongTitle.delete(guildId);
    return;
  }

  try {
    // Parse embed FlaviBot
    const songInfo = parseFlaviBotEmbed(message);
    if (!songInfo) return;

    let title = songInfo.title;
    let artist = songInfo.artist;

    // Jika tidak ada title tapi ada image, coba OCR
    if (!title && songInfo.imageUrl) {
      console.log('[AutoDetect] No text in embed, trying OCR...');
      const ocrText = await extractTextFromImage(songInfo.imageUrl);
      if (ocrText) {
        const ocrResult = parseSongFromOCR(ocrText);
        if (ocrResult) {
          title = ocrResult.title;
          artist = ocrResult.artist;
        }
      }
    }

    if (!title) {
      return;
    }

    // Selalu simpan lagu terakhir ke memory agar /lyrics tanpa argumen selalu dapat lagu terbaru
    lastDetected.set(guildId, { title, artist, timestamp: now });

    // Cek apakah lagu sama dengan yang terakhir dikirim (hindari duplikat lirik saat progress bar terupdate)
    const songKey = `${title}||${artist || ''}`.toLowerCase();
    if (lastSongTitle.get(guildId) === songKey) {
      return;
    }

    // Cooldown check untuk pengiriman pesan otomatis
    const lastTime = cooldowns.get(guildId) || 0;
    if (now - lastTime < config.autoDetectCooldown) return;

    console.log(`[AutoDetect] Detected new song: "${title}"${artist ? ` by ${artist}` : ''}`);

    // Update cooldown & last song
    cooldowns.set(guildId, now);
    lastSongTitle.set(guildId, songKey);

    // Hapus lirik lagu sebelumnya sebelum menampilkan yang baru
    await clearLyricsMessages(guildId, message.client);

    // Kirim "sedang mencari" embed
    const query = artist ? `${title} - ${artist}` : title;
    const searchMsg = await message.channel.send({
      embeds: [createSearchingEmbed(query)],
    });
    trackLyricsMessage(guildId, message.channelId, searchMsg.id);

    // Cari lirik
    const lyrics = await findBestLyrics(title, artist);

    if (!lyrics) {
      await searchMsg.edit({ embeds: [createNotFoundEmbed(query)] });
      return;
    }

    // Siapkan lirik — otomatis ubah ke Romaji jika lagu Jepang
    const prepared = await prepareLyricsData(lyrics);
    const embeds = createLyricsEmbeds(prepared.currentLyrics, true, prepared.isRomaji);
    const components = prepared.hasJapanese ? [createRomajiButton(prepared.isRomaji)] : [];

    // Edit pesan pertama dengan lirik + tombol toggle (jika Jepang)
    const sentMsg = await searchMsg.edit({ embeds: [embeds[0]], components });
    if (prepared.hasJapanese && sentMsg) {
      saveLyricsSession(sentMsg.id, prepared);
    }

    for (let i = 1; i < embeds.length; i++) {
      const pageMsg = await message.channel.send({ embeds: [embeds[i]] });
      trackLyricsMessage(guildId, message.channelId, pageMsg.id);
    }

    console.log(`[AutoDetect] Lyrics sent for: ${lyrics.trackName}${prepared.isRomaji ? ' (Romaji)' : ''}`);
  } catch (error) {
    console.error('[AutoDetect] Error:', error);
  }
}

/**
 * Event handler: messageCreate
 */
const messageCreateHandler = {
  name: 'messageCreate',
  async execute(message) {
    await processFlaviBotMessage(message);
  },
};

/**
 * Event handler: messageUpdate
 * FlaviBot sering MENGEDIT pesan "Now Playing" saat ganti lagu
 */
const messageUpdateHandler = {
  name: 'messageUpdate',
  async execute(oldMessage, newMessage) {
    // Fetch full message jika partial
    if (newMessage.partial) {
      try {
        newMessage = await newMessage.fetch();
      } catch (err) {
        console.error('[messageUpdate] Could not fetch message:', err);
        return;
      }
    }
    await processFlaviBotMessage(newMessage);
  },
};

// Export lastDetected agar bisa diakses dari command /lyrics
function getLastDetected() {
  return lastDetected;
}

module.exports = {
  messageCreateHandler,
  messageUpdateHandler,
  getLastDetected,
};
