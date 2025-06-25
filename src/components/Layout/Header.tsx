import React from 'react'
import { Music, User, LogOut, Upload, Search, Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { motion } from 'framer-motion'

interface HeaderProps {
  onUploadClick: () => void
}

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
  const { user, signOut } = useAuth()

  return (
    <motion.header 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="glass sticky top-0 z-50 border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <motion.div 
            className="flex items-center space-x-3"
            whileHover={{ scale: 1.05 }}
          >
            <div className="gradient-primary p-3 rounded-2xl shadow-glow">
              <Music className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient">
                MixStream
              </h1>
              <p className="text-xs text-white/60">Premium Mix Platform</p>
            </div>
          </motion.div>

          {/* Search Bar - Hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-8">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/60" />
              <input
                type="text"
                placeholder="Search mixes, artists, or genres..."
                className="input-glass w-full pl-12 pr-4 py-4 text-lg"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            {/* Upload Button - Only visible for specific user */}
            {user?.email === 'leonard.mutugi.m@gmail.com' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onUploadClick}
                className="btn-primary flex items-center space-x-2"
              >
                <Upload className="h-5 w-5" />
                <span className="hidden sm:inline">Upload</span>
              </motion.button>
            )}

            {/* Notifications */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="glass glass-hover p-3 rounded-xl relative"
            >
              <Bell className="h-5 w-5 text-white/80" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-pink-500 to-red-500 rounded-full animate-pulse" />
            </motion.button>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="glass p-3 rounded-xl">
                <User className="h-6 w-6 text-white/80" />
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-medium text-white">
                  {user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                </p>
                <p className="text-xs text-white/60">Pro Creator</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={signOut}
                className="glass glass-hover p-3 rounded-xl text-white/80 hover:text-red-400 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.header>
  )
}