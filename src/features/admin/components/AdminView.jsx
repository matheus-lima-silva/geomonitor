import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { deleteUser, saveUser } from '../../../services/userService';
import { saveRulesConfig } from '../../../services/rulesService';
import { normalizeRulesConfig, RULES_DATABASE } from '../../shared/rulesConfig';
import { normalizeUserStatus } from '../../shared/statusUtils';

function AdminView({ users, rulesConfig, searchTerm }) {
  const { user } = useAuth();
  const { show } = useToast();
  const [section, setSection] = useState('users');
  const [draftRules, setDraftRules] = useState(() => normalizeRulesConfig(rulesConfig || RULES_DATABASE));
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
    await saveRulesConfig(draftRules, { updatedBy: user?.email, merge: true });
    show('Regras salvas com sucesso.', 'success');
  }

  const criterios = {
    tipo: ['sulco', 'ravina', 'voçoroca', 'deslizamento'],
    estagio: ['inicial', 'intermediario', 'avancado', 'critico'],
    profundidade: ['<0.5', '0.5-1.5', '1.5-3.0', '>3.0'],
    declividade: ['<15', '15-30', '30-45', '>45'],
    largura: ['<1', '1-3', '3-5', '>5'],
  };
  const [selectedCriterio, setSelectedCriterio] = useState('tipo');

  return (
    <section className="panel">
      <div className="topbar">
        <div>
          <h2>Administração</h2>
          <p className="muted">Gestão de utilizadores e regras de criticidade.</p>
        </div>
      </div>

      <div className="inline-row">
        <button type="button" className={section === 'users' ? 'chip-active' : ''} onClick={() => setSection('users')}>Utilizadores</button>
        <button type="button" className={section === 'rules' ? 'chip-active' : ''} onClick={() => setSection('rules')}>Regras</button>
      </div>

      {section === 'users' && (
        <div>
          <div className="row-actions">
            <button type="button" onClick={openNewUser}>
              <AppIcon name="plus" />
              Novo Utilizador
            </button>
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Cargo</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>{u.nome || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td>{u.cargo || '-'}</td>
                    <td>{u.perfil || 'Utilizador'}</td>
                    <td>{normalizeUserStatus(u.status)}</td>
                    <td>
                      <div className="inline-row">
                        <button type="button" className="secondary" onClick={() => openEditUser(u)}>
                          <AppIcon name="edit" />
                          Editar
                        </button>
                        {canApproveUsers && normalizeUserStatus(u.status) === 'Pendente' && (
                          <>
                            <button type="button" onClick={() => handleApproveUser(u.id, 'Ativo')}>
                              <AppIcon name="check" />
                              Aprovar
                            </button>
                            <button type="button" className="secondary" onClick={() => handleApproveUser(u.id, 'Inativo')}>
                              <AppIcon name="pause" />
                              Inativar
                            </button>
                          </>
                        )}
                        <button type="button" className="danger" onClick={() => handleDeleteUser(u.id)}>
                          <AppIcon name="trash" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="muted">Nenhum utilizador encontrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {section === 'rules' && (
        <div>
          <div className="inline-row">
            {Object.keys(criterios).map((c) => (
              <button key={c} type="button" className={selectedCriterio === c ? 'chip-active' : ''} onClick={() => setSelectedCriterio(c)}>
                {c}
              </button>
            ))}
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Valor</th>
                  <th>Impacto</th>
                  <th>Score</th>
                  <th>Frequência</th>
                  <th>Intervenção</th>
                </tr>
              </thead>
              <tbody>
                {criterios[selectedCriterio].map((valor) => {
                  const key = `${selectedCriterio}|${valor}`;
                  const regra = draftRules[key] || RULES_DATABASE[key];
                  return (
                    <tr key={key}>
                      <td>{valor}</td>
                      <td><input value={regra.impacto} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, impacto: e.target.value } }))} /></td>
                      <td><input type="number" min="1" max="4" value={regra.score} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, score: Number(e.target.value || 1) } }))} /></td>
                      <td><input value={regra.frequencia} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, frequencia: e.target.value } }))} /></td>
                      <td><input value={regra.intervencao} onChange={(e) => setDraftRules((prev) => ({ ...prev, [key]: { ...regra, intervencao: e.target.value } }))} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="row-actions">
            <button type="button" className="secondary" onClick={() => setDraftRules(normalizeRulesConfig(RULES_DATABASE))}>
              <AppIcon name="reset" />
              Restaurar padrão
            </button>
            <button type="button" onClick={handleSaveRules}>
              <AppIcon name="save" />
              Salvar regras
            </button>
          </div>
        </div>
      )}

      {isUserFormOpen && (
        <div className="modal-backdrop">
          <div className="modal wide">
            <h3>{isEditingUser ? 'Editar Utilizador' : 'Novo Utilizador'}</h3>
            <div className="grid-form">
              <input
                value={userForm.id}
                onChange={(e) => setUserForm((prev) => ({ ...prev, id: e.target.value.trim() }))}
                placeholder="UID (Firebase Auth)"
                disabled={isEditingUser}
              />
              <input
                value={userForm.nome}
                onChange={(e) => setUserForm((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Nome"
              />
              <input
                value={userForm.email}
                onChange={(e) => setUserForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="Email"
                type="email"
              />
              <input
                value={userForm.cargo}
                onChange={(e) => setUserForm((prev) => ({ ...prev, cargo: e.target.value }))}
                placeholder="Cargo"
              />
              <input
                value={userForm.departamento}
                onChange={(e) => setUserForm((prev) => ({ ...prev, departamento: e.target.value }))}
                placeholder="Departamento"
              />
              <input
                value={userForm.telefone}
                onChange={(e) => setUserForm((prev) => ({ ...prev, telefone: e.target.value }))}
                placeholder="Telefone"
              />
              <select
                value={userForm.perfil}
                onChange={(e) => setUserForm((prev) => ({ ...prev, perfil: e.target.value }))}
              >
                <option value="Utilizador">Utilizador</option>
                <option value="Gerente">Gerente</option>
                <option value="Administrador">Administrador</option>
              </select>
              <select
                value={userForm.status}
                onChange={(e) => setUserForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <option value="Pendente">Pendente</option>
                <option value="Ativo">Ativo</option>
                <option value="Inativo">Inativo</option>
              </select>
            </div>

            <div className="row-actions">
              <button type="button" onClick={handleSaveUser}>
                <AppIcon name="save" />
                Salvar
              </button>
              <button type="button" className="secondary" onClick={() => setIsUserFormOpen(false)}>
                <AppIcon name="close" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default AdminView;
