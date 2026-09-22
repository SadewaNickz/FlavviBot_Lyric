const { SlashCommandBuilder } = require('discord.js');
const { findBestLyrics } = require('../services/lrclib');
const {
  createLyricsEmbeds,
  createSearchingEmbed,
  createNotFoundEmbed,
  createErrorEmbed,
} = require('../utils/formatLyrics');
const { parseSongString, parseFlaviBotEmbed, isNowPlayingEmbed } = require('../utils/parseEmbed');
const { prepareLyricsData, createRomajiButton, saveLyricsSession } = require('../services/romaji');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('🎵 Cari lirik lagu — otomatis atau manual')
    .addStringOption(option =>
      option
        .setName('query')
        .setDescription('Judul lagu (contoh: "Bohemian Rhapsody" atau "Queen - Bohemian Rhapsody")')
        .setRequired(false)
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const query = interaction.options.getString('query');

    // Jika query kosong, coba ambil dari lagu terakhir yang dideteksi
    if (!query) {
      return await handleAutoDetected(interaction);
    }

    // Cari lirik berdasarkan query manual
    await interaction.deferReply();

    try {
      // Parse query jika ada format "Artist - Title"
      const parsed = parseSongString(query);
      const title = parsed?.title || query;
      const artist = parsed?.artist || null;

      console.log(`[/lyrics] Searching: "${title}"${artist ? ` by ${artist}` : ''}`);

      const lyrics = await findBestLyrics(title, artist);

      if (!lyrics) {
        await interaction.editReply({ embeds: [createNotFoundEmbed(query)] });
        return;
      }

      // Siapkan lirik — otomatis ubah ke Romaji jika lagu Jepang
      const prepared = await prepareLyricsData(lyrics);
      const embeds = createLyricsEmbeds(prepared.currentLyrics, true, prepared.isRomaji);
      const components = prepared.hasJapanese ? [createRomajiButton(prepared.isRomaji)] : [];

      const replyMsg = await interaction.editReply({ embeds: [embeds[0]], components });
      if (prepared.hasJapanese && replyMsg) {
        saveLyricsSession(replyMsg.id, prepared);
      }

      // Kirim embed tambahan sebagai follow-up
      for (let i = 1; i < embeds.length; i++) {
        await interaction.followUp({ embeds: [embeds[i]] });
      }

      console.log(`[/lyrics] Lyrics sent for: ${lyrics.trackName}${prepared.isRomaji ? ' (Romaji)' : ''}`);
    } catch (error) {
      console.error('[/lyrics] Error:', error);
      await interaction.editReply({
        embeds: [createErrorEmbed('Terjadi kesalahan saat mencari lirik. Coba lagi nanti.')],
      });
    }
  },
};

/**
 * Handle /lyrics tanpa query — coba ambil dari auto-detect atau fetch pesan FlaviBot terakhir
 */
async function handleAutoDetected(interaction) {
  const { getLastDetected } = require('../events/messageCreate');
  const lastDetected = getLastDetected();
  const guildId = interaction.guildId;
  const channel = interaction.channel;

  // 1. Coba dari auto-detected memory dulu
  const detected = lastDetected.get(guildId);
  if (detected && detected.title) {
    const age = Date.now() - detected.timestamp;
    // Jika masih dalam rentang 30 menit
    if (age <= 30 * 60 * 1000) {
      await interaction.deferReply();
      console.log(`[/lyrics] Auto-detected from memory: "${detected.title}"${detected.artist ? ` by ${detected.artist}` : ''}`);
      return await searchAndReply(interaction, detected.title, detected.artist);
    }
  }

  // 2. Fallback: cari langsung dari pesan FlaviBot di channel ini
  await interaction.deferReply();

  try {
    const messages = await channel.messages.fetch({ limit: 50 });

    // Cari pesan FlaviBot (abaikan bot kita sendiri!)
    let songInfo = null;
    for (const [, m] of messages) {
      if (m.author.id === interaction.client.user.id) continue; // Jangan baca bot sendiri!
      if (config.flavibotId && m.author.id !== config.flavibotId && !m.author.bot) continue;

      const parsed = parseFlaviBotEmbed(m);
      if (parsed && parsed.title) {
        songInfo = parsed;
        console.log(`[/lyrics] Found song in channel #${channel.name}: "${parsed.title}"${parsed.artist ? ` by ${parsed.artist}` : ''}`);
        break;
      }
    }

    // 3. Fallback: jika tidak ada di channel ini, cari di channel musik lain di server
    if (!songInfo && interaction.guild) {
      const otherChannels = interaction.guild.channels.cache.filter(c =>
        c.isTextBased() &&
        c.id !== channel.id &&
        (c.name.includes('music') || c.name.includes('lagu') || c.name.includes('bot') || c.name.includes('general'))
      );

      for (const [, ch] of otherChannels) {
        try {
          const chMsgs = await ch.messages.fetch({ limit: 25 });
          for (const [, m] of chMsgs) {
            if (m.author.id === interaction.client.user.id) continue;
            const parsed = parseFlaviBotEmbed(m);
            if (parsed && parsed.title) {
              songInfo = parsed;
              console.log(`[/lyrics] Found song in channel #${ch.name}: "${parsed.title}"${parsed.artist ? ` by ${parsed.artist}` : ''}`);
              break;
            }
          }
          if (songInfo) break;
        } catch (_) {}
      }
    }

    if (songInfo && songInfo.title) {
      // Simpan ke memory agar subsequent /lyrics cepat
      lastDetected.set(guildId, {
        title: songInfo.title,
        artist: songInfo.artist,
        timestamp: Date.now(),
      });
      return await searchAndReply(interaction, songInfo.title, songInfo.artist);
    }
  } catch (err) {
    console.error('[/lyrics] Error fetching channel messages:', err.message);
  }

  // Jika tetap tidak ditemukan
  await interaction.editReply({
    embeds: [
      createErrorEmbed(
        '🎵 Tidak dapat mendeteksi lagu yang sedang diputar oleh FlaviBot!\n\n' +
        '**Kemungkinan penyebab:**\n' +
        '• FlaviBot belum memutar lagu atau lagu sudah selesai\n' +
        '• Pesan pemutar musik FlaviBot terhapus atau terlewat jauh\n\n' +
        '**Solusi:**\n' +
        '• Putar lagu dulu di FlaviBot, lalu ketik `/lyrics`\n' +
        '• Atau ketik manual dengan judul: `/lyrics The Changcuters - Main Serong`'
      ),
    ],
  });
}

/**
 * Cari lirik dan kirim reply
 */
async function searchAndReply(interaction, title, artist) {
  try {
    const lyrics = await findBestLyrics(title, artist);

    if (!lyrics) {
      const query = artist ? `${title} - ${artist}` : title;
      await interaction.editReply({ embeds: [createNotFoundEmbed(query)] });
      return;
    }

    // Siapkan lirik — otomatis ubah ke Romaji jika lagu Jepang
    const prepared = await prepareLyricsData(lyrics);
    const embeds = createLyricsEmbeds(prepared.currentLyrics, true, prepared.isRomaji);
    const components = prepared.hasJapanese ? [createRomajiButton(prepared.isRomaji)] : [];

    const replyMsg = await interaction.editReply({ embeds: [embeds[0]], components });
    if (prepared.hasJapanese && replyMsg) {
      saveLyricsSession(replyMsg.id, prepared);
    }

    for (let i = 1; i < embeds.length; i++) {
      await interaction.followUp({ embeds: [embeds[i]] });
    }
  } catch (error) {
    console.error('[/lyrics] Error:', error);
    await interaction.editReply({
      embeds: [createErrorEmbed('Terjadi kesalahan saat mencari lirik.')],
    });
  }
}
