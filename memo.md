# DB保存方法
| DB名 | 要素1 | 要素2 | 要素3 | 要素4 | 要素5 | 要素6 | 要素7 | 
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
|  player_status  |  Level  | HP(leftover) | EXP | Subjugations | Now_in_battle | [talent_array] | ban_status |
| player_items(sozais) | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | ... |
| enemy_status | Level | HP(leftover) | Name | Rank | Image | - | - |
| channel_status | Level | On_battle | [Battler_list] | - | - | - | - |
| lists | [Login_list] | [Ban_list] | - | - | - | - | - |

# 関数一覧
| 関数名 | 必要引数 | 主な用途 |
|:-----:|:------:|:-------:|
| create_data | option,id | dbとidを指定して定型データを作成 |
|delete_data | option,id | dbとidを指定してデータを削除 |
| bulk_change | option,instructions | dbに指定した処理を行う(未完成) |
|splice_status | player_id,start,deleteCount,item1 | 特定のプレイヤーのステータスをstart,deleteCount,item1を指定して置き換え |
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
| experiment | player_id,exp |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |
|  |  |  |