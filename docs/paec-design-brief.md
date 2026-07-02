# Brief de design — Módulo PAEC (portal relat)

> Este documento é o handover para o Claude Design (claude.ai/design). Cole o conteúdo abaixo numa conversa nova lá para gerar o handoff hi-fi (mockups + README de especificação), no mesmo formato que já produziu o módulo "Relatório Mensal de Acompanhamento dos Serviços" (`E:\Download\Relatorios.zip`, referenciado como handoff v2 no histórico do projeto).

---

## 1. Contexto de produto

O **GeoMonitor** é uma aplicação web para gestão de empreendimentos, vistorias, licenças e relatórios de inspeção em linhas de transmissão e usinas, usada pela equipe técnica da **AXIA Energia**. Dentro dele existe um segundo app, o **portal relat** (`relat.lima.rio.br`), dedicado a geração de relatórios e documentos institucionais — hoje com um módulo funcionando (Relatório Mensal de Acompanhamento) e este brief pede o design do **segundo módulo: PAEC**.

**PAEC** = Plano de Atendimento às Emergências da Central. É um documento regulatório extenso (60–80 páginas) que cada usina (UHE/PCH) da AXIA precisa manter atualizado, descrevendo brigada de emergência, contatos, procedimentos de resposta a incêndio/vazamento, rotas de fuga etc.

**O problema real que o módulo resolve**: hoje, atualizar o PAEC de uma usina é um trabalho manual no Word — pegar o modelo institucional mais recente, procurar à mão os ~80 trechos que mudam por usina (nome, CNPJ, endereço, telefones, nomes de responsáveis, siglas de gerência...) e substituir um por um, olhando um PAEC antigo para copiar os valores. É lento, sujeito a erro, e sem padronização entre usinas.

**A solução**: uma "ficha" no portal — uma tela com **título da chave → campo de valor**, agrupada por seção do documento — onde o engenheiro preenche os dados da usina uma vez. O sistema já sabe onde cada dado entra no modelo institucional (isso é resolvido no backend: o modelo Word foi "tokenizado", ou seja, cada trecho que varia virou um marcador interno). Ao terminar, o engenheiro clica em "Gerar PAEC" e baixa o `.docx` pronto, já formatado como o original — Verdana, cabeçalhos, tabelas, tudo preservado.

**Quem usa**: um punhado de engenheiros/técnicos internos da AXIA (dezenas de usuários, não milhares). É uma ferramenta de trabalho, não um produto público — prioriza clareza e velocidade de preenchimento sobre "wow visual".

---

## 2. Sistema de design a seguir (reuso obrigatório)

O portal relat **não usa a identidade visual AXIA** (aquela é só para o documento `.docx` gerado). A UI do portal segue o design system próprio do GeoMonitor. Este design precisa **reusar os primitivos existentes**, não inventar componentes novos.

**Paleta / tokens Tailwind** (nunca hex literal):
- `brand-50…brand-900` — cor primária/marca (`brand-600` = ação principal, `brand-50`/`brand-700` = estado ativo/seleção)
- Semânticas: `success`, `warning`, `danger`, `critical` (cada uma com variantes `.light`/`.border`/`.dark`), `info`
- Neutras: `slate-50…slate-900`, `neutral-50…neutral-900`
- Superfícies: `app-bg` (fundo geral), `app-surface` (cards/painéis), `app-surfaceMuted` (chips, inputs "filled")
- Sombras: `shadow-card`, `shadow-panel`, `shadow-modal`
- Raios: `rounded-sm|md|lg|xl|2xl`; componentes recentes usam `rounded-[10px]`/`rounded-[14px]`

**Tipografia**: sans padrão (sem fonte custom). Título de card `text-[1.05rem] font-bold`; título de hub `text-base font-semibold`; corpo `text-sm`; legendas `text-xs`; micro-labels `text-2xs font-bold uppercase tracking-wide`.

**Primitivos disponíveis** (todos já implementados — desenhe usando estes, não novos):
- `Button` (variants `primary|secondary|outline|ghost|danger`, sizes `sm|md|lg`)
- `Badge` (tones `ok|warning|danger|critical|neutral|info`)
- `Card` (variants `default|nested|flat`)
- `Input` / `Textarea` (Textarea tem variant `filled` — fundo `app-surfaceMuted`, vira branco no foco)
- `Select` / `SearchableSelect`
- `Modal` (sizes `sm|md|lg|xl|2xl`, fecha com Escape)
- `IconButton` (variants `ghost|outline|primary|danger|dangerGhost`)
- `ConfirmDeleteModal`, `HintText`, `RangeSlider`, `Skeleton`/`ListItemSkeleton`
- `PageHeader` (título + subtítulo + ação — é o que o hub do relat usa hoje)
- `EmptyState` (sempre ícone + título + descrição + ação)
- `Tabs`

**Ícones**: um único sistema (`AppIcon` + `ICON_MAP`) — aliases semânticos como `plus`, `save`, `trash-2`, `check`, `settings`, `download`, `chevron-down`, `clock`, `map-pin`, `alert-triangle`. Use nomes de ícone conceituais no mockup (ex. "ícone de check circular verde", "ícone de alerta triangular âmbar") — a implementação mapeia depois.

**Feedback**: toasts (sucesso/erro/info), nunca `alert()`. Confirmação destrutiva sempre em modal, nunca `confirm()` nativo.

### Referência: como o módulo irmão (Relatório Mensal) resolve os mesmos problemas de UI

Use como vocabulário visual, **adaptando ao PAEC onde os padrões abaixo não servem** (detalhado na seção 3):

- **Topbar de uma linha só**: tile de ícone da marca + nome do módulo → navegação de etapas → controles específicos do módulo → botão primary de ação principal → indicador de status de salvamento à direita.
- **`SaveStatus`** (`aria-live="polite"`, 4 estados): "Salvando…" (cinza) → "Salvo" (verde) → "Erro ao salvar" (vermelho) → "Salvamento automático" (cinza claro, estado ocioso).
- **Card de hub**: grid `sm:grid-cols-2 lg:grid-cols-3`; cada módulo é um `Card` com título, descrição de uma linha e botão "Abrir".
- **Card de seção do formulário**: borda `slate-300`, cantos arredondados, sombra suave, `padding` generoso; cabeçalho com chip circular numerado + título + subtítulo opcional.
- **Nav lateral/scroll-spy**: item ativo destacado (`bg-brand-50 text-brand-700`) conforme o scroll da coluna de conteúdo.
- Um dos módulos tem uma coluna de **preview A4 ao vivo do documento** — **o PAEC NÃO deve ter isso** (ver seção 3, motivo explicado).

---

## 3. Escopo desta rodada — o que desenhar e o que NÃO desenhar

Este é o **MVP (Fase 1)** do módulo. Já existe backend/API funcionando (rotas REST, autosave, versionamento, geração assíncrona do `.docx`). O que falta é **só a interface**. Desenhe:

✅ **Incluir nesta rodada:**
1. Card do módulo PAEC no hub do portal relat
2. Lista de usinas (fichas existentes) com indicador de completude
3. Criar nova usina (com opção de copiar campos de outra)
4. Editor da ficha — formulário dirigido por seções, campo = texto simples ou multilinha
5. Painel de pendências (o que falta preencher)
6. Fluxo de geração do documento (clicar, aguardar, baixar) + resultado com pendências que foram para o `.docx`
7. Estado de conflito de versão (outro usuário editou a mesma ficha)

❌ **Fora de escopo agora** (não desenhar, ou desenhar apenas como placeholder estático "em breve" se aparecer naturalmente no fluxo):
- Edição de **tabelas** (lista de brigadistas, recursos materiais, contatos externos etc.) — nesta fase esses blocos aparecem só como um item fixo no painel de pendências ("Relação de brigadistas — pendente, editar depois")
- Toggle de seções ligado/desligado (quais recursos internos a usina tem)
- Upload de **fotos/imagens/anexos** (mapa de localização, rota de fuga, diagrama unifilar — lista completa na seção 5.2) — nesta fase eles também entram como item fixo no painel de pendências, mas com um **ícone diferente das tabelas** (ícone de imagem/câmera, não de lista), porque o usuário vai perceber que "isso é upload de arquivo, não preenchimento de texto"
- Tela de administração do modelo institucional (upload de nova revisão do Word)

**Por que não tem preview A4 ao vivo como o outro módulo**: o PAEC tem 60–80 páginas — um preview de página ao vivo não compensa o custo de implementação nem ajuda o usuário a validar o preenchimento. Em vez disso, a coluna direita é ocupada pelo **painel de pendências**, que é o que realmente importa aqui: "o que ainda falta preencher antes de eu poder confiar neste documento".

---

## 4. Fluxos e telas

### 4.1 Hub do portal (alteração pequena numa tela existente)

Adicionar um terceiro card no grid do hub, ao lado do card "Relatório Mensal de Serviços" já existente:
- Título: "PAEC — Planos de Emergência"
- Descrição curta: algo como "Fichas de dados por usina e geração do Plano de Atendimento às Emergências atualizado."
- Botão "Abrir"

### 4.2 Lista de usinas

Tela inicial do módulo. Mostra as fichas já criadas.

- Cabeçalho com título "PAEC — Planos de Emergência", subtítulo com a revisão ativa do modelo (ex. "Modelo: OOSEMB.PL.003.2026 REV 10") e botão primary "Nova usina".
- Lista/grid de cards, um por usina, cada um mostrando:
  - Nome da usina (ex. "UHE Marimbondo", "PCH Anta")
  - **Barra ou anel de completude** (ex. "62 / 79 campos preenchidos" — pense em uma barra de progresso simples, não precisa ser um gráfico sofisticado)
  - Badge de pendências (ex. "17 pendências" em tom `warning`, ou tom `ok`/verde tipo "Completo" quando zero)
  - Data da última geração do documento (se já gerou alguma vez) ou "Nunca gerado"
  - Ação: abrir a ficha
- Estado vazio (nenhuma usina cadastrada ainda): `EmptyState` com call-to-action "Nova usina".

### 4.3 Cadastro de usina (criar nova ficha)

Isto substitui um modal simples de "só nome" — a usina é uma entidade que vale a pena identificar bem desde a criação, porque a lista de usinas (4.2) e o "copiar dados de..." ficam mais úteis com um mínimo de metadado. Pode ser um modal (`Modal size="md"`) ou uma mini-tela de 1 passo — não precisa de wizard multi-etapa.

**Campos do cadastro:**
- **Nome da usina** * — texto livre (ex. "UHE Marimbondo", "PCH Anta"). Obrigatório.
- **Tipo** — select (UHE / PCH / CGH / Subestação). *Este campo é uma proposta nova (ainda não existe no backend atual — é uma migração pequena e barata se o time topar); serve para a lista de usinas mostrar um badge/ícone por tipo e ajudar a filtrar quando houver muitas usinas cadastradas.* Se não for aprovado a tempo, tudo bem — o tipo já aparece embutido no nome (ex. "UHE ...", "PCH ...") e pode ser inferido visualmente.
- **Vincular a um empreendimento existente do GeoMonitor** — `SearchableSelect` opcional, busca nos empreendimentos já cadastrados no app principal (`projects` — hoje usado por linhas de transmissão, mas o campo já é genérico). Já existe suporte no backend (`projectId`). Sem seleção = "Nenhum vínculo" (padrão, a maioria das usinas ainda não tem um empreendimento correspondente cadastrado).
- **Copiar dados de...** — select opcional com as usinas PAEC já cadastradas (já existe no backend, `copyFromId`). Útil porque várias usinas compartilham a mesma gerência regional, contatos de plantão corporativo etc. — ver nota na seção 5.1 sobre quais campos tendem a repetir entre usinas de uma mesma regional.

Botões: Cancelar / Criar ficha (leva direto para o editor da ficha recém-criada, 4.4).

**Empty state da lista (4.2)** deve reforçar a mesma ideia: título "Nenhuma usina cadastrada ainda", descrição curta, botão que abre este mesmo cadastro.

### 4.4 Editor da ficha (tela principal)

Layout de duas colunas, como o módulo irmão, mas adaptado:

**Topbar** (uma linha):
- Nome da usina + chip mostrando a revisão do modelo em uso (ex. "REV 10")
- `SaveStatus` (mesmo padrão: salvando/salvo/erro/ocioso)
- Botão "Pendências" (abre/foca o painel — útil se ele for colapsável em telas menores)
- Botão primary "Gerar PAEC" (ícone de download; desabilitado durante geração, mostra spinner)

**Coluna esquerda/central (a maior, ~70% da largura)** — formulário dirigido por seções:
- Nav lateral fina ou scroll-spy no topo com as seções (ver lista de seções reais na seção 5 deste brief)
- Cada seção é um card (mesmo padrão do módulo irmão: cabeçalho com número + título) contendo uma lista de campos
- Cada campo é uma linha: **label = o título da chave** (ex. "Razão Social", "Endereço", "CNPJ") + um `Input` (ou `Textarea` quando o campo aceita múltiplas linhas, ex. endereços) com o valor
- Campo vazio/pendente deve ter uma pista visual sutil (ex. borda `warning` ou um pontinho âmbar ao lado do label) — sem ser alarmante, é normal ter campos vazios durante o preenchimento
- Ao lado de cada bloco não-editável nesta fase (7 tabelas + 3 anexos com imagem, listados nas seções 5.2 e 5.3), mostrar um card "achatado"/desabilitado com texto tipo "Relação de brigadistas — edição de tabela chega em breve. Por enquanto, ajuste direto no documento gerado." Use ícone de tabela para os blocos tabulares e ícone de imagem/câmera para os 3 anexos com foto — são pendências de natureza diferente (texto estruturado vs. upload de arquivo) e o usuário deve perceber isso de relance. Isso evita que o usuário ache que o campo sumiu.

**Coluna direita (fixa, ~30% da largura)** — **Painel de pendências**:
- Título "Pendências" com contador total (ex. "17 pendências")
- Lista agrupada por seção (ou por tipo: campos vazios / blocos manuais), cada item:
  - Ícone indicando o tipo (campo de texto vs. bloco de tabela vs. anexo manual)
  - Label do campo/bloco pendente
  - Clicável — ao clicar, rola a coluna do formulário até aquele campo e dá foco nele
- Quando zero pendências: estado de sucesso ("Ficha completa!" com ícone de check verde)

### 4.5 Fluxo de geração

1. Usuário clica "Gerar PAEC" na topbar
2. Botão entra em estado de carregamento (o job de geração no backend leva alguns segundos — é assíncrono, com polling)
3. Ao concluir, abre um **modal de resultado**:
   - Se zero pendências: mensagem de sucesso simples + botão "Baixar .docx"
   - Se houver pendências: mensagem tipo "O documento foi gerado, mas 17 itens ficaram marcados como pendentes dentro dele (destacados em amarelo)." + lista resumida das pendências + botão "Baixar .docx" (o download acontece de qualquer forma — pendências não bloqueiam a geração, só avisam)
4. Erro na geração: toast de erro, modal não abre

### 4.6 Conflito de versão (409)

Se dois usuários editam a mesma ficha ao mesmo tempo, o segundo save falha. Desenhar:
- Um banner de aviso no topo do editor (tom `warning`), algo como "Esta ficha foi alterada em outra sessão. Recarregue para ver a versão mais recente."
- Botão "Recarregar"
- Enquanto o banner estiver visível, o formulário fica em modo leitura (inputs desabilitados) até o usuário recarregar

---

## 5. Conteúdo real para os mockups

Use estes dados reais (extraídos do modelo institucional da UHE Marimbondo, a usina que serviu de base) para preencher os mockups com conteúdo verossímil — não use lorem ipsum, o preenchimento real ajuda a validar se o layout aguenta labels/valores longos.

O modelo institucional tem **83 campos de texto** ao todo (depois de uma correção de curadoria — três rótulos genéricos como "Nome"/"Endereço"/"E-mail" apareciam repetidos em tabelas diferentes e precisaram virar chaves distintas). Abaixo está o inventário completo, agrupado exatamente como as seções do formulário devem aparecer na ficha.

### 5.1 Inventário completo dos campos de texto

Legenda da coluna **Tipo**: `Valor` = o usuário digita algo que muda por usina · `Rótulo` = tecnicamente marcado como editável no modelo, mas é o texto fixo de uma coluna/linha de tabela (raramente alguém muda) — desenhar com a mesma `Input`, só não precisa de destaque especial · `Repetido` = o mesmo dado aparece em vários pontos do documento mas é **um campo só** na ficha (edita uma vez, aplica em todo lugar) · `Fixo` = título/trecho decorativo que tende a sair do formulário numa curadoria futura — inclua no mockup só se ajudar a mostrar como o formulário se comporta com uma seção "quase toda preenchida automaticamente", não é prioridade.

**Seção 1 — Capa e cabeçalho do documento** (8 campos)

| Label sugerido | Exemplo de valor | Tipo |
|---|---|---|
| Nome da usina | UHE Marimbondo | Repetido (~15x no corpo do texto) |
| Número do documento | Nº do Documento: OO\|SEMB.PL.003.2026 | Valor |
| Gerência regional (linha 1) | Gerência Regional O&M Minas Gerais | Valor |
| Gerência regional (linha 2 — sigla) | G SUDESTE – OO\|SEGSRM | Valor |
| Gerência de O&M da usina (linha 1) | GERÊNCIA DE O&M MARIMBONDO E | Valor |
| Gerência de O&M da usina (linha 2 — sigla) | P.COLÔMBIA G SUDESTE – OO\|SEGSRMMB | Valor |
| Regional de transmissão (linha 1) | REGIONAL O&M ES E MINAS T SE – OO\|SEPTRM | Valor |
| Regional de transmissão (linha 2) | O&M MINAS GERAIS T SUDESTE – OO\|SEPTRMMG | Valor |

> Nota de curadoria (não é problema seu, é conteúdo para o README): os nomes de gerência vêm partidos em 2 linhas porque a quebra de linha do cabeçalho da capa virou 2 campos em vez de 1 — na versão final provavelmente vira 1 campo multiline só.

**Seção 2 — Equipe técnica, aprovação e revisão** (11 campos — é visualmente uma pequena tabela "Órgão / Sigla / Responsável" repetida 2x no documento, com 4 linhas cada)

| Label sugerido | Exemplo de valor | Tipo |
|---|---|---|
| Gerência Regional (nome curto) | G Sudeste | Repetido |
| Sigla da Gerência Regional | OO\|SEGSRM | Repetido |
| Responsável — Gerência Regional | Roberto Teixeira Siniscalchi | Repetido |
| Gerência O&M (nome curto) | Gerência de O&M Marimbondo e P. Colômbia G Sudeste | Repetido |
| Sigla — Gerência O&M | OO\|SEGSRMMB | Repetido (7x no doc) |
| Responsável — Gerência O&M | Rodrigo Ferreira Moreno | Repetido (4x no doc) |
| Regional de Transmissão (nome curto) | Regional O&M ES e Minas T SE | Repetido |
| Sigla — Regional de Transmissão | OO\|SEPTRM | Repetido |
| Responsável — Regional de Transmissão | Anderson Prado Azevedo | Repetido |
| Equipe revisora — Meio Ambiente | Élvio Zampier de Abreu, Orlanilson da Silva Brito e Michele Melo Mendes | Valor (multiline, lista de nomes) |
| Equipe revisora — O&M | Rodrigo Ferreira Moreno, Douglas de Jesus Passos, Fabio Júnio de Faria | Valor (multiline) |

**Seção 3 — Objetivo e enquadramento** (7 campos — nome da usina embutido em frases institucionais fixas; alguns são parágrafos inteiros)

| Label sugerido | Exemplo de valor | Tipo |
|---|---|---|
| Nome completo (usina + subestação) | UHE e SE DE MARIMBONDO | Repetido |
| Objetivo — proteger instalações | Proteger as Instalações da UHE e SE DE MARIMBONDO; | Valor |
| Objetivo — manter imagem | Manter a Imagem e a Reputação da UHE e SE DE MARIMBONDO | Valor |
| Parágrafo — gerência responsável pela usina | "A Gerência de O&M Marimbondo e P. Colômbia G Sudeste - OO\|SEGSRMMB é responsável pela operação da Usina Hidrelétrica de Marimbondo, sendo esta subordinada à Gerência Regional O&M Minas Gerais G Sudeste - OO\|SEGSRM." | Valor (**Textarea**, parágrafo longo) |
| Parágrafo — gerência responsável pela subestação | "A O&M Minas Gerais T Sudeste – OO\|SEPTRMMG é responsável pela operação da SE de Marimbondo..." | Valor (**Textarea**, parágrafo longo) |
| Título — características físicas | CARACTERÍSTICAS FÍSICAS GERAIS DA USINA HIDRELÉTRICA e subestação DE marimbondo | Valor |
| Subtítulo 6.2 | A USINA HIDRELÉTRICA E SUBESTAÇÃO DE MARIMBONDO | Valor |

**Seção 4 — Identificação da instalação** (11 campos — a "ficha cadastral" clássica)

| Label sugerido | Exemplo de valor | Tipo |
|---|---|---|
| Razão Social | Usina Hidrelétrica de Marimbondo | Valor |
| Nome Fantasia | UHE DE MARIMBONDO | Valor |
| Endereço | Rodovia BR 153, km 245/246, Fronteira MG, Cep: 38.230-000 - Caixa postal: 25 | Valor (**Textarea**) |
| CNPJ | 00.001.180/0038-18 | Valor |
| Inscrição Estadual | *(vazio no exemplo — mostrar como campo pendente)* | Valor |
| Telefone 1 | (34) 99730-4626 (Sala de Controle) | Valor |
| Telefone 2 | (34) 3428-5295 (Portaria) | Valor |
| *(rótulos "Razão Social", "Nome Fantasia", "CNPJ (CGC/MF Nº)", "Telefone/Fax", "WEB", "Inscrição Estadual" também aparecem como campos próprios — são o texto da coluna da esquerda da tabela)* | — | Rótulo (4 campos) |

**Seção 5 — Representante legal (Usina)** (7 campos — bloco da pessoa responsável pela operação da usina)

| Label sugerido | Exemplo de valor |
|---|---|
| Nome | Rodrigo Ferreira Moreno |
| Endereço | Rua Gago Coutinho, 911, Apto 11, Higienópolis. São José do Rio Preto – SP |
| Telefone/Fax | (34) 3428-5320 |
| Celular corporativo | (21) 99401-5162 |
| E-mail | *(vazio no modelo original — bom exemplo de campo pendente no mockup)* |

**Seção 6 — Representante legal (Subestação)** (7 campos — mesmo formato, pessoa responsável pela subestação)

| Label sugerido | Exemplo de valor |
|---|---|
| Nome | Alessandro Antônio Medeiros Cardoso |
| Endereço | Av. Dido Fontes, 2355 - Jardim Tropical, Serra / ES, CEP 29.162-090 |
| Telefone comercial | (27) 3398-5210 |
| E-mail | acardoso@axia.com.br |

**Seção 7 — Dados técnicos / cenário de risco** (9 campos)

| Label sugerido | Exemplo de valor | Tipo |
|---|---|---|
| Cenário de maior risco (título) | Vazamento ou derramamento de óleo na UHE e SE DE MARIMBONDO | Valor |
| Descrição da hipótese de maior severidade | "A hipótese de maior severidade, mapeada na MAIA, identifica o derramamento de 95.814 L de óleo isolante, assim detalhado a seguir:" | Valor (**Textarea**) |
| Volume da pior hipótese | 95.814 L | Valor — **este é o campo mais "numérico" da ficha, vale destacar visualmente** |
| Gerência responsável (ação 10.4.4) | Gerência de O&M de Marimbondo – OO\|SEGSRMMB | Valor |
| Gerência responsável (ação 10.4.6) | Gerência da Operação de Meio Ambiente – OO\|SEMB | Valor |
| Local de realização dos simulados | UHE de Marimbondo; | Repetido |
| Título — ações de combate (geral) | AÇÕES DE COMBATE E ATENDIMENTO ÀS EMERGÊNCIAS | Valor |
| Título — ações de combate (usinas) | AÇÕES DE COMBATE E ATENDIMENTO ÀS EMERGÊNCIAS EM USINAS | Valor |

**Seção 8 — Fluxograma de acionamento** (11 campos — cargos/nomes/telefones que aparecem dentro do organograma da capa/anexo I; visualmente são caixinhas de organograma no `.docx`, mas na ficha são só linhas de texto normais)

| Label sugerido | Exemplo de valor |
|---|---|
| Cargo — Gerente da usina | GERENTE UHE DE MARIMBONDO |
| Telefone do gerente | (21) 99401 5162 |
| Nome do gerente | *(reaproveita o campo "Responsável — Gerência O&M" da Seção 2 — Rodrigo Ferreira Moreno)* |
| Cargo — Coordenador da BEM | BRIGADA DE EMERGÊNCIA – Coordenador da BEM |
| Telefone do coordenador BEM | Tel.: 17 98820-6833 |
| Nome do coordenador BEM | Nicola Prado |
| Local — sala de painéis | SALA DE PAINÉIS - ESCRITÓRIO CENTRAL |
| Telefone da sala de painéis | (34) 99730-4626 |
| Rótulo "Plantão" | Plantão |
| Sigla do plantão de segurança | CSSE.G |

**Textos fixos** (título de seção/tabela — 5 campos: "Sumário", "HISTÓRICO DE REVISÕES:", "IDENTIFICAÇÃO DA INSTALAÇÃO", e os 2 fragmentos do subtítulo "Plano de Atendimento às Emergências da Central (PAEC)"). Não precisa desenhar como destaque — são os candidatos naturais a sumir do formulário numa curadoria futura.

### 5.2 Anexos com foto/imagem (upload — fora de escopo de edição nesta fase, mas precisam aparecer identificados)

O modelo institucional tem **3 pontos confirmados** onde uma imagem real (foto/mapa/diagrama) muda por usina — hoje incorporados como imagem fixa no modelo (a da UHE Marimbondo), que uma usina nova precisaria substituir:

1. **Mapa de localização** (seção 6.6 "Localização", "Figura 1") — uma captura de satélite/Google Earth mostrando onde a usina fica. Uma imagem, alta resolução.
2. **Rota de fuga** (Anexo VII) — mapa/diagrama esquemático da rota de evacuação da instalação. Uma imagem.
3. **Diagrama unifilar** (Anexo X — "Arranjo das Instalações Físicas do Sistema Elétrico") — este é o mais complexo: no modelo da Marimbondo o diagrama elétrico vem **dividido em vários painéis de imagem** (ex. "Diagrama de Operação", "Auxiliares Geral AC", "Auxiliares Geral DC", "Auxiliares da Subestação" — pelo menos 4-6 imagens). Provavelmente vai precisar de um slot de "múltiplos anexos" em vez de um upload único.

Há ainda um **Anexo XI (Arranjo dos Sistemas de Drenagem)** que só faz referência a desenhos externos ("disponíveis no Portal da DO") — não tem imagem embutida no `.docx`, então não precisa de upload aqui.

**Para o design**: no painel de pendências (4.4) e no card "achatado" de bloco não-editável, esses 3 itens devem usar um **ícone de imagem/câmera** (diferente do ícone de tabela usado para brigadistas/recursos materiais), com texto tipo "Mapa de localização — upload de imagem chega em breve" / "Diagrama unifilar (múltiplas imagens) — chega em breve". Isso ajuda o usuário a entender que são dois tipos de pendência bem diferentes (preencher tabela vs. anexar arquivo).

### 5.3 Blocos "em breve" — tabelas (não editáveis nesta fase)

Para o card achatado mencionado em 4.4, ícone de lista/tabela:
- Relação de brigadistas (Anexo IV)
- Recursos materiais da BEM (Anexo V)
- Pontos de encontro
- Sistema Móvel de Extintores de Incêndio (12.1.9)
- Contatos internos de comunicação de emergência (Anexo II)
- Contatos externos de comunicação de emergência (Anexo II)
- Plantões das gerências de produção (Anexo II)

### 5.4 Números de exemplo para completude

O modelo real tem **83 campos de texto** + **3 anexos com imagem** + **7 blocos de tabela** = 93 itens rastreáveis ao todo. Use algo como "70 / 93 completos" para uma ficha quase pronta e "12 / 93 completos" para uma ficha recém-criada (uma usina nova provavelmente começa preenchendo primeiro a Seção 1 e 4 — identidade e endereço — antes do resto).

---

## 6. Entregável esperado

Mesmo formato do handoff anterior (Relatório Mensal): um pacote com mockups hi-fi das telas acima (desktop — é ferramenta interna, não precisa de versão mobile) + um README escrito descrevendo estados, variações e decisões de interação, pronto para servir de especificação de implementação em React + Tailwind reusando os primitivos listados na seção 2.

Se algo neste brief parecer incompleto ou ambíguo durante o design, é preferível fazer uma escolha razoável e documentar a decisão no README do que travar — a implementação depois adapta o necessário.
