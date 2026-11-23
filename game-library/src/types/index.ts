export type GameStatus = 'want_to_play' | 'playing' | 'completed' | 'dropped'

export const GAME_STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: 'want_to_play', label: '想玩' },
  { value: 'playing', label: '在玩' },
  { value: 'completed', label: '已通关' },
  { value: 'dropped', label: '搁置' }
]

export type GameReleaseStatus = 'released' | 'upcoming' | 'cancelled'

export interface Game {
  _id?: string
  rawg_id?: number
  igdb_id?: number
  slug?: string
  name: string
  summary?: string
  first_release_date?: number
  genres?: string[]
  platforms?: string[]
  developers?: string[]
  publishers?: string[]
  metacritic_score?: number
  rating?: number
  cover_file_id?: string
  screenshot_file_ids?: string[]
  tags?: string[]
  status?: GameReleaseStatus
  source_updated_at?: number
  created_at?: number
  updated_at?: number
}

export interface UserGame {
  _id?: string
  _openid?: string
  game_id: string
  status: GameStatus
  rating?: number
  play_hours?: number
  notes?: string
  screenshot_file_ids?: string[]
  added_at?: number
  updated_at?: number
}

export interface Banner {
  _id?: string
  type: string
  title?: string
  image_file_id: string
  link_type?: string
  link_value?: string
  weight?: number
  is_active?: boolean
}

export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

export const ErrorCode = {
  SUCCESS: 0,
  PARAM_INVALID: 40001,
  NOT_LOGIN: 40101,
  PERMISSION_DENIED: 40301,
  RATE_LIMITED: 42901,
  UPSTREAM_FAIL: 50001,
  DEGRADED: 50002,
  NOT_IMPLEMENTED: 50099
} as const
