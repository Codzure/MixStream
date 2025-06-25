import React, { useState, useRef } from 'react';
import { X, Upload, Music, Video, Sparkles, Cloud, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, uploadFile, checkStorageBucket } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { UploadProgress as UploadProgressType } from '../../types';
import { UploadProgress } from './UploadProgress';
import toast from 'react-hot-toast';

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: () => void
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onUploadComplete,
}) => {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressType>({
    progress: 0,
    status: 'idle',
  });
  // Remove unused state variables
  const uploadStartTime = useRef(0);
  const lastUploadedSize = useRef(0);
  const speedInterval = useRef<NodeJS.Timeout>();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Check file size (2GB limit)
      if (file.size > 2 * 1024 * 1024 * 1024) {
        toast.error('File size must be less than 2GB')
        return
      }

      // Check file type
      const isAudio = file.type.startsWith('audio/')
      const isVideo = file.type.startsWith('video/')
      
      if (!isAudio && !isVideo) {
        toast.error('Please select an audio or video file')
        return
      }

      // Additional file type validation
      const allowedAudioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mp3']
      const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/webm', 'video/quicktime']
      
      if (isAudio && !allowedAudioTypes.some(type => file.type === type || file.name.toLowerCase().endsWith(type.split('/')[1]))) {
        toast.error('Unsupported audio format. Please use MP3, WAV, FLAC, or AAC.')
        return
      }
      
      if (isVideo && !allowedVideoTypes.some(type => file.type === type || file.name.toLowerCase().includes(type.split('/')[1]))) {
        toast.error('Unsupported video format. Please use MP4, MOV, AVI, or WebM.')
        return
      }

      setSelectedFile(file);
      // Set default title from filename (without extension)
      const fileName = file.name.replace(/\.[^/.]+$/, '');
      setTitle(fileName);
      
      toast.success(`${isAudio ? 'Audio' : 'Video'} file selected: ${file.name}`)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) {
      const event = { 
        target: { 
          files: [file] 
        },
        preventDefault: () => {},
        stopPropagation: () => {},
        nativeEvent: e.nativeEvent,
        currentTarget: e.currentTarget as HTMLInputElement,
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        defaultPrevented: e.defaultPrevented,
        eventPhase: e.eventPhase,
        isTrusted: e.isTrusted,
        timeStamp: e.timeStamp,
        type: e.type,
        isDefaultPrevented: () => e.isDefaultPrevented(),
        isPropagationStopped: () => e.isPropagationStopped(),
        persist: () => {}
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileSelect(event)
    }
  }

  // Simplified speed tracking
  const startSpeedTracking = () => {
    uploadStartTime.current = Date.now();
    lastUploadedSize.current = 0;
    
    if (speedInterval.current) {
      clearInterval(speedInterval.current);
    }
  };

  const stopSpeedTracking = () => {
    if (speedInterval.current) {
      clearInterval(speedInterval.current);
      speedInterval.current = undefined;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user || !title.trim()) {
      toast.error('Please fill in all required fields')
      setUploadProgress({ 
        progress: 0, 
        status: 'error', 
        error: 'Please fill in all required fields' 
      });
      stopSpeedTracking();
      return;
    }

    setUploadProgress({ progress: 0, status: 'uploading' });
    startSpeedTracking();

    try {
      const bucketAccessible = await checkStorageBucket()
      if (!bucketAccessible) {
        const errorMessage = (
          'Storage bucket not properly configured.\n\n' +
          'Please follow these steps:\n' +
          '1. Go to your Supabase dashboard\n' +
          '2. Navigate to Storage\n' +
          '3. Click "New Bucket"\n' +
          '4. Name it "music-mixes"\n' +
          '5. Set it to public\n' +
          '6. Try uploading again'
        )
        
        toast.error(
          <div className="whitespace-pre-line">{errorMessage}</div>,
          { duration: 10000 }
        )
        setUploadProgress({ progress: 0, status: 'error' });
        return
      }

      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase()
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 15)
      const fileName = `${timestamp}-${randomId}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      console.log('Starting upload:', { 
        fileName, 
        filePath, 
        fileSize: selectedFile.size,
        fileType: selectedFile.type
      })

      await uploadFile(selectedFile, filePath, (progress) => {
        setUploadProgress({
          progress: Math.min(progress, 95), 
          status: 'uploading'
        });
      })
      
      setUploadProgress({ progress: 100, status: 'success' })

      let duration: number | undefined
      try {
        duration = await getMediaDuration(selectedFile)
        console.log('Media duration:', duration)
      } catch (error) {
        console.warn('Could not get media duration:', error)
      }

      const mixData = {
        title: title.trim(),
        description: description.trim() || null,
        file_path: filePath,
        file_size: selectedFile.size,
        file_type: selectedFile.type.startsWith('audio/') ? 'audio' as const : 'video' as const,
        mime_type: selectedFile.type,
        duration: duration,
        user_id: user.id,
        is_public: isPublic,
      }

      console.log('Creating database record:', mixData)

      const { error: dbError } = await supabase
        .from('music_mixes')
        .insert(mixData)

      if (dbError) {
        console.error('Database error:', dbError)
        throw new Error(`Database error: ${dbError.message}`)
      }

      stopSpeedTracking();
      
      toast.success('Mix uploaded successfully!')
      
      setTimeout(() => {
        resetForm()
        onUploadComplete()
        onClose()
      }, 1500)
      
    } catch (error) {
      console.error('Upload error:', error)
      
      let errorMessage = 'Upload failed'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      
      setUploadProgress({ 
        progress: 0, 
        status: 'error', 
        error: errorMessage
      })
      
      toast.error(`Upload failed: ${errorMessage}`)
    }
  }

  const getMediaDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const media = file.type.startsWith('video/') 
        ? document.createElement('video')
        : document.createElement('audio')
      
      const cleanup = () => {
        URL.revokeObjectURL(url)
        media.remove()
      }
      
      media.onloadedmetadata = () => {
        const duration = Math.floor(media.duration)
        cleanup()
        resolve(duration)
      }
      
      media.onerror = () => {
        cleanup()
        reject(new Error('Could not load media'))
      }
      
      setTimeout(() => {
        cleanup()
        reject(new Error('Timeout loading media'))
      }, 10000)
      
      media.src = url
      media.load()
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const resetForm = () => {
    setSelectedFile(null)
    setTitle('')
    setDescription('')
    setIsPublic(true)
    setUploadProgress({ progress: 0, status: 'idle' })
  }

  const handleRetry = () => {
    setUploadProgress({ progress: 0, status: 'idle' });
  };
  
  const handleCancel = () => {
    // TODO: Implement cancel upload functionality
    setUploadProgress({ progress: 0, status: 'idle' });
    toast('Upload cancelled');
  };

  const isUploading = uploadProgress.status === 'uploading'

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={isUploading ? undefined : onClose}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative floating-card max-w-2xl w-full mx-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-8 border-b border-white/10">
                <div className="flex items-center space-x-3">
                  <div className="gradient-primary p-3 rounded-2xl">
                    <Upload className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">Upload Your Mix</h3>
                    <p className="text-white/60">Share your creation with the world</p>
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={isUploading ? undefined : onClose}
                  disabled={isUploading}
                  className="glass glass-hover p-3 rounded-xl text-white/60 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="h-6 w-6" />
                </motion.button>
              </div>

              <div className="p-8 space-y-8">
                {/* File Upload Area */}
                {!selectedFile ? (
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-white/20 rounded-2xl p-12 text-center cursor-pointer hover:border-purple-500/50 transition-all duration-300 glass-hover"
                  >
                    <div className="space-y-6">
                      <motion.div
                        animate={{ y: [0, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="gradient-accent p-6 rounded-3xl inline-block"
                      >
                        <Cloud className="h-16 w-16 text-white" />
                      </motion.div>
                      <div>
                        <h4 className="text-xl font-semibold text-white mb-2">
                          Drop your mix here or click to browse
                        </h4>
                        <p className="text-white/60 mb-4">
                          Support for audio and video files up to 2GB
                        </p>
                        <div className="flex items-center justify-center space-x-4 text-sm text-white/50">
                          <span className="flex items-center space-x-1">
                            <Music className="h-4 w-4" />
                            <span>MP3, WAV, FLAC, AAC</span>
                          </span>
                          <span>•</span>
                          <span className="flex items-center space-x-1">
                            <Video className="h-4 w-4" />
                            <span>MP4, MOV, AVI, WebM</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass rounded-2xl p-6"
                  >
                    <div className="flex items-center space-x-4">
                      <div className={`p-4 rounded-2xl ${
                        selectedFile.type.startsWith('video/') 
                          ? 'gradient-secondary' 
                          : 'gradient-primary'
                      }`}>
                        {selectedFile.type.startsWith('video/') ? (
                          <Video className="h-8 w-8 text-white" />
                        ) : (
                          <Music className="h-8 w-8 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-semibold text-white truncate">
                          {selectedFile.name}
                        </p>
                        <p className="text-white/60">
                          {formatFileSize(selectedFile.size)} • {selectedFile.type.split('/')[1].toUpperCase()}
                        </p>
                      </div>
                      {!isUploading && (
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            setSelectedFile(null)
                            setTitle('')
                          }}
                          className="text-white/60 hover:text-red-400 p-2 rounded-lg transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Select audio or video file to upload"
                />

                {/* Form Fields */}
                {selectedFile && (
                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-white/80 mb-3">
                        Title *
                      </label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input-glass w-full py-4 text-lg"
                        placeholder="Give your mix an awesome title"
                        disabled={isUploading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-white/80 mb-3">
                        Description
                      </label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={4}
                        className="input-glass w-full py-4 text-lg resize-none"
                        placeholder="Tell us about your mix, the vibe, the story..."
                        disabled={isUploading}
                      />
                    </div>

                    <div className="flex items-center justify-between glass rounded-2xl p-6">
                      <div className="flex items-center space-x-3">
                        <Sparkles className="h-6 w-6 text-yellow-400" />
                        <div>
                          <h4 className="font-semibold text-white">Make it public</h4>
                          <p className="text-sm text-white/60">Let everyone discover your mix</p>
                        </div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setIsPublic(!isPublic)}
                        disabled={isUploading}
                        className={`relative w-16 h-8 rounded-full transition-colors disabled:opacity-50 ${
                          isPublic ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-white/20'
                        }`}
                      >
                        <motion.div
                          animate={{ x: isPublic ? 32 : 4 }}
                          className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
                        />
                      </motion.button>
                    </div>
                  </div>
                )}

                {/* Upload Progress */}
                {uploadProgress.status !== 'idle' && selectedFile && (
                  <div className="mt-4">
                    <UploadProgress
                      progress={uploadProgress.progress}
                      status={uploadProgress.status}
                      fileName={selectedFile.name}
                      fileSize={selectedFile.size}
                      onRetry={handleUpload}
                      onCancel={handleCancel}
                    />
                    
                    {uploadProgress.status === 'success' && (
                      <div className="mt-4 flex items-center justify-center space-x-3 text-green-400">
                        <CheckCircle className="h-6 w-6" />
                        <span className="font-medium">Upload complete!</span>
                      </div>
                    )}

                    {uploadProgress.status === 'error' && (
                      <div className="mt-4 space-y-4">
                        <div className="flex items-start space-x-3 text-red-400 glass rounded-xl p-4">
                          <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium mb-1">Upload Failed</p>
                            <p className="text-sm text-red-300">{uploadProgress.error || 'An unknown error occurred'}</p>
                          </div>
                        </div>
                        <div className="flex space-x-3">
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleRetry}
                            className="btn-secondary flex-1 flex items-center justify-center space-x-2"
                          >
                            <RefreshCw className="h-4 w-4" />
                            <span>Try Again</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={resetForm}
                            className="btn-secondary flex-1"
                          >
                            Start Over
                          </motion.button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end space-x-4 p-8 border-t border-white/10">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onClose}
                  disabled={isUploading}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? 'Uploading...' : 'Cancel'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleUpload}
                  disabled={!selectedFile || !title.trim() || isUploading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadProgress.status === 'uploading' ? 'Uploading...' : 'Upload Mix'}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}