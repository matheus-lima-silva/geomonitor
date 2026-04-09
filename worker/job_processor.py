import hashlib
import os
import shutil
import tempfile

from worker.docx_renderer import render_context_to_docx
from worker.kmz_renderer import render_context_to_kmz


DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
KMZ_CONTENT_TYPE = "application/vnd.google-earth.kmz"


def normalize_text(value):
    return str(value or "").strip()


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

    client.upload_media_binary(upload_descriptor, content, content_type)
    sha256 = hashlib.sha256(content).hexdigest()
    client.complete_media_upload(
        media_id,
        stored_size_bytes=len(content),
        sha256=sha256,
    )
    return media_id


def process_docx_job(client, job_id, context, staging_dir):
    file_name = build_output_file_name(context)
    output_path = os.path.join(staging_dir, file_name)

    render_context_to_docx(
        context,
        output_path,
        lambda media_asset_id: client.download_media_content(media_asset_id),
    )

    with open(output_path, "rb") as handle:
        content = handle.read()

    if not content:
        return {
            "status": "failed",
            "errorLog": f"O arquivo DOCX gerado para '{job_id}' ficou vazio.",
        }

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

    render_context_to_kmz(
        context,
        output_path,
        lambda media_asset_id: client.download_media_content(media_asset_id),
    )

    with open(output_path, "rb") as handle:
        content = handle.read()

    if not content:
        return {
            "status": "failed",
            "errorLog": f"O arquivo KMZ gerado para '{job_id}' ficou vazio.",
        }

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

    try:
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
