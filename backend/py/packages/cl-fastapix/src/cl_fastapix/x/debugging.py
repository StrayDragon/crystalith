import contextlib
import logging
from typing import Any, NoReturn

import anyio
import uvicorn
from anyio.to_thread import current_default_thread_limiter

_LOGGER = logging.getLogger(__name__)


async def monitor_thread_limiter() -> NoReturn:
    """
    check the running threads
    ref: https://github.com/Kludex/fastapi-tips?tab=readme-ov-file#9-your-dependencies-may-be-running-on-threads

    Example:
        ```python
        import uvicorn

        config = uvicorn.Config(app="main:app")
        server = uvicorn.Server(config)


        async def main():
            async with anyio.create_task_group() as tg:
                tg.start_soon(monitor_thread_limiter)
                await server.serve()


        anyio.run(main)
        ```
    """
    limiter = current_default_thread_limiter()
    threads_in_use = limiter.borrowed_tokens
    scan_duration = 0.3
    while True:
        if threads_in_use != limiter.borrowed_tokens and limiter.borrowed_tokens > 0:
            _LOGGER.warning(
                "[fastapix.x.debugging] 监测到有 %s 个线程在使用, "
                "请检查是否有同步写法的Depends或Security, "
                "请使用 cl_fastapix.vendor.fastapi_dependency.* 避免低效, "
                "如果误判请忽略! 当前扫描间隔: %s 秒, "
                "注意少于该时间可能扫不到需要降低该值查看!",
                limiter.borrowed_tokens,
                scan_duration,
            )
            threads_in_use = limiter.borrowed_tokens
        await anyio.sleep(scan_duration)


async def run_server_with_debugging(dev_uvicorn_params: dict[str, Any]) -> None:
    """
    Example:
        ```python
        anyio.run(run_server_with_debugging, dev_uvicorn_params)
        ```
    """
    config = uvicorn.Config(**dev_uvicorn_params)
    server = uvicorn.Server(config)

    cancel_exc = anyio.get_cancelled_exc_class()
    with contextlib.suppress(cancel_exc, KeyboardInterrupt):
        async with anyio.create_task_group() as tg:
            tg.start_soon(monitor_thread_limiter)
            await server.serve()
