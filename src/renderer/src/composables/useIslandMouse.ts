// composables/useIslandMouse.ts
// 监听鼠标是否在岛元素上，动态切换 Electron 窗口的鼠标穿透状态
// 展开/收起完全由用户点击（togglePin）控制，此处不干预

import { type Ref, watch } from 'vue'
import { useMouseInElement } from '@vueuse/core'
import { useWinBridge } from './useWinBridge'

export function useIslandMouse(targetRef: Ref<HTMLElement | null>) {
  const { isOutside } = useMouseInElement(targetRef)
  const { setClickThrough } = useWinBridge()

  watch(isOutside, (outside) => {
    // 鼠标离开岛 → 穿透到桌面，鼠标在岛上 → 正常接收事件
    setClickThrough(outside)
  })

  return { isOutside }
}
