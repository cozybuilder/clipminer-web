// ClipMiner Web — IndexedDB (Dexie) database definition.
//
// Local-First: 모든 사용자 데이터는 브라우저 IndexedDB에 저장된다.
// 외부 DB / 서버 저장소 / 인증 없음.

import Dexie, { type EntityTable } from "dexie";
import type { TagItem, VideoItem } from "./types";
import { detectPlatform } from "./platform";

const DB_NAME = "clipminer";

/**
 * ClipMiner 로컬 데이터베이스.
 *
 * Dexie 인스턴스 생성 자체는 IndexedDB를 즉시 열지 않으므로
 * (실제 open은 첫 쿼리 시점), SSR/빌드 단계에서 모듈이 로드돼도 안전하다.
 */
export const db = new Dexie(DB_NAME) as Dexie & {
  videos: EntityTable<VideoItem, "id">;
  tags: EntityTable<TagItem, "name">;
};

// 스키마 v1
// - videos: id(PK), status/updatedAt/createdAt 인덱스, *tags multi-entry 인덱스
// - tags:   name(PK), createdAt 인덱스
db.version(1).stores({
  videos: "id, status, updatedAt, createdAt, *tags",
  tags: "name, createdAt",
});

// 스키마 v2
// - videos에 platform 인덱스 추가
// - 기존 레코드는 URL로부터 platform을 추정하여 백필
db.version(2)
  .stores({
    videos: "id, status, platform, updatedAt, createdAt, *tags",
    tags: "name, createdAt",
  })
  .upgrade(async (tx) => {
    await tx
      .table<VideoItem>("videos")
      .toCollection()
      .modify((v) => {
        if (!v.platform) v.platform = detectPlatform(v.url ?? "");
      });
  });

// 스키마 v3
// - videos에 isFavorite 추가(기본 false 백필).
//   IndexedDB는 boolean을 인덱스 키로 쓸 수 없어 인덱스 목록에는 넣지 않는다(메모리 필터 사용).
db.version(3)
  .stores({
    videos: "id, status, platform, updatedAt, createdAt, *tags",
    tags: "name, createdAt",
  })
  .upgrade(async (tx) => {
    await tx
      .table<VideoItem>("videos")
      .toCollection()
      .modify((v) => {
        if (v.isFavorite === undefined) v.isFavorite = false;
      });
  });
