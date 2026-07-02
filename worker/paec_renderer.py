"""Renderer do PAEC: preenche o template DOCX tokenizado com a ficha da usina.

O template (gerado por worker/tools/paec_tokenizer.py e registrado como media
asset) tem cada campo por-usina num run unico ``{{chave}}`` ou
``{{chave|transform}}``. Aqui a mutacao e minima — so o texto dos runs muda,
preservando a formatacao institucional (Verdana, cabecalhos, tabelas, TOC).

Politica de dados ausentes: o renderer NUNCA falha por falta de valor — o
placeholder vira ``[[PENDENTE: <label>]]`` com realce amarelo (auditavel no
proprio documento) e entra na lista de pendencias devolvida no resultMeta do
job. Falha dura so por template inacessivel/corrompido.
"""

import copy
import io
import re

from docx import Document
from docx.oxml.ns import qn

from worker.docx_runs import (
    collect_all_spans,
    iter_parts,
    replace_span_text,
    run_text,
    set_run_highlight,
    set_run_text,
)

PLACEHOLDER_RE = re.compile(r"\{\{([a-z0-9_.]+)(?:\|(upper|title))?\}\}")

PENDING_PREFIX = "[[PENDENTE: "
PENDING_SUFFIX = "]]"


def _apply_transform(value, transform):
    if transform == "upper":
        return value.upper()
    if transform == "title":
        return value.title()
    return value


def _normalize_values(values):
    normalized = {}
    if isinstance(values, dict):
        for key, value in values.items():
            text = "" if value is None else str(value)
            if text.strip():
                normalized[str(key)] = text
    return normalized


def _field_labels(fields):
    labels = {}
    if isinstance(fields, list):
        for field in fields:
            if isinstance(field, dict) and field.get("key"):
                labels[str(field["key"])] = str(field.get("label") or field["key"])
    return labels


_TABLE_SEARCH_WINDOW = 8


def _enclosing_table(paragraph):
    """``w:tbl`` ancestral mais proximo de ``paragraph``, ou None se o
    paragrafo nao esta dentro de tabela nenhuma."""
    node = paragraph.getparent()
    while node is not None:
        if node.tag == qn("w:tbl"):
            return node
        node = node.getparent()
    return None


def _find_following_table(paragraph):
    """Primeira ``w:tbl`` depois de ``paragraph`` no mesmo pai — pula
    paragrafos de legenda intermediarios (ex. a frase de introducao antes da
    tabela de extintores), mas nao cruza mais que ``_TABLE_SEARCH_WINDOW``
    elementos irmaos para nao vazar pra uma tabela de outra secao."""
    parent = paragraph.getparent()
    if parent is None:
        return None
    siblings = list(parent)
    try:
        idx = siblings.index(paragraph)
    except ValueError:
        return None
    for sibling in siblings[idx + 1 : idx + 1 + _TABLE_SEARCH_WINDOW]:
        if sibling.tag == qn("w:tbl"):
            return sibling
    return None


def _find_block_table(paragraph):
    """Tabela do bloco a partir do paragrafo-ancora: se a propria ancora ja
    esta dentro de uma tabela (caso do cabecalho de coluna vir realcado, ex.
    'Nº PONTO DE ENCONTRO'), essa e a tabela; senao procura a proxima tabela
    depois do paragrafo (caso do heading solto antes da tabela, ex. Anexo IV
    ou 12.1.9)."""
    enclosing = _enclosing_table(paragraph)
    return enclosing if enclosing is not None else _find_following_table(paragraph)


def _find_block_anchor_span(document, block):
    """Localiza o span kind=list/manual ainda realcado (nao tokenizado nesta
    fase) que corresponde ao bloco, casando pelo texto salvo em
    ``anchorContext`` na curadoria do mapping.yaml."""
    anchor = (block.get("anchorContext") or "").strip()
    if not anchor:
        return None
    for span in collect_all_spans(document):
        if span.text.strip() == anchor:
            return span
    return None


def _set_cell_text(tc, text, highlight=None):
    """Substitui o texto de uma celula (``w:tc``), mantendo o primeiro
    paragrafo/run (herda formatacao) e removendo os demais. ``highlight``
    marca a celula (ex. amarelo em ``[[PENDENTE]]``), igual ao tratamento
    de campo escalar sem valor."""
    paragraphs = tc.findall(qn("w:p"))
    if not paragraphs:
        return
    first_p = paragraphs[0]
    for extra_p in paragraphs[1:]:
        tc.remove(extra_p)
    runs = first_p.findall(qn("w:r"))
    if runs:
        run = runs[0]
        set_run_text(run, text)
        for extra_r in runs[1:]:
            first_p.remove(extra_r)
    else:
        run = first_p.makeelement(qn("w:r"), {})
        first_p.append(run)
        set_run_text(run, text)
    if highlight:
        set_run_highlight(run, highlight)


def _render_list_block(document, block, items):
    """Clona a linha-modelo da tabela do bloco uma vez por item da ficha
    (``paec_plant_list_items``), preenchendo as celulas por ``columns[].key``
    na ordem. Sem item nenhum, uma unica linha ``[[PENDENTE]]`` substitui a
    linha-exemplo do modelo (nunca deixa dado de outra usina no documento
    gerado). Retorna True se conseguiu renderizar a tabela.
    """
    columns = block.get("columns") or []
    if not columns:
        return False

    anchor_span = _find_block_anchor_span(document, block)
    if anchor_span is None:
        return False

    table = _find_block_table(anchor_span.paragraph)
    if table is None:
        return False

    rows = table.findall(qn("w:tr"))
    if len(rows) < 2:
        return False
    header_row, template_row = rows[0], rows[1]
    data_rows = rows[1:]

    new_rows = []
    if items:
        for item in items:
            row = copy.deepcopy(template_row)
            cells = row.findall(qn("w:tc"))
            for cell, column in zip(cells, columns):
                value = item.get(column["key"]) if isinstance(item, dict) else None
                _set_cell_text(cell, "" if value is None else str(value))
            new_rows.append(row)
    else:
        row = copy.deepcopy(template_row)
        cells = row.findall(qn("w:tc"))
        if cells:
            label = block.get("label") or block.get("key")
            _set_cell_text(cells[0], f"{PENDING_PREFIX}{label}{PENDING_SUFFIX}", highlight="yellow")
            for cell in cells[1:]:
                _set_cell_text(cell, "")
        new_rows.append(row)

    for row in data_rows:
        table.remove(row)
    anchor = header_row
    for row in new_rows:
        anchor.addnext(row)
        anchor = row

    replace_span_text(anchor_span, anchor_span.text, drop_highlight=True)
    return True


def _render_list_blocks(document, blocks, list_items_map):
    """Renderiza todos os blocos ``kind=list`` do manifest; retorna as chaves
    que NAO deu pra renderizar (sem tabela localizavel ou sem colunas
    curadas ainda) — ficam com a linha-exemplo original do modelo, visivel
    pra auditoria manual."""
    unrendered = []
    for block in blocks or []:
        if not isinstance(block, dict) or block.get("kind") != "list":
            continue
        items = list_items_map.get(block.get("key")) or []
        if not _render_list_block(document, block, items):
            unrendered.append(block.get("key"))
    return unrendered


def render_paec_to_docx(context, template_bytes, output_path):
    """Renderiza o PAEC e retorna ``{"pendencies": [...], "stats": {...}}``.

    ``context`` e o retorno de buildPaecContext (backend): renderModel.paecReport
    com fields (catalogo do manifest), values (ficha) e pendencies pre-computadas
    (blocos manuais etc. — repassadas e complementadas aqui).
    """
    render_model = context.get("renderModel") if isinstance(context, dict) else {}
    paec = render_model.get("paecReport") if isinstance(render_model, dict) else {}

    values = _normalize_values(paec.get("values"))
    labels = _field_labels(paec.get("fields"))

    document = Document(io.BytesIO(template_bytes))

    missing_keys = []
    unresolved_tokens = []

    for _part, root in iter_parts(document):
        for run in root.iter(qn("w:r")):
            text = run_text(run)
            if "{{" not in text:
                continue

            replaced_missing = []

            def _sub(match):
                key, transform = match.group(1), match.group(2)
                if key in values:
                    return _apply_transform(values[key], transform or "none")
                replaced_missing.append(key)
                label = labels.get(key, key)
                return f"{PENDING_PREFIX}{label}{PENDING_SUFFIX}"

            new_text = PLACEHOLDER_RE.sub(_sub, text)
            if new_text != text:
                set_run_text(run, new_text)
                if replaced_missing:
                    set_run_highlight(run, "yellow")
                    missing_keys.extend(replaced_missing)
            if "{{" in new_text:
                # Token que o regex nao reconhece (manifest dessincronizado do
                # template): mantem visivel e reporta.
                unresolved_tokens.append(new_text.strip()[:120])
                set_run_highlight(run, "yellow")

    list_items_map = paec.get("listItems") if isinstance(paec.get("listItems"), dict) else {}
    _render_list_blocks(document, paec.get("blocks"), list_items_map)

    pendencies = []
    seen = set()
    for key in missing_keys:
        if key in seen:
            continue
        seen.add(key)
        pendencies.append({
            "kind": "field",
            "key": key,
            "label": labels.get(key, key),
            "section": None,
        })
    for token in unresolved_tokens:
        pendencies.append({
            "kind": "unresolved_token",
            "key": token,
            "label": f"Marcador nao resolvido: {token}",
            "section": None,
        })
    # Pendencias que so o backend conhece (blocos manuais da fase 1); campos ja
    # sao recalculados acima com base no documento real.
    for pendency in paec.get("pendencies") or []:
        if isinstance(pendency, dict) and pendency.get("kind") in {"manual_block", "list", "image"}:
            pendencies.append(pendency)

    document.save(output_path)

    stats = paec.get("stats") if isinstance(paec.get("stats"), dict) else {}
    return {"pendencies": pendencies, "stats": stats}
