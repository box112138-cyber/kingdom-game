# 王国崛起

一个纯前端原生 JavaScript 小游戏，玩法包含王国建设、地图探索、资源采集、建筑升级、怪物战斗、废墟探索、动物消消乐和转生成长。

## 运行方式

单机模式不需要安装依赖或构建，建议用本地静态服务器运行：

```bash
python -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

不建议直接双击 `index.html`，因为浏览器可能限制 ES Modules 的本地文件加载。

## 联机模式

联机模式使用 WebSocket 房间同步，服务端只负责转发玩家位置和世界快照。第一个进入房间的玩家会把当前世界作为房间初始状态，后续玩家会自动同步到同一张地图和同一份王国进度。

本地联机运行方式：

```bash
npm install
npm start
```

然后访问：

```text
http://localhost:8787/
```

页面顶部填写同一个服务器地址和房间名，点击“联机”即可加入同一房间。局域网联机时，把服务器地址改成主机的局域网地址，例如 `ws://192.168.1.20:8787`。

跨网络联机有两种方式：临时隧道或部署公网服务。GitHub Pages 只能托管静态页面，不能直接运行 WebSocket 服务端。

### 不绑卡临时联机

这个方式不需要注册云平台，也不需要填写银行卡，但你的电脑必须一直开着。

先启动本地游戏服务：

```bash
npm start
```

再打开另一个终端，运行：

```bash
npm run tunnel
```

命令会输出一个公网地址，例如：

```text
https://abc-123.loca.lt
```

你和朋友都打开这个地址。页面顶部“联机服务器”填写对应的 WebSocket 地址：

```text
wss://abc-123.loca.lt
```

所有玩家填写同一个房间名即可跨网络联机。每次重新运行隧道，地址可能会变化。

### Render 部署联机服务端

Render 是长期部署方式，但新账号可能要求绑卡。项目已包含 `render.yaml`，可以用 Render Blueprint 一键部署：

1. 打开 `https://dashboard.render.com/blueprints`。
2. 点击 `New Blueprint Instance`。
3. 连接 GitHub 并选择 `box112138-cyber/kingdom-game` 仓库。
4. 确认服务名、免费套餐和配置后点击部署。
5. 部署完成后复制 Render 分配的地址，例如 `https://kingdom-game.onrender.com`。
6. 游戏页面顶部“联机服务器”填写对应的 WebSocket 地址，例如 `wss://kingdom-game.onrender.com`。

所有玩家填写同一个联机服务器地址和同一个房间名即可跨网络联机。

## 操作说明

- `WASD` 或方向键：移动角色
- `Space`：进入建筑或废墟
- `Esc`：关闭面板或取消建筑放置
- `M`：建筑移动模式；站在怪物旁按 `M` 可进入三消战斗
- `H`：显示快捷键帮助
- 鼠标滚轮：缩放地图
- 鼠标拖拽：平移地图
- 点击地图格子：查看地形、建筑或进行放置

## 项目结构

- `index.html`：页面结构和模块入口
- `css/style.css`：游戏界面样式
- `js/main.js`：初始化、读档、事件绑定和主循环
- `js/multiplayer.js`：联机连接、房间同步、远程玩家显示
- `js/state.js`：集中式游戏状态和存档写入
- `js/config.js`：地图尺寸、建筑、怪物和内部场景配置
- `js/map.js`：地形生成、建筑占格、宝箱、怪物和废墟生成
- `js/renderer.js`：地图、资源栏、浮窗和升级面板渲染
- `js/player.js`：角色移动、视角控制、键鼠输入和地图交互
- `js/economy.js`：资源产出、容量、人口、战力、英雄和训练
- `js/buildings.js`：建筑成本、需求、升级时间和升级队列
- `js/shop.js`：商店、建筑购买、放置和回收
- `js/terrain.js`：地形采集、冷却和建筑移动逻辑
- `js/combat.js`：自动战斗、三消战斗结算和 Boss 装备掉落
- `js/match3.js`：动物消消乐小游戏
- `js/interiors.js`：建筑和废墟内部探索
- `js/achievements.js`：成就计数、解锁和奖励
- `server/index.js`：静态文件和 WebSocket 房间服务

## 存档

游戏存档保存在浏览器 `localStorage` 中，键名为 `kingdom_v13`。点击游戏内“保存”按钮会立即保存，游戏也会每 30 秒自动保存一次。

## 发布部署

### GitHub Pages

项目已包含 `.github/workflows/deploy-pages.yml`。推送到 `main` 或 `master` 分支后，GitHub Actions 会自动发布静态站点。

首次使用需要在 GitHub 仓库中开启 Pages：

1. 打开仓库的 `Settings`。
2. 进入 `Pages`。
3. 将 `Build and deployment` 的 `Source` 设为 `GitHub Actions`。
4. 推送代码后，在 `Actions` 页面等待 `Deploy GitHub Pages` 完成。

发布完成后，访问地址通常是：

```text
https://box112138-cyber.github.io/kingdom-game/
```

### Netlify

项目已包含 `netlify.toml`，可以直接在 Netlify 中导入 GitHub 仓库。构建命令为空，发布目录为项目根目录 `.`。

## 开发注意

- 新的建筑、怪物和地图常量优先放在 `js/config.js`。
- 新的共享状态需要同时补充 `createState()`、保存逻辑和读取逻辑。
- 地图单格变化优先使用 `updateCell()` 或 `updateCells()`，避免频繁全量 `renderMap()`。
- 建筑放置判断需要传入建筑 ID，确保桥梁等特殊建筑规则生效。
