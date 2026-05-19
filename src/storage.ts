import type { GameState } from './types'

export const PASSWORD_KEY = 'loverhythm_auth'
export const SAVE_KEY = 'loverhythm_save'

export const isAuthorized = () => localStorage.getItem(PASSWORD_KEY) === 'true'
export const setAuthorized = () => localStorage.setItem(PASSWORD_KEY, 'true')

export const saveGame = (state: GameState) => localStorage.setItem(SAVE_KEY, JSON.stringify(state))
export const loadGame = (): GameState | null => {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as GameState
  } catch {
    return null
  }
}
