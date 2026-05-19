import type { Affinity, GameState, Girl, PlayerStats } from './types'

export const PASSWORD_KEY = 'loverhythm_auth'
export const SAVE_KEY = 'loverhythm_save'

const GIRL_MASTER = [
  { name: 'あかり', image: '/images/girls/akari.webp', comment: '一緒にいると落ち着くね。' },
  { name: 'みさき', image: '/images/girls/misaki.webp', comment: '次はどこに行く？' },
  { name: 'ゆい', image: '/images/girls/yui.webp', comment: 'もっとあなたを知りたいな。' },
  { name: 'ことね', image: '/images/girls/kotone.webp', comment: '今日は良い日になりそう。' }
]

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

const migrateStats = (raw: unknown): PlayerStats => {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  return {
    looks: clamp(s.looks, 1, 10, 3),
    cleanliness: clamp(s.cleanliness, 1, 10, 3),
    talk: clamp(s.talk, 1, 10, 3)
  }
}

const migrateGirls = (rawGirls: unknown): Girl[] => {
  const input = Array.isArray(rawGirls) ? rawGirls : []
  return GIRL_MASTER.map((master, i) => {
    const g = (input[i] ?? {}) as Record<string, unknown>
    const affinity = clamp(g.affinity, 0, 4, 0) as Affinity
    return {
      id: typeof g.id === 'string' ? g.id : `girl-${i}`,
      name: typeof g.name === 'string' ? g.name : master.name,
      image: typeof g.image === 'string' ? g.image : master.image,
      comment: typeof g.comment === 'string' ? g.comment : master.comment,
      discovered: Boolean(g.discovered),
      affinity
    }
  })
}

const migrateSave = (raw: unknown): GameState | null => {
  if (typeof raw !== 'object' || raw === null) return null
  const data = raw as Record<string, unknown>
  const girls = migrateGirls(data.girls)
  const logs = Array.isArray(data.logs)
    ? data.logs.filter((l): l is { day: number; text: string; affinityLabel?: string } => {
        if (typeof l !== 'object' || l === null) return false
        const r = l as Record<string, unknown>
        return typeof r.day === 'number' && typeof r.text === 'string'
      }).slice(0, 6)
    : []

  const status = data.gameStatus === 'clear' || data.gameStatus === 'gameover' ? data.gameStatus : 'playing'

  return {
    day: clamp(data.day, 1, 99, 1),
    points: Math.max(0, clamp(data.points, 0, 999999, 24)),
    stats: migrateStats(data.stats),
    girls,
    gameStatus: status,
    gameOverReason: typeof data.gameOverReason === 'string' ? data.gameOverReason : undefined,
    bifurcationSuccesses: Math.max(0, clamp(data.bifurcationSuccesses, 0, 999, 0)),
    logs
  }
}

export const isAuthorized = () => localStorage.getItem(PASSWORD_KEY) === 'true'
export const setAuthorized = () => localStorage.setItem(PASSWORD_KEY, 'true')

export const saveGame = (state: GameState) => localStorage.setItem(SAVE_KEY, JSON.stringify(state))
export const loadGame = (): GameState | null => {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    const migrated = migrateSave(JSON.parse(raw))
    if (migrated) saveGame(migrated)
    return migrated
  } catch {
    return null
  }
}
