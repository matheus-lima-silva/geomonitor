import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card, ConfirmDeleteModal, Input, Modal, Select } from '../../../components/ui';
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
import SqlExecutorPanel from './SqlExecutorPanel';
import FeriadosSection from './FeriadosSection';
import CriticalityConfigEditor from './CriticalityConfigEditor';

const NAV_GROUPS = [
  {
    label: 'Pessoas e acesso',
    items: [
      { id: 'users', label: 'Utilizadores', icon: 'user' },
      { id: 'signatures', label: 'Assinaturas', icon: 'edit' },
      { id: 'workspaces-access', label: 'Acessos a workspaces', icon: 'projects-nav' },
    ],
  },
  {
    label: 'Regras do sistema',
    items: [
      { id: 'rules', label: 'Criticidade', icon: 'shield' },
      { id: 'retencao', label: 'Retencao', icon: 'clock' },
      { id: 'feriados', label: 'Feriados', icon: 'calendar' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'stats', label: 'Estatisticas', icon: 'dashboard-nav' },
      { id: 'sql', label: 'Console SQL', icon: 'database', adminOnly: true },
    ],
  },
];

const SECTION_META = {
  users: { title: 'Utilizadores', desc: 'Aprove solicitacoes de acesso, edite perfis e gerencie status.' },
  signatures: { title: 'Assinaturas', desc: 'Gerencie os signatarios de qualquer utilizador para os relatorios compostos.' },
  'workspaces-access': { title: 'Acessos a workspaces', desc: 'Consolida todos os workspaces do sistema e seus membros.' },
  rules: { title: 'Criticidade (V3)', desc: 'Configuracao canonica usada pelo motor de criticidade.' },
  retencao: { title: 'Retencao da lixeira', desc: 'Quando fotos na lixeira passam a ser sugeridas para arquivamento.' },
  feriados: { title: 'Feriados', desc: 'Datas sinalizadas no planejamento de visitas e no diario da vistoria.' },
  stats: { title: 'Estatisticas de uso', desc: 'Totais, atividade recente, logins e saude da fila de relatorios.' },
  sql: { title: 'Console SQL', desc: 'Consultas somente leitura para diagnostico, com auditoria.' },
};

function AdmNavItem({ item, active, badge, locked, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      aria-current={active ? 'page' : undefined}
      className={[
        'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm font-semibold border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
        active
          ? 'bg-brand-50 border-brand-200 text-brand-800'
          : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800',
        locked ? 'opacity-60 cursor-not-allowed' : '',
      ].filter(Boolean).join(' ')}
    >
      <AppIcon name={item.icon} className={`w-4 h-4 ${active ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden="true" />
      <span className="flex-1 min-w-0 truncate">{item.label}</span>
      {badge ? (
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-warning-light border border-warning-border text-yellow-900 text-2xs font-bold">{badge}</span>
      ) : null}
      {locked ? <AppIcon name="lock" className="w-3 h-3 text-slate-400" aria-hidden="true" /> : null}
    </button>
  );
}

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
  const [criticalityValid, setCriticalityValid] = useState(true);

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

  const pendingCount = useMemo(
    () => (Array.isArray(users) ? users.filter((item) => normalizeUserStatus(item.status) === 'Pendente').length : 0),
    [users],
  );

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

      <div className="grid grid-cols-1 lg:grid-cols-[252px_minmax(0,1fr)] gap-6 items-start">
        <nav aria-label="Secoes do gerenciamento" className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col gap-4 lg:sticky lg:top-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <p className="px-3 text-2xs font-bold uppercase tracking-wide text-slate-400 m-0 mb-0.5">{group.label}</p>
              {group.items
                .filter((navItem) => !navItem.adminOnly || user?.role === 'admin')
                .map((navItem) => (
                  <AdmNavItem
                    key={navItem.id}
                    item={navItem}
                    active={section === navItem.id}
                    badge={navItem.id === 'users' && pendingCount > 0 ? pendingCount : null}
                    onClick={() => setSection(navItem.id)}
                  />
                ))}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <h3 className="text-lg font-bold text-slate-800 m-0">{SECTION_META[section]?.title}</h3>
            <p className="text-sm text-slate-500 m-0 mt-0.5">{SECTION_META[section]?.desc}</p>
          </div>

      {section === 'users' && (
        <div className="flex flex-col gap-4">
          {pendingCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-warning-border bg-warning-light px-4 py-2.5">
              <AppIcon name="alert" className="w-4 h-4 text-yellow-700 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-sm text-yellow-900 m-0">
                {pendingCount === 1 ? '1 utilizador aguardando aprovacao.' : `${pendingCount} utilizadores aguardando aprovacao.`}
              </p>
            </div>
          )}
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

      {section === 'sql' && user?.role === 'admin' && (
        <SqlExecutorPanel />
      )}

      {section === 'retencao' && (
        <div className="flex flex-col gap-5" data-testid="admin-retention-section">
          <Card variant="flat" className="p-5 flex flex-col gap-4 max-w-2xl">
            <p className="text-sm text-slate-500 m-0">
              Nada e apagado automaticamente — a lixeira apenas exibe um alerta com a acao
              "Arquivar antigas" em lote quando ha fotos elegiveis.
            </p>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="admin-retention-days" className="block text-2xs font-bold uppercase tracking-wide text-slate-500 mb-1">
                  Dias para elegibilidade
                </label>
                <Input
                  id="admin-retention-days"
                  type="number"
                  min="1"
                  max="3650"
                  fullWidth={false}
                  className="w-28"
                  value={retentionDays}
                  onChange={(event) => setRetentionDays(event.target.value === '' ? '' : Number(event.target.value))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
                {[30, 60, 90, 180, 365].map((preset) => (
                  <Button
                    key={preset}
                    variant={Number(retentionDays) === preset ? 'primary' : 'outline'}
                    size="sm"
                    aria-pressed={Number(retentionDays) === preset}
                    onClick={() => setRetentionDays(preset)}
                  >
                    {preset}d
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-2xs text-slate-500 m-0">Padrao: 30 dias. Limite maximo: 3650 dias (10 anos).</p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={handleSaveRetention} data-testid="admin-retention-save">
                <AppIcon name="save" />
                Salvar retencao
              </Button>
            </div>
          </Card>
        </div>
      )}

      {section === 'feriados' && (
        <FeriadosSection rulesConfig={rulesConfig} />
      )}

      {section === 'rules' && (
        <div className="flex flex-col gap-5">
          <CriticalityConfigEditor
            value={criticalityText}
            onChange={setCriticalityText}
            onValidityChange={setCriticalityValid}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-2xs text-slate-400 m-0">A metodologia V3 continua a mesma; aqui ajusta-se apenas a configuracao canonica usada pelo motor.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setCriticalityText(JSON.stringify(mergeCriticalityConfig(CRITICALITY_DEFAULTS), null, 2))}
              >
                <AppIcon name="reset" />
                Restaurar padrao
              </Button>
              <Button variant="primary" onClick={handleSaveRules} disabled={!criticalityValid}>
                <AppIcon name="save" />
                Salvar regras
              </Button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

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
            label="UID"
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
