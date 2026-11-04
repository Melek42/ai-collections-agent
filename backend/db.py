import os

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

_pool = None


def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            conninfo=os.environ["DATABASE_URL"],
            min_size=1,
            max_size=5,
            # prepare_threshold=None is required for Supabase's connection pooler
            kwargs={"row_factory": dict_row, "prepare_threshold": None},
            open=True,
        )
    return _pool


def query(sql: str, params=None) -> list[dict]:
    """Run one SQL statement in its own transaction and return rows as dicts."""
    with get_pool().connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchall() if cur.description else []


def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None