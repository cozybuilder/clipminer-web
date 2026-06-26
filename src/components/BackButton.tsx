// ClipMiner Web — 공통 뒤로가기 버튼.
// 텍스트 링크형("← 라이브러리") 금지. 아이콘 + 라벨의 정돈된 버튼(ClipMiner Desktop 톤).

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackButton({
  href,
  label = "뒤로",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-sm font-medium text-subtext transition-colors hover:border-border/80 hover:bg-border/40 hover:text-text"
    >
      <ArrowLeft size={18} />
      <span>{label}</span>
    </Link>
  );
}
