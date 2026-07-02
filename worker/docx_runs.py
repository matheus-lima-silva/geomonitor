"""Low-level helpers for highlighted-run spans in DOCX XML.

The PAEC canonical model marks per-plant fields with yellow highlight and
per-plant table blocks with red highlight. Word fragments logically contiguous
highlighted text into dozens of adjacent runs (the REV 10 model has ~500
highlighted runs for ~120 logical fields); these helpers group those fragments
back into whole spans so the tokenizer (and, defensively, future renderers)
can treat each highlighted stretch as a single unit.

Everything operates at the lxml layer exposed by python-docx so it reaches
text inside tables, headers/footers and VML/DrawingML text boxes
(w:txbxContent), where the model keeps its cover fields and flowcharts.
"""

from dataclasses import dataclass, field

from docx.oxml.ns import qn

# Elements that may sit between two runs without breaking span adjacency.
_IGNORABLE_BETWEEN_RUNS = frozenset(
    qn(tag)
    for tag in (
        "w:proofErr",
        "w:bookmarkStart",
        "w:bookmarkEnd",
        "w:commentRangeStart",
        "w:commentRangeEnd",
        "w:lastRenderedPageBreak",
    )
)

_XML_SPACE = "{http://www.w3.org/XML/1998/namespace}space"


def iter_parts(document):
    """Yield ``(part_name, root_element)`` for the body and every distinct
    header/footer part of a python-docx ``Document``."""
    yield "document", document.element
    seen = set()
    for section in document.sections:
        for attr in (
            "header",
            "footer",
            "first_page_header",
            "first_page_footer",
            "even_page_header",
            "even_page_footer",
        ):
            hf = getattr(section, attr)
            if hf is None or hf.is_linked_to_previous:
                continue
            name = str(hf.part.partname)
            if name in seen:
                continue
            seen.add(name)
            yield name, hf.part.element


def iter_paragraphs(root):
    """All ``w:p`` elements of a part in document order, including paragraphs
    nested in tables and in text boxes (``w:txbxContent``)."""
    return root.iter(qn("w:p"))


def run_highlight(run):
    """Highlight color name of a run (``yellow``, ``red``...) or ``None``."""
    rpr = run.find(qn("w:rPr"))
    if rpr is None:
        return None
    hl = rpr.find(qn("w:highlight"))
    if hl is None:
        return None
    return hl.get(qn("w:val"))


def run_text(run):
    """Visible text of a run; ``w:br``/``w:cr`` map to ``\\n``, ``w:tab`` to ``\\t``."""
    parts = []
    for child in run:
        tag = child.tag
        if tag == qn("w:t"):
            parts.append(child.text or "")
        elif tag in (qn("w:br"), qn("w:cr")):
            parts.append("\n")
        elif tag == qn("w:tab"):
            parts.append("\t")
    return "".join(parts)


def paragraph_text(paragraph):
    """Visible text of a paragraph element (all runs, hyperlinks included)."""
    return "".join(run_text(r) for r in paragraph.iter(qn("w:r")))


@dataclass
class Span:
    """A maximal stretch of adjacent runs sharing one highlight color."""

    part: str
    paragraph: object
    runs: list
    color: str
    text: str
    context: str = ""


@dataclass
class _SpanBuilder:
    color: str
    runs: list = field(default_factory=list)
    texts: list = field(default_factory=list)


def collect_highlight_spans(root, part_name="document"):
    """Group adjacent highlighted runs of every paragraph into ``Span``s.

    Runs separated only by proof-error/bookmark/comment markers count as
    adjacent. A change of highlight color, a non-ignorable element or a
    non-highlighted run closes the current span.
    """
    spans = []
    for paragraph in iter_paragraphs(root):
        current = None

        def flush():
            nonlocal current
            if current is not None and "".join(current.texts):
                spans.append(
                    Span(
                        part=part_name,
                        paragraph=paragraph,
                        runs=current.runs,
                        color=current.color,
                        text="".join(current.texts),
                    )
                )
            current = None

        for child in paragraph:
            tag = child.tag
            if tag == qn("w:r"):
                color = run_highlight(child)
                if color is None:
                    flush()
                elif current is not None and current.color == color:
                    current.runs.append(child)
                    current.texts.append(run_text(child))
                else:
                    flush()
                    current = _SpanBuilder(color=color, runs=[child], texts=[run_text(child)])
            elif tag in _IGNORABLE_BETWEEN_RUNS:
                continue
            else:
                flush()
        flush()

    context_cache = {}
    for span in spans:
        key = id(span.paragraph)
        if key not in context_cache:
            context_cache[key] = paragraph_text(span.paragraph)
        span.context = context_cache[key]
    return spans


def collect_all_spans(document):
    """``collect_highlight_spans`` over every part, in stable order (body
    first, then headers/footers). Span order is the contract between the
    ``extract`` mapping and ``apply``."""
    spans = []
    for part_name, root in iter_parts(document):
        spans.extend(collect_highlight_spans(root, part_name))
    return spans


def set_run_text(run, text):
    """Replace the visible content of ``run`` with ``text``; ``\\n`` becomes
    ``w:br`` and ``\\t`` becomes ``w:tab`` so multi-line values survive."""
    for child in list(run):
        if child.tag != qn("w:rPr"):
            run.remove(child)
    first_line = True
    for line in text.split("\n"):
        if not first_line:
            run.append(run.makeelement(qn("w:br"), {}))
        first_line = False
        segments = line.split("\t")
        for i, segment in enumerate(segments):
            if i:
                run.append(run.makeelement(qn("w:tab"), {}))
            if segment:
                t = run.makeelement(qn("w:t"), {})
                t.text = segment
                if segment != segment.strip():
                    t.set(_XML_SPACE, "preserve")
                run.append(t)


def set_run_highlight(run, color):
    """Add/replace the ``w:highlight`` of a run (e.g. the yellow mark on
    ``[[PENDENTE]]`` placeholders in generated PAECs)."""
    rpr = run.find(qn("w:rPr"))
    if rpr is None:
        rpr = run.makeelement(qn("w:rPr"), {})
        run.insert(0, rpr)
    hl = rpr.find(qn("w:highlight"))
    if hl is None:
        hl = rpr.makeelement(qn("w:highlight"), {})
        rpr.append(hl)
    hl.set(qn("w:val"), color)


def replace_span_text(span, new_text, drop_highlight=True):
    """Collapse ``span`` into its first run carrying ``new_text``.

    The first run keeps its ``w:rPr`` (font, size, bold...) so institutional
    formatting is preserved; remaining runs are removed. With
    ``drop_highlight`` the highlight mark is stripped, which is what turns a
    marked field into a clean ``{{placeholder}}``.
    """
    first = span.runs[0]
    set_run_text(first, new_text)
    if drop_highlight:
        rpr = first.find(qn("w:rPr"))
        if rpr is not None:
            hl = rpr.find(qn("w:highlight"))
            if hl is not None:
                rpr.remove(hl)
    parent = first.getparent()
    for run in span.runs[1:]:
        if run.getparent() is not None:
            parent.remove(run)
    span.runs = [first]
    span.text = new_text


def collect_page_geometry(document):
    """Audit of every ``w:sectPr``/``w:pgSz`` (size in twips + orientation)."""
    sections = []
    for sect_pr in document.element.iter(qn("w:sectPr")):
        pg_sz = sect_pr.find(qn("w:pgSz"))
        if pg_sz is None:
            continue
        sections.append(
            {
                "widthTwips": int(pg_sz.get(qn("w:w"))),
                "heightTwips": int(pg_sz.get(qn("w:h"))),
                "orientation": pg_sz.get(qn("w:orient")) or "portrait",
            }
        )
    return sections
