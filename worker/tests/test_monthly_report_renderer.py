import datetime
import os
import tempfile

from docx import Document

from worker.monthly_report_renderer import (
    easter_date,
    get_date_range,
    computed_meta_for_project,
    holiday_map_for_report,
    render_context_to_docx,
)


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
    context = {
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
