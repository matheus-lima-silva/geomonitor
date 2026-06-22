import { useRef, useState } from 'react';
import { Button, Card, Input, IconButton, EmptyState } from '@app/components/ui';
import AppIcon from '@app/components/AppIcon';
import { useToast } from '@app/context/ToastContext';
import { triggerBlobDownload } from '@app/features/reports/utils/reportUtils';

import { usePhotosKmz } from './hooks/usePhotosKmz';

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

/**
 * Modulo "Geo - Fotos para KMZ" do Portal de Relatorios.
 *
 * Ferramenta standalone: recebe um lote de fotos, le a coordenada GPS do EXIF de
 * cada uma no proprio navegador e empacota um KMZ com os marcadores. Nao toca
 * backend/worker/MinIO — nada e enviado nem persistido.
 */
export default function GeoPhotosKmzPage({ onExit }) {
  const toast = useToast();
  const { files, addFiles, removeFile, clear, generating, progress, generate } = usePhotosKmz();
  const [title, setTitle] = useState('Fotos');
  const [summary, setSummary] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);
  const folderInputRef = useRef(null);

  function handleSelect(event) {
    const count = addFiles(event.target.files);
    setSummary(null);
    if (!count) {
      toast.show('Nenhum arquivo de imagem reconhecido na seleção.', 'info');
    }
    // Permite reselecionar os mesmos arquivos depois (onChange so dispara se mudar).
    event.target.value = '';
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragActive(false);
    const count = addFiles(event.dataTransfer?.files);
    setSummary(null);
    if (!count) {
      toast.show('Solte apenas arquivos de imagem.', 'info');
    }
  }

  async function handleGenerate() {
    try {
      const result = await generate(title);
      if (!result) return;
      setSummary({ markerCount: result.markerCount, skipped: result.skipped });
      const downloaded = triggerBlobDownload(result.fileName, result.blob);
      const skippedNote = result.skipped.length ? ` ${result.skipped.length} sem GPS ignorada(s).` : '';
      toast.show(
        downloaded
          ? `KMZ gerado com ${result.markerCount} marcador(es).${skippedNote}`
          : 'KMZ gerado, mas o download não pôde iniciar neste navegador.',
        downloaded ? 'success' : 'error',
      );
    } catch (err) {
      setSummary(null);
      toast.show(err?.message || 'Falha ao gerar o KMZ.', 'error');
    }
  }

  const progressPct = progress && progress.total
    ? Math.round((progress.processed / progress.total) * 100)
    : 0;

  return (
    <main className="min-h-screen bg-app-bg">
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <IconButton
            variant="ghost"
            size="md"
            aria-label="Voltar ao portal"
            onClick={onExit}
          >
            <AppIcon name="chevron-left" className="w-5 h-5" aria-hidden="true" />
          </IconButton>
          <div>
            <h1 className="text-lg font-semibold text-slate-800 m-0">Geo · Fotos para KMZ</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              As fotos não saem do seu navegador — o KMZ é montado localmente.
            </p>
          </div>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <Input
              id="geo-kmz-title"
              label="Título do KMZ"
              hint="Vira o nome do documento dentro do Google Earth e a base do arquivo baixado."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Fotos"
            />

            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  inputRef.current?.click();
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                dragActive ? 'border-brand-500 bg-brand-50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
              }`}
            >
              <AppIcon name="upload" className="w-6 h-6 text-brand-600" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">
                Arraste fotos aqui ou clique para selecionar
              </p>
              <p className="text-xs text-slate-500">
                JPEG com GPS no EXIF viram marcadores. Tudo roda offline.
              </p>
              <input
                ref={inputRef}
                id="geo-kmz-files"
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={handleSelect}
              />
            </div>

            <div className="flex flex-col items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => folderInputRef.current?.click()}
              >
                <AppIcon name="folder" className="w-4 h-4" aria-hidden="true" />
                Selecionar pasta
              </Button>
              <p className="text-xs text-slate-400 text-center">
                Coleta todas as fotos da pasta, incluindo subpastas.
              </p>
              {/* webkitdirectory faz o browser devolver a arvore inteira (recursivo). */}
              <input
                ref={folderInputRef}
                id="geo-kmz-folder"
                type="file"
                accept="image/*"
                multiple
                webkitdirectory=""
                directory=""
                className="sr-only"
                onChange={handleSelect}
              />
            </div>

            {files.length > 0 ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-700 m-0">
                    {files.length} foto(s) selecionada(s)
                  </p>
                  <Button variant="ghost" size="sm" onClick={clear} disabled={generating}>
                    Limpar
                  </Button>
                </div>
                <ul className="max-h-56 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
                  {files.map((file) => (
                    <li
                      key={`${file.webkitRelativePath || file.name}-${file.size}-${file.lastModified}`}
                      className="flex items-center justify-between gap-3 px-3 py-2"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <AppIcon name="image" className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                        <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-slate-400">{formatBytes(file.size)}</span>
                        <IconButton
                          variant="dangerGhost"
                          size="sm"
                          aria-label={`Remover ${file.name}`}
                          onClick={() => removeFile(file)}
                          disabled={generating}
                        >
                          <AppIcon name="close" className="w-4 h-4" aria-hidden="true" />
                        </IconButton>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <EmptyState
                icon="image"
                title="Nenhuma foto selecionada"
                description="Selecione um lote de fotos geotagueadas para gerar o KMZ."
              />
            )}

            {generating && progress ? (
              <div className="flex flex-col gap-1" aria-live="polite">
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-150"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Processando {progress.processed}/{progress.total} foto(s)…
                </p>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={handleGenerate}
                disabled={!files.length || generating}
              >
                <AppIcon name="download" className="w-4 h-4" aria-hidden="true" />
                {generating ? 'Gerando…' : 'Gerar KMZ'}
              </Button>
            </div>
          </div>
        </Card>

        {summary ? (
          <Card className="mt-4" variant="nested">
            <h2 className="text-sm font-semibold text-slate-800 m-0">Último KMZ gerado</h2>
            <p className="text-sm text-slate-600 mt-1">
              {summary.markerCount} marcador(es) criado(s).
            </p>
            {summary.skipped.length > 0 ? (
              <div className="mt-2">
                <p className="text-sm text-warning font-medium m-0">
                  {summary.skipped.length} foto(s) sem GPS (não entraram no mapa):
                </p>
                <ul className="mt-1 list-disc list-inside text-sm text-slate-500 max-h-32 overflow-y-auto">
                  {summary.skipped.map((name) => (
                    <li key={name} className="truncate">{name}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        ) : null}
      </div>
    </main>
  );
}
