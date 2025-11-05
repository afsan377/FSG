// ---------- FSG WATCHER (Main Bot File) ----------

// Imports
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField } = require("discord.js");
const mongoose = require("mongoose");
const express = require("express");
const ms = require("ms");
require("dotenv").config();

// Create an Express web server (keeps bot alive)
const app = express();
app.get("/", (req, res) => res.send("✅ FSG Watcher is running!"));
app.listen(3000, () => console.log("🌐 Express server active on port 3000"));

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember]
});

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || "", {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Bot ready event
client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
  client.user.setActivity("FSG Watcher | /help", { type: 2 });
});
