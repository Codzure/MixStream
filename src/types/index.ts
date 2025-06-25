export interface MusicMix {
  id: string
  title: string
  artist?: string
  description?: string
  file_path: string
  file_size: number
  file_type: 'audio' | 'video'
  mime_type: string
  duration: number
  thumbnail_url?: string
  coverUrl?: string
  audioUrl?: string
  created_at: string
  updated_at: string
  user_id: string
  is_public: boolean
  play_count: number
}

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
}

export interface UploadProgress {
  progress: number
  status: 'idle' | 'uploading' | 'success' | 'error'
  error?: string
}