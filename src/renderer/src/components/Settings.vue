<template>
  <div class="settings-root">
    <!-- 标题栏：仅显示标题文字，closing 由 titleBarOverlay 原生按钟处理 -->
    <div class="titlebar">
      <span class="titlebar-title">Material Island 设置</span>
    </div>

    <div class="content">
      <!-- 缩放 -->
      <section class="section">
        <h3 class="section-title">缩放</h3>
        <div class="row">
          <label class="row-label">岛的大小</label>
          <div class="slider-group">
            <input
              type="range"
              min="0.5" max="2.0" step="0.05"
              v-model.number="draft.scale"
              class="slider"
            />
            <span class="slider-val">{{ Math.round(draft.scale * 100) }}%</span>
          </div>
        </div>
        <div class="preset-row">
          <button
            v-for="p in scalePresets"
            :key="p.value"
            class="preset-btn"
            :class="{ active: Math.abs(draft.scale - p.value) < 0.01 }"
            @click="draft.scale = p.value"
          >{{ p.label }}</button>
        </div>
      </section>

      <!-- 位置 -->
      <section class="section">
        <h3 class="section-title">位置</h3>
        <div class="row">
          <label class="row-label">距顶部偏移</label>
          <div class="slider-group">
            <input
              type="range"
              min="0" max="200" step="1"
              v-model.number="draft.topOffset"
              class="slider"
            />
            <span class="slider-val">{{ draft.topOffset }}px</span>
          </div>
        </div>
      </section>

      <!-- 显示器 -->
      <section class="section" v-if="displays.length > 1">
        <h3 class="section-title">显示器</h3>
        <div class="row">
          <label class="row-label">显示在</label>
          <select v-model.number="draft.displayId" class="select">
            <option :value="-1">主显示器</option>
            <option v-for="d in displays" :key="d.id" :value="d.id">{{ d.label }}</option>
          </select>
        </div>
      </section>

      <!-- 静默模式 -->
      <section class="section">
        <h3 class="section-title">静默模式</h3>
        <div class="row">
          <label class="row-label">启用静默模式</label>
          <label class="toggle">
            <input type="checkbox" v-model="draft.silentMode" />
            <span class="toggle-track" />
          </label>
        </div>
        <div class="row" v-if="draft.silentMode">
          <label class="row-label">自动静默</label>
          <div class="slider-group">
            <input
              type="range"
              min="0" max="300" step="5"
              v-model.number="draft.silentModeDelay"
              class="slider"
            />
            <span class="slider-val">
              {{ draft.silentModeDelay === 0 ? '关闭' : draft.silentModeDelay + 's' }}
            </span>
          </div>
        </div>
        <p class="section-hint" v-if="draft.silentMode && draft.silentModeDelay > 0">
          播放 {{ draft.silentModeDelay }} 秒后，岛自动缩为顶部横条
        </p>
        <p class="section-hint" v-else-if="draft.silentMode">
          仅手动点击托盘图标进入静默，不自动静默
        </p>
      </section>

      <!-- 消息接收 -->
      <section class="section">
        <h3 class="section-title">消息接收</h3>
        <div class="row">
          <label class="row-label">HTTP 服务</label>
          <label class="toggle">
            <input type="checkbox" v-model="draft.httpEnabled" />
            <span class="toggle-track" />
          </label>
        </div>
        <template v-if="draft.httpEnabled">
          <div class="row">
            <label class="row-label">监听端口</label>
            <input
              type="number"
              min="1024" max="65535" step="1"
              v-model.number="draft.httpPort"
              class="text-input"
            />
          </div>
          <div class="row">
            <label class="row-label">Bearer Token</label>
            <div class="token-group">
              <input
                :type="showToken ? 'text' : 'password'"
                v-model="draft.httpToken"
                placeholder="留空则不鉴权"
                class="text-input flex-1"
                autocomplete="off"
              />
              <button class="icon-btn" @click="showToken = !showToken" :title="showToken ? '隐藏' : '显示'">
                <span class="material-symbols-rounded">{{ showToken ? 'visibility_off' : 'visibility' }}</span>
              </button>
              <button class="icon-btn" @click="copyToken" title="复制">
                <span class="material-symbols-rounded">content_copy</span>
              </button>
            </div>
          </div>
          <p class="section-hint addr-hint">
            接口地址：<code class="addr">http://127.0.0.1:{{ draft.httpPort }}/notify</code>
          </p>
          <p class="section-hint">
            POST JSON：<code class="addr">{ "title": "…", "body": "…", "app": "…" }</code>
          </p>
        </template>
      </section>

      <!-- 操作按钮 -->
      <div class="actions">
        <button class="btn secondary" @click="reset">恢复默认</button>
        <button class="btn primary" @click="save">应用</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import type { AppSettings } from '@shared/types'

const displays = ref<{ id: number; label: string }[]>([])
const showToken = ref(false)

const draft = reactive<AppSettings>({
  scale: 1.0,
  topOffset: 0,
  displayId: -1,
  silentMode: false,
  silentModeDelay: 0,
  httpEnabled: false,
  httpPort: 19198,
  httpToken: '',
})

const scalePresets = [
  { label: '80%',  value: 0.8 },
  { label: '100%', value: 1.0 },
  { label: '120%', value: 1.2 },
  { label: '150%', value: 1.5 },
]

onMounted(async () => {
  const result = await window.electron.getSettings()
  displays.value = result.displays
  Object.assign(draft, result.settings)
})

function save(): void {
  window.electron.setSettings({ ...draft })
}

function reset(): void {
  draft.scale           = 1.0
  draft.topOffset       = 0
  draft.displayId       = -1
  draft.silentMode      = false
  draft.silentModeDelay = 0
  draft.httpEnabled     = false
  draft.httpPort        = 19198
  draft.httpToken       = ''
  window.electron.setSettings({ ...draft })
}

function copyToken(): void {
  if (draft.httpToken) navigator.clipboard.writeText(draft.httpToken)
}
</script>

<style scoped>
* { box-sizing: border-box; }

.settings-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #1c1b1f;
  color: #e6e1e5;
  font-family: 'Segoe UI Variable', 'Segoe UI', system-ui, sans-serif;
  font-size: 13px;
  user-select: none;
}

/* 标题栏 */
.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  height: 40px;
  background: #1c1b1f;
  -webkit-app-region: drag;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.titlebar-title {
  font-size: 13px;
  font-weight: 600;
  color: #cac4d0;
}

/* 内容区 */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-title {
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #938f99;
}

.row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.row-label {
  width: 100px;
  flex-shrink: 0;
  color: #cac4d0;
}

/* 滑块 */
.slider-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}
.slider {
  flex: 1;
  accent-color: #d0bcff;
  height: 4px;
  cursor: pointer;
}
.slider-val {
  width: 40px;
  text-align: right;
  color: #d0bcff;
  font-variant-numeric: tabular-nums;
}

/* 预设按钮 */
.preset-row {
  display: flex;
  gap: 8px;
  padding-left: 116px;
}
.preset-btn {
  padding: 4px 14px;
  border-radius: 99px;
  border: 1px solid rgba(255,255,255,0.12);
  background: transparent;
  color: #cac4d0;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.preset-btn:hover { background: rgba(255,255,255,0.08); }
.preset-btn.active {
  background: #4a4458;
  border-color: #d0bcff;
  color: #e8def8;
}

/* 下拉框 */
.select {
  flex: 1;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: #2b2930;
  color: #e6e1e5;
  font-size: 13px;
  cursor: pointer;
  outline: none;
}
.select:focus { border-color: #d0bcff; }

/* 操作按钮 */
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.btn {
  padding: 8px 24px;
  border-radius: 99px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: opacity 0.15s, transform 0.1s;
}
.btn:active { transform: scale(0.96); }
.btn.secondary {
  background: rgba(255,255,255,0.08);
  color: #cac4d0;
}
.btn.secondary:hover { background: rgba(255,255,255,0.12); }
.btn.primary {
  background: #d0bcff;
  color: #1c1b1f;
}
.btn.primary:hover { opacity: 0.9; }

/* ── 开关 Toggle ── */
.toggle {
  position: relative;
  display: inline-flex;
  cursor: pointer;
}
.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.toggle-track {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.2);
  transition: background 0.2s, border-color 0.2s;
  flex-shrink: 0;
}
.toggle-track::after {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #938f99;
  transition: transform 0.2s, background 0.2s;
}
.toggle input:checked + .toggle-track {
  background: #d0bcff;
  border-color: #d0bcff;
}
.toggle input:checked + .toggle-track::after {
  transform: translateX(20px);
  background: #1c1b1f;
}

/* 提示文字 */
.section-hint {
  font-size: 11px;
  color: #79747e;
  margin: 0;
  padding-left: 4px;
}

/* 文本输入框 */
.text-input {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.12);
  background: #2b2930;
  color: #e6e1e5;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  width: 100px;
}
.text-input.flex-1 { flex: 1; width: auto; }
.text-input:focus { border-color: #d0bcff; }

/* Token 输入框组 */
.token-group {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* 图标按钮 */
.icon-btn {
  width: 30px;
  height: 30px;
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 8px;
  background: #2b2930;
  color: #cac4d0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.15s;
}
.icon-btn:hover { background: rgba(255,255,255,0.1); }
.icon-btn .material-symbols-rounded {
  font-size: 18px;
  font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20;
}

/* 地址提示 */
.addr-hint { margin-top: 2px; }
.addr {
  font-family: 'Cascadia Code', 'Consolas', monospace;
  font-size: 11px;
  color: #d0bcff;
  background: rgba(208,188,255,0.08);
  padding: 1px 5px;
  border-radius: 4px;
}
</style>

<style>
@import '@fontsource-variable/material-symbols-rounded';
.material-symbols-rounded {
  font-family: 'Material Symbols Rounded Variable', sans-serif;
  font-weight: normal;
  font-style: normal;
  line-height: 1;
  letter-spacing: normal;
  text-transform: none;
  white-space: nowrap;
  word-wrap: normal;
  direction: ltr;
  -webkit-font-smoothing: antialiased;
  font-feature-settings: 'liga';
  display: inline-block;
  vertical-align: middle;
  user-select: none;
}
</style>
