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

/**
 * 영상 고유 ID 추출 (중복 판정 기준). 우선순위:
 *   1) 경로 /video/{id} · /share/video/{id} · /note/{id}
 *   2) 쿼리 modal_id · aweme_id · vid
 * Douyin aweme_id 는 긴 숫자(보통 19자리)라 6자리 이상 숫자만 인정.
 * 없으면 null → 호출부에서 정규화 URL fallback.
 */
export function extractVideoId(url: string): string | null {
  if (!url) return null;
  const path = url.match(/\/(?:video|note)\/(\d{6,})/);
  if (path) return path[1];
  try {
    const sp = new URL(url).searchParams;
    for (const k of ["modal_id", "aweme_id", "vid"]) {
      const v = sp.get(k);
      if (v && /^\d{6,}$/.test(v)) return v;
    }
  } catch {
    /* URL 파싱 실패 → 정규식 폴백 */
  }
  const q = url.match(/[?&](?:modal_id|aweme_id|vid)=(\d{6,})/);
  return q ? q[1] : null;
}

/** Douyin URL의 modal_id(숫자 영상 ID) 추출. 없으면 null. (Desktop 포팅) */
function extractDouyinModalId(url: string): string | null {
  try {
    const id = new URL(url).searchParams.get("modal_id");
    if (id && /^\d+$/.test(id)) return id;
  } catch {
    /* 정규식 폴백 */
  }
  const m = url.match(/[?&]modal_id=(\d+)/);
  return m ? m[1] : null;
}

/**
 * 다운로드 직전 URL 정규화 (Desktop downloadService.normalizeDownloadUrl 포팅).
 * - Douyin 검색/추천 페이지(...?modal_id={id})는 https://www.douyin.com/video/{id} 로 변환.
 * - 그 외(이미 영상 URL·단축 URL·타 플랫폼)는 그대로 반환.
 */
export function normalizeDownloadUrl(url: string): string {
  const u = (url ?? "").trim();
  if (!u) return u;
  if (/^https?:\/\/(?:www\.)?douyin\.com\//i.test(u) && /[?&]modal_id=/.test(u)) {
    const modalId = extractDouyinModalId(u);
    if (modalId) return `https://www.douyin.com/video/${modalId}`;
  }
  return u;
}
