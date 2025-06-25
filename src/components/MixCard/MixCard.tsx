import React from 'react'
import { Play, Clock, Eye, Music, Video, Heart, Share2, MoreHorizontal } from 'lucide-react'
import { motion } from 'framer-motion'
import { MusicMix } from '../../types'

interface MixCardProps {
  mix: MusicMix
  onPlay: (mix: MusicMix) => void
}

export const MixCard: React.FC<MixCardProps> = ({ mix, onPlay }) => {
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      className="floating-card group cursor-pointer card-hover overflow-hidden"
    >
      <div className="relative">
        {/* Cover Art */}
        <div className={`h-56 relative overflow-hidden rounded-xl ${
          mix.file_type === 'video' 
            ? 'bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-700' 
            : 'bg-gradient-to-br from-purple-500 via-blue-600 to-teal-600'
        }`}>
          <div className="absolute inset-0 flex items-center justify-center">
            {mix.file_type === 'video' ? (
              <Video className="h-16 w-16 text-white/80" />
            ) : (
              <Music className="h-16 w-16 text-white/80" />
            )}
          </div>
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          
          {/* Play button overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onPlay(mix)}
              className="bg-white/20 backdrop-blur-md hover:bg-white/30 text-white p-4 rounded-full shadow-2xl border border-white/20"
            >
              <Play className="h-8 w-8 ml-1" />
            </motion.button>
          </div>

          {/* Type badge */}
          <div className="absolute top-4 left-4">
            <span className={`px-3 py-1 text-xs font-bold rounded-full text-white shadow-lg ${
              mix.file_type === 'video' 
                ? 'bg-gradient-to-r from-pink-500 to-red-500' 
                : 'bg-gradient-to-r from-purple-500 to-blue-500'
            }`}>
              {mix.file_type.toUpperCase()}
            </span>
          </div>

          {/* Action buttons */}
          <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="glass p-2 rounded-lg text-white/80 hover:text-red-400"
            >
              <Heart className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="glass p-2 rounded-lg text-white/80 hover:text-blue-400"
            >
              <Share2 className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="glass p-2 rounded-lg text-white/80 hover:text-white"
            >
              <MoreHorizontal className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-bold text-white text-lg mb-2 line-clamp-2 group-hover:text-gradient transition-all">
            {mix.title}
          </h3>
          
          {mix.description && (
            <p className="text-white/70 text-sm mb-4 line-clamp-2">
              {mix.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-white/60 mb-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Eye className="h-3 w-3" />
                <span>{mix.play_count.toLocaleString()}</span>
              </div>
              {mix.duration && (
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(mix.duration)}</span>
                </div>
              )}
            </div>
            <span className="text-white/50">{formatFileSize(mix.file_size)}</span>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-white/50">
                {formatDate(mix.created_at)}
              </span>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onPlay(mix)}
              className="btn-primary px-4 py-2 text-sm"
            >
              Play Now
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  )
}