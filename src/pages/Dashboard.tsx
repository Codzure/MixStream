import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, Grid, List, TrendingUp, Clock, Siren as Fire, Sparkles } from 'lucide-react';
import { Header } from '../components/Layout/Header';
import { UploadModal } from '../components/Upload/UploadModal';
import styles from './Dashboard.module.css';
import { MixCard } from '../components/MixCard/MixCard'
import { MediaPlayer } from '../components/Player/MediaPlayer'
import { supabase, getStreamingUrl, testDatabaseConnection } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MusicMix } from '../types'
import toast from 'react-hot-toast'

export const Dashboard: React.FC = () => {
  const { user } = useAuth()
  const [mixes, setMixes] = useState<MusicMix[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'trending'>('recent')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [selectedMix, setSelectedMix] = useState<MusicMix | null>(null)
  const [streamingUrl, setStreamingUrl] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      initializeDashboard()
    }
  }, [user, sortBy])

  const initializeDashboard = async () => {
    try {
      // Test database connection first
      const dbConnected = await testDatabaseConnection()
      if (!dbConnected) {
        throw new Error('Database connection failed')
      }
      
      await fetchMixes()
    } catch (error) {
      console.error('Dashboard initialization error:', error)
      toast.error('Failed to initialize dashboard')
    }
  }

  const fetchMixes = async () => {
    if (!user) return
    
    try {
      setLoading(true)
      
      // Build the base query
      let query = supabase
        .from('music_mixes')
        .select('*')
        
      // Apply filters
      if (filterType !== 'all') {
        query = query.eq('file_type', filterType)
      }
      
      // Apply search term if provided
      if (searchTerm.trim()) {
        query = query.textSearch('title', searchTerm, {
          type: 'websearch',
          config: 'english'
        })
      }
      
      // Apply visibility filter
      query = query.or(`user_id.eq.${user.id},is_public.eq.true`)
      
      // Apply sorting
      switch (sortBy) {
        case 'popular':
          query = query.order('play_count', { ascending: false })
          break
        case 'trending':
          // For trending, we might want to consider recent plays/likes
          query = query.order('play_count', { ascending: false })
                  .order('created_at', { ascending: false })
                  .limit(50)
          break
        default:
          query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query

      if (error) {
        console.error('Fetch mixes error:', error)
        throw error
      }
      
      console.log('Fetched mixes:', data)
      setMixes(data || [])
    } catch (error) {
      console.error('Error fetching mixes:', error)
      toast.error('Failed to load mixes')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayMix = async (mix: MusicMix) => {
    try {
      const url = await getStreamingUrl(mix.file_path)
      if (url) {
        setSelectedMix(mix)
        setStreamingUrl(url)
        
        // Update play count
        const { error } = await supabase
          .from('music_mixes')
          .update({ play_count: mix.play_count + 1 })
          .eq('id', mix.id)
        
        if (error) {
          console.warn('Failed to update play count:', error)
        } else {
          // Update local state
          setMixes(prev => prev.map(m => 
            m.id === mix.id ? { ...m, play_count: m.play_count + 1 } : m
          ))
        }
      }
    } catch (error) {
      console.error('Error getting streaming URL:', error)
      toast.error('Failed to load mix')
    }
  }

  const filteredMixes = mixes.filter(mix => {
    const matchesSearch = mix.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         mix.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesFilter = filterType === 'all' || mix.file_type === filterType
    return matchesSearch && matchesFilter
  })

  const getSortIcon = (sort: string) => {
    switch (sort) {
      case 'popular': return <Fire className="h-4 w-4" />
      case 'trending': return <TrendingUp className="h-4 w-4" />
      default: return <Clock className="h-4 w-4" />
    }
  }

  const getSortLabel = (sort: string) => {
    switch (sort) {
      case 'popular': return 'Most Played'
      case 'trending': return 'Trending'
      default: return 'Recent'
    }
  }

  // Particle background component
  const ParticleBackground = () => {
    const getParticleSizeClass = (index: number) => {
      const size = index % 3;
      return [
        styles.particleSmall,
        styles.particleMedium,
        styles.particleLarge
      ][size];
    };

    const getAnimationDelayClass = (index: number) => {
      const delay = index % 5;
      return [
        styles.delay1,
        styles.delay2,
        styles.delay3,
        styles.delay4,
        styles.delay5
      ][delay];
    };

    const getAnimationDurationClass = (index: number) => {
      const duration = index % 3;
      return [
        styles.duration1,
        styles.duration2,
        styles.duration3
      ][duration];
    };

    return (
      <div className={styles.particles}>
        {[...Array(15)].map((_, i) => {
          const positionClass = styles[`particle${i}`];
          const sizeClass = getParticleSizeClass(i);
          const delayClass = getAnimationDelayClass(i);
          const durationClass = getAnimationDurationClass(i);
          
          return (
            <div
              key={i}
              className={`${styles.particle} ${positionClass} ${sizeClass} ${delayClass} ${durationClass}`}
            />
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <ParticleBackground />
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="gradient-primary p-4 rounded-3xl inline-block mb-6"
          >
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent" />
          </motion.div>
          <p className="text-white/70 text-lg">Loading your premium mixes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 relative overflow-hidden">
      <ParticleBackground />
      
      {/* Background gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-pink-900/10" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/5 rounded-full blur-3xl" />
      
      <Header onUploadClick={() => setIsUploadModalOpen(true)} />
      
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Now Playing */}
        {selectedMix && streamingUrl && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center space-x-3 mb-6">
              <div className="gradient-primary p-2 rounded-xl">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Now Playing</h2>
            </div>
            <MediaPlayer mix={selectedMix} streamingUrl={streamingUrl} />
          </motion.div>
        )}

        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 space-y-6 lg:space-y-0">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h1 className="text-4xl font-bold text-gradient mb-2">
              Your Mix Library
            </h1>
            <p className="text-white/70 text-lg">
              {filteredMixes.length} premium {filteredMixes.length === 1 ? 'mix' : 'mixes'} ready to stream
            </p>
          </motion.div>

          {/* Controls */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-4 sm:space-y-0 sm:space-x-4"
          >
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/60" />
              <input
                type="text"
                placeholder="Search your mixes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-glass pl-12 pr-4 py-3 w-80"
              />
            </div>

            {/* Filters */}
            <div className="flex items-center space-x-3">
              <label htmlFor="filter-type" className="sr-only">Filter by type</label>
              <select
                id="filter-type"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'audio' | 'video')}
                className="input-glass px-4 py-3 pr-8"
                aria-label="Filter by media type"
              >
                <option value="all">All Types</option>
                <option value="audio">Audio Only</option>
                <option value="video">Video Only</option>
              </select>

              <label htmlFor="sort-by" className="sr-only">Sort by</label>
              <select
                id="sort-by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'trending')}
                className="input-glass px-4 py-3 pr-8"
                aria-label="Sort by"
              >
                <option value="recent">Recent</option>
                <option value="popular">Most Played</option>
                <option value="trending">Trending</option>
              </select>

              {/* View Toggle */}
              <div className="flex glass rounded-xl overflow-hidden">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('grid')}
                  className={`p-3 transition-all ${
                    viewMode === 'grid' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Grid className="h-5 w-5" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setViewMode('list')}
                  className={`p-3 transition-all ${
                    viewMode === 'list' 
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <List className="h-5 w-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Sort Indicator */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center space-x-2 mb-8"
        >
          <div className="flex items-center space-x-2 glass px-4 py-2 rounded-xl">
            {getSortIcon(sortBy)}
            <span className="text-white/80 text-sm font-medium">
              Sorted by {getSortLabel(sortBy)}
            </span>
          </div>
          {searchTerm && (
            <div className="flex items-center space-x-2 glass px-4 py-2 rounded-xl">
              <Search className="h-4 w-4 text-white/60" />
              <span className="text-white/80 text-sm">
                Results for "{searchTerm}"
              </span>
            </div>
          )}
        </motion.div>

        {/* Content */}
        {filteredMixes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="floating-card max-w-md mx-auto">
              <div className="gradient-primary p-6 rounded-3xl inline-block mb-6 animate-float">
                <Filter className="h-16 w-16 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">
                {searchTerm || filterType !== 'all' ? 'No matches found' : 'Your library awaits'}
              </h3>
              <p className="text-white/70 mb-8 text-lg">
                {searchTerm || filterType !== 'all' 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Upload your first premium mix to get started'
                }
              </p>
              {!searchTerm && filterType === 'all' && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsUploadModalOpen(true)}
                  className="btn-primary text-lg px-8 py-4"
                >
                  Upload Your First Mix
                </motion.button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`grid gap-8 ${
              viewMode === 'grid' 
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                : 'grid-cols-1 max-w-4xl mx-auto'
            }`}
          >
            {filteredMixes.map((mix, index) => (
              <motion.div
                key={mix.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <MixCard
                  mix={mix}
                  onPlay={handlePlayMix}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploadComplete={fetchMixes}
      />
    </div>
  )
}