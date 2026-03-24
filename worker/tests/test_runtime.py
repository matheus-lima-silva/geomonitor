import base64
import io
import json
import unittest
import zipfile

from worker.runtime import WorkerClient, WorkerRuntime


SAMPLE_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2ioAAAAASUVORK5CYII="
)


def read_docx_entry(docx_bytes, entry_name):
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as docx_zip:
        return docx_zip.read(entry_name).decode("utf-8")


def read_kmz_entry(kmz_bytes, entry_name):
    with zipfile.ZipFile(io.BytesIO(kmz_bytes)) as kmz_zip:
        return kmz_zip.read(entry_name)


def read_metadata_header(docx_bytes):
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as docx_zip:
        for name in sorted(docx_zip.namelist()):
            if not name.startswith("word/header") or not name.endswith(".xml"):
                continue
            content = docx_zip.read(name).decode("utf-8")
            if "N° do Documento:" in content:
                return content
    return ""


def build_dossier_context():
    return {
        "job": {"id": "JOB-1", "kind": "project_dossier"},
        "project": {"id": "PRJ-01", "nome": "Projeto 1"},
        "defaults": {"projectId": "PRJ-01"},
        "renderModel": {
            "dossier": {
                "id": "DOS-1",
                "nome": "Dossie 1",
                "observacoes": "Observacoes",
                "scopeJson": {"includeFotos": True},
            },
            "sections": {
                "licencas": [{"id": "LO-1", "orgao": "IBAMA"}],
                "inspecoes": [],
                "erosoes": [],
                "entregas": [],
                "workspaces": [{"id": "RW-1", "nome": "Workspace 1", "status": "draft"}],
                "photos": [{
                    "id": "RPH-1",
                    "caption": "Foto 1",
                    "workspaceId": "RW-1",
                    "towerId": "T-01",
                    "includeInReport": True,
                    "mediaAssetId": "MED-PHOTO-1",
                }],
            },
        },
    }


def build_compound_context():
    return {
        "job": {"id": "JOB-2", "kind": "report_compound"},
        "project": None,
        "defaults": None,
        "renderModel": {
            "compound": {
                "id": "RC-1",
                "nome": "Composto 1",
                "sharedTextsJson": {"introducao": "Introducao global"},
                "orderJson": ["RW-2", "RW-1"],
                "workspaceIds": ["RW-1", "RW-2"],
            },
            "workspaces": [
                {
                    "workspace": {"id": "RW-2", "nome": "Workspace 2", "status": "draft"},
                    "project": {"id": "PRJ-02", "nome": "Projeto 2"},
                    "photos": [],
                },
                {
                    "workspace": {"id": "RW-1", "nome": "Workspace 1", "status": "draft"},
                    "project": {"id": "PRJ-01", "nome": "Projeto 1"},
                    "photos": [{
                        "id": "RPH-2",
                        "caption": "Foto 2",
                        "workspaceId": "RW-1",
                        "includeInReport": True,
                        "mediaAssetId": "MED-PHOTO-2",
                    }],
                },
            ],
        },
    }


def build_workspace_kmz_context():
    return {
        "job": {"id": "JOB-KMZ-1", "kind": "workspace_kmz", "workspaceId": "RW-1"},
        "project": {
            "id": "PRJ-01",
            "nome": "Projeto 1",
            "linhaFonteKml": "Linha Norte C1",
            "linhaCoordenadas": [
                {"latitude": -22.1, "longitude": -43.1},
                {"latitude": -22.2, "longitude": -43.2},
            ],
            "torresCoordenadas": [
                {"numero": "1", "latitude": -22.3, "longitude": -43.3},
            ],
        },
        "defaults": {"projectId": "PRJ-01"},
        "renderModel": {
            "workspaceKmz": {
                "token": "kmz-1",
                "workspaceId": "RW-1",
            },
            "workspace": {"id": "RW-1", "nome": "Workspace 1", "projectId": "PRJ-01"},
            "photos": [{
                "id": "RPH-KMZ-1",
                "caption": "Foto KMZ 1",
                "workspaceId": "RW-1",
                "towerId": "T-01",
                "includeInReport": True,
                "mediaAssetId": "MED-KMZ-PHOTO-1",
            }],
        },
    }


class StubClient:
    def __init__(self, configured=True, job=None, contexts=None, download_fail_media_ids=None, fail_upload=False):
        self._configured = configured
        self.job = job
        self.contexts = contexts or {}
        self.download_fail_media_ids = set(download_fail_media_ids or [])
        self.fail_upload = fail_upload
        self.completed = []
        self.failed = []
        self.created_media = []
        self.uploaded_media = []
        self.completed_media = []

    def is_configured(self):
        return self._configured

    def claim_next_job(self):
        return self.job

    def get_job_context(self, job_id):
        return self.contexts.get(job_id)

    def download_media_content(self, media_id):
        if media_id in self.download_fail_media_ids:
            raise RuntimeError(f"media {media_id} indisponivel")
        return {
            "buffer": SAMPLE_PNG_BYTES,
            "contentType": "image/png",
        }

    def create_output_media(self, job_id, file_name, content_type, size_bytes=0, purpose="report_output_docx"):
        media = {
            "id": f"MED-{job_id}",
            "upload": {
                "href": "https://geomonitor-api.example.com/api/media/upload",
                "method": "PUT",
                "headers": {"Content-Type": content_type},
            },
        }
        self.created_media.append((job_id, file_name, content_type, size_bytes, purpose, media))
        return media

    def upload_media_binary(self, upload_descriptor, content, content_type):
        if self.fail_upload:
            raise RuntimeError("falha no upload final")
        self.uploaded_media.append((upload_descriptor, content, content_type))

    def complete_media_upload(self, media_id, stored_size_bytes=None, sha256=""):
        self.completed_media.append((media_id, stored_size_bytes, sha256))

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

    def test_run_once_completes_project_dossier_job(self):
        job = {"id": "JOB-1", "kind": "project_dossier"}
        client = StubClient(
            configured=True,
            job=job,
            contexts={"JOB-1": build_dossier_context()},
        )
        runtime = WorkerRuntime(client=client)

        result = runtime.run_once()

        self.assertEqual(result["status"], "completed")
        self.assertEqual(client.completed[0][0], "JOB-1")
        self.assertEqual(client.completed[0][1], "MED-JOB-1")
        self.assertEqual(runtime.describe()["completedCount"], 1)

        uploaded_docx = client.uploaded_media[0][1]
        document_xml = read_docx_entry(uploaded_docx, "word/document.xml")
        header_xml = read_metadata_header(uploaded_docx)

        self.assertIn("Foto 1 - Foto 1", document_xml)
        self.assertIn("Regiao da Torre T-01", document_xml)
        self.assertIn('TOC \\o "1-3"', document_xml)
        self.assertIn("LT Projeto 1", header_xml)

    def test_run_once_completes_report_compound_job(self):
        job = {"id": "JOB-2", "kind": "report_compound"}
        client = StubClient(
            configured=True,
            job=job,
            contexts={"JOB-2": build_compound_context()},
        )
        runtime = WorkerRuntime(client=client)

        result = runtime.run_once()

        self.assertEqual(result["status"], "completed")
        self.assertEqual(client.completed[0][0], "JOB-2")
        self.assertEqual(client.completed[0][1], "MED-JOB-2")

        uploaded_docx = client.uploaded_media[0][1]
        document_xml = read_docx_entry(uploaded_docx, "word/document.xml")
        self.assertIn("Projeto 1 - Workspace 1", document_xml)
        self.assertIn("Foto 1 - Foto 2", document_xml)

    def test_run_once_completes_workspace_kmz_job(self):
        job = {"id": "JOB-KMZ-1", "kind": "workspace_kmz"}
        client = StubClient(
            configured=True,
            job=job,
            contexts={"JOB-KMZ-1": build_workspace_kmz_context()},
        )
        runtime = WorkerRuntime(client=client)

        result = runtime.run_once()

        self.assertEqual(result["status"], "completed")
        self.assertEqual(client.completed[0][0], "JOB-KMZ-1")
        self.assertEqual(client.completed[0][2], "MED-JOB-KMZ-1")

        uploaded_kmz = client.uploaded_media[0][1]
        kml_text = read_kmz_entry(uploaded_kmz, "doc.kml").decode("utf-8")

        self.assertIn("Projeto 1 - Workspace 1", kml_text)
        self.assertIn("Linha Norte C1", kml_text)
        self.assertIn("Foto KMZ 1", kml_text)
        self.assertIn("files/Foto_KMZ_1.png", kml_text)
        self.assertEqual(read_kmz_entry(uploaded_kmz, "files/Foto_KMZ_1.png"), SAMPLE_PNG_BYTES)

    def test_run_once_marks_job_as_failed_when_upload_breaks(self):
        job = {"id": "JOB-UPLOAD-FAIL", "kind": "project_dossier"}
        client = StubClient(
            configured=True,
            job=job,
            contexts={"JOB-UPLOAD-FAIL": build_dossier_context()},
            fail_upload=True,
        )
        runtime = WorkerRuntime(client=client)

        result = runtime.run_once()

        self.assertEqual(result["status"], "failed")
        self.assertEqual(client.failed[0][0], "JOB-UPLOAD-FAIL")
        self.assertIn("falha no upload final", client.failed[0][1])

    def test_run_once_ignores_individual_photo_download_failure(self):
        context = build_dossier_context()
        context["renderModel"]["sections"]["photos"].append({
            "id": "RPH-2",
            "caption": "Foto com falha",
            "workspaceId": "RW-1",
            "includeInReport": True,
            "mediaAssetId": "MED-PHOTO-FAIL",
        })
        job = {"id": "JOB-PHOTO-FAIL", "kind": "project_dossier"}
        client = StubClient(
            configured=True,
            job=job,
            contexts={"JOB-PHOTO-FAIL": context},
            download_fail_media_ids={"MED-PHOTO-FAIL"},
        )
        runtime = WorkerRuntime(client=client)

        result = runtime.run_once()

        self.assertEqual(result["status"], "completed")
        self.assertEqual(client.completed[0][0], "JOB-PHOTO-FAIL")


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

    def test_get_job_context_returns_payload_data(self):
        client = WorkerClient(
            base_url="https://geomonitor-api.example.com",
            token="worker-secret",
            urlopen=lambda req, timeout=0: FakeResponse(200, {"data": {"job": {"id": "JOB-CTX"}}}),
        )

        result = client.get_job_context("JOB-CTX")

        self.assertEqual(result, {"job": {"id": "JOB-CTX"}})


if __name__ == "__main__":
    unittest.main()
