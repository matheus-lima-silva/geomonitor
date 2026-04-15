import json
import logging
import os
import socket
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from worker.logging_utils import configure_worker_logging
from worker.runtime import WorkerRuntime, utc_now


RUNTIME = WorkerRuntime()
logger = logging.getLogger("worker.app")


class WorkerHandler(BaseHTTPRequestHandler):
    server_version = "GeomonitorWorker/0.2"

    def _write_json(self, status_code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            self._write_json(
                200,
                {
                    "status": "ok",
                    "service": os.getenv("WORKER_NAME", "geomonitor-worker"),
                    "environment": os.getenv("WORKER_ENV", "unknown"),
                    "timestamp": utc_now(),
                    "worker": RUNTIME.describe(),
                },
            )
            return

        if self.path == "/stats":
            self._write_json(
                200,
                {
                    "status": "success",
                    "data": RUNTIME.describe(),
                    "timestamp": utc_now(),
                },
            )
            return

        if self.path == "/":
            self._write_json(
                200,
                {
                    "message": "geomonitor worker ready",
                    "mode": "poll" if RUNTIME.auto_poll_enabled else "manual",
                    "timestamp": utc_now(),
                    "worker": RUNTIME.describe(),
                },
            )
            return

        self._write_json(404, {"error": "not_found", "timestamp": utc_now()})

    def do_POST(self):  # noqa: N802
        if self.path == "/run-once":
            result = RUNTIME.run_once()
            status_code = 500 if result.get("status") == "error" else 200
            self._write_json(status_code, result)
            return

        self._write_json(404, {"error": "not_found", "timestamp": utc_now()})

    def log_message(self, format, *args):  # noqa: A003
        logger.debug(
            "http_access",
            extra={
                "client": self.address_string(),
                "line": format % args,
            },
        )


def start_background_poll(runtime):
    if not runtime.auto_poll_enabled:
        logger.info("auto_poll_disabled")
        return None

    logger.info(
        "auto_poll_enabled",
        extra={"pollIntervalSeconds": runtime.poll_interval_seconds},
    )

    def loop():
        while True:
            result = runtime.run_once()
            if result.get("status") == "error":
                logger.error(
                    "poll_error",
                    extra={"errorLog": result.get("errorLog")},
                )
            time.sleep(runtime.poll_interval_seconds)

    thread = threading.Thread(target=loop, name="worker-poller", daemon=True)
    thread.start()
    return thread


def main():
    configure_worker_logging()
    port = int(os.getenv("PORT", "8080"))
    logger.info(
        "worker_boot",
        extra={
            "apiUrl": RUNTIME.client.base_url,
            "tokenConfigured": bool(RUNTIME.client.token),
            "port": port,
        },
    )
    start_background_poll(RUNTIME)

    class DualStackHTTPServer(ThreadingHTTPServer):
        address_family = socket.AF_INET6

    server = DualStackHTTPServer(("::", port), WorkerHandler)
    logger.info("worker_listening", extra={"port": port})
    server.serve_forever()


if __name__ == "__main__":
    main()
