const BASE_URL = 'https://api.themeparks.wiki/v1'

export async function fetchDestinations() {
  const data = await $fetch<{ destinations: any[] }>(`${BASE_URL}/destinations`)
  return data.destinations
}

export async function fetchEntityChildren(entityId: string) {
  const data = await $fetch<{ id: string; name: string; children: any[] }>(
    `${BASE_URL}/entity/${entityId}/children`
  )
  return data
}

export async function fetchLiveData(entityId: string) {
  const data = await $fetch<{ id: string; name: string; liveData: any[] }>(
    `${BASE_URL}/entity/${entityId}/live`
  )
  return data
}

export async function fetchSchedule(entityId: string) {
  const data = await $fetch<{ id: string; name: string; schedule: any[] }>(
    `${BASE_URL}/entity/${entityId}/schedule`
  )
  return data
}

export interface ParkForecastResponse {
  parkId: string
  dayOfWeek: number
  forecasts: Record<string, {
    source: string
    forecast: { hour: number; minute: number; projectedWait: number; sampleCount: number }[]
  }>
}

export async function fetchParkForecasts(parkId: string): Promise<ParkForecastResponse> {
  return await $fetch<ParkForecastResponse>(`/api/forecast/park/${parkId}`)
}
