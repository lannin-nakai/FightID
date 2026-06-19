export type ParsedVideoUrl = {
  provider: "youtube" | "direct";
  label: string;
  url: string;
  youtubeId?: string;
};

const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export const getYouTubeVideoId = (url: string): string | undefined => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return undefined;
  }

  const host = parsedUrl.hostname.toLowerCase();

  if (!youtubeHosts.has(host)) {
    return undefined;
  }

  if (host.includes("youtu.be")) {
    return parsedUrl.pathname.split("/").filter(Boolean)[0];
  }

  if (parsedUrl.pathname === "/watch") {
    return parsedUrl.searchParams.get("v") ?? undefined;
  }

  const [prefix, videoId] = parsedUrl.pathname.split("/").filter(Boolean);

  if (["embed", "shorts", "live"].includes(prefix ?? "")) {
    return videoId;
  }

  return undefined;
};

export const getYouTubeEmbedUrl = (videoId: string, startSeconds = 0): string => {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    start: String(Math.max(0, Math.floor(startSeconds))),
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

export const parseVideoUrl = (rawUrl: string): ParsedVideoUrl | undefined => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    return undefined;
  }

  const youtubeId = getYouTubeVideoId(parsedUrl.toString());

  if (youtubeId) {
    return {
      provider: "youtube",
      label: `YouTube: ${youtubeId}`,
      url: parsedUrl.toString(),
      youtubeId,
    };
  }

  return {
    provider: "direct",
    label: parsedUrl.hostname || "Linked footage",
    url: parsedUrl.toString(),
  };
};
