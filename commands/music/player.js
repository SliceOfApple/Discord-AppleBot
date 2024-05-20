const play = require('play-dl');

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, NoSubscriberBehavior, createAudioResource, getVoiceConnection, AudioPlayerStatus, VoiceConnectionStatus } = require('@discordjs/voice');

const guildSongListMap = new Map();
const ytUrlRegex = /(?:https?:\/\/)?(?:www\.)?youtu\.?be(?:\.com)?\/?.*(?:watch|embed)?(?:.*v=|v\/|\/)([\w\-_]+)\&?/;

function checkIfTitleTooLong(incomingString) {
    return (incomingString.length > 100) ? incomingString.slice(0, 96) + "..." : incomingString;
}

function hoursMinutesSecondsFormat(inputSeconds) {
    var hours = Math.floor(inputSeconds / 3600);
    var minutes = Math.floor(inputSeconds / 60 % 60);
    var seconds = Math.floor(inputSeconds % 60);

    return (hours > 0 ? hours + ":" : "") + minutes.toString().padStart(2, '0') + ":" + seconds.toString().padStart(2, '0');
}

const EMBED_PLAYER_EVENT = (title, author, video, sender) => 
    new EmbedBuilder()
        .setColor(0x4E0707)
        .setTitle(title)
        .setURL(video.URL)
        .setAuthor({ name: author.name, iconURL: author.iconURL, url: author.anchor })
        .setThumbnail(video.thumbnail)
        .addFields(
            { name: video.name, value: video.duration }
        )
        .setTimestamp()
        .setFooter({ text: 'Queued by ' + sender.name, iconURL: sender.iconURL })

const EMBED_QUEUE = (guild, firstVideoThumbnail, queue, sender) =>
    new EmbedBuilder()
        .setColor(0x4E0707)
        .setTitle('Queue')
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() })
        .setThumbnail(firstVideoThumbnail)
        .addFields(queue)
        .setTimestamp()
        .setFooter({ text: sender.name, iconURL: sender.iconURL });

module.exports = {
	data: new SlashCommandBuilder()
        // Pre-requisites
        .setDMPermission(false)

        // Command Description
        .setName('player')
		.setDescription('Commands for the audio player.')
        
        // Subcommands
        .addSubcommand(option =>
            option
                .setName('play')
                .setDescription('Streams audio from a YouTube video into a voice channel.')
                .addStringOption(stringOption =>
                    stringOption
                        .setName('query')
                        .setDescription('Title or URL of video.')
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(option =>
            option
                .setName('pause')
                .setDescription('Pauses the audio player.')
        )
        .addSubcommand(option =>
            option
                .setName('skip')
                .setDescription('Skips the current song.')
        )
        .addSubcommand(option => 
            option
                .setName('queue')
                .setDescription('Shows list of added tracks.')
        ),
        // Arguments
	async execute(interaction) {
        switch(interaction.options.getSubcommand()) {
            case 'play':
                if (!interaction.member.voice.channel) return await interaction.reply({ content: 'You must be in a voice channel to use this command!', ephemeral: true });

                const youtubeUrl = interaction.options.getString('query');

                if (!youtubeUrl) {
                    var connection = getVoiceConnection(interaction.guildId);

                    if (!connection) return await interaction.reply({ content: 'You need to enter a query and select a corresponding result!', ephemeral: true })
                    return await interaction.reply({ content: connection.state.subscription.player.unpause() ? 'Playback resumed.' : 'The bot is currently playing nothing!', ephemeral: true });
                }
                else if (youtubeUrl.endsWith('error')) {
                    return await interaction.reply({ content: `Supplied ${youtubeUrl.startsWith('video') ? 'Video' : 'Playlist'} URL invalid. Check your input.`, ephemeral: true })
                }

                // Prepare YouTube video data stream.
                let stream, yt_info, entry;
                try {
                    stream = await play.stream(youtubeUrl);
                    yt_info = (await play.video_info(youtubeUrl)).video_details;
                } catch (error) { return await interaction.reply({ content: 'Something went wrong processing your query. Please check your input!', ephemeral: true }); }

                if (!guildSongListMap.has(interaction.guildId)) {
                    entry = [yt_info];
                    guildSongListMap.set(interaction.guildId, entry);

                    // Prepare audio player.
                    const player = createAudioPlayer({
                        behaviors: {
                            noSubscriber: NoSubscriberBehavior.Play,
                        },
                    });

                    let resource;
                    resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
                    // Join voice channel and get ready for audio playback.
                    var connection = 
                        getVoiceConnection(interaction.guildId) || 
                        joinVoiceChannel({
                            channelId: interaction.member.voice.channel.id,
                            guildId: interaction.guildId,
                            adapterCreator: interaction.guild.voiceAdapterCreator,
                        });
                    resource.volume.setVolume(0.25); // Don't wanna ear rape everyone in the call
                    //player.play(resource);
                    connection.subscribe(player);

                    player.on(AudioPlayerStatus.Playing, async (oldState, newState) => {
                        yt_info = guildSongListMap.get(interaction.guildId)[0];
                        var embed_NowPlaying = 
                            EMBED_PLAYER_EVENT(
                                'Now Playing',
                                { name: yt_info.channel.name, iconURL: yt_info.channel.icons[0].url, anchor: yt_info.channel.url }, 
                                { name: yt_info.title, duration: '**[' + yt_info.durationRaw + ']**', URL: yt_info.url, thumbnail: yt_info.thumbnails[yt_info.thumbnails.length - 1].url },
                                { name: interaction.user.displayName, iconURL: interaction.user.avatarURL() }
                            )
                        if (entry.length > 1) await interaction.channel.send({ embeds: [embed_NowPlaying] })

                        console.log('Audio player is in the Playing state!');
                    });

                    player.on(AudioPlayerStatus.Idle, async (oldState, newState) => {
                        console.log('Audio player is idle');

                        // Remove old song and prep new one
                        var myGuildSongQueue = guildSongListMap.get(interaction.guildId);
                        myGuildSongQueue.shift();
                        guildSongListMap.set(interaction.guildId, myGuildSongQueue);

                        if (myGuildSongQueue.length < 1) return await interaction.channel.send('## The audio player has run out of songs. Add more to keep the party going!');

                        nextSong = myGuildSongQueue[0];
                        stream = await play.stream(nextSong.url);
                        yt_info = (await play.video_info(nextSong.url)).video_details;
                        resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
                        resource.volume.setVolume(0.25)
                        player.play(resource);
                        connection.subscribe(player);
                    });

                    connection.on(VoiceConnectionStatus.Ready, (oldState, newState) => {
                        console.log('Connection is in the Ready state!');

                        // Start playing the track only when the bot has joined and is ready.
                        player.play(resource);
                    });

                    // player.on(AudioPlayerStatus.Playing...)
                    // player.on(AudioPlayerStatus.Idle...)
                }
                else {
                    entry = guildSongListMap.get(interaction.guildId);
                    entry.push(yt_info);
                    guildSongListMap.set(interaction.guildId, entry);
                }

                await interaction.reply(
                    {
                        embeds: [EMBED_PLAYER_EVENT(
                            (entry.length > 1) ? 'Added to Queue' : 'Now Playing',
                            { name: yt_info.channel.name, iconURL: yt_info.channel.icons[0].url, anchor: yt_info.channel.url }, 
                            { name: yt_info.title, duration: '**[' + yt_info.durationRaw + ']**', URL: yt_info.url, thumbnail: yt_info.thumbnails[yt_info.thumbnails.length - 1].url },
                            { name: interaction.user.displayName, iconURL: interaction.user.avatarURL() }
                        )]
                    }
                );
                break;
            case 'pause':
                if (!interaction.member.voice.channel) return await interaction.reply({ content: 'You must be in a voice channel to use this command!', ephemeral: true });

                var connection = getVoiceConnection(interaction.guildId);
                connection.state.subscription.player.pause();
                await interaction.reply('## Playback paused.');
                break;
            case 'skip':
                if (!interaction.member.voice.channel) return await interaction.reply({ content: 'You must be in a voice channel to use this command!', ephemeral: true });

                var connection = getVoiceConnection(interaction.guildId);
                connection.state.subscription.player.stop();
                await interaction.reply('## Skipping...');
                break;
            case 'queue':
                const guildQueue = guildSongListMap.get(interaction.guild.id);
                
                if (!guildQueue || !guildQueue.length) return await interaction.reply({ content: 'There are no songs in queue. Add a few to get the party going!', ephemeral: true })
                else {
                    let playbackDuration = getVoiceConnection(interaction.guildId).state.subscription.player.state.playbackDuration / 1000;
                    let queue = guildQueue.map((video, index) => (
                        {
                            name: index === 0 ? "Now Playing" : (index === 1 ? "Up Next" : (index - 1 + '. ' + video.title)), 
                            value: index < 2 ? video.title : '\u200b',
                            inline: index === 0
                        }
                    ))
                    let playedToTotalRatio = Math.floor(playbackDuration / guildQueue[0].durationInSec * 8);

                    // Insert progress bar after first entry (currently playing song) on the same line.
                    queue.splice(1, 0, { 
                        name: `${hoursMinutesSecondsFormat(playbackDuration)}/${hoursMinutesSecondsFormat(guildQueue[0].durationInSec)}`, 
                        value:  '`[' + '◼'.repeat(playedToTotalRatio) + '️◻'.repeat(8 - playedToTotalRatio) + ']`',
                        inline: true
                    });

                    await interaction.reply(
                        { 
                            embeds: [EMBED_QUEUE(
                                interaction.guild,
                                guildQueue[0].thumbnails[guildQueue.length - 1].url,
                                queue,
                                { name: interaction.user.displayName, iconURL: interaction.user.avatarURL() }
                            )] 
                        }
                    )
                }
                break;
        }
	},
    async autocomplete(interaction) {
        // Handle user's input string
        const focusedOption = interaction.options.get('query');

        // if (focusedOption.name === 'query') {
            if (focusedOption.value === '') return await interaction.respond([]); // Return empty list for a blank query.

            if (ytUrlRegex.test(focusedOption.value)) { // Is a valid YouTube URL, be it a video or playlist link.
                if (focusedOption.value.includes('watch')) {
                    let video_info;
                    try {
                        video_info = await play.video_info(focusedOption.value);
                    } catch (error) {
                        await interaction.respond([{ name: 'Video not found.', value: 'video_url_error' }]);
                    }
                    await interaction.respond([{ name: checkIfTitleTooLong(`[${video_info.video_details.channel.name}] • ` + video_info.video_details.title), value: focusedOption.value }]);
                }
                else {
                    let playlist_info;
                    try {
                        playlist_info = await play.playlist_info(focusedOption.value);
                        console.log(playlist_info);
                    } catch (error) {
                        await interaction.respond([{ name: 'Playlist not found.', value: 'playlist_url_error' }]);
                    }
                    await interaction.respond([{ name: '[Playlist] "' + playlist_info.title + '" containing ' + playlist_info.videoCount + ((playlist_info.videoCount > 1) ? ' videos.' : ' video.'), value: focusedOption.value }]);
                }
                // If the video or playlist URL is not valid, automatically return an error to show the user. No need to do anything here :)
                
                // (await play.playlist_info(focusedOption.value))

                // await interaction.respond([{ name: checkIfTitleTooLong(`[${query_info.video_details.channel.name}] • ` + query_info.video_details.title), value: focusedOption.value }]);
            }
            else {
                let ytVideoSearchList = await play.search(focusedOption.value, { limit: 25 });

                await interaction.respond(
                    ytVideoSearchList.map(ytVideo => ({ name: checkIfTitleTooLong(`[${ytVideo.channel.name}] • ` + ytVideo.title), value: ytVideo.url })),
                );
            }
        // }
    }
};