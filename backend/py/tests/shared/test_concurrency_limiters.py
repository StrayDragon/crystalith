from __future__ import annotations

import asyncio

import pytest

from crystalith.shared.concurrency import StageLimiter


@pytest.mark.asyncio
async def test_stage_limiter_enforces_limit() -> None:
    limiter = StageLimiter("test", limit=2)
    release = asyncio.Event()

    active = 0
    max_active = 0
    entered = 0
    entered_two = asyncio.Event()

    async def worker() -> None:
        nonlocal active, max_active, entered
        async with limiter.acquire():
            active += 1
            max_active = max(max_active, active)
            entered += 1
            if entered >= 2:
                entered_two.set()
            await release.wait()
            active -= 1

    tasks = [asyncio.create_task(worker()) for _ in range(5)]
    await asyncio.wait_for(entered_two.wait(), timeout=1.0)
    await asyncio.sleep(0.01)

    assert max_active == 2

    release.set()
    await asyncio.gather(*tasks)


@pytest.mark.asyncio
async def test_stage_limiter_records_wait_ms_when_contended() -> None:
    limiter = StageLimiter("test", limit=1)
    started = asyncio.Event()
    release = asyncio.Event()
    observed: list[int] = []

    async def holder() -> None:
        async with limiter.acquire():
            started.set()
            await release.wait()

    async def waiter() -> None:
        await started.wait()
        async with limiter.acquire() as lease:
            observed.append(int(lease.wait_ms))

    t1 = asyncio.create_task(holder())
    t2 = asyncio.create_task(waiter())

    await asyncio.wait_for(started.wait(), timeout=1.0)
    await asyncio.sleep(0.02)
    release.set()

    await asyncio.gather(t1, t2)
    assert observed and observed[0] > 0
