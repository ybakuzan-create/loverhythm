export type StatKey = 'looks' | 'cleanliness' | 'talk'
export type ActionType = 'self' | 'meet' | 'rest'

export interface PlayerStats {
  looks: number
  cleanliness: number
  talk: number
}

export interface Woman {
  id: string
  name: string
  affinity: 0 | 1 | 2 | 3 | 4
}

export interface GameState {
  day: number
  points: number
  stats: PlayerStats
  women: Woman[]
  gameStatus: 'playing' | 'clear' | 'gameover'
  gameOverReason?: string
  bifurcationSuccesses: number
}
