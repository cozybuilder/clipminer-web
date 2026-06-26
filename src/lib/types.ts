// ClipMiner Web — Local data layer types (Local-First / IndexedDB)

import type { Platform } from "./platform";

/** 영상 제작 상태 */
export type VideoStatus = "idea" | "in_progress" | "done";

/** 상태 표시 라벨 (UI 용) — ClipMiner Desktop 표기 기준 */
export const VIDEO_STATUS_LABELS: Record<VideoStatus, string> = {
  idea: "미제작",
  in_progress: "제작중",
  done: "제작완료",
};

/** 선택 가능한 상태 목록 (UI 셀렉트 순서 기준) */
export const VIDEO_STATUSES: VideoStatus[] = ["idea", "in_progress", "done"];

/**
 * 영상 메타데이터 레코드.
 * 실제 영상 파일은 이번 단계 범위 밖(로컬 폴더 저장은 이후 단계).
 */
export interface VideoItem {
  /** uuid (primary key) */
  id: string;
  /** 영상 원본 URL / 출처 */
  url: string;
  /** URL로부터 추정된 플랫폼 (schema v2) */
  platform: Platform;
  /** 사용자가 직접 입력한 제목 */
  title: string;
  /** 사용자가 직접 부착한 태그 (배열 필드) */
  tags: string[];
  /** 사용자 메모 */
  note: string;
  /** 제작 상태 */
  status: VideoStatus;
  /** 즐겨찾기 여부 (schema v3) */
  isFavorite: boolean;
  /**
   * 로컬 영상 파일 메타데이터 (schema v4).
   * 파일 본체/ObjectURL은 저장하지 않는다. 첨부 사실과 파일 정보만 보관하며,
   * 실제 File 객체는 현재 세션 메모리에만 존재한다(새로고침 시 재연결 필요).
   */
  localFileName?: string;
  localFileType?: string;
  localFileSize?: number;
  /** 생성 시각 (epoch ms) */
  createdAt: number;
  /** 수정 시각 (epoch ms) */
  updatedAt: number;
}

/** 태그 스토어 레코드 (이름이 primary key) */
export interface TagItem {
  /** 태그 이름 (primary key, 고유) */
  name: string;
  /** 최초 생성 시각 (epoch ms) */
  createdAt: number;
}

/** 영상 생성 입력 (id/타임스탬프는 데이터 계층에서 생성) */
export type NewVideoInput = Pick<
  VideoItem,
  "url" | "title" | "tags" | "note" | "status"
> &
  Partial<
    Pick<VideoItem, "localFileName" | "localFileType" | "localFileSize">
  >;

/** 영상 수정 입력 (변경할 필드만) */
export type VideoPatch = Partial<NewVideoInput>;
