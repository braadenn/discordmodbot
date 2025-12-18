const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const express = require("express");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const queue = []; // Roblox commands

// --- Slash commands ---
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

// --- Register commands ---
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => console.log(`Logged in as ${client.user.tag}`));

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    // Admin-only
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
        await interaction.reply({ content: "You must be an Administrator.", flags: 64 });
        return;
    }

    const command = interaction.commandName;
    const userId = interaction.options.getInteger("userid");
    const reason = interaction.options.getString("reason") || "No reason";

    // --- Ephemeral processing message ---
    const processingEmbed = new EmbedBuilder()
        .setTitle("Moderation Request")
        .setDescription("Your request is being processed...")
        .setColor(0xFFFF00);

    await interaction.reply({ embeds: [processingEmbed], flags: 64 });

    // --- Confirmation embed with Accept/Cancel buttons ---
    const confirmEmbed = new EmbedBuilder()
        .setTitle(`Confirm ${command.toUpperCase()} Action`)
        .setDescription(`Do you want to ${command} this player?`)
        .addFields(
            { name: "Target Roblox UserId", value: `${userId}`, inline: true },
            { name: "Reason", value: reason, inline: true },
            { name: "Place", value: interaction.guild.name, inline: true }
        )
        .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
        .setColor(0xFF0000);

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("accept").setLabel("Accept").setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId("cancel").setLabel("Cancel").setStyle(ButtonStyle.Danger)
        );

    // Edit the ephemeral reply to show confirmation
    await interaction.editReply({ embeds: [confirmEmbed], components: [row], flags: 64 });

    // Collector for ephemeral buttons
    const filter = i => i.user.id === interaction.user.id;
    const collector = interaction.channel.createMessageComponentCollector({ filter, componentType: "BUTTON", time: 60000 });

    collector.on("collect", async btnInteraction => {
        if (btnInteraction.customId === "accept") {
            // Push command to Roblox queue
            queue.push({ action: command, userId, reason });

            // Edit ephemeral message
            await btnInteraction.update({ content: `✅ ${command} confirmed for user ${userId}`, embeds: [], components: [], flags: 64 });

            // Send non-ephemeral confirmation embed
            const completedEmbed = new EmbedBuilder()
                .setTitle(`${command.toUpperCase()} Completed`)
                .setDescription(`The ${command} command was successfully executed.`)
                .addFields(
                    { name: "Target Roblox UserId", value: `${userId}`, inline: true },
                    { name: "Reason", value: reason, inline: true },
                    { name: "Moderator", value: `${interaction.user.tag}`, inline: true },
                    { name: "Place", value: interaction.guild.name, inline: true }
                )
                .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`)
                .setColor(command === "ban" ? 0xFF0000 : 0xFFA500);

            await interaction.channel.send({ embeds: [completedEmbed] });

        } else if (btnInteraction.customId === "cancel") {
            await btnInteraction.update({ content: `❌ ${command} canceled`, embeds: [], components: [], flags: 64 });
        }
        collector.stop();
    });

    collector.on("end", collected => {
        if (collected.size === 0) {
            interaction.editReply({ content: "⏰ Confirmation timed out.", embeds: [], components: [], flags: 64 });
        }
    });
});

// --- Express endpoint for Roblox ---
const app = express();
app.use(express.json());
app.get("/pop", (req, res) => res.json(queue.shift() || {}));
app.listen(3000, () => console.log("API running on port 3000"));

client.login(BOT_TOKEN);
