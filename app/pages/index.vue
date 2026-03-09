<script setup lang="ts">
import { useParkStore } from '../stores/park'
import type { ParkEntry } from '../utils/types'
import { parkIdToSlug } from '../utils/slugs'

const store = useParkStore()
const searchQuery = ref('')
const showIntro = ref(false)

onMounted(() => {
  if (store.destinations.length === 0) {
    store.loadDestinations()
  }
  if (!localStorage.getItem('intro_seen')) {
    showIntro.value = true
  }
})

function dismissIntro() {
  showIntro.value = false
  localStorage.setItem('intro_seen', '1')
}

const filteredDestinations = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.destinations
  return store.destinations
    .map((d) => {
      const matchesDest = d.name.toLowerCase().includes(q)
      const matchingParks = d.parks.filter((p) => p.name.toLowerCase().includes(q))
      if (matchesDest) return d
      if (matchingParks.length > 0) return { ...d, parks: matchingParks }
      return null
    })
    .filter(Boolean) as typeof store.destinations
})

function selectPark(park: ParkEntry) {
  store.selectPark(park)
  navigateTo(`/park/${parkIdToSlug(park.id)}`)
}
</script>

<template>
  <div class="min-h-screen">
    <IntroOverlay v-if="showIntro" @dismiss="dismissIntro" />

    <!-- Hero header -->
    <div class="bg-gradient-to-br from-indigo-950 via-indigo-900 to-purple-900 text-white px-4 pt-10 pb-8">
      <div class="max-w-lg mx-auto">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-extrabold tracking-tight">Kenny's Park Times</h1>
            <p class="text-indigo-300 text-sm mt-1">Real-time wait times & smart recommendations</p>
          </div>
          <button
            class="mt-1 p-2 -mr-2 rounded-full text-indigo-400 hover:text-white hover:bg-white/10 transition-colors"
            title="About this app"
            @click="showIntro = true"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-lg mx-auto px-4 -mt-4">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="Search parks..."
        class="w-full px-4 py-3 rounded-xl border-0 bg-white text-base shadow-lg shadow-black/5 focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
      />

      <div v-if="store.loading && store.destinations.length === 0" class="text-center py-16 text-gray-400">
        <div class="inline-block w-6 h-6 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin mb-3" />
        <p>Loading destinations...</p>
      </div>

      <div v-else-if="store.error" class="text-center py-12">
        <p class="text-red-500 mb-2">{{ store.error }}</p>
        <button class="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700" @click="store.loadDestinations()">
          Retry
        </button>
      </div>

      <div v-else class="space-y-4 mt-6 pb-8">
        <div
          v-for="dest in filteredDestinations"
          :key="dest.id"
          class="bg-white rounded-2xl shadow-sm shadow-black/5 overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-gray-100">
            <h2 class="font-semibold text-gray-500 text-xs tracking-wider uppercase">{{ dest.name }}</h2>
          </div>
          <div class="divide-y divide-gray-50">
            <button
              v-for="park in dest.parks"
              :key="park.id"
              class="w-full px-4 py-3.5 text-left hover:bg-indigo-50 active:bg-indigo-100 transition-colors flex items-center justify-between group"
              @click="selectPark(park)"
            >
              <div class="min-w-0">
                <span class="text-gray-800 font-medium">{{ park.name }}</span>
                <div v-if="store.parkSchedules[park.id]" class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-xs text-gray-400">{{ store.parkSchedules[park.id]!.open }} – {{ store.parkSchedules[park.id]!.close }}</span>
                  <span
                    v-if="store.isParkOpen(park.id) === true"
                    class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 leading-none"
                  >Open</span>
                  <span
                    v-else-if="store.isParkOpen(park.id) === false"
                    class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none"
                  >Closed</span>
                </div>
                <div v-else-if="store.parkSchedules[park.id] === null" class="flex items-center gap-1.5 mt-0.5">
                  <span
                    class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 leading-none"
                  >Closed today</span>
                </div>
              </div>
              <svg class="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
