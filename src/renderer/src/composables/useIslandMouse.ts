// composables/useIslandMouse.ts
// 监听鼠标是否在岛元素上，动态切换 Electron 窗口的鼠标穿透状态

import { type Ref, watch } from 'vue'
import { useMouseInElement } from '@vueuse/core'
import { useWinBridge } from './useWinBridge'
import { useIslandStore } from '@renderer/store/island'

export function useIslandMouse(targetRef: Ref<HTMLElement | null>) {
  const { isOutside } = useMouseInElement(targetRef)
  const { setClickThrough } = useWinBridge()
  const store = useIslandStore()

  watch(isOutside, (outside) => {
    // 鼠标离开岛 → 穿透，鼠标进入岛 → 不穿透
    setClickThrough(outside)

    if (outside) {
      store.collapse() // isPinned 时 collapse() 内部会忽略
    } else {
      store.expand()
    }
  })

  return { isOutside }
}
