# dsh-netease-music

<p align="center">
  <img alt="version" src="https://img.shields.io/badge/version-1.0.0-blue">
  <img alt="platform" src="https://img.shields.io/badge/platform-DSH%20Web-blueviolet">
  <img alt="license" src="https://img.shields.io/badge/license-MIT-green">
</p>

<p align="center"><b>DeepSeek Harness（DSH）网页版的网易云音乐播放器插件</b></p>
<p align="center">常驻顶部条迷你播放器 + 可展开完整面板 · 内置自动启动的 <a href="https://github.com/Binaryify/NeteaseCloudMusicApi">NeteaseCloudMusicApi</a> 本地服务 · 支持 AI 对话控制</p>

<p align="center"><span style="font-size:1.5em;font-weight:600">我</span>听说，从前有个木匠，他手里那把刨子磨得锃亮，做起活来便格外顺手。人做事也是一样，手里的家伙什儿顺了，心里便不慌，活计也就做得利落。工作时听歌，就如同给心神添了一副趁手的器具，让繁杂的事务也生出几分轻快来。这并非贪图安逸，而是懂得调适自己的节奏，使精神常驻清明。若按礼法来看，人各掌其事，也各有其养心之法，能让自己安住当下，便不失为本分。这样看来，随身带着乐声劳作，岂不也是一种贤者的智慧？</p>

---

## 功能总览

- **顶部条常驻迷你播放器**：封面、歌名 / 歌手、上一首、播放 / 暂停、下一首、播放模式切换、单行滚动歌词
- **展开播放面板**：每日推荐、我的歌单、私人 FM、搜索（歌曲 + 歌单）、播放队列、播放历史、设置
- **完整播放控制**：顺序 / 列表循环 / 单曲循环 / 随机播放，进度条拖动，音量调节，歌词显示
- **断点续播**：自动记住关闭前正在播放的歌曲、歌单与播放位置，重新打开后继续收听
- **扫码登录**：面板内展示二维码，手机网易云音乐 App 扫码确认，登录状态持久化（重启 DSH 不丢）
- **AI 控制工具**：注册模型工具 `netease_music`，可直接在对话里控制播放器

## 安装

### 环境要求

- DeepSeek Harness（`dsh web`）
- Node.js、pnpm（安装依赖用）

### 安装步骤

```bash
# 1. 进入 web profile 目录
cd "$env:USERPROFILE\.dsh\profiles\web"

# 2. link 安装本插件（<路径> 替换为插件目录的绝对路径）
pnpm add 'link:C:/<路径>/dsh-netease-music'

# 3. 安装插件运行时依赖 NeteaseCloudMusicApi
pnpm add NeteaseCloudMusicApi

# 4. 编辑 profile 的 package.json，在 dsh.profile.bundles 末尾追加
#    "dsh-netease-music"
```

4. 完成后**重启 `dsh web`**（Host 端需要重启进程加载），刷新页面即可在顶部条看到播放器。

> 提示：如果使用 `dsh plugin --profile web add ...` 命令安装，路径中**不能包含空格**（该命令内部拼接命令行时会被截断）；上方 pnpm 直装方式没有此限制。

### 卸载

```bash
cd "$env:USERPROFILE\.dsh\profiles\web"
pnpm remove dsh-netease-music NeteaseCloudMusicApi   # 若其他插件也在使用 API 包，保留它
# 从 package.json 的 dsh.profile.bundles 中删除 "dsh-netease-music"，重启 dsh web
```

## 使用说明

### 登录

1. 面板「推荐 / 歌单 / 私人FM」页或「设置 → 账号」中点击 **「扫码登录」**
2. 手机网易云音乐 App 扫码并**确认登录**
3. 登录状态显示在设置页；「退出登录」可注销

### 播放一首歌

1. 点击顶部条播放器**左侧封面 / 箭头**展开面板（也可用快捷键 `Ctrl+Shift+M`）
2. 切换到 **「搜索」** 页，输入歌名 / 歌手 / 专辑 / 歌单，回车
3. 搜索结果分「歌单」和「歌曲」两个区块展示：
   - 点歌单 → 进入歌单详情，可「播放全部」或点单曲播放
   - 点歌曲（或行尾 ▶ 按钮）→ 直接播放

### 每日推荐

登录后打开面板 **「推荐」** 页 → 「播放全部」或点击单曲。

### 我的歌单

面板 **「歌单」** 页 → 显示账号下全部歌单（创建 + 收藏）→ 点击进入详情播放。

### 私人 FM

面板 **「私人FM」** 页 → 「开始播放」获取专属推荐流 → 「换一批」刷新推荐。

### 播放控制

| 操作 | 位置 |
| --- | --- |
| 上一首 / 播放暂停 / 下一首 | 顶部迷你播放器、面板底部播放条 |
| 播放模式（顺序 / 列表循环 / 单曲循环 / 随机） | 迷你播放器与面板的模式按钮，点击循环切换 |
| 进度拖动 | 面板底部进度条 |
| 音量调节 | 面板底部音量滑块（可在设置中隐藏） |
| 歌词 | 面板底部滚动歌词框 + 顶部条单行滚动歌词（随行上下滚动、居中、宽度自适应顶栏剩余空间） |
| 播放队列 | 面板「队列」页：点击跳转、清空 |
| 播放历史 | 面板「历史」页：本机保留最近 50 首 |

### 断点续播

插件会自动记住你关闭页面前的状态，重新打开 `dsh web` 后继续收听：

- **记住的内容**：正在播放的歌曲、歌单（播放队列，最多 300 首）、播放位置（播放中每 5 秒自动保存一次）、播放模式
- **恢复方式**：打开页面后自动恢复歌曲与队列，并从上次位置继续播放；若浏览器自动播放策略拦截（新页面首次播放需要一次点击），歌曲会停在原位置并提示，点一下播放按钮即可继续
- **存储位置**：仅保存在本机浏览器 localStorage；清空播放队列后记忆随之清除

### 设置项

打开面板「设置」页（或 DSH 设置 → 网易云音乐）：

| 分组 | 项目 | 说明 |
| --- | --- | --- |
| 显示模块 | 每日推荐页 / 歌单页 / 私人FM页 / 歌词显示 / 播放历史页 / 音量调节 | 勾选即时生效，控制面板页签与控件显隐 |
| 播放 | 音质 | 标准 / 高音质 / 极高音质（非 VIP 自动降级为标准） |
| 播放 | 播放模式 | 顺序 / 列表循环 / 单曲循环 / 随机 |
| 账号 | 状态 / 扫码登录 / 退出登录 | — |
| 本地服务 | NeteaseCloudMusicApi 状态、重启按钮 | 默认端口 3000 |

### 用 AI 控制播放

插件注册了模型工具 **`netease_music`**，在对话中直接说即可，例如：

- 「帮我播放周杰伦的晴天」
- 「播放每日推荐」「播放我的歌单」「下一首」「暂停」
- 「把音量调到 50%」「切换为随机播放」

工具动作一览：

| action | 说明 |
| --- | --- |
| `search` | 按关键词搜索歌曲，返回结果列表（含歌曲 id） |
| `play` | 按 songId 播放一首歌 |
| `pause` / `toggle` | 暂停 / 播放暂停切换 |
| `next` / `previous` | 下一首 / 上一首 |
| `setMode` | 设置播放模式：`sequence` / `loop` / `single` / `shuffle` |
| `volume` | 设置音量 0~1 |
| `state` | 查询当前播放状态（歌曲 / 模式 / 音量 / 队列） |
| `daily` | 播放每日推荐 |
| `playlists` | 列出账号歌单（含歌单 id） |
| `playPlaylist` | 按 playlistId 播放歌单 |

## 工作原理

- **Host 端**（`lib/index.js`）：零第三方 import（仅 Node 内置模块 + `webServer` / `subprocess` / `tools` 服务）
  - 通过 `webServer` 注册同源路由 `/plugin/netease-music/*`（设置、API 代理、命令队列、状态回报），浏览器端直接 `fetch`，无跨域问题
  - 用 `subprocess` 拉起 `NeteaseCloudMusicApi`（默认端口 3000，崩溃自动重启）
  - 代理全部网易云 API 请求并自动附带登录 Cookie（持久化在 profile 目录，重启登录不丢）
  - 通过 `tools` 注册 AI 工具 `netease_music`
- **Client 端**（`lib/client.js`）：自注册浏览器 bundle，HTML5 `<audio>` 播放
  - 歌曲地址优先取 `/song/url/v1`（按所选音质自动降级），无地址时回退 `music.163.com/song/media/outer/url`
  - 每 1.2s 轮询一次 Host 命令队列执行 AI 指令，播放状态回报 Host 供 AI 查询
- **UI 挂载点**：迷你播放器 → `conversation.session.header.actions`（顶部条）；面板 → `shell.overlay`（全局浮动层，Portal 到 body）；设置页 → `settings.section`

## 项目结构

```
dsh-netease-music/
├── package.json           # 插件清单（dsh.bundle.patch + dsh.client）
├── cordis.patch.yml       # 注入 profile 的 Loader 补丁
├── lib/
│   ├── index.js           # Host 端插件
│   └── client.js          # 浏览器端 bundle
├── nm-default-cover.jpg   # 未播放时的默认封面图（内嵌于 bundle）
└── README.md
```

## 常见问题

**Q：需要登录才能用吗？**
搜索、播放、队列、历史不需要登录；每日推荐、私人 FM、我的歌单需要登录。

**Q：登录状态会被别人拿到吗？**
不会。登录状态只保存在你的本机，不会随插件仓库或安装包分发。

**Q：有些歌播放失败？**
无版权或需要单独付费的歌曲无法播放，面板会提示。非 VIP 的高音质 / 极高音质会自动降级为标准音质。

**Q：打开页面第一次点播放没反应？**
浏览器自动播放策略要求页面首次播放必须有一次点击；点击过一次后，AI 下发的播放命令即可正常生效。

**Q：改了代码怎么生效？**
改 `lib/client.js` 刷新页面即可；改 `lib/index.js` 需要重启 `dsh web`。

**Q：本地 API 服务启动很慢或失败？**
首次启动需要十余秒；若端口 3000 被占用，可在设置页重启或在 profile 的插件配置中修改端口。

## 致谢

- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) — 网易云音乐 Node.js API
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — 插件宿主框架

## 许可证

[MIT](LICENSE)
