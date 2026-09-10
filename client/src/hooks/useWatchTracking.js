import { useCallback, useEffect, useRef, useState } from 'react';
import { videoApi } from '../services/endpoints';

const SAVE_INTERVAL_MS = 10000;

/**
 * Honest watch tracking, shared by every player engine.
 *
 * Only real playback advances the counter: the hook adds elapsed wall time while
 * the video is playing, and drops the partial tick whenever the student seeks.
 * So scrubbing to the end can never complete a video that was not watched.
 *
 * The same contract is sent to the server for a YouTube embed and a direct file,
 * which is why both sources produce comparable progress.
 *
 * @param {object}   options
 * @param {string}   options.videoId
 * @param {object}   options.initialProgress   { lastPosition, percentage, completed }
 * @param {Function} options.getPlayerState    () => ({ position, duration })
 * @param {Function} [options.onCompleted]
 */
export default function useWatchTracking({
  videoId,
  initialProgress,
  getPlayerState,
  onCompleted,
}) {
  const [percentage, setPercentage] = useState(initialProgress?.percentage ?? 0);
  const [completed, setCompleted] = useState(initialProgress?.completed ?? false);
  const [playing, setPlaying] = useState(false);

  // Seconds watched since the last save. Advanced only by real playback.
  const pendingDelta = useRef(0);
  const lastTick = useRef(null);
  const startedSent = useRef(false);
  const completedRef = useRef(initialProgress?.completed ?? false);
  const stateRef = useRef(getPlayerState);

  stateRef.current = getPlayerState;

  /** Sends the accumulated watch time to the server. */
  const flush = useCallback(
    async (force = false) => {
      const delta = pendingDelta.current;
      if (!force && delta < 1) return;

      const { position = 0, duration = 0 } = stateRef.current?.() || {};
      pendingDelta.current = 0;

      try {
        const res = await videoApi.saveProgress(videoId, {
          position: Math.max(0, Math.floor(position)),
          watchedDelta: Math.round(delta),
          duration: Math.max(0, Math.floor(duration)),
        });

        setPercentage(res.data.percentage);

        if (res.data.completed && !completedRef.current) {
          completedRef.current = true;
          setCompleted(true);
          onCompleted?.();
        }
      } catch {
        // Put the delta back so a failed save is retried on the next flush.
        pendingDelta.current += delta;
      }
    },
    [videoId, onCompleted]
  );

  /** Call when playback starts. Records VIDEO_STARTED once per student. */
  const handlePlay = useCallback(async () => {
    lastTick.current = performance.now();
    setPlaying(true);

    if (!startedSent.current) {
      startedSent.current = true;
      try {
        await videoApi.start(videoId);
      } catch {
        /* tracking must never block playback */
      }
    }
  }, [videoId]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    lastTick.current = null;
    flush(true);
  }, [flush]);

  /** Call before a jump so the seek itself is not counted as watched. */
  const handleSeek = useCallback(() => {
    lastTick.current = null;
  }, []);

  /**
   * Call repeatedly while playing. Adds the elapsed wall time, ignoring gaps
   * that are too long to be continuous playback.
   */
  const handleTick = useCallback((playbackRate = 1) => {
    const now = performance.now();
    if (lastTick.current !== null) {
      const elapsed = (now - lastTick.current) / 1000;
      if (elapsed > 0 && elapsed < 2) pendingDelta.current += elapsed * playbackRate;
    }
    lastTick.current = now;
  }, []);

  // Periodic save while playing.
  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => flush(), SAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, flush]);

  // Save when the tab is hidden or the page unloads, and on unmount.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) flush(true);
    };
    const onUnload = () => flush(true);

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onUnload);
      flush(true);
    };
  }, [flush]);

  return {
    percentage,
    completed,
    playing,
    setPlaying,
    handlePlay,
    handlePause,
    handleSeek,
    handleTick,
    flush,
  };
}
