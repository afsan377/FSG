// ---------- PART 1: BOT SETUP & IN-MEMORY STORAGE ----------
const { Client, GatewayIntentBits, Partials, EmbedBuilder, PermissionsBitField, Collection } = require('discord.js');
require('dotenv').config();

// ---------- CLIENT ----------
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

// ---------- IN-MEMORY STORAGE ----------
// Stores giveaways, message counts, moderation logs
const giveaways = {};      // { messageId: { channelId, entries: [], ended: false, prize, endTime } }
const messages = {};       // { guildId: { userId: { daily: 0, total: 0 } } }
const moderationLogs = []; // Array of { type, user, moderator, reason, time }

// ---------- CONFIG FROM ENV ----------
const GUILD_ID = process.env.GUILD_ID;
const OWNER_ROLE_ID = process.env.OWNER_ROLE_ID;
const ADMIN_ROLE_ID = process.env.ADMIN_ROLE_ID;
const MOD_ROLE_ID = process.env.MOD_ROLE_ID;
const STAFF_ROLE_ID = process.env.STAFF_ROLE_ID;
const MUTE_ROLE_ID = process.env.MUTE_ROLE_ID;

const BANLOG_CHANNEL = process.env.BANLOG_CHANNEL;
const MESSAGELOG_CHANNEL = process.env.MESSAGELOG_CHANNEL;
const GIVEAWAY_CHANNELS = process.env.GIVEAWAY_CHANNELS.split(',');

// ---------- BOT READY ----------
client.once('ready', () => {
console.log("✅ Logged in as ${client.user.tag}");
});

// ---------- MESSAGE TRACKING ----------
client.on('messageCreate', message => {
if (message.author.bot) return;

const guildId = message.guild.id;  
const userId = message.author.id;  

if (!messages[guildId]) messages[guildId] = {};  
if (!messages[guildId][userId]) messages[guildId][userId] = { daily: 0, total: 0 };  

messages[guildId][userId].daily++;  
messages[guildId][userId].total++;  

// Log message to MESSAGELOG_CHANNEL  
const msgLogChannel = message.guild.channels.cache.get(MESSAGELOG_CHANNEL);  
if (msgLogChannel) msgLogChannel.send(`📩 ${message.author.tag} sent a message in #${message.channel.name}: "${message.content}"`);  

});

// ---------- LOGIN ----------
client.login(process.env.TOKEN);
// ---------- PART 2: GIVEAWAY COMMANDS ----------
const { SlashCommandBuilder } = require('discord.js');

client.commands = new Collection();

// ---------- START GIVEAWAY ----------
client.commands.set('giveaway', {
data: new SlashCommandBuilder()
.setName('giveaway')
.setDescription('Start a giveaway')
.addStringOption(option => option.setName('prize').setDescription('Prize for the giveaway').setRequired(true))
.addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true)),
execute: async (interaction) => {
const channelId = interaction.channel.id;
if (!GIVEAWAY_CHANNELS.includes(channelId)) return interaction.reply({ content: '❌ Giveaways cannot be started here!', ephemeral: true });

    const prize = interaction.options.getString('prize');  
    const duration = interaction.options.getInteger('duration');  

    const embed = new EmbedBuilder()  
        .setTitle('🎉 Giveaway!')  
        .setDescription(`Prize: **${prize}**\nReact to enter!`)  
        .setFooter({ text: `Ends in ${duration} minutes` })  
        .setColor('Random');  

    const msg = await interaction.channel.send({ embeds: [embed] });  
    await msg.react('🎁');  

    giveaways[msg.id] = {  
        channelId: msg.channel.id,  
        entries: [],  
        ended: false,  
        prize,  
        endTime: Date.now() + duration * 60 * 1000  
    };  

    interaction.reply({ content: `✅ Giveaway started for **${prize}**!`, ephemeral: true });  

    // Automatically end giveaway after duration  
    setTimeout(() => {  
        const giveaway = giveaways[msg.id];  
        if (!giveaway || giveaway.ended) return;  
        giveaway.ended = true;  

        if (giveaway.entries.length === 0) {  
            msg.channel.send('No entries, giveaway cancelled 😢');  
            return;  
        }  

        const winnerId = giveaway.entries[Math.floor(Math.random() * giveaway.entries.length)];  
        const winner = interaction.guild.members.cache.get(winnerId);  

        msg.channel.send(`🎉 Congratulations ${winner ? winner : `<@${winnerId}>`}! You won **${giveaway.prize}**!`);  

        // Log winner  
        const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);  
        if (logChannel) logChannel.send(`🎉 Giveaway won by ${winner ? winner.user.tag : winnerId} | Prize: ${giveaway.prize}`);  
    }, duration * 60 * 1000);  
}  

});
// ---------- PART 3: GIVEAWAY REACTIONS ----------
client.on('messageReactionAdd', async (reaction, user) => {
if (user.bot) return;

if (reaction.partial) await reaction.fetch();  
if (reaction.message.partial) await reaction.message.fetch();  

const giveaway = giveaways[reaction.message.id];  
if (!giveaway || giveaway.ended) return;  

// Add user if not already in entries  
if (!giveaway.entries.includes(user.id)) {  
    giveaway.entries.push(user.id);  
}  

});

client.on('messageReactionRemove', async (reaction, user) => {
if (user.bot) return;

if (reaction.partial) await reaction.fetch();  
if (reaction.message.partial) await reaction.message.fetch();  

const giveaway = giveaways[reaction.message.id];  
if (!giveaway || giveaway.ended) return;  

// Remove user from entries  
giveaway.entries = giveaway.entries.filter(id => id !== user.id);  

});
// ---------- PART 4: MODERATION COMMANDS ----------
const { SlashCommandBuilder } = require('discord.js');

// ---------- BAN COMMAND ----------
client.commands.set('ban', {
data: new SlashCommandBuilder()
.setName('ban')
.setDescription('Ban a user')
.addUserOption(option => option.setName('target').setDescription('User to ban').setRequired(true))
.addStringOption(option => option.setName('reason').setDescription('Reason for ban')),
execute: async (interaction) => {
const target = interaction.options.getUser('target');
const reason = interaction.options.getString('reason') || 'No reason provided';
const member = interaction.guild.members.cache.get(target.id);
if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers)) return interaction.reply({ content: 'You cannot ban members.', ephemeral: true });

    await member.ban({ reason });  

    // Log it  
    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);  
    if (logChannel) logChannel.send(`✅ ${target.tag} was banned by ${interaction.user.tag} | Reason: ${reason}`);  

    interaction.reply({ content: `✅ ${target.tag} has been banned.`, ephemeral: true });  
}  

});

// ---------- KICK COMMAND ----------
client.commands.set('kick', {
data: new SlashCommandBuilder()
.setName('kick')
.setDescription('Kick a user')
.addUserOption(option => option.setName('target').setDescription('User to kick').setRequired(true))
.addStringOption(option => option.setName('reason').setDescription('Reason for kick')),
execute: async (interaction) => {
const target = interaction.options.getUser('target');
const reason = interaction.options.getString('reason') || 'No reason provided';
const member = interaction.guild.members.cache.get(target.id);
if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });
if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers)) return interaction.reply({ content: 'You cannot kick members.', ephemeral: true });

    await member.kick(reason);  

    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);  
    if (logChannel) logChannel.send(`✅ ${target.tag} was kicked by ${interaction.user.tag} | Reason: ${reason}`);  

    interaction.reply({ content: `✅ ${target.tag} has been kicked.`, ephemeral: true });  
}  

});

// ---------- MUTE & UNMUTE ----------
client.commands.set('mute', {
data: new SlashCommandBuilder()
.setName('mute')
.setDescription('Mute a user')
.addUserOption(option => option.setName('target').setDescription('User to mute').setRequired(true))
.addIntegerOption(option => option.setName('duration').setDescription('Duration in minutes').setRequired(true)),
execute: async (interaction) => {
const target = interaction.options.getUser('target');
const duration = interaction.options.getInteger('duration');
const member = interaction.guild.members.cache.get(target.id);
if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });

    let muteRole = interaction.guild.roles.cache.get(MUTE_ROLE_ID);  
    if (!muteRole) {  
        muteRole = await interaction.guild.roles.create({ name: 'Muted', permissions: [] });  
    }  
    await member.roles.add(muteRole);  

    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);  
    if (logChannel) logChannel.send(`🔇 ${target.tag} was muted by ${interaction.user.tag} for ${duration} minutes`);  

    interaction.reply({ content: `✅ ${target.tag} has been muted for ${duration} minutes.`, ephemeral: true });  

    setTimeout(async () => {  
        await member.roles.remove(muteRole);  
        if (logChannel) logChannel.send(`🔊 ${target.tag} has been unmuted after ${duration} minutes.`);  
    }, duration * 60 * 1000);  
}  

});

client.commands.set('unmute', {
data: new SlashCommandBuilder()
.setName('unmute')
.setDescription('Unmute a user')
.addUserOption(option => option.setName('target').setDescription('User to unmute').setRequired(true)),
execute: async (interaction) => {
const target = interaction.options.getUser('target');
const member = interaction.guild.members.cache.get(target.id);
if (!member) return interaction.reply({ content: 'User not found.', ephemeral: true });

    const muteRole = interaction.guild.roles.cache.get(MUTE_ROLE_ID);  
    if (muteRole) await member.roles.remove(muteRole);  

    const logChannel = interaction.guild.channels.cache.get(BANLOG_CHANNEL);  
    if (logChannel) logChannel.send(`🔊 ${target.tag} was unmuted by ${interaction.user.tag}`);  

    interaction.reply({ content: `✅ ${target.tag} has been unmuted.`, ephemeral: true });  
}  

});
// ---------- PART 5: MESSAGE TRACKING COMMANDS + DAILY RESET ----------
const { SlashCommandBuilder } = require('discord.js');

// ---------- /dailymsg COMMAND ----------
client.commands.set('dailymsg', {
data: new SlashCommandBuilder()
.setName('dailymsg')
.setDescription('Shows your daily message count'),
execute: async (interaction) => {
const guildId = interaction.guild.id;
const userId = interaction.user.id;

    if (!messages[guildId] || !messages[guildId][userId]) return interaction.reply({ content: '0 messages today', ephemeral: true });  

    interaction.reply({ content: `📩 You sent **${messages[guildId][userId].daily}** messages today!`, ephemeral: true });  
}  

});

// ---------- /totalmsg COMMAND ----------
client.commands.set('totalmsg', {
data: new SlashCommandBuilder()
.setName('totalmsg')
.setDescription('Shows your total message count'),
execute: async (interaction) => {
const guildId = interaction.guild.id;
const userId = interaction.user.id;

    if (!messages[guildId] || !messages[guildId][userId]) return interaction.reply({ content: '0 messages total', ephemeral: true });  

    interaction.reply({ content: `📨 You sent **${messages[guildId][userId].total}** messages in total!`, ephemeral: true });  
}  

});

// ---------- /leaderboard COMMAND ----------
client.commands.set('leaderboard', {
data: new SlashCommandBuilder()
.setName('leaderboard')
.setDescription('Shows top message senders'),
execute: async (interaction) => {
const guildId = interaction.guild.id;
if (!messages[guildId]) return interaction.reply({ content: 'No message data yet', ephemeral: true });

    const leaderboard = Object.entries(messages[guildId])  
        .map(([userId, data]) => ({ userId, total: data.total }))  
        .sort((a, b) => b.total - a.total)  
        .slice(0, 10);  

    let lbText = '📊 **Message Leaderboard:**\n';  
    for (let i = 0; i < leaderboard.length; i++) {  
        const member = interaction.guild.members.cache.get(leaderboard[i].userId);  
        lbText += `${i + 1}. ${member ? member.user.tag : 'Unknown'} — ${leaderboard[i].total} messages\n`;  
    }  

    interaction.reply({ content: lbText, ephemeral: true });  
}  

});

// ---------- DAILY RESET OF MESSAGE COUNTS ----------
setInterval(() => {
for (const guildId in messages) {
for (const userId in messages[guildId]) {
messages[guildId][userId].daily = 0;
}
}
console.log('🔄 Daily message counts reset');

// Optional: log daily reset  
const guild = client.guilds.cache.get(GUILD_ID);  
if (guild) {  
    const msgLogChannel = guild.channels.cache.get(MESSAGELOG_CHANNEL);  
    if (msgLogChannel) msgLogChannel.send('🔄 Daily message counts have been reset!');  
}  

}, 24 * 60 * 60 * 1000); // every 24 hours
