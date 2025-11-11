// -------------------- Part 1: Setup & Configuration --------------------
const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  EmbedBuilder, 
  PermissionsBitField, 
  REST, 
  Routes, 
  SlashCommandBuilder 
} = require('discord.js');
require('dotenv').config();

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const PORT = process.env.PORT || 3000;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ Missing environment variables. Check TOKEN, CLIENT_ID, and GUILD_ID!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.prefix = '?';
client.commands = new Collection();
const giveaways = new Map();
const messages = {};

// ----------- Keepalive (for Render or Replit) -----------
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`✅ Express active on port ${PORT}`));

// ----------- Inline Slash Command Registration -----------
const commandsArray = [];
client.registerSlashCommands = async () => {
  const commandsJSON = commandsArray.map(cmd => cmd.data.toJSON());
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('🚀 Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commandsJSON }
    );
    console.log('✅ Slash commands registered successfully!');
  } catch (err) {
    console.error('❌ Error registering slash commands:', err);
  }
};

// ----------- Event: Bot Ready -----------
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await client.registerSlashCommands();
});

module.exports = { client, giveaways, messages, commandsArray };
// -------------------- Part 2: Commands & Handlers --------------------
const { client, commandsArray } = require('./index.js');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// ----------- Channel IDs for Logs -----------
const MSG_LOGS_CHANNEL = '1430361387846336594';
const MOD_LOGS_CHANNEL = '1431142672399204432';

// -------------------- Command Helpers --------------------
function sendModLog(embed) {
  const channel = client.channels.cache.get(MOD_LOGS_CHANNEL);
  if (channel) channel.send({ embeds: [embed] });
}

function sendMsgLog(embed) {
  const channel = client.channels.cache.get(MSG_LOGS_CHANNEL);
  if (channel) channel.send({ embeds: [embed] });
}

// -------------------- Prefix Commands --------------------
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(client.prefix)) return;

  const args = message.content.slice(client.prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // --------- ?ping ---------
  if (cmd === 'ping') {
    return message.reply(`🏓 Pong! Latency: ${Date.now() - message.createdTimestamp}ms`);
  }

  // --------- ?ban ---------
  if (cmd === 'ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply('❌ You do not have permission to ban members.');
    const user = message.mentions.members.first();
    if (!user) return message.reply('❌ Mention a user to ban.');
    const reason = args.join(' ') || 'No reason provided.';
    try {
      await user.ban({ reason });
      message.reply(`✅ Banned ${user.user.tag}`);
      const embed = new EmbedBuilder()
        .setTitle('Member Banned')
        .setDescription(`${user.user.tag} was banned by ${message.author.tag}`)
        .addFields({ name: 'Reason', value: reason })
        .setColor('Red')
        .setTimestamp();
      sendModLog(embed);
    } catch (err) {
      message.reply('❌ Failed to ban user.');
    }
  }

  // --------- ?unban ---------
  if (cmd === 'unban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return message.reply('❌ You do not have permission to unban members.');
    const userId = args[0];
    if (!userId) return message.reply('❌ Provide a user ID to unban.');
    try {
      await message.guild.members.unban(userId);
      message.reply(`✅ Unbanned <@${userId}>`);
      const embed = new EmbedBuilder()
        .setTitle('Member Unbanned')
        .setDescription(`<@${userId}> was unbanned by ${message.author.tag}`)
        .setColor('Green')
        .setTimestamp();
      sendModLog(embed);
    } catch {
      message.reply('❌ Failed to unban.');
    }
  }

  // --------- ?purge ---------
  if (cmd === 'purge') {
    const count = parseInt(args[0], 10);
    if (!count || count < 1 || count > 100)
      return message.reply('❌ Provide a number between 1 and 100.');
    const deleted = await message.channel.bulkDelete(count, true);
    const embed = new EmbedBuilder()
      .setTitle('Messages Purged')
      .setDescription(`${deleted.size} messages deleted by ${message.author.tag}`)
      .setColor('Yellow')
      .setTimestamp();
    sendMsgLog(embed);
  }

  // --------- ?nuke ---------
  if (cmd === 'nuke') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply('❌ You do not have permission to nuke this channel.');
    const cloned = await message.channel.clone();
    await message.channel.delete();
    cloned.send('💥 Channel nuked!');
  }

  // --------- ?gstart (Simple Giveaway) ---------
  if (cmd === 'gstart') {
    const duration = parseInt(args[0]);
    const prize = args.slice(1).join(' ');
    if (!duration || !prize)
      return message.reply('❌ Usage: ?gstart <duration_sec> <prize>');
    const giveaway = {
      channel: message.channel.id,
      prize,
      endTime: Date.now() + duration * 1000,
      participants: new Set(),
    };
    giveaways.set(message.id, giveaway);
    message.channel.send(`🎉 Giveaway started for **${prize}**! React to enter.`);
    setTimeout(() => {
      const arr = Array.from(giveaway.participants);
      if (!arr.length) return message.channel.send('❌ No one entered.');
      const winner = arr[Math.floor(Math.random() * arr.length)];
      message.channel.send(`🏆 Congratulations <@${winner}>! You won **${prize}**`);
      giveaways.delete(message.id);
    }, duration * 1000);
  }
});

// -------------------- Message Logs --------------------
client.on('messageDelete', async message => {
  if (!message.guild) return;
  const embed = new EmbedBuilder()
    .setTitle('Message Deleted')
    .setDescription(`Author: ${message.author.tag}`)
    .addFields({ name: 'Content', value: message.content || 'Empty' })
    .setColor('DarkRed')
    .setTimestamp();
  sendMsgLog(embed);
});

client.on('messageUpdate', async (oldMsg, newMsg) => {
  if (!oldMsg.guild) return;
  const embed = new EmbedBuilder()
    .setTitle('Message Edited')
    .setDescription(`Author: ${oldMsg.author.tag}`)
    .addFields(
      { name: 'Before', value: oldMsg.content || 'Empty' },
      { name: 'After', value: newMsg.content || 'Empty' }
    )
    .setColor('Orange')
    .setTimestamp();
  sendMsgLog(embed);
});

// -------------------- Register Slash Commands Inline --------------------
// Ping
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  execute: async (interaction) => {
    await interaction.reply(`🏓 Pong!`);
  },
});

// Ban
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member')
    .addUserOption(opt => opt.setName('target').setDescription('User to ban').setRequired(true))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')),
  execute: async (interaction) => {
    const user = interaction.options.getUser('target');
    const reason = interaction.options.getString('reason') || 'No reason provided';
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return interaction.reply('❌ Member not found.');
    try {
      await member.ban({ reason });
      interaction.reply(`✅ Banned ${user.tag}`);
      const embed = new EmbedBuilder()
        .setTitle('Member Banned')
        .setDescription(`${user.tag} was banned by ${interaction.user.tag}`)
        .addFields({ name: 'Reason', value: reason })
        .setColor('Red')
        .setTimestamp();
      sendModLog(embed);
    } catch {
      interaction.reply('❌ Failed to ban user.');
    }
  },
});
// -------------------- Part 3: Mute, Roles, Warns, Embeds --------------------
const { client, commandsArray } = require('./index.js');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --------- Role Commands ---------
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(client.prefix)) return;

  const args = message.content.slice(client.prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // -------- ?roleadd --------
  if (cmd === 'roleadd') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return message.reply('❌ You cannot manage roles.');
    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    if (!member || !roleName) return message.reply('❌ Usage: ?roleadd @member RoleName');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('❌ Role not found.');
    await member.roles.add(role);
    message.reply(`✅ Added role ${roleName} to ${member.user.tag}`);
  }

  // -------- ?roleremove --------
  if (cmd === 'roleremove') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return message.reply('❌ You cannot manage roles.');
    const member = message.mentions.members.first();
    const roleName = args.slice(1).join(' ');
    if (!member || !roleName) return message.reply('❌ Usage: ?roleremove @member RoleName');
    const role = message.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return message.reply('❌ Role not found.');
    await member.roles.remove(role);
    message.reply(`✅ Removed role ${roleName} from ${member.user.tag}`);
  }

  // -------- ?rolecreate --------
  if (cmd === 'rolecreate') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
      return message.reply('❌ You cannot manage roles.');
    const roleName = args.join(' ');
    if (!roleName) return message.reply('❌ Provide a role name.');
    const role = await message.guild.roles.create({ name: roleName });
    message.reply(`✅ Created role ${role.name}`);
  }

  // -------- ?mute --------
  if (cmd === 'mute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply('❌ You cannot mute members.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to mute.');
    await member.timeout(600000, 'Muted by command'); // 10 min default
    message.reply(`🔇 Muted ${member.user.tag} for 10 minutes`);
  }

  // -------- ?unmute --------
  if (cmd === 'unmute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply('❌ You cannot unmute members.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to unmute.');
    await member.timeout(null);
    message.reply(`🔊 Unmuted ${member.user.tag}`);
  }

  // -------- ?warn --------
  if (cmd === 'warn') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return message.reply('❌ You cannot warn members.');
    const member = message.mentions.members.first();
    const reason = args.slice(1).join(' ') || 'No reason provided';
    if (!member) return message.reply('❌ Mention a member to warn.');
    const embed = new EmbedBuilder()
      .setTitle('Member Warned')
      .setDescription(`${member.user.tag} was warned by ${message.author.tag}`)
      .addFields({ name: 'Reason', value: reason })
      .setColor('Orange')
      .setTimestamp();
    sendModLog(embed);
    message.reply(`⚠️ Warned ${member.user.tag}`);
  }

  // -------- ?embed (custom embed) --------
  if (cmd === 'embed') {
    const text = args.join(' ');
    if (!text) return message.reply('❌ Provide text for the embed.');
    const embed = new EmbedBuilder()
      .setDescription(text)
      .setColor('Blue')
      .setFooter({ text: message.author.tag })
      .setTimestamp();
    message.channel.send({ embeds: [embed] });
  }
});

// -------------------- Slash Commands Registration --------------------
// Role Add
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('roleadd')
    .setDescription('Add a role to a member')
    .addUserOption(opt => opt.setName('member').setDescription('Member').setRequired(true))
    .addStringOption(opt => opt.setName('role').setDescription('Role name').setRequired(true)),
  execute: async (interaction) => {
    const member = interaction.options.getMember('member');
    const roleName = interaction.options.getString('role');
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return interaction.reply('❌ Role not found.');
    await member.roles.add(role);
    interaction.reply(`✅ Added role ${roleName} to ${member.user.tag}`);
  },
});

// Role Remove
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('roleremove')
    .setDescription('Remove a role from a member')
    .addUserOption(opt => opt.setName('member').setDescription('Member').setRequired(true))
    .addStringOption(opt => opt.setName('role').setDescription('Role name').setRequired(true)),
  execute: async (interaction) => {
    const member = interaction.options.getMember('member');
    const roleName = interaction.options.getString('role');
    const role = interaction.guild.roles.cache.find(r => r.name === roleName);
    if (!role) return interaction.reply('❌ Role not found.');
    await member.roles.remove(role);
    interaction.reply(`✅ Removed role ${roleName} from ${member.user.tag}`);
  },
});
// -------------------- Part 4: Timeout, Nuke, Purge, Giveaway, Logs --------------------
const { client, commandsArray } = require('./index.js');
const { EmbedBuilder, PermissionsBitField } = require('discord.js');

// --------- Timeout Remove ---------
client.on('messageCreate', async message => {
  if (!message.guild || message.author.bot) return;
  if (!message.content.startsWith(client.prefix)) return;

  const args = message.content.slice(client.prefix.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  // -------- ?rto / ?removetimeout --------
  if (cmd === 'rto' || cmd === 'removetimeout') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
      return message.reply('❌ You cannot remove timeouts.');
    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Mention a member to remove timeout.');
    await member.timeout(null);
    message.reply(`✅ Timeout removed for ${member.user.tag}`);
  }

  // -------- ?nuke --------
  if (cmd === 'nuke') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels))
      return message.reply('❌ You cannot nuke channels.');
    const channel = message.channel;
    const newChannel = await channel.clone();
    await channel.delete();
    newChannel.send('💥 Channel nuked!');
  }

  // -------- ?purge (all / 3) --------
  if (cmd === 'purge') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply('❌ You cannot purge messages.');
    let count = args[0];
    if (count === 'all') count = 100; // max bulk delete
    else count = parseInt(count) || 3;
    const deleted = await message.channel.bulkDelete(count, true);
    message.channel.send(`🗑️ Deleted ${deleted.size} messages`).then(m => setTimeout(() => m.delete(), 5000));
  }

  // -------- Giveaway Start (gstart) --------
  if (cmd === 'gstart') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild))
      return message.reply('❌ You cannot start giveaways.');
    const channel = message.mentions.channels.first() || message.channel;
    const duration = parseInt(args[1]) || 60; // seconds
    const prize = args.slice(2).join(' ') || 'No prize specified';
    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Started!')
      .setDescription(`Prize: **${prize}**\nReact to enter!`)
      .setColor('Green')
      .setFooter({ text: `Hosted by ${message.author.tag}` })
      .setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    await msg.react('🎉');
    setTimeout(async () => {
      const users = (await msg.reactions.cache.get('🎉').users.fetch()).filter(u => !u.bot);
      const winner = users.random();
      channel.send(`🏆 Congratulations ${winner}! You won **${prize}**!`);
    }, duration * 1000);
  }
});

// -------------------- Slash Commands Registration --------------------

// Timeout Remove
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('removetimeout')
    .setDescription('Remove timeout from a member')
    .addUserOption(opt => opt.setName('member').setDescription('Member').setRequired(true)),
  execute: async (interaction) => {
    const member = interaction.options.getMember('member');
    await member.timeout(null);
    interaction.reply(`✅ Timeout removed for ${member.user.tag}`);
  },
});

// Nuke
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('nuke')
    .setDescription('Nuke the channel'),
  execute: async (interaction) => {
    const channel = interaction.channel;
    const newChannel = await channel.clone();
    await channel.delete();
    newChannel.send('💥 Channel nuked!');
  },
});

// Purge
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete messages')
    .addStringOption(opt => opt.setName('count').setDescription('Number of messages or all').setRequired(true)),
  execute: async (interaction) => {
    let count = interaction.options.getString('count');
    if (count === 'all') count = 100;
    else count = parseInt(count) || 3;
    const deleted = await interaction.channel.bulkDelete(count, true);
    interaction.reply({ content: `🗑️ Deleted ${deleted.size} messages`, ephemeral: true });
  },
});

// Giveaway Start
commandsArray.push({
  data: new SlashCommandBuilder()
    .setName('gstart')
    .setDescription('Start a giveaway')
    .addChannelOption(opt => opt.setName('channel').setDescription('Channel for giveaway'))
    .addIntegerOption(opt => opt.setName('duration').setDescription('Duration in seconds'))
    .addStringOption(opt => opt.setName('prize').setDescription('Prize for giveaway')),
  execute: async (interaction) => {
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const duration = interaction.options.getInteger('duration') || 60;
    const prize = interaction.options.getString('prize') || 'No prize specified';
    const embed = new EmbedBuilder()
      .setTitle('🎉 Giveaway Started!')
      .setDescription(`Prize: **${prize}**\nReact to enter!`)
      .setColor('Green')
      .setFooter({ text: `Hosted by ${interaction.user.tag}` })
      .setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    await msg.react('🎉');
    setTimeout(async () => {
      const users = (await msg.reactions.cache.get('🎉').users.fetch()).filter(u => !u.bot);
      const winner = users.random();
      channel.send(`🏆 Congratulations ${winner}! You won **${prize}**!`);
    }, duration * 1000);
    interaction.reply({ content: '✅ Giveaway started!', ephemeral: true });
  },
});
