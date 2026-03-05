import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select, Textarea } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { deleteUser, saveUser } from '../../../services/userService';
import { saveErosion } from '../../../services/erosionService';
import { saveRulesConfig } from '../../../services/rulesService';
import {
  CRITICALITY_V2_DEFAULTS,
  mergeCriticalityV2Config,
  normalizeRulesConfig,
  RULES_DATABASE,
} from '../../shared/rulesConfig';
import { normalizeUserStatus } from '../../shared/statusUtils';

function AdminView({
  users,
  rulesConfig,
  searchTerm,
  erosions = [],
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [section, setSection] = useState('users');
  const [draftRules, setDraftRules] = useState(() => normalizeRulesConfig(rulesConfig || RULES_DATABASE));
  const [criticalityV2Text, setCriticalityV2Text] = useState(() => JSON.stringify(mergeCriticalityV2Config(rulesConfig?.criticalityV2 || CRITICALITY_V2_DEFAULTS), null, 2));

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

  useEffect(() => {
    setDraftRules(normalizeRulesConfig(rulesConfig || RULES_DATABASE));
    setCriticalityV2Text(JSON.stringify(mergeCriticalityV2Config(rulesConfig?.criticalityV2 || CRITICALITY_V2_DEFAULTS), null, 2));
  }, [rulesConfig]);

  const canApproveUsers = user?.role === 'admin' || user?.role === 'manager';

  const filteredUsers = useMemo(() => {
    const t = String(searchTerm || '').toLowerCase();
    if (!t) return users;
    return users.filter((u) =>
      String(u.nome || '').toLowerCase().includes(t)
      || String(u.email || '').toLowerCase().includes(t)
      || String(u.cargo || '').toLowerCase().includes(t),
    );
  }, [users, searchTerm]);

  async function handleApproveUser(uid, status) {
    const u = users.find((x) => x.id === uid);
    if (!u) return;
    await saveUser(uid, { ...u, status }, { updatedBy: user?.email });
    show(`Utilizador definido como ${status}.`, 'success');
  }

  async function handleDeleteUser(uid) {
    if (!window.confirm(`Excluir utilizador ${uid}?`)) return;
    await deleteUser(uid);
    show('Utilizador excluído.', 'success');
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
    let parsedCriticalityV2;
    try {
      parsedCriticalityV2 = mergeCriticalityV2Config(JSON.parse(String(criticalityV2Text || '{}')));
    } catch {
      show('JSON invalido em configuracao criticalityV2.', 'error');
      return;
    }
    await saveRulesConfig({
      ...draftRules,
      criticalityV2: parsedCriticalityV2,
    }, { updatedBy: user?.email, merge: true });
    show('Regras salvas com sucesso.', 'success');
  }



  const criterios = {
    tipo: ['sulco', 'ravina', 'vocoroca', 'deslizamento'],
    estagio: ['inicial', 'intermediario', 'avancado', 'critico'],
    profundidade: ['<0.5', '0.5-1.5', '1.5-3.0', '>3.0'],
    declividade: ['<15', '15-30', '30-45', '>45'],
    largura: ['<1', '1-3', '3-5', '>5'],
  };
  const [selectedCriterio, setSelectedCriterio] = useState('tipo');

  return (
    <section className="bg-white rounded-2xl shadow-[0_4px_18px_rgba(15,23,42,0.08)] p-5 mb-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 m-0">Administração</h2>
          <p className="text-sm text-slate-500 mt-1">Gestão de utilizadores e regras de criticidade.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Button variant={section === 'users' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('users')}>Utilizadores</Button>
        <Button variant={section === 'rules' ? 'primary' : 'outline'} size="sm" onClick={() => setSection('rules')}>Regras</Button>
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
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700">{u.nome || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{u.email || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{u.cargo || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{u.perfil || 'Utilizador'}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{normalizeUserStatus(u.status)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEditUser(u)}>
                          <AppIcon name="edit" />
                          Editar
                        </Button>
                        {canApproveUsers && normalizeUserStatus(u.status) === 'Pendente' && (
                          <>
                            <Button variant="primary" size="sm" onClick={() => handleApproveUser(u.id, 'Ativo')}>
                              <AppIcon name="check" />
                              Aprovar
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleApproveUser(u.id, 'Inativo')}>
                              <AppIcon name="pause" />
                              Inativar
                            </Button>
                          </>
                        )}
                        <Button variant="danger" size="sm" onClick={() => handleDeleteUser(u.id)}>
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
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(criterios).map((c) => (
              <Button key={c} variant={selectedCriterio === c ? 'primary' : 'outline'} size="sm" onClick={() => setSelectedCriterio(c)}>
                {c}
              </Button>
            ))}
          </div>

          <div className="overflow-x-auto w-full bg-white rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Impacto</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Score</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Frequência</th>
                  <th className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">Intervenção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {criterios[selectedCriterio].map((valor) => {
                  const key = `${selectedCriterio}|${valor}`;
                  const regra = draftRules[key] || RULES_DATABASE[key];
                  return (
                    <tr key={key} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2 text-sm text-slate-700 font-medium">{valor}</td>
                      <td className="px-4 py-2"><input className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" value={regra.impacto} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, impacto: e.target.value } }))} /></td>
                      <td className="px-4 py-2"><input className="w-20 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" type="number" min="1" max="4" value={regra.score} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, score: Number(e.target.value || 1) } }))} /></td>
                      <td className="px-4 py-2"><input className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" value={regra.frequencia} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, frequencia: e.target.value } }))} /></td>
                      <td className="px-4 py-2"><input className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none" value={regra.intervencao} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, intervencao: e.target.value } }))} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setDraftRules(normalizeRulesConfig(RULES_DATABASE))}>
              <AppIcon name="reset" />
              Restaurar padrão
            </Button>
            <Button variant="primary" onClick={handleSaveRules}>
              <AppIcon name="save" />
              Salvar regras
            </Button>
          </div>

          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 mt-2">
            <h3 className="text-base font-bold text-slate-800 m-0 mb-1">Configuração Criticidade V2 (JSON)</h3>
            <p className="text-sm text-slate-500 mb-4">Overrides para classes, faixas e soluções. O padrão é mesclado automaticamente.</p>
            <Textarea
              id="admin-criticality-v2-json"
              rows={14}
              value={criticalityV2Text}
              onChange={(e) => setCriticalityV2Text(e.target.value)}
              className="min-h-[300px] font-mono mb-4"
            />
            <div className="flex justify-start">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCriticalityV2Text(JSON.stringify(mergeCriticalityV2Config(CRITICALITY_V2_DEFAULTS), null, 2))}
              >
                <AppIcon name="reset" />
                Restaurar V2 padrão
              </Button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={isUserFormOpen}
        onClose={() => setIsUserFormOpen(false)}
        title={isEditingUser ? 'Editar Utilizador' : 'Novo Utilizador'}
        size="lg"
        footer={
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
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            id="user-uid"
            label="UID (Firebase Auth)"
            value={userForm.id}
            onChange={(e) => setUserForm((prev) => ({ ...prev, id: e.target.value.trim() }))}
            disabled={isEditingUser}
          />
          <Input
            id="user-nome"
            label="Nome"
            value={userForm.nome}
            onChange={(e) => setUserForm((prev) => ({ ...prev, nome: e.target.value }))}
          />
          <Input
            id="user-email"
            label="Email"
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
          />
          <Input
            id="user-cargo"
            label="Cargo"
            value={userForm.cargo}
            onChange={(e) => setUserForm((prev) => ({ ...prev, cargo: e.target.value }))}
          />
          <Input
            id="user-depto"
            label="Departamento"
            value={userForm.departamento}
            onChange={(e) => setUserForm((prev) => ({ ...prev, departamento: e.target.value }))}
          />
          <Input
            id="user-tel"
            label="Telefone"
            value={userForm.telefone}
            onChange={(e) => setUserForm((prev) => ({ ...prev, telefone: e.target.value }))}
          />
          <Select
            id="user-perfil"
            label="Perfil"
            value={userForm.perfil}
            onChange={(e) => setUserForm((prev) => ({ ...prev, perfil: e.target.value }))}
          >
            <option value="Utilizador">Utilizador</option>
            <option value="Gerente">Gerente</option>
            <option value="Administrador">Administrador</option>
          </Select>
          <Select
            id="user-status"
            label="Status"
            value={userForm.status}
            onChange={(e) => setUserForm((prev) => ({ ...prev, status: e.target.value }))}
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


