// =====================
// Single-file Full Bot
// =====================
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, PermissionsBitField, SlashCommandBuilder } = require("discord.js");
const express = require("express");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
const giveaways = new Map();
const messages = {};

// =====================
// Config from .env
// =====================
const TOKEN = process.env.TOKEN;
const PREFIX = process.env.PREFIX || "?";
const LOG_CHANNEL = process.env.LOG_CHANNEL;
const BANLOG_CHANNEL = process.env.BANLOG_CHANNEL;
const GIVEAWAY_CHANNELS = process.env.GIVEAWAY_CHANNELS ? process.env.GIVEAWAY_CHANNELS.split(",") : [];
const MUTE_ROLE_ID = process.env.MUTE_ROLE_ID;

// =====================
// Express Keep-Alive
// =====================
const app = express();
app.get("/", (req, res) => res.send("Bot is alive!"));
app.listen(process.env.PORT || 3000, () => console.log("✅ Express server running"));

// =====================
// Helper: Safe Embed Send
// =====================
function safeSend(channelId, embed) {
  const ch = client.channels.cache.get(channelId);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

// =====================
// Slash + Prefix Commands
// =====================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const { commandName } = interaction;

  // -----------------
  // /ban
  // -----------------
  if (commandName === "ban") {
    const target = interaction.options.getUser("target");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: "You cannot ban members.", ephemeral: true });
    await member.ban({ reason });
    interaction.reply({ content: `✅ ${target.tag} banned.`, ephemeral: true });
    safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Red").setTitle("Ban").setDescription(`${target.tag} was banned by ${interaction.user.tag} | Reason: ${reason}`).setTimestamp());
  }

  // -----------------
  // /kick
  // -----------------
  if (commandName === "kick") {
    const target = interaction.options.getUser("target");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: "You cannot kick members.", ephemeral: true });
    await member.kick(reason);
    interaction.reply({ content: `✅ ${target.tag} kicked.`, ephemeral: true });
    safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Orange").setTitle("Kick").setDescription(`${target.tag} was kicked by ${interaction.user.tag} | Reason: ${reason}`).setTimestamp());
  }

  // -----------------
  // /mute
  // -----------------
  if (commandName === "mute") {
    const target = interaction.options.getUser("target");
    const duration = interaction.options.getInteger("duration");
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });
    let muteRole = interaction.guild.roles.cache.get(MUTE_ROLE_ID);
    if (!muteRole) muteRole = await interaction.guild.roles.create({ name: "Muted", permissions: [] });
    await member.roles.add(muteRole);
    interaction.reply({ content: `✅ ${target.tag} muted for ${duration} minutes.`, ephemeral: true });
    safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Gray").setTitle("Mute").setDescription(`${target.tag} muted by ${interaction.user.tag} for ${duration} minutes`).setTimestamp());
    setTimeout(async () => {
      await member.roles.remove(muteRole);
      safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Green").setTitle("Unmute").setDescription(`${target.tag} has been unmuted`).setTimestamp());
    }, duration * 60 * 1000);
  }

  // -----------------
  // /unmute
  // -----------------
  if (commandName === "unmute") {
    const target = interaction.options.getUser("target");
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });
    const muteRole = interaction.guild.roles.cache.get(MUTE_ROLE_ID);
    if (muteRole) await member.roles.remove(muteRole);
    interaction.reply({ content: `✅ ${target.tag} unmuted.`, ephemeral: true });
    safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Green").setTitle("Unmute").setDescription(`${target.tag} unmuted by ${interaction.user.tag}`).setTimestamp());
  }

  // -----------------
  // /leaderboard
  // -----------------
  if (commandName === "leaderboard") {
    const guildId = interaction.guild.id;
    if (!messages[guildId]) return interaction.reply({ content: "No messages tracked yet.", ephemeral: true });
    const sorted = Object.entries(messages[guildId]).sort(([, a], [, b]) => b.total - a.total).slice(0, 10);
    let desc = "";
    for (let i = 0; i < sorted.length; i++) {
      const user = await client.users.fetch(sorted[i][0]);
      desc += `**${i + 1}. ${user.tag}** - Total: ${sorted[i][1].total} | Daily: ${sorted[i][1].daily}\n`;
    }
    const embed = new EmbedBuilder().setTitle("📊 Message Leaderboard").setDescription(desc).setColor("Random");
    interaction.reply({ embeds: [embed] });
  }

  // -----------------
  // /gstart
  // -----------------
  if (commandName === "gstart") {
    const duration = interaction.options.getInteger("duration");
    const prize = interaction.options.getString("prize");
    const roleRequired = interaction.options.getRole("role_required");
    const extraEntries = interaction.options.getInteger("extra_entries") || 0;
    const host = interaction.user;

    const endTime = Date.now() + duration * 60 * 1000;
    const embed = new EmbedBuilder().setColor("Blue").setTitle("🎉 Giveaway Started!").setDescription(`**Prize:** ${prize}\n🕒 Ends: <t:${Math.floor(endTime/1000)}:R>\n👤 Hosted by: ${host}\n${roleRequired ? `🎭 Role Required: ${roleRequired}` : ""}\n⭐ Extra Entries: ${extraEntries}`).setTimestamp();
    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    msg.react("🎉");

    setTimeout(async () => {
      const reacted = await msg.reactions.cache.get("🎉")?.users.fetch();
      const participants = reacted?.filter(u => !u.bot)
        .filter(u => !roleRequired || interaction.guild.members.cache.get(u.id)?.roles.cache.has(roleRequired.id))
        .map(u => ({id: u.id, entries: 1 + (u.id === host.id ? extraEntries : 0)}));
      if (!participants?.length) return msg.reply("❌ No valid participants, giveaway canceled.");
      const weighted = [];
      for (const p of participants) for (let i=0;i<p.entries;i++) weighted.push(p.id);
      const winnerId = weighted[Math.floor(Math.random()*weighted.length)];
      const winner = await interaction.guild.members.fetch(winnerId);
      const endEmbed = new EmbedBuilder().setColor("Green").setTitle("🎉 Giveaway Ended!").setDescription(`**Prize:** ${prize}\n🏆 Winner: ${winner}\n🎭 Hosted by: ${host}`).setTimestamp();
      msg.edit({ embeds: [endEmbed] });
    }, duration * 60 * 1000);
  }

  // -----------------
  // /roleadd
  // -----------------
  if (commandName === "roleadd") {
    const target = interaction.options.getUser("target");
    const role = interaction.options.getRole("role");
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });
    await member.roles.add(role);
    interaction.reply({ content: `✅ ${role.name} added to ${target.tag}`, ephemeral: true });
  }

  // -----------------
  // /roleremove
  // -----------------
  if (commandName === "roleremove") {
    const target = interaction.options.getUser("target");
    const role = interaction.options.getRole("role");
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: "User not found.", ephemeral: true });
    await member.roles.remove(role);
    interaction.reply({ content: `✅ ${role.name} removed from ${target.tag}`, ephemeral: true });
  }

  // -----------------
  // /rolecreate
  // -----------------
  if (commandName === "rolecreate") {
    const name = interaction.options.getString("name");
    const newRole = await interaction.guild.roles.create({ name });
    interaction.reply({ content: `✅ Role ${newRole.name} created.`, ephemeral: true });
  }
});

// =====================
// Prefix Commands
// =====================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const guildId = message.guild.id;
  const userId = message.author.id;
  if (!messages[guildId]) messages[guildId] = {};
  if (!messages[guildId][userId]) messages[guildId][userId] = { daily:0, total:0 };
  messages[guildId][userId].daily +=1;
  messages[guildId][userId].total +=1;

  if(!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if(cmd === "ban") {
    const member = message.mentions.members.first();
    if(!member) return message.reply("❌ Mention a user to ban.");
    await member.ban({ reason: "Banned by prefix command" });
    message.reply(`✅ ${member.user.tag} banned.`);
    safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Red").setTitle("Ban").setDescription(`${member.user.tag} banned by ${message.author.tag}`).setTimestamp());
  }

  if(cmd === "kick") {
    const member = message.mentions.members.first();
    if(!member) return message.reply("❌ Mention a user to kick.");
    await member.kick({ reason: "Kicked by prefix command" });
    message.reply(`✅ ${member.user.tag} kicked.`);
    safeSend(BANLOG_CHANNEL, new EmbedBuilder().setColor("Orange").setTitle("Kick").setDescription(`${member.user.tag} kicked by ${message.author.tag}`).setTimestamp());
  }
});

// =====================
// Message Delete/Edit Logs
// =====================
client.on("messageDelete", async (msg)=>{
  if(msg.author.bot) return;
  const embed = new EmbedBuilder().setColor("Red").setTitle("🗑️ Message Deleted")
    .addFields(
      { name:"User", value:`${msg.author.tag}`, inline:true },
      { name:"Channel", value:`${msg.channel}`, inline:true },
      { name:"Content", value: msg.content?.slice(0,1024) || "*No content*" }
    ).setTimestamp();
  safeSend(LOG_CHANNEL, embed);
});

client.on("messageUpdate", async (oldMsg,newMsg)=>{
  if(newMsg.author.bot || oldMsg.content===newMsg.content) return;
  const embed = new EmbedBuilder().setColor("Yellow").setTitle("✏️ Message Edited")
    .addFields(
      { name:"User", value:`${newMsg.author.tag}`, inline:true },
      { name:"Channel", value:`${newMsg.channel}`, inline:true },
      { name:"Before", value: oldMsg.content?.slice(0,1024) || "*Empty*" },
      { name:"After", value: newMsg.content?.slice(0,1024) || "*Empty*" }
    ).setTimestamp();
  safeSend(LOG_CHANNEL, embed);
});

// =====================
// Daily Reset
// =====================
setInterval(()=>{
  for(const guildId in messages) for(const userId in messages[guildId]) messages[guildId][userId].daily=0;
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if(guild) safeSend(LOG_CHANNEL, new EmbedBuilder().setColor("Blue").setTitle("🔄 Daily message counts reset").setTimestamp());
},24*60*60*1000);

// =====================
// Ready
// =====================
client.once("ready", ()=>console.log(`✅ Logged in as ${client.user.tag}`));
client.login(TOKEN);
