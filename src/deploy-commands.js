const { REST, Routes } = require('discord.js');
const config = require('./config');
const lyricsCommand = require('./commands/lyrics');

/**
 * Script untuk register slash commands ke Discord API
 * Jalankan: node src/deploy-commands.js
 */

const commands = [lyricsCommand.data.toJSON()];

const rest = new REST({ version: '10' }).setToken(config.token);

const guildId = process.env.GUILD_ID;

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} slash command(s)...`);

    const isGlobal = process.argv.includes('--global') || !guildId || guildId === 'your_guild_id_here';

    let data;
    if (isGlobal) {
      // Register global — muncul di semua server tempat bot berada
      data = await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commands }
      );
      console.log(`✅ Berhasil register ${data.length} slash command(s) secara GLOBAL!`);
      console.log('🌐 Command sekarang akan tersedia di SEMUA server tempat bot ini berada.');
      console.log('⏳ Catatan Discord: Global commands butuh waktu hingga ~1 jam untuk tersinkronisasi ke seluruh server.');
    } else {
      // Register per guild — INSTAN, langsung muncul di guild tertentu
      data = await rest.put(
        Routes.applicationGuildCommands(config.clientId, guildId),
        { body: commands }
      );
      console.log(`✅ Berhasil register ${data.length} slash command(s) di guild ${guildId}!`);
      console.log('⚡ Guild commands langsung tersedia (tidak perlu tunggu)!');
    }

    console.log('📋 Commands:');
    data.forEach(cmd => console.log(`   /${cmd.name} — ${cmd.description}`));
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();

