# Smoke Test Report - 2026-02-22

Fonte: `docs/smoke-test-checklist.md`

Contexto desta execução:
- Testes automatizados e build executados via CLI.
- Fluxos de smoke abaixo exigem navegador autenticado e credenciais Firebase válidas.
- Status atual: **Pendente (execução manual necessária)**.

## Login
- [ ] Login válido abre dashboard modular. (Pendente)

## Empreendimentos
- [ ] Criar empreendimento manual com ID/Nome. (Pendente)
- [ ] Importar KML dentro de Novo/Editar e aplicar importação. (Pendente)
- [ ] Card sem KML mostra "Importar KML neste empreendimento". (Pendente)
- [ ] Card com KML mostra "Traçar rota" e oculta botão de importação. (Pendente)
- [ ] Abrir rota gera URL do Google Maps. (Pendente)

## Persistência
- [ ] Recarregar página e confirmar dados de empreendimentos persistidos. (Pendente)

## Erosões
- [ ] Exportar relatório com empreendimento + ano vazio e validar que traz todos os anos. (Pendente)
- [ ] Exportar relatório com ano único e validar filtro anual. (Pendente)
- [ ] Exportar relatório multi-ano (com painel expandido) e validar união dos anos. (Pendente)
- [ ] Abrir detalhe de erosão e verificar histórico em formato timeline. (Pendente)
- [ ] Adicionar evento manual de Obra (etapa + descrição) e confirmar persistência após recarregar. (Pendente)
- [ ] Adicionar evento manual de Autuação (órgão + nº/descrição + status) e confirmar persistência após recarregar. (Pendente)
- [ ] No detalhe da erosão, clicar em "Gerar PDF" e validar layout (Resumo + Criticidade + Histórico). (Pendente)
