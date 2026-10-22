// type !testwelcome to test bot functionality
const event = {
  // checks every message made in discord server general chat(general is specfied in .env file)
  name: "messageCreate",
  async execute(message, client) {
    if (message.author.bot) return; // prevent infinite loop 
    if (message.content.trim() === "!testwelcome") client.emit("guildMemberAdd", message.member);
  },
};

export default event;