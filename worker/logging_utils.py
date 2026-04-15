"""Helpers de logging estruturado para o worker.

Este modulo fornece:

* ``configure_worker_logging`` - instala um handler no root logger que emite
  linhas JSON via stdout, respeitando ``WORKER_LOG_LEVEL`` (default ``INFO``).
* ``timed_phase`` - context manager que emite ``phase_start``, ``phase_end`` e,
  em caso de excecao, ``phase_error`` com ``durationMs`` medido via
  ``time.perf_counter()``.

O objetivo e dar visibilidade para onde o worker gasta tempo durante o
processamento de um job, o que e critico para diagnosticar jobs que ficam
presos em ``processing`` sem nunca concluirem.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import traceback
from contextlib import contextmanager
from datetime import datetime, timezone


_RESERVED_ATTRS = {
    "name",
    "msg",
    "args",
    "levelname",
    "levelno",
    "pathname",
    "filename",
    "module",
    "exc_info",
    "exc_text",
    "stack_info",
    "lineno",
    "funcName",
    "created",
    "msecs",
    "relativeCreated",
    "thread",
    "threadName",
    "processName",
    "process",
    "message",
    "asctime",
    "taskName",
}


class JsonFormatter(logging.Formatter):
    """Formata registros de log como JSON de uma linha.

    Campos padrao:
        - ``ts``: ISO 8601 UTC
        - ``level``: nivel do logger em uppercase
        - ``logger``: nome do logger de origem
        - ``msg``: mensagem formatada

    Qualquer atributo extra passado via ``logger.info("...", extra={...})`` e
    copiado diretamente no JSON, o que permite incluir campos como
    ``phase``, ``jobId``, ``durationMs``, ``mediaAssetId``, etc.
    """

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }

        for key, value in record.__dict__.items():
            if key in _RESERVED_ATTRS:
                continue
            if key.startswith("_"):
                continue
            try:
                json.dumps(value)
                payload[key] = value
            except (TypeError, ValueError):
                payload[key] = repr(value)

        if record.exc_info:
            payload["exc"] = "".join(traceback.format_exception(*record.exc_info)).strip()

        return json.dumps(payload, ensure_ascii=False)


def configure_worker_logging(level: str | None = None) -> None:
    """Configura o root logger do worker.

    Chamado uma vez no ``main()`` do worker antes de qualquer operacao.
    Idempotente - chamadas repetidas apenas substituem o handler anterior.
    """

    effective_level = (level or os.getenv("WORKER_LOG_LEVEL") or "INFO").upper()
    numeric_level = getattr(logging, effective_level, logging.INFO)

    root = logging.getLogger()
    root.setLevel(numeric_level)

    # Remover handlers previos para evitar duplicacao ao reconfigurar.
    for existing in list(root.handlers):
        root.removeHandler(existing)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setLevel(numeric_level)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)


@contextmanager
def timed_phase(
    logger: logging.Logger,
    phase: str,
    job_id: str | None = None,
    **extra,
):
    """Context manager que emite logs de inicio/fim de uma fase.

    Uso::

        with timed_phase(logger, "render_docx", job_id=job_id):
            ...

    Emite:
        * ``phase_start`` no inicio do bloco
        * ``phase_end`` com ``durationMs`` ao sair com sucesso
        * ``phase_error`` com ``durationMs`` e ``errorType`` se uma excecao
          escapar do bloco (a excecao e re-lancada normalmente).
    """

    base_extra: dict = {"phase": phase}
    if job_id:
        base_extra["jobId"] = job_id
    base_extra.update(extra)

    logger.info("%s_start", phase, extra=dict(base_extra))
    start = time.perf_counter()
    try:
        yield
    except Exception as exc:
        duration_ms = int((time.perf_counter() - start) * 1000)
        err_extra = dict(base_extra)
        err_extra["durationMs"] = duration_ms
        err_extra["errorType"] = type(exc).__name__
        err_extra["errorMessage"] = str(exc)
        logger.error("%s_error", phase, extra=err_extra, exc_info=True)
        raise
    else:
        duration_ms = int((time.perf_counter() - start) * 1000)
        end_extra = dict(base_extra)
        end_extra["durationMs"] = duration_ms
        logger.info("%s_end", phase, extra=end_extra)
