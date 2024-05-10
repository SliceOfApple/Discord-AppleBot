require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Collection, Events, GatewayIntentBits, REST, Routes } = require('discord.js');

const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates ] });

client.commands = new Collection();

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);

		// Set a new item in the Collection with the key as the command name and the value as the exported module
		if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// const eventsPath = path.join(__dirname, 'events');
// const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

// for (const file of eventFiles) {
// 	const filePath = path.join(eventsPath, file);
// 	const event = require(filePath);
// 	if (event.once) {
// 		client.once(event.name, (...args) => event.execute(...args));
// 	} else {
// 		client.on(event.name, (...args) => event.execute(...args));
// 	}
// }

client.on(Events.InteractionCreate, async interaction => {
	if (interaction.isChatInputCommand()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}
		try {
			await command.execute(interaction); // Runs the execute() function in the command file.
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
			} else {
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}
			//interaction.guild.name, interaction.guild.iconURL();	
		}
	}
	else if (interaction.isAutocomplete()) {
		const command = interaction.client.commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}
		try {
			await command.autocomplete(interaction);
		} catch (error) {
			console.error(error);
		}
	}
});

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(process.env.TOKEN);

// and deploy your commands!
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		// const data = await rest.put(
		// 	Routes.applicationGuildCommands(process.env.APPLICATION_ID, process.env.GUILD_ID),
		// 	{},
		// );
		const data = await rest.put(
			Routes.applicationCommands(process.env.APPLICATION_ID),
			{ body: commands },
		);
		
		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error(error);
	}
})();

client.once(Events.ClientReady, readyClient => {
	console.log(`Bot ready. Logged in as ${readyClient.user.tag}`);
});

client.login(process.env.TOKEN);