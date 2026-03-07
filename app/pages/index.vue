<script setup lang="ts">
import { useParkStore } from '../stores/park'
import type { ParkEntry } from '../utils/types'
import { parkIdToSlug } from '../utils/slugs'

const store = useParkStore()
const searchQuery = ref('')

onMounted(() => {
  if (store.destinations.length === 0) {
    store.loadDestinations()
  }
})

const filteredDestinations = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return store.destinations
  return store.destinations
    .map((d) => {
      const matchesDest = d.name.toLowerCase().includes(q)
      const matchingParks = d.parks.filter((p) => p.name.toLowerCase().includes(q))
      // If the destination name matches, show all its parks; otherwise show only matching parks
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
  <div class="max-w-lg mx-auto px-4 py-6">
    <h1 class="text-2xl font-bold text-center mb-1">Theme Park Guide</h1>
    <p class="text-gray-500 text-center text-sm mb-6">Choose your park to get started</p>

    <input
      v-model="searchQuery"
      type="search"
      placeholder="Search parks..."
      class="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
    />

    <div v-if="store.loading && store.destinations.length === 0" class="text-center py-12 text-gray-400">
      Loading destinations...
    </div>

    <div v-else-if="store.error" class="text-center py-12 text-red-500">
      {{ store.error }}
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="dest in filteredDestinations"
        :key="dest.id"
        class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      >
        <div class="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <h2 class="font-semibold text-gray-800">{{ dest.name }}</h2>
        </div>
        <div class="divide-y divide-gray-50">
          <button
            v-for="park in dest.parks"
            :key="park.id"
            class="w-full px-4 py-3 text-left hover:bg-blue-50 active:bg-blue-100 transition-colors flex items-center justify-between"
            @click="selectPark(park)"
          >
            <span class="text-gray-700">{{ park.name }}</span>
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
