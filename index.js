// index.js — FIXED VERSION (Part 1/3)
const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  PermissionsBitField,
  Collection,
  SlashCommandBuilder
} = require('discord.js');
const express = require('express');
require('dotenv').config();

// ---- CONFIGURATION (from .env file) ----------
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;
const GIVEAWAY_CHANNELS = process.env.GIVEAWAY_CHANNELS ? process.env.GIVEAWAY_CHANNELS.split(',') : [];
const BANLOG_CHANNEL = process.env.BANLOG_CHANNEL;
const MESSAGELOG_CHANNEL = process.env.MESSAGELOG_CHANNEL;
const MUTE_ROLE_ID = process.env.MUTE_ROLE_ID;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

client.commands = new Collection();
const giveaways = new Map();
const messages = {};

// --- Keepalive for Render ---
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`✅ Express active on port ${PORT}`));

// ---------- SLASH COMMANDS -----------
client.commands.set('giveaway', {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start a giveaway')
    .addStringOption(option =>
      option.setName('prize')
        .setDescription('Prize for the giveaway')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)),
  execute: async (interaction) => {
    await interaction.deferReply({ ephemeral: true }); // Prevent "did not respond"
    const channelId = interaction.channel.id;
    if (!GIVEAWAY_CHANNELS.includes(channelId)) {
      return interaction.editReply({ content: '❌ Giveaways cannot be started here!' });
    }
    const prize = interaction.options.getString('prize');
    const duration = interaction.options.getInteger('duration');

    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway!')
      .setDescription(`Prize: **${prize}**\nReact to enter!`)
      .setFooter({ text: `Ends in ${duration} minutes` })
      .setColor('Random');

    const msg = await interaction.channel.send({ embeds: [embed] });
    await msg.react('🎁');

    giveaways.set(msg.id, {
      channelId: msg.channel.id,
      entries: [],
      ended: false,
      prize,
      endTime: Date.now() + duration * 60 * 1000
    });

    await interaction.editReply({ content: `✅ Giveaway started for **${prize}**!` });

    setTimeout(() => {
      const giveaway = giveaways.get(msg.id);
      if (!giveaway || giveaway.ended) return;
      giveaway.ended = true;
      if (giveaway.entries.length === 0) {
        msg.channel.send('No entries, giveaway cancelled 😢');
        return;
      }
      const winnerId = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];
      const winner = msg.guild.members.cache.get(winnerId);
      msg.channel.send(`🎉 Congrats ${winner ? winner : `<@${winnerId}>`}! You won **${giveaway.prize}**!`);
      const logChannel = msg.guild.channels.cache.get(BANLOG_CHANNEL);
      if (logChannel) logChannel.send(`🎉 Giveaway won by ${winner ? winner.user.tag : winnerId} | Prize: ${giveaway.prize}`);
    }, duration * 60 * 1000);
  }
});
// ---------- MODERATION COMMANDS ----------

client.commands.set('ban', {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to ban')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')),
  execute: async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(target.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.editReply({ content: '❌ You don’t have permission to ban members.' });
    if (!member)
      return interaction.editReply({ content: '❌ User not found in this server.' });

    await member.ban({ reason });
    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);
    if (logChannel)
      logChannel.send(`✅ ${target.tag} was banned by ${interaction.user.tag} | Reason: ${reason}`);

    await interaction.editReply({ content: `✅ ${target.tag} has been banned.` });
  }
});

client.commands.set('kick', {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a user')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to kick')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('reason')
        .setDescription('Reason')),
  execute: async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(target.id);

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.editReply({ content: '❌ You don’t have permission to kick members.' });
    if (!member)
      return interaction.editReply({ content: '❌ User not found in this server.' });

    await member.kick(reason);
    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);
    if (logChannel)
      logChannel.send(`✅ ${target.tag} was kicked by ${interaction.user.tag} | Reason: ${reason}`);

    await interaction.editReply({ content: `✅ ${target.tag} has been kicked.` });
  }
});

client.commands.set('mute', {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to mute')
        .setRequired(true))
    .addIntegerOption(option =>
      option.setName('duration')
        .setDescription('Duration in minutes')
        .setRequired(true)),
  execute: async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('target');
    const duration = interaction.options.getInteger('duration');
    const member = interaction.guild.members.cache.get(target.id);
    if (!member) return interaction.editReply({ content: '❌ User not found.' });

    let muteRole = interaction.guild.roles.cache.get(MUTE_ROLE_ID);
    if (!muteRole)
      muteRole = await interaction.guild.roles.create({ name: 'Muted', permissions: [] });

    await member.roles.add(muteRole);
    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);
    if (logChannel)
      logChannel.send(`🔇 ${target.tag} was muted by ${interaction.user.tag} for ${duration} minutes`);

    await interaction.editReply({ content: `✅ ${target.tag} has been muted for ${duration} minutes.` });

    setTimeout(async () => {
      if (member.roles.cache.has(muteRole.id)) {
        await member.roles.remove(muteRole);
        if (logChannel) logChannel.send(`🔊 ${target.tag} has been unmuted after ${duration} minutes.`);
      }
    }, duration * 60 * 1000);
  }
});
// ---------- LEADERBOARD COMMAND ----------
client.commands.set('leaderboard', {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show top message senders'),
  execute: async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guild.id;

    if (!messages[guildId] || Object.keys(messages[guildId]).length === 0)
      return interaction.editReply({ content: 'No messages tracked yet.' });

    const sorted = Object.entries(messages[guildId])
      .sort(([, a], [, b]) => b.total - a.total)
      .slice(0, 10);

    let desc = '';
    for (let i = 0; i < sorted.length; i++) {
      const user = await client.users.fetch(sorted[i][0]);
      desc += `**${i + 1}. ${user.tag}** — Total: ${sorted[i][1].total} | Daily: ${sorted[i][1].daily}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle('📊 Message Leaderboard')
      .setDescription(desc)
      .setColor('Random');

    await interaction.editReply({ embeds: [embed] });
  }
});

// ---------- SLASH COMMAND HANDLER ----------
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.deferred || interaction.replied)
      await interaction.followUp({ content: '⚠️ There was an error executing this command.', ephemeral: true });
    else
      await interaction.reply({ content: '⚠️ There was an error executing this command.', ephemeral: true });
  }
});

// ---------- GIVEAWAY REACTION TRACKING ----------
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  const giveaway = giveaways.get(reaction.message.id);
  if (!giveaway || giveaway.ended) return;

  if (!giveaway.entries.includes(user.id)) giveaway.entries.push(user.id);
});

client.on('messageReactionRemove', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  const giveaway = giveaways.get(reaction.message.id);
  if (!giveaway || giveaway.ended) return;

  giveaway.entries = giveaway.entries.filter(id => id !== user.id);
});

// ---------- MESSAGE LOGGING + TRACKING ----------
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const guildId = message.guild.id;
  const userId = message.author.id;

  if (!messages[guildId]) messages[guildId] = {};
  if (!messages[guildId][userId]) messages[guildId][userId] = { daily: 0, total: 0 };

  messages[guildId][userId].daily++;
  messages[guildId][userId].total++;

  const logChannel = message.guild.channels.cache.get(MESSAGELOG_CHANNEL);
  if (logChannel) logChannel.send(`📝 ${message.author.tag} sent a message in ${message.channel}`);
});

// ---------- DAILY RESET ----------
setInterval(() => {
  for (const guildId in messages) {
    for (const userId in messages[guildId]) {
      messages[guildId][userId].daily = 0;
    }
  }
  console.log('🔄 Daily message counts reset');
  const guild = client.guilds.cache.get(GUILD_ID);
  if (guild) {
    const msgLogChannel = guild.channels.cache.get(MESSAGELOG_CHANNEL);
    if (msgLogChannel) msgLogChannel.send('🔄 Daily message counts have been reset!');
  }
}, 24 * 60 * 60 * 1000);

// ---------- READY + LOGIN ----------
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(TOKEN)
client.commands.set('unmute', {
  data: new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Unmute a user')
    .addUserOption(option =>
      option.setName('target')
        .setDescription('User to unmute')
        .setRequired(true)),
  execute: async (interaction) => {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('target');
    const member = interaction.guild.members.cache.get(target.id);
    if (!member)
      return interaction.editReply({ content: '❌ User not found.' });

    const muteRole = interaction.guild.roles.cache.get(MUTE_ROLE_ID);
    if (muteRole && member.roles.cache.has(muteRole.id))
      await member.roles.remove(muteRole);

    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);
    if (logChannel)
      logChannel.send(`🔊 ${target.tag} was unmuted by ${interaction.user.tag}`);

    await interaction.editReply({ content: `✅ ${target.tag} has been unmuted.` });
  }
});
