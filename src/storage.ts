import type { Affinity, GameState, Girl, PlayerStats } from './types'

export const PASSWORD_KEY = 'loverhythm_auth'
export const SAVE_KEY = 'loverhythm_save'

const GIRL_MASTER = [
  { id: 'akari', name: 'あかり', image: '/images/girls/akari.png', comment: '一緒にいると落ち着くね。' },
  { id: 'misaki', name: 'みさき', image: '/images/girls/misaki.png', comment: '次はどこに行く？' },
  { id: 'yui', name: 'ゆい', image: '/images/girls/yui.png', comment: 'もっとあなたを知りたいな。' },
  { id: 'kotone', name: 'ことね', image: '/images/girls/kotone.png', comment: '今日は良い日になりそう。' }
]

const LEGACY_ID_MAP: Record<string, string> = { 'girl-0': 'akari', 'girl-1': 'misaki', 'girl-2': 'yui', 'girl-3': 'kotone' }
const AFFINITY_THRESHOLDS = [0, 30, 70, 120, 180]

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.floor(n)))
}

const affinityFromExp = (exp: number): Affinity => {
  if (exp >= AFFINITY_THRESHOLDS[4]) return 4
  if (exp >= AFFINITY_THRESHOLDS[3]) return 3
  if (exp >= AFFINITY_THRESHOLDS[2]) return 2
  if (exp >= AFFINITY_THRESHOLDS[1]) return 1
  return 0
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
    const raw = (input.find((g) => {
      if (typeof g !== 'object' || g === null) return false
      const id = (g as Record<string, unknown>).id
      return id === master.id || id === `girl-${i}`
    }) ?? input[i] ?? {}) as Record<string, unknown>
    const legacyAffinity = clamp(raw.affinity, 0, 4, 0) as Affinity
    const affinityExp = Math.max(clamp(raw.affinityExp, 0, 9999, AFFINITY_THRESHOLDS[legacyAffinity]), AFFINITY_THRESHOLDS[legacyAffinity])
    const affinity = affinityFromExp(affinityExp)
    const rawId = typeof raw.id === 'string' ? raw.id : ''
    return {
      id: LEGACY_ID_MAP[rawId] ?? master.id,
      name: typeof raw.name === 'string' ? raw.name : master.name,
      image: typeof raw.image === 'string' ? raw.image : master.image,
      comment: typeof raw.comment === 'string' ? raw.comment : master.comment,
      discovered: Boolean(raw.discovered),
      affinity,
      affinityExp
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
      }).slice(0, 12)
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
