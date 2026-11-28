# Plano: fichas de erosao, acessos, geodados e risco

> Criado em 2026-11-27. Origem: revisao da ficha `ERS-1795822284739` (ARAPCA T104, ravina no acesso) e do KMZ de acessos das linhas de Pocos de Caldas (STPCA, exportado do MAPS.ME).

Cada fase vira um PR proprio, com teste e atualizacao de [../api-backend.md](../api-backend.md) quando houver rota nova. Mudancas de metodologia entram como **V3.1** em [../metodologia-criticidade-v3.md](../metodologia-criticidade-v3.md), valendo so para cadastros e edicoes novas.

## Fase 0 — Correcoes imediatas

1. **Legendas da ARAPCA T104**: aplicar as legendas revisadas na ficha `ERS-1795822284739` e nas fotos do workspace `RW-1795811069623`.
2. **Data do historico de criticidade**: o historico usa a data do save quando o payload nao traz data de vistoria (a ARAPCA saiu com 27/11 em vez de 13/11). Passar a usar a data da vistoria vinculada (dia em que a torre foi vistoriada, senao inicio da vistoria) e corrigir o registro afetado.
3. **Mapa do formulario de erosao** (`ErosionFormModal`):
   - o `key` do `MapContainer` dependia do ponto, entao cada clique ou digito recriava o mapa e perdia o zoom; o mapa passa a ser estavel e so recentraliza quando muda a torre/projeto ou quando o ponto sai da tela;
   - camadas Satelite (Esri), Relevo (OpenTopoMap) e OSM, com zoom ate 19;
   - marcador do GPS da foto sempre visivel, mesmo quando coincide com o ponto da erosao.

Rotulos e faixas de medida em escala de via ficam na Fase 2 (dependem da V3.1).

**Status (2026-11-27)**:

- Legendas aplicadas direto no banco (payload + coluna `caption` das fotos e `fotosPrincipais` da erosao); backup em `~/arapca_captions_backup_20261127.tsv` na VM.
- Historico: `resolveInspectionDateForTower` (shared) + busca da vistoria no save. Registro da ARAPCA corrigido para 13/11. Restam **229 entradas em 40 erosoes** com a data do save fora do periodo da vistoria (inclui recalculos em lote) — corrigir ou nao fica para decisao.
- Mapa: `ErosionMapViewport` (viewport estavel, pan com debounce, `invalidateSize` + `setView({ reset: true })` quando a etapa oculta fica visivel — antes o mapa abria descentralizado e com os rotulos das torres por cima do ponto). Satelite Esri com zoom nativo ate 18 (em z19 a regiao nao tem imagem).
- Achado lateral: no `nginx.conf` do frontend, o `add_header` dentro de `location = /index.html` descarta os headers do nivel `server`, entao o CSP e demais headers de seguranca nao chegam na pagina. O `img-src` ja inclui os hosts de tiles (OpenTopoMap, Esri) para quando isso for corrigido.

## Fase 1 — Geometrias via KML/KMZ/GPX

### 1a. Tracado da erosao (na ficha)

**Status (2026-11-27)**: feito em `feat/erosao-fase1a-geometria` — parser KML/KMZ/GPX (`src/features/erosions/utils/geometryFile.js`, testado com o KMZ do Google Earth da ARAPCA T104 e o KMZ de 1.294 linhas do MAPS.ME/STPCA), metricas (`geometryMetrics.js`), painel `ErosionGeometryImport` no passo Localizacao (escolha do elemento ordenada pela distancia a torre; botoes de sugestao: ponto do tracado mais perto da torre, centro do tracado, extensao afetada), desenho no mapa do formulario e do detalhe, validacao Zod. **Adiado**: coluna PostGIS gerada (vai junto com as tabelas geograficas da 1b), distancia a torre medida ate o tracado no backend, geometria no PDF da ficha e no KMZ exportado.

- Importar ponto, linha ou poligono (ex.: KMZ do trecho erodido da ARAPCA T104, linha de 184 m).
- `geometria` (GeoJSON) + `geometriaOrigem` (arquivo, placemark) no payload; comprimento, area e perimetro derivados e sugeridos para a extensao afetada.
- Schema Zod aceita o campo (sem quebrar o `/simulate`, ver acoplamento save/simulate); coluna PostGIS gerada + GIST.
- Distancia a torre medida ate o tracado; botao "usar ponto do tracado".
- Geometria no PDF da ficha e no KMZ exportado.

### 1b. Tracado do acesso (no cadastro do empreendimento)

**Status (2026-11-27)**: base feita em `feat/erosao-fase1b-acessos` — migracao `0032` (`tower_accesses`, `osm_roads`, `osm_road_loads`), `scripts/loadOsmRoads.js` (Overpass em grade fixa so em volta das torres, com retentativa, espelho e retomada), previa/gravacao/edicao/remocao em `/api/projects/:id/accesses`, modal "Acessos" no card do empreendimento (importacao, revisao com filtros e alertas, mapa colorido, repintura por clique, substituir ou adicionar). Validado em banco de rascunho no homelab: carga de 21 ladrilhos (ARAPCA, CAMPCA, PCAABA, PCAIJU) = 96.005 vias em ~30 min (Overpass lento); previa do KMZ STPCA (1.294 linhas, 2.195 km) em ~23 s, amostra de 20 m: 324 acessos de torre / 238 rotas-guia / 732 ignorados para PCAIJU; 125 torres com acesso, trecho de acesso mediano 376 m. **Pendente**: carregar o OSM em producao apos o deploy (migracao + `node scripts/loadOsmRoads.js --all --apply`), mostrar o acesso da torre no mapa da ficha de erosao, KMZ colorido para o celular, tracado estimado pelas fotos de acesso.

- **Entradas**, todas para a tabela `tower_accesses`:
  - arquivo com varios acessos (ex.: KMZ STPCA: 1.294 linhas, 2.195 km);
  - arquivo com um acesso, pela ficha ou pela torre;
  - trilha gravada na visita (KMZ do MAPS.ME com `LineString` ou `gx:Track`; favoritos no caminho viram candidatos a erosao/observacao);
  - sem trilha: tracado estimado pelas fotos de acesso do workspace (marcado como estimado).
- Parser aceita o namespace antigo `earth.google.com/kml/2.2` e o `ExtendedData` do MAPS.ME.
- **Ligacao com a torre pela geometria** (ponta da linha mais proxima da torre); os nomes do MAPS.ME ("Acessos DOPD.O", "Caminho sem titulo", "Route") nao servem.
- **Classificacao por trecho, sem cortar a linha**: cada trecho e pintado como
  - **asfalto** (via publica pavimentada no OSM),
  - **estrada de terra** (via publica nao pavimentada no OSM),
  - **acesso** (fora de qualquer via publica do OSM).

  No STPCA: 564 km de asfalto, 918 km de terra, 713 km de acesso; mediana de 2 trechos por linha. Sem tag `surface`, o tipo vem do tipo de via (rodovias/ruas = asfalto; `unclassified` = terra) e fica marcado como inferido.
- Linhas sem ponta em torre do empreendimento (rotas longas, "Route") viram **rota-guia**: camada do empreendimento, sem virar acesso de torre. Linhas longe de qualquer torre podem ser ignoradas.
- **Tela de revisao antes de gravar**: mapa, torre sugerida, trechos coloridos repintaveis com um clique (correcao manual persiste mesmo apos atualizar o OSM), aceite em lote das linhas sem duvida.
- Tracado novo para torre que ja tem acesso: substitui ou vira outro acesso.
- **Extrato do OSM** (vias publicas do Sudeste) no PostGIS, atualizado periodicamente; lista configuravel de classes publicas; credito ODbL ("© OpenStreetMap contributors").
- Usos: mapa da ficha, encaixe da erosao no tracado (terra/acesso; asfalto fica de fora), pre-preenchimento de "A torre tem outro acesso?", planejador de rota.
- **Exportar KMZ colorido** (asfalto/terra/acesso) para abrir no MAPS.ME ou Google Earth em campo.
- Renumeracao de torres: acessos entram na mesma rotina de remapeamento de fotos e erosoes.

## Fase 2 — Ficha orientada a trafegabilidade (V3.1)

**Status (2026-11-27)**: feito em `feat/erosao-fase2-trafegabilidade` (empilhada sobre a 1b) — engine V3.1 em `backend/utils/criticality.js` (escala de via, profundidade inferida, pisos C3/C4, +1 sulco longitudinal, alertas, `metodologia_versao`), bloco "Condicao de trafego" e "Foi possivel medir a erosao?" na ficha, faixas em cm, largura da plataforma/largura livre com sugestao de obstrucao, orientacao do sulco, "A torre tem outro acesso?" sugerido pelo cadastro de acessos, acesso da torre desenhado no mapa da ficha, distancia em acesso = ate a borda da via (sem trocar pela distancia a torre). Documentado na secao 6.1 da metodologia. **Pendente**: posicao em relacao a fundacao, causa/origem da agua, papel das fotos, alertas de consistencia de extensao vs GPS das fotos; os campos novos usam os primitivos (rotulo em caixa alta) e os antigos ainda nao — unificar na Fase 9.

**Bloco 1, logo apos local e torre — condicao de trafego** (responde-se mesmo sem trena):

1. "A caminhonete passa?": passa / passa com dificuldade / nao passa.
2. "Da para desviar no local?" e "A torre tem outro acesso?" (pre-preenchida pelos acessos cadastrados).
3. "Foi possivel medir a erosao?": Sim, com trena / So no olho (estimativa) / Nao foi possivel medir.

**Bloco 2 — medidas** (opcionais quando o bloco 1 esta respondido), em escala de via quando o local e acesso:

- Profundidade: P1 <= 10 cm / P2 10-25 cm / P3 25-50 cm / P4 > 50 cm (vao livre de caminhonete ~20-25 cm).
- Largura da plataforma e largura comprometida; largura livre < 3,0 m sugere obstrucao total, 3,0-3,5 m parcial.
- Distancia a borda (talude): E4 < 1 m / E3 1-3 m / E2 3-5 m / E1 > 5 m. Leito continua E4 automatico.
- Orientacao do sulco: longitudinal (trilha de roda) ou transversal (degrau).
- Extensao vinda do KMZ ou do encaixe no acesso.

**Criticidade**:

- Sem medida, P e inferida da resposta de trafego (nao passa = P4, com dificuldade = P3, passa = P1), marcada como inferida.
- Piso C3 quando a caminhonete nao passa; piso C4 quando nao passa, sem desvio e sem outro acesso.
- Aviso quando resposta e medida se contradizem.

**Outros campos**: posicao em relacao a fundacao, causa/origem da agua, drenagem, papel de cada foto (geral, detalhe, escala, montante, jusante) com legenda montada a partir dele, alertas de consistencia (profundidade vazia em estagio avancado, extensao incompativel com o GPS das fotos, datas).

## Fase 3 — Bases ambientais publicas

| Tema | Base | Resolucao |
|---|---|---|
| Relevo | ANADEM (UFRGS/ANA); TOPODATA (INPE) como alternativa | 30 m |
| Solo (classe) | IBGE BDiA Pedologia | 1:250.000 |
| Solo (textura) | MapBiomas Solo, colecao 3 (textura em beta) | 30 m |
| Erodibilidade (K) | Embrapa, Mapa de Erodibilidade dos Solos do Brasil; UFMS/JRC 250 m | 1:500.000 |
| Erosividade (R) | REDB-BR (Zenodo) | raster |
| Uso e cobertura | MapBiomas Colecao (anual) | 30 m |
| Drenagem | ANA BHO | vetor |

Recorte na area dos lotes (bbox dos empreendimentos + 5 km). Rasters em COG no MinIO (`geodata/`), vetores no PostGIS (`geo_ref`), tabela `geodata_sources` com versao, licenca e data. Script de ingestao em `worker/tools/`.

## Fase 4 — Atributos por torre e por acesso

- Tabela `tower_environment` (projeto + numero da torre + payload + fontes + data), calculada pelo worker num buffer de ~50 m da torre e ao longo dos trechos de terra/acesso: altitude, declividade media/maxima, orientacao, curvatura, LS, indice topografico de umidade, classe de solo, textura, K, R, uso atual e mudanca em 5 anos, distancia a drenagem, perfil de rampa do acesso.
- API `GET /projects/:id/tower-environment` e `POST` de recalculo.
- Aba "Meio fisico" no empreendimento.

## Fase 5 — Sugestoes na ficha e seletor de torre

- Clique no mapa sugere a torre mais proxima; camadas de declividade, solo e uso.
- Cartao de sugestoes ao escolher a torre; a ficha guarda a origem de cada valor (base publica ou campo).
- Declividade do ponto exato consultada no terreno (endpoint no worker).
- Correspondencia classe IBGE -> tipo de solo da ficha (Neossolo Quartzarenico = arenoso; Argissolo com alerta de mudanca textural abrupta).

## Fase 6 — Suscetibilidade (RUSLE)

- A = R . K . LS . C . P por torre, por vao e por acesso (C pelo uso MapBiomas; P = 1 de inicio).
- Ranking e mapa de calor ao lado da criticidade V3, sem substitui-la.
- Validacao contra as erosoes cadastradas (AUC).

## Fase 7 — Modelo estatistico

- Base de treino: torre x vistoria, rotulo com/sem erosao vindo das vistorias (excluir recalculos em lote, ~44% do historico de criticidade).
- Regressao logistica e random forest com validacao cruzada por linha; saida em `tower_risk` (probabilidade + importancia dos fatores).
- Comeca quando houver algumas centenas de torres vistoriadas.

## Fase 8 — Risco dinamico

- Chuva acumulada (Open-Meteo, ja integrado, ou CHIRPS) x suscetibilidade -> alerta de "vistoriar apos evento" no cronograma.
- Depois: solo exposto novo pelo NDVI do Sentinel-2.

## Fase 9 — Revisao e melhoria do frontend

Pedido do usuario (2026-11-27). Melhor momento: logo depois das Fases 1b e 2, que concentram a interface nova (painel de tracado, modal de acessos, ficha reordenada); pode ser repetida no fim das Fases 5 e 6.

- **Auditoria das telas novas e alteradas** contra [../ui/ui-audit-report.md](../ui/ui-audit-report.md) e `src/CLAUDE.md`: primitivos, tokens, `AppIcon`, toasts, acessibilidade (foco, `aria-*`, teclado nas listas selecionaveis).
- **Uso em campo**: formulario de erosao e modal de acessos no celular/tablet (layout em coluna, alvos de toque, mapa em tela cheia), leitura ao sol (contraste), conexao fraca.
- **Mapas**: padronizar camadas (satelite/relevo/OSM) e legenda num componente unico reutilizado no formulario, no detalhe da erosao e nos acessos; zoom pela roda do mouse dentro de modais rolaveis (hoje rolar a pagina por cima do mapa da zoom).
- **Desempenho**: listas grandes (KMZ com ~1.300 linhas, ~1.400 torres) com virtualizacao/paginacao; desenho no mapa em canvas; tempo de importacao e de previa medido.
- **Fluxos**: ordem das perguntas da ficha (bloco de trafegabilidade primeiro), mensagens de erro e estados vazios, desfazer em acoes destrutivas, consistencia de rotulos PT-BR.
- **Saida**: lista priorizada de ajustes com prints antes/depois, entrada no `ui-audit-report.md` e PRs pequenos por tela.

## Decisoes em aberto

- Como servir rasters no mapa (tiles pre-gerados ou servidor de tiles tipo TiTiler).
- Termos de uso do basemap de satelite da Esri.
- Buffer de analise por torre (50 m?).
- Quem pode recalcular atributos (editor ou admin).
- Recalcular ou nao as fichas antigas na V3.1.

## Decisoes tomadas

- Ponto de corte/classificacao dos acessos pelo OSM (vias publicas), com cores asfalto/terra/acesso em vez de cortar.
- Pergunta de medicao: "Foi possivel medir a erosao?".
- Sugestoes vindas de bases publicas sao sempre sugestao, nunca preenchimento silencioso (mesma regra do GPS da foto).
