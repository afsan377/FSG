// PART 1 - Basic Setup and Imports
require('dotenv').config();
const { Client, GatewayIntentBits, Partials, Collection, EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
client.prefix = "?";

// ----- Load Command Files -----
const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
  const command = require(`./commands/${file}`);
  client.commands.set(command.name, command);
}

// ----- When Bot Ready -----
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity("managing your server 😎", { type: 3 });
});

// ----- Command Handler -----
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(client.prefix)) return;

  const args = message.content.slice(client.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);

  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(error);
    message.reply("❌ There was an error executing this command.");
  }
});
// PART 2 - Logging System with channel IDs

const MSG_LOGS_CHANNEL_ID = "1430361387846336594"; // msg-logs
const MOD_LOGS_CHANNEL_ID = "1431142672399204432"; // ban/kick/warn/etc

// Helper function to send embed to a channel by ID
async function sendLogEmbedByID(guild, channelId, embed) {
  const logChannel = guild.channels.cache.get(channelId);
  if (logChannel) logChannel.send({ embeds: [embed] }).catch(() => {});
}

// ----- Message Delete -----
client.on('messageDelete', async (message) => {
  if (message.author?.bot) return;

  const embed = new EmbedBuilder()
    .setTitle("🗑️ Message Deleted")
    .setColor("Red")
    .addFields(
      { name: "User", value: `${message.author.tag}`, inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      { name: "Content", value: message.content || "No content" }
    )
    .setTimestamp();

  sendLogEmbedByID(message.guild, MSG_LOGS_CHANNEL_ID, embed);
});

// ----- Message Edit -----
client.on('messageUpdate', async (oldMessage, newMessage) => {
  if (oldMessage.author?.bot) return;
  if (oldMessage.content === newMessage.content) return;

  const embed = new EmbedBuilder()
    .setTitle("✏️ Message Edited")
    .setColor("Orange")
    .addFields(
      { name: "User", value: `${oldMessage.author.tag}`, inline: true },
      { name: "Channel", value: `${oldMessage.channel}`, inline: true },
      { name: "Before", value: oldMessage.content || "No content" },
      { name: "After", value: newMessage.content || "No content" }
    )
    .setTimestamp();

  sendLogEmbedByID(oldMessage.guild, MSG_LOGS_CHANNEL_ID, embed);
});

// ----- Member Ban -----
client.on('guildBanAdd', async (ban) => {
  const embed = new EmbedBuilder()
    .setTitle("🔨 User Banned")
    .setColor("DarkRed")
    .addFields(
      { name: "User", value: `${ban.user.tag}` },
      { name: "Reason", value: `${ban.reason || "No reason provided"}` }
    )
    .setTimestamp();

  sendLogEmbedByID(ban.guild, MOD_LOGS_CHANNEL_ID, embed);
});

// ----- Member Unban -----
client.on('guildBanRemove', async (ban) => {
  const embed = new EmbedBuilder()
    .setTitle("♻️ User Unbanned")
    .setColor("Green")
    .addFields({ name: "User", value: `${ban.user.tag}` })
    .setTimestamp();

  sendLogEmbedByID(ban.guild, MOD_LOGS_CHANNEL_ID, embed);
});

// ----- Kick Logs -----
client.on('userKicked', async (user, moderator, reason, guild) => {
  const embed = new EmbedBuilder()
    .setTitle("👢 User Kicked")
    .setColor("OrangeRed")
    .addFields(
      { name: "User", value: `${user.tag}` },
      { name: "Moderator", value: `${moderator.tag}` },
      { name: "Reason", value: `${reason}` }
    )
    .setTimestamp();

  sendLogEmbedByID(guild, MOD_LOGS_CHANNEL_ID, embed);
});

// ----- Warn Logs -----
client.on('userWarned', async (user, moderator, reason, guild) => {
  const embed = new EmbedBuilder()
    .setTitle("⚠️ User Warned")
    .setColor("Yellow")
    .addFields(
      { name: "User", value: `${user.tag}` },
      { name: "Moderator", value: `${moderator.tag}` },
      { name: "Reason", value: `${reason}` }
    )
    .setTimestamp();

  sendLogEmbedByID(guild, MOD_LOGS_CHANNEL_ID, embed);
});
// PART 3 - Commands + Prefix + Giveaway + Role/Moderation
const PREFIX = "?"; // Change prefix if you want

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // ---- Ping ----
  if (cmd === "ping") {
    return message.channel.send(`🏓 Pong! Latency: ${Date.now() - message.createdTimestamp}ms`);
  }

  // ---- Ban ----
  if (cmd === "ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ You cannot ban members.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mention a user to ban.");

    const reason = args.join(" ") || "No reason provided";
    await target.ban({ reason }).catch(() => message.reply("❌ Cannot ban this member."));

    message.reply(`✅ ${target.user.tag} was banned.`);

    // Log
    const embed = new EmbedBuilder()
      .setTitle("🔨 User Banned")
      .setColor("DarkRed")
      .addFields(
        { name: "User", value: `${target.user.tag}` },
        { name: "Moderator", value: `${message.author.tag}` },
        { name: "Reason", value: reason }
      )
      .setTimestamp();
    sendLogEmbedByID(message.guild, MOD_LOGS_CHANNEL_ID, embed);
  }

  // ---- Unban ----
  if (cmd === "unban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply("❌ You cannot unban members.");

    const id = args[0];
    if (!id) return message.reply("❌ Provide user ID to unban.");

    await message.guild.bans.remove(id).catch(() => message.reply("❌ Cannot unban this user."));

    message.reply(`✅ User <@${id}> has been unbanned.`);

    // Log
    const embed = new EmbedBuilder()
      .setTitle("♻️ User Unbanned")
      .setColor("Green")
      .addFields({ name: "User ID", value: id }, { name: "Moderator", value: message.author.tag })
      .setTimestamp();
    sendLogEmbedByID(message.guild, MOD_LOGS_CHANNEL_ID, embed);
  }

  // ---- Kick ----
  if (cmd === "kick") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return message.reply("❌ You cannot kick members.");

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Mention a user to kick.");
    const reason = args.join(" ") || "No reason provided";

    await target.kick(reason).catch(() => message.reply("❌ Cannot kick this member."));
    message.reply(`✅ ${target.user.tag} was kicked.`);

    // Log
    const embed = new EmbedBuilder()
      .setTitle("👢 User Kicked")
      .setColor("OrangeRed")
      .addFields(
        { name: "User", value: target.user.tag },
        { name: "Moderator", value: message.author.tag },
        { name: "Reason", value: reason }
      )
      .setTimestamp();
    sendLogEmbedByID(message.guild, MOD_LOGS_CHANNEL_ID, embed);
  }

  // ---- Mute / Timeout ----
  if (cmd === "mute") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply("❌ You cannot mute members.");

    const target = message.mentions.members.first();
    const duration = parseInt(args[1]);
    if (!target || !duration) return message.reply("❌ Usage: ?mute @user <minutes>");

    let muteRole = message.guild.roles.cache.find(r => r.name === "Muted");
    if (!muteRole) muteRole = await message.guild.roles.create({ name: "Muted", permissions: [] });

    await target.roles.add(muteRole);
    message.reply(`🔇 ${target.user.tag} muted for ${duration} minutes.`);

    // Log
    const embed = new EmbedBuilder()
      .setTitle("🔇 User Muted")
      .setColor("Orange")
      .addFields(
        { name: "User", value: target.user.tag },
        { name: "Moderator", value: message.author.tag },
        { name: "Duration", value: `${duration} minutes` }
      )
      .setTimestamp();
    sendLogEmbedByID(message.guild, MOD_LOGS_CHANNEL_ID, embed);

    setTimeout(async () => {
      await target.roles.remove(muteRole).catch(() => {});
      const unmuteEmbed = new EmbedBuilder()
        .setTitle("🔊 User Unmuted")
        .setColor("Green")
        .addFields({ name: "User", value: target.user.tag })
        .setTimestamp();
      sendLogEmbedByID(message.guild, MOD_LOGS_CHANNEL_ID, unmuteEmbed);
    }, duration * 60 * 1000);
  }

  // ---- Giveaway gstart ----
  if (cmd === "gstart") {
    const prize = args.join(" ");
    if (!prize) return message.reply("❌ Specify a prize!");

    const embed = new EmbedBuilder()
      .setTitle("🎉 Giveaway!")
      .setDescription(`Prize: **${prize}**\nReact with 🎁 to enter!`)
      .setColor("Random");
    const msg = await message.channel.send({ embeds: [embed] });
    await msg.react("🎁");

    giveaways.set(msg.id, { entries: [], ended: false, prize, channelId: message.channel.id });

    message.reply(`✅ Giveaway started for **${prize}**!`);

    // Auto pick winner after 1 hour
    setTimeout(() => {
      const g = giveaways.get(msg.id);
      if (!g || g.ended) return;
      g.ended = true;
      if (!g.entries.length) return msg.channel.send("No entries 😢");
      const winnerId = g.entries[Math.floor(Math.random() * g.entries.length)];
      const winner = message.guild.members.cache.get(winnerId);
      msg.channel.send(`🎉 Congratulations ${winner || `<@${winnerId}>`}! You won **${g.prize}**!`);
    }, 60 * 60 * 1000);
  }
});
