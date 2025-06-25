import React, { useState, useEffect, useRef } from 'react';
import styles from './MediaPlayer.module.css';
import { AlertCircle } from 'lucide-react';

interface MediaPlayerProps {
  media: {
    url: string;
    type: 'audio' | 'video';
    coverArt?: string;
    title?: string;
    artist?: string;
  };
}

const MediaPlayer = ({ media }: MediaPlayerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mediaRef = useRef<any>(null); // Temporary fix for type casting issues

  // Handle media errors
  useEffect(() => {
    const mediaElement = mediaRef.current;
    if (!mediaElement) return;

    mediaElement.addEventListener('error', () => {
      setError('Failed to load media. Please try again.');
    });

    return () => {
      mediaElement?.removeEventListener('error', () => {});
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const media = mediaRef.current;
      if (media) {
        media.pause();
        media.src = '';
      }
    };
  }, []);

  const renderMediaElement = () => {
    return (
      <div className={styles.mediaContainer}>
        {media.type === 'video' ? (
          <video
            ref={mediaRef}
            src={media.url}
            poster={media.coverArt}
            playsInline={true}
            controls
            className={styles.mediaElement}
          />
        ) : (
          <audio
            ref={mediaRef}
            src={media.url}
            controls
            className={styles.mediaElement}
          />
        )}
      </div>
    );
  };

  const renderControls = () => {
    return (
      <div className={styles.controls}>
        <div className={styles.progressContainer}>
          <input
            type="range"
            min="0"
            max="100"
            value="0"
            className={styles.progress}
            aria-label="Progress"
          />
        </div>
        <div className={styles.timeDisplay}>
          <span className={styles.currentTime}>0:00</span>
          <span className={styles.duration}>0:00</span>
        </div>
        <div className={styles.volumeControls}>
          <button className={styles.muteButton}>
            <span>🔊</span>
          </button>
          <input
            type="range"
            min="0"
            max="100"
            value="100"
            className={styles.volume}
            aria-label="Volume"
          />
        </div>
        <button
          className={styles.fullscreenButton}
          onClick={() => setIsFullscreen(!isFullscreen)}
        >
          <span>Fullscreen</span>
        </button>
      </div>
    );
  };

  return (
    <div className={styles.mediaPlayer}>
      {error ? (
        <div className={styles.error}>
          <AlertCircle className={styles.icon} />
          <span>{error}</span>
          <button 
            className={styles.retryButton}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {renderMediaElement()}
          
          {media.coverArt && media.type === 'audio' && (
            <div className={styles.coverArtContainer}>
              <img
                src={media.coverArt}
                alt={`${media.title} cover`}
                className={styles.coverArt}
              />
            </div>
          )}
          
          <div className={styles.info}>
            <h3 className={styles.title}>{media.title}</h3>
            <p className={styles.artist}>{media.artist}</p>
          </div>
          
          {renderControls()}
        </>
      )}
    </div>
  );
};

export default MediaPlayer;
