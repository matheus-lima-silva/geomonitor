import html
import re
import zipfile


def normalize_text(value):
    return str(value or "").strip()


def to_number(value):
    text = normalize_text(value).replace(",", ".")
    if not text:
        return None
    try:
        number = float(text)
    except ValueError:
        return None
    return number


def safe_file_name(file_name, fallback="arquivo.bin"):
    normalized = re.sub(r"[^\w.\-]+", "_", normalize_text(file_name))
    return normalized or fallback


def extension_from_content_type(content_type):
    mapping = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/gif": ".gif",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
        "image/tiff": ".tif",
    }
    return mapping.get(normalize_text(content_type).lower(), ".bin")


def normalize_tower_id(value):
    text = normalize_text(value).upper()
    if not text:
        return ""

    text = re.sub(r"^(TORRE|TOR|T)\s*[-_: ]?", "", text)
    compact = re.sub(r"[\s_-]+", "", text)
    match = re.match(r"^0*(\d+)([A-Z]*)$", compact)
    if not match:
        return compact
    return f"{int(match.group(1))}{match.group(2)}"


def escape_xml(value):
    return html.escape(str(value or ""), quote=True)


def sanitize_cdata(value):
    return str(value or "").replace("]]>", "]]]]><![CDATA[>")


def sort_tower_key(value):
    normalized = normalize_tower_id(value)
    match = re.match(r"^(\d+)([A-Z]*)$", normalized)
    if match:
        return (int(match.group(1)), match.group(2))
    return (10**9, normalized)


def build_tower_lookup(project):
    lookup = {}
    for tower in project.get("torresCoordenadas") or []:
        tower_id = normalize_tower_id(tower.get("numero") or tower.get("towerId") or tower.get("id"))
        latitude = to_number(tower.get("latitude"))
        longitude = to_number(tower.get("longitude"))
        altitude = to_number(tower.get("altitude")) or 0.0
        if not tower_id or latitude is None or longitude is None:
            continue
        lookup[tower_id] = {
            "towerId": tower_id,
            "latitude": latitude,
            "longitude": longitude,
            "altitude": altitude,
            "raw": tower,
        }
    return lookup


def build_line_coordinates(project):
    points = []
    for point in project.get("linhaCoordenadas") or []:
        latitude = to_number(point.get("latitude"))
        longitude = to_number(point.get("longitude"))
        altitude = to_number(point.get("altitude")) or 0.0
        if latitude is None or longitude is None:
            continue
        points.append((latitude, longitude, altitude))
    return points


def resolve_photo_coordinates(photo, tower_lookup):
    latitude = to_number(photo.get("gpsLat"))
    longitude = to_number(photo.get("gpsLon"))
    if latitude is not None and longitude is not None:
        return latitude, longitude, 0.0, "gps"

    tower_id = normalize_tower_id(photo.get("towerId"))
    tower = tower_lookup.get(tower_id)
    if tower:
        return tower["latitude"], tower["longitude"], tower["altitude"], "tower"

    return None, None, None, ""


def build_photo_description(photo, image_path, coordinate_source):
    include_in_report = "Sim" if photo.get("includeInReport") else "Nao"
    capture_at = normalize_text(photo.get("captureAt")) or "-"
    coordinate_label = coordinate_source or "sem coordenadas"
    parts = [
        "<div>",
        f"<p><strong>ID:</strong> {escape_xml(photo.get('id') or '-')}</p>",
        f"<p><strong>Legenda:</strong> {escape_xml(photo.get('caption') or '-')}</p>",
        f"<p><strong>Torre:</strong> {escape_xml(photo.get('towerId') or '-')}</p>",
        f"<p><strong>Origem da coordenada:</strong> {escape_xml(coordinate_label)}</p>",
        f"<p><strong>Incluida no relatorio:</strong> {include_in_report}</p>",
        f"<p><strong>Captura:</strong> {escape_xml(capture_at)}</p>",
    ]
    if image_path:
        parts.append(f'<p><img src="{escape_xml(image_path)}" style="max-width:640px;" /></p>')
    parts.append("</div>")
    return "".join(parts)


def build_line_placemark(project):
    coordinates = build_line_coordinates(project)
    if len(coordinates) < 2:
        return ""

    line_name = normalize_text(project.get("linhaFonteKml")) or normalize_text(project.get("nome")) or "Linha"
    tuples = " ".join(
        f"{longitude},{latitude},{altitude}"
        for latitude, longitude, altitude in coordinates
    )

    return "\n".join([
        "    <Placemark>",
        f"      <name>{escape_xml(line_name)}</name>",
        "      <LineString>",
        "        <coordinates>",
        f"          {tuples}",
        "        </coordinates>",
        "      </LineString>",
        "    </Placemark>",
    ])


def build_tower_placemark(tower):
    tower_name = f"Torre {tower['towerId']}"
    return "\n".join([
        "    <Placemark>",
        f"      <name>{escape_xml(tower_name)}</name>",
        "      <Point>",
        f"        <coordinates>{tower['longitude']},{tower['latitude']},{tower['altitude']}</coordinates>",
        "      </Point>",
        "    </Placemark>",
    ])


def build_photo_placemark(photo_entry):
    photo = photo_entry["photo"]
    name = normalize_text(photo.get("caption")) or normalize_text(photo.get("id")) or "Foto"
    description = sanitize_cdata(
        build_photo_description(photo, photo_entry["imagePath"], photo_entry["coordinateSource"])
    )
    lines = [
        "      <Placemark>",
        f"        <name>{escape_xml(name)}</name>",
        f"        <description><![CDATA[{description}]]></description>",
    ]

    latitude = photo_entry.get("latitude")
    longitude = photo_entry.get("longitude")
    altitude = photo_entry.get("altitude")
    if latitude is not None and longitude is not None:
        lines.extend([
            "        <Point>",
            f"          <coordinates>{longitude},{latitude},{altitude or 0.0}</coordinates>",
            "        </Point>",
        ])

    lines.append("      </Placemark>")
    return "\n".join(lines)


def build_kml_document(project, workspace, photo_entries, warnings):
    project_name = normalize_text(project.get("nome")) or normalize_text(project.get("id")) or "Empreendimento"
    workspace_name = normalize_text(workspace.get("nome")) or normalize_text(workspace.get("id")) or "Workspace"
    tower_lookup = build_tower_lookup(project)
    line_placemark = build_line_placemark(project)
    tower_placemarks = [
        build_tower_placemark(tower_lookup[tower_id])
        for tower_id in sorted(tower_lookup, key=sort_tower_key)
    ]

    grouped_photos = {}
    for photo_entry in photo_entries:
        tower_id = normalize_tower_id(photo_entry["photo"].get("towerId")) or "Sem Torre"
        grouped_photos.setdefault(tower_id, []).append(photo_entry)

    photo_folders = []
    for tower_id in sorted(grouped_photos, key=sort_tower_key):
        placemarks = "\n".join(build_photo_placemark(photo_entry) for photo_entry in grouped_photos[tower_id])
        photo_folders.append("\n".join([
            "    <Folder>",
            f"      <name>{escape_xml(f'Torre {tower_id}' if tower_id != 'Sem Torre' else tower_id)}</name>",
            placemarks,
            "    </Folder>",
        ]))

    warning_paragraph = ""
    if warnings:
        warning_html = "".join(f"<li>{escape_xml(item)}</li>" for item in warnings)
        warning_paragraph = (
            "<description><![CDATA["
            f"<p>Ocorreram observacoes durante a geracao:</p><ul>{warning_html}</ul>"
            "]]></description>"
        )

    infra_folder = ""
    if line_placemark or tower_placemarks:
        infra_folder = "\n".join([
            "  <Folder>",
            "    <name>Infraestrutura do Empreendimento</name>",
            line_placemark,
            "\n".join(tower_placemarks),
            "  </Folder>",
        ])

    photos_folder = "\n".join([
        "  <Folder>",
        "    <name>Fotos do Workspace</name>",
        *photo_folders,
        "  </Folder>",
    ])

    header_description = warning_paragraph or ""
    return "\n".join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        "  <Document>",
        f"    <name>{escape_xml(f'{project_name} - {workspace_name}')}</name>",
        header_description,
        infra_folder,
        photos_folder,
        "  </Document>",
        "</kml>",
    ])


def render_context_to_kmz(context, output_path, download_media):
    render_model = context.get("renderModel") if isinstance(context, dict) else {}
    project = context.get("project") if isinstance(context, dict) else {}
    workspace = render_model.get("workspace") if isinstance(render_model, dict) else {}
    photos = render_model.get("photos") if isinstance(render_model, dict) else []
    tower_lookup = build_tower_lookup(project)

    if not isinstance(workspace, dict) or not workspace:
        raise RuntimeError("Contexto invalido para gerar KMZ do workspace.")

    photo_entries = []
    warnings = []
    used_names = set()

    for index, photo in enumerate(photos or [], start=1):
        media_asset_id = normalize_text(photo.get("mediaAssetId"))
        if not media_asset_id:
            warnings.append(f"Foto {normalize_text(photo.get('id')) or index} sem media associada.")
            continue

        try:
            response = download_media(media_asset_id) or {}
            buffer = response.get("buffer")
            if not buffer:
                raise RuntimeError("conteudo vazio")
        except Exception as exc:
            warnings.append(
                f"Foto {normalize_text(photo.get('id')) or index} nao foi incorporada: {exc}"
            )
            continue

        base_name = safe_file_name(
            photo.get("fileName")
            or photo.get("caption")
            or f"foto-{index}.jpg",
            fallback=f"foto-{index}.bin",
        )
        if "." not in base_name:
            base_name = f"{base_name}{extension_from_content_type(response.get('contentType'))}"
        file_name = base_name
        suffix = 1
        while file_name in used_names:
            stem, dot, extension = base_name.rpartition(".")
            if dot:
                file_name = f"{stem}-{suffix}.{extension}"
            else:
                file_name = f"{base_name}-{suffix}"
            suffix += 1
        used_names.add(file_name)

        latitude, longitude, altitude, coordinate_source = resolve_photo_coordinates(photo, tower_lookup)
        if latitude is None or longitude is None:
            warnings.append(
                f"Foto {normalize_text(photo.get('id')) or index} ficou sem coordenadas de mapa."
            )

        photo_entries.append({
            "photo": photo,
            "buffer": buffer,
            "imagePath": f"files/{file_name}",
            "fileName": file_name,
            "latitude": latitude,
            "longitude": longitude,
            "altitude": altitude,
            "coordinateSource": coordinate_source,
        })

    if not photo_entries:
        raise RuntimeError("Nenhuma foto com media disponivel para gerar o KMZ.")

    kml_document = build_kml_document(project, workspace, photo_entries, warnings)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("doc.kml", kml_document.encode("utf-8"))
        for photo_entry in photo_entries:
            archive.writestr(photo_entry["imagePath"], photo_entry["buffer"])
        if warnings:
            archive.writestr(
                "README.txt",
                "\n".join([
                    f"Projeto: {normalize_text(project.get('id')) or '-'}",
                    f"Workspace: {normalize_text(workspace.get('id')) or '-'}",
                    "",
                    "Observacoes:",
                    *[f"- {warning}" for warning in warnings],
                ]).encode("utf-8"),
            )
