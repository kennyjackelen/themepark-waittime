<script setup lang="ts">
import { useParkStore } from '../../../stores/park'
import { slugToParkId, parkIdToSlug } from '../../../utils/slugs'
import { useDarkMode } from '../../../composables/useDarkMode'

const route = useRoute()
const store = useParkStore()
const activeTab = ref<'recommendations' | 'all' | 'timing'>('recommendations')

const { isDark, modeLabel, toggle: toggleDark } = useDarkMode()
const parkId = computed(() => slugToParkId(route.params.id as string))
const parkSlug = computed(() => route.params.id as string)

onMounted(async () => {
  if (!store.selectedPark || store.selectedPark.id !== parkId.value) {
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

const refreshState = ref<'idle' | 'loading' | 'done'>('idle')

async function handleRefresh() {
  if (refreshState.value === 'loading') return
  refreshState.value = 'loading'
  await store.refreshLiveData()
  refreshState.value = 'done'
  setTimeout(() => { refreshState.value = 'idle' }, 1500)
}

function formatTime(date: Date | null): string {
  if (!date) return '—'
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function waitColor(wait: number | null): string {
  if (wait === null) return 'text-gray-400'
  if (wait === 0) return 'text-emerald-600'
  if (wait <= 15) return 'text-emerald-600'
  if (wait <= 30) return 'text-amber-600'
  if (wait <= 60) return 'text-orange-500'
  return 'text-red-600'
}

function waitBg(wait: number | null): string {
  if (wait === null) return 'bg-gray-100 dark:bg-gray-700'
  if (wait === 0) return 'bg-emerald-50 dark:bg-emerald-900/20'
  if (wait <= 15) return 'bg-emerald-50 dark:bg-emerald-900/20'
  if (wait <= 30) return 'bg-amber-50 dark:bg-amber-900/20'
  if (wait <= 60) return 'bg-orange-50 dark:bg-orange-900/20'
  return 'bg-red-50 dark:bg-red-900/20'
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
    case 'good_time': return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800'
    case 'bad_time': return 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800'
    case 'doesnt_matter': return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800'
    case 'closed': return 'text-gray-500 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700'
    default: return 'text-gray-500 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:border-gray-700'
  }
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Branded header -->
    <div class="bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 text-white px-4 pt-6 pb-8">
      <div class="max-w-lg mx-auto">
        <div class="flex items-center justify-between mb-3">
          <button
            class="flex items-center gap-1.5 text-indigo-300 hover:text-white transition-colors text-sm"
            @click="goHome"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            All Parks
          </button>
          <button
            class="flex flex-col items-center gap-0.5 p-2 -mr-2 rounded-full text-indigo-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Toggle theme"
            @click="toggleDark"
          >
            <svg v-if="!isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <span class="text-[9px] leading-none font-medium">{{ modeLabel }}</span>
          </button>
        </div>
        <h1 class="text-2xl font-extrabold tracking-tight">{{ store.selectedPark?.name || 'Park' }}</h1>
        <div v-if="store.parkOpenTime" class="flex items-center gap-2 text-indigo-300/70 text-sm mt-1">
          <span>Today {{ store.parkOpenTime }} – {{ store.parkCloseTime }}</span>
          <span
            v-if="store.selectedParkOpen === true"
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 leading-none"
          >Open</span>
          <span
            v-else-if="store.selectedParkOpen === false"
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-indigo-300/70 leading-none"
          >Closed</span>
        </div>
        <div class="flex items-center gap-2 mt-1 text-indigo-300 text-sm">
          <span>Updated {{ formatTime(store.lastRefresh) }}</span>
          <span class="text-indigo-600">·</span>
          <button
            class="inline-flex items-center gap-1 transition-colors"
            :class="refreshState === 'idle' ? 'text-indigo-300 hover:text-white' : 'text-indigo-400'"
            :disabled="refreshState !== 'idle'"
            @click="handleRefresh()"
          >
            <svg v-if="refreshState === 'loading'" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <svg v-else-if="refreshState === 'done'" class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
            {{ refreshState === 'loading' ? 'Refreshing…' : refreshState === 'done' ? 'Done' : 'Refresh' }}
          </button>
        </div>
      </div>
    </div>

    <div class="max-w-lg mx-auto px-4">
      <!-- Loading skeleton -->
      <div v-if="store.loading && store.rideList.length === 0" class="py-8 space-y-3 -mt-4">
        <div v-for="n in 5" :key="n" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 p-4 animate-pulse">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
            <div class="flex-1 space-y-2">
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
              <div class="h-3 bg-gray-100 dark:bg-gray-700 rounded w-1/2" />
            </div>
            <div class="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="store.error" class="text-center py-12 -mt-4">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 p-8">
          <p class="text-red-500 mb-3">{{ store.error }}</p>
          <button
            class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
            @click="store.refreshLiveData()"
          >
            Retry
          </button>
        </div>
      </div>

      <template v-else>
        <!-- Tab Navigation -->
        <div class="flex gap-1 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-sm shadow-black/5 dark:shadow-black/20 -mt-4 mb-5">
          <button
            v-for="tab in [
              { key: 'recommendations', label: 'Best Now' },
              { key: 'timing', label: 'Timing' },
              { key: 'all', label: 'All Rides' },
            ] as const"
            :key="tab.key"
            class="flex-1 py-2 px-3 rounded-xl text-sm font-semibold transition-all"
            :class="activeTab === tab.key
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- Best Now Tab -->
        <div v-if="activeTab === 'recommendations'">
          <div v-if="store.topRecommendations.length === 0" class="text-center py-12 text-gray-400 dark:text-gray-500">
            No operating rides with wait data
          </div>
          <div v-else class="space-y-3 pb-8">
            <p class="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider px-1">Best rides to hit right now</p>
            <NuxtLink
              v-for="(rec, idx) in store.topRecommendations"
              :key="rec.ride.id"
              :to="`/park/${parkSlug}/ride/${store.rideSlug(rec.ride.id)}`"
              class="block bg-white dark:bg-gray-800 rounded-2xl shadow-sm shadow-black/5 dark:shadow-black/20 p-4 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start gap-3">
                <div
                  class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                  :class="idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : idx <= 2 ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'"
                >
                  {{ idx + 1 }}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-semibold text-gray-800 dark:text-gray-100 truncate">{{ rec.ride.name }}</h3>
                  <p class="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{{ rec.reason }}</p>
                </div>
                <div class="text-right shrink-0 pl-2">
                  <div class="text-2xl font-bold tabular-nums" :class="waitColor(rec.ride.currentWait)">
                    {{ rec.ride.currentWait ?? '—' }}
                  </div>
                  <div class="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">min</div>
                </div>
              </div>
              <RideProjectionBar v-if="rec.ride.projection.length > 0" :ride="rec.ride" class="mt-3" />
            </NuxtLink>
          </div>
        </div>

        <!-- Timing Tab -->
        <div v-if="activeTab === 'timing'" class="pb-8">
          <!-- Good time section -->
          <div v-if="store.goodTimeRides.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-2 px-1">
              <div class="w-2 h-2 rounded-full bg-emerald-500" />
              <h2 class="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Good Time to Go ({{ store.goodTimeRides.length }})
              </h2>
            </div>
            <div class="space-y-2">
              <RideCard v-for="ride in store.goodTimeRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
            </div>
          </div>

          <!-- Doesn't matter section -->
          <div v-if="store.doesntMatterRides.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-2 px-1">
              <div class="w-2 h-2 rounded-full bg-blue-500" />
              <h2 class="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                Anytime is Fine ({{ store.doesntMatterRides.length }})
              </h2>
            </div>
            <div class="space-y-2">
              <RideCard v-for="ride in store.doesntMatterRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
            </div>
          </div>

          <!-- Bad time section -->
          <div v-if="store.badTimeRides.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-2 px-1">
              <div class="w-2 h-2 rounded-full bg-red-500" />
              <h2 class="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                Bad Time to Go ({{ store.badTimeRides.length }})
              </h2>
            </div>
            <div class="space-y-2">
              <RideCard v-for="ride in store.badTimeRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
            </div>
          </div>

          <!-- Not enough data section -->
          <div v-if="store.unknownRides.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-2 px-1">
              <div class="w-2 h-2 rounded-full bg-gray-400" />
              <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Not Enough Data ({{ store.unknownRides.length }})
              </h2>
            </div>
            <div class="space-y-2">
              <RideCard v-for="ride in store.unknownRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
            </div>
          </div>

          <!-- Walk-on / no wait data section -->
          <div v-if="store.walkOnRides.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-2 px-1">
              <div class="w-2 h-2 rounded-full bg-gray-300" />
              <h2 class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                No Posted Wait ({{ store.walkOnRides.length }})
              </h2>
            </div>
            <div class="space-y-2">
              <RideCard v-for="ride in store.walkOnRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
            </div>
          </div>

          <!-- Closed section -->
          <div v-if="store.closedRides.length > 0" class="mb-6">
            <div class="flex items-center gap-2 mb-2 px-1">
              <div class="w-2 h-2 rounded-full bg-gray-300" />
              <h2 class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Closed ({{ store.closedRides.length }})
              </h2>
            </div>
            <div class="space-y-2">
              <RideCard v-for="ride in store.closedRides" :key="ride.id" :ride="ride" :park-id="parkSlug" />
            </div>
          </div>
        </div>

        <!-- All Rides Tab -->
        <div v-if="activeTab === 'all'" class="space-y-2 pb-8">
          <RideCard v-for="ride in store.rideList" :key="ride.id" :ride="ride" show-recommendation :park-id="parkSlug" />
        </div>
      </template>
    </div>
  </div>
</template>
