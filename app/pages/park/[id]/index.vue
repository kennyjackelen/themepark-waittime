<script setup lang="ts">
import { useParkStore } from '../../../stores/park'
import { slugToParkId, parkIdToSlug } from '../../../utils/slugs'

const route = useRoute()
const store = useParkStore()
const activeTab = ref<'recommendations' | 'all' | 'timing'>('recommendations')

const parkId = computed(() => slugToParkId(route.params.id as string))
const parkSlug = computed(() => route.params.id as string)

onMounted(async () => {
  if (!store.selectedPark || store.selectedPark.id !== parkId.value) {
    // Direct navigation — need to select this park
    store.selectPark({ id: parkId.value, name: 'Loading...' })
  }
})

onUnmounted(() => {
  // Don't stop refresh — user might navigate back
})

function goHome() {
  store.leavePark()
  navigateTo('/')
}

function formatTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function waitColor(wait: number | null): string {
  if (wait === null) return 'text-gray-400'
  if (wait === 0) return 'text-green-600'
  if (wait <= 15) return 'text-green-600'
  if (wait <= 30) return 'text-yellow-600'
  if (wait <= 60) return 'text-orange-500'
  return 'text-red-600'
}

function waitBg(wait: number | null): string {
  if (wait === null) return 'bg-gray-100'
  if (wait === 0) return 'bg-green-50'
  if (wait <= 15) return 'bg-green-50'
  if (wait <= 30) return 'bg-yellow-50'
  if (wait <= 60) return 'bg-orange-50'
  return 'bg-red-50'
}

function recommendationLabel(rec: string): string {
  switch (rec) {
    case 'good_time': return 'Good time to go'
    case 'bad_time': return 'Bad time to go'
    case 'doesnt_matter': return 'Anytime is fine'
    case 'closed': return 'Closed'
    default: return 'Unknown'
  }
}

function recommendationColor(rec: string): string {
  switch (rec) {
    case 'good_time': return 'text-green-700 bg-green-50 border-green-200'
    case 'bad_time': return 'text-red-700 bg-red-50 border-red-200'
    case 'doesnt_matter': return 'text-blue-700 bg-blue-50 border-blue-200'
    case 'closed': return 'text-gray-500 bg-gray-50 border-gray-200'
    default: return 'text-gray-500 bg-gray-50 border-gray-200'
  }
}
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-4">
    <!-- Header -->
    <div class="flex items-center gap-3 mb-4">
      <button
        class="p-2 -ml-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
        @click="goHome"
      >
        <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="flex-1 min-w-0">
        <h1 class="text-lg font-bold truncate">{{ store.selectedPark?.name || 'Park' }}</h1>
        <p class="text-xs text-gray-400">
          Updated {{ formatTime(store.lastRefresh) }}
          <button class="ml-2 text-blue-500 underline" @click="store.refreshLiveData()">Refresh</button>
        </p>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading && store.rideList.length === 0" class="text-center py-12 text-gray-400">
      Loading ride data...
    </div>

    <!-- Error -->
    <div v-else-if="store.error" class="text-center py-8">
      <p class="text-red-500 mb-2">{{ store.error }}</p>
      <button class="px-4 py-2 bg-blue-500 text-white rounded-lg" @click="store.refreshLiveData()">
        Retry
      </button>
    </div>

    <template v-else>
      <!-- Tab Navigation -->
      <div class="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        <button
          v-for="tab in [
            { key: 'recommendations', label: 'Best Now' },
            { key: 'timing', label: 'Timing' },
            { key: 'all', label: 'All Rides' },
          ] as const"
          :key="tab.key"
          class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors"
          :class="activeTab === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Best Now Tab -->
      <div v-if="activeTab === 'recommendations'">
        <div v-if="store.topRecommendations.length === 0" class="text-center py-8 text-gray-400">
          No operating rides with wait data
        </div>
        <div v-else class="space-y-3">
          <p class="text-sm text-gray-500 mb-2">Rides where now is the best time relative to later:</p>
          <div
            v-for="(rec, idx) in store.topRecommendations"
            :key="rec.ride.id"
            class="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
          >
            <div class="flex items-start gap-3">
              <div
                class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                :class="idx === 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'"
              >
                {{ idx + 1 }}
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-800 truncate">{{ rec.ride.name }}</h3>
                <p class="text-sm text-gray-500">{{ rec.reason }}</p>
              </div>
              <div class="text-right shrink-0">
                <div class="text-2xl font-bold" :class="waitColor(rec.ride.currentWait)">
                  {{ rec.ride.currentWait ?? '—' }}
                </div>
                <div class="text-xs text-gray-400">min</div>
              </div>
            </div>
            <!-- Mini projection bar -->
            <RideProjectionBar v-if="rec.ride.projection.length > 0" :ride="rec.ride" class="mt-3" />
          </div>
        </div>
      </div>

      <!-- Timing Tab -->
      <div v-if="activeTab === 'timing'">
        <!-- Good time section -->
        <div v-if="store.goodTimeRides.length > 0" class="mb-6">
          <h2 class="text-sm font-semibold text-green-700 uppercase tracking-wide mb-2">
            Good Time to Go ({{ store.goodTimeRides.length }})
          </h2>
          <div class="space-y-2">
            <RideCard v-for="ride in store.goodTimeRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
          </div>
        </div>

        <!-- Doesn't matter section -->
        <div v-if="store.doesntMatterRides.length > 0" class="mb-6">
          <h2 class="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-2">
            Anytime is Fine ({{ store.doesntMatterRides.length }})
          </h2>
          <div class="space-y-2">
            <RideCard v-for="ride in store.doesntMatterRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
          </div>
        </div>

        <!-- Bad time section -->
        <div v-if="store.badTimeRides.length > 0" class="mb-6">
          <h2 class="text-sm font-semibold text-red-700 uppercase tracking-wide mb-2">
            Bad Time to Go ({{ store.badTimeRides.length }})
          </h2>
          <div class="space-y-2">
            <RideCard v-for="ride in store.badTimeRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
          </div>
        </div>

        <!-- Closed section -->
        <div v-if="store.closedRides.length > 0" class="mb-6">
          <h2 class="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Closed ({{ store.closedRides.length }})
          </h2>
          <div class="space-y-2">
            <RideCard v-for="ride in store.closedRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
          </div>
        </div>
      </div>

      <!-- All Rides Tab -->
      <div v-if="activeTab === 'all'">
        <div class="space-y-2">
          <RideCard v-for="ride in store.rideList" :key="ride.id" :ride="ride" show-recommendation :park-id="parkSlug" />
        </div>
      </div>
    </template>
  </div>
</template>
