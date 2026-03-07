import { startCollector } from '../utils/collector'
import { backfillFromApi } from '../utils/backfill'
import { getDb } from '../utils/db'

export default defineNitroPlugin(() => {
  // Run backfill on first startup if database is empty
  const db = getDb()
  const count = (db.prepare('SELECT COUNT(*) as c FROM wait_observations').get() as any).c
  if (count === 0) {
    console.log('[startup] Empty database, running initial backfill from API history...')
    backfillFromApi().catch((err) => {
      console.error('[startup] Backfill failed:', err.message)
    })
  }

  // Start the regular 5-minute polling
  startCollector()
})
