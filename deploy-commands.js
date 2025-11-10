import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

console.log("🧠 Loaded env:", {
  TOKEN: process.env.TOKEN ? "✅ Present" : "❌ Missing",
  CLIENT_ID: process.env.CLIENT_ID ? "✅ Present" : "❌ Missing",
  GUILD_ID: process.env.GUILD_ID ? "✅ Present" : "❌ Missing"
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN) {
  console.error("❌ TOKEN not found. Check Render environment variables or .env file!");
  process.exit(1);
}

const commands = [
  new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('Show leaderboard'),
  new SlashCommandBuilder().setName('ban').setDescription('Ban a user')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('🚀 Starting slash command deployment...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands deployed successfully!');
  } catch (error) {
    console.error('❌ Error deploying commands:', error);
  }
})();
