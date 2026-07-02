import io

import pytest
from docx import Document
from docx.enum.text import WD_COLOR_INDEX

from worker.docx_runs import collect_all_spans
from worker.tools.paec_tokenizer import (
    apply_mapping,
    build_mapping,
    document_text,
    render_values,
    sample_values,
)

_COLORS = {"yellow": WD_COLOR_INDEX.YELLOW, "red": WD_COLOR_INDEX.RED}


def _marked_doc():
    """Documento sintetico reproduzindo os padroes do modelo REV 10."""
    doc = Document()

    p = doc.add_paragraph()
    p.add_run("Usina de ")
    p.add_run("Marimbondo").font.highlight_color = _COLORS["yellow"]
    p.add_run(" gera energia.")

    p = doc.add_paragraph("Proteger as instalacoes da ")
    p.add_run("MARIMBONDO").font.highlight_color = _COLORS["yellow"]

    # campo fragmentado em 3 runs, como o Word costuma salvar
    p = doc.add_paragraph()
    for chunk in ("Ger", "encia ", "Regional"):
        p.add_run(chunk).font.highlight_color = _COLORS["yellow"]

    p = doc.add_paragraph("Contato: ")
    p.add_run("(34) 99730-4626").font.highlight_color = _COLORS["yellow"]

    p = doc.add_paragraph("Derramamento de ")
    p.add_run("95.814 L").font.highlight_color = _COLORS["yellow"]
    p.add_run(" de oleo isolante.")

    p = doc.add_paragraph()
    p.add_run("12.1.2. Rede de Hidrantes").font.highlight_color = _COLORS["yellow"]

    p = doc.add_paragraph()
    p.add_run("anexo VII - ROTA DE FUGA").font.highlight_color = _COLORS["yellow"]

    p = doc.add_paragraph()
    p.add_run("N PONTO DE ENCONTRO").font.highlight_color = _COLORS["red"]

    p = doc.add_paragraph()
    p.add_run("   ").font.highlight_color = _COLORS["yellow"]
    p.add_run("fim")

    return doc


def _entry(mapping, text):
    return next(e for e in mapping["spans"] if e["text"].strip() == text)


# ---------------------------------------------------------------------------
# extract / build_mapping
# ---------------------------------------------------------------------------
def test_extract_sugere_kinds_e_chaves():
    mapping = build_mapping(_marked_doc(), "sintetico.docx")

    assert mapping["stats"] == {"spans": 9, "yellow": 8, "red": 1}
    assert len(mapping["pageAudit"]) == 1

    assert _entry(mapping, "Marimbondo")["kind"] == "field"
    assert _entry(mapping, "Gerencia Regional")["kind"] == "field"
    assert _entry(mapping, "(34) 99730-4626")["key"] == "telefone_1"
    # "95.814 L" casa com o regex de heading (numero.numero) mas nao tem
    # letras suficientes para ser um titulo de secao real -> deve ficar campo
    assert _entry(mapping, "95.814 L")["kind"] == "field"
    assert _entry(mapping, "12.1.2. Rede de Hidrantes")["kind"] == "section_title"
    assert _entry(mapping, "anexo VII - ROTA DE FUGA")["kind"] == "manual"
    assert _entry(mapping, "N PONTO DE ENCONTRO")["kind"] == "list"

    blank = next(e for e in mapping["spans"] if not e["text"].strip())
    assert blank["kind"] == "whitespace"


def test_extract_agrupa_variante_maiuscula_na_mesma_chave():
    mapping = build_mapping(_marked_doc(), "sintetico.docx")
    canonical = _entry(mapping, "Marimbondo")
    upper = _entry(mapping, "MARIMBONDO")
    assert canonical["key"] == upper["key"] == "marimbondo"
    assert canonical["transform"] == "none"
    assert upper["transform"] == "upper"


def test_extract_variante_nao_derivavel_ganha_chave_propria():
    doc = Document()
    doc.add_paragraph().add_run("Elvio Zampier").font.highlight_color = _COLORS["yellow"]
    # mesmo texto normalizado (acentos ignorados), mas nao derivavel por upper/title
    doc.add_paragraph().add_run("elvio zampier").font.highlight_color = _COLORS["yellow"]
    mapping = build_mapping(doc, "s.docx")
    keys = [e["key"] for e in mapping["spans"]]
    assert keys[0] == "elvio_zampier"
    assert keys[1] == "elvio_zampier_v2"


def test_extract_textos_distintos_que_colidem_no_slug_ganham_chaves_diferentes():
    """Regressao: slugify trunca em 5 tokens e descarta pontuacao, entao
    "Gerencia de O&M Marimbondo e Colombia G Sudeste" e "...e P. Colombia G
    Sudeste" (textos DIFERENTES, nao variantes de caixa um do outro)
    colidiam no mesmo slug e se fundiam incorretamente no mesmo campo."""
    doc = Document()
    doc.add_paragraph().add_run(
        "Gerencia de O&M Marimbondo e Colombia G Sudeste"
    ).font.highlight_color = _COLORS["yellow"]
    doc.add_paragraph().add_run(
        "Gerencia de O&M Marimbondo e P. Colombia G Sudeste"
    ).font.highlight_color = _COLORS["yellow"]
    doc.add_paragraph().add_run("Telefone / Fax").font.highlight_color = _COLORS["yellow"]
    doc.add_paragraph().add_run("Telefone/Fax").font.highlight_color = _COLORS["yellow"]

    mapping = build_mapping(doc, "s.docx")
    keys = [e["key"] for e in mapping["spans"]]
    assert len(keys) == len(set(keys)), f"chaves colidiram: {keys}"

    manifest = apply_mapping(doc, mapping, "PAEC", "REV")
    assert len(manifest["fields"]) == 4
    values = sample_values(manifest)
    unresolved = render_values(doc, values)
    assert unresolved == []
    assert "Gerencia de O&M Marimbondo e Colombia G Sudeste" in document_text(doc)
    assert "Gerencia de O&M Marimbondo e P. Colombia G Sudeste" in document_text(doc)
    assert "Telefone / Fax" in document_text(doc)
    assert "Telefone/Fax" in document_text(doc)


def test_extract_canonico_nunca_e_a_variante_toda_maiuscula():
    doc = Document()
    # a variante MAIUSCULA aparece primeiro no documento
    doc.add_paragraph().add_run("MARIMBONDO").font.highlight_color = _COLORS["yellow"]
    doc.add_paragraph().add_run("Marimbondo").font.highlight_color = _COLORS["yellow"]
    mapping = build_mapping(doc, "s.docx")
    assert mapping["spans"][0]["transform"] == "upper"
    assert mapping["spans"][1]["transform"] == "none"


# ---------------------------------------------------------------------------
# apply
# ---------------------------------------------------------------------------
def test_apply_tokeniza_campos_e_limpa_highlights():
    doc = _marked_doc()
    mapping = build_mapping(doc, "sintetico.docx")
    manifest = apply_mapping(doc, mapping, "PAEC AXIA", "REV TESTE")

    text = document_text(doc)
    assert "{{marimbondo}}" in text
    assert "{{marimbondo|upper}}" in text
    assert "{{telefone_1}}" in text
    assert "{{95_814_l}}" in text
    assert "Marimbondo" not in text.replace("{{marimbondo", "")

    # sobram apenas os spans NAO tokenizados nesta fase: titulos de secao e
    # anexos manuais mantem o realce (pendencia visual) e o bloco vermelho
    # so e tokenizado na fase 2
    remaining = collect_all_spans(doc)
    assert [(s.color, s.text) for s in remaining] == [
        ("yellow", "12.1.2. Rede de Hidrantes"),
        ("yellow", "anexo VII - ROTA DE FUGA"),
        ("red", "N PONTO DE ENCONTRO"),
    ]

    field = next(f for f in manifest["fields"] if f["key"] == "marimbondo")
    assert field["sampleValue"] == "Marimbondo"
    assert len(field["occurrences"]) == 2
    assert {o["transform"] for o in field["occurrences"]} == {"none", "upper"}

    assert [(b["key"], b["kind"]) for b in manifest["blocks"]] == [
        ("anexo_vii_rota_de_fuga", "manual"),
        ("n_ponto_de_encontro", "list"),
    ]
    assert [s["sectionKey"] for s in manifest["sections"]] == ["12_1_2_rede_de"]
    assert manifest["sections"][0]["renumberGroup"] == "12.1"
    assert manifest["revisionLabel"] == "REV TESTE"


def test_apply_ignore_mantem_texto_mas_remove_realce():
    """kind=ignore preserva o texto original (rotulo estatico que nao varia
    por usina) mas remove o realce de curadoria; ao contrario de kind=field,
    nao vira placeholder nem entra no manifest."""
    doc = Document()
    doc.add_paragraph().add_run("Razao Social").font.highlight_color = _COLORS["yellow"]
    mapping = build_mapping(doc, "s.docx")
    mapping["spans"][0]["kind"] = "ignore"
    mapping["spans"][0]["reviewed"] = True

    manifest = apply_mapping(doc, mapping, "PAEC", "REV")

    assert document_text(doc) == "Razao Social"
    remaining = collect_all_spans(doc)
    assert remaining == []
    assert manifest["fields"] == []
    assert manifest["stats"]["unreviewedSpans"] == 0


def test_apply_preserva_indentacao_da_capa():
    doc = Document()
    doc.add_paragraph().add_run("          Plano de Emergencia ").font.highlight_color = (
        _COLORS["yellow"]
    )
    mapping = build_mapping(doc, "s.docx")
    apply_mapping(doc, mapping, "PAEC", "REV")
    assert document_text(doc) == "          {{plano_de_emergencia}} "


def test_apply_recusa_documento_divergente_do_mapping():
    doc = _marked_doc()
    mapping = build_mapping(doc, "sintetico.docx")
    mapping["spans"][0]["text"] = "outro texto"
    with pytest.raises(ValueError, match="divergiu do mapping"):
        apply_mapping(doc, mapping, "PAEC", "REV")

    other = Document()
    other.add_paragraph().add_run("x").font.highlight_color = _COLORS["yellow"]
    with pytest.raises(ValueError, match="confira se e o MESMO arquivo"):
        apply_mapping(other, build_mapping(_marked_doc(), "s.docx"), "PAEC", "REV")


# ---------------------------------------------------------------------------
# render / round-trip
# ---------------------------------------------------------------------------
def test_render_aplica_transform_e_reporta_nao_resolvidas():
    doc = _marked_doc()
    mapping = build_mapping(doc, "s.docx")
    manifest = apply_mapping(doc, mapping, "PAEC", "REV")

    values = sample_values(manifest)
    values.pop("telefone_1")
    unresolved = render_values(doc, values)

    text = document_text(doc)
    assert "Usina de Marimbondo gera energia." in text
    assert "Proteger as instalacoes da MARIMBONDO" in text
    assert "{{telefone_1}}" in text
    assert set(unresolved) == {"telefone_1"}


def test_roundtrip_texto_identico_ao_modelo_marcado():
    original = _marked_doc()
    original_text = document_text(original)

    doc = _marked_doc()
    mapping = build_mapping(doc, "s.docx")
    manifest = apply_mapping(doc, mapping, "PAEC", "REV")

    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    rendered = Document(buffer)
    unresolved = render_values(rendered, sample_values(manifest))

    assert unresolved == []
    assert document_text(rendered) == original_text


def test_roundtrip_com_campo_multilinha():
    def _build():
        doc = Document()
        p = doc.add_paragraph()
        run = p.add_run("Tel.: ")
        run.font.highlight_color = _COLORS["yellow"]
        run.add_break()
        run2 = p.add_run("17 98820-6833")
        run2.font.highlight_color = _COLORS["yellow"]
        return doc

    original_text = document_text(_build())
    doc = _build()
    mapping = build_mapping(doc, "s.docx")
    manifest = apply_mapping(doc, mapping, "PAEC", "REV")

    field = manifest["fields"][0]
    assert field["type"] == "multiline"

    unresolved = render_values(doc, sample_values(manifest))
    assert unresolved == []
    assert document_text(doc) == original_text
