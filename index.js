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
// ==========================
// FSG WATCHER - Part 2
// ==========================

// ---------------- REGISTER SLASH COMMANDS ----------------
const {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder
} = require("discord.js");

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),

    new SlashCommandBuilder()
      .setName("gstart")
      .setDescription("Start a giveaway")
      .addStringOption(o => o.setName("duration").setDescription("Duration (e.g. 1h)").setRequired(true))
      .addIntegerOption(o => o.setName("winners").setDescription("Number of winners").setRequired(true))
      .addStringOption(o => o.setName("prize").setDescription("Prize").setRequired(true))
      .addRoleOption(o => o.setName("role_required").setDescription("Role required to join"))
      .addRoleOption(o => o.setName("extra_entries").setDescription("Role with extra entries")),

    new SlashCommandBuilder()
      .setName("ban")
      .setDescription("Ban a user")
      .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason")),

    new SlashCommandBuilder()
      .setName("kick")
      .setDescription("Kick a user")
      .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason")),

    new SlashCommandBuilder()
      .setName("mute")
      .setDescription("Mute a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("duration").setDescription("Duration (e.g. 10m)"))
      .addStringOption(o => o.setName("reason").setDescription("Reason")),

    new SlashCommandBuilder()
      .setName("unmute")
      .setDescription("Unmute a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
      .setName("warn")
      .setDescription("Warn a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

    new SlashCommandBuilder()
      .setName("lock")
      .setDescription("Lock a channel"),

    new SlashCommandBuilder()
      .setName("unlock")
      .setDescription("Unlock a channel"),

    new SlashCommandBuilder()
      .setName("msgcount")
      .setDescription("Show message count for a user")
      .addUserOption(o => o.setName("user").setDescription("User")),

    new SlashCommandBuilder()
      .setName("leaderboard")
      .setDescription("Show top message senders"),

    new SlashCommandBuilder()
      .setName("addrole")
      .setDescription("Add role to a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

    new SlashCommandBuilder()
      .setName("removerole")
      .setDescription("Remove role from a user")
      .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
      .addRoleOption(o => o.setName("role").setDescription("Role").setRequired(true)),

    new SlashCommandBuilder()
      .setName("createrole")
      .setDescription("Create a new role")
      .addStringOption(o => o.setName("name").setDescription("Role name").setRequired(true))
      .addStringOption(o => o.setName("color").setDescription("Hex color (e.g. #ff0000)"))
  ].map(c => c.toJSON());

  const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (process.env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });
    } else {
      await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    }
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
}

// ---------------- COMMAND HANDLER ----------------
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, guild, channel, user } = interaction;

  function isAdmin(m) { return m.permissions.has(PermissionsBitField.Flags.Administrator); }

  try {
    if (commandName === "ping") return interaction.reply({ content: "🏓 Pong!", ephemeral: true });

    // lock / unlock
    if (commandName === "lock" || commandName === "unlock") {
      if (!isAdmin(member)) return interaction.reply({ content: "❌ Not authorized", ephemeral: true });
      await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: commandName === "lock" ? false : true });
      return interaction.reply({ content: commandName === "lock" ? "🔒 Channel locked" : "🔓 Channel unlocked", ephemeral: true });
    }

    // ban / kick
    if (commandName === "ban" || commandName === "kick") {
      if (!isAdmin(member)) return interaction.reply({ content: "❌ Not authorized", ephemeral: true });
      const target = options.getUser("user");
      const reason = options.getString("reason") || "No reason provided";
      const targetMember = guild.members.cache.get(target.id);
      if (!targetMember) return interaction.reply({ content: "❌ User not found", ephemeral: true });
      if (commandName === "ban") await targetMember.ban({ reason });
      else await targetMember.kick(reason);
      return interaction.reply({ content: `✅ ${target.tag} ${commandName}ed`, ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    try { await interaction.reply({ content: "❌ Error executing command.", ephemeral: true }); } catch {}
  }
});
// ---------------- GIVEAWAY SYSTEM ----------------
const activeGiveaways = new Map();

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'gstart') {
    const duration = interaction.options.getString('duration');
    const prize = interaction.options.getString('prize');
    const winnerCount = interaction.options.getInteger('winners');
    const requiredRole = interaction.options.getRole('requiredrole');
    const bonusRole = interaction.options.getRole('bonusrole');
    const bonusEntries = interaction.options.getInteger('bonusentries') || 0;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return interaction.reply({ content: '❌ You do not have permission to start giveaways.', ephemeral: true });

    const endTime = Date.now() + ms(duration);
    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Started!')
      .setDescription(
        `**Prize:** ${prize}\n**Winners:** ${winnerCount}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n` +
        `${requiredRole ? `**Required Role:** ${requiredRole}` : ''}`
      )
      .setColor('Gold')
      .setFooter({ text: 'React with 🎉 to enter!' });

    const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
    await msg.react('🎉');

    activeGiveaways.set(msg.id, {
      prize,
      winnerCount,
      endTime,
      requiredRole: requiredRole?.id || null,
      bonusRole: bonusRole?.id || null,
      bonusEntries,
      host: interaction.user.id,
      channelId: msg.channel.id,
    });
  }

  if (commandName === 'greroll') {
    const messageId = interaction.options.getString('messageid');
    const giveaway = activeGiveaways.get(messageId);
    if (!giveaway) return interaction.reply('❌ Giveaway not found.');
    await pickWinners(interaction, giveaway, true);
  }
});

async function pickWinners(interaction, giveaway, reroll = false) {
  const channel = await client.channels.fetch(giveaway.channelId);
  const msg = await channel.messages.fetch(interaction.options.getString('messageid'));
  const reactions = await msg.reactions.cache.get('🎉').users.fetch();
  const entries = [];

  reactions.forEach((u) => {
    if (u.bot) return;
    if (giveaway.requiredRole && !channel.guild.members.cache.get(u.id).roles.cache.has(giveaway.requiredRole)) return;

    let count = 1;
    if (giveaway.bonusRole && channel.guild.members.cache.get(u.id).roles.cache.has(giveaway.bonusRole))
      count += giveaway.bonusEntries;
    for (let i = 0; i < count; i++) entries.push(u.id);
  });

  if (entries.length === 0)
    return interaction.reply({ content: '❌ No valid participants found.', ephemeral: true });

  const winners = [];
  for (let i = 0; i < giveaway.winnerCount && entries.length > 0; i++) {
    const winnerId = entries.splice(Math.floor(Math.random() * entries.length), 1)[0];
    if (!winners.includes(winnerId)) winners.push(winnerId);
  }

  await interaction.reply({
    content: reroll
      ? `🔁 Giveaway rerolled! New winners: ${winners.map((id) => `<@${id}>`).join(', ')}`
      : `🎉 Congratulations ${winners.map((id) => `<@${id}>`).join(', ')}! You won **${giveaway.prize}**!`,
  });
}

// ---------------- LOGGING SYSTEM ----------------
client.on('messageDelete', async (message) => {
  if (message.partial || message.author.bot) return;
  const logChannel = message.guild.channels.cache.find(c => c.name === 'message-logs');
  if (logChannel)
    logChannel.send(`🗑️ Message deleted in ${message.channel} by ${message.author}: ${message.content}`);
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (oldMsg.partial || oldMsg.author.bot) return;
  const logChannel = oldMsg.guild.channels.cache.find(c => c.name === 'message-logs');
  if (logChannel)
    logChannel.send(`✏️ Message edited in ${oldMsg.channel} by ${oldMsg.author}\nOld: ${oldMsg.content}\nNew: ${newMsg.content}`);
});

client.on('guildMemberAdd', async (member) => {
  const logChannel = member.guild.channels.cache.find(c => c.name === 'member-logs');
  if (logChannel) logChannel.send(`✅ **${member.user.tag}** joined the server!`);
});

client.on('guildMemberRemove', async (member) => {
  const logChannel = member.guild.channels.cache.find(c => c.name === 'member-logs');
  if (logChannel) logChannel.send(`❌ **${member.user.tag}** left the server.`);
});

// ---------------- KEEP ALIVE ----------------
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(3000, () => console.log('🌐 Express server running for uptime'));

// ---------------- LOGIN ----------------
client.login(process.env.TOKEN);
