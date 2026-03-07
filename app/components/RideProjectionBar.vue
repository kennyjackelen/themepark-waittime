<script setup lang="ts">
import type { RideData, WaitTimeSnapshot } from '../utils/types'
import { getCurrentSlotIndex } from '../utils/projection'
import { useParkStore } from '../stores/park'

interface DisplaySlot {
  hour: number
  minute: number
  projectedWait: number | null // null = no data for this hour
}

const props = defineProps<{
  ride: RideData
  tall?: boolean
}>()

const store = useParkStore()
const BAR_HEIGHT = computed(() => props.tall ? 96 : 48)
const now = new Date()

// Build full-day slots from park open to close, filling gaps with null
const fullDaySlots = computed((): DisplaySlot[] => {
  const openHour = store.parkOpenHour
  const closeHour = store.parkCloseHour
  const projMap = new Map<number, number>()
  for (const p of props.ride.projection) {
    // Key on hour (projections are hourly)
    projMap.set(p.hour, p.projectedWait)
  }

  const slots: DisplaySlot[] = []
  for (let h = openHour; h <= closeHour; h++) {
    const wait = projMap.get(h)
    slots.push({
      hour: h,
      minute: 0,
      projectedWait: wait !== undefined ? wait : null,
    })
  }
  return slots
})

const liveIndex = computed(() => {
  // Find which full-day slot is closest to now
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  let bestIdx = -1
  let bestDist = Infinity
  for (let i = 0; i < fullDaySlots.value.length; i++) {
    const slotMinutes = fullDaySlots.value[i]!.hour * 60 + fullDaySlots.value[i]!.minute
    const dist = Math.abs(slotMinutes - nowMinutes)
    if (dist < bestDist) {
      bestDist = dist
      bestIdx = i
    }
  }
  return bestDist <= 60 ? bestIdx : -1
})

const maxWait = computed(() => {
  const waits: number[] = []
  for (const s of fullDaySlots.value) {
    if (s.projectedWait !== null) waits.push(s.projectedWait)
  }
  if (props.ride.currentWait !== null) waits.push(props.ride.currentWait)
  for (const snap of props.ride.history) {
    if (snap.waitMinutes !== null) waits.push(snap.waitMinutes)
  }
  return Math.max(...waits, 10)
})

// Map each full-day slot to the closest actual wait from history
const actualWaitBySlot = computed(() => {
  const result: (number | null)[] = new Array(fullDaySlots.value.length).fill(null)
  if (props.ride.history.length === 0) return result

  for (let i = 0; i < fullDaySlots.value.length; i++) {
    const s = fullDaySlots.value[i]!
    const slotMinutes = s.hour * 60 + s.minute
    const nowMinutes = now.getHours() * 60 + now.getMinutes()

    if (slotMinutes >= nowMinutes - 30) continue

    let bestSnap: WaitTimeSnapshot | null = null
    let bestDist = Infinity
    for (const snap of props.ride.history) {
      const snapMinutes = snap.time.getHours() * 60 + snap.time.getMinutes()
      const dist = Math.abs(snapMinutes - slotMinutes)
      if (dist < bestDist && snap.waitMinutes !== null) {
        bestDist = dist
        bestSnap = snap
      }
    }
    if (bestSnap && bestDist <= 45) {
      result[i] = bestSnap.waitMinutes
    }
  }
  return result
})

function barPx(wait: number): string {
  return `${Math.max((wait / maxWait.value) * BAR_HEIGHT.value, 2)}px`
}

function labelForBar(i: number): { value: number | null; isActual: boolean } {
  const s = fullDaySlots.value[i]!
  if (i === liveIndex.value && props.ride.currentWait !== null) {
    return { value: props.ride.currentWait, isActual: true }
  }
  const actual = actualWaitBySlot.value[i]
  if (actual !== null) {
    return { value: actual, isActual: true }
  }
  return { value: s.projectedWait, isActual: false }
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'p' : 'a'
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayHour}${period}`
}

function showLabel(idx: number): boolean {
  const s = fullDaySlots.value[idx]
  if (!s || s.minute !== 0) return false
  return props.tall ? true : idx % 3 === 0
}

function isPastSlot(i: number): boolean {
  const s = fullDaySlots.value[i]!
  const slotMinutes = s.hour * 60 + s.minute
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return slotMinutes < nowMinutes - 30
}
</script>

<template>
  <div>
    <div class="flex items-center gap-1.5 mb-1">
      <p class="text-xs font-medium text-gray-500">Wait times</p>
      <span
        v-if="ride.currentWait !== null && (ride.status === 'OPERATING' || ride.status === 'OPEN')"
        class="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1 leading-4"
      >LIVE</span>
      <span
        v-if="ride.forecastSource === 'historical'"
        class="text-[10px] font-medium text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 leading-4"
      >TRAINED</span>
      <span
        v-if="ride.forecastSource === 'synthetic'"
        class="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 leading-4"
      >ESTIMATED</span>
    </div>
    <!-- Legend (tall mode only) -->
    <div v-if="tall" class="flex items-center gap-3 mb-2 text-[10px] text-gray-400">
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-teal-400" /> Forecast
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-rose-500" /> Actual
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm border-2 border-dashed border-gray-300" /> No data
      </span>
    </div>
    <!-- Bars -->
    <div class="flex items-end gap-[3px]" :style="{ height: BAR_HEIGHT + 28 + 'px' }">
      <div
        v-for="(s, i) in fullDaySlots"
        :key="i"
        class="flex flex-col items-center justify-end flex-1 min-w-0"
      >
        <!-- Wait time label -->
        <span
          v-if="labelForBar(i).value !== null"
          class="text-[8px] leading-none mb-0.5 font-medium tabular-nums"
          :class="labelForBar(i).isActual ? 'text-rose-600' : 'text-gray-400'"
        >{{ labelForBar(i).value }}</span>
        <span v-else class="text-[8px] leading-none mb-0.5 text-transparent">0</span>

        <!-- Missing data slot -->
        <div v-if="s.projectedWait === null && i !== liveIndex" class="w-full">
          <div
            class="w-full rounded-sm border-2 border-dashed border-gray-300"
            :style="{ height: '8px' }"
          />
        </div>

        <!-- Bar: layered for live slot (forecast behind, actual in front) -->
        <div v-else-if="i === liveIndex" class="w-full relative">
          <!-- Forecast ghost bar behind (if we have projection data) -->
          <div
            v-if="s.projectedWait !== null"
            class="w-full rounded-sm bg-teal-200"
            :style="{ height: barPx(s.projectedWait) }"
          />
          <div
            v-else
            class="w-full rounded-sm border-2 border-dashed border-gray-300"
            :style="{ height: '8px' }"
          />
          <!-- Actual live bar overlaid from bottom -->
          <div
            v-if="ride.currentWait !== null"
            class="w-full rounded-sm bg-rose-500 absolute bottom-0 left-0"
            :style="{ height: barPx(ride.currentWait) }"
          />
        </div>

        <!-- Past slot with actual data: forecast ghost + actual overlay -->
        <div v-else-if="isPastSlot(i) && actualWaitBySlot[i] !== null" class="w-full relative">
          <div
            class="w-full rounded-sm bg-teal-200"
            :style="{ height: barPx(s.projectedWait!) }"
          />
          <div
            class="w-full rounded-sm bg-rose-400 absolute bottom-0 left-0"
            :style="{ height: barPx(actualWaitBySlot[i]!) }"
          />
        </div>

        <!-- Past slot without actual data: dimmed forecast -->
        <div v-else-if="isPastSlot(i)" class="w-full">
          <div
            class="w-full rounded-sm bg-teal-200"
            :style="{ height: barPx(s.projectedWait!) }"
          />
        </div>

        <!-- Future slot: normal forecast -->
        <div v-else class="w-full">
          <div
            class="w-full rounded-sm bg-teal-400"
            :style="{ height: barPx(s.projectedWait!) }"
          />
        </div>

        <!-- Hour label -->
        <span
          class="text-[9px] mt-0.5 leading-none"
          :class="showLabel(i) ? 'text-gray-400' : 'text-transparent'"
        >{{ formatHour(s.hour) }}</span>
      </div>
    </div>
  </div>
</template>
