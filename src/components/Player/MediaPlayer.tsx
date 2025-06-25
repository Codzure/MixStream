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
        await initAudioContext();
        await media.play();
        setIsPlaying(true);
        setIsLoading(false);
      } else {
        media.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Error toggling play/pause:', error);
      setError('Failed to play media');
      setIsLoading(false);
    }
  }, [initAudioContext]);

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
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;

    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw visualizer bars
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;

        // Create gradient for each bar
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, `hsl(${i * 2}, 100%, 50%)`);
        gradient.addColorStop(1, `hsl(${i * 2 + 30}, 100%, 50%)`);

        ctx.fillStyle = gradient;
        ctx.fillRect(
          x,
          canvas.height - barHeight,
          barWidth - 1,
          barHeight
        );

        x += barWidth + 1;
      }
    };

    // Start the animation loop
    draw();

    // Cleanup function
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
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
    const commonProps = {
      src: streamingUrl,
      preload: 'metadata',
      onPlay: () => setIsPlaying(true),
      onPause: () => setIsPlaying(false),
      onTimeUpdate: handleTimeUpdate,
      onEnded: handleEnded,
      onError: handleError,
      onLoadedMetadata: () => {
        const media = mediaRef.current;
        if (media) setDuration(media.duration);
      },
      className: styles.mediaElement,
    };

    if (coverArt) {
      return (
        <video 
          {...commonProps} 
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          poster={coverArt} 
          playsInline 
        />
      );
    }
    
    return <audio {...commonProps} ref={mediaRef as React.RefObject<HTMLAudioElement>} />;
  };

  const renderVisualizer = () => (
    <div className={styles.visualizerContainer}>
      <canvas
        ref={canvasRef}
        className={styles.visualizer}
        width={800}
        height={200}
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
      {coverArt && (
        <div className={styles.coverArtContainer}>
          <img
            src={coverArt}
            alt={`${title} cover`}
            className={styles.coverArt}
          />
        </div>
      )}
      
      {renderVisualizer()}
      
      <div className={styles.info}>
        <h3 className={styles.title}>{title}</h3>
        {artist && <p className={styles.artist}>{artist}</p>}
      </div>
      
      {renderControls()}
      {renderMediaElement()}
    </div>
  );
};
