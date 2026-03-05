# Backlog de Revisao de Testes para CI/CD

- Gerado em: `2026-03-05T02:38:22+00:00`
- Total de tarefas: `47`
- Status: TODO=37 | DOING=0 | BLOCKED=0 | DONE=10
- Camadas: backend=5 | frontend=42

| ID | Status | Prioridade | Camada | Framework | Dono | Arquivo de teste | Acao de revisao | Job CI sugerido |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TST-0001 | TODO | P1 | backend | jest |  | backend/__tests__/criticality.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-backend |
| TST-0002 | TODO | P1 | backend | jest |  | backend/__tests__/health.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-backend |
| TST-0003 | TODO | P1 | backend | jest |  | backend/__tests__/inspections.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-backend |
| TST-0004 | TODO | P1 | backend | jest |  | backend/__tests__/licenses.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-backend |
| TST-0005 | TODO | P1 | backend | jest |  | backend/__tests__/projects.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-backend |
| TST-0006 | TODO | P3 | frontend | vitest |  | src/components/ui/__tests__/Button.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0007 | TODO | P3 | frontend | vitest |  | src/components/ui/__tests__/Textarea.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0008 | TODO | P1 | frontend | vitest |  | src/features/erosions/components/__tests__/ErosionDetailsModal.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0009 | DONE | P2 | frontend | vitest | qa.platform | src/features/erosions/components/__tests__/ErosionFormModal.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0010 | TODO | P1 | frontend | vitest |  | src/features/erosions/components/__tests__/ErosionReportPanel.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0011 | DONE | P2 | frontend | vitest | qa.platform | src/features/erosions/components/__tests__/ErosionsView.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0012 | TODO | P3 | frontend | vitest |  | src/features/followups/components/__tests__/FollowupsView.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0013 | DONE | P2 | frontend | vitest | qa.platform | src/features/inspections/components/__tests__/InspectionDetailsModal.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0014 | TODO | P1 | frontend | vitest |  | src/features/inspections/components/__tests__/InspectionsView.wizard.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0015 | TODO | P1 | frontend | vitest |  | src/features/inspections/utils/__tests__/hotelHistory.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0016 | TODO | P1 | frontend | vitest |  | src/features/inspections/utils/__tests__/inspectionWorkflow.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0017 | TODO | P1 | frontend | vitest |  | src/features/inspections/utils/__tests__/planningGuideExport.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0018 | DONE | P2 | frontend | vitest | qa.platform | src/features/inspections/utils/__tests__/visitPlanning.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0019 | TODO | P1 | frontend | vitest |  | src/features/licenses/models/__tests__/licenseModel.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0020 | TODO | P1 | frontend | vitest |  | src/features/licenses/utils/__tests__/agencyOptions.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0021 | TODO | P1 | frontend | vitest |  | src/features/licenses/utils/__tests__/scheduleResolver.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0022 | TODO | P3 | frontend | vitest |  | src/features/monitoring/components/__tests__/TopPlanningAlert.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0023 | TODO | P2 | frontend | vitest |  | src/features/monitoring/utils/__tests__/monitoringViewModel.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0024 | TODO | P1 | frontend | vitest |  | src/features/projects/components/__tests__/KmlReviewModal.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0025 | TODO | P1 | frontend | vitest |  | src/features/projects/components/__tests__/ProjectsView.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0026 | TODO | P1 | frontend | vitest |  | src/features/projects/models/__tests__/projectModel.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0027 | DONE | P2 | frontend | vitest | qa.platform | src/features/projects/utils/__tests__/kmlUtils.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0028 | TODO | P1 | frontend | vitest |  | src/features/projects/utils/__tests__/projectKmlExport.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0029 | TODO | P1 | frontend | vitest |  | src/features/projects/utils/__tests__/projectStats.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0030 | TODO | P1 | frontend | vitest |  | src/features/projects/utils/__tests__/reportSchedule.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0031 | TODO | P1 | frontend | vitest |  | src/features/projects/utils/__tests__/routeUtils.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0032 | DONE | P1 | frontend | vitest | qa.platform | src/features/shared/__tests__/rulesConfig.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0033 | TODO | P2 | frontend | vitest |  | src/features/shared/__tests__/statusUtils.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0034 | TODO | P3 | frontend | vitest |  | src/layout/__tests__/AppShell.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0035 | TODO | P1 | frontend | vitest |  | src/models/__tests__/inspectionModel.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0036 | TODO | P2 | frontend | vitest |  | src/models/__tests__/projectModel.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0037 | TODO | P1 | frontend | vitest |  | src/services/__tests__/authService.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0038 | DONE | P1 | frontend | vitest | qa.platform | src/services/__tests__/erosionService.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0039 | TODO | P3 | frontend | vitest |  | src/services/__tests__/firestoreClient.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0040 | DONE | P1 | frontend | vitest | qa.platform | src/services/__tests__/inspectionService.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0041 | DONE | P1 | frontend | vitest | qa.platform | src/services/__tests__/projectService.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0042 | TODO | P3 | frontend | vitest |  | src/services/__tests__/rulesService.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0043 | TODO | P3 | frontend | vitest |  | src/services/__tests__/userService.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0044 | TODO | P2 | frontend | vitest |  | src/utils/__tests__/dateUtils.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0045 | TODO | P2 | frontend | vitest |  | src/utils/__tests__/parseTowerInput.test.js | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0046 | TODO | P3 | frontend | vitest |  | src/views/__tests__/DashboardView.monitoring.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
| TST-0047 | DONE | P2 | frontend | vitest | qa.platform | src/views/__tests__/SidebarReviewView.test.jsx | Validar determinismo, isolamento de mocks/estado e adequacao do teste ao job CI sugerido. | test-frontend |
