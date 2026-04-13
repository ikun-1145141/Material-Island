<div align="center">

# Material Island

**Windows 桌面灵动岛** · Material Design 3

一个运行在 Windows 顶部的透明覆盖层，以 Apple Dynamic Island 为灵感，用 Material You 的语言重新诠释。

![Vue 3](https://img.shields.io/badge/Vue-3.4+-4FC08D?style=flat-square&logo=vue.js&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-30+-47848F?style=flat-square&logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/Platform-Windows_10%2B-0078D4?style=flat-square&logo=windows&logoColor=white)
![License](https://img.shields.io/badge/License-AGPL--3.0-green?style=flat-square)

</div>

---

## 预览

```
┌──────────────────────────────────────┐  ←  屏幕顶部
│                                      │
│         ╭─────────────────╮          │
│         │   22:30:15      │          │  ← 紧凑态（时钟）
│         ╰─────────────────╯          │
│                                      │
│    ╭───────────────────────────╮     │
│    │  ♫  Daylight  · Taylor   ●│    │  ← 音乐态（展开）
│    ╰───────────────────────────╯     │
└──────────────────────────────────────┘
```

## 功能

| 状态 | 触发条件 | 说明 |
|------|----------|------|
| **紧凑** | 默认 | 显示系统时钟，悬停展开 |
| **音乐** | 系统有媒体会话（SMTC）活跃 | 封面、歌曲名、艺术家、播放状态 |
| **通知** | 收到系统通知 | 应用名、标题、正文，5 秒自动收回 |
| **计时** | 手动激活 | 秒表，支持暂停 / 重置 |

- 透明无边框窗口，始终置顶
- 默认**鼠标穿透**，鼠标移入岛区域时自动恢复交互
- M3 动态配色，跟随系统深色模式自动切换
- M3 强调型弹出动画（`cubic-bezier(0.05, 0.7, 0.1, 1)`）

## 技术栈

- **框架**: Vue 3 + Composition API
- **桌面容器**: Electron 30
- **构建工具**: Vite 5 + electron-vite
- **状态管理**: Pinia
- **动效**: CSS Transition（M3 曲线） + `@vueuse/motion`
- **工具库**: VueUse
- **配色系统**: `@material/material-color-utilities`（Google 官方 M3 算法库）
- **语言**: TypeScript 5（全量类型覆盖，零 `any`）

## 快速开始

**系统要求**：Windows 10+，Node.js 20+

```bash
# 克隆仓库
git clone https://github.com/your-name/material-island.git
cd material-island

# 安装依赖
npm install

# 启动开发模式（支持热重载）
npm run dev
```

### 构建

```bash
# 编译并打包为 Windows 安装程序
npm run build
```

产物位于 `dist/` 目录。

## 目录结构

```
src/
├── shared/
│   └── types.ts             # 跨层数据契约（MediaInfo、NoticeInfo、IPC 常量）
│
├── main/                    # Electron 主进程
│   ├── index.ts             # 应用入口，注册 IPC
│   ├── window.ts            # 透明置顶窗口工厂
│   └── providers/
│       ├── media.ts         # Windows SMTC 媒体信息轮询
│       └── notify.ts        # 系统通知监听
│
├── preload/
│   ├── index.ts             # contextBridge 安全桥接
│   └── index.d.ts           # window.electron 全局类型
│
└── renderer/src/            # Vue 渲染层
    ├── App.vue              # 根组件
    ├── main.ts              # Vue 入口，注册 Pinia / Motion
    ├── store/island.ts      # 岛状态机（IslandMode 枚举 + 尺寸计算）
    ├── composables/
    │   ├── useM3Theme.ts    # M3 动态配色
    │   ├── useIslandMouse.ts# 鼠标进出 → 切换穿透 + 展开/收起
    │   └── useWinBridge.ts  # 封装 window.electron.*
    ├── components/
    │   ├── IslandShell.vue  # 药丸容器（形状动画 + 动态组件切换）
    │   ├── Compact.vue      # 时钟
    │   ├── Music.vue        # 媒体播放
    │   ├── Notification.vue # 系统通知
    │   └── Timer.vue        # 秒表
    └── styles/
        ├── tokens.css       # M3 CSS 变量（颜色、形状、排印）
        └── motion.css       # M3 动效时长与曲线变量
```

详细架构说明见 [ARCHITECTURE.md](ARCHITECTURE.md)。

## 扩展新状态

1. 在 `src/shared/types.ts` 中添加所需接口
2. 在 `store/island.ts` 的 `IslandMode` 联合类型中添加新值，并在 `SIZE_MAP` 中配置尺寸
3. 新建 `components/YourView.vue`
4. 在 `IslandShell.vue` 的 `componentMap` 中注册
5. 在 `store/island.ts` 中添加触发 action

## 配色自定义

在 `App.vue` 中修改品牌色（十六进制），M3 算法会自动生成完整的 Primary / Secondary / Surface 色板：

```ts
useM3Theme('#6750A4')  // 改成你的品牌色
```

## License

[AGPL-3.0](LICENSE)
