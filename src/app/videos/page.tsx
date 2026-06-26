"use client";

// ClipMiner Web — Video Library (MVP).
// Local-First: 모든 데이터는 브라우저 IndexedDB(Dexie)에 저장된다.
// 실제 영상 파일 저장 / File System Access / Import-Export 는 범위 밖.

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

type StatusFilter = "all" | VideoStatus;

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_BADGE: Record<VideoStatus, string> = {
  idea: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  done: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
};

export default function VideoLibraryPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 등록 폼
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<VideoStatus>("idea");

  // 필터 / 검색
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !url.trim()) return;
    await addVideo({ url, title, tags: parseTags(tags), note, status });
    setUrl("");
    setTitle("");
    setTags("");
    setNote("");
    setStatus("idea");
    await refresh();
  }

  async function handleDelete(id: string) {
    await deleteVideo(id);
    await refresh();
  }

  async function handleStatusChange(id: string, next: VideoStatus) {
    await updateVideo(id, { status: next });
    await refresh();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [v.title, v.url, v.note, ...v.tags]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [videos, statusFilter, query]);

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

  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "전체" },
    { key: "idea", label: VIDEO_STATUS_LABELS.idea },
    { key: "in_progress", label: VIDEO_STATUS_LABELS.in_progress },
    { key: "done", label: VIDEO_STATUS_LABELS.done },
  ];

  return (
    <div className="min-h-screen">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/60">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-baseline gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              ClipMiner Web
            </Link>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              Local Library · {videos.length}개 (이 브라우저에 저장)
            </span>
          </div>
          <Link
            href="/"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← 홈
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-8 md:grid-cols-[320px_1fr]">
          {/* 등록 폼 */}
          <aside className="md:sticky md:top-24 md:self-start">
            <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400">
              영상 등록
            </h2>
            <form
              onSubmit={handleSave}
              className="mt-3 flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <input
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="영상 URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <input
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="제목 (직접 입력)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="태그 (쉼표로 구분)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              <textarea
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                placeholder="메모"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <select
                className="rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={status}
                onChange={(e) => setStatus(e.target.value as VideoStatus)}
              >
                {VIDEO_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {VIDEO_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                저장
              </button>
            </form>
          </aside>

          {/* 목록 영역 */}
          <section>
            {/* 필터 + 검색 */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-1">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={`rounded-full px-3 py-1 text-sm transition-colors ${
                      statusFilter === tab.key
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {tab.label} ({counts[tab.key]})
                  </button>
                ))}
              </div>
              <input
                className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:w-56"
                placeholder="제목·태그·메모 검색"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {/* 카드 목록 / 빈 상태 */}
            <div className="mt-5">
              {loading ? (
                <p className="text-sm text-zinc-500">불러오는 중…</p>
              ) : videos.length === 0 ? (
                <EmptyState
                  title="아직 저장된 영상이 없습니다"
                  desc="왼쪽 폼에서 첫 영상을 등록해 보세요. 데이터는 이 브라우저에만 저장됩니다."
                />
              ) : filtered.length === 0 ? (
                <EmptyState
                  title="조건에 맞는 영상이 없습니다"
                  desc="필터나 검색어를 바꿔 보세요."
                />
              ) : (
                <ul className="flex flex-col gap-3">
                  {filtered.map((v) => (
                    <li
                      key={v.id}
                      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-zinc-50">
                            {v.title || "(제목 없음)"}
                          </p>
                          {v.url && (
                            <a
                              href={v.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              {v.url}
                            </a>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[v.status]}`}
                        >
                          {VIDEO_STATUS_LABELS[v.status]}
                        </span>
                      </div>

                      {v.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {v.tags.map((t) => (
                            <button
                              key={t}
                              onClick={() => setQuery(t)}
                              className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                              #{t}
                            </button>
                          ))}
                        </div>
                      )}

                      {v.note && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                          {v.note}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800/60">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-400">상태</label>
                          <select
                            value={v.status}
                            onChange={(e) =>
                              handleStatusChange(
                                v.id,
                                e.target.value as VideoStatus,
                              )
                            }
                            className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                          >
                            {VIDEO_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {VIDEO_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-400">
                            생성 {formatDate(v.createdAt)}
                            {v.updatedAt !== v.createdAt && (
                              <> · 수정 {formatDate(v.updatedAt)}</>
                            )}
                          </span>
                          <button
                            onClick={() => handleDelete(v.id)}
                            className="text-xs text-red-600 hover:underline dark:text-red-400"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
      <p className="font-medium text-zinc-700 dark:text-zinc-300">{title}</p>
      <p className="mt-1 text-sm text-zinc-500">{desc}</p>
    </div>
  );
}
