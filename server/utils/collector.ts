import { getDb } from './db'

const BASE_URL = 'https://api.themeparks.wiki/v1'

// All parks we want to collect data for
const PARK_IDS = [
  // Walt Disney World
  '75ea578a-adc8-4116-a54d-dccb60765ef9', // Magic Kingdom
  '47f90d2c-e191-4239-a466-5892ef59a88b', // EPCOT
  '288747d1-8b4f-4a64-867e-ea7c9b27bad8', // Hollywood Studios
  '1c84a229-8862-4648-9c71-378ddd2c7693', // Animal Kingdom
  'b070cbc5-feaa-4b87-a8c1-f94cca037a18', // Typhoon Lagoon
  'ead53ea5-22e5-4095-9a83-8c29300d7c63', // Blizzard Beach
  // Universal Orlando
  '267615cc-8943-4c2a-ae2c-5da728ca591f', // Islands of Adventure
  'eb3f4560-2383-4a36-9152-6b3e5ed6bc57', // Universal Studios
  'fe78a026-b91b-470c-b906-9d2266b692da', // Volcano Bay
  '12dbb85b-265f-44e6-bccf-f1faa17211fc', // Epic Universe
]

const POLL_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

let intervalHandle: ReturnType<typeof setInterval> | null = null

export function startCollector() {
  if (intervalHandle) return
  console.log('[collector] Starting wait time data collection')
  // Run immediately, then on interval
  collectAll()
  intervalHandle = setInterval(collectAll, POLL_INTERVAL_MS)
}

export function stopCollector() {
  if (intervalHandle) {
    clearInterval(intervalHandle)
    intervalHandle = null
  }
}

async function collectAll() {
  const now = new Date()
  console.log(`[collector] Polling ${PARK_IDS.length} parks at ${now.toISOString()}`)

  // Fetch all parks in parallel
  const results = await Promise.allSettled(
    PARK_IDS.map((parkId) => collectPark(parkId, now))
  )

  let totalInserted = 0
  for (const r of results) {
    if (r.status === 'fulfilled') totalInserted += r.value
  }
  console.log(`[collector] Inserted ${totalInserted} observations`)
}

async function collectPark(parkId: string, now: Date): Promise<number> {
  try {
    const [childrenRes, liveRes] = await Promise.all([
      fetch(`${BASE_URL}/entity/${parkId}/children`).then((r) => r.json()) as Promise<any>,
      fetch(`${BASE_URL}/entity/${parkId}/live`).then((r) => r.json()) as Promise<any>,
    ])

    const childMap = new Map<string, { name: string; entityType: string }>()
    for (const child of childrenRes.children || []) {
      childMap.set(child.id, { name: child.name, entityType: child.entityType })
    }

    const db = getDb()
    const insert = db.prepare(`
      INSERT OR IGNORE INTO wait_observations (park_id, ride_id, ride_name, wait_minutes, status, observed_at, day_of_week, hour, minute)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let count = 0
    const insertMany = db.transaction(() => {
      for (const entry of liveRes.liveData || []) {
        const childInfo = childMap.get(entry.id)
        const entityType = childInfo?.entityType || entry.entityType || 'UNKNOWN'
        if (entityType !== 'ATTRACTION') continue

        const waitTime = entry.queue?.STANDBY?.waitTime
        if (waitTime === null || waitTime === undefined) continue

        const status = entry.status || 'UNKNOWN'
        if (status !== 'OPERATING' && status !== 'OPEN') continue

        const name = entry.name || childInfo?.name || 'Unknown'
        const observedAt = entry.lastUpdated ? new Date(entry.lastUpdated) : now
        insert.run(
          parkId,
          entry.id,
          name,
          waitTime,
          status,
          observedAt.toISOString(),
          observedAt.getDay(),
          observedAt.getHours(),
          observedAt.getMinutes(),
        )
        count++
      }
    })

    insertMany()
    return count
  } catch (err: any) {
    console.error(`[collector] Error collecting park ${parkId}:`, err.message)
    return 0
  }
}
