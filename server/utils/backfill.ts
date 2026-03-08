import { getDb } from './db'
import { parkTimeComponents } from './timezone'

const BASE_URL = 'https://api.themeparks.wiki/v1'

const PARKS = [
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

// Rate limit: wait between requests
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function backfillFromApi() {
  const db = getDb()
  const insert = db.prepare(`
    INSERT OR IGNORE INTO wait_observations
      (park_id, ride_id, ride_name, wait_minutes, status, observed_at, day_of_week, hour, minute)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  // Track what we already have so we don't duplicate
  const existingCount = (db.prepare('SELECT COUNT(*) as c FROM wait_observations').get() as any).c
  console.log(`[backfill] Starting. Existing observations: ${existingCount}`)

  let totalInserted = 0

  for (const parkId of PARKS) {
    console.log(`[backfill] Fetching children for park ${parkId}`)
    let children: any[]
    try {
      const res = await fetch(`${BASE_URL}/entity/${parkId}/children`)
      const data = await res.json() as any
      children = (data.children || []).filter((c: any) => c.entityType === 'ATTRACTION')
    } catch (err: any) {
      console.error(`[backfill] Failed to fetch children for ${parkId}:`, err.message)
      continue
    }

    console.log(`[backfill] Park has ${children.length} attractions, fetching history...`)

    for (const child of children) {
      // Respect rate limits: 200ms between requests
      await sleep(200)

      try {
        const res = await fetch(`${BASE_URL}/entity/${child.id}/history`)
        const data = await res.json() as any
        const history = data.history || []

        if (history.length === 0) continue

        const insertMany = db.transaction(() => {
          let count = 0
          for (const entry of history) {
            if (entry.waitTime === null || entry.waitTime === undefined) continue
            if (entry.status !== 'OPERATING' && entry.status !== 'OPEN') continue

            const time = new Date(entry.time)
            const { dayOfWeek, hour, minute } = parkTimeComponents(time)
            insert.run(
              parkId,
              child.id,
              child.name,
              entry.waitTime,
              entry.status,
              time.toISOString(),
              dayOfWeek,
              hour,
              minute,
            )
            count++
          }
          return count
        })

        const count = insertMany()
        if (count > 0) {
          totalInserted += count
          console.log(`[backfill]   ${child.name}: +${count} entries`)
        }
      } catch (err: any) {
        console.error(`[backfill]   ${child.name}: error - ${err.message}`)
      }
    }

    // Extra pause between parks
    await sleep(500)
  }

  console.log(`[backfill] Done. Inserted ${totalInserted} new observations.`)
  return totalInserted
}
