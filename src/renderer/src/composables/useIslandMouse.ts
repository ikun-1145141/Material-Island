// composables/useIslandMouse.ts
// 驱动鼠标穿透 + 展开时离开自动收起：
//   鼠标进入岛 → setClickThrough(false) → 可以点击岛
//   鼠标离开岛 → setClickThrough(true)  → 点击穿透到桌面
//   鼠标离开岛且已展开 → mouseLeave() → 自动收起卡片

import { watch, type Ref } from 'vue'
import { useMouseInElement } from '@vueuse/core'
import { useIslandStore } from '@renderer/store/island'

export function useIslandMouse(targetRef: Ref<HTMLElement | null>) {
  const { isOutside } = useMouseInElement(targetRef)
  const store = useIslandStore()

  watch(isOutside, (outside) => {
    window.electron.setClickThrough(outside)
    // 展开状态下鼠标离开岛 → 自动收起
    if (outside && store.isExpanded) {
      store.mouseLeave()
    }
  })

  return { isOutside }
}
