# Metodologia de Calculo de Criticidade — V3

**Documento tecnico | GeoMonitor — Monitoramento de Erosoes em Linhas de Transmissao**

---

## 1. Introducao e Objetivo

O sistema de classificacao de criticidade tem por finalidade atribuir, de forma objetiva e reprodutivel, um grau de urgencia a cada ponto erosivo identificado ao longo de faixas de servidao de linhas de transmissao (LT). A classificacao orienta a priorizacao de intervencoes, a definicao de prazos de retorno para inspecao e a selecao de solucoes tecnicas adequadas.

A versao 3 (V3) unifica as dimensoes de avaliacao em uma escala balanceada, elimina divergencias entre frontend e backend presentes em versoes anteriores e introduz modificadores contextuais para situacoes especificas de vias de acesso.

---

## 2. Formula de Calculo

O escore de criticidade e obtido pela soma de seis dimensoes independentes, acrescida de modificadores contextuais quando aplicaveis:

```
Score = T + P + D + S + E + A + modificadores contextuais
```

Onde:

| Simbolo | Dimensao                        |
|---------|---------------------------------|
| T       | Tipo de erosao                  |
| P       | Profundidade                    |
| D       | Declividade                     |
| S       | Tipo de solo                    |
| E       | Exposicao (distancia da estrutura) |
| A       | Sinais de avanco / atividade    |

Cada dimensao possui quatro classes, pontuadas em **0, 2, 4 ou 6**, totalizando um escore base maximo de **36 pontos**. Modificadores contextuais podem acrescentar pontos adicionais conforme descrito na Secao 5.

---

## 3. Tabela Completa de Dimensoes

### T — Tipo de Erosao

| Classe | Descricao                    | Pontuacao |
|--------|------------------------------|-----------|
| T1     | Laminar                      | 0         |
| T2     | Sulco                        | 2         |
| T3     | Ravina                       | 4         |
| T4     | Vocoroca / Movimento de massa | 6         |

### P — Profundidade

| Classe | Descricao   | Pontuacao |
|--------|-------------|-----------|
| P1     | <= 1 m      | 0         |
| P2     | > 1 – 10 m  | 2         |
| P3     | > 10 – 30 m | 4         |
| P4     | > 30 m      | 6         |

### D — Declividade

| Classe | Descricao  | Pontuacao |
|--------|------------|-----------|
| D1     | < 10°      | 0         |
| D2     | 10 – 25°   | 2         |
| D3     | 25 – 45°   | 4         |
| D4     | > 45°      | 6         |

### S — Tipo de Solo

| Classe | Descricao    | Pontuacao |
|--------|--------------|-----------|
| S1     | Lateritico   | 0         |
| S2     | Argiloso     | 2         |
| S3     | Solos rasos  | 4         |
| S4     | Arenoso      | 6         |

### E — Exposicao (Distancia da Estrutura)

| Classe | Descricao  | Pontuacao |
|--------|------------|-----------|
| E1     | > 50 m     | 0         |
| E2     | 20 – 50 m  | 2         |
| E3     | 5 – 20 m   | 4         |
| E4     | < 5 m      | 6         |

### A — Sinais de Avanco / Atividade

| Classe | Descricao                                   | Pontuacao |
|--------|---------------------------------------------|-----------|
| A1     | Vegetacao no interior, sem sinais de avanco  | 0         |
| A2     | Sem vegetacao, sem sinais de avanco          | 2         |
| A3     | Avanco com presenca de vegetacao             | 4         |
| A4     | Avanco ativo, sem vegetacao                  | 6         |

---

## 4. Faixas de Criticidade

O escore base maximo e **36** (6 dimensoes x 6 pontos). As faixas de criticidade sao definidas como:

| Faixa | Classificacao | Escore       | Prazo de retorno | Abordagem                |
|-------|---------------|--------------|------------------|--------------------------|
| C1    | Baixo         | 0 – 9        | 24 meses         | Preventiva               |
| C2    | Medio         | 10 – 18      | 12 meses         | Corretiva leve           |
| C3    | Alto          | 19 – 27      | 6 meses          | Corretiva estrutural     |
| C4    | Muito Alto    | >= 28        | 3 meses          | Engenharia / PRAD        |

---

## 5. Modificadores Contextuais

### 5.1 Via de Acesso

Quando o ponto erosivo afeta diretamente uma via de acesso, aplica-se um modificador adicional ao escore base. O valor do modificador varia de **+1 a +4** conforme a severidade da situacao, sendo limitado (cap) a **+4 pontos**.

| Condicao                                                          | Modificador |
|-------------------------------------------------------------------|-------------|
| `grauObstrucao = total`                                           | +3          |
| `grauObstrucao = parcial` e `rotaAlternativaDisponivel = false`   | +2          |
| `grauObstrucao = parcial` e `rotaAlternativaDisponivel = true`    | +1          |
| `tipoImpactoVia = ruptura_plataforma`                             | +2          |
| `estadoVia = terra`                                               | +1          |

Os modificadores sao **cumulativos** entre si, porem o total acumulado e limitado a **+4**, independentemente da combinacao de condicoes observadas.

### 5.2 Cap de Monitoramento

Para pontos classificados como **C1 ou C2** que se encontrem em **area de terceiros** ou com declividade **D1 ou D2**, a recomendacao e restrita a **monitoramento apenas**, sem intervencao fisica.

### 5.3 Filtro de Torre

Quando o contexto de acesso indica que o ponto erosivo esta distante de uma torre, as solucoes especificas de torre (por exemplo, protecao de fundacao, reforco de estai) sao removidas do conjunto de recomendacoes.

### 5.4 Piso Minimo C3

Um piso minimo de **C3 (Alto)** e aplicado automaticamente quando as tres condicoes a seguir sao satisfeitas simultaneamente:

1. O ponto erosivo esta em **base de torre**;
2. O tipo de erosao e **vocoroca ou movimento de massa** (T4);
3. A distancia da estrutura e **inferior a 5 m** (E4).

Nesse caso, mesmo que o escore calculado resulte em C1 ou C2, a classificacao final e elevada para C3.

### 5.5 Teto C2 para Fora da Faixa de Servidao

Quando o ponto erosivo esta **fora da faixa de servidao** (`local_tipo = fora_faixa_servidao`) e em **area de terceiros** (`localizacao_exposicao = area_terceiros`), a classificacao final nunca ultrapassa **C2 (Medio)**, mesmo que o escore bruto indique C3 ou C4.

Justificativa: erosoes fora da faixa de servidao nao afetam diretamente a linha de transmissao e a responsabilidade pela intervencao e do proprietario do terreno. O monitoramento pela equipe de manutencao e suficiente.

### 5.6 Monitoramento Exclusivo para Fora da Faixa

Quando `local_tipo = fora_faixa_servidao`, o sistema remove todas as solucoes de intervencao fisica e mantem apenas:

- Monitoramento visual periodico;
- Registro fotografico de evolucao;
- Notificacao ao proprietario.

---

## 6. Regra Especial — Via de Acesso (Dimensao E)

A dimensao **E (Exposicao)** possui regras especiais quando o ponto erosivo esta associado a uma via de acesso:

- **posicao = leito**: a erosao ocorre no proprio leito da via. Nesse caso, a classe **E4** e atribuida automaticamente, com distancia considerada igual a **zero**.

- **posicao = talude**: a erosao ocorre no talude adjacente a via. A distancia e medida a partir da borda da erosao ate a **borda da plataforma da via**, aplicando-se as faixas normais da dimensao E.

---

## 7. Solucoes Tecnicas por Faixa

O sistema utiliza um banco de 27 solucoes tagueadas (`SOLUCOES_DATABASE`), filtradas por tres eixos: **faixa de criticidade** (C1–C4), **local** (faixa_servidao, via_acesso_exclusiva, base_torre, fora_faixa_servidao) e **tipo de erosao** (laminar, sulco, ravina, vocoroca, movimento_massa). A funcao `getSolutionsForContext()` retorna apenas as solucoes aplicaveis ao contexto especifico de cada ponto erosivo. Abaixo, exemplos representativos por faixa.

### C1 — Baixo (Preventiva)

- Plantio de gramineas e cobertura vegetal;
- Cordoes de nivel em curva;
- Canaletas de drenagem superficial;
- Monitoramento periodico (24 meses).

### C2 — Medio (Corretiva Leve)

- Recomposicao vegetal com especies nativas;
- Barreiras de contencao com material biodegradavel (palha, fibra de coco);
- Dissipadores de energia em saidas de drenagem;
- Reperfilamento de talude com compactacao leve;
- Monitoramento periodico (12 meses).

### C3 — Alto (Corretiva Estrutural)

- Gabiao em caixa ou colchao reno;
- Muro de arrimo em concreto ciclope ou solo-cimento;
- Retaludamento com corte e aterro compactado;
- Sistema de drenagem profunda (drenos sub-horizontais);
- Geomantas e biomantas em taludes reperfilados;
- Monitoramento periodico (6 meses).

### C4 — Muito Alto (Engenharia / PRAD)

- Projeto de engenharia especifico (ART/RRT);
- Cortina atirantada ou solo grampeado;
- Estabilizacao geotecnica com estacas ou micropilares;
- PRAD — Plano de Recuperacao de Areas Degradadas;
- Obras de drenagem profunda e superficial combinadas;
- Monitoramento periodico (3 meses) com instrumentacao geotecnica.

---

## 8. Cenarios de Referencia

### Cenario 1 — C4 Extremo

| Dimensao | Classe | Descricao             | Pontuacao |
|----------|--------|-----------------------|-----------|
| T        | T4     | Vocoroca              | 6         |
| P        | P4     | > 30 m                | 6         |
| D        | D3     | > 25°                 | 4         |
| S        | S4     | Arenoso               | 6         |
| E        | E4     | < 5 m                 | 6         |
| A        | A4     | Avanco ativo          | 6         |
| **Total**|        |                       | **34**    |

Classificacao: **C4 — Muito Alto** (>= 28).

### Cenario 2 — C4 Limiar

| Dimensao | Classe | Descricao             | Pontuacao |
|----------|--------|-----------------------|-----------|
| T        | T4     | Vocoroca              | 6         |
| P        | P2     | 5 m                   | 2         |
| D        | D2     | 15°                   | 2         |
| S        | S4     | Arenoso               | 6         |
| E        | E4     | < 5 m                 | 6         |
| A        | A4     | Avanco ativo          | 6         |
| **Total**|        |                       | **28**    |

Classificacao: **C4 — Muito Alto** (>= 28).

### Cenario 3 — C3

| Dimensao | Classe | Descricao             | Pontuacao |
|----------|--------|-----------------------|-----------|
| T        | T3     | Ravina                | 4         |
| P        | P2     | 5 m                   | 2         |
| D        | D2     | 15°                   | 2         |
| S        | S3     | Solos rasos           | 4         |
| E        | E3     | 10 m                  | 4         |
| A        | A3     | Avanco parcial        | 4         |
| **Total**|        |                       | **20**    |

Classificacao: **C3 — Alto** (19–27).

### Cenario 4 — C2

| Dimensao | Classe | Descricao             | Pontuacao |
|----------|--------|-----------------------|-----------|
| T        | T2     | Sulco                 | 2         |
| P        | P2     | 3 m                   | 2         |
| D        | D2     | 12°                   | 2         |
| S        | S2     | Argiloso              | 2         |
| E        | E2     | 30 m                  | 2         |
| A        | A2     | Indeterminado         | 2         |
| **Total**|        |                       | **12**    |

Classificacao: **C2 — Medio** (10–18).

### Cenario 5 — C1

| Dimensao | Classe | Descricao             | Pontuacao |
|----------|--------|-----------------------|-----------|
| T        | T1     | Laminar               | 0         |
| P        | P1     | 0,5 m                 | 0         |
| D        | D1     | 5°                    | 0         |
| S        | S1     | Lateritico            | 0         |
| E        | E1     | 60 m                  | 0         |
| A        | A1     | Estabilizado          | 0         |
| **Total**|        |                       | **0**     |

Classificacao: **C1 — Baixo** (0–9).

### Cenario 6 — Via de Acesso com Modificador

| Dimensao | Classe | Descricao                   | Pontuacao |
|----------|--------|-----------------------------|-----------|
| T        | T4     | Movimento de massa           | 6         |
| P        | P2     | 10 m                        | 2         |
| D        | D2     | 20°                         | 2         |
| S        | S4     | Arenoso                     | 6         |
| E        | E4     | Leito (E4 automatico)       | 6         |
| A        | A4     | Avanco ativo                | 6         |
| **Subtotal base** |  |                       | **28**    |

Modificador de via de acesso: obstrucao total = **+3**.

**Escore final: 28 + 3 = 31**

Classificacao: **C4 — Muito Alto** (>= 28).

---

## 9. Glossario

| Termo                | Definicao |
|----------------------|-----------|
| **Vocoroca**         | Feicao erosiva de grande porte, com profundidade superior a 1,5 m e paredes verticais ou subverticais, frequentemente associada a afloramento do lencol freatico. |
| **Ravina**           | Feicao erosiva intermediaria, mais profunda que sulcos, com incisao linear bem definida no terreno, porem sem atingir o nivel freatico. |
| **Sulco**            | Incisao linear rasa no solo, causada por escoamento superficial concentrado, com profundidade tipicamente inferior a 0,5 m. |
| **Laminar**          | Remocao uniforme e difusa de camadas superficiais do solo pela acao de escoamento nao concentrado ou impacto de gotas de chuva. |
| **Movimento de massa** | Deslocamento de volume significativo de solo ou rocha encosta abaixo por acao gravitacional, incluindo deslizamentos, escorregamentos e fluxos. |
| **Deslizamento**     | Tipo de movimento de massa em que a massa de solo ou rocha se desloca ao longo de uma superficie de ruptura bem definida. |
| **Escorregamento**   | Movimento rapido de massa de solo saturado ao longo de superficies de ruptura planares ou curvas, frequentemente deflagrado por eventos pluviometricos intensos. |
| **Fluxo de lama**    | Movimento de massa com alta concentracao de agua, no qual o material se comporta como fluido viscoso, com grande alcance e velocidade. |
| **Lateritico**       | Solo tropical altamente intemperizado, rico em oxidos de ferro e aluminio, com boa estruturacao e elevada resistencia a erosao. |
| **Argiloso**         | Solo com predominancia de particulas finas (< 0,002 mm), com alta plasticidade e coesao, porem suscetivel a saturacao e selamento superficial. |
| **Solos rasos**      | Solos com pequena espessura sobre a rocha ou horizonte impenetravel, com baixa capacidade de armazenamento hidrico e elevada suscetibilidade a erosao. |
| **Arenoso**          | Solo com predominancia de particulas grossas (0,05–2 mm), com baixa coesao, alta permeabilidade e elevada erodibilidade. |
| **PRAD**             | Plano de Recuperacao de Areas Degradadas — documento tecnico exigido por legislacao ambiental que detalha as acoes necessarias para restauracao de areas impactadas. |

---

## 10. Historico de Versoes

| Versao | Descricao |
|--------|-----------|
| **V1** | Versao legado. Utilizava 5 dimensoes com escalas inconsistentes entre si (intervalos de pontuacao variavam por dimensao). Nao contemplava sinais de avanco como dimensao independente. |
| **V2** | Introducao da separacao backend/frontend, porem com divergencia entre os modulos. O backend utilizava as dimensoes T/P/D/S/E (com S = solo). O frontend utilizava T/P/D/S(sinaisAvanco)/E, substituindo o tipo de solo por sinais de avanco. Essa divergencia causava inconsistencias nos calculos dependendo do ponto de entrada. |
| **V3 (atual)** | Unificacao completa. Seis dimensoes independentes — T/P/D/S/E/A — com balanceamento uniforme de 0 a 6 pontos em todas as dimensoes. Introducao do modificador de via de acesso, regras especiais para posicao leito/talude, piso minimo C3, cap de monitoramento e filtro de torre. Engine unica de calculo compartilhada entre backend e frontend. |

---

*Documento gerado para o projeto GeoMonitor.*
