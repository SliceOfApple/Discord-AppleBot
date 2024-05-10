const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        .setDMPermission(false)
		.setName('nword')
		.setDescription('Checks if a person is an n-word.')
		
		.addUserOption(option => option
			.setName('user')
			.setDescription('Mention a user you want to check.')
		),
	async execute(interaction) {
		const user = interaction.options.getUser('user') || interaction.user;

		await interaction.reply(`<@${user.id}> is ` + 
			(Math.floor(Math.random() * 2) == 1 ? 'a nigger!' : 'not a nigger.'));
	},
};