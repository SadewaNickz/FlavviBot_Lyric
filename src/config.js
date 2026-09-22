require('dotenv').config();

module.exports = {
  // Discord Bot Token
  token: process.env.DISCORD_TOKEN,

  // Bot Client ID (untuk register slash commands)
  clientId: process.env.CLIENT_ID,

  // FlaviBot User ID — digunakan untuk mengenali pesan FlaviBot
  flavibotId: process.env.FLAVIBOT_ID,

  // LRCLIB API base URL (gratis, tanpa API key)
  lrclibBaseUrl: 'https://lrclib.net',

  // User-Agent header untuk LRCLIB (wajib)
  lrclibUserAgent: 'FlaviBotLyric/1.0 (https://github.com/flavibot-lyric)',

  // Warna embed untuk bot
  embedColors: {
    primary: 0x7C3AED,   // ungu
    success: 0x10B981,   // hijau
    error: 0xEF4444,     // merah
    warning: 0xF59E0B,   // kuning
    synced: 0x3B82F6,    // biru — untuk synced lyrics
  },

  // Maksimal karakter per embed description (Discord limit 4096)
  maxEmbedChars: 4000,

  // Cooldown deteksi otomatis (ms) — mencegah spam
  autoDetectCooldown: 5000,
};
