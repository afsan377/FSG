const { REST, Routes } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [];

// Read your index.js to extract command data
const { SlashCommandBuilder } = require('discord.js');

// Here’s a simple example — add your actual commands here
commands.push(
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Show leaderboard'),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
).map(cmd => cmd.toJSON());

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
