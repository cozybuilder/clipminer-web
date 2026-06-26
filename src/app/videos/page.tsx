"use client";

// ClipMiner Web — 개발 확인용 최소 UI.
// IndexedDB(Dexie) 저장/조회/삭제가 실제로 동작하는지 검증하기 위한 페이지.
// 실제 영상 파일 저장 / File System Access / Import-Export 는 이번 단계 범위 밖.

import { useEffect, useState } from "react";
import {
  VIDEO_STATUSES,
  VIDEO_STATUS_LABELS,
  type VideoItem,
  type VideoStatus,
} from "@/lib/types";
import { addVideo, deleteVideo, listVideos } from "@/lib/videos";

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function VideosDevPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<VideoStatus>("idea");

  async function refresh() {
    setVideos(await listVideos());
    setLoading(false);
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
    await addVideo({
      url,
      title,
      tags: parseTags(tags),
      note,
      status,
    });
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

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        영상 데이터 (로컬 IndexedDB)
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        개발 확인용 화면. 데이터는 브라우저 IndexedDB(`clipminer`)에 저장됩니다.
      </p>

      <form
        onSubmit={handleSave}
        className="mt-6 flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
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
          rows={2}
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
          className="self-start rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          저장
        </button>
      </form>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-400">
          목록 {loading ? "" : `(${videos.length})`}
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-zinc-500">불러오는 중…</p>
        ) : videos.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">저장된 영상이 없습니다.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {videos.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                      {v.title || "(제목 없음)"}
                    </p>
                    {v.url && (
                      <p className="truncate text-xs text-zinc-500">{v.url}</p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {VIDEO_STATUS_LABELS[v.status]}
                  </span>
                </div>
                {v.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
                {v.note && (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
                    {v.note}
                  </p>
                )}
                <button
                  onClick={() => handleDelete(v.id)}
                  className="mt-3 text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
