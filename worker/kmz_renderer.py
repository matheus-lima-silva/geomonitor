import html
import math
import os
import re
import zipfile

from worker.exif_gps import extract_gps_latlon


# Estilo do marcador de foto (icone de camera publico do Google), distinto das
# torres (pin padrao). Referenciado por <styleUrl>#photo-marker</styleUrl>.
PHOTO_MARKER_STYLE = "\n".join([
    '    <Style id="photo-marker">',
    "      <IconStyle>",
    "        <color>ff00aaff</color>",
    "        <scale>1.1</scale>",
    "        <Icon>",
    "          <href>https://maps.google.com/mapfiles/kml/shapes/camera.png</href>",
    "        </Icon>",
    "      </IconStyle>",
    "    </Style>",
])


def kmz_exif_gps_enabled():
    return os.environ.get("WORKER_KMZ_EXIF_GPS", "1").strip().lower() not in ("0", "false", "no", "off")


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


def resolve_image_extension(photo):
    # Deriva a extensao na fase de metadados (antes do download) a partir do
    # fileName; sem isso, default para .jpg (extensao de imagem valida que o
    # leitor de KMZ reconhece no re-import).
    name = normalize_text(photo.get("fileName"))
    if "." in name:
        candidate = "." + name.rsplit(".", 1)[1].lower()
        if re.match(r"^\.[a-z0-9]{1,5}$", candidate):
            return candidate
    return ".jpg"


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


def is_valid_latlon(latitude, longitude):
    # Rejeita o sentinela "null island" (0,0) e coordenadas fora de faixa/nao-finitas.
    # As fotos de campo vinham com gpsLat/gpsLon=0 (placeholder), o que jogava todos
    # os marcadores em lat0/lon0 no meio do Atlantico.
    if latitude is None or longitude is None:
        return False
    if not (math.isfinite(latitude) and math.isfinite(longitude)):
        return False
    if abs(latitude) > 90 or abs(longitude) > 180:
        return False
    if latitude == 0.0 and longitude == 0.0:
        return False
    return True


def resolve_photo_coordinates(photo, tower_lookup):
    latitude = to_number(photo.get("gpsLat"))
    longitude = to_number(photo.get("gpsLon"))
    if is_valid_latlon(latitude, longitude):
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
    photo_id = normalize_text(photo_entry.get("photoId")) or normalize_text(photo.get("id"))
    media_asset_id = normalize_text(photo_entry.get("mediaAssetId")) or normalize_text(photo.get("mediaAssetId"))
    lines = [
        "      <Placemark>",
        f"        <name>{escape_xml(name)}</name>",
        f"        <description><![CDATA[{description}]]></description>",
        # ExtendedData carrega a identidade estavel da foto. Sobrevive ao round-trip
        # no Google Earth Pro, permitindo que o re-import case a foto existente e
        # atribua a torre da pasta sem novo upload.
        "        <ExtendedData>",
        f'          <Data name="photoId"><value>{escape_xml(photo_id)}</value></Data>',
        f'          <Data name="mediaAssetId"><value>{escape_xml(media_asset_id)}</value></Data>',
        "        </ExtendedData>",
    ]

    latitude = photo_entry.get("latitude")
    longitude = photo_entry.get("longitude")
    altitude = photo_entry.get("altitude")
    if latitude is not None and longitude is not None:
        lines.extend([
            "        <styleUrl>#photo-marker</styleUrl>",
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
        # Estilo deve preceder os placemarks que o referenciam.
        PHOTO_MARKER_STYLE,
        header_description,
        infra_folder,
        photos_folder,
        "  </Document>",
        "</kml>",
    ])


def _emit_progress(progress_callback, processed, total):
    if not progress_callback:
        return
    try:
        progress_callback(processed, total)
    except Exception:  # pragma: no cover - progresso e best-effort
        pass


def render_context_to_kmz(context, output_path, download_media, progress_callback=None):
    render_model = context.get("renderModel") if isinstance(context, dict) else {}
    project = context.get("project") if isinstance(context, dict) else {}
    workspace = render_model.get("workspace") if isinstance(render_model, dict) else {}
    photos = render_model.get("photos") if isinstance(render_model, dict) else []
    tower_lookup = build_tower_lookup(project)

    if not isinstance(workspace, dict) or not workspace:
        raise RuntimeError("Contexto invalido para gerar KMZ do workspace.")

    photos = photos or []
    photo_entries = []
    warnings = []
    photos_without_media = 0

    # Fase 1 — metadados sem bytes. Resolve nome de arquivo estavel por photoId
    # (fecha o round-trip de organizacao) e coordenadas, sem segurar buffers.
    for index, photo in enumerate(photos, start=1):
        media_asset_id = normalize_text(photo.get("mediaAssetId"))
        if not media_asset_id:
            photos_without_media += 1
            warnings.append(f"Foto {normalize_text(photo.get('id')) or index} sem media associada.")
            continue

        photo_id = normalize_text(photo.get("id")) or f"foto-{index}"
        extension = resolve_image_extension(photo)
        file_name = f"{safe_file_name(photo_id, fallback=f'foto-{index}')}{extension}"

        latitude, longitude, altitude, coordinate_source = resolve_photo_coordinates(photo, tower_lookup)
        # O aviso de "sem coordenadas" so e decidido apos a tentativa de EXIF
        # (Fase 2), senao uma foto que ganha posicao via EXIF receberia aviso falso.

        photo_entries.append({
            "photo": photo,
            "photoId": photo_id,
            "mediaAssetId": media_asset_id,
            "imagePath": f"files/{file_name}",
            "fileName": file_name,
            "latitude": latitude,
            "longitude": longitude,
            "altitude": altitude,
            "coordinateSource": coordinate_source,
        })

    if not photo_entries:
        raise RuntimeError("Nenhuma foto com media associada para gerar o KMZ.")

    # Fase 2 — stream: baixa cada imagem, grava no zip e descarta o buffer, mantendo
    # o pico de memoria em O(1 imagem) mesmo com centenas de fotos full-res.
    images_written = 0
    download_failures = 0
    failed_photo_ids = set()
    total_photos = len(photo_entries)
    # Reporta progresso ~a cada 5% (limita ~20 pings HTTP mesmo com 500+ fotos).
    progress_step = max(1, total_photos // 20)
    _emit_progress(progress_callback, 0, total_photos)

    with zipfile.ZipFile(output_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for index, photo_entry in enumerate(photo_entries, start=1):
            try:
                response = download_media(photo_entry["mediaAssetId"]) or {}
                buffer = response.get("buffer")
                if not buffer:
                    raise RuntimeError("conteudo vazio")
                archive.writestr(photo_entry["imagePath"], buffer)
                images_written += 1
                # Foto sem coordenada localizada (gps invalido + sem torre)? Recupera
                # do EXIF do proprio JPEG que acabamos de baixar, para virar marcador
                # no lugar real. O KML so e montado depois deste loop, entao a
                # coordenada descoberta aqui ja entra no placemark. Precedencia:
                # gps valido > torre > exif. extract_gps_latlon nunca levanta.
                if kmz_exif_gps_enabled() and not photo_entry.get("coordinateSource"):
                    gps = extract_gps_latlon(buffer)
                    if gps:
                        photo_entry["latitude"] = gps[0]
                        photo_entry["longitude"] = gps[1]
                        photo_entry["altitude"] = 0.0
                        photo_entry["coordinateSource"] = "exif"
            except Exception as exc:
                download_failures += 1
                failed_photo_ids.add(photo_entry["photoId"])
                warnings.append(f"Foto {photo_entry['photoId']} nao foi incorporada: {exc}")

            # processed = fotos tentadas (avanca mesmo em falha), para a barra nao travar.
            if index % progress_step == 0 or index == total_photos:
                _emit_progress(progress_callback, index, total_photos)

        # Agora que o EXIF ja foi tentado, registra as fotos que seguem sem posicao
        # (exceto as que ja falharam no download — essas ja tem aviso proprio).
        for photo_entry in photo_entries:
            if not photo_entry.get("coordinateSource") and photo_entry["photoId"] not in failed_photo_ids:
                warnings.append(f"Foto {photo_entry['photoId']} ficou sem coordenadas de mapa.")

        # KML montado depois do stream para incluir todos os avisos (inclusive de
        # download) na descricao do documento. Ordem das entradas no zip e
        # irrelevante para leitores de KMZ.
        kml_document = build_kml_document(project, workspace, photo_entries, warnings)
        archive.writestr("doc.kml", kml_document.encode("utf-8"))

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

    if images_written == 0:
        # Havia fotos com media, mas todas falharam no download apos as retentativas.
        # Mensagem distinta de "workspace sem fotos com media" para diagnostico claro.
        raise RuntimeError(
            "Todas as fotos falharam no download apos novas tentativas; KMZ nao gerado."
        )
