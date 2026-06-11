"""Renderer DOCX do Relatorio Mensal de Atividades (portal relat.lima.rio.br).

Recebe o renderModel cru (projetos + atividades + overrides de feriado) e
computa feriados/calendario/meta em Python (espelha apps/relat/.../utils),
montando um .docx institucional AXIA com python-docx. Sem fotos.
"""

import datetime

from docx import Document
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

# DM Sans is not bundled with Windows/Office; viewers without it installed see
# a substituted fallback font (python-docx cannot embed fonts).
BODY_FONT_NAME = "DM Sans"
BODY_FONT_SIZE_PT = 14

# Estilos de paragrafo nomeados: o estilo carrega fonte/tamanho; runs carregam
# apenas bold/italic/cor. Tamanhos escalados de forma proporcional ao corpo 14pt.
STYLE_TITLE = "GM Title"      # titulo do documento
STYLE_HEADING = "GM Heading"  # secoes e titulos de projeto
STYLE_META = "GM Meta"        # subtitulos, intros, legenda, numeros de dia
STYLE_SMALL = "GM Small"      # header/rodape de identificacao, celulas do calendario
STYLE_TINY = "GM Tiny"        # nota de feriado nas celulas

MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
]

CATEGORIES = {
    "vistoria": {"label": "Vistoria de campo", "short": "VISTORIA", "color": "0F6E56"},
    "doc": {"label": "Documentação técnica", "short": "DOCUMENTAÇÃO", "color": "534AB7"},
    "relatorio": {"label": "Elaboração de relatório", "short": "RELATÓRIO", "color": "185FA5"},
    "geo": {"label": "Geoprocessamento", "short": "GEOPROCESSAMENTO", "color": "D85A30"},
    "reuniao": {"label": "Reuniões / articulação", "short": "ARTICULAÇÃO", "color": "5F5E5A"},
    "outro": {"label": "Outros", "short": "OUTROS", "color": "993556"},
}

HOLIDAY_COLOR = "993556"
MUTED_COLOR = "9A9A9A"
TEXT_COLOR = "1A1A1A"


def _norm(value):
    return str(value or "").strip()


# ----------------------------------------------------------------------------
# Datas / feriados (porta de holidays.js + calendar.js + projectMeta.js)
# ----------------------------------------------------------------------------
def date_key(d):
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def parse_date_key(k):
    y, m, d = (int(x) for x in str(k).split("-"))
    return datetime.date(y, m, d)


def easter_date(year):
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    L = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * L) // 451
    month = (h + L - 7 * m + 114) // 31
    day = ((h + L - 7 * m + 114) % 31) + 1
    return datetime.date(year, month, day)


def brazil_holidays_for(year):
    easter = easter_date(year)
    good_friday = easter - datetime.timedelta(days=2)
    carnival_tuesday = easter - datetime.timedelta(days=47)
    corpus_christi = easter + datetime.timedelta(days=60)
    return [
        (f"{year}-01-01", "Confraternização Universal"),
        (date_key(good_friday), "Sexta-feira Santa"),
        (f"{year}-04-21", "Tiradentes"),
        (f"{year}-05-01", "Dia do Trabalho"),
        (date_key(corpus_christi), "Corpus Christi"),
        (f"{year}-09-07", "Independência do Brasil"),
        (f"{year}-10-12", "N. Sra. Aparecida"),
        (f"{year}-11-02", "Finados"),
        (f"{year}-11-15", "Proclamação da República"),
        (f"{year}-11-20", "Consciência Negra"),
        (f"{year}-12-25", "Natal"),
        (date_key(carnival_tuesday), "Carnaval"),
        (f"{year}-04-23", "São Jorge"),
        (f"{year}-01-20", "São Sebastião"),
        (f"{year}-03-01", "Aniversário do Rio"),
    ]


def get_date_range(ref_year, ref_month):
    # ref_month 0-11. Periodo: dia 16 do mes anterior -> dia 15 do mes de ref.
    end = datetime.date(ref_year, ref_month + 1, 15)
    start_month = ref_month  # mes anterior em base 1 = ref_month (ja que ref_month0-based)
    start_year = ref_year
    if start_month == 0:
        start_month = 12
        start_year -= 1
    start = datetime.date(start_year, start_month, 16)
    return start, end


def holiday_map_for_report(ref_year, ref_month, overrides):
    years = {ref_year, ref_year - 1 if ref_month == 0 else ref_year}
    result = {}
    for y in years:
        for date_str, name in brazil_holidays_for(y):
            result[date_str] = name
    for ov in (overrides or []):
        if isinstance(ov, dict) and ov.get("date"):
            result[_norm(ov["date"])] = _norm(ov.get("name")) or "Feriado"
    return result


def is_working_day(d, holiday_keys):
    if d.weekday() >= 5:  # 5=sab, 6=dom
        return False
    return date_key(d) not in holiday_keys


def activities_visible_on_date(activities, date_str, holiday_keys):
    d = parse_date_key(date_str)
    visible = []
    for a in activities:
        if date_str < a["startDate"] or date_str > a["endDate"]:
            continue
        if a["startDate"] == a["endDate"]:
            visible.append(a)
        elif is_working_day(d, holiday_keys):
            visible.append(a)
    return visible


def is_first_visible_day(activity, date_str, holiday_keys):
    if activity["startDate"] == activity["endDate"]:
        return True
    target = parse_date_key(date_str)
    d = parse_date_key(activity["startDate"])
    while d < target:
        if is_working_day(d, holiday_keys):
            return False
        d += datetime.timedelta(days=1)
    return is_working_day(target, holiday_keys)


def _format_day_list(days):
    strs = [f"{d:02d}" for d in days]
    if len(strs) == 1:
        return strs[0]
    if len(strs) == 2:
        return f"{strs[0]} E {strs[1]}"
    return f"{', '.join(strs[:-1])} E {strs[-1]}"


def format_date_label(day_keys):
    if not day_keys:
        return ""
    by_month = {}
    for k in day_keys:
        y, m, d = k.split("-")
        month_key = f"{m}/{y[2:]}"
        by_month.setdefault(month_key, []).append(int(d))
    months_ordered = sorted(by_month.keys(), key=lambda mk: (mk.split("/")[1], mk.split("/")[0]))
    parts = []
    for mk in months_ordered:
        days = sorted(by_month[mk])
        parts.append(f"{_format_day_list(days)}/{mk.split('/')[0]}")
    return " E ".join(parts)


def computed_meta_for_project(activities, project_id, ref_year, ref_month, holiday_keys):
    acts = [a for a in activities if a.get("projectId") == project_id]
    if not acts:
        return ""
    counts = {}
    for a in acts:
        counts[a["category"]] = counts.get(a["category"], 0) + 1
    cats = [
        CATEGORIES.get(k, {}).get("short", str(k).upper())
        for k, _ in sorted(counts.items(), key=lambda kv: -kv[1])
    ]

    start, end = get_date_range(ref_year, ref_month)
    start_key, end_key = date_key(start), date_key(end)
    days = set()
    for a in acts:
        d = parse_date_key(a["startDate"])
        end_d = parse_date_key(a["endDate"])
        while d <= end_d:
            key = date_key(d)
            if start_key <= key <= end_key and (a["startDate"] == a["endDate"] or is_working_day(d, holiday_keys)):
                days.add(key)
            d += datetime.timedelta(days=1)
    sorted_days = sorted(days)
    date_label = format_date_label(sorted_days)
    n = len(sorted_days)
    day_count_label = ""
    if n > 0:
        day_count_label = f" ({n} DIA{'S' if n != 1 else ''} ÚTE{'IS' if n != 1 else 'L'})"
    return f"{', '.join(cats)} · {date_label}{day_count_label}"


# ----------------------------------------------------------------------------
# Helpers de estilo python-docx
# ----------------------------------------------------------------------------
def _set_cell_background(cell, hex_color):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    cell._tc.get_or_add_tcPr().append(shd)


def _run(paragraph, text, bold=False, color=None, italic=False):
    # Fonte e tamanho vem do estilo do paragrafo (herdados de Normal).
    r = paragraph.add_run(text)
    r.bold = bold
    r.italic = italic
    if color:
        r.font.color.rgb = RGBColor.from_string(color)
    return r


def _setup_styles(document):
    """Configura Normal (DM Sans 14pt) e cria os estilos nomeados do relatorio."""
    normal = document.styles["Normal"]
    normal.font.name = BODY_FONT_NAME
    normal.font.size = Pt(BODY_FONT_SIZE_PT)

    spec = [
        (STYLE_TITLE, 20, True),
        (STYLE_HEADING, 16, True),
        (STYLE_META, 12, False),
        (STYLE_SMALL, 10.5, False),
        (STYLE_TINY, 9.5, False),
    ]
    for name, size, bold in spec:
        style = document.styles.add_style(name, WD_STYLE_TYPE.PARAGRAPH)
        style.base_style = normal
        style.font.size = Pt(size)
        if bold:
            style.font.bold = True


# ----------------------------------------------------------------------------
# Render principal
# ----------------------------------------------------------------------------
def render_context_to_docx(context, output_path):
    render_model = context.get("renderModel", {}) if isinstance(context, dict) else {}
    report = render_model.get("monthlyReport", {}) if isinstance(render_model, dict) else {}

    ref_year = int(report.get("refYear"))
    ref_month = int(report.get("refMonth"))
    author = _norm(report.get("authorName"))
    activities = [a for a in (report.get("activities") or []) if isinstance(a, dict)]
    projects = [p for p in (report.get("projects") or []) if isinstance(p, dict)]
    overrides = report.get("holidayOverrides") or []

    hmap = holiday_map_for_report(ref_year, ref_month, overrides)
    holiday_keys = set(hmap.keys())
    start, end = get_date_range(ref_year, ref_month)
    periodo = f"{MONTHS[ref_month]}/{ref_year}"
    doc_id = f"REL.ATV.MENSAL.{ref_month + 1:02d}.{ref_year}"

    document = Document()
    _setup_styles(document)
    document.sections[0].page_height = Cm(29.7)
    document.sections[0].page_width = Cm(21.0)

    # Cabecalho
    header = document.add_table(rows=1, cols=2)
    left, right = header.rows[0].cells
    brand = left.paragraphs[0]
    brand.style = document.styles[STYLE_SMALL]
    _run(brand, "AXIA ENERGIA · GESTÃO AMBIENTAL", color=MUTED_COLOR)
    title = left.add_paragraph(style=STYLE_TITLE)
    _run(title, "Relatório de atividades mensais", color=TEXT_COLOR)
    sub = left.add_paragraph(style=STYLE_META)
    _run(sub, f"{author} · {periodo}", color="6B6B6B")
    rng = left.add_paragraph(style=STYLE_SMALL)
    _run(rng, f"Período: {start.strftime('%d/%m/%Y')} a {end.strftime('%d/%m/%Y')}", color=MUTED_COLOR)
    rp = right.paragraphs[0]
    rp.style = document.styles[STYLE_SMALL]
    rp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    _run(rp, f"{doc_id}\n", bold=True, color="6B6B6B")
    _run(rp, "Rev. 00", color=MUTED_COLOR)

    # Secao 1
    s1 = document.add_paragraph(style=STYLE_HEADING)
    _run(s1, "1. Distribuição de atividades", color=TEXT_COLOR)
    intro1 = document.add_paragraph(style=STYLE_META)
    _run(intro1, "Visão diária das atividades no período. Atividades multi-dia pulam fins de semana e feriados.", color="6B6B6B")

    # Grade do calendario (semanas iniciando no domingo)
    def js_get_day(d):
        return (d.weekday() + 1) % 7  # domingo=0

    grid_start = start - datetime.timedelta(days=js_get_day(start))
    grid_end = end + datetime.timedelta(days=6 - js_get_day(end))

    weekdays = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"]
    days_list = []
    cursor = grid_start
    while cursor <= grid_end:
        days_list.append(cursor)
        cursor += datetime.timedelta(days=1)
    num_weeks = len(days_list) // 7

    cal = document.add_table(rows=1 + num_weeks, cols=7)
    cal.style = "Table Grid"
    for i, wd in enumerate(weekdays):
        cell = cal.rows[0].cells[i]
        para = cell.paragraphs[0]
        para.style = document.styles[STYLE_SMALL]
        para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        _run(para, wd, bold=True, color=MUTED_COLOR)

    for idx, d in enumerate(days_list):
        row = 1 + idx // 7
        col = idx % 7
        cell = cal.rows[row].cells[col]
        key = date_key(d)
        in_range = start <= d <= end
        if not in_range:
            _set_cell_background(cell, "F5F4EF")
        elif key in holiday_keys:
            _set_cell_background(cell, "FBEAF0")
        elif d.weekday() >= 5:
            _set_cell_background(cell, "FAF9F5")

        para = cell.paragraphs[0]
        para.style = document.styles[STYLE_META]
        _run(para, str(d.day), bold=True, color=(TEXT_COLOR if in_range else MUTED_COLOR))

        if in_range and key in holiday_keys:
            hp = cell.add_paragraph(style=STYLE_TINY)
            _run(hp, f"★ {hmap[key]}", color=HOLIDAY_COLOR)

        if in_range:
            for a in activities_visible_on_date(activities, key, holiday_keys):
                cat = CATEGORIES.get(a.get("category"), {})
                color = cat.get("color", "888888")
                prefix = "●" if is_first_visible_day(a, key, holiday_keys) else "↳"
                ap = cell.add_paragraph(style=STYLE_SMALL)
                _run(ap, f"{prefix} ", bold=True, color=color)
                _run(ap, _norm(a.get("description")), color=TEXT_COLOR)

    # Legenda
    legend = document.add_paragraph(style=STYLE_META)
    for key, cat in CATEGORIES.items():
        _run(legend, "● ", bold=True, color=cat["color"])
        _run(legend, f"{cat['label']}    ", color=TEXT_COLOR)
    _run(legend, "★ ", bold=True, color=HOLIDAY_COLOR)
    _run(legend, "Feriado", color=TEXT_COLOR)

    # Secao 2
    s2 = document.add_paragraph(style=STYLE_HEADING)
    _run(s2, "2. Resumo por projeto", color=TEXT_COLOR)
    intro2 = document.add_paragraph(style=STYLE_META)
    _run(intro2, "Descrição das atividades desenvolvidas em cada empreendimento no período.", color="6B6B6B")

    visible_projects = [p for p in projects if _norm(p.get("name")) or _norm(p.get("description"))]
    for idx, p in enumerate(visible_projects):
        title = document.add_paragraph(style=STYLE_HEADING)
        _run(title, f"{idx + 1}. {_norm(p.get('name')) or 'Projeto sem nome'}", color=TEXT_COLOR)
        meta = computed_meta_for_project(activities, p.get("id"), ref_year, ref_month, holiday_keys)
        if meta:
            mp = document.add_paragraph(style=STYLE_SMALL)
            _run(mp, meta, color=MUTED_COLOR)
        body = document.add_paragraph()
        body.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        _run(body, _norm(p.get("description")), color=TEXT_COLOR)

    document.save(output_path)
    return output_path
