const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require("discord.js");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID; // Discord server ID
const CLIENT_ID = process.env.CLIENT_ID; // Your bot's application ID

const queue = []; // Commands queue for Roblox

// --- Setup Discord Slash Commands ---
const commands = [
    new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a Roblox player")
        .addIntegerOption(opt => opt.setName("userid").setDescription("Roblox UserId").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)),

    new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a Roblox player")
        .addIntegerOption(opt => opt.setName("userid").setDescription("Roblox UserId").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false)),
].map(cmd => cmd.toJSON());

// Register commands
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
(async () => {
    try {
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log("Slash commands registered!");
    } catch (err) { console.error(err); }
})();

// --- Discord client ---
const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Handle slash commands
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Check admin permission
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ content: "You must be an Administrator to use this command.", ephemeral: true });
        return;
    }

    const command = interaction.commandName;
    const userId = interaction.options.getInteger("userid");
    const reason = interaction.options.getString("reason") || "No reason";

    if (command === "kick" || command === "ban") {
        queue.push({ action: command, userId, reason });
        await interaction.reply(`Command sent: ${command} ${userId} (${reason})`);
    }
});

// --- Express endpoint for Roblox ---
const app = express();
app.use(express.json());

app.get("/pop", (req, res) => {
    res.json(queue.shift() || {});
});

app.listen(3000, () => console.log("API running on port 3000"));

// Login Discord
client.login(BOT_TOKEN);
