import json
import unittest

from worker.runtime import WorkerClient, WorkerRuntime


class StubClient:
    def __init__(self, configured=True, job=None):
        self._configured = configured
        self.job = job
        self.completed = []
        self.failed = []

    def is_configured(self):
        return self._configured

    def claim_next_job(self):
        return self.job

    def mark_complete(self, job_id, output_docx_media_id=None, output_kmz_media_id=None):
        self.completed.append((job_id, output_docx_media_id, output_kmz_media_id))

    def mark_failed(self, job_id, error_log):
        self.failed.append((job_id, error_log))


class FakeResponse:
    def __init__(self, status, payload=None):
        self.status = status
        self.payload = payload

    def read(self):
        if self.payload is None:
            return b""
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class WorkerRuntimeTests(unittest.TestCase):
    def test_run_once_returns_disabled_when_worker_is_not_configured(self):
        runtime = WorkerRuntime(client=StubClient(configured=False))

        result = runtime.run_once()

        self.assertEqual(result["status"], "disabled")
        self.assertEqual(runtime.describe()["lastResultStatus"], "disabled")

    def test_run_once_returns_idle_when_queue_is_empty(self):
        runtime = WorkerRuntime(client=StubClient(configured=True, job=None))

        result = runtime.run_once()

        self.assertEqual(result["status"], "idle")
        self.assertEqual(runtime.describe()["claimedCount"], 0)

    def test_run_once_marks_not_implemented_job_as_failed(self):
        job = {"id": "JOB-1", "kind": "project_dossier"}
        client = StubClient(configured=True, job=job)
        runtime = WorkerRuntime(client=client)

        result = runtime.run_once()

        self.assertEqual(result["status"], "failed")
        self.assertEqual(client.failed[0][0], "JOB-1")
        self.assertIn("project_dossier", client.failed[0][1])
        self.assertEqual(runtime.describe()["claimedCount"], 1)
        self.assertEqual(runtime.describe()["failedCount"], 1)


class WorkerClientTests(unittest.TestCase):
    def test_claim_next_job_returns_none_on_204(self):
        client = WorkerClient(
            base_url="https://geomonitor-api.example.com",
            token="worker-secret",
            urlopen=lambda req, timeout=0: FakeResponse(204),
        )

        result = client.claim_next_job()

        self.assertIsNone(result)

    def test_claim_next_job_returns_data_on_200(self):
        client = WorkerClient(
            base_url="https://geomonitor-api.example.com",
            token="worker-secret",
            urlopen=lambda req, timeout=0: FakeResponse(200, {"data": {"id": "JOB-2"}}),
        )

        result = client.claim_next_job()

        self.assertEqual(result, {"id": "JOB-2"})


if __name__ == "__main__":
    unittest.main()
