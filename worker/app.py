import json
import os
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def utc_now():
    return datetime.now(timezone.utc).isoformat()


class WorkerHandler(BaseHTTPRequestHandler):
    server_version = "GeomonitorWorker/0.1"

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
                },
            )
            return

        if self.path == "/":
            self._write_json(
                200,
                {
                    "message": "geomonitor worker bootstrap active",
                    "status": "idle",
                    "timestamp": utc_now(),
                },
            )
            return

        self._write_json(404, {"error": "not_found", "timestamp": utc_now()})

    def log_message(self, format, *args):  # noqa: A003
        message = "%s - - [%s] %s" % (
            self.address_string(),
            self.log_date_time_string(),
            format % args,
        )
        print(message, flush=True)


def main():
    port = int(os.getenv("PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), WorkerHandler)
    print(
        f"[geomonitor-worker] bootstrap worker listening on 0.0.0.0:{port}",
        flush=True,
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
