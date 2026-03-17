#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date
from pathlib import Path


@dataclass(frozen=True)
class Category:
    key: str
    label: str


PRIORITY_ORDER: list[Category] = [
    Category("refactor", "重构"),
    Category("architecture", "架构优化"),
    Category("ux", "用户体验（旧功能优化）"),
    Category("feature", "新功能"),
]

# Weighted keywords for a simple, deterministic heuristic classifier.
# Notes:
# - We only score against sections: Why / What Changes / Impact, plus the folder name.
# - We avoid generic verbs like "add/new/增加" because all proposals "add" things.
WEIGHTED_KEYWORDS: dict[str, dict[str, int]] = {
    "refactor": {
        r"\brefactor\b": 3,
        r"重构": 3,
        r"\bmigration\b": 3,
        r"迁移": 3,
        r"\bdrift\b": 3,
        r"漂移": 3,
        r"\brollback\b": 3,
        r"回滚": 3,
        r"\blint\b": 3,
        r"\bformat\b": 3,
        r"\btypecheck\b": 3,
        r"\bmypy\b": 3,
        r"cleanup": 2,
        r"清理": 2,
        r"rename": 2,
        r"改名": 2,
        r"upgrade": 2,
        r"升级": 1,
        r"dependency": 1,
        r"依赖": 1,
        r"audit": 2,
        r"审计": 2,
        r"lazy[- ]load": 2,
        r"懒加载": 2,
        r"startup": 2,
        r"冷启动": 2,
        r"启动耗时": 2,
        r"测试": 1,
        r"回归": 1,
        r"mock": 2,
        r"\bvalidate\b": 2,
        r"\bvalidation\b": 2,
        r"\brepair\b": 2,
        r"self[- ]heal": 2,
        r"校验": 2,
        r"修补": 2,
        r"自愈": 2,
        r"回退": 2,
    },
    "architecture": {
        r"\bcontract\b": 3,
        r"契约": 3,
        r"\bframework\b": 3,
        r"框架": 3,
        r"architecture": 2,
        r"架构": 2,
        r"object model": 3,
        r"对象模型": 3,
        r"readiness": 2,
        r"运行时": 2,
        r"\bruntime\b": 2,
        r"\bscheduler\b": 2,
        r"调度": 2,
        r"\bqueue\b": 2,
        r"队列": 2,
        r"一致性": 2,
        r"consisten": 2,
        r"\bschema\b": 2,
        r"openapi": 2,
        r"\bsdk\b": 2,
        r"接口": 2,
        r"event": 2,
        r"事件": 2,
        r"\bsse\b": 2,
        r"流式": 2,
        r"observab": 2,
        r"可观察": 2,
        r"\btrace\b": 2,
        r"日志": 2,
        r"\bmetric\b": 2,
        r"指标": 2,
        r"cache": 1,
        r"缓存": 1,
        r"index": 1,
        r"索引": 1,
        r"retriev": 2,
        r"检索": 2,
        r"限流": 2,
        r"rate[- ]limit": 2,
        r"降级": 2,
        r"degraded": 2,
        r"backpressure": 2,
        r"背压": 2,
        r"\bslo\b": 2,
        r"预算": 1,
        r"budget": 1,
        r"quality gate": 2,
        r"质量门": 2,
        r"评测": 2,
        r"eval": 2,
        r"证据": 2,
        r"evidence": 2,
        r"主张": 2,
        r"claim": 2,
        r"引用": 1,
        r"citation": 1,
        r"溯源": 1,
        r"provenance": 1,
    },
    "ux": {
        r"error[- ]ux": 3,
        r"错误体验": 3,
        r"recovery action": 3,
        r"恢复动作": 3,
        r"onboarding": 3,
        r"引导": 3,
        r"first[- ]run": 3,
        r"首次": 2,
        r"empty state": 3,
        r"空态": 3,
        r"workspace home": 2,
        r"首页": 2,
        r"notification": 2,
        r"通知": 2,
        r"snooze": 2,
        r"延后": 2,
        r"resurfacing": 2,
        r"浮出": 2,
        r"keyboard": 2,
        r"快捷键": 2,
        r"shortcut": 2,
        r"navigation": 2,
        r"导航": 2,
        r"deep[- ]link": 2,
        r"深链": 2,
        r"multi[- ]select": 2,
        r"多选": 2,
        r"focus mode": 2,
        r"专注": 2,
        r"layout": 1,
        r"布局": 1,
        r"折叠": 1,
        r"置顶": 1,
        r"sidebar": 2,
        r"hotkey": 2,
        r"侧边栏": 2,
        r"热键": 2,
        r"scratchpad": 2,
        r"草稿": 1,
        r"卡片": 1,
        r"\bcard\b": 1,
    },
    "feature": {
        r"connector": 3,
        r"连接器": 3,
        r"ocr": 3,
        r"幻灯片": 2,
        r"slides": 2,
        r"export": 2,
        r"导出": 2,
        r"导入": 2,
        r"publish": 2,
        r"发布": 2,
        r"share": 2,
        r"分享": 2,
        r"journal": 2,
        r"日记": 2,
        r"inbox": 2,
        r"收件箱": 2,
        r"template": 1,
        r"模板": 1,
        r"recipe": 2,
        r"watcher": 2,
        r"监控": 2,
        r"mindmap": 2,
        r"quiz": 2,
        r"timeline": 2,
        r"知识地图": 2,
        r"简报": 1,
        r"合集": 1,
        r"chart": 2,
        r"图表": 2,
        r"caption": 2,
        r"摘要卡": 2,
    },
}

SECTION_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)
CHANGE_ID_RE = re.compile(r"^c(\d+)-")

BUCKETS: list[tuple[int, int | None]] = [
    (1000, 1999),
    (2000, 2999),
    (3000, 3999),
    (4000, None),
]


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def extract_relevant_sections(markdown: str) -> str:
    matches = list(SECTION_RE.finditer(markdown))
    if not matches:
        return markdown
    wanted = {"why", "what changes", "impact"}
    chunks: list[str] = []
    for idx, m in enumerate(matches):
        title = m.group(1).strip().lower()
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(markdown)
        if title in wanted:
            chunks.append(markdown[start:end])
    return "\n".join(chunks)


def compile_patterns() -> dict[str, list[tuple[re.Pattern[str], int]]]:
    out: dict[str, list[tuple[re.Pattern[str], int]]] = {}
    for cat in PRIORITY_ORDER:
        kws = WEIGHTED_KEYWORDS.get(cat.key, {})
        out[cat.key] = [(re.compile(pat, re.IGNORECASE), weight) for pat, weight in kws.items()]
    return out


PATTERNS = compile_patterns()


def score(text: str) -> dict[str, int]:
    scores: dict[str, int] = {cat.key: 0 for cat in PRIORITY_ORDER}
    for cat in PRIORITY_ORDER:
        s = 0
        for pat, w in PATTERNS[cat.key]:
            s += w * len(pat.findall(text))
        scores[cat.key] = s
    return scores


def choose_category(scores: dict[str, int]) -> str:
    max_score = max(scores.values())
    if max_score == 0:
        # If nothing matches, default to "feature" (most proposals introduce something new).
        return "feature"
    # Tie-break follows the user-specified priority order (refactor > architecture > ux > feature).
    for cat in PRIORITY_ORDER:
        if scores[cat.key] == max_score:
            return cat.key
    return PRIORITY_ORDER[-1].key


def parse_change_id(change_name: str) -> int | None:
    m = CHANGE_ID_RE.match(change_name)
    if not m:
        return None
    return int(m.group(1))


def bucket_label(bucket_start: int, bucket_end: int | None) -> str:
    if bucket_end is None:
        return f"c{bucket_start}+"
    return f"c{bucket_start}–c{bucket_end}"


def bucket_for_change_id(change_id: int) -> tuple[int, int | None]:
    for start, end in BUCKETS:
        if end is None:
            if change_id >= start:
                return start, end
        elif start <= change_id <= end:
            return start, end
    return BUCKETS[-1]


def change_sort_key(change_name: str) -> tuple[int, str]:
    change_id = parse_change_id(change_name)
    if change_id is None:
        return (10**9, change_name)
    return (change_id, change_name)


def build_priority_index(changes_dir: Path) -> dict[str, object]:
    changes: dict[str, dict[str, object]] = {}
    for p in changes_dir.iterdir():
        if not p.is_dir() or p.name == "archive":
            continue
        proposal = p / "proposal.md"
        if not proposal.exists():
            continue

        md = proposal.read_text(encoding="utf-8", errors="replace")
        relevant = extract_relevant_sections(md)
        text = f"{p.name.replace('-', ' ')}\n{relevant}"
        scores = score(text)
        category = choose_category(scores)
        sorted_scores = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)
        top = sorted_scores[0][1]
        second = sorted_scores[1][1] if len(sorted_scores) > 1 else 0

        change_id = parse_change_id(p.name)
        if change_id is None:
            bucket_start, bucket_end = (-1, None)
            bucket = "unknown"
        else:
            bucket_start, bucket_end = bucket_for_change_id(change_id)
            bucket = bucket_label(bucket_start, bucket_end)
        changes[p.name] = {
            "category": category,
            "id": change_id,
            "bucket": bucket,
            "bucket_start": bucket_start,
            "bucket_end": bucket_end,
            "scores": scores,
            "margin": top - second,
        }

    counts = {cat.key: 0 for cat in PRIORITY_ORDER}
    for meta in changes.values():
        counts[str(meta["category"])] += 1

    needs_review = sorted(
        [name for name, meta in changes.items() if int(meta["margin"]) <= 2],
        key=change_sort_key,
    )

    return {
        "generated_at": date.today().isoformat(),
        "priority_order": [cat.key for cat in PRIORITY_ORDER],
        "labels": {cat.key: cat.label for cat in PRIORITY_ORDER},
        "counts": counts,
        "needs_review": needs_review,
        "changes": changes,
    }


def write_markdown(changes_dir: Path, index: dict[str, object]) -> None:
    labels: dict[str, str] = index["labels"]  # type: ignore[assignment]
    counts: dict[str, int] = index["counts"]  # type: ignore[assignment]
    changes: dict[str, dict[str, object]] = index["changes"]  # type: ignore[assignment]
    needs_review: list[str] = index["needs_review"]  # type: ignore[assignment]

    # Group: bucket -> category -> names
    bucket_items: dict[str, dict[str, list[str]]] = {}
    for name, meta in changes.items():
        bucket = str(meta.get("bucket") or "unknown")
        category = str(meta["category"])
        bucket_items.setdefault(bucket, {}).setdefault(category, []).append(name)

    # Ensure deterministic ordering within each group
    for per_cat in bucket_items.values():
        for cat in PRIORITY_ORDER:
            per_cat.setdefault(cat.key, [])
            per_cat[cat.key].sort(key=change_sort_key)

    lines: list[str] = []
    lines.append("# OpenSpec Changes — Priority Index")
    lines.append("")
    lines.append(
        "按优先级排序（从高到低）：`重构` → `架构优化` → `用户体验（旧功能优化）` → `新功能`。"
    )
    lines.append("并按编号段分组：`1000–1999`、`2000–2999`、`3000–3999`、`4000+`。")
    lines.append("")
    lines.append(f"生成时间：`{index['generated_at']}`")
    lines.append("")
    lines.append(
        "本文件由 `scripts/openspec/rebuild_priority_index.py` 生成；如需调整分类，请改脚本关键词权重后重跑。"
    )

    # Bucket order follows BUCKETS; unknown bucket last (if any).
    bucket_order: list[str] = [bucket_label(s, e) for s, e in BUCKETS]
    if "unknown" in bucket_items and "unknown" not in bucket_order:
        bucket_order.append("unknown")

    for bucket in bucket_order:
        per_cat = bucket_items.get(bucket, {})
        bucket_total = sum(len(per_cat.get(cat.key, [])) for cat in PRIORITY_ORDER)
        lines.append("")
        lines.append(f"## {bucket} ({bucket_total})")
        for cat in PRIORITY_ORDER:
            names = per_cat.get(cat.key, [])
            if not names:
                continue
            lines.append("")
            lines.append(f"### {labels[cat.key]} ({len(names)})")
            for name in names:
                lines.append(f"- `{name}`")

    lines.append("")
    lines.append(f"## 需要人工复核（margin ≤ 2）({len(needs_review)})")
    lines.append(
        "这些 change 的分类边界更模糊（关键词命中分差很小），建议快速扫一眼 proposal 再确认。"
    )
    needs_by_bucket: dict[str, list[str]] = {}
    for name in needs_review:
        meta = changes[name]
        needs_by_bucket.setdefault(str(meta.get("bucket") or "unknown"), []).append(name)
    for bucket in bucket_order:
        names = needs_by_bucket.get(bucket, [])
        if not names:
            continue
        names.sort(key=change_sort_key)
        lines.append("")
        lines.append(f"### {bucket} ({len(names)})")
        for name in names:
            meta = changes[name]
            lines.append(f"- `{name}` ({meta['category']}, margin={meta['margin']})")

    (changes_dir / "PRIORITY.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    root = repo_root()
    changes_dir = root / "openspec" / "changes"
    if not changes_dir.exists():
        raise SystemExit(f"Not found: {changes_dir}")

    index = build_priority_index(changes_dir)

    # Machine-readable snapshot (keeps full scores for easier tuning).
    (changes_dir / "priority.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    # Human-friendly index.
    write_markdown(changes_dir, index)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
