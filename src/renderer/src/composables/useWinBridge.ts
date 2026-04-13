// composables/useWinBridge.ts
// 封装所有 window.electron.* 调用
// 组件和 Store 必须通过此 composable 与 Electron 通信，不得直接调用 window.electron

export function useWinBridge() {
  function setClickThrough(enable: boolean): void {
    window.electron?.setClickThrough(enable)
  }

  return { setClickThrough }
}
