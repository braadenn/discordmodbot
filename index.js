const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionType } = require("discord.js");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const queue = []; // Commands for Roblox

// --- Define slash commands ---
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
        .addStringOption(opt => opt.setName("reason").setDescription("Reason").setRequired(false))
].map(cmd => cmd.toJSON());

// --- Register slash commands ---
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
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => console.log(`Logged in as ${client.user.tag}`));

// --- Handle slash commands ---
client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ content: "You must be an Administrator to use this command.", ephemeral: true });
        return;
    }

    const command = interaction.commandName;
    const userId = interaction.options.getInteger("userid");
    const reason = interaction.options.getString("reason") || "No reason";

    // --- Embed: processing ---
    const processingEmbed = new EmbedBuilder()
        .setTitle("Moderation Request")
        .setDescription("Your request is being processed...")
        .setColor(0xFFFF00);

    await interaction.reply({ embeds: [processingEmbed], ephemeral: true });

    // --- Build confirmation embed ---
    const confirmEmbed = new EmbedBuilder()
        .setTitle(`Confirm ${command.toUpperCase()} Action`)
        .setDescription(`Do you want to ${command} this player?`)
        .addFields(
            { name: "Target Roblox UserId", value: `${userId}`, inline: true },
            { name: "Reason", value: reason, inline: true },
            { name: "Place", value: `${interaction.guild.name}`, inline: true }
        )
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
        .setColor(0xFF0000);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId("accept")
                .setLabel("Accept")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId("cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Danger)
        );

    // --- Send confirmation to same channel ---
    const msg = await interaction.channel.send({ embeds: [confirmEmbed], components: [row] });

    // --- Button collector ---
    const collector = msg.createMessageComponentCollector({ componentType: "BUTTON", time: 60000 });

    collector.on("collect", async btnInteraction => {
        if (btnInteraction.user.id !== interaction.user.id) {
            await btnInteraction.reply({ content: "You cannot interact with this button.", ephemeral: true });
            return;
        }

        if (btnInteraction.customId === "accept") {
            queue.push({ action: command, userId, reason });
            await btnInteraction.update({ content: `✅ ${command} command confirmed for user ${userId}`, embeds: [], components: [] });
        } else if (btnInteraction.customId === "cancel") {
            await btnInteraction.update({ content: `❌ ${command} command canceled`, embeds: [], components: [] });
        }
        collector.stop();
    });

    collector.on("end", collected => {
        if (collected.size === 0) {
            msg.edit({ content: "⏰ Confirmation timed out.", embeds: [], components: [] });
        }
    });
});

// --- Express endpoint for Roblox ---
const app = express();
app.use(express.json());
app.get("/pop", (req, res) => res.json(queue.shift() || {}));
app.listen(3000, () => console.log("API running on port 3000"));

// --- Login Discord ---
client.login(BOT_TOKEN);
