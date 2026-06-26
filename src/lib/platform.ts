// 영상 URL로부터 플랫폼을 추정한다.

export type Platform = "youtube" | "douyin" | "xiaohongshu" | "tiktok" | "other";

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  douyin: "Douyin",
  xiaohongshu: "Xiaohongshu",
  tiktok: "TikTok",
  other: "기타",
};

/** 배지 색상 (Desktop 팔레트 톤) */
export const PLATFORM_BADGE: Record<Platform, string> = {
  youtube: "bg-red-500/20 text-red-400 border-red-500/30",
  douyin: "bg-pink-500/20 text-pink-400 border-pink-500/30",
  xiaohongshu: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  tiktok: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  other: "bg-subtext/15 text-subtext border-subtext/30",
};

/** URL → 플랫폼 추정 (없거나 모르면 'other') */
export function detectPlatform(url: string): Platform {
  if (!url) return "other";
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "other";
  }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "youtube";
  if (host.endsWith("douyin.com")) return "douyin";
  if (host.endsWith("xiaohongshu.com") || host.endsWith("xhslink.com"))
    return "xiaohongshu";
  if (host.endsWith("tiktok.com")) return "tiktok";
  return "other";
}
