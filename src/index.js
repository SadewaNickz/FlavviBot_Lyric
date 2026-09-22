const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  ActivityType,
} = require('discord.js');

const config = require('./config');
const { messageCreateHandler, messageUpdateHandler } = require('./events/messageCreate');
const interactionCreateEvent = require('./events/interactionCreate');
const lyricsCommand = require('./commands/lyrics');
const { terminateWorker } = require('./services/ocr');

// ── Validasi ─────────────────────────────────────────────
if (!config.token) {
  console.error('❌ DISCORD_TOKEN tidak ditemukan! Buat file .env berdasarkan .env.example');
  process.exit(1);
}

if (!config.clientId) {
  console.error('❌ CLIENT_ID tidak ditemukan! Tambahkan ke file .env');
  process.exit(1);
}

if (!config.flavibotId) {
  console.warn('⚠️  FLAVIBOT_ID belum diset. Auto-detect FlaviBot tidak akan berjalan.');
  console.warn('   Tambahkan FLAVIBOT_ID di file .env untuk mengaktifkan auto-detect.');
}

// ── Client Setup ─────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Message,   // Untuk bisa menerima messageUpdate pada pesan lama
    Partials.Channel,
  ],
});

// ── Commands Collection ──────────────────────────────────
client.commands = new Collection();
client.commands.set(lyricsCommand.data.name, lyricsCommand);

// ── Events ───────────────────────────────────────────────

// Bot ready
client.once('ready', (c) => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🎵 FlaviBotLyric — Online!                ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  Bot:      ${c.user.tag.padEnd(33)}║`);
  console.log(`║  Servers:  ${String(c.guilds.cache.size).padEnd(33)}║`);
  console.log(`║  FlaviBot: ${(config.flavibotId || 'NOT SET').padEnd(33)}║`);
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Commands:                                   ║');
  console.log('║    /lyrics [query] — Cari lirik lagu         ║');
  console.log('║                                              ║');
  console.log('║  Listening: messageCreate + messageUpdate    ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');

  // Set activity/status
  c.user.setActivity('🎵 /lyrics untuk lirik lagu', {
    type: ActivityType.Listening,
  });
});

// Message create — pesan baru dari FlaviBot
client.on('messageCreate', (message) => {
  messageCreateHandler.execute(message);
});

// Message update — FlaviBot EDIT pesan "Now Playing" saat ganti lagu
client.on('messageUpdate', (oldMessage, newMessage) => {
  messageUpdateHandler.execute(oldMessage, newMessage);
});

// Interaction create — slash commands
client.on('interactionCreate', (interaction) => {
  interactionCreateEvent.execute(interaction, client.commands);
});

// ── Graceful Shutdown ────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down...`);
  await terminateWorker();
  client.destroy();
  console.log('👋 Goodbye!');
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// ── Login ────────────────────────────────────────────────
client.login(config.token).catch((error) => {
  console.error('❌ Gagal login ke Discord:', error.message);
  console.error('   Pastikan DISCORD_TOKEN di file .env sudah benar.');
  process.exit(1);
});
