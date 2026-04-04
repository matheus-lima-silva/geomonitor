import { useEffect, useState } from 'react';
import AppIcon from '../../../components/AppIcon';
import { Button, Input, Modal, Select } from '../../../components/ui';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import {
  createSignatario,
  deleteSignatario,
  listProfissoes,
  listSignatarios,
  saveUser,
  updateSignatario,
} from '../../../services/userService';

function formatPhone(value) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatRegistroPreview(conselho, estado, numero, sufixo) {
  const parts = [];
  if (conselho && estado) parts.push(`${conselho}-${estado}`);
  else if (conselho) parts.push(conselho);
  if (numero) parts.push(sufixo ? `${numero}/${sufixo}` : numero);
  return parts.join(' ');
}

const EMPTY_SIG = { nome: '', profissao_id: '', registro_conselho: '', registro_estado: '', registro_numero: '', registro_sufixo: '' };

function ProfileModal({ onClose }) {
  const { user, refreshProfile } = useAuth();
  const { show } = useToast();
  const [formData, setFormData] = useState({
    id: user?.uid || '',
    nome: user?.nome || '',
    email: user?.email || '',
    cargo: user?.cargo || '',
    departamento: user?.departamento || '',
    telefone: formatPhone(user?.telefone || ''),
    perfil: user?.perfil || 'Utilizador',
    profissao_id: user?.profissao_id || '',
    registro_conselho: user?.registro_conselho || '',
    registro_estado: user?.registro_estado || '',
    registro_numero: user?.registro_numero || '',
    registro_sufixo: user?.registro_sufixo || '',
  });

  const [profissoes, setProfissoes] = useState([]);
  const [signatarios, setSignatarios] = useState([]);
  const [newSig, setNewSig] = useState({ ...EMPTY_SIG });
  const [editingSigId, setEditingSigId] = useState(null);
  const [editingSig, setEditingSig] = useState({ ...EMPTY_SIG });
  const [sigBusy, setSigBusy] = useState('');

  useEffect(() => {
    listProfissoes().then(setProfissoes).catch(() => {});
    listSignatarios().then(setSignatarios).catch(() => {});
  }, []);

  async function handleSave() {
    if (!String(formData.nome || '').trim()) {
      show('Preencha o nome para salvar o perfil.', 'error');
      return;
    }

    try {
      await saveUser(user.uid, {
        id: user.uid,
        nome: String(formData.nome || '').trim(),
        email: user.email,
        cargo: String(formData.cargo || '').trim(),
        departamento: String(formData.departamento || '').trim(),
        telefone: String(formData.telefone || '').trim(),
        perfil: user.perfil || 'Utilizador',
        status: user.status || 'Pendente',
        perfilAtualizadoPrimeiroLogin: user.perfilAtualizadoPrimeiroLogin ?? true,
        profissao_id: formData.profissao_id,
        registro_conselho: String(formData.registro_conselho || '').trim(),
        registro_estado: String(formData.registro_estado || '').trim().toUpperCase(),
        registro_numero: String(formData.registro_numero || '').trim(),
        registro_sufixo: String(formData.registro_sufixo || '').trim().toUpperCase(),
      }, { merge: true, updatedBy: user.email });

      await refreshProfile();
      show('Perfil salvo com sucesso.', 'success');
      onClose();
    } catch (err) {
      show(err.message || 'Erro ao salvar perfil.', 'error');
    }
  }

  async function handleAddSignatario() {
    if (!String(newSig.nome || '').trim()) {
      show('Informe o nome do signatario.', 'error');
      return;
    }
    try {
      setSigBusy('add');
      await createSignatario(newSig);
      setNewSig({ ...EMPTY_SIG });
      setSignatarios(await listSignatarios());
      show('Signatario adicionado.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao adicionar signatario.', 'error');
    } finally {
      setSigBusy('');
    }
  }

  async function handleUpdateSignatario(sigId) {
    try {
      setSigBusy(`edit:${sigId}`);
      await updateSignatario(sigId, editingSig);
      setEditingSigId(null);
      setSignatarios(await listSignatarios());
      show('Signatario atualizado.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao atualizar signatario.', 'error');
    } finally {
      setSigBusy('');
    }
  }

  async function handleDeleteSignatario(sigId) {
    try {
      setSigBusy(`del:${sigId}`);
      await deleteSignatario(sigId);
      setSignatarios(await listSignatarios());
      show('Signatario removido.', 'success');
    } catch (err) {
      show(err.message || 'Erro ao remover signatario.', 'error');
    } finally {
      setSigBusy('');
    }
  }

  function startEdit(sig) {
    setEditingSigId(sig.id);
    setEditingSig({
      nome: sig.nome || '',
      profissao_id: sig.profissao_id || '',
      registro_conselho: sig.registro_conselho || '',
      registro_estado: sig.registro_estado || '',
      registro_numero: sig.registro_numero || '',
      registro_sufixo: sig.registro_sufixo || '',
    });
  }

  const registroPreview = formatRegistroPreview(formData.registro_conselho, formData.registro_estado, formData.registro_numero, formData.registro_sufixo);

  function renderSigFields(data, setData, prefix) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
        <div className="sm:col-span-2">
          <Input id={`${prefix}-nome`} label="Nome" value={data.nome} onChange={(e) => setData((prev) => ({ ...prev, nome: e.target.value }))} placeholder="Nome completo" />
        </div>
        <div className="sm:col-span-1">
          <Select id={`${prefix}-prof`} label="Profissao" value={data.profissao_id} onChange={(e) => setData((prev) => ({ ...prev, profissao_id: e.target.value }))}>
            <option value="">--</option>
            {profissoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
        </div>
        <div className="sm:col-span-3 grid grid-cols-4 gap-2">
          <Input id={`${prefix}-cons`} label="Conselho" value={data.registro_conselho} onChange={(e) => setData((prev) => ({ ...prev, registro_conselho: e.target.value }))} placeholder="CREA" />
          <Input id={`${prefix}-uf`} label="UF" value={data.registro_estado} onChange={(e) => setData((prev) => ({ ...prev, registro_estado: e.target.value.slice(0, 2).toUpperCase() }))} placeholder="RJ" maxLength={2} />
          <Input id={`${prefix}-num`} label="Numero" value={data.registro_numero} onChange={(e) => setData((prev) => ({ ...prev, registro_numero: e.target.value }))} placeholder="123456" />
          <Input id={`${prefix}-suf`} label="Sufixo" value={data.registro_sufixo} onChange={(e) => setData((prev) => ({ ...prev, registro_sufixo: e.target.value.toUpperCase() }))} placeholder="D" />
        </div>
      </div>
    );
  }

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>
        <AppIcon name="close" />
        Cancelar
      </Button>
      <Button variant="primary" onClick={handleSave}>
        <AppIcon name="save" />
        Salvar Alteracoes
      </Button>
    </>
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <AppIcon name="user" /> Meu Perfil
        </span>
      }
      size="lg"
      footer={footer}
    >
      <section className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
        <div className="flex-shrink-0 w-14 h-14 bg-blue-100 text-brand-700 rounded-full flex items-center justify-center text-xl font-bold">
          {String(formData.nome || user?.email || 'U').trim().charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="flex flex-col">
          <strong className="text-lg text-slate-800">{String(formData.nome || '').trim() || 'Utilizador'}</strong>
          <span className="text-sm text-slate-500">{user?.email || '-'}</span>
          <small className="text-xs text-slate-400 mt-1">ID: {formData.id || '-'}</small>
        </div>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
        <Input
          id="profile-nome"
          label="Nome Completo *"
          value={formData.nome}
          onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
          placeholder="Seu nome completo"
        />
        <Input
          id="profile-email"
          label="Email"
          value={formData.email}
          disabled
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Input
          id="profile-cargo"
          label="Cargo"
          value={formData.cargo}
          onChange={(e) => setFormData((prev) => ({ ...prev, cargo: e.target.value }))}
          placeholder="Ex: Engenheiro"
        />
        <Input
          id="profile-departamento"
          label="Departamento"
          value={formData.departamento}
          onChange={(e) => setFormData((prev) => ({ ...prev, departamento: e.target.value }))}
          placeholder="Ex: Geotecnia"
        />
        <Input
          id="profile-telefone"
          label="Telefone"
          type="tel"
          value={formData.telefone}
          onChange={(e) => setFormData((prev) => ({ ...prev, telefone: formatPhone(e.target.value) }))}
          placeholder="(00) 00000-0000"
          maxLength={15}
        />
      </div>

      {/* Minha Assinatura */}
      <hr className="my-6 border-slate-200" />
      <h3 className="text-sm font-bold text-slate-700 mb-3">Minha Assinatura</h3>
      <div className="grid grid-cols-1 gap-4 mb-2">
        <Select
          id="profile-profissao"
          label="Profissao"
          value={formData.profissao_id}
          onChange={(e) => setFormData((prev) => ({ ...prev, profissao_id: e.target.value }))}
        >
          <option value="">Selecione...</option>
          {profissoes.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-4 gap-3 mb-2">
        <Input id="profile-reg-conselho" label="Conselho" value={formData.registro_conselho} onChange={(e) => setFormData((prev) => ({ ...prev, registro_conselho: e.target.value }))} placeholder="CREA" />
        <Input id="profile-reg-uf" label="UF" value={formData.registro_estado} onChange={(e) => setFormData((prev) => ({ ...prev, registro_estado: e.target.value.slice(0, 2).toUpperCase() }))} placeholder="RJ" maxLength={2} />
        <Input id="profile-reg-numero" label="Numero" value={formData.registro_numero} onChange={(e) => setFormData((prev) => ({ ...prev, registro_numero: e.target.value }))} placeholder="123456" />
        <Input id="profile-reg-sufixo" label="Sufixo" value={formData.registro_sufixo} onChange={(e) => setFormData((prev) => ({ ...prev, registro_sufixo: e.target.value.toUpperCase() }))} placeholder="D" />
      </div>
      {registroPreview ? (
        <p className="text-xs text-slate-500 mb-4">Registro: <strong>{registroPreview}</strong></p>
      ) : null}

      {/* Signatarios Frequentes */}
      <hr className="my-6 border-slate-200" />
      <h3 className="text-sm font-bold text-slate-700 mb-3">Signatarios Frequentes</h3>
      {signatarios.length > 0 ? (
        <div className="flex flex-col gap-2 mb-4">
          {signatarios.map((sig) => (
            <div key={sig.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
              {editingSigId === sig.id ? (
                <div className="flex-1 flex flex-col gap-2">
                  {renderSigFields(editingSig, setEditingSig, `edit-sig-${sig.id}`)}
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingSigId(null)}>Cancelar</Button>
                    <Button size="sm" onClick={() => handleUpdateSignatario(sig.id)} disabled={sigBusy === `edit:${sig.id}`}>
                      {sigBusy === `edit:${sig.id}` ? 'Salvando...' : 'Salvar'}
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
                  <button type="button" className="text-slate-400 hover:text-blue-600" onClick={() => startEdit(sig)} title="Editar">
                    <AppIcon name="edit" size={14} />
                  </button>
                  <button type="button" className="text-slate-400 hover:text-red-600" onClick={() => handleDeleteSignatario(sig.id)} disabled={sigBusy === `del:${sig.id}`} title="Remover">
                    <AppIcon name="trash" size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 mb-4">Nenhum signatario cadastrado.</p>
      )}

      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 mb-6">
        <p className="text-xs font-semibold text-slate-600 mb-2">Adicionar signatario</p>
        {renderSigFields(newSig, setNewSig, 'new-sig')}
        <div className="flex justify-end mt-2">
          <Button size="sm" onClick={handleAddSignatario} disabled={sigBusy === 'add'}>
            <AppIcon name="plus" size={14} />
            {sigBusy === 'add' ? 'Adicionando...' : 'Adicionar'}
          </Button>
        </div>
      </div>

      <section className="bg-brand-50 border border-brand-100 rounded-xl p-5 text-brand-900">
        <div className="flex items-center gap-2 font-bold text-sm mb-2 text-brand-800">
          <AppIcon name="shield" />
          Perfil de Acesso
        </div>
        <strong className="block text-lg mb-1">{formData.perfil}</strong>
        <p className="text-sm opacity-80 m-0">Para alterar seu perfil de acesso, contate um administrador.</p>
      </section>
    </Modal>
  );
}

export default ProfileModal;
