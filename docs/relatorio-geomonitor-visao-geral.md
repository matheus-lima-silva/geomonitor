# Relatório Institucional do GeoMonitor

## 1. Resumo Executivo

O GeoMonitor consolidou, em uma única plataforma web, atividades que antes dependiam de planilhas, registros dispersos, consultas manuais e acompanhamento fragmentado entre campo, licenciamento e gestão. O sistema hoje integra empreendimentos, licenças, planejamento de visitas, vistorias, cadastro técnico de erosões, cálculo de criticidade, monitorização operacional e governança de acesso.

Na prática, isso significa mais previsibilidade para a operação, melhor rastreabilidade para o time técnico e uma leitura executiva mais clara para a chefia. O ganho principal não está apenas na digitalização do processo, mas na capacidade de transformar informação operacional em decisão: o que precisa ser vistoriado, o que deve ser acompanhado, o que está atrasado, onde está o risco e qual frente exige atuação primeiro.

O GeoMonitor também já apresenta sinais concretos de maturidade técnica. A base atual opera com frontend e backend separados, regras canônicas de criticidade, autenticação e perfis de acesso, fluxos cobertos por testes automatizados e esteiras de CI/CD preparadas para publicação controlada. Isso posiciona o sistema não como uma prova de conceito, mas como uma base operacional evolutiva.

![Dashboard de monitorização do GeoMonitor](docs/assets/relatorio-geomonitor/dashboard.png)
Legenda: Painel executivo que centraliza indicadores de risco, agenda de entregas, obras em andamento e leitura espacial dos pontos críticos.

## 2. Por Que o GeoMonitor Foi Necessário?

Antes de uma plataforma integrada, a gestão de empreendimentos, vistorias e erosões tende a ficar distribuída entre documentos, mensagens, memórias de equipa e controles paralelos. Esse modelo dificulta a visão consolidada do processo e aumenta o esforço operacional para responder perguntas simples, como:

- quais empreendimentos exigem relatório no próximo ciclo;
- quais torres já foram vistoriadas e quais ainda exigem retorno;
- quais erosões merecem ação imediata;
- quais ocorrências já tiveram obra, monitorização ou encerramento;
- quais utilizadores podem editar, validar ou apenas consultar as informações.

O GeoMonitor foi estruturado justamente para reduzir essa fricção. O sistema cria uma linha contínua entre cadastro base, planejamento, execução de campo, leitura de risco e acompanhamento posterior. O resultado é menos retrabalho, menos perda de contexto e maior consistência entre o que é observado em campo e o que é reportado para gestão e licenciamento.

## 3. Como a Plataforma Funciona

### 3.1. Empreendimentos e KML

O módulo de empreendimentos organiza a base territorial do sistema. Cada linha ou corredor monitorado pode ser cadastrado com identificação, tensão, extensão, periodicidade de relatório e geometria associada. A importação e revisão de KML permitem estruturar torres e traçados com maior coerência espacial, o que melhora o planejamento posterior e reduz ambiguidades na leitura do campo.

Além de servir como cadastro mestre, esse módulo funciona como ponto de partida para outras rotinas do sistema. A partir dele, vistorias, licenças, roteirização e exportações passam a operar sobre uma referência comum, o que reduz inconsistências entre equipas.

![Tela de empreendimentos e base territorial](docs/assets/relatorio-geomonitor/projects.png)
Legenda: Cadastro central de empreendimentos com metadados operacionais, leitura de periodicidade e ações ligadas à base geográfica.

### 3.2. Licenças e Periodicidades

O GeoMonitor permite registrar Licenças de Operação com vigência, órgão ambiental, cobertura por empreendimento ou conjunto de torres e periodicidade de entregas. Essa camada aproxima o uso técnico do sistema das obrigações regulatórias efetivas, conectando o acompanhamento ambiental ao calendário de compromisso institucional.

Ao vincular escopo regulatório e rotina operacional, o sistema ajuda a antecipar entregas, evitar omissões e tornar mais transparente a origem de cada relatório programado.

![Tela de licenças de operação e cobertura](docs/assets/relatorio-geomonitor/licenses.png)
Legenda: Gestão centralizada de LOs com vínculo por empreendimento, vigência e cobertura operacional do escopo monitorado.

### 3.3. Planejamento de Visitas

No planejamento de visitas, o sistema organiza a seleção anual de torres, separa prioridades obrigatórias, amostragem e itens de menor urgência, além de aproveitar histórico operacional para sugerir apoio logístico. Isso transforma o planejamento de campo em uma etapa mais racional e documentada, evitando deslocamentos improvisados e reduzindo perda de eficiência.

Essa funcionalidade também serve como ponte entre intenção e execução. A seleção planejada pode ser reaproveitada diretamente na criação da vistoria, acelerando o fluxo e diminuindo erros de transcrição.

![Tela de planejamento de visita](docs/assets/relatorio-geomonitor/visit-planning.png)
Legenda: Planejamento anual com seleção de torres, critérios de prioridade e apoio logístico para a preparação de campo.

### 3.4. Vistorias

O módulo de vistorias foi pensado para representar a rotina real de campo. Ele suporta vistorias multi-dia, diário por torre, checklist detalhado e abertura integrada de erosões a partir do próprio fluxo de inspeção. Isso aumenta a rastreabilidade do que foi observado, em que dia e em qual contexto, sem exigir retrabalho posterior fora da plataforma.

Além do registro operacional, a vistoria também estrutura o histórico que alimenta outras leituras do sistema, como planejamento futuro, pendências por torre e contexto de cada ocorrência erosiva.

![Wizard de vistoria multi-dia](docs/assets/relatorio-geomonitor/inspections.png)
Legenda: Fluxo guiado de vistoria com diário por dia, checklist por torre e integração direta com o cadastro de erosões.

### 3.5. Erosões e Criticidade

O módulo de erosões concentra o cadastro técnico das ocorrências, o histórico de acompanhamento e a priorização por criticidade. A criticidade V3 é um dos diferenciais do GeoMonitor porque traduz múltiplas variáveis de campo em uma classificação objetiva, reprodutível e conectada à recomendação de ação.

Essa lógica evita que ocorrências distintas recebam o mesmo tratamento. Em vez de uma leitura apenas descritiva, o sistema apoia a priorização técnica e operacional, destacando onde a equipa deve monitorar, corrigir ou escalar intervenção de engenharia.

![Tela de erosões com criticidade e relatório](docs/assets/relatorio-geomonitor/erosions.png)
Legenda: Cadastro técnico de erosões com classificação de criticidade, leitura por empreendimento e preparação de relatórios e fichas.

### 3.6. Monitorização e Acompanhamentos

O dashboard e a área de acompanhamentos conectam o cadastro técnico à gestão cotidiana. O sistema consolida entregas próximas, obras em andamento, distribuição por criticidade, erosões recentes e registros operacionais por projeto e competência.

Com isso, o GeoMonitor deixa de ser apenas um repositório e passa a atuar como painel de gestão. A informação deixa de existir apenas para consulta retroativa e passa a orientar decisão, cobrança, follow-up e comunicação entre áreas.

![Tela de acompanhamentos operacionais](docs/assets/relatorio-geomonitor/followups.png)
Legenda: Acompanhamento de entregas e obras com status operacional, observações e registro contínuo de avanço.

### 3.7. Administração e Governança

A camada administrativa dá suporte à governança do sistema por meio de gestão de utilizadores, perfis de acesso e configuração canônica das regras de criticidade. Esse ponto é importante porque garante consistência institucional: quem pode editar, quem pode aprovar, quais regras são oficiais e qual base deve ser usada pela aplicação.

Em termos de sustentabilidade do produto, essa camada reduz dependência de ajustes informais e dá previsibilidade à operação da plataforma.

![Tela de administração e governança](docs/assets/relatorio-geomonitor/admin.png)
Legenda: Gestão de acessos e configuração canônica das regras que suportam a operação e a governança do sistema.

## 4. Arquitetura e Operação

O GeoMonitor adota uma arquitetura web modular com frontend em React e Vite, backend em Express e persistência apoiada em Firebase. A autenticação é protegida por token, com controlo de acesso baseado em perfil, e a API organiza recursos como projetos, licenças, inspeções, erosões, utilizadores, regras e acompanhamento de entregas.

Essa arquitetura separa responsabilidades com mais clareza. O frontend concentra experiência e fluxo operacional. O backend concentra regras, segurança, normalização e integração. A criticidade, por exemplo, deixa de depender de interpretações múltiplas e passa a operar a partir de uma base canônica.

O deploy está preparado para execução controlada no Fly.io, com pipeline de validação e verificação operacional. Isso reduz risco de publicação e cria uma base mais segura para continuidade do sistema.

- Frontend: React 18, Vite 5 e Tailwind CSS.
- Backend: Node.js e Express.
- Persistência e autenticação: Firebase.
- Segurança: RBAC, autenticação por token, `helmet`, `cors` controlado e `rate limit`.
- Implantação: Fly.io para web e API, com política operacional de máquina única em `gru`.

## 5. Evidências de Maturidade

O GeoMonitor já acumula evidências objetivas de maturidade técnica e operacional:

- 247 testes automatizados aprovados no frontend.
- 66 testes automatizados aprovados no backend.
- 313 testes aprovados na base atual.
- pipeline CI com validação separada para web e API;
- build de aplicação integrado à validação;
- deploy controlado com gate e verificação pós-publicação;
- backend dedicado para centralizar regras e serviços;
- padronização recente de UI e componentes reutilizáveis;
- documentação técnica de API, criticidade e operação de deploy.

Esses elementos são relevantes porque reduzem dependência de conhecimento tácito e tornam a evolução do sistema mais segura. A maturidade, nesse caso, não é apenas visual ou funcional: ela também aparece na capacidade de manter, validar e publicar o produto com menor risco.

## 6. Cenários Ilustrativos

### Cenário 1. Empreendimento, licença e entrega regulatória

O empreendimento é cadastrado com sua base territorial e periodicidade. A LO define escopo, vigência e mês de entrega. A área de acompanhamentos consolida o calendário, o status operacional e o histórico da entrega. Esse fluxo reduz perda de prazo e melhora a previsibilidade da gestão regulatória.

### Cenário 2. Planejamento, vistoria e registro de erosão

O planeamento seleciona torres prioritárias, a vistoria reutiliza essa seleção no diário de campo e o registo de erosão é aberto com contexto técnico já estruturado. O resultado é um fluxo mais rápido, menos manual e com rastreabilidade entre preparação, execução e cadastro da ocorrência.

### Cenário 3. Dashboard, priorização e acompanhamento de obra

O dashboard destaca criticidades, prazos e ocorrências relevantes. A partir daí, a equipa pode abrir o detalhe da erosão, acompanhar evolução, registrar etapa de obra e manter a chefia informada sobre o andamento. Esse encadeamento transforma dados operacionais em acompanhamento gerencial contínuo.

## 7. Evolução e Consolidação do GeoMonitor

O GeoMonitor vem se consolidando por camadas. Primeiro, estruturou a base de dados operacional. Em seguida, ampliou o alcance funcional para planejamento, acompanhamento e governança. Depois, reforçou a coerência técnica com backend dedicado, regras canônicas de criticidade e documentação mais consistente.

Entre os avanços mais relevantes desta fase, destacam-se:

- consolidação da arquitetura modular por domínio funcional;
- formalização do backend e da API de apoio;
- unificação da engine de criticidade V3;
- monitorização integrada de entregas e obras;
- amadurecimento da base de testes;
- preparação de pipeline de CI/CD e deploy controlado;
- esforço recente de padronização visual e de componentes.

Esse conjunto indica que o sistema já ultrapassou o estágio de ferramenta pontual. Ele caminha para se tornar a base institucional de apoio à gestão operacional e ambiental do processo monitorado.

## 8. Conclusões e Recomendações

O GeoMonitor já entrega valor concreto ao centralizar informação, reduzir dispersão operacional e apoiar a priorização de risco. O sistema aproxima campo, gestão e licenciamento em um fluxo mais rastreável, previsível e auditável.

Como próximos passos recomendados, faz sentido:

- consolidar o uso da plataforma como referência única para acompanhamento operacional;
- continuar a fortalecer a qualidade dos dados de entrada, especialmente em campo;
- ampliar o uso dos módulos de acompanhamento para gestão rotineira e não apenas consulta pontual;
- manter a disciplina de testes, deploy controlado e documentação técnica;
- seguir evoluindo relatórios, exportações e indicadores executivos.

Em síntese, o GeoMonitor já se apresenta como uma plataforma útil, tecnicamente consistente e com potencial claro de consolidação institucional.

## 9. Glossário

- Empreendimento: unidade base monitorada no sistema, normalmente uma linha, corredor ou ativo associado.
- LO: Licença de Operação vinculada ao escopo regulatório acompanhado.
- Vistoria: registro estruturado da atividade de campo, podendo abranger mais de um dia.
- Torre: referência operacional e espacial usada para organizar planeamento, vistoria e ocorrências.
- Erosão: ocorrência técnica cadastrada com dados de contexto, localização e estado.
- Criticidade: classificação que traduz risco e prioridade de ação a partir de critérios técnicos.
- Monitorização: leitura consolidada de risco, prazos, obras e evolução operacional.
- Acompanhamento: atualização contínua de entregas, obras e histórico de ação.
- RBAC: controlo de acesso baseado em perfis, usado para restringir o que cada utilizador pode fazer.
- CI/CD: esteira de validação e publicação que reduz risco operacional na evolução do sistema.
