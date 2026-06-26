"use client";

// ClipMiner Web — Video Library.
// ClipMiner Desktop(v0.1.1) 원본 사용감을 재현: 상단 헤더(로고/검색/정렬/추가) +
// 상단 StatCard 필터(전체/미제작/제작중/제작완료) + 보조 태그 필터 라인 +
// 9:16 쇼츠 카드 그리드 + 추가 모달.
// 데이터는 IndexedDB(Dexie)에 저장(Local-First). 실제 영상 파일 저장은 범위 밖.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
} from "@/lib/videos";
import { getThumbnail } from "@/lib/thumbnail";

type StatusFilter = "all" | VideoStatus;
type SortKey = "updated" | "created" | "title";

const STATUS_BADGE: Record<VideoStatus, string> = {
  idea: "bg-subtext/15 text-subtext border-subtext/30",
  in_progress: "bg-accent/15 text-accent border-accent/30",
  done: "bg-primary/20 text-primary border-primary/40",
};

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

export default function VideoLibraryPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [adding, setAdding] = useState(false);

  async function refresh() {
    setVideos(await listVideos());
  }

  useEffect(() => {
    let active = true;
    (async () => {
      const items = await listVideos();
      if (active) {
        setVideos(items);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleDelete(id: string) {
    if (!window.confirm("이 영상을 삭제하시겠습니까?")) return;
    await deleteVideo(id);
    await refresh();
  }

  async function handleStatusChange(id: string, next: VideoStatus) {
    await updateVideo(id, { status: next });
    await refresh();
  }

  // 상태 카운트
  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      all: videos.length,
      idea: 0,
      in_progress: 0,
      done: 0,
    };
    for (const v of videos) c[v.status] += 1;
    return c;
  }, [videos]);

  // 태그 목록 (빈도순)
  const tagList = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of videos)
      for (const t of v.tags) map.set(t, (map.get(t) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [videos]);

  // 필터 + 검색 + 정렬
  const results = useMemo(() => {
    const q = norm(query);
    const filtered = videos.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (tagFilter && !v.tags.includes(tagFilter)) return false;
      if (q) {
        const hay = norm([v.title, v.url, v.note, ...v.tags].join(" "));
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
  ];

  const activeLabel = stats.find((s) => s.key === statusFilter)?.label;

  return (
    <div className="flex min-h-screen flex-col bg-background text-text">
      {/* ───────── 상단 헤더 (로고 / 검색 / 정렬 / 추가) ───────── */}
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
              onChange={(e) => setQuery(e.target.value)}
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
        {/* StatCard 필터 */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <StatCard
              key={s.key}
              label={s.label}
              value={counts[s.key]}
              icon={s.icon}
              active={statusFilter === s.key}
              onClick={() => setStatusFilter(s.key)}
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
              onClick={() => setTagFilter(null)}
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
                onClick={() => setTagFilter(tagFilter === name ? null : name)}
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

        {/* 결과 카운트 */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-subtext">
            {query ? `검색 결과 ${results.length}개` : `${activeLabel} ${results.length}개`}
            {tagFilter && <span className="text-primary"> · #{tagFilter}</span>}
          </p>
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
                onDelete={handleDelete}
                onStatusChange={handleStatusChange}
                onTagClick={setTagFilter}
              />
            ))}
          </div>
        )}
      </main>

      {adding && (
        <AddVideoModal
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await refresh();
          }}
        />
      )}
    </div>
  );
}

// ───────── StatCard (Desktop 원본 구조) ─────────
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

// ───────── 영상 카드 (9:16 쇼츠형) ─────────
function VideoCard({
  video,
  onDelete,
  onStatusChange,
  onTagClick,
}: {
  video: VideoItem;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, s: VideoStatus) => void;
  onTagClick: (t: string) => void;
}) {
  const thumb = getThumbnail(video.url);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-card border border-border bg-card transition-all duration-200 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      {/* 썸네일 (카드 중심) */}
      <div className="relative aspect-[9/16] overflow-hidden bg-border">
        {video.url ? (
          <a href={video.url} target="_blank" rel="noopener noreferrer">
            {thumb ? (
              // 외부 썸네일 — next/image 대신 일반 img (도메인 비고정)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt={video.title}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <ThumbPlaceholder />
            )}
          </a>
        ) : (
          <ThumbPlaceholder />
        )}

        {/* 상태 배지 (좌상단) */}
        <span
          className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[video.status]}`}
        >
          {VIDEO_STATUS_LABELS[video.status]}
        </span>

        {/* 삭제 (우상단, hover 시) */}
        <button
          onClick={() => onDelete(video.id)}
          className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white/80 opacity-0 backdrop-blur-sm transition-opacity hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
          title="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* 정보 */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-text">
          {video.title || "(제목 없음)"}
        </p>

        {video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {video.tags.map((t) => (
              <button
                key={t}
                onClick={() => onTagClick(t)}
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

        {/* 상태 빠른 변경 + 날짜 */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <select
            value={video.status}
            onChange={(e) =>
              onStatusChange(video.id, e.target.value as VideoStatus)
            }
            className="rounded-lg border border-border bg-background px-2 py-1 text-xs text-text focus:border-primary/60 focus:outline-none"
            title="상태 변경"
          >
            {VIDEO_STATUSES.map((s) => (
              <option key={s} value={s}>
                {VIDEO_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <span className="text-xs text-subtext/60">
            {formatDate(video.createdAt)}
          </span>
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

// ───────── 영상 추가 모달 ─────────
function AddVideoModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<VideoStatus>("idea");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() && !title.trim()) {
      setError("URL 또는 제목 중 하나는 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await addVideo({ url, title, tags: parseTags(tags), note, status });
      onSaved();
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
          <h2 className="text-lg font-semibold text-text">영상 추가</h2>
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
