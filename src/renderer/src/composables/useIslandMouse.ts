// composables/useIslandMouse.ts
// 驱动鼠标穿透 + 展开时离开自动收起 + 静默计时器暂停/恢复：
//   鼠标进入岛 → setClickThrough(false) + 暂停静默倒计时
//   鼠标离开岛 → setClickThrough(true)  + 恢复静默倒计时
//   鼠标离开岛且已展开（非静默模式）→ mouseLeave() → 自动收起卡片

import { watch, type Ref } from 'vue'
import { useMouseInElement } from '@vueuse/core'
import { useIslandStore } from '@renderer/store/island'

export function useIslandMouse(targetRef: Ref<HTMLElement | null>) {
  const { isOutside } = useMouseInElement(targetRef)
  const store = useIslandStore()

  watch(isOutside, (outside) => {
    window.electron.setClickThrough(outside)

    if (outside) {
      // 鼠标离开：恢复静默倒计时
      store.resumeSilentTimer()
      // 展开状态且非静默模式时，自动收起卡片
      if (store.isExpanded && !store.isSilent) {
        store.mouseLeave()
      }
    } else {
      // 鼠标进入：暂停静默倒计时
      store.pauseSilentTimer()
    }
  })

  return { isOutside }
}
