// Part 1 - Bot Setup & Core
import { Client, GatewayIntentBits, Partials, Collection, Routes, REST, EmbedBuilder } from 'discord.js';
import 'dotenv/config';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Prefix and permissions from environment
const PREFIX = process.env.PREFIX || '?';
const OWNER_ROLE = process.env.OWNER_ROLE_ID;
const ADMIN_ROLE = process.env.ADMIN_ROLE_ID;
const MOD_ROLE = process.env.MOD_ROLE_ID;
const STAFF_ROLE = process.env.STAFF_ROLE_ID;
const MUTE_ROLE = process.env.MUTE_ROLE_ID;

// Channels for logs
const BANLOG_CHANNEL = process.env.BANLOG_CHANNEL;
const MESSAGELOG_CHANNEL = process.env.MESSAGELOG_CHANNEL;
const GIVEAWAY_CHANNELS = process.env.GIVEAWAY_CHANNELS ? process.env.GIVEAWAY_CHANNELS.split(',') : [];

// Collections
client.commands = new Collection();
client.slashCommands = new Collection();

// Ready Event
client.once('ready', async () => {
    console.log(`${client.user.tag} is online!`);

    // Register slash commands
    const commands = [
        {
            name: 'ban',
            description: 'Ban a member',
            options: [
                { name: 'user', type: 6, description: 'User to ban', required: true },
                { name: 'reason', type: 3, description: 'Reason for ban', required: false }
            ]
        },
        {
            name: 'unban',
            description: 'Unban a member',
            options: [
                { name: 'user_id', type: 3, description: 'ID of the user to unban', required: true }
            ]
        },
        {
            name: 'kick',
            description: 'Kick a member',
            options: [
                { name: 'user', type: 6, description: 'User to kick', required: true },
                { name: 'reason', type: 3, description: 'Reason for kick', required: false }
            ]
        },
        {
            name: 'embed',
            description: 'Create a custom embed',
            options: [
                { name: 'title', type: 3, description: 'Title of the embed', required: false },
                { name: 'description', type: 3, description: 'Description of the embed', required: false },
                { name: 'color', type: 3, description: 'Hex color code', required: false }
            ]
        }
        // You can continue adding other slash commands here
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('🚀 Starting slash command deployment...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Slash commands deployed successfully!');
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
    }
});

// Message Delete/Edit Logging
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author.bot) return;
    const logChannel = await client.channels.fetch(MESSAGELOG_CHANNEL).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .setDescription(`**Author:** ${message.author.tag}\n**Channel:** ${message.channel}\n**Content:** ${message.content || 'Empty'}`)
        .setColor('Red')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author.bot) return;
    const logChannel = await client.channels.fetch(MESSAGELOG_CHANNEL).catch(() => null);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .setDescription(`**Author:** ${oldMessage.author.tag}\n**Channel:** ${oldMessage.channel}\n**Before:** ${oldMessage.content || 'Empty'}\n**After:** ${newMessage.content || 'Empty'}`)
        .setColor('Yellow')
        .setTimestamp();

    logChannel.send({ embeds: [embed] }).catch(() => {});
});

// Prefix command listener
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Commands will be handled in next parts
});

client.login(process.env.TOKEN);
// Part 2 - Moderation Commands & Logging
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Permission checks
    const memberRoles = message.member.roles.cache;
    const hasOwner = memberRoles.has(OWNER_ROLE);
    const hasAdmin = memberRoles.has(ADMIN_ROLE);
    const hasMod = memberRoles.has(MOD_ROLE);
    const hasStaff = memberRoles.has(STAFF_ROLE);

    // --- BAN ---
    if (command === 'ban') {
        if (!(hasOwner || hasAdmin || hasMod)) return message.reply('You do not have permission to use this command.');
        const user = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!user) return message.reply('Please mention a user to ban.');
        if (!user.bannable) return message.reply('I cannot ban this user.');

        await user.ban({ reason }).catch(err => message.reply('Failed to ban user.'));
        message.reply(`${user.user.tag} has been banned.`);

        const logChannel = await client.channels.fetch(BANLOG_CHANNEL).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Member Banned')
                .setColor('Red')
                .setDescription(`**User:** ${user.user.tag}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    }

    // --- UNBAN ---
    if (command === 'unban') {
        if (!(hasOwner || hasAdmin || hasMod)) return message.reply('You do not have permission to use this command.');
        const userId = args[0];
        if (!userId) return message.reply('Please provide the user ID to unban.');

        try {
            await message.guild.members.unban(userId);
            message.reply(`User <@${userId}> has been unbanned.`);

            const logChannel = await client.channels.fetch(BANLOG_CHANNEL).catch(() => null);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setTitle('Member Unbanned')
                    .setColor('Green')
                    .setDescription(`**User ID:** ${userId}\n**Moderator:** ${message.author.tag}`)
                    .setTimestamp();
                logChannel.send({ embeds: [embed] });
            }
        } catch (err) {
            message.reply('Failed to unban. Check the ID.');
        }
    }

    // --- KICK ---
    if (command === 'kick') {
        if (!(hasOwner || hasAdmin || hasMod)) return message.reply('You do not have permission to use this command.');
        const user = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!user) return message.reply('Please mention a user to kick.');
        if (!user.kickable) return message.reply('I cannot kick this user.');

        await user.kick(reason).catch(err => message.reply('Failed to kick user.'));
        message.reply(`${user.user.tag} has been kicked.`);

        const logChannel = await client.channels.fetch(BANLOG_CHANNEL).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Member Kicked')
                .setColor('Orange')
                .setDescription(`**User:** ${user.user.tag}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    }

    // --- WARN ---
    if (command === 'warn') {
        if (!(hasOwner || hasAdmin || hasMod || hasStaff)) return message.reply('You do not have permission to use this command.');
        const user = message.mentions.members.first();
        const reason = args.slice(1).join(' ') || 'No reason provided';
        if (!user) return message.reply('Please mention a user to warn.');

        message.reply(`${user.user.tag} has been warned.`);
        const logChannel = await client.channels.fetch(BANLOG_CHANNEL).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Member Warned')
                .setColor('Yellow')
                .setDescription(`**User:** ${user.user.tag}\n**Moderator:** ${message.author.tag}\n**Reason:** ${reason}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    }

    // --- TIMEOUT ---
    if (command === 'timeout') {
        if (!(hasOwner || hasAdmin || hasMod || hasStaff)) return message.reply('You do not have permission to use this command.');
        const user = message.mentions.members.first();
        const duration = args[1];
        const reason = args.slice(2).join(' ') || 'No reason provided';
        if (!user || !duration) return message.reply('Please mention a user and duration (in minutes).');

        const msDuration = parseInt(duration) * 60000;
        await user.timeout(msDuration, reason).catch(() => message.reply('Failed to timeout user.'));
        message.reply(`${user.user.tag} has been timed out for ${duration} minutes.`);

        const logChannel = await client.channels.fetch(BANLOG_CHANNEL).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Member Timed Out')
                .setColor('Purple')
                .setDescription(`**User:** ${user.user.tag}\n**Moderator:** ${message.author.tag}\n**Duration:** ${duration} minutes\n**Reason:** ${reason}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    }

    // --- REMOVE TIMEOUT ---
    if (command === 'rto') {
        if (!(hasOwner || hasAdmin || hasMod || hasStaff)) return message.reply('You do not have permission to use this command.');
        const user = message.mentions.members.first();
        if (!user) return message.reply('Please mention a user to remove timeout.');

        await user.timeout(null).catch(() => message.reply('Failed to remove timeout.'));
        message.reply(`${user.user.tag}'s timeout has been removed.`);

        const logChannel = await client.channels.fetch(BANLOG_CHANNEL).catch(() => null);
        if (logChannel) {
            const embed = new EmbedBuilder()
                .setTitle('Timeout Removed')
                .setColor('Green')
                .setDescription(`**User:** ${user.user.tag}\n**Moderator:** ${message.author.tag}`)
                .setTimestamp();
            logChannel.send({ embeds: [embed] });
        }
    }

    // Role Add / Remove / Create commands can be added in next part
});
// Part 3 - Roles, Embeds, Giveaway & Purge/Nuke
client.on('messageCreate', async (message) => {
    if (!message.guild || message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const memberRoles = message.member.roles.cache;
    const hasOwner = memberRoles.has(OWNER_ROLE);
    const hasAdmin = memberRoles.has(ADMIN_ROLE);
    const hasMod = memberRoles.has(MOD_ROLE);
    const hasStaff = memberRoles.has(STAFF_ROLE);

    // --- ROLE CREATE ---
    if (command === 'rolecreate') {
        if (!(hasOwner || hasAdmin)) return message.reply('You do not have permission.');
        const roleName = args.join(' ');
        if (!roleName) return message.reply('Provide a role name.');

        message.guild.roles.create({ name: roleName, color: 'BLUE' })
            .then(role => message.reply(`Role ${role.name} created.`))
            .catch(err => message.reply('Failed to create role.'));
    }

    // --- ROLE ADD ---
    if (command === 'roleadd') {
        if (!(hasOwner || hasAdmin || hasMod)) return message.reply('You do not have permission.');
        const user = message.mentions.members.first();
        const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === args[1]?.toLowerCase());
        if (!user || !role) return message.reply('Provide a user and role name.');

        user.roles.add(role).catch(() => message.reply('Failed to add role.'));
        message.reply(`Added role ${role.name} to ${user.user.tag}.`);
    }

    // --- ROLE REMOVE ---
    if (command === 'roleremove') {
        if (!(hasOwner || hasAdmin || hasMod)) return message.reply('You do not have permission.');
        const user = message.mentions.members.first();
        const role = message.guild.roles.cache.find(r => r.name.toLowerCase() === args[1]?.toLowerCase());
        if (!user || !role) return message.reply('Provide a user and role name.');

        user.roles.remove(role).catch(() => message.reply('Failed to remove role.'));
        message.reply(`Removed role ${role.name} from ${user.user.tag}.`);
    }

    // --- EMBED CREATION ---
    if (command === 'embed') {
        if (!(hasOwner || hasAdmin || hasMod)) return message.reply('You do not have permission.');
        const embedTitle = args.join(' ') || 'Embed';
        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setColor('Random')
            .setDescription('Type your description here')
            .setTimestamp()
            .setFooter({ text: `Embed by ${message.author.tag}` });

        message.channel.send({ embeds: [embed] });
    }

    // --- GIVEAWAY START ---
    if (command === 'gstart') {
        if (!(hasOwner || hasAdmin || hasStaff)) return message.reply('You do not have permission.');
        const duration = parseInt(args[0]);
        const prize = args.slice(1).join(' ');
        if (!duration || !prize) return message.reply('Provide duration (minutes) and prize.');

        const giveawayChannel = client.channels.cache.get(GIVEAWAY_CHANNELS.split(',')[0]);
        if (!giveawayChannel) return message.reply('Giveaway channel not found.');

        const embed = new EmbedBuilder()
            .setTitle(prize)
            .setDescription(`React with 🎉 to enter!\nTime: ${duration} minutes`)
            .setColor('Gold')
            .setTimestamp();
        const msg = await giveawayChannel.send({ embeds: [embed] });
        await msg.react('🎉');

        setTimeout(async () => {
            const usersReacted = (await msg.reactions.cache.get('🎉').users.fetch()).filter(u => !u.bot);
            if (usersReacted.size === 0) return giveawayChannel.send('No entries, giveaway cancelled.');

            const winner = usersReacted.random();
            giveawayChannel.send(`🎉 Congratulations ${winner}! You won **${prize}**`);
        }, duration * 60000);
    }

    // --- PURGE / NUKE ---
    if (command === 'purge') {
        if (!(hasOwner || hasAdmin)) return message.reply('You do not have permission.');
        const amount = parseInt(args[0]);
        if (!amount || amount > 100) return message.reply('Provide number of messages (max 100).');

        message.channel.bulkDelete(amount, true).catch(() => message.reply('Failed to delete messages.'));
    }

    if (command === 'nuke') {
        if (!hasOwner) return message.reply('Only owner can nuke.');
        const cloned = await message.channel.clone();
        await message.channel.delete();
        cloned.send('Channel nuked! 🔥');
    }
});
// Part 4 - Logs and Message Edit/Delete
client.on('messageDelete', async (message) => {
    if (!message.guild || message.author.bot) return;

    const logChannel = client.channels.cache.get(MESSAGELOG_CHANNEL);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Deleted')
        .addFields(
            { name: 'Author', value: `${message.author.tag}`, inline: true },
            { name: 'Channel', value: `${message.channel}`, inline: true },
            { name: 'Content', value: message.content || 'No text content' }
        )
        .setColor('Red')
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
});

client.on('messageUpdate', async (oldMessage, newMessage) => {
    if (!oldMessage.guild || oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    const logChannel = client.channels.cache.get(MESSAGELOG_CHANNEL);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle('Message Edited')
        .addFields(
            { name: 'Author', value: `${oldMessage.author.tag}`, inline: true },
            { name: 'Channel', value: `${oldMessage.channel}`, inline: true },
            { name: 'Old', value: oldMessage.content || 'No text content' },
            { name: 'New', value: newMessage.content || 'No text content' }
        )
        .setColor('Yellow')
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
});

// BAN/KICK/WARN logging function
async function modLog(action, user, moderator, reason) {
    const logChannel = client.channels.cache.get(BANLOG_CHANNEL);
    if (!logChannel) return;

    const embed = new EmbedBuilder()
        .setTitle(`${action} Executed`)
        .addFields(
            { name: 'User', value: user.tag, inline: true },
            { name: 'Moderator', value: moderator.tag, inline: true },
            { name: 'Reason', value: reason || 'No reason provided' }
        )
        .setColor(action === 'BAN' ? 'Red' : action === 'KICK' ? 'Orange' : 'Yellow')
        .setTimestamp();

    logChannel.send({ embeds: [embed] });
}

// Example usage inside ban command
// await modLog('BAN', target.user, message.author, reason);
