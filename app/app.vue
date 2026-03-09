<script setup lang="ts">
useDarkMode()
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 dark:from-gray-950 dark:to-gray-950 font-sans dark:text-gray-100 transition-colors">
    <NuxtRouteAnnouncer />
    <NuxtPage />
    <ClientOnly>
      <TimeShiftControl />
    </ClientOnly>
  </div>
</template>

<style>
:root {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.page-enter-active,
.page-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

</style>
