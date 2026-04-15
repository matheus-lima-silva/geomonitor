import { useEffect, useMemo, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Card } from '../../../components/ui';
import { useToast } from '../../../context/ToastContext';
import { listProfissoes } from '../../../services/userService';
import {
  listUserSignatarios,
  createSignatarioForUser,
  updateSignatarioForUser,
  deleteSignatarioForUser,
} from '../../../services/adminSignatoryService';
import SignatoryFields, { EMPTY_SIG, formatRegistroPreview } from './SignatoryFields';

function SignaturesSection({ users, searchTerm }) {
  const { show } = useToast();
  const [profissoes, setProfissoes] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState('');
  const [sigsByUser, setSigsByUser] = useState({});
  const [loadingUserId, setLoadingUserId] = useState('');
  const [newSigByUser, setNewSigByUser] = useState({});
  const [editingSig, setEditingSig] = useState({ userId: '', sigId: '', data: { ...EMPTY_SIG } });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    listProfissoes().then(setProfissoes).catch(() => show('Erro ao carregar profissoes.', 'error'));
  }, [show]);

  const filteredUsers = useMemo(() => {
    const term = String(searchTerm || '').toLowerCase();
    if (!term) return users || [];
    return (users || []).filter((item) => (
      String(item.nome || '').toLowerCase().includes(term)
      || String(item.email || '').toLowerCase().includes(term)
    ));
  }, [users, searchTerm]);

  async function toggleExpand(userId) {
    if (expandedUserId === userId) {
      setExpandedUserId('');
      return;
    }
    setExpandedUserId(userId);
    if (!sigsByUser[userId]) {
      try {
        setLoadingUserId(userId);
        const items = await listUserSignatarios(userId);
        setSigsByUser((prev) => ({ ...prev, [userId]: items }));
      } catch (err) {
        show(err.message || 'Erro ao carregar signatarios do usuario.', 'error');
      } finally {
        setLoadingUserId('');
      }
    }
  }

  async function refreshUser(userId) {
    try {
      const items = await listUserSignatarios(userId);
      setSigsByUser((prev) => ({ ...prev, [userId]: items }));
    } catch (err) {
      show(err.message || 'Erro ao atualizar signatarios do usuario.', 'error');
    }
  }

  async function handleAdd(userId) {
    const draft = newSigByUser[userId] || { ...EMPTY_SIG };
    if (!String(draft.nome || '').trim()) {
      show('Informe o nome do signatario.', 'error');
      return;
    }
    try {
      setBusy(`add:${userId}`);
      await createSignatarioForUser(userId, draft);
      setNewSigByUser((prev) => ({ ...prev, [userId]: { ...EMPTY_SIG } }));
      await refreshUser(userId);
      show('Signatario adicionado.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao adicionar signatario.', 'error');
    } finally {
      setBusy('');
    }
  }

  function startEdit(userId, sig) {
    setEditingSig({
      userId,
      sigId: sig.id,
      data: {
        nome: sig.nome || '',
        profissao_id: sig.profissao_id || '',
        registro_conselho: sig.registro_conselho || '',
        registro_estado: sig.registro_estado || '',
        registro_numero: sig.registro_numero || '',
        registro_sufixo: sig.registro_sufixo || '',
      },
    });
  }

  function cancelEdit() {
    setEditingSig({ userId: '', sigId: '', data: { ...EMPTY_SIG } });
  }

  async function handleSaveEdit() {
    const { userId, sigId, data } = editingSig;
    if (!userId || !sigId) return;
    try {
      setBusy(`edit:${sigId}`);
      await updateSignatarioForUser(userId, sigId, data);
      cancelEdit();
      await refreshUser(userId);
      show('Signatario atualizado.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao atualizar signatario.', 'error');
    } finally {
      setBusy('');
    }
  }

  async function handleDelete(userId, sigId) {
    try {
      setBusy(`del:${sigId}`);
      await deleteSignatarioForUser(userId, sigId);
      await refreshUser(userId);
      show('Signatario removido.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao remover signatario.', 'error');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-600">
        Gerencie as assinaturas (signatarios) de qualquer usuario. Cada entrada alimenta o seletor de elaboradores/revisores nos relatorios compostos.
      </p>
      <Card variant="flat" className="!p-0 overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {filteredUsers.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-slate-500">Nenhum utilizador encontrado.</li>
          ) : null}
          {filteredUsers.map((u) => {
            const sigs = sigsByUser[u.id] || [];
            const isOpen = expandedUserId === u.id;
            const isLoading = loadingUserId === u.id;
            const newSig = newSigByUser[u.id] || { ...EMPTY_SIG };
            return (
              <li key={u.id} className="">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => toggleExpand(u.id)}
                >
                  <div className="flex flex-col">
                    <strong className="text-sm text-slate-800">{u.nome || '-'}</strong>
                    <span className="text-xs text-slate-500">{u.email || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {isOpen && sigs.length > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-2xs font-medium text-emerald-700">{sigs.length} assinatura(s)</span>
                    ) : null}
                    <AppIcon name="chevron-right" size={14} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                  </div>
                </button>
                {isOpen ? (
                  <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                    {isLoading ? (
                      <p className="text-xs text-slate-500">Carregando...</p>
                    ) : (
                      <>
                        {sigs.length > 0 ? (
                          <div className="flex flex-col gap-2 mb-3">
                            {sigs.map((sig) => (
                              <div key={sig.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                {editingSig.userId === u.id && editingSig.sigId === sig.id ? (
                                  <div className="flex-1 flex flex-col gap-2">
                                    <SignatoryFields
                                      data={editingSig.data}
                                      onChange={(updater) => setEditingSig((prev) => ({
                                        ...prev,
                                        data: typeof updater === 'function' ? updater(prev.data) : updater,
                                      }))}
                                      prefix={`admin-edit-sig-${sig.id}`}
                                      profissoes={profissoes}
                                    />
                                    <div className="flex gap-2 justify-end">
                                      <Button variant="outline" size="sm" onClick={cancelEdit}>
                                        <AppIcon name="close" />
                                        Cancelar
                                      </Button>
                                      <Button size="sm" onClick={handleSaveEdit} disabled={busy === `edit:${sig.id}`}>
                                        <AppIcon name="save" />
                                        {busy === `edit:${sig.id}` ? 'Salvando...' : 'Salvar'}
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex-1">
                                      <strong className="text-slate-800">{sig.nome}</strong>
                                      <span className="ml-2 text-xs text-slate-500">
                                        {sig.profissao_nome || ''}{sig.profissao_nome && formatRegistroPreview(sig.registro_conselho, sig.registro_estado, sig.registro_numero, sig.registro_sufixo) ? ' \u2013 ' : ''}{formatRegistroPreview(sig.registro_conselho, sig.registro_estado, sig.registro_numero, sig.registro_sufixo)}
                                      </span>
                                    </div>
                                    <button type="button" className="text-slate-400 hover:text-brand-600" onClick={() => startEdit(u.id, sig)} title="Editar">
                                      <AppIcon name="edit" size={14} />
                                    </button>
                                    <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => handleDelete(u.id, sig.id)} disabled={busy === `del:${sig.id}`} title="Remover">
                                      <AppIcon name="trash" size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 mb-3">Nenhum signatario cadastrado para este usuario.</p>
                        )}

                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Adicionar signatario</p>
                          <SignatoryFields
                            data={newSig}
                            onChange={(updater) => setNewSigByUser((prev) => ({
                              ...prev,
                              [u.id]: typeof updater === 'function' ? updater(prev[u.id] || EMPTY_SIG) : updater,
                            }))}
                            prefix={`admin-new-sig-${u.id}`}
                            profissoes={profissoes}
                          />
                          <div className="flex justify-end mt-2">
                            <Button size="sm" onClick={() => handleAdd(u.id)} disabled={busy === `add:${u.id}`}>
                              <AppIcon name="plus" size={14} />
                              {busy === `add:${u.id}` ? 'Adicionando...' : 'Adicionar'}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

export default SignaturesSection;
