# GeoMonitor — Visao Geral do Sistema

## 1. O Problema

O monitoramento de erosoes em faixas de servidao de linhas de transmissao envolve centenas de pontos distribuidos por multiplos empreendimentos, campanhas de vistoria periodicas, licencas de operacao (LO) com validade e cobertura geografica especificas, e um ciclo continuo de inspecoes, relatorios e recomendacoes tecnicas.

Antes do GeoMonitor, esse controle era feito de forma dispersa: planilhas Excel independentes por empreendimento, documentos Word com descricoes de campo, fotos sem vinculacao direta ao cadastro, e historicos de criticidade sem padronizacao. O resultado era retrabalho, dificuldade de rastreabilidade e risco de perda de informacao critica.

---

## 2. O que e o GeoMonitor

GeoMonitor e uma aplicacao web centralizada para gestao de empreendimentos, erosoes, vistorias, licencas de operacao e **producao de relatorios tecnicos** em linhas de transmissao de energia.

O sistema substitui documentos espalhados por um banco de dados unico, com interface visual, historico completo, calculo automatico de criticidade e pipeline integrado de curadoria de fotos → composicao → entrega versionada — permitindo que equipes tecnicas e gestores tomem decisoes com base em dados consolidados e rastreaveis.

---

## 3. Modulos Principais

| Modulo | O que faz |
|---|---|
| **Empreendimentos** | Cadastro dos projetos de LT com importacao de traçado KML, lista de torres e dados de identificacao |
| **Erosoes** | Cadastro, edicao e acompanhamento de pontos erosivos; calculo automatico de criticidade V3; historico de evolucao; exportacao de dados |
| **Vistorias** | Planejamento e registro de campanhas de campo multi-dia; diario por torre; controle de pendencias |
| **Licencas de Operacao (LO)** | Gestao de LOs por empreendimento com cobertura de torres e alertas de vencimento |
| **Acompanhamento** | Historico de eventos e evolucao de cada ponto erosivo ao longo do tempo |
| **Workspaces de Relatorio** | Pipeline completo de producao: upload direto de KMZ/fotos → curadoria por torre → composicao DOCX → entrega versionada e imutavel. Lixeira com retencao e arquivamento automatico. Ver [modulo-reports.md](modulo-reports.md) |
| **Entrega de Relatorios** | Registro mensal de entregas por empreendimento (separado do pipeline de producao) |
| **Dossies de Projeto** | Compilacao de licencas, erosoes e relatorios em dossies exportaveis para auditoria |
| **Monitoramento** | Dashboard com alertas de planejamento, status de torres curadas e metricas operacionais |
| **Administracao** | Gestao de usuarios, perfis de acesso, signatarios e configuracao de regras de criticidade |

---

## 4. Motor de Criticidade V3

O diferencial tecnico central do GeoMonitor e a **engine de criticidade V3**: um algoritmo que classifica automaticamente cada erosao em quatro niveis de risco (C1 a C4) com base em seis dimensoes tecnicas:

| Dimensao | O que avalia |
|---|---|
| **T** — Tipo de erosao | Laminar, sulco, ravina, vocoroca ou movimento de massa |
| **P** — Profundidade | Metros de profundidade da feicao |
| **D** — Declividade | Inclinacao do terreno em graus |
| **S** — Tipo de solo | Lateritico, argiloso, solos rasos ou arenoso |
| **E** — Exposicao | Distancia da erosao ate a estrutura/torre |
| **A** — Atividade erosiva | Presenca de sinais de avanco e cobertura vegetal |

Alem do score base (soma das seis dimensoes), o sistema aplica um **modificador contextual** para erosoes em vias de acesso exclusivas, considerando grau de obstrucao, tipo de impacto e disponibilidade de rota alternativa.

### Faixas de Criticidade

| Codigo | Classe | Score | Acao recomendada |
|---|---|---|---|
| C1 | Baixo | 0 – 9 | Medidas preventivas |
| C2 | Medio | 10 – 18 | Correcao leve |
| C3 | Alto | 19 – 27 | Intervencao estrutural |
| C4 | Muito Alto | >= 28 | Engenharia / PRAD |

O sistema tambem aplica **politicas contextuais automaticas**:
- Erosoes em area de terceiros recebem teto de C2 e solucoes de monitoramento
- Erosoes na base de torre com vocoroca/movimento de massa nunca ficam abaixo de C3
- A lista de solucoes tecnicas recomendadas e gerada automaticamente com base na faixa e no contexto

---

## 5. Perfis de Usuario

### Perfis globais

| Perfil | O que pode fazer |
|---|---|
| **Admin/Administrador** | Acesso total: usuarios, configuracoes, todos os dados e todos os workspaces |
| **Gerente** | Acesso editorial completo com visao gerencial; ve todos os workspaces |
| **Editor** | Criar e editar empreendimentos, erosoes, vistorias e licencas; so ve workspaces em que for membro |
| **Visualizador** | Leitura de dados sem edicao |

### Papeis locais por workspace

Alem do perfil global, workspaces de relatorio aplicam RBAC fino:

| Papel local | Acesso |
|---|---|
| **owner** | Leitura, escrita e gestao de membros (nao pode ser removido se for o ultimo owner) |
| **editor** | Leitura e escrita (curadoria, upload, composicao) |
| **viewer** | Apenas leitura |

Usuarios Admin/Gerente veem todos os workspaces independentemente de serem membros. Demais usuarios so veem os workspaces em que estao listados na tabela `workspace_members`.

---

## 6. Beneficios

- **Centralizacao**: todos os dados de empreendimentos, erosoes, vistorias e producao de relatorios em um unico sistema
- **Rastreabilidade**: historico completo de cada ponto erosivo; entregas versionadas e imutaveis com SHA256; ciclo de vida das fotos auditado (ativa → lixeira → arquivada)
- **Padronizacao**: metodologia de criticidade unica aplicada de forma consistente a todos os projetos
- **Agilidade de campo**: formularios estruturados com tooltips de orientacao, diario de vistoria por torre, alertas de pendencia e feedback visual de torres totalmente curadas
- **Suporte a decisao**: recomendacoes tecnicas automaticas, exportacao de dados, visualizacao em mapa e dashboards operacionais
- **Seguranca**: controle de acesso por perfis globais + RBAC fino por workspace; autenticacao JWT propria com bcrypt; auditoria de alteracoes

---

## 7. Tecnologias

O sistema e uma aplicacao web moderna, acessivel pelo navegador, sem necessidade de instalacao:

- **Interface**: React 18 + Vite com mapas interativos (Leaflet) e graficos (Recharts)
- **Banco de dados**: PostgreSQL gerenciado (Fly Managed Postgres em producao)
- **Autenticacao**: JWT propria com bcrypt (access + refresh tokens, reset por email)
- **Storage de midia**: AWS S3 / Tigris com signed URLs (upload direto do navegador para o bucket)
- **API backend**: Node.js / Express 5 (servidor dedicado, ~20 routers HATEOAS)
- **Worker**: processador assincrono de jobs (composicao DOCX, processamento KMZ, exports)
- **Infraestrutura**: Docker + Fly.io com pipeline de CI/CD automatizado por ambiente (homologacao/producao)

---

## 8. Limitacoes Atuais

- Integracao com sistemas corporativos (SAP, GIS empresarial) nao implementada.
- Relatorios sao gerados em DOCX e entregues manualmente; nao ha integracao automatica com sistemas de protocolo externos.
- Auditoria detalhada de alteracoes (quem editou o que, quando) e limitada a campos `updated_by`/`updated_at` em cada registro — nao ha log de mudancas por campo.
