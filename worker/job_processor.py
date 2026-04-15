import concurrent.futures
import hashlib
import logging
import os
import shutil
import tempfile

from worker.docx_renderer import render_context_to_docx
from worker.kmz_renderer import render_context_to_kmz
from worker.logging_utils import timed_phase


logger = logging.getLogger("worker.job_processor")


DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
KMZ_CONTENT_TYPE = "application/vnd.google-earth.kmz"

DEFAULT_IMAGE_CONCURRENCY = 8


def normalize_text(value):
    return str(value or "").strip()


def _collect_media_asset_ids(context):
    """Walk o contexto coletando mediaAssetIds únicos de fotos do job.

    Cobre ``report_compound``, ``project_dossier`` e ``workspace_kmz``; o
    renderer de ``ficha_cadastro`` nao usa image_loader hoje. Mesmo que
    alguma seção nova seja esquecida aqui, o ``image_loader`` cacheado cai
    para download sincrono como fallback, entao isso e um best-effort para
    maximizar paralelismo sem quebrar nada.
    """

    found = set()
    render_model = context.get("renderModel") if isinstance(context, dict) else None
    if not isinstance(render_model, dict):
        return found

    def _add_photo_ids(photos):
        if not isinstance(photos, list):
            return
        for photo in photos:
            if not isinstance(photo, dict):
                continue
            if photo.get("includeInReport") is not True:
                continue
            media_id = normalize_text(photo.get("mediaAssetId"))
            if media_id:
                found.add(media_id)

    # report_compound: renderModel.workspaces[*].photos[*]
    workspaces = render_model.get("workspaces")
    if isinstance(workspaces, list):
        for bundle in workspaces:
            if isinstance(bundle, dict):
                _add_photo_ids(bundle.get("photos"))

    # project_dossier: renderModel.sections.photos[*]
    sections = render_model.get("sections")
    if isinstance(sections, dict):
        _add_photo_ids(sections.get("photos"))

    # workspace_kmz: renderModel.photos[*]
    _add_photo_ids(render_model.get("photos"))

    return found


def _prefetch_images(client, media_ids, job_id, max_workers=None):
    """Faz download paralelo das imagens e retorna dict[media_id] -> payload.

    Erros sao tolerados silenciosamente — media_ids que falham ficam fora do
    cache para que o ``image_loader`` cai para download sincrono e lide com
    o erro da forma atual (warning + placeholder de imagem indisponivel).
    """

    cache = {}
    if not media_ids:
        return cache

    limit = max_workers or int(os.getenv("WORKER_IMAGE_CONCURRENCY") or DEFAULT_IMAGE_CONCURRENCY)
    effective_workers = max(1, min(limit, len(media_ids)))

    def fetch(media_id):
        try:
            return media_id, client.download_media_content(media_id), None
        except Exception as exc:  # pragma: no cover - network errors vary
            return media_id, None, exc

    with timed_phase(
        logger,
        "prefetch_images",
        job_id=job_id,
        mediaCount=len(media_ids),
        workers=effective_workers,
    ):
        success = 0
        failed = 0
        with concurrent.futures.ThreadPoolExecutor(max_workers=effective_workers) as executor:
            futures = [executor.submit(fetch, media_id) for media_id in media_ids]
            for future in concurrent.futures.as_completed(futures):
                media_id, payload, error = future.result()
                if error is not None:
                    failed += 1
                    continue
                if payload is not None:
                    cache[media_id] = payload
                    success += 1

        logger.info(
            "prefetch_images_summary",
            extra={
                "phase": "prefetch_images",
                "jobId": job_id,
                "requested": len(media_ids),
                "succeeded": success,
                "failed": failed,
            },
        )

    return cache


def _build_cached_image_loader(client, cache):
    """Retorna um image_loader compativel com o renderer.

    Usa o cache populado por ``_prefetch_images``; se o media_id nao foi
    pre-carregado (ou falhou no prefetch), cai para download sincrono.
    """

    def loader(media_asset_id):
        cached = cache.get(media_asset_id)
        if cached is not None:
            return cached
        return client.download_media_content(media_asset_id)

    return loader


def build_staging_dir(job_id):
    return os.path.join(tempfile.gettempdir(), "geomonitor-worker", normalize_text(job_id) or "job")


def build_output_file_name(context):
    job = context.get("job") if isinstance(context, dict) else {}
    render_model = context.get("renderModel") if isinstance(context, dict) else {}
    kind = normalize_text(job.get("kind"))

    if kind == "project_dossier":
        dossier = render_model.get("dossier") if isinstance(render_model, dict) else {}
        project = context.get("project") if isinstance(context, dict) else {}
        project_id = normalize_text(project.get("id")) or "projeto"
        dossier_id = normalize_text(dossier.get("id")) or normalize_text(job.get("dossierId")) or "dossie"
        return f"dossie-{project_id}-{dossier_id}.docx"

    if kind == "report_compound":
        compound = render_model.get("compound") if isinstance(render_model, dict) else {}
        compound_id = normalize_text(compound.get("id")) or normalize_text(job.get("compoundId")) or "composto"
        return f"relatorio-composto-{compound_id}.docx"

    if kind == "workspace_kmz":
        workspace = render_model.get("workspace") if isinstance(render_model, dict) else {}
        workspace_kmz = render_model.get("workspaceKmz") if isinstance(render_model, dict) else {}
        workspace_id = normalize_text(workspace.get("id")) or normalize_text(job.get("workspaceId")) or "workspace"
        token = normalize_text(workspace_kmz.get("token")) or normalize_text(job.get("workspaceKmzToken")) or "kmz"
        return f"workspace-{workspace_id}-{token}.kmz"

    if kind == "ficha_cadastro":
        project = context.get("project") if isinstance(context, dict) else {}
        project_id = normalize_text(project.get("id")) or normalize_text(job.get("projectId")) or "projeto"
        return f"fichas-cadastro-erosao-{project_id}.docx"

    return f"relatorio-{normalize_text(job.get('id')) or 'job'}.docx"


def upload_output_media(client, job_id, file_name, content_type, purpose, content):
    with timed_phase(
        logger,
        "create_output_media",
        job_id=job_id,
        fileName=file_name,
        sizeBytes=len(content),
    ):
        media = client.create_output_media(
            job_id,
            file_name=file_name,
            content_type=content_type,
            size_bytes=len(content),
            purpose=purpose,
        )

    upload_descriptor = media.get("upload") if isinstance(media, dict) else None
    media_id = normalize_text((media or {}).get("id"))
    if not upload_descriptor or not media_id:
        raise RuntimeError(f"A API nao retornou dados validos de upload para o job '{job_id}'.")

    with timed_phase(
        logger,
        "upload_media_binary",
        job_id=job_id,
        mediaId=media_id,
        sizeBytes=len(content),
    ):
        client.upload_media_binary(upload_descriptor, content, content_type)

    sha256 = hashlib.sha256(content).hexdigest()
    with timed_phase(
        logger,
        "complete_media_upload",
        job_id=job_id,
        mediaId=media_id,
    ):
        client.complete_media_upload(
            media_id,
            stored_size_bytes=len(content),
            sha256=sha256,
        )
    return media_id


def process_docx_job(client, job_id, context, staging_dir):
    file_name = build_output_file_name(context)
    output_path = os.path.join(staging_dir, file_name)

    media_ids = _collect_media_asset_ids(context)
    image_cache = _prefetch_images(client, media_ids, job_id)
    image_loader = _build_cached_image_loader(client, image_cache)

    with timed_phase(logger, "render_docx", job_id=job_id, fileName=file_name):
        render_context_to_docx(context, output_path, image_loader)

    with timed_phase(logger, "read_output", job_id=job_id, path=output_path):
        with open(output_path, "rb") as handle:
            content = handle.read()

    if not content:
        return {
            "status": "failed",
            "errorLog": f"O arquivo DOCX gerado para '{job_id}' ficou vazio.",
        }

    with timed_phase(logger, "upload_output", job_id=job_id, sizeBytes=len(content)):
        media_id = upload_output_media(
            client,
            job_id,
            file_name=file_name,
            content_type=DOCX_CONTENT_TYPE,
            purpose="report_output_docx",
            content=content,
        )

    return {
        "status": "completed",
        "outputDocxMediaId": media_id,
    }


def process_workspace_kmz_job(client, job_id, context, staging_dir):
    file_name = build_output_file_name(context)
    output_path = os.path.join(staging_dir, file_name)

    media_ids = _collect_media_asset_ids(context)
    image_cache = _prefetch_images(client, media_ids, job_id)
    image_loader = _build_cached_image_loader(client, image_cache)

    with timed_phase(logger, "render_kmz", job_id=job_id, fileName=file_name):
        render_context_to_kmz(context, output_path, image_loader)

    with timed_phase(logger, "read_output", job_id=job_id, path=output_path):
        with open(output_path, "rb") as handle:
            content = handle.read()

    if not content:
        return {
            "status": "failed",
            "errorLog": f"O arquivo KMZ gerado para '{job_id}' ficou vazio.",
        }

    with timed_phase(logger, "upload_output", job_id=job_id, sizeBytes=len(content)):
        media_id = upload_output_media(
            client,
            job_id,
            file_name=file_name,
            content_type=KMZ_CONTENT_TYPE,
            purpose="report_output_kmz",
            content=content,
        )

    return {
        "status": "completed",
        "outputKmzMediaId": media_id,
    }


def process_claimed_job(client, job):
    job_id = normalize_text(job.get("id")) or "unknown-job"
    staging_dir = build_staging_dir(job_id)
    output_path = ""

    with timed_phase(logger, "job_total", job_id=job_id):
        try:
            with timed_phase(logger, "get_context", job_id=job_id):
                context = client.get_job_context(job_id)
            if not isinstance(context, dict) or not isinstance(context.get("job"), dict):
                return {
                    "status": "failed",
                    "errorLog": f"Contexto invalido para o job '{job_id}'.",
                }

            os.makedirs(staging_dir, exist_ok=True)
            output_path = os.path.join(staging_dir, build_output_file_name(context))
            kind = normalize_text(context.get("job", {}).get("kind"))

            if kind in {"project_dossier", "report_compound", "ficha_cadastro"}:
                return process_docx_job(client, job_id, context, staging_dir)

            if kind == "workspace_kmz":
                return process_workspace_kmz_job(client, job_id, context, staging_dir)

            return {
                "status": "failed",
                "errorLog": f"Tipo de job nao suportado pelo worker: '{kind or 'desconhecido'}'.",
            }
        finally:
            if output_path or os.path.isdir(staging_dir):
                shutil.rmtree(staging_dir, ignore_errors=True)
