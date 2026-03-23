# Tabela de Criticidade e Solucoes Tecnicas (Erosoes) - V3

## 1. Objetivo

Este documento resume a regra operacional de criticidade V3 usada pelo projeto e como o sistema escolhe solucoes tecnicas conforme faixa e contexto.

Fontes canonicas:
- `backend/utils/criticality.js`
- `backend/__tests__/criticality.test.js`

## 2. Formula Geral

Score base:

`Score = T + P + D + S + E + A`

Onde:
- `T` = tipo de erosao
- `P` = profundidade
- `D` = declividade
- `S` = tipo de solo
- `E` = exposicao (distancia da estrutura ou da borda da via)
- `A` = atividade erosiva

Modificador adicional:

`Score final = Score base + V`

Onde:
- `V` = modificador de via de acesso, limitado a `+4`

## 3. Tabela de Classificacao por Dimensao

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
| D3 | `> 25 e <= 45` | 4 |
| D4 | `> 45` | 6 |

### 3.4 Tipo de solo (S)

| Classe | Regra | Pontos |
|---|---|---:|
| S1 | lateritico | 0 |
| S2 | argiloso | 2 |
| S3 | solos_rasos | 4 |
| S4 | arenoso | 6 |

### 3.5 Exposicao por distancia (E)

| Classe | Regra (m) | Pontos |
|---|---|---:|
| E1 | `> 50` | 0 |
| E2 | `>= 20 e <= 50` | 2 |
| E3 | `>= 5 e < 20` | 4 |
| E4 | `< 5` | 6 |

Regra especial para via de acesso:
- se `localTipo = via_acesso_exclusiva` e `impactoVia.posicaoRelativaVia = leito`, a distancia considerada e `0`, logo `E4`

### 3.6 Atividade erosiva (A)

| Classe | Regra | Pontos |
|---|---|---:|
| A1 | vegetacaoInterior = true e sinaisAvanco = false | 0 |
| A2 | vegetacaoInterior = false e sinaisAvanco = false | 2 |
| A3 | sinaisAvanco = true e vegetacaoInterior = true | 4 |
| A4 | sinaisAvanco = true e vegetacaoInterior = false | 6 |

### 3.7 Modificador de via de acesso (V)

Aplicado apenas quando a erosao afeta `via_acesso_exclusiva`.

| Condicao | Modificador |
|---|---:|
| `grauObstrucao = total` | +3 |
| `grauObstrucao = parcial` e `rotaAlternativaDisponivel = false` | +2 |
| `grauObstrucao = parcial` e `rotaAlternativaDisponivel = true` | +1 |
| `tipoImpactoVia = ruptura_plataforma` | +2 |
| `estadoVia = terra` | +1 |
| Teto maximo acumulado | +4 |

## 4. Faixas de Criticidade Final (C1-C4)

| Codigo | Classe | Faixa de Score | Tipo de medida base |
|---|---|---:|---|
| C1 | Baixo | 0 a 9 | preventiva |
| C2 | Medio | 10 a 18 | corretiva_leve |
| C3 | Alto | 19 a 27 | corretiva_estrutural |
| C4 | Muito Alto | >= 28 | engenharia_PRAD |

## 5. Recomendacao de Solucao por Faixa e Contexto

O sistema nao usa apenas uma lista fixa por faixa. Ele cruza:
- faixa final (`C1` a `C4`)
- contexto (`faixa_servidao`, `via_acesso_exclusiva`, `base_torre`, `fora_faixa_servidao`)
- tipo de erosao

### 5.1 C1 - Preventiva

Exemplos de solucoes:
- Cobertura vegetal
- Curvas de nivel e plantio em faixas
- Mulching ou biomanta leve
- Controle de trafego
- Regularizacao leve de acesso

### 5.2 C2 - Corretiva leve

Exemplos de solucoes:
- Barraginhas e pequenos terracos
- Sangradouros laterais
- Canaletas vegetadas
- Hidrossemeadura com biomantas leves
- Reperfilamento de caixa de estrada

### 5.3 C3 - Corretiva estrutural

Exemplos de solucoes:
- Reconformacao de taludes
- Sarjetas de crista e canaletas revestidas
- Escadas hidraulicas e bacias de dissipacao
- Check dams
- Bioengenharia robusta
- Enrocamento em acesso critico
- Protecao de base de torre

### 5.4 C4 - Engenharia / PRAD

Exemplos de solucoes:
- Rede completa de drenagem
- Drenos profundos
- Diques e barragens com vertedouro protegido
- Estruturas de contencao
- Reperfilamento amplo com revegetacao
- Monitoramento com marcos
- PRAD especifico

## 6. Politicas Contextuais

### 6.1 Cap de monitoramento em C1/C2

Quando o resultado final estiver em `C1` ou `C2` e ocorrer pelo menos um dos cenarios abaixo:
- `localizacao_exposicao = area_terceiros`
- declividade `D1` ou `D2`

Entao:
- `tipo_medida_recomendada` vira `monitoramento`
- `lista_solucoes_sugeridas` fica com a lista de monitoramento
- `lista_solucoes_possiveis_intervencao` guarda intervencoes opcionais

### 6.2 Piso minimo C3 em base de torre

Quando:
- `local_tipo = base_torre`
- `distancia_estrutura_m < 5`
- tipo = `vocoroca` ou `movimento_massa`

O resultado nunca fica abaixo de `C3`.

### 6.3 Teto C2 para fora da faixa

Quando:
- `local_tipo = fora_faixa_servidao`
- `localizacao_exposicao = area_terceiros`

O resultado final nunca ultrapassa `C2`, mesmo que o escore bruto indique `C3` ou `C4`.

### 6.4 Monitoramento exclusivo para fora da faixa

Quando `local_tipo = fora_faixa_servidao`, o sistema remove intervencoes fisicas e mantem apenas:
- Monitoramento visual periodico
- Registro fotografico de evolucao
- Notificacao ao proprietario

### 6.5 Filtro de solucoes de torre em acesso distante

Quando:
- contexto de acesso
- `distancia_estrutura_m >= 20`
- nao for contexto real de torre ou fundacao

O sistema remove solucoes especificas de protecao de torre.

## 7. Fluxo de Decisao

1. Classificar `T`, `P`, `D`, `S`, `E` e `A`.
2. Somar o score base.
3. Aplicar o modificador `V` quando houver impacto em via.
4. Converter o score final em `C1`, `C2`, `C3` ou `C4`.
5. Aplicar piso/teto contextuais.
6. Buscar solucoes pela combinacao de faixa + local + tipo.
7. Aplicar filtros contextuais de monitoramento ou remocao de solucoes.
8. Retornar:
   - `codigo`
   - `criticidade_classe`
   - `tipo_medida_recomendada`
   - `lista_solucoes_sugeridas`
   - `lista_solucoes_possiveis_intervencao`
   - `recomendacao_contextual`

## 8. Exemplos Rapidos

### Exemplo A - C2 com cap para monitoramento

Entrada:
- tipo_erosao: `sulco`
- profundidade_m: `6`
- declividade_graus: `12`
- tipo_solo: `argiloso`
- distancia_estrutura_m: `25`
- localizacao_exposicao: `area_terceiros`

Saida esperada:
- score final dentro de `C1/C2`
- `tipo_medida_recomendada = monitoramento`
- intervencoes aparecem apenas como opcionais

### Exemplo B - C4 rebaixado para C2 fora da faixa

Entrada:
- tipo_erosao: `movimento_massa`
- profundidade_m: `11`
- declividade_graus: `30`
- tipo_solo: `arenoso`
- distancia_estrutura_m: `3`
- local_tipo: `fora_faixa_servidao`
- localizacao_exposicao: `area_terceiros`
- sinais_avanco: `true`
- vegetacao_interior: `false`

Saida esperada:
- score bruto alto
- classificacao final = `C2`
- solucoes apenas de monitoramento

## 9. Observacoes de Uso

- O backend e a fonte canonica da criticidade.
- O frontend deve apenas exibir classes, score e recomendacoes retornadas pela engine.
- O campo `tiposFeicao` e single-select na UI, mas continua armazenado como array para retrocompatibilidade.
- Registros legados sem `criticalidade` V3 completa sao recalculados ao abrir o modal de detalhes.
