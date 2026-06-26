// ClipMiner Web — 중국어 쇼츠 제목 → "한국어 관리용 제목" 변환.
// Desktop electron/titleTranslate.cjs 를 충실히 포팅(외부 번역 API 없음, 로컬 사전 기반).
//
// 처리: 해시태그/멘션 제거 → 광고문구 제거 → 기호/이모지 정리 → 중국어 키워드 사전 치환
//      → 미매핑 한자 제거 → 중복/포함 토큰 정리 → 비면 "제목 번역 필요" 폴백.

// 사전 값은 공백 없는 단일 토큰으로 유지.
const DICT: [string, string][] = [
  // 디저트/음식
  ["哈根达斯", "하겐다즈"], ["根达斯", "하겐다즈"],
  ["冰淇淋机", "아이스크림기계"], ["意式冰淇淋", "젤라또"], ["冰淇淋", "아이스크림"],
  ["雪糕", "아이스크림"], ["冰棍", "아이스바"], ["gelato", "젤라또"],
  ["大米", "쌀"], ["芒果", "망고"], ["草莓", "딸기"], ["巧克力", "초콜릿"],
  ["蛋糕", "케이크"], ["面包", "빵"], ["饼干", "쿠키"], ["咖啡", "커피"],
  ["奶茶", "밀크티"], ["布丁", "푸딩"], ["酸奶", "요거트"], ["甜品", "디저트"],
  // 요리/주방
  ["空气炸锅", "에어프라이어"], ["电饭煲", "전기밥솥"], ["破壁机", "믹서기"],
  ["厨房", "주방"], ["食谱", "레시피"], ["做法", "만드는법"], ["教程", "튜토리얼"],
  ["全手动", "수동"], ["手动", "수동"], ["自动", "자동"],
  ["材料", "재료"], ["零失败", "실패없는"], ["超简单", "초간단"], ["简单", "간단"],
  ["在家", "집에서"], ["家庭", "가정"], ["自制", "수제"], ["复刻", "재현"],
  ["爆改", "개조"], ["邪修", "꼼수"], ["实现", "실현"], ["自由", "자유"],
  // 뷰티
  ["面膜", "마스크팩"], ["口红", "립스틱"], ["护肤", "스킨케어"], ["化妆", "메이크업"],
  ["防晒", "선크림"], ["精华", "에센스"], ["面霜", "크림"], ["美白", "미백"],
  // 청소/생활
  ["扫地机器人", "로봇청소기"], ["吸尘器", "청소기"], ["收纳", "수납"], ["清洁", "청소"],
  ["神器", "꿀템"], ["好物", "추천템"], ["家用", "가정용"], ["必备", "필수템"],
  // 카테고리
  ["露营", "캠핑"], ["健身", "헬스"], ["减肥", "다이어트"], ["宠物", "반려동물"],
  ["母婴", "육아"], ["数码", "디지털"], ["穿搭", "코디"],
  // 계절/시기
  ["夏天", "여름"], ["夏日", "여름"], ["冬天", "겨울"], ["春天", "봄"], ["秋天", "가을"],
  // 콘텐츠 유형
  ["开箱", "언박싱"], ["测评", "리뷰"], ["评测", "리뷰"], ["推荐", "추천"], ["分享", "공유"],
  ["vlog", "브이로그"], ["DIY", "DIY"], ["LED", "LED"],
];

// 광고/플랫폼 유도 문구 (제목에서 통째로 제거)
const SPAM: string[] = [
  "瓜子二手车", "二手车", "拼多多", "淘宝", "京东", "抖音电商", "点击下方", "同款链接",
  "小黄车", "直播间", "关注我", "点赞", "评论区", "已上车", "橱窗", "低价",
];

const KEYS_DESC = DICT.slice().sort((a, b) => b[0].length - a[0].length);

/** 중국어 텍스트 → 한국어 토큰 문자열 (매핑 키워드만 치환, 남은 한자 제거, 결과 없으면 ''). */
function mapToKorean(raw: string): string {
  if (!raw) return "";
  let s = String(raw);

  // 1) 해시태그 / 멘션 제거
  s = s.replace(/#[^\s#]+/g, " ").replace(/@[^\s@]+/g, " ");
  // 2) 광고성 문구 제거
  for (const sp of SPAM) s = s.split(sp).join(" ");
  // 3) 이모지/픽토그램 제거
  s = s.replace(
    /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,
    " ",
  );
  // 구분기호 정리
  s = s.replace(
    /[—\-_|｜·•/\\~、，,。.!！?？:：;；“”"'()（）[\]「」【】]/g,
    " ",
  );

  // 4) 사전 매핑 (긴 키 우선)
  for (const [zh, ko] of KEYS_DESC) {
    if (s.indexOf(zh) !== -1) s = s.split(zh).join(" " + ko + " ");
  }

  // 5) 매핑되지 않은 한자(CJK) 제거 — 중국어 원문을 남기지 않는다
  s = s.replace(/[㐀-䶿一-鿿豈-﫿]/g, " ");

  // 6) 토큰화 → 중복 제거 → 포함관계 토큰 정리
  let tokens = s.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  tokens = tokens.filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  tokens = tokens.filter((t) => !tokens.some((o) => o !== t && o.includes(t)));

  return tokens.join(" ").trim();
}

/** 제목용: 매핑 실패 시 한국어 폴백("제목 번역 필요"). 중국어 원문 반환 안 함. */
export function toKoreanTitle(raw: string): string {
  return mapToKorean(raw) || "제목 번역 필요";
}

/** 태그용: 선행 # 제거 후 매핑. 매핑 실패 시 ''(빈 값). */
export function toKoreanTag(raw: string): string {
  return mapToKorean(String(raw || "").replace(/^#/, ""));
}

/** 원본 제목에서 #해시태그 추출 (# 제거, 광고/스팸·중복 제외). */
export function extractHashtags(raw: string): string[] {
  if (!raw) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /#([^\s#]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(raw))) !== null) {
    const tag = m[1].replace(/[，,。.!！?？、~·•]+$/g, "").trim();
    if (!tag) continue;
    if (SPAM.some((sp) => tag.includes(sp))) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}
