export interface Destination {
  id: string
  name: string
  slug: string
  parks: ParkEntry[]
}

export interface ParkEntry {
  id: string
  name: string
}

export interface EntityData {
  id: string
  name: string
  entityType: string
  parentId?: string
  destinationId?: string
  timezone?: string
  location?: { latitude: number; longitude: number }
  tags?: Record<string, string>[]
}

export interface EntityChild {
  id: string
  name: string
  entityType: string
  location?: { latitude: number; longitude: number }
}

export interface ForecastEntry {
  time: string
  waitTime: number
  percentage: number
}

export interface LiveDataEntry {
  id: string
  name: string
  entityType: string
  status?: string
  queue?: {
    STANDBY?: { waitTime: number | null }
    SINGLE_RIDER?: { waitTime: number | null }
    RETURN_TIME?: { state?: string; returnStart?: string; returnEnd?: string }
  }
  forecast?: ForecastEntry[]
  showtimes?: { startTime: string; endTime: string; type: string }[]
  operatingHours?: { openingTime: string; closingTime: string }[]
}

export interface WaitTimeSnapshot {
  time: Date
  waitMinutes: number | null
}

export type ForecastSource = 'api' | 'historical' | 'synthetic' | 'none'

export interface RideData {
  id: string
  name: string
  entityType: string
  currentWait: number | null
  status: string
  history: WaitTimeSnapshot[]
  projection: ProjectedWait[]
  forecastSource: ForecastSource
  recommendation: RideRecommendation
}

export interface ProjectedWait {
  hour: number
  minute: number
  projectedWait: number
}

export type RideRecommendation =
  | 'good_time'     // wait is lower than usual / trending down
  | 'bad_time'      // wait is higher than usual / trending up
  | 'doesnt_matter' // consistently low or consistently high with no good window
  | 'closed'        // ride is closed
  | 'unknown'       // not enough data

export interface RideScore {
  ride: RideData
  score: number
  reason: string
}
