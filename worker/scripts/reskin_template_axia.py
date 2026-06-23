"""Re-skin the worker DOCX templates to the AXIA Energia brand.

Targets both institutional templates used by the compound report (Relatorio de
Monitoramento de Processo Erosivo) and its erosion-form annex:

  * worker/assets/template_relatorio.docx
  * worker/assets/template_ficha_cadastro_erosao.docx

Applies the AXIA Communication Visual Manual (sections 3-4):

  * theme1.xml   -> color scheme remapped to the AXIA palette; theme fonts (major
                    and minor) switched to DM Sans.
  * styles.xml   -> docDefaults base font switched to DM Sans; any explicit
                    Verdana switched to DM Sans.
  * fontTable.xml-> declares "DM Sans" with altName="Arial" (manual 3.2 system
                    font rule) and EMBEDS the DM Sans static weights so the font
                    renders for recipients without it installed.
  * document.xml -> body/cover runs switched from Verdana to DM Sans.

Fonts are embedded per ECMA-376 / OPC: each TTF is obfuscated (XOR of the first
32 bytes with the reversed fontKey GUID) and wired through fontTable.xml,
fontTable.xml.rels, [Content_Types].xml (odttf Default) and settings.xml
(embedTrueTypeFonts).

The transform is idempotent: re-running on an already-skinned/embedded template
is a no-op. Untouched members (media, headers/footers, Furnas control fields)
are copied through.

Usage:
    python -m worker.scripts.reskin_template_axia          # rewrites all targets in place
"""

import io
import os
import re
import sys
import zipfile

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")
TARGETS = [
    os.path.join(ASSETS_DIR, "template_relatorio.docx"),
    os.path.join(ASSETS_DIR, "template_ficha_cadastro_erosao.docx"),
]

# AXIA palette (Manual de Comunicacao Visual, secao 4).
AXIA_AZUL = "0000FF"      # Azul AXIA
AXIA_MARINHO = "0A003C"   # Azul-marinho
AXIA_OFFWHITE = "FAF5F0"  # Off-white
AXIA_CINZA = "A0B4D2"     # Cinza
AXIA_AMARELO = "F9B50B"   # Amarelo (usado so como cor de texto, nunca fundo)

# clrScheme slot -> AXIA hex. dk1/lt1 stay as sysClr (black/white) for AAA body
# contrast required by the manual (secao 3.5).
THEME_SLOTS = {
    "dk2": AXIA_MARINHO,
    "lt2": AXIA_OFFWHITE,
    "accent1": AXIA_AZUL,
    "accent2": AXIA_MARINHO,
    "accent3": AXIA_CINZA,
    "accent4": AXIA_AMARELO,
    "accent5": AXIA_CINZA,
    "accent6": AXIA_AZUL,
    "hlink": AXIA_AZUL,
    "folHlink": AXIA_MARINHO,
}

BRAND_FONT = "DM Sans"
FALLBACK_FONT = "Arial"

# Base DM Sans declaration (no embed children yet — embed_dm_sans adds those).
DM_SANS_FONT_ENTRY = (
    '<w:font w:name="DM Sans">'
    '<w:altName w:val="Arial"/>'
    '<w:panose1 w:val="020B0604020202020204"/>'
    '<w:charset w:val="00"/>'
    '<w:family w:val="swiss"/>'
    '<w:pitch w:val="variable"/>'
    '<w:sig w:usb0="A00002EF" w:usb1="4000205B" w:usb2="00000000" w:usb3="00000000"'
    ' w:csb0="0000019F" w:csb1="00000000"/>'
    "</w:font>"
)

# Embed slot -> (TTF file, fixed fontKey GUID hex). Fixed GUIDs keep the obfuscated
# output deterministic across runs.
EMBED_SLOTS = [
    ("embedRegular", "DMSans-Regular.ttf", "1B6E9F40000040008000000000000001"),
    ("embedBold", "DMSans-Bold.ttf", "1B6E9F40000040008000000000000002"),
    ("embedItalic", "DMSans-Italic.ttf", "1B6E9F40000040008000000000000003"),
    ("embedBoldItalic", "DMSans-BoldItalic.ttf", "1B6E9F40000040008000000000000004"),
]
FONT_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/font"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ODTTF_DEFAULT = (
    '<Default Extension="odttf" '
    'ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/>'
)


# ---------------------------------------------------------------------------
# Text (XML) transforms
# ---------------------------------------------------------------------------
def reskin_theme(xml):
    def slot_sub(match):
        slot = match.group("slot")
        return f'<a:{slot}><a:srgbClr val="{THEME_SLOTS[slot]}"/></a:{slot}>'

    slots = "|".join(THEME_SLOTS)
    # Whitespace-tolerant: matches both `<a:srgbClr val=".."/>` and `.. />`.
    xml = re.sub(
        rf'<a:(?P<slot>{slots})>\s*<a:srgbClr val="[0-9A-Fa-f]{{6}}"\s*/>\s*</a:(?P=slot)>',
        slot_sub,
        xml,
    )
    xml = re.sub(
        r'(<a:majorFont>\s*<a:latin typeface=")[^"]*(")', rf"\1{BRAND_FONT}\2", xml, count=1
    )
    xml = re.sub(
        r'(<a:minorFont>\s*<a:latin typeface=")[^"]*(")', rf"\1{BRAND_FONT}\2", xml, count=1
    )
    return xml


def reskin_styles(xml):
    def doc_defaults_sub(match):
        block = match.group(0)
        block = re.sub(
            r'(<w:rFonts\b[^>]*?w:ascii=")[^"]*("[^>]*?w:hAnsi=")[^"]*(")',
            rf"\1{BRAND_FONT}\2{BRAND_FONT}\3",
            block,
        )
        block = re.sub(r'(w:eastAsia=")[^"]*(")', rf"\1{BRAND_FONT}\2", block)
        block = re.sub(r'(w:cs=")[^"]*(")', rf"\1{BRAND_FONT}\2", block)
        return block

    xml = re.sub(r"<w:docDefaults>.*?</w:docDefaults>", doc_defaults_sub, xml, flags=re.S)
    # Named styles that hard-code Verdana (e.g. the ficha) -> DM Sans.
    xml = xml.replace('"Verdana"', f'"{BRAND_FONT}"')
    return xml


def reskin_font_table(xml):
    if '<w:font w:name="DM Sans">' not in xml:
        xml = xml.replace("</w:fonts>", DM_SANS_FONT_ENTRY + "</w:fonts>", 1)
    return xml


def reskin_document(xml):
    return xml.replace('"Verdana"', f'"{BRAND_FONT}"')


TRANSFORMS = {
    "word/theme/theme1.xml": reskin_theme,
    "word/styles.xml": reskin_styles,
    "word/fontTable.xml": reskin_font_table,
    "word/document.xml": reskin_document,
}


# ---------------------------------------------------------------------------
# Font embedding (ECMA-376 / OPC)
# ---------------------------------------------------------------------------
def obfuscate_font(ttf_bytes, guid_hex):
    """XOR the first 32 bytes of a TTF with the reversed fontKey GUID (symmetric)."""
    key = bytearray.fromhex(guid_hex)
    key.reverse()
    data = bytearray(ttf_bytes)
    for i in range(32):
        data[i] ^= key[i % 16]
    return bytes(data)


def _format_guid(guid_hex):
    h = guid_hex
    return "{" + f"{h[0:8]}-{h[8:12]}-{h[12:16]}-{h[16:20]}-{h[20:32]}".upper() + "}"


def _next_index(names, prefix, suffix):
    nums = [
        int(m.group(1))
        for n in names
        for m in [re.fullmatch(re.escape(prefix) + r"(\d+)" + re.escape(suffix), n)]
        if m
    ]
    return max(nums, default=0) + 1


def embed_dm_sans(blobs, names):
    """Embed the DM Sans static weights into the package (mutates blobs/names)."""
    ft = blobs["word/fontTable.xml"].decode("utf-8")
    dm_entry = re.search(r'<w:font w:name="DM Sans">.*?</w:font>', ft, re.S)
    if dm_entry is None:
        raise RuntimeError("DM Sans font entry missing — run reskin_font_table first")
    if "w:embedRegular" in dm_entry.group(0):
        return  # idempotent: already embedded

    # Ensure the r: namespace is declared on the <w:fonts> root (inspect the
    # actual root open tag, not the <?xml?> declaration).
    fonts_open = ft[ft.find("<w:fonts") : ft.find(">", ft.find("<w:fonts")) + 1]
    if "xmlns:r=" not in fonts_open:
        ft = re.sub(r"(<w:fonts\b)", rf'\1 xmlns:r="{R_NS}"', ft, count=1)

    font_idx = _next_index(names, "word/fonts/font", ".odttf")
    rels_name = "word/_rels/fontTable.xml.rels"
    rels_xml = blobs.get(rels_name, b"").decode("utf-8") if rels_name in blobs else ""
    rid_idx = (
        max(
            [int(m) for m in re.findall(r'Id="rId(\d+)"', rels_xml)] or [0],
            default=0,
        )
        + 1
    )

    embed_children = ""
    new_rels = ""
    for offset, (tag, ttf_file, guid_hex) in enumerate(EMBED_SLOTS):
        odttf_name = f"word/fonts/font{font_idx + offset}.odttf"
        rid = f"rId{rid_idx + offset}"
        with open(os.path.join(FONTS_DIR, ttf_file), "rb") as handle:
            blobs[odttf_name] = obfuscate_font(handle.read(), guid_hex)
        names.append(odttf_name)
        embed_children += f'<w:{tag} r:id="{rid}" w:fontKey="{_format_guid(guid_hex)}"/>'
        new_rels += (
            f'<Relationship Id="{rid}" Type="{FONT_REL_TYPE}" '
            f'Target="fonts/font{font_idx + offset}.odttf"/>'
        )

    # Insert embed children into the DM Sans entry.
    new_entry = dm_entry.group(0).replace("</w:font>", embed_children + "</w:font>")
    ft = ft.replace(dm_entry.group(0), new_entry, 1)
    blobs["word/fontTable.xml"] = ft.encode("utf-8")

    # fontTable.xml.rels — create or extend.
    if rels_xml:
        rels_xml = rels_xml.replace("</Relationships>", new_rels + "</Relationships>", 1)
    else:
        rels_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            f"{new_rels}</Relationships>"
        )
        names.append(rels_name)
    blobs[rels_name] = rels_xml.encode("utf-8")

    # [Content_Types].xml — ensure odttf Default.
    ct = blobs["[Content_Types].xml"].decode("utf-8")
    if 'Extension="odttf"' not in ct:
        ct = ct.replace("</Types>", ODTTF_DEFAULT + "</Types>", 1)
        blobs["[Content_Types].xml"] = ct.encode("utf-8")

    # settings.xml — ensure embedTrueTypeFonts flag.
    settings = blobs["word/settings.xml"].decode("utf-8")
    if "<w:embedTrueTypeFonts" not in settings:
        settings = re.sub(
            r"(<w:settings\b[^>]*>)", r"\1<w:embedTrueTypeFonts/>", settings, count=1
        )
        blobs["word/settings.xml"] = settings.encode("utf-8")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------
def reskin(src_path, dst_path):
    with zipfile.ZipFile(src_path) as zin:
        names = [item.filename for item in zin.infolist()]
        blobs = {name: zin.read(name) for name in names}

    for name, transform in TRANSFORMS.items():
        if name in blobs:
            blobs[name] = transform(blobs[name].decode("utf-8")).encode("utf-8")

    embed_dm_sans(blobs, names)

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zout:
        for name in names:
            zout.writestr(name, blobs[name])
    with open(dst_path, "wb") as handle:
        handle.write(buffer.getvalue())


def main():
    for target in TARGETS:
        reskin(target, target)
        print(f"re-skinned + embedded: {target}")


if __name__ == "__main__":
    main()
