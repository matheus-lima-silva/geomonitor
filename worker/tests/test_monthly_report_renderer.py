import datetime
import os
import tempfile

from docx import Document
from docx.shared import Pt

from worker.monthly_report_renderer import (
    easter_date,
    get_date_range,
    computed_meta_for_project,
    holiday_map_for_report,
    render_context_to_docx,
)


def _build_context():
    return {
        "job": {"id": "JOB-1", "kind": "monthly_report"},
        "renderModel": {
            "monthlyReport": {
                "id": "MR-1",
                "refYear": 2026,
                "refMonth": 4,
                "authorName": "Ana Lima",
                "status": "final",
                "projects": [
                    {"id": "P1", "name": "LT 500 kV Bom Despacho", "description": "Atividade de gabinete e campo.", "collapsed": False, "sortOrder": 0},
                ],
                "activities": [
                    {"id": "1", "projectId": "P1", "category": "vistoria", "description": "Vistoria torre T-10", "startDate": "2026-04-16", "endDate": "2026-04-16"},
                    {"id": "2", "projectId": "P1", "category": "relatorio", "description": "Redacao do relatorio", "startDate": "2026-04-20", "endDate": "2026-04-21"},
                ],
                "holidayOverrides": [],
            },
        },
    }


def _all_text(path):
    doc = Document(path)
    chunks = [p.text for p in doc.paragraphs]
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for p in cell.paragraphs:
                    chunks.append(p.text)
    return "\n".join(chunks)


def test_easter_2026():
    assert easter_date(2026) == datetime.date(2026, 4, 5)


def test_get_date_range_periodo_16_a_15():
    start, end = get_date_range(2026, 4)  # Maio/2026
    assert start == datetime.date(2026, 4, 16)
    assert end == datetime.date(2026, 5, 15)


def test_computed_meta_paridade_com_frontend():
    holiday_keys = set(holiday_map_for_report(2026, 4, []).keys())
    activities = [
        {"id": "1", "projectId": "P1", "category": "vistoria", "startDate": "2026-04-16", "endDate": "2026-04-16"},
        {"id": "2", "projectId": "P1", "category": "relatorio", "startDate": "2026-04-20", "endDate": "2026-04-21"},
    ]
    meta = computed_meta_for_project(activities, "P1", 2026, 4, holiday_keys)
    assert meta == "VISTORIA, RELATÓRIO · 16 E 20/04 (2 DIAS ÚTEIS)"


def test_render_produces_docx_with_expected_content():
    context = _build_context()

    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out.docx")
        render_context_to_docx(context, out)
        assert os.path.getsize(out) > 0
        text = _all_text(out)

    assert "REL.ATV.MENSAL.05.2026" in text
    assert "Relatório de atividades mensais" in text
    assert "Ana Lima" in text
    assert "LT 500 kV Bom Despacho" in text
    assert "Vistoria torre T-10" in text
    assert "Tiradentes" in text  # feriado 21/04 dentro do periodo
    assert "DIAS ÚTEIS" in text  # meta computada do projeto


def test_render_uses_named_styles_with_dm_sans_14():
    context = _build_context()

    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "out.docx")
        render_context_to_docx(context, out)
        doc = Document(out)

        # Base: texto normal em DM Sans 14pt.
        normal = doc.styles["Normal"]
        assert normal.font.name == "DM Sans"
        assert normal.font.size == Pt(14)

        # Estilos nomeados com escala proporcional ao corpo.
        expected = {
            "GM Title": Pt(20),
            "GM Heading": Pt(16),
            "GM Meta": Pt(12),
            "GM Small": Pt(10.5),
            "GM Tiny": Pt(9.5),
        }
        for name, size in expected.items():
            style = doc.styles[name]
            assert style.font.size == size
            assert style.base_style.name == "Normal"

        # Paragrafos de papel recorrente usam estilo nomeado, nao formatacao ad-hoc.
        headings = [p for p in doc.paragraphs if p.text.startswith("1. Distribuição")]
        assert headings and headings[0].style.name == "GM Heading"

        # Nenhum run carrega fonte explicita: tudo herda de Normal.
        all_paragraphs = list(doc.paragraphs)
        for table in doc.tables:
            for row in table.rows:
                for cell in row.cells:
                    all_paragraphs.extend(cell.paragraphs)
        assert all_paragraphs
        for p in all_paragraphs:
            for r in p.runs:
                assert r.font.name is None
