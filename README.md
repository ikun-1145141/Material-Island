<div align="center">

# Material Island

**Windows 桌面灵动岛** · Material Design 3

一个运行在 Windows 顶部的透明覆盖层，以 Apple Dynamic Island 为灵感，用 Material You 的语言重新诠释。

![Vue 3](https://img.shields.io/badge/Vue-3.4+-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-30+-47848F?style=flat-square&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat-square&logo=typescript&logoColor=white)
![C#](https://img.shields.io/badge/C%23-.NET_8-512BD4?style=flat-square&logo=dotnet&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows_10%2B-0078D4?style=flat-square&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL--3.0-green?style=flat-square)

</div>

---

## 预览

```
屏幕顶部
┌──────────────────────────────────────────────────────────┐
│                                                          │
│              ╭──────────────╮                            │
│              │  22:30:15    │   ← 紧凑态（时钟）         │
│              ╰──────────────╯                            │
│                                                          │
│     ╭─────────────────────────────────────────────╮     │
│     │  [封面]  Daylight · Taylor Swift             │     │
│     │          ══════●══════════════  02:15/03:48  │     │  ← 音乐态（展开）
│     │          ⏮  ⏸  ⏭    SPOTIFY                │     │
│     ╰─────────────────────────────────────────────╯     │
│                                                          │
│                   ▬▬▬▬▬                                 │  ← 静默态（极细横条）
└──────────────────────────────────────────────────────────┘
```

## 功能

| 状态 | 触发条件 | 说明 |
|------|----------|------|
| **紧凑** | 默认 | 显示系统时钟，悬停展开 |
| **音乐** | 系统有媒体会话（SMTC）活跃 | 封面缩略图、歌曲、艺术家、播放源、进度条 |
| **通知** | 收到 Windows 系统通知 或 HTTP 推送 | 应用名、标题、正文，5 秒自动收回 |
| **计时** | 手动激活 | 秒表，支持暂停 / 重置 |
| **静默** | 手动或自动倒计时触发 | 岛缩为顶部极细横条，点击恢复正常岛形态 |

**通知渠道：**

- **HTTP 推送**：任意外部程序向本地服务发送 POST 请求即可将消息提上岛

  ```bash
  curl -X POST http://127.0.0.1:19198/notify \
    -H "Content-Type: application/json" \
    -d '{"title":"构建成功","body":"main v1.0.0","app":"GitHub Actions"}'
  ```

- **Windows 系统 Toast 通知**：自动监听系统通知中心，新弹窗同步上岛

**音乐控制（展开态）：**

- 上/下曲、播放/暂停
- 拖拽进度条 seek 到任意位置
- 专辑封面（58×58，从 SMTC 读取）
- 播放来源应用名称标签

**窗口行为：**

- 透明无边框，始终置顶
- 默认**鼠标穿透**，鼠标移入岛区域时自动恢复交互
- 点击岛展开卡片；鼠标移出岛区域自动收起
- 系统托盘图标，右键菜单（打开设置 / 退出）

**静默模式：**

- 音乐播放一段时间后，岛自动收缩为顶部 120×6px 极细横条
- **鼠标指针在岛内时自动暂停倒计时**，移出岛外后重新开始倒计时
- 横条带呼吸动画，点击后恢复正常岛形态，再点击展开卡片
- 卡片展开期间不计时；收起卡片后或鼠标移出岛后重新计时

**设置：**

- 岛的缩放倍数（0.5× ～ 2.0×）
- 距屏幕顶部偏移量
- 多显示器选择
- 静默模式开关 + 自动静默延迟（秒）
- **消息接收**：HTTP 服务开关、监听端口、Bearer Token 鉴权

## 技术栈

| 层 | 技术 |
|----|------|
| **桌面容器** | Electron 30 |
| **前端框架** | Vue 3.4 + Composition API |
| **构建工具** | Vite 5 + electron-vite |
| **状态管理** | Pinia |
| **动效** | CSS Transition（M3 曲线）|
| **工具库** | VueUse |
| **配色系统** | `@material/material-color-utilities`（Google 官方 M3 算法）|
| **图标** | Material Symbols Rounded（`@fontsource-variable/material-symbols-rounded`）|
| **语言** | TypeScript 5（全量类型覆盖，零 `any`）|
| **SMTC sidecar** | C# / .NET 8 — `SmtcServer.exe`，读取 Windows 媒体会话 |
| **HTTP 服务** | Node.js 内置 `http` 模块，仅绑定 127.0.0.1 |

## 快速开始

**系统要求**：Windows 10 2004+（Build 19041+）、Node.js 20+、.NET 8 SDK

```bash
# 克隆仓库
git clone https://github.com/your-name/material-island.git
cd material-island

# 安装 Node 依赖
npm install

# 编译 C# SMTC sidecar（首次或 sidecar 代码变更后需要）
dotnet build sidecar/SmtcServer -c Release

# 启动开发模式（支持热重载）
npm run dev
```

### 构建生产包

```bash
npm run build
```

产物位于 `dist/`，electron-builder 会将 `SmtcServer.exe` 打包进 `resources/`。

## 目录结构

```
Material-Island/
├── scripts/
│   └── gen-icon.mjs         # SVG → ICO 生成（prebuild 自动执行）
├── resources/
│   ├── icon.ico             # 安装包图标（MD3 圆角深色风格）
│   └── music_cast.png       # 系统托盘图标
├── sidecar/
│   └── SmtcServer/          # C# .NET 8 SMTC 服务进程
│       └── Program.cs       # 读取系统媒体会话，通过 stdout 推送 JSON
│
└── src/
    ├── shared/
    │   └── types.ts         # 跨层数据契约（MediaInfo、IPC 常量、AppSettings）
    │
    ├── main/                # Electron 主进程
    │   ├── index.ts         # 入口：窗口生命周期、IPC 注册、Provider 启动
    │   ├── window.ts        # 窗口工厂：透明/置顶/无边框 + setIslandExpanded()
    │   ├── tray.ts          # 系统托盘图标与右键菜单
    │   ├── settings-store.ts# 设置持久化（electron-store）
    │   └── providers/
    │       ├── media.ts     # 启动/守护 SmtcServer sidecar，解析媒体事件
    │       ├── notify.ts    # Windows 系统通知监听
    │       └── http-server.ts# 本地 HTTP 消息接收（仅 127.0.0.1）
    │
    ├── preload/
    │   ├── index.ts         # contextBridge 安全桥接（最小接口原则）
    │   └── index.d.ts       # window.electron 全局类型声明
    │
    └── renderer/src/        # Vue 渲染层
        ├── App.vue          # 根组件：背景点击捕获、鼠标穿透联动
        ├── main.ts          # Vue 入口，注册 Pinia
        ├── store/
        │   └── island.ts    # 岛状态机（IslandMode + IPC 订阅 + togglePin）
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
            └── motion.css       # M3 动效时长与曲线变量
```

详细架构设计见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 扩展新状态

1. 在 `src/shared/types.ts` 中添加所需数据接口
2. 在 `store/island.ts` 的 `IslandMode` 联合类型和 `SIZE_MAP` 中添加新条目
3. 新建 `components/YourView.vue`
4. 在 `IslandShell.vue` 的 `componentMap` 中注册
5. 在 `store/island.ts` 中添加触发该状态的 action

## 配色自定义

在 `App.vue` 中修改品牌色（十六进制），M3 算法自动生成完整色板：

```ts
useM3Theme('#6750A4')  // 改成你的品牌色
```

## License

[AGPL-3.0](LICENSE)
