const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Show leaderboard'),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a user'),
  new SlashCommandBuilder().setName('unban').setDescription('Unban a user'),
  new SlashCommandBuilder().setName('mute').setDescription('Mute a member'),
  new SlashCommandBuilder().setName('unmute').setDescription('Unmute a member')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🚀 Starting slash command deployment...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands },
    );

    console.log('✅ Slash commands deployed successfully!');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
