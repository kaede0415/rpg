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
const prefix = "_"
const cmd_list = ["help","status","st","attack","atk","item","i","in","reset","re","rs","inquiry","inq","weapon","we","talent","ranking","rank","training","t","mine","gatya","gacha","xgatya","xgacha","craft","c","changemode","cm","summon","ban","unban","banlist","kill","itemid","ii","materialid","mi","weaponid","wi","toolid","ti","proofid","pi","consumeitem","ci","consumematerial","cma","consumeweapon","cw","consumetool","ct","consumeproof","cp","register_info","ri","exp","eval","db","bulkdb"]
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
//const dbFiles = fs.readdirSync('./').filter(file => file.endsWith('.sqlite'));

function admin_or_player(id){
  if(admin_list.includes(id)) return "admin"
  else return "```diff\n- お前は誰だ？```"
}

function json_key_length(folder,file){
  let json_name
  if(folder == "none"){
    json_name = `./${file}.json`
  }else{
    json_name = `./${folder}/${file}.json`
  }
  const json = require(json_name)
  return Object.keys(json).length
}

async function get_channel_mode(channel_id){
  const status = await channel_status.get(channel_id)
  if(!status) return false
  return status[3]
}

function monster_count(){
  const array = []
  array.push(json_key_length("monsters","zyakuteki"))
  array.push(json_key_length("monsters","normal"))
  array.push(json_key_length("monsters","kyouteki"))
  array.push(json_key_length("monsters","super_kyouteki"))
  array.push(json_key_length("monsters","kiwami"))
  array.push(json_key_length("monsters","rare"))
  array.push(json_key_length("monsters","super_rare"))
  array.push(json_key_length("monsters","super_ultra_rare"))
  array.push(json_key_length("monsters","maboroshi"))
  const reducer = (sum,currentValue) => sum + currentValue
  array.push(array.reduce(reducer))
  return array
}

function item_count(){
  const array = []
  array.push(json_key_length("items","item"))
  array.push(json_key_length("items","material"))
  array.push(json_key_length("items","weapon"))
  array.push(json_key_length("items","tool"))
  array.push(json_key_length("items","proof"))
  const reducer = (sum,currentValue) => sum + currentValue
  array.push(array.reduce(reducer))
  return array
}

async function splice_status(option,id,start,item){
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
}

async function create_data(option,id){
  if(option == "player"){
    await player_status.set(id,[100,550,10000,0,false,[0,0,0,0,0],0,[0,0]])
    await player_items.set(id,[[],[],[["0",1]],[],[]])
  }else if(option == "monster"){
    const info = generate_monster("random")
    const array = [1,60].concat(info)
    await monster_status.set(id,array)
  }else if(option == "channel"){
    await channel_status.set(id,[1,false,[],"normal"])
  }else{
    return false
  }
}

async function generate_detection(player_id,message){
  let status = await player_status.get(player_id)
  const deru = await get_proof_quantity(player_id,999)
  const denai = await get_proof_quantity(player_id,-999)
  let probability = 0.001
  if(denai >= 1){
    probability = 0
  }else if(deru => 1){
    probability = probability + (deru * 0.001)
  }
  if(Math.random() < probability){
    await splice_status("player_status",player_id,6,true)
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
        await splice_status("player_status",player_id,6,false)
        clearTimeout(timer);
      }
      if(interaction.customId == `${random_2}`){
        interaction.message.edit({ embeds: [x_embed], components: [] })
        interaction.reply({ content: "あなたはBOTだと判断されました。", ephemeral: true })
        await splice_status("player_status",player_id,6,false)
        await ban(player_id)
        clearTimeout(timer);
      }
    });
    const timer = setTimeout(async () => {
      msg.edit({ embeds: [t_embed], components: [] })
      await ban(player_id)
      await splice_status("player_status",player_id,6,false)
    },1000*60);
    return;
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

async function ban(player_id){
  const list = await lists.get(client.user.id)
  const ban_list = list[1]
  if(ban_list.includes(player_id) || client.users.cache.get(player_id) == undefined){
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
  if(index == -1 || client.users.cache.get(player_id) == undefined){
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
  const atk_talent = await get_talent_level("攻撃力",player_id)
  const player_attack = get_player_attack(player_level*(1+0.01*atk_talent),random) * get_weapon_abi(await get_equipped_weapon(player_id))
  monster_hp -= player_attack
  const attack_message = get_attack_message(player_name,player_attack,monster_name,monster_level,monster_hp,random)
  if(monster_hp <= 0){
    const win_message = await win_process(player_id,channel_id,monster_level)
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
    .setColor("RANDOM")
    const mode = await get_channel_mode(channel_id)
    if(mode == "normal"){
      embed2.setImage(m_img)
    }else if(mode == "debug"){
      const id = get_monster_id(m_rank,m_name)
      embed2.setImage(m_img)
      .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
    }
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
  let id = message.author.id
  if(!item_name || await player_items.get(item_name) || message.mentions.members.size != 0){
    if(message.mentions.members.size != 0){
      id = message.mentions.members.first().id
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      if(!await player_items.get(id)){
        return message.reply({ content: "そのプレイヤーのデータは見つかりませんでした", allowedMentions: { parse: [] } })
      }
    }else if(await player_items.get(item_name)){
      id = item_name
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
    }
    const items = await player_items.get(id)
    const p_items = items[0]
    const p_materials = items[1]
    const p_weapons = items[2]
    const p_tools = items[3]
    const p_proofs = items[4]
    const player = client.users.cache.get(id)
    const comparefunction = function(a,b){
      return a[0] - b[0]
    }
    if(p_items){
      p_items.sort(comparefunction)
    }
    if(p_materials){
      p_materials.sort(comparefunction)
    }
    if(p_weapons){
      p_weapons.sort(comparefunction)
    }
    if(p_tools){
      p_tools.sort(comparefunction)
    }
    if(p_proofs){
      p_proofs.sort(comparefunction)
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
      const item_name = get_item_name(p_items[i][0])
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
      const material_name = get_material_name(p_materials[i][0])
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
      const weapon_name = get_weapon_name(p_weapons[i][0])
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
      const tool_name = get_tool_name(p_tools[i][0])
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
      const proof_name = get_proof_name(p_proofs[i][0])
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
    .setDescription(`>>> ${item_name}のデータは見つかりませんでした`)
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
    const win_message = await win_process(player_id,channel_id,monster_level)
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
    .setColor("RANDOM")
    const mode = await get_channel_mode(channel_id)
    if(mode == "normal"){
      embed2.setImage(m_img)
    }else if(mode == "debug"){
      const id = get_monster_id(m_rank,m_name)
      embed2.setImage(m_img)
      .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
    }
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
  if(await get_monster_rank(channel_id) == "【極】"){
    const embed = new MessageEmbed()
    .setDescription(">>> この敵に気は通用しない...!")
    .setColor("RANDOM")
    return message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
  }
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
  const win_message = await win_process(player_id,channel_id,monster_level)
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
  .setColor("RANDOM")
  const mode = await get_channel_mode(channel_id)
  if(mode == "normal"){
    embed2.setImage(m_img)
  }else if(mode == "debug"){
    const id = get_monster_id(m_rank,m_name)
    embed2.setImage(m_img)
    .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
  }
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
  let atk_msg = `+ ビッグバン！${monster_name}に${damage.toLocaleString()}ダメージを与えた！\n! 先の50体の敵が吹っ飛んだ！`
  if(monster_hp <= 0){
    const win_message = await win_process(player_id,channel_id,monster_level)
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
    .setColor("RANDOM")
    const mode = await get_channel_mode(channel_id)
    if(mode == "normal"){
      embed2.setImage(m_img)
    }else if(mode == "debug"){
      const id = get_monster_id(m_rank,m_name)
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
}

async function kill(count,player_id,channel_id,message){
  const intobattle = await into_battle(player_id,channel_id)
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
  await reset_battle(channel_id,count)
  const m_info = await monster_status.get(channel_id)
  const m_level = m_info[0]
  const m_hp = m_info[1]
  const m_name = m_info[2]
  const m_rank = m_info[3]
  const m_img = m_info[4]
  const embed2 = new MessageEmbed()
  .setTitle(`ランク:${m_rank}\n${m_name}が待ち構えている...！\nLv.${m_level.toLocaleString()} HP:${m_hp.toLocaleString()}`)
  .setColor("RANDOM")
  const mode = await get_channel_mode(channel_id)
  if(mode == "normal"){
    embed2.setImage(m_img)
  }else if(mode == "debug"){
    const id = get_monster_id(m_rank,m_name)
    embed2.setImage(m_img)
    .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
  }
  message.reply({ content:`\`\`\`diff\n${atk_msg}\`\`\``, embeds:[embed,embed2], allowedMentions: { parse: [] } })
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
  itemList[0].forEach(x => {
    if(x[0] == item_id){
      quantity = x[1]
    }
  })
  if(quantity) return quantity
  else return 0
}

async function get_material_quantity(player_id,item_id){
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

async function get_weapon_quantity(player_id,item_id){
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

async function get_tool_quantity(player_id,item_id){
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

async function get_proof_quantity(player_id,item_id){
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

function get_item_name(id){
  const hoge = JSON.parse(JSON.stringify(item_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

function get_material_name(id){
  const hoge = JSON.parse(JSON.stringify(material_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

function get_weapon_name(id){
  const hoge = JSON.parse(JSON.stringify(weapon_json))
  const valueList = Object.values(hoge)
  for(let i=0;i<valueList.length;i++){
    if(valueList[i].id == id){
      return `${valueList[i].name}`
    }
  }
  return undefined
}

function get_tool_name(id){
  const hoge = JSON.parse(JSON.stringify(tool_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

function get_proof_name(id){
  const hoge = JSON.parse(JSON.stringify(proof_json))
  const keyList = Object.keys(hoge)
  for(let key in keyList){
    if(keyList[key] == id){
      return `${hoge[keyList[key]]}`
    }
  }
  return undefined
}

async function obtain_item(item_id,quantity,player_id){
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

async function consume_item(item_id,quantity,player_id){
  if(get_item_name(item_id) == undefined) return console.log("error")
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

async function obtain_material(item_id,quantity,player_id){
  if(get_material_name(item_id) == undefined) return console.log("error")
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

async function consume_material(item_id,quantity,player_id){
  if(get_material_name(item_id) == undefined) return console.log("error")
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

async function obtain_weapon(item_id,quantity,player_id){
  if(get_weapon_name(item_id) == undefined) return console.log("error")
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

async function consume_weapon(item_id,quantity,player_id){
  if(get_weapon_name(item_id) == undefined) return console.log("error")
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

async function obtain_tool(item_id,quantity,player_id){
  if(get_tool_name(item_id) == undefined) return console.log("error")
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

async function consume_tool(item_id,quantity,player_id){
  if(get_tool_name(item_id) == undefined) return console.log("error")
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

async function obtain_proof(item_id,quantity,player_id){
  if(get_proof_name(item_id) == undefined) return console.log("error")
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

async function consume_proof(item_id,quantity,player_id){
  if(get_proof_name(item_id) == undefined) return console.log("error")
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

async function win_process(player_id,channel_id,exp){
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
    const exp_talent = await get_talent_level("経験値",player_id)
    if(rank == "【強敵】"){
      expcalc = expcalc*(2+exp_talent*0.02)
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
      expcalc = expcalc*(5+exp_talent*0.02)
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
    }else if(rank == "【極】"){
      expcalc = expcalc*(10+exp_talent*0.02)
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await obtain_item("3",1,members[i])
      item_members.push(`<@${members[i]}>は気を**1個**手に入れた！`)
      await obtain_item("4",1,members[i])
      if(Math.random() <= 0.3){
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
      expcalc = expcalc*(10+exp_talent*0.02)
    }else if(rank == "【激レア】"){
      expcalc = expcalc*(100+exp_talent*0.02)
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
      expcalc = expcalc*(1000+exp_talent*0.02)
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
    }else if(rank == "【幻】"){
      expcalc = expcalc*(10000+exp_talent*0.02)
      item_members.push(`<@${members[i]}>はエリクサーを**1個**手に入れた！`)
      await obtain_item("1",1,members[i])
      item_members.push(`<@${members[i]}>はファイアボールの書を**1個**手に入れた！`)
      await obtain_item("2",1,members[i])
      item_members.push(`<@${members[i]}>は祈りの書を**1個**手に入れた！`)
      await obtain_item("3",1,members[i])
      item_members.push(`<@${members[i]}>は100円硬貨を**1個**手に入れた！`)
      await obtain_item("100000",1,members[i])
      item_members.push(`<@${members[i]}>は気を**1個**手に入れた！`)
      if(Math.random() <= 0.5){
        item_members.push(`<@${members[i]}>は超新星爆発を**1個**手に入れた！`)
        await obtain_item("5",1,members[i])
      }
      if(Math.random() <= 0.5 && i==0){
        const number = Math.floor( Math.random() * members.length )
        item_members.push(`<@${members[number]}>は幻の証を**1個**手に入れた！`)
        await obtain_proof("-100002",1,members[number])
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
      expcalc = expcalc*(1+exp_talent*0.02)
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
    await create_data("channel",channel_id)
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
    if(nowrank != "【強敵】" && nowrank != "【超強敵】" && nowrank != "【極】"){
      info = generate_monster("normal")
    }else{
      if(nowrank == "【強敵】"){
        info = generate_monster("kyouteki")
      }else if(nowrank == "【超強敵】"){
        info = generate_monster("super_kyouteki")
      }else if(nowrank == "【極】"){
        info = generate_monster("kiwami")
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
      info = generate_monster("kiwami")
    }else if(boss_level % 50 == 0){
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

async function change_mode(channel_id,option){
  const status = await channel_status.get(channel_id)
  if(option == "normal"){
    await splice_status("channel_status",channel_id,3,"normal")
  }else if(option == "hihyozi"){
    await splice_status("channel_status",channel_id,3,"hihyozi")
  }else if(option == "debug"){
    await splice_status("channel_status",channel_id,3,"debug")
  }else{
    return false
  }
}

async function get_mode(channel_id){
  const status = await channel_status.get(channel_id)
  return status[3]
}

async function get_equipped_weapon(player_id){
  const status = await player_status.get(player_id)
  if(status){
    return status[7]
  }else{
    return false
  }
}

function get_weapon_abi(id){
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

function get_weapon_outline(id){
  const hoge = JSON.parse(JSON.stringify(weapon_json))
  const valueList = Object.values(hoge)
  for(let i=0;i<valueList.length;i++){
    if(valueList[i].id == id){
      return `${valueList[i].outline}`
    }
  }
  return undefined
}

async function weapon_list(player_id){
  const items = await player_items.get(player_id)
  const weapons = items[2]
  const ids = []
  const msgs = []
  for(let i=0;i<weapons.length;i++){
    const id = weapons[i][0]
    ids.push(id)
    msgs.push(`[${id}:${get_weapon_name(id)}]`)
  }
  return [ids,msgs]
}

async function weapon(player_id,message){
  const list = await weapon_list(player_id)
  const embed = new MessageEmbed()
  .setTitle(`現在は「${get_weapon_name(await get_equipped_weapon(player_id))}」`)
  .setDescription(`<@${player_id}>\`\`\`css\n${list[1].join("\n")}\`\`\`\`\`\`js\n${get_weapon_outline(await get_equipped_weapon(player_id))}\`\`\``)
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
      .setDescription(`\`\`\`diff\n+ 武器を「${get_weapon_name(m.content)}」に変更しました\`\`\`\`\`\`js\n${get_weapon_outline(m.content)}\`\`\``)
      .setColor("RANDOM")
      msg.edit({ embeds:[emb] })
      await splice_status("player_status",player_id,7,Number(m.content))
    }
  })
  collector.on('end', async (collected, reason) => {
    if(reason == "idle"){
      msg.edit({ content:"```時間切れです...```" });
    }
  })
}

async function talent(player_id,message){
  const player_name = client.users.cache.get(player_id).username
  const status = await player_status.get(player_id)
  const talents = status[5]
  const embed = new MessageEmbed()
  .setDescription(`\`\`\`md\n[${player_name}](合計Lv.${await get_talent_level("all",player_id)}/Lv.50)\`\`\`\`\`\`css\n[1.体力] ${talents[0]}\n[2.攻撃力] ${talents[1]}\n[3.防御力] ${talents[2]}\n[4.盗み力] ${talents[3]}\n[5.経験値] ${talents[4]}\`\`\``)
  .setFooter("上げたいタレントの数字を送信してください")
  .setColor("RANDOM")
  if(await get_talent_level("all",player_id) >= 50){
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
      if(await get_talent_level("all",player_id)+Number(m.content) > 50){
        return msg.edit({ content: "```上限を超えているため処理を停止しました...```" })
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
  await obtain_material("1",w_quantity,player_id)
  if(Math.random() < 0.5){
    comment.push(`+ 丸石: ${s_quantity}個`)
    await obtain_material("2",s_quantity,player_id)
  }
  if(Math.random() < 0.25){
    comment.push(`+ 鉄: ${s_quantity}個`)
    await obtain_material("3",s_quantity,player_id)
  }
  if(Math.random() < 0.5){
    comment.push(`+ 石炭: ${s_quantity}個`)
    await obtain_material("5",s_quantity,player_id)
  }
  if(Math.random() < 0.1){
    comment.push(`+ ダイヤモンド: ${s_quantity}個`)
    await obtain_material("4",s_quantity,player_id)
  }
  return comment
}

async function get_monster_rank(channel_id){
  const m_info = await monster_status.get(channel_id)
  return m_info[3]
}

function get_monster_id(monster_rank,monster_name){
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

function summon_monster(rank,id){
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

async function ranking(message){
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
        if(await get_proof_quantity(key,0) != 0){
          keys.push(key)
          values.push(await get_proof_quantity(key,0))
          n_values.push(await get_proof_quantity(key,0))
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

async function exchange(player_id,message){
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
        if(await get_tool_quantity(message.author.id,"100") != 0){
          recipe_menu.setDescription(`\`\`\`css\n${recipes_txt.join("\n\n\n")}\`\`\``)
        }else{
          recipe_menu.setDescription("```diff\n- 必要なものが揃っていないので開けません```")
          .setFooter("強制終了しました")
          return msg.edit({ embeds:[recipe_menu] })
        }
      }else if(category == "kanadoko"){
        if(await get_tool_quantity(message.author.id,"101") != 0){
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
              if(info.quantity <= await get_item_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await get_item_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await get_item_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await get_item_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await get_item_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "material"){
              if(info.quantity <= await get_material_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await get_material_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await get_material_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await get_material_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await get_material_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "weapon"){
              if(info.quantity <= await get_weapon_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await get_weapon_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await get_weapon_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await get_weapon_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await get_weapon_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "tool"){
              if(info.quantity <= await get_tool_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await get_tool_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await get_tool_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await get_tool_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await get_tool_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                num = 0
              }
            }else if(info.type == "proof"){
              if(info.quantity <= await get_proof_quantity(message.author.id,info.id)){
                msgs.push(`+ ${info.name}: ${info.quantity}個 | 所有:${await get_proof_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
                if(!num || await get_proof_quantity(message.author.id,info.id)/info.quantity < num){
                  num = Math.floor(await get_proof_quantity(message.author.id,info.id)/info.quantity)
                }
              }else{
                msgs.push(`- ${info.name}: ${info.quantity}個 | 所有:${await get_proof_quantity(message.author.id,info.id)} 必要:${info.quantity}個`)
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
                  if(await get_item_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await get_item_quantity(message.author.id,info.id)} -> ${await get_item_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await get_item_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await get_item_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "material"){
                  if(await get_material_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await get_material_quantity(message.author.id,info.id)} -> ${await get_material_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await get_material_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await get_material_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "weapon"){
                  if(await get_weapon_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await get_weapon_quantity(message.author.id,info.id)} -> ${await get_weapon_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await get_weapon_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await get_weapon_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "tool"){
                  if(await get_tool_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await get_tool_quantity(message.author.id,info.id)} -> ${await get_tool_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await get_tool_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await get_tool_quantity(message.author.id,info.id)}個不足`)
                  }
                }else if(info.type == "proof"){
                  if(await get_proof_quantity(message.author.id,info.id)-info.quantity*quant >= 0){
                    msgs.push(`+ ${info.name}: ${info.quantity*quant}個 | 所有:${await get_proof_quantity(message.author.id,info.id)} -> ${await get_proof_quantity(message.author.id,info.id)-info.quantity*quant}個`)
                  }else{
                    msgs.push(`- ${info.name}: ${info.quantity*quant}個 | 所有:${await get_proof_quantity(message.author.id,info.id)} -> ${info.quantity*quant-await get_proof_quantity(message.author.id,info.id)}個不足`)
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
                        await consume_item(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "material"){
                        await consume_material(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "weapon"){
                        await consume_weapon(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "tool"){
                        await consume_tool(info.id,info.quantity*quant,message.author.id)
                      }else if(info.type == "proof"){
                        await consume_proof(info.id,info.quantity*quant,message.author.id)
                      }
                    }
                    if(data["item_type"] == "item"){
                      await obtain_item(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "material"){
                      await obtain_material(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "weapon"){
                      await obtain_weapon(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "tool"){
                      await obtain_tool(data["item_id"],quant,message.author.id)
                    }else if(data["item_type"] == "proof"){
                      await obtain_proof(data["item_id"],quant,message.author.id)
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
      await create_data("player",message.author.id)
    }
    if(ban_list.includes(message.author.id) && !admin_list.includes(message.author.id) && !["help"].includes(command)){
      return message.reply({ content: "BANされてますよ...?", allowedMentions: { parse: [] } })
    }else if(p_status[6] == true){
      return message.reply({ content: "質問に答えてください。", allowedMentions: { parse: [] } })
    }
    if(!login_list.includes(message.author.id)){
      const day = await get_proof_quantity(message.author.id,0)+1
      const elength = day+29
      const flength = day*3+52
      const plength = day*3+42
      const tlength = day+10
      const embed = new MessageEmbed()
      .setDescription(`>>> **ログイン${day}日目です。\nログボをゲットしました！！！**\`\`\`ゲットした物:\n   冒険の証:1個\n   エリクサー:${elength}個\n   ファイアボールの書:${flength}個\n   祈りの書:${plength}個\n   100円硬貨:${tlength}個\`\`\``)
      .setThumbnail(client.user.displayAvatarURL())
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
      await obtain_proof("0",1,message.author.id)
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
    await generate_detection(message.author.id,message)
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
      const error_msg = admin_or_player(message.author.id)
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
      await _attack(message.author.id,message.channel.id,message)
    }
    if(["item","i"].includes(command)){
      const item_name = message.content.split(" ")[1]
      await _item(message.channel.id,item_name,message.mentions.members.first(),message)
    }
    if(["in"].includes(command)){
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
    if(["training","t"].includes(command)){
      await training(message.author.id,message)
    }
    if(["reset","re","rs"].includes(command)){
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
    if(["inquiry","inq"].includes(command)){
      await inquiry(message.channel.id,message)
    }
    if(["gatya","gacha"].includes(command)){
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
        }else if(result[i][2] == "material"){
          await obtain_material(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "weapon"){
          await obtain_weapon(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "tool"){
          await obtain_tool(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "proof"){
          await obtain_proof(result[i][3],result[i][4],message.author.id)
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
        time = Number(await get_item_quantity(message.author.id,100001))
      }else if(time == 0){
        return message.reply({ content: "がちゃちけないやん" })
      }else{
        time = Number(time)
      }
      if(await get_item_quantity(message.author.id,100001) < time){
        return message.reply({ content: "がちゃちけがたりん！" })
      }
      message.reply({ content: "```diff\n+ ガチャを引き終わるまでしばらくお待ち下さい```" })
      await consume_item("100001",time,message.author.id)
      const result = gatya("rare",time)
      const msgs = []
      for(let i=0;i<result.length;i++){
        if(result[i][2] == "item"){
          await obtain_item(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "material"){
          await obtain_material(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "weapon"){
          await obtain_weapon(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "tool"){
          await obtain_tool(result[i][3],result[i][4],message.author.id)
        }else if(result[i][2] == "proof"){
          await obtain_proof(result[i][3],result[i][4],message.author.id)
        }
        msgs.push(`\`\`\`${result[i][0]}${result[i][1]}\`\`\`->${result[i][4]}個`)
      }
      const embed = new MessageEmbed()
      .setTitle(`ガチャ結果${time}枚`)
      .setDescription(msgs.join("\n"))
      message.channel.send({ embeds:[embed] })
    }
    if(["weapon","we"].includes(command)){
      await weapon(message.author.id,message)
    }
    if(["changemode","cm"].includes(command)){
      const role = admin_or_player(message.author.id)
      const mode = await get_mode(message.channel.id)
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
            await change_mode(message.channel.id,"normal")
          }else if(m.content == "2"){
            embed2.setDescription("チャンネルのモードを非表示に変更しました")
            msg.edit({ embeds:[embed2], allowedMentions: { parse: [] } })
            collector.stop();
            await change_mode(message.channel.id,"hihyozi")
          }else if(m.content == "3"){
            embed2.setDescription("チャンネルのモードをデバッグに変更しました")
            msg.edit({ embeds:[embed2], allowedMentions: { parse: [] } })
            collector.stop();
            await change_mode(message.channel.id,"debug")
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
          await change_mode(message.channel.id,"hihyozi")
          comment = `<#${message.channel.id}>の敵画像表示を非表示に変更しました`
        }else if(mode == "hihyozi"){
          await change_mode(message.channel.id,"normal")
          comment = `<#${message.channel.id}>の敵画像表示を表示に変更しました`
        }else if(mode == "debug"){
          await change_mode(message.channel.id,"normal")
          comment = `<#${message.channel.id}>の敵画像表示を表示に変更しました`
        }
        const embed = new MessageEmbed()
        .setDescription(comment)
        .setColor("RANDOM")
        message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
      }
    }
    if(["mine"].includes(command)){
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
    if(["craft","c"].includes(command)){
      await exchange(message.author.id,message)
    }
    if(["talent"].includes(command)){
      await talent(message.author.id,message)
    }
    if(["ranking","rank"].includes(command)){
      await ranking(message)
    }
    if(["itemid","ii"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await obtain_item(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_item_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumeitem","ci"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await consume_item(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["materialid","mi"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await obtain_material(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_material_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumematerial","cma"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await consume_material(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["weaponid","wi"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await obtain_weapon(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_weapon_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumeweapon","cw"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await consume_weapon(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["toolid","ti"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await obtain_tool(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_tool_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumetool","ct"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await consume_tool(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["proofid","pi"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await obtain_proof(itemId,quantity,player)
      message.reply({ content: `\`${client.users.cache.get(player).username}\`は\`ID:${itemId}:${get_proof_name(itemId)}\`を\`${quantity.toLocaleString()}\`個手に入れた！`, allowedMentions: { parse: [] } })
    }
    if(["consumeproof","cp"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      await consume_proof(itemId,quantity,player)
      message.reply({ content: "unco", allowedMentions: { parse: [] } })
    }
    if(["exp"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const player_id = message.content.split(" ")[1]
      const exp = Number(message.content.split(" ")[2])
      const levelup_msg = await experiment(player_id,exp)
      const embed = new MessageEmbed()
      .setDescription(`<@${player_id}>に${exp.toLocaleString()}EXPを付与しました\n${levelup_msg}`)
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["monstergen"].includes(command)){
      let rank = message.content.slice(prefix.length+11)
      const info = generate_monster(rank)
      const embed = new MessageEmbed()
      .setTitle(`ランク:${info[1]}\n${info[0]}が待ち構えている...！\nLv.0 HP:0`)
      .setImage(info[2])
      .setColor("RANDOM")
      message.channel.send({ embeds:[embed] })
    }
    if(["summon"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const rank = message.content.split(" ")[1]
      const id = Number(message.content.split(" ")[2])
      const level = Number(message.content.split(" ")[3])
      const hp = level*10+50
      const info = summon_monster(rank,id,level)
      if(info == undefined){
        return message.reply({ content: "undefined", allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setTitle(`ランク:${info[1]}\n${info[0]}が待ち構えている...！\nLv.${level.toLocaleString()} HP:${hp.toLocaleString()}`)
      .setColor("RANDOM")
      const mode = await get_channel_mode(message.channel.id)
      if(mode == "normal"){
        embed.setImage(info[2])
      }else if(mode == "debug"){
        const id = get_monster_id(info[1],info[0])
        embed.setImage(info[2])
        .setFooter(`ファイル名:${id[0]} | モンスターid:${id[1]}`)
      }
      message.channel.send({ embeds:[embed] })
      await monster_status.set(message.channel.id,[level,hp].concat(info))
    }
    if(["ban"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      if(await ban(player) == false){
        return message.reply({ content: "不正", allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setDescription(`${client.users.cache.get(player).tag}をBANしました`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["unban"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      if(await unban(player) == false){
        return message.reply({ content: "不正", allowedMentions: { parse: [] } })
      }
      const embed = new MessageEmbed()
      .setDescription(`${client.users.cache.get(player).tag}をUNBANしました`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["banlist"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      let count = message.content.slice(prefix.length+5).trim()
      if(count == "" || !Number.isInteger(Number(count))){
        count = 1
      }else{
        count = Number(count)
      }
      await kill(count,message.author.id,message.channel.id,message)
    }
    if(["register_info","ri"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      const monster = monster_count()
      const item = item_count()
      const embed = new MessageEmbed()
      .setTitle("各種登録情報")
      .addField("モンスター",`弱敵:${monster[0]}体\n通常:${monster[1]}体\n強敵:${monster[2]}体\n超強敵:${monster[3]}体\n極:${monster[4]}体\nレア:${monster[5]}体\n激レア:${monster[6]}体\n超激レア:${monster[7]}体\n幻:${monster[8]}体\n合計:${monster[9]}体`,true)
      .addField("所持品関連",`アイテム:${item[0]}種類\n素材:${item[1]}種類\n武器:${item[2]}種類\nツール:${item[3]}種類\n証:${item[4]}種類\n合計:${item[5]}種類`,true)
      .addField("コマンド数",`${cmd_list.length}`)
      .setColor("RANDOM")
      message.reply({ embeds:[embed], allowedMentions: { parse: [] } })
    }
    if(["eval"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
      if(error_msg != "admin") return message.reply({ content: error_msg, allowedMentions: { parse: [] } })
      var result = message.content.slice(prefix.length+5).trim();
      let evaled = eval(result);
      message.channel.send(evaled)
      message.react("✅")
    }
    if(["db"].includes(command)){
      const error_msg = admin_or_player(message.author.id)
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
