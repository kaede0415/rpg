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
const player_sozais = new Keyv(`sqlite://player_data.sqlite`, { table: "sozai" });
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
const prefix = "_"
const cmd_list = ["help","status","st","attack","atk","item","i","in","reset","re","rs","inquiry","inq","talent","training","t","mine","gatya","itemid","consumeitem","sozaiid","consumesozai","exp","eval","db","bulkdb"]
const command_json = require("./jsons/command.json")
const item_json = require("./jsons/item.json")
const sozai_json = require("./jsons/sozai.json")
const training_json = require("./jsons/training.json")
const admin_list = ["945460382733058109"];
const mine_cooldown = []
let timeout;
let time;
process.env.TZ = 'Asia/Tokyo'
//const dbFiles = fs.readdirSync('./').filter(file => file.endsWith('.sqlite'));

async function bulk_change(option,instructions){
  if(option == "player_status"){
    for await(const [key, value] of player_status.iterator()){
      let evaled = eval("(async () => {" + instructions + "})()");
      if(typeof evaled != "string"){
        evaled = util.inspect(evaled);
      }
    };
  }else if(option == "player_items"){
    for await(const [key, value] of player_items.iterator()){
      let evaled = eval("(async () => {" + instructions + "})()");
      if(typeof evaled != "string"){
        evaled = util.inspect(evaled);
      }
    };
  }else if(option == "player_sozais"){
    for await(const [key, value] of player_sozais.iterator()){
      let evaled = eval("(async () => {" + instructions + "})()");
      if(typeof evaled != "string"){
        evaled = util.inspect(evaled);
      }
    };
  }else if(option == "monster_status"){
    for await(const [key, value] of monster_status.iterator()){
      let evaled = eval("(async () => {" + instructions + "})()");
      if(typeof evaled != "string"){
        evaled = util.inspect(evaled);
      }
    };
  }else if(option == "channel_status"){
    for await(const [key, value] of channel_status.iterator()){
      let evaled = eval("(async () => {" + instructions + "})()");
      if(typeof evaled != "string"){
        evaled = util.inspect(evaled);
      }
    };
  }else{
    return false
  }
}

async function create_data(option,id){
  if(option == "player"){
    await player_status.set(id,[100,550,10000,0,false,[0,0,0,0,0]])
    await player_items.set(id,[])
    await player_sozais.set(id,[])
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

async function generate_detection(player_id,message){
  let status = await player_status.get(player_id)
  const deru = await get_item_quantity(player_id,999)
  const denai = await get_item_quantity(player_id,-999)
  let probability = 0.001
  if(denai >= 1){
    probability = 0
  }else if(deru => 1){
    probability = probability + (deru * 0.001)
  }
  if(Math.random() < probability){
    status.splice(7,1,true)
    await player_status.set(player_id,status)
    const embed = new MessageEmbed()
    .setTitle("マクロ検知")
    .setDescription("ボタンを押してください。")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    .setFooter("制限時間:1分")
    const o_embed = new MessageEmbed()
    .setTitle("マクロ検知")
    .setDescription("認証しました。")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    const x_embed = new MessageEmbed()
    .setTitle("マクロ検知")
    .setDescription("時間切れです。")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    const msg = await message.reply({ embeds: [embed], components: [ newbutton([ { id: "ok", label: "私はBOTではありません。" } ]) ] })
    const timer = setTimeout(async () => {
      msg.edit({ embeds: [x_embed], components: [] })
      await ban(player_id)
      status = await player_status.get(player_id)
      status.splice(7,1,false)
      await status.set(player_id,status)
    },1000*60);
    client.on("interactionCreate", async interaction => {
      if(interaction.user.id != player_id){
        return;
      }
      if(interaction.customId == "ok"){
        interaction.message.edit({ embeds: [o_embed], components: [] })
        await interaction.reply({ content: "認証しました。", ephemeral: true })
        status = await player_status.get(player_id)
        status.splice(7,1,false)
        await player_status.set(player_id,status)
        clearTimeout(timer);
      }
    });
    return;
  }
}

async function delete_data(option,id){
  if(option == "player"){
    await player_status.delete(id)
    await player_items.delete(id)
    await player_sozais.delete(id)
  }else if(option == "monster"){
    await monster_status.delete(id)
  }else if(option == "channel"){
    await channel_status.delete(id)
  }else{
    return false
  }
}

async function ban(player_id){
  const list = await lists.get(client.user.id)
  const ban_list = list[1]
  if(ban_list.includes(player_id)){
    return false
  }else{
    ban_list.push(player_id)
  }
  await lists.set(client.user.id,list)
}

async function unban(player_id){
  const list = await lists.get(client.user.id)
  const ban_list = list[1]
  const index = ban_list.findIndex(n => n == player_id)
  if(index == -1){
    return false
  }else{
    ban_list.splice(index,1)
  }
  await lists.set(client.user.id,list)
}

async function _attack(player_id,channel_id,message){
  const intobattle = await into_battle(player_id,channel_id)
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply({ content: error_message, allowedMentions: { parse: [] } })
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
    await reset_battle(channel_id,1)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
    .setImage(m_img)
    .setColor("RANDOM")
    message.reply({ content:`\`\`\`diff\n${attack_message}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
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
    const p_sozais = await player_sozais.get(message.author.id)
    const comparefunction = function(a,b){
      return a[0] - b[0]
    }
    if(p_items){
      p_items.sort(comparefunction)
    }
    if(p_sozais){
      p_sozais.sort(comparefunction)
    }
    let i_content = [];
    const i_embed = new MessageEmbed()
    .setTitle(`${message.author.username}のアイテムリスト:`)
    .setFooter("ページ:1/2")
    .setColor("RANDOM")
    if(!p_items.length){
      i_content.push("なし")
    }
    const i_time = p_items.length
    for(let i=0;i<i_time;i++){
      const item_name = get_item_name(p_items[i][0])
      const item_value = p_items[i][1]
      i_content.push(`**${item_name}：**\`${item_value.toLocaleString()}個\``)
    }
    i_embed.setDescription(`>>> ${i_content.join("\n")}`)
    let s_content = [];
    const s_embed = new MessageEmbed()
    .setTitle(`${message.author.username}の素材リスト:`)
    .setFooter("ページ:2/2")
    .setColor("RANDOM")
    if(!p_sozais.length){
      s_content.push("なし")
    }
    const s_time = p_sozais.length
    for(let i=0;i<s_time;i++){
      const sozai_name = get_sozai_name(p_sozais[i][0])
      const sozai_value = p_sozais[i][1]
      s_content.push(`**${sozai_name}：**\`${sozai_value.toLocaleString()}個\``)
    }
    s_embed.setDescription(`>>> ${s_content.join("\n")}`)
    const msg = await message.reply({ content: "```js\nページ数を送信してください。\n0で処理を終了します。```", embeds:[i_embed], allowedMentions: { parse: [] } })
    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
    collector.on('collect', async m => {
      m.delete();
      if(Number.isInteger(Number(m.content)) && 1 <= Number(m.content) && Number(m.content) >= 2){
        msg.edit({ content: `\`\`\`js\nページ数を送信してください。\n0で処理を終了します。\`\`\`` })
      }
      if(m.content == "1"){
        msg.edit({ embeds:[i_embed] });
      }else if(m.content == "2"){
        msg.edit({ embeds:[s_embed] });
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
  }else if(["ファイアボールの書","fire","f"].includes(item_name)){
    await fireball(message.author.id,message.channel.id,message)
  }else if(["エリクサー","elixir","e"].includes(item_name)){
    const msg = await elixir(message.author.id,message.channel.id,message)
    const embed = new MessageEmbed()
    .setDescription(`>>> ${msg}`)
    .setColor("RANDOM")
    message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }else if(["祈りの書","i"].includes(item_name)){
    const msg = await pray(message.author.id,message.channel.id,mentions,message)
    if(msg != undefined){
      const embed = new MessageEmbed()
      .setDescription(`>>> ${msg}`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
  }else if(["気","k"].includes(item_name)){
    await ki(message.author.id,message.channel.id,message)
  }else if(["超新星爆発","b"].includes(item_name)){
    await bigbang(message.author.id,message.channel.id,message)
  }else{
    const embed = new MessageEmbed()
    .setDescription(`>>> ${item_name}？なんすか${item_name}って...`)
    .setColor("RANDOM")
    message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
}

async function elixir(player_id,channel_id,message){
  if(await consume_item("1",1,player_id) == false){
    return `<@${player_id}>はエリクサーを持っていない！`
  }
  const ch_status = await channel_status.get(channel_id)
  const btl_members = ch_status[2]
  for(let i=0;i<btl_members.length;i++){
    const p_st = await player_status.get(btl_members[i])
    const p_lv = p_st[0]
    p_st.splice(1,1,p_lv*5+50)
    await player_status.set(btl_members[i],p_st)
  }
  return `<@${player_id}>はエリクサーを使用した！このチャンネルの仲間全員が全回復した！`
}

async function fireball(player_id,channel_id,message){
  if(await consume_item("2",1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`>>> <@${player_id}>はファイボールの書を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  const intobattle = await into_battle(player_id,channel_id)
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply({ content: error_message, allowedMentions: { parse: [] } })
  }
  const player_level = status[0]
  const player_attack = player_level*2+10
  const monster_level = m_status[0]
  let monster_hp = m_status[1]
  const monster_name = m_status[2]
  const damage = Math.floor(player_level * (1 + Math.random()) /10)
  monster_hp -= damage
  const atk_msg = `+ ファイアボール！${monster_name}に${damage.toLocaleString()}のダメージを与えた！`
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
    await reset_battle(channel_id,1)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
    .setImage(m_img)
    .setColor("RANDOM")
    message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
  }else{
    m_status.splice(1,1,monster_hp)
    await monster_status.set(channel_id,m_status)
    message.channel.send(`\`\`\`diff\n${atk_msg}\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}\`\`\``)
  }
}

async function pray(player_id,channel_id,mentions,message){
  if(!mentions){
    return `祈りの書は仲間を復活させます。祈る相手を指定して使います。\n例)${prefix}item 祈りの書 @ユーザーメンション`
  }
  const prayed_id = message.mentions.members.first().id
  const prayed_status = await player_status.get(prayed_id)
  const ch_status = await channel_status.get(channel_id)
  const prayed_hp = prayed_status[1]
  const btl_members = ch_status[2]
  if(prayed_id == player_id){
    return `自分を祈ることは出来ない！`
  }else if(!btl_members.includes(prayed_id)){
    return `<@${prayed_id}>は戦闘に参加していない！`
  }else if(prayed_hp != 0){
    return `<@${prayed_id}>はまだ生きている！`
  }else if(await consume_item("3",1,player_id) == false){
    return `<@${player_id}>は祈りの書を持っていない！`
  }
  const intobattle = await into_battle(player_id,channel_id)
  const error_message = intobattle[1]
  if(error_message != ""){
    message.reply({ content: error_message, allowedMentions: { parse: [] } })
    return
  }
  prayed_status.splice(1,1,1)
  await player_status.set(prayed_id,prayed_status)
  return `祈りを捧げ、<@${prayed_id}>は復活した！\n<@${prayed_id}> 残りHP: 1`
}

async function ki(player_id,channel_id,message){
  if(await consume_item("4",1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`>>> <@${player_id}>は気を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  const intobattle = await into_battle(player_id,channel_id)
  const m_status = await monster_status.get(channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply({ content: error_message, allowedMentions: { parse: [] } })
  }
  const monster_level = m_status[0]
  let monster_hp = m_status[1]
  const monster_name = m_status[2]
  const damage = monster_hp
  monster_hp -= damage
  const atk_msg = `+ 破...！${monster_name}に即死を与えた！`
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
  await reset_battle(channel_id,1)
  const m_info = await monster_status.get(channel_id)
  const m_level = m_info[0]
  const m_hp = m_info[1]
  const m_name = m_info[2]
  const m_rank = m_info[3]
  const m_img = m_info[4]
  const embed2 = new MessageEmbed()
  .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
  .setImage(m_img)
  .setColor("RANDOM")
  message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
}

async function bigbang(player_id,channel_id,message){
  if(await consume_item("5",1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`>>> <@${player_id}>は超新星爆発を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  const intobattle = await into_battle(player_id,channel_id)
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply({ content: error_message, allowedMentions: { parse: [] } })
  }
  const player_level = status[0]
  const player_attack = player_level*2+10
  const monster_level = m_status[0]
  let monster_hp = m_status[1]
  const monster_name = m_status[2]
  const damage = Math.floor(player_attack*100000000*Math.random())
  monster_hp -= damage
  let atk_msg = `+ ビッグバン！${monster_name}に${damage.toLocaleString()}を与えた！\n! 先の50体の敵が吹っ飛んだ！`
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
    await reset_battle(channel_id,50)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
    .setImage(m_img)
    .setColor("RANDOM")
    message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
  }else{
    m_status.splice(1,1,monster_hp)
    await monster_status.set(channel_id,m_status)
    atk_msg = `+ ビッグバン！${monster_name}に${damage.toLocaleString()}を与えた！`
    message.channel.send(`\`\`\`diff\n${atk_msg}\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}\`\`\``)
  }
}

function get_player_attack(player_attack,rand){
  if(rand < 0.01) return 0
  else if(rand > 0.96) return player_attack*(2) + 10
  else return Math.floor(player_attack*(rand/2+1) + 10)
}

function get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,rand){
  if(player_attack == 0)
    return `+ ${player_name}の攻撃！${monster_name}にかわされてしまった！\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}`
  else if(rand > 0.96)
    if(monster_hp <= 0)
      return `+ ${player_name}の攻撃！会心の一撃！${monster_name}に${player_attack.toLocaleString()}のダメージを与えた！`
    else
      return `+ ${player_name}の攻撃！会心の一撃！${monster_name}に${player_attack.toLocaleString()}のダメージを与えた！\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}`
  else
    if(monster_hp <= 0)
      return `+ ${player_name}の攻撃！${monster_name}に${player_attack.toLocaleString()}のダメージを与えた！`
    else
      return `+ ${player_name}の攻撃！${monster_name}に${player_attack.toLocaleString()}のダメージを与えた！\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}`
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
    return `+ ${monster_name}の攻撃！${player_name}は華麗にかわした！\n- ${player_name}のHP:${player_hp.toLocaleString()}/${(player_level * 5 + 50).toLocaleString()}`
  else if(player_hp <= 0)
    return `+ ${monster_name}の攻撃！${player_name}は${monster_attack.toLocaleString()}のダメージを受けた。\n- ${player_name}のHP:0/${(player_level * 5 + 50).toLocaleString()}\n- ${player_name}はやられてしまった。。。`
  else 
    return `+ ${monster_name}の攻撃！${player_name}は${monster_attack.toLocaleString()}のダメージを受けた。\n- ${player_name}のHP:${player_hp.toLocaleString()}/${(player_level * 5 + 50).toLocaleString()}`
}

async function get_item_quantity(player_id,item_id){
  let quantity;
  const itemList = await player_items.get(player_id)
  itemList.forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

async function get_sozai_quantity(player_id,sozai_id){
  let quantity;
  const sozaiList = await player_sozais.get(player_id)
  sozaiList.forEach(x => {
    if(x[0] == sozai_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
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
      x.pop()
      x.push(hoge-Number(quantity))
    }
  })
  if(!itemIds.includes(item_id)){
    return false
  }
  await player_items.set(player_id,itemList)
}

function get_sozai_name(sozai_id){
  const hoge = JSON.parse(JSON.stringify(sozai_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == sozai_id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

async function obtain_sozai(sozai_id,quantity,player_id){
  if(get_sozai_name(sozai_id) == undefined) console.log("error")
  const sozaiList = await player_sozais.get(player_id)
  const sozaiIds = [];
  sozaiList.forEach(x => {
    sozaiIds.push(x[0])
    if(x[0] == sozai_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!sozaiIds.includes(sozai_id)){
    sozaiList.push([sozai_id,Number(quantity)])
  }
  await player_sozais.set(player_id,sozaiList)
}

async function consume_sozai(sozai_id,quantity,player_id){
  if(get_sozai_name(sozai_id) == undefined) console.log("error")
  const sozaiList = await player_sozais.get(player_id)
  const sozaiIds = [];
  sozaiList.forEach(x => {
    sozaiIds.push(x[0])
    if(x[0] == sozai_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = sozaiIds.indexOf(x[0])
        const func = sozaiList.splice(num,1)
        return
      }
      x.pop()
      x.push(hoge-Number(quantity))
    }
  })
  if(!sozaiIds.includes(sozai_id)){
    return false
  }
  await player_sozais.set(player_id,sozaiList)
}

async function experiment(player_id,exp){
  const status = await player_status.get(player_id)
  const newexp = status[2]+exp
  const current_level = status[0]
  status.splice(2,1,newexp)
  await player_status.set(player_id,status)
  if(Math.floor(newexp**0.5) != current_level){
    status.splice(0,1,Math.floor(newexp**0.5))
    await player_status.set(player_id,status)
    return `**<@${player_id}>:** \`Lv.${current_level.toLocaleString()} -> Lv.${Math.floor(newexp**0.5).toLocaleString()}\``
  }else{
    return "none"
  }
}

async function win_process(channel_id,exp){
  const ch_status = await channel_status.get(channel_id)
  const exp_members = []
  const levelup_members = []
  const item_members = []
  const members = ch_status[2]
  for(let i=0;i<members.length;i++){
    const status = await player_status.get(members[i])
    const sub = status[3]
    status.splice(3,1,sub+1)
    await player_status.set(members[i],status)
    let expcalc = exp
    const rank = await get_monster_rank(channel_id)
    if(rank == "【強敵】"){
      expcalc = expcalc*2
      if(Math.random() <= 0.06){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.11){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.11){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.02){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await obtain_item("100000",1,members[i])
      }
    }else if(rank == "【超強敵】"){
      expcalc = expcalc*5
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await obtain_item("3",1,members[i])
      if(Math.random() <= 0.01){
        item_members.push(`<@${members[i]}>は気を**1個**手に入れた！`)
        await obtain_item("4",1,members[i])
      }
      if(Math.random() <= 0.03){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await obtain_item("100000",1,members[i])
      }
    }else if(rank == "【レア】"){
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.2){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.2){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.05){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await obtain_item("100000",1,members[i])
      }
      expcalc = expcalc*10
    }else if(rank == "【激レア】"){
      expcalc = expcalc*100
      if(Math.random() <= 0.25){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await obtain_item("100000",1,members[i])
      }
    }else if(rank == "【超激レア】"){
      expcalc = expcalc*1000
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await obtain_item("3",1,members[i])
      item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
      await obtain_item("100000",1,members[i])
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>は超新星爆発を**1個**手に入れた！`)
        await obtain_item("5",1,members[i])
      }
    }else{
      if(Math.random() <= 0.05){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.01){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await obtain_item("100000",1,members[i])
      }
    }
    exp_members.push(`<@${members[i]}>は**${expcalc.toLocaleString()}EXP**を獲得した。`)
    const msg = await experiment(members[i],expcalc)
    if(msg != "none"){
      levelup_members.push(msg)
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
    ch_status.splice(1,1,true)
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

async function reset_battle(channel_id,level){
  let ch_status = await channel_status.get(channel_id)
  if(ch_status[1] == false){
    return "このchで戦闘は行われていませんよ...？"
  }
  ch_status[2].forEach(async x => {
    const status = await player_status.get(x)
    status.splice(4,1,false)
    await player_status.set(x,status)
  })
  ch_status.splice(1,1,false)
  ch_status.splice(2,1,[])
  await channel_status.set(channel_id,ch_status)
  if(level == 0){
    ch_status = await channel_status.get(channel_id)
    const monster_info = [ch_status[0],ch_status[0]*10+50]
    let info;
    const nowrank = await get_monster_rank(channel_id)
    if(nowrank != "【強敵】" && nowrank != "【超強敵】"){
      info = generate_monster("normal")
    }else{
      if(nowrank == "【強敵】"){
        info = generate_monster("kyouteki")
      }else if(nowrank == "【超強敵】"){
        info = generate_monster("super_kyouteki")
      }
    }
    await monster_status.set(channel_id,monster_info.concat(info))
  }else{
    ch_status = await channel_status.get(channel_id)
    const boss_level = ch_status[0]+level
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
  }
}

async function inquiry(channel_id,message){
  let ch_status = await channel_status.get(channel_id)
  if(ch_status[1] == false){
    return message.reply({ content: "このchで戦闘は行われていませんよ...？", allowedMentions: { parse: [] } })
  }
  const channel_name = client.channels.cache.get(channel_id).name
  const m_status = await monster_status.get(channel_id)
  const content = []
  const btl_members = ch_status[2]
  for(let i=0;i<btl_members.length;i++){
    const status = await player_status.get(btl_members[i])
    const p_name = client.users.cache.get(btl_members[i]).tag
    content.push(`${p_name} HP: ${status[1].toLocaleString()}/${(status[0]*5+50).toLocaleString()}`)
  }
  const embed = new MessageEmbed()
  .setTitle(`${channel_name}の戦闘状況:`)
  .addField("戦闘中のモンスター情報:",`>>> **ランク: ${m_status[3]}\n名前:** \`${m_status[2]}\`\n**Lv.** \`${m_status[0].toLocaleString()}\` **HP: ${m_status[1].toLocaleString()}/${(m_status[0]*10+50).toLocaleString()}**`)
  .addField("戦闘中のPLAYER:",`**${content.join("\n")}**`)
  .setThumbnail(m_status[4])
  .setColor("RANDOM")
  message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
}

async function talent(player_id,message){
  const player_name = client.users.cache.get(player_id).username
  const status = await player_status.get(player_id)
  const talents = status[5]
  const embed = new MessageEmbed()
  .setTitle(`${player_name}のタレント`)
  .setDescription(`\`\`\`css\n[1.体力] ${talents[0]}\n[2.攻撃力] ${talents[1]}\n[3.防御力] ${talents[2]}\n[4.盗み力] ${talents[3]}\n[5.経験値] ${talents[4]}\`\`\``)
  .setFooter("上げたいタレントの数字を送信してください")
  .setColor("RANDOM")
  const msg = await message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000, max: 1 });
  collector.on('collect', async m => {
    m.delete();
    let talent_name
    if(m.content == "1"){
      talent_name = "体力"
    }else if(m.content == "2"){
      talent_name = "攻撃力"
    }else if(m.content == "3"){
      talent_name = "防御力"
    }else if(m.content == "4"){
      talent_name = "盗み力"
    }else if(m.content == "5"){
      talent_name = "経験値"
    }else if(m.content == "0"){
      return msg.edit({ content:"```処理を終了しました...```" });
    }else{
      return msg.edit({ content:"```値が不正なので処理を終了しました...```" })
    }
    const newembed = new MessageEmbed()
    .setDescription(`[${talent_name}]\n上げたいレベルを送信してください`)
    .setColor("RANDOM")
    msg.edit({ embeds:[newembed] })
    const collector2 = message.channel.createMessageCollector({ filter: filter, idle: 60000, max: 1 });
    collector2.on('collect', async m => {
      if(!Number.isInteger(Number(m.content))){
        return msg.edit({ content: "```値が整数ではないので処理を終了しました...```" })
      }
      if(Number(m.content) <= 0){
        return msg.edit({ content: "```値は1以上の整数にしてください```" })
      }
      const nowlevel = await get_talent_level(talent_name,player_id)
      const value = Number(m.content)
      const newlevel = nowlevel+value
      const q_embed = new MessageEmbed()
      .setDescription(`\`\`\`css\n[${talent_name}]\nLv.${nowlevel} -> Lv.${newlevel}\nレベルを上げますか？\`\`\``)
      .setFooter("ok or 0")
      .setColor("RANDOM")
      msg.edit({ embeds:[q_embed] })
      const collector3 = message.channel.createMessageCollector({ filter: filter, idle: 60000, max: 1 });
      collector3.on('collect', async m => {
        if(m.content.toLowerCase() == "ok"){
          const lastembed = new MessageEmbed()
          .setDescription(`\`\`\`diff\n+ レベルを${value}上げました！\`\`\``)
          .setColor("RANDOM")
          msg.edit({ embeds:[lastembed] })
          await add_talent_level(talent_name,player_id,value)
        }else if(m.content == "0"){
          return msg.edit({ content:"```処理を終了しました...```" });
        }else{
          return msg.edit({ content: "```値が不正なので処理を終了しました```" })
        }
      })
      collector3.on('end', async (collected, reason) => {
        if(reason == "idle"){
          msg.edit({ content:"```時間切れです...```" });
        }
      })
    })
    collector2.on('end', async (collected, reason) => {
      if(reason == "idle"){
        msg.edit({ content:"```時間切れです...```" });
      }
    })
  });
  collector.on('end', async (collected, reason) => {
    if(reason == "idle"){
      msg.edit({ content:"```時間切れです...```" });
    }
  })
}

async function get_talent_level(option,player_id){
  let num;
  if(option == "体力"){
    num = 0
  }else if(option == "攻撃力"){
    num = 1
  }else if(option == "防御力"){
    num = 2
  }else if(option == "盗み力"){
    num = 3
  }else if(option == "経験値"){
    num = 4
  }else{
    return undefined
  }
  const status = await player_status.get(player_id)
  return status[5][num]
}

async function add_talent_level(option,player_id,value){
  let num;
  if(option == "体力"){
    num = 0
  }else if(option == "攻撃力"){
    num = 1
  }else if(option == "防御力"){
    num = 2
  }else if(option == "盗み力"){
    num = 3
  }else if(option == "経験値"){
    num = 4
  }else{
    return undefined
  }
  const status = await player_status.get(player_id)
  const nowlv =  status[5][num]
  status[5].splice(num,1,nowlv+value)
  await player_status.set(player_id,status)
}

async function training(player_id,message){
  const random = Math.floor(Math.random()*training_json.length);
  const q = training_json[random][0]
  const a = training_json[random][1]
  const p_status = await player_status.get(player_id)
  const nowexp = p_status[2]
  const exp = Math.ceil(Math.sqrt(nowexp) * 3 / 5)
  let comment = `正解！${exp.toLocaleString()}の経験値を得た。`
  const q_embed = new MessageEmbed()
  .setDescription(`「${q}」の読み方をひらがなで答えなさい。`)
  .setColor("RANDOM")
  const msg = await message.reply({ embeds:[q_embed], allowedMentions: { parse: [] } })
  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createMessageCollector({ filter: filter, time: 15000 });
  collector.on('collect', async m => {
    if(m.content == a){
      const expe = await experiment(player_id,exp)
      if(expe != "none"){
        comment += `\n${expe}`
      }
      if(Math.random() < 0.005){
        comment += `\n\`エリクサー\`を手に入れた！`
        await obtain_item(1,1,player_id)
      }
      if(Math.random() < 0.1){
        comment += `\n\`ファイアボールの書\`を手に入れた！`
        await obtain_item(2,1,player_id)
      }
      if(Math.random() < 0.1){
        comment += `\n\`祈りの書\`を手に入れた！`
        await obtain_item(3,1,player_id)
      }
      const t_embed = new MessageEmbed()
      .setDescription(comment)
      .setColor("RANDOM")
      msg.edit({ embeds:[t_embed] })
      collector.stop();
    }else{
      const f_embed = new MessageEmbed()
      .setDescription(`不正解！正解は「${a}」だ。`)
      .setColor("RANDOM")
      msg.edit({ embeds:[f_embed] })
      collector.stop();
    }
  });
  collector.on('end', async (collected, reason) => {
    if(reason == "time"){
      const l_embed = new MessageEmbed()
      .setDescription(`時間切れ！正解は「${a}」だ。`)
      .setColor("RANDOM")
      msg.edit({ embeds:[l_embed] })
    }
  });
}

async function mine(player_id,channel_id){
  let comment = []
  if(!mine_cooldown.includes(player_id)){
    mine_cooldown.push(player_id)
    timeout = setTimeout(function(){
      mine_cooldown.splice(mine_cooldown.indexOf(player_id),1)
    },3000)
    time = Date.now()
  }else if(mine_cooldown.includes(player_id)){
    const now = Date.now()
    return (timeout._idleTimeout - (now - time)) / 1000
  }
  const w_quantity = Math.floor( Math.random() * 30 ) + 15
  const s_quantity = Math.floor( Math.random() * 10 ) + 1
  comment.push(`+ 木材: ${w_quantity}個`)
  await obtain_sozai("1",w_quantity,player_id)
  if(Math.random() < 0.5){
    comment.push(`+ 丸石: ${s_quantity}個`)
    await obtain_sozai("2",s_quantity,player_id)
  }
  if(Math.random() < 0.25){
    comment.push(`+ 鉄: ${s_quantity}個`)
    await obtain_sozai("3",s_quantity,player_id)
  }
  if(Math.random() < 0.5){
    comment.push(`+ 石炭: ${s_quantity}個`)
    await obtain_sozai("5",s_quantity,player_id)
  }
  if(Math.random() < 0.1){
    comment.push(`+ ダイヤモンド: ${s_quantity}個`)
    await obtain_sozai("4",s_quantity,player_id)
  }
  return comment
}

async function get_monster_rank(channel_id){
  const m_info = await monster_status.get(channel_id)
  return m_info[3]
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

function gatya(option,time){
  const rewards = []
  const rewards_name = []
  for(let i=0;i<time;i++){
    let reality
    const random = Math.random()
    if(random <= 0.001){
      reality = "sur"
    }else if(0.001 < random && random <= 0.005){
      reality = "ur"
    }else if(0.005 < random && random <= 0.105){
      reality = "sr"
    }else if(0.015 < random && random <= 0.405){
      reality = "r"
    }else{
      reality = "n"
    }
    const reward_list = require(`./gatya/${option}/${reality}.json`)
    const number = Math.floor( Math.random() * Number( reward_list.length.toString()) )
    const reward = reward_list[number]
    rewards.push([`【${reality.toUpperCase()}レア】`,reward.name,reward.type,reward.id,reward.quantity])
    rewards_name.push(reward.name)
  }
  let count = {};
  for(let i=0;i<rewards.length;i++) {
    var elm = rewards[i][1];
    count[elm] = (count[elm] || 0) + 1;
  }
  const length = Object.keys(count).length
  for(let i=0;i<length;i++){
    const name = Object.keys(count)[i]
    const quant = Object.values(count)[i]
    const num = rewards_name.indexOf(name)
    const quantity = rewards[num][4]
    rewards[num].splice(4,1,quantity*quant)
  }
  const newrewards = rewards.filter(i => {
    if(!this[i[1]] || this[i[1]] == false){
      return this[i[1]] = true
    }
  });
  rewards.filter(i => {
    if(this[i[1]] == true || this[i[1]] == false){
      return this[i[1]] = undefined
    }
  });
  return newrewards
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

cron.schedule('0 0 0 * * *', async () => {
  const list = await lists.get(client.user.id)
  const login_list = list[0]
  list.splice(1,1,[])
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
    if(!p_status){
      await create_data("player",message.author.id)
    }
    if(!login_list.includes(message.author.id)){
      const day = await get_item_quantity(message.author.id,0)+1
      const elength = day+29
      const flength = day*3+52
      const plength = day*3+42
      const tlength = day+10
      const embed = new MessageEmbed()
      .setDescription(`>>> **ログイン${day}日目です。\nログボをゲットしました！！！**\`\`\`ゲットした物:\n   冒険の証:1個\n   エリクサー:${elength}個\n   ファイアボールの書:${flength}個\n   祈りの書:${plength}個\n   100円硬貨:${tlength}個\`\`\``)
      .setThumbnail(client.user.displayAvatarURL())
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
      await obtain_item("0",1,message.author.id)
      await obtain_item("1",elength,message.author.id)
      await obtain_item("2",flength,message.author.id)
      await obtain_item("3",plength,message.author.id)
      await obtain_item("100000",tlength,message.author.id)
      login_list.push(message.author.id)
      await lists.set(client.user.id,list)
    }
    for await(const [key, value] of player_status.iterator()){
      if(client.users.cache.get(key) == undefined){
        await delete_data("player",key)
      }
    }
    return await generate_detection(message.author.id,message)
  }
  try{
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
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
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
        return message.reply({ content:error_message, allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setDescription(`<@${message.author.id}>は<#${message.channel.id}>の戦闘に参加した！`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(command == "training" || command == "t"){
      await training(message.author.id,message)
    }
    if(command == "reset" || command == "re" || command == "rs"){
      const reset = await reset_battle(message.channel.id,0)
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
    if(command == "inquiry" || command == "inq"){
      await inquiry(message.channel.id,message)
    }
    if(command == "gatya"){
      let time = message.content.slice(prefix.length+6).trim()
      if(!time){
        return message.reply({ content: "回数を入力してください" })
      }else if(time != "max" && !Number.isInteger(Number(time)) || Number(time) <= 0){
        return message.reply({ content: "引数が不正です" })
      }else if(time == "max"){
        time = Number(await get_item_quantity(message.author.id,100000))
      }else if(time == 0){
        return message.reply({ content: "がちゃちけないやん" })
      }else{
        time = Number(time)
      }
      if(await get_item_quantity(message.author.id,100000) < time){
        return message.reply({ content: "がちゃちけがたりん！" })
      }
      message.reply({ content: "```diff\n+ ガチャを引き終わるまでしばらくお待ち下さい```" })
      await consume_item("100000",time,message.author.id)
      const result = gatya("normal",time)
      const msgs = []
      for(let i=0;i<result.length;i++){
        if(result[i][2] == "item"){
          await obtain_item(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "sozai"){
          await obtain_sozai(result[i][3],result[i][4],message.author.id)
        }
        msgs.push(`\`\`\`${result[i][0]}${result[i][1]}\`\`\`->${result[i][4]}個`)
      }
      const embed = new MessageEmbed()
      .setTitle(`ガチャ結果${time}枚`)
      .setDescription(msgs.join("\n"))
      message.channel.send({ embeds:[embed] })
    }
    if(command == "mine"){
      const msg = await mine(message.author.id,message.channel.id)
      const embed = new MessageEmbed()
      .setColor("RANDOM")
      if(!Array.isArray(msg)){
        embed.setDescription(`そのコマンドは${msg}秒後に使えます`)
      }else{
        embed.setDescription(`\`\`\`css\n[採掘者:${message.author.username}]\`\`\`\`\`\`diff\n${msg.join("\n")}\`\`\``)
      }
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(command == "talent"){
      await talent(message.author.id,message)
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
          return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
        }
        await obtain_item(itemId,quantity,player)
        message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_item_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
      }else{
        message.reply({ content:"実行権限がありません。", allowedMentions: { parse: [] } })
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
        return message.reply({ content: "Undefined_Player", allowedMentions: { parse: [] } })
      }
      await consume_item(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(command == "sozaiid")
      if(admin_list.includes(message.author.id)){
        const sozaiId = message.content.split(" ")[1]
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
        await obtain_sozai(sozaiId,quantity,player)
        message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${sozaiId}:${get_sozai_name(sozaiId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
      }else{
        message.reply({ content:"実行権限がありません。", allowedMentions: { parse: [] } })
        message.react("❎")
      }
    if(command == "consumesozai"){
      const sozaiId = message.content.split(" ")[1]
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
      await consume_sozai(sozaiId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(command == "exp")
      if(admin_list.includes(message.author.id)){
        const player_id = message.content.split(" ")[1]
        const exp = Number(message.content.split(" ")[2])
        const levelup_msg = await experiment(player_id,exp)
        const embed = new MessageEmbed()
        .setDescription(`<@${player_id}>に${exp.toLocaleString()}EXPを付与しました\n${levelup_msg}`)
        message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
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
        message.reply({ content: "実行権限がありません。", allowedMentions: { parse: [] } })
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
        message.reply({ content: "実行権限がありません。", allowedMentions: { parse: [] } })
        message.react("❎")
      }
    if(command == "bulkdb")
      if(admin_list.includes(message.author.id)){
        const option = message.content.split(" ")[1]
        const instructions = message.content.split(" ").slice(2).join(' ')
        await bulk_change(option,instructions)
        message.channel.send("Done.")
        message.react("✅")
      }else{
        message.reply({ content: "実行権限がありません。", allowedMentions: { parse: [] } })
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
