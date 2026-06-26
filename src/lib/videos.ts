// ClipMiner Web — 영상 데이터 계층 (IndexedDB / Dexie)

import { db } from "./db";
import { ensureTags } from "./tags";
import { detectPlatform } from "./platform";
import type { NewVideoInput, VideoItem, VideoPatch } from "./types";

/** uuid 생성 (브라우저 crypto 사용) */
function newId(): string {
  return crypto.randomUUID();
}

/**
 * 영상 추가.
 * - id/타임스탬프 자동 생성
 * - 부착된 태그는 tags 스토어에도 보장(생성)
 */
export async function addVideo(input: NewVideoInput): Promise<VideoItem> {
  const tags = await ensureTags(input.tags);
  const now = Date.now();
  const url = input.url.trim();
  const item: VideoItem = {
    id: newId(),
    url,
    platform: detectPlatform(url),
    title: input.title.trim(),
    tags,
    note: input.note,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  await db.videos.add(item);
  return item;
}

/** 영상 목록 조회 (최신 수정순) */
export async function listVideos(): Promise<VideoItem[]> {
  return db.videos.orderBy("updatedAt").reverse().toArray();
}

/** 영상 단건 조회 */
export async function getVideo(id: string): Promise<VideoItem | undefined> {
  return db.videos.get(id);
}

/**
 * 영상 수정.
 * - 전달된 필드만 변경, updatedAt 갱신
 * - 태그가 바뀌면 tags 스토어에도 보장(생성)
 */
export async function updateVideo(
  id: string,
  patch: VideoPatch,
): Promise<VideoItem | undefined> {
  const next: VideoPatch & { updatedAt: number } = {
    ...patch,
    updatedAt: Date.now(),
  };
  if (patch.tags) {
    next.tags = await ensureTags(patch.tags);
  }
  await db.videos.update(id, next);
  return db.videos.get(id);
}

/** 영상 삭제 */
export async function deleteVideo(id: string): Promise<void> {
  await db.videos.delete(id);
}
