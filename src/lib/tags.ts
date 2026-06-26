// ClipMiner Web — 태그 데이터 계층 (IndexedDB / Dexie)

import { db } from "./db";
import type { TagItem } from "./types";

/** 태그 이름 정규화: 앞뒤 공백 제거 */
function normalizeTag(name: string): string {
  return name.trim();
}

/**
 * 태그 1개 생성(없으면). 이미 있으면 기존 것을 유지한다.
 * 반환값: 정규화된 태그 이름 (빈 문자열이면 무시되고 null 반환)
 */
export async function createTag(name: string): Promise<string | null> {
  const normalized = normalizeTag(name);
  if (!normalized) return null;

  const existing = await db.tags.get(normalized);
  if (!existing) {
    await db.tags.put({ name: normalized, createdAt: Date.now() });
  }
  return normalized;
}

/** 여러 태그를 한 번에 보장(생성). 정규화·중복 제거된 이름 배열 반환 */
export async function ensureTags(names: string[]): Promise<string[]> {
  const normalized = Array.from(
    new Set(names.map(normalizeTag).filter(Boolean)),
  );
  if (normalized.length === 0) return [];

  const now = Date.now();
  const rows: TagItem[] = normalized.map((name) => ({ name, createdAt: now }));
  // put은 upsert지만 createdAt 덮어쓰기를 피하려 기존 존재분은 건드리지 않는다.
  const existing = await db.tags.bulkGet(normalized);
  const toInsert = rows.filter((_, i) => !existing[i]);
  if (toInsert.length > 0) {
    await db.tags.bulkPut(toInsert);
  }
  return normalized;
}

/** 모든 태그 조회 (이름 오름차순) */
export async function listTags(): Promise<TagItem[]> {
  return db.tags.orderBy("name").toArray();
}
