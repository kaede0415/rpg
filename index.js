const http = require('http')
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { Pagination } = require("discordjs-button-embed-pagination");
const moment = require('moment');
const Keyv = require('keyv');
const player_status = new Keyv(`sqlite://player_data.sqlite`, { table: "status" });
const player_items = new Keyv(`sqlite://player_data.sqlite`, { table: "item" });
const enemy_status = new Keyv(`sqlite://enemy_data.sqlite`, { table: "status" });
const channel_status = new Keyv(`sqlite://channel_data.sqlite`, { table: "channel" });
const client = new Client({
  partials: ["CHANNEL"],
  intents: new Intents(32767),
  restTimeOffset: -1000
});
const newbutton = (buttondata) => {
  return {
    components: buttondata.map((data) => {
      return {
        custom_id: data.id,
        label: data.label,
        style: data.style || 1,
        url: data.url,
        emoji: data.emoji,
        disabled: data.disabled,
        type: 2,
      };
    }),
    type: 1,
  };
};
const prefix = "_"
const cmd_list = ["help","status","st"]
const json = require("./jsons/command.json")
const item_json = require("./jsons/item.json")
process.env.TZ = 'Asia/Tokyo'

http
  .createServer(function(request, response) {
    response.writeHead(200, { 'Content-Type': 'text/plain;charset=utf-8' })
    response.end(`${client.user.tag} is ready!\n導入サーバー:${client.guilds.cache.size}\nユーザー:${client.users.cache.size}`)
  })
  .listen(3000)

if (process.env.DISCORD_BOT_TOKEN == undefined) {
  console.error('tokenが設定されていません！')
  process.exit(0)
}

client.on('ready', async () => {
    client.user.setActivity(`${prefix}help`, {
      type: 'PLAYING'
    });
    client.user.setStatus("idle");
  console.log(`${client.user.tag} is ready!`);
  const embed = new MessageEmbed()
  .setTitle("起動しました！")
  .setDescription(">>> ```diff\n+ Hello World!　　　　　``````diff\n+ 導入サーバー数:" + client.guilds.cache.size + "\n+ ユーザー数:" + client.users.cache.size + "```" + moment().format("YYYY-MM-DD HH:mm:ss"))
  .setThumbnail(client.user.displayAvatarURL())
  .setColor("RANDOM")
  client.channels.cache.get("1072311355606048839").send({ embeds:[embed] })
});

client.on("messageCreate", async message => {
  const arg = message.content.slice(prefix.length).split(/ +/);
  const command = arg.shift().toLowerCase();
  if(message.author.bot || message.channel.type == "DM" || !message.content.startsWith(prefix)){
    return;
  }
  if(message.content.startsWith(prefix) && cmd_list.includes(command)){
    const p_status = await player_status.get(message.author.id)
    const p_items = await player_items.get(message.author.id)
    if(!p_status){
      await player_status.set(message.author.id,[100,550,10000,0,false,false])
    }
    if(!p_items){
      await player_items.set(message.author.id,[])
    }
  }
  try{
    if(command == "status" || command == "st"){
      const status = await player_status.get(message.author.id)
      const embed = new MessageEmbed()
      .setTitle(`${message.author.username}のステータス:`)
      .setThumbnail(message.author.displayAvatarURL())
      .addField("レベル",`${status[0].toLocaleString()}`,true)
      .addField("体力",`${(status[0]*5+50).toLocaleString()}`,true)
      .addField("攻撃力",`${(status[0]*2+10).toLocaleString()}`,true)
      .addField("経験値",`${status[2].toLocaleString()}`,true)
      .addField("次のレベルまで",`${((status[0]+1)**2-status[2]).toLocaleString()}`,true)
      .addField("討伐数",`${status[3].toLocaleString()}`,true)
      if(status[4] == false){
        embed.addField("戦闘状況",`戦闘していません`,true)
      }else{
        embed.addField("戦闘状況",`<#${status[4]}>で戦闘中`,true)
      }
      message.reply({ embeds:[embed] })
    }
    if(command == "item"){
      const p_items = await player_items.get(message.author.id)
      let content;
      const embed = new MessageEmbed()
      .setTitle(`${message.author.username}のアイテムリスト:`)
      if(!p_items.length){
        content = "なし"
      }
      p_items
      embed.setDescription(`>>> ${content}`)
      message.reply({ embeds:[embed] })
    }
  }catch(err){
    message.react("❓")
    const embed = new MessageEmbed()
    .setTitle("Error[ " + err.toString() + " ]")
    .setDescription(`M:${message.content}/${message.id}\nG:${message.guild.name}/${message.guild.id}\nC:${message.channel.name}/${message.channel.id}/<#${message.channel.id}>\nU:${message.author.username}/${message.author.id}/<@${message.author.id}>\n` + "```js\n" + err.stack + "```")
    .setColor("RANDOM")
    message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
});

client.login(process.env.DISCORD_BOT_TOKEN)
