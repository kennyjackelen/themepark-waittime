type DarkModePreference = 'light' | 'dark' | 'system'

const mode = ref<DarkModePreference>('system')
const systemPrefersDark = ref(false)

let initialized = false

function resolveIsDark(): boolean {
  if (mode.value === 'dark') return true
  if (mode.value === 'light') return false
  return systemPrefersDark.value
}

function applyClass() {
  if (import.meta.client) {
    document.documentElement.classList.toggle('dark', resolveIsDark())
  }
}

export function useDarkMode() {
  const isDark = computed(resolveIsDark)

  if (import.meta.client && !initialized) {
    initialized = true

    const saved = localStorage.getItem('dark_mode') as DarkModePreference | null
    if (saved === 'light' || saved === 'dark' || saved === 'system') {
      mode.value = saved
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    systemPrefersDark.value = mq.matches
    mq.addEventListener('change', (e) => {
      systemPrefersDark.value = e.matches
      applyClass()
    })

    // Apply immediately and watch for reactive changes
    applyClass()
    watch([mode, systemPrefersDark], () => applyClass())
  }

  function toggle() {
    if (mode.value === 'system') mode.value = 'dark'
    else if (mode.value === 'dark') mode.value = 'light'
    else mode.value = 'system'
    localStorage.setItem('dark_mode', mode.value)
    applyClass()
  }

  const modeLabel = computed(() => {
    if (mode.value === 'system') return 'Auto'
    if (mode.value === 'dark') return 'Dark'
    return 'Light'
  })

  return { mode, isDark, modeLabel, toggle }
}
