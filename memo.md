# DB保存方法
| DB名 | 要素1 | 要素2 | 要素3 | 要素4 | 要素5 | 要素6 | 要素7 | 
|:----:|:----:|:----:|:----:|:----:|:----:|:----:|:----:|
|  player_status  |  Level  | HP(leftover) | EXP | Subjugations | Now_in_battle | [talent_array] | ban_status |
| player_items(sozais) | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | [id,quantity] | ... |
| enemy_status | Level | HP(leftover) | Name | Rank | Image | - | - |
| channel_status | Level | On_battle | [Battler_list] | - | - | - | - |
| lists | [Login_list] | [Ban_list] | - | - | - | - | - |

# 関数一覧
| 関数名 | 必要引数 | 用途 |
|:-----:|:------:|:----:|