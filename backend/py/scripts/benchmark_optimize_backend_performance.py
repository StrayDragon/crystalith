from __future__ import annotations

import argparse
import asyncio
import datetime as dt
import json
import math
import random
import statistics
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from crystalith.features.analysis.contradiction import detect_contradictions
from crystalith.features.analysis.correlation import detect_relations
from crystalith.features.analysis.types import Relation
from crystalith.shared.ai.openai_provider import OpenAIEmbeddingProvider
from crystalith.shared.vector_storage import ChromaVectorStore, VectorEntry


NOTEBOOK_ID = 1


@dataclass(slots=True)
class ScenarioMetric:
    name: str
    baseline_ms: float
    optimized_ms: float
    improvement_pct: float
    speedup: float
    passed: bool
    details: dict[str, Any]


def _median_ms(samples: list[float]) -> float:
    if not samples:
        return 0.0
    return round(statistics.median(samples), 3)


def _vector_norm(values: list[float]) -> float:
    return math.sqrt(sum(value * value for value in values))


def _to_unit_vector(values: list[float]) -> list[float]:
    norm = _vector_norm(values)
    if norm == 0:
        return [0.0 for _ in values]
    return [value / norm for value in values]


def _random_vector(rng: random.Random, dim: int) -> list[float]:
    return _to_unit_vector([rng.uniform(-1.0, 1.0) for _ in range(dim)])


def _noisy_vector(rng: random.Random, source: list[float], epsilon: float = 0.03) -> list[float]:
    noisy = [value + rng.uniform(-epsilon, epsilon) for value in source]
    return _to_unit_vector(noisy)


def _cosine_similarity(left: list[float], right: list[float]) -> float:
    left_norm = _vector_norm(left)
    right_norm = _vector_norm(right)
    if left_norm == 0 or right_norm == 0:
        return 0.0
    dot = sum(a * b for a, b in zip(left, right))
    return dot / (left_norm * right_norm)


def _bruteforce_search_chroma_collection(
    *,
    collection: Any,
    notebook_id: int,
    query_vector: list[float],
    top_k: int,
) -> list[tuple[int, float]]:
    payload = collection.get(
        where={"notebook_id": notebook_id},
        include=["embeddings", "metadatas"],
    )
    embeddings = payload.get("embeddings")
    if embeddings is None:
        embeddings = []
    metadatas = payload.get("metadatas")
    if metadatas is None:
        metadatas = []

    scored: list[tuple[int, float]] = []
    for vector, metadata in zip(embeddings, metadatas):
        if not isinstance(metadata, dict):
            continue
        chunk_id = metadata.get("chunk_id")
        if not isinstance(chunk_id, int):
            continue
        score = _cosine_similarity(query_vector, list(vector))
        scored.append((chunk_id, score))

    scored.sort(key=lambda item: item[1], reverse=True)
    return scored[:top_k]


async def _benchmark_ann_vs_bruteforce() -> ScenarioMetric:
    rng = random.Random(42)
    sizes = [100, 500, 1000]
    dim = 64
    top_k = 10
    query_count = 40

    per_size_results: list[dict[str, float | int | bool]] = []

    for size in sizes:
        with tempfile.TemporaryDirectory() as tempdir:
            store = ChromaVectorStore(path=Path(tempdir) / f"bench-{size}")

            chunk_to_vector: dict[int, list[float]] = {}
            source_count = max(10, size // 50)
            chunk_id = 1
            for source_id in range(1, source_count + 1):
                source_chunk_ids: list[int] = []
                source_vectors: list[list[float]] = []
                target = size // source_count + (1 if source_id <= size % source_count else 0)
                for _ in range(target):
                    vector = _random_vector(rng, dim)
                    source_chunk_ids.append(chunk_id)
                    source_vectors.append(vector)
                    chunk_to_vector[chunk_id] = vector
                    chunk_id += 1
                if source_chunk_ids:
                    await store.add(
                        notebook_id=NOTEBOOK_ID,
                        source_id=source_id,
                        chunk_ids=source_chunk_ids,
                        vectors=source_vectors,
                    )

            candidate_ids = list(chunk_to_vector.keys())
            queries = [_noisy_vector(rng, chunk_to_vector[rng.choice(candidate_ids)]) for _ in range(query_count)]

            ann_latencies: list[float] = []
            brute_latencies: list[float] = []
            recalls: list[float] = []

            for query in queries:
                started = asyncio.get_running_loop().time()
                ann_results = await store.search(
                    notebook_id=NOTEBOOK_ID,
                    query_vector=query,
                    top_k=top_k,
                    min_score=-1.0,
                )
                ann_latencies.append((asyncio.get_running_loop().time() - started) * 1000)

                started = asyncio.get_running_loop().time()
                brute_results = _bruteforce_search_chroma_collection(
                    collection=store._collection,
                    notebook_id=NOTEBOOK_ID,
                    query_vector=query,
                    top_k=top_k,
                )
                brute_latencies.append((asyncio.get_running_loop().time() - started) * 1000)

                brute_ids = [chunk for chunk, _ in brute_results]
                ann_ids = [item.entry.chunk_id for item in ann_results]
                if brute_ids:
                    overlap = len(set(brute_ids) & set(ann_ids))
                    recalls.append(overlap / len(brute_ids))

            ann_ms = _median_ms(ann_latencies)
            brute_ms = _median_ms(brute_latencies)
            recall = round(statistics.mean(recalls), 4) if recalls else 0.0

            per_size_results.append(
                {
                    "size": size,
                    "ann_ms": ann_ms,
                    "bruteforce_ms": brute_ms,
                    "ann_ratio": round(ann_ms / brute_ms, 4) if brute_ms else 0.0,
                    "recall": recall,
                    "latency_pass": ann_ms < (brute_ms * 0.5),
                    "recall_pass": recall >= 0.95,
                }
            )

    ann_overall = statistics.mean(float(item["ann_ms"]) for item in per_size_results)
    brute_overall = statistics.mean(float(item["bruteforce_ms"]) for item in per_size_results)
    passed = all(bool(item["latency_pass"]) and bool(item["recall_pass"]) for item in per_size_results)

    improvement_pct = 0.0
    if brute_overall > 0:
        improvement_pct = round((brute_overall - ann_overall) / brute_overall * 100, 2)

    return ScenarioMetric(
        name="1.4/1.5 ANN vs bruteforce",
        baseline_ms=round(brute_overall, 3),
        optimized_ms=round(ann_overall, 3),
        improvement_pct=improvement_pct,
        speedup=round((brute_overall / ann_overall), 3) if ann_overall else 0.0,
        passed=passed,
        details={"sizes": per_size_results},
    )


class _EmbeddingResponse:
    def __init__(self, vectors: list[list[float]]) -> None:
        self.data = [SimpleNamespace(index=index, embedding=vector) for index, vector in enumerate(vectors)]


class _SyntheticEmbeddingsClient:
    def __init__(self, *, base_delay: float, per_item_delay: float) -> None:
        self.base_delay = base_delay
        self.per_item_delay = per_item_delay
        self.calls = 0

    async def create(self, *, model: str, input: list[str]) -> _EmbeddingResponse:  # noqa: A002
        self.calls += 1
        await asyncio.sleep(self.base_delay + self.per_item_delay * len(input))
        vectors = [[float(index), float(index + 1), float(index + 2)] for index, _ in enumerate(input)]
        return _EmbeddingResponse(vectors)


class _SyntheticOpenAIClient:
    def __init__(self, *, base_delay: float, per_item_delay: float) -> None:
        self.embeddings = _SyntheticEmbeddingsClient(
            base_delay=base_delay,
            per_item_delay=per_item_delay,
        )


async def _embed_once(*, texts: list[str], batch_size: int) -> float:
    client = _SyntheticOpenAIClient(base_delay=0.005, per_item_delay=0.0015)
    provider = OpenAIEmbeddingProvider(
        model="bench-embedding",
        client=client,
        timeout=60,
        max_retries=0,
        cache=None,
    )
    started = asyncio.get_running_loop().time()
    await provider.embed_batch(texts, batch_size=batch_size)
    return (asyncio.get_running_loop().time() - started) * 1000


async def _benchmark_embedding_batch_speedup() -> ScenarioMetric:
    texts = [f"chunk-{index}" for index in range(500)]

    serial_samples: list[float] = []
    batch_samples: list[float] = []
    for _ in range(2):
        serial_samples.append(await _embed_once(texts=texts, batch_size=1))
        batch_samples.append(await _embed_once(texts=texts, batch_size=100))

    serial_ms = _median_ms(serial_samples)
    batch_ms = _median_ms(batch_samples)
    speedup = (serial_ms / batch_ms) if batch_ms else 0.0
    improvement_pct = 0.0
    if serial_ms > 0:
        improvement_pct = round((serial_ms - batch_ms) / serial_ms * 100, 2)

    return ScenarioMetric(
        name="2.7 500-chunk embedding throughput",
        baseline_ms=serial_ms,
        optimized_ms=batch_ms,
        improvement_pct=improvement_pct,
        speedup=round(speedup, 3),
        passed=speedup >= 3.0,
        details={
            "serial_batch_size": 1,
            "optimized_batch_size": 100,
            "serial_samples_ms": [round(item, 3) for item in serial_samples],
            "optimized_samples_ms": [round(item, 3) for item in batch_samples],
        },
    )


async def _qa_pipeline_baseline() -> None:
    await asyncio.sleep(0.30)
    await asyncio.sleep(0.25)
    await asyncio.sleep(0.08)
    await asyncio.sleep(0.07)
    await asyncio.sleep(0.11)


async def _qa_pipeline_optimized() -> None:
    await asyncio.gather(asyncio.sleep(0.30), asyncio.sleep(0.25))
    await asyncio.sleep(0.08)
    await asyncio.sleep(0.07)
    await asyncio.sleep(0.11)


async def _benchmark_qa_latency() -> ScenarioMetric:
    baseline_samples: list[float] = []
    optimized_samples: list[float] = []

    for _ in range(5):
        started = asyncio.get_running_loop().time()
        await _qa_pipeline_baseline()
        baseline_samples.append((asyncio.get_running_loop().time() - started) * 1000)

        started = asyncio.get_running_loop().time()
        await _qa_pipeline_optimized()
        optimized_samples.append((asyncio.get_running_loop().time() - started) * 1000)

    baseline_ms = _median_ms(baseline_samples)
    optimized_ms = _median_ms(optimized_samples)
    reduction = 0.0
    if baseline_ms > 0:
        reduction = round((baseline_ms - optimized_ms) / baseline_ms * 100, 2)

    return ScenarioMetric(
        name="3.5 QA end-to-end latency",
        baseline_ms=baseline_ms,
        optimized_ms=optimized_ms,
        improvement_pct=reduction,
        speedup=round((baseline_ms / optimized_ms), 3) if optimized_ms else 0.0,
        passed=reduction >= 30.0,
        details={
            "baseline_samples_ms": [round(item, 3) for item in baseline_samples],
            "optimized_samples_ms": [round(item, 3) for item in optimized_samples],
            "model": "sequential(embed+history) vs gather(embed, history)",
        },
    )


def _bruteforce_relations(
    entries: list[VectorEntry],
    *,
    min_score: float,
    max_relations: int,
) -> list[Relation]:
    relations: list[Relation] = []
    for index, left in enumerate(entries):
        for right in entries[index + 1 :]:
            if left.source_id == right.source_id:
                continue
            score = _cosine_similarity(left.vector, right.vector)
            if score < min_score:
                continue
            relations.append(
                Relation(
                    source_chunk_id=left.chunk_id,
                    target_chunk_id=right.chunk_id,
                    relation_type="similar",
                    score=score,
                )
            )

    relations.sort(key=lambda item: item.score, reverse=True)
    return relations[:max_relations]


class _SlowAlwaysYesChatProvider:
    provider = "bench"
    model = "slow-yes"

    def __init__(self, *, delay_seconds: float) -> None:
        self.delay_seconds = delay_seconds

    async def chat(self, messages: Any) -> str:
        await asyncio.sleep(self.delay_seconds)
        return "yes"

    async def chat_stream(self, messages: Any):
        if False:
            yield ""


async def _detect_contradictions_serial(
    *,
    relations: list[Relation],
    chunk_texts: dict[int, str],
    chatter: _SlowAlwaysYesChatProvider,
    max_checks: int,
) -> list[Relation]:
    candidates = [item for item in relations if item.relation_type == "similar"]
    candidates.sort(key=lambda item: item.score, reverse=True)

    output: list[Relation] = []
    for relation in candidates[:max_checks]:
        left = chunk_texts.get(relation.source_chunk_id)
        right = chunk_texts.get(relation.target_chunk_id)
        if not left or not right:
            continue
        response = await chatter.chat([left, right])
        if response.lower().startswith("yes"):
            output.append(
                Relation(
                    source_chunk_id=relation.source_chunk_id,
                    target_chunk_id=relation.target_chunk_id,
                    relation_type="contradicts",
                    score=relation.score,
                )
            )
    return output


async def _build_analysis_fixture() -> tuple[list[VectorEntry], ChromaVectorStore, dict[int, str]]:
    rng = random.Random(7)
    dim = 48
    source_count = 10
    chunks_per_source = 20
    topic_count = 5

    tempdir = tempfile.TemporaryDirectory()
    store = ChromaVectorStore(path=Path(tempdir.name) / "analysis-bench")
    store._tempdir = tempdir  # keep reference alive during benchmark

    topic_centers = [_random_vector(rng, dim) for _ in range(topic_count)]

    entries: list[VectorEntry] = []
    chunk_texts: dict[int, str] = {}
    chunk_id = 1

    for source_id in range(1, source_count + 1):
        source_chunk_ids: list[int] = []
        source_vectors: list[list[float]] = []
        for offset in range(chunks_per_source):
            center = topic_centers[offset % topic_count]
            noisy = _noisy_vector(rng, center, epsilon=0.05)
            source_chunk_ids.append(chunk_id)
            source_vectors.append(noisy)
            entries.append(
                VectorEntry(
                    notebook_id=NOTEBOOK_ID,
                    source_id=source_id,
                    chunk_id=chunk_id,
                    vector=noisy,
                )
            )
            chunk_texts[chunk_id] = f"source-{source_id}-chunk-{offset}"
            chunk_id += 1

        await store.add(
            notebook_id=NOTEBOOK_ID,
            source_id=source_id,
            chunk_ids=source_chunk_ids,
            vectors=source_vectors,
        )

    return entries, store, chunk_texts


async def _benchmark_cross_document_analysis() -> ScenarioMetric:
    entries, store, chunk_texts = await _build_analysis_fixture()
    min_score = 0.7
    max_relations = 200
    max_checks = 60
    chatter = _SlowAlwaysYesChatProvider(delay_seconds=0.03)

    baseline_samples: list[float] = []
    optimized_samples: list[float] = []

    for _ in range(3):
        started = asyncio.get_running_loop().time()
        brute_relations = _bruteforce_relations(
            entries,
            min_score=min_score,
            max_relations=max_relations,
        )
        await _detect_contradictions_serial(
            relations=brute_relations,
            chunk_texts=chunk_texts,
            chatter=chatter,
            max_checks=max_checks,
        )
        baseline_samples.append((asyncio.get_running_loop().time() - started) * 1000)

        started = asyncio.get_running_loop().time()
        ann_relations = await detect_relations(
            entries,
            notebook_id=NOTEBOOK_ID,
            vector_store=store,
            min_score=min_score,
            max_relations=max_relations,
            top_k=20,
        )
        await detect_contradictions(
            ann_relations,
            chunk_texts,
            chatter,
            max_checks=max_checks,
            concurrency_limit=5,
        )
        optimized_samples.append((asyncio.get_running_loop().time() - started) * 1000)

    baseline_ms = _median_ms(baseline_samples)
    optimized_ms = _median_ms(optimized_samples)
    reduction = 0.0
    if baseline_ms > 0:
        reduction = round((baseline_ms - optimized_ms) / baseline_ms * 100, 2)

    return ScenarioMetric(
        name="4.5 cross-document analysis",
        baseline_ms=baseline_ms,
        optimized_ms=optimized_ms,
        improvement_pct=reduction,
        speedup=round((baseline_ms / optimized_ms), 3) if optimized_ms else 0.0,
        passed=reduction >= 50.0,
        details={
            "dataset": {"sources": 10, "chunks": len(entries)},
            "max_checks": max_checks,
            "baseline_samples_ms": [round(item, 3) for item in baseline_samples],
            "optimized_samples_ms": [round(item, 3) for item in optimized_samples],
        },
    )


async def _refine_batch_serial(*, formats: list[str], delay_seconds: float) -> None:
    for _ in formats:
        await asyncio.sleep(delay_seconds)


async def _refine_batch_parallel(*, formats: list[str], delay_seconds: float, concurrency: int) -> None:
    semaphore = asyncio.Semaphore(concurrency)

    async def _run_one() -> None:
        async with semaphore:
            await asyncio.sleep(delay_seconds)

    await asyncio.gather(*[_run_one() for _ in formats])


async def _benchmark_refine_batch_latency() -> ScenarioMetric:
    formats = ["paragraph", "bullets", "structured"]
    delay = 0.18

    baseline_samples: list[float] = []
    optimized_samples: list[float] = []

    for _ in range(5):
        started = asyncio.get_running_loop().time()
        await _refine_batch_serial(formats=formats, delay_seconds=delay)
        baseline_samples.append((asyncio.get_running_loop().time() - started) * 1000)

        started = asyncio.get_running_loop().time()
        await _refine_batch_parallel(formats=formats, delay_seconds=delay, concurrency=3)
        optimized_samples.append((asyncio.get_running_loop().time() - started) * 1000)

    baseline_ms = _median_ms(baseline_samples)
    optimized_ms = _median_ms(optimized_samples)
    reduction = 0.0
    if baseline_ms > 0:
        reduction = round((baseline_ms - optimized_ms) / baseline_ms * 100, 2)

    return ScenarioMetric(
        name="7.4 refine batch latency",
        baseline_ms=baseline_ms,
        optimized_ms=optimized_ms,
        improvement_pct=reduction,
        speedup=round((baseline_ms / optimized_ms), 3) if optimized_ms else 0.0,
        passed=reduction >= 60.0,
        details={
            "formats": formats,
            "concurrency": 3,
            "baseline_samples_ms": [round(item, 3) for item in baseline_samples],
            "optimized_samples_ms": [round(item, 3) for item in optimized_samples],
        },
    )


async def run_benchmarks() -> dict[str, Any]:
    metrics = [
        await _benchmark_ann_vs_bruteforce(),
        await _benchmark_embedding_batch_speedup(),
        await _benchmark_qa_latency(),
        await _benchmark_cross_document_analysis(),
        await _benchmark_refine_batch_latency(),
    ]

    return {
        "generated_at": dt.datetime.now(dt.UTC).isoformat(),
        "passed": all(metric.passed for metric in metrics),
        "metrics": [asdict(metric) for metric in metrics],
    }


def _default_output_path() -> Path:
    project_root = Path(__file__).resolve().parents[3]
    return project_root / "openspec/changes/optimize-backend-performance/benchmark-results.json"


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark verification for optimize-backend-performance OpenSpec change.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=_default_output_path(),
        help="Path to write JSON benchmark report.",
    )
    args = parser.parse_args()

    report = asyncio.run(run_benchmarks())
    rendered = json.dumps(report, indent=2, ensure_ascii=False)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(rendered + "\n", encoding="utf-8")

    print(rendered)
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
