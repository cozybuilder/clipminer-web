// ClipMiner Web — Browser Connector 수신부.
// Douyin 확장이 "실제 mp4 다운로드 성공" 후 보내는 등록 payload를 받아,
// 기존 라이브러리 등록 경로(작업 폴더 저장 + IndexedDB)로 저장한다.
//
// 원칙: URL만으로 등록하지 않는다. 아래를 모두 만족할 때만 등록한다.
//   1) 실제 mp4 bytes 존재  2) content-type video/*(mp4 계열)  3) 작업 폴더 저장 성공
//   4) 제목(원문 또는 fallback)  5) payload 유효
// 번역/태그는 Desktop ClipMiner titleTranslate 흐름(이미 포팅됨)을 그대로 적용한다.

import { addVideo } from "./videos";
import { ensureWritePermission, saveFileToWorkspace, type Workspace } from "./workspace";
import { toKoreanTitle, extractHashtags } from "./titleTranslate";
import { extractVideoId, normalizeDownloadUrl } from "./platform";
import type { VideoItem } from "./types";

export const CONNECTOR_MSG = "clipminer:register";
export const CONNECTOR_RESULT = "clipminer:register:result";

export interface ConnectorPayload {
  platform: string;
  originalTitle: string;
  translatedTitle?: string;
  sourceUrl: string;
  videoUrl?: string;
  localFileName: string;
  fileSize: number;
  mimeType: string;
  /** mp4 본체(base64) — 작업 폴더 저장용 */
  bytesBase64: string;
  tags?: string[];
  memo?: string;
  favorite?: boolean;
  status?: string;
}

export type ConnectorResult =
  | { ok: true; status: "added"; id: string; title: string }
  | { ok: true; status: "duplicate"; id: string; title: string }
  | { ok: false; error: string };

function isVideoMime(mt: string): boolean {
  return /^video\//i.test(mt) || /\b(mp4|octet-stream)\b/i.test(mt);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * 확장 payload → 라이브러리 등록.
 * 성공 시 blob도 함께 반환(즉시 재생용 ObjectURL 등록에 사용). 결과 전송 시 blob은 제외할 것.
 */
export async function registerFromConnector(
  payload: ConnectorPayload,
  ctx: { workspace: Workspace | null; existing: VideoItem[] },
): Promise<ConnectorResult & { blob?: Blob }> {
  const mt = (payload?.mimeType || "").trim();
  // 2) content-type 검증 (image/* 등은 거부)
  if (!isVideoMime(mt)) {
    return { ok: false, error: `영상 파일이 아닙니다 (content-type: ${mt || "?"})` };
  }
  // 1) bytes 필수
  if (!payload.bytesBase64) return { ok: false, error: "파일 데이터(bytes)가 없습니다" };
  if (!payload.localFileName) return { ok: false, error: "파일명이 없습니다" };

  const original = (payload.originalTitle || "").trim();

  // 중복 방지: 영상 고유 ID(aweme_id/modal_id) 우선, 없으면 정규화 URL fallback.
  // (제목 기반 localFileName 일치로 판정하던 기존 방식은 서로 다른 영상을 오판해 제거)
  const payloadId = extractVideoId(payload.sourceUrl || "");
  const payloadNorm = normalizeDownloadUrl((payload.sourceUrl || "").trim());
  let dupBasis = "";
  const dup = ctx.existing.find((v) => {
    const vId = extractVideoId(v.url || "");
    // 양쪽 모두 영상 ID가 있으면 ID로만 비교 → 서로 다른 ID는 절대 중복 아님
    if (payloadId && vId) {
      if (payloadId === vId) {
        dupBasis = `videoId=${payloadId}`;
        return true;
      }
      return false;
    }
    // 한쪽이라도 ID가 없으면 정규화 URL 비교 (기존 데이터 fallback)
    if (payloadNorm && normalizeDownloadUrl((v.url || "").trim()) === payloadNorm) {
      dupBasis = `normalizedUrl=${payloadNorm}`;
      return true;
    }
    return false;
  });
  if (dup) {
    // 개발 로그: 어떤 기준으로 중복 판정했는지(사용자 UI 비노출)
    console.log(`[ClipMiner] 중복 판정 (${dupBasis}) → 기존 레코드 ${dup.id}`);
    return {
      ok: true,
      status: "duplicate",
      id: dup.id,
      title: dup.translatedTitle || dup.originalTitle || dup.title,
    };
  }

  // 저장 파일명 고유화: 영상 ID가 있으면 파일명에 부착해 서로 다른 영상이
  // 같은 파일명(예: 제목 추출 실패 시 douyin.mp4)으로 덮어쓰는 것을 방지.
  const localName = payloadId
    ? payload.localFileName.replace(/(\.[^.]+)?$/, (ext) => `_${payloadId}${ext || ".mp4"}`)
    : payload.localFileName;

  // 3) 작업 폴더 저장 (없으면 등록하지 않음)
  if (!ctx.workspace) return { ok: false, error: "작업 폴더가 연결되지 않았습니다" };
  const canWrite = await ensureWritePermission(ctx.workspace.handle);
  if (!canWrite) return { ok: false, error: "작업 폴더 쓰기 권한이 없습니다" };

  let blob: Blob;
  try {
    const bytes = base64ToBytes(payload.bytesBase64);
    blob = new Blob([bytes as BlobPart], { type: mt || "video/mp4" });
  } catch {
    return { ok: false, error: "파일 데이터 디코딩 실패" };
  }
  try {
    await saveFileToWorkspace(ctx.workspace.handle, localName, blob);
  } catch (e) {
    return { ok: false, error: "작업 폴더 저장 실패: " + (e instanceof Error ? e.message : String(e)) };
  }

  // 4) 번역/태그 (Desktop titleTranslate 흐름). 5) 등록
  const isCN = payload.platform === "douyin" || payload.platform === "xiaohongshu";
  const translated =
    payload.translatedTitle?.trim() || (isCN ? toKoreanTitle(original) : "");
  const tags =
    payload.tags && payload.tags.length ? payload.tags : extractHashtags(original);
  const display =
    translated || original || payload.localFileName.replace(/\.[^.]+$/, "") || "제목 없음";

  try {
    const item = await addVideo({
      url: payload.sourceUrl || "",
      title: display,
      originalTitle: original || undefined,
      translatedTitle: translated || undefined,
      tags,
      note: payload.memo || "",
      status: "idea", // unproduced = 미제작
      localFileName: localName,
      localFileType: mt || "video/mp4",
      localFileSize: payload.fileSize || blob.size,
    });
    return { ok: true, status: "added", id: item.id, title: display, blob };
  } catch (e) {
    return { ok: false, error: "라이브러리 등록 실패: " + (e instanceof Error ? e.message : String(e)) };
  }
}
