/**
 * dsh-netease-music — Host half (plain Node ESM, node builtins only).
 *
 * Deliberately dependency-free so the plugin can be `link:`-installed from
 * anywhere (Node resolves @deepseek-ai/* from a linked package's real path,
 * which has no node_modules). Everything shared lives on the Host Context:
 *
 *   - `webServer` registers the same-origin JSON routes the browser half calls
 *     (settings, API proxy, command queue, state report),
 *   - `subprocess` spawns and supervises the local NeteaseCloudMusicApi,
 *   - `tools` registers the model-facing `netease_music` control tool.
 *
 * The login cookie is persisted under the profile directory so login survives
 * DSH restarts; it is attached to every proxied API request.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

export const name = "dsh-netease-music";
export const inject = ["webServer", "subprocess", "tools"];

const API_GET_TIMEOUT_MS = 25000;
const MAX_COMMANDS = 200;
const API_PATH_PATTERN = /^\/[A-Za-z0-9/_?&=\-.]*$/;
const ROUTE_PREFIX = "/plugin/netease-music";

/** Simple fetch with a timeout that works on older Node too. */
function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

/** Read a bounded JSON request body. */
function readJsonBody(req, limit = 262144) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export function apply(ctx, config = {}) {
  const state = {
    disposed: false,
    apiHandle: null,
    apiReady: false,
    apiStarting: null,
    apiRestartTimer: null,
    restartAttempts: 0,
    commands: [],
    commandSeq: 0,
    playerState: null,
    playerStateAt: 0,
  };

  const profileDir = (() => {
    const home = process.env.DSH_HOME || join(process.env.HOME || process.env.USERPROFILE || ".", ".dsh");
    const profile = process.env.DSH_PROFILE || "web";
    return join(home, "profiles", profile);
  })();
  const settingsFile = join(profileDir, "netease-music.json");

  const defaultSettings = () => ({
    port: Number(config.port) > 0 ? Number(config.port) : 3000,
    cookie: "",
    quality: "standard",
    volume: 0.8,
    playMode: "sequence",
    modules: {
      daily: true,
      playlist: true,
      fm: true,
      lyrics: true,
      history: true,
      volume: true,
    },
  });

  let settings = (() => {
    const defaults = defaultSettings();
    try {
      const raw = JSON.parse(readFileSync(settingsFile, "utf8"));
      return {
        ...defaults,
        ...raw,
        modules: { ...defaults.modules, ...(raw.modules ?? {}) },
      };
    } catch {
      return defaults;
    }
  })();

  function saveSettings(patch = {}) {
    settings = {
      ...settings,
      ...patch,
      modules: { ...settings.modules, ...(patch.modules ?? {}) },
    };
    try {
      mkdirSync(dirname(settingsFile), { recursive: true });
      writeFileSync(settingsFile, JSON.stringify(settings, null, 2), "utf8");
      return { ok: true, settings };
    } catch (error) {
      return { ok: false, message: String(error?.message ?? error) };
    }
  }

  function apiPort() {
    const port = Number(settings.port);
    return Number.isInteger(port) && port > 0 && port < 65536 ? port : 3000;
  }

  // ------------------------------------------------------------- API server

  function resolveApiEntry() {
    // Resolve against the PROFILE directory: this plugin is usually
    // link:-installed from a source folder that has no node_modules of its
    // own, and the API package is a profile-level dependency.
    const profileRequire = createRequire(join(profileDir, "package.json"));
    const pkgJsonPath = profileRequire.resolve("NeteaseCloudMusicApi/package.json");
    const pkgDir = dirname(pkgJsonPath);
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8"));
    // The server entry is the package bin (`./app.js`); `main` is the
    // programmatic module export and must NOT be used as the server entry.
    const entry = typeof pkg.bin === "string" && pkg.bin ? pkg.bin : "app.js";
    return join(pkgDir, entry);
  }

  async function waitForReady(port, timeoutMs = 25000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (state.disposed) return false;
      try {
        const res = await fetchWithTimeout(`http://127.0.0.1:${port}/`, 2000);
        if (res.ok) return true;
      } catch {
        /* not up yet */
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  }

  function scheduleRestart() {
    if (state.disposed || state.apiRestartTimer !== null) return;
    state.restartAttempts += 1;
    if (state.restartAttempts > 6) return; // give up until an apiGet retriggers it
    state.apiRestartTimer = setTimeout(() => {
      state.apiRestartTimer = null;
      startApi();
    }, 4000);
  }

  async function startApi() {
    if (state.disposed) return;
    if (state.apiHandle !== null || state.apiStarting !== null) return;
    const subprocess = ctx.get("subprocess");
    if (subprocess === undefined) return;
    state.apiStarting = (async () => {
      try {
        const entry = resolveApiEntry();
        const port = apiPort();
        const handle = subprocess.spawn({
          argv: [process.execPath, entry],
          cwd: dirname(entry),
          stdio: {
            stdin: "ignore",
            stdout: { maxBytes: 65536 },
            stderr: { maxBytes: 65536 },
          },
          graceMs: 5000,
          env: { PORT: String(port) },
        });
        state.apiHandle = handle;
        state.apiReady = await waitForReady(port);
        if (state.apiReady) state.restartAttempts = 0;
        handle.done
          .then(() => {
            if (state.apiHandle === handle) {
              state.apiHandle = null;
              state.apiReady = false;
            }
            scheduleRestart();
          })
          .catch(() => {
            if (state.apiHandle === handle) {
              state.apiHandle = null;
              state.apiReady = false;
            }
            scheduleRestart();
          });
      } catch (error) {
        state.apiHandle = null;
        state.apiReady = false;
        ctx.logger.warn(`dsh-netease-music: failed to start API server: ${String(error?.message ?? error)}`);
        scheduleRestart();
      } finally {
        state.apiStarting = null;
      }
    })();
    await state.apiStarting;
  }

  async function ensureApi() {
    if (state.apiReady) return true;
    await startApi();
    return state.apiReady;
  }

  async function restartApi(wantedPort) {
    const port = Number(wantedPort);
    if (Number.isInteger(port) && port > 0 && port < 65536) saveSettings({ port });
    state.restartAttempts = 0;
    if (state.apiRestartTimer !== null) {
      clearTimeout(state.apiRestartTimer);
      state.apiRestartTimer = null;
    }
    if (state.apiHandle !== null) {
      state.apiHandle.terminate();
      state.apiHandle = null;
    }
    state.apiReady = false;
    await startApi();
    return { ok: state.apiReady, port: apiPort() };
  }

  /** Proxy one NeteaseCloudMusicApi GET request; cookie attached automatically. */
  async function apiGet(method, params) {
    try {
      if (typeof method !== "string" || !API_PATH_PATTERN.test(method)) {
        return { status: 0, body: { code: -1, message: `illegal api path: ${String(method).slice(0, 80)}` } };
      }
      const ready = await ensureApi();
      if (!ready) {
        return { status: 0, body: { code: -1, message: "NeteaseCloudMusicApi 尚未就绪（首次启动可能需要数十秒，或端口被占用）" } };
      }
      const url = new URL(`http://127.0.0.1:${apiPort()}${method}`);
      if (params !== null && typeof params === "object") {
        for (const [key, value] of Object.entries(params)) {
          if (value === undefined || value === null) continue;
          url.searchParams.set(key, String(value));
        }
      }
      if (settings.cookie && !url.searchParams.has("cookie")) {
        url.searchParams.set("cookie", settings.cookie);
      }
      const res = await fetchWithTimeout(url, API_GET_TIMEOUT_MS);
      const text = await res.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = { code: -1, message: "invalid response", raw: text.slice(0, 2000) };
      }
      return { status: res.status, body };
    } catch (error) {
      return { status: 0, body: { code: -1, message: String(error?.message ?? error) } };
    }
  }

  // --------------------------------------------------------- command queue

  function pushCommand(type, payload) {
    const seq = ++state.commandSeq;
    state.commands.push({ seq, type, payload });
    if (state.commands.length > MAX_COMMANDS) {
      state.commands.splice(0, state.commands.length - MAX_COMMANDS);
    }
    return seq;
  }

  // -------------------------------------------------------------- AI tool

  /** Raw ToolDefinition (JSON-Schema parameters; no dsh-tools import needed). */
  const musicTool = {
    name: "netease_music",
    description:
      "Control the Netease Cloud Music player embedded in the DSH top bar (dsh-netease-music plugin). " +
      "Use it to search songs, play/pause, switch tracks, set the play mode, adjust volume, load daily " +
      "recommendations, or play the user's playlists. Commands are applied by the browser player; " +
      "search returns song ids that can be played with action 'play'.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["search", "play", "pause", "toggle", "next", "previous", "setMode", "volume", "state", "daily", "playlists", "playPlaylist"],
          description:
            "search: find songs by keywords and return the top results. play: play one song by songId. pause/toggle/next/previous: transport control. setMode: change play mode (sequence | loop | single | shuffle). volume: set volume 0-1. state: read current player state. daily: load and play daily recommendations. playlists: list the user's Netease playlists with their ids. playPlaylist: load and play one playlist by playlistId.",
        },
        query: { type: "string", description: "Search keywords (for action 'search')." },
        songId: { type: "string", description: "Netease song id (for action 'play')." },
        playlistId: { type: "string", description: "Netease playlist id (for action 'playPlaylist')." },
        mode: { type: "string", enum: ["sequence", "loop", "single", "shuffle"], description: "Play mode (for action 'setMode')." },
        volume: { type: "number", description: "Volume 0..1 (for action 'volume')." },
      },
      required: ["action"],
    },
    output: {
      schema: { type: "string" },
      render: (_args, value) => [{ type: "text", text: String(value) }],
    },
    timeoutMs: 20000,
    isConcurrencySafe: () => true,
    execute: async (args) => {
      const action = args.action;
      switch (action) {
        case "search": {
          if (!args.query || String(args.query).trim() === "") return "请提供 query 搜索关键词。";
          const res = await apiGet("/cloudsearch", { keywords: String(args.query), type: 1, limit: 10 });
          const songs = res?.body?.result?.songs;
          if (!Array.isArray(songs) || songs.length === 0) {
            return `搜索“${args.query}”没有结果（API: ${res?.body?.code ?? res?.status ?? "?"}）。`;
          }
          const lines = songs.map((song, index) => {
            const artists = (song.ar ?? []).map((a) => a.name).join("/");
            return `${index + 1}. id=${song.id} ${song.name} - ${artists}`;
          });
          return `搜索“${args.query}”的结果（用 action='play' + songId 播放）：\n${lines.join("\n")}`;
        }
        case "play": {
          if (!args.songId) return "请提供 songId（先 search 获取）。";
          pushCommand("playSong", { id: String(args.songId) });
          return `已下发播放命令：歌曲 ${args.songId}。播放器会加载并开始播放。`;
        }
        case "pause":
          pushCommand("pause", {});
          return "已下发暂停命令。";
        case "toggle":
          pushCommand("toggle", {});
          return "已下发播放/暂停切换命令。";
        case "next":
          pushCommand("next", {});
          return "已下发下一首命令。";
        case "previous":
          pushCommand("previous", {});
          return "已下发上一首命令。";
        case "setMode": {
          if (!["sequence", "loop", "single", "shuffle"].includes(args.mode)) return "mode 必须是 sequence | loop | single | shuffle 之一。";
          pushCommand("setMode", { mode: args.mode });
          return `已下发播放模式切换命令：${args.mode}。`;
        }
        case "volume": {
          const volume = Number(args.volume);
          if (!Number.isFinite(volume) || volume < 0 || volume > 1) return "volume 必须是 0 到 1 之间的数字。";
          pushCommand("volume", { volume });
          return `已下发音量命令：${Math.round(volume * 100)}%。`;
        }
        case "state": {
          if (state.playerState === null) return "播放器尚未回报状态（页面未打开或插件未激活）。";
          const song = state.playerState.song;
          const songText = song ? `《${song.name}》- ${song.artist}` : "无";
          return [
            `当前歌曲：${songText}`,
            `播放状态：${state.playerState.playing ? "播放中" : "已暂停"}`,
            `播放模式：${state.playerState.playMode}`,
            `音量：${Math.round(state.playerState.volume * 100)}%`,
            `队列长度：${state.playerState.queueLength}`,
            `状态时间：${new Date(state.playerStateAt).toLocaleTimeString()}`,
          ].join("\n");
        }
        case "daily":
          pushCommand("playDaily", {});
          return "已下发播放每日推荐命令（需要已登录网易云账号）。";
        case "playlists": {
          const status = await apiGet("/login/status", {});
          const uid = status.body?.data && ((status.body.data.account && status.body.data.account.id) || (status.body.data.profile && status.body.data.profile.userId));
          if (!uid) return "未登录网易云账号，无法获取歌单。";
          const res = await apiGet("/user/playlist", { uid, limit: 100 });
          const list = res.body?.playlist;
          if (!Array.isArray(list) || list.length === 0) return "你的账号下没有歌单。";
          const lines = list.map((p, index) => `${index + 1}. id=${p.id} ${p.name}（${p.trackCount ?? 0}首）`);
          return `你的歌单（用 action='playPlaylist' + playlistId 播放）：\n${lines.join("\n")}`;
        }
        case "playPlaylist": {
          if (!args.playlistId) return "请提供 playlistId（先 playlists 获取）。";
          pushCommand("playPlaylist", { id: String(args.playlistId) });
          return `已下发播放歌单命令：歌单 ${args.playlistId}。播放器会加载并开始播放。`;
        }
        default:
          return `未知 action：${String(action)}。`;
      }
    },
  };

  // Defensive ctx.get: a missing service must never crash activation (the
  // web shell is one-shot — one throwing entry fails the whole page load).
  const tools = ctx.get("tools");
  if (tools !== undefined) {
    ctx.effect(() => tools.register(musicTool), "dsh-netease-music: ai tool");
  }

  // ------------------------------------------------------------- HTTP routes

  const webServer = ctx.get("webServer");
  if (webServer === undefined) {
    ctx.logger.warn("dsh-netease-music: webServer service unavailable — browser half will not work");
  } else {
    ctx.effect(
      () =>
        webServer.register({
        kind: "prefix",
        path: ROUTE_PREFIX,
        handler: async (req, res) => {
          try {
            const url = new URL(req.url ?? "/", "http://x");
            const sub = url.pathname.slice(ROUTE_PREFIX.length).replace(/^\/+/, "");

            if (sub === "api" && req.method === "GET") {
              const params = {};
              for (const [key, value] of url.searchParams.entries()) {
                if (key === "method") continue;
                params[key] = value;
              }
              return sendJson(res, 200, await apiGet(url.searchParams.get("method") || "/", params));
            }
            if (sub === "settings" && req.method === "GET") {
              return sendJson(res, 200, { ok: true, settings });
            }
            if (sub === "settings" && req.method === "POST") {
              const patch = await readJsonBody(req);
              const oldPort = apiPort();
              const result = saveSettings(patch);
              const portChanged = Number.isInteger(Number(patch.port)) && Number(patch.port) !== oldPort;
              if (portChanged) restartApi(Number(patch.port));
              return sendJson(res, 200, result);
            }
            if (sub === "cookie" && req.method === "POST") {
              const payload = await readJsonBody(req);
              const value = typeof payload.cookie === "string" ? payload.cookie.trim() : "";
              if (value.length > 8000) return sendJson(res, 200, { ok: false, message: "cookie too long" });
              return sendJson(res, 200, saveSettings({ cookie: value }));
            }
            if (sub === "logout" && req.method === "POST") {
              await apiGet("/logout", {});
              return sendJson(res, 200, saveSettings({ cookie: "" }));
            }
            if (sub === "commands" && req.method === "GET") {
              const offset = Number(url.searchParams.get("since"));
              const since = Number.isFinite(offset) ? offset : 0;
              return sendJson(res, 200, {
                commands: state.commands.filter((cmd) => cmd.seq > since),
                since: state.commandSeq,
              });
            }
            if (sub === "state" && req.method === "POST") {
              const payload = await readJsonBody(req);
              if (payload !== null && typeof payload === "object") {
                state.playerState = {
                  song: payload.song ?? null,
                  playing: payload.playing === true,
                  playMode: typeof payload.playMode === "string" ? payload.playMode : "sequence",
                  volume: Number.isFinite(Number(payload.volume)) ? Number(payload.volume) : 0.8,
                  queueLength: Number.isFinite(Number(payload.queueLength)) ? Number(payload.queueLength) : 0,
                };
                state.playerStateAt = Date.now();
              }
              return sendJson(res, 200, { ok: true });
            }
            if (sub === "status" && req.method === "GET") {
              return sendJson(res, 200, {
                ready: state.apiReady,
                port: apiPort(),
                restartAttempts: state.restartAttempts,
                hasCookie: Boolean(settings.cookie),
              });
            }
            if (sub === "restart" && req.method === "POST") {
              const payload = await readJsonBody(req).catch(() => ({}));
              const result = await restartApi(payload.port);
              return sendJson(res, 200, result);
            }
            return sendJson(res, 404, { ok: false, message: "not found" });
          } catch (error) {
            return sendJson(res, 500, { ok: false, message: String(error?.message ?? error) });
          }
        },
        }),
      "dsh-netease-music: web routes"
    );
  }

  ctx.effect(() => () => {
    state.disposed = true;
    if (state.apiRestartTimer !== null) {
      clearTimeout(state.apiRestartTimer);
      state.apiRestartTimer = null;
    }
    if (state.apiHandle !== null) {
      state.apiHandle.terminate();
      state.apiHandle = null;
    }
    state.apiReady = false;
  }, "dsh-netease-music: dispose");

  startApi();
}
