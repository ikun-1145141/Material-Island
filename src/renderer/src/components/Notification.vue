<template>
  <div class="notification-view">
    <div v-if="notice" class="notice-content">
      <div class="notice-header">
        <span class="notice-app">{{ notice.appName }}</span>
        <span class="notice-time">{{ relativeTime }}</span>
      </div>
      <p class="notice-title">{{ notice.title }}</p>
      <p v-if="notice.body" class="notice-body">{{ notice.body }}</p>
    </div>
    <div v-else class="notice-placeholder">
      <span>通知</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useIslandStore } from '@renderer/store/island'
import { useNow } from '@vueuse/core'

const store  = useIslandStore()
const notice = computed(() => store.notification)
const now    = useNow({ interval: 10000 })

const relativeTime = computed(() => {
  if (!notice.value) return ''
  const diff = now.value.getTime() - notice.value.timestamp
  const sec  = Math.floor(diff / 1000)
  if (sec < 60)  return '刚刚'
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
  return `${Math.floor(sec / 3600)} 小时前`
})
</script>

<style scoped>
.notification-view {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  height: 100%;
  padding: 10px 16px;
  overflow: hidden;
}

.notice-content {
  width: 100%;
}

.notice-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.notice-app {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--md-sys-color-primary, #d0bcff);
}

.notice-time {
  font-size: 10px;
  color: var(--md-sys-color-outline, #938f99);
}

.notice-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--md-sys-color-on-surface, #e6e1e5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0 0 2px;
}

.notice-body {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.notice-placeholder {
  font-size: 13px;
  color: var(--md-sys-color-on-surface-variant, #cac4d0);
}
</style>
