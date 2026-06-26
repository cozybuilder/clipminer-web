"use client";

// ClipMiner Web — Video Library.
// ClipMiner Desktop(v0.1.1) 사용감 재현. Local-First: 데이터는 IndexedDB(Dexie).
// 로컬 영상 파일은 서버/IndexedDB에 저장하지 않는다. File 객체는 현재 세션 메모리에만 보관하고,
// 파일 메타데이터(이름/형식/크기)만 IndexedDB에 저장한다. 새로고침 시 파일은 재연결 필요.

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Film,
  Search,
  Plus,
  Trash2,
  X,
  ArrowDownUp,
  Circle,
  Clapperboard,
  CheckCircle2,
  Copy,
  Check,
  Pencil,
  Calendar,
  Tag as TagIcon,
  FileText,
  ExternalLink,
  Star,
  StarOff,
  CheckSquare,
  FileVideo,
  Upload,
  RotateCw,
  Folder,
  FolderOpen,
  FolderX,
  Download,
} from "lucide-react";
import {
  VIDEO_STATUSES,
  VIDEO_STATUS_LABELS,
  type VideoItem,
  type VideoStatus,
} from "@/lib/types";
import {
  addVideo,
  deleteVideo,
  listVideos,
  updateVideo,
  setFavorite,
  bulkSetStatus,
  bulkSetFavorite,
  bulkDelete,
} from "@/lib/videos";
import { getThumbnail } from "@/lib/thumbnail";
import {
  detectPlatform,
  PLATFORM_BADGE,
  PLATFORM_LABELS,
  type Platform,
} from "@/lib/platform";
import {
  isFsAccessSupported,
  pickWorkspace,
  getStoredWorkspace,
  clearWorkspace,
  queryWorkspacePermission,
  requestWorkspacePermission,
  readFileFromWorkspace,
  type Workspace,
} from "@/lib/workspace";
import {
  CONNECTOR_MSG,
  CONNECTOR_RESULT,
  registerFromConnector,
  type ConnectorPayload,
} from "@/lib/connector";

type StatusFilter = "all" | VideoStatus | "favorite";
type SortKey = "updated" | "created" | "title";

const STATUS_BADGE: Record<VideoStatus, string> = {
  idea: "bg-subtext/15 text-subtext border-subtext/30",
  in_progress: "bg-accent/15 text-accent border-accent/30",
  done: "bg-primary/20 text-primary border-primary/40",
};

// Desktop 기본 추천 태그 (1차)
const RECOMMENDED_TAGS = [
  "수납",
  "주방",
  "욕실",
  "생활용품",
  "청소",
  "아이디어",
  "육아",
  "캠핑",
  "자동차",
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "");

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function isVideoFile(file: File): boolean {
  return file.type.startsWith("video/");
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
}

function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PLATFORM_BADGE[platform]}`}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        copyText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="flex items-center gap-1.5 text-xs text-subtext transition-colors hover:text-primary"
      title="URL 복사"
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {label && <span>{copied ? "복사됨" : label}</span>}
    </button>
  );
}

export default function VideoLibraryPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [adding, setAdding] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 현재 세션의 로컬 파일 ObjectURL (id → blob: URL). 새로고침 시 사라짐(의도).
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  function registerFile(id: string, file: File) {
    const url = URL.createObjectURL(file);
    setFileUrls((prev) => {
      if (prev[id]) URL.revokeObjectURL(prev[id]);
      return { ...prev, [id]: url };
    });
  }
  function forgetFile(id: string) {
    setFileUrls((prev) => {
      if (prev[id]) URL.revokeObjectURL(prev[id]);
      const { [id]: _omit, ...rest } = prev;
      void _omit;
      return rest;
    });
  }

  // 작업 폴더 (File System Access)
  const [fsSupported, setFsSupported] = useState(false);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspacePerm, setWorkspacePerm] = useState<PermissionState | null>(
    null,
  );

  // Browser Connector 수신 배너
  const [connectorBanner, setConnectorBanner] = useState<{
    kind: "ok" | "dup" | "err" | "info";
    text: string;
  } | null>(null);

  async function refresh() {
    setVideos(await listVideos());
  }

  // 확장 등록 핸들러 — 항상 최신 상태(workspace/videos)를 보도록 ref로 보관
  const connectorHandlerRef = useRef<
    (payload: ConnectorPayload) => Promise<unknown>
  >(async () => undefined);
  connectorHandlerRef.current = async (payload: ConnectorPayload) => {
    setConnectorBanner({ kind: "info", text: "등록 처리 중…" });
    const res = await registerFromConnector(payload, {
      workspace,
      existing: videos,
    });
    if (res.ok && res.status === "added") {
      if (res.blob) registerFile(res.id, new File([res.blob], payload.localFileName));
      await refresh();
      setConnectorBanner({ kind: "ok", text: `ClipMiner Web 등록 완료 · ${res.title}` });
    } else if (res.ok && res.status === "duplicate") {
      setConnectorBanner({ kind: "dup", text: `이미 등록된 영상 · ${res.title}` });
    } else if (!res.ok) {
      setConnectorBanner({ kind: "err", text: `등록 실패 · ${res.error}` });
    }
    const clean = { ...res };
    delete (clean as { blob?: Blob }).blob;
    return clean;
  };

  // 확장 → window.postMessage 수신
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; payload?: ConnectorPayload };
      if (!d || d.type !== CONNECTOR_MSG || !d.payload) return;
      void (async () => {
        const result = await connectorHandlerRef.current(d.payload!);
        window.postMessage({ type: CONNECTOR_RESULT, result }, "*");
      })();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const items = await listVideos();
      const supported = isFsAccessSupported();
      const ws = supported ? await getStoredWorkspace() : null;
      const perm = ws ? await queryWorkspacePermission(ws.handle) : null;
      if (active) {
        setVideos(items);
        setLoading(false);
        setFsSupported(supported);
        setWorkspace(ws);
        setWorkspacePerm(perm);
      }
      // 작업 폴더 권한이 있으면 로컬 파일을 자동 재연결(새로고침 후 재생 복원)
      if (active && ws && perm === "granted") {
        const map: Record<string, string> = {};
        for (const v of items) {
          if (!v.localFileName) continue;
          const file = await readFileFromWorkspace(ws.handle, v.localFileName);
          if (file) map[v.id] = URL.createObjectURL(file);
        }
        if (active && Object.keys(map).length > 0) {
          setFileUrls((prev) => ({ ...map, ...prev }));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handlePickWorkspace() {
    try {
      const ws = await pickWorkspace();
      if (ws) {
        setWorkspace(ws);
        setWorkspacePerm(await queryWorkspacePermission(ws.handle));
      }
    } catch {
      // 사용자가 선택 취소 — 무시
    }
  }
  async function handleReauthWorkspace() {
    if (!workspace) return;
    const perm = await requestWorkspacePermission(workspace.handle);
    setWorkspacePerm(perm);
  }
  async function handleClearWorkspace() {
    await clearWorkspace();
    setWorkspace(null);
    setWorkspacePerm(null);
  }

  // 필터/검색이 바뀌면 선택 초기화
  function changeStatusFilter(f: StatusFilter) {
    setStatusFilter(f);
    setSelected(new Set());
  }
  function changeTagFilter(t: string | null) {
    setTagFilter(t);
    setSelected(new Set());
  }
  function changeQuery(q: string) {
    setQuery(q);
    setSelected(new Set());
  }

  async function handleDelete(id: string) {
    if (!window.confirm("이 영상을 삭제하시겠습니까?")) return;
    await deleteVideo(id);
    forgetFile(id);
    if (detailId === id) setDetailId(null);
    await refresh();
  }

  async function handleStatusChange(id: string, next: VideoStatus) {
    await updateVideo(id, { status: next });
    await refresh();
  }

  async function handleMemoSave(id: string, note: string) {
    await updateVideo(id, { note });
    await refresh();
  }

  // 제목 수정(관리용 = translatedTitle/title). 사용자가 수정하면 그대로 유지(자동 재번역 없음)
  async function handleTitleSave(id: string, title: string) {
    await updateVideo(id, { title, translatedTitle: title });
    await refresh();
  }

  async function handleTagsChange(id: string, tags: string[]) {
    await updateVideo(id, { tags });
    await refresh();
  }

  async function handleToggleFavorite(id: string, value: boolean) {
    await setFavorite(id, value);
    await refresh();
  }

  // 로컬 파일 (재)연결: 세션 ObjectURL 등록 + 메타데이터 갱신
  async function handleAttachFile(id: string, file: File) {
    registerFile(id, file);
    await updateVideo(id, {
      localFileName: file.name,
      localFileType: file.type,
      localFileSize: file.size,
    });
    await refresh();
  }

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: videos.length,
      idea: 0,
      in_progress: 0,
      done: 0,
      favorite: 0,
    };
    for (const v of videos) {
      c[v.status] += 1;
      if (v.isFavorite && v.status !== "done") c.favorite += 1;
    }
    return c;
  }, [videos]);

  const tagList = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of videos)
      for (const t of v.tags) map.set(t, (map.get(t) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [videos]);

  const results = useMemo(() => {
    const q = norm(query);
    const filtered = videos.filter((v) => {
      if (statusFilter === "favorite") {
        if (!v.isFavorite || v.status === "done") return false;
      } else if (statusFilter !== "all" && v.status !== statusFilter) {
        return false;
      }
      if (tagFilter && !v.tags.includes(tagFilter)) return false;
      if (q) {
        const hay = norm(
          [v.title, v.translatedTitle, v.originalTitle, v.url, v.note, ...v.tags]
            .filter(Boolean)
            .join(" "),
        );
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const sorted = [...filtered];
    if (sort === "updated") sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    else if (sort === "created")
      sorted.sort((a, b) => a.createdAt - b.createdAt);
    else sorted.sort((a, b) => a.title.localeCompare(b.title, "ko"));
    return sorted;
  }, [videos, statusFilter, tagFilter, query, sort]);

  // ── 다중선택 ──
  const visibleIds = results.map((v) => v.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(visibleIds));
  }
  async function handleBulkProduced() {
    if (selected.size === 0) return;
    await bulkSetStatus([...selected], "done");
    setSelected(new Set());
    await refresh();
  }
  async function handleBulkFavorite(value: boolean) {
    if (selected.size === 0) return;
    await bulkSetFavorite([...selected], value);
    setSelected(new Set());
    await refresh();
  }
  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!window.confirm(`선택한 영상 ${selected.size}개를 삭제하시겠습니까?`))
      return;
    const ids = [...selected];
    await bulkDelete(ids);
    ids.forEach(forgetFile);
    setSelected(new Set());
    await refresh();
  }

  const stats: {
    key: StatusFilter;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: "all", label: "전체", icon: <Film size={18} /> },
    { key: "idea", label: VIDEO_STATUS_LABELS.idea, icon: <Circle size={18} /> },
    {
      key: "in_progress",
      label: VIDEO_STATUS_LABELS.in_progress,
      icon: <Clapperboard size={18} />,
    },
    {
      key: "done",
      label: VIDEO_STATUS_LABELS.done,
      icon: <CheckCircle2 size={18} />,
    },
    { key: "favorite", label: "즐겨찾기(미제작)", icon: <Star size={18} /> },
  ];

  const activeLabel = stats.find((s) => s.key === statusFilter)?.label;
  const detailVideo = detailId
    ? videos.find((v) => v.id === detailId) ?? null
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      {/* ───────── 헤더 ───────── */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center gap-4 px-6 py-4">
          <Link href="/" className="mr-2 flex shrink-0 items-center gap-2.5" title="홈으로">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Film size={16} className="text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">ClipMiner</span>
          </Link>

          <div className="relative max-w-md flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-subtext"
            />
            <input
              type="text"
              placeholder="제목·태그·메모 검색..."
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              className="w-full rounded-xl border border-border bg-card py-2 pl-9 pr-4 text-sm text-text placeholder:text-subtext transition-colors focus:border-primary/60 focus:outline-none"
            />
          </div>

          <div className="flex-1" />

          <div className="relative hidden sm:block">
            <ArrowDownUp
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtext"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="appearance-none rounded-xl border border-border bg-card py-2 pl-8 pr-8 text-sm text-text transition-colors focus:border-primary/60 focus:outline-none"
            >
              <option value="updated">최근 수정순</option>
              <option value="created">등록 오래된순</option>
              <option value="title">제목순</option>
            </select>
          </div>

          <Link
            href="/download"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-sm font-medium text-subtext transition-colors hover:border-primary/50 hover:text-text"
            title="확장으로 수집 (안내/연결 상태)"
          >
            <Download size={15} />
            수집
          </Link>

          <button
            onClick={() => setAdding(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <Plus size={15} />
            영상 추가
          </button>
        </div>
      </header>

      {/* ───────── 메인 ───────── */}
      <main className="mx-auto w-full max-w-[1440px] flex-1 space-y-6 px-6 py-6">
        {/* Browser Connector 등록 결과 배너 */}
        {connectorBanner && (
          <div
            className={`flex items-center justify-between gap-3 rounded-card border px-4 py-3 text-sm ${
              connectorBanner.kind === "ok"
                ? "border-primary/30 bg-primary/10 text-primary"
                : connectorBanner.kind === "dup"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                  : connectorBanner.kind === "err"
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-border bg-card text-subtext"
            }`}
          >
            <span className="break-words">{connectorBanner.text}</span>
            <button
              onClick={() => setConnectorBanner(null)}
              className="shrink-0 text-xs opacity-70 hover:opacity-100"
            >
              닫기
            </button>
          </div>
        )}

        {/* 작업 폴더 (File System Access) */}
        <WorkspaceBar
          supported={fsSupported}
          workspace={workspace}
          permission={workspacePerm}
          onPick={handlePickWorkspace}
          onReauth={handleReauthWorkspace}
          onClear={handleClearWorkspace}
        />

        {/* StatCard 필터 */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <StatCard
              key={s.key}
              label={s.label}
              value={counts[s.key]}
              icon={s.icon}
              active={statusFilter === s.key}
              onClick={() => changeStatusFilter(s.key)}
            />
          ))}
        </div>

        {/* 보조 태그 필터 라인 */}
        {tagList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-widest text-subtext">
              태그
            </span>
            <button
              onClick={() => changeTagFilter(null)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                tagFilter === null
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-subtext hover:text-text"
              }`}
            >
              전체
            </button>
            {tagList.map(([name, n]) => (
              <button
                key={name}
                onClick={() => changeTagFilter(tagFilter === name ? null : name)}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  tagFilter === name
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-card text-subtext hover:text-text"
                }`}
              >
                #{name} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}

        {/* 결과 카운트 + 일괄 작업 바 */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-subtext">
            {query ? `검색 결과 ${results.length}개` : `${activeLabel}영상 ${results.length}개`}
            {tagFilter && <span className="text-primary"> · #{tagFilter}</span>}
            {selected.size > 0 && (
              <span className="text-primary"> · {selected.size}개 선택</span>
            )}
          </p>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {/* 순서: 선택 삭제(맨왼쪽) → 제작완료 → 즐겨찾기 추가 → 즐겨찾기 해제 → 선택 해제/전체 선택(맨오른쪽) */}
            {selected.size > 0 && (
              <>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/25"
                >
                  <Trash2 size={14} /> 선택 삭제 ({selected.size})
                </button>
                <button
                  onClick={handleBulkProduced}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/20"
                >
                  <CheckCircle2 size={14} /> 제작완료
                </button>
                <button
                  onClick={() => handleBulkFavorite(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-subtext transition-colors hover:border-primary/50 hover:text-primary"
                >
                  <Star size={14} /> 즐겨찾기 추가
                </button>
                <button
                  onClick={() => handleBulkFavorite(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-subtext transition-colors hover:border-border/80 hover:text-text"
                >
                  <StarOff size={14} /> 즐겨찾기 해제
                </button>
              </>
            )}
            {results.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-subtext transition-colors hover:border-border/80 hover:text-text"
              >
                <CheckSquare size={14} />
                {allSelected ? "선택 해제" : "전체 선택"}
              </button>
            )}
          </div>
        </div>

        {/* 그리드 */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-subtext">
            <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm">영상 로딩 중...</p>
          </div>
        ) : videos.length === 0 ? (
          <EmptyState
            title="아직 저장된 영상이 없습니다"
            desc="우측 상단 ‘영상 추가’로 첫 영상을 등록하세요. 데이터는 이 브라우저에 저장됩니다."
          />
        ) : results.length === 0 ? (
          <EmptyState
            title="조건에 맞는 영상이 없습니다"
            desc="다른 키워드나 필터를 시도해보세요"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {results.map((v) => (
              <VideoCard
                key={v.id}
                video={v}
                fileUrl={fileUrls[v.id]}
                selected={selected.has(v.id)}
                onToggleSelect={toggleSelect}
                onToggleFavorite={handleToggleFavorite}
                onOpen={setDetailId}
                onStatusChange={handleStatusChange}
                onTagClick={changeTagFilter}
              />
            ))}
          </div>
        )}
      </main>

      {adding && (
        <AddVideoModal
          onClose={() => setAdding(false)}
          onSaved={async (id, file) => {
            setAdding(false);
            if (file) registerFile(id, file);
            await refresh();
          }}
        />
      )}

      {detailVideo && (
        <DetailModal
          video={detailVideo}
          fileUrl={fileUrls[detailVideo.id]}
          onClose={() => setDetailId(null)}
          onStatusChange={handleStatusChange}
          onMemoSave={handleMemoSave}
          onTitleSave={handleTitleSave}
          onTagsChange={handleTagsChange}
          onToggleFavorite={handleToggleFavorite}
          onAttachFile={handleAttachFile}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

// ───────── 작업 폴더 바 ─────────
function WorkspaceBar({
  supported,
  workspace,
  permission,
  onPick,
  onReauth,
  onClear,
}: {
  supported: boolean;
  workspace: Workspace | null;
  permission: PermissionState | null;
  onPick: () => void;
  onReauth: () => void;
  onClear: () => void;
}) {
  // 미지원 브라우저 안내
  if (!supported) {
    return (
      <div className="flex items-center gap-2.5 rounded-card border border-border bg-card px-4 py-3 text-sm text-subtext">
        <FolderX size={16} className="shrink-0" />
        <span>
          이 브라우저는 작업 폴더 연결(File System Access)을 지원하지 않습니다.
          Chrome·Edge 등 데스크톱 브라우저에서 사용하세요. (로컬 파일 첨부는 계속 사용 가능)
        </span>
      </div>
    );
  }

  // 폴더 미선택
  if (!workspace) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2.5 text-sm text-subtext">
          <Folder size={16} className="shrink-0" />
          <span>작업 폴더를 선택하면 영상 파일을 폴더 기준으로 관리할 수 있습니다.</span>
        </div>
        <button
          onClick={onPick}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <FolderOpen size={15} /> 작업 폴더 선택
        </button>
      </div>
    );
  }

  const granted = permission === "granted";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2.5 text-sm">
        <FolderOpen
          size={16}
          className={granted ? "text-primary" : "text-amber-400"}
        />
        <span className="text-subtext">작업 폴더</span>
        <span className="font-medium text-text">{workspace.name}</span>
        {granted ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs text-primary">
            연결됨
          </span>
        ) : (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
            권한 필요
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {!granted && (
          <button
            onClick={onReauth}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
          >
            <RotateCw size={14} /> 권한 다시 허용
          </button>
        )}
        <button
          onClick={onPick}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-subtext transition-colors hover:border-border/80 hover:text-text"
        >
          변경
        </button>
        <button
          onClick={onClear}
          className="rounded-xl border border-border bg-card px-3 py-1.5 text-sm text-subtext transition-colors hover:border-red-500/40 hover:text-red-400"
        >
          해제
        </button>
      </div>
    </div>
  );
}

// ───────── StatCard ─────────
function StatCard({
  label,
  value,
  icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-4 rounded-card border bg-card p-4 text-left transition-colors hover:border-primary/60 ${
        active ? "border-primary ring-1 ring-primary/40" : "border-border"
      }`}
    >
      <div
        className={`rounded-xl p-2.5 ${
          active ? "bg-primary/15 text-primary" : "bg-border/60 text-subtext"
        }`}
      >
        {icon}
      </div>
      <div>
        <p className="mb-0.5 text-xs text-subtext">{label}</p>
        <p className="text-xl font-semibold text-text">{value}</p>
      </div>
    </button>
  );
}

// ───────── 영상 카드 ─────────
function VideoCard({
  video,
  fileUrl,
  selected,
  onToggleSelect,
  onToggleFavorite,
  onOpen,
  onStatusChange,
  onTagClick,
}: {
  video: VideoItem;
  fileUrl?: string;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string, value: boolean) => void;
  onOpen: (id: string) => void;
  onStatusChange: (id: string, s: VideoStatus) => void;
  onTagClick: (t: string) => void;
}) {
  const thumb = getThumbnail(video.url);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const needsRelink = !fileUrl && !!video.localFileName;

  // Hover 자동 재생 (Desktop 동일): 진입 500ms 후 재생, 이탈 시 정지+첫 프레임, 단일 재생, 모바일 비활성
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
  }, []);
  function startHover() {
    if (!fileUrl) return;
    if (typeof window !== "undefined" && window.matchMedia && !window.matchMedia("(hover: hover)").matches)
      return; // 모바일/터치 비활성
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => {
      // 현재 카드만 재생 — 나머지 영상 정지
      document
        .querySelectorAll<HTMLVideoElement>("video[data-cm-video]")
        .forEach((v) => {
          if (v !== videoRef.current) {
            v.pause();
            v.currentTime = 0;
          }
        });
      videoRef.current?.play().catch(() => {});
    }, 500);
  }
  function endHover() {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
  }

  const bigTitle = video.translatedTitle || video.title || video.originalTitle || "(제목 없음)";
  const smallTitle =
    video.originalTitle && video.originalTitle !== bigTitle ? video.originalTitle : "";

  return (
    <div
      onClick={() => onOpen(video.id)}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-card border bg-card transition-all duration-200 hover:shadow-lg hover:shadow-primary/5 ${
        selected
          ? "border-primary ring-2 ring-primary/50"
          : "border-border hover:border-primary/50"
      }`}
    >
      {/* 썸네일 / 로컬 영상 */}
      <div
        className="relative aspect-[9/16] overflow-hidden bg-border"
        onMouseEnter={startHover}
        onMouseLeave={endHover}
      >
        {fileUrl ? (
          <video
            ref={videoRef}
            data-cm-video
            src={fileUrl}
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : thumb ? (
          // 외부 썸네일 — next/image 대신 일반 img (도메인 비고정)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : needsRelink ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-2 text-center text-subtext/50">
            <FileVideo size={26} />
            <span className="text-xs">로컬 파일</span>
            <span className="text-[10px] leading-tight">재연결 필요</span>
          </div>
        ) : (
          <ThumbPlaceholder />
        )}

        {/* 선택 체크박스 (좌상단) */}
        <button
          onClick={(e) => {
            stop(e);
            onToggleSelect(video.id);
          }}
          className={`absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
            selected
              ? "border-primary bg-primary text-white opacity-100"
              : "border-white/70 bg-black/40 text-transparent opacity-0 group-hover:opacity-100"
          }`}
          title={selected ? "선택 해제" : "선택"}
        >
          <Check size={14} />
        </button>

        {/* 즐겨찾기 (우상단) */}
        <button
          onClick={(e) => {
            stop(e);
            onToggleFavorite(video.id, !video.isFavorite);
          }}
          className="absolute right-2 top-2 rounded-full bg-black/40 p-1.5 backdrop-blur-sm transition-colors hover:bg-black/60"
          title={video.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
        >
          <Star
            size={16}
            className={video.isFavorite ? "fill-primary text-primary" : "text-white/70"}
          />
        </button>

        {/* 좌하단: 플랫폼 배지 + 로컬 파일 표시 */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1">
          <PlatformBadge platform={video.platform} />
          {video.localFileName && (
            <span
              className="flex items-center rounded-full border border-border bg-black/50 p-1 text-white/80"
              title={fileUrl ? "로컬 영상 연결됨" : "로컬 파일 (재연결 필요)"}
            >
              <FileVideo size={11} />
            </span>
          )}
        </div>

        {/* 상태 배지 (우하단) */}
        <span
          className={`absolute bottom-2 right-2 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[video.status]}`}
        >
          {VIDEO_STATUS_LABELS[video.status]}
        </span>
      </div>

      {/* 정보 */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <p className="line-clamp-2 text-sm font-medium leading-snug text-text">
            {bigTitle}
          </p>
          {smallTitle && (
            <p className="line-clamp-1 text-xs leading-snug text-subtext/80">
              {smallTitle}
            </p>
          )}
        </div>

        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.map((t) => (
              <button
                key={t}
                onClick={(e) => {
                  stop(e);
                  onTagClick(t);
                }}
                className="rounded bg-background px-1.5 py-0.5 text-xs text-subtext transition-colors hover:text-primary"
              >
                #{t}
              </button>
            ))}
          </div>
        )}

        {video.note && (
          <p className="line-clamp-2 text-xs leading-relaxed text-subtext">
            {video.note}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <select
            value={video.status}
            onClick={stop}
            onChange={(e) => {
              stop(e);
              onStatusChange(video.id, e.target.value as VideoStatus);
            }}
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-text focus:border-primary/60 focus:outline-none"
            title="상태 변경"
          >
            {VIDEO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VIDEO_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-2">
            <CopyButton text={video.url} />
            <span className="text-xs text-subtext/60">
              {formatDate(video.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThumbPlaceholder() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-subtext/40">
      <Film size={28} />
      <span className="text-xs">No Preview</span>
    </div>
  );
}

// ───────── 상세 모달 ─────────
function DetailModal({
  video,
  fileUrl,
  onClose,
  onStatusChange,
  onMemoSave,
  onTitleSave,
  onTagsChange,
  onToggleFavorite,
  onAttachFile,
  onDelete,
}: {
  video: VideoItem;
  fileUrl?: string;
  onClose: () => void;
  onStatusChange: (id: string, s: VideoStatus) => void;
  onMemoSave: (id: string, note: string) => void;
  onTitleSave: (id: string, title: string) => void;
  onTagsChange: (id: string, tags: string[]) => void;
  onToggleFavorite: (id: string, value: boolean) => void;
  onAttachFile: (id: string, file: File) => void;
  onDelete: (id: string) => void;
}) {
  const thumb = getThumbnail(video.url);
  const [memoEditing, setMemoEditing] = useState(false);
  const [memoDraft, setMemoDraft] = useState(video.note);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const bigTitle = video.translatedTitle || video.title || video.originalTitle || "(제목 없음)";

  function startTitleEdit() {
    setTitleDraft(bigTitle === "(제목 없음)" ? "" : bigTitle);
    setTitleEditing(true);
  }
  function saveTitle() {
    const t = titleDraft.trim();
    if (t) onTitleSave(video.id, t);
    setTitleEditing(false);
  }
  function addTag(tag: string) {
    if (video.tags.includes(tag)) return; // 중복 금지
    onTagsChange(video.id, [...video.tags, tag]);
  }
  function removeTag(tag: string) {
    onTagsChange(
      video.id,
      video.tags.filter((t) => t !== tag),
    );
  }

  // 상세 모달이 열리면(로컬 파일 연결 시) 즉시 무음 자동 재생
  useEffect(() => {
    const el = videoRef.current;
    if (el && fileUrl) {
      el.muted = true;
      void el.play().catch(() => {});
    }
  }, [fileUrl]);

  function startEdit() {
    setMemoDraft(video.note);
    setMemoEditing(true);
  }
  async function saveMemo() {
    await onMemoSave(video.id, memoDraft.trim());
    setMemoEditing(false);
  }
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isVideoFile(file)) {
      window.alert("영상 파일(mp4/webm/mov 등)만 첨부할 수 있습니다.");
      return;
    }
    onAttachFile(video.id, file);
  }

  const needsRelink = !fileUrl && !!video.localFileName;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-border bg-card shadow-2xl shadow-black/40">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <PlatformBadge platform={video.platform} />
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[video.status]}`}
            >
              {VIDEO_STATUS_LABELS[video.status]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(video.id, !video.isFavorite)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${
                video.isFavorite
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-card text-subtext hover:text-text"
              }`}
            >
              <Star size={15} className={video.isFavorite ? "fill-primary" : ""} />
              {video.isFavorite ? "즐겨찾기 해제" : "즐겨찾기"}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-subtext transition-colors hover:bg-border/60 hover:text-text"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 md:grid-cols-[260px_1fr]">
          {/* 미리보기 영역 */}
          <div className="mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-card border border-border bg-border">
            {fileUrl ? (
              <video
                ref={videoRef}
                src={fileUrl}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="h-full w-full object-contain"
              />
            ) : thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={video.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <ThumbPlaceholder />
            )}
          </div>

          {/* 정보 */}
          <div className="flex flex-col gap-4">
            {/* 제목 (번역 크게 / 원문 작게, 수정 가능) */}
            <div>
              {titleEditing ? (
                <div className="flex flex-col gap-2">
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveTitle();
                      if (e.key === "Escape") setTitleEditing(false);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-lg font-semibold text-text focus:border-primary/60 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveTitle}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/90"
                    >
                      <Check size={12} /> 저장
                    </button>
                    <button
                      onClick={() => setTitleEditing(false)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-subtext transition-colors hover:text-text"
                    >
                      <X size={12} /> 취소
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group/title flex items-start justify-between gap-2">
                  <div>
                    <h1 className="text-xl font-semibold leading-snug text-text">
                      {bigTitle}
                    </h1>
                    {video.originalTitle && video.originalTitle !== bigTitle && (
                      <p className="mt-0.5 text-sm text-subtext">{video.originalTitle}</p>
                    )}
                  </div>
                  <button
                    onClick={startTitleEdit}
                    className="shrink-0 rounded-lg p-1.5 text-subtext transition-colors hover:bg-border/60 hover:text-text"
                    title="제목 수정"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>

            <InfoRow icon={<Calendar size={15} />} label="등록일">
              <span className="text-sm text-text">
                {formatDate(video.createdAt)}
                {video.updatedAt !== video.createdAt && (
                  <span className="text-subtext"> · 수정 {formatDate(video.updatedAt)}</span>
                )}
              </span>
            </InfoRow>

            {/* URL */}
            <div className="rounded-card border border-border bg-background p-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs text-subtext">영상 URL</p>
                {video.url && (
                  <div className="flex items-center gap-3">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-subtext transition-colors hover:text-primary"
                    >
                      <ExternalLink size={12} /> 열기
                    </a>
                    <CopyButton text={video.url} label="복사" />
                  </div>
                )}
              </div>
              <p className="break-all font-mono text-sm leading-relaxed text-text">
                {video.url || "URL 없음"}
              </p>
            </div>

            {/* 로컬 영상 */}
            <div className="rounded-card border border-border bg-background p-4">
              <div className="mb-2 flex items-center gap-2">
                <FileVideo size={14} className="text-subtext" />
                <p className="text-xs text-subtext">로컬 영상</p>
              </div>

              {video.localFileName ? (
                <div className="space-y-2">
                  <p className="break-all font-mono text-sm text-text">
                    {video.localFileName}
                  </p>
                  <p className="text-xs text-subtext">
                    {video.localFileType || "video"}
                    {video.localFileSize
                      ? ` · ${formatFileSize(video.localFileSize)}`
                      : ""}
                  </p>
                  {fileUrl ? (
                    <p className="text-xs text-accent">
                      현재 세션에서 재생 중 — 위 미리보기에서 재생할 수 있습니다.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-400">
                      이 브라우저 세션에 파일 객체가 없습니다. 로컬 파일을 다시 연결하세요.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-subtext/50">연결된 로컬 파일 없음</p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onPickFile}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-subtext transition-colors hover:border-primary/50 hover:text-text"
              >
                {needsRelink ? <RotateCw size={12} /> : <Upload size={12} />}
                {video.localFileName ? "다시 연결" : "로컬 파일 연결"}
              </button>
            </div>

            {/* 태그 */}
            <div className="rounded-card border border-border bg-background p-4">
              <div className="mb-2 flex items-center gap-2">
                <TagIcon size={14} className="text-subtext" />
                <p className="text-xs text-subtext">태그</p>
              </div>
              {video.tags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {video.tags.map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs text-primary"
                    >
                      #{t}
                      <button
                        onClick={() => removeTag(t)}
                        className="opacity-60 hover:opacity-100"
                        title="태그 제거"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-subtext/50">태그 없음</p>
              )}

              {/* 추천 태그 (클릭 시 추가, 중복 제외) */}
              {RECOMMENDED_TAGS.some((t) => !video.tags.includes(t)) && (
                <div className="mt-3 border-t border-border/60 pt-3">
                  <p className="mb-1.5 text-xs text-subtext/70">추천 태그</p>
                  <div className="flex flex-wrap gap-1.5">
                    {RECOMMENDED_TAGS.filter((t) => !video.tags.includes(t)).map((t) => (
                      <button
                        key={t}
                        onClick={() => addTag(t)}
                        className="rounded-full border border-border bg-card px-2.5 py-1 text-xs text-subtext transition-colors hover:border-primary/50 hover:text-primary"
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 제작 상태 */}
            <div className="rounded-card border border-border bg-background p-4">
              <div className="mb-2 flex items-center gap-2">
                <Clapperboard size={14} className="text-subtext" />
                <p className="text-xs text-subtext">제작 상태</p>
              </div>
              <div className="flex gap-2">
                {VIDEO_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => onStatusChange(video.id, s)}
                    className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                      video.status === s
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-card text-subtext hover:text-text"
                    }`}
                  >
                    {VIDEO_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div className="rounded-card border border-border bg-background p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-subtext" />
                  <p className="text-xs text-subtext">메모</p>
                </div>
                {!memoEditing && (
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1.5 text-xs text-subtext transition-colors hover:text-primary"
                  >
                    <Pencil size={12} /> 수정
                  </button>
                )}
              </div>
              {memoEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={memoDraft}
                    onChange={(e) => setMemoDraft(e.target.value)}
                    rows={4}
                    autoFocus
                    placeholder="이 영상에 대한 메모를 입력하세요..."
                    className="w-full resize-none rounded-xl border border-border bg-card px-3 py-2 text-sm leading-relaxed text-text placeholder:text-subtext/50 focus:border-primary/60 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={saveMemo}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-white transition-colors hover:bg-primary/90"
                    >
                      <Check size={12} /> 저장
                    </button>
                    <button
                      onClick={() => setMemoEditing(false)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-subtext transition-colors hover:text-text"
                    >
                      <X size={12} /> 취소
                    </button>
                  </div>
                </div>
              ) : video.note ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-text">
                  {video.note}
                </p>
              ) : (
                <p className="text-sm text-subtext/50">메모 없음</p>
              )}
            </div>

            {/* 삭제 */}
            <button
              onClick={() => onDelete(video.id)}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-subtext transition-colors hover:border-red-500/40 hover:text-red-400"
            >
              <Trash2 size={15} /> 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-background p-4">
      <span className="text-subtext">{icon}</span>
      <div>
        <p className="mb-0.5 text-xs text-subtext">{label}</p>
        {children}
      </div>
    </div>
  );
}

// ───────── 영상 추가 모달 ─────────
function AddVideoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string, file: File | null) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<VideoStatus>("idea");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platform = detectPlatform(url.trim());

  // 미리보기 ObjectURL: file에서 파생 생성 후, 변경/언마운트 시 revoke
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!isVideoFile(f)) {
      setError("영상 파일(mp4/webm/mov 등)만 첨부할 수 있습니다.");
      return;
    }
    setError("");
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // URL만으로는 등록하지 않는다(No Preview 방지). 로컬 영상 파일 필수.
    // 온라인 영상은 상단 "다운로드"로 받아 등록한다.
    if (!file) {
      setError(
        "로컬 영상 파일을 선택하세요. URL만으로는 추가할 수 없습니다 — 온라인 영상은 ‘다운로드’를 이용하세요.",
      );
      return;
    }
    setSaving(true);
    try {
      const item = await addVideo({
        url,
        title,
        tags: parseTags(tags),
        note,
        status,
        localFileName: file?.name,
        localFileType: file?.type,
        localFileSize: file?.size,
      });
      onSaved(item.id, file);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative flex max-h-[90vh] w-full max-w-xl flex-col rounded-card border border-border bg-card shadow-2xl shadow-black/40">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold text-text">로컬 영상 추가</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-subtext transition-colors hover:bg-border/60 hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="space-y-4 px-6 py-5">
            <Field label="영상 URL">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtu.be/..."
                className={inputCls}
              />
              <div className="mt-1.5 flex items-center gap-1.5">
                <span className="text-xs text-subtext/60">추정 플랫폼:</span>
                <PlatformBadge platform={platform} />
              </div>
            </Field>

            {/* 로컬 영상 파일 */}
            <Field label="로컬 영상 파일 (필수)">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={onPickFile}
              />
              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-border bg-background">
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="max-h-64 w-full bg-black object-contain"
                  />
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <p className="truncate text-xs text-subtext">
                      {file?.name}
                      {file ? ` · ${formatFileSize(file.size)}` : ""}
                    </p>
                    <button
                      type="button"
                      onClick={() => setFile(null)}
                      className="text-xs text-subtext hover:text-red-400"
                    >
                      제거
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-sm text-subtext transition-colors hover:border-primary/50 hover:text-text"
                >
                  <Upload size={16} /> mp4/webm/mov 파일 선택
                </button>
              )}
              <p className="mt-1 text-xs text-subtext/50">
                파일은 서버에 업로드되지 않습니다. 현재 세션에서만 재생되며, 새로고침 후에는
                다시 연결해야 합니다.
              </p>
            </Field>

            <Field label="제목">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="영상 제목 (직접 입력)"
                className={inputCls}
              />
            </Field>
            <Field label="태그">
              <input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="주방, 리뷰, 쇼츠"
                className={inputCls}
              />
              <p className="mt-1 text-xs text-subtext/50">쉼표(,)로 구분합니다</p>
            </Field>
            <Field label="메모">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="이 영상에 대한 메모..."
                rows={3}
                className={`${inputCls} resize-none leading-relaxed`}
              />
            </Field>
            <Field label="제작 상태">
              <div className="flex gap-2">
                {VIDEO_STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium transition-colors ${
                      status === s
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-background text-subtext hover:text-text"
                    }`}
                  >
                    {VIDEO_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </Field>

            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>

          <div className="flex shrink-0 gap-3 border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-subtext transition-colors hover:text-text"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
            >
              <Plus size={15} />
              {saving ? "저장 중..." : "영상 추가"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text placeholder:text-subtext/50 transition-colors focus:border-primary/60 focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs text-subtext">{label}</label>
      {children}
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-subtext">
      <Film size={48} className="mb-4 opacity-30" />
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm opacity-70">{desc}</p>
    </div>
  );
}
