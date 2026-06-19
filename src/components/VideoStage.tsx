import { Gauge, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FightEvent, Fighter, PoseFrame, VideoSource } from "../types/fight";
import { MOVEMENT_LABELS } from "../types/fight";
import { formatTimestamp } from "../utils/time";
import { getYouTubeEmbedUrl, getYouTubeVideoId } from "../utils/videoSource";
import { PoseSilhouette } from "./PoseSilhouette";

interface VideoStageProps {
  source: VideoSource;
  selectedEvent?: FightEvent;
  selectedPoseFrame?: PoseFrame;
  fighter?: Fighter;
  seekRequest: number | null;
  onSeekHandled: () => void;
}

const playbackRates = [0.25, 0.5, 1, 1.5];

export const VideoStage = ({
  source,
  selectedEvent,
  selectedPoseFrame,
  fighter,
  seekRequest,
  onSeekHandled,
}: VideoStageProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [youtubeStart, setYoutubeStart] = useState(0);
  const youtubeVideoId = source.src ? getYouTubeVideoId(source.src) : undefined;
  const youtubeEmbedUrl = youtubeVideoId
    ? getYouTubeEmbedUrl(youtubeVideoId, youtubeStart)
    : undefined;

  useEffect(() => {
    if (seekRequest === null) {
      return;
    }

    if (youtubeVideoId) {
      setYoutubeStart(Math.max(0, Math.floor(seekRequest)));
      onSeekHandled();
      return;
    }

    if (!videoRef.current) {
      onSeekHandled();
      return;
    }

    videoRef.current.currentTime = Math.max(0, seekRequest);
    onSeekHandled();
  }, [onSeekHandled, seekRequest, youtubeVideoId]);

  useEffect(() => {
    setYoutubeStart(0);
  }, [source.src]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const jumpBy = (delta: number) => {
    if (youtubeVideoId) {
      setYoutubeStart((currentStart) => Math.max(0, currentStart + delta));
      return;
    }

    if (!videoRef.current) {
      return;
    }

    videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime + delta);
  };

  return (
    <section className="glass-panel overflow-hidden rounded-3xl">
      <div className="flex flex-col gap-4 border-b border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            Film room
          </p>
          <h2 className="mt-1 text-2xl font-black text-white">Interactive footage review</h2>
        </div>

        {selectedEvent && fighter && (
          <div className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-sm">
            <span className="text-slate-400">Selected:</span>{" "}
            <span className={`font-bold ${fighter.accentClass}`}>{fighter.name}</span>
            <span className="text-slate-500"> / </span>
            <span className="font-bold text-white">
              {MOVEMENT_LABELS[selectedEvent.movementType]}
            </span>
            <span className="text-slate-500"> at </span>
            <span className="font-mono text-orange-200">
              {formatTimestamp(selectedEvent.timestamp)}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="relative min-h-[360px] bg-black">
          {youtubeEmbedUrl ? (
            <iframe
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="aspect-video h-full min-h-[360px] w-full bg-black"
              src={youtubeEmbedUrl}
              title={`${source.label} embedded fight footage`}
            />
          ) : source.src ? (
            <video
              className="aspect-video h-full max-h-[650px] w-full bg-black object-contain"
              controls
              playsInline
              ref={videoRef}
              src={source.src}
            />
          ) : (
            <div className="relative flex aspect-video min-h-[360px] items-center justify-center overflow-hidden bg-slate-950">
              <div className="absolute inset-0 fight-grid opacity-50" />
              <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/20 blur-3xl" />
              <div className="relative z-10 max-w-md px-6 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-orange-300/40 bg-orange-500/10">
                  <Gauge className="h-9 w-9 text-orange-300" />
                </div>
                <h3 className="text-2xl font-black text-white">Sample fight loaded</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Upload a local video, paste a YouTube link, or paste a direct video URL
                  to review footage in the player. Clickable timestamps are generated by
                  the active analysis mode.
                </p>
              </div>
            </div>
          )}

          {selectedEvent && (
            <div className="absolute bottom-4 left-4 rounded-2xl border border-slate-700 bg-slate-950/85 px-4 py-3 text-sm shadow-2xl backdrop-blur">
              <p className="font-mono text-orange-200">
                {formatTimestamp(selectedEvent.timestamp)}
              </p>
              <p className="font-bold text-white">{selectedEvent.label}</p>
            </div>
          )}
        </div>

        <aside className="border-t border-slate-800 bg-slate-950/55 p-5 xl:border-l xl:border-t-0">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Pose overlay
              </p>
              <h3 className="font-bold text-white">Figure-frame preview</h3>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">
              {selectedPoseFrame?.facing ?? "auto"} facing
            </span>
          </div>
          <PoseSilhouette fighter={fighter} frame={selectedPoseFrame} />

          <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
              <RotateCcw className="h-4 w-4 text-cyan-300" />
              Slow-motion replay
            </div>
            <div className="grid grid-cols-4 gap-2">
              {playbackRates.map((rate) => (
                <button
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    playbackRate === rate
                      ? "bg-orange-400 text-slate-950"
                      : "bg-slate-900 text-slate-300 hover:bg-slate-800"
                  }`}
                  disabled={Boolean(youtubeVideoId)}
                  key={rate}
                  type="button"
                  onClick={() => setPlaybackRate(rate)}
                >
                  {rate}x
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400/60 hover:text-white"
                type="button"
                onClick={() => jumpBy(-5)}
              >
                <SkipBack className="h-3.5 w-3.5" />
                -5s
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-cyan-400/60 hover:text-white"
                type="button"
                onClick={() => jumpBy(5)}
              >
                +5s
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>
            {youtubeVideoId && (
              <p className="mt-3 text-xs leading-5 text-slate-500">
                YouTube embeds do not expose playback-speed control here; timestamp cards
                reload the embed at the selected moment.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};
