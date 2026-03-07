<script setup lang="ts">
import { useParkStore } from '../../../../stores/park'
import { slugToParkId } from '../../../../utils/slugs'

const route = useRoute()
const store = useParkStore()

const parkId = computed(() => slugToParkId(route.params.id as string))
const ride = computed(() => store.rides.get(route.params.rideId as string))

function goBack() {
  navigateTo(`/park/${route.params.id}`)
}

function waitColor(wait: number | null): string {
  if (wait === null) return 'text-gray-400'
  if (wait === 0) return 'text-green-600'
  if (wait <= 15) return 'text-green-600'
  if (wait <= 30) return 'text-yellow-600'
  if (wait <= 60) return 'text-orange-500'
  return 'text-red-600'
}

function recommendationText(rec: string): { label: string; description: string; colorClass: string } {
  switch (rec) {
    case 'good_time':
      return {
        label: 'Good Time to Go',
        description: 'The wait is shorter than what we project for later. Head over now!',
        colorClass: 'text-green-700 bg-green-50 border-green-200',
      }
    case 'bad_time':
      return {
        label: 'Bad Time to Go',
        description: 'The wait is expected to get shorter later. Consider coming back.',
        colorClass: 'text-red-700 bg-red-50 border-red-200',
      }
    case 'doesnt_matter':
      return {
        label: 'Anytime is Fine',
        description: 'The wait stays roughly the same all day. Go whenever convenient.',
        colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
      }
    case 'closed':
      return {
        label: 'Currently Closed',
        description: 'This ride is not operating right now.',
        colorClass: 'text-gray-600 bg-gray-50 border-gray-200',
      }
    default:
      return {
        label: 'Unknown',
        description: 'Not enough data to make a recommendation.',
        colorClass: 'text-gray-500 bg-gray-50 border-gray-200',
      }
  }
}

const recInfo = computed(() => ride.value ? recommendationText(ride.value.recommendation) : null)

const maxProjectedWait = computed(() => {
  if (!ride.value) return 10
  const waits = ride.value.projection.map((p) => p.projectedWait)
  if (ride.value.currentWait !== null) waits.push(ride.value.currentWait)
  return Math.max(...waits, 10)
})
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-4">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <button
        class="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
        @click="goBack"
      >
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 class="text-lg font-bold truncate flex-1">{{ ride?.name || 'Ride' }}</h1>
    </div>

    <div v-if="!ride" class="text-center py-12 text-gray-400">
      Ride not found. Try going back and selecting a park first.
    </div>

    <template v-else>
      <!-- Current wait -->
      <div class="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center mb-4">
        <p class="text-sm text-gray-500 mb-1">Current Wait</p>
        <div class="text-5xl font-bold" :class="waitColor(ride.currentWait)">
          {{ ride.currentWait ?? '—' }}
        </div>
        <p class="text-sm text-gray-400 mt-1">minutes</p>
      </div>

      <!-- Recommendation -->
      <div
        v-if="recInfo"
        class="rounded-xl border p-4 mb-4"
        :class="recInfo.colorClass"
      >
        <h2 class="font-semibold text-base">{{ recInfo.label }}</h2>
        <p class="text-sm mt-1 opacity-80">{{ recInfo.description }}</p>
      </div>

      <!-- Forecast chart -->
      <div v-if="ride.projection.length > 0" class="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <RideProjectionBar :ride="ride" tall />
      </div>

      <!-- History -->
      <div v-if="ride.history.length > 0" class="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 class="text-sm font-semibold text-gray-700 mb-3">Today's Wait History</h2>
        <div class="space-y-1">
          <div
            v-for="(snap, i) in ride.history"
            :key="i"
            class="flex items-center gap-3 text-sm"
          >
            <span class="text-gray-400 w-16 shrink-0">
              {{ snap.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}
            </span>
            <div class="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
              <div
                class="h-full rounded-full"
                :class="
                  (snap.waitMinutes ?? 0) <= 15
                    ? 'bg-green-400'
                    : (snap.waitMinutes ?? 0) <= 30
                      ? 'bg-yellow-400'
                      : (snap.waitMinutes ?? 0) <= 60
                        ? 'bg-orange-400'
                        : 'bg-red-400'
                "
                :style="{ width: Math.min(((snap.waitMinutes ?? 0) / Math.max(maxProjectedWait, 10)) * 100, 100) + '%' }"
              />
            </div>
            <span class="font-medium w-12 text-right" :class="waitColor(snap.waitMinutes)">
              {{ snap.waitMinutes ?? '—' }} min
            </span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
