from __future__ import annotations

from enum import Enum
from typing import Any, TypeVar

from cl_sqlalchemyx.mgrs.base import AsyncDBManagersMapper
from cl_sqlalchemyx.mgrs.pgsql.manager import AsyncPostgresManager

DBEnumT = TypeVar("DBEnumT", bound=Enum)


class AsyncPostgresManagersMapper(AsyncDBManagersMapper[DBEnumT, AsyncPostgresManager]):
    def __init__(
        self,
        *,
        default_name: DBEnumT,
        managers: dict[DBEnumT, AsyncPostgresManager] | None = None,
        binds: dict[DBEnumT, str] | None = None,
        engine_options_default: dict[str, Any] | None = None,
        binds_engine_options: dict[DBEnumT, dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(
            default_name=default_name,
            managers=managers,
            binds=binds,
            engine_options_default=engine_options_default,
            binds_engine_options=binds_engine_options,
            manager_cls=AsyncPostgresManager,
        )
