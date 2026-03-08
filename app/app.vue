<template>
  <div class="min-h-screen bg-gradient-to-b from-slate-100 to-slate-50 font-sans">
    <NuxtRouteAnnouncer />
    <NuxtPage />
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
