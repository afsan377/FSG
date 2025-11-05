const { Client, GatewayIntentBits, Partials, EmbedBuilder, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
require('dotenv').config();
const mongoose = require('mongoose');
const ms = require('ms');

// ---------- CONFIG ----------
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const LOG_CHANNEL_ID = process.env.LOG_CHANNEL_ID;

// ---------- DISCORD CLIENT ----------
const client = new Client({
intents: [
GatewayIntentBits.Guilds,
GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,
GatewayIntentBits.GuildMembers,
GatewayIntentBits.GuildMessageReactions
],
partials: [Partials.Channel, Partials.Message, Partials.Reaction],
});

// ---------- MONGODB CONNECTION ----------
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.log('❌ MongoDB Error:', err));

// ---------- MESSAGE LOG SCHEMA ----------
const messageLogSchema = new mongoose.Schema({
guildId: String,
userId: String,
daily: { type: Number, default: 0 },
total: { type: Number, default: 0 },
});
const MessageLog = mongoose.model('MessageLog', messageLogSchema);

// ---------- GIVEAWAY SCHEMA ----------
const giveawaySchema = new mongoose.Schema({
guildId: String,
channelId: String,
prize: String,
duration: Number,
hostId: String,
entries: [String],
ended: { type: Boolean, default: false },
});
const Giveaway = mongoose.model('Giveaway', giveawaySchema);

client.login(TOKEN);

// ---------- READY EVENT ----------
client.once('ready', () => {
console.log("✅ Logged in as ${client.user.tag}");
});

// ---------- MESSAGE CREATE EVENT FOR LOGGING ----------
client.on('messageCreate', async message => {
if (message.author.bot) return;

let log = await MessageLog.findOne({ guildId: message.guild.id, userId: message.author.id });  
if (!log) {  
    log = await MessageLog.create({ guildId: message.guild.id, userId: message.author.id });  
}  

log.daily += 1;  
log.total += 1;  
await log.save();  

});
const { SlashCommandBuilder } = require('discord.js');

// ---------- GIVEAWAY SLASH COMMANDS ----------
const giveawayCommands = [
new SlashCommandBuilder()
.setName('startgiveaway')
.setDescription('Start a giveaway')
.addStringOption(option => option.setName('prize').setDescription('Prize of giveaway').setRequired(true))
.addStringOption(option => option.setName('duration').setDescription('Duration like 1m, 1h').setRequired(true)),

new SlashCommandBuilder()  
    .setName('endgiveaway')  
    .setDescription('End an ongoing giveaway')  
    .addStringOption(option => option.setName('id').setDescription('Giveaway ID').setRequired(true)),  

new SlashCommandBuilder()  
    .setName('rerollgiveaway')  
    .setDescription('Reroll winner for ended giveaway')  
    .addStringOption(option => option.setName('id').setDescription('Giveaway ID').setRequired(true)),  

];

// ---------- REGISTER GIVEAWAY COMMANDS ----------
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
try {
console.log('🔄 Refreshing giveaway commands...');
await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: giveawayCommands });
console.log('✅ Giveaway commands registered.');
} catch (error) {
console.error(error);
}
})();

// ---------- INTERACTION CREATE EVENT ----------
client.on('interactionCreate', async interaction => {
if (!interaction.isChatInputCommand()) return;

const { commandName } = interaction;  

// START GIVEAWAY  
if (commandName === 'startgiveaway') {  
    const prize = interaction.options.getString('prize');  
    const duration = ms(interaction.options.getString('duration'));  

    const giveaway = await Giveaway.create({  
        guildId: interaction.guild.id,  
        channelId: interaction.channel.id,  
        prize,  
        duration,  
        hostId: interaction.user.id,  
        entries: [],  
    });  

    await interaction.reply(`🎉 Giveaway started for **${prize}**! React or enter to participate.`);  

    // END GIVEAWAY AFTER DURATION  
    setTimeout(async () => {  
        const g = await Giveaway.findById(giveaway._id);  
        if (!g) return;  
        if (g.entries.length === 0) {  
            interaction.followUp(`❌ Giveaway ended for **${g.prize}**, but no one entered.`);  
            return;  
        }  

        const winnerId = g.entries[Math.floor(Math.random() * g.entries.length)];  
        interaction.followUp(`🏆 Congratulations <@${winnerId}>! You won **${g.prize}**!`);  

        // LOG  
        const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);  
        logChannel.send(`Giveaway ended: **${g.prize}** | Winner: <@${winnerId}> | Host: <@${g.hostId}>`);  

        g.ended = true;  
        await g.save();  
    }, duration);  
}  

// END GIVEAWAY MANUALLY  
if (commandName === 'endgiveaway') {  
    const id = interaction.options.getString('id');  
    const g = await Giveaway.findById(id);  
    if (!g) return interaction.reply('❌ Giveaway not found.');  
    if (g.ended) return interaction.reply('❌ Giveaway already ended.');  

    if (g.entries.length === 0) {  
        g.ended = true;  
        await g.save();  
        return interaction.reply(`❌ Giveaway ended for **${g.prize}**, but no one entered.`);  
    }  

    const winnerId = g.entries[Math.floor(Math.random() * g.entries.length)];  
    interaction.reply(`🏆 Giveaway ended! Winner: <@${winnerId}> for **${g.prize}**`);  

    const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);  
    logChannel.send(`Giveaway ended manually: **${g.prize}** | Winner: <@${winnerId}> | Host: <@${g.hostId}>`);  

    g.ended = true;  
    await g.save();  
}  

// REROLL GIVEAWAY  
if (commandName === 'rerollgiveaway') {  
    const id = interaction.options.getString('id');  
    const g = await Giveaway.findById(id);  
    if (!g) return interaction.reply('❌ Giveaway not found.');  
    if (!g.ended) return interaction.reply('❌ Giveaway is still running.');  
    if (g.entries.length === 0) return interaction.reply('❌ No entries to reroll.');  

    const winnerId = g.entries[Math.floor(Math.random() * g.entries.length)];  
    interaction.reply(`🔄 Giveaway rerolled! New winner: <@${winnerId}> for **${g.prize}**`);  

    const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);  
    logChannel.send(`Giveaway rerolled: **${g.prize}** | New Winner: <@${winnerId}> | Host: <@${g.hostId}>`);  
}  

});
const { PermissionsBitField } = require('discord.js');

// ---------- MODERATION SLASH COMMANDS ----------
const moderationCommands = [
new SlashCommandBuilder()
.setName('ban')
.setDescription('Ban a member')
.addUserOption(option => option.setName('user').setDescription('User to ban').setRequired(true))
.addStringOption(option => option.setName('reason').setDescription('Reason for ban')),

new SlashCommandBuilder()  
    .setName('kick')  
    .setDescription('Kick a member')  
    .addUserOption(option => option.setName('user').setDescription('User to kick').setRequired(true))  
    .addStringOption(option => option.setName('reason').setDescription('Reason for kick')),  

new SlashCommandBuilder()  
    .setName('mute')  
    .setDescription('Mute a member')  
    .addUserOption(option => option.setName('user').setDescription('User to mute').setRequired(true))  
    .addStringOption(option => option.setName('duration').setDescription('Duration like 10m, 1h')),  

new SlashCommandBuilder()  
    .setName('unmute')  
    .setDescription('Unmute a member')  
    .addUserOption(option => option.setName('user').setDescription('User to unmute').setRequired(true)),  

new SlashCommandBuilder()  
    .setName('role')  
    .setDescription('Manage roles')  
    .addSubcommand(sub => sub.setName('add').setDescription('Add role to member')  
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))  
        .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true)))  
    .addSubcommand(sub => sub.setName('remove').setDescription('Remove role from member')  
        .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))  
        .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))  
    .addSubcommand(sub => sub.setName('create').setDescription('Create a new role')  
        .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true)))  
    .addSubcommand(sub => sub.setName('kick').setDescription('Delete a role')  
        .addRoleOption(o => o.setName('role').setDescription('Role to delete').setRequired(true))),  

];

// ---------- REGISTER MODERATION COMMANDS ----------
(async () => {
try {
console.log('🔄 Registering moderation commands...');
await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [...giveawayCommands, ...moderationCommands] });
console.log('✅ Moderation commands registered.');
} catch (error) {
console.error(error);
}
})();

// ---------- MODERATION INTERACTION HANDLER ----------
client.on('interactionCreate', async interaction => {
if (!interaction.isChatInputCommand()) return;

const logChannel = await client.channels.fetch(process.env.LOG_CHANNEL_ID);  

// ----- BAN -----  
if (interaction.commandName === 'ban') {  
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))  
        return interaction.reply('❌ You do not have permission to ban members.');  

    const user = interaction.options.getUser('user');  
    const reason = interaction.options.getString('reason') || 'No reason provided';  
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);  
    if (!member) return interaction.reply('❌ Member not found.');  

    await member.ban({ reason });  
    interaction.reply(`✅ <@${user.id}> has been banned.\nReason: ${reason}`);  
    logChannel.send(`🛑 Ban | User: <@${user.id}> | By: <@${interaction.user.id}> | Reason: ${reason}`);  
}  

// ----- KICK -----  
if (interaction.commandName === 'kick') {  
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))  
        return interaction.reply('❌ You do not have permission to kick members.');  

    const user = interaction.options.getUser('user');  
    const reason = interaction.options.getString('reason') || 'No reason provided';  
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);  
    if (!member) return interaction.reply('❌ Member not found.');  

    await member.kick(reason);  
    interaction.reply(`✅ <@${user.id}> has been kicked.\nReason: ${reason}`);  
    logChannel.send(`🛑 Kick | User: <@${user.id}> | By: <@${interaction.user.id}> | Reason: ${reason}`);  
}  

// ----- MUTE -----  
if (interaction.commandName === 'mute') {  
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.MuteMembers))  
        return interaction.reply('❌ You do not have permission to mute members.');  

    const user = interaction.options.getUser('user');  
    const duration = interaction.options.getString('duration') || '10m';  
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);  
    if (!member) return interaction.reply('❌ Member not found.');  

    let muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');  
    if (!muteRole) {  
        muteRole = await interaction.guild.roles.create({ name: 'Muted', permissions: [] });  
        interaction.guild.channels.cache.forEach(c => c.permissionOverwrites.create(muteRole, { SendMessages: false, AddReactions: false }));  
    }  

    await member.roles.add(muteRole);  
    interaction.reply(`✅ <@${user.id}> has been muted for ${duration}`);  
    logChannel.send(`🤐 Mute | User: <@${user.id}> | By: <@${interaction.user.id}> | Duration: ${duration}`);  

    setTimeout(async () => {  
        await member.roles.remove(muteRole);  
        logChannel.send(`🔊 Unmute (auto) | User: <@${user.id}>`);  
    }, ms(duration));  
}  

// ----- UNMUTE -----  
if (interaction.commandName === 'unmute') {  
    const user = interaction.options.getUser('user');  
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);  
    if (!member) return interaction.reply('❌ Member not found.');  

    const muteRole = interaction.guild.roles.cache.find(r => r.name === 'Muted');  
    if (muteRole && member.roles.cache.has(muteRole.id)) {  
        await member.roles.remove(muteRole);  
        interaction.reply(`✅ <@${user.id}> has been unmuted.`);  
        logChannel.send(`🔊 Unmute | User: <@${user.id}> | By: <@${interaction.user.id}>`);  
    } else {  
        interaction.reply('❌ User is not muted.');  
    }  
}  

// ----- ROLE SUBCOMMANDS -----  
if (interaction.commandName === 'role') {  
    const sub = interaction.options.getSubcommand();  

    if (sub === 'add') {  
        const user = interaction.options.getUser('user');  
        const role = interaction.options.getRole('role');  
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);  
        if (!member) return interaction.reply('❌ Member not found.');  

        await member.roles.add(role);  
        interaction.reply(`✅ Added role **${role.name}** to <@${user.id}>.`);  
        logChannel.send(`🟢 Role Add | User: <@${user.id}> | Role: ${role.name} | By: <@${interaction.user.id}>`);  
    }  

    if (sub === 'remove') {  
        const user = interaction.options.getUser('user');  
        const role = interaction.options.getRole('role');  
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);  
        if (!member) return interaction.reply('❌ Member not found.');  

        await member.roles.remove(role);  
        interaction.reply(`✅ Removed role **${role.name}** from <@${user.id}>.`);  
        logChannel.send(`🔴 Role Remove | User: <@${user.id}> | Role: ${role.name} | By: <@${interaction.user.id}>`);  
    }  

    if (sub === 'create') {  
        const name = interaction.options.getString('name');  
        const role = await interaction.guild.roles.create({ name, permissions: [] });  
        interaction.reply(`✅ Created new role **${role.name}**.`);  
        logChannel.send(`🆕 Role Create | Role: ${role.name} | By: <@${interaction.user.id}>`);  
    }  

    if (sub === 'kick') {  
        const role = interaction.options.getRole('role');  
        await role.delete();  
        interaction.reply(`✅ Deleted role **${role.name}**.`);  
        logChannel.send(`❌ Role Delete | Role: ${role.name} | By: <@${interaction.user.id}>`);  
    }  
}  

});
// ---------- MESSAGE TRACKING SLASH COMMANDS ----------
const messageCommands = [
new SlashCommandBuilder()
.setName('dailymsg')
.setDescription('Check your daily message count'),

new SlashCommandBuilder()  
    .setName('totalmsg')  
    .setDescription('Check your total message count'),  

new SlashCommandBuilder()  
    .setName('leaderboard')  
    .setDescription('Show top message senders in the server'),  

];

// ---------- REGISTER MESSAGE COMMANDS ----------
(async () => {
try {
console.log('🔄 Registering message tracking commands...');
await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: [...giveawayCommands, ...moderationCommands, ...messageCommands] });
console.log('✅ Message tracking commands registered.');
} catch (error) {
console.error(error);
}
})();

// ---------- INTERACTION HANDLER FOR MESSAGE COMMANDS ----------
client.on('interactionCreate', async interaction => {
if (!interaction.isChatInputCommand()) return;

const { commandName } = interaction;  

// DAILY MESSAGE COUNT  
if (commandName === 'dailymsg') {  
    let log = await MessageLog.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });  
    const count = log ? log.daily : 0;  
    interaction.reply(`📊 You have sent **${count}** messages today.`);  
}  

// TOTAL MESSAGE COUNT  
if (commandName === 'totalmsg') {  
    let log = await MessageLog.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });  
    const count = log ? log.total : 0;  
    interaction.reply(`📊 You have sent **${count}** messages in total.`);  
}  

// LEADERBOARD  
if (commandName === 'leaderboard') {  
    const logs = await MessageLog.find({ guildId: interaction.guild.id }).sort({ total: -1 }).limit(10);  
    if (!logs.length) return interaction.reply('❌ No messages tracked yet.');  

    let description = '';  
    logs.forEach((l, i) => {  
        description += `**${i + 1}. <@${l.userId}>** — ${l.total} messages\n`;  
    });  

    const embed = new EmbedBuilder()  
        .setTitle('📊 Message Leaderboard')  
        .setDescription(description)  
        .setColor('Blue');  

    interaction.reply({ embeds: [embed] });  
}  

});
// ---------- GIVEAWAY REACTION HANDLER ----------
client.on('messageReactionAdd', async (reaction, user) => {
if (user.bot) return;

// Fetch partials if necessary  
if (reaction.partial) await reaction.fetch();  
if (reaction.message.partial) await reaction.message.fetch();  

const giveaway = await Giveaway.findOne({ channelId: reaction.message.channel.id, ended: false });  
if (!giveaway) return;  

// Add user to entries if not already  
if (!giveaway.entries.includes(user.id)) {  
    giveaway.entries.push(user.id);  
    await giveaway.save();  
}  

});

client.on('messageReactionRemove', async (reaction, user) => {
if (user.bot) return;

if (reaction.partial) await reaction.fetch();  
if (reaction.message.partial) await reaction.message.fetch();  

const giveaway = await Giveaway.findOne({ channelId: reaction.message.channel.id, ended: false });  
if (!giveaway) return;  

// Remove user from entries if reaction removed  
giveaway.entries = giveaway.entries.filter(id => id !== user.id);  
await giveaway.save();  

});
// ---------- DAILY RESET FOR MESSAGE LOGS ----------
const resetDailyMessages = async () => {
try {
const logs = await MessageLog.updateMany({}, { daily: 0 });
console.log('🔄 Daily message counts reset for all users');
} catch (err) {
console.error('❌ Error resetting daily messages:', err);
}
};

// Reset daily messages every 24 hours (86400000 ms)
setInterval(resetDailyMessages, 24 * 60 * 60 * 1000);

// Optionally, reset at a specific time every day (e.g., midnight server time)
// const now = new Date();
// const millisTillMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0, 0, 0, 0) - now;
// setTimeout(function(){
//     resetDailyMessages();
//     setInterval(resetDailyMessages, 24 * 60 * 60 * 1000);
// }, millisTillMidnight);
