const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice')

module.exports = {
	data: new SlashCommandBuilder()
        // Pre-requisites
        .setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)

        // Command Description
        .setName('vc')
		.setDescription('Voice-channel moderating commands')
        
        // Action type
        .addSubcommand(subcommand => 
            subcommand
                .setName('join')
                .setDescription('Commands bot to join the specified voice channel, or the voice channel you are connected to.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Which voice channel the bot will join. Leave blank to default to your current voice channel.')
                        .addChannelTypes(ChannelType.GuildVoice)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Commands bot to disconnect from connected voice channel, if applicable.')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('transferall')
                .setDescription('Transfer all people from a voice channel to another.')

                // Channel arguments
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
                )
        ),
	async execute(interaction) {
        switch (interaction.options.getSubcommand()) { // Check specified action type
            case 'join':
                const targetVC = interaction.options.getChannel('channel') || interaction.member.voice.channel;
                if (!targetVC) return await interaction.reply({ content: 'You are not in a voice channel. If you want the bot to join a channel, specify its name in the first argument.', ephemeral: true });
        
                joinVoiceChannel({
                    channelId: targetVC.id,
                    guildId: targetVC.guild.id,
                    adapterCreator: targetVC.guild.voiceAdapterCreator,
                });

                await interaction.reply({ content: `Joined <#${targetVC.id}>.`, ephemeral: true });
                break;
            case 'leave':
                const connection = getVoiceConnection(interaction.guildId);
                connection.disconnect();
                connection.destroy();

                await interaction.reply({ content: `Disconnected.`, ephemeral: true });
                break;
            case 'transferall':
                const oldVC = interaction.options.getChannel('from');
                const newVC = interaction.options.getChannel('to');
        
                if (!oldVC || !newVC) return await interaction.reply({ content: 'At least one argument was invalid. Verify your input.', ephemeral: true }); // Specified source and/or target VC was somehow null.
                if (oldVC.id === newVC.id) return await interaction.reply({ content: 'Specified channels must be different.', ephemeral: true }); 
        
                let memberMoveCount = 0;
        
                for([_/** discard var snowflake */, member] of oldVC.members) {
                    if (member.id === "445862880131285004") await interaction.channel.send(`Jesus <@445862880131285004>, you a fat nigga. I cant move you!`);
                    else await member.voice.setChannel(newVC);
                    memberMoveCount++;
                }
                //console.log(oldVC.members);
        
                await interaction.reply({ content: `Finished! ${memberMoveCount} member(s) moved.`, ephemeral: true });
                break;
        }
	},
};