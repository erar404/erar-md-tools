import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

interface YoutubeSearchItem {
  id: { videoId?: string };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: { default?: { url: string }; medium?: { url: string } };
  };
}

interface YoutubeVideoItem {
  id: string;
  contentDetails: { duration: string };
}

/** "PT4M13S" -> "4:13". Falls back to "" for anything that doesn't parse. */
function parseIsoDuration(iso: string): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return "";
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const parts = hours > 0 ? [hours, minutes, seconds] : [minutes, seconds];
  return parts.map((p, i) => (i === 0 ? String(p) : String(p).padStart(2, "0"))).join(":");
}

export async function GET(request: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube search isn't configured yet" }, { status: 500 });
  }

  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("maxResults", "8");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("key", apiKey);

  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();
  if (!searchRes.ok) {
    return NextResponse.json(
      { error: searchData.error?.message ?? "YouTube search failed" },
      { status: 502 }
    );
  }

  const items = (searchData.items ?? []) as YoutubeSearchItem[];
  const videoIds = items.map((item) => item.id.videoId).filter((id): id is string => Boolean(id));

  let durationById = new Map<string, string>();
  if (videoIds.length) {
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "contentDetails");
    videosUrl.searchParams.set("id", videoIds.join(","));
    videosUrl.searchParams.set("key", apiKey);

    const videosRes = await fetch(videosUrl);
    if (videosRes.ok) {
      const videosData = await videosRes.json();
      const videoItems = (videosData.items ?? []) as YoutubeVideoItem[];
      durationById = new Map(
        videoItems.map((v) => [v.id, parseIsoDuration(v.contentDetails.duration)])
      );
    }
  }

  const results = items
    .filter((item) => item.id.videoId)
    .map((item) => ({
      videoId: item.id.videoId!,
      title: item.snippet.title,
      channelTitle: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails.medium?.url ?? item.snippet.thumbnails.default?.url ?? "",
      duration: durationById.get(item.id.videoId!) ?? "",
    }));

  return NextResponse.json({ results });
}
