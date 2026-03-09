<script setup lang="ts">
import type { RideData, WaitTimeSnapshot } from '../utils/types'
import { useParkStore } from '../stores/park'
import { getMinutesSinceMidnight } from '../utils/parkTime'

interface DisplaySlot {
  hour: number
  minute: number
  projectedWait: number | null
  low: number | null
  high: number | null
}

const props = defineProps<{
  ride: RideData
  tall?: boolean
}>()

const store = useParkStore()
const BAR_HEIGHT = computed(() => props.tall ? 96 : 48)
const now = computed(() => store.now)
const tz = computed(() => store.parkTimezone)

const fullDaySlots = computed((): DisplaySlot[] => {
  const openHour = store.parkOpenHour
  const closeHour = store.parkCloseHour
  const projMap = new Map<number, { wait: number; low?: number; high?: number }>()
  for (const p of props.ride.projection) {
    projMap.set(p.hour, { wait: p.projectedWait, low: p.low, high: p.high })
  }

  const slots: DisplaySlot[] = []
  for (let h = openHour; h < closeHour; h++) {
    const data = projMap.get(h)
    slots.push({
      hour: h,
      minute: 0,
      projectedWait: data ? data.wait : null,
      low: data?.low ?? null,
      high: data?.high ?? null,
    })
  }
  return slots
})

const liveIndex = computed(() => {
  const nowMinutes = getMinutesSinceMidnight(now.value, tz.value)
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
    if (s.high !== null) waits.push(s.high)
  }
  if (props.ride.currentWait !== null) waits.push(props.ride.currentWait)
  for (const snap of props.ride.history) {
    if (snap.waitMinutes !== null) waits.push(snap.waitMinutes)
  }
  return Math.max(...waits, 10)
})

const actualWaitBySlot = computed(() => {
  const result: (number | null)[] = new Array(fullDaySlots.value.length).fill(null)
  if (props.ride.history.length === 0) return result

  for (let i = 0; i < fullDaySlots.value.length; i++) {
    const s = fullDaySlots.value[i]!
    const slotMinutes = s.hour * 60 + s.minute
    const nowMinutes = getMinutesSinceMidnight(now.value, tz.value)

    if (slotMinutes >= nowMinutes - 30) continue

    let bestSnap: WaitTimeSnapshot | null = null
    let bestDist = Infinity
    for (const snap of props.ride.history) {
      const snapMinutes = getMinutesSinceMidnight(snap.time, tz.value)
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

function hasConfidence(i: number): boolean {
  const s = fullDaySlots.value[i]!
  return s.low !== null && s.high !== null && s.low !== s.high
}

function formatHour(h: number): string {
  const period = h >= 12 ? 'p' : 'a'
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return `${displayHour}${period}`
}

function actualWaitLabel(i: number): number | null {
  if (i === liveIndex.value && props.ride.currentWait !== null) {
    return props.ride.currentWait
  }
  return actualWaitBySlot.value[i] ?? null
}

function isPastSlot(i: number): boolean {
  const s = fullDaySlots.value[i]!
  const slotMinutes = s.hour * 60 + s.minute
  const nowMinutes = getMinutesSinceMidnight(now.value, tz.value)
  return slotMinutes < nowMinutes - 30
}

// Line chart points for actual wait data — one point per history snapshot
const actualLinePoints = computed(() => {
  const slots = fullDaySlots.value
  if (slots.length === 0) return []

  const openMinutes = slots[0]!.hour * 60 + slots[0]!.minute
  const closeMinutes = slots[slots.length - 1]!.hour * 60 + slots[slots.length - 1]!.minute + 60
  const range = closeMinutes - openMinutes

  const points: { key: number; xPct: number; yPct: number; wait: number; isLive: boolean }[] = []

  // Plot every history snapshot at its exact time, but not beyond "now"
  const nowMinutes = getMinutesSinceMidnight(now.value, tz.value)
  for (const snap of props.ride.history) {
    if (snap.waitMinutes === null) continue
    const snapMinutes = getMinutesSinceMidnight(snap.time, tz.value)
    if (snapMinutes < openMinutes || snapMinutes > closeMinutes) continue
    if (snapMinutes > nowMinutes) continue
    const xPct = ((snapMinutes - openMinutes) / range) * 100
    const yPct = (snap.waitMinutes / maxWait.value) * 100
    points.push({ key: snapMinutes, xPct, yPct, wait: snap.waitMinutes, isLive: false })
  }

  // Add live point
  if (props.ride.currentWait !== null && liveIndex.value >= 0) {
    const nowMin = getMinutesSinceMidnight(now.value, tz.value)
    if (nowMin >= openMinutes && nowMin <= closeMinutes) {
      const xPct = ((nowMin - openMinutes) / range) * 100
      const yPct = (props.ride.currentWait / maxWait.value) * 100
      points.push({ key: nowMin, xPct, yPct, wait: props.ride.currentWait, isLive: true })
    }
  }

  points.sort((a, b) => a.key - b.key)
  return points
})

const actualLineSvgPoints = computed(() => {
  return actualLinePoints.value
    .map(p => `${p.xPct},${100 - p.yPct}`)
    .join(' ')
})
</script>

<template>
  <div>
    <div class="flex items-center gap-1.5 mb-1">
      <p class="text-xs font-medium text-gray-500 dark:text-gray-400">Wait times</p>
      <span
        v-if="ride.currentWait !== null && (ride.status === 'OPERATING' || ride.status === 'OPEN')"
        class="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800 rounded px-1 leading-4"
      >LIVE</span>
      <span
        v-if="ride.forecastSource === 'historical'"
        class="text-[11px] font-medium text-violet-600 bg-violet-50 border border-violet-200 dark:bg-violet-900/20 dark:border-violet-800 dark:text-violet-400 rounded px-1 leading-4"
      >TRAINED</span>
      <span
        v-if="ride.forecastSource === 'synthetic'"
        class="text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400 rounded px-1 leading-4"
      >ESTIMATED</span>
    </div>
    <!-- Legend (tall mode only) -->
    <div v-if="tall" class="flex items-center gap-3 mb-2 text-[11px] text-gray-400 dark:text-gray-500">
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-teal-400" /> Forecast
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-0.5 rounded bg-rose-500" /> Actual
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm bg-teal-100 border border-teal-300 dark:bg-teal-900/30 dark:border-teal-600" /> Range
      </span>
      <span class="flex items-center gap-1">
        <span class="inline-block w-2.5 h-2.5 rounded-sm border-2 border-dashed border-gray-300 dark:border-gray-600" /> No data
      </span>
    </div>

    <!-- Chart area -->
    <div class="relative" :style="{ height: BAR_HEIGHT + 'px' }">
      <!-- Forecast bars -->
      <div class="flex items-end gap-[3px] h-full">
        <div v-for="(s, i) in fullDaySlots" :key="i" class="flex-1 min-w-0">
          <!-- Missing data -->
          <div v-if="s.projectedWait === null" class="w-full">
            <div class="w-full rounded-sm border-2 border-dashed border-gray-300 dark:border-gray-600" style="height: 8px" />
          </div>
          <!-- Bar with confidence interval -->
          <div v-else-if="hasConfidence(i)" class="w-full relative">
            <div class="w-full rounded-sm bg-teal-100 dark:bg-teal-900/30" :style="{ height: barPx(s.high!) }" />
            <div
              class="w-full rounded-sm absolute bottom-0 left-0"
              :class="isPastSlot(i) ? 'bg-teal-200' : i === liveIndex ? 'bg-teal-300' : 'bg-teal-400'"
              :style="{ height: barPx(s.projectedWait) }"
            />
          </div>
          <!-- Simple bar -->
          <div v-else class="w-full">
            <div
              class="w-full rounded-sm"
              :class="isPastSlot(i) ? 'bg-teal-200' : i === liveIndex ? 'bg-teal-300' : 'bg-teal-400'"
              :style="{ height: barPx(s.projectedWait) }"
            />
          </div>
        </div>
      </div>

      <!-- Actual wait line overlay -->
      <svg
        v-if="actualLinePoints.length >= 2"
        class="absolute top-0 left-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <polyline
          :points="actualLineSvgPoints"
          fill="none"
          stroke="#f43f5e"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>

      <!-- Data point dots -->
      <template v-for="pt in actualLinePoints" :key="pt.key">
        <!-- Pulse ring for live dot -->
        <div
          v-if="pt.isLive"
          class="absolute rounded-full pointer-events-none bg-rose-400 animate-ping"
          :style="{
            width: '10px',
            height: '10px',
            left: `calc(${pt.xPct}% - 5px)`,
            bottom: `calc(${pt.yPct}% - 5px)`,
          }"
        />
        <div
          class="absolute rounded-full pointer-events-none"
          :class="pt.isLive
            ? 'w-2.5 h-2.5 bg-rose-500 border-2 border-white dark:border-gray-800 shadow-sm'
            : 'w-1.5 h-1.5 bg-rose-500'"
          :style="{
            left: pt.isLive ? `calc(${pt.xPct}% - 5px)` : `calc(${pt.xPct}% - 3px)`,
            bottom: pt.isLive ? `calc(${pt.yPct}% - 5px)` : `calc(${pt.yPct}% - 3px)`,
          }"
        />
      </template>
    </div>

    <!-- Labels -->
    <div class="flex gap-[3px] mt-1">
      <div v-for="(s, i) in fullDaySlots" :key="i" class="flex-1 min-w-0 flex flex-col items-center">
        <span class="text-[11px] leading-none text-gray-400 dark:text-gray-500 pb-1">{{ formatHour(s.hour) }}</span>
        <!-- Projected label -->
        <span
          v-if="s.projectedWait !== null"
          class="text-[10px] leading-none mt-0.5 font-medium tabular-nums text-teal-600 dark:text-teal-400"
        >{{ s.projectedWait }}</span>
        <span v-else class="text-[9px] leading-none mt-0.5 text-transparent">0</span>
        <!-- Actual label -->
        <span
          v-if="actualWaitLabel(i) !== null"
          class="text-[10px] leading-none mt-0.5 font-medium tabular-nums text-rose-500"
        >{{ actualWaitLabel(i) }}</span>
        <span v-else class="text-[9px] leading-none mt-0.5 text-transparent">0</span>
      </div>
    </div>
  </div>
</template>
