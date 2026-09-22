/**
 * Event handler: interactionCreate
 * Router untuk semua slash command interactions
 */
module.exports = {
  name: 'interactionCreate',

  /**
   * @param {import('discord.js').Interaction} interaction
   * @param {import('discord.js').Collection} commands
   */
  async execute(interaction, commands) {
    // Handler tombol interaktif (misal: toggle Romaji)
    if (interaction.isButton()) {
      if (interaction.customId === 'toggle_romaji') {
        const { handleRomajiToggle } = require('../services/romaji');
        return await handleRomajiToggle(interaction);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = commands.get(interaction.commandName);

    if (!command) {
      console.error(`[Interaction] Command not found: ${interaction.commandName}`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`[Interaction] Error executing ${interaction.commandName}:`, error);

      const errorMsg = {
        content: '❌ Terjadi kesalahan saat menjalankan command.',
        ephemeral: true,
      };

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(errorMsg);
      } else {
        await interaction.reply(errorMsg);
      }
    }
  },
};
