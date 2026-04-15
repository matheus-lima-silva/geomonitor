import base64
import io
import json
import re
import unittest
import zipfile

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt

from worker.docx_renderer import (
    apply_eletrobras_formatting_compound,
    create_document_from_template,
)
from worker.runtime import WorkerClient, WorkerRuntime


SAMPLE_PNG_BYTES = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2ioAAAAASUVORK5CYII="
)


def read_docx_entry(docx_bytes, entry_name):
    with zipfile.ZipFile(io.BytesIO(docx_bytes)) as docx_zip:
        return docx_zip.read(entry_name).decode("utf-8")


def read_docx_plain_text(docx_bytes):
    """Return concatenated text from every <w:t> element in word/document.xml.

    Useful for assertions on content that spans multiple runs separated by
    field codes or formatting boundaries (e.g. SEQ Foto fields).
    """
    xml = read_docx_entry(docx_bytes, "word/document.xml")
    texts = re.findall(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>", xml)
    return "".join(texts)


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
        document_text = read_docx_plain_text(uploaded_docx)
        header_xml = read_metadata_header(uploaded_docx)

        self.assertIn("Foto 1", document_text)
        self.assertIn("Torre T-01", document_text)
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
        document_text = read_docx_plain_text(uploaded_docx)
        self.assertIn("Introducao global", document_text)
        self.assertIn("ILUSTRA\u00c7\u00c3O FOTOGR\u00c1FICA", document_text)
        self.assertIn("Foto 1", document_text)
        self.assertIn("Foto 2", document_text)

    def test_apply_eletrobras_formatting_compound_aligns_styles_and_margins(self):
        document, used_template, _ = create_document_from_template(
            "LT Test", "COD-001", "2026-04-15", "00"
        )
        self.assertTrue(used_template, "Template file must exist for this test to be meaningful")

        apply_eletrobras_formatting_compound(document)

        sections = list(document.sections)
        self.assertGreater(len(sections), 1, "Template expected to have a back-cover section")

        # All content sections (everything except the back cover) get Eletrobras margins.
        # Margins round-trip through w:pgMar as twips, so Cm(4) lands ~180 EMU off
        # (2268 twips * 635 EMU = 1440180 vs Cm(4) = 1440000). Tolerate <0.01 cm.
        margin_tolerance = Cm(0.01)
        for section in sections[:-1]:
            self.assertAlmostEqual(section.top_margin, Cm(4), delta=margin_tolerance)
            self.assertAlmostEqual(section.right_margin, Cm(2), delta=margin_tolerance)
            self.assertAlmostEqual(section.left_margin, Cm(2), delta=margin_tolerance)
            self.assertAlmostEqual(section.bottom_margin, Cm(2), delta=margin_tolerance)

        # Back-cover section stays at its original zero-margin layout (quarta capa).
        back_cover = sections[-1]
        self.assertAlmostEqual(back_cover.top_margin, Cm(0), delta=margin_tolerance)
        self.assertAlmostEqual(back_cover.right_margin, Cm(0), delta=margin_tolerance)
        self.assertAlmostEqual(back_cover.left_margin, Cm(0), delta=margin_tolerance)
        self.assertAlmostEqual(back_cover.bottom_margin, Cm(0), delta=margin_tolerance)

        # Normal: Arial 11.
        normal = document.styles["Normal"]
        self.assertEqual(normal.font.name, "Arial")
        self.assertEqual(normal.font.size, Pt(11))

        # NormalWeb (body paragraph style) — justified Arial 11 with 12pt spacing.
        body = document.styles["Normal (Web)"]
        self.assertEqual(body.font.name, "Arial")
        self.assertEqual(body.font.size, Pt(11))
        self.assertFalse(body.font.italic)
        self.assertEqual(body.paragraph_format.alignment, WD_ALIGN_PARAGRAPH.JUSTIFY)
        self.assertEqual(body.paragraph_format.space_before, Pt(12))
        self.assertEqual(body.paragraph_format.space_after, Pt(12))

        # Autospacing flags on NormalWeb must be cleared so space_before/after take effect.
        pPr = body.element.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pPr")
        self.assertIsNotNone(pPr)
        spacing_el = pPr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}spacing")
        self.assertIsNotNone(spacing_el)
        self.assertNotIn(
            "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}beforeAutospacing",
            spacing_el.attrib,
        )
        self.assertNotIn(
            "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}afterAutospacing",
            spacing_el.attrib,
        )

        # Caption (photo legend): Arial 10 bold, not italic, no explicit color.
        caption = document.styles["caption"]
        self.assertEqual(caption.font.name, "Arial")
        self.assertEqual(caption.font.size, Pt(10))
        self.assertTrue(caption.font.bold)
        self.assertFalse(caption.font.italic)
        rPr = caption.element.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}rPr")
        if rPr is not None:
            color_el = rPr.find("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}color")
            self.assertIsNone(color_el)

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

    # ------------------------------------------------------------------
    # Regression tests for docx_renderer findings (plan: precious-churning-lecun)
    # ------------------------------------------------------------------

    def _run_dossier(self, context, job_id="JOB-RENDER"):
        job = {"id": job_id, "kind": "project_dossier"}
        client = StubClient(configured=True, job=job, contexts={job_id: context})
        runtime = WorkerRuntime(client=client)
        result = runtime.run_once()
        self.assertEqual(result["status"], "completed")
        return client.uploaded_media[0][1]

    def _run_compound(self, context, job_id="JOB-COMP"):
        job = {"id": job_id, "kind": "report_compound"}
        client = StubClient(configured=True, job=job, contexts={job_id: context})
        runtime = WorkerRuntime(client=client)
        result = runtime.run_once()
        self.assertEqual(result["status"], "completed")
        return client.uploaded_media[0][1]

    def test_project_dossier_preserves_content_section_break(self):
        """T1 — clear_template_body must hand back a content sectPr.

        When the inline section break is preserved, the body ends up with
        at least two <w:sectPr> elements (main content + quarta capa).
        """
        docx = self._run_dossier(build_dossier_context(), job_id="JOB-T1")
        body_xml = read_docx_entry(docx, "word/document.xml")
        sectpr_count = body_xml.count("<w:sectPr")
        self.assertGreaterEqual(
            sectpr_count,
            2,
            msg=f"expected >=2 sectPr (content + quarta capa), got {sectpr_count}",
        )

    def test_report_compound_cover_only_replaces_program_subtitle(self):
        """T2 — titulo_programa only overwrites the 'Programa de ...' line.

        The template cover has three textbox lines: LT, Programa subtitle,
        and 'Inspeção Técnica ...'. The deterministic matcher must only
        touch the middle line; the third line must remain intact.
        """
        context = build_compound_context()
        context["renderModel"]["compound"]["sharedTextsJson"] = {
            "introducao": "Introducao global",
            "nome_lt": "Projeto Alfa",
            "titulo_programa": "Programa Personalizado",
        }
        docx = self._run_compound(context, job_id="JOB-T2")
        plain = read_docx_plain_text(docx)
        self.assertIn("Programa Personalizado", plain)
        # The inspection subtitle from the template must still be present.
        self.assertIn("Inspe", plain)

    def test_project_dossier_header_has_custom_document_code(self):
        """T3 — document_code flows from context, hard-coded placeholder gone."""
        context = build_dossier_context()
        context["renderModel"]["dossier"]["codigo_documento"] = "TESTE.RT.999.2030"
        context["renderModel"]["dossier"]["revisao"] = "07"
        context["job"]["updatedAt"] = "2030-06-15T12:00:00Z"
        docx = self._run_dossier(context, job_id="JOB-T3")
        header_xml = read_metadata_header(docx)
        self.assertIn("TESTE.RT.999.2030", header_xml)
        self.assertNotIn("OOSEMB.RT.023.2026", header_xml)
        self.assertIn("15/06/2030", header_xml)
        # The revision cell is a separate run; check inside <w:t> to avoid
        # matching the font size attribute "07".
        self.assertTrue(
            re.search(r"<w:t[^>]*>07</w:t>", header_xml),
            msg="expected revision '07' inside a <w:t> element of the header",
        )

    def test_format_emission_date_normalizes_to_utc(self):
        """T4 — format_emission_date must normalize timezones to UTC."""
        from worker.docx_renderer import format_emission_date
        self.assertEqual(
            format_emission_date("2026-01-01T02:30:00+00:00"),
            "01/01/2026",
        )
        # 23:30 in -05:00 == 04:30 UTC next day
        self.assertEqual(
            format_emission_date("2025-12-31T23:30:00-05:00"),
            "01/01/2026",
        )

    def test_project_dossier_renders_without_template(self):
        """T5 — fallback path must work when the template file is absent."""
        import unittest.mock as mock
        import worker.docx_renderer as renderer

        real_exists = renderer.os.path.exists

        def fake_exists(path):
            if path == renderer.TEMPLATE_PATH:
                return False
            return real_exists(path)

        with mock.patch.object(renderer.os.path, "exists", side_effect=fake_exists):
            docx = self._run_dossier(build_dossier_context(), job_id="JOB-T5")
        plain = read_docx_plain_text(docx)
        self.assertIn("Resumo do Empreendimento", plain)
        # Photos section still rendered even without the Legenda style.
        self.assertIn("Foto 1", plain)

    def test_project_dossier_header_with_non_lt_project_name(self):
        """T6 — non-LT project names are prefixed and propagated."""
        context = build_dossier_context()
        context["project"]["nome"] = "SE Substacao Norte"
        docx = self._run_dossier(context, job_id="JOB-T6")
        header_xml = read_metadata_header(docx)
        self.assertIn("LT SE Substacao Norte", header_xml)

    def test_report_compound_signature_block_no_blank_page(self):
        """T7 — the signature block adds at most one page break (no blank page).

        The institutional template carries pre-existing page breaks inside
        its quarta-capa textboxes, so we compare the delta between a run
        WITH signatures and a run WITHOUT, instead of an absolute count.
        """
        def _page_break_count(context):
            docx = self._run_compound(context, job_id="JOB-T7")
            xml = read_docx_entry(docx, "word/document.xml")
            return len(re.findall(r'<w:br[^>]*w:type="page"', xml))

        baseline_ctx = build_compound_context()
        baseline_ctx["renderModel"]["compound"]["sharedTextsJson"] = {
            "introducao": "Introducao global",
        }
        baseline = _page_break_count(baseline_ctx)

        signed_ctx = build_compound_context()
        signed_ctx["renderModel"]["compound"]["sharedTextsJson"] = {
            "introducao": "Introducao global",
            "elaboradores": [{"nome": "Fulano"}],
            "revisores": [],
        }
        with_signatures = _page_break_count(signed_ctx)

        delta = with_signatures - baseline
        self.assertLessEqual(
            delta,
            1,
            msg=(
                f"signature block added {delta} page breaks "
                f"(baseline={baseline}, with_signatures={with_signatures})"
            ),
        )

    def test_project_dossier_photo_numbering_sequential(self):
        """T8 — multiple photos produce sequential 'Foto N' captions."""
        context = build_dossier_context()
        context["renderModel"]["sections"]["photos"] = [
            {
                "id": "RPH-A",
                "caption": "A",
                "towerId": "T-01",
                "includeInReport": True,
                "mediaAssetId": "MED-A",
            },
            {
                "id": "RPH-B",
                "caption": "B",
                "towerId": "T-01",
                "includeInReport": True,
                "mediaAssetId": "MED-B",
            },
            {
                "id": "RPH-C",
                "caption": "C",
                "towerId": "T-02",
                "includeInReport": True,
                "mediaAssetId": "MED-C",
            },
        ]
        docx = self._run_dossier(context, job_id="JOB-T8")
        plain = read_docx_plain_text(docx)
        idx1 = plain.find("Foto 1")
        idx2 = plain.find("Foto 2")
        idx3 = plain.find("Foto 3")
        self.assertGreaterEqual(idx1, 0, "Foto 1 missing")
        self.assertGreater(idx2, idx1, "Foto 2 should follow Foto 1")
        self.assertGreater(idx3, idx2, "Foto 3 should follow Foto 2")


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
