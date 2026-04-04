import io
import os
import re
import zipfile
from datetime import datetime, timezone

from copy import deepcopy

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches


MAX_IMAGE_WIDTH_CM = 15
HEADING_NUM_ID = "12"
SIGNATURE_LINE = "_________________________________________"
MAX_IMAGE_WIDTH_INCHES = MAX_IMAGE_WIDTH_CM / 2.54
TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "assets", "template_relatorio.docx")


def normalize_text(value):
    return str(value or "").strip()


def ensure_dict(value):
    return value if isinstance(value, dict) else {}


def safe_list(value):
    return value if isinstance(value, list) else []


def format_timestamp(value=None):
    if not value:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    text = normalize_text(value)
    if not text:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    except ValueError:
        return text


def format_emission_date(value=None):
    if not value:
        return datetime.now(timezone.utc).strftime("%d/%m/%Y")

    text = normalize_text(value)
    if not text:
        return datetime.now(timezone.utc).strftime("%d/%m/%Y")

    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.strftime("%d/%m/%Y")
    except ValueError:
        parts = text.split("-")
        if len(parts) == 3:
            return f"{parts[2].zfill(2)}/{parts[1].zfill(2)}/{parts[0]}"
        return text


def normalize_lt_name(value, fallback="Relatorio"):
    text = normalize_text(value) or normalize_text(fallback) or "Relatorio"
    return text if text.upper().startswith("LT ") else f"LT {text}"


def replace_paragraph_text(paragraph, text):
    runs = list(paragraph.runs)
    if not runs:
        paragraph.text = text
        return
    runs[0].text = text
    for run in runs[1:]:
        run.text = ""


def iter_header_paragraphs(document):
    for section in document.sections:
        for header in (section.header, section.first_page_header, section.even_page_header):
            for paragraph in header.paragraphs:
                yield paragraph
            for table in header.tables:
                for row in table.rows:
                    for cell in row.cells:
                        for paragraph in cell.paragraphs:
                            yield paragraph


def update_template_headers(document, title, document_code="", emission_date="", revision="00"):
    normalized_title = normalize_lt_name(title)
    normalized_code = normalize_text(document_code)
    normalized_date = format_emission_date(emission_date)
    normalized_revision = normalize_text(revision) or "00"

    for paragraph in iter_header_paragraphs(document):
        text = normalize_text(paragraph.text)
        if not text:
            continue
        if text.startswith("LT "):
            replace_paragraph_text(paragraph, normalized_title)
            continue
        if "N° do Documento:" in text:
            replace_paragraph_text(paragraph, f"N° do Documento: {normalized_code}")
            continue
        if "Emissão Inicial:" in text:
            replace_paragraph_text(paragraph, f"Emissão Inicial: {normalized_date}")
            continue
        if "Rev.:" in text:
            replace_paragraph_text(paragraph, f"Rev.: {normalized_revision}")


def clear_template_body(document):
    body = document._element.body
    children = list(body)
    start_index = None

    for index, child in enumerate(children):
        if child.tag not in {qn("w:p"), qn("w:tbl")}:
            continue
        text = "".join(child.itertext()).strip()
        if text.startswith("Introdução") or text.startswith("Introducao"):
            start_index = index
            break

    if start_index is None:
        return

    for child in children[start_index:]:
        if child.tag == qn("w:sectPr"):
            continue
        body.remove(child)


def fix_body_sectpr(document):
    body = document._element.body
    body_sectpr = body.find(qn('w:sectPr'))
    if body_sectpr is None:
        return
    for para in body.findall(qn('w:p')):
        ppr = para.find(qn('w:pPr'))
        if ppr is None:
            continue
        inline_sectpr = ppr.find(qn('w:sectPr'))
        if inline_sectpr is not None and inline_sectpr.find(qn('w:footerReference')) is not None:
            body.replace(body_sectpr, deepcopy(inline_sectpr))
            return


def create_document_from_template(title, document_code="", emission_date="", revision="00"):
    if os.path.exists(TEMPLATE_PATH):
        document = Document(TEMPLATE_PATH)
        clear_template_body(document)
        fix_body_sectpr(document)
        update_template_headers(document, title, document_code, emission_date, revision)
        return document, True

    return Document(), False


def replace_header_xml_value(xml, marker, placeholder, value):
    marker_index = xml.find(marker)
    if marker_index < 0:
        return xml
    pattern = f">{placeholder}</w:t>"
    target_index = xml.find(pattern, marker_index)
    if target_index < 0:
        return xml
    return xml[:target_index] + f">{value}</w:t>" + xml[target_index + len(pattern):]


def replace_header_lt_title(xml, title):
    paragraphs = re.findall(r"<w:p\b[^>]*>[\s\S]*?</w:p>", xml)
    for paragraph in paragraphs:
        text_runs = re.findall(r"<w:t[^>]*>([\s\S]*?)</w:t>", paragraph)
        text = "".join(text_runs).strip()
        if not text.startswith("LT "):
            continue
        run_blocks = re.findall(r"<w:r\b[^>]*>[\s\S]*?<w:t[^>]*>[\s\S]*?</w:t>[\s\S]*?</w:r>", paragraph)
        if not run_blocks:
            continue
        first_run = run_blocks[0]
        open_tag_match = re.match(r"^<w:r\b[^>]*>", first_run)
        open_tag = open_tag_match.group(0) if open_tag_match else "<w:r>"
        rpr_match = re.search(r"<w:rPr[\s\S]*?</w:rPr>", first_run)
        rpr = rpr_match.group(0) if rpr_match else ""
        replacement_run = f'{open_tag}{rpr}<w:t xml:space="preserve">{normalize_lt_name(title)}</w:t></w:r>'
        updated_paragraph = re.sub(
            r"(?:<w:r\b[^>]*>[\s\S]*?<w:t[^>]*>[\s\S]*?</w:t>[\s\S]*?</w:r>)+",
            replacement_run,
            paragraph,
            count=1,
        )
        return xml.replace(paragraph, updated_paragraph, 1)
    return xml


def rewrite_template_header_metadata(docx_path, title, document_code="", emission_date="", revision="00"):
    if not os.path.exists(docx_path):
        return

    normalized_date = format_emission_date(emission_date)
    day, month, year = (normalized_date.split("/") + ["", "", ""])[:3]
    temp_path = f"{docx_path}.tmp"

    with zipfile.ZipFile(docx_path, "r") as source_zip, zipfile.ZipFile(temp_path, "w", compression=zipfile.ZIP_DEFLATED) as target_zip:
        for info in source_zip.infolist():
            data = source_zip.read(info.filename)
            if info.filename.startswith("word/header") and info.filename.endswith(".xml"):
                xml = data.decode("utf-8")
                if "N° do Documento:" in xml and "Emissão Inicial:" in xml and "Rev.:" in xml:
                    xml = replace_header_lt_title(xml, title)
                    xml = replace_header_xml_value(xml, "N° do Documento:", "OOSEMB.RT.023.2026", normalize_text(document_code))
                    xml = replace_header_xml_value(xml, "Emissão Inicial:", "26", day)
                    xml = replace_header_xml_value(xml, "Emissão Inicial:", "01", month)
                    xml = replace_header_xml_value(xml, "Emissão Inicial:", "2026", year)
                    xml = replace_header_xml_value(xml, "Rev.:", "00", normalize_text(revision) or "00")
                    data = xml.encode("utf-8")
            target_zip.writestr(info, data)

    os.replace(temp_path, docx_path)


def add_heading_paragraph(document, text, ilvl=0):
    p = document.add_paragraph(text, style='Ttulo1')
    pPr = p._p.get_or_add_pPr()
    numPr = OxmlElement('w:numPr')
    ilvl_el = OxmlElement('w:ilvl')
    ilvl_el.set(qn('w:val'), str(ilvl))
    numId_el = OxmlElement('w:numId')
    numId_el.set(qn('w:val'), HEADING_NUM_ID)
    numPr.append(ilvl_el)
    numPr.append(numId_el)
    pPr.append(numPr)
    return p


def update_cover_page_body(document, lt_name, titulo_programa):
    for paragraph in document.paragraphs:
        if not paragraph.style or paragraph.style.name != 'Normal':
            continue
        text = "".join(r.text for r in paragraph.runs).strip()
        if text.startswith("LT ") and lt_name:
            replace_paragraph_text(paragraph, normalize_lt_name(lt_name))
        elif titulo_programa and (
            text.startswith("Programa") or "monitoramento" in text.lower() or text.startswith("Inspe")
        ):
            replace_paragraph_text(paragraph, titulo_programa)


def add_cover(document, title, subtitle_lines):
    heading = document.add_heading(title or "Relatorio", level=0)
    heading.alignment = WD_ALIGN_PARAGRAPH.CENTER

    for line in subtitle_lines:
        text = normalize_text(line)
        if not text:
            continue
        paragraph = document.add_paragraph(text)
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER

    document.add_paragraph("")


def add_key_value_table(document, title, rows):
    if not rows:
        return

    add_heading_paragraph(document, title)
    table = document.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for label, value in rows:
        if not normalize_text(value):
            continue
        cells = table.add_row().cells
        cells[0].text = normalize_text(label)
        cells[1].text = normalize_text(value)


def add_record_table(document, title, records, columns):
    rows = safe_list(records)
    add_heading_paragraph(document, title)
    if not rows:
        document.add_paragraph("Nenhum registro encontrado para esta secao.")
        return

    table = document.add_table(rows=1, cols=len(columns))
    table.style = "Table Grid"
    for index, column in enumerate(columns):
        table.rows[0].cells[index].text = column["label"]

    for record in rows:
        values = []
        for column in columns:
            value = column["getter"](record)
            values.append(normalize_text(value))

        if not any(values):
            continue

        table_row = table.add_row().cells
        for index, value in enumerate(values):
            table_row[index].text = value


def add_workspace_summary(document, workspaces):
    rows = safe_list(workspaces)
    add_heading_paragraph(document, "Workspaces")
    if not rows:
        document.add_paragraph("Nenhum workspace encontrado para esta secao.")
        return

    table = document.add_table(rows=1, cols=4)
    table.style = "Table Grid"
    headers = ["ID", "Nome", "Status", "Importado em"]
    for index, header in enumerate(headers):
        table.rows[0].cells[index].text = header

    for workspace in rows:
        row = table.add_row().cells
        row[0].text = normalize_text(workspace.get("id"))
        row[1].text = normalize_text(workspace.get("nome"))
        row[2].text = normalize_text(workspace.get("status"))
        row[3].text = format_timestamp(workspace.get("importedAt"))


def add_photo_entry(document, photo, image_loader, photo_index):
    caption = normalize_text(photo.get("caption"))
    label = f"Foto {photo_index} - {caption}" if caption else f"Foto {photo_index}"
    document.add_paragraph(label, style='Legenda')

    media_asset_id = normalize_text(photo.get("mediaAssetId"))
    if not media_asset_id:
        document.add_paragraph("[Imagem indisponivel]")
        return

    try:
        media = image_loader(media_asset_id)
        buffer = media.get("buffer") if isinstance(media, dict) else None
        if not buffer:
            raise ValueError("conteudo vazio")
        document.add_picture(io.BytesIO(buffer), width=Cm(MAX_IMAGE_WIDTH_CM))
        document.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
    except Exception as exc:  # pragma: no cover - defensive fallback
        document.add_paragraph(f"[Imagem indisponivel: {exc}]")


def add_photos_section(document, photos, image_loader, section_title="ILUSTRACAO FOTOGRAFICA"):
    rows = [photo for photo in safe_list(photos) if photo.get("includeInReport") is True]

    add_heading_paragraph(document, section_title, ilvl=0)

    if not rows:
        document.add_paragraph("Nenhuma foto marcada para inclusao no relatorio.", style='NormalWeb')
        return

    grouped = []
    lookup = {}
    for photo in rows:
        tower_id = normalize_text(photo.get("towerId"))
        if tower_id:
            group_key = f"Regiao da Torre {tower_id}"
        else:
            group_key = "Fotos sem agrupamento"
        if group_key not in lookup:
            lookup[group_key] = []
            grouped.append((group_key, lookup[group_key]))
        lookup[group_key].append(photo)

    photo_index = 1
    for group_label, items in grouped:
        add_heading_paragraph(document, group_label, ilvl=1)
        for photo in items:
            add_photo_entry(document, photo, image_loader, photo_index)
            photo_index += 1


def build_project_summary_rows(project, defaults):
    project = project if isinstance(project, dict) else {}
    defaults = defaults if isinstance(defaults, dict) else {}
    return [
        ("Empreendimento", normalize_text(project.get("nome")) or normalize_text(project.get("id"))),
        ("Codigo", normalize_text(project.get("id"))),
        ("Buffer faixa (m)", str(defaults.get("faixaBufferMetersSide") or 200)),
        ("Raio sugestao torre (m)", str(defaults.get("towerSuggestionRadiusMeters") or 300)),
    ]


def first_nonempty(*values):
    for value in values:
        text = normalize_text(value)
        if text:
            return text
    return ""


def resolve_template_metadata(defaults=None, source=None):
    defaults_texts = ensure_dict(ensure_dict(defaults).get("textosBase"))
    payload = ensure_dict(source)
    return {
        "document_code": first_nonempty(
            payload.get("codigo_documento"),
            payload.get("codigoRt"),
            payload.get("codigo_rt"),
            payload.get("numeroDocumento"),
            defaults_texts.get("codigoRt"),
            defaults_texts.get("codigo_rt"),
            defaults_texts.get("numeroDocumento"),
        ),
        "revision": first_nonempty(
            payload.get("revisao"),
            payload.get("rev"),
            defaults_texts.get("revisao"),
            defaults_texts.get("rev"),
            "00",
        ),
    }


def add_numbered_text_section(document, title, text):
    add_heading_paragraph(document, title, ilvl=0)
    for paragraph_text in text.split("\n\n"):
        stripped = normalize_text(paragraph_text)
        if stripped:
            document.add_paragraph(stripped, style='NormalWeb')


def format_registro(person):
    conselho = person.get("registro_conselho", "")
    estado = person.get("registro_estado", "")
    numero = person.get("registro_numero", "")
    sufixo = person.get("registro_sufixo", "")
    parts = []
    if conselho and estado:
        parts.append(f"{conselho}-{estado}")
    elif conselho:
        parts.append(conselho)
    if numero:
        parts.append(f"{numero}/{sufixo}" if sufixo else numero)
    return " ".join(parts)


def add_signature_block(document, elaboradores, revisores):
    def _render_group(label, people):
        if not people:
            return
        document.add_paragraph(label)
        for person in people:
            nome = normalize_text(person.get("nome", "")) if isinstance(person, dict) else normalize_text(person)
            profissao = normalize_text(person.get("profissao", "")) if isinstance(person, dict) else ""
            registro = normalize_text(person.get("registro", "")) if isinstance(person, dict) else ""
            document.add_paragraph("")
            document.add_paragraph(nome)
            if profissao or registro:
                meta = " \u2013 ".join(filter(None, [profissao, registro]))
                document.add_paragraph(meta)
            document.add_paragraph(SIGNATURE_LINE)

    _render_group("Elaborado por:", safe_list(elaboradores))
    if elaboradores and revisores:
        document.add_paragraph("")
    _render_group("Revisado por:", safe_list(revisores))


def render_project_dossier_docx(context, output_path, image_loader):
    render_model = ensure_dict(context.get("renderModel"))
    dossier = ensure_dict(render_model.get("dossier"))
    sections = ensure_dict(render_model.get("sections"))
    project = ensure_dict(context.get("project"))
    defaults = ensure_dict(context.get("defaults"))
    job = ensure_dict(context.get("job"))
    metadata = resolve_template_metadata(defaults=defaults, source=dossier)

    document, used_template = create_document_from_template(
        normalize_text(project.get("nome")) or normalize_text(project.get("id")) or normalize_text(dossier.get("nome")),
        metadata["document_code"],
        job.get("updatedAt") or job.get("createdAt"),
        metadata["revision"],
    )
    if not used_template:
        add_cover(
            document,
            normalize_text(dossier.get("nome")) or f"Dossie {normalize_text(project.get('id'))}",
            [
                normalize_text(project.get("nome")) or normalize_text(project.get("id")),
                f"Gerado em {format_timestamp()}",
            ],
        )

    add_key_value_table(document, "Resumo do Empreendimento", build_project_summary_rows(project, defaults))

    observacoes = normalize_text(dossier.get("observacoes"))
    if observacoes:
        add_numbered_text_section(document, "OBSERVACOES", observacoes)

    scope = ensure_dict(dossier.get("scopeJson"))

    if scope.get("includeLicencas", True):
        add_record_table(
            document,
            "Licencas",
            sections.get("licencas"),
            [
                {"label": "ID", "getter": lambda item: item.get("id")},
                {"label": "Orgao", "getter": lambda item: item.get("orgao") or item.get("agencia")},
                {"label": "Numero", "getter": lambda item: item.get("numero") or item.get("numeroLicenca")},
                {"label": "Status", "getter": lambda item: item.get("status")},
            ],
        )

    if scope.get("includeInspecoes", True):
        add_record_table(
            document,
            "Inspecoes",
            sections.get("inspecoes"),
            [
                {"label": "ID", "getter": lambda item: item.get("id")},
                {"label": "Inicio", "getter": lambda item: item.get("dataInicio")},
                {"label": "Fim", "getter": lambda item: item.get("dataFim")},
                {"label": "Status", "getter": lambda item: item.get("status")},
            ],
        )

    if scope.get("includeErosoes", True):
        add_record_table(
            document,
            "Erosoes",
            sections.get("erosoes"),
            [
                {"label": "ID", "getter": lambda item: item.get("id")},
                {"label": "Status", "getter": lambda item: item.get("status")},
                {"label": "Criticidade", "getter": lambda item: item.get("criticalityCode")},
                {"label": "Score", "getter": lambda item: item.get("criticalityScore")},
            ],
        )

    if scope.get("includeEntregas", True):
        add_record_table(
            document,
            "Entregas",
            sections.get("entregas"),
            [
                {"label": "ID", "getter": lambda item: item.get("id")},
                {"label": "Competencia", "getter": lambda item: item.get("monthKey")},
                {"label": "Status", "getter": lambda item: item.get("operationalStatus")},
                {"label": "Atualizado em", "getter": lambda item: item.get("updatedAt")},
            ],
        )

    if scope.get("includeWorkspaces", True):
        add_workspace_summary(document, sections.get("workspaces"))

    if scope.get("includeFotos", True):
        add_photos_section(document, sections.get("photos"), image_loader)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    document.save(output_path)
    if used_template:
        rewrite_template_header_metadata(
            output_path,
            normalize_text(project.get("nome")) or normalize_text(project.get("id")) or normalize_text(dossier.get("nome")),
            metadata["document_code"],
            job.get("updatedAt") or job.get("createdAt"),
            metadata["revision"],
        )
    return output_path


def render_report_compound_docx(context, output_path, image_loader):
    render_model = ensure_dict(context.get("renderModel"))
    compound = ensure_dict(render_model.get("compound"))
    workspaces = safe_list(render_model.get("workspaces"))
    job = ensure_dict(context.get("job"))
    shared = ensure_dict(compound.get("sharedTextsJson"))
    metadata = resolve_template_metadata(source=shared)

    lt_name = normalize_text(shared.get("nome_lt")) or normalize_text(compound.get("nome")) or "Relatorio composto"
    doc_code = metadata["document_code"]
    revision = metadata["revision"]

    document, used_template = create_document_from_template(
        lt_name,
        doc_code,
        job.get("updatedAt") or job.get("createdAt"),
        revision,
    )
    titulo_programa = normalize_text(shared.get("titulo_programa"))

    if used_template:
        update_cover_page_body(document, lt_name, titulo_programa)
    else:
        subtitle_lines = []
        if titulo_programa:
            subtitle_lines.append(titulo_programa)
        if doc_code:
            subtitle_lines.append(doc_code)
        subtitle_lines.append(f"Gerado em {format_timestamp()}")
        add_cover(document, lt_name, subtitle_lines)

    pre_photo_sections = [
        ("INTRODUCAO", "introducao"),
        ("CARACTERIZACAO TECNICA", "caracterizacao_tecnica"),
        ("DESCRICAO DAS ATIVIDADES", "descricao_atividades"),
    ]
    for title, key in pre_photo_sections:
        text = normalize_text(shared.get(key))
        if text:
            add_numbered_text_section(document, title, text)

    all_photos = []
    for bundle in workspaces:
        photos = safe_list(bundle.get("photos") if isinstance(bundle, dict) else [])
        all_photos.extend(photos)

    add_photos_section(document, all_photos, image_loader)

    post_photo_sections = [
        ("CONCLUSOES E RECOMENDACOES", "conclusoes"),
        ("ANALISE DA EVOLUCAO DOS PROCESSOS EROSIVOS", "analise_evolucao"),
        ("CONSIDERACOES FINAIS", "observacoes"),
    ]
    for title, key in post_photo_sections:
        text = normalize_text(shared.get(key))
        if text:
            add_numbered_text_section(document, title, text)

    elaboradores = safe_list(shared.get("elaboradores"))
    revisores = safe_list(shared.get("revisores"))
    if elaboradores or revisores:
        add_signature_block(document, elaboradores, revisores)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    document.save(output_path)
    if used_template:
        rewrite_template_header_metadata(
            output_path,
            lt_name,
            doc_code,
            job.get("updatedAt") or job.get("createdAt"),
            revision,
        )
    return output_path


def render_context_to_docx(context, output_path, image_loader):
    job = context.get("job") if isinstance(context, dict) else {}
    kind = normalize_text(job.get("kind"))
    if kind == "project_dossier":
        return render_project_dossier_docx(context, output_path, image_loader)
    if kind == "report_compound":
        return render_report_compound_docx(context, output_path, image_loader)
    raise ValueError(f"Tipo de job sem renderizador DOCX: {kind or 'desconhecido'}")
