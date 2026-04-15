"""Formatadores de coordenada para uso no worker do DOCX.

Porta direta das funcoes em backend/utils/erosionCoordinates_dist.js para Python
puro — sem dependencias externas. Fornece:

    decimal_to_dms(decimal, axis='lat') -> str          # 22°54'20.00"S
    decimal_to_utm(lat, lon) -> dict or None            # {easting, northing, zone, hemisphere}
    format_tower_coordinate(lat, lon, fmt) -> str       # 'decimal' | 'dms' | 'utm'
"""

from __future__ import annotations

import math
from typing import Optional

WGS84_A = 6378137.0
WGS84_ECC_SQUARED = 0.00669438
UTM_SCALE_FACTOR = 0.9996


def _coerce_float(value) -> Optional[float]:
    if value is None:
        return None
    try:
        result = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(result):
        return None
    return result


def decimal_to_dms(decimal, axis: str = "lat") -> str:
    """Converte um numero decimal para a string DMS ``22°54'20.00"S``.

    Espelha ``decimalToDms`` de ``erosionCoordinates_dist.js``.
    """
    dec = _coerce_float(decimal)
    if dec is None:
        return ""
    abs_val = abs(dec)
    deg = int(math.floor(abs_val))
    min_full = (abs_val - deg) * 60.0
    minutes = int(math.floor(min_full))
    seconds = (min_full - minutes) * 60.0
    if axis == "lat":
        hemi = "N" if dec >= 0 else "S"
    else:
        hemi = "E" if dec >= 0 else "W"
    minutes_str = f"{minutes:02d}"
    seconds_str = f"{seconds:05.2f}"
    return f"{deg}\u00b0{minutes_str}'{seconds_str}\"{hemi}"


def decimal_to_utm(lat, lon) -> Optional[dict]:
    """Converte coordenadas decimais WGS84 para UTM.

    Retorna ``{"easting", "northing", "zone", "hemisphere"}`` ou ``None`` se
    inválido. Espelha ``convertDecimalToUtm``.
    """
    lat_f = _coerce_float(lat)
    lon_f = _coerce_float(lon)
    if lat_f is None or lon_f is None:
        return None
    if lat_f < -80 or lat_f > 84:
        return None

    lat_rad = lat_f * math.pi / 180.0
    lon_rad = lon_f * math.pi / 180.0
    zone = int(math.floor((lon_f + 180) / 6)) + 1
    lon_origin = (zone - 1) * 6 - 180 + 3
    lon_origin_rad = lon_origin * math.pi / 180.0

    ecc_prime_sq = WGS84_ECC_SQUARED / (1 - WGS84_ECC_SQUARED)
    sin_lat = math.sin(lat_rad)
    cos_lat = math.cos(lat_rad)
    tan_lat = math.tan(lat_rad)

    n_val = WGS84_A / math.sqrt(1 - WGS84_ECC_SQUARED * sin_lat ** 2)
    t_val = tan_lat ** 2
    c_val = ecc_prime_sq * cos_lat ** 2
    a_val = cos_lat * (lon_rad - lon_origin_rad)

    m_val = WGS84_A * (
        (1 - WGS84_ECC_SQUARED / 4 - 3 * WGS84_ECC_SQUARED ** 2 / 64 - 5 * WGS84_ECC_SQUARED ** 3 / 256) * lat_rad
        - (3 * WGS84_ECC_SQUARED / 8 + 3 * WGS84_ECC_SQUARED ** 2 / 32 + 45 * WGS84_ECC_SQUARED ** 3 / 1024) * math.sin(2 * lat_rad)
        + (15 * WGS84_ECC_SQUARED ** 2 / 256 + 45 * WGS84_ECC_SQUARED ** 3 / 1024) * math.sin(4 * lat_rad)
        - (35 * WGS84_ECC_SQUARED ** 3 / 3072) * math.sin(6 * lat_rad)
    )

    easting = (
        UTM_SCALE_FACTOR
        * n_val
        * (
            a_val
            + (1 - t_val + c_val) * a_val ** 3 / 6
            + (5 - 18 * t_val + t_val ** 2 + 72 * c_val - 58 * ecc_prime_sq) * a_val ** 5 / 120
        )
        + 500000.0
    )
    northing = UTM_SCALE_FACTOR * (
        m_val
        + n_val
        * tan_lat
        * (
            a_val ** 2 / 2
            + (5 - t_val + 9 * c_val + 4 * c_val ** 2) * a_val ** 4 / 24
            + (61 - 58 * t_val + t_val ** 2 + 600 * c_val - 330 * ecc_prime_sq) * a_val ** 6 / 720
        )
    )
    if lat_f < 0:
        northing += 10000000.0

    if not math.isfinite(easting) or not math.isfinite(northing):
        return None

    return {
        "easting": int(round(easting)),
        "northing": int(round(northing)),
        "zone": zone,
        "hemisphere": "N" if lat_f >= 0 else "S",
    }


def format_tower_coordinate(lat, lon, fmt: str) -> str:
    """Formata a coordenada da torre na representação escolhida.

    ``fmt`` aceita: ``'decimal'`` (default quando desconhecido), ``'dms'``,
    ``'utm'``. Retorna string vazia se os valores forem inválidos.
    """
    lat_f = _coerce_float(lat)
    lon_f = _coerce_float(lon)
    if lat_f is None or lon_f is None:
        return ""

    mode = (fmt or "decimal").strip().lower()
    if mode == "dms":
        lat_str = decimal_to_dms(lat_f, "lat")
        lon_str = decimal_to_dms(lon_f, "lon")
        if not lat_str or not lon_str:
            return ""
        return f"{lat_str} {lon_str}"

    if mode == "utm":
        utm = decimal_to_utm(lat_f, lon_f)
        if not utm:
            return ""
        return f"{utm['easting']}E {utm['northing']}N {utm['zone']}{utm['hemisphere']}"

    # default: decimal
    return f"{lat_f:.6f}\u00b0, {lon_f:.6f}\u00b0"
