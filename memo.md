# DB保存方法
| DB名 | 要素1 | 要素2 | 要素3 | 要素4 | 要素5 | 要素6 | 要素7 | 要素8 | 要素9 |
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:-----:|:----:|
|  player_status  |  Level  | HP(leftover) | EXP | Subjugations | Now_in_battle | [talent_array] | ban_status | weapon_id | [free_coin,paid_coin] |
| player_items | item [[id,quantity],...] | material [[id,quantity],...] | weapon [[id,quantity],...] | tool [[id,quantity],...] | proof [[id,quantity],...] | - | - | - | - |
| enemy_status | Level | HP(leftover) | Name | Rank | Image | - | - | - | - |
| channel_status | Level | On_battle | [Battler_list] | mode | - | - | - | - | - |
| lists | [Login_list] | [Ban_list] | - | - | - | - | - | - | - |

# 関数一覧
| 関数名 | 必要引数 | 主な用途 |
|:-----:|:------:|:-------:|
| create_data | option,id | dbとidを指定して定型データを作成 |
| delete_data | option,id | dbとidを指定してデータを削除 |
| splice_status | player_id,start,deleteCount,item1 | 特定のプレイヤーのステータスをstart,deleteCount,item1を指定して置き換え |
| generate_detection | player_id,message | マクロ検知を生成 |
| ban | player_id | プレイヤーを指定してban |
| unban | player_id | プレイヤーを指定してunban |
| kill | count,player_id,channel_id,message | count体の敵を抹殺 |
| get_item_name | item_id | idを指定してアイテム名を取得 |
| get_sozai_name | sozai_id | idを指定して素材名を取得 |
| get_item_quantity | player_id,item_id | 特定のアイテムを特定のプレイヤーが何個持っているか取得 |
| get_sozai_quantity | player_id,sozai_id | 特定の素材を特定のプレイヤーが何個持っているか取得 |
| obtain_item | item_id,quantity,player_id | 特定のアイテムを個数を指定してプレイヤーに付与 |
| obtain_sozai | sozai_id,quantity,player_id | 特定の素材を個数を指定してプレイヤーに付与 |
| consume_item | item_id,quantity,player_id | 特定のアイテムを個数を指定してプレイヤーから剥奪 |
| obtain_item | item_id,quantity,player_id | 特定の素材を個数を指定してプレイヤーから剥奪 |
| experiment | player_id,exp | 特定のプレイヤーに指定した経験値を付与 |
| win_process | player_id,channel_id,exp | バトルに勝ったときの処理 |
| into_battle | player_id,channe_id | 特定のプレイヤーを特定のチャンネルの戦闘に登録 |
| reset_battle | channel_id,level | 特定のチャンネルの戦闘を次のレベルの差分を指定してリセット |
| inquiry | channel_id,message | そのチャンネルの敵の情報開示コマンド用 |
| talent | player_id,message | タレント変更用コマンド用 |
| get_talent_level | option,player_id | 特定のプレイヤーの特定のタレントのレベルを取得 |
| add_talent_level | option,player_id,value | 特定のプレイヤーの特定のタレントのレベルを追加 |
| training | player_id,message | トレーニングコマンド用 |
| mine | player_id,channel_id | 採掘コマンド用 |
| ranking | message | ランキングコマンド用 |
| exchange | player_id,message | クラフトコマンド用 |
| gatya | option,time | ガチャのレア度と回数を指定してガチャを回す |
| get_monster_rank | channel_id | 特定のチャンネルに出ているモンスターのランクを取得 |
| generate_monster | rank | ランクを指定してモンスターの情報を登録 |
|  |  |  |
|  |  |  |
