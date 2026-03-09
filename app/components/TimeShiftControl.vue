<script setup lang="ts">
import { useParkStore } from '../stores/park'
import { formatTimeInTz } from '../utils/parkTime'

const store = useParkStore()
const expanded = ref(false)

onMounted(() => {
  const saved = localStorage.getItem('time_offset_hours')
  if (saved) {
    const val = Number(saved)
    if (!isNaN(val) && val !== 0) {
      store.timeOffsetHours = val
      store.reclassifyRides()
    }
  }
})

function persist() {
  if (offset.value === 0) {
    localStorage.removeItem('time_offset_hours')
  } else {
    localStorage.setItem('time_offset_hours', String(store.timeOffsetHours))
  }
}

const offset = computed(() => store.timeOffsetHours ?? 0)

const offsetDisplay = computed(() => {
  const h = offset.value
  if (h === 0) return 'Live'
  const sign = h > 0 ? '+' : ''
  return `${sign}${h}h`
})

const shiftedTime = computed(() => {
  return formatTimeInTz(store.now, store.parkTimezone)
})

function adjust(delta: number) {
  store.timeOffsetHours = Math.min((store.timeOffsetHours ?? 0) + delta, 0)
  persist()
  store.reclassifyRides()
}

function reset() {
  store.timeOffsetHours = 0
  persist()
  // Re-fetch to restore real status/waits after simulation
  store.refreshLiveData()
}
</script>

<template>
  <div class="fixed bottom-4 right-4 z-40">
    <!-- Collapsed pill -->
    <button
      v-if="!expanded"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg transition-colors"
      :class="offset === 0
        ? 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        : 'bg-amber-500 text-white hover:bg-amber-600'"
      @click="expanded = true"
    >
      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
      </svg>
      {{ offsetDisplay }}
    </button>

    <!-- Expanded panel -->
    <div
      v-else
      class="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 w-56"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Time Shift</span>
        <button
          class="text-gray-500 hover:text-white transition-colors"
          @click="expanded = false"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="text-center mb-3">
        <div class="text-2xl font-bold tabular-nums">{{ shiftedTime }}</div>
        <div
          class="text-xs mt-0.5"
          :class="offset === 0 ? 'text-emerald-400' : 'text-amber-400'"
        >
          {{ offset === 0 ? 'Live' : `${offsetDisplay} from now` }}
        </div>
      </div>

      <div class="flex items-center gap-2 mb-3">
        <button
          class="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
          @click="adjust(-6)"
        >-6h</button>
        <button
          class="flex-1 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-medium transition-colors"
          @click="adjust(-1)"
        >-1h</button>
        <button
          class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="offset >= 0 ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700'"
          :disabled="offset >= 0"
          @click="adjust(1)"
        >+1h</button>
        <button
          class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="offset >= 0 ? 'bg-gray-800/50 text-gray-600 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700'"
          :disabled="offset >= 0"
          @click="adjust(6)"
        >+6h</button>
      </div>

      <button
        v-if="offset !== 0"
        class="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-sm font-semibold transition-colors"
        @click="reset"
      >
        Reset to Live
      </button>
    </div>
  </div>
</template>
