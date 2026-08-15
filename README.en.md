<div align="right"><a href="README.md">简体中文</a> | <b>English</b></div>

# dsh-netease-music

<p align="center">
  <a href="https://github.com/JasonCHTT/dsh-netease-music"><img alt="release" src="https://img.shields.io/github/v/release/JasonCHTT/dsh-netease-music"></a>
  <img alt="platform" src="https://img.shields.io/badge/platform-DSH%20Web-blueviolet">
  <a href="https://github.com/JasonCHTT/dsh-netease-music/blob/main/LICENSE"><img alt="license" src="https://img.shields.io/github/license/JasonCHTT/dsh-netease-music"></a>
</p>

<p align="center"><b>A Netease Cloud Music player plugin for DeepSeek Harness (DSH) Web</b></p>
<p align="center">Persistent mini player in the top bar + expandable full panel · bundles an auto-started <a href="https://github.com/Binaryify/NeteaseCloudMusicApi">NeteaseCloudMusicApi</a> local service · AI chat control supported</p>

<p align="center"><i>An old carpenter kept his plane sharp, and his work went smoothly. So it is with people: when the tools of one's craft are in good order, the mind is at ease and the work is done well. Music while working is like adding a fitting tool for the spirit — it turns tedious tasks into something light and pleasant. This is not idleness, but knowing how to pace oneself so the mind stays clear. By the old rites, each person has their own duty, and each their own way of nurturing the heart; to settle into the present moment is to fulfil one's part. Seen this way, keeping music close while one labors is no small wisdom.</i></p>

---

## Screenshot

<p align="center"><img src="demo.jpg" alt="Screenshot" width="720"></p>

## Features

- **Persistent top-bar mini player**: cover, title / artist, previous, play / pause, next, play-mode switch, single-line rolling lyrics
- **Expandable panel**: daily recommendations, my playlists, personal FM, search (songs + playlists), play queue, history, settings
- **Full playback control**: sequence / list loop / single loop / shuffle, seek bar, volume, lyrics
- **Resume playback**: automatically remembers the playing song, playlist and position; continues where you left off after reopening
- **QR-code login**: scan with the Netease Cloud Music app; login persists across DSH restarts
- **AI control tool**: registers the model tool `netease_music` — control the player directly from the chat

## Installation

### Requirements

- DeepSeek Harness (`dsh web`)
- Node.js and pnpm (for dependency installation)

### Steps

```bash
# 1. Enter the web profile directory
cd "$env:USERPROFILE\.dsh\profiles\web"

# 2. Clone the plugin and link-install it (<path> = absolute path to the plugin folder)
git clone https://github.com/JasonCHTT/dsh-netease-music.git
pnpm add 'link:C:/<path>/dsh-netease-music'

# 3. Install the plugin's runtime dependency NeteaseCloudMusicApi
pnpm add NeteaseCloudMusicApi

# 4. Edit the profile's package.json: append "dsh-netease-music"
#    to the end of dsh.profile.bundles
```

4. Then **restart `dsh web`** (the host half needs a process restart), and refresh the page — the mini player appears in the top bar.

> Note: if you install with the `dsh plugin --profile web add ...` command, the path must **not contain spaces** (that command's command-line joining truncates spaced paths); the pnpm approach above has no such limitation.

### Uninstall

```bash
cd "$env:USERPROFILE\.dsh\profiles\web"
pnpm remove dsh-netease-music NeteaseCloudMusicApi   # keep the API package if other plugins use it
# remove "dsh-netease-music" from dsh.profile.bundles in package.json, then restart dsh web
```

## Usage

### Login

1. Click **"QR login"** on the "Daily / Playlists / Personal FM" tab of the panel, or under Settings → Account
2. Scan with the Netease Cloud Music app and **confirm on your phone**
3. Login status shows in Settings; "Log out" signs out

### Play a song

1. Click the **cover / arrow on the left** of the top-bar player to expand the panel (or press `Ctrl+Shift+M`)
2. Switch to the **"Search"** tab, type a song / artist / album / playlist keyword, press Enter
3. Results are shown in two sections, "Playlists" and "Songs":
   - Click a playlist → playlist detail, "Play all" or play a single track
   - Click a song (or the ▶ button at the row end) → plays immediately

### Daily recommendations

After login, open the **"Daily"** tab → "Play all" or click a track.

### My playlists

The **"Playlists"** tab shows every playlist of your account (created + subscribed) → click one to open its details and play.

### Personal FM

The **"Personal FM"** tab → "Start" fetches your personalized stream → "Refresh" loads a new batch.

### Playback controls

| Action | Where |
| --- | --- |
| Previous / play-pause / next | Mini player, panel bottom bar |
| Play mode (sequence / list loop / single loop / shuffle) | Mode buttons in the mini player and panel; click to cycle |
| Seek | Progress bar at the panel bottom |
| Volume | Volume slider at the panel bottom (can be hidden in settings) |
| Lyrics | Scrolling lyrics box at the panel bottom + single-line rolling lyrics in the top bar (rolls line by line, centered, width adapts to the remaining top-bar space) |
| Play queue | "Queue" tab: click to jump, clear |
| History | "History" tab: last 50 played tracks kept locally |

### Resume playback

The plugin remembers your state before closing the page and continues after reopening `dsh web`:

- **What is remembered**: the playing song, the playlist (queue, up to 300 tracks), the position (saved every 5 seconds while playing), and the play mode
- **How it resumes**: the song and queue are restored and playback continues from the saved position; if the browser's autoplay policy blocks it (the first play on a fresh page needs one click), the song stays at the saved position with a hint — one click on play continues
- **Where it is stored**: only in the browser's localStorage; clearing the queue clears the memory

### Settings

Open the "Settings" tab of the panel (or DSH Settings → Netease Cloud Music):

| Group | Item | Description |
| --- | --- | --- |
| Display modules | Daily page / Playlists page / Personal FM page / Lyrics / History page / Volume | Toggles apply instantly; controls which tabs and controls appear |
| Playback | Quality | Standard / High / Extreme high (auto-falls back to standard without VIP) |
| Playback | Play mode | Sequence / list loop / single loop / shuffle |
| Account | Status / QR login / Log out | — |
| Local service | NeteaseCloudMusicApi status, restart button | Default port 3000 |

### AI control

The plugin registers the model tool **`netease_music`** — just ask in the chat, for example:

- "Play Qing Tian by Jay Chou"
- "Play daily recommendations", "Play my playlist", "Next", "Pause"
- "Set volume to 50%", "Switch to shuffle"

Tool actions:

| action | Description |
| --- | --- |
| `search` | Search songs by keyword, returns a result list (with song ids) |
| `play` | Play one song by songId |
| `pause` / `toggle` | Pause / play-pause toggle |
| `next` / `previous` | Next / previous track |
| `setMode` | Set play mode: `sequence` / `loop` / `single` / `shuffle` |
| `volume` | Set volume 0–1 |
| `state` | Query current player state (song / mode / volume / queue) |
| `daily` | Play daily recommendations |
| `playlists` | List the account's playlists (with playlist ids) |
| `playPlaylist` | Play a playlist by playlistId |

## How it works

- **Host half** (`lib/index.js`): zero third-party imports (only Node built-ins + the `webServer` / `subprocess` / `tools` services)
  - Registers same-origin routes under `/plugin/netease-music/*` (settings, API proxy, command queue, state report) via `webServer` — the browser fetches them directly with no CORS issues
  - Spawns `NeteaseCloudMusicApi` via `subprocess` (default port 3000, auto-restarts on crash)
  - Proxies every Netease API request and attaches the login cookie automatically (persisted in the profile directory, survives restarts)
  - Registers the `netease_music` AI tool via `tools`
- **Client half** (`lib/client.js`): a self-registering browser bundle playing through HTML5 `<audio>`
  - Song URLs come from `/song/url/v1` first (falling back down the chosen quality), with `music.163.com/song/media/outer/url` as the final fallback
  - Polls the host command queue every 1.2s to execute AI commands and reports player state back to the host
- **UI mount points**: mini player → `conversation.session.header.actions` (top bar); panel → `shell.overlay` (global overlay, portaled to body); settings → `settings.section`

## Project structure

```
dsh-netease-music/
├── package.json           # plugin manifest (dsh.bundle.patch + dsh.client)
├── cordis.patch.yml       # loader patch injected into the profile
├── lib/
│   ├── index.js           # host-half plugin
│   └── client.js          # browser bundle
├── nm-default-cover.jpg   # default cover shown before playback (embedded in the bundle)
├── demo.jpg               # usage screenshot
├── README.md              # Chinese README
├── README.en.md           # English README
└── LICENSE
```

## FAQ

**Q: Is login required?**
Search, playback, queue and history do not require login; daily recommendations, personal FM and my playlists do.

**Q: Can anyone else get my login state?**
No. The login cookie is stored only in your local profile directory and stays inside the host process — the settings the browser receives have the cookie field stripped, and the plugin routes only answer loopback requests. It is never distributed with the repository or the package.

**Q: Can I expose the local API service (default port 3000) to the public internet?**
No. The login cookie is passed to the local NeteaseCloudMusicApi as a URL query parameter (an upstream API design constraint); exposing that port to the public network could leave the cookie in server logs or packet captures. Keep the service bound to loopback (127.0.0.1) only, and never port-forward 3000.

**Q: Some songs fail to play?**
Songs without copyright or behind a separate paywall cannot be played; the panel will show a hint. Non-VIP high / extreme-high quality automatically falls back to standard.

**Q: The first play click does nothing on a fresh page?**
The browser autoplay policy requires one click for the first playback; after that, AI-issued play commands work normally.

**Q: How do code changes take effect?**
Changes to `lib/client.js` apply after a page refresh; changes to `lib/index.js` require restarting `dsh web`.

**Q: The local API service starts slowly or fails?**
First startup takes a dozen seconds; if port 3000 is taken, restart the service in Settings or change the port in the profile plugin config.

## Credits

- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) — Node.js API for Netease Cloud Music
- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — plugin host framework

## License

[MIT](LICENSE)
