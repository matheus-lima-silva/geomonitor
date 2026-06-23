"""Trava de conformidade de marca dos templates DOCX do relatorio composto.

Garante que worker/assets/template_relatorio.docx (corpo) e
template_ficha_cadastro_erosao.docx (anexo) permanecem alinhados ao Manual de
Comunicacao Visual da AXIA Energia (secoes 3 e 4) apos o re-skin + embed feito
por worker/scripts/reskin_template_axia.py. Se alguem reabrir um template no
Word e salvar com o tema Office/Aptos padrao, ou perder o embed de DM Sans,
estes testes quebram.
"""

import os
import re
import zipfile

import pytest
from docx import Document

from worker.scripts.reskin_template_axia import (
    EMBED_SLOTS,
    FONTS_DIR,
    _format_guid,
    obfuscate_font,
)

ASSETS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "assets")
TEMPLATES = {
    "relatorio": os.path.join(ASSETS_DIR, "template_relatorio.docx"),
    "ficha": os.path.join(ASSETS_DIR, "template_ficha_cadastro_erosao.docx"),
}

# Paleta AXIA (manual secao 4).
AXIA = {"AZUL": "0000FF", "MARINHO": "0A003C", "OFFWHITE": "FAF5F0", "CINZA": "A0B4D2", "AMARELO": "F9B50B"}

# Cores dos temas padrao (Office no relatorio, Aptos na ficha) que NAO podem sobreviver.
STOCK_THEME_COLORS = ["4472C4", "ED7D31", "FFC000", "44546A", "0E2841", "156082", "E97132", "0F9ED5"]


@pytest.fixture(params=list(TEMPLATES), ids=list(TEMPLATES))
def template_path(request):
    return TEMPLATES[request.param]


def _xml(path, part):
    with zipfile.ZipFile(path) as z:
        return z.read(part).decode("utf-8", "ignore")


def _clr_scheme(path):
    return re.search(r"<a:clrScheme.*?</a:clrScheme>", _xml(path, "word/theme/theme1.xml"), re.S).group(0)


def test_template_opens(template_path):
    assert len(Document(template_path).sections) >= 1


def test_theme_uses_axia_palette(template_path):
    cs = _clr_scheme(template_path)

    def slot(name):
        return re.search(rf'<a:{name}>\s*<a:srgbClr val="([0-9A-Fa-f]{{6}})"', cs).group(1).upper()

    assert slot("accent1") == AXIA["AZUL"]
    assert slot("dk2") == AXIA["MARINHO"]
    assert slot("lt2") == AXIA["OFFWHITE"]
    assert slot("accent3") == AXIA["CINZA"]
    assert slot("accent4") == AXIA["AMARELO"]
    assert slot("hlink") == AXIA["AZUL"]


def test_no_stock_theme_colors_remain(template_path):
    cs = _clr_scheme(template_path)
    leftovers = [c for c in STOCK_THEME_COLORS if c in cs]
    assert leftovers == [], f"cores de tema padrao ainda presentes: {leftovers}"


def test_theme_and_doc_default_fonts_are_dm_sans(template_path):
    fonts = re.findall(
        r'<a:(?:major|minor)Font>\s*<a:latin typeface="([^"]+)"', _xml(template_path, "word/theme/theme1.xml")
    )
    assert fonts[:2] == ["DM Sans", "DM Sans"]
    dd = re.search(r"<w:docDefaults>.*?</w:docDefaults>", _xml(template_path, "word/styles.xml"), re.S).group(0)
    rfonts = re.search(r"<w:rFonts[^>]*>", dd).group(0)
    assert 'w:ascii="DM Sans"' in rfonts and 'w:hAnsi="DM Sans"' in rfonts


def test_no_verdana_left(template_path):
    # Capa do relatorio + 368 runs da ficha migraram de Verdana para DM Sans.
    assert '"Verdana"' not in _xml(template_path, "word/document.xml")


def test_dm_sans_declared_with_arial_fallback(template_path):
    # Manual secao 3.2: docs abertos por terceiros caem na fonte de sistema Arial.
    entry = re.search(r'<w:font w:name="DM Sans">.*?</w:font>', _xml(template_path, "word/fontTable.xml"), re.S)
    assert entry is not None
    assert 'w:altName w:val="Arial"' in entry.group(0)


def test_dm_sans_is_embedded(template_path):
    """DM Sans embutida (regular/bold/italic/bold-italic) e wiring OPC completo."""
    with zipfile.ZipFile(template_path) as z:
        names = z.namelist()
        ft = z.read("word/fontTable.xml").decode("utf-8")
        ct = z.read("[Content_Types].xml").decode("utf-8")
        settings = z.read("word/settings.xml").decode("utf-8")
        rels = z.read("word/_rels/fontTable.xml.rels").decode("utf-8")
        entry = re.search(r'<w:font w:name="DM Sans">.*?</w:font>', ft, re.S).group(0)

        assert 'Extension="odttf"' in ct
        assert "<w:embedTrueTypeFonts" in settings
        for tag, _ttf, _guid in EMBED_SLOTS:
            assert f"<w:{tag} " in entry, f"slot {tag} ausente"

        # rId -> rels -> odttf part: cadeia resolve e a fonte de-ofuscada bate com a TTF do repo.
        guid_to_ttf = {_format_guid(g): f for _, f, g in EMBED_SLOTS}
        embeds = re.findall(r'<w:embed\w+ r:id="(rId\d+)" w:fontKey="(\{[0-9A-F-]+\})"/>', entry)
        assert len(embeds) == len(EMBED_SLOTS)
        for rid, key in embeds:
            target = re.search(rf'Id="{rid}"[^>]*Target="(fonts/font\d+\.odttf)"', rels).group(1)
            assert ("word/" + target) in names
            obf = z.read("word/" + target)
            deobf = obfuscate_font(obf, key.strip("{}").replace("-", ""))
            original = open(os.path.join(FONTS_DIR, guid_to_ttf[key]), "rb").read()
            assert deobf == original, f"odttf {target} nao de-ofusca para a TTF original"
