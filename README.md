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

已通过 107 项本地测试，包括完整规则测试、2–10 人模拟、独立 HTTP 建房/加入/开局、并发操作互斥、私密手牌、AI、结束投票、头像同步和回合倒计时。新房间默认每次抽牌回合 30 秒；房主可在大厅关闭计时或选择 30/60/90/120 秒，超时自动抽牌，NOPE 窗口和结束投票暂停。赠牌、拆弹放回和调整未来超时也会自动完成。房主还可分别开启完整弃牌记录和炸弹风险仪表盘，默认关闭；风险为抽牌堆剩余炸弹数 / 剩余牌数，不透露牌序。关闭弃牌记录时，API 只返回顶张弃牌和总数。PostgreSQL 适配器已提供，但尚未连接真实 PostgreSQL 验证；云端部署和数据库连接需要在你的 Render 账号完成。

爆炸特效独立预览：`/preview/explosion`，无需进入房间，打开自动播放并支持重播；正式对局已启用：只有无法拆除的炸弹淘汰会触发，全员可见；刷新不重播，支持减少动态效果偏好。

功能牌特效预览：`/preview/cards`，包含 NOPE、Attack、Targeted Attack、Alter/See the Future、Shuffle、Skip、Favor、Draw from Bottom、Defuse，支持单卡重播和连续预览。这批功能牌特效已接入正式对局，所有玩家可见。可用 `?card=defuse` 等参数直接选择卡牌。

公共功能牌预览不展示私密牌面：Alter 为巫师挥杖，See the Future 为水晶球发光与星光浮现，Favor 用黑色爱心从送牌者飞向求牌者；底抽保留抬牌堆与底部抽牌动画，文字固定居中，Defuse 用剪线、停表和绿色护盾。

卡牌特效预览中，每种动画图案正下方直接显示该功能牌的英文名称，文字使用接近该特效的颜色，牌桌外不显示独立名称标题或说明段落。

预览中的卡牌名字随动画出现和消失；Favor 和 Draw from Bottom 的名字固定在牌桌中央，不随爱心或卡牌移动。

正式对局通过有序公共事件同步功能牌特效；被 NOPE 取消的动作不播成功动画，Favor 送牌完成后由送牌者飞向求牌者，底抽、拆弹与爆炸按顺序播放。事件仅含类型与参与玩家，不含手牌、未来牌或赠牌内容。首次打开不重播历史事件，换局清理动画，支持减少动态效果。

SEE THE FUTURE 的使用者会在私人区域直接看到按抽牌顺序排列的真实牌面，支持点击放大；公共动画仍不展示未来牌。按官方 Party Pack 规则核对：Favor、猫咪组合不结束回合；无法拆弹的炸弹不放回抽牌堆，成功拆弹后才秘密放回。仅猫咪牌可组成组合的限制继续保留为房间原有自订规则。官方说明：https://cdn.shopify.com/s/files/1/0345/9180/1483/files/ekpp-instructions-english.pdf?v=1743819467

抽牌阶段复测：额外自动模拟 260 局、24,596 步操作，验证卡牌守恒、存活玩家轮转和炸弹数量。修复 Attack 多次抽牌期间，倒计时自动抽牌后旧点击/重复请求可能再消耗下一次抽牌的问题；新版客户端附带当前抽牌步骤标记，过期步骤只同步最新牌局，不再次抽牌。旧客户端仍兼容，但所有玩家应刷新以使用此保护。

结束投票按已投的同意/反对票比较，多数决定；平票继续游戏。可主动弃票，30 秒未选也计为弃票，机器人不参与。结果确定后可提前结束投票，投票期间暂停回合和 NOPE 倒计时。

四名独立人类身份的 Party Pack HTTP 回归与四个独立 Chromium 浏览器点击实测通过，两轮普通抽牌依次 A→B→C→D。Attack 的额外抽牌与 Targeted Attack 跳转另有检查；没有复现只在两人之间轮转。游戏桌面、手牌和操作栏改为单屏布局，已检查 1366×768、1280×720、1440×900、390×844、360×640、844×390。私密未来牌可展开/收起；长设置/投票面板在面板内部滚动。

联机复查：修复刷新时第 9 张之后的手牌被发牌动画隐藏；同次操作增加请求去重，出牌/赠牌校验原手牌，过期局次请求拒绝。轮询不重叠，离开/切房后的旧回复忽略，请求 12 秒超时后释放操作锁；启动重连遇临时网络错误保留房间并重试，确定房间失效才返回入口。真实 Chromium 四客户端验证刷新 10 张手牌、选牌/目标跨轮询保留、离线失败恢复和抽牌同步。另完成 195 局策略模拟、17,963 步，检查牌数守恒、炸弹数量、存活轮转、私密数据与正常结束。3–10 人独立 HTTP 测试 192 次抽牌及 1,290 个视角同步检查通过。

部署限制：当前 render.yaml 使用 memory，进程重启/重新部署会清空房间；生产持久化需配置 PostgreSQL。回合计时关闭时，离线玩家可能阻塞出牌/赠牌/拆弹；没有离线自动转移房主功能。刷新同一标签可恢复玩家身份，彻底关闭标签后 sessionStorage 身份不保证保留，尚未提供跨设备接回座位。

自动排查日志：提交成功的房间操作保存时间、局次、版本、公开动作消息，以及操作前后当前玩家/剩余抽牌次数/存活状态/手牌张数。房间内保留最近 500 条，通过仅房内成员可访问的 GET /api/logs 导出；重开一局不清除这份记录。生产入口同时输出 kind=game-audit 的结构化 Render 运行日志，平台保留时间按套餐，不承诺永久保存。私密手牌、未来牌、牌序、拆弹放回位置、玩家令牌和请求正文均不记录。

浏览器自动备份收到的公开日志，最多 3 个房间、各 500 条、7 天（本地存储可用时）。TABLE TALK 的“导出日志”会合并服务器记录；服务器房间已丢失时，/play 入口的“导出上次牌局日志”仍可导出本机备份。后台/离线期间未收到的事件不保证在本机完整保存。内存房间在重启后仍会丢失，自动日志不等于牌局持久化；配置 PostgreSQL 时，房内记录随牌局事务存储并受房间清理周期约束。旧版已截掉的记录不能恢复。

回合提醒预览：/preview/turn 提供 A 柔和双叮、B 清脆铃声、C 游戏提示、D 轻快木琴，点击解锁 Web Audio，音量可调。正式游戏尚未启用声音，等用户选定再接入仅当前玩家本机播放。正式头像已接入约 850ms 金色双段短线向外闪出并恢复倒计时光圈；按玩家/局次切换触发，初次刷新、轮询、同一玩家的额外抽牌、投票暂停恢复不会重复触发，支持减少动态效果。真实浏览器验证四种音色的音频波形/音量、手机宽度、倒计时恢复及四客户端轮转提醒。手机后台/锁屏声音受浏览器限制，不承诺系统推送。
