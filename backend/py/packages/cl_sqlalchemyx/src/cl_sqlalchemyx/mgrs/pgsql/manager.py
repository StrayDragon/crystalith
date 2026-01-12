from __future__ import annotations

from cl_sqlalchemyx.mgrs.base import AsyncDBManager


class AsyncPostgresManager(AsyncDBManager):
    """异步数据库管理器（PostgreSQL）"""
