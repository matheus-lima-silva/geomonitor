import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, ConfirmDeleteModal, Input, Modal, Select, Textarea } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { deleteUser, saveUser, sendUserResetEmail } from '../../../services/userService';
import { saveRulesConfig } from '../../../services/rulesService';
import {
  CRITICALITY_DEFAULTS,
  mergeCriticalityConfig,
  normalizeRulesConfig,
} from '../../shared/rulesConfig';
import { normalizeUserStatus } from '../../shared/statusUtils';
import SignaturesSection from './SignaturesSection';
import WorkspacesAccessSection from './WorkspacesAccessSection';
import UsageStatsSection from './UsageStatsSection';

function AdminView({
  users,
  rulesConfig,
  searchTerm,
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
  const [retentionDays, setRetentionDays] = useState(() => (
    Number(rulesConfig?.retencao?.lixeira_para_arquivo_dias) || 30
  ));

  const [isUserFormOpen, setIsUserFormOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
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

  useEffect(() => {
    setDraftRules(normalizeRulesConfig(rulesConfig || {}));
    setCriticalityText(JSON.stringify(
      mergeCriticalityConfig(rulesConfig?.criticalidade || CRITICALITY_DEFAULTS),
      null,
      2,
    ));
    setRetentionDays(Number(rulesConfig?.retencao?.lixeira_para_arquivo_dias) || 30);
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

  function handleDeleteUser(uid) {
    setDeleteConfirm(uid);
  }

  async function handleConfirmDeleteUser() {
    await deleteUser(deleteConfirm);
    setDeleteConfirm(null);
    show('Utilizador excluido.', 'success');
  }

  async function handleSendReset(uid) {
    try {
      await sendUserResetEmail(uid);
      show('Email de reset enviado.', 'success');
    } catch {
      show('Falha ao enviar email de reset.', 'error');
    }
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

  async function handleSaveRetention() {
    const parsed = Number(retentionDays);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3650) {
      show('Informe um numero inteiro entre 1 e 3650 dias.', 'error');
      return;
    }
    try {
      await saveRulesConfig(
        { retencao: { lixeira_para_arquivo_dias: parsed } },
        { updatedBy: user?.email, merge: true },
      );
      show('Retencao atualizada com sucesso.', 'success');
    } catch (error) {
      show(error?.message || 'Falha ao salvar retencao.', 'error');
    }
  }

  return (
    <section className="bg-white rounded-xl shadow-[0_4px_18px_rgba(15,23,42,0.08)] p-5 mb-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 m-0">Gerenciamento</h2>
          <p className="text-sm text-slate-500 mt-1">Gestao de utilizadores, assinaturas, acessos a workspaces, criticidade e metricas.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant={section === 'users' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('users')}><AppIcon name="user" />Utilizadores</Button>
        <Button variant={section === 'signatures' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('signatures')}><AppIcon name="edit" />Assinaturas</Button>
        <Button variant={section === 'workspaces-access' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('workspaces-access')}><AppIcon name="projects-nav" />Acessos a Workspaces</Button>
        <Button variant={section === 'rules' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('rules')}><AppIcon name="shield" />Criticidade</Button>
        <Button variant={section === 'retencao' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('retencao')}><AppIcon name="clock" />Retencao</Button>
        <Button variant={section === 'stats' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('stats')}><AppIcon name="dashboard-nav" />Estatisticas</Button>
      </div>

      {section === 'users' && (
        <div className="flex flex-col gap-4">
          <div className="flex justify-start sm:justify-end gap-2">
            <Button variant="primary" size="sm" onClick={openNewUser}>
              <AppIcon name="plus" />
              Novo Utilizador
            </Button>
          </div>

          <Card variant="flat" className="overflow-x-auto w-full !p-0">
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
                        {canApproveUsers && normalizeUserStatus(item.status) !== 'Inativo' && (
                          <Button variant="outline" size="sm" onClick={() => handleSendReset(item.id)}>
                            <AppIcon name="mail" />
                            Reset
                          </Button>
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
          </Card>
        </div>
      )}

      {section === 'signatures' && (
        <SignaturesSection users={users} searchTerm={searchTerm} />
      )}

      {section === 'workspaces-access' && (
        <WorkspacesAccessSection />
      )}

      {section === 'stats' && (
        <UsageStatsSection />
      )}

      {section === 'retencao' && (
        <div className="flex flex-col gap-5" data-testid="admin-retention-section">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h3 className="text-base font-bold text-slate-800 m-0 mb-1">Retencao de fotos na lixeira</h3>
            <p className="text-sm text-slate-500 mb-4">
              Define apos quantos dias fotos da lixeira passam a ser sugeridas para arquivamento.
              Nao apaga nada automaticamente — apenas exibe um alerta dentro da lixeira com a acao
              "Arquivar antigas" em lote.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="admin-retention-days" className="block text-xs font-semibold text-slate-700 mb-1">
                  Dias para elegibilidade de arquivamento
                </label>
                <Input
                  id="admin-retention-days"
                  type="number"
                  min="1"
                  max="3650"
                  value={retentionDays}
                  onChange={(event) => setRetentionDays(event.target.value === '' ? '' : Number(event.target.value))}
                />
                <p className="text-2xs text-slate-500 m-0 mt-1">
                  Padrao: 30 dias. Limite maximo: 3650 dias (10 anos).
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={handleSaveRetention} data-testid="admin-retention-save">
                <AppIcon name="save" />
                Salvar retencao
              </Button>
            </div>
          </div>
        </div>
      )}

      {section === 'rules' && (
        <div className="flex flex-col gap-5">
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
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

      <ConfirmDeleteModal
        open={Boolean(deleteConfirm)}
        itemName="o utilizador"
        itemId={deleteConfirm}
        onConfirm={handleConfirmDeleteUser}
        onCancel={() => setDeleteConfirm(null)}
      />

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
    </section>
  );
}

export default AdminView;
