import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import styles from './MediaPlayer.module.css';

// Define the Mix interface
interface Mix {
  id: string;
  title: string;
  artist?: string;
  coverArt?: string;
  duration?: number;
}

interface MediaPlayerProps {
  mix: Mix;
  streamingUrl: string;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ mix, streamingUrl }) => {
  const { title, artist, coverArt } = mix;
  const mediaRef = useRef<HTMLMediaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const progressContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const volumeBeforeMute = useRef(0.8);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStreamingUrl, setCurrentStreamingUrl] = useState(streamingUrl);

  // Handle streaming URL changes
  useEffect(() => {
    if (streamingUrl && streamingUrl !== currentStreamingUrl) {
      setCurrentStreamingUrl(streamingUrl);
      
      // Reset media element when URL changes
      const media = mediaRef.current;
      if (media) {
        media.pause();
        media.load();
        
        // Reset state
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
      }
    }
  }, [streamingUrl, currentStreamingUrl]);

  // Initialize media element when component mounts or URL changes
  useEffect(() => {
    const media = mediaRef.current;
    if (!media) return;

    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };

    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load media. Please try again.');
    };

    media.addEventListener('canplay', handleCanPlay);
    media.addEventListener('error', handleError);

    return () => {
      media.removeEventListener('canplay', handleCanPlay);
      media.removeEventListener('error', handleError);
    };
  }, [currentStreamingUrl]);

  const formatTime = useCallback((timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }, []);

  const initAudioContext = useCallback(async () => {
    try {
      if (audioContextRef.current) {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        return audioContextRef.current;
      }

      const media = mediaRef.current;
      if (!media) return null;

      // Create audio context
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      // Create analyser node
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Create media element source
      const source = audioContext.createMediaElementSource(media);
      sourceNodeRef.current = source;

      // Create gain node for volume control
      const gain = audioContext.createGain();
      gain.gain.value = isMuted ? 0 : volume;
      gainNodeRef.current = gain;

      // Connect the audio graph
      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioContext.destination);

      // Initialize data array for visualizer
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);

      // Start visualization
      startVisualization();

      return audioContext;
    } catch (error) {
      console.error('Error initializing audio context:', error);
      setError('Failed to initialize audio. Please try again.');
      return null;
    }
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const media = mediaRef.current;
    if (!media) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const seekTime = pos * media.duration;

    media.currentTime = seekTime;
    setCurrentTime(seekTime);
  }, []);

  const togglePlayPause = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;
    
    try {
      if (media.paused) {
        setIsLoading(true);
        setError(null);
        
        // Initialize audio context first
        await initAudioContext();
        
        // For video elements, ensure they're visible and ready
        if (coverArt && media instanceof HTMLVideoElement) {
          media.playsInline = true;
          media.muted = false;
          media.preload = 'auto';
          media.load();
        }
        
        // Start playback
        await media.play();
        setIsPlaying(true);
        
        // If we have a video, ensure it's visible
        if (coverArt && media instanceof HTMLVideoElement) {
          media.style.opacity = '1';
        }
      } else {
        media.pause();
        setIsPlaying(false);
      }
    } catch (err) {
      console.error('Error toggling play/pause:', err);
      setError('Failed to play media. Please try again.');
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  }, [initAudioContext, coverArt]);

  const handleVolumeChange = useCallback((value: number) => {
    const newVolume = value;
    setVolume(newVolume);
    
    // Unmute if volume is increased while muted
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
    
    // Mute if volume is set to 0
    if (newVolume === 0) {
      setIsMuted(true);
    }
    
    // Update the audio context gain if it exists
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : newVolume;
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (!gainNodeRef.current) return;
    

    if (isMuted) {
      // Unmute
      const newVolume = volumeBeforeMute.current > 0 ? volumeBeforeMute.current : 0.8;
      setVolume(newVolume);
      gainNodeRef.current.gain.value = newVolume;
      setIsMuted(false);
    } else {
      // Mute
      volumeBeforeMute.current = volume;
      setVolume(0);
      gainNodeRef.current.gain.value = 0;
      setIsMuted(true);
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;

    setCurrentTime(media.currentTime);

    if (!duration || Math.abs(duration - (media.duration || 0)) > 0.1) {
      setDuration(media.duration || 0);
    }
  }, [duration]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleError = useCallback(() => {
    setError('Failed to play media');
    setIsLoading(false);
  }, []);

  const startVisualization = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current || !dataArrayRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    const bufferLength = analyser.frequencyBinCount;

    const renderFrame = () => {
      animationFrameRef.current = requestAnimationFrame(renderFrame);
      
      // Get frequency data
      analyser.getByteFrequencyData(dataArray);
      
      // Clear canvas with semi-transparent black for trail effect
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8; // Scale to canvas height
        
        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#6366f1'); // Indigo-500
        gradient.addColorStop(0.7, '#8b5cf6'); // Purple-500
        gradient.addColorStop(1, '#ec4899'); // Pink-500
        
        ctx.fillStyle = gradient;
        const barX = x + (barWidth / 2);
        const barY = canvas.height - barHeight;
        const barW = barWidth * 0.8; // Slightly narrower bars with spacing
        
        // Draw rounded rectangle for each bar
        const radius = 2;
        ctx.beginPath();
        ctx.moveTo(barX + radius, barY);
        ctx.lineTo(barX + barW - radius, barY);
        ctx.quadraticCurveTo(barX + barW, barY, barX + barW, barY + radius);
        ctx.lineTo(barX + barW, canvas.height - radius);
        ctx.quadraticCurveTo(barX + barW, canvas.height, barX + barW - radius, canvas.height);
        ctx.lineTo(barX + radius, canvas.height);
        ctx.quadraticCurveTo(barX, canvas.height, barX, canvas.height - radius);
        ctx.lineTo(barX, barY + radius);
        ctx.quadraticCurveTo(barX, barY, barX + radius, barY);
        ctx.closePath();
        ctx.fill();
        
        x += barWidth + 1;
      }
    };

    // Start the animation
    renderFrame();
  }, []);

  useEffect(() => {
    const media = mediaRef.current;

    // Add event listeners
    if (media) {
      media.addEventListener('timeupdate', handleTimeUpdate);
      media.addEventListener('ended', handleEnded);
      media.addEventListener('error', handleError);
      media.addEventListener('loadedmetadata', () => {
        if (media.duration) setDuration(media.duration);
      });
      media.addEventListener('play', () => setIsPlaying(true));
      media.addEventListener('pause', () => setIsPlaying(false));
    }

    return () => {
      // Remove event listeners
      if (media) {
        media.removeEventListener('timeupdate', handleTimeUpdate);
        media.removeEventListener('ended', handleEnded);
        media.removeEventListener('error', handleError);
        media.removeEventListener('loadedmetadata', () => {});
        media.removeEventListener('play', () => {});
        media.removeEventListener('pause', () => {});
      }

      // Cleanup audio context
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      }

      // Cleanup animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [handleTimeUpdate, handleEnded, handleError]);

  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const container = canvas.parentElement;
      if (!container) return;

      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
    };

    const canvas = canvasRef.current;
    if (canvas) {
      const resizeObserver = new ResizeObserver(updateCanvasSize);
      resizeObserver.observe(canvas);

      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  const renderMediaElement = () => {
    if (!currentStreamingUrl) return null;
    
    const commonProps = {
      src: currentStreamingUrl,
      preload: 'auto',
      playsInline: true,
      onPlay: () => {
        setIsPlaying(true);
        setIsLoading(false);
      },
      onPause: () => {
        setIsPlaying(false);
        setIsLoading(false);
      },
      onTimeUpdate: handleTimeUpdate,
      onEnded: handleEnded,
      onError: (e: React.SyntheticEvent<HTMLMediaElement>) => {
        console.error('Media error:', e);
        const error = e.currentTarget.error;
        console.error('Media error details:', {
          code: error?.code,
          message: error?.message
        });
        setError('Failed to load media. The file may be corrupted or unsupported.');
        setIsLoading(false);
      },
      onLoadedMetadata: () => {
        const media = mediaRef.current;
        if (media) {
          setDuration(media.duration);
          // For video elements, ensure they're visible
          if (coverArt && media instanceof HTMLVideoElement) {
            media.style.opacity = '1';
          }
        }
      },
      onWaiting: () => setIsLoading(true),
      onCanPlay: () => {
        setIsLoading(false);
        const media = mediaRef.current;
        if (media && media.paused && isPlaying) {
          media.play().catch(console.error);
        }
      },
      className: `${styles.mediaElement} ${coverArt ? styles.videoElement : ''}`,
      style: {
        opacity: coverArt ? '1' : '1',
        transition: 'opacity 0.3s ease',
      },
    };

    if (coverArt) {
      return (
        <video 
          {...commonProps} 
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          poster={coverArt} 
          playsInline 
          crossOrigin="anonymous"
        />
      );
    }
    
    return (
      <audio 
        {...commonProps} 
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        crossOrigin="anonymous"
      />
    );
  };

  const renderVisualizer = () => (
    <div className={styles.visualizerContainer}>
      {coverArt && (
        <div className={styles.videoContainer}>
          {renderMediaElement()}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={styles.visualizerCanvas}
        width={window.innerWidth}
        height={150}
      />
    </div>
  );

  // Update progress bar width when currentTime changes
  useEffect(() => {
    if (progressContainerRef.current && duration > 0) {
      const progressWidth = (currentTime / duration) * 100;
      progressContainerRef.current.style.setProperty('--progress-width', `${progressWidth}%`);
    }
  }, [currentTime, duration]);

  const renderControls = () => {
    return (
      <div className={styles.controls}>
        <button
          className={styles.controlButton}
          onClick={togglePlayPause}
          disabled={isLoading}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isLoading ? (
            <Loader2 className={styles.iconSpin} />
          ) : isPlaying ? (
            <Pause className={styles.icon} />
          ) : (
            <Play className={styles.icon} />
          )}
        </button>

        <div className={styles.timeInfo}>
          <span>{formatTime(currentTime)}</span>
          <span>/</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div 
          ref={progressContainerRef}
          className={styles.progressContainer}
          onClick={handleSeek}
        >
          <div className={styles.progressBar}>
            <div className={styles.progressBarFill} />
          </div>
        </div>

        <div className={styles.volumeControls}>
          <button
            className={styles.controlButton}
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className={styles.icon} />
            ) : (
              <Volume2 className={styles.icon} />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className={styles.volumeSlider}
            aria-label="Volume"
          />
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className={styles.error}>
        <AlertCircle className={styles.errorIcon} />
        <p>{error}</p>
        <button 
          className={styles.retryButton}
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.mediaPlayer}>
      {renderVisualizer()}
      
      {!coverArt && (
        <div className={styles.coverArtContainer}>
          <img
            src={coverArt}
            alt={`${title} cover`}
            className={styles.coverArt}
          />
        </div>
      )}
      
      <div className={styles.info}>
        <h3 className={styles.title}>{title}</h3>
        {artist && <p className={styles.artist}>{artist}</p>}
      </div>
      
      {renderControls()}
      {!coverArt && renderMediaElement()}
    </div>
  );
};
