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

// ---------- CONFIG ----------
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

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

});

// ---------- LOGIN ----------
client.login(process.env.TOKEN);
// ---------- PART 2: GIVEAWAY COMMANDS ----------
const { SlashCommandBuilder } = require('discord.js');

client.commands = new Collection();

// ---------- START GIVEAWAY ----------
client.commands.set('startgiveaway', {
data: new SlashCommandBuilder()
.setName('startgiveaway')
.setDescription('Start a new giveaway')
.addStringOption(option => option.setName('prize').setDescription('Giveaway prize').setRequired(true))
.addIntegerOption(option => option.setName('duration').setDescription('Duration in seconds').setRequired(true)),
execute: async (interaction) => {
const prize = interaction.options.getString('prize');
const duration = interaction.options.getInteger('duration') * 1000;
const endTime = Date.now() + duration;

    const giveawayMessage = await interaction.channel.send({ content: `🎉 **GIVEAWAY** 🎉\nPrize: **${prize}**\nReact with 🎁 to join!\nEnds in **${duration/1000} seconds**` });  
    await giveawayMessage.react('🎁');  

    // Store giveaway in memory  
    giveaways[giveawayMessage.id] = {  
        channelId: interaction.channel.id,  
        entries: [],  
        ended: false,  
        prize,  
        endTime  
    };  

    interaction.reply({ content: `✅ Giveaway started for **${prize}**!`, ephemeral: true });  

    // End giveaway automatically  
    setTimeout(() => {  
        const giveaway = giveaways[giveawayMessage.id];  
        if (!giveaway || giveaway.ended) return;  
        giveaway.ended = true;  

        const entries = giveaway.entries;  
        if (entries.length === 0) {  
            interaction.channel.send(`No one joined the giveaway for **${prize}** 😢`);  
        } else {  
            const winnerId = entries[Math.floor(Math.random() * entries.length)];  
            const winner = interaction.guild.members.cache.get(winnerId);  
            interaction.channel.send(`🎉 Congratulations ${winner}! You won **${prize}**!`);  
        }  

        // Log giveaway end  
        const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);  
        if (logChannel) logChannel.send(`Giveaway ended for **${prize}**`);  
    }, duration);  
}  

});

// ---------- END GIVEAWAY MANUALLY ----------
client.commands.set('endgiveaway', {
data: new SlashCommandBuilder()
.setName('endgiveaway')
.setDescription('End an active giveaway')
.addStringOption(option => option.setName('messageid').setDescription('Giveaway message ID').setRequired(true)),
execute: async (interaction) => {
const messageId = interaction.options.getString('messageid');
const giveaway = giveaways[messageId];
if (!giveaway || giveaway.ended) return interaction.reply({ content: "❌ Giveaway not found or already ended.", ephemeral: true });

    giveaway.ended = true;  

    const entries = giveaway.entries;  
    if (entries.length === 0) {  
        interaction.channel.send(`No one joined the giveaway for **${giveaway.prize}** 😢`);  
    } else {  
        const winnerId = entries[Math.floor(Math.random() * entries.length)];  
        const winner = interaction.guild.members.cache.get(winnerId);  
        interaction.channel.send(`🎉 Congratulations ${winner}! You won **${giveaway.prize}**!`);  
    }  

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);  
    if (logChannel) logChannel.send(`Giveaway ended manually for **${giveaway.prize}**`);  

    interaction.reply({ content: `✅ Giveaway ended manually.`, ephemeral: true });  
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
    moderationLogs.push({ type: 'Ban', user: target.tag, moderator: interaction.user.tag, reason, time: new Date() });  
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);  
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

    moderationLogs.push({ type: 'Kick', user: target.tag, moderator: interaction.user.tag, reason, time: new Date() });  
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);  
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

    let muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');  
    if (!muteRole) {  
        muteRole = await interaction.guild.roles.create({ name: 'Muted', permissions: [] });  
    }  
    await member.roles.add(muteRole);  

    moderationLogs.push({ type: 'Mute', user: target.tag, moderator: interaction.user.tag, duration, time: new Date() });  
    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);  
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

    const muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');  
    if (muteRole) await member.roles.remove(muteRole);  

    const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);  
    if (logChannel) logChannel.send(`🔊 ${target.tag} was unmuted by ${interaction.user.tag}`);  

    interaction.reply({ content: `✅ ${target.tag} has been unmuted.`, ephemeral: true });  
}  

});

// ---------- ROLE MANAGEMENT: ADD & REMOVE & CREATE ----------
client.commands.set('role', {
data: new SlashCommandBuilder()
.setName('role')
.setDescription('Role management')
.addStringOption(option => option.setName('action').setDescription('add/remove/create').setRequired(true))
.addUserOption(option => option.setName('target').setDescription('User'))
.addRoleOption(option => option.setName('role').setDescription('Role'))
.addStringOption(option => option.setName('name').setDescription('Role name for create')),
execute: async (interaction) => {
const action = interaction.options.getString('action');
const targetUser = interaction.options.getUser('target');
const role = interaction.options.getRole('role');
const roleName = interaction.options.getString('name');
const logChannel = interaction.guild.channels.cache.get(LOG_CHANNEL_ID);

    if (action === 'add' && targetUser && role) {  
        const member = interaction.guild.members.cache.get(targetUser.id);  
        await member.roles.add(role);  
        if (logChannel) logChannel.send(`✅ ${role.name} role added to ${targetUser.tag} by ${interaction.user.tag}`);  
        interaction.reply({ content: `✅ Role added.`, ephemeral: true });  
    } else if (action === 'remove' && targetUser && role) {  
        const member = interaction.guild.members.cache.get(targetUser.id);  
        await member.roles.remove(role);  
        if (logChannel) logChannel.send(`✅ ${role.name} role removed from ${targetUser.tag} by ${interaction.user.tag}`);  
        interaction.reply({ content: `✅ Role removed.`, ephemeral: true });  
    } else if (action === 'create' && roleName) {  
        const newRole = await interaction.guild.roles.create({ name: roleName });  
        if (logChannel) logChannel.send(`✅ Role ${roleName} created by ${interaction.user.tag}`);  
        interaction.reply({ content: `✅ Role created.`, ephemeral: true });  
    } else {  
        interaction.reply({ content: `❌ Invalid options.`, ephemeral: true });  
    }  
}  

});
// ---------- PART 5: MESSAGE TRACKING COMMANDS + DAILY RESET ----------
const { SlashCommandBuilder } = require('discord.js');

// ---------- DAILY MESSAGE COUNT ----------
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

// ---------- TOTAL MESSAGE COUNT ----------
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

// ---------- MESSAGE LEADERBOARD ----------
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

// ---------- DAILY RESET ----------
setInterval(() => {
for (const guildId in messages) {
for (const userId in messages[guildId]) {
messages[guildId][userId].daily = 0;
}
}
console.log('🔄 Daily message counts reset');
}, 24 * 60 * 60 * 1000); // every 24 hours
