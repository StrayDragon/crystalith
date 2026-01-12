"""Tests for shortcuts.meta utilities."""

from sqlalchemy import Index, Integer, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from cl_sqlalchemyx.shortcuts.meta import get_table_ddl_info


class _Base(DeclarativeBase):
    pass


class _MetaExample(_Base):
    __tablename__ = "unit_testing_meta_example"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(50), nullable=False)

    __table_args__ = (Index("idx_unit_testing_meta_example_name", "name"),)


def test_get_table_ddl_info_compiles_table_and_index():
    info = get_table_ddl_info(_MetaExample)

    create_sql = str(info.create_table)
    assert "CREATE TABLE" in create_sql.upper()
    assert "unit_testing_meta_example" in create_sql

    assert len(info.index_ddls) == 1
    index_sql = str(info.index_ddls[0])
    assert "CREATE" in index_sql.upper()
    assert "INDEX" in index_sql.upper()
    assert "idx_unit_testing_meta_example_name" in index_sql


def test_table_ddl_info_print_sql_outputs_statements(capsys):
    info = get_table_ddl_info(_MetaExample)
    info.print_sql()

    captured = capsys.readouterr().out
    assert "CREATE TABLE" in captured.upper()
    assert "CREATE INDEX" in captured.upper()
