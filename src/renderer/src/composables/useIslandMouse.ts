// composables/useIslandMouse.ts
// 仅用于检测鼠标是否在岛元素上
// 穿透状态完全由主进程通过 ISLAND_EXPANDED IPC 统一管理

import { type Ref } from 'vue'
import { useMouseInElement } from '@vueuse/core'

export function useIslandMouse(targetRef: Ref<HTMLElement | null>) {
  const { isOutside } = useMouseInElement(targetRef)
  return { isOutside }
}
