# Tabela de Criticidade e Solucao Tecnica (Erosoes)

## 1. Objetivo

Este documento explica, de forma operacional, como funciona a classificacao de criticidade de erosoes no projeto, e como a sugestao de solucao tecnica e definida.

Fonte canonica de regra:
- backend/utils/criticalityV2.js
- backend/__tests__/criticality.test.js

## 2. Formula Geral

Score total:

`Score = T + P + D + S + E`

Onde:
- `T` = tipo de erosao
- `P` = profundidade
- `D` = declividade
- `S` = tipo de solo
- `E` = exposicao (distancia da estrutura)

## 3. Tabela de Classificacao por Dimensao (T/P/D/S/E)

### 3.1 Tipo de erosao (T)

| Classe | Regra | Pontos |
|---|---|---:|
| T1 | laminar | 0 |
| T2 | sulco | 2 |
| T3 | ravina | 4 |
| T4 | vocoroca, movimento_massa | 6 |

### 3.2 Profundidade (P)

| Classe | Regra (m) | Pontos |
|---|---|---:|
| P1 | `<= 1` | 0 |
| P2 | `> 1 e <= 10` | 2 |
| P3 | `> 10 e <= 30` | 4 |
| P4 | `> 30` | 6 |

### 3.3 Declividade (D)

| Classe | Regra (graus) | Pontos |
|---|---|---:|
| D1 | `< 10` | 0 |
| D2 | `>= 10 e <= 25` | 2 |
| D3 | `> 25` | 4 |

### 3.4 Tipo de solo (S)

| Classe | Regra | Pontos |
|---|---|---:|
| S1 | lateritico | 0 |
| S2 | argiloso | 2 |
| S3 | solos_rasos, arenoso | 4 |

### 3.5 Exposicao por distancia da estrutura (E)

| Classe | Regra (m) | Pontos |
|---|---|---:|
| E1 | `> 50` | 0 |
| E2 | `>= 20 e <= 50` | 2 |
| E3 | `>= 5 e < 20` | 4 |
| E4 | `< 5` | 6 |

## 4. Faixas de Criticidade Final (C1-C4)

| Codigo | Classe | Faixa de Score | Tipo de medida (base) |
|---|---|---:|---|
| C1 | Baixo | 0 a 7 | preventiva |
| C2 | Medio | 8 a 15 | corretiva_leve |
| C3 | Alto | 16 a 23 | corretiva_estrutural |
| C4 | Muito Alto | >= 24 | engenharia_PRAD |

## 5. Sugestao de Solucao Tecnica por Criticidade

### 5.1 C1 (preventiva)

Exemplos de solucoes sugeridas:
- Cobertura vegetal (gramineas, ressemeadura)
- Curvas de nivel, plantio em faixas
- Mulching / palhada / biomanta leve
- Controle de trafego
- Regularizacao leve de acesso

### 5.2 C2 (corretiva_leve)

Exemplos de solucoes sugeridas:
- Barraginhas e pequenos terracos
- Sangradouros laterais / lombadas de agua
- Canaletas vegetadas / valetas rasas
- Hidrossemeadura + biomantas leves
- Reperfilamento de caixa de estrada

### 5.3 C3 (corretiva_estrutural)

Exemplos de solucoes sugeridas:
- Reconformacao de taludes
- Sarjetas de crista / canaletas revestidas
- Escadas hidraulicas / bacias de dissipacao
- Check dams
- Bioengenharia robusta
- Enrocamento lateral em acessos criticos
- Protecao de base de torres

### 5.4 C4 (engenharia_PRAD)

Exemplos de solucoes sugeridas:
- Rede completa de drenagem da bacia
- Drenos profundos para piping
- Diques de terra / barragens com vertedouro protegido
- Estruturas de contencao (muros, gabioes)
- Reperfilamento amplo + revegetacao com nativas
- Monitoramento periodico com marcos
- PRAD com acompanhamento semestral/anual

## 6. Politica Contextual (Ajustes da Recomendacao)

A recomendacao tecnica base pode ser ajustada por contexto.

### 6.1 Cap para monitoramento em C1/C2

Quando a erosao estiver em um dos cenarios abaixo, o sistema prioriza `monitoramento`:
- localizacao_exposicao = `area_terceiros`; ou
- declividade classe `D1` ou `D2`.

Nesse caso:
- `lista_solucoes_sugeridas` vira a lista de monitoramento (base de C1)
- `lista_solucoes_possiveis_intervencao` guarda as demais intervencoes como opcao
- `recomendacao_contextual` explica o motivo do cap

### 6.2 Filtro de solucoes de torre em contexto de acesso distante

Quando:
- estrutura_proxima = `acesso` (ou local de acesso), e
- distancia_estrutura_m >= 20, e
- nao for contexto de torre/fundacao,

O sistema remove solucoes especificas de protecao de torre, como:
- protecao de base de torres
- anel drenante

## 7. Fluxo de Decisao C1-C4 (texto)

1. Classificar T, P, D, S e E com base nos dados informados.
2. Somar pontos para obter o `Score`.
3. Converter `Score` em `Codigo` (C1, C2, C3 ou C4).
4. Buscar recomendacao base pela faixa de criticidade.
5. Aplicar filtros contextuais:
   - Se C1/C2 com area_terceiros ou D1/D2: cap para monitoramento.
   - Se acesso distante de torre: remover solucoes especificas de torre.
6. Retornar:
   - `tipo_medida_recomendada`
   - `lista_solucoes_sugeridas`
   - `lista_solucoes_possiveis_intervencao` (quando aplicavel)
   - `recomendacao_contextual`

## 8. Exemplos Rapidos

### Exemplo A: C2 com cap para monitoramento

Entrada simplificada:
- tipo_erosao: sulco
- profundidade_m: 6
- declividade_graus: 12
- tipo_solo: argiloso
- distancia_estrutura_m: 25
- localizacao_exposicao: area_terceiros

Resultado esperado:
- score 8 -> C2
- tipo_medida_recomendada = monitoramento
- lista_solucoes_sugeridas = lista preventiva/monitoramento
- lista_solucoes_possiveis_intervencao preenchida

### Exemplo B: C3 sem cap contextual

Entrada simplificada:
- tipo_erosao: movimento_massa
- profundidade_m: 11
- declividade_graus: 12
- tipo_solo: arenoso
- distancia_estrutura_m: 25

Resultado esperado:
- score 16 -> C3
- tipo_medida_recomendada = corretiva_estrutural
- lista_solucoes_possiveis_intervencao vazia

## 9. Observacoes de Uso

- O backend e a fonte canonica da criticidade.
- O frontend deve exibir resultado e classes conforme retorno canonico.
- Para auditoria, sempre registrar codigo final (`C1-C4`) junto do score.

## 10. Referencias Tecnicas

- backend/utils/criticalityV2.js
- backend/__tests__/criticality.test.js
- docs/api-erosoes-calcular-phase2.md
- docs/api-backend.md
