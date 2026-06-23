# UI Audit Report - Active Flows

Date: 2026-03-05
Scope: auth, app shell, dashboard and lazy-loaded active tabs.
Method: `ui-standardization` + iterative `ralph-loops`.

## Baseline Summary

- `InspectionFormWizardModal.jsx` raw controls: `51`
- Token gate matches (`focus:ring-blue|focus:border-blue|bg-[#eef3fb]` in `src/views src/layout src/features`): `>0`
- Hardcoded app background (`bg-[#eef3fb]`): present in `AppShell` and `AuthView`
- UI test baseline (target suite): 4 failing tests

## Implemented Changes

1. Foundation and primitives
- Added semantic color aliases in `tailwind.config.js` (`app`, `neutral`, `info`, expanded `brand` scale).
- Added app background token in `src/styles.css` via `--app-bg`.
- Added visible keyboard focus ring to `src/components/ui/Button.jsx`.
- Added `src/components/ui/Textarea.jsx`.
- Added `src/components/ui/IconButton.jsx`.
- Updated `src/components/ui/index.js` exports.

2. Critical hotspot (inspection wizard)
- Refactored `src/features/inspections/components/InspectionFormWizardModal.jsx`.
- Replaced multiple ad-hoc controls with `Button`, `IconButton`, `Input`, `Select`, `Textarea`.
- Removed blue hardcoded focus/background classes and converged to brand/info tokens.

3. Secondary hotspots
- Refactored key actions in `src/features/projects/components/ProjectsView.jsx` to `Button`/`IconButton`.
- Refactored parts of `src/features/projects/components/KmlReviewModal.jsx` to use `Input`.
- Refactored report/work follow-up form controls in `src/features/followups/components/FollowupsView.jsx` to `Input/Select/Textarea`.
- Refactored JSON editor field in `src/features/admin/components/AdminView.jsx` to `Textarea`.

4. Global consistency
- Replaced `bg-[#eef3fb]` with `bg-app-bg` in:
  - `src/layout/AppShell.jsx`
  - `src/views/AuthView.jsx`
- Extracted dashboard chart colors to semantic map:
  - Added `src/features/monitoring/utils/monitoringColors.js`
  - Updated `src/views/DashboardView.jsx` to consume semantic color helpers.

5. Test hardening
- Fixed prior failing tests:
  - `KmlReviewModal.test.jsx` accent expectation (`Válidas`).
  - `FollowupsView.test.jsx` selection logic by semantic row lookup and heading.
  - `DashboardView.monitoring.test.jsx` header expectation alignment (`Status op.`).
- Added new primitive regression tests:
  - `src/components/ui/__tests__/Button.test.jsx`
  - `src/components/ui/__tests__/Textarea.test.jsx`

## After Metrics

- `InspectionFormWizardModal.jsx` raw controls: `10` (from `51`)
- Token gate matches (`focus:ring-blue|focus:border-blue|bg-[#eef3fb]`): `0`
- Hardcoded app background matches (`bg-[#eef3fb]`): `0`
- `Button` focus-visible rule present: `1` (enforced in base class)

## Validation Evidence

- Target UI suite:
  - `npm run test -- src/components/ui/__tests__/Button.test.jsx src/components/ui/__tests__/Textarea.test.jsx src/layout/__tests__/AppShell.test.jsx src/features/projects/components/__tests__/ProjectsView.test.jsx src/features/projects/components/__tests__/KmlReviewModal.test.jsx src/features/followups/components/__tests__/FollowupsView.test.jsx src/features/inspections/components/__tests__/InspectionsView.wizard.test.jsx src/views/__tests__/DashboardView.monitoring.test.jsx`
  - Result: all tests passed.
- Build:
  - `npm run build`
  - Result: success.

## Remaining P3/P4 Items

- Some table-heavy modules still keep native controls for dense editing grids where primitive wrappers can degrade table compactness.
- Optional next pass:
  - Introduce table-optimized field primitives (`InlineInput`, `InlineSelect`, `InlineTextarea`) without label wrapper.
  - Continue migrating remaining ad-hoc buttons in low-traffic areas.

---

## Components added after 2026-03-05 (reports module)

The `reports` feature area grew substantially in April 2026, adding five new modals/panels to support the workspace trash/archive pipeline and member management. All of them reuse the design primitives (`Button`, `Input`, `Textarea`, `Modal`, `Select`, `IconButton`, `SearchableSelect`) audited above — no new ad-hoc controls were introduced.

### `src/features/reports/components/TrashExpandedModal.jsx`

Large modal for the photo trash. Props: `open`, `onClose`, `photos`, `onRestore`, `onArchive`, `onEmpty`, `onArchiveOlder`.

- Sort options (`SORT_OPTIONS`): deleted desc/asc, caption A-Z, tower A-Z.
- Paginated list: `PAGE_SIZE = 24` default, selectable via `Select` (`[12, 24, 48, 96]`).
- Tower filter dropdown (`Select`) tied to `groupPhotosByTower()` output, letting operators apply bulk restore/archive to a single tower.
- Bulk archive uses `OLD_THRESHOLD_DAYS = 30` as the default retention horizon.
- Uses `Button` for primary actions and preserves focus ring tokens from the primitives.

### `src/features/reports/components/ArchivedDeliveriesPanel.jsx`

Panel embedded in the compound detail screen showing versioned deliveries. Props: `compoundId`, `compoundName`, `refreshToken`, `showToast`.

- Lists `report_archives` rows returned from `listArchives(compoundId)`.
- Two download variants per row (`generated`, `delivered`) via `Button`; disabled state when no `deliveredMediaId`.
- SHA256 rendered truncated (`shortSha` helper) for visual inspection.
- No bespoke styling — relies on `Button` primitive and existing brand tokens.

### `src/features/reports/components/UnclassifiedWorkspacesModal.jsx`

Global modal to retroactively link workspaces lacking `inspection_id`. Props: `open`, `unclassifiedWorkspaces`, `inspections`, `projectNamesById`, `busy`, `onAssign`, `onCreateInspection`.

- Fires independently of the active filter in `WorkspacesTab`, exposing every pending workspace regardless of UI state.
- Per-row `Select` with inspections indexed by project, sorted by `dataInicio` desc.
- Inline "create inspection" form (`Input` + `Button`) avoids a modal-in-modal pattern.
- Keyboard nav preserved via the primitives' focus ring.

### `src/features/reports/components/DeliveryUploadModal.jsx`

Upload wizard for final delivery files (`.pdf` or `.docx`). Props: `open`, `onClose`, `compoundId`, `compoundName`, `userEmail`, `onDelivered`, `showToast`.

- Step machine (`step` state: `idle → creating → uploading → attaching → done`) with `Button` primary disabled while step ≠ idle.
- File input accepts `application/pdf` and `.docx` via both `type` and extension whitelist.
- SHA256 computed client-side (`computeFileSha256`) before upload for integrity.
- Notes via `Textarea` primitive.

### `src/features/reports/components/WorkspaceMembersModal.jsx`

Member management for a workspace. Props: `open`, `onClose`, `workspaceId`, `workspaceName`, `canManage`.

- Role picker via `Select` with options `owner` / `editor` / `viewer`.
- User picker uses `SearchableSelect` for large user lists.
- Role badges use Tailwind color tokens (`amber`, `sky`, `slate`) consistent with existing status chips elsewhere.
- Delete uses `IconButton` with `canManage` gating; the API refuses to remove the last `owner`.

## Components added after 2026-04-18 (erosion photo curation)

### `src/features/erosions/components/ErosionPhotosPickerModal.jsx`

Modal de 2xl para selecionar ate 6 fotos principais de uma erosao, agregando fotos de todos os workspaces do mesmo `projetoId`. Props: `open`, `erosion`, `project`, `userEmail`, `onClose`, `onSaved`, `onRequestCreateWorkspace`.

- Reusa primitives `Modal`, `Button`, `IconButton`, `Select` (children-based), `EmptyState` e `AppIcon`.
- Reordenacao via setinhas `arrow-up` / `arrow-down` (sem dnd-kit; setinhas sao `IconButton variant="outline" size="sm"`).
- Grid de thumbnails usa `<button aria-pressed>` com borda/ring do token `brand-600` para indicar selecao — card-like clickable, padrao ja aceito no codebase para toggles visuais.
- Persiste via `saveErosion({ id, fotosPrincipais }, { merge: true })` — nao cria rota nova.

### `src/features/erosions/components/EnsureErosionWorkspaceModal.jsx`

Cria um workspace dedicado para armazenar fotos quando o projeto nao tem nenhum. Props: `open`, `projectId`, `projectName`, `defaultName`, `userEmail`, `onClose`, `onCreated`.

- Usa `Modal size="md"`, `Input`, `Button`.
- Marca o workspace com `draftState.purpose = 'erosion_photos'` (sem impacto em `classification`).
- Backend adiciona criador como `owner` automaticamente.

### `src/features/erosions/components/ErosionPhotoLightbox.jsx`

Preview read-only reutilizado pelo modal de detalhes (grid de thumbs). Props: `open`, `photo`, `index`, `total`, `onClose`, `onPrev`, `onNext`.

- Reusa `Modal size="2xl"` e `MediaImage`.
- Footer com navegacao prev/next (`Button outline` + icones chevron) quando `total > 1`.

### `src/components/MediaImage.jsx` + `src/hooks/useMediaAccessUrl.js`

Componente novo em `components/` (nao em `features/`) porque e util a qualquer parte da UI que precise renderizar um `<img>` a partir de um `mediaAssetId`. Resolve a URL via `downloadMediaAsset` + `URL.createObjectURL`, com cache global por id e revogacao no unmount. Fallback com icone `image-off` quando falha.

### `src/context/ToastContext.jsx` (extensao)

Adicionado `useOptionalToast()` que retorna um stub `{ show: () => {} }` quando nao ha `ToastProvider`. Padrao recomendado pelo CLAUDE.md para componentes instalados em telas testadas sem provider wrapping.

### `src/components/AppIcon.jsx` (aliases novos)

`camera`, `image`/`photo`, `image-off`, `arrow-up`, `arrow-down` — usados no picker, lightbox e fallback de `MediaImage`.

## Novo primitive `Tabs` (abril/2026, feature de LOs)

Adicionado `src/components/ui/Tabs.jsx` como primeiro primitive de tabs do projeto — nao existia anteriormente. Consumido inicialmente pelo redesign do modulo de Licencas (modal de LO segmentado em 7 abas e pagina de detalhe com 4 abas).

- **API**: `<Tabs items={[{key, label, icon?, badge?}]} activeKey onChange ariaLabel className? />`. Controlled: o caller guarda o `activeKey`.
- **Acessibilidade**: `role="tablist"`/`role="tab"`/`aria-selected`. Setas Left/Right + Home/End movem selecao com foco e atualizam `activeKey` automaticamente.
- **Visual**: linha inferior `border-b-2` no item ativo, cor `brand-600`. Itens inativos em `text-slate-500` com hover `text-slate-800`. Sem hex literal — tudo via tokens.
- **Fallback**: se `activeKey` nao pertencer a `items`, o primitive chama `onChange(items[0].key)` no primeiro efeito.
- **Testes**: `src/components/ui/__tests__/Tabs.test.jsx` (4 casos: render, click, keyboard nav, activeKey invalido).

Usar sempre que um container precise alternar entre paineis sem criar componentes separados. Nao criar mais abas ad-hoc com `<button className="border-b">` no projeto.

## Redesign do modulo de Licencas de Operacao (abril/2026)

PR grande que refatorou `src/features/licenses/components/LicensesView.jsx` em cima dos primitives do barrel. Itens introduzidos:

- **`LicenseCard`** (`src/features/licenses/components/LicenseCard.jsx`) — card enriquecido com titulo contextual (`LO Nº X — Empreendimento`), subtitulo `orgao · esfera · UF` e chips de status (periodicidade, proximo vencimento com tone warning/danger, flag erosiva) via `Badge`. Deprecia o header `<h3>{numero}</h3>` solto do card antigo.
- **`LicenseDetailView`** (`src/features/licenses/components/LicenseDetailView.jsx`) — painel full-screen ativado por URL param `?license=ID`. Quatro abas: Resumo (dois `<section>` grid), Condicionantes (reusa `LicenseConditionsSection`), Documentos (reusa `LicenseFilesSection`), Historico. Usa `Tabs` primitive.
- **`LicenseFiltersBar`** (`src/features/licenses/components/LicenseFiltersBar.jsx`) — barra de filtros composta (busca texto, multi-select de orgaos em popover, select esfera, date input de vencimento, checkbox "so com acomp. erosivo"). Segue o padrao flat + reset de `BibliotecaTab`.
- **`useLicensesFilters`** (`src/features/licenses/hooks/useLicensesFilters.js`) — hook que encapsula estado + aplicacao dos filtros. Retorna `{ filters, setFilter, reset, apply(licenses, projectsById), isEmpty }`. Testado com 7 casos em `__tests__/useLicensesFilters.test.jsx`.
- **`LicenseFormModal` em abas** — o modal antigo de ~30 campos em scroll unico agora se divide em 7 abas (Identificacao, Vigencia, Cronograma, Cobertura, Condicionantes, Documentos, Observacoes). Cada aba sub-componente proprio. Campos reusam `Input`, `Select`, `SearchableSelect`, `Textarea`, `RangeSlider` — zero controle ad-hoc novo.
- **Helpers puros** em `src/features/licenses/utils/licenseCardFormat.js` (`buildLicenseTitle`, `buildLicenseSubtitle`, `buildLicenseChips`, `daysUntil`) testados em `__tests__/licenseCardFormat.test.js` (11 casos).

A secao "exige acompanhamento erosivo" permanece como callout amber (alinhado ao warning do projeto). Roteamento por URL param (`?license=ID`) foi escolhido por fidelidade ao projeto — o app nao usa React Router; seguimos o padrao ja presente em `App.jsx:8` (`?uiReview=sidebar`) e `?token` do reset-password.

## Redesign do Gerenciamento (Admin) (junho/2026)

Refatoracao de UX de `src/features/admin/components/AdminView.jsx` (sem mudanca de backend) seguindo o handoff do design system:

- **Rail lateral agrupado** substitui a fileira de 8 botoes. Tres grupos (`Pessoas e acesso` / `Regras do sistema` / `Sistema`) num `<nav>` esquerdo (`grid lg:grid-cols-[252px_minmax(0,1fr)]`), com cabecalho de secao (titulo + descricao) na coluna de conteudo. Itens de navegacao seguem o padrao de `<button>` de nav do `AppShell` (`aria-current`, focus-visible ring) e o item `Console SQL` aparece travado (lock) para nao-admin.
- **Pendencias de aprovacao em destaque**: badge com a contagem de utilizadores `Pendente` no item Utilizadores + banner amber no topo da secao.
- **Criticidade estruturada** (`CriticalityConfigEditor`, novo): substitui o textarea de JSON cru por faixas C1-C4 com limites encadeados (so o limite superior e editavel) + barra visual (cores via `monitoringColors`) e matriz de pontos T/P/D/S/E/A. O JSON completo continua a fonte de verdade salva (controlled por `value`/`onChange`, preservando descricoes/tipos/`solucoes_por_criticidade`); um `<details>` "Editor avancado (JSON)" mantem o escape. O botao Salvar desabilita quando ha erro de ordenacao das faixas. Campos via `Input` primitive.
- **Retencao** ganha presets (30/60/90/180/365d) via `Button`.
- **Icone novo**: alias `clock` em `AppIcon.jsx` (lucide `Clock`) para o item Retencao.
- **Testes**: `__tests__/CriticalityConfigEditor.test.jsx` (round-trip JSON, encadeamento de faixas, validacao, preservacao de campos nao editados) e `__tests__/AdminView.test.jsx` (rail agrupado, badge/banner de pendencias, troca para o editor).

## Adocao do design handoff em Vistorias (junho/2026)

Programa de adocao do estilo do handoff (kit do Claude Design) nas views, 1 PR por view. Primeira: **Vistorias** (`src/features/inspections/`). Apenas apresentacao — sem mudanca de save/validacao/modelo.

- **Card da lista** (`InspectionsView.jsx`): card clicavel (role=button + Enter/Space) que abre os detalhes; header com **badge de status** (derivado das datas via `getInspectionStatusMeta`), nome do projeto e **periodo humanizado** (`formatInspectionPeriod`); dias com icone `clock`; a caixa de pendencia passa a usar **tower-pills** (chips por torre) em vez de texto com virgulas; rodape discreto (`border-t`, `bg-slate-50`) com resumo de pendencia + acoes em `IconButton` (`ghost`/`dangerGhost`).
- **Barra de filtros**: `Select` de empreendimento + chips de status (Todas/Em andamento/Planejadas/Concluidas) com contagem; substitui o banner de filtro forcado, sincronizando com `forcedProjectFilterId`.
- **Details modal** (`InspectionDetailsModal.jsx`): badge de status + periodo humanizado no card de informacoes; o restante (grid 2-col de torres, caixa de hospedagem `brand-50`, lista de erosoes em cards) **ja estava alinhado**. Preserva o toggle A/B do PDF (Track 1).
- **Wizard / diario** (`InspectionFormWizardModal.jsx`): **ja alinhado** ao kit (grid de torres 10-col, aviso amber de torre reusada, dropdown de hotel com busca/criar, "Detalhar dia", mini-form de erosao). Sem alteracao — o kit foi engenharia-reversa deste codigo.
- Primitivos: `Badge` ganhou tone **`info`** (azul, tokens info-*); aliases `clock`/`more-horizontal`/`calendar-check` no `AppIcon`. Helpers `formatInspectionPeriod`/`getInspectionStatusMeta`/`getInspectionDayCount` em `inspectionWorkflow.js`.
- Testes: `InspectionsView.wizard.test.jsx` ajustado ao novo card; `InspectionDetailsModal.test.jsx` mantido (PDF + feriado + hospedagem).

## Follow-up suggestions

- Add regression tests for the paginated trash modal (cover page boundaries, empty pages, filter + sort interaction). Existing tests cover `WorkspacesTab.lixeira` but not the modal's pagination edge cases.
- Consider extracting the "status machine button" pattern from `DeliveryUploadModal` into a primitive, as similar step state flows exist in the KMZ import UI.
- Migrar as abas ad-hoc que ainda sobrevivem em outros modulos (ex.: `ReportsView` subtabs internas) para o primitive `Tabs`.
