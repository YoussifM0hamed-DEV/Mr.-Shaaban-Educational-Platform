import { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import {
  Check,
  Maximize,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import useWatchTracking from '../../hooks/useWatchTracking';
import { formatDuration } from '../../utils/format';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Player for a direct video file, with the platform's own controls.
 * Watch tracking is delegated to useWatchTracking, so it behaves exactly like
 * the YouTube engine from the server's point of view.
 */
export default function NativeVideoPlayer({ video, initialProgress, onCompleted }) {
  const videoRef = useRef(null);
  const wrapRef = useRef(null);
  const hideTimer = useRef(null);

  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [resumed, setResumed] = useState(false);

  const getPlayerState = useCallback(
    () => ({
      position: videoRef.current?.currentTime || 0,
      duration: videoRef.current?.duration || duration || 0,
    }),
    [duration]
  );

  const tracking = useWatchTracking({
    videoId: video._id,
    initialProgress,
    getPlayerState,
    onCompleted,
  });

  const { playing } = tracking;

  useEffect(() => {
    const onFsChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleLoadedMetadata = () => {
    const el = videoRef.current;
    if (!el) return;
    setDuration(el.duration || video.duration || 0);

    // Resume where the student stopped, but never inside the final seconds.
    const resumeAt = initialProgress?.lastPosition || 0;
    if (!resumed && resumeAt > 5 && resumeAt < (el.duration || Infinity) - 10) {
      el.currentTime = resumeAt;
      setCurrent(resumeAt);
    }
    setResumed(true);
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el) return;
    setCurrent(el.currentTime);
    if (el.buffered.length) setBuffered(el.buffered.end(el.buffered.length - 1));
    tracking.handleTick(el.playbackRate);
  };

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  const seek = (value) => {
    const el = videoRef.current;
    if (!el) return;
    tracking.handleSeek();
    el.currentTime = value;
    setCurrent(value);
  };

  const skip = (seconds) => {
    const el = videoRef.current;
    if (!el) return;
    seek(Math.max(0, Math.min(el.duration || 0, el.currentTime + seconds)));
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else wrapRef.current?.requestFullscreen?.();
  };

  const onKeyDown = (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    switch (e.key) {
      case ' ':
      case 'k':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowRight':
        skip(10);
        break;
      case 'ArrowLeft':
        skip(-10);
        break;
      case 'f':
        toggleFullscreen();
        break;
      case 'm':
        setMuted((v) => !v);
        break;
      default:
        break;
    }
  };

  const revealControls = () => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) hideTimer.current = setTimeout(() => setShowControls(false), 2800);
  };

  const progressPercent = duration ? (current / duration) * 100 : 0;
  const bufferedPercent = duration ? (buffered / duration) * 100 : 0;

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        className="group relative aspect-video w-full overflow-hidden rounded-2xl bg-black focus:outline-none"
        onMouseMove={revealControls}
        onMouseLeave={() => playing && setShowControls(false)}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="region"
        aria-label={video.title}
      >
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.thumbnailUrl || undefined}
          className="h-full w-full"
          playsInline
          preload="metadata"
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
          onPlay={tracking.handlePlay}
          onPause={tracking.handlePause}
          onSeeking={tracking.handleSeek}
          onEnded={tracking.handlePause}
          onClick={togglePlay}
          onVolumeChange={(e) => {
            setVolume(e.target.volume);
            setMuted(e.target.muted);
          }}
        />

        {!playing ? (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors hover:bg-black/35"
            aria-label="Play video"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 shadow-elevated">
              <Play className="ml-1 h-7 w-7 text-ink-900" fill="currentColor" />
            </span>
          </button>
        ) : null}

        <div
          className={clsx(
            'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3 pb-2.5 pt-8 transition-opacity duration-200',
            showControls || !playing ? 'opacity-100' : 'opacity-0'
          )}
        >
          <div className="relative mb-2 h-1.5">
            <div className="absolute inset-0 rounded-full bg-white/25" />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/40"
              style={{ width: `${bufferedPercent}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-brand-500"
              style={{ width: `${progressPercent}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 0}
              step="0.1"
              value={current}
              onChange={(e) => seek(Number(e.target.value))}
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              aria-label="Seek"
            />
          </div>

          <div className="flex items-center gap-2 text-white">
            <button type="button" onClick={togglePlay} className="p-1.5" aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            <button type="button" onClick={() => skip(-10)} className="p-1.5" aria-label="Back 10 seconds">
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => skip(10)} className="p-1.5" aria-label="Forward 10 seconds">
              <RotateCw className="h-4 w-4" />
            </button>

            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={() => {
                  const el = videoRef.current;
                  if (el) el.muted = !el.muted;
                }}
                className="p-1.5"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step="0.05"
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const el = videoRef.current;
                  if (el) {
                    el.volume = Number(e.target.value);
                    el.muted = Number(e.target.value) === 0;
                  }
                }}
                className="h-1 w-20 cursor-pointer accent-white"
                aria-label="Volume"
              />
            </div>

            <span className="ml-1 text-xs tabular-nums text-white/90">
              {formatDuration(current)} / {formatDuration(duration)}
            </span>

            <div className="ml-auto flex items-center gap-1">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSpeed((v) => !v)}
                  className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold hover:bg-white/15"
                  aria-label="Playback speed"
                >
                  <Settings2 className="h-4 w-4" />
                  {speed}x
                </button>

                {showSpeed ? (
                  <div className="absolute bottom-full right-0 mb-2 w-24 overflow-hidden rounded-xl bg-ink-900/95 py-1 shadow-elevated">
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const el = videoRef.current;
                          if (el) el.playbackRate = s;
                          setSpeed(s);
                          setShowSpeed(false);
                        }}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-xs text-white hover:bg-white/10"
                      >
                        {s}x
                        {speed === s ? <Check className="h-3 w-3" /> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5"
                aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              >
                {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <WatchProgressBar percentage={tracking.percentage} completed={tracking.completed} />
    </div>
  );
}

export function WatchProgressBar({ percentage, completed }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-ink-500">Your watch progress</span>
          <span className="font-semibold tabular-nums text-ink-800">{percentage}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-ink-100">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              completed ? 'bg-emerald-500' : 'bg-brand-600'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {completed ? (
        <span className="badge bg-emerald-50 text-emerald-700">
          <Check className="h-3 w-3" />
          Completed
        </span>
      ) : (
        <span className="text-xs text-ink-500">Watch to the end to complete this video</span>
      )}
    </div>
  );
}
