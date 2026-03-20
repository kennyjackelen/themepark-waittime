import type { GuestRating } from './types'

// Keyed by lowercased ride name substring for fuzzy matching against API names
const RATINGS: { pattern: string; ratings: GuestRating[] }[] = [
  // Epic Universe
  { pattern: 'curse of the werewolf', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'monsters unchained', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'battle at the ministry', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }, { guest: 'Mom', rating: 3 }] },
  { pattern: 'dragon racer\'s', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 1 }] },
  { pattern: 'wing glider', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'viking training', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'constellation carousel', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'stardust racers', ratings: [{ guest: 'Amy', rating: 3 }] },
  { pattern: 'mario kart', ratings: [{ guest: 'Max', rating: 3 }, { guest: 'Amy', rating: 3 }] },
  { pattern: 'yoshi', ratings: [{ guest: 'Max', rating: 3 }, { guest: 'Amy', rating: 3 }] },
  { pattern: 'mine-cart madness', ratings: [{ guest: 'Max', rating: 3 }, { guest: 'Amy', rating: 3 }] },

  // Universal Studios Florida
  { pattern: 'minion mayhem', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'minion blast', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'transformers', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'race through new york', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 1 }] },
  { pattern: 'mummy', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'fast & furious', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'hogwarts', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }, { guest: 'Mom', rating: 3 }] },
  { pattern: 'gringotts', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'men in black', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 1 }] },
  { pattern: 'simpsons', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }, { guest: 'Dad', rating: 3 }] },
  { pattern: 'twirl', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'shrek', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'trollercoaster', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'kung fu panda', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'animal actors', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'e.t.', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'bourne', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 1 }] },

  // Islands of Adventure
  { pattern: 'hulk', ratings: [{ guest: 'Amy', rating: 3 }] },
  { pattern: 'accelatron', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'doctor doom', ratings: [{ guest: 'Amy', rating: 3 }] },
  { pattern: 'spider-man', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'dudley do-right', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'bilge-rat', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'kong', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'jurassic park river', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'pteranodon', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'camp jurassic', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'velocicoaster', ratings: [{ guest: 'Amy', rating: 3 }] },
  { pattern: 'forbidden journey', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'hippogriff', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'motorbike', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'cat in the hat', ratings: [{ guest: 'Amy', rating: 1 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'one fish, two fish', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'caro-seuss-el', ratings: [{ guest: 'Amy', rating: 2 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'ohno', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },

  // Volcano Bay
  { pattern: 'maku puihi', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'taniwha', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'ika moana', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
  { pattern: 'body plunge', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'body slides', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 2 }] },
  { pattern: 'krakatau', ratings: [{ guest: 'Amy', rating: 3 }, { guest: 'Max', rating: 3 }] },
]

const RIDE_TAGS: { pattern: string; tags: string[] }[] = [
  { pattern: 'bilge-rat', tags: ['SOAKED'] },
  { pattern: 'dudley do-right', tags: ['SOAKED'] },
  { pattern: 'jurassic park river', tags: ['SOAKED'] },
]

export function getRideRatings(rideName: string): GuestRating[] {
  const lower = rideName.toLowerCase()
  const match = RATINGS.find((r) => lower.includes(r.pattern))
  return match?.ratings ?? []
}

export function getRideTags(rideName: string): string[] {
  const lower = rideName.toLowerCase()
  const match = RIDE_TAGS.find((r) => lower.includes(r.pattern))
  return match?.tags ?? []
}
