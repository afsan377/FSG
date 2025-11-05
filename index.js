// index.js - FSG WATCHER PRO

const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  EmbedBuilder, 
  PermissionsBitField, 
  Collection 
} = require("discord.js");
const mongoose = require("mongoose");
const express = require("express");
require("dotenv").config();

const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(3000, () => console.log("✅ Express active on port 3000"));

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
// ---------------- CONFIG (Part 2) ----------------
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID || "";
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID || "";
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID || "";
const MOD_ROLE_ID = process.env.MOD_ROLE_ID || "";
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID || "";
const MUTE_ROLE_ID = process.env.MUTE_ROLE_ID || "";
const BANLOG_CHANNEL = process.env.BANLOG_CHANNEL || "";
const MESSAGELOG_CHANNEL = process.env.MESSAGELOG_CHANNEL || "";
const MEMBERLOG_CHANNEL = process.env.MEMBERLOG_CHANNEL || "";
const GIVEAWAY_CHANNELS = process.env.GIVEAWAY_CHANNELS ? process.env.GIVEAWAY_CHANNELS.split(",") : [];
const MONGODB_URI = process.env.MONGODB_URI || "";

// ---------------- MONGODB CONNECT ----------------
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB connected"))
    .catch((e) => console.error("Mongo connection error:", e));
}

// ---------------- JSON STORAGE ----------------
const fs = require("fs");
const path = require("path");
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(path.join(dataDir, file + ".json"))); }
  catch { return {}; }
}
function writeJSON(file, data) {
  fs.writeFileSync(path.join(dataDir, file + ".json"), JSON.stringify(data, null, 2));
}

let messageCounts = readJSON("messages");

// ---------------- SCHEMAS ----------------
let GiveawayModel = null;
let WarningModel = null;

if (MONGODB_URI) {
  const gSchema = new mongoose.Schema({
    messageId: String,
    channelId: String,
    prize: String,
    winners: Number,
    endsAt: Date,
    hostId: String,
    roleRequired: String,
    extraRole: String
  });
  GiveawayModel = mongoose.models.Giveaway || mongoose.model("Giveaway", gSchema);

  const wSchema = new mongoose.Schema({
    guildId: String,
    userId: String,
    modId: String,
    reason: String,
    timestamp: Date
  });
  WarningModel = mongoose.models.Warning || mongoose.model("Warning", wSchema);
}

// ---------------- HELPERS (re-usable) ----------------
function hasRole(member, roleId) { return roleId && member && member.roles.cache.has(roleId); }
function isOwner(member) { return hasRole(member, OWNER_ROLE_ID); }
function isAdmin(member) { return member.permissions?.has(PermissionsBitField.Flags.Administrator) || hasRole(member, ADMIN_ROLE_ID); }
function isMod(member) { return isAdmin(member) || hasRole(member, MOD_ROLE_ID); }
function isStaff(member) { return isMod(member) || hasRole(member, STAFF_ROLE_ID); }

async function sendLog(channelId, content) {
  try {
    if (!channelId) return;
    const ch = await client.channels.fetch(channelId).catch(()=>null);
    if (ch) await ch.send(content).catch(()=>{});
  } catch {}
}

function pickWinners(participants, count) {
  const pool = Array.from(participants);
  const winners = [];
  while (winners.length < count && pool.length > 0) {
    winners.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return winners;
}

// ---------------- REGISTER SLASH COMMANDS ----------------
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
    new SlashCommandBuilder()
      .setName("gstart")
      .setDescription("Start a giveaway")
      .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 1h").setRequired(true))
      .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setRequired(true))
      .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
      .addRoleOption(o => o.setName("role_required").setDescription("Role required to enter"))
      .addRoleOption(o => o.setName("extra_entries").setDescription("Role for extra entries")),
    new SlashCommandBuilder().setName("ban").setDescription("Ban a user")
      .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason")),
    new SlashCommandBuilder().setName("kick").setDescription("Kick a user")
      .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason")),
    new SlashCommandBuilder().setName("mute").setDescription("Mute a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("duration").setDescription("Duration (e.g. 10m)"))
      .addStringOption(o => o.setName("reason").setDescription("Reason")),
    new SlashCommandBuilder().setName("unmute").setDescription("Unmute a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),
    new SlashCommandBuilder().setName("warn").setDescription("Warn a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),
    new SlashCommandBuilder().setName("lock").setDescription("Lock a channel"),
    new SlashCommandBuilder().setName("unlock").setDescription("Unlock a channel"),
    new SlashCommandBuilder().setName("msgcount").setDescription("Show message counts")
      .addUserOption(o => o.setName("user").setDescription("User")),
    new SlashCommandBuilder().setName("leaderboard").setDescription("Show top message senders"),
    new SlashCommandBuilder().setName("addrole").setDescription("Add a role to member")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),
    new SlashCommandBuilder().setName("removerole").setDescription("Remove a role from member")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),
    new SlashCommandBuilder().setName("createrole").setDescription("Create a role")
      .addStringOption(o => o.setName("name").setDescription("Role name").setRequired(true))
      .addStringOption(o => o.setName("color").setDescription("Role color (hex)"))
  ].map(c => c.toJSON());

  if (!TOKEN || !CLIENT_ID) return console.warn("Skipping command register: missing CLIENT_ID or TOKEN");
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  try {
    if (GUILD_ID) await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    else await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (err) {
    console.error("Command register failed:", err);
  }
}

// ---------------- READY ----------------
client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await registerCommands();
  // resumeGiveaways() can be called here if you store giveaways in DB
});

// ---------------- MESSAGE / MEMBER LOGS ----------------
client.on("messageDelete", async (msg) => {
  try {
    if (msg.partial) msg = await msg.fetch().catch(()=>null);
    if (!msg) return;
    const embed = new EmbedBuilder()
      .setTitle("Message Deleted")
      .addFields(
        { name: "Author", value: `${msg.author?.tag || "Unknown"}`, inline: true },
        { name: "Channel", value: `${msg.channel?.toString() || "Unknown"}`, inline: true },
        { name: "Content", value: msg.content || "No content" }
      )
      .setTimestamp();
    sendLog(MESSAGELOG_CHANNEL, { embeds: [embed] });
  } catch (e) { console.error("msgDelete log err:", e); }
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  try {
    if (oldMsg.partial) oldMsg = await oldMsg.fetch().catch(()=>null);
    if (newMsg.partial) newMsg = await newMsg.fetch().catch(()=>null);
    if (!oldMsg || !newMsg) return;
    if (oldMsg.content === newMsg.content) return;
    const embed = new EmbedBuilder()
      .setTitle("Message Edited")
      .addFields(
        { name: "Author", value: `${oldMsg.author?.tag || "Unknown"}`, inline: true },
        { name: "Channel", value: `${oldMsg.channel?.toString() || "Unknown"}`, inline: true },
        { name: "Before", value: oldMsg.content || "No content" },
        { name: "After", value: newMsg.content || "No content" }
      )
      .setTimestamp();
    sendLog(MESSAGELOG_CHANNEL, { embeds: [embed] });
  } catch (e) { console.error("msgUpdate log err:", e); }
});

client.on("guildMemberAdd", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("Member Joined")
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "ID", value: `${member.id}`, inline: true }
    )
    .setTimestamp();
  sendLog(MEMBERLOG_CHANNEL, { embeds: [embed] });
});

client.on("guildMemberRemove", async (member) => {
  const embed = new EmbedBuilder()
    .setTitle("Member Left")
    .addFields(
      { name: "User", value: `${member.user.tag}`, inline: true },
      { name: "ID", value: `${member.id}`, inline: true }
    )
    .setTimestamp();
  sendLog(MEMBERLOG_CHANNEL, { embeds: [embed] });
});

// ---------------- Keep messageCounts updated (if Part1 duplicated this event, keep only one) ----------------
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author?.bot) return;
    if (!messageCounts[msg.author.id]) messageCounts[msg.author.id] = { total: 0, daily: {} };
    messageCounts[msg.author.id].total++;
    const today = new Date().toISOString().split("T")[0];
    messageCounts[msg.author.id].daily[today] = (messageCounts[msg.author.id].daily[today] || 0) + 1;
    writeJSON("messages", messageCounts);
  } catch (e) { console.error("msgcount store err:", e); }
});
// ---------- INTERACTION HANDLER ----------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, guild, channel } = interaction;

  // Ping
  if (commandName === "ping") {
    return interaction.reply({ content: `🏓 Pong! Latency: ${client.ws.ping}ms`, ephemeral: true });
  }

  // Ban
  if (commandName === "ban") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const reason = options.getString("reason") || "No reason";
    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) return interaction.reply("⚠️ User not found in server.");
    await target.ban({ reason });
    await sendLog(BANLOG_CHANNEL, `🚫 **${user.tag}** was banned by ${member.user.tag} — ${reason}`);
    return interaction.reply(`✅ Banned **${user.tag}**`);
  }

  // Kick
  if (commandName === "kick") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const reason = options.getString("reason") || "No reason";
    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) return interaction.reply("⚠️ User not found.");
    await target.kick(reason);
    await sendLog(BANLOG_CHANNEL, `👢 **${user.tag}** was kicked by ${member.user.tag} — ${reason}`);
    return interaction.reply(`✅ Kicked **${user.tag}**`);
  }

  // Mute
  if (commandName === "mute") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const duration = options.getString("duration") || "10m";
    const reason = options.getString("reason") || "No reason";
    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) return interaction.reply("⚠️ User not found.");
    const muteRole = guild.roles.cache.get(MUTE_ROLE_ID);
    if (!muteRole) return interaction.reply("⚠️ Mute role not found.");
    await target.roles.add(muteRole, reason);
    await sendLog(BANLOG_CHANNEL, `🔇 ${user.tag} muted by ${member.user.tag} for ${duration} — ${reason}`);
    setTimeout(() => {
      if (target.roles.cache.has(muteRole.id)) target.roles.remove(muteRole, "Mute expired");
    }, ms(duration));
    return interaction.reply(`✅ Muted **${user.tag}** for ${duration}`);
  }

  // Unmute
  if (commandName === "unmute") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) return interaction.reply("⚠️ User not found.");
    const muteRole = guild.roles.cache.get(MUTE_ROLE_ID);
    if (!muteRole) return interaction.reply("⚠️ Mute role not found.");
    await target.roles.remove(muteRole, "Unmuted");
    await sendLog(BANLOG_CHANNEL, `🔊 ${user.tag} unmuted by ${member.user.tag}`);
    return interaction.reply(`✅ Unmuted **${user.tag}**`);
  }

  // Warn
  if (commandName === "warn") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const reason = options.getString("reason");
    if (!WarningModel) return interaction.reply("⚠️ Warnings disabled (no DB).");
    await WarningModel.create({
      guildId: guild.id,
      userId: user.id,
      modId: member.id,
      reason,
      timestamp: new Date(),
    });
    return interaction.reply(`⚠️ Warned **${user.tag}** — ${reason}`);
  }

  // Lock / Unlock
  if (commandName === "lock") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false });
    return interaction.reply("🔒 Channel locked.");
  }
  if (commandName === "unlock") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: true });
    return interaction.reply("🔓 Channel unlocked.");
  }

  // Role Add
  if (commandName === "addrole") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const role = options.getRole("role");
    const target = await guild.members.fetch(user.id);
    await target.roles.add(role);
    return interaction.reply(`✅ Added role ${role.name} to ${user.tag}`);
  }

  // Role Remove
  if (commandName === "removerole") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const user = options.getUser("user");
    const role = options.getRole("role");
    const target = await guild.members.fetch(user.id);
    await target.roles.remove(role);
    return interaction.reply(`✅ Removed role ${role.name} from ${user.tag}`);
  }

  // Create Role
  if (commandName === "createrole") {
    if (!isAdmin(member)) return interaction.reply({ content: "❌ Only admins can create roles.", ephemeral: true });
    const name = options.getString("name");
    const color = options.getString("color") || "#ffffff";
    const role = await guild.roles.create({ name, color });
    return interaction.reply(`✅ Created role **${role.name}**`);
  }

  // Giveaway start
  if (commandName === "gstart") {
    if (!isMod(member)) return interaction.reply({ content: "❌ You lack permission.", ephemeral: true });
    const duration = options.getString("duration");
    const winners = options.getInteger("winners");
    const prize = options.getString("prize");
    const roleRequired = options.getRole("role_required");
    const extraRole = options.getRole("extra_entries");

    const embed = new EmbedBuilder()
      .setTitle("🎉 Giveaway Started!")
      .setDescription(`**Prize:** ${prize}\n**Hosted by:** ${member}\n**Duration:** ${duration}`)
      .setColor("Gold")
      .setTimestamp();

    const msg = await channel.send({ embeds: [embed] });
    await msg.react("🎉");

    const giveaway = await GiveawayModel.create({
      messageId: msg.id,
      channelId: channel.id,
      prize,
      winners,
      hostId: member.id,
      roleRequired: roleRequired?.id || null,
      extraRole: extraRole?.id || null,
      endsAt: new Date(Date.now() + ms(duration)),
    });

    setTimeout(async () => {
      const giveawayData = await GiveawayModel.findById(giveaway.id);
      if (!giveawayData) return;
      const fetchedMsg = await channel.messages.fetch(giveawayData.messageId).catch(() => null);
      if (!fetchedMsg) return;
      const users = (await fetchedMsg.reactions.cache.get("🎉")?.users.fetch())?.filter((u) => !u.bot) || [];
      let participants = new Set(users.map((u) => u.id));

      if (giveawayData.roleRequired) {
        participants = new Set(
          [...participants].filter((id) =>
            guild.members.cache.get(id)?.roles.cache.has(giveawayData.roleRequired)
          )
        );
      }
      if (giveawayData.extraRole) {
        const extra = [...participants].filter((id) =>
          guild.members.cache.get(id)?.roles.cache.has(giveawayData.extraRole)
        );
        extra.forEach((id) => participants.add(id));
      }

      const winnersList = pickWinners(participants, giveawayData.winners);
      const mention = winnersList.map((id) => `<@${id}>`).join(", ") || "No valid participants 😢";
      await channel.send(`🎉 Giveaway ended!\n**Prize:** ${giveawayData.prize}\n**Winners:** ${mention}`);
      await GiveawayModel.deleteOne({ _id: giveawayData.id });
    }, ms(duration));

    return interaction.reply({ content: "🎁 Giveaway started!", ephemeral: true });
  }

  // Message Count
  if (commandName === "msgcount") {
    const user = options.getUser("user") || member.user;
    const count = messageCounts[user.id] || 0;
    return interaction.reply(`💬 ${user.tag} has sent **${count}** messages.`);
  }

  // Leaderboard
  if (commandName === "leaderboard") {
    const sorted = Object.entries(messageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    const desc = sorted.map(([id, count], i) => `**${i + 1}.** <@${id}> — ${count}`).join("\n");
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle("🏆 Message Leaderboard").setDescription(desc)] });
  }
});

// ---------- MESSAGE COUNTER & LOGS ----------
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  messageCounts[msg.author.id] = (messageCounts[msg.author.id] || 0) + 1;
  writeJSON("messages", messageCounts);
});

client.on("messageDelete", async (msg) => {
  if (!msg.guild || msg.author?.bot) return;
  await sendLog(MESSAGELOG_CHANNEL, `🗑️ Message deleted in ${msg.channel} by ${msg.author?.tag || "unknown"}`);
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (!oldMsg.guild || oldMsg.author?.bot) return;
  await sendLog(MESSAGELOG_CHANNEL, `✏️ Message edited in ${oldMsg.channel} by ${oldMsg.author.tag}`);
});

client.on("guildMemberAdd", (member) => {
  sendLog(MESSAGELOG_CHANNEL, `👋 ${member.user.tag} joined the server.`);
});

client.on("guildMemberRemove", (member) => {
  sendLog(MESSAGELOG_CHANNEL, `👋 ${member.user.tag} left the server.`);
});

// ---------- STARTUP ----------
client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("FSG WATCHER | /help", { type: 2 });
  await registerCommands();
});

client.login(TOKEN);
