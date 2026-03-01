# Contrato Futuro - POST /api/erosoes/calcular

## Status
Fase 2 (nao implementado em backend nesta etapa). O contrato abaixo ja e atendido localmente pelo adapter `postCalculoErosao(payload)` no frontend.

## Request
`POST /api/erosoes/calcular`

```json
{
  "feicao": {
    "tipo": "ravina",
    "profundidade_m": 1.2
  },
  "contexto_fisico": {
    "declividade_graus": 22,
    "tipo_solo": "argiloso",
    "sinais_avanco": true,
    "vegetacao_interior": false
  },
  "exposicao": {
    "distancia_estrutura_m": 8,
    "estrutura_proxima": "torre",
    "localizacao": "faixa_servidao"
  }
}
```

## Response
```json
{
  "campos_calculados": {
    "profundidade_classe": "P3",
    "tipo_erosao_classe": "T3",
    "declividade_classe": "D2",
    "solo_classe": "S2",
    "exposicao_classe": "E3",
    "pontos": { "T": 4, "P": 4, "D": 2, "S": 2, "E": 4 },
    "criticidade_score": 16,
    "criticidade_classe": "Alto",
    "codigo": "C3",
    "tipo_medida_recomendada": "corretiva_estrutural",
    "lista_solucoes_sugeridas": ["..."]
  },
  "alertas_validacao": ["..."]
}
```

## Regras
- Formula: `Score = T + P + D + S + E`.
- Faixas: `C1 0-7`, `C2 8-15`, `C3 16-23`, `C4 >=24`.
- Alertas sao nao bloqueantes.
