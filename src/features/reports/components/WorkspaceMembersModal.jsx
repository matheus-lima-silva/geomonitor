import { useEffect, useMemo, useState } from 'react';
import Modal from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import IconButton from '../../../components/ui/IconButton';
import AppIcon from '../../../components/AppIcon';
import { useToast } from '../../../context/ToastContext';
import { subscribeUsers } from '../../../services/userService';
import {
    listWorkspaceMembers,
    addWorkspaceMember,
    removeWorkspaceMember,
} from '../../../services/reportWorkspaceMembersService';

const ROLE_OPTIONS = [
    { value: 'owner', label: 'Owner (dono)' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer (somente leitura)' },
];

const ROLE_BADGE = {
    owner: 'bg-amber-100 text-amber-800 border border-amber-300',
    editor: 'bg-sky-100 text-sky-800 border border-sky-300',
    viewer: 'bg-slate-100 text-slate-700 border border-slate-300',
};

const ROLE_LABEL = {
    owner: 'Owner',
    editor: 'Editor',
    viewer: 'Viewer',
};

/**
 * Modal de gestao de membros de um workspace.
 *
 * Props:
 *   open           — controla visibilidade
 *   onClose        — callback ao fechar
 *   workspaceId    — id do workspace
 *   workspaceName  — nome para exibir no titulo
 *   canManage      — se o requester pode adicionar/remover (owner/editor
 *                    local ou superuser global)
 */
export default function WorkspaceMembersModal({
    open,
    onClose,
    workspaceId,
    workspaceName,
    canManage = false,
}) {
    const { show: showToast } = useToast();
    const [members, setMembers] = useState([]);
    const [links, setLinks] = useState({});
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [removingUserId, setRemovingUserId] = useState(null);
    const [newUserId, setNewUserId] = useState('');
    const [newRole, setNewRole] = useState('editor');

    // Carrega lista completa de usuarios ativa enquanto modal estiver aberto
    useEffect(() => {
        if (!open) return undefined;
        const unsubscribe = subscribeUsers(
            (list) => setAllUsers(Array.isArray(list) ? list : []),
            (error) => showToast(error?.message || 'Erro ao carregar usuarios.', 'error'),
        );
        return () => unsubscribe?.();
    }, [open, showToast]);

    const fetchMembers = async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const { members: list, links: envelopeLinks } = await listWorkspaceMembers(workspaceId);
            setMembers(list);
            setLinks(envelopeLinks || {});
        } catch (error) {
            showToast(error?.message || 'Erro ao listar membros.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && workspaceId) {
            fetchMembers();
            setNewUserId('');
            setNewRole('editor');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, workspaceId]);

    const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);
    const ownerCount = useMemo(
        () => members.filter((m) => m.role === 'owner').length,
        [members],
    );

    // Opcoes do dropdown: todos os usuarios ativos que ainda NAO sao membros
    const addableUserOptions = useMemo(() => {
        return allUsers
            .filter((u) => {
                if (memberIds.has(u.id)) return false;
                if (u.status && u.status !== 'Ativo') return false;
                return true;
            })
            .map((u) => ({
                value: u.id,
                label: u.nome ? `${u.nome}${u.email ? ` — ${u.email}` : ''}` : (u.email || u.id),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [allUsers, memberIds]);

    // Usa HATEOAS como fonte canonica de permissao: se o backend enviou
    // _links.add, o requester pode adicionar. canManage e fallback quando
    // a prop e explicita (ex.: ainda nao carregou os members).
    const canAdd = canManage && Boolean(links.add);

    const handleAdd = async (event) => {
        event?.preventDefault?.();
        if (!newUserId || !newRole) return;
        setSubmitting(true);
        try {
            await addWorkspaceMember(workspaceId, { userId: newUserId, role: newRole });
            showToast('Membro adicionado.', 'success');
            setNewUserId('');
            setNewRole('editor');
            await fetchMembers();
        } catch (error) {
            showToast(error?.message || 'Erro ao adicionar membro.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleRemove = async (member) => {
        if (!member?.userId) return;
        if (member.role === 'owner' && ownerCount <= 1) {
            showToast('Nao e possivel remover o ultimo owner.', 'error');
            return;
        }
        setRemovingUserId(member.userId);
        try {
            await removeWorkspaceMember(workspaceId, member.userId);
            showToast('Membro removido.', 'success');
            await fetchMembers();
        } catch (error) {
            showToast(error?.message || 'Erro ao remover membro.', 'error');
        } finally {
            setRemovingUserId(null);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={workspaceName ? `Membros — ${workspaceName}` : 'Membros do workspace'}
            size="lg"
            footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}
        >
            <div className="flex flex-col gap-4">
                {/* Lista de membros */}
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">
                        Membros atuais{members.length > 0 && ` (${members.length})`}
                    </h3>

                    {loading && (
                        <p className="text-sm text-slate-500">Carregando...</p>
                    )}

                    {!loading && members.length === 0 && (
                        <p className="text-sm text-slate-500">Nenhum membro cadastrado ainda.</p>
                    )}

                    {!loading && members.length > 0 && (
                        <ul className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                            {members.map((member) => {
                                const user = allUsers.find((u) => u.id === member.userId);
                                const label = user?.nome
                                    ? `${user.nome}${user.email ? ` — ${user.email}` : ''}`
                                    : member.userId;
                                const canDelete = Boolean(member._links?.delete)
                                    && !(member.role === 'owner' && ownerCount <= 1);
                                const isRemoving = removingUserId === member.userId;
                                return (
                                    <li
                                        key={member.userId}
                                        className="flex items-center justify-between gap-3 px-3 py-2"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm text-slate-800 truncate">{label}</div>
                                            {member.createdAt && (
                                                <div className="text-xs text-slate-500">
                                                    Desde {new Date(member.createdAt).toLocaleDateString('pt-BR')}
                                                </div>
                                            )}
                                        </div>
                                        <span
                                            className={[
                                                'text-xs font-medium px-2 py-0.5 rounded-full',
                                                ROLE_BADGE[member.role] || ROLE_BADGE.viewer,
                                            ].join(' ')}
                                        >
                                            {ROLE_LABEL[member.role] || member.role}
                                        </span>
                                        {canDelete && (
                                            <IconButton
                                                aria-label={`Remover ${label}`}
                                                onClick={() => handleRemove(member)}
                                                disabled={isRemoving}
                                                title="Remover membro"
                                            >
                                                <AppIcon name="trash" />
                                            </IconButton>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Formulario de adicao */}
                {canAdd && (
                    <form onSubmit={handleAdd} className="border-t border-slate-200 pt-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Adicionar membro</h3>
                        <div className="flex flex-col sm:flex-row gap-3 items-end">
                            <div className="flex-1 min-w-0">
                                <SearchableSelect
                                    label="Usuario"
                                    id="ws-member-user"
                                    options={addableUserOptions}
                                    value={newUserId}
                                    onChange={setNewUserId}
                                    placeholder={
                                        addableUserOptions.length === 0
                                            ? 'Todos os usuarios ativos ja sao membros'
                                            : 'Selecionar usuario...'
                                    }
                                    disabled={addableUserOptions.length === 0}
                                />
                            </div>
                            <div className="w-full sm:w-48">
                                <Select
                                    label="Role"
                                    id="ws-member-role"
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value)}
                                >
                                    {ROLE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={!newUserId || submitting}
                            >
                                {submitting ? 'Adicionando...' : 'Adicionar'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </Modal>
    );
}
