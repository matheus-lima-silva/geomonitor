import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, HintText, Input, Select, Textarea } from '../../../components/ui';
import { subscribeProjects } from '../../../services/projectService';
import { listProjectDossiers, createProjectDossier } from '../../../services/projectDossierService';
import { listProjectPhotos, requestProjectPhotoExport } from '../../../services/projectPhotoLibraryService';
import { subscribeReportCompounds, createReportCompound } from '../../../services/reportCompoundService';
import { completeMediaUpload, createMediaUpload, uploadMediaBinary } from '../../../services/mediaService';
import {
  createReportWorkspace,
  importReportWorkspace,
  saveReportWorkspacePhoto,
  subscribeReportWorkspaces,
} from '../../../services/reportWorkspaceService';

const TABS = [
  ['workspaces', 'Workspaces', 'file-text'],
  ['library', 'Biblioteca do Empreendimento', 'search'],
  ['dossier', 'Dossie do Empreendimento', 'clipboard'],
  ['compounds', 'Relatorios Compostos', 'details'],
];

const STEPS = [
  ['Empreendimento', 'Cada workspace pertence a um unico empreendimento.'],
  ['Importacao', 'Aceita fotos soltas, subpastas por torre e KMZ organizado.'],
  ['Curadoria', 'Legenda, torre e inclusao da foto sao decididas aqui.'],
  ['Textos', 'Os textos-base do empreendimento viram um rascunho do workspace.'],
  ['Preflight', 'Valida foto, torre, legenda e consistencia.'],
  ['Geracao', 'DOCX e KMZ entram na trilha do worker.'],
];

function fmt(value) {
  return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

function tone(status) {
  const value = String(status || '').toLowerCase();
  if (value.includes('queued') || value.includes('process')) return 'bg-amber-100 text-amber-700';
  if (value.includes('ready') || value.includes('done') || value.includes('ativo')) return 'bg-emerald-100 text-emerald-700';
  if (value.includes('error') || value.includes('fail')) return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-600';
}

export default function ReportsView({ userEmail = '', showToast = () => {} }) {
  const [tab, setTab] = useState('workspaces');
  const [projects, setProjects] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [compounds, setCompounds] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectPhotos, setProjectPhotos] = useState([]);
  const [projectDossiers, setProjectDossiers] = useState([]);
  const [workspaceDraft, setWorkspaceDraft] = useState({ projectId: '', nome: '', descricao: '' });
  const [dossierDraft, setDossierDraft] = useState({ nome: '', observacoes: '' });
  const [compoundDraft, setCompoundDraft] = useState({ nome: '', texto: '' });
  const [workspaceImportTargetId, setWorkspaceImportTargetId] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const [busy, setBusy] = useState('');

  useEffect(() => subscribeReportWorkspaces((rows) => setWorkspaces(rows || []), () => showToast('Erro ao carregar workspaces.', 'error')), [showToast]);
  useEffect(() => subscribeProjects((rows) => setProjects(rows || []), () => showToast('Erro ao carregar empreendimentos.', 'error')), [showToast]);
  useEffect(() => subscribeReportCompounds((rows) => setCompounds(rows || []), () => showToast('Erro ao carregar compostos.', 'error')), [showToast]);

  useEffect(() => {
    if (projects.length === 0) return;
    const fallbackId = String(projects[0]?.id || '');
    if (!selectedProjectId) setSelectedProjectId(fallbackId);
    if (!workspaceDraft.projectId) setWorkspaceDraft((prev) => ({ ...prev, projectId: fallbackId }));
  }, [projects, selectedProjectId, workspaceDraft.projectId]);

  useEffect(() => {
    const candidates = workspaces.filter((workspace) => !selectedProjectId || workspace.projectId === selectedProjectId);
    const fallbackId = String(candidates[0]?.id || workspaces[0]?.id || '');
    if (!workspaceImportTargetId || !candidates.some((workspace) => workspace.id === workspaceImportTargetId)) {
      setWorkspaceImportTargetId(fallbackId);
    }
  }, [selectedProjectId, workspaceImportTargetId, workspaces]);

  useEffect(() => {
    if (!selectedProjectId) return;
    let cancelled = false;
    Promise.all([listProjectPhotos(selectedProjectId), listProjectDossiers(selectedProjectId)])
      .then(([photos, dossiers]) => {
        if (cancelled) return;
        setProjectPhotos(Array.isArray(photos) ? photos : []);
        setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
      })
      .catch((error) => !cancelled && showToast(error?.message || 'Erro ao carregar dados do empreendimento.', 'error'));
    return () => { cancelled = true; };
  }, [selectedProjectId, showToast]);

  const metrics = useMemo(() => ({
    total: projectPhotos.length,
    included: projectPhotos.filter((photo) => photo.includeInReport).length,
    missingCaption: projectPhotos.filter((photo) => !String(photo.caption || '').trim()).length,
    missingTower: projectPhotos.filter((photo) => !String(photo.towerId || '').trim()).length,
  }), [projectPhotos]);

  const workspaceCandidates = useMemo(
    () => workspaces.filter((workspace) => !selectedProjectId || workspace.projectId === selectedProjectId),
    [selectedProjectId, workspaces],
  );

  async function handleCreateWorkspace() {
    if (!workspaceDraft.projectId || !String(workspaceDraft.nome || '').trim()) {
      showToast('Selecione um empreendimento e informe um nome para o workspace.', 'error');
      return;
    }
    try {
      setBusy('workspace');
      await createReportWorkspace({
        id: `RW-${Date.now()}`,
        projectId: workspaceDraft.projectId,
        nome: workspaceDraft.nome.trim(),
        descricao: String(workspaceDraft.descricao || '').trim(),
        status: 'draft',
        slots: [],
        draftState: { autosave: 'pending' },
      }, { updatedBy: userEmail || 'web' });
      setWorkspaceDraft((prev) => ({ ...prev, nome: '', descricao: '' }));
      showToast('Workspace criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCreateDossier() {
    if (!selectedProjectId || !String(dossierDraft.nome || '').trim()) {
      showToast('Selecione um empreendimento e informe um nome para o dossie.', 'error');
      return;
    }
    try {
      setBusy('dossier');
      await createProjectDossier(selectedProjectId, {
        nome: dossierDraft.nome.trim(),
        observacoes: String(dossierDraft.observacoes || '').trim(),
        scopeJson: { includeFotos: true, includeInspecoes: true, includeErosoes: true },
        draftState: { autosave: 'pending' },
      }, { updatedBy: userEmail || 'web' });
      setDossierDraft({ nome: '', observacoes: '' });
      const dossiers = await listProjectDossiers(selectedProjectId);
      setProjectDossiers(Array.isArray(dossiers) ? dossiers : []);
      showToast('Dossie criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar dossie.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleCreateCompound() {
    if (!String(compoundDraft.nome || '').trim()) {
      showToast('Informe um nome para o relatorio composto.', 'error');
      return;
    }
    try {
      setBusy('compound');
      await createReportCompound({
        id: `RC-${Date.now()}`,
        nome: compoundDraft.nome.trim(),
        sharedTextsJson: { introducao: String(compoundDraft.texto || '').trim() },
        status: 'draft',
        workspaceIds: [],
        orderJson: [],
      }, { updatedBy: userEmail || 'web' });
      setCompoundDraft({ nome: '', texto: '' });
      showToast('Relatorio composto criado.', 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao criar relatorio composto.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handlePhotoExport() {
    if (!selectedProjectId) {
      showToast('Selecione um empreendimento para exportar as fotos.', 'error');
      return;
    }
    try {
      setBusy('export');
      const result = await requestProjectPhotoExport(selectedProjectId, {
        folderMode: 'tower',
        filters: { includedOnly: false },
      }, { updatedBy: userEmail || 'web' });
      showToast(`Exportacao solicitada para ${result?.data?.itemCount || 0} foto(s).`, 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao solicitar exportacao.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleUploadLoosePhotos() {
    if (!workspaceImportTargetId) {
      showToast('Selecione um workspace para importar as fotos.', 'error');
      return;
    }
    if (pendingFiles.length === 0) {
      showToast('Selecione ao menos uma foto para importar.', 'error');
      return;
    }

    const workspace = workspaces.find((item) => item.id === workspaceImportTargetId);
    if (!workspace) {
      showToast('Workspace alvo nao encontrado.', 'error');
      return;
    }

    try {
      setBusy('workspace-upload');
      const uploadedMediaIds = [];

      for (const [index, file] of pendingFiles.entries()) {
        const createResult = await createMediaUpload({
          fileName: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          purpose: 'workspace-photo',
          linkedResourceType: 'reportWorkspaces',
          linkedResourceId: workspace.id,
        }, { updatedBy: userEmail || 'web' });

        const mediaAsset = createResult?.data;
        await uploadMediaBinary(mediaAsset?.upload, file);
        await completeMediaUpload({
          id: mediaAsset?.id,
          storedSizeBytes: file.size,
        }, { updatedBy: userEmail || 'web' });

        const photoId = `RPH-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`;
        const defaultCaption = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();

        await saveReportWorkspacePhoto(workspace.id, photoId, {
          mediaAssetId: mediaAsset?.id,
          caption: defaultCaption,
          includeInReport: false,
          curationStatus: 'uploaded',
          importSource: 'loose_photos',
          towerSource: 'pending',
        }, { updatedBy: userEmail || 'web' });

        uploadedMediaIds.push(mediaAsset?.id);
      }

      await importReportWorkspace(workspace.id, {
        sourceType: 'loose_photos',
        importSource: 'loose_photos',
        warnings: [],
        summaryJson: {
          filesReceived: pendingFiles.length,
          uploadedMediaIds,
        },
      }, { updatedBy: userEmail || 'web' });

      if (workspace.projectId) {
        const photos = await listProjectPhotos(workspace.projectId);
        setProjectPhotos(Array.isArray(photos) ? photos : []);
        if (!selectedProjectId) {
          setSelectedProjectId(workspace.projectId);
        }
      }

      setPendingFiles([]);
      showToast(`Upload concluido para ${uploadedMediaIds.length} foto(s).`, 'success');
    } catch (error) {
      showToast(error?.message || 'Erro ao importar fotos para o workspace.', 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="flex flex-col gap-5 p-2">
      <div>
        <h2 className="m-0 flex items-center gap-2 text-xl font-bold text-slate-800"><AppIcon name="file-text" />Relatorios</h2>
        <p className="mt-1 text-sm text-slate-500">O modulo passa a separar workspaces, biblioteca agregada de fotos, dossies por empreendimento e relatorios compostos.</p>
      </div>

      <Card variant="nested" className="flex flex-wrap gap-2">
        {TABS.map(([id, label, icon]) => (
          <Button key={id} size="sm" variant={tab === id ? 'primary' : 'outline'} onClick={() => setTab(id)}>
            <AppIcon name={icon} />
            {label}
          </Button>
        ))}
      </Card>

      {tab === 'workspaces' ? (
        <>
          <Card variant="nested">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800">
              <span>Fluxo do Workspace</span>
              <HintText label="Fluxo do workspace">O fluxo guiado substitui a logica dispersa e prepara curadoria, textos, preflight e geracao.</HintText>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-6">
              {STEPS.map(([label, hint], index) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <div className="mb-1 flex items-center gap-2 text-2xs font-bold uppercase tracking-wide text-slate-500">
                    <span>Etapa {index + 1}</span>
                    <HintText label={label}>{hint}</HintText>
                  </div>
                  <strong>{label}</strong>
                </div>
              ))}
            </div>
          </Card>

          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select id="rw-project" label="Empreendimento" hint="Toda inferencia espacial acontece dentro do empreendimento selecionado." value={workspaceDraft.projectId} onChange={(event) => { setWorkspaceDraft((prev) => ({ ...prev, projectId: event.target.value })); setSelectedProjectId(event.target.value); }}>
              <option value="">Selecione...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome || project.id}</option>)}
            </Select>
            <Input id="rw-name" label="Nome" value={workspaceDraft.nome} onChange={(event) => setWorkspaceDraft((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex: RT LT Norte - Abril" />
            <Input id="rw-desc" label="Descricao" hint="Os textos-base do empreendimento serao copiados para um rascunho editavel." value={workspaceDraft.descricao} onChange={(event) => setWorkspaceDraft((prev) => ({ ...prev, descricao: event.target.value }))} placeholder="Escopo, periodo ou observacoes" />
            <div className="md:col-span-3 flex justify-end">
              <Button onClick={handleCreateWorkspace} disabled={busy === 'workspace'}><AppIcon name="plus" />{busy === 'workspace' ? 'Criando...' : 'Criar Workspace'}</Button>
            </div>
          </Card>

          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select id="rw-import-target" label="Workspace Alvo" hint="Primeira trilha real do modulo: importar fotos soltas para um workspace existente." value={workspaceImportTargetId} onChange={(event) => setWorkspaceImportTargetId(event.target.value)}>
              <option value="">Selecione...</option>
              {workspaceCandidates.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.nome || workspace.id}</option>)}
            </Select>
            <Input id="rw-import-files" label="Fotos Soltas" hint="O upload usa URL assinada quando MEDIA_BACKEND=tigris e fallback local em desenvolvimento." type="file" accept="image/*" multiple onChange={(event) => setPendingFiles(Array.from(event.target.files || []))} />
            <div className="flex items-end justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs text-slate-500">
                <div className="font-bold uppercase tracking-wide text-slate-600">Selecao Atual</div>
                <div>{pendingFiles.length} arquivo(s) pronto(s) para envio.</div>
              </div>
              <Button onClick={handleUploadLoosePhotos} disabled={busy === 'workspace-upload' || !workspaceImportTargetId || pendingFiles.length === 0}>
                <AppIcon name="save" />
                {busy === 'workspace-upload' ? 'Enviando...' : 'Importar Fotos Soltas'}
              </Button>
            </div>
          </Card>

          <Card variant="nested" className="flex flex-col gap-3">
            {workspaces.map((workspace) => (
              <article key={workspace.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{workspace.nome || workspace.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">{workspace.descricao || 'Sem descricao'}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(workspace.status)}`}>{workspace.status || 'draft'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-500">
                  <span>Empreendimento: {workspace.projectId || '-'}</span>
                  <span>Slots: {Array.isArray(workspace.slots) ? workspace.slots.length : 0}</span>
                  <span>Atualizado: {fmt(workspace.updatedAt)}</span>
                </div>
              </article>
            ))}
            {workspaces.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum workspace criado ainda.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'library' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
            <Select id="library-project" label="Empreendimento" hint="A biblioteca cruza todas as fotos do empreendimento, nao apenas as de um workspace." value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Selecione...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome || project.id}</option>)}
            </Select>
            <div className="flex items-end"><Button variant="outline" onClick={handlePhotoExport} disabled={busy === 'export' || !selectedProjectId}><AppIcon name="save" />{busy === 'export' ? 'Solicitando...' : 'Baixar Tudo Filtrado'}</Button></div>
          </Card>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card variant="nested"><strong className="text-slate-800">{metrics.total}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Fotos agregadas</p></Card>
            <Card variant="nested"><strong className="text-slate-800">{metrics.included}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Incluidas</p></Card>
            <Card variant="nested"><strong className="text-slate-800">{metrics.missingCaption}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Sem legenda</p></Card>
            <Card variant="nested"><strong className="text-slate-800">{metrics.missingTower}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Sem torre</p></Card>
          </div>
          <Card variant="nested" className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
              <span>Biblioteca agregada</span>
              <HintText label="Biblioteca agregada">O download total ou parcial sera entregue como ZIP efemero, sem persistencia duravel.</HintText>
            </div>
            {projectPhotos.map((photo) => (
              <article key={photo.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <strong className="text-slate-800">{photo.id}</strong>
                <p className="mt-1 mb-0 text-xs text-slate-500">{photo.caption || 'Sem legenda ainda'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-1">Torre: {photo.towerId || '-'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Workspace: {photo.workspaceId || '-'}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1">Origem: {photo.importSource || '-'}</span>
                </div>
              </article>
            ))}
            {selectedProjectId && projectPhotos.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhuma foto agregada encontrada para este empreendimento.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'dossier' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select id="dossier-project" label="Empreendimento" hint="O dossie consolida dados operacionais de um unico empreendimento." value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="">Selecione...</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.id} - {project.nome || project.id}</option>)}
            </Select>
            <Input id="dossier-name" label="Nome do Dossie" value={dossierDraft.nome} onChange={(event) => setDossierDraft((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex: Dossie operacional" />
            <Textarea id="dossier-notes" label="Observacoes" hint="O dossie tera seu proprio rascunho persistido, independente do workspace." rows={2} value={dossierDraft.observacoes} onChange={(event) => setDossierDraft((prev) => ({ ...prev, observacoes: event.target.value }))} />
            <div className="md:col-span-3 flex justify-end"><Button onClick={handleCreateDossier} disabled={busy === 'dossier' || !selectedProjectId}><AppIcon name="plus" />{busy === 'dossier' ? 'Criando...' : 'Criar Dossie'}</Button></div>
          </Card>
          <Card variant="nested" className="flex flex-col gap-3">
            {projectDossiers.map((dossier) => (
              <article key={dossier.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{dossier.nome || dossier.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">{dossier.observacoes || 'Sem observacoes'}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(dossier.status)}`}>{dossier.status || 'draft'}</span>
                </div>
              </article>
            ))}
            {selectedProjectId && projectDossiers.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum dossie criado ainda para este empreendimento.</div> : null}
          </Card>
        </>
      ) : null}

      {tab === 'compounds' ? (
        <>
          <Card variant="nested" className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input id="compound-name" label="Nome" value={compoundDraft.nome} onChange={(event) => setCompoundDraft((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex: Consolidado trimestral" />
            <Textarea id="compound-text" label="Texto Global" hint="Esse texto e do relatorio composto e nao sobrescreve os workspaces filhos." rows={2} value={compoundDraft.texto} onChange={(event) => setCompoundDraft((prev) => ({ ...prev, texto: event.target.value }))} />
            <div className="md:col-span-2 flex justify-end"><Button onClick={handleCreateCompound} disabled={busy === 'compound'}><AppIcon name="plus" />{busy === 'compound' ? 'Criando...' : 'Criar Relatorio Composto'}</Button></div>
          </Card>
          <Card variant="nested" className="flex flex-col gap-3">
            {compounds.map((compound) => (
              <article key={compound.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div><strong className="text-slate-800">{compound.nome || compound.id}</strong><p className="mt-1 mb-0 text-xs text-slate-500">Workspaces: {Array.isArray(compound.workspaceIds) ? compound.workspaceIds.length : 0}</p></div>
                  <span className={`rounded-full px-2 py-1 text-xs ${tone(compound.status)}`}>{compound.status || 'draft'}</span>
                </div>
                <div className="mt-3 text-xs text-slate-500">Atualizado: {fmt(compound.updatedAt)}</div>
              </article>
            ))}
            {compounds.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">Nenhum relatorio composto criado ainda.</div> : null}
          </Card>
        </>
      ) : null}
    </section>
  );
}
