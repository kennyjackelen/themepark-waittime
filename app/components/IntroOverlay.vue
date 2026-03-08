<script setup lang="ts">
const emit = defineEmits<{ dismiss: [] }>()

const currentStep = ref(0)

const steps = [
  {
    title: 'Real-Time Wait Times',
    description: 'See live wait times for every ride, updated every few minutes. Color-coded so you can spot short waits at a glance.',
    icon: 'clock',
  },
  {
    title: 'Smart Recommendations',
    description: 'We compare the current wait to projected waits for the rest of the day, so you know if now is a good time or if you should come back later.',
    icon: 'sparkle',
  },
  {
    title: 'Forecast Charts',
    description: 'Each ride has a projected wait chart built from historical data. See how waits trend throughout the day to plan your route.',
    icon: 'chart',
  },
]

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
        <div class="relative w-full max-w-sm mx-4 mb-8 sm:mb-0 bg-white rounded-3xl shadow-2xl overflow-hidden">
          <!-- Illustration area -->
          <div class="bg-gradient-to-br from-indigo-600 to-purple-700 px-8 pt-10 pb-8 text-center">
            <!-- Icons -->
            <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <!-- Clock icon -->
              <svg v-if="steps[currentStep].icon === 'clock'" class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
              </svg>
              <!-- Sparkle icon -->
              <svg v-else-if="steps[currentStep].icon === 'sparkle'" class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
              </svg>
              <!-- Chart icon -->
              <svg v-else class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </div>
            <h2 class="text-xl font-bold text-white">{{ steps[currentStep].title }}</h2>
          </div>

          <!-- Content -->
          <div class="px-8 pt-5 pb-6">
            <p class="text-gray-600 text-sm leading-relaxed text-center">
              {{ steps[currentStep].description }}
            </p>

            <!-- Progress dots -->
            <div class="flex justify-center gap-2 mt-5">
              <div
                v-for="(_, i) in steps"
                :key="i"
                class="h-1.5 rounded-full transition-all duration-300"
                :class="i === currentStep ? 'w-6 bg-indigo-600' : 'w-1.5 bg-gray-200'"
              />
            </div>

            <!-- Actions -->
            <div class="flex gap-3 mt-5">
              <button
                v-if="currentStep < steps.length - 1"
                class="flex-1 py-2.5 text-sm font-medium text-gray-400 hover:text-gray-600 transition-colors"
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
