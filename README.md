# GeoMonitor

Aplicação React + Firebase para gestão de empreendimentos, vistorias multi-dia, checklist de torres e cadastro de erosões.

## Stack

- React + Vite
- Firebase Auth
- Firestore
- Hooks customizados e serviços por domínio

## Rodando localmente

1. Copie `.env.example` para `.env` e preencha credenciais do Firebase.
2. Instale dependências com `npm install`.
3. Execute `npm run dev`.

## Scripts

- `npm run dev`: ambiente local
- `npm run build`: build de produção
- `npm run test`: testes unitários (Vitest)
- `npm run test:watch`: testes unitários em watch mode

## Estrutura

```txt
src/
├── features/
│   └── projects/
│       ├── components/
│       ├── hooks/
│       ├── models/
│       ├── services/
│       └── utils/
├── layout/
├── services/
├── context/
├── views/
├── firebase/
└── App.jsx
```

## Migração em andamento

O projeto está em migração do `app.html` monolítico para `src/` modular.

- Base Firestore padronizada em `shared/geomonitor/*`.
- Módulo `Empreendimentos` já modularizado em `src/features/projects`.
- Módulo `Erosões` atualizado com:
  - relatório por empreendimento + ano opcional (vazio = todos os anos),
  - seleção multi-ano colapsável,
  - histórico em timeline com eventos manuais (Obra e Autuação),
  - exportação de detalhes da erosão em PDF (layout para impressão A4).
- Demais módulos permanecem em fase de migração.

## Smoke checklist

Checklist manual da fase atual em `docs/smoke-test-checklist.md`.
