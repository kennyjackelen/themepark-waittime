<script setup lang="ts">
import type { RideData } from '../utils/types'
import { nameToSlug } from '../utils/slugs'
import { useParkStore } from '../stores/park'
import { formatTimeInTz } from '../utils/parkTime'

const props = defineProps<{
  ride: RideData
  showRecommendation?: boolean
  parkId?: string
}>()

const store = useParkStore()
const expanded = ref(false)

function ratingDots(rating: number): string {
  return String(rating)
}

function ratingColor(rating: number): string {
  return rating === 3
    ? 'text-amber-500 dark:text-amber-400'
    : rating === 2
      ? 'text-gray-500 dark:text-gray-400'
      : 'text-gray-300 dark:text-gray-600'
}

function waitColor(wait: number | null): string {
  if (wait === null) return 'text-gray-400'
  if (wait === 0) return 'text-emerald-600'
  if (wait <= 15) return 'text-emerald-600'
  if (wait <= 30) return 'text-amber-600'
  if (wait <= 60) return 'text-orange-500'
  return 'text-red-600'
}

function recommendationBadge(rec: string): { label: string; classes: string } {
  switch (rec) {
    case 'good_time': return { label: 'Go now', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' }
    case 'bad_time': return { label: 'Wait', classes: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
    case 'doesnt_matter': return { label: 'Anytime', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
    case 'closed': return { label: 'Closed', classes: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' }
    default: return { label: '—', classes: 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500' }
  }
}

const badge = computed(() => recommendationBadge(props.ride.recommendation))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 overflow-hidden">
    <button
      class="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors"
      @click="expanded = !expanded"
    >
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-800 dark:text-gray-100 truncate text-sm">{{ ride.name }}</h3>
        <div v-if="ride.guestRatings.length > 0" class="mt-0.5 flex items-center gap-2 flex-wrap">
          <span
            v-for="gr in ride.guestRatings"
            :key="gr.guest"
            class="text-[10px] font-semibold tabular-nums"
            :class="ratingColor(gr.rating)"
          >{{ gr.guest }} {{ ratingDots(gr.rating) }}</span>
        </div>
        <div v-if="showRecommendation || ride.reason" class="mt-1 flex items-center gap-2">
          <span v-if="showRecommendation" class="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0" :class="badge.classes">
            {{ badge.label }}
          </span>
          <span v-if="ride.reason" class="text-[11px] text-gray-400 dark:text-gray-500 truncate">
            {{ ride.reason }}
          </span>
        </div>
      </div>
      <div v-if="ride.status === 'OPERATING' || ride.status === 'OPEN'" class="text-right shrink-0">
        <span class="text-xl font-bold tabular-nums" :class="waitColor(ride.currentWait)">
          {{ ride.currentWait ?? '—' }}
        </span>
        <span class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-0.5">min</span>
      </div>
      <div v-else class="text-xs font-medium text-gray-400 dark:text-gray-500 shrink-0 uppercase tracking-wider">
        {{ ride.status === 'CLOSED' ? 'Closed' : ride.status === 'DOWN' ? 'Down' : ride.status || 'Unknown' }}
      </div>
      <svg
        class="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 transition-transform"
        :class="{ 'rotate-180': expanded }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="expanded" class="px-4 pb-4 border-t border-gray-100/80 dark:border-gray-700">
      <RideProjectionBar v-if="ride.projection.length > 0" :ride="ride" class="mt-3" />
      <p v-else class="text-sm text-gray-400 dark:text-gray-500 mt-3">No projection data available</p>

      <!-- Recent history -->
      <div v-if="ride.history.length > 0" class="mt-3">
        <p class="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Recent</p>
        <div class="flex gap-3 overflow-x-auto">
          <div
            v-for="(snap, i) in ride.history.slice(-8)"
            :key="i"
            class="text-center shrink-0"
          >
            <div class="text-[11px] text-gray-400 dark:text-gray-500">
              {{ formatTimeInTz(snap.time, store.parkTimezone) }}
            </div>
            <div class="text-sm font-semibold tabular-nums" :class="waitColor(snap.waitMinutes)">
              {{ snap.waitMinutes ?? '—' }}
            </div>
          </div>
        </div>
      </div>

      <NuxtLink
        v-if="parkId"
        :to="`/park/${parkId}/ride/${nameToSlug(ride.name)}`"
        class="mt-3 block text-center text-sm font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
      >
        View details
      </NuxtLink>
    </div>
  </div>
</template>
