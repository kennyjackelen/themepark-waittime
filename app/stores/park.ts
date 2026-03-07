import { defineStore } from 'pinia'
import type { Destination, ParkEntry, LiveDataEntry, RideData, WaitTimeSnapshot, RideScore, ForecastSource } from '../utils/types'
import { fetchDestinations, fetchEntityChildren, fetchLiveData, fetchSchedule, fetchParkForecasts } from '../utils/api'
import { forecastToProjections, generateSyntheticForecast, classifyRide, scoreRides } from '../utils/projection'

const ALLOWED_DESTINATION_IDS = new Set([
  'e957da41-3552-4cf6-b636-5babc5cbc4e5', // Walt Disney World
  '89db5d43-c434-4097-b71f-f6869f495a22', // Universal Orlando
])

export const useParkStore = defineStore('park', {
  state: () => ({
    destinations: [] as Destination[],
    selectedPark: null as ParkEntry | null,
    rides: new Map<string, RideData>(),
    loading: false,
    error: null as string | null,
    lastRefresh: null as Date | null,
    autoRefreshInterval: null as ReturnType<typeof setInterval> | null,
  }),

  getters: {
    rideList(): RideData[] {
      return Array.from(this.rides.values())
        .filter((r) => r.entityType === 'ATTRACTION')
        .sort((a, b) => a.name.localeCompare(b.name))
    },

    operatingRides(): RideData[] {
      return this.rideList.filter((r) => r.status === 'OPERATING' || r.status === 'OPEN')
    },

    topRecommendations(): RideScore[] {
      const ridesWithProjections = this.operatingRides.map((r) => ({
        id: r.id,
        name: r.name,
        currentWait: r.currentWait,
        status: r.status,
        projections: r.projection,
      }))
      return scoreRides(ridesWithProjections)
        .slice(0, 5)
        .map((s) => ({
          ride: this.rides.get(s.id)!,
          score: s.score,
          reason: s.reason,
        }))
    },

    goodTimeRides(): RideData[] {
      return this.operatingRides.filter((r) => r.recommendation === 'good_time')
    },

    badTimeRides(): RideData[] {
      return this.operatingRides.filter((r) => r.recommendation === 'bad_time')
    },

    doesntMatterRides(): RideData[] {
      return this.operatingRides.filter((r) => r.recommendation === 'doesnt_matter')
    },

    closedRides(): RideData[] {
      return this.rideList.filter((r) => r.recommendation === 'closed')
    },
  },

  actions: {
    async loadDestinations() {
      this.loading = true
      this.error = null
      try {
        const all = await fetchDestinations()
        this.destinations = all.filter((d: Destination) => ALLOWED_DESTINATION_IDS.has(d.id))
      } catch (e: any) {
        this.error = e.message || 'Failed to load destinations'
      } finally {
        this.loading = false
      }
    },

    async selectPark(park: ParkEntry) {
      this.selectedPark = park
      this.rides.clear()
      await this.refreshLiveData()
      this.startAutoRefresh()
    },

    async refreshLiveData() {
      if (!this.selectedPark) return
      this.loading = true
      this.error = null
      try {
        // Fetch children, live data, schedule, and backend forecasts in parallel
        const [childrenData, liveDataResponse, scheduleData, backendForecasts] = await Promise.all([
          fetchEntityChildren(this.selectedPark.id),
          fetchLiveData(this.selectedPark.id),
          fetchSchedule(this.selectedPark.id),
          fetchParkForecasts(this.selectedPark.id).catch(() => null),
        ])

        // Extract today's operating hours for synthetic forecasts
        const todayStr = new Date().toISOString().slice(0, 10)
        const todaySchedule = scheduleData.schedule.find(
          (s: any) => s.date === todayStr && s.type === 'OPERATING'
        )
        const parkOpenHour = todaySchedule ? new Date(todaySchedule.openingTime).getHours() : 9
        const parkCloseHour = todaySchedule ? new Date(todaySchedule.closingTime).getHours() : 21

        const childMap = new Map<string, { name: string; entityType: string }>()
        for (const child of childrenData.children) {
          childMap.set(child.id, { name: child.name, entityType: child.entityType })
        }

        const now = new Date()
        for (const entry of liveDataResponse.liveData as LiveDataEntry[]) {
          const childInfo = childMap.get(entry.id)
          const entityType = childInfo?.entityType || entry.entityType || 'UNKNOWN'
          if (entityType !== 'ATTRACTION') continue

          const currentWait = entry.queue?.STANDBY?.waitTime ?? null
          const status = entry.status || 'UNKNOWN'

          const existing = this.rides.get(entry.id)
          const history: WaitTimeSnapshot[] = existing?.history ? [...existing.history] : []

          // Add current data point to history
          if (currentWait !== null) {
            history.push({ time: now, waitMinutes: currentWait })
          }

          // Keep only last 4 hours of history
          const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)
          const trimmedHistory = history.filter((h) => h.time >= fourHoursAgo)

          // Forecast priority: API forecast > backend historical > synthetic curve
          let projection = forecastToProjections((entry as any).forecast)
          let forecastSource: ForecastSource = projection.length > 0 ? 'api' : 'none'

          if (projection.length === 0 && backendForecasts?.forecasts[entry.id]) {
            const bf = backendForecasts.forecasts[entry.id]
            projection = bf.forecast.map((f) => ({
              hour: f.hour,
              minute: f.minute,
              projectedWait: f.projectedWait,
            }))
            forecastSource = 'historical'
          }

          if (projection.length === 0 && currentWait !== null && (status === 'OPERATING' || status === 'OPEN')) {
            projection = generateSyntheticForecast(currentWait, parkOpenHour, parkCloseHour, now)
            forecastSource = 'synthetic'
          }

          const recommendation = classifyRide(currentWait, status, projection)

          this.rides.set(entry.id, {
            id: entry.id,
            name: entry.name || childInfo?.name || 'Unknown Ride',
            entityType,
            currentWait,
            status,
            history: trimmedHistory,
            projection,
            forecastSource,
            recommendation,
          })
        }

        this.lastRefresh = now
      } catch (e: any) {
        this.error = e.message || 'Failed to refresh data'
      } finally {
        this.loading = false
      }
    },

    startAutoRefresh() {
      this.stopAutoRefresh()
      // Refresh every 5 minutes
      this.autoRefreshInterval = setInterval(() => {
        this.refreshLiveData()
      }, 5 * 60 * 1000)
    },

    stopAutoRefresh() {
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval)
        this.autoRefreshInterval = null
      }
    },

    leavePark() {
      this.stopAutoRefresh()
      this.selectedPark = null
      this.rides.clear()
      this.lastRefresh = null
    },
  },
})
