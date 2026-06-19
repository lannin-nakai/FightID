import { Link2, Play, UploadCloud } from "lucide-react";
import { useState } from "react";
import type { VideoSource } from "../types/fight";

interface UploadPanelProps {
  source: VideoSource;
  isAnalyzing: boolean;
  onSourceChange: (source: VideoSource) => void;
  onAnalyze: () => void;
}

export const UploadPanel = ({
  source,
  isAnalyzing,
  onSourceChange,
  onAnalyze,
}: UploadPanelProps) => {
  const [url, setUrl] = useState("");

  return (
    <section className="glass-panel rounded-3xl p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-300">
            Fight ingestion
          </p>
          <h2 className="mt-2 text-xl font-bold text-white">Upload or link fight footage</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-400">
            The prototype runs a realistic mock analysis pass and returns structured fight
            events that can later be replaced by real CV/ML output.
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
            onClick={onAnalyze}
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
            placeholder="Paste a direct MP4/HLS video URL or scouting footage link"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button
            className="rounded-xl border border-cyan-400/40 px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200 transition hover:bg-cyan-400/10"
            type="button"
            onClick={() => {
              const trimmedUrl = url.trim();

              if (!trimmedUrl) {
                return;
              }

              let parsedUrl: URL;

              try {
                parsedUrl = new URL(trimmedUrl);
              } catch {
                return;
              }

              onSourceChange({
                kind: "url",
                label: parsedUrl.hostname || "Linked footage",
                src: trimmedUrl,
              });
            }}
          >
            Use link
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-300">
          <span className="text-slate-500">Active source:</span>{" "}
          <span className="font-semibold text-white">{source.label}</span>
        </div>
      </div>
    </section>
  );
};
