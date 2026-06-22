"""Extracao de coordenadas GPS do EXIF de um JPEG usando apenas a stdlib.

Sem dependencias (Pillow/piexif): parseia o segmento APP1/Exif -> bloco TIFF ->
IFD0 -> GPS IFD na mao, com bounds-check em cada passo. Tudo best-effort: qualquer
dado ausente ou malformado retorna ``None`` (nunca levanta).

O worker ja baixa o JPEG full-res para embutir no KMZ; aqui recuperamos a posicao
real onde a foto foi tirada para virar um marcador no mapa.
"""

import math
import struct


# Tamanho em bytes de cada tipo de campo EXIF/TIFF.
_TYPE_SIZES = {
    1: 1,   # BYTE
    2: 1,   # ASCII
    3: 2,   # SHORT
    4: 4,   # LONG
    5: 8,   # RATIONAL (2x uint32: num/den)
    7: 1,   # UNDEFINED
    9: 4,   # SLONG
    10: 8,  # SRATIONAL
}

# Tags do GPS IFD.
_GPS_LAT_REF = 0x0001
_GPS_LAT = 0x0002
_GPS_LON_REF = 0x0003
_GPS_LON = 0x0004
# Ponteiro para o GPS IFD dentro do IFD0.
_GPS_IFD_POINTER = 0x8825


def _find_exif_tiff(data):
    """Localiza o bloco TIFF do segmento APP1/Exif e retorna seus bytes.

    Todos os offsets de IFD do EXIF sao relativos ao inicio desse bloco TIFF
    (logo apos ``Exif\\x00\\x00``). Retorna ``None`` se nao houver Exif.
    """
    n = len(data)
    if n < 4 or data[0] != 0xFF or data[1] != 0xD8:
        return None
    i = 2
    while i + 4 <= n:
        if data[i] != 0xFF:
            i += 1
            continue
        marker = data[i + 1]
        # Marcadores sem payload (SOI/EOI/RST/TEM): nao tem campo de tamanho.
        if marker in (0xD8, 0xD9, 0x01) or 0xD0 <= marker <= 0xD7:
            i += 2
            continue
        # Start of Scan: acabou a area de metadados.
        if marker == 0xDA:
            break
        seg_len = struct.unpack(">H", data[i + 2:i + 4])[0]
        if seg_len < 2:
            break
        seg_start = i + 4
        seg_end = i + 2 + seg_len
        if seg_end > n:
            break
        if marker == 0xE1 and data[seg_start:seg_start + 6] == b"Exif\x00\x00":
            return data[seg_start + 6:seg_end]
        i = seg_end
    return None


def _read_ifd(tiff, endian, offset):
    """Le um IFD em ``offset`` e retorna a lista de (tag, type, count, val_field)."""
    if offset < 0 or offset + 2 > len(tiff):
        return None
    count = struct.unpack(endian + "H", tiff[offset:offset + 2])[0]
    entries = []
    base = offset + 2
    for k in range(count):
        e = base + k * 12
        if e + 12 > len(tiff):
            break
        tag = struct.unpack(endian + "H", tiff[e:e + 2])[0]
        typ = struct.unpack(endian + "H", tiff[e + 2:e + 4])[0]
        cnt = struct.unpack(endian + "I", tiff[e + 4:e + 8])[0]
        val_field = tiff[e + 8:e + 12]
        entries.append((tag, typ, cnt, val_field))
    return entries


def _entry_data(tiff, endian, typ, cnt, val_field):
    """Resolve os bytes de um campo: inline (<=4 bytes) ou no offset apontado."""
    size = _TYPE_SIZES.get(typ, 0) * cnt
    if size <= 0:
        return None
    if size <= 4:
        return val_field[:size]
    off = struct.unpack(endian + "I", val_field)[0]
    if off < 0 or off + size > len(tiff):
        return None
    return tiff[off:off + size]


def _rationals_to_degrees(data, endian):
    """Converte 3 RATIONALs (graus, minutos, segundos) para graus decimais."""
    if data is None or len(data) < 24:
        return None
    parts = []
    for k in range(3):
        num = struct.unpack(endian + "I", data[k * 8:k * 8 + 4])[0]
        den = struct.unpack(endian + "I", data[k * 8 + 4:k * 8 + 8])[0]
        if den == 0:
            return None
        parts.append(num / den)
    return parts[0] + parts[1] / 60.0 + parts[2] / 3600.0


def extract_gps_latlon(jpeg_bytes):
    """Retorna ``(lat, lon)`` em graus decimais a partir do EXIF, ou ``None``.

    Best-effort: qualquer ausencia/erro -> ``None``. Aplica o sinal pelos refs
    (S/W negativos) e descarta coordenadas fora de faixa.
    """
    try:
        tiff = _find_exif_tiff(jpeg_bytes)
        if not tiff or len(tiff) < 8:
            return None

        if tiff[:2] == b"II":
            endian = "<"
        elif tiff[:2] == b"MM":
            endian = ">"
        else:
            return None

        ifd0_offset = struct.unpack(endian + "I", tiff[4:8])[0]
        ifd0 = _read_ifd(tiff, endian, ifd0_offset)
        if not ifd0:
            return None

        gps_pointer = None
        for tag, _typ, _cnt, val_field in ifd0:
            if tag == _GPS_IFD_POINTER:
                gps_pointer = struct.unpack(endian + "I", val_field)[0]
                break
        if gps_pointer is None:
            return None

        gps_entries = _read_ifd(tiff, endian, gps_pointer)
        if not gps_entries:
            return None

        fields = {tag: (typ, cnt, val) for tag, typ, cnt, val in gps_entries}

        def ref_of(tag):
            entry = fields.get(tag)
            if not entry:
                return ""
            data = _entry_data(tiff, endian, *entry)
            if not data:
                return ""
            return data[:1].decode("ascii", "ignore").upper()

        def degrees_of(tag):
            entry = fields.get(tag)
            if not entry:
                return None
            return _rationals_to_degrees(_entry_data(tiff, endian, *entry), endian)

        latitude = degrees_of(_GPS_LAT)
        longitude = degrees_of(_GPS_LON)
        if latitude is None or longitude is None:
            return None

        if ref_of(_GPS_LAT_REF) == "S":
            latitude = -latitude
        if ref_of(_GPS_LON_REF) == "W":
            longitude = -longitude

        if not (math.isfinite(latitude) and math.isfinite(longitude)):
            return None
        if abs(latitude) > 90 or abs(longitude) > 180:
            return None
        return (latitude, longitude)
    except Exception:  # pragma: no cover - parser defensivo, nunca propaga
        return None
