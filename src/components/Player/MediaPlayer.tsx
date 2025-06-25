import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Play, Pause, Volume2, VolumeX, Loader2, AlertCircle } from 'lucide-react';
import styles from './MediaPlayer.module.css';

interface MediaData {
  id: string;
  title: string;
  artist: string;
  coverArt?: string;
  url: string;
  type: 'audio' | 'video';
}

interface MediaPlayerProps {
  media: MediaData | null;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ media }) => {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const progressContainerRef = useRef<HTMLDivElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const volumeBeforeMute = useRef(0.8);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const visualizerWidth = 800;
  const visualizerHeight = 200;
  const { title = '', artist = '', coverArt, url, type } = media || {};

  const formatTime = useCallback((timeInSeconds: number): string => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  const initAudioContext = useCallback(async () => {
    if (audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      return audioContextRef.current;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioCtx();
      audioContextRef.current = audioContext;

      const media = mediaRef.current;
      if (!media) return null;

      const source = audioContext.createMediaElementSource(media);
      sourceRef.current = source;

      const gain = audioContext.createGain();
      gain.gain.value = isMuted ? 0 : volume;
      gainNodeRef.current = gain;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      source.connect(gain);
      gain.connect(analyser);
      analyser.connect(audioContext.destination);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      dataArrayRef.current = dataArray;

      return audioContext;
    } catch (err) {
      console.error('Error initializing audio context:', err);
      setError('Failed to initialize audio. Please try again.');
      return null;
    }
  }, [isMuted, volume]);

  const togglePlayPause = useCallback(async () => {
    const media = mediaRef.current;
    if (!media) return;

    try {
      if (media.paused) {
        setIsLoading(true);
        setError(null);
        if (type === 'audio') await initAudioContext();
        await media.play();
        setIsPlaying(true);
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
  }, [initAudioContext, type]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = newVolume;
    }
    
    if (isMuted && newVolume > 0) {
      setIsMuted(false);
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (isMuted) {
      const newVolume = volumeBeforeMute.current > 0 ? volumeBeforeMute.current : 0.8;
      setVolume(newVolume);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = newVolume;
      }
      setIsMuted(false);
    } else {
      volumeBeforeMute.current = volume;
      setVolume(0);
      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = 0;
      }
      setIsMuted(true);
    }
  }, [volume, isMuted]);

  const handleTimeUpdate = useCallback(() => {
    const media = mediaRef.current;
    if (!media) return;
    setCurrentTime(media.currentTime);
  }, []);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = progressContainerRef.current;
    const media = mediaRef.current;
    if (!container || !media) return;

    const rect = container.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    
    media.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration]);

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
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      analyser.getByteFrequencyData(dataArray);
      
      const barWidth = (canvas.width / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.8;
        
        const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(0.7, '#8b5cf6');
        gradient.addColorStop(1, '#ec4899');
        
        ctx.fillStyle = gradient;
        const barX = x + (barWidth / 2);
        const barY = canvas.height - barHeight;
        const barW = barWidth * 0.8;
        
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

    renderFrame();
  }, []);

  useEffect(() => {
    if (isPlaying && type === 'audio') {
      startVisualization();
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, type, startVisualization]);

  const commonProps = useMemo(() => ({
    src: url || undefined,
    preload: 'auto' as const,
    playsInline: true,
    crossOrigin: 'anonymous' as const,
    onTimeUpdate: handleTimeUpdate,
    onEnded: () => setIsPlaying(false),
    onError: (e: React.SyntheticEvent<HTMLMediaElement>) => {
      console.error('Media error:', e);
      setError('Failed to load media. The file may be corrupted or unsupported.');
      setIsLoading(false);
    },
    onLoadedMetadata: () => {
      if (mediaRef.current) {
        setDuration(mediaRef.current.duration);
      }
    },
    onWaiting: () => setIsLoading(true),
    onCanPlay: () => {
      setIsLoading(false);
      setError(null);
    },
  }), [url, handleTimeUpdate]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const renderMediaElement = () => {
    if (!url) return null;

    if (type === 'video') {
      return (
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          poster={coverArt}
          {...commonProps}
          style={{
            width: '100%',
            maxHeight: '80vh',
            objectFit: 'contain',
            backgroundColor: '#000'
          }}
        />
      );
    }

    return (
      <>
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          {...commonProps}
        />
        <div className={styles.visualizerContainer}>
          <canvas
            ref={canvasRef}
            className={styles.visualizer}
            width={visualizerWidth}
            height={visualizerHeight}
          />
        </div>
      </>
    );
  };

  const renderControls = () => (
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
          <div 
            className={styles.progressBarFill} 
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
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
          onChange={handleVolumeChange}
          className={styles.volumeSlider}
          aria-label="Volume"
        />
      </div>
    </div>
  );

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
      <div className={styles.mediaContainer}>
        {renderMediaElement()}
      </div>
      
      {coverArt && type === 'audio' && (
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
    </div>
  );
};

export default MediaPlayer;