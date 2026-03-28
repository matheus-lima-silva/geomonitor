import io
import os
import re
import zipfile
from datetime import datetime, timezone

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches


MAX_IMAGE_WIDTH_INCHES = 5.8
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


def create_document_from_template(title, document_code="", emission_date="", revision="00"):
    if os.path.exists(TEMPLATE_PATH):
        document = Document(TEMPLATE_PATH)
        clear_template_body(document)
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

    document.add_heading(title, level=1)
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
    document.add_heading(title, level=1)
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
    document.add_heading("Workspaces", level=1)
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


def build_photo_group_label(photo, workspace_name=""):
    tower_id = normalize_text(photo.get("towerId"))
    if tower_id:
        return f"Regiao da Torre {tower_id}"

    normalized_workspace = normalize_text(workspace_name or photo.get("workspaceId"))
    if normalized_workspace:
        if normalized_workspace.lower().startswith("workspace ") or " - " in normalized_workspace:
            return normalized_workspace
        return f"Workspace {normalized_workspace}"

    return "Fotos sem agrupamento"


def build_photo_title(photo, photo_index):
    label = normalize_text(photo.get("caption")) or normalize_text(photo.get("id")) or "Registro sem legenda"
    return f"Foto {photo_index} - {label}"


def add_photo_entry(document, photo, image_loader, photo_index, workspace_name="", heading_level=3):
    title = build_photo_title(photo, photo_index)
    document.add_heading(title, level=heading_level)
    details = [
        f"Workspace: {normalize_text(workspace_name or photo.get('workspaceId')) or 'N/D'}",
        f"Torre: {normalize_text(photo.get('towerId')) or 'N/D'}",
        f"Origem: {normalize_text(photo.get('importSource')) or 'N/D'}",
        f"Captura: {format_timestamp(photo.get('captureAt') or photo.get('createdAt'))}",
    ]
    document.add_paragraph(" | ".join(details))

    media_asset_id = normalize_text(photo.get("mediaAssetId"))
    if not media_asset_id:
        document.add_paragraph("[Imagem indisponivel: mediaAssetId ausente]")
        return

    try:
        media = image_loader(media_asset_id)
        buffer = media.get("buffer") if isinstance(media, dict) else None
        if not buffer:
            raise ValueError("conteudo vazio")
        document.add_picture(io.BytesIO(buffer), width=Inches(MAX_IMAGE_WIDTH_INCHES))
    except Exception as exc:  # pragma: no cover - defensive fallback
        document.add_paragraph(f"[Imagem indisponivel: {exc}]")


def add_photos_section(
    document,
    photos,
    image_loader,
    workspace_name_getter=None,
    section_title="Ilustracao fotografica",
    section_level=1,
    group_level=2,
    photo_level=3,
):
    rows = [photo for photo in safe_list(photos) if photo.get("includeInReport") is True]
    if section_title:
        document.add_heading(section_title, level=section_level)
    if not rows:
        document.add_paragraph("Nenhuma foto marcada para inclusao no relatorio.")
        return

    grouped = []
    lookup = {}
    for photo in rows:
        workspace_name = ""
        if callable(workspace_name_getter):
            workspace_name = workspace_name_getter(photo)
        group_label = build_photo_group_label(photo, workspace_name=workspace_name)
        if group_label not in lookup:
            lookup[group_label] = []
            grouped.append((group_label, lookup[group_label]))
        lookup[group_label].append((photo, workspace_name))

    photo_index = 1
    for group_label, items in grouped:
        document.add_heading(group_label, level=group_level)
        for photo, workspace_name in items:
            add_photo_entry(
                document,
                photo,
                image_loader,
                photo_index,
                workspace_name=workspace_name,
                heading_level=photo_level,
            )
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
        document.add_heading("Observacoes", level=1)
        document.add_paragraph(observacoes)

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
    add_workspace_summary(document, sections.get("workspaces"))
    add_photos_section(
        document,
        sections.get("photos"),
        image_loader,
        section_title="Ilustracao fotografica",
        section_level=1,
        group_level=2,
        photo_level=3,
    )

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
    metadata = resolve_template_metadata(source=compound.get("sharedTextsJson"))

    document, used_template = create_document_from_template(
        normalize_text(compound.get("nome")) or "Relatorio composto",
        metadata["document_code"],
        job.get("updatedAt") or job.get("createdAt"),
        metadata["revision"],
    )
    if not used_template:
        add_cover(
            document,
            normalize_text(compound.get("nome")) or "Relatorio composto",
            [f"Gerado em {format_timestamp()}"],
        )

    introducao = normalize_text((compound.get("sharedTextsJson") or {}).get("introducao"))
    if introducao:
        document.add_heading("Introducao", level=1)
        document.add_paragraph(introducao)

    if not workspaces:
        document.add_heading("Workspaces", level=1)
        document.add_paragraph("Nenhum workspace encontrado para o relatorio composto.")

    for index, bundle in enumerate(workspaces):
        workspace = bundle.get("workspace") if isinstance(bundle, dict) else {}
        project = bundle.get("project") if isinstance(bundle, dict) else {}
        photos = bundle.get("photos") if isinstance(bundle, dict) else []

        if index > 0:
            document.add_page_break()

        title = normalize_text(workspace.get("nome")) or normalize_text(workspace.get("id")) or "Workspace"
        document.add_heading(title, level=1)
        document.add_paragraph(
            " | ".join([
                f"Workspace: {normalize_text(workspace.get('id')) or 'N/D'}",
                f"Empreendimento: {normalize_text(project.get('nome')) or normalize_text(project.get('id')) or 'N/D'}",
                f"Status: {normalize_text(workspace.get('status')) or 'N/D'}",
            ]),
        )

        texts = workspace.get("texts") if isinstance(workspace.get("texts"), dict) else {}
        for label, key in [("Introducao do workspace", "introducao"), ("Observacoes", "observacoes")]:
            value = normalize_text(texts.get(key))
            if value:
                document.add_heading(label, level=2)
                document.add_paragraph(value)

        add_photos_section(
            document,
            photos,
            image_loader,
            workspace_name_getter=lambda _photo, current=title, current_project=project: (
                f"{normalize_text(current_project.get('nome')) or normalize_text(current_project.get('id')) or 'Empreendimento'} - {current}"
            ),
            section_title="",
            group_level=2,
            photo_level=3,
        )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    document.save(output_path)
    if used_template:
        rewrite_template_header_metadata(
            output_path,
            normalize_text(compound.get("nome")) or "Relatorio composto",
            metadata["document_code"],
            job.get("updatedAt") or job.get("createdAt"),
            metadata["revision"],
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
