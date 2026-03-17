from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import tempfile
from pathlib import Path
from time import perf_counter
from typing import Any

from pydantic_ai import Agent

from crystalith.shared.agents.deps import StudioDeps
from crystalith.shared.agents.generation_preference import tuning_for_request
from crystalith.shared.agents.models import build_chat_model
from crystalith.shared.agents.output_graph import (
    DEFAULT_PROMPTS,
    OUTPUT_SCHEMAS,
    SYSTEM_PROMPT,
    _build_citation,
    _build_output_prompt,
    _map_citations,
)
from crystalith.shared.ai.test_provider import TestEmbeddingProvider
from crystalith.shared.cache import InMemoryCache
from crystalith.shared.config import ConfigManager, Settings
from crystalith.shared.db import Chunk, Notebook, Source, create_db_manager
from crystalith.shared.db.migrations import upgrade_head
from crystalith.shared.eval import (
    check_constraints,
    load_dataset,
    percentile,
    validate_mapped_citations,
)
from crystalith.shared.retrieval import retrieve_context
from crystalith.shared.types import SourceStatus
from crystalith.shared.vector_storage import InMemoryVectorStore


class _SeedAwareEmbedder(TestEmbeddingProvider):
    async def embed_batch(self, texts, *, batch_size: int = 100):
        vectors: list[list[float]] = []
        for text in texts:
            if "Output type:" in text:
                vectors.append([0.0, 1.0, 0.0])
            else:
                vectors.append([1.0, 0.0, 0.0])
        return vectors


def _repo_root() -> Path:
    # backend/py/scripts/llm_eval.py -> repo root
    return Path(__file__).resolve().parents[3]


def _offline_settings() -> Settings:
    return Settings(
        app={"cors": {"allow_origins": []}},
        cache={"provider": "memory"},
        vector_storage={"provider": "memory"},
        models={
            "defaults": {"chat": "test-chat", "embedding": "test-embed"},
            "available": [
                {
                    "id": "test-chat",
                    "provider": "test",
                    "model": "test-chat",
                    "display_name": "Test Chat",
                    "roles": ["chat"],
                },
                {
                    "id": "test-embed",
                    "provider": "test",
                    "model": "test-embed",
                    "display_name": "Test Embed",
                    "roles": ["embed"],
                },
            ],
        },
    )


async def _seed_synthetic_notebook(*, session, vector_store: InMemoryVectorStore) -> tuple[int, list[int]]:
    notebook = Notebook(name="eval-notebook")
    session.add(notebook)
    await session.commit()
    await session.refresh(notebook)

    source1 = Source(notebook_id=notebook.id, filename="alpha.md", status=SourceStatus.READY)
    source2 = Source(notebook_id=notebook.id, filename="beta.md", status=SourceStatus.READY)
    session.add_all([source1, source2])
    await session.flush()

    chunk1 = Chunk(source_id=source1.id, chunk_index=0, text="Alpha concept.")
    chunk2 = Chunk(source_id=source2.id, chunk_index=0, text="Beta concept.")
    session.add_all([chunk1, chunk2])
    await session.commit()
    await session.refresh(chunk1)
    await session.refresh(chunk2)

    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source1.id,
        chunk_ids=[chunk1.id],
        vectors=[[1.0, 0.0, 0.0]],
    )
    await vector_store.add(
        notebook_id=notebook.id,
        source_id=source2.id,
        chunk_ids=[chunk2.id],
        vectors=[[0.0, 1.0, 0.0]],
    )

    return int(notebook.id), [int(source1.id), int(source2.id)]


def _stage_percentiles(values: list[float]) -> dict[str, float]:
    return {
        "p50": round(percentile(values, 50), 3),
        "p95": round(percentile(values, 95), 3),
        "p99": round(percentile(values, 99), 3),
    }


async def _run(args: argparse.Namespace) -> int:
    dataset_path = Path(args.dataset).resolve()
    samples = load_dataset(dataset_path)

    mode = "offline"
    settings = _offline_settings()
    if args.use_real_model:
        mode = "real"
        if not args.confirm_real_model:
            raise SystemExit("--use-real-model requires --confirm-real-model (may call external services).")
        config_path = Path(args.config).resolve()
        manager = ConfigManager(config_path=config_path)
        settings = manager.load()

    report_dir = Path(args.output_dir).resolve()
    report_dir.mkdir(parents=True, exist_ok=True)

    out_json = report_dir / "llm_eval_report.json"
    out_md = report_dir / "llm_eval_report.md"

    with tempfile.TemporaryDirectory() as tempdir:
        db_path = Path(tempdir) / "llm-eval.db"
        db_url = f"sqlite+aiosqlite:///{db_path}"
        await asyncio.to_thread(upgrade_head, db_url)
        manager = create_db_manager(db_url)
        vector_store = InMemoryVectorStore()
        cache = InMemoryCache(ttl=60)

        try:
            async with manager.got_manual_session() as session:
                notebook_id, source_ids = await _seed_synthetic_notebook(
                    session=session, vector_store=vector_store
                )

                deps = StudioDeps(
                    settings=settings,
                    session=session,
                    vector_store=vector_store,
                    embedder=_SeedAwareEmbedder("test-embed"),
                    cache=cache,
                )

                model = build_chat_model(settings) if mode == "real" else build_chat_model(_offline_settings())

                sample_results: list[dict[str, Any]] = []
                total_ms_values: list[float] = []
                query_counts: list[float] = []
                embed_ms_values: list[float] = []
                search_ms_values: list[float] = []
                db_ms_values: list[float] = []
                format_ms_values: list[float] = []
                generate_ms_values: list[float] = []

                for sample in samples:
                    tuning = tuning_for_request(sample.output_type, sample.preference)
                    top_k = tuning.top_k
                    min_score = tuning.min_score

                    sample_started = perf_counter()
                    retrieved = await retrieve_context(
                        deps,
                        notebook_id=notebook_id,
                        seed=sample.prompt,
                        source_ids=source_ids,
                        output_type=sample.output_type,
                        preference=sample.preference,
                        top_k=top_k,
                        min_score=min_score,
                    )

                    schema = OUTPUT_SCHEMAS[sample.output_type]
                    prompt_title = sample.prompt.strip() or DEFAULT_PROMPTS.get(sample.output_type, "")
                    user_prompt = _build_output_prompt(sample.output_type, prompt_title, retrieved.context_text)

                    agent = Agent(
                        model,
                        output_type=schema,
                        deps_type=StudioDeps,
                        system_prompt=SYSTEM_PROMPT,
                        retries=tuning.agent_retries,
                    )

                    generate_started = perf_counter()
                    fallback = False
                    repaired = False
                    content: dict[str, Any]
                    try:
                        result = await agent.run(user_prompt, deps=deps)
                        content = result.output.model_dump()
                    except Exception:
                        fallback = True
                        content = {}
                    generate_ms = int((perf_counter() - generate_started) * 1000)

                    from crystalith.shared.agents.output_postprocess import postprocess_output  # local import

                    processed = postprocess_output(
                        output_type=sample.output_type,
                        content=content,
                        prompt_title=prompt_title,
                        citations_count=len(retrieved.chunks),
                        preference=sample.preference,
                        apply_structural=True,
                    ).content
                    fallback = fallback or bool(processed.get("_fallback") is True)

                    citations = [
                        _build_citation(item.chunk, item.source, item.score) for item in retrieved.chunks
                    ]
                    citation_map = dict(enumerate(citations, start=1))
                    mapped = _map_citations(processed, citation_map, citations[:1])

                    citations_mappable, has_citations = validate_mapped_citations(
                        mapped,
                        allowed_chunk_ids=set(retrieved.resolved_chunk_ids),
                        allowed_source_ids={int(item.source.id) for item in retrieved.chunks},
                    )
                    citations_valid = citations_mappable and has_citations

                    passed, failures = check_constraints(
                        constraints=sample.constraints,
                        fallback=fallback,
                        citations_valid=citations_mappable,
                        has_citations=has_citations,
                        query_count=retrieved.stats.query_count,
                    )

                    total_ms = int((perf_counter() - sample_started) * 1000)
                    total_ms_values.append(float(total_ms))
                    query_counts.append(float(retrieved.stats.query_count))
                    embed_ms_values.append(float(retrieved.timings_ms.get("embed_ms") or 0))
                    search_ms_values.append(float(retrieved.timings_ms.get("search_ms") or 0))
                    db_ms_values.append(float(retrieved.timings_ms.get("db_ms") or 0))
                    format_ms_values.append(float(retrieved.timings_ms.get("format_ms") or 0))
                    generate_ms_values.append(float(generate_ms))

                    sample_results.append(
                        {
                            "id": sample.id,
                            "output_type": sample.output_type.value,
                            "preference": sample.preference,
                            "prompt": sample.prompt,
                            "constraints": sample.constraints,
                            "result": {
                                "pass": passed,
                                "failures": failures,
                                "fallback": fallback,
                                "repair": repaired,
                                "citations_valid": citations_valid,
                                "citations_count": len(retrieved.chunks),
                                "query_count": retrieved.stats.query_count,
                                "timings_ms": {
                                    **retrieved.timings_ms,
                                    "generate_ms": generate_ms,
                                    "total_ms": total_ms,
                                },
                                "warnings": processed.get("_warnings") if isinstance(processed.get("_warnings"), list) else [],
                            },
                        }
                    )

        finally:
            await manager.close()

    passed_count = sum(1 for item in sample_results if item.get("result", {}).get("pass") is True)
    fallback_count = sum(1 for item in sample_results if item.get("result", {}).get("fallback") is True)
    repair_count = sum(1 for item in sample_results if item.get("result", {}).get("repair") is True)
    citations_valid_count = sum(
        1 for item in sample_results if item.get("result", {}).get("citations_valid") is True
    )

    report = {
        "meta": {
            "generated_at": dt.datetime.now(dt.UTC).isoformat(),
            "mode": mode,
            "dataset_path": str(dataset_path),
        },
        "summary": {
            "samples_total": len(sample_results),
            "passed": passed_count,
            "failed": len(sample_results) - passed_count,
            "fallback": fallback_count,
            "repair": repair_count,
            "citations_valid": citations_valid_count,
            "query_count": _stage_percentiles(query_counts),
            "timings_ms": {
                "total_ms": _stage_percentiles(total_ms_values),
                "embed_ms": _stage_percentiles(embed_ms_values),
                "search_ms": _stage_percentiles(search_ms_values),
                "db_ms": _stage_percentiles(db_ms_values),
                "format_ms": _stage_percentiles(format_ms_values),
                "generate_ms": _stage_percentiles(generate_ms_values),
            },
        },
        "samples": sample_results,
    }

    out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    md_lines = [
        "# LLM Eval Regression Report",
        "",
        f"- Mode: `{mode}`",
        f"- Dataset: `{dataset_path}`",
        f"- Samples: `{len(sample_results)}`",
        f"- Passed: `{passed_count}`",
        f"- Failed: `{len(sample_results) - passed_count}`",
        f"- Fallback: `{fallback_count}`",
        f"- Repair: `{repair_count}`",
        f"- Citations valid: `{citations_valid_count}`",
        "",
        "## Timings (ms)",
        "",
        f"- total_ms: {report['summary']['timings_ms']['total_ms']}",
        f"- embed_ms: {report['summary']['timings_ms']['embed_ms']}",
        f"- search_ms: {report['summary']['timings_ms']['search_ms']}",
        f"- db_ms: {report['summary']['timings_ms']['db_ms']}",
        f"- format_ms: {report['summary']['timings_ms']['format_ms']}",
        f"- generate_ms: {report['summary']['timings_ms']['generate_ms']}",
        "",
        "## Query count",
        "",
        f"- query_count: {report['summary']['query_count']}",
        "",
    ]
    out_md.write_text("\n".join(md_lines), encoding="utf-8")

    print(f"Wrote report: {out_json}")
    print(f"Wrote summary: {out_md}")
    print(f"Passed {passed_count}/{len(sample_results)} samples; fallback={fallback_count}; repair={repair_count}")

    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline regression harness for Crystalith generation.")
    default_dataset = Path(__file__).resolve().with_name("llm_eval_dataset.json")
    parser.add_argument("--dataset", default=str(default_dataset), help="Path to dataset JSON")
    parser.add_argument("--output-dir", default=str(Path.cwd() / "llm_eval_reports"), help="Output directory")

    parser.add_argument(
        "--use-real-model",
        action="store_true",
        help="Use real chat model from config (may call external services).",
    )
    parser.add_argument(
        "--confirm-real-model",
        action="store_true",
        help="Required with --use-real-model to acknowledge potential costs/network calls.",
    )
    default_config = _repo_root() / "config" / "app.yaml"
    parser.add_argument("--config", default=str(default_config), help="Config path for --use-real-model")

    args = parser.parse_args()
    raise SystemExit(asyncio.run(_run(args)))


if __name__ == "__main__":
    main()
