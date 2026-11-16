# Kitten Kaboom — Render 独立部署版

这是普通网站版本，不需要 ChatGPT、Sites、Cloudflare 账号或 ChatGPT 登录。前端、卡牌图片、游戏规则和服务器都包含在本项目里。

## 已包含

- 普通版 2–5 人；Party Pack 2–10 人，按规则自动配置牌组。
- 独立主页（Logo + PLAY）和第二页（模式选择、Host、Join Friend）；邀请链接直达加入页。
- 房间码、分享链接、私密手牌、AI 机器人。
- 深红色牌桌、发牌动画、自动配对和回合高亮。
- Nope 连锁、指定攻击、改变未来、底部抽牌、万能猫。
- 猫咪专属组合：只有同种猫咪牌（派对版可加万能猫）能两张或三张一起出；所有功能牌单张生效，不启用“任意同名牌组合”的可选规则。
- 房主发起结束投票，全体真人同意才返回大厅。
- Node.js 独立后端；内存或 PostgreSQL 两种存储。

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/AceShadow9323/kitten-kaboom)

点击上面的按钮，登录 Render 并确认 Free 配置即可开始部署。

## 最简单：免费部署到 Render

1. 在 GitHub 建立一个仓库，上传本目录中的文件。**package.json、render.yaml、game、server 和 artwork 必须在仓库根目录，不能再套一层文件夹。** 私有仓库也可以使用；在 Render 中授权访问它即可。
2. 打开 https://dashboard.render.com/ ，选择 **New → Blueprint**，连接该 GitHub 仓库。
3. 使用默认的 `render.yaml`，确认套餐是 **Free**，然后创建。
4. 部署完成后，打开 Render 返回的 `https://你的服务名.onrender.com`。
5. 创建房间，把房间邀请链接发给朋友即可。无需登录游戏或 ChatGPT。

默认配置只创建一个免费 Web Service，不创建付费数据库。具体可用额度和免费计划要求以 Render 账号界面为准。

### 也可以手动创建 Web Service

| 设置 | 值 |
| --- | --- |
| Runtime | Node |
| Root Directory | 留空（项目文件放在仓库根目录） |
| Build Command | `npm ci --omit=dev` |
| Start Command | `npm start` |
| Instance Type | Free |
| Health Check Path | `/healthz` |
| Environment | `NODE_ENV=production`, `ROOM_STORE=memory`, `TRUST_PROXY=1` |

Render 自动提供 `PORT` 和 HTTPS，不要把服务端口写死。自定义域名可以之后在 Render 的 Settings → Custom Domains 添加。

## 免费内存版的实际限制

- 房间保存在单个服务器的内存中；休眠、重启或重新部署后，旧房间会消失，需要重新建房。
- Render 免费服务在约 15 分钟没有访问后可能休眠，再次打开通常需要等待约一分钟。活跃玩家的同步请求会保持正常游戏活动。
- 内存版只适合单实例，不要横向扩容。没有账户、积分或长期个人数据。
- 24 小时无游戏动作的房间会被清理。

## 可选：PostgreSQL 持久存储

若希望服务器重启后继续访问房间，使用 `render.postgres.yaml` 作为 Blueprint 文件路径（创建 Blueprint 时选择该路径）。它配置免费 Web Service 和免费 Render Postgres。

**Render 的免费 Postgres 在创建 30 天后到期。** 如果需要长期存储，请自行在 Render 选择付费数据库；本项目不会自动升级或收费。

也可以连接已有 PostgreSQL，在 Web Service 的 Environment 中设置：

```text
ROOM_STORE=postgres
DATABASE_URL=你的数据库连接地址
```

将 `DATABASE_URL` 只放在 Render 的环境变量/Secrets 中，不要提交到 GitHub。数据库要求验证 TLS 时设置 `PGSSLMODE=require`；Render Blueprint 默认使用数据库的内部连接地址。

服务器启动时会建立自己使用的 `game_rooms` 表。每个房间的操作使用数据库事务和行锁，避免多人同时操作覆盖状态。过期房间在 24 小时无游戏动作后清理。

## 本地运行

需要 Node.js 22.13+（推荐 Node.js 24）。

```bash
npm ci
npm start
```

打开 http://localhost:3000 。本地默认使用内存存储，不需要数据库。测试和检查：

```bash
npm test
npm run check
```

如果要测试 PostgreSQL，请先在系统环境中设置 `ROOM_STORE=postgres`、`DATABASE_URL`，然后运行 `npm start`。项目不会自动加载 `.env`；Node.js 24 也可以使用 `node --env-file=.env server/index.mjs`。

## 项目结构

- `server/index.mjs`：启动、Render 端口、关机处理。
- `server/app.mjs`：网页、图片和房间 HTTP API。
- `server/storage.mjs`：内存互斥锁和 PostgreSQL 事务存储。
- `game/game.mjs`：规则和机器人。
- `game/ui.mjs`：网页界面。
- `artwork/`：本地卡牌图片；来源记录在 `sources.json`。
- `render.yaml`：默认免费部署。
- `render.postgres.yaml`：可选 PostgreSQL 部署。

## 图片与规则

独立粉丝项目，不代表 Exploding Kittens 官方。卡牌图片与品牌归其权利人所有；参考来源为用户指定的 https://explodi.ng/ 及规则 PDF，详见 `artwork/sources.json`。本项目附带的是游戏代码和部署配置，不授予第三方素材的额外权利。

## 本次验证范围

已通过 72 项本地测试，包括完整规则测试、2–10 人模拟、独立 HTTP 建房/加入/开局、并发操作互斥、私密手牌、AI、结束投票、头像同步和回合倒计时。新房间默认每次抽牌回合 30 秒；房主可在大厅关闭计时或选择 30/60/90/120 秒，超时自动抽牌，NOPE 窗口和结束投票暂停。赠牌、拆弹放回和调整未来超时也会自动完成。房主还可分别开启完整弃牌记录和炸弹风险仪表盘，默认关闭；风险为抽牌堆剩余炸弹数 / 剩余牌数，不透露牌序。关闭弃牌记录时，API 只返回顶张弃牌和总数。PostgreSQL 适配器已提供，但尚未连接真实 PostgreSQL 验证；云端部署和数据库连接需要在你的 Render 账号完成。

爆炸特效独立预览：`/preview/explosion`，无需进入房间，打开自动播放并支持重播；正式对局已启用：只有无法拆除的炸弹淘汰会触发，全员可见；刷新不重播，支持减少动态效果偏好。

功能牌特效预览：`/preview/cards`，包含 NOPE、Attack、Targeted Attack、Alter/See the Future、Shuffle、Skip、Favor、Draw from Bottom、Defuse，支持单卡重播和连续预览。这批功能牌特效仅在预览页播放，尚未接入正式对局。可用 `?card=defuse` 等参数直接选择卡牌。

公共功能牌预览不展示私密牌面：Alter 为巫师挥杖，See the Future 为水晶球发光与星光浮现，Favor 用黑色爱心从送牌者飞向求牌者；底抽保留抬牌堆与底部抽牌动画，文字固定居中，Defuse 用剪线、停表和绿色护盾。

卡牌特效预览中，每种动画图案正下方直接显示该功能牌的英文名称，文字使用接近该特效的颜色，牌桌外不显示独立名称标题或说明段落。

预览中的卡牌名字随动画出现和消失；Favor 和 Draw from Bottom 的名字固定在牌桌中央，不随爱心或卡牌移动。
