<script setup lang="ts">
const emit = defineEmits<{ dismiss: [] }>()

const currentStep = ref(0)

const steps = [
  {
    title: 'Real-Time Wait Times',
    description: 'See live wait times for every ride, updated every few minutes. Color-coded so you can spot short waits at a glance.',
    visual: 'waits',
  },
  {
    title: 'Smart Recommendations',
    description: 'We compare the current wait to projected waits for the rest of the day, so you know if now is a good time or if you should come back later.',
    visual: 'recommendations',
  },
  {
    title: 'Forecast Charts',
    description: 'Each ride has a projected wait chart built from historical data. See how waits trend throughout the day to plan your route.',
    visual: 'chart',
  },
]

const sampleRides = [
  { name: 'Space Mountain', wait: 15, color: 'text-emerald-600' },
  { name: 'Thunder Mountain', wait: 45, color: 'text-orange-500' },
  { name: 'Haunted Mansion', wait: 5, color: 'text-emerald-600' },
]

const sampleRecs = [
  { name: 'Haunted Mansion', badge: 'Go now', badgeClass: 'bg-emerald-100 text-emerald-700', wait: 5 },
  { name: 'Thunder Mountain', badge: 'Wait', badgeClass: 'bg-red-100 text-red-700', wait: 45 },
  { name: 'Pirates of the Caribbean', badge: 'Anytime', badgeClass: 'bg-blue-100 text-blue-700', wait: 20 },
]

// Sample forecast data (projected waits per hour)
const sampleForecast = [
  { label: '9a', wait: 10 },
  { label: '10a', wait: 25 },
  { label: '11a', wait: 45 },
  { label: '12p', wait: 60 },
  { label: '1p', wait: 65 },
  { label: '2p', wait: 55 },
  { label: '3p', wait: 50 },
  { label: '4p', wait: 40 },
  { label: '5p', wait: 25 },
  { label: '6p', wait: 15 },
]

const CHART_MAX = 65 // max wait in sample data

// Sample actual data points (index into sampleForecast, actual wait)
// "Now" is between 2p and 3p (index ~5.5), so actuals cover 9a-2p
const sampleActualPoints = [
  { idx: 0, wait: 8 },
  { idx: 1, wait: 22 },
  { idx: 2, wait: 40 },
  { idx: 3, wait: 55 },
  { idx: 4, wait: 70 },
  { idx: 5, wait: 50 },
]

// Live point: current time between 2p and 3p
const livePoint = { idx: 5.5, wait: 48 }

// Convert index to x% (center of each bar slot)
function slotXPct(idx: number): number {
  const slotWidth = 100 / sampleForecast.length
  return slotWidth * idx + slotWidth / 2
}

// Convert wait to y% from bottom
function waitYPct(wait: number): number {
  return (wait / CHART_MAX) * 100
}

// SVG polyline points for actual line (including live point)
const actualLineSvg = computed(() => {
  const allPoints = [
    ...sampleActualPoints.map(p => ({ x: slotXPct(p.idx), y: 100 - waitYPct(p.wait) })),
    { x: slotXPct(livePoint.idx), y: 100 - waitYPct(livePoint.wait) },
  ]
  return allPoints.map(p => `${p.x},${p.y}`).join(' ')
})

function next() {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
  } else {
    emit('dismiss')
  }
}

function skip() {
  emit('dismiss')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="overlay">
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="skip" />

        <!-- Card -->
        <div class="relative w-full max-w-sm mx-4 mb-8 sm:mb-0 bg-white dark:bg-gray-800 rounded-3xl shadow-2xl overflow-hidden">
          <!-- Visual area -->
          <div class="bg-gradient-to-br from-indigo-600 to-purple-700 px-6 pt-8 pb-6">
            <h2 class="text-xl font-bold text-white text-center mb-4">{{ steps[currentStep].title }}</h2>

            <!-- Step 1: Sample wait time list -->
            <div v-if="steps[currentStep].visual === 'waits'" class="space-y-2">
              <div
                v-for="ride in sampleRides"
                :key="ride.name"
                class="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 flex items-center justify-between"
              >
                <span class="text-white/90 text-sm font-medium">{{ ride.name }}</span>
                <div class="flex items-baseline gap-1">
                  <span class="text-lg font-bold tabular-nums" :class="ride.color">{{ ride.wait }}</span>
                  <span class="text-[10px] text-white/50 uppercase">min</span>
                </div>
              </div>
            </div>

            <!-- Step 2: Sample recommendation badges -->
            <div v-else-if="steps[currentStep].visual === 'recommendations'" class="space-y-2">
              <div
                v-for="rec in sampleRecs"
                :key="rec.name"
                class="bg-white/10 backdrop-blur rounded-xl px-4 py-2.5 flex items-center gap-3"
              >
                <div class="flex-1 min-w-0">
                  <span class="text-white/90 text-sm font-medium">{{ rec.name }}</span>
                  <div class="mt-1">
                    <span class="text-[11px] px-2 py-0.5 rounded-full font-semibold" :class="rec.badgeClass">
                      {{ rec.badge }}
                    </span>
                  </div>
                </div>
                <div class="text-right shrink-0">
                  <span class="text-lg font-bold tabular-nums text-white">{{ rec.wait }}</span>
                  <span class="text-[10px] text-white/50 uppercase ml-0.5">min</span>
                </div>
              </div>
            </div>

            <!-- Step 3: Sample forecast chart -->
            <div v-else class="bg-white/10 backdrop-blur rounded-xl p-4">
              <div class="flex items-center gap-3 mb-2 text-[11px] text-white/50">
                <span class="flex items-center gap-1">
                  <span class="inline-block w-2.5 h-2.5 rounded-sm bg-teal-400" /> Forecast
                </span>
                <span class="flex items-center gap-1">
                  <span class="inline-block w-2.5 h-0.5 rounded bg-rose-400" /> Actual
                </span>
              </div>
              <div class="relative" style="height: 72px">
                <!-- Forecast bars -->
                <div class="flex items-end gap-[3px] h-full">
                  <div
                    v-for="(slot, i) in sampleForecast"
                    :key="i"
                    class="flex-1 min-w-0"
                  >
                    <div
                      class="w-full rounded-sm"
                      :class="i <= 5 ? 'bg-teal-300/60' : 'bg-teal-400'"
                      :style="{ height: (slot.wait / CHART_MAX) * 72 + 'px' }"
                    />
                  </div>
                </div>
                <!-- Actual line overlay -->
                <svg class="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    :points="actualLineSvg"
                    fill="none"
                    stroke="#fb7185"
                    stroke-width="2"
                    vector-effect="non-scaling-stroke"
                    stroke-linejoin="round"
                    stroke-linecap="round"
                  />
                </svg>
                <!-- Data point dots -->
                <div
                  v-for="(pt, i) in sampleActualPoints"
                  :key="i"
                  class="absolute w-1.5 h-1.5 bg-rose-500 rounded-full pointer-events-none"
                  :style="{
                    left: `calc(${slotXPct(pt.idx)}% - 3px)`,
                    bottom: `calc(${waitYPct(pt.wait)}% - 3px)`,
                  }"
                />
                <!-- Live dot pulse ring -->
                <div
                  class="absolute rounded-full pointer-events-none bg-rose-400 animate-ping"
                  :style="{
                    width: '10px', height: '10px',
                    left: `calc(${slotXPct(livePoint.idx)}% - 5px)`,
                    bottom: `calc(${waitYPct(livePoint.wait)}% - 5px)`,
                  }"
                />
                <!-- Live dot -->
                <div
                  class="absolute w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white shadow-sm pointer-events-none"
                  :style="{
                    left: `calc(${slotXPct(livePoint.idx)}% - 5px)`,
                    bottom: `calc(${waitYPct(livePoint.wait)}% - 5px)`,
                  }"
                />
              </div>
              <!-- Labels -->
              <div class="flex gap-[3px] mt-1">
                <div
                  v-for="(slot, i) in sampleForecast"
                  :key="slot.label"
                  class="flex-1 min-w-0 flex flex-col items-center"
                >
                  <span class="text-[10px] leading-none text-white/40">{{ slot.label }}</span>
                  <span class="text-[9px] leading-none mt-0.5 font-medium tabular-nums text-teal-300">{{ slot.wait }}</span>
                  <span
                    v-if="sampleActualPoints.find(p => p.idx === i)"
                    class="text-[9px] leading-none mt-0.5 font-medium tabular-nums text-rose-300"
                  >{{ sampleActualPoints.find(p => p.idx === i)!.wait }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Content -->
          <div class="px-8 pt-5 pb-6">
            <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed text-center">
              {{ steps[currentStep].description }}
            </p>

            <!-- Progress dots -->
            <div class="flex justify-center gap-2 mt-5">
              <div
                v-for="(_, i) in steps"
                :key="i"
                class="h-1.5 rounded-full transition-all duration-300"
                :class="i === currentStep ? 'w-6 bg-indigo-600' : 'w-1.5 bg-gray-200 dark:bg-gray-600'"
              />
            </div>

            <!-- Actions -->
            <div class="flex gap-3 mt-5">
              <button
                v-if="currentStep < steps.length - 1"
                class="flex-1 py-2.5 text-sm font-medium text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                @click="skip"
              >
                Skip
              </button>
              <button
                class="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
                :class="{ 'flex-[2]': currentStep < steps.length - 1 }"
                @click="next"
              >
                {{ currentStep < steps.length - 1 ? 'Next' : 'Get Started' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.overlay-enter-active {
  transition: opacity 0.3s ease;
}
.overlay-enter-active .relative {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.overlay-enter-from {
  opacity: 0;
}
.overlay-enter-from .relative {
  transform: translateY(30px);
  opacity: 0;
}
.overlay-leave-active {
  transition: opacity 0.2s ease;
}
.overlay-leave-to {
  opacity: 0;
}
</style>
