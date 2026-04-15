import json
import logging
import os
import threading
import time
from datetime import datetime, timezone
from urllib import error, parse, request

from worker.job_processor import DOCX_CONTENT_TYPE, process_claimed_job
from worker.logging_utils import timed_phase


logger = logging.getLogger("worker.runtime")


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def normalize_text(value):
    return str(value or "").strip()


def is_truthy(value):
    return normalize_text(value).lower() in {"1", "true", "yes", "on", "sim"}


def normalize_base_url(value):
    return normalize_text(value).rstrip("/")


class WorkerClientError(RuntimeError):
    """Raised when the worker cannot talk to the API."""


class WorkerClient:
    def __init__(self, base_url=None, token=None, timeout=30, urlopen=None):
        self.base_url = normalize_base_url(base_url or os.getenv("GEOMONITOR_API_URL"))
        self.token = normalize_text(token or os.getenv("WORKER_API_TOKEN"))
        self.timeout = timeout
        self.urlopen = urlopen or request.urlopen

    def is_configured(self):
        return bool(self.base_url and self.token)

    def claim_next_job(self):
        status_code, payload = self._request_json(
            "POST",
            "/api/report-jobs/claim",
            expected_statuses={200, 204},
        )
        if status_code == 204:
            return None
        return payload.get("data") if isinstance(payload, dict) else None

    def get_job_context(self, job_id):
        _, payload = self._request_json(
            "GET",
            f"/api/report-jobs/{parse.quote(normalize_text(job_id))}/context",
            expected_statuses={200},
        )
        return payload.get("data") if isinstance(payload, dict) else None

    def mark_complete(self, job_id, output_docx_media_id=None, output_kmz_media_id=None):
        payload = {"data": {}}
        if normalize_text(output_docx_media_id):
            payload["data"]["outputDocxMediaId"] = normalize_text(output_docx_media_id)
        if normalize_text(output_kmz_media_id):
            payload["data"]["outputKmzMediaId"] = normalize_text(output_kmz_media_id)
        return self._request_json(
            "PUT",
            f"/api/report-jobs/{parse.quote(normalize_text(job_id))}/complete",
            payload=payload,
            expected_statuses={200},
        )

    def mark_failed(self, job_id, error_log):
        return self._request_json(
            "PUT",
            f"/api/report-jobs/{parse.quote(normalize_text(job_id))}/fail",
            payload={"data": {"errorLog": str(error_log or "")}},
            expected_statuses={200},
        )

    def download_media_content(self, media_id):
        normalized = normalize_text(media_id)
        start = time.perf_counter()
        try:
            status_code, raw_body, headers = self._request_binary(
                "GET",
                f"/api/media/{parse.quote(normalized)}/content",
                expected_statuses={200},
            )
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            logger.warning(
                "download_image_error",
                extra={
                    "phase": "download_image",
                    "mediaAssetId": normalized,
                    "durationMs": duration_ms,
                    "errorType": type(exc).__name__,
                },
            )
            raise

        duration_ms = int((time.perf_counter() - start) * 1000)
        size_bytes = len(raw_body) if raw_body else 0
        logger.info(
            "download_image",
            extra={
                "phase": "download_image",
                "mediaAssetId": normalized,
                "sizeBytes": size_bytes,
                "durationMs": duration_ms,
            },
        )
        return {
            "statusCode": status_code,
            "buffer": raw_body,
            "contentType": headers.get("Content-Type") if isinstance(headers, dict) else "",
        }

    def create_output_media(
        self,
        job_id,
        file_name,
        content_type=DOCX_CONTENT_TYPE,
        size_bytes=0,
        purpose="report_output_docx",
    ):
        _, payload = self._request_json(
            "POST",
            "/api/media/upload-url",
            payload={
                "data": {
                    "fileName": normalize_text(file_name) or "arquivo.docx",
                    "contentType": normalize_text(content_type) or DOCX_CONTENT_TYPE,
                    "sizeBytes": int(size_bytes or 0),
                    "purpose": normalize_text(purpose) or "generic",
                    "linkedResourceType": "report_job",
                    "linkedResourceId": normalize_text(job_id),
                },
            },
            expected_statuses={201},
        )
        return payload.get("data") if isinstance(payload, dict) else None

    def upload_media_binary(self, upload_descriptor, content, content_type=DOCX_CONTENT_TYPE):
        if not isinstance(upload_descriptor, dict):
            raise WorkerClientError("Descritor de upload invalido retornado pela API.")

        href = normalize_text(upload_descriptor.get("href"))
        method = normalize_text(upload_descriptor.get("method")) or "PUT"
        if not href:
            raise WorkerClientError("URL de upload nao informada pela API.")

        headers = dict(upload_descriptor.get("headers") or {})
        if "Content-Type" not in headers:
            headers["Content-Type"] = normalize_text(content_type) or DOCX_CONTENT_TYPE

        if self._is_local_api_url(href):
            headers["X-Worker-Token"] = self.token
            url = self._resolve_absolute_url(href)
        else:
            url = href

        req = request.Request(
            url,
            data=content,
            method=method,
            headers=headers,
        )

        try:
            with self.urlopen(req, timeout=self.timeout) as response:
                status_code = getattr(response, "status", None) or response.getcode()
                if status_code < 200 or status_code >= 300:
                    raise WorkerClientError(f"Upload retornou status {status_code}.")
                response.read()
        except error.HTTPError as exc:
            raise WorkerClientError(
                self._build_error_message(exc.code, exc.read()),
            ) from exc
        except error.URLError as exc:
            raise WorkerClientError(f"Falha ao enviar media para a API/storage: {exc.reason}") from exc

    def complete_media_upload(self, media_id, stored_size_bytes=None, sha256=""):
        payload = {
            "data": {
                "id": normalize_text(media_id),
            },
        }
        if stored_size_bytes is not None:
            payload["data"]["storedSizeBytes"] = int(stored_size_bytes)
        if normalize_text(sha256):
            payload["data"]["sha256"] = normalize_text(sha256)

        return self._request_json(
            "POST",
            "/api/media/complete",
            payload=payload,
            expected_statuses={200},
        )

    def _request_json(self, method, path, payload=None, expected_statuses=None):
        if not self.is_configured():
            raise WorkerClientError("GEOMONITOR_API_URL e WORKER_API_TOKEN devem estar configurados.")

        request_data = None
        headers = {"X-Worker-Token": self.token}
        if payload is not None:
            request_data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = request.Request(
            f"{self.base_url}{path}",
            data=request_data,
            method=method,
            headers=headers,
        )

        try:
            with self.urlopen(req, timeout=self.timeout) as response:
                status_code = getattr(response, "status", None)
                if status_code is None:
                    status_code = response.getcode()
                raw_body = response.read()
        except error.HTTPError as exc:
            status_code = exc.code
            raw_body = exc.read()
            if expected_statuses and status_code not in expected_statuses:
                raise WorkerClientError(self._build_error_message(status_code, raw_body)) from exc
        except error.URLError as exc:
            raise WorkerClientError(f"Falha ao comunicar com a API: {exc.reason}") from exc

        if expected_statuses and status_code not in expected_statuses:
            raise WorkerClientError(self._build_error_message(status_code, raw_body))

        if not raw_body:
            return status_code, None

        try:
            return status_code, json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise WorkerClientError("Resposta JSON invalida da API.") from exc

    def _request_binary(self, method, path, expected_statuses=None):
        if not self.is_configured():
            raise WorkerClientError("GEOMONITOR_API_URL e WORKER_API_TOKEN devem estar configurados.")

        req = request.Request(
            f"{self.base_url}{path}",
            method=method,
            headers={"X-Worker-Token": self.token},
        )

        try:
            with self.urlopen(req, timeout=self.timeout) as response:
                status_code = getattr(response, "status", None)
                if status_code is None:
                    status_code = response.getcode()
                raw_body = response.read()
                headers = dict(getattr(response, "headers", {}) or {})
        except error.HTTPError as exc:
            status_code = exc.code
            raw_body = exc.read()
            headers = dict(getattr(exc, "headers", {}) or {})
            if expected_statuses and status_code not in expected_statuses:
                raise WorkerClientError(self._build_error_message(status_code, raw_body)) from exc
        except error.URLError as exc:
            raise WorkerClientError(f"Falha ao comunicar com a API: {exc.reason}") from exc

        if expected_statuses and status_code not in expected_statuses:
            raise WorkerClientError(self._build_error_message(status_code, raw_body))

        return status_code, raw_body, headers

    def _resolve_absolute_url(self, href):
        text = normalize_text(href)
        if text.startswith("http://") or text.startswith("https://"):
            return text
        return parse.urljoin(f"{self.base_url}/", text)

    def _is_local_api_url(self, href):
        text = normalize_text(href)
        if not text:
            return False
        if text.startswith("/"):
            return True
        return text.startswith(self.base_url)

    @staticmethod
    def _build_error_message(status_code, raw_body):
        if raw_body:
            try:
                payload = json.loads(raw_body.decode("utf-8"))
                message = normalize_text(payload.get("message"))
                if message:
                    return f"API respondeu {status_code}: {message}"
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass
        return f"API respondeu {status_code}."


class WorkerState:
    def __init__(self, auto_poll_enabled=False, poll_interval_seconds=15):
        self._lock = threading.Lock()
        self._data = {
            "autoPollEnabled": bool(auto_poll_enabled),
            "pollIntervalSeconds": int(poll_interval_seconds),
            "configured": False,
            "claimedCount": 0,
            "completedCount": 0,
            "failedCount": 0,
            "lastPollAt": "",
            "lastActivityAt": "",
            "lastJobId": "",
            "lastJobKind": "",
            "lastResultStatus": "idle",
            "lastError": "",
            "currentJobId": "",
        }

    def snapshot(self):
        with self._lock:
            return dict(self._data)

    def note_poll(self, timestamp, configured):
        with self._lock:
            self._data["lastPollAt"] = timestamp
            self._data["configured"] = bool(configured)

    def note_idle(self, timestamp, status, message=""):
        with self._lock:
            self._data["lastActivityAt"] = timestamp
            self._data["lastResultStatus"] = status
            self._data["lastError"] = message
            self._data["currentJobId"] = ""

    def note_claimed(self, timestamp, job_id, job_kind):
        with self._lock:
            self._data["claimedCount"] += 1
            self._data["lastActivityAt"] = timestamp
            self._data["lastJobId"] = job_id
            self._data["lastJobKind"] = job_kind
            self._data["currentJobId"] = job_id
            self._data["lastResultStatus"] = "processing"
            self._data["lastError"] = ""

    def note_completed(self, timestamp, job_id):
        with self._lock:
            self._data["completedCount"] += 1
            self._data["lastActivityAt"] = timestamp
            self._data["lastJobId"] = job_id
            self._data["lastResultStatus"] = "completed"
            self._data["lastError"] = ""
            self._data["currentJobId"] = ""

    def note_failed(self, timestamp, job_id, error_log):
        with self._lock:
            self._data["failedCount"] += 1
            self._data["lastActivityAt"] = timestamp
            self._data["lastJobId"] = job_id
            self._data["lastResultStatus"] = "failed"
            self._data["lastError"] = str(error_log or "")
            self._data["currentJobId"] = ""


class WorkerRuntime:
    def __init__(self, client=None, auto_poll=None, poll_interval_seconds=None, processor=None):
        self.client = client or WorkerClient()
        env_interval = normalize_text(os.getenv("WORKER_POLL_INTERVAL_SECONDS")) or "15"
        default_interval = max(1, int(env_interval))
        self.poll_interval_seconds = max(1, int(poll_interval_seconds or default_interval))
        self.auto_poll_enabled = bool(
            is_truthy(os.getenv("WORKER_AUTO_POLL")) if auto_poll is None else auto_poll
        )
        self.processor = processor or (lambda job: process_claimed_job(self.client, job))
        self.state = WorkerState(
            auto_poll_enabled=self.auto_poll_enabled,
            poll_interval_seconds=self.poll_interval_seconds,
        )

    def describe(self):
        snapshot = self.state.snapshot()
        snapshot["configured"] = self.client.is_configured()
        return snapshot

    def run_once(self):
        timestamp = utc_now()
        configured = self.client.is_configured()
        self.state.note_poll(timestamp, configured)

        if not configured:
            message = "GEOMONITOR_API_URL e WORKER_API_TOKEN devem estar configurados."
            self.state.note_idle(timestamp, "disabled", message)
            logger.warning("worker_not_configured")
            return {
                "status": "disabled",
                "message": message,
                "timestamp": timestamp,
            }

        try:
            with timed_phase(logger, "claim"):
                job = self.client.claim_next_job()
        except WorkerClientError as exc:
            error_log = str(exc)
            self.state.note_idle(timestamp, "error", error_log)
            logger.error("claim_failed", extra={"errorLog": error_log})
            return {
                "status": "error",
                "errorLog": error_log,
                "timestamp": timestamp,
            }

        if not job:
            self.state.note_idle(timestamp, "idle")
            return {
                "status": "idle",
                "message": "Nenhum job na fila.",
                "timestamp": timestamp,
            }

        job_id = normalize_text(job.get("id")) or "unknown-job"
        job_kind = normalize_text(job.get("kind")) or "unknown"
        self.state.note_claimed(timestamp, job_id, job_kind)
        logger.info(
            "job_claimed",
            extra={"jobId": job_id, "kind": job_kind},
        )

        try:
            with timed_phase(logger, "process", job_id=job_id, kind=job_kind):
                result = self.processor(job)
            result_status = normalize_text(result.get("status")) or "failed"
            if result_status == "completed":
                with timed_phase(logger, "mark_complete", job_id=job_id):
                    self.client.mark_complete(
                        job_id,
                        output_docx_media_id=result.get("outputDocxMediaId"),
                        output_kmz_media_id=result.get("outputKmzMediaId"),
                    )
                finished_at = utc_now()
                self.state.note_completed(finished_at, job_id)
                logger.info(
                    "job_completed",
                    extra={"jobId": job_id, "kind": job_kind},
                )
                return {
                    "status": "completed",
                    "jobId": job_id,
                    "kind": job_kind,
                    "timestamp": finished_at,
                }

            error_log = normalize_text(result.get("errorLog")) or f"Falha ao processar job '{job_kind}'."
            with timed_phase(logger, "mark_failed", job_id=job_id):
                self.client.mark_failed(job_id, error_log)
            finished_at = utc_now()
            self.state.note_failed(finished_at, job_id, error_log)
            logger.warning(
                "job_failed",
                extra={"jobId": job_id, "kind": job_kind, "errorLog": error_log},
            )
            return {
                "status": "failed",
                "jobId": job_id,
                "kind": job_kind,
                "errorLog": error_log,
                "timestamp": finished_at,
            }
        except WorkerClientError as exc:
            error_log = f"Falha de comunicacao com a API ao processar '{job_id}': {exc}"
            try:
                self.client.mark_failed(job_id, error_log)
            except WorkerClientError as mark_exc:
                error_log = f"{error_log} | falha ao reportar erro: {mark_exc}"
        except Exception as exc:  # pragma: no cover - protection for unexpected runtime failures
            error_log = f"Falha interna do worker ao processar '{job_id}': {exc}"
            logger.exception(
                "job_unexpected_error",
                extra={"jobId": job_id, "kind": job_kind},
            )
            try:
                self.client.mark_failed(job_id, error_log)
            except WorkerClientError as mark_exc:
                error_log = f"{error_log} | falha ao reportar erro: {mark_exc}"

        finished_at = utc_now()
        self.state.note_failed(finished_at, job_id, error_log)
        logger.error(
            "job_failed_with_exception",
            extra={"jobId": job_id, "kind": job_kind, "errorLog": error_log},
        )
        return {
            "status": "failed",
            "jobId": job_id,
            "kind": job_kind,
            "errorLog": error_log,
            "timestamp": finished_at,
        }
