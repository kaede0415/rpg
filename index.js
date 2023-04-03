const http = require('http')
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton, MessageAttachment } = require("discord.js");
const { Pagination } = require("discordjs-button-embed-pagination");
const moment = require('moment');
const Keyv = require('keyv');
const util = require('util');
const fs = require('fs');
const cron = require('node-cron');
const player_status = new Keyv(`sqlite://player_data.sqlite`, { table: "status" });
const player_items = new Keyv(`sqlite://player_data.sqlite`, { table: "item" });
const monster_status = new Keyv(`sqlite://monster_data.sqlite`, { table: "status" });
const channel_status = new Keyv(`sqlite://channel_data.sqlite`, { table: "channel" });
const lists = new Keyv(`sqlite://db.sqlite`, { table: "list" });
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
String.prototype.format = function(){
  let formatted = this;
  for(let arg in arguments){
    formatted = formatted.replace("{" + arg + "}", arguments[arg]);
  }
  return formatted;
};
const prefix = "_"
const cmd_list = ["help","status","st","attack","atk","item","i","in","reset","re","rs","inquiry","inq","weapon","we","talent","ranking","rank","training","t","mine","gatya","gacha","xgatya","xgacha","craft","c","changemode","cm","wallet","summon","ban","unban","banlist","kill","itemid","ii","materialid","mi","weaponid","wi","toolid","ti","proofid","pi","consumeitem","ci","consumematerial","cma","consumeweapon","cw","consumetool","ct","consumeproof","cp","register_info","ri","exp","eval","db","bulkdb"]
const command_json = require("./jsons/command.json")
const item_json = require("./items/item.json")
const material_json = require("./items/material.json")
const weapon_json = require("./items/weapon.json")
const tool_json = require("./items/tool.json")
const proof_json = require("./items/proof.json")
const training_json = require("./jsons/training.json")
const admin_list = ["945460382733058109","759001587422462015","879573587063898192"];
const mine_cooldown = []
let timeout;
let time;
process.env.TZ = 'Asia/Tokyo'
const {FUNC} = require("./functions")
const func = new FUNC()
//const dbFiles = fs.readdirSync('./').filter(file => file.endsWith('.sqlite'));

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
  client.channels.cache.forEach(ch => {
    if(ch.name == "きふぉう"){
      ch.send({ embeds:[embed] })
    }
  })
});

cron.schedule('0 0 0 * * *', async () => {
  const list = await lists.get(client.user.id)
  const login_list = list[0]
  list.splice(0,1,[])
  await lists.set(client.user.id,list)
  console.log("ログイン情報をリセットしました。")
});

client.on("messageCreate", async message => {
  const arg = message.content.slice(prefix.length).split(/ +/);
  const command = arg.shift().toLowerCase();
  if(message.author.bot || message.channel.type == "DM" || !message.content.startsWith(prefix)){
    return;
  }
  if(message.content.startsWith(prefix) && cmd_list.includes(command)){
    const p_status = await player_status.get(message.author.id)
    const list = await lists.get(client.user.id)
    const login_list = list[0]
    const ban_list = list[1]
    if(!p_status){
      await func.create_data("player",message.author.id)
      return message.reply({ content:"お初さんいらっしゃい^^\n※これは初めてコマンドを打った人用のメッセージです" })
    }
    if(ban_list.includes(message.author.id) && !admin_list.includes(message.author.id) && !["help","wallet"].includes(command)){
      return message.reply({ content: "BANされてますよ...?", allowedMentions: { parse: [] } })
    }else if(p_status[6] == true){
      return message.reply({ content: "質問に答えてください。", allowedMentions: { parse: [] } })
    }
    if(!login_list.includes(message.author.id)){
      const day = await func.get_proof_quantity(message.author.id,0)+1
      const elength = day+29
      const flength = day*3+52
      const plength = day*3+42
      const tlength = day+10
      const embed = new MessageEmbed()
      .setDescription(`>>> **ログイン${day}日目です。\nログボをゲットしました！！！**\`\`\`ゲットした物:\n   冒険の証:1個\n   エリクサー:${elength}個\n   ファイアボールの書:${flength}個\n   祈りの書:${plength}個\n   100円硬貨:${tlength}個\`\`\``)
      .setThumbnail(client.user.displayAvatarURL())
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
      await func.obtain_proof("0",1,message.author.id)
      await func.obtain_item("1",elength,message.author.id)
      await func.obtain_item("2",flength,message.author.id)
      await func.obtain_item("3",plength,message.author.id)
      await func.obtain_item("100000",tlength,message.author.id)
      login_list.push(message.author.id)
      await lists.set(client.user.id,list)
    }
    for await(const [key, value] of player_status.iterator()){
      if(client.users.cache.get(key) == undefined){
        await func.delete_data("player",key)
      }
    }
    await func.generate_detection(message.author.id,message)
  }
  try{
    if(["help"].includes(command)){
      const args = message.content.split(" ")[1]
      if(args){
        if(cmd_list.includes(args.toLowerCase())){
          const num = cmd_list.indexOf(args.toLowerCase())
          const embed = new MessageEmbed()
          .setTitle(`HELP of \`${command_json[num][0]}\``)
          .addField("= コマンドの説明 =",`${command_json[num][1]}`)
          .addField("= エイリアス =",`${command_json[num][2]}`)
          .addField("= 使用例 =",`${command_json[num][3]}`)
          .addField("= 使用可能 =",`${command_json[num][4]}`)
          .setColor("RANDOM")
          return message.reply({ embeds: [embed], allowedMentions: { parse: [] } })
        }else{
          return message.reply(`Command[\`${args.toLowerCase()}\`] not found.`)
        } 
      }
      const embeds = [
        new MessageEmbed()
        .setTitle("HELP:")
        .setDescription(`このbotは${client.users.cache.get(admin_list[0]).tag}が自己満で作ったげーむぼっとです。`)
        .addField("= 注意 =", "浅はかすぎる知識でテンプレもなしに作っているのでバグが多発します。\nもし発見した際は開発者までdmください。")
        .addField("= 管理者ズ =", `${admin_list.map(x => eval('client.users.cache.get("' + x + '").tag'))}`)
        .setAuthor(`コマンド実行者:${message.author.tag}`, message.author.displayAvatarURL())
        .setColor("RANDOM"),
        new MessageEmbed()
        .setTitle("HELP:")
        .setDescription("全員使用可能なコマンド")
        .addField(`= ${prefix}help ([cmd]) =`,">>> この画面",true)
        .addField(`= ${prefix}status ([id]) | ${prefix}st ([id]) =`,">>> ステータス表示",true)
        .addField(`= ${prefix}attack | ${prefix}atk =`,">>> 敵に攻撃",true)
        .addField(`= ${prefix}item ([item名]) | ${prefix}i ([item名]) =`,">>> アイテムリスト/アイテムを使用",true)
        .addField(`= ${prefix}training | ${prefix}t =`,">>> 四字熟語トレーニング",true)
        .addField(`= ${prefix}ranking | ${prefix}rank =`,">>> 各種ランキング",true)
        .addField(`= ${prefix}in =`,">>> 戦闘に参加",true)
        .addField(`= ${prefix}reset | ${prefix}re =`,">>> 戦闘をリセット",true)
        .addField(`= ${prefix}inquiry | ${prefix}inq =`,">>> 戦闘状況の確認",true)
        //.addField(`= ${prefix}dungeon | ${prefix}dung =`,">>> ダンジョン",true)
        //.addField(`= ${prefix}retire =`,">>> ダンジョンからリタイア",true)
        .addField(`= ${prefix}talent =`,">>> タレント",true)
        .addField(`= ${prefix}monstergen [rarelity] =`,">>> モンスターを生成",true)
        //.addField(`= ${prefix}inbox ([gift名]) =`,">>> 受信箱/ギフト受け取り",true)
        //.addField(`= ${prefix}word =`,">>> 特別コードの入力",true)
        .addField(`= ${prefix}mine =`,">>> 採掘(特に意味はない)",true)
        .addField(`= ${prefix}gatya [回数] =`,">>> ガチャる",true)
        .setAuthor(`コマンド実行者:${message.author.tag}`, message.author.displayAvatarURL())
        .setColor("RANDOM"),
        new MessageEmbed()
        .setTitle("HELP:")
        .setDescription("管理者のみ使用可能なコマンド")
        .addField(`= ${prefix}itemid [itemid] [個数] [@メンション/id] =`,">>> アイテム付与",true)
        .addField(`= ${prefix}consumeitem [itemid] [個数] [@メンション/id] =`,">>> アイテム剥奪",true)
        .addField(`= ${prefix}materialid [materialid] [個数] [@メンション/id] =`,">>> 素材付与",true)
        .addField(`= ${prefix}consumematerial [materialid] [個数] [@メンション/id] =`,">>> 素材剥奪",true)
        .addField(`= ${prefix}summon [rank] [id] [level] =`,">>> モンスターを召喚",true)
        .addField(`= ${prefix}kill [count] =`,">>> 指定した数字の敵を殺害",true)
        .addField(`= ${prefix}ban [id/@mention] =`,">>> id指定または全員をBAN",true)
        .addField(`= ${prefix}unban [id/@mention] =`,">>> id指定または全員をUNBAN",true)
        .addField(`= ${prefix}banlist =`,">>> BAN者のリストを表示",true)
        .addField(`= ${prefix}eval [code] =`,">>> 記述したコードを実行",true)
        .addField(`= ${prefix}db [code] =`,">>> 記述したコードを実行(非同期処理)",true)
        //.addField(`= ${prefix}delete [code] =`,">>> Dataを削除",true)
        //.addField(`= ${prefix}test =`,">>> 登録されている敵の情報",true)
        //.addField(`= ${prefix}file [ファイル名] =`,">>> 指定したファイルを表示",true)
        //.addField(`= ${prefix}backup =`,">>> db出力",true)
        .setAuthor(`コマンド実行者:${message.author.tag}`, message.author.displayAvatarURL())
        .setColor("RANDOM")
      ]
      await new Pagination(message.channel, embeds, "page").paginate();
    }
    if(["status","st"].includes(command)){
      let id = message.content.split(" ")[1]
      if(!id) id = message.author.id
      else if(message.mentions.members.size != 0) id = message.mentions.members.first().id
      const error_msg = func.admin_or_player(message.author.id)
      if(!await player_status.get(id) || !client.users.cache.get(id)) return message.reply({ content: "そのプレイヤーは登録または認識されていません", allowedMentions: { parse: [] } })
      else if(id != message.author.id && error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const status = await player_status.get(id)
      const player = client.users.cache.get(id)
      const embed = new MessageEmbed()
      .setTitle(`${player.username}のステータス:`)
      .setColor("RANDOM")
      .setThumbnail(player.displayAvatarURL())
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
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["attack","atk"].includes(command)){
      await func._attack(message.author.id,message.channel.id,message)
    }
    if(["item","i"].includes(command)){
      const item_name = message.content.split(" ")[1]
      await func._item(message.channel.id,item_name,message.mentions.members.first(),message)
    }
    if(["in"].includes(command)){
      const intobattle = await func.into_battle(message.author.id,message.channel.id)
      const error_message = intobattle[1]
      if(error_message != ""){
        return message.reply({ content:error_message, allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setDescription(`<@${message.author.id}>は<#${message.channel.id}>の戦闘に参加した！`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["training","t"].includes(command)){
      await func.training(message.author.id,message)
    }
    if(["reset","re","rs"].includes(command)){
      const reset = await func.reset_battle(message.channel.id,0)
      if(reset == "このchで戦闘は行われていませんよ...？"){
        return message.reply({ content: "このchで戦闘は行われていませんよ...？", allowedMentions: { parse: [] } })
      }
      const m_info = await monster_status.get(message.channel.id)
      const embed = new MessageEmbed()
      .setTitle(`ランク:${m_info[3]}\n${m_info[2]}が待ち構えている...！\nLv.${m_info[0].toLocaleString()} HP:${m_info[1].toLocaleString()}`)
      .setImage(m_info[4])
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["inquiry","inq"].includes(command)){
      await func.inquiry(message.channel.id,message)
    }
    if(["gatya","gacha"].includes(command)){
      let time = message.content.slice(prefix.length+6).trim()
      if(!time){
        return message.reply({ content: "回数を入力してください" })
      }else if(time != "max" && !Number.isInteger(Number(time)) || Number(time) <= 0){
        return message.reply({ content: "引数が不正です" })
      }else if(time == "max"){
        time = Number(await func.get_item_quantity(message.author.id,100000))
      }else if(time == 0){
        return message.reply({ content: "がちゃちけないやん" })
      }else{
        time = Number(time)
      }
      if(await func.get_item_quantity(message.author.id,100000) < time){
        return message.reply({ content: "がちゃちけがたりん！" })
      }
      message.reply({ content: "```diff\n+ ガチャを引き終わるまでしばらくお待ち下さい```" })
      await func.consume_item("100000",time,message.author.id)
      const result = func.gatya("normal",time)
      const msgs = []
      for(let i=0;i<result.length;i++){
        if(result[i][2] == "item"){
          await func.obtain_item(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "material"){
          await func.obtain_material(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "weapon"){
          await func.obtain_weapon(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "tool"){
          await func.obtain_tool(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "proof"){
          await func.obtain_proof(result[i][3],result[i][4],message.author.id)
        }
        msgs.push(`\`\`\`${result[i][0]}${result[i][1]}\`\`\`->${result[i][4]}個`)
      }
      const embed = new MessageEmbed()
      .setTitle(`ガチャ結果${time}枚`)
      .setDescription(msgs.join("\n"))
      message.channel.send({ embeds:[embed] })
    }
    if(["xgatya","xgacha"].includes(command)){
      let time = message.content.slice(prefix.length+7).trim()
      if(!time){
        return message.reply({ content: "回数を入力してください" })
      }else if(time != "max" && !Number.isInteger(Number(time)) || Number(time) <= 0){
        return message.reply({ content: "引数が不正です" })
      }else if(time == "max"){
        time = Number(await func.get_item_quantity(message.author.id,100001))
      }else if(time == 0){
        return message.reply({ content: "がちゃちけないやん" })
      }else{
        time = Number(time)
      }
      if(await func.get_item_quantity(message.author.id,100001) < time){
        return message.reply({ content: "がちゃちけがたりん！" })
      }
      message.reply({ content: "```diff\n+ ガチャを引き終わるまでしばらくお待ち下さい```" })
      await func.consume_item("100001",time,message.author.id)
      const result = func.gatya("rare",time)
      const msgs = []
      for(let i=0;i<result.length;i++){
        if(result[i][2] == "item"){
          await func.obtain_item(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "material"){
          await func.obtain_material(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "weapon"){
          await func.obtain_weapon(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "tool"){
          await func.obtain_tool(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "proof"){
          await func.obtain_proof(result[i][3],result[i][4],message.author.id)
        }
        msgs.push(`\`\`\`${result[i][0]}${result[i][1]}\`\`\`->${result[i][4]}個`)
      }
      const embed = new MessageEmbed()
      .setTitle(`ガチャ結果${time}枚`)
      .setDescription(msgs.join("\n"))
      message.channel.send({ embeds:[embed] })
    }
    if(["weapon","we"].includes(command)){
      await func.weapon(message.author.id,message)
    }
    if(["changemode","cm"].includes(command)){
      const role = func.admin_or_player(message.author.id)
      const mode = await func.get_mode(message.channel.id)
      if(role == "admin"){
        const embed1 = new MessageEmbed()
        .setTitle(`変えたいモードを選択してください(現在のモード:${mode})`)
        .setDescription("1⃣:通常\n2⃣:非表示\n3⃣:デバッグ")
        .setColor("RANDOM")
        const embed2 = new MessageEmbed()
        .setColor("RANDOM")
        const msg = await message.reply({ embeds:[embed1], allowedMentions: { parse: [] } })
        const filter = m => m.author.id == message.author.id;
        const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
        collector.on('collect', async m => {
          m.delete();
          if(!Number.isInteger(Number(m.content)) || 0 > Number(m.content) || Number(m.content) > 3){
          }else if(m.content == "1"){
            embed2.setDescription("チャンネルのモードを通常に変更しました")
            msg.edit({ embeds:[embed2], allowedMentions: { parse: [] } })
            collector.stop();
            await func.change_mode(message.channel.id,"normal")
          }else if(m.content == "2"){
            embed2.setDescription("チャンネルのモードを非表示に変更しました")
            msg.edit({ embeds:[embed2], allowedMentions: { parse: [] } })
            collector.stop();
            await func.change_mode(message.channel.id,"hihyozi")
          }else if(m.content == "3"){
            embed2.setDescription("チャンネルのモードをデバッグに変更しました")
            msg.edit({ embeds:[embed2], allowedMentions: { parse: [] } })
            collector.stop();
            await func.change_mode(message.channel.id,"debug")
          }else if(m.content == "0"){
            msg.edit({ content:"```処理を終了しました...```" });
            collector.stop();
          }
        });
        collector.on('end', async (collected, reason) => {
          if(reason == "idle"){
            msg.edit({ content:"```時間切れです...```" });
          }
        })
      }else{
        let comment
        if(mode == "normal"){
          await func.change_mode(message.channel.id,"hihyozi")
          comment = `<#${message.channel.id}>の敵画像表示を非表示に変更しました`
        }else if(mode == "hihyozi"){
          await func.change_mode(message.channel.id,"normal")
          comment = `<#${message.channel.id}>の敵画像表示を表示に変更しました`
        }else if(mode == "debug"){
          await func.change_mode(message.channel.id,"normal")
          comment = `<#${message.channel.id}>の敵画像表示を表示に変更しました`
        }
        const embed = new MessageEmbed()
        .setDescription(comment)
        .setColor("RANDOM")
        message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
      }
    }
    if(["mine"].includes(command)){
      const msg = await func.mine(message.author.id,message.channel.id)
      const embed = new MessageEmbed()
      .setColor("RANDOM")
      if(!Array.isArray(msg)){
        embed.setDescription(`そのコマンドは${msg}秒後に使えます`)
      }else{
        embed.setDescription(`\`\`\`css\n[採掘者:${message.author.username}]\`\`\`\`\`\`diff\n${msg.join("\n")}\`\`\``)
      }
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["craft","c"].includes(command)){
      await func.exchange(message.author.id,message)
    }
    if(["talent"].includes(command)){
      await func.talent(message.author.id,message)
    }
    if(["ranking","rank"].includes(command)){
      await func.ranking(message)
    }
    if(["wallet"].includes(command)){
      const list = await lists.get(client.user.id)
      const ban_list = list[1]
      const coin = await func.wallet(message.author.id)
      let ban
      if(ban_list.includes(message.author.id)){
         ban = "BAN"
      }else{
        ban = "OK"
      }
      const embed = new MessageEmbed()
      .setTitle("財布")
      .addField("BAN状態",`>>> {0}`.format(ban))
      .addField("無償通貨",`>>> ${coin[0]}コイン`)
      .addField("有償通貨",`>>> ${coin[1]}コイン`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["shop","s"].includes(command)){
      await func.shop(message.author.id,message)
    }
    if(["itemid","ii"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.obtain_item(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${func.get_item_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumeitem","ci"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.consume_item(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["materialid","mi"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.obtain_material(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${func.get_material_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumematerial","cma"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.consume_material(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["weaponid","wi"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.obtain_weapon(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${func.get_weapon_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumeweapon","cw"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.consume_weapon(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["toolid","ti"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.obtain_tool(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${func.get_tool_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumetool","ct"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.consume_tool(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["proofid","pi"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.obtain_proof(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${func.get_proof_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumeproof","cp"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const itemId = message.content.split(" ")[1]
      const quantity = message.content.split(" ")[2]
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[3]
      }
      if(await player_status.get(player) == undefined){
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await func.consume_proof(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["exp"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const player_id = message.content.split(" ")[1]
      const exp = Number(message.content.split(" ")[2])
      const levelup_msg = await func.experiment(player_id,exp)
      const embed = new MessageEmbed()
      .setDescription(`<@${player_id}>に${exp.toLocaleString()}EXPを付与しました\n${levelup_msg}`)
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["coin"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const option = message.content.split(" ")[1]
      const player_id = message.content.split(" ")[2]
      const coin = Number(message.content.split(" ")[3])
      let mes
      if(coin >= 0){
        await func.coinment(option,player_id,coin)
        mes = `<@${player_id}>に${coin.toLocaleString()}コイン(${option})を付与しました`
      }else{
        await func.consume_coin(option,player_id,Math.abs(coin))
        mes = `<@${player_id}>から${Math.abs(coin).toLocaleString()}コイン(${option})を剥奪しました`
      }
      const embed = new MessageEmbed()
      .setDescription(mes)
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["monstergen"].includes(command)){
      let rank = message.content.slice(prefix.length+11)
      const info = func.generate_monster(rank)
      const embed = new MessageEmbed()
      .setTitle(`ランク:${info[1]}\n${info[0]}が待ち構えている...！\nLv.0 HP:0`)
      .setImage(info[2])
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
    }
    if(["summon"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const rank = message.content.split(" ")[1]
      const id = Number(message.content.split(" ")[2])
      const level = Number(message.content.split(" ")[3])
      const hp = level*10+50
      const info = func.summon_monster(rank,id,level)
      if(info == undefined){
        return message.reply({ content: "undefined", allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setTitle(`ランク:${info[1]}\n${info[0]}が待ち構えている...！\nLv.${level.toLocaleString()} HP:${hp.toLocaleString()}`)
      .setColor("RANDOM")
      const mode = await func.get_channel_mode(message.channel.id)
      if(mode == "normal"){
        embed.setImage(info[2])
      }else if(mode == "debug"){
        const id = func.get_monster_id(info[1],info[0])
        embed.setImage(info[2])
        .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
      }
      message.channel.send({ embeds:[embed] })
      await monster_status.set(message.channel.id,[level,hp].concat(info))
    }
    if(["ban"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[1]
      }
      if(player == undefined){
        return message.reply({ content: "メンションは1人にしてください", allowedMentions: { parse: [] } })
      }
      if(await func.ban(player) == false){
        return message.reply({ content: "不正", allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setDescription(`${client.users.cache.get(player).tag}をBANしました`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["unban"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      let player;
      if(message.mentions.members.size == 1){
        player = message.mentions.members.first().id
      }else if(message.mentions.members.size >= 2){
        player = undefined
      }else{
        player = message.content.split(" ")[1]
      }
      if(player == undefined){
        return message.reply({ content: "メンションは1人にしてください", allowedMentions: { parse: [] } })
      }
      if(await func.unban(player) == false){
        return message.reply({ content: "不正", allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setDescription(`${client.users.cache.get(player).tag}をUNBANしました`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["banlist"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const list = await lists.get(client.user.id)
      const banlist = list[1]
      const desc = banlist.map(x => client.users.cache.get(x).tag+`/${x}`).join("\n")
      const embed = new MessageEmbed()
      .setTitle("BAN者一覧")
      .setColor("RANDOM")
      if(!banlist.length){
        embed
          .setDescription("なし")
      }else{
        embed
          .setDescription(desc)
      }
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["kill"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      let count = message.content.slice(prefix.length+5).trim()
      if(count == "" || !Number.isInteger(Number(count))){
        count = 1
      }else{
        count = Number(count)
      }
      await func.kill(count,message.author.id,message.channel.id,message)
    }
    if(["register_info","ri"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const monster = func.monster_count()
      const item = func.item_count()
      const embed = new MessageEmbed()
      .setTitle("各種登録情報")
      .addField("モンスター",`弱敵:${monster[0]}体\n通常:${monster[1]}体\n強敵:${monster[2]}体\n超強敵:${monster[3]}体\n極:${monster[4]}体\nレア:${monster[5]}体\n激レア:${monster[6]}体\n超激レア:${monster[7]}体\n幻:${monster[8]}体\n合計:${monster[9]}体`,true)
      .addField("所持品関連",`アイテム:${item[0]}種類\n素材:${item[1]}種類\n武器:${item[2]}種類\nツール:${item[3]}種類\n証:${item[4]}種類\n合計:${item[5]}種類`,true)
      .addField("コマンド数",`${cmd_list.length}`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["eval"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      var result = message.content.slice(prefix.length+5).trim();
      let evaled = eval(result);
      message.channel.send(evaled)
      message.react("✅")
    }
    if(["db"].includes(command)){
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      var result = message.content.slice(prefix.length+3).trim();
      let evaled = eval("(async () => {" + result + "})()");
      if(typeof evaled != "string"){
        evaled = util.inspect(evaled);
      }
      message.channel.send("Done.")
      message.react("✅")
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
