# TODO - Criticidade V3 (Plano enchanted-bubbling-newt)

Data de corte da analise: 2026-03-20

Resumo rapido:
- Implementado integral: 27/33 itens acionaveis
- Implementado parcial: 0/33
- Nao implementado: 6/33
- Progresso estimado: 82%

## Prioridade P0

- [x] Converter `tiposFeicao` para single-select na UI, mantendo array no storage
  - Evidencia atual: ainda e checkbox multi-select em `src/features/erosions/components/ErosionTechnicalFields.jsx:427` e `src/features/erosions/components/ErosionTechnicalFields.jsx:432`
  - Criterio de aceite:
    - UI com `<select>` unico para `tiposFeicao`
    - `onChange` grava array com 0/1 item (`[]` ou `[valor]`)
    - dados legados com multi-itens continuam legiveis

- [x] Atualizar `docs/tabela-criticidade-solucoes.md` para V3 real (T+P+D+S+E+A + V)
  - Evidencia atual: documento ainda esta em formula antiga `Score = T + P + D + S + E` em `docs/tabela-criticidade-solucoes.md:15`
  - Criterio de aceite:
    - incluir dimensao A e modificador V
    - incluir faixas C1 0-9, C2 10-18, C3 19-27, C4 >= 28
    - refletir solucoes por contexto (nao apenas por faixa)

## Prioridade P1

- [x] Implementar `HintText` e textos de ajuda visiveis no formulario tecnico
  - Evidencia atual: arquivo nao existe (`src/components/ui/HintText.jsx`) e nao ha textos orientativos por campo
  - Criterio de aceite:
    - componente criado
    - hints aplicados nos campos principais e nos campos de `impactoVia`

- [x] Incluir `dimensionamento` no fluxo de backend/frontend conforme plano
  - Evidencia atual: nenhuma ocorrencia de `dimensionamento` no codigo (`rg -n "dimensionamento" backend src`)
  - Criterio de aceite:
    - normalizacao, validacao, persistencia e passagem para calculo quando aplicavel
    - cobertura de teste minima para serializacao/persistencia

- [x] Ajustar recalc em `ErosionDetailsModal` para cobrir erosoes sem `criticalidadeV2`
  - Evidencia atual: condicao depende de `breakdown.pontos.A === undefined` e pode nao recalcular quando `criticalidadeV2` estiver ausente (`src/features/erosions/components/ErosionDetailsModal.jsx:165`)
  - Criterio de aceite:
    - recalc ocorre quando nao existe `criticalidadeV2` ou quando `A` nao existe

- [x] Corrigir fallback legado de declividade no modal para D4
  - Evidencia atual: alias `>45` mapeia para `D3` e fallback de `deriveSlopeClass` termina em `D3` (`src/features/erosions/components/ErosionDetailsModal.jsx:86` e `src/features/erosions/components/ErosionDetailsModal.jsx:101`)
  - Criterio de aceite:
    - `>45` -> `D4`
    - fallback numerico >45 -> `D4`

## Prioridade P2

- [x] Sincronizar metadado de defaults com plano para `modificador_via`
  - Evidencia atual: engine calcula `V`, mas `CRITICALITY_V2_DEFAULTS.pontos` nao possui secao descritiva `modificador_via`
  - Criterio de aceite:
    - bloco descritivo adicionado em backend e espelho de configuracao no frontend

- [x] Revisar regra de teto C2 fora faixa para aderencia exata ao plano
  - Evidencia atual: implementacao usa condicao ampla (OR entre `fora_faixa` e `area_terceiros`) em `backend/utils/criticalityV2.js:625`
  - Criterio de aceite:
    - confirmar regra desejada (estrita ou ampla) e documentar decisao
  - Decisao aplicada: regra estrita, seguindo o plano. O teto C2 agora so ocorre quando `local_tipo = fora_faixa_servidao` **e** `localizacao_exposicao = area_terceiros`.

- [x] Reforcar testes de interface para o formulario tecnico V3
  - Escopo minimo:
    - single-select de `tiposFeicao`
    - hints visiveis
    - comportamento de distancia no `leito` da via

## Prioridade P3

- [ ] Revisar a normalizacao de score V3 no monitoramento e no heatmap do dashboard
  - Evidencia atual: `safeScore` ainda e limitado a `26` e `peso` continua dividido por `26` em `src/features/monitoring/utils/monitoringViewModel.js:510` e `src/features/monitoring/utils/monitoringViewModel.js:517`
  - Criterio de aceite:
    - escala do heatmap compativel com o score maximo atual da V3
    - erosoes com score acima de `26` nao perdem intensidade por clamp legado

- [ ] Revisar a tela `DashboardView` para garantir consistencia das superficies derivadas da V3
  - Evidencia atual: dashboard depende diretamente de `heatPoints`, `workTrackingRows` e `recentErosions` em `src/views/DashboardView.jsx:147`, `src/views/DashboardView.jsx:142` e `src/views/DashboardView.jsx:149`
  - Criterio de aceite:
    - mapa, listas recentes e blocos derivados continuam coerentes com a criticidade recalculada
    - copiar/rotulos e exibicoes nao assumem a escala antiga implicitamente

- [ ] Atualizar PDF de erosoes para exibir o breakdown V3 completo
  - Evidencia atual: resumo da ficha ainda renderiza `Pontos T/P/D/S/E` em `src/features/erosions/utils/erosionPdfTemplates.js:233`
  - Criterio de aceite:
    - PDF reflete ao menos `T/P/D/S/E/A`
    - validar se `V` e `dimensionamento` precisam aparecer na ficha final

- [ ] Revisar cards e listagens de erosoes para alinhamento com a criticidade V3
  - Evidencia atual: card principal continua priorizando badge de `impacto` legado em `src/features/erosions/components/ErosionCardGrid.jsx:55`
  - Criterio de aceite:
    - confirmar se `impacto` isolado ainda basta ou se a UI deve expor `codigo`/score V3
    - manter consistencia visual entre grid, detalhes e dashboard

- [ ] Revisar telas de inspecao que resumem erosoes vinculadas
  - Evidencia atual: `InspectionDetailsModal` ainda mostra somente `impacto` nas erosoes relacionadas em `src/features/inspections/components/InspectionDetailsModal.jsx:125` e `src/features/inspections/components/InspectionDetailsModal.jsx:327`
  - Criterio de aceite:
    - decidir explicitamente se a inspecao continua com resumo simplificado ou se incorpora criticidade V3
    - evitar divergencia entre detalhe da inspecao e detalhe da erosao

- [ ] Reforcar testes de dashboard/monitoramento para a faixa nova de score
  - Evidencia atual: os testes cobrem scores como `6`, `10` e `25`, mas ainda nao exercitam score acima de `26` em `src/features/monitoring/utils/__tests__/monitoringViewModel.test.js:380`, `src/features/monitoring/utils/__tests__/monitoringViewModel.test.js:394` e `src/views/__tests__/DashboardView.monitoring.test.jsx:89`
  - Criterio de aceite:
    - incluir cenarios com `C4` acima de `26`
    - validar regressao de heatmap, listas recentes e agregacoes do dashboard
