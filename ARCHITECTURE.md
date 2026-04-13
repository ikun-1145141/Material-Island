# Material Island — 架构文档

> **技术栈**: Vue 3 + TypeScript + Vite + Electron  
> **设计语言**: Material Design 3 (Material You)  
> **灵感来源**: Apple Dynamic Island

---

## 目录

1. [项目概述](#1-项目概述)
2. [核心技术栈](#2-核心技术栈)
3. [目录结构](#3-目录结构)
4. [架构分层](#4-架构分层)
5. [核心模块设计](#5-核心模块设计)
   - 5.1 [Electron 主进程](#51-electron-主进程)
   - 5.2 [Preload 桥接层](#52-preload-桥接层)
   - 5.3 [岛状态机 (Pinia Store)](#53-岛状态机-pinia-store)
   - 5.4 [UI 组件层](#54-ui-组件层)
   - 5.5 [动效系统](#55-动效系统)
   - 5.6 [M3 主题系统](#56-m3-主题系统)
6. [数据流](#6-数据流)
7. [扩展指南](#7-扩展指南)
8. [启动与构建](#8-启动与构建)

---

## 1. 项目概述

Material Island 是一个运行在 **Windows** 桌面端的 **灵动岛风格通知中枢**，基于 Electron 实现无边框透明窗口，利用 Vue 3 的响应式系统驱动岛的状态切换动画，全程遵循 Material Design 3 规范。

**核心能力：**

| 能力 | 实现方式 |
|------|----------|
| 透明置顶窗口 | Electron `BrowserWindow` 透明 + 始终置顶 |
| 点击穿透 | `win.setIgnoreMouseEvents()` 动态切换 |
| 状态驱动 UI | Pinia 状态机 + Vue `<Transition>` |
| 弹簧动画 | `@vueuse/motion` Spring 曲线 |
| 系统信息获取 | Electron IPC + Node.js 原生 API |
| M3 动态配色 | CSS Custom Properties + `useDynamicColor` |

---

## 2. 核心技术栈

```
运行时
├── Electron 30+          # Windows 桌面容器，管理窗口生命周期
├── Node.js 20+           # 主进程运行环境

渲染层
├── Vue 3.4+              # Composition API，响应式 UI 框架
├── TypeScript 5+         # 全量类型覆盖
├── Vite 5+               # 极速构建与 HMR
└── electron-vite         # Electron 专用 Vite 封装

状态与逻辑
├── Pinia 2+              # 岛状态机（当前模式、是否展开等）
└── VueUse                # useMouseInElement / useSpring 等工具集

动效
└── @vueuse/motion        # Spring 弹簧动画，语法同 Framer Motion

M3 设计系统
├── material-color-utilities   # Google 官方 M3 配色算法库
└── 自定义 CSS Token 系统       # --md-sys-color-* 变量
```

---

## 3. 目录结构

```
Material-Island/
├── electron.vite.config.ts      # electron-vite 总配置
├── package.json
├── tsconfig.json
│
├── src/
│   ├── main/                    # ── Electron 主进程 ──
│   │   ├── index.ts             # 入口：创建窗口、注册 IPC handler
│   │   ├── window.ts            # 窗口工厂：透明、置顶、无边框配置
│   │   └── providers/           # 系统数据提供者
│   │       ├── media.ts         # 获取当前播放媒体 (Windows: SMTC)
│   │       └── notify.ts        # 系统通知监听
│   │
│   ├── preload/                 # ── IPC 桥接层 ──
│   │   └── index.ts             # contextBridge 暴露安全 API
│   │
│   └── renderer/                # ── Vue 渲染层 ──
│       ├── index.html
│       └── src/
│           ├── main.ts          # Vue 应用入口，注册 Pinia / Router
│           ├── App.vue          # 岛的外壳容器，处理形状动画
│           │
│           ├── components/      # 岛的各状态组件
│           │   ├── IslandShell.vue   # 药丸容器（控制宽高伸缩）
│           │   ├── Compact.vue       # 紧凑态：默认时间/图标
│           │   ├── Music.vue         # 音乐播放控制
│           │   ├── Notification.vue  # 系统通知
│           │   └── Timer.vue         # 计时/倒计时
│           │
│           ├── composables/     # 可复用逻辑 (hooks)
│           │   ├── useM3Theme.ts     # M3 动态配色
│           │   ├── useIslandMouse.ts # 鼠标悬停 → 切换穿透
│           │   └── useWinBridge.ts   # 封装 window.electron API
│           │
│           ├── store/
│           │   └── island.ts    # Pinia：岛的核心状态机
│           │
│           ├── styles/
│           │   ├── tokens.css   # M3 CSS 变量（颜色、形状、排印）
│           │   └── motion.css   # 全局过渡时长变量
│           │
│           └── assets/          # M3 图标 / 静态资源
```

---

## 4. 架构分层

```
┌─────────────────────────────────────────────┐
│              操作系统 / 系统 API              │
│    (媒体会话 SMTC / 通知中心 / 文件系统)      │
└────────────────────┬────────────────────────┘
                     │ Node.js API
┌────────────────────▼────────────────────────┐
│              Electron 主进程                  │
│  window.ts  ·  providers/*  ·  IPC handler  │
└────────────────────┬────────────────────────┘
                     │ contextBridge (安全隔离)
┌────────────────────▼────────────────────────┐
│                  Preload                     │
│          window.electron.* API              │
└────────────────────┬────────────────────────┘
                     │ 调用
┌────────────────────▼────────────────────────┐
│           Vue 渲染层 (Renderer)              │
│                                             │
│  composables  →  Pinia Store  →  Components │
│  (副作用/IO)     (状态机)        (纯展示层)   │
└─────────────────────────────────────────────┘
```

**设计原则：**

- **单向数据流**：系统事件 → Pinia → 组件，禁止组件直接调用 IPC
- **主进程零 UI 逻辑**：渲染层不感知 Electron，仅通过 `composables/useWinBridge` 间接调用
- **状态机驱动 UI**：岛的形态由 `island.ts` 中枚举状态决定，组件只负责渲染

---

## 5. 核心模块设计

### 5.1 Electron 主进程

**`src/main/window.ts`** — 窗口工厂

```typescript
import { BrowserWindow, screen } from 'electron'

export function createIslandWindow(): BrowserWindow {
  const { width } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 240,
    height: 40,
    x: Math.round(width / 2 - 120),
    y: 8,                          // 屏幕顶部，模拟刘海区域
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,      // 安全：禁止渲染层直接用 Node
    },
  })

  // 默认穿透鼠标点击（桌面其他操作不受影响）
  win.setIgnoreMouseEvents(true, { forward: true })

  return win
}
```

**`src/main/index.ts`** — IPC 注册

```typescript
// 渲染层通知主进程切换穿透状态
ipcMain.on('island:set-clickthrough', (_, enable: boolean) => {
  win.setIgnoreMouseEvents(enable, { forward: true })
})

// 媒体信息推送（主进程 → 渲染层）
mediaProvider.on('update', (info) => {
  win.webContents.send('media:update', info)
})
```

---

### 5.2 Preload 桥接层

**`src/preload/index.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  // 渲染层 → 主进程
  setClickThrough: (enable: boolean) =>
    ipcRenderer.send('island:set-clickthrough', enable),

  // 主进程 → 渲染层（事件订阅）
  onMediaUpdate: (cb: (info: MediaInfo) => void) =>
    ipcRenderer.on('media:update', (_, data) => cb(data)),

  onNotification: (cb: (notice: NoticeInfo) => void) =>
    ipcRenderer.on('notify:new', (_, data) => cb(data)),
})
```

> **原则**：`contextBridge` 只暴露最小必要接口，所有数据须经过类型校验后再注入 Store。

---

### 5.3 岛状态机 (Pinia Store)

**`src/renderer/src/store/island.ts`**

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// 岛的所有可能状态
export type IslandMode = 'COMPACT' | 'MUSIC' | 'NOTIFICATION' | 'TIMER'

export const useIslandStore = defineStore('island', () => {
  // ── 状态 ──
  const mode = ref<IslandMode>('COMPACT')
  const isExpanded = ref(false)
  const mediaInfo = ref<MediaInfo | null>(null)
  const notification = ref<NoticeInfo | null>(null)

  // ── 计算属性 ──
  const islandSize = computed(() => {
    if (!isExpanded.value) return { width: 200, height: 36 }
    const sizeMap: Record<IslandMode, { width: number; height: number }> = {
      COMPACT:      { width: 200, height: 36 },
      MUSIC:        { width: 380, height: 120 },
      NOTIFICATION: { width: 340, height: 80 },
      TIMER:        { width: 260, height: 60 },
    }
    return sizeMap[mode.value]
  })

  // ── 动作 ──
  function applyMediaUpdate(info: MediaInfo) {
    mediaInfo.value = info
    mode.value = 'MUSIC'
  }

  function applyNotification(notice: NoticeInfo) {
    notification.value = notice
    mode.value = 'NOTIFICATION'
    // 5 秒后自动收回
    setTimeout(() => { mode.value = 'COMPACT' }, 5000)
  }

  function collapse() {
    isExpanded.value = false
  }

  function expand() {
    isExpanded.value = true
  }

  // ── IPC 订阅（在 App.vue 的 onMounted 中调用 init）──
  function init() {
    window.electron.onMediaUpdate(applyMediaUpdate)
    window.electron.onNotification(applyNotification)
  }

  return {
    mode, isExpanded, mediaInfo, notification, islandSize,
    applyMediaUpdate, applyNotification, collapse, expand, init,
  }
})
```

---

### 5.4 UI 组件层

#### IslandShell.vue — 药丸容器

负责岛的形状动画，内部使用 `<component :is>` 动态切换内容。

```html
<template>
  <div
    v-motion
    class="island-shell"
    :initial="{ width: 200, height: 36, borderRadius: 20 }"
    :animate="{
      width: store.islandSize.width,
      height: store.islandSize.height,
      transition: { type: 'spring', stiffness: 300, damping: 28 }
    }"
    @mouseenter="store.expand(); setClickThrough(false)"
    @mouseleave="store.collapse(); setClickThrough(true)"
  >
    <Transition name="island-fade" mode="out-in">
      <component :is="activeComponent" :key="store.mode" />
    </Transition>
  </div>
</template>
```

#### 组件状态映射表

| 组件文件 | 对应 `IslandMode` | 触发条件 |
|----------|-------------------|----------|
| `Compact.vue` | `COMPACT` | 默认/空闲 |
| `Music.vue` | `MUSIC` | 系统媒体会话活跃 |
| `Notification.vue` | `NOTIFICATION` | 收到系统通知 |
| `Timer.vue` | `TIMER` | 用户手动启动计时 |

---

### 5.5 动效系统

**使用 `@vueuse/motion` 的 Spring 动画（推荐）**

```bash
npm install @vueuse/motion
```

在 `main.ts` 中注册：

```typescript
import { MotionPlugin } from '@vueuse/motion'
app.use(MotionPlugin)
```

**过渡参数参考值（M3 风格）：**

| 动画类型 | stiffness | damping | 说明 |
|----------|-----------|---------|------|
| 岛扩展/收缩 | 300 | 28 | 丝滑弹簧，不过冲 |
| 状态切换 fade | — | — | CSS `opacity` 150ms |
| 通知弹入 | 400 | 20 | 略带弹跳感 |

**`styles/motion.css`** — 全局过渡变量

```css
:root {
  --md-motion-duration-short: 150ms;
  --md-motion-duration-medium: 250ms;
  --md-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1);
  --md-motion-easing-emphasized: cubic-bezier(0.05, 0.7, 0.1, 1);
}

.island-fade-enter-active,
.island-fade-leave-active {
  transition: opacity var(--md-motion-duration-short) var(--md-motion-easing-standard);
}
.island-fade-enter-from,
.island-fade-leave-to {
  opacity: 0;
}
```

---

### 5.6 M3 主题系统

**`src/renderer/src/composables/useM3Theme.ts`**

```typescript
import { watchEffect } from 'vue'
import { argbFromHex, themeFromSourceColor, applyTheme } from '@material/material-color-utilities'

export function useM3Theme(sourceHex = '#6750A4') {
  const theme = themeFromSourceColor(argbFromHex(sourceHex))

  watchEffect(() => {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    applyTheme(theme, { target: document.documentElement, dark: isDark })
  })
}
```

在 `App.vue` 中调用：

```typescript
// App.vue <script setup>
import { useM3Theme } from './composables/useM3Theme'
useM3Theme('#6750A4')  // 传入品牌色，M3 自动生成全套配色
```

生成的 CSS 变量可直接在组件中使用：

```css
.island-shell {
  background: var(--md-sys-color-surface-container-high);
  color: var(--md-sys-color-on-surface);
}
```

---

## 6. 数据流

```
系统事件（媒体/通知）
       │
       ▼
  主进程 Provider
  (src/main/providers/*)
       │  ipcMain.send
       ▼
  Preload contextBridge
  window.electron.onMediaUpdate
       │
       ▼
  Pinia Store (island.ts)
  applyMediaUpdate / applyNotification
       │
       ▼
  计算属性 islandSize / activeComponent
       │
       ▼
  IslandShell.vue  →  v-motion 动画
       │
       ▼
  子组件渲染 (Music / Notification / ...)
       │
       ▼
  用户交互（鼠标悬停）
       │  ipcRenderer.send
       ▼
  主进程 setIgnoreMouseEvents()
```

---

## 7. 扩展指南

### 新增一种岛状态

1. 在 `store/island.ts` 的 `IslandMode` 联合类型中添加新枚举值
2. 在 `islandSize` 的 `sizeMap` 中添加对应尺寸
3. 在 `components/` 下新建对应 `.vue` 文件
4. 在 `IslandShell.vue` 的组件映射表中注册
5. 在 `store/island.ts` 中添加触发该状态的 action

### 新增一种系统数据源

1. 在 `src/main/providers/` 下新建 `xxx.ts`，继承 `EventEmitter`
2. 在 `src/main/index.ts` 中注册并转发 IPC 事件
3. 在 `src/preload/index.ts` 的 `contextBridge` 中暴露订阅接口
4. 在 Pinia Store 的 `init()` 中订阅

---

## 8. 启动与构建

```bash
# 安装依赖
npm install

# 开发模式（支持 HMR）
npm run dev

# 构建生产包
npm run build

# 预览打包结果
npm run preview
```

**推荐初始化方式：**

```bash
npm create electron-vite@latest
# 选择: Vue → TypeScript
```

**核心依赖安装：**

```bash
npm install pinia @vueuse/core @vueuse/motion
npm install @material/material-color-utilities
```

---

*文档版本: 0.1.0 · 最后更新: 2026-04-13*
