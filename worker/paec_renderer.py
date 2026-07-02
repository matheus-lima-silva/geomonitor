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

import io
import re

from docx import Document
from docx.oxml.ns import qn

from worker.docx_runs import iter_parts, run_text, set_run_highlight, set_run_text

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
