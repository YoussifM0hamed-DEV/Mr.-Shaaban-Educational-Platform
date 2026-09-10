import NativeVideoPlayer from './NativeVideoPlayer';
import YouTubePlayer from './YouTubePlayer';
import { VIDEO_PROVIDERS, detectVideoSource } from '../../utils/videoSource';

/**
 * Picks the right engine for where the lesson video is hosted.
 * Both engines report watch progress through the same hook and the same API,
 * so a lesson on YouTube and a lesson on a direct file are measured identically.
 */
export default function VideoPlayer({ video, initialProgress, onCompleted }) {
  // Fall back to reading the URL for videos saved before the provider was stored.
  const provider =
    video.provider || detectVideoSource(video.videoUrl)?.provider || VIDEO_PROVIDERS.DIRECT;

  if (provider === VIDEO_PROVIDERS.YOUTUBE) {
    const externalId = video.externalId || detectVideoSource(video.videoUrl)?.externalId;
    return (
      <YouTubePlayer
        video={{ ...video, externalId }}
        initialProgress={initialProgress}
        onCompleted={onCompleted}
      />
    );
  }

  return (
    <NativeVideoPlayer video={video} initialProgress={initialProgress} onCompleted={onCompleted} />
  );
}
