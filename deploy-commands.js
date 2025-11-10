// deploy-commands.js
import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';

// Load environment variables
const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ TOKEN, CLIENT_ID, or GUILD_ID missing in environment variables!');
  process.exit(1);
}

// Load commands from index.js commands collection
import index from './index.js';
const commandsArray = Array.from(index.commands.values()).map(cmd => cmd.data.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🚀 Starting slash command deployment...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsArray }
    );
    console.log('✅ Slash commands deployed successfully!');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
