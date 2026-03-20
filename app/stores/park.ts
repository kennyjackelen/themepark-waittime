import { defineStore } from 'pinia'
import type { Destination, ParkEntry, LiveDataEntry, RideData, WaitTimeSnapshot, RideScore, ForecastSource } from '../utils/types'
import { fetchDestinations, fetchEntityChildren, fetchLiveData, fetchSchedule, fetchParkForecasts, fetchParkHistory } from '../utils/api'
import { forecastToProjections, generateSyntheticForecast, classifyRide, scoreRides, interpolateProjectedWait } from '../utils/projection'
import { getHourInTz, getMinutesSinceMidnight, formatTimeInTz, getTodayInTz, getStartOfDayInTz } from '../utils/parkTime'
import { nameToSlug } from '../utils/slugs'
import { getRideRatings, getRideTags } from '../utils/rideRatings'

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
    parkOpenHour: 9,
    parkCloseHour: 21,
    parkOpenTime: null as string | null,
    parkCloseTime: null as string | null,
    parkSchedules: {} as Record<string, { open: string; close: string; openHour: number; closeHour: number } | null>,
    parkTimezone: 'America/New_York' as string,
    lastRefresh: null as Date | null,
    autoRefreshInterval: null as ReturnType<typeof setInterval> | null,
    timeOffsetHours: 0,
  }),

  getters: {
    now(): Date {
      const offset = this.timeOffsetHours || 0
      if (offset === 0) return new Date()
      return new Date(Date.now() + offset * 60 * 60 * 1000)
    },

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
      return scoreRides(ridesWithProjections, this.now, this.parkTimezone)
        .slice(0, 5)
        .map((s) => {
          const ride = this.rides.get(s.id)!
          return {
            ride,
            score: s.score,
            reason: ride.reason || s.reason,
          }
        })
    },

    walkOnRides(): RideData[] {
      return this.operatingRides.filter((r) => r.currentWait === null)
    },

    goodTimeRides(): RideData[] {
      return this.operatingRides.filter((r) => r.currentWait !== null && r.recommendation === 'good_time')
    },

    badTimeRides(): RideData[] {
      return this.operatingRides.filter((r) => r.currentWait !== null && r.recommendation === 'bad_time')
    },

    doesntMatterRides(): RideData[] {
      return this.operatingRides.filter((r) => r.currentWait !== null && r.recommendation === 'doesnt_matter')
    },

    unknownRides(): RideData[] {
      return this.operatingRides.filter((r) => r.currentWait !== null && r.recommendation === 'unknown')
    },

    closedRides(): RideData[] {
      return this.rideList.filter((r) => r.recommendation === 'closed')
    },

    rideBySlug(): (slug: string) => RideData | undefined {
      const slugMap = new Map<string, RideData>()
      for (const ride of this.rides.values()) {
        slugMap.set(nameToSlug(ride.name), ride)
      }
      return (slug: string) => slugMap.get(slug)
    },

    rideSlug(): (id: string) => string {
      return (id: string) => {
        const ride = this.rides.get(id)
        return ride ? nameToSlug(ride.name) : id
      }
    },

    isParkOpen(): (parkId: string) => boolean | null {
      const nowHour = getHourInTz(this.now, this.parkTimezone)
      return (parkId: string) => {
        const sched = this.parkSchedules[parkId]
        if (sched === undefined) return null // not loaded yet
        if (sched === null) return false // closed today
        return nowHour >= sched.openHour && nowHour < sched.closeHour
      }
    },

    selectedParkOpen(): boolean | null {
      if (!this.selectedPark) return null
      if (this.parkOpenTime === null) return null
      const nowHour = getHourInTz(this.now, this.parkTimezone)
      return nowHour >= this.parkOpenHour && nowHour < this.parkCloseHour
    },
  },

  actions: {
    async loadDestinations() {
      this.loading = true
      this.error = null
      try {
        const all = await fetchDestinations()
        this.destinations = all.filter((d: Destination) => ALLOWED_DESTINATION_IDS.has(d.id))
        // Fetch schedules for all parks in the background
        this.loadAllParkSchedules()
      } catch (e: any) {
        this.error = e.message || 'Failed to load destinations'
      } finally {
        this.loading = false
      }
    },

    async loadAllParkSchedules() {
      const tz = this.parkTimezone
      const todayStr = getTodayInTz(tz)
      const parkIds = this.destinations.flatMap((d) => d.parks.map((p) => p.id))
      const results = await Promise.allSettled(
        parkIds.map((id) => fetchSchedule(id).then((data) => ({ id, data })))
      )
      for (const result of results) {
        if (result.status === 'fulfilled') {
          const { id, data } = result.value
          const todaySchedule = data.schedule.find(
            (s: any) => s.date === todayStr && s.type === 'OPERATING'
          )
          if (todaySchedule) {
            this.parkSchedules[id] = {
              open: formatTimeInTz(new Date(todaySchedule.openingTime), tz),
              close: formatTimeInTz(new Date(todaySchedule.closingTime), tz),
              openHour: getHourInTz(new Date(todaySchedule.openingTime), tz),
              closeHour: getHourInTz(new Date(todaySchedule.closingTime), tz),
            }
          } else {
            this.parkSchedules[id] = null
          }
        }
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
        // Fetch children, live data, schedule, backend forecasts, and server history in parallel
        const [childrenData, liveDataResponse, scheduleData, backendForecasts, serverHistory] = await Promise.all([
          fetchEntityChildren(this.selectedPark.id),
          fetchLiveData(this.selectedPark.id),
          fetchSchedule(this.selectedPark.id),
          fetchParkForecasts(this.selectedPark.id).catch(() => null),
          fetchParkHistory(this.selectedPark.id).catch(() => null),
        ])

        // Update park name from API response (needed for direct navigation)
        if (childrenData.name && this.selectedPark) {
          this.selectedPark.name = childrenData.name
        }

        // Extract today's operating hours for synthetic forecasts
        const tz = this.parkTimezone
        const todayStr = getTodayInTz(tz)
        const todaySchedule = scheduleData.schedule.find(
          (s: any) => s.date === todayStr && s.type === 'OPERATING'
        )
        this.parkOpenHour = todaySchedule ? getHourInTz(new Date(todaySchedule.openingTime), tz) : 9
        this.parkCloseHour = todaySchedule ? getHourInTz(new Date(todaySchedule.closingTime), tz) : 21
        if (todaySchedule) {
          this.parkOpenTime = formatTimeInTz(new Date(todaySchedule.openingTime), tz)
          this.parkCloseTime = formatTimeInTz(new Date(todaySchedule.closingTime), tz)
        } else {
          this.parkOpenTime = null
          this.parkCloseTime = null
        }
        const parkOpenHour = this.parkOpenHour
        const parkCloseHour = this.parkCloseHour

        const childMap = new Map<string, { name: string; entityType: string }>()
        for (const child of childrenData.children) {
          childMap.set(child.id, { name: child.name, entityType: child.entityType })
        }

        const now = this.now
        for (const entry of liveDataResponse.liveData as LiveDataEntry[]) {
          const childInfo = childMap.get(entry.id)
          const entityType = childInfo?.entityType || entry.entityType || 'UNKNOWN'
          if (entityType !== 'ATTRACTION') continue

          const currentWait = entry.queue?.STANDBY?.waitTime ?? null
          const status = entry.status || 'UNKNOWN'

          // Build history: start from server-collected data, then merge in-memory snapshots
          const serverSnaps: WaitTimeSnapshot[] = (serverHistory?.history[entry.id] || []).map((s) => ({
            time: new Date(s.time),
            waitMinutes: s.waitMinutes,
          }))

          const existing = this.rides.get(entry.id)
          const inMemory: WaitTimeSnapshot[] = existing?.history ? [...existing.history] : []

          // Add current data point using the API's lastUpdated timestamp when available
          if (currentWait !== null) {
            const observedAt = (entry as any).lastUpdated ? new Date((entry as any).lastUpdated) : now
            inMemory.push({ time: observedAt, waitMinutes: currentWait })
          }

          // Merge server + in-memory, dedup by rounding to nearest minute
          const seen = new Set<number>()
          const merged: WaitTimeSnapshot[] = []
          for (const snap of [...serverSnaps, ...inMemory]) {
            const key = Math.round(snap.time.getTime() / 60000)
            if (!seen.has(key)) {
              seen.add(key)
              merged.push(snap)
            }
          }
          merged.sort((a, b) => a.time.getTime() - b.time.getTime())

          // Keep only today's history
          const startOfDay = getStartOfDayInTz(now, tz)
          const trimmedHistory = merged.filter((h) => h.time >= startOfDay)

          // Forecast priority: API forecast > backend historical > synthetic curve
          let projection = forecastToProjections((entry as any).forecast, tz)
          let forecastSource: ForecastSource = projection.length > 0 ? 'api' : 'none'

          if (projection.length === 0 && backendForecasts?.forecasts[entry.id]) {
            const bf = backendForecasts.forecasts[entry.id]!
            projection = bf.forecast.map((f) => ({
              hour: f.hour,
              minute: f.minute,
              projectedWait: f.projectedWait,
              low: f.low,
              high: f.high,
            }))
            forecastSource = 'historical'
          }

          // When time-shifted, derive a simulated wait from existing projections
          const isShifted = (this.timeOffsetHours || 0) !== 0
          const isOpen = status === 'OPERATING' || status === 'OPEN'

          // For non-operating rides, use last known wait from today's history for synthetic
          const lastKnownWait = !isOpen && trimmedHistory.length > 0
            ? trimmedHistory[trimmedHistory.length - 1]!.waitMinutes
            : null
          const effectiveWait = currentWait
            ?? (isShifted ? interpolateProjectedWait(projection, now, tz) : null)
            ?? lastKnownWait
          const effectiveOpen = (currentWait !== null && isOpen) || isShifted || lastKnownWait !== null

          // Fill any missing hours in backend forecasts with synthetic data
          if (projection.length > 0 && effectiveWait !== null && effectiveOpen) {
            const synthetic = generateSyntheticForecast(effectiveWait, parkOpenHour, parkCloseHour, now, tz)
            const existingHours = new Set(projection.map((p) => p.hour))
            for (const s of synthetic) {
              if (!existingHours.has(s.hour)) {
                projection.push(s)
              }
            }
            projection.sort((a, b) => a.hour * 60 + (a.minute ?? 0) - (b.hour * 60 + (b.minute ?? 0)))
          }

          if (projection.length === 0 && effectiveWait !== null && effectiveOpen) {
            projection = generateSyntheticForecast(effectiveWait, parkOpenHour, parkCloseHour, now, tz)
            forecastSource = 'synthetic'
          }

          const { recommendation, reason } = classifyRide(currentWait, status, projection, now, tz)

          const rideName = entry.name || childInfo?.name || 'Unknown Ride'
          this.rides.set(entry.id, {
            id: entry.id,
            name: rideName,
            entityType,
            currentWait,
            status,
            history: trimmedHistory,
            projection,
            forecastSource,
            recommendation,
            reason,
            guestRatings: getRideRatings(rideName),
            tags: getRideTags(rideName),
          })
        }

        // When time-shifted, simulate operating data from projections
        if ((this.timeOffsetHours || 0) !== 0) {
          this.reclassifyRides()
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

    /** Re-classify all rides using the current (possibly shifted) time.
     *  When time-shifted, simulate operating status using projected waits. */
    reclassifyRides() {
      const now = this.now
      const tz = this.parkTimezone
      const isShifted = (this.timeOffsetHours || 0) !== 0
      for (const [id, ride] of this.rides) {
        if (isShifted && ride.projection.length > 0) {
          // Simulate operating status using forecast data
          const simulatedWait = interpolateProjectedWait(ride.projection, now, tz)
          if (simulatedWait !== null) {
            ride.currentWait = simulatedWait
            ride.status = 'OPERATING'
          }
        }
        const result = classifyRide(ride.currentWait, ride.status, ride.projection, now, tz)
        ride.recommendation = result.recommendation
        ride.reason = result.reason
      }
    },
  },
})
