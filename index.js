// index.js
// ======== FSG BOT v2 – Fixed Version ========
// Includes: prefix + slash commands + giveaway + mod + logs

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");
const fs = require("fs");
const express = require("express");
require("dotenv").config();

// ======== CONFIG ========
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();
client.slashCommands = new Collection();

const PREFIX = process.env.PREFIX || "?";
const TOKEN = process.env.TOKEN;

// ======== EXPRESS KEEP-ALIVE FOR RENDER ========
const app = express();
app.get("/", (req, res) => res.send("Bot is alive! ✅"));
app.listen(process.env.PORT || 3000, () =>
  console.log("🌐 Express server active.")
);

// ======== LOAD COMMAND FILES ========
const commandFolders = fs.readdirSync("./commands");
for (const folder of commandFolders) {
  const files = fs
    .readdirSync(`./commands/${folder}`)
    .filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const command = require(`./commands/${folder}/${file}`);
    if (command.name) client.commands.set(command.name, command);
    if (command.data && command.data.name)
      client.slashCommands.set(command.data.name, command);
  }
}

// ======== PREFIX MESSAGE HANDLER ========
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(PREFIX) || message.author.bot) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  const command = client.commands.get(cmd);
  if (!command) return;

  try {
    await command.execute(message, args, client);
  } catch (err) {
    console.error(err);
    message.reply("❌ | There was an error executing that command.");
  }
});

// ======== SLASH COMMAND HANDLER ========
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await interaction.deferReply({ ephemeral: false });
    await command.execute(interaction, client);
  } catch (err) {
    console.error(err);
    if (!interaction.replied)
      await interaction.editReply("❌ | Command failed to run properly.");
  }
});

// ======== LOGIN ========
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.login(TOKEN);
// ======== MODERATION COMMANDS ========
// Make folder: ./commands/mod/

const { EmbedBuilder, PermissionsBitField, SlashCommandBuilder } = require("discord.js");

// ===== BAN =====
module.exports = {
  name: "ban",
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user from the server.")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to ban").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for ban").setRequired(false)
    ),
  async execute(interactionOrMsg, args, client) {
    let member, reason;

    if (interactionOrMsg.isCommand?.()) {
      const target = interactionOrMsg.options.getUser("target");
      member = await interactionOrMsg.guild.members.fetch(target.id);
      reason =
        interactionOrMsg.options.getString("reason") || "No reason provided";
    } else {
      member = interactionOrMsg.mentions.members.first();
      reason = args.slice(1).join(" ") || "No reason provided";
    }

    if (!member)
      return interactionOrMsg.reply("❌ | Couldn't find that member.");
    if (!interactionOrMsg.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interactionOrMsg.reply("❌ | You lack **Ban Members** permission.");

    await member.ban({ reason });
    const embed = new EmbedBuilder()
      .setColor("Red")
      .setTitle("🔨 User Banned")
      .addFields(
        { name: "User", value: `${member.user.tag}`, inline: true },
        { name: "By", value: `${interactionOrMsg.member.user.tag}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    const logChannel = client.channels.cache.get(process.env.BANLOG_CHANNEL);
    if (logChannel) logChannel.send({ embeds: [embed] });

    if (interactionOrMsg.isCommand?.()) {
      await interactionOrMsg.editReply({ content: "✅ User banned!", embeds: [embed] });
    } else {
      await interactionOrMsg.reply({ embeds: [embed] });
    }
  },
};

// ===== KICK =====
module.exports.kick = {
  name: "kick",
  data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user from the server.")
    .addUserOption((opt) =>
      opt.setName("target").setDescription("User to kick").setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName("reason").setDescription("Reason for kick").setRequired(false)
    ),
  async execute(interactionOrMsg, args, client) {
    let member, reason;
    if (interactionOrMsg.isCommand?.()) {
      const target = interactionOrMsg.options.getUser("target");
      member = await interactionOrMsg.guild.members.fetch(target.id);
      reason =
        interactionOrMsg.options.getString("reason") || "No reason provided";
    } else {
      member = interactionOrMsg.mentions.members.first();
      reason = args.slice(1).join(" ") || "No reason provided";
    }

    if (!member)
      return interactionOrMsg.reply("❌ | Couldn't find that member.");
    if (!interactionOrMsg.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interactionOrMsg.reply("❌ | You lack **Kick Members** permission.");

    await member.kick(reason);
    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("👢 User Kicked")
      .addFields(
        { name: "User", value: `${member.user.tag}`, inline: true },
        { name: "By", value: `${interactionOrMsg.member.user.tag}`, inline: true },
        { name: "Reason", value: reason }
      )
      .setTimestamp();

    const logChannel = client.channels.cache.get(process.env.BANLOG_CHANNEL);
    if (logChannel) logChannel.send({ embeds: [embed] });

    if (interactionOrMsg.isCommand?.()) {
      await interactionOrMsg.editReply({ content: "✅ User kicked!", embeds: [embed] });
    } else {
      await interactionOrMsg.reply({ embeds: [embed] });
    }
  },
};

// ===== ROLE ADD / REMOVE / CREATE =====
module.exports.role = {
  name: "roleadd",
  data: new SlashCommandBuilder()
    .setName("roleadd")
    .setDescription("Add a role to a user.")
    .addUserOption((opt) =>
      opt.setName("user").setDescription("User to give role").setRequired(true)
    )
    .addRoleOption((opt) =>
      opt.setName("role").setDescription("Role to give").setRequired(true)
    ),
  async execute(interactionOrMsg, args, client) {
    let member, role;

    if (interactionOrMsg.isCommand?.()) {
      member = interactionOrMsg.options.getMember("user");
      role = interactionOrMsg.options.getRole("role");
    } else {
      member = interactionOrMsg.mentions.members.first();
      role = interactionOrMsg.mentions.roles.first();
    }

    if (!member || !role)
      return interactionOrMsg.reply("❌ | Please mention a valid member and role.");
    await member.roles.add(role);

    const embed = new EmbedBuilder()
      .setColor("Green")
      .setTitle("✅ Role Added")
      .addFields(
        { name: "User", value: `${member.user.tag}`, inline: true },
        { name: "Role", value: `${role.name}`, inline: true },
        { name: "By", value: `${interactionOrMsg.member.user.tag}` }
      )
      .setTimestamp();

    await interactionOrMsg.reply({ embeds: [embed] });
  },
};
// ======== GIVEAWAY & LOGS & KEEP-ALIVE ========

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  Collection,
} = require("discord.js");
const express = require("express");
const ms = require("ms");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.commands = new Collection();

// =============================
// Message Delete/Edit Logging
// =============================
client.on("messageDelete", async (message) => {
  if (message.author?.bot) return;
  const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor("Red")
    .setTitle("🗑️ Message Deleted")
    .addFields(
      { name: "User", value: `${message.author.tag}`, inline: true },
      { name: "Channel", value: `${message.channel}`, inline: true },
      {
        name: "Content",
        value: message.content?.slice(0, 1024) || "*No content*",
      }
    )
    .setTimestamp();
  logChannel.send({ embeds: [embed] });
});

client.on("messageUpdate", async (oldMsg, newMsg) => {
  if (newMsg.author?.bot || oldMsg.content === newMsg.content) return;
  const logChannel = client.channels.cache.get(process.env.LOG_CHANNEL);
  if (!logChannel) return;

  const embed = new EmbedBuilder()
    .setColor("Yellow")
    .setTitle("✏️ Message Edited")
    .addFields(
      { name: "User", value: `${newMsg.author.tag}`, inline: true },
      { name: "Channel", value: `${newMsg.channel}`, inline: true },
      { name: "Before", value: oldMsg.content?.slice(0, 1024) || "*Empty*" },
      { name: "After", value: newMsg.content?.slice(0, 1024) || "*Empty*" }
    )
    .setTimestamp();

  logChannel.send({ embeds: [embed] });
});

// =============================
// Giveaway Command
// =============================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (interaction.commandName === "gstart") {
    const duration = interaction.options.getString("duration");
    const prize = interaction.options.getString("prize");
    const roleRequired = interaction.options.getRole("role_required");
    const extraEntries = interaction.options.getInteger("extra_entries") || 0;
    const host = interaction.user;

    const endTime = Date.now() + ms(duration);
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("🎉 Giveaway Started!")
      .setDescription(
        `**Prize:** ${prize}\n🕒 Ends: <t:${Math.floor(
          endTime / 1000
        )}:R>\n👤 Hosted by: ${host}\n${roleRequired ? `🎭 Role Required: ${roleRequired}` : ""
        }\n⭐ Extra Entries: ${extraEntries}`
      )
      .setTimestamp();

    const msg = await interaction.reply({
      embeds: [embed],
      fetchReply: true,
    });
    msg.react("🎉");

    setTimeout(async () => {
      const reacted = await msg.reactions.cache.get("🎉")?.users.fetch();
      const participants = reacted
        ?.filter((u) => !u.bot)
        .filter(
          (u) =>
            !roleRequired ||
            interaction.guild.members.cache
              .get(u.id)
              ?.roles.cache.has(roleRequired.id)
        )
        .map((u) => ({
          id: u.id,
          entries: 1 + (u.id === host.id ? extraEntries : 0),
        }));

      if (!participants?.length) {
        return msg.reply("❌ No valid participants, giveaway canceled.");
      }

      const weighted = [];
      for (const p of participants) {
        for (let i = 0; i < p.entries; i++) weighted.push(p.id);
      }

      const winnerId = weighted[Math.floor(Math.random() * weighted.length)];
      const winner = await interaction.guild.members.fetch(winnerId);

      const endEmbed = new EmbedBuilder()
        .setColor("Green")
        .setTitle("🎉 Giveaway Ended!")
        .setDescription(
          `**Prize:** ${prize}\n🏆 Winner: ${winner}\n🎭 Hosted by: ${host}`
        )
        .setTimestamp();

      await msg.edit({ embeds: [endEmbed] });
    }, ms(duration));
  }
});

// =============================
// Prefix Commands Example (?ban, ?kick, etc.)
// =============================
client.on("messageCreate", async (msg) => {
  if (msg.author.bot || !msg.content.startsWith("?")) return;
  const args = msg.content.slice(1).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "ping") {
    msg.reply("🏓 Pong!");
  }
  if (cmd === "ban") {
    const member = msg.mentions.members.first();
    if (!member)
      return msg.reply("❌ Mention a user to ban.");
    await member.ban({ reason: "Banned by prefix command" });
    msg.reply(`✅ ${member.user.tag} banned.`);
  }
});

// =============================
// Express Keep Alive (Render)
// =============================
const app = express();
app.get("/", (req, res) => res.send("Bot is alive"));
app.listen(3000, () =>
  console.log("✅ Express server running to keep bot alive.")
);

// =============================
// Login
// =============================
client.login(process.env.TOKEN);
