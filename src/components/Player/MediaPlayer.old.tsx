import React, { useState, useEffect, useRef } from 'react';

interface MediaPlayerProps {
  media: {
    url: string;
    type: 'audio' | 'video';
    coverArt?: string;
  };
}

const MediaPlayer = ({ media }: MediaPlayerProps) => {
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<HTMLMediaElement>(null);

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

      media.removeEventListener('ended', handleEnded);
      media.removeEventListener('waiting', handleWaiting);
      media.removeEventListener('canplay', handleCanPlay);
      media.removeEventListener('error', handleError);
      media.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  if (error) {
    return (
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
    );
  }

  return (
    <div className={`${styles.mediaPlayer} ${isFullscreen ? styles.fullscreen : ''}`}>
      {error ? (
        <div className={styles.error}>
          <AlertCircle className={styles.icon} />
          <span>{error}</span>
        </div>
      ) : (
        <>
          <div className={styles.mediaContainer}>
            {renderMediaElement()}
          </div>
          
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

  return (
    <div className={styles.mediaPlayer}>
      {renderMediaElement()}
      {renderControls()}
    </div>
  );
};

export default MediaPlayer;
