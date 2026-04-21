# Material Island — 架构文档

> **技术栈**: Vue 3 + TypeScript + Vite + Electron + C# (.NET 8)
> **设计语言**: Material Design 3 (Material You)
> **灵感来源**: Apple Dynamic Island

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心技术栈](#2-核心技术栈)
3. [目录结构](#3-目录结构)
4. [架构分层](#4-架构分层)
5. [核心模块设计](#5-核心模块设计)
   - 5.1 [C# SMTC Sidecar](#51-c-smtc-sidecar)
   - 5.2 [Electron 主进程](#52-electron-主进程)
   - 5.3 [Preload 桥接层](#53-preload-桥接层)
   - 5.4 [岛状态机 Pinia Store](#54-岛状态机-pinia-store)
   - 5.5 [UI 组件层](#55-ui-组件层)
   - 5.6 [动效系统](#56-动效系统)
   - 5.7 [M3 主题系统](#57-m3-主题系统)
   - 5.8 [消息接收模块](#58-消息接收模块)
   - 5.9 [歌词系统](#59-歌词系统)
6. [IPC 频道一览](#6-ipc-频道一览)
7. [窗口管理策略](#7-窗口管理策略)
8. [模块化设计](#8-模块化设计)
9. [数据流](#9-数据流)
10. [扩展指南](#10-扩展指南)
11. [启动与构建](#11-启动与构建)

---

## 1. 项目概述

Material Island 是一个运行在 **Windows** 桌面端的 **灵动岛风格通知/媒体控制中枢**，基于 Electron 实现无边框透明覆盖窗口，以 C# sidecar 进程读取 Windows SMTC 系统媒体会话，通过 Vue 3 响应式系统驱动岛的状态切换，全程遵循 Material Design 3 规范。

**核心能力：**

| 能力 | 实现方式 |
|------|----------|
| 透明置顶覆盖窗口 | Electron `BrowserWindow` 透明 + `alwaysOnTop: screen-saver` |
| 鼠标穿透 | `win.setIgnoreMouseEvents(true, { forward: true })` 动态切换 |
| 展开时捕获全屏点击 | 展开时将窗口 `setBounds` 拉伸至全屏，关闭穿透；收起恢复小窗口 |
| 状态驱动 UI | Pinia 状态机 + CSS Transition |
| 系统媒体信息 | C# SmtcServer sidecar 读取 Windows.Media.Control SMTC API |
| 高频进度更新 | sidecar 独立 position 事件流，减少完整 MediaInfo 解析开销 |
| 进度 seek | 渲染层拖拽 → IPC → sidecar stdin `seek:N` 命令 |
| 静默模式 | 岛自动缩为 120×6px 顶部横条，点击恢复；鼠标在岛内自动暂停静默倒计时，鼠标移出后重启 |
| 外部 HTTP 消息推送 | 本地 HTTP Server（仅 localhost），外部程序 / 脚本 POST `/notify` 即可将消息上岛 |
| Windows 原生通知上岛 | 监听 Windows Toast 通知事件，将系统弹窗同步到岛的 NOTIFICATION 状态 |
| 歌词显示 | 自动拉取 LRC 歌词（lrclib.net / 网易云），展开态实时同步带淡入淡出过渡 |
| 持久化设置 | electron-store，JSON 文件落地 |
| 系统托盘 | Electron `Tray`，右键菜单 + 双击打开设置 |
| M3 动态配色 | CSS Custom Properties + `@material/material-color-utilities` |

---

## 2. 核心技术栈

```
运行时
├── Electron 30+          # Windows 桌面容器，管理窗口生命周期
└── Node.js 20+           # 主进程运行环境

原生组件
└── C# / .NET 8           # SmtcServer sidecar：读取 SMTC 系统媒体会话

渲染层
├── Vue 3.4+              # Composition API，响应式 UI 框架
├── TypeScript 5+         # 全量类型覆盖，零 any
├── Vite 5+               # 极速构建与 HMR
└── electron-vite         # Electron 专用 Vite 封装

状态与逻辑
├── Pinia 2+              # 岛状态机（当前模式、是否展开等）
└── VueUse                # useMouseInElement 等工具集

M3 设计系统
├── @material/material-color-utilities  # Google 官方 M3 配色算法
└── 自定义 CSS Token 系统              # --md-sys-color-* 变量

歌词
└── providers/lyrics.ts                 # lrclib.net 字节 + 网易云 LRC 二分搜索
```

---

## 3. 目录结构

```
Material-Island/
├── electron.vite.config.ts      # electron-vite 总配置
├── package.json
├── tsconfig.json                # 基础 TS 配置
├── tsconfig.node.json           # 主进程 / preload 配置
├── tsconfig.web.json            # 渲染层配置
├── scripts/
│   └── gen-icon.mjs             # SVG → 多尺寸 ICO 生成脚本（prebuild 自动执行）
├── resources/
│   ├── icon.ico                 # 安装包图标（gen-icon.mjs 生成，MD3 风格）
│   └── music_cast.png           # 系统托盘图标
│
├── sidecar/
│   └── SmtcServer/              # C# .NET 8 sidecar 项目
│       ├── SmtcServer.csproj
│       └── Program.cs           # SMTC 读取、进度推送、seek 命令处理
│
└── src/
    ├── shared/
    │   └── types.ts             # 跨层类型契约（MediaInfo、IPC 常量、AppSettings）
    │
    ├── main/                    # ── Electron 主进程 ──
    │   ├── index.ts             # 入口：窗口生命周期、IPC 注册、Provider 启动
    │   ├── window.ts            # 窗口工厂 + setIslandExpanded()
    │   ├── tray.ts              # 系统托盘图标与右键菜单
    │   ├── settings-store.ts    # 设置读写（electron-store）
    │   └── providers/
    │       ├── media.ts         # 启动/守护 SmtcServer，解析媒体事件
    │       ├── notify.ts        # 系统通知监听
    │       ├── http-server.ts   # 本地 HTTP 消息接收服务（仅 localhost）
    │       └── lyrics.ts        # 歌词拉取、LRC 解析、二分搜索定位当前行
    │
    ├── preload/
    │   ├── index.ts             # contextBridge 安全桥接
    │   └── index.d.ts           # window.electron 全局类型声明
    │
    └── renderer/src/            # ── Vue 渲染层 ──
        ├── App.vue              # 根组件：静态居中容器
        ├── main.ts              # Vue 入口，注册 Pinia
        ├── store/
        │   └── island.ts        # 岛状态机（IslandMode + IPC 订阅）
        ├── composables/
        │   ├── useM3Theme.ts    # M3 动态配色
        │   └── useIslandMouse.ts# 鼠标进出检测
        ├── components/
        │   ├── IslandShell.vue  # 药丸容器（CSS 尺寸动画 + 动态组件）
        │   ├── Compact.vue      # 紧凑态：时钟
        │   ├── Music.vue        # 音乐态：封面/控制/拖拽进度条
        │   ├── Notification.vue # 通知态
        │   ├── Timer.vue        # 计时态：秒表
        │   └── Settings.vue     # 设置页（独立窗口）
        └── styles/
            ├── tokens.css       # M3 CSS 变量（颜色、形状、排印）
            └── motion.css       # 全局过渡时长与曲线变量
```

---

## 4. 架构分层

```
┌────────────────────────────────────────────────────────────────┐
│                     操作系统 / 系统 API                         │
│   Windows.Media.Control (SMTC)  ·  通知中心  ·  文件系统       │
└──────────────────────────┬─────────────────────────────────────┘
                           │ Win32 / WinRT API
┌──────────────────────────▼─────────────────────────────────────┐
│                   C# SmtcServer Sidecar                         │
│  读取媒体会话元数据/进度  ·  接收 seek 命令  ·  stdout JSON 流  │
└──────────────────────────┬─────────────────────────────────────┘
                           │ spawn + stdio pipe
┌──────────────────────────▼─────────────────────────────────────┐
│                    Electron 主进程                               │
│   window.ts  ·  tray.ts  ·  providers/*  ·  IPC handler        │
└──────────────────────────┬─────────────────────────────────────┘
                           │ contextBridge（安全隔离）
┌──────────────────────────▼─────────────────────────────────────┐
│                        Preload                                   │
│                  window.electron.* API                          │
└──────────────────────────┬─────────────────────────────────────┘
                           │ 调用
┌──────────────────────────▼─────────────────────────────────────┐
│                  Vue 渲染层 (Renderer)                           │
│                                                                 │
│   composables  →  Pinia Store  →  Components                   │
│   (副作用/IO)     (状态机)        (纯展示层)                     │
└────────────────────────────────────────────────────────────────┘
```

**设计原则：**

- **单向数据流**：系统事件 → Provider → IPC → Pinia → 组件，禁止组件直接调用 IPC
- **主进程零 UI 逻辑**：渲染层不感知 Electron，仅通过 `window.electron.*` 间接调用
- **状态机驱动 UI**：岛的形态由 `island.ts` 中枚举状态决定，组件只负责渲染
- **sidecar 进程隔离**：C# 进程崩溃不影响 Electron 主进程，`media.ts` 自动 5s 重启

---

## 5. 核心模块设计

### 5.1 C# SMTC Sidecar

**`sidecar/SmtcServer/Program.cs`**

SmtcServer 是独立的 .NET 8 控制台进程，通过
`Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager`
读取当前系统媒体会话，将媒体信息以 JSON 行（`\n` 分隔）写入 stdout，并从 stdin 读取控制命令。

**stdout 输出格式：**

```json
// 完整媒体信息更新（元数据或状态变化时推送）
{"type":"update","title":"Daylight","artist":"Taylor Swift","album":"1989","status":"Playing","thumbnail":"data:image/png;base64,...","position":134.5,"duration":228.0,"source":"Spotify"}

// 高频进度更新（独立事件，每秒推送）
{"type":"position","position":135.2,"duration":228.0}
```

**stdin 控制命令：**

```
toggle\n       # 播放/暂停
prev\n         # 上一曲
next\n         # 下一曲
seek:134.5\n   # seek 到 134.5 秒
```

**关键实现细节：**

- seek 调用 `TryChangePlaybackPositionAsync(seconds * 10_000_000)`（WinRT 使用 100ns ticks）
- duration 优先取 `MaxSeekTime`，为 0 时用 `EndTime`，仍为 0 则用 `TimeSpan.MaxValue` 兜底
- elapsed 插值上限 3600s，避免 `TimeSpan.MinValue` 导致溢出
- 位置和时长同时为 0 时跳过推送

**WinIsland 风格 Session 选取（`GetBestMusicSession()`）：**

与 WinIsland 采用相同策略，而非直接调用 `GetCurrentSession()`：

1. 调用 `mgr.GetSessions()` 枚举全部媒体会话
2. 跳过 `PlaybackType == Video` 的视频会话
3. 优先返回状态为 `Playing` 的音乐会话；无则返回第一个非视频备选
4. 均无时回退 `manager.GetCurrentSession()`

**WinIsland 风格事件驱动轮询：**

- 订阅 `SessionsChanged` COM 事件 → 置 `sessionChangedFlag = true`，让主循环跳过当前延迟立即处理新 Session
- 基础轮询间隔 **300ms**（与 WinIsland 一致）

**本地计时器插值（Local Timer）：**

酷狗等应用通过 SMTC 上报的 `pos=0 / duration=0 / lastUpdated=MinValue`，是其 SMTC 实现缺陷。C# sidecar 采用本地计时器绕过：

```csharp
// 检测到新曲目或 Playing 状态开始时重置基准
_basePos  = smtcPosition;   // SMTC 报 0 时即为 0
_baseTime = DateTimeOffset.UtcNow;

// 每次 tick 计算：基准位置 + 已过时间
var elapsed    = (DateTimeOffset.UtcNow - _baseTime).TotalSeconds;
var outPosition = _basePos + elapsed;
```

- 暂停时冻结 `_basePos`，不再累加 elapsed
- elapsed 上限 3600s，防止 `TimeSpan.MinValue` 溢出
- 已知限制：若 SMTC 始终报 0（如酷狗），position 从 0 开始计时，无法知道真实播放位置。WinIsland 存在相同限制。

**`src/main/providers/media.ts`** — sidecar 守护器

```
MediaProvider (extends EventEmitter)
├── start()         → spawn SmtcServer.exe，建立 stdio 管道
├── stop()          → 杀进程，清除重启定时器
├── sendControl()   → 向 sidecar stdin 写控制命令
├── sendSeek()      → 向 sidecar stdin 写 seek:N 命令
└── _spawn() 内部   → readline 解析 stdout JSON 行
                      → emit('update', MediaInfo)
                      → emit('position', MediaPosition)
                      → 异常退出时 5s 后自动重启
```

sidecar 路径解析：开发模式优先查找 Release 编译输出，生产模式从 `process.resourcesPath/SmtcServer.exe` 读取。

---

### 5.2 Electron 主进程

**`src/main/window.ts`** — 窗口工厂

```typescript
export const ISLAND_MAX_WIDTH  = 440
export const ISLAND_MAX_HEIGHT = 180

export function createIslandWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: ISLAND_MAX_WIDTH,
    height: ISLAND_MAX_HEIGHT,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,      // 默认不可聚焦，避免抢夺用户焦点
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setIgnoreMouseEvents(true, { forward: true })  // 默认穿透
  return win
}
```

**`setIslandExpanded(win, expanded, settings)`** — 展开/收起时调整窗口尺寸：

```typescript
if (expanded) {
  // 全屏覆盖，捕获岛外任意位置的点击事件
  win.setBounds({ x: dx, y: dy, width: dw, height: dh })
} else {
  // 恢复小窗口（440×180 × scale），居中于屏幕顶部
  win.setBounds({
    x: dx + Math.round(dw / 2 - scaledW / 2),
    y: dy + settings.topOffset,
    width: scaledW,
    height: scaledH,
  })
}
```

**`src/main/tray.ts`** — 系统托盘

- 图标：`resources/music_cast.png`
- 右键菜单：「打开设置」「退出」
- 双击：打开设置窗口

**`src/main/settings-store.ts`** — 设置持久化

使用 electron-store 将 `AppSettings` 序列化为 JSON，提供 `loadSettings()` / `saveSettings(settings)` 接口。

`AppSettings` 字段：

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `scale` | `number` | `1.0` | 缩放倍数，0.5～2.0 |
| `topOffset` | `number` | `0` | 距顶部偏移像素 |
| `displayId` | `number` | `-1` | 显示器 ID，-1 表示主屏 |
| `silentMode` | `boolean` | `false` | 静默模式开关 |
| `silentModeDelay` | `number` | `0` | 自动静默延迟（秒），0=不自动 |
| `httpEnabled` | `boolean` | `false` | 是否启动本地 HTTP 消息服务 |
| `httpPort` | `number` | `19198` | HTTP 服务监听端口（1024-65535）|
| `httpToken` | `string` | `""` | Bearer Token 鉴权，空字符串表示不鉴权 |
| `lyricsEnabled` | `boolean` | `false` | 歌词功能开关 |
| `lyricsSource` | `string` | `"lrclib"` | 歌词数据源：`'lrclib'` \| `'163'` |
| `lyricsFallback` | `boolean` | `true` | 主源失败后是否尝试另一源 |
| `lyricsDelay` | `number` | `0` | 歌词时间偏移（ms，正值提前显示） |

---

### 5.3 Preload 桥接层

遵循最小接口原则，所有参数经过类型校验后才调用 ipcRenderer。

| 方法 | 方向 | 说明 |
|------|------|------|
| `setClickThrough(enable)` | R→M | 切换窗口穿透（鼠标进出岛区域） |
| `setIslandExpanded(expanded)` | R→M | 展开/收起，驱动窗口 resize + 穿透切换 |
| `pin()` | R→M | 请求主进程将窗口设为可聚焦并激活焦点 |
| `mediaControl(action)` | R→M | 发送播放控制（prev/next/toggle） |
| `mediaSeek(seconds)` | R→M | 发送 seek 指令 |
| `getSettings()` | R↔M | 读取当前设置 + 可用显示器列表（invoke） |
| `setSettings(settings)` | R→M | 提交新设置，主进程校验后应用 |
| `openSettings()` | R→M | 打开设置窗口 |
| `onMediaUpdate(cb)` | M→R | 订阅媒体信息更新，返回取消订阅函数 |
| `onMediaPosition(cb)` | M→R | 订阅高频进度更新，返回取消订阅函数 |
| `onNotification(cb)` | M→R | 订阅系统通知 |
| `onWindowBlur(cb)` | M→R | 订阅窗口失去焦点事件（兜底收起） |
| `onSettingsChanged(cb)` | M→R | 订阅设置变更（用于更新 CSS 缩放变量） |
| `onLyricsData(cb)` | M→R | 订阅完整歌词数组 + 时长（秒）更新，切歌/停止时推送空数组 |

---

### 5.4 岛状态机 Pinia Store

**`src/renderer/src/store/island.ts`**

```typescript
export type IslandMode = 'COMPACT' | 'MUSIC' | 'NOTIFICATION' | 'TIMER'

const SIZE_MAP: Record<IslandMode, { width: number; height: number }> = {
  COMPACT:      { width: 240, height: 72  },
  MUSIC:        { width: 360, height: 135 },
  NOTIFICATION: { width: 340, height: 80  },
  TIMER:        { width: 260, height: 60  },
}
const COMPACT_SIZE       = { width: 210, height: 36 }
const MUSIC_COMPACT_SIZE = { width: 280, height: 36 }  // 音乐播放中稍宽，显示缩略图
const SILENT_BAR_SIZE    = { width: 120, height: 6  }  // 静默模式极细横条
```

**状态字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `mode` | `IslandMode` | 当前岛模式 |
| `isExpanded` | `boolean` | 是否展开 |
| `isPinned` | `boolean` | 用户主动锁定展开 |
| `isSilent` | `boolean` | 是否处于静默横条态 |
| `silentModeEnabled` | `boolean` | 设置项：静默模式开关 |
| `mediaInfo` | `MediaInfo \| null` | 最新完整媒体信息（含缩略图） |
| `notification` | `NoticeInfo \| null` | 当前通知 |
| `position` | `number` | 当前播放位置（秒），由 RAF 60fps 插值更新 |
| `duration` | `number` | 总时长（秒），优先取歌词 API 返回值，其次 SMTC |
| `lyricsData` | `LyricLine[]` | 完整歌词数组（从主进程 `LYRICS_DATA` 推送） |
| `currentLyric` | `string` | 当前歌词行（computed，RAF 帧内二分搜索） |
| `lyricsEnabled` | `boolean` | 设置项：歌词功能开关（用于调整岛展开高度） |

**RAF 60fps 位置插值：**

```typescript
// requestAnimationFrame 驱动的平滑插值，消除 300ms 轮询的跳变感
let _syncPos  = 0   // C# 推送的最新基准位置（秒）
let _syncTime = 0   // 对应的本地时间戳（ms）

// 每帧计算：
position.value = _syncPos + (Date.now() - _syncTime) / 1000
```

- `onMediaPosition` 收到 C# 推送时仅更新 `_syncPos / _syncTime`
- RAF 在每帧内加上亚 tick 经过时间，实现视觉上连续的进度
- 换曲时 `applyMediaUpdate` 重置 `_syncPos = 0 / duration = 0 / lyricsData = []`

**关键动作：**

```typescript
// 点击岛切换展开/收起，同步通知主进程调整窗口大小
function togglePin(): void {
  if (isExpanded.value) {
    isExpanded.value = false
    isPinned.value   = false
    window.electron.setIslandExpanded(false)
  } else {
    isExpanded.value = true
    isPinned.value   = true
    window.electron.setIslandExpanded(true)
  }
}
```

**防闪策略：**

- 媒体停止时延迟 3s 才重置为 COMPACT，避免换曲间短暂丢失会话导致界面抖动
- `onWindowBlur` 作为收起兜底，主要依赖背景点击（全屏覆盖后 `@mousedown.self`）

---

### 5.5 UI 组件层

#### IslandShell.vue — 药丸容器

```html
<div
  class="island-shell"
  :class="{ pinned: store.isPinned, silent: store.isSilent }"
  :style="shellStyle"
  @click="handleClick"
>
  <div v-if="store.isSilent" class="silent-bar"><span class="silent-dot" /></div>
  <component v-else :is="componentMap[store.mode]" />
</div>
```

```typescript
function handleClick(): void {
  if (store.isSilent) store.exitSilent()  // 横条 → 岛
  else               store.togglePin()   // 岛 → 展开/收起
}
```

- 静默态下 `.island-shell.silent` 覆盖样式：`border-radius: 3px`、降低阴影、半透明背景
- `.silent-dot` 呈现呼吸动画（`opacity 2.4s ease-in-out infinite`）
- `shellStyle` 从 `store.islandSize` 读取 `width/height`，配合 CSS `transition` 平滑扩缩

#### App.vue — 根组件

```html
<div class="app-root">
  <IslandShell />
</div>
```

- `.app-root` 为静态水平居中容器，自身 `pointer-events: none`
- 展开/收起不再通过展开全屏窗口实现，改由 `useIslandMouse` 监衬鼠标位置驱动收起

#### Music.vue — 拖拽进度条

```typescript
function onSeekMousedown(e: MouseEvent): void {
  isDragging.value = true
  _dragBarRect     = barRef.value!.getBoundingClientRect()
  dragPct.value    = clamp((e.clientX - _dragBarRect.left) / _dragBarRect.width)
  window.addEventListener('mousemove', onSeekMousemove)
  window.addEventListener('mouseup',   onSeekMouseup)
}

function onSeekMouseup(): void {
  window.electron.mediaSeek(dragPct.value * store.duration)
  isDragging.value = false
  window.removeEventListener('mousemove', onSeekMousemove)
  window.removeEventListener('mouseup',   onSeekMouseup)
}
```

拖拽期间显示 `dragPct`（实时反馈），松手后调用 `mediaSeek`；`onUnmounted` 清理 window 监听器。

#### 组件状态映射表

| 组件 | `IslandMode` | 触发条件 |
|------|-------------|----------|
| `Compact.vue` | `COMPACT` | 默认/空闲 |
| `Music.vue` | `MUSIC` | SMTC 有活跃媒体会话 |
| `Notification.vue` | `NOTIFICATION` | 系统通知到达，5s 自动收回 |
| `Timer.vue` | `TIMER` | 用户手动激活 |

---

### 5.6 动效系统

岛的尺寸变化通过 CSS `transition` 实现，无需 JS 动画库：

```css
.island-shell {
  transition:
    width  250ms cubic-bezier(0.05, 0.7, 0.1, 1),
    height 250ms cubic-bezier(0.05, 0.7, 0.1, 1),
    border-radius 200ms cubic-bezier(0.2, 0, 0, 1);
}
```

**`styles/motion.css`** — 全局过渡变量

```css
:root {
  --md-motion-duration-short:    150ms;
  --md-motion-duration-medium:   250ms;
  --md-motion-easing-standard:   cubic-bezier(0.2, 0, 0, 1);
  --md-motion-easing-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);
}
```

| 动画类型 | 时长 | 曲线 |
|----------|------|------|
| 岛扩展/收缩（宽高） | 250ms | emphasized（M3 强调型）|
| 圆角变化 | 200ms | standard |
| 进度条（拖拽中） | `transition: none` | — |

---

### 5.7 M3 主题系统

**`src/renderer/src/composables/useM3Theme.ts`**

```typescript
import { argbFromHex, themeFromSourceColor, applyTheme } from '@material/material-color-utilities'

export function useM3Theme(sourceHex = '#6750A4') {
  const theme  = themeFromSourceColor(argbFromHex(sourceHex))
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  applyTheme(theme, { target: document.documentElement, dark: isDark })
}
```

生成的 CSS 变量可在组件中直接引用：

```css
.island-shell {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}
```

---

### 5.8 消息接收模块

本模块提供两条独立的消息入口，最终都汇入岛的 `NOTIFICATION` 状态机：

```
外部 HTTP 请求  ──┐
                  ├──► HttpNotifyProvider ──► IPC NOTIFY_NEW ──► 岛 NOTIFICATION 态
Windows 系统通知 ─┘（notify.ts 已有，此处合并描述）
```

#### 5.8.1 本地 HTTP 服务器

**`src/main/providers/http-server.ts`**

启动一个仅绑定 `127.0.0.1` 的 HTTP 服务（Node.js `http` 内置模块，无额外依赖），监听可配置端口（默认 `19198`）。

**安全边界：**

- 绑定 `127.0.0.1`，拒绝所有外网连接
- 支持可选 Bearer Token（`AppSettings.httpToken`），为空时不鉴权
- 请求体大小上限 64 KB，超出直接 400

**API 接口：**

```
POST /notify
Content-Type: application/json
Authorization: Bearer <token>   （可选）

{
  "title": "构建成功",           // 必填，通知标题
  "body":  "main 分支 v0.2.0",  // 可选，通知正文
  "app":   "GitHub Actions",    // 可选，来源应用名
  "icon":  "data:image/..."     // 可选，base64 图标
}

→ 200 OK  { "ok": true }
→ 400     { "error": "invalid body" }
→ 401     { "error": "unauthorized" }
```

**核心实现（设计意图）：**

```typescript
export class HttpNotifyProvider extends EventEmitter {
  private _server: http.Server | null = null

  start(port: number, token?: string): void {
    this._server = http.createServer((req, res) => {
      // 只接受 POST /notify
      if (req.method !== 'POST' || req.url !== '/notify') {
        res.writeHead(404); res.end(); return
      }
      // Bearer Token 鉴权
      if (token) {
        const auth = req.headers['authorization'] ?? ''
        if (auth !== `Bearer ${token}`) {
          res.writeHead(401)
          res.end(JSON.stringify({ error: 'unauthorized' })); return
        }
      }
      // 读取 body（上限 64KB）
      let body = ''
      req.on('data', chunk => {
        body += chunk
        if (body.length > 65536) req.destroy()
      })
      req.on('end', () => {
        try {
          const payload = JSON.parse(body)
          this.emit('notify', {
            app:   payload.app   ?? 'HTTP',
            title: payload.title ?? '(无标题)',
            body:  payload.body  ?? '',
          } satisfies NoticeInfo)
          res.writeHead(200)
          res.end(JSON.stringify({ ok: true }))
        } catch {
          res.writeHead(400)
          res.end(JSON.stringify({ error: 'invalid body' }))
        }
      })
    })
    // 仅绑定 127.0.0.1，禁止外网访问
    this._server.listen(port, '127.0.0.1')
  }

  stop(): void {
    this._server?.close()
    this._server = null
  }
}
```

**`src/main/index.ts` 中注册：**

```typescript
const httpNotify = new HttpNotifyProvider()
if (settings.httpEnabled) {
  httpNotify.start(settings.httpPort, settings.httpToken)
}
httpNotify.on('notify', (info: NoticeInfo) => {
  islandWin.webContents.send(IPC.NOTIFY_NEW, info)
})
```

#### 5.8.2 Windows 系统通知监听

**`src/main/providers/notify.ts`**

监听 Windows 通知中心事件，将 Toast 通知同步上岛（已有模块，此处完善描述）。

通知到达 → `emit('notify', NoticeInfo)` → 主进程 `IPC.NOTIFY_NEW` → 渲染层 `NOTIFICATION` 态，5s 后自动收回。

#### 5.8.3 相关 AppSettings 字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `httpEnabled` | `boolean` | `false` | 是否启动 HTTP 消息服务 |
| `httpPort` | `number` | `19198` | 监听端口（1024-65535） |
| `httpToken` | `string` | `""` | Bearer Token，空字符串表示不鉴权 |

#### 5.8.4 设置界面集成

Settings.vue 中新增「消息接收」分区：

- Toggle：启用 HTTP 服务
- 端口输入框（数字，范围 1024–65535）
- Token 输入框（密码型 input，支持一键复制）
- 实时显示当前监听地址：`http://127.0.0.1:{port}/notify`

---

### 5.9 歌词系统

**`src/main/providers/lyrics.ts`**

纯 Node.js 模块，无需修改 C# sidecar，由 `media.ts` 事件驱动。

```
MediaProvider.emit('update', info)  →  LyricsProvider.handleMediaUpdate(info)
    曲目变化 → 异步 _fetchLyrics()
        成功 → emit('data', lines, durationSec)  (IPC LYRICS_DATA → 渲染层)
    停止/无会话 → emit('data', [], 0)             (清空渲染层)
```

与旧方案（主进程实时 tick + 推送当前行文本）相比，新方案将整组 `LyricLine[]` 一次性推送给渲染层，由渲染层的 RAF 循环在每帧内完成二分搜索。好处：

- 主进程无需跟踪播放位置，解耦更彻底
- 渲染层始终与 `position.value` 严格同步，不存在主→渲延迟

**`durationSec` 时长传递：**

lrclib 响应包含 `duration`（秒），163 搜索结果包含 `duration`（毫秒）。`lyrics.ts` 在 `emit('data', lines, durationSec)` 时一并传出，渲染层优先用此值覆盖 SMTC 上报的时长（解决酷狗 duration=0 问题）。

**歌词拉取流程（双源 + fallback）：**

```
fetch_lyrics(title, artist, duration)
       │
       ├── source = 'lrclib'
       │     └── _fetchLrclib(精确) → 失败 → _fetchLrclib(搜索) → 失败
       │           └── fallback → _fetch163()
       │
       └── source = '163'
             └── _fetch163() → 失败
                   └── fallback → _fetchLrclib()
```

**API 端点：**

| 数据源 | 接口 |
|--------|------|
| lrclib 精确 | `GET https://lrclib.net/api/get?track_name=&artist_name=&duration=` |
| lrclib 搜索 | `GET https://lrclib.net/api/search?q=` |
| 网易云搜索 | `GET https://music.163.com/api/search/get/web?s=&type=1&limit=10` |
| 网易云歌词 | `GET https://music.163.com/api/song/lyric?id=&lv=1&kv=1&tv=-1` |

**LRC 解析：**

- 正则 `[mm:ss.xx]` 提取时间戳（支持 1-3 位小数）
- `Map<timeMs, text>` 去重后转 `LyricLine[]` 升序排列
- 网易云翻译歌词（`tlyric`）与主歌词同时间戳时合并（`\n` 分隔）

**定位当前行（渲染层 RAF 内执行）：**

```typescript
// store/island.ts — 每帧 RAF 回调中调用
const t = position.value * 1000 + lyricsDelay.value  // ms
// 二分搜索 ≤ t 的最后一条
let lo = 0, hi = lyricsData.value.length - 1
while (lo < hi) {
  const mid = (lo + hi + 1) >> 1
  if (lyricsData.value[mid].timeMs <= t) lo = mid
  else hi = mid - 1
}
currentLyric.value = lyricsData.value[lo]?.text ?? ''
```

**抗并发设计：**

每次开始新请求时递增 `_fetchId`，异步结果返回时检查 ID 是否匹配，丢弃已切歌的过期结果。

**`AppSettings` 相关字段：**

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `lyricsEnabled` | `boolean` | `false` | 歌词功能开关 |
| `lyricsSource` | `string` | `"lrclib"` | 主数据源 |
| `lyricsFallback` | `boolean` | `true` | 主源失败后备选 |
| `lyricsDelay` | `number` | `0` | 时间偏移 ms（-3000~+3000） |

**渲染层展示（`Music.vue`）：**

- 展开态在艺术家名下方添加 `.lyric-wrap` 容器，`v-if="store.lyricsEnabled"`
- `<transition name="lyric-fade" mode="out-in">` + `:key="store.currentLyric"` 触发 fade+slide 动画
- 文本一行截断（`text-overflow: ellipsis`），颜色使用 `--md-sys-color-primary`
- 启用歌词时岛展开高度从 135px 自动增加到 162px（`MUSIC_LYRICS_SIZE`）

---

## 6. IPC 频道一览

所有频道名称集中定义在 `src/shared/types.ts` 的 `IPC` 常量对象，避免魔法字符串。

| 常量名 | 频道字符串 | 方向 | 说明 |
|--------|-----------|------|------|
| `ISLAND_CLICKTHROUGH` | `island:set-clickthrough` | R→M | 切换鼠标穿透 |
| `ISLAND_PIN` | `island:pin` | R→M | 请求窗口聚焦 |
| `ISLAND_BLUR` | `island:blur` | M→R | 窗口失去焦点通知 |
| `ISLAND_EXPANDED` | `island:expanded` | R→M | 展开/收起，驱动窗口 resize |
| `MEDIA_UPDATE` | `media:update` | M→R | 完整媒体信息推送 |
| `MEDIA_POSITION` | `media:position` | M→R | 高频进度更新 |
| `MEDIA_CONTROL` | `media:control` | R→M | 播放控制（prev/next/toggle） |
| `MEDIA_SEEK` | `media:seek` | R→M | seek 到指定秒数 |
| `NOTIFY_NEW` | `notify:new` | M→R | 系统通知推送 |
| `SETTINGS_OPEN` | `settings:open` | R→M | 打开设置窗口 |
| `SETTINGS_GET` | `settings:get` | R↔M | 读取设置（invoke/handle） |
| `SETTINGS_SET` | `settings:set` | R→M | 更新设置 |
| `SETTINGS_CHANGED` | `settings:changed` | M→R | 设置已更新通知 |
| `HTTP_NOTIFY_TOGGLE` | `http-notify:toggle` | R→M | 动态启停 HTTP 服务（端口/Token 变更时） |
| `LYRICS_DATA` | `lyrics:data` | M→R | 完整歌词数组 `LyricLine[]` + 时长秒数推送；切歌/停止时推送空数组 |

---

## 7. 窗口管理策略

### 7.1 岛窗口

| 状态 | 窗口尺寸 | `setIgnoreMouseEvents` | `focusable` |
|------|---------|------------------------|-------------|
| 静默横条 | 120×6（×scale） | `true, { forward: true }` | `false` |
| 默认/收起 | 440×180（×scale） | `true, { forward: true }` | `false` |
| 鼠标悬停岛 | 440×180 | `false` | `false` |
| 展开（isPinned） | 440×180 | `false` | `true`（pin 期间） |

两个窗口均使用独立 `partition`（`persist:island` / `persist:settings`），避免 Chromium 同 session 共享缩放比例。

**`_lastPinTime` blur 防抖：**

Windows 上透明 Electron 窗口在 `setFocusable(true)` → `focus()` 后会立即触发 blur（已知 quirk）。记录 pin 时间戳，500ms 内收到的 blur 事件被忽略。

### 7.2 设置窗口

- `titleBarStyle: 'hidden'` + `titleBarOverlay`：保留 Windows 原生标题栏按钟，拖拽由 OS 处理，消除自定义 `-webkit-app-region: drag` 在 DWM 下的抜闪抖动
- `titleBarOverlay` 配色与界面背景 `#1c1b1f` 一致
- 尺寸 520×500，`partition: 'persist:settings'`（独立 session ，缩放偏好不意外继承岛窗口）
- `IPC.SETTINGS_GET`（invoke）读取，`IPC.SETTINGS_SET` 提交
- 保存后主进程校验所有字段并持久化，通过 `IPC.SETTINGS_CHANGED` 通知岛渲染层

---

## 8. 模块化设计

### 8.1 模块依赖图

```
src/shared/types.ts                  ← 所有模块共同依赖的类型契约
        │
        ├──► sidecar/SmtcServer      (原生采集层，独立进程)
        │         │ stdout JSON 行
        │         ▼
        ├──► src/main/providers/*    (采集层：解析 JSON，emit 事件)
        │    ├── media.ts            (SMTC 媒体会话)
        │    ├── notify.ts           (Windows 系统通知)
        │    ├── http-server.ts      (本地 HTTP 消息接收，127.0.0.1 only)
        │    └── lyrics.ts           (歌词拉取/解析/定位，由 media 事件驱动)
        │         │ EventEmitter
        │         ▼
        │    src/main/index.ts       (IPC 转发层)
        │         │ ipcRenderer.send / on / handle
        │         ▼
        ├──► src/preload/index.ts    (安全桥接层，contextBridge)
        │         │ window.electron.*
        │         ▼
        ├──► store/island.ts         (状态机层)
        │         │ ref / computed
        │         ▼
        └──► components/*            (纯展示层，只读 Store)
```

### 8.2 各模块边界规则

| 模块 | 允许依赖 | 禁止 |
|------|---------|------|
| `components/*` | store、composables | preload、ipcRenderer |
| `composables/*` | store、`window.electron` | ipcRenderer 直接调用 |
| `store/island.ts` | shared/types、`window.electron` | Electron API |
| `preload/index.ts` | ipcRenderer、types | main 模块 |
| `main/providers/*` | Node.js、types | renderer |
| `main/index.ts` | providers、ipcMain、window.ts | renderer |

---

## 9. 数据流

### 媒体信息流

```
Windows SMTC API
       │  WinRT
       ▼
SmtcServer.exe (C# sidecar)
  GetBestMusicSession()  ← 遍历 GetSessions()，优先 Playing 音乐 session
  SessionsChanged 事件   ← 立即唤醒主循环（无需等 300ms）
  Local Timer 插值       ← _basePos + (UtcNow - _baseTime).TotalSeconds
       │  stdout JSON 行（300ms/tick）
       ▼
MediaProvider._spawn() → readline 解析
       ├── emit('update', MediaInfo)   ──► MEDIA_UPDATE  → store.applyMediaUpdate()
       │                                                   ├── 换曲：重置 pos/dur/lyrics
       │                                                   └── pos>0 时更新 _syncPos
       └── emit('position', MediaPos)  ──► MEDIA_POSITION → 更新 _syncPos / _syncTime
                                                                    │
                                                     RAF 60fps 插值 → position.value
                                                                    │
                                                         Music.vue 进度条 + 歌词定位
```

### Seek 流

```
Music.vue 拖拽 mouseup
       │  window.electron.mediaSeek(seconds)
       ▼
ipcMain → mediaProvider.sendSeek(seconds)
       │  stdin: "seek:134.5\n"
       ▼
SmtcServer.exe → TryChangePlaybackPositionAsync()
       │  SMTC 触发 position 变化
       ▼
SmtcServer stdout → MEDIA_POSITION → store.position 更新
```

### 展开/收起流

```
鼠标移入岛
       ├── setClickThrough(false)       ← 可点击
       └── pauseSilentTimer()           ← 静默倒计时暂停

用户点击岛 → handleClick()
       ├── isSilent: exitSilent()       ← 横条 → 岛，重新倒计时
       └── 否: togglePin()
              ├── 已展开: 岛 → 卡片收起，等鼠标移出
              └── 未展开: clearSilentTimer() + 岛 → 卡片

鼠标移出岛
       ├── setClickThrough(true)        ← 穿透恢复
       ├── resumeSilentTimer()          ← 靠溢倒计时重启
       └── isExpanded && !isSilent: mouseLeave() ← 卡片 → 岛

静默计时器到期
       └── !isExpanded: enterSilent()   ← 岛 →  120×6 横条
```

### 静默模式完整流

```
          [岛，音乐播放]
               │
   鼠标进入岛内        鼠标在岛外
       ▼                  ▼
 pauseSilentTimer()   resumeSilentTimer()
  计时器暂停                N 秒倒计时运行中
                            │
                      N 秒到期
                            ▼
                    enterSilent()  ← isExpanded 必须为 false
                    isSilent=true
                    岛缩为 120×6 横条

          [横条] 点击 → exitSilent()
               ↳ isSilent=false + _startSilentTimer() 重新倒计时
```

### 歌词数据流

```
MediaProvider.emit('update', info)  (曲目变化)
       │
       ▼
LyricsProvider._fetchLyrics(title, artist, durationSec)
       ├── source='lrclib': GET lrclib.net/api/get → /api/search
       └── source='163':    GET music.163.com/api/search → /api/song/lyric
  (antiFetch id 防竞态：切歌时丢弃过期结果)
       │
       ▼
emit('data', lines: LyricLine[], durationSec: number)
       │  IPC LYRICS_DATA
       ▼
store/island.ts  onLyricsData()
       ├── lyricsData.value = lines
       └── durationSec > 0 → duration.value = durationSec  (覆盖 SMTC 上报值)

RAF 每帧:
  currentLyric = binarySearch(lyricsData, position * 1000 + lyricsDelay)
```

### HTTP / Windows 通知上岛流

```
外部程序 / 脚本
       │  POST http://127.0.0.1:19198/notify
       │  { "title": "...", "body": "...", "app": "..." }
       ▼
HttpNotifyProvider._server（Node.js http，仅 127.0.0.1）
       │  Bearer Token 鉴权（可选）→ 解析 JSON body
       │  emit('notify', NoticeInfo)
       ▼
src/main/index.ts
       │  IPC.NOTIFY_NEW → islandWin.webContents.send
       ▼
store/island.ts  applyNotification()
       ├── mode = 'NOTIFICATION'
       ├── notification.value = NoticeInfo
       └── 5s 后自动 → mode = 'COMPACT'

Windows 系统 Toast 通知
       │  notify.ts 监听
       └── 同一 NOTIFY_NEW 频道合并上岛
```

**curl 快速测试：**

```bash
curl -X POST http://127.0.0.1:19198/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mytoken" \
  -d '{"title":"构建成功","body":"main v0.2.0","app":"GitHub Actions"}'
```

---

## 10. 扩展指南

### 新增一种岛状态（以「天气」为例）

```
1. src/shared/types.ts
   → 添加 WeatherInfo 接口

2. src/main/providers/weather.ts
   → 定期获取天气数据，emit('update', WeatherInfo)

3. src/main/index.ts
   → 注册 provider，通过 ipcMain 转发到渲染层

4. src/preload/index.ts + index.d.ts
   → contextBridge 新增 onWeatherUpdate 方法

5. src/renderer/src/store/island.ts
   → IslandMode 添加 'WEATHER'
   → SIZE_MAP 添加对应尺寸
   → 添加 weatherInfo ref + applyWeatherUpdate action
   → init() 中订阅

6. src/renderer/src/components/Weather.vue
   → 从 store 读数据，纯展示

7. IslandShell.vue componentMap
   → 注册 WEATHER → Weather
```

### 新增原生 Windows API 数据源

如需访问更底层的 Windows API（如音量、屏幕亮度），建议复用 sidecar 模式：

1. 在 `sidecar/` 下新建 C# .NET 8 项目
2. 以相同 JSON 行协议写入 stdout，从 stdin 读取命令
3. 在 `main/providers/` 下新建 TypeScript 封装（继承 `EventEmitter`）

---

## 11. 启动与构建

```bash
# 安装 Node 依赖
npm install

# 编译 C# sidecar（首次或 sidecar 代码变更后执行）
dotnet build sidecar/SmtcServer -c Release

# 开发模式（支持 HMR）
npm run dev

# 类型检查
npx vue-tsc --noEmit --project tsconfig.web.json
npx tsc   --noEmit --project tsconfig.node.json

# 构建生产包（electron-builder 将 SmtcServer.exe 打包进 resources/）
npm run build
```

**系统要求：**

- Windows 10 2004+（Build 19041+）— SMTC API 最低版本要求
- Node.js 20+
- .NET 8 SDK（仅开发时需要，生产包含预编译 exe）

---

文档版本: 0.5.0 · 最后更新: 2026-04-21
