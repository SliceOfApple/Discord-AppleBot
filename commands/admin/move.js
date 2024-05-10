const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
        // Pre-requisites
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)

        // Command Description
        .setName('transferall')
		.setDescription('Transfer all people from a specified voice channel to a new one.')

        // Arguments
        .addChannelOption(option => option /** Source VC: Origin*/
            .setName('from')
            .setDescription('Voice channel to pull people from.')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        )
        .addChannelOption(option => option /** Target VC: Destination*/
            .setName('to')
            .setDescription('Voice channel to move people to.')
            .addChannelTypes(ChannelType.GuildVoice)
            .setRequired(true)
        ),
	async execute(interaction) {
        const sourceVC = interaction.options.getChannel('from');
        const targetVC = interaction.options.getChannel('to');

        if (!sourceVC || !targetVC) return await interaction.reply({ content: 'One or more of the arguments were invalid.', ephemeral: true }); // Specified source and/or target VC was somehow null.
        if (sourceVC.id == targetVC.id) return await interaction.reply({ content: 'Specified channels must be different.', ephemeral: true }); 

        let memberMoveCount = 0;

        for([_/** unneeded var snowflake */, member] of sourceVC.members) {
            if (member.id === "445862880131285004") await interaction.channel.send(`Jesus <@445862880131285004>, you a fat nigga. I cant move you!`);
            else await member.voice.setChannel(targetVC);
            memberMoveCount++;
        }
        //console.log(sourceVC.members);

		await interaction.reply({ content: `Finished! ${memberMoveCount} member(s) moved.`, ephemeral: true });
	},
};