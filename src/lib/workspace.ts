// ClipMiner Web — 작업 폴더 (File System Access API).
//
// 사용자가 선택한 디렉터리 핸들을 IndexedDB(settings 스토어)에 영속 저장한다.
// 핸들은 구조화 복제로 저장되며, 파일 본체/Blob은 저장하지 않는다.
// 새로고침 후에는 저장된 핸들에 대해 권한을 다시 확인/요청한다.

import { db } from "./db";

const WORKSPACE_KEY = "workspaceDir";

// 표준 lib.dom에 아직 없는 권한 메서드 보강
type PermissionMode = { mode?: "read" | "readwrite" };
type DirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (d?: PermissionMode) => Promise<PermissionState>;
  requestPermission?: (d?: PermissionMode) => Promise<PermissionState>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: PermissionMode) => Promise<FileSystemDirectoryHandle>;
  }
}

export interface Workspace {
  handle: DirHandle;
  name: string;
}

/** 브라우저가 File System Access 디렉터리 선택을 지원하는지 */
export function isFsAccessSupported(): boolean {
  return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

/** 작업 폴더 선택 (사용자 제스처 필요). 저장 후 반환 */
export async function pickWorkspace(): Promise<Workspace | null> {
  if (!isFsAccessSupported() || !window.showDirectoryPicker) return null;
  const handle = (await window.showDirectoryPicker({ mode: "read" })) as DirHandle;
  await db.settings.put({ key: WORKSPACE_KEY, handle, name: handle.name });
  return { handle, name: handle.name };
}

/** 저장된 작업 폴더 핸들 조회 (없으면 null) */
export async function getStoredWorkspace(): Promise<Workspace | null> {
  const row = await db.settings.get(WORKSPACE_KEY);
  if (!row || !row.handle) return null;
  const handle = row.handle as DirHandle;
  return { handle, name: row.name ?? handle.name };
}

/** 저장된 작업 폴더 해제 */
export async function clearWorkspace(): Promise<void> {
  await db.settings.delete(WORKSPACE_KEY);
}

/** 권한 상태 조회 (read). 메서드 미지원 시 granted 가정 */
export async function queryWorkspacePermission(
  handle: DirHandle,
): Promise<PermissionState> {
  if (!handle.queryPermission) return "granted";
  try {
    return await handle.queryPermission({ mode: "read" });
  } catch {
    return "prompt";
  }
}

/** 권한 요청 (사용자 제스처 필요). 메서드 미지원 시 granted 가정 */
export async function requestWorkspacePermission(
  handle: DirHandle,
): Promise<PermissionState> {
  if (!handle.requestPermission) return "granted";
  try {
    return await handle.requestPermission({ mode: "read" });
  } catch {
    return "denied";
  }
}

/** 쓰기 권한 확보 (사용자 제스처 필요). 다운로드 저장 전에 호출 */
export async function ensureWritePermission(handle: DirHandle): Promise<boolean> {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted")
    return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

/** 작업 폴더에 파일 저장 */
export async function saveFileToWorkspace(
  handle: FileSystemDirectoryHandle,
  name: string,
  data: Blob,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(data);
  await writable.close();
}

/** 작업 폴더에서 파일 읽기 (없으면 null) */
export async function readFileFromWorkspace(
  handle: FileSystemDirectoryHandle,
  name: string,
): Promise<File | null> {
  try {
    const fileHandle = await handle.getFileHandle(name);
    return await fileHandle.getFile();
  } catch {
    return null;
  }
}
