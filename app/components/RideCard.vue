<script setup lang="ts">
import type { RideData } from '../utils/types'

const props = defineProps<{
  ride: RideData
  showRecommendation?: boolean
  parkId?: string
}>()

const expanded = ref(false)

function waitColor(wait: number | null): string {
  if (wait === null) return 'text-gray-400'
  if (wait === 0) return 'text-green-600'
  if (wait <= 15) return 'text-green-600'
  if (wait <= 30) return 'text-yellow-600'
  if (wait <= 60) return 'text-orange-500'
  return 'text-red-600'
}

function recommendationBadge(rec: string): { label: string; classes: string } {
  switch (rec) {
    case 'good_time': return { label: 'Go now', classes: 'bg-green-100 text-green-700' }
    case 'bad_time': return { label: 'Wait', classes: 'bg-red-100 text-red-700' }
    case 'doesnt_matter': return { label: 'Anytime', classes: 'bg-blue-100 text-blue-700' }
    case 'closed': return { label: 'Closed', classes: 'bg-gray-100 text-gray-500' }
    default: return { label: '—', classes: 'bg-gray-100 text-gray-400' }
  }
}

const badge = computed(() => recommendationBadge(props.ride.recommendation))
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
    <button
      class="w-full px-4 py-3 flex items-center gap-3 text-left"
      @click="expanded = !expanded"
    >
      <div class="flex-1 min-w-0">
        <h3 class="font-medium text-gray-800 truncate text-sm">{{ ride.name }}</h3>
        <div v-if="showRecommendation" class="mt-1">
          <span class="text-xs px-2 py-0.5 rounded-full font-medium" :class="badge.classes">
            {{ badge.label }}
          </span>
        </div>
      </div>
      <div v-if="ride.status === 'OPERATING' || ride.status === 'OPEN'" class="text-right shrink-0">
        <span class="text-xl font-bold" :class="waitColor(ride.currentWait)">
          {{ ride.currentWait ?? '—' }}
        </span>
        <span class="text-xs text-gray-400 ml-0.5">min</span>
      </div>
      <div v-else class="text-sm text-gray-400 shrink-0">
        {{ ride.status === 'CLOSED' ? 'Closed' : ride.status === 'DOWN' ? 'Down' : ride.status || 'Unknown' }}
      </div>
      <svg
        class="w-4 h-4 text-gray-400 shrink-0 transition-transform"
        :class="{ 'rotate-180': expanded }"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <div v-if="expanded" class="px-4 pb-4 border-t border-gray-50">
      <RideProjectionBar v-if="ride.projection.length > 0" :ride="ride" class="mt-3" />
      <p v-else class="text-sm text-gray-400 mt-3">No projection data available</p>

      <!-- Recent history -->
      <div v-if="ride.history.length > 0" class="mt-3">
        <p class="text-xs font-medium text-gray-500 mb-1">Recent wait times:</p>
        <div class="flex gap-2 overflow-x-auto">
          <div
            v-for="(snap, i) in ride.history.slice(-8)"
            :key="i"
            class="text-center shrink-0"
          >
            <div class="text-xs text-gray-400">
              {{ snap.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}
            </div>
            <div class="text-sm font-medium" :class="waitColor(snap.waitMinutes)">
              {{ snap.waitMinutes ?? '—' }}
            </div>
          </div>
        </div>
      </div>

      <NuxtLink
        v-if="parkId"
        :to="`/park/${parkId}/ride/${ride.id}`"
        class="mt-3 block text-center text-sm text-blue-500 hover:text-blue-700"
      >
        View full details
      </NuxtLink>
    </div>
  </div>
</template>
