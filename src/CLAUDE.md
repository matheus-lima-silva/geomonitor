# Frontend — convencoes (UI/UX + consumo HATEOAS)

Regras obrigatorias para toda mudanca em `src/`. **Fonte canonica de padroes UI**: [../docs/ui/ui-audit-report.md](../docs/ui/ui-audit-report.md). Ele registra o baseline (51 controles ad-hoc no wizard de inspecao), as metricas pos-migracao (0 `bg-[#eef3fb]`, 0 `focus:ring-blue`) e os componentes novos do modulo de reports (abril/2026): `TrashExpandedModal`, `ArchivedDeliveriesPanel`, `UnclassifiedWorkspacesModal`, `DeliveryUploadModal`, `WorkspaceMembersModal`. **Consultar antes** de criar modal/painel novo.

Stack: React 18 + Vite 5 + Tailwind + Vitest.

## 1. Componentes base sao mandatorios

Importar sempre do barrel [components/ui/index.js](components/ui/index.js):

```js
import {
  Button, Badge, Card, Input, Select, Textarea,
  Modal, IconButton, ConfirmDeleteModal, HintText,
  RangeSlider, SearchableSelect, Skeleton, PageHeader, EmptyState,
} from '../components/ui';
```

Nunca `<button>`, `<input>`, `<textarea>` ou `<div className="card">` soltos. Se faltar variante, **estender o primitive** em `components/ui/`, nao duplicar.

Precedente: o audit em `docs/ui/ui-audit-report.md` reduziu de **51 para 10** os controles ad-hoc do wizard de inspecao substituindo-os pelos primitivos. Reintroduzir controle solto e retrocesso.

## 2. Variantes permitidas

- `Button`: variants `primary` | `secondary` | `outline` | `ghost` | `danger`; sizes `sm` | `md` | `lg`. Focus ring obrigatorio (`focus-visible:ring-2 focus-visible:ring-brand-500`) — ja embutido no primitive.
- `IconButton`: variants `ghost` | `outline` | `primary` | `danger`; sizes `sm` | `md` | `lg`. Exige `aria-label` no uso.
- `Card`: variants `default` | `nested` | `flat`.
- `Modal`: sizes `sm` | `md` | `lg` | `xl` | `2xl`; fecha com `Escape`; footer via slot.
- `Badge`: tones `ok` | `warning` | `danger` | `critical` | `neutral`. Para papeis de workspace seguir o padrao de [features/reports/components/WorkspaceMembersModal.jsx](features/reports/components/WorkspaceMembersModal.jsx): `amber` (owner), `sky` (editor), `slate` (viewer).
- `EmptyState`: sempre com `icon + title + description + action`.
- `Textarea`: auto-height; usar para campos multi-linha (nunca `<textarea>` cru).

## 3. Tailwind: so tokens

Nunca hex literal em classes (o audit zerou `bg-[#eef3fb]` e `focus:ring-blue`). Tokens disponiveis em [../tailwind.config.js](../tailwind.config.js):

- **Brand/primary**: `brand-50` … `brand-900`.
- **Semanticas**: `success`, `warning`, `danger`, `critical` (com `.light`, `.border`, `.dark` quando aplicavel); `info` para caixas informativas.
- **Neutras**: `slate-50` … `slate-900` e `neutral-50` … `neutral-900`.
- **Superficies**: `app-bg` (fundo da app — **sempre** `bg-app-bg`, nunca `bg-[#eef3fb]`), `app-surface`, `app-surfaceMuted`.
- **Sombras**: `shadow-card`, `shadow-panel`, `shadow-modal`.
- **Bordas**: `rounded-sm | md | lg | xl | 2xl` (6–16px).
- **Alturas de botao**: `min-h-btn`, `min-h-btn-sm`, `min-h-btn-lg`.
- **Charts**: usar [features/monitoring/utils/monitoringColors.js](features/monitoring/utils/monitoringColors.js) em vez de literais.

## 4. Feedback ao usuario

SEMPRE `useToast()` de [context/ToastContext.jsx](context/ToastContext.jsx) — `toast.show(msg, 'success' | 'error' | 'info')`. Nunca `alert()`, `window.confirm()` (use `ConfirmDeleteModal`), nem renderizar mensagem solta na tela.

## 5. Consumo da API: `fetchWithHateoas`

SEMPRE via `fetchWithHateoas(hateoasLink, body?, preferredBaseUrl?)` de [utils/apiClient.js](utils/apiClient.js). Ele recebe o objeto `{ href, method }` do `response.data._links.xxx` — **nao construa URL manualmente**. Isso preserva o espirito do HATEOAS: o frontend descobre acoes disponiveis pela resposta.

Erros: usar `extractApiErrorMessage` e `normalizeRequestError` do mesmo arquivo em vez de tratamento ad-hoc.

## 6. Services

Criar em `services/*Service.js` (globais) ou `features/<feature>/services/` (especificos da feature). Para CRUD, usar `createCrudService({ resourcePath, itemName })` de [utils/serviceFactory.js](utils/serviceFactory.js). Exemplo canonico: [services/projectService.js](services/projectService.js).

## 7. Estrutura de feature

```
features/<feature>/
├── components/   UI do modulo
├── hooks/        hooks de estado complexo do modulo
├── models/       normalizers / transformadores
├── services/     chamadas de API especificas
└── utils/        helpers locais
```

Nao criar componentes de feature fora dessa estrutura. Exemplo canonico: [features/projects/](features/projects/).

## 8. Acessibilidade minima

- Modais: `role="dialog"` + `aria-modal="true"` + `aria-label`.
- Botoes so com icone: `aria-label` obrigatorio.
- Inputs: `htmlFor` + `id` sempre que houver `<label>`.
- Focus visivel: `focus-visible:ring-2 focus-visible:ring-brand-500`.

## 9. Estado global

`React Context` em `context/` (`AuthContext`, `ToastContext`). **Nao** adicionar Redux/Zustand. Para estado complexo de feature, criar hook em `features/<feature>/hooks/` (ex.: `useProjectsFeatureState`).

## 10. Icones: sempre via `<AppIcon>`

Nunca importar de `lucide-react` diretamente em features/views. Fonte unica: [components/AppIcon.jsx](components/AppIcon.jsx).

`AppIcon` mantem um `ICON_MAP` com **aliases semanticos** (`plus`, `save`, `edit`, `trash`, `close`, `check`, `alert`, `dashboard-nav`, `projects-nav`, `licenses-nav`, `inspections-nav`, `erosions-nav`, `visit-nav`, `route-plan` etc.). Esses aliases padronizam o visual mesmo que o icone lucide subjacente mude.

Uso:

```jsx
<AppIcon name="save" className="w-4 h-4" aria-hidden="true" />
```

Dentro de `IconButton` / `Button` so com icone, ainda exigir `aria-label` no botao.

Se o alias nao existir, **adicionar ao `AppIcon.jsx`** (importar de `lucide-react/dist/esm/icons/<nome>` e registrar no `ICON_MAP`). Nunca contornar criando import solto de lucide em outro arquivo.

Tamanhos: `w-4 h-4` (inline em texto), `w-5 h-5` (botoes), `w-6 h-6` (enfase). Nunca `width={16}` inline — sempre classes Tailwind.

## 11. Testes sao obrigatorios

Vitest. Toda mudanca de componente, hook, service ou util precisa de teste novo ou atualizacao.

- **Local**: `__tests__/` irmao do arquivo. Exemplos:
  - [components/ui/__tests__/Button.test.jsx](components/ui/__tests__/Button.test.jsx)
  - [components/ui/__tests__/Textarea.test.jsx](components/ui/__tests__/Textarea.test.jsx)
  - [features/projects/services/__tests__/projectService.test.js](features/projects/services/__tests__/projectService.test.js)
- **Padrao**: Vitest + `react-dom/client` (`createRoot` + `act`), **nao** React Testing Library. Comeco dos arquivos: `globalThis.IS_REACT_ACT_ENVIRONMENT = true;`.
- **Componente com `useAuth`/`useToast`**: ou o teste monta os Providers, ou o componente usa `useOptionalAuth` / render condicional para nao explodir sem contexto (ver `memory/feedback_react_hooks_testing.md` no home do usuario).
- **Services**: mockar `fetch`/`fetchWithHateoas` e assertar que o frontend usa o `_links` que recebeu — testa o contrato HATEOAS no consumo.
- Comando: `npm run test` (ou `npm run test:watch`).

## 12. Checklist ao mexer em UI

- [ ] Nenhum `<button>`, `<input>`, `<textarea>` solto — usei os do `ui/`?
- [ ] Nenhuma cor hex literal — so tokens Tailwind?
- [ ] `alert()` / `confirm()` → substitui por `useToast` / `ConfirmDeleteModal`?
- [ ] Chamadas a API vao por `fetchWithHateoas` a partir de `response.data._links`?
- [ ] Icones via `<AppIcon name="..." />` — nao importei `lucide-react` direto?
- [ ] `aria-label` em icones-botao e `htmlFor` em labels?
- [ ] **Teste novo** em `__tests__/` irmao — `npm run test` passando?

## 13. Anti-padroes

- `<button className="bg-blue-600 rounded px-3 py-1">` — deveria ser `<Button variant="primary">`.
- `fetch('/api/projects/123')` — deveria ser `fetchWithHateoas(project._links.self)`.
- `alert('Salvo!')` — deveria ser `toast.show('Salvo!', 'success')`.
- `style={{ color: '#dc2626' }}` — deveria ser `className="text-danger"`.
- `bg-[#eef3fb]` — deveria ser `bg-app-bg` (audit zerou isso).
- `import { Plus } from 'lucide-react'` numa feature — deveria ser `<AppIcon name="plus" />`; ampliar `AppIcon` se faltar alias.
- Icone com `width={16}` inline — usar `w-4 h-4`.
- `useApi` paralelo em vez de `apiClient.js` + `serviceFactory.js`.
- PR sem teste novo para codigo novo.

## 14. Manutencao deste documento

Ao adicionar novo primitive em `components/ui/`, novo token Tailwind, novo hook global, novo alias em `AppIcon.jsx` ou nova convencao UX, **atualizar este arquivo no mesmo PR** e bumpar a data do rodape. Ao concluir refatoracao UI grande, adicionar entrada em `../docs/ui/ui-audit-report.md`. Revisar integralmente a cada trimestre (audit comparando com estado do codigo). Ver secao "Manutencao dos documentos" do plano arquitetural em `.claude/plans/jazzy-tinkering-cocke.md`.

> Ultima revisao: 2026-04-17.
