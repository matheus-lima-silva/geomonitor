# Smoke Test Checklist (Migração src)

## Login
- [ ] Login válido abre dashboard modular.

## Empreendimentos
- [ ] Criar empreendimento manual com ID/Nome.
- [ ] Importar KML dentro de Novo/Editar e aplicar importação.
- [ ] Card sem KML mostra "Importar KML neste empreendimento".
- [ ] Card com KML mostra "Traçar rota" e oculta botão de importação.
- [ ] Abrir rota gera URL do Google Maps.

## Persistência
- [ ] Recarregar página e confirmar dados de empreendimentos persistidos.

## Erosões
- [ ] Exportar relatório com empreendimento + ano vazio e validar que traz todos os anos.
- [ ] Exportar relatório com ano único e validar filtro anual.
- [ ] Exportar relatório multi-ano (com painel expandido) e validar união dos anos.
- [ ] Abrir detalhe de erosão e verificar histórico em formato timeline.
- [ ] Adicionar evento manual de Obra (etapa + descrição) e confirmar persistência após recarregar.
- [ ] Adicionar evento manual de Autuação (órgão + nº/descrição + status) e confirmar persistência após recarregar.
- [ ] No detalhe da erosão, clicar em "Gerar PDF" e validar layout (Resumo + Criticidade + Histórico).
