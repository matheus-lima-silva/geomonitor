import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select, Textarea } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { deleteUser, saveUser } from '../../../services/userService';
import { saveRulesConfig } from '../../../services/rulesService';
import {
  createReportTemplate,
  updateReportTemplate,
  deleteReportTemplate,
  activateReportTemplate,
} from '../../../services/reportTemplateService';
import {
  CRITICALITY_DEFAULTS,
  mergeCriticalityConfig,
  normalizeRulesConfig,
} from '../../shared/rulesConfig';
import { normalizeUserStatus } from '../../shared/statusUtils';

function AdminView({
  users,
  rulesConfig,
  searchTerm,
  templates = [],
  onTemplatesChange,
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [section, setSection] = useState('users');
  const [draftRules, setDraftRules] = useState(() => normalizeRulesConfig(rulesConfig || {}));
  const [criticalityText, setCriticalityText] = useState(() => JSON.stringify(
    mergeCriticalityConfig(rulesConfig?.criticalidade || CRITICALITY_DEFAULTS),
    null,
    2,
  ));

  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [userForm, setUserForm] = useState({
    id: '',
    nome: '',
    email: '',
    cargo: '',
    departamento: '',
    telefone: '',
    perfil: 'Utilizador',
    status: 'Pendente',
  });

  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    id: '',
    versionLabel: '',
    sourceKind: 'docx_base',
    notes: '',
  });

  useEffect(() => {
    setDraftRules(normalizeRulesConfig(rulesConfig || {}));
    setCriticalityText(JSON.stringify(
      mergeCriticalityConfig(rulesConfig?.criticalidade || CRITICALITY_DEFAULTS),
      null,
      2,
    ));
  }, [rulesConfig]);

  const canApproveUsers = user?.role === 'admin' || user?.role === 'manager';

  const filteredUsers = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase();
    if (!term) return users;
    return users.filter((item) => (
      String(item.nome || '').toLowerCase().includes(term)
      || String(item.email || '').toLowerCase().includes(term)
      || String(item.cargo || '').toLowerCase().includes(term)
    ));
  }, [users, searchTerm]);

  async function handleApproveUser(uid, status) {
    const existing = users.find((item) => item.id === uid);
    if (!existing) return;
    await saveUser(uid, { ...existing, status }, { updatedBy: user?.email });
    show(`Utilizador definido como ${status}.`, 'success');
  }

  async function handleDeleteUser(uid) {
    if (!window.confirm(`Excluir utilizador ${uid}?`)) return;
    await deleteUser(uid);
    show('Utilizador excluido.', 'success');
  }

  function openNewUser() {
    setUserForm({
      id: '',
      nome: '',
      email: '',
      cargo: '',
      departamento: '',
      telefone: '',
      perfil: 'Utilizador',
      status: 'Pendente',
    });
    setIsEditingUser(false);
    setIsUserFormOpen(true);
  }

  function openEditUser(existing) {
    setUserForm({
      id: String(existing?.id || ''),
      nome: String(existing?.nome || ''),
      email: String(existing?.email || ''),
      cargo: String(existing?.cargo || ''),
      departamento: String(existing?.departamento || ''),
      telefone: String(existing?.telefone || ''),
      perfil: String(existing?.perfil || 'Utilizador'),
      status: normalizeUserStatus(existing?.status || 'Pendente'),
    });
    setIsEditingUser(true);
    setIsUserFormOpen(true);
  }

  async function handleSaveUser() {
    const uid = String(userForm.id || '').trim();
    const nome = String(userForm.nome || '').trim();
    const email = String(userForm.email || '').trim();

    if (!uid || !nome || !email) {
      show('Preencha UID, nome e email.', 'error');
      return;
    }

    await saveUser(uid, {
      ...userForm,
      id: uid,
      nome,
      email,
      status: normalizeUserStatus(userForm.status),
    }, { updatedBy: user?.email });

    setIsUserFormOpen(false);
    show(isEditingUser ? 'Utilizador atualizado com sucesso.' : 'Utilizador criado com sucesso.', 'success');
  }

  async function handleSaveRules() {
    let parsedCriticality;
    try {
      parsedCriticality = mergeCriticalityConfig(JSON.parse(String(criticalityText || '{}')));
    } catch {
      show('JSON invalido em configuracao de criticidade.', 'error');
      return;
    }

    await saveRulesConfig({
      ...draftRules,
      criticalidade: parsedCriticality,
    }, { updatedBy: user?.email, merge: true });

    show('Regras salvas com sucesso.', 'success');
  }

  function openNewTemplate() {
    setTemplateForm({ id: '', versionLabel: '', sourceKind: 'docx_base', notes: '' });
    setIsEditingTemplate(false);
    setIsTemplateFormOpen(true);
  }

  function openEditTemplate(tpl) {
    setTemplateForm({
      id: String(tpl?.id || ''),
      versionLabel: String(tpl?.versionLabel || ''),
      sourceKind: String(tpl?.sourceKind || 'docx_base'),
      notes: String(tpl?.notes || ''),
    });
    setIsEditingTemplate(true);
    setIsTemplateFormOpen(true);
  }

  async function handleSaveTemplate() {
    const versionLabel = String(templateForm.versionLabel || '').trim();
    if (!versionLabel) {
      show('Preencha a versao do template.', 'error');
      return;
    }

    try {
      if (isEditingTemplate && templateForm.id) {
        await updateReportTemplate(templateForm.id, templateForm, { updatedBy: user?.email });
      } else {
        await createReportTemplate(templateForm, { updatedBy: user?.email });
      }
      setIsTemplateFormOpen(false);
      show(isEditingTemplate ? 'Template atualizado.' : 'Template criado.', 'success');
      onTemplatesChange?.();
    } catch (error) {
      show(error?.message || 'Erro ao salvar template.', 'error');
    }
  }

  async function handleActivateTemplate(tplId) {
    try {
      await activateReportTemplate(tplId);
      show('Template ativado.', 'success');
      onTemplatesChange?.();
    } catch (error) {
      show(error?.message || 'Erro ao ativar template.', 'error');
    }
  }

  async function handleDeleteTemplate(tplId) {
    if (!window.confirm('Remover este template?')) return;
    try {
      await deleteReportTemplate(tplId);
      show('Template removido.', 'success');
      onTemplatesChange?.();
    } catch (error) {
      show(error?.message || 'Erro ao remover template.', 'error');
    }
  }

  return (
    <section className="bg-white rounded-2xl shadow-[0_4px_18px_rgba(15,23,42,0.08)] p-5 mb-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 m-0">Administracao</h2>
          <p className="text-sm text-slate-500 mt-1">Gestao de utilizadores, criticidade e templates de relatorio.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant={section === 'users' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('users')}>Utilizadores</Button>
        <Button variant={section === 'rules' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('rules')}>Criticidade</Button>
        <Button variant={section === 'templates' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('templates')}>Templates</Button>
      </div>

      {section === 'users' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-start sm:justify-end gap-2">
            <Button variant="primary" size="sm" onClick={openNewUser}>
              <AppIcon name="plus" />
              Novo Utilizador
            </Button>
          </div>

          <div className="overflow-x-auto w-full bg-white rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Nome</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cargo</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Perfil</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700">{item.nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.cargo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{item.perfil || 'Utilizador'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{normalizeUserStatus(item.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditUser(item)}>
                          <AppIcon name="edit" />
                          Editar
                        </Button>
                        {canApproveUsers && normalizeUserStatus(item.status) === 'Pendente' && (
                          <>
                            <Button variant="primary" size="sm" onClick={() => handleApproveUser(item.id, 'Ativo')}>
                              <AppIcon name="check" />
                              Aprovar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleApproveUser(item.id, 'Inativo')}>
                              <AppIcon name="pause" />
                              Inativar
                            </Button>
                          </>
                        )}
                        <Button variant="danger" size="sm" onClick={() => handleDeleteUser(item.id)}>
                          <AppIcon name="trash" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-6 text-center text-sm text-slate-500">Nenhum utilizador encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'rules' && (
        <div className="flex flex-col gap-5">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 m-0 mb-1">Configuracao de criticidade (JSON)</h3>
            <p className="text-sm text-slate-500 mb-4">
              A metodologia V3 continua a mesma; aqui ajustamos apenas a configuracao canonica usada pelo motor.
            </p>
            <Textarea
              id="admin-criticality-json"
              rows={14}
              value={criticalityText}
              onChange={(event) => setCriticalityText(event.target.value)}
              className="min-h-[300px] font-mono mb-4"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 m-0">
                Estrutura esperada: `criticalidade.pontos`, `criticalidade.faixas` e `criticalidade.solucoes_por_criticidade`.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCriticalityText(JSON.stringify(mergeCriticalityConfig(CRITICALITY_DEFAULTS), null, 2))}
                >
                  <AppIcon name="reset" />
                  Restaurar padrao
                </Button>
                <Button variant="primary" onClick={handleSaveRules}>
                  <AppIcon name="save" />
                  Salvar regras
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {section === 'templates' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-start sm:justify-end gap-2">
            <Button variant="primary" size="sm" onClick={openNewTemplate}>
              <AppIcon name="plus" />
              Novo Template
            </Button>
          </div>

          <div className="overflow-x-auto w-full bg-white rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Versao</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tipo</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ativo</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Notas</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((tpl) => (
                  <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700">{tpl.versionLabel || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{tpl.sourceKind || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {tpl.isActive
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Ativo</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Inativo</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 max-w-[200px] truncate">{tpl.notes || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditTemplate(tpl)}>
                          <AppIcon name="edit" />
                          Editar
                        </Button>
                        {!tpl.isActive && (
                          <Button variant="primary" size="sm" onClick={() => handleActivateTemplate(tpl.id)}>
                            <AppIcon name="check" />
                            Ativar
                          </Button>
                        )}
                        <Button variant="danger" size="sm" onClick={() => handleDeleteTemplate(tpl.id)}>
                          <AppIcon name="trash" />
                          Excluir
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {templates.length === 0 && (
                  <tr>
                    <td colSpan="5" className="px-4 py-6 text-center text-sm text-slate-500">Nenhum template cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={isUserFormOpen}
        onClose={() => setIsUserFormOpen(false)}
        title={isEditingUser ? 'Editar Utilizador' : 'Novo Utilizador'}
        size="lg"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsUserFormOpen(false)}>
              <AppIcon name="close" />
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveUser}>
              <AppIcon name="save" />
              Salvar
            </Button>
          </>
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="user-uid"
            label="UID (Firebase Auth)"
            value={userForm.id}
            onChange={(event) => setUserForm((prev) => ({ ...prev, id: event.target.value.trim() }))}
            disabled={isEditingUser}
          />
          <Input
            id="user-nome"
            label="Nome"
            value={userForm.nome}
            onChange={(event) => setUserForm((prev) => ({ ...prev, nome: event.target.value }))}
          />
          <Input
            id="user-email"
            label="Email"
            type="email"
            value={userForm.email}
            onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
          />
          <Input
            id="user-cargo"
            label="Cargo"
            value={userForm.cargo}
            onChange={(event) => setUserForm((prev) => ({ ...prev, cargo: event.target.value }))}
          />
          <Input
            id="user-depto"
            label="Departamento"
            value={userForm.departamento}
            onChange={(event) => setUserForm((prev) => ({ ...prev, departamento: event.target.value }))}
          />
          <Input
            id="user-tel"
            label="Telefone"
            value={userForm.telefone}
            onChange={(event) => setUserForm((prev) => ({ ...prev, telefone: event.target.value }))}
          />
          <Select
            id="user-perfil"
            label="Perfil"
            value={userForm.perfil}
            onChange={(event) => setUserForm((prev) => ({ ...prev, perfil: event.target.value }))}
          >
            <option value="Utilizador">Utilizador</option>
            <option value="Gerente">Gerente</option>
            <option value="Administrador">Administrador</option>
          </Select>
          <Select
            id="user-status"
            label="Status"
            value={userForm.status}
            onChange={(event) => setUserForm((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="Pendente">Pendente</option>
            <option value="Ativo">Ativo</option>
            <option value="Inativo">Inativo</option>
          </Select>
        </div>
      </Modal>

      <Modal
        open={isTemplateFormOpen}
        onClose={() => setIsTemplateFormOpen(false)}
        title={isEditingTemplate ? 'Editar Template' : 'Novo Template'}
        size="md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsTemplateFormOpen(false)}>
              <AppIcon name="close" />
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSaveTemplate}>
              <AppIcon name="save" />
              Salvar
            </Button>
          </>
        )}
      >
        <div className="grid grid-cols-1 gap-4">
          <Input
            id="tpl-version"
            label="Versao"
            value={templateForm.versionLabel}
            onChange={(event) => setTemplateForm((prev) => ({ ...prev, versionLabel: event.target.value }))}
          />
          <Select
            id="tpl-source-kind"
            label="Tipo"
            value={templateForm.sourceKind}
            onChange={(event) => setTemplateForm((prev) => ({ ...prev, sourceKind: event.target.value }))}
          >
            <option value="docx_base">Base DOCX</option>
            <option value="override">Override</option>
          </Select>
          <Textarea
            id="tpl-notes"
            label="Notas"
            rows={3}
            value={templateForm.notes}
            onChange={(event) => setTemplateForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
        </div>
      </Modal>
    </section>
  );
}

export default AdminView;
