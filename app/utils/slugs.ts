// Bidirectional mapping between park UUIDs and readable slugs
const PARK_SLUGS: Record<string, string> = {
  // Walt Disney World
  '75ea578a-adc8-4116-a54d-dccb60765ef9': 'magic-kingdom',
  '47f90d2c-e191-4239-a466-5892ef59a88b': 'epcot',
  '288747d1-8b4f-4a64-867e-ea7c9b27bad8': 'hollywood-studios',
  '1c84a229-8862-4648-9c71-378ddd2c7693': 'animal-kingdom',
  'b070cbc5-feaa-4b87-a8c1-f94cca037a18': 'typhoon-lagoon',
  'ead53ea5-22e5-4095-9a83-8c29300d7c63': 'blizzard-beach',
  // Universal Orlando
  'fe78a026-b91b-470c-b906-9d2266b692da': 'volcano-bay',
  '267615cc-8943-4c2a-ae2c-5da728ca591f': 'islands-of-adventure',
  'eb3f4560-2383-4a36-9152-6b3e5ed6bc57': 'universal-studios',
  '12dbb85b-265f-44e6-bccf-f1faa17211fc': 'epic-universe',
}

// Reverse map: slug -> UUID
const SLUG_TO_ID: Record<string, string> = Object.fromEntries(
  Object.entries(PARK_SLUGS).map(([id, slug]) => [slug, id])
)

export function parkIdToSlug(id: string): string {
  return PARK_SLUGS[id] || id
}

export function slugToParkId(slug: string): string {
  return SLUG_TO_ID[slug] || slug
}

export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
