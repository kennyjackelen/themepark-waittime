import { backfillFromApi } from '../utils/backfill'

export default defineEventHandler(async () => {
  const inserted = await backfillFromApi()
  return { status: 'ok', inserted }
})
