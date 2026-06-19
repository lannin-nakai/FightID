import { Link2, Play, UploadCloud } from "lucide-react";
import { useState } from "react";
import type { VideoSource } from "../types/fight";
import { parseVideoUrl } from "../utils/videoSource";

interface UploadPanelProps {
  source: VideoSource;
  analyzedSource: VideoSource;
  analysisMode: string;
  analysisSummary: string;
  isAnalyzing: boolean;
  isAnalysisStale: boolean;
  onSourceChange: (source: VideoSource) => void;
  onAnalyze: (source?: VideoSource) => void;
}

export const UploadPanel = ({
  source,
  analyzedSource,
  analysisMode,
  analysisSummary,
  isAnalyzing,
  isAnalysisStale,
  onSourceChange,
  onAnalyze,
}: UploadPanelProps) => {
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const getUrlSource = (): VideoSource | undefined => {
    const trimmedUrl = url.trim();

    if (!trimmedUrl) {
      return undefined;
    }

    const parsedVideo = parseVideoUrl(trimmedUrl);

    if (!parsedVideo) {
      setUrlError("Enter a valid video URL.");
      return undefined;
    }

    setUrlError("");
    return {
      kind: "url",
      label: parsedVideo.label,
      src: parsedVideo.url,
    };
  };

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            Fight ingestion
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">Upload or link fight footage</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            Uploaded or CORS-enabled direct videos run client-side frame sampling for
            motion-based event candidates. Restricted links still need a backend ingestion
            worker for true visual model analysis.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="group flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-700/80 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-orange-400/70 hover:text-white">
            <UploadCloud className="h-4 w-4 text-orange-300" />
            Upload video
            <input
              className="sr-only"
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];

                if (file) {
                  setUrl("");
                  setUrlError("");
                  onSourceChange({
                    kind: "upload",
                    label: file.name,
                    src: URL.createObjectURL(file),
                  });
                }
              }}
            />
          </label>

          <button
            className="flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-black uppercase tracking-[0.16em] text-slate-950 shadow-lg shadow-orange-950/40 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isAnalyzing}
            type="button"
            onClick={() => {
              const urlSource = getUrlSource();

              if (url.trim() && !urlSource) {
                return;
              }

              if (urlSource) {
                onSourceChange(urlSource);
                onAnalyze(urlSource);
                return;
              }

              onAnalyze();
            }}
          >
            <Play className="h-4 w-4" />
            {isAnalyzing ? "Analyzing" : "Analyze"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
          <Link2 className="h-4 w-4 text-cyan-300" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            placeholder="Paste a YouTube link, direct MP4/HLS URL, or scouting footage link"
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setUrlError("");
            }}
          />
          <button
            className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isAnalyzing}
            type="button"
            onClick={() => {
              const urlSource = getUrlSource();

              if (!urlSource) {
                return;
              }

              onSourceChange(urlSource);
              onAnalyze(urlSource);
            }}
          >
            Use & analyze
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          <span className="text-slate-500">Active source:</span>{" "}
          <span className="font-semibold text-white">{source.label}</span>
        </div>
      </div>
      <div
        className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
          isAnalysisStale
            ? "border-orange-400/40 bg-orange-500/10 text-orange-100"
            : "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
        }`}
      >
        <span className="text-slate-400">Dashboard results:</span>{" "}
        <span className="font-semibold">{analyzedSource.label}</span>
        {isAnalysisStale && (
          <span className="text-orange-200">
            {" "}
            - new source selected, press Analyze to refresh the results.
          </span>
        )}
        <p className="mt-2 text-xs leading-5 text-slate-300">
          <span className="font-semibold uppercase tracking-[0.14em] text-slate-400">
            {analysisMode}
          </span>{" "}
          {analysisSummary}
        </p>
      </div>
      {urlError && <p className="mt-2 text-sm text-rose-300">{urlError}</p>}
    </section>
  );
};
