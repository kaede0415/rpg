# DB保存方法
| DB名 | 要素1 | 要素2 | 要素3 | 要素4 | 要素5 | 要素6 | 要素7 | 
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
|  player_status  |  Level  | HP(leftover) | EXP | Subjugations | Now_in_battle | [talent_array] | ban_status |
| player_items(sozais) | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | ... |
| enemy_status | Level | HP(leftover) | Name | Rank | Image | - | - |
| channel_status | Level | On_battle | [Battler_list] | - | - | - | - |
| lists | [Login_list] | [Ban_list] | - | - | - | - | - |

# 関数一覧
| 関数名 | 必要引数 | 用途 | 関数名 | 必要引数 | 用途 |
|:-----:|:------:|:----:|:-----:|:------:|:---:|
| create_data | option,id | dbとidを指定して定型データを作成 | delete_data | option,id | dbとidを指定してデータを削除 |
| bulk_change | option,instructions | dbに指定した処理を行う(未完成) | splice_status | player_id,start,deleteCount,item1 | 特定のプレイヤーのステータスをstart,deleteCount,item1を指定して置き換え |