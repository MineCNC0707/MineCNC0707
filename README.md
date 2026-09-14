# 尸潮乱斗 / Horde Mayhem

这是在原始 Three.js FPS 原型上增量扩展的双语僵尸生存游戏。中文正式名称固定为“尸潮乱斗”，英文名称为 “Horde Mayhem”。原型基线保存在 Git 提交 `31437e0`，审查记录在 [AUDIT.md](./AUDIT.md)。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

然后打开 <http://127.0.0.1:5173/>。这个命令用于检查静态前端和离线试玩，浏览器需要支持 WebGL。

要运行带 D1、登录、教学、好友、房间和 WebSocket 的 Worker：

```bash
npm run db:init
npm run dev:worker
```

然后打开 <http://127.0.0.1:8787/>。`npm run build` 会把 `public/` 复制到 `dist/`，并把 Three.js 0.186.0 作为本地固定依赖复制到 `dist/vendor/`，所以生产页面不依赖 CDN。

测试和静态检查：

```bash
npm test
npm run check
npm run build
npx wrangler deploy --dry-run
```

## 目录

```text
public/                 双语大厅和游戏客户端
  index.html            登录后大厅、军火处、黑市、设置、社交
  app.html              Three.js 游戏和 HUD
  js/config.js          FPS、FOV、武器、成长、难度、Boss、网络参数
  js/ui.js              i18n 和游戏壳层交互限制
  js/home.js            3D 大厅、登录、商城、好友、房间
  js/game.js            第一人称玩法、viewmodel、移动端控制、Boss
  js/models.js          共享手部、武器、玩家模型和动画
  js/network.js         会话 API、WebSocket 重连和 Ping
  js/progression.js     玩家/武器经验与结算计算
worker/                 Cloudflare Worker、D1 逻辑和 Durable Object 房间
  worker.js             API、HttpOnly 会话、限速、服务端校验
  room.js               房间状态、WebSocket、服务器模拟和结算
  simulation.js         权威移动、碰撞、射线、伤害、换弹时机
  schema.sql            用户、会话、武器、好友、邀请和结算表
tests/                  成长、服务器模拟和端到端本地接口测试
```

## Cloudflare 部署

部署前需要登录 Wrangler，并把 `wrangler.jsonc` 中的 D1 `database_id` 换成自己的数据库 ID；也可以先执行 `npx wrangler d1 create horde-mayhem`，再把命令输出的 ID 填入配置。初始化远端数据库：

```bash
npx wrangler login
npx wrangler d1 execute horde-mayhem --remote --file worker/schema.sql
npm run build
npx wrangler deploy
```

配置使用 Worker 静态 Assets、D1 和 Durable Objects。`ROOMS` 每个房间一个实例，房间状态先写入 Durable Object SQLite，再广播给已认证 WebSocket 客户端；D1 保存账号、会话、成长、好友、邀请和结算收据。真实货币、经验、购买和伤害结果不会以 localStorage 为权威。

本次部署已验证：GitHub 源码位于 [`horde-mayhem` 分支](https://github.com/MineCNC0707/MineCNC0707/tree/horde-mayhem)，Cloudflare Worker 地址为 <https://horde-mayhem.cncchow7777.workers.dev>，远端 D1 数据库为 `horde-mayhem`（ID `791f0141-b047-4b6a-a80b-50466720a8f7`）。

生产环境建议把 Worker 绑定到 HTTPS 自定义域名。会话使用 `HttpOnly; SameSite=Strict` Cookie；密码在 Worker 端使用 PBKDF2（随机 salt）哈希，前端不会接触密码哈希或密钥。登录接口和已认证 API 都有基础频率限制及请求大小限制。

## 游戏功能说明

- 桌面保留 WASD、鼠标、左键射击、R 换弹、Space 跳跃和 ESC 菜单。鼠标锁定不可用时，桌面可以拖动画面转向。
- 手机和平板使用动态左摇杆、右侧多点视角、射击、ADS、换弹、跳跃、切枪和暂停按钮；页面不会滚动、缩放或拖拽游戏资源。登录输入仍可正常编辑。
- ADS 默认点击切换，也可以在设置中改成长按。世界 FOV 为 70–110，枪械使用独立 viewmodel FOV，设置修改会平滑过渡。
- 新账号必须完成 6 步短教学：移动/视角、跳跃、射击、换弹、ADS、身体与爆头反馈。教学检查点由服务端保存，完成后才能进入正式单人或多人。
- 多人房间支持好友在线状态、后端邀请冷却与过期倒计时；大厅和进行中的战局都会显示可接受/拒绝的邀请提示。
- 默认手枪与 AK-47 使用不同模型、弹匣、射速、后坐力、ADS 和可见换弹动作。主页角色、远端玩家和第一人称 viewmodel 共用程序化资源。
- 单人和多人分别使用五档难度表。Boss 有大型模型、红色范围预警、前摇、伤害窗口、收招和冷却。
- 首页、战斗和 Boss 使用合成 Web Audio 状态音乐，并根据距离和方向衰减僵尸声音；没有打包许可不明的音乐文件。

## 资源许可

项目当前使用程序生成的几何、Canvas 纹理和 Web Audio 合成音效，没有外部音乐或模型版权资源。Three.js 通过 npm 固定为 0.186.0；其许可证随构建复制到 `dist/vendor/THREE-LICENSE.txt`。如果未来添加第三方资源，必须在此处记录作者、来源 URL 和明确的 CC0、公共领域或项目可用许可。

## 阶段状态

- Phase 1：已完成审查、基线、可运行脚本、暂停时序修复和实测 FPS。
- Phase 2：已完成双语、3D 大厅、登录/注册 UI、军火处、黑市、设置、响应式壳层和 Loading。
- Phase 3：已完成城市场景、碰撞、手枪/AK viewmodel、可见换弹、僵尸/Boss、触控输入、FOV、音频和 HUD。
- Phase 4：已完成配置化难度、玩家/武器经验、货币结算、购买/装备服务端接口。
- Phase 5：已完成 Worker、D1 schema、HttpOnly 会话、密码哈希、教学持久化、好友和邀请冷却。
- Phase 6：已完成 Durable Object 房间、WebSocket 重连、Ping、动作序号去重、插值远端角色、敌人/波次同步和服务端结算收据。

这些阶段均通过本地静态检查、服务器模拟测试、本地 Worker 集成测试和线上 Worker 静态资源检查；如果需要自定义域名，仍需在自己的 Cloudflare 控制台添加域名绑定。
