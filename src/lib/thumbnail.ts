// URL로부터 영상 썸네일을 유추한다. (Local-First — 실제 파일 저장은 범위 밖)
// 지원되면 썸네일 URL, 아니면 null 을 반환한다.

/** YouTube video id 추출 */
function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.slice(1) || null;
    }
    if (host.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/\/(shorts|embed)\/([^/?]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/** 썸네일 URL (없으면 null) */
export function getThumbnail(url: string): string | null {
  const yt = youtubeId(url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  return null;
}
