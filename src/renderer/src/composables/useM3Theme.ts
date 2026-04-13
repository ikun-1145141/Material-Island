// composables/useM3Theme.ts
// 从品牌色出发，通过 Google material-color-utilities 生成完整 M3 配色
// 并将 --md-sys-color-* CSS 变量注入到 :root，响应系统深色模式切换

import { onMounted, onUnmounted } from 'vue'

type Scheme = 'light' | 'dark'

export function useM3Theme(sourceHex = '#6750A4') {
  let cleanup: (() => void) | null = null

  async function apply(scheme: Scheme): Promise<void> {
    try {
      const { argbFromHex, themeFromSourceColor, applyTheme } =
        await import('@material/material-color-utilities')

      const theme = themeFromSourceColor(argbFromHex(sourceHex))
      applyTheme(theme, {
        target: document.documentElement,
        dark: scheme === 'dark',
      })
    } catch {
      // 降级：tokens.css 中已提供默认值，不影响主流程
    }
  }

  onMounted(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    apply(mq.matches ? 'dark' : 'light')

    const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light')
    mq.addEventListener('change', handler)
    cleanup = () => mq.removeEventListener('change', handler)
  })

  onUnmounted(() => {
    cleanup?.()
  })
}
