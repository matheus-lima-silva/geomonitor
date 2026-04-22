# Modulo de Relatorios (Workspaces, Compounds, Lixeira e Arquivo)

Este documento cobre o pipeline de producao de relatorios tecnicos no GeoMonitor: desde o upload de fotos e KMZ ate a geracao de DOCX versionado e imutavel. Para a API HTTP correspondente, ver [api-backend.md](api-backend.md).

## Visao geral

O modulo e estruturado em tres niveis:

1. **Workspace** ([`report_workspaces`](../backend/migrations/0002_reporting_scaffold.sql)) — unidade de trabalho de uma campanha de vistoria. Contem fotos, curadoria, import KMZ e textos. Tem um `project_id` obrigatorio e um `inspection_id` opcional (vinculo com uma vistoria especifica).
2. **Compound** ([`report_compounds`](../backend/migrations/0002_reporting_scaffold.sql)) — agrupamento de multiplos workspaces em um relatorio composto unico. Define ordem, textos compartilhados e template.
3. **Archive** ([`report_archives`](../backend/migrations/0010_report_archives.sql)) — entrega versionada e imutavel do compound, com hashes SHA256.

Em paralelo existem os **Dossies de Projeto** ([`project_dossiers`](../backend/migrations/0002_reporting_scaffold.sql)), que compilam licencas, erosoes e workspaces de um projeto em um documento para auditoria. O pipeline tecnico de execucao (fila, worker, templates) e compartilhado.

---

## Pipeline de uma entrega

```
Upload signed URL       KMZ process           Curadoria         Compound + template
  (media_assets)   →    (report_photos)   →   (tower_id,    →   (compose DOCX)
                                               caption,
                                               include_in_
                                               report)
                                                                        ↓
                                                              Archive imutavel
                                                              (report_archives, v1, v2, ...)
```

1. Usuario cria o workspace (`POST /api/report-workspaces`) e vira `owner`.
2. Upload do KMZ via signed URL (`POST /api/media/upload-url` → PUT no S3/Tigris → `POST /api/media/complete`).
3. Processamento do KMZ (`POST /api/report-workspaces/:id/kmz/process`): extrai fotos, faz parse do KML, infere `tower_id` por coordenadas (raio configuravel em `project_report_defaults`) e cria entradas em `report_photos`.
4. Curadoria manual: `PUT /api/report-workspaces/:id/photos/:photoId` ajusta `caption`, `tower_id`, `include_in_report`. O frontend persiste `drafts` locais em `localStorage` ate o usuario confirmar.
5. Composicao: `POST /api/report-compounds` agrega workspaces. `/generate` enfileira um `report_job` com kind `report_compound` consumido pelo worker.
6. Entrega: o DOCX gerado vira `media_asset` com `purpose = 'report_compound_output'`; a operacao de entrega registra um `report_archives.v{N}` apontando para esse asset e opcionalmente um `delivered_media_id` distinto (PDF assinado final).

---

## Ciclo de vida da foto

Tabela `report_photos` usa dois timestamps para modelar tres estados (definidos em [0011_photo_archive.sql](../backend/migrations/0011_photo_archive.sql)):

| Estado | `deleted_at` | `archived_at` |
|---|---|---|
| ativa | `NULL` | `NULL` |
| lixeira | `NOT NULL` | `NULL` |
| arquivada | qualquer | `NOT NULL` |

### Transicoes suportadas

```
    ativa  ──trash──▶  lixeira  ──archive──▶  arquivada
      ▲                    │                       │
      │                    ▼                       │
      └─────restore────────┘                       │
                                                   │
                       lixeira  ◀──unarchive───────┘
```

- **ativa → lixeira** — `POST .../photos/:photoId/trash`. Soft delete; a foto deixa de aparecer em listagens padrao e pode ser restaurada.
- **lixeira → ativa** — `POST .../photos/:photoId/restore`.
- **lixeira → arquivada** — `POST .../photos/:photoId/archive`. So aceita fotos atualmente na lixeira. O arquivo imutavel serve como registro historico.
- **arquivada → lixeira** — `POST .../photos/:photoId/unarchive-to-trash`. Nao existe transicao direta `arquivada → ativa` — o operador precisa devolver para a lixeira e restaurar.
- **Purga definitiva** — `DELETE .../photos/:photoId` remove a linha e o `media_asset` associado.

### Retencao e arquivamento em lote

A lixeira oferece dois caminhos de arquivamento em lote, ambos em [TrashExpandedModal.jsx](../src/features/reports/components/TrashExpandedModal.jsx):

- `POST /api/report-workspaces/:id/photos/archive-trash-older-than` recebe `{ olderThanDays: N }` e arquiva em lote todas as fotos com `deleted_at < NOW() - N days`. UI: botao "Arquivar antigas (N)" (banner amber), aparece quando ha fotos elegiveis. Limiar default `OLD_THRESHOLD_DAYS = 30`.
- `POST /api/report-workspaces/:id/photos/archive-all-trash` arquiva **todas** as fotos da lixeira agora, sem filtro de idade. UI: botao "Arquivar todas" no rodape da lixeira, ao lado de "Esvaziar lixeira". Reversivel individualmente via `POST .../photos/:photoId/unarchive-to-trash`.

---

## Lixeira (Trash)

Componente principal: [src/features/reports/components/TrashExpandedModal.jsx](../src/features/reports/components/TrashExpandedModal.jsx).

### Paginacao e agrupamento

- Constantes: `PAGE_SIZE = 24` (default), `PAGE_SIZE_OPTIONS = [12, 24, 48, 96]`.
- Agrupamento por torre: usa `groupPhotosByTower()` em `reportUtils.js`. Fotos sem `tower_id` ficam em um bucket `__none__`.
- Filtro por torre: dropdown no modal permite isolar uma torre e aplicar operacoes em lote.
- Restore/archive/empty selecionam por pagina visivel ou por torre filtrada.

### Endpoints relacionados

| Acao | Endpoint |
|---|---|
| Listar lixeira | `GET /api/report-workspaces/:id/photos/trash` |
| Restaurar foto | `POST .../photos/:photoId/restore` |
| Arquivar foto | `POST .../photos/:photoId/archive` |
| Arquivar em lote por idade | `POST .../photos/archive-trash-older-than` |
| Arquivar todas da lixeira agora | `POST .../photos/archive-all-trash` |
| Esvaziar lixeira | `DELETE .../photos/trash` |

---

## Arquivo imutavel de fotos

Fotos arquivadas (`archived_at IS NOT NULL`) sao somente leitura. O objetivo e preservar a evidencia historica de cada campanha mesmo apos limpezas da lixeira. Nao existe endpoint de edicao para fotos arquivadas. A unica transicao disponivel e o retorno para a lixeira (`unarchive-to-trash`), que permite entao restaurar ou purgar definitivamente.

---

## Arquivo imutavel de entregas (Compound Archives)

Tabela: [`report_archives`](../backend/migrations/0010_report_archives.sql). Cada entrega de um compound gera uma versao sequencial (`v1`, `v2`, ...) protegida por `UNIQUE (compound_id, version)`.

### Estrutura

| Coluna | Proposito |
|---|---|
| `generated_media_id` | DOCX gerado pelo sistema (snapshot do `output_docx_media_id` do compound) |
| `delivered_media_id` | Arquivo final efetivamente entregue (ex.: PDF assinado). Pode ser anexado depois via `attach-delivered` |
| `generated_sha256` / `delivered_sha256` | Hashes para verificacao de integridade |
| `snapshot_payload` | Copia defensiva do payload do compound no momento da entrega (mesmo que o compound seja alterado depois, a entrega preserva o estado) |
| `delivered_at`, `delivered_by` | Auditoria basica de quem entregou e quando |

A UI da arquivos esta em [src/features/reports/components/ArchivedDeliveriesPanel.jsx](../src/features/reports/components/ArchivedDeliveriesPanel.jsx).

### Endpoints

| Acao | Endpoint |
|---|---|
| Listar arquivos de um compound | `GET /api/report-archives?compoundId=...` |
| Baixar (variant `generated` ou `delivered`) | `GET /api/report-archives/:id/download` |
| Anexar arquivo entregue | `POST /api/report-archives/:id/attach-delivered` |

Upload do arquivo entregue usa o fluxo padrao: `POST /api/media/upload-url` → upload direto para o bucket → `POST /api/media/complete` → `attach-delivered` com o `mediaAssetId`. Componente UI: [DeliveryUploadModal.jsx](../src/features/reports/components/DeliveryUploadModal.jsx).

---

## Membros por workspace

Tabela: [`workspace_members`](../backend/migrations/0007_workspace_members.sql). Primary key composta `(workspace_id, user_id)`, role em `CHECK (role IN ('owner', 'editor', 'viewer'))`.

### Regras

- Usuarios Admin/Administrador/Gerente (perfil global) veem todos os workspaces independentemente desta tabela.
- Demais usuarios so leem/editam workspaces em que aparecem em `workspace_members`.
- Role local `owner` e `editor` permitem escrita; `viewer` e read-only.
- Nao e possivel remover o ultimo `owner` de um workspace — o endpoint rejeita a operacao.
- O criador do workspace e registrado automaticamente como `owner`.

### Endpoints e UI

| Acao | Endpoint | UI |
|---|---|---|
| Listar membros | `GET .../members` | [WorkspaceMembersModal.jsx](../src/features/reports/components/WorkspaceMembersModal.jsx) |
| Adicionar | `POST .../members` | idem |
| Remover | `DELETE .../members/:userId` | idem |

Middlewares de autorizacao: `requireWorkspaceRead` / `requireWorkspaceWrite` definidos em `backend/utils/workspaceAccess.js`.

---

## Workspaces como banco de fotos de erosao

As fotos principais de uma erosao (campo `fotosPrincipais` no `payload` de `erosions` — ver [api-backend.md](api-backend.md)) sao referencias `{ photoId, workspaceId, mediaAssetId }` apontando para linhas de `report_photos`. A curadoria e feita no modal de detalhe da erosao, que reutiliza toda a infra de workspace:

1. O modal lista fotos ativas de **todos** os workspaces cujo `project_id` coincide com o `projetoId` da erosao. Nao ha tabela nova — e agregacao client-side via [useErosionPhotoSources.js](../src/features/erosions/hooks/useErosionPhotoSources.js).
2. Se o projeto nao tem nenhum workspace com foto, o modal oferece [EnsureErosionWorkspaceModal.jsx](../src/features/erosions/components/EnsureErosionWorkspaceModal.jsx) — cria um workspace dedicado com `draftState.purpose = 'erosion_photos'` e leva o usuario ao `DeliveryUploadModal` usual.
3. O `purpose: 'erosion_photos'` e apenas uma etiqueta semantica dentro do `draftState`; nao altera `classification`, status ou filtros dos fluxos de relatorio. Um workspace criado por esse caminho continua funcional para qualquer uso.
4. Ate 6 fotos podem ser marcadas como "principais" via [ErosionPhotosPickerModal.jsx](../src/features/erosions/components/ErosionPhotosPickerModal.jsx). A selecao e persistida no `payload` da erosao (sem migracao; validada por Zod).
5. O PDF completo (`buildSingleErosionFichaPdfDocument`) embute essas 6 fotos em grid 2x3 (8 cm x 6 cm) no final da ficha. A **ficha simplificada nao muda** — nao contem imagens embutidas.

**Permissao**: acesso a uma foto depende de membership no workspace de origem (ver `workspace_members`). O backend ja adiciona o criador de um workspace como `owner` automaticamente, entao quem cria o "banco de fotos" tem acesso imediato; demais usuarios precisam ser convidados via `WorkspaceMembersModal`.

---

## Vinculo com vistoria (`inspection_id`)

Adicionado em [0009_workspace_inspection_link.sql](../backend/migrations/0009_workspace_inspection_link.sql).

Workspaces podem opcionalmente referenciar uma `inspection` especifica via `report_workspaces.inspection_id`. Isso permite distinguir campanhas re-entrantes no mesmo empreendimento (ex.: mesmo projeto vistoriado 3 vezes no ano gera 3 workspaces, um por vistoria).

- Nao ha FK fisica (a tabela `inspections` usa document-store JSONB). A integridade e validada no route handler antes de aceitar um `inspection_id` no payload.
- Workspaces antigos, criados antes desta migracao, ficam com `inspection_id = NULL`. A UI oferece um modal global para classificacao retroativa: [UnclassifiedWorkspacesModal.jsx](../src/features/reports/components/UnclassifiedWorkspacesModal.jsx).
- Esse modal **dispara globalmente**, independente do filtro ativo na aba de workspaces — garantindo que o usuario veja todos os pendentes de classificacao, nao apenas os do filtro atual.

---

## Feedback visual de curadoria por torre

Funcao: `computeTowerCurationStatus()` em [src/features/reports/utils/reportUtils.js](../src/features/reports/utils/reportUtils.js) (linha 258).

Retorna um mapa `{ [towerId]: boolean }` indicando se **todas** as fotos de uma torre foram curadas. Uma foto e considerada curada quando:

1. Tem `tower_id` definido
2. Tem `caption` nao-vazia
3. Tem `include_in_report = true`

A funcao aceita `drafts` (estado em memoria do formulario de curadoria) que sobrepoe o estado persistido — isso permite feedback imediato enquanto o usuario edita sem recarregar.

### UI

Em [WorkspacesTab.jsx](../src/features/reports/components/WorkspacesTab.jsx) cada torre exibe um indicador visual (check) quando `towerCurationStatus[towerId] === true`. Torres parcialmente curadas ficam destacadas em estado intermediario, incentivando a conclusao.

Testes: [src/features/reports/utils/__tests__/towerCurationStatus.test.js](../src/features/reports/utils/__tests__/towerCurationStatus.test.js) cobre casos de torre completa, incompleta, sem towerId, drafts com override e caption/includeInReport ausentes.

---

## Componentes UI principais

| Componente | Proposito |
|---|---|
| [ReportsView.jsx](../src/features/reports/components/ReportsView.jsx) | Container com tabs (Workspaces, Compostos, Dossies, Biblioteca) |
| [WorkspacesTab.jsx](../src/features/reports/components/WorkspacesTab.jsx) | Listagem de workspaces, curadoria por torre, badge de torres completas |
| [TrashExpandedModal.jsx](../src/features/reports/components/TrashExpandedModal.jsx) | Lixeira de fotos com paginacao, filtro e agrupamento por torre, arquivamento em lote |
| [UnclassifiedWorkspacesModal.jsx](../src/features/reports/components/UnclassifiedWorkspacesModal.jsx) | Modal global para classificar workspaces sem `inspection_id` |
| [WorkspaceMembersModal.jsx](../src/features/reports/components/WorkspaceMembersModal.jsx) | Gestao de membros (adicionar, remover, mudar role) |
| [ArchivedDeliveriesPanel.jsx](../src/features/reports/components/ArchivedDeliveriesPanel.jsx) | Historico de entregas imutaveis de um compound |
| [DeliveryUploadModal.jsx](../src/features/reports/components/DeliveryUploadModal.jsx) | Upload do arquivo final entregue (delivered_media) |
| [PhotoPreviewModal.jsx](../src/features/reports/components/PhotoPreviewModal.jsx) | Preview e edicao de metadata de uma foto |
| [CompoundsTab.jsx](../src/features/reports/components/CompoundsTab.jsx) | Listagem e edicao de compounds; geracao DOCX |
| [DossierTab.jsx](../src/features/reports/components/DossierTab.jsx) | Dossies de projeto (licencas, erosoes, workspaces) |
| [BibliotecaTab.jsx](../src/features/reports/components/BibliotecaTab.jsx) | Biblioteca de fotos do projeto (agregacao multi-workspace) |

---

## Anexo de fichas de erosao simplificada

O wizard de criacao/edicao do compound tem uma etapa dedicada a anexar fichas de erosao simplificada **apos as assinaturas** no DOCX final. O conteudo aparece sob o heading `ANEXO - FICHAS DE EROSÃO SIMPLIFICADA`, com uma pagina por erosao e ordenacao crescente pelo numero da torre.

Persistencia no `sharedTextsJson` do compound:
- `anexoFichasMode`: `none` (default) | `all` | `selected`.
- `anexoFichasErosionIds`: usado quando `anexoFichasMode = 'selected'`; array de ids de `erosions` (uma entrada por ficha).

O backend monta `renderModel.compound.anexoFichas = { erosions, projectName }` em [buildReportCompoundContext](../backend/utils/reportJobContext.js) quando o modo nao e `none`, reaproveitando `enrichErosionWithUtm`. O worker usa o helper `append_fichas_cadastro_to_document` ([worker/ficha_cadastro_renderer.py](../worker/ficha_cadastro_renderer.py)) — o mesmo codigo que a rota standalone `POST /api/erosions/fichas-cadastro/generate`.

---

## Jobs e worker

A geracao de DOCX, o processamento de KMZ grande e o export ZIP de fotos rodam no worker para nao bloquear a API. Flow basico:

1. API chama `POST /api/report-compounds/:id/generate` (ou endpoints similares de dossie/export) — insere linha em `report_jobs` com `status_execucao = 'queued'`.
2. Worker faz polling via `POST /api/report-jobs/claim` usando `x-worker-token`.
3. Worker baixa insumos (media assets, dados do compound) e gera o DOCX usando o template ativo de `report_templates`.
4. Worker faz upload do resultado como novo `media_asset` e chama `PUT /api/report-jobs/:id/complete` com os ids de saida.
5. UI observa o job (polling) e, quando `ready`, habilita download/entrega.

Configuracao do worker fica em [deploy/fly/**/worker.toml](../deploy/fly). Envs relevantes: `GEOMONITOR_API_URL`, `WORKER_API_TOKEN`, `WORKER_AUTO_POLL`, `WORKER_POLL_INTERVAL_SECONDS`.

---

## Referencias

- API HTTP: [api-backend.md](api-backend.md)
- Visao nao-tecnica: [visao-geral-sistema.md](visao-geral-sistema.md)
- Migracoes SQL: [backend/migrations/](../backend/migrations)
- Repositorios Postgres: [backend/repositories/](../backend/repositories)
