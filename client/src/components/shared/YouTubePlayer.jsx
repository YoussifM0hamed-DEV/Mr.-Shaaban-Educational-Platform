import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '../ui';
import useWatchTracking from '../../hooks/useWatchTracking';
import { WatchProgressBar } from './NativeVideoPlayer';

const API_SRC = 'https://www.youtube.com/iframe_api';
const POLL_MS = 400;

let apiPromise = null;

/** Loads YouTube's iframe API once and shares it across every player instance. */
function loadYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous();
      resolve(window.YT);
    };

    const script = document.createElement('script');
    script.src = API_SRC;
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error('Could not load the YouTube player'));
    };
    document.head.appendChild(script);
  });

  return apiPromise;
}

/**
 * Player for a YouTube-hosted lesson video.
 *
 * YouTube supplies its own controls, so this only drives the tracking: it polls
 * the real playback position and feeds the same hook the direct-file player
 * uses. Seeking still contributes nothing, because the hook drops the tick.
 */
export default function YouTubePlayer({ video, initialProgress, onCompleted }) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const pollRef = useRef(null);
  const lastPosition = useRef(0);
  const resumed = useRef(false);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [duration, setDuration] = useState(video.duration || 0);

  const getPlayerState = useCallback(
    () => ({
      position: lastPosition.current,
      duration: playerRef.current?.getDuration?.() || duration || 0,
    }),
    [duration]
  );

  const tracking = useWatchTracking({
    videoId: video._id,
    initialProgress,
    getPlayerState,
    onCompleted,
  });

  // Keep the callbacks in a ref so the effect below can stay mount-only.
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;

  useEffect(() => {
    let cancelled = false;

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;

        playerRef.current = new YT.Player(hostRef.current, {
          videoId: video.externalId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              setReady(true);
              setDuration(event.target.getDuration() || video.duration || 0);

              // Resume where the student stopped, never inside the final seconds.
              const resumeAt = initialProgress?.lastPosition || 0;
              const total = event.target.getDuration() || Infinity;
              if (!resumed.current && resumeAt > 5 && resumeAt < total - 10) {
                event.target.seekTo(resumeAt, true);
                lastPosition.current = resumeAt;
              }
              resumed.current = true;
            },

            onStateChange: (event) => {
              const YTState = window.YT.PlayerState;
              if (event.data === YTState.PLAYING) {
                trackingRef.current.handlePlay();
              } else if (event.data === YTState.PAUSED || event.data === YTState.ENDED) {
                trackingRef.current.handlePause();
              } else if (event.data === YTState.BUFFERING) {
                // Buffering usually follows a seek, so drop the partial tick.
                trackingRef.current.handleSeek();
              }
            },

            onError: () => {
              if (!cancelled) {
                setError(
                  'This YouTube video cannot be played here. It may be private, deleted, or the owner disabled embedding.'
                );
              }
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setError('Could not load the YouTube player. Check your connection.');
      });

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* the iframe may already be gone */
      }
      playerRef.current = null;
    };
    // Mount-only: the player is rebuilt by remounting, not by prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.externalId]);

  /**
   * Poll the real position while playing. A jump larger than the poll interval
   * means the student seeked, so the tick is dropped instead of being counted.
   */
  useEffect(() => {
    if (!ready) return undefined;

    pollRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime) return;

      const state = player.getPlayerState?.();
      if (state !== window.YT?.PlayerState?.PLAYING) return;

      const position = player.getCurrentTime() || 0;
      const jumped = Math.abs(position - lastPosition.current) > (POLL_MS / 1000) * 4;
      lastPosition.current = position;

      if (jumped) {
        trackingRef.current.handleSeek();
        return;
      }

      trackingRef.current.handleTick(player.getPlaybackRate?.() || 1);
    }, POLL_MS);

    return () => clearInterval(pollRef.current);
  }, [ready]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-white/90">{error}</p>
            <a
              href={video.videoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-brand-300 underline"
            >
              Open it on YouTube
            </a>
          </div>
        ) : null}

        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Spinner className="h-7 w-7 text-white" />
          </div>
        ) : null}

        {/* The API replaces this node with the player iframe. */}
        <div ref={hostRef} className="h-full w-full" />
      </div>

      <WatchProgressBar percentage={tracking.percentage} completed={tracking.completed} />
    </div>
  );
}
