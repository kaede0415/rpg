const http = require('http')
const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { Pagination } = require("discordjs-button-embed-pagination");
const moment = require('moment');
const Keyv = require('keyv');
const util = require('util');
const player_status = new Keyv(`sqlite://player_data.sqlite`, { table: "status" });
const player_items = new Keyv(`sqlite://player_data.sqlite`, { table: "item" });
const monster_status = new Keyv(`sqlite://monster_data.sqlite`, { table: "status" });
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
const cmd_list = ["help","status","st","attack","atk","item","i"]
const json = require("./jsons/command.json")
const item_json = require("./jsons/item.json")
const admin_list = ["945460382733058109"];
process.env.TZ = 'Asia/Tokyo'

async function create_data(option,id){
  if(option == "player"){
    await player_status.set(id,[100,550,10000,0,false])
    await player_items.set(id,[])
  }else if(option == "monster"){
    const info = generate_monster("random")
    const array = [1,60].concat(info)
    await monster_status.set(id,array)
  }else if(option == "channel"){
    await channel_status.set(id,[1,false,[]])
  }else{
    return false
  }
}

async function delete_data(option,id){
  if(option == "player"){
    await player_status.delete(id)
    await player_items.delete(id)
  }else if(option == "monster"){
    await monster_status.delete(id)
  }else if(option == "channel"){
    await channel_status.delete(id)
  }else{
    return false
  }
}

async function _attack(player_id,channel_id,message){
  const intobattle = await into_battle(player_id,channel_id)
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply(error_message)
  }
  const player_level = status[0]
  const monster_level = m_status[0]
  let monster_hp = m_status[1]
  const monster_name = m_status[2]
  const monster_rank = m_status[3]
  const monster_img = m_status[4]
  const player_name = client.users.cache.get(player_id).username
  const random = Math.random()
  const player_attack = get_player_attack(player_level,random)
  monster_hp -= player_attack
  const attack_message = get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,random)
  if(monster_hp <= 0){
    const win_message = await win_process(channel_id,monster_level)
    const embed = new MessageEmbed()
    .setTitle("戦闘結果:")
    .setDescription(`**${monster_name}を倒した！**\n>>> ${win_message[0]}`)
    .setColor("RANDOM")
    if(win_message[1] != ""){
      embed.addField("**レベルアップ:**",`>>> ${win_message[1]}`)
    }
    if(win_message[2] != ""){
      embed.addField("**アイテムを獲得:**",`>>> ${win_message[2]}`)
    }
    await reset_battle(channel_id,true)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level} HP:${m_hp}`)
    .setImage(m_img)
    .setColor("RANDOM")
    message.reply({ content:`\`\`\`diff\n${attack_message}\`\`\``, embeds:[embed,embed2] })
  }else{
    m_status.splice(1,1,monster_hp)
    await monster_status.set(channel_id,m_status)
    const monster_attack = get_monster_attack(monster_level)
    player_hp -= monster_attack
    if(monster_attack == 0){
    }else if(player_hp <= 0){
      status.splice(1,1,0)
      await player_status.set(player_id,status)
    }else{
      status.splice(1,1,player_hp)
      await player_status.set(player_id,status)
    }
    const monster_attack_message = monster_attack_process(player_name,player_level,player_hp,monster_name,monster_attack)
    message.channel.send(`\`\`\`diff\n${attack_message}\n\n${monster_attack_message}\`\`\``)
  }
}

async function _item(channel_id,item_name,mentions,message){
  if(item_name == undefined){
    const p_items = await player_items.get(message.author.id)
    const comparefunction = function(a,b){
      return a[0] - b[0]
    }
    p_items.sort(comparefunction)
    let content = "";
    const embed = new MessageEmbed()
    .setTitle(`${message.author.username}のアイテムリスト:`)
    .setColor("RANDOM")
    if(!p_items.length){
      content = "なし"
    }
    const time = p_items.length
    for(let i=0;i<time;i++){
      const item_name = get_item_name(p_items[i][0])
      const item_value = p_items[i][1]
      content += `**${item_name}：**\`${item_value.toLocaleString()}個\`\n`
    }
    embed.setDescription(`>>> ${content}`)
    message.reply({ embeds:[embed] })
  }else if(["ファイアボールの書","fire","f"].includes(item_name)){
    message.reply("ファイアボール！")
  }else if(["エリクサー","elixir","e"].includes(item_name)){
    message.reply("エリ草")
  }else if(["祈りの書","i"].includes(item_name)){
    message.reply("今から降るよ")
  }else{
    message.reply("Undefined_Item")
  }
}

async function fireball(player_id,channel_id,message){
  const intobattle = await into_battle(player_id,channel_id)
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply(error_message)
  }
  if(await consume_item(2,1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`<@${player_id}>はファイボールの書を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed] })
  }
  
}

function get_player_attack(player_attack,rand){
  if(rand < 0.01) return 0
  else if(rand > 0.96) return player_attack*(2) + 10
  else return Math.floor(player_attack*(rand/2+1) + 10)
}

function get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,rand){
  if(player_attack == 0)
    return `+ ${player_name}の攻撃！${monster_name}にかわされてしまった！\n- ${monster_name}のHP:${monster_hp}/${monster_level * 10 + 50}`
  else if(rand > 0.96)
    if(monster_hp <= 0)
      return `+ ${player_name}の攻撃！会心の一撃！${monster_name}に${player_attack}のダメージを与えた！`
    else
      return `+ ${player_name}の攻撃！会心の一撃！${monster_name}に${player_attack}のダメージを与えた！\n- ${monster_name}のHP:${monster_hp}/${monster_level * 10 + 50}`
  else
    if(monster_hp <= 0)
      return `+ ${player_name}の攻撃！${monster_name}に${player_attack}のダメージを与えた！`
    else
      return `+ ${player_name}の攻撃！${monster_name}に${player_attack}のダメージを与えた！\n- ${monster_name}のHP:${monster_hp}/${monster_level * 10 + 50}`
}

function get_monster_attack(monster_level){
  if(Math.random() < 0.01){
    return 0
  }else if(monster_level % 50 == 0){
    return Math.floor(monster_level * (1 + Math.random()) * 5)
  }else if(monster_level % 5 == 0){
    return Math.floor(monster_level * (1 + Math.random()) * 3)
  }else{
    return Math.floor(monster_level * (2 + Math.random()) + 5)
  }
}

function monster_attack_process(player_name,player_level,player_hp,monster_name,monster_attack){
  if(monster_attack == 0)
    return `+ ${monster_name}の攻撃！${player_name}は華麗にかわした！\n- ${player_name}のHP:${player_hp}/${player_level * 5 + 50}`
  else if(player_hp <= 0)
    return `+ ${monster_name}の攻撃！${player_name}は${monster_attack}のダメージを受けた。\n- ${player_name}のHP:0/${player_level * 5 + 50}\n- ${player_name}はやられてしまった。。。`
  else 
    return `+ ${monster_name}の攻撃！${player_name}は${monster_attack}のダメージを受けた。\n- ${player_name}のHP:${player_hp}/${player_level * 5 + 50}`
}

async function get_item_quantity(player_id,item_id){
  const itemList = await player_items.get(player_id)
  itemList.forEach(x => {
    if(x[0] == item_id){
      return x[1]
    }
  })
  return 0
}

function get_item_name(item_id){
  const hoge = JSON.parse(JSON.stringify(item_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == item_id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

async function obtain_item(item_id,quantity,player_id){
  if(get_item_name(item_id) == undefined) console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList.forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!itemIds.includes(item_id)){
    itemList.push([item_id,Number(quantity)])
  }
  await player_items.set(player_id,itemList)
}

async function consume_item(item_id,quantity,player_id){
  if(get_item_name(item_id) == undefined) console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList.forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = itemIds.indexOf(x[0])
        const func = itemList.splice(num,1)
        return
      }
      console.log(itemIds)
      x.pop()
      x.push(hoge-Number(quantity))
    }
  })
  if(!itemIds.includes(item_id)){
    return false
  }
  await player_items.set(player_id,itemList)
}

async function experiment(player_id,exp){
  const status = await player_status.get(player_id)
  const newexp = status[2]+exp
  const current_level = status[0]
  status.splice(2,1,newexp)
  await player_status.set(player_id,status)
  if(newexp > (current_level+1)**2){
    status.splice(0,1,Math.floor(newexp**0.5))
    await player_status.set(player_id,status)
    return `**<@${player_id}>:** \`Lv.${current_level} -> Lv.${Math.floor(newexp**0.5)}\``
  }
}

async function win_process(channel_id,exp){
  const ch_status = await channel_status.get(channel_id)
  const exp_members = []
  const levelup_members = []
  const item_members = []
  const members = ch_status[2]
  for(let i=0;i<members.length;i++){
    exp_members.push(`<@${members[i]}>は**${exp}EXP**を獲得した。`)
    levelup_members.push(await experiment(members[i],exp))
    const status = await player_status.get(members[i])
    const p = Math.min((0.02*(exp**2))/status[2],0.1)
    if(exp % 50 == 0 || Math.random() < p){
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await obtain_item("1",1,members[i])
    }
    if(Math.random() < p){
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await obtain_item("2",1,members[i])
    }
    if(Math.random() < p*2){
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await obtain_item("3",1,members[i])
    }
  }
  const exp_message = exp_members.join("\n")
  const levelup_message = levelup_members.join("\n")
  const item_message = item_members.join("\n")
  return [exp_message,levelup_message,item_message]
}

async function into_battle(player_id,channel_id){
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let ch_status = await channel_status.get(channel_id)
  let error_message = ""
  if(!m_status){
    const info = generate_monster("random")
    await monster_status.set(channel_id,[1,60].concat(info))
  }
  if(!ch_status){
    await channel_status.set(channel_id,[1,false,[]])
  }
  ch_status = await channel_status.get(channel_id)
  if(status[4] == false){
    status.splice(4,1,channel_id)
    ch_status[2].push(player_id)
    status.splice(1,1,status[0]*5+50)
    await player_status.set(player_id,status)
    await channel_status.set(channel_id,ch_status)
    const player_hp = status[0]*5+50
    return [player_hp,error_message]
  }
  const player_hp = status[1]
  if(status[4] != channel_id){
    error_message = `${client.users.cache.get(player_id).username}は<#${status[4]}>で戦闘中だ。`
  }else if(player_hp == 0){
    error_message = `${client.users.cache.get(player_id).username}はすでにやられている！`
  }
  return [player_hp,error_message]
}

async function reset_battle(channel_id,level_up){
let ch_status = await channel_status.get(channel_id)
  ch_status[2].forEach(async x => {
    const status = await player_status.get(x)
    status.splice(4,1,false)
    await player_status.set(x,status)
  })
  ch_status.splice(1,1,false)
  ch_status.splice(2,1,[])
  await channel_status.set(channel_id,ch_status)
  if(level_up == true){
    ch_status = await channel_status.get(channel_id)
    const boss_level = ch_status[0]+1
    ch_status.splice(0,1,boss_level)
    await channel_status.set(channel_id,ch_status)
    const monster_info = [boss_level,boss_level*10+50]
    let info;
    if(boss_level % 50 == 0){
      info = generate_monster("super_kyouteki")
    }else if(boss_level % 5 == 0){
      info = generate_monster("kyouteki")
    }else{
      info = generate_monster("random")
    }
    await monster_status.set(channel_id,monster_info.concat(info))
  }else if(level_up == false){
    ch_status = await channel_status.get(channel_id)
    const monster_info = [ch_status[0],ch_status[0]*10+50]
    const info = generate_monster("normal")
    await monster_status.set(channel_id,monster_info.concat(info))
  }
}

function generate_monster(rank){
  try{
    if(rank == "random"){
      const random = Math.random()
      if(random <= 0.01){
        rank = "rare"
      }else if(0.01 < random && random <= 0.012){
        rank = "super_rare"
      }else if(0.012 < random && random <= 0.013){
        rank = "super_ultra_rare"
      }else if(0.013 < random && random <= 0.023){
        rank = "zyakuteki"
      }else{
        rank = "normal"
      }
      const monsters = require(`./monsters/${rank}.json`)
      const number = Math.floor( Math.random() * Number( monsters.length.toString()) )
      const monster = monsters[number]
      return [monster.name,monster.rank,monster.img]
    }else{
      const monsters = require(`./monsters/${rank}.json`)
      const number = Math.floor( Math.random() * Number( monsters.length.toString()) )
      const monster = monsters[number]
      return [monster.name,monster.rank,monster.img]
    }
  }catch(err){
    return undefined
  }
}

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
    if(!p_status){
      await create_data("player",message.author.id)
    }
  }
  try{
    if(command == "test"){
      /*const player_name = message.author.username
      const player_attack = get_player_attack(10000,Math.random())
      const monster_name = "モンスター"
      const monster_level = 10
      const monster_hp = 150
      const rand = Math.random()
      const msg = await get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,rand)
      message.channel.send(msg)*/
      const msgs = await win_process(message.channel.id,1)
      console.log(msgs)
    }
    if(command == "status" || command == "st"){
      const status = await player_status.get(message.author.id)
      const embed = new MessageEmbed()
      .setTitle(`${message.author.username}のステータス:`)
      .setColor("RANDOM")
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
    if(command == "attack" || command == "atk"){
      await _attack(message.author.id,message.channel.id,message)
    }
    if(command == "item" || command == "i"){
      const item_name = message.content.split(" ")[1]
      await _item(message.channel.id,item_name,message.mentions.members.first(),message)
    }
    if(command == "in"){
      const intobattle = await into_battle(message.author.id,message.channel.id)
      const error_message = intobattle[1]
      if(error_message != ""){
        return message.reply(error_message)
      }
      const embed = new MessageEmbed()
      .setDescription(`<@${message.author.id}>は<#${message.channel.id}>の戦闘に参加した！`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed] })
    }
    if(command == "reset" || command == "re"){
      await reset_battle(message.channel.id,false)
      const m_info = await monster_status.get(message.channel.id)
      const embed = new MessageEmbed()
      .setTitle(`ランク:${m_info[3]}\n${m_info[2]}が待ち構えている...！\nLv.${m_info[0]} HP:${m_info[1]}`)
      .setImage(m_info[4])
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
    }
    if(command == "itemid")
      if(admin_list.includes(message.author.id)){
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
          return message.reply("Undefined_Player")
        }
        await obtain_item(itemId,quantity,player)
        message.reply(`\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_item_name(itemId)}\`を\`${quantity}\`個手に入れた！`)
      }else{
        message.reply("実行権限がありません。")
        message.react("❎")
      }
    if(command == "consumeitem"){
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
        return message.reply("Undefined_Player")
      }
      await consume_item(itemId,quantity,player)
      message.reply("unco")
    }
    if(command == "exp")
      if(admin_list.includes(message.author.id)){
        const player_id = message.content.split(" ")[1]
        const exp = Number(message.content.split(" ")[2])
        const levelup_msg = await experiment(player_id,exp)
        const embed = new MessageEmbed()
        .setDescription(`<@${player_id}>に${exp}EXPを付与しました\n${levelup_msg}`)
        message.reply({ embeds:[embed] })
      }
    if(command == "monstergen"){
      let rank = message.content.slice(prefix.length+11)
      const info = generate_monster(rank)
      const embed = new MessageEmbed()
      .setTitle(`ランク:${info[1]}\n${info[0]}が待ち構えている...！\nLv.0 HP:0`)
      .setImage(info[2])
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
    }
    if(command == "eval")
      if(admin_list.includes(message.author.id)){
        var result = message.content.slice(prefix.length+5).trim();
          let evaled = eval(result);
          message.channel.send(evaled)
          message.react("✅")
      }else{
        message.reply("実行権限がありません。")
        message.react("❎")
      }
    if(command == "db")
      if(admin_list.includes(message.author.id)){
        var result = message.content.slice(prefix.length+3).trim();
          let evaled = eval("(async () => {" + result + "})()");
          if(typeof evaled != "string"){
            evaled = util.inspect(evaled);
          }
          message.channel.send("Done.")
          message.react("✅")
      }else{
        message.reply("実行権限がありません。")
        message.react("❎")
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
