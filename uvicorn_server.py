from pathlib import Path
from mimetypes import guess_type

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

BASE_DIR = Path(__file__).resolve().parent

app = FastAPI(title="GeoMonitor Legacy app.html Server")


@app.get("/")
def serve_app_html() -> FileResponse:
    app_file = BASE_DIR / "app.html"
    if not app_file.exists():
        raise HTTPException(status_code=404, detail="app.html not found")
    return FileResponse(app_file)


@app.get("/{file_path:path}")
def serve_root_file(file_path: str) -> FileResponse:
    requested = (BASE_DIR / file_path).resolve()

    # Keep requests restricted to the project root.
    if BASE_DIR not in requested.parents and requested != BASE_DIR:
        raise HTTPException(status_code=403, detail="Forbidden path")

    if not requested.exists() or requested.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    media_type, _ = guess_type(str(requested))
    return FileResponse(requested, media_type=media_type)