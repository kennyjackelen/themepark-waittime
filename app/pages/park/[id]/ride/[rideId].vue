<script setup lang="ts">
import { useParkStore } from '../../../../stores/park'
import { slugToParkId } from '../../../../utils/slugs'

const route = useRoute()
const store = useParkStore()

const parkId = computed(() => slugToParkId(route.params.id as string))
const ride = computed(() => {
  const param = route.params.rideId as string
  return store.rideBySlug(param) || store.rides.get(param)
})

onMounted(async () => {
  if (!store.selectedPark || store.selectedPark.id !== parkId.value) {
    await store.selectPark({ id: parkId.value, name: 'Loading...' })
  }
})

function goBack() {
  navigateTo(`/park/${route.params.id}`)
}

function waitColor(wait: number | null): string {
  if (wait === null) return 'text-gray-400'
  if (wait === 0) return 'text-emerald-600'
  if (wait <= 15) return 'text-emerald-600'
  if (wait <= 30) return 'text-amber-600'
  if (wait <= 60) return 'text-orange-500'
  return 'text-red-600'
}

function waitRingColor(wait: number | null): string {
  if (wait === null) return 'border-gray-200'
  if (wait === 0) return 'border-emerald-400'
  if (wait <= 15) return 'border-emerald-400'
  if (wait <= 30) return 'border-amber-400'
  if (wait <= 60) return 'border-orange-400'
  return 'border-red-400'
}

function recommendationText(rec: string): { label: string; description: string; colorClass: string; icon: string } {
  switch (rec) {
    case 'good_time':
      return {
        label: 'Good Time to Go',
        description: 'The wait is shorter than what we project for later. Head over now!',
        colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
        icon: 'check',
      }
    case 'bad_time':
      return {
        label: 'Bad Time to Go',
        description: 'The wait is expected to get shorter later. Consider coming back.',
        colorClass: 'text-red-700 bg-red-50 border-red-200',
        icon: 'clock',
      }
    case 'doesnt_matter':
      return {
        label: 'Anytime is Fine',
        description: 'The wait stays roughly the same all day. Go whenever convenient.',
        colorClass: 'text-blue-700 bg-blue-50 border-blue-200',
        icon: 'neutral',
      }
    case 'closed':
      return {
        label: 'Currently Closed',
        description: 'This ride is not operating right now.',
        colorClass: 'text-gray-600 bg-gray-50 border-gray-200',
        icon: 'x',
      }
    default:
      return {
        label: 'Unknown',
        description: 'Not enough data to make a recommendation.',
        colorClass: 'text-gray-500 bg-gray-50 border-gray-200',
        icon: 'question',
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
  <div class="min-h-screen">
    <!-- Branded header -->
    <div class="bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 text-white px-4 pt-6 pb-8">
      <div class="max-w-lg mx-auto">
        <button
          class="flex items-center gap-1.5 text-indigo-300 hover:text-white transition-colors text-sm mb-3"
          @click="goBack"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
          {{ store.selectedPark?.name || 'Back' }}
        </button>
        <h1 class="text-2xl font-extrabold tracking-tight">{{ ride?.name || 'Ride' }}</h1>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-4">
      <!-- Loading -->
      <div v-if="store.loading && !ride" class="-mt-4 py-8">
        <div class="bg-white rounded-2xl shadow-sm shadow-black/5 p-8 animate-pulse">
          <div class="flex flex-col items-center gap-3">
            <div class="w-20 h-20 rounded-full bg-gray-200" />
            <div class="h-4 bg-gray-200 rounded w-24" />
          </div>
        </div>
      </div>

      <!-- Not found -->
      <div v-else-if="!ride" class="-mt-4 py-8">
        <div class="bg-white rounded-2xl shadow-sm shadow-black/5 p-8 text-center">
          <p class="text-gray-400">Ride not found. Try going back and selecting a park first.</p>
        </div>
      </div>

      <template v-else>
        <!-- Current wait hero -->
        <div class="bg-white rounded-2xl shadow-sm shadow-black/5 p-6 -mt-4 mb-4">
          <div class="flex items-center justify-center">
            <div
              class="w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center"
              :class="waitRingColor(ride.currentWait)"
            >
              <span class="text-3xl font-bold tabular-nums" :class="waitColor(ride.currentWait)">
                {{ ride.currentWait ?? '—' }}
              </span>
              <span class="text-[10px] text-gray-400 uppercase tracking-wider -mt-0.5">min</span>
            </div>
          </div>
          <p class="text-center text-xs text-gray-400 mt-3 uppercase tracking-wider">Current Wait</p>
        </div>

        <!-- Recommendation -->
        <div
          v-if="recInfo"
          class="rounded-2xl border p-4 mb-4"
          :class="recInfo.colorClass"
        >
          <h2 class="font-semibold text-base">{{ recInfo.label }}</h2>
          <p class="text-sm mt-1 opacity-80">{{ recInfo.description }}</p>
        </div>

        <!-- Forecast chart -->
        <div v-if="ride.projection.length > 0" class="bg-white rounded-2xl shadow-sm shadow-black/5 p-4 mb-4">
          <h2 class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Projected Wait Times</h2>
          <RideProjectionBar :ride="ride" tall />
        </div>

        <!-- History -->
        <div v-if="ride.history.length > 0" class="bg-white rounded-2xl shadow-sm shadow-black/5 p-4 mb-8">
          <h2 class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Today's History</h2>
          <div class="space-y-1.5">
            <div
              v-for="(snap, i) in ride.history"
              :key="i"
              class="flex items-center gap-3 text-sm"
            >
              <span class="text-gray-400 w-16 shrink-0 text-xs tabular-nums">
                {{ snap.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }}
              </span>
              <div class="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all"
                  :class="
                    (snap.waitMinutes ?? 0) <= 15
                      ? 'bg-emerald-400'
                      : (snap.waitMinutes ?? 0) <= 30
                        ? 'bg-amber-400'
                        : (snap.waitMinutes ?? 0) <= 60
                          ? 'bg-orange-400'
                          : 'bg-red-400'
                  "
                  :style="{ width: Math.min(((snap.waitMinutes ?? 0) / Math.max(maxProjectedWait, 10)) * 100, 100) + '%' }"
                />
              </div>
              <span class="font-semibold w-12 text-right tabular-nums text-xs" :class="waitColor(snap.waitMinutes)">
                {{ snap.waitMinutes ?? '—' }}m
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
