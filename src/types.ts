export interface PlayerStats {
  looks: number
  cleanliness: number
  talk: number
}

export type Affinity = 0 | 1 | 2 | 3 | 4

export interface Girl {
  id: string
  name: string
  affinity: Affinity
  affinityExp: number
  image: string
  comment: string
  discovered: boolean
}

export interface EventLog {
  day: number
  text: string
  affinityLabel?: string
}

export interface GameState {
  day: number
  points: number
  stats: PlayerStats
  girls: Girl[]
  gameStatus: 'playing' | 'clear' | 'gameover'
  gameOverReason?: string
  bifurcationSuccesses: number
  logs: EventLog[]
}
