require("dotenv").config();
const { SlashCommandBuilder, REST, Routes } = require("discord.js");
const commands = [
    new SlashCommandBuilder()
    .setName("badger-den")
    .setDescription("Open the Badger Den")
    .toJSON(),
     new SlashCommandBuilder()
    .setName("blackjack")
    .setDescription("Play a game of blackjack against the bot")
    .toJSON(),
    new SlashCommandBuilder()
    .setName("poker")
    .setDescription("Play a game of poker against the bot")
    .toJSON(),
];
const rest = new REST({version:"10"}).setToken(process.env.TOKEN);
(async () =>{
    try{
        await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),{body: commands }
        );
        console.log("Command registered");
        } catch(error){
                console.error(error);
            }
        
})();