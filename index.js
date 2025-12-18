const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const express = require("express");

const BOT_TOKEN = "MTQ1MTAyNTk2NDc2NjMzNTA1Nw.GZzbBN.4r_D7EShf7F3byoFyvW2uCkbL6KF9dOfnD2yYk";

const app = express();
app.use(express.json());

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent
	]
});

const queue = [];

// Discord commands
client.on("messageCreate", message => {
	if (!message.content.startsWith("!")) return;
	if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

	const args = message.content.slice(1).split(" ");
	const cmd = args.shift();

	if (cmd === "kick") {
		const userId = Number(args.shift());
		const reason = args.join(" ") || "No reason";

		if (!userId) {
			message.reply("Invalid UserId.");
			return;
		}

		queue.push({
			action: "kick",
			userId: userId,
			reason: reason
		});

		message.reply("Kick command sent to Roblox.");
	}
});

// Roblox polls here
app.get("/pop", (req, res) => {
	res.json(queue.shift() || {});
});

// Start everything
client.once("ready", () => {
	console.log(`Logged in as ${client.user.tag}`);
});

client.login(BOT_TOKEN);

app.listen(3000, () => {
	console.log("API running on port 3000");
});
