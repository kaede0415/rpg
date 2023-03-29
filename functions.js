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

//class func{
module.exports = {
   admin_or_player(id){
  if(admin_list.includes(id)) return "admin"
  else return "```diff\n- お前は誰だ？```"
},

 json_key_length(folder,file){
  let json_name
  if(folder == "none"){
    json_name = `./${file}.json`
  }else{
    json_name = `./${folder}/${file}.json`
  }
  const json = require(json_name)
  return Object.keys(json).length
},

async get_channel_mode(channel_id){
  const status = await channel_status.get(channel_id)
  if(!status) return false
  return status[3]
},

 monster_count(){
  const array = []
  array.push(func.json_key_length("monsters","zyakuteki"))
  array.push(func.json_key_length("monsters","normal"))
  array.push(func.json_key_length("monsters","kyouteki"))
  array.push(func.json_key_length("monsters","super_kyouteki"))
  array.push(func.json_key_length("monsters","kiwami"))
  array.push(func.json_key_length("monsters","rare"))
  array.push(func.json_key_length("monsters","super_rare"))
  array.push(func.json_key_length("monsters","super_ultra_rare"))
  array.push(func.json_key_length("monsters","maboroshi"))
  const reducer = (sum,currentValue) => sum + currentValue
  array.push(array.reduce(reducer))
  return array
},

 item_count(){
  const array = []
  array.push(func.json_key_length("items","item"))
  array.push(func.json_key_length("items","material"))
  array.push(func.json_key_length("items","weapon"))
  array.push(func.json_key_length("items","tool"))
  array.push(func.json_key_length("items","proof"))
  const reducer = (sum,currentValue) => sum + currentValue
  array.push(array.reduce(reducer))
  return array
},

async splice_status(option,id,start,item){
  let value;
  if(option == "player_status"){
    value = await player_status.get(id)
    value.splice(start,1,item)
    await player_status.set(id,value)
  }else if(option == "player_items"){
    value = await player_items.get(id)
    value[0].splice(start,1,item)
    await player_items.set(id,value)
  }else if(option == "player_materials"){
    value = await player_items.get(id)
    value[1].splice(start,1,item)
    await player_items.set(id,value)
  }else if(option == "player_weapons"){
    value = await player_items.get(id)
    value[2].splice(start,1,item)
    await player_items.set(id,value)
  }else if(option == "player_tools"){
    value = await player_items.get(id)
    value[3].splice(start,1,item)
    await player_items.set(id,value)
  }else if(option == "player_proofs"){
    value = await player_items.get(id)
    value[4].splice(start,1,item)
    await player_items.set(id,value)
  }else if(option == "monster_status"){
    value = await monster_status.get(id)
    value.splice(start,1,item)
    await monster_status.set(id,value)
  }else if(option == "channel_status"){
    value = await channel_status.get(id)
    value.splice(start,1,item)
    await channel_status.set(id,value)
  }else{
    return false
  }
},

async create_data(option,id){
  if(option == "player"){
    await player_status.set(id,[100,550,10000,0,false,[0,0,0,0,0],false,0,[0,0]])
    await player_items.set(id,[[],[],[["0",1]],[],[]])
  }else if(option == "monster"){
    const info = func.generate_monster("random")
    const array = [1,60].concat(info)
    await monster_status.set(id,array)
  }else if(option == "channel"){
    await channel_status.set(id,[1,false,[],"normal"])
  }else{
    return false
  }
},

async generate_detection(player_id,message){
  let status = await player_status.get(player_id)
  const deru = await func.get_proof_quantity(player_id,999)
  const denai = await func.get_proof_quantity(player_id,-999)
  let probability = 0.001
  if(denai >= 1){
    probability = 0
  }else if(deru => 1){
    probability = probability + (deru * 0.001)
  }
  if(Math.random() < probability){
    await func.splice_status("player_status",player_id,6,true)
    const first = ["マクロ","まくろ","ﾏｸﾛ","ま＜ろ","マク口","Macro","macro","MACRO","マク❏","マク❒","マク□","makuro","Makuro","MAKURO"]
    const second = ["Kenti","kenti","KENTI","検知","木僉矢口"," Detection"," detection"," DETECTION","ケンチ","けんち","ｹﾝﾁ"]
    const title = `${first[Math.floor(Math.random()*first.length)]}${second[Math.floor(Math.random()*second.length)]}`
    const embed = new MessageEmbed()
    .setTitle(title)
    .setDescription("あなたはBOTですか？")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    .setFooter("制限時間:1分")
    const o_embed = new MessageEmbed()
    .setTitle(title)
    .setDescription("認証しました。")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    const t_embed = new MessageEmbed()
    .setTitle(title)
    .setDescription("時間切れです。")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    const x_embed = new MessageEmbed()
    .setTitle(title)
    .setDescription("あなたはBOTだと判断されました。")
    .setColor("RANDOM")
    .setAuthor(`検知者:${message.author.tag}`,message.author.displayAvatarURL())
    const random_1 = Math.random().toString(36).slice(-16)
    const random_2 = Math.random().toString(36).slice(-16)
    const b1 = ["No","no","NO","No ","no ","NO ","のー","違う","ちがう","ちげえよ"]
    const b2 = ["Yes","yes","YES","いぇす","はい","せやで","いえす"]
    const b1_label = `${b1[Math.floor(Math.random()*b1.length)]}`
    const b2_label = `${b2[Math.floor(Math.random()*b2.length)]}`
    const buttons = []
    const rand = Math.random()
    if(rand < 0.125)　buttons.push({ id: `${random_1}`, label: b1_label, style: "PRIMARY" },{ id: `${random_2}`, label: b2_label, style: "PRIMARY" })
    else if(rand < 0.25) buttons.push({ id: `${random_1}`, label: b1_label, style: "PRIMARY" },{ id: `${random_2}`, label: b2_label, style: "DANGER" })
    else if(rand < 0.375) buttons.push({ id: `${random_1}`, label: b1_label, style: "DANGER" },{ id: `${random_2}`, label: b2_label, style: "PRIMARY" })
    else if(rand < 0.5) buttons.push({ id: `${random_1}`, label: b1_label, style: "DANGER" },{ id: `${random_2}`, label: b2_label, style: "DANGER" })
    else if(rand < 0.675) buttons.push({ id: `${random_2}`, label: b2_label, style: "PRIMARY" },{ id: `${random_1}`, label: b1_label, style: "PRIMARY" })
    else if(rand < 0.75) buttons.push({ id: `${random_2}`, label: b2_label, style: "PRIMARY" },{ id: `${random_1}`, label: b1_label, style: "DANGER" })
    else if(rand < 0.825) buttons.push({ id: `${random_2}`, label: b2_label, style: "DANGER" },{ id: `${random_1}`, label: b1_label, style: "PRIMARY" })
    else if(rand < 1) buttons.push({ id: `${random_2}`, label: b2_label, style: "DANGER" },{ id: `${random_1}`, label: b1_label, style: "DANGER" })
    const msg = await message.reply({ embeds: [embed], components: [ newbutton(buttons) ] })
    client.on("interactionCreate", async interaction => {
      if(interaction.user.id != player_id){
        return;
      }
      if(interaction.customId == `${random_1}`){
        interaction.message.edit({ embeds: [o_embed], components: [] })
        interaction.reply({ content: "認証しました。", ephemeral: true })
        await func.splice_status("player_status",player_id,6,false)
        clearTimeout(timer);
      }
      if(interaction.customId == `${random_2}`){
        interaction.message.edit({ embeds: [x_embed], components: [] })
        interaction.reply({ content: "あなたはBOTだと判断されました。", ephemeral: true })
        await func.splice_status("player_status",player_id,6,false)
        await func.ban(player_id)
        clearTimeout(timer);
      }
    });
    const timer = setTimeout(async () => {
      msg.edit({ embeds: [t_embed], components: [] })
      await func.ban(player_id)
      await func.splice_status("player_status",player_id,6,false)
    },1000*60);
    return;
  }
},

async delete_data(option,id){
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
},

async ban(player_id){
  const list = await lists.get(client.user.id)
  const ban_list = list[1]
  if(ban_list.includes(player_id) || client.users.cache.get(player_id) == undefined){
    return false
  }else{
    ban_list.push(player_id)
  }
  await lists.set(client.user.id,list)
},

async unban(player_id){
  const list = await lists.get(client.user.id)
  const ban_list = list[1]
  const index = ban_list.findIndex(n => n == player_id)
  if(index == -1 || client.users.cache.get(player_id) == undefined){
    return false
  }else{
    ban_list.splice(index,1)
  }
  await lists.set(client.user.id,list)
},

async _attack(player_id,channel_id,message){
  const intobattle = await func.into_battle(player_id,channel_id)
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
  const atk_talent = await func.get_talent_level("攻撃力",player_id)
  const player_attack = func.get_player_attack(player_level*(1+0.01*atk_talent),random) * func.get_weapon_abi(await func.get_equipped_weapon(player_id))
  monster_hp -= player_attack
  const attack_message = func.get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,random)
  if(monster_hp <= 0){
    const win_message = await func.win_process(player_id,channel_id,monster_level)
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
    await func.reset_battle(channel_id,1)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
    .setColor("RANDOM")
    const mode = await func.get_channel_mode(channel_id)
    if(mode == "normal"){
      embed2.setImage(m_img)
    }else if(mode == "debug"){
      const id = func.get_monster_id(m_rank,m_name)
      embed2.setImage(m_img)
      .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
    }
    message.reply({ content:`\`\`\`diff\n${attack_message}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
  }else{
    m_status.splice(1,1,monster_hp)
    await monster_status.set(channel_id,m_status)
    const monster_attack = func.get_monster_attack(monster_level)
    player_hp -= monster_attack
    if(monster_attack == 0){
    }else if(player_hp <= 0){
      status.splice(1,1,0)
      await player_status.set(player_id,status)
    }else{
      status.splice(1,1,player_hp)
      await player_status.set(player_id,status)
    }
    const monster_attack_message = func.monster_attack_process(player_name,player_level,player_hp,monster_name,monster_attack)
    message.channel.send(`\`\`\`diff\n${attack_message}\n\n${monster_attack_message}\`\`\``)
  }
},

async _item(channel_id,item_name,mentions,message){
  let id = message.author.id
  if(!item_name || await player_items.get(item_name) || message.mentions.members.size != 0){
    if(message.mentions.members.size != 0){
      id = message.mentions.members.first().id
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      if(!await player_items.get(id)){
        return message.reply({ content: "そのプレイヤーのデータは見つかりませんでした", allowedMentions: { parse: [] } })
      }
    }else if(await player_items.get(item_name)){
      id = item_name
      const error_msg = func.admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
    }
    const items = await player_items.get(id)
    const p_items = items[0]
    const p_materials = items[1]
    const p_weapons = items[2]
    const p_tools = items[3]
    const p_proofs = items[4]
    const player = client.users.cache.get(id)
    const compare = function(a,b){
      return a[0] - b[0]
    }
    if(p_items){
      p_items.sort(compare)
    }
    if(p_materials){
      p_materials.sort(compare)
    }
    if(p_weapons){
      p_weapons.sort(compare)
    }
    if(p_tools){
      p_tools.sort(compare)
    }
    if(p_proofs){
      p_proofs.sort(compare)
    }
    let i_content = [];
    const i_embed = new MessageEmbed()
    .setTitle(`${player.username}のアイテムリスト:`)
    .setFooter("ページ:1/5")
    .setColor("RANDOM")
    if(!p_items.length){
      i_content.push("なし")
    }
    const i_time = p_items.length
    for(let i=0;i<i_time;i++){
      const item_name = func.get_item_name(p_items[i][0])
      const item_value = p_items[i][1]
      i_content.push(`**${item_name}：**\`${item_value.toLocaleString()}個\``)
    }
    i_embed.setDescription(`>>> ${i_content.join("\n")}`)
    let m_content = [];
    const m_embed = new MessageEmbed()
    .setTitle(`${player.username}の素材リスト:`)
    .setFooter("ページ:2/5")
    .setColor("RANDOM")
    if(!p_materials.length){
      m_content.push("なし")
    }
    const m_time = p_materials.length
    for(let i=0;i<m_time;i++){
      const material_name = func.get_material_name(p_materials[i][0])
      const material_value = p_materials[i][1]
      m_content.push(`**${material_name}：**\`${material_value.toLocaleString()}個\``)
    }
    m_embed.setDescription(`>>> ${m_content.join("\n")}`)
    let w_content = [];
    const w_embed = new MessageEmbed()
    .setTitle(`${player.username}の武器リスト:`)
    .setFooter("ページ:3/5")
    .setColor("RANDOM")
    if(!p_weapons.length){
      w_content.push("なし")
    }
    const w_time = p_weapons.length
    for(let i=0;i<w_time;i++){
      const weapon_name = func.get_weapon_name(p_weapons[i][0])
      const weapon_value = p_weapons[i][1]
      w_content.push(`**${weapon_name}：**\`${weapon_value.toLocaleString()}個\``)
    }
    w_embed.setDescription(`>>> ${w_content.join("\n")}`)
    let t_content = [];
    const t_embed = new MessageEmbed()
    .setTitle(`${player.username}のツールリスト:`)
    .setFooter("ページ:4/5")
    .setColor("RANDOM")
    if(!p_tools.length){
      t_content.push("なし")
    }
    const t_time = p_tools.length
    for(let i=0;i<t_time;i++){
      const tool_name = func.get_tool_name(p_tools[i][0])
      const tool_value = p_tools[i][1]
      t_content.push(`**${tool_name}：**\`${tool_value.toLocaleString()}個\``)
    }
    t_embed.setDescription(`>>> ${t_content.join("\n")}`)
    let p_content = [];
    const p_embed = new MessageEmbed()
    .setTitle(`${player.username}の証リスト:`)
    .setFooter("ページ:5/5")
    .setColor("RANDOM")
    if(!p_proofs.length){
      p_content.push("なし")
    }
    const p_time = p_proofs.length
    for(let i=0;i<p_time;i++){
      const proof_name = func.get_proof_name(p_proofs[i][0])
      const proof_value = p_proofs[i][1]
      p_content.push(`**${proof_name}：**\`${proof_value.toLocaleString()}個\``)
    }
    p_embed.setDescription(`>>> ${p_content.join("\n")}`)
    const msg = await message.reply({ content: "```js\nページ数を送信してください。\n0で処理を終了します。```", embeds:[i_embed], allowedMentions: { parse: [] } })
    const filter = m => m.author.id == message.author.id;
    const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
    collector.on('collect', async m => {
      m.delete();
      if(Number.isInteger(Number(m.content)) && 1 <= Number(m.content) && Number(m.content) >= 5){
        msg.edit({ content: `\`\`\`js\nページ数を送信してください。\n0で処理を終了します。\`\`\`` })
      }
      if(m.content == "1"){
        msg.edit({ embeds:[i_embed] });
      }else if(m.content == "2"){
        msg.edit({ embeds:[m_embed] });
      }else if(m.content == "3"){
        msg.edit({ embeds:[w_embed] });
      }else if(m.content == "4"){
        msg.edit({ embeds:[t_embed] });
      }else if(m.content == "5"){
        msg.edit({ embeds:[p_embed] });
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
    await func.fireball(message.author.id,message.channel.id,message)
  }else if(["エリクサー","elixir","e"].includes(item_name)){
    const msg = await func.elixir(message.author.id,message.channel.id,message)
    const embed = new MessageEmbed()
    .setDescription(`>>> ${msg}`)
    .setColor("RANDOM")
    message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }else if(["祈りの書","i"].includes(item_name)){
    const msg = await func.pray(message.author.id,message.channel.id,mentions,message)
    if(msg != undefined){
      const embed = new MessageEmbed()
      .setDescription(`>>> ${msg}`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
  }else if(["気","k"].includes(item_name)){
    await func.ki(message.author.id,message.channel.id,message)
  }else if(["超新星爆発","b"].includes(item_name)){
    await func.bigbang(message.author.id,message.channel.id,message)
  }else{
    const embed = new MessageEmbed()
    .setDescription(`>>> ${item_name}のデータは見つかりませんでした`)
    .setColor("RANDOM")
    message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
},

async elixir(player_id,channel_id,message){
  if(await func.consume_item("1",1,player_id) == false){
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
},

async fireball(player_id,channel_id,message){
  if(await func.consume_item("2",1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`>>> <@${player_id}>はファイボールの書を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  const intobattle = await func.into_battle(player_id,channel_id)
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
    const win_message = await func.win_process(player_id,channel_id,monster_level)
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
    await func.reset_battle(channel_id,1)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
    .setColor("RANDOM")
    const mode = await func.get_channel_mode(channel_id)
    if(mode == "normal"){
      embed2.setImage(m_img)
    }else if(mode == "debug"){
      const id = func.get_monster_id(m_rank,m_name)
      embed2.setImage(m_img)
      .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
    }
    message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
  }else{
    m_status.splice(1,1,monster_hp)
    await monster_status.set(channel_id,m_status)
    message.channel.send(`\`\`\`diff\n${atk_msg}\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}\`\`\``)
  }
},

async pray(player_id,channel_id,mentions,message){
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
  }else if(await func.consume_item("3",1,player_id) == false){
    return `<@${player_id}>は祈りの書を持っていない！`
  }
  const intobattle = await func.into_battle(player_id,channel_id)
  const error_message = intobattle[1]
  if(error_message != ""){
    message.reply({ content: error_message, allowedMentions: { parse: [] } })
    return
  }
  prayed_status.splice(1,1,1)
  await player_status.set(prayed_id,prayed_status)
  return `祈りを捧げ、<@${prayed_id}>は復活した！\n<@${prayed_id}> 残りHP: 1`
},

async ki(player_id,channel_id,message){
  if(await func.get_monster_rank(channel_id) == "【極】"){
    const embed = new MessageEmbed()
    .setDescription(">>> この敵に気は通用しない...!")
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  if(await func.consume_item("4",1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`>>> <@${player_id}>は気を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  const intobattle = await func.into_battle(player_id,channel_id)
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
  const win_message = await func.win_process(player_id,channel_id,monster_level)
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
  await func.reset_battle(channel_id,1)
  const m_info = await monster_status.get(channel_id)
  const m_level = m_info[0]
  const m_hp = m_info[1]
  const m_name = m_info[2]
  const m_rank = m_info[3]
  const m_img = m_info[4]
  const embed2 = new MessageEmbed()
  .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
  .setColor("RANDOM")
  const mode = await func.get_channel_mode(channel_id)
  if(mode == "normal"){
    embed2.setImage(m_img)
  }else if(mode == "debug"){
    const id = func.get_monster_id(m_rank,m_name)
    embed2.setImage(m_img)
    .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
  }
  message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
},

async bigbang(player_id,channel_id,message){
  if(await func.consume_item("5",1,player_id) == false){
    const embed = new MessageEmbed()
    .setDescription(`>>> <@${player_id}>は超新星爆発を持っていない！`)
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
  const intobattle = await func.into_battle(player_id,channel_id)
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
  let atk_msg = `+ ビッグバン！${monster_name}に${damage.toLocaleString()}ダメージを与えた！\n! 先の50体の敵が吹っ飛んだ！`
  if(monster_hp <= 0){
    const win_message = await func.win_process(player_id,channel_id,monster_level)
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
    await func.reset_battle(channel_id,50)
    const m_info = await monster_status.get(channel_id)
    const m_level = m_info[0]
    const m_hp = m_info[1]
    const m_name = m_info[2]
    const m_rank = m_info[3]
    const m_img = m_info[4]
    const embed2 = new MessageEmbed()
    .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
    .setColor("RANDOM")
    const mode = await func.get_channel_mode(channel_id)
    if(mode == "normal"){
      embed2.setImage(m_img)
    }else if(mode == "debug"){
      const id = func.get_monster_id(m_rank,m_name)
      embed2.setImage(m_img)
      .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
    }
    message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
  }else{
    m_status.splice(1,1,monster_hp)
    await monster_status.set(channel_id,m_status)
    atk_msg = `+ ビッグバン！${monster_name}に${damage.toLocaleString()}を与えた！`
    message.channel.send(`\`\`\`diff\n${atk_msg}\n- ${monster_name}のHP:${monster_hp.toLocaleString()}/${(monster_level * 10 + 50).toLocaleString()}\`\`\``)
  }
},

async kill(count,player_id,channel_id,message){
  const intobattle = await func.into_battle(player_id,channel_id)
  let player_hp = intobattle[0]
  const error_message = intobattle[1]
  if(error_message != ""){
    return message.reply({ content: error_message, allowedMentions: { parse: [] } })
  }
  const m_status = await monster_status.get(channel_id)
  const monster_level = m_status[0]
  let monster_hp = m_status[1]
  const monster_name = m_status[2]
  const player_name = client.users.cache.get(player_id).username
  let atk_msg = `+ ${player_name}「生有るものは死へと収束する...。」\n+ ${monster_name}に死を与えた！\n! ${count}体の敵が吹っ飛んだ！`
  if(count < 0){
    atk_msg = `+ ${player_name}「トキヨモドレ...！」\n+ ${monster_name}に生命を与えた！\n! ${Math.abs(count)}体の敵が蘇った！`
  }else if(count == 0){
    atk_msg = `+ ${player_name}「...?」\n+ ${player_name}は何かを忘れてしまった！\n! 敵は立ち尽くしている！`
  }
  const embed = new MessageEmbed()
  .setTitle("戦闘結果:")
  .setDescription(`**${monster_name}を倒した！**\nキルコマンドは経験値が入りません。`)
  .setColor("RANDOM")
  await func.reset_battle(channel_id,count)
  const m_info = await monster_status.get(channel_id)
  const m_level = m_info[0]
  const m_hp = m_info[1]
  const m_name = m_info[2]
  const m_rank = m_info[3]
  const m_img = m_info[4]
  const embed2 = new MessageEmbed()
  .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
  .setColor("RANDOM")
  const mode = await func.get_channel_mode(channel_id)
  if(mode == "normal"){
    embed2.setImage(m_img)
  }else if(mode == "debug"){
    const id = func.get_monster_id(m_rank,m_name)
    embed2.setImage(m_img)
    .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
  }
  message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
},

 get_player_attack(player_attack,rand){
  if(rand < 0.01) return 0
  else if(rand > 0.96) return player_attack*(2) + 10
  else return Math.floor(player_attack*(rand/2+1) + 10)
},

 get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,rand){
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

 get_monster_attack(monster_level){
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

 monster_attack_process(player_name,player_level,player_hp,monster_name,monster_attack){
  if(monster_attack == 0)
    return `+ ${monster_name}の攻撃！${player_name}は華麗にかわした！\n- ${player_name}のHP:${player_hp.toLocaleString()}/${(player_level * 5 + 50).toLocaleString()}`
  else if(player_hp <= 0)
    return `+ ${monster_name}の攻撃！${player_name}は${monster_attack.toLocaleString()}のダメージを受けた。\n- ${player_name}のHP:0/${(player_level * 5 + 50).toLocaleString()}\n- ${player_name}はやられてしまった。。。`
  else 
    return `+ ${monster_name}の攻撃！${player_name}は${monster_attack.toLocaleString()}のダメージを受けた。\n- ${player_name}のHP:${player_hp.toLocaleString()}/${(player_level * 5 + 50).toLocaleString()}`
}

async get_item_quantity(player_id,item_id){
  let quantity;
  const itemList = await player_items.get(player_id)
  itemList[0].forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

async get_material_quantity(player_id,item_id){
  let quantity;
  const itemList = await player_items.get(player_id)
  itemList[1].forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

async get_weapon_quantity(player_id,item_id){
  let quantity;
  const itemList = await player_items.get(player_id)
  itemList[2].forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

async get_tool_quantity(player_id,item_id){
  let quantity;
  const itemList = await player_items.get(player_id)
  itemList[3].forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

async get_proof_quantity(player_id,item_id){
  let quantity;
  const itemList = await player_items.get(player_id)
  itemList[4].forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

 get_item_name(id){
  const hoge = JSON.parse(JSON.stringify(item_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

 get_material_name(id){
  const hoge = JSON.parse(JSON.stringify(material_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

 get_weapon_name(id){
  const hoge = JSON.parse(JSON.stringify(weapon_json))
  const valueList = Object.values(hoge)
  for(let i=0;i<valueList.length;i++){
    if(valueList[i].id == id){
      return `${valueList[i].name}`
    }
  }
  return undefined
}

 get_tool_name(id){
  const hoge = JSON.parse(JSON.stringify(tool_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

 get_proof_name(id){
  const hoge = JSON.parse(JSON.stringify(proof_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

async obtain_item(item_id,quantity,player_id){
  if(get_item_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[0].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!itemIds.includes(item_id)){
    itemList[0].push([item_id,Number(quantity)])
  }
  await player_items.set(player_id,itemList)
}

async consume_item(item_id,quantity,player_id){
  if(func.get_item_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[0].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = itemIds.indexOf(x[0])
        const func = itemList[0].splice(num,1)
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

async obtain_material(item_id,quantity,player_id){
  if(func.get_material_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[1].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!itemIds.includes(item_id)){
    itemList[1].push([item_id,Number(quantity)])
  }
  await player_items.set(player_id,itemList)
}

async consume_material(item_id,quantity,player_id){
  if(func.get_material_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[1].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = itemIds.indexOf(x[0])
        const func = itemList[1].splice(num,1)
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

async obtain_weapon(item_id,quantity,player_id){
  if(func.get_weapon_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[2].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!itemIds.includes(item_id)){
    itemList[2].push([item_id,Number(quantity)])
  }
  await player_items.set(player_id,itemList)
}

async consume_weapon(item_id,quantity,player_id){
  if(func.get_weapon_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[2].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = itemIds.indexOf(x[0])
        const func = itemList[2].splice(num,1)
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

async obtain_tool(item_id,quantity,player_id){
  if(func.get_tool_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[3].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!itemIds.includes(item_id)){
    itemList[3].push([item_id,Number(quantity)])
  }
  await player_items.set(player_id,itemList)
}

async consume_tool(item_id,quantity,player_id){
  if(func.get_tool_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[3].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = itemIds.indexOf(x[0])
        const func = itemList[3].splice(num,1)
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

async obtain_proof(item_id,quantity,player_id){
  if(func.get_proof_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[4].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      x.pop()
      x.push(hoge+Number(quantity))
      return;
    }
  })
  if(!itemIds.includes(item_id)){
    itemList[4].push([item_id,Number(quantity)])
  }
  await player_items.set(player_id,itemList)
}

async consume_proof(item_id,quantity,player_id){
  if(func.get_proof_name(item_id) == undefined) return console.log("error")
  const itemList = await player_items.get(player_id)
  const itemIds = [];
  itemList[4].forEach(x => {
    itemIds.push(x[0])
    if(x[0] == item_id){
      const hoge = x[1]
      if(hoge < Number(quantity)){
        return false
      }else if(hoge == Number(quantity)){
        const num = itemIds.indexOf(x[0])
        const func = itemList[4].splice(num,1)
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

async experiment(player_id,exp){
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

async coinment(option,player_id,coin){
  let num;
  if(option == "free"){
    num = 0
  }else if(option == "paid"){
    num = 1
  }else{
    return false
  }
  const status = await player_status.get(player_id)
  const newcoin = status[8][num]+coin
  status[8].splice(num,1,newcoin)
  await player_status.set(player_id,status)
}

async win_process(player_id,channel_id,exp){
  const ch_status = await channel_status.get(channel_id)
  const exp_coin_members = []
  const levelup_members = []
  const item_members = []
  const members = ch_status[2]
  for(let i=0;i<members.length;i++){
    const status = await player_status.get(members[i])
    const sub = status[3]
    status.splice(3,1,sub+1)
    await player_status.set(members[i],status)
    let expcalc = exp
    let coincalc
    const rank = await func.get_monster_rank(channel_id)
    const exp_talent = await func.get_talent_level("経験値",player_id)
    if(rank == "【強敵】"){
      expcalc = expcalc*(2+exp_talent*0.02)
      coincalc = 2
      if(Math.random() <= 0.06){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await func.obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.11){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await func.obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.11){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await func.obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.02){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await func.obtain_item("100000",1,members[i])
      }
    }else if(rank == "【超強敵】"){
      expcalc = expcalc*(5+exp_talent*0.02)
      coincalc = 5
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await func.obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await func.obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await func.obtain_item("3",1,members[i])
      if(Math.random() <= 0.01){
        item_members.push(`<@${members[i]}>は気を**1個**手に入れた！`)
        await func.obtain_item("4",1,members[i])
      }
      if(Math.random() <= 0.03){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await func.obtain_item("100000",1,members[i])
      }
    }else if(rank == "【極】"){
      expcalc = expcalc*(10+exp_talent*0.02)
      coincalc = 10
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await func.obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await func.obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await func.obtain_item("3",1,members[i])
      item_members.push(`<@${members[i]}>は気を**1個**手に入れた！`)
      await func.obtain_item("4",1,members[i])
      if(Math.random() <= 0.3){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await func.obtain_item("100000",1,members[i])
      }
    }else if(rank == "【レア】"){
      expcalc = expcalc*(10+exp_talent*0.02)
      coincalc = 10
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await func.obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.2){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await func.obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.2){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await func.obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.05){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await func.obtain_item("100000",1,members[i])
      }
    }else if(rank == "【激レア】"){
      expcalc = expcalc*(100+exp_talent*0.02)
      coincalc = 50
      if(Math.random() <= 0.25){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await func.obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await func.obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await func.obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await func.obtain_item("100000",1,members[i])
      }
    }else if(rank == "【超激レア】"){
      expcalc = expcalc*(1000+exp_talent*0.02)
      coincalc = 100
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await func.obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await func.obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await func.obtain_item("3",1,members[i])
      item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
      await func.obtain_item("100000",1,members[i])
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>は超新星爆発を**1個**手に入れた！`)
        await func.obtain_item("5",1,members[i])
      }
    }else if(rank == "【幻】"){
      expcalc = expcalc*(10000+exp_talent*0.02)
      coincalc = 1000
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await func.obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await func.obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await func.obtain_item("3",1,members[i])
      item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
      await func.obtain_item("100000",1,members[i])
      item_members.push(`<@${members[i]}>は気を**1個**手に入れた！`)
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>は超新星爆発を**1個**手に入れた！`)
        await func.obtain_item("5",1,members[i])
      }
      if(Math.random() <= 0.5 && i==0){
        const number = Math.floor( Math.random() * members.length )
        item_members.push(`<@${members[number]}>は幻の証を**1個**手に入れた！`)
        await func.obtain_proof("-100002",1,members[number])
      }
    }else{
      expcalc = expcalc*(1+exp_talent*0.02)
      coincalc = 1
      if(Math.random() <= 0.05){
        item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
        await func.obtain_item("1",1,members[i])
      }
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
        await func.obtain_item("2",1,members[i])
      }
      if(Math.random() <= 0.1){
        item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
        await func.obtain_item("3",1,members[i])
      }
      if(Math.random() <= 0.01){
        item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
        await func.obtain_item("100000",1,members[i])
      }
    }
    exp_coin_members.push(`<@${members[i]}>は**${expcalc.toLocaleString()}EXP**と**${coincalc.toLocaleString()}コイン**を獲得した。`)
    const msg = await func.experiment(members[i],expcalc)
    await func.coinment("free",members[i],coincalc)
    if(msg != "none"){
      levelup_members.push(msg)
    }
  }
  const exp_message = exp_coin_members.join("\n")
  const levelup_message = levelup_members.join("\n")
  const item_message = item_members.join("\n")
  return [exp_message,levelup_message,item_message]
}

async into_battle(player_id,channel_id){
  const status = await player_status.get(player_id)
  const m_status = await monster_status.get(channel_id)
  let ch_status = await channel_status.get(channel_id)
  let error_message = ""
  if(!m_status){
    const info = func.generate_monster("random")
    await monster_status.set(channel_id,[1,60].concat(info))
  }
  if(!ch_status){
    await func.create_data("channel",channel_id)
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

async reset_battle(channel_id,level){
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
    const nowrank = await func.get_monster_rank(channel_id)
    if(nowrank != "【強敵】" && nowrank != "【超強敵】" && nowrank != "【極】"){
      info = func.generate_monster("normal")
    }else{
      if(nowrank == "【強敵】"){
        info = func.generate_monster("kyouteki")
      }else if(nowrank == "【超強敵】"){
        info = func.generate_monster("super_kyouteki")
      }else if(nowrank == "【極】"){
        info = func.generate_monster("kiwami")
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
    if(boss_level % 500 == 0){
      info = func.generate_monster("kiwami")
    }else if(boss_level % 50 == 0){
      info = func.generate_monster("super_kyouteki")
    }else if(boss_level % 5 == 0){
      info = func.generate_monster("kyouteki")
    }else{
      info = func.generate_monster("random")
    }
    await monster_status.set(channel_id,monster_info.concat(info))
  }
}

async inquiry(channel_id,message){
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

async change_mode(channel_id,option){
  const status = await channel_status.get(channel_id)
  if(option == "normal"){
    await func.splice_status("channel_status",channel_id,3,"normal")
  }else if(option == "hihyozi"){
    await func.splice_status("channel_status",channel_id,3,"hihyozi")
  }else if(option == "debug"){
    await func.splice_status("channel_status",channel_id,3,"debug")
  }else{
    return false
  }
}

async get_mode(channel_id){
  const status = await channel_status.get(channel_id)
  return status[3]
}

async get_equipped_weapon(player_id){
  const status = await player_status.get(player_id)
  if(status){
    return status[7]
  }else{
    return false
  }
}

 get_weapon_abi(id){
  if(id == -1){
    return 10000
  }else if(id == 0){
    return 1
  }else if(id == 1){
    return 1.1
  }else if(id == 2){
    return 1.3
  }else if(id == 3){
    return 1.6
  }else if(id == 4){
    return 2
  }else if(id == 5){
    return -1
  }
}

 get_weapon_outline(id){
  const hoge = JSON.parse(JSON.stringify(weapon_json))
  const valueList = Object.values(hoge)
  for(let i=0;i<valueList.length;i++){
    if(valueList[i].id == id){
      return `${valueList[i].outline}`
    }
  }
  return undefined
}

async weapon_list(player_id){
  const items = await player_items.get(player_id)
  const weapons = items[2]
  const ids = []
  const msgs = []
  for(let i=0;i<weapons.length;i++){
    const id = weapons[i][0]
    ids.push(id)
    msgs.push(`[${id}:${func.get_weapon_name(id)}]`)
  }
  return [ids,msgs]
}

async weapon(player_id,message){
  const list = await func.weapon_list(player_id)
  const id = await func.get_equipped_weapon(player_id)
  const embed = new MessageEmbed()
  .setTitle(`現在は「${func.get_weapon_name(id)}」`)
  .setDescription(`<@${player_id}>\`\`\`css\n${list[1].join("\n")}\`\`\`\`\`\`js\n${func.get_weapon_outline(id)}\`\`\``)
  .setFooter("数字を送信してください(xで処理終了)")
  .setColor("RANDOM")
  const msg = await message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
  collector.on('collect', async m => {
    m.delete();
    if(m.content != "x" && !list[0].includes(m.content)){
    }else if(m.content == "x"){
      collector.stop()
      return msg.edit({ content:"```処理を終了しました...```" });
    }else{
      collector.stop()
      const emb = new MessageEmbed()
      .setDescription(`\`\`\`diff\n+ 武器を「${func.get_weapon_name(m.content)}」に変更しました\`\`\`\`\`\`js\n${func.get_weapon_outline(m.content)}\`\`\``)
      .setColor("RANDOM")
      msg.edit({ embeds:[emb] })
      await func.splice_status("player_status",player_id,7,Number(m.content))
    }
  })
  collector.on('end', async (collected, reason) => {
    if(reason == "idle"){
      msg.edit({ content:"```時間切れです...```" });
    }
  })
}

async talent(player_id,message){
  const player_name = client.users.cache.get(player_id).username
  const status = await player_status.get(player_id)
  const talents = status[5]
  const embed = new MessageEmbed()
  .setDescription(`\`\`\`md\n[${player_name}](合計Lv.${await func.get_talent_level("all",player_id)}/Lv.50)\`\`\`\`\`\`css\n[1.体力] ${talents[0]}\n[2.攻撃力] ${talents[1]}\n[3.防御力] ${talents[2]}\n[4.盗み力] ${talents[3]}\n[5.経験値] ${talents[4]}\`\`\``)
  .setFooter("上げたいタレントの数字を送信してください")
  .setColor("RANDOM")
  if(await func.get_talent_level("all",player_id) >= 50){
    embed.setFooter("上限に達しました")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
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
      if(await func.get_talent_level("all",player_id)+Number(m.content) > 50){
        return msg.edit({ content: "```上限を超えているため処理を停止しました...```" })
      }
      const nowlevel = await func.get_talent_level(talent_name,player_id)
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
          await func.add_talent_level(talent_name,player_id,value)
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

async get_talent_level(option,player_id){
  let num;
  const status = await player_status.get(player_id)
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
  }else if(option == "all"){
    const talents = status[5]
    return talents[0]+talents[1]+talents[2]+talents[3]+talents[4]
  }else{
    return undefined
  }
  return status[5][num]
}

async add_talent_level(option,player_id,value){
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

async training(player_id,message){
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
      const expe = await func.experiment(player_id,exp)
      if(expe != "none"){
        comment += `\n${expe}`
      }
      if(Math.random() < 0.005){
        comment += `\n\`エリクサー\`を手に入れた！`
        await func.obtain_item(1,1,player_id)
      }
      if(Math.random() < 0.1){
        comment += `\n\`ファイアボールの書\`を手に入れた！`
        await func.obtain_item(2,1,player_id)
      }
      if(Math.random() < 0.1){
        comment += `\n\`祈りの書\`を手に入れた！`
        await func.obtain_item(3,1,player_id)
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

async wallet(player_id){
  const status = await player_status.get(player_id)
  return status[8]
}

async mine(player_id,channel_id){
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
  await func.obtain_material("1",w_quantity,player_id)
  if(Math.random() < 0.5){
    comment.push(`+ 丸石: ${s_quantity}個`)
    await func.obtain_material("2",s_quantity,player_id)
  }
  if(Math.random() < 0.25){
    comment.push(`+ 鉄: ${s_quantity}個`)
    await func.obtain_material("3",s_quantity,player_id)
  }
  if(Math.random() < 0.5){
    comment.push(`+ 石炭: ${s_quantity}個`)
    await func.obtain_material("5",s_quantity,player_id)
  }
  if(Math.random() < 0.1){
    comment.push(`+ ダイヤモンド: ${s_quantity}個`)
    await func.obtain_material("4",s_quantity,player_id)
  }
  return comment
}

async get_monster_rank(channel_id){
  const m_info = await monster_status.get(channel_id)
  return m_info[3]
}

 get_monster_id(monster_rank,monster_name){
  const array = []
  let rank
  if(["【通常】"].includes(monster_rank)){
    rank = "normal"
  }else if(["【弱敵】"].includes(monster_rank)){
    rank = "zyakuteki"
  }else if(["【強敵】"].includes(monster_rank)){
    rank = "kyouteki"
  }else if(["【超強敵】"].includes(monster_rank)){
    rank = "super_kyouteki"
  }else if(["【極】"].includes(monster_rank)){
    rank = "kiwami"
  }else if(["【レア】"].includes(monster_rank)){
    rank = "rare"
  }else if(["【激レア】"].includes(monster_rank)){
    rank = "super_rare"
  }else if(["【超激レア】"].includes(monster_rank)){
    rank = "super_ultra_rare"
  }else if(["【幻】"].includes(monster_rank)){
    rank = "maboroshi"
  }
  array.push(rank)
  const json = require(`./monsters/${rank}.json`)
  const hoge = JSON.parse(JSON.stringify(json))
  const valueList = Object.keys(hoge)
  for(let value in valueList){
    if(hoge[valueList[value]].name == monster_name){
      array.push(`${hoge[valueList[value]].id}`)
      return array
    }
  }
  return undefined
}

 generate_monster(rank){
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
      }else if(0.013 < random && random <= 0.0131){
        rank = "maboroshi"
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

 summon_monster(rank,id){
  try{
    const monsters = require(`./monsters/${rank}.json`)
    const hoge = JSON.parse(JSON.stringify(monsters))
    const valueList = Object.values(hoge)
    for(let value in valueList){
      if(valueList[value].id == id){
        const monster = valueList[value]
        return [monster.name,monster.rank,monster.img]
      }
    }
  }catch(err){
    return undefined
  }
}

 gatya(option,time){
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

async ranking(message){
  const keys = []
  const values = []
  const n_values = []
  const content = []
  const embed = new MessageEmbed()
  .setTitle("各種ランキング一覧:")
  .setDescription("1⃣:プレイヤーレベルランキング\n2⃣:プレイヤー討伐数ランキング\n3⃣:プレイヤーログイン日数ランキング")
  .setColor("RANDOM")
  const msg = await message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
  collector.on('collect', async m => {
    m.delete();
    if(!Number.isInteger(Number(m.content)) || 0 > Number(m.content) || Number(m.content) > 3){
    }else if(m.content == "1"){
      for await(const [key, value] of player_status.iterator()){
        keys.push(key)
        values.push(value[0])
        n_values.push(value[0])
      };
      const newvalues = n_values.sort(function(a,b){
        return Number(b) - Number(a);
      });
      const max = values.length
      for(var i = 0;  i < max; i++){
        const num = values.indexOf(n_values[i])
        content.push(`${i+1}位 \`${client.users.cache.get(keys[num]).tag}\` **Lv.${n_values[i].toLocaleString()}**`)
        keys.splice(num,1);
        values.splice(num,1);
      }
      collector.stop();
    }else if(m.content == "2"){
      for await(const [key, value] of player_status.iterator()){
        if(value[3] != 0){
          keys.push(key)
          values.push(value[3])
          n_values.push(value[3])
        }
      };
      const newvalues = n_values.sort(function(a,b){
        return Number(b) - Number(a);
      });
      const max = values.length
      for(var i = 0;  i < max; i++){
        const num = values.indexOf(n_values[i])
        content.push(`${i+1}位 \`${client.users.cache.get(keys[num]).tag}\` **${n_values[i].toLocaleString()}体**`)
        keys.splice(num,1);
        values.splice(num,1);
      }
    }else if(m.content == "3"){
      for await(const [key, value] of player_items.iterator()){
        if(await func.get_proof_quantity(key,0) != 0){
          keys.push(key)
          values.push(await func.get_proof_quantity(key,0))
          n_values.push(await func.get_proof_quantity(key,0))
        }
      };
      const newvalues = n_values.sort(function(a,b){
        return Number(b) - Number(a);
      });
      const max = values.length
      for(var i = 0;  i < max; i++){
        const num = values.indexOf(n_values[i])
        content.push(`${i+1}位 \`${client.users.cache.get(keys[num]).tag}\` **${n_values[i].toLocaleString()}日**`)
        keys.splice(num,1);
        values.splice(num,1);
      }
    }else{
      msg.edit({ content:"```処理を終了しました。```" })
      collector.stop();
    }
    if(content.length != 0){
      const embed = new MessageEmbed()
      .setTitle("ランキング")
      .setDescription(`>>> ${content.join("\n")}`)
      .setColor("RANDOM")
      msg.edit({ embeds:[embed] })
      collector.stop();
    }
  })
  collector.on('end', async (collected, reason) => {
    if(reason == "idle"){
      msg.edit({ content:"```時間切れです...```" });
    }
  })
}

async exchange(player_id,message){
  let category;
  let title;
  const menu = new MessageEmbed()
  .setTitle("レシピの目次")
  .setDescription("```diff\n+ 1\n最初から作れるアイテム\n+ 2\n少し需要があるアイテム(要作業台)\n+ 3\n序盤武器(要金床)\n\n0:処理終了```")
  .setThumbnail(client.user.displayAvatarURL())
  .setFooter("ページ数を送信してください")
  .setColor("RANDOM")
  const msg = await message.reply({ embeds:[menu], allowedMentions: { parse: [] } })
  const filter = m => m.author.id == message.author.id;
  const collector = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
  collector.on('collect', async m => {
    m.delete();
    if(m.content == "1"){
      category = "normal"
      title = "最初から作れるアイテム"
      collector.stop();
    }else if(m.content == "2"){
      category = "sagyoudai"
      title = "少し需要があるアイテム"
      collector.stop();
    }else if(m.content == "3"){
      category = "kanadoko"
      title = "序盤武器"
      collector.stop();
    }else if(m.content == "0"){
      msg.edit({ content:"```処理を終了しました...```" });
      return collector.stop();
    }
    if(category == undefined){
    }else{
      const recipe = require(`./craft/${category}.json`)[0]
      const r_length = Object.keys(recipe).length
      const recipes_txt = []
      const recipe_menu = new MessageEmbed()
      .setTitle(title)
      .setColor("RANDOM")
      .setFooter("作りたいアイテムの番号を送信してください(0で処理を終了)")
      for(let x=0;x<r_length;x++){
        const target = recipe[`${x+1}`]
        const length = Object.keys(target).length-3
        const msgs = []
        for(let y=0;y<length;y++){
          const info = target[`item_${y+1}`]
          msgs.push(`・${info.name} ${info.quantity}個`)
        }
        recipes_txt.push(`[${x+1}:${target["item_name"]}]\n${msgs.join("\n")}`)
      }
      if(category == "normal"){
        recipe_menu.setDescription(`\`\`\`css\n${recipes_txt.join("\n\n\n")}\`\`\``)
      }else if(category == "sagyoudai"){
        if(await func.get_tool_quantity(message.author.id,"100") != 0){
          recipe_menu.setDescription(`\`\`\`css\n${recipes_txt.join("\n\n\n")}\`\`\``)
        }else{
          recipe_menu.setDescription("```diff\n- 必要なものが揃っていないので開けません```")
          .setFooter("強制終了しました")
          return msg.edit({ embeds:[recipe_menu] })
        }
      }else if(category == "kanadoko"){
        if(await func.get_tool_quantity(message.author.id,"101") != 0){
          recipe_menu.setDescription(`\`\`\`css\n${recipes_txt.join("\n\n\n")}\`\`\``)
        }else{
          recipe_menu.setDescription("```diff\n- 必要なものが揃っていないので開けません```")
          .setFooter("強制終了しました")
          return msg.edit({ embeds:[recipe_menu] })
        }
      }
      msg.edit({ embeds:[recipe_menu] })
      const collector2 = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
      collector2.on('collect', async m => {
        m.delete();
        if((!Number.isInteger(Number(m.content)) || 1 > Number(m.content) || Number(m.content) > r_length) && (m.content != "0")){
        }else if(m.content == "0"){
          msg.edit({ content:"```処理を終了しました...```" });
          return collector2.stop();
        }else{
          collector2.stop()
          const data = recipe[`${m.content}`]
          const i_length = Object.keys(data).length-3
          const msgs = []
          let num
          for(let i=0;i<i_length;i++){
            const info = data[`item_${i+1}`]
            if(info.type == "item"){
              if(info.quantity <= await func.get_item_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await func.get_item_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await func.get_item_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await func.get_item_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await func.get_item_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "material"){
              if(info.quantity <= await func.get_material_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await func.get_material_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await func.get_material_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await func.get_material_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await func.get_material_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "weapon"){
              if(info.quantity <= await func.get_weapon_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await func.get_weapon_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await func.get_weapon_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await func.get_weapon_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await func.get_weapon_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "tool"){
              if(info.quantity <= await func.get_tool_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await func.get_tool_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await func.get_tool_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await func.get_tool_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await func.get_tool_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "proof"){
              if(info.quantity <= await func.get_proof_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await func.get_proof_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await func.get_proof_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await func.get_proof_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await func.get_proof_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }
          }
          const mes = msgs.join("\n")
          const check_embed = new MessageEmbed()
          .setColor("RANDOM")
          if(mes.includes("-")){
            check_embed.setDescription(`\`\`\`fix\n${data["item_name"]}\`\`\`\`\`\`diff\n${mes}\`\`\`\`\`\`diff\n- 素材が不足しています\`\`\``)
            return msg.edit({ embeds:[check_embed] })
          }else{
            check_embed.setDescription(`\`\`\`fix\n${data["item_name"]}\`\`\`\`\`\`diff\n${mes}\n\n\n最大${num}個作成可能(allで一括作成)\`\`\`\`\`\`diff\n+ 作成したい数を数字で送信してください\`\`\``)
            msg.edit({ embeds:[check_embed] })
          }
          const collector3 = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
          collector3.on('collect', async m => {
            m.delete()
            let quant
            if((Number.isInteger(Number(m.content)) || Number(m.content) < 1) && m.content.toLowerCase().includes(["0","all"])){
            }else if(m.content == "0"){
              msg.edit({ content:"```処理を終了しました...```" });
              return collector3.stop();
            }else if(m.content.toLowerCase() == "all"){
              collector3.stop()
              quant = num
            }else{
              collector3.stop()
              quant = Number(m.content)
            }
            if(!quant){
            }else{
              const msgs = []
              for(let i=0;i<i_length;i++){
                const info = data[`item_${i+1}`]
                if(info.type == "item"){
                  if(await func.get_item_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_item_quantity(message.author.id,info.id)} -> ${await func.get_item_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_item_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await func.get_item_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "material"){
                  if(await func.get_material_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_material_quantity(message.author.id,info.id)} -> ${await func.get_material_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_material_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await func.get_material_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "weapon"){
                  if(await func.get_weapon_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_weapon_quantity(message.author.id,info.id)} -> ${await func.get_weapon_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_weapon_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await func.get_weapon_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "tool"){
                  if(await func.get_tool_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_tool_quantity(message.author.id,info.id)} -> ${await func.get_tool_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_tool_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await func.get_tool_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "proof"){
                  if(await func.get_proof_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_proof_quantity(message.author.id,info.id)} -> ${await func.get_proof_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await func.get_proof_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await func.get_proof_quantity(message.author.id,info.id)}個不足`)
                  }
                }
              }
              const n_mes = msgs.join("\n")
              const q_embed = new MessageEmbed()
              .setColor("RANDOM")
              if(n_mes.includes("- ")){
                q_embed.setDescription(`\`\`\`fix\n${data["item_name"]}\`\`\`\`\`\`diff\n${n_mes}\n\n\n${quant}個作成\`\`\`\`\`\`diff\n- 素材が不足しています\`\`\``)
                return msg.edit({ embeds:[q_embed] })
              }else{
                q_embed.setDescription(`\`\`\`fix\n${data["item_name"]}\`\`\`\`\`\`diff\n${n_mes}\n\n\n${quant}個作成\`\`\``)
                .setFooter("ok or 0")
                msg.edit({ embeds:[q_embed] })
                const collector4 = message.channel.createMessageCollector({ filter: filter, idle: 60000 });
                collector4.on('collect', async m => {
                  m.delete()
                  const o_embed = new MessageEmbed()
                  .setDescription(`\`\`\`fix\n「${data["item_name"]}」を${quant}個作りました\`\`\``)
                  .setColor("RANDOM")
                  if(m.content.toLowerCase() == "ok"){
                    collector4.stop()
                    for(let i=0;i<i_length;i++){
                      const info = data[`item_${i+1}`]
                      if(info.type == "item"){
                        await func.consume_item(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "material"){
                        await func.consume_material(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "weapon"){
                        await func.consume_weapon(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "tool"){
                        await func.consume_tool(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "proof"){
                        await func.consume_proof(info.id,info.quantity*quant,message.author.id)
                      }
                    }
                    if(data["item_type"] == "item"){
                      await func.obtain_item(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "material"){
                      await func.obtain_material(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "weapon"){
                      await func.obtain_weapon(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "tool"){
                      await func.obtain_tool(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "proof"){
                      await func.obtain_proof(data["item_id"],quant,message.author.id)
                    }
                    msg.edit({ embeds:[o_embed] })
                  }else if(m.content == "0"){
                    msg.edit({ content:"```処理を終了しました...```" });
                    return collector3.stop();
                  }else{
                  }
                })
                collector4.on('end', async (collected, reason) => {
                  if(reason == "idle"){
                    msg.edit({ content:"```時間切れです...```" });
                  }
                })
              }
            }
          })
          collector3.on('end', async (collected, reason) => {
            if(reason == "idle"){
              msg.edit({ content:"```時間切れです...```" });
            }
          })
        }
      })
      collector2.on('end', async (collected, reason) => {
        if(reason == "idle"){
          msg.edit({ content:"```時間切れです...```" });
        }
      })
    }
  });
  collector.on('end', async (collected, reason) => {
    if(reason == "idle"){
      msg.edit({ content:"```時間切れです...```" });
    }
  })
}
}

module.exports = {
  FUNC: func
}