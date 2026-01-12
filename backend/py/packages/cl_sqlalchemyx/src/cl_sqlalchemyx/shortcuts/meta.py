# pragma: no cover
import dataclasses
from collections.abc import Callable
from typing import cast

from sqlalchemy import Dialect, Table
from sqlalchemy.dialects.sqlite import dialect as sqlite_dialect
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.schema import CreateIndex, CreateTable
from sqlalchemy.sql.compiler import Compiled


@dataclasses.dataclass
class TableDDLInfo:
    create_table: Compiled
    index_ddls: list[Compiled]

    def print_sql(self) -> None:
        create_table_sql = str(self.create_table)

        fields = create_table_sql.split("\n")
        before_fields: list[str] = []
        other_fields: list[str] = []

        for field in fields:
            if not field.strip():
                continue
            if (
                "id INTEGER NOT NULL AUTO_INCREMENT" in field
                or "create_datetime DATETIME" in field
                or "create_operator_id INTEGER" in field
                or "update_datetime DATETIME" in field
                or "update_operator_id INTEGER" in field
                or "is_delete INTEGER" in field
            ):
                before_fields.append(field)
            else:
                other_fields.append(field)

        if before_fields:
            other_fields = [other_fields[0], *before_fields, *other_fields[1:]]
        create_table_sql = "\n".join(other_fields)
        if not create_table_sql.endswith(";"):
            create_table_sql = create_table_sql + ";"
        print(create_table_sql)
        for index_ddl in self.index_ddls:
            index_ddl_sql = str(index_ddl)
            if not index_ddl_sql.endswith(";"):
                index_ddl_sql = index_ddl_sql + ";"
            print(index_ddl_sql)
        print()


def get_table_ddl_info(
    entity: type[DeclarativeBase],
    dialect_fn: Callable[[], Dialect | None] = lambda: sqlite_dialect(),
) -> TableDDLInfo:
    dialect = dialect_fn()
    table = cast("Table", entity.__table__)
    stmt = CreateTable(table)

    index_ddls: list[Compiled] = []
    for index in table.indexes:
        create_index = CreateIndex(index)
        index_ddl = create_index.compile(dialect=dialect, compile_kwargs={"literal_binds": True})
        index_ddls.append(index_ddl)
    return TableDDLInfo(
        create_table=stmt.compile(dialect=dialect, compile_kwargs={"literal_binds": True}),
        index_ddls=index_ddls,
    )
