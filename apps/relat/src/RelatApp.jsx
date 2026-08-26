import { useState } from 'react';
import { Button, Card, Input, PageHeader } from '@app/components/ui';
import AppIcon from '@app/components/AppIcon';
import { useAuth } from '@app/context/AuthContext';
import { useToast } from '@app/context/ToastContext';
import MonthlyReportPage from './features/monthly-report/MonthlyReportPage';
import GeoPhotosKmzPage from './features/geo/GeoPhotosKmzPage';
import PaecPage from './features/paec/PaecPage';
import FichaErosaoPage from './features/ficha-erosao/FichaErosaoPage';


/**
 * Catalogo de modulos do hub. Cada modulo tem uma cor propria, usada na faixa
 * do topo do cartao e no bloco do icone — a cor e o atalho visual do modulo.
 *
 * As classes de cor ficam escritas por extenso (nunca interpoladas) porque o
 * Tailwind so preserva no CSS final as classes que encontra literalmente no
 * fonte; `bg-${cor}-50` seria purgado.
 */
const MODULES = [
  {
    id: 'monthly-report',
    nome: 'Relatorio Mensal de Servicos',
    descricao: 'Calendario de atividades por engenheiro, resumo por projeto e geracao do documento final.',
    hint: 'Atividades por engenheiro',
    formato: '.docx',
    icone: 'calendar-days',
    faixa: 'bg-brand-600',
    iconeBg: 'bg-brand-50',
    iconeCor: 'text-brand-600',
  },
  {
    id: 'geo',
    nome: 'Geo - Fotos para KMZ',
    descricao: 'Um lote de fotos vira um KMZ com marcadores no GPS do EXIF, montado no navegador.',
    hint: 'Roda sem upload',
    formato: '.kmz',
    icone: 'map',
    faixa: 'bg-success',
    iconeBg: 'bg-success-light',
    iconeCor: 'text-success',
  },
  {
    id: 'paec',
    nome: 'PAEC - Planos de Emergencia',
    descricao: 'Fichas de dados por usina e geracao do Plano de Atendimento as Emergencias atualizado.',
    hint: 'Uma ficha por usina',
    formato: '.docx',
    icone: 'shield',
    faixa: 'bg-warning',
    iconeBg: 'bg-warning-light',
    iconeCor: 'text-warning',
  },
  {
    id: 'ficha-erosao',
    nome: 'Ficha de Erosao Avulsa',
    descricao: 'Cadastro de um foco erosivo na hora, com a ficha pronta para impressao em A4.',
    hint: 'Uma pagina A4',
    formato: '.xlsx',
    icone: 'clipboard',
    faixa: 'bg-violet-600',
    iconeBg: 'bg-violet-50',
    iconeCor: 'text-violet-600',
    selo: 'Novo',
  },
];

/**
 * Cartao de modulo do hub.
 *
 * Nao usa o primitivo `Card` porque a faixa colorida precisa sangrar ate a
 * borda arredondada — o `Card` tem padding fixo. As demais classes de
 * superficie (fundo, borda, raio, sombra) sao as mesmas dele.
 */
function ModuleCard({ modulo, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Abrir ${modulo.nome}`}
      className={[
        'group flex flex-col overflow-hidden text-left',
        'bg-white border border-slate-300 rounded-xl shadow-card',
        'transition-shadow transition-colors duration-150',
        'hover:border-brand-300 hover:shadow-panel',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
      ].join(' ')}
    >
      <span className={`h-[3px] w-full ${modulo.faixa}`} aria-hidden="true" />

      <span className="flex flex-col gap-3 p-5 flex-grow">
        <span className="flex items-start justify-between gap-3">
          <span className={`flex items-center justify-center w-10 h-10 rounded-lg ${modulo.iconeBg}`}>
            <AppIcon name={modulo.icone} size={20} strokeWidth={1.75} className={modulo.iconeCor} />
          </span>
          <span className="font-mono text-2xs font-semibold text-slate-600 bg-slate-100 border border-slate-200 rounded-sm px-2 py-0.5">
            {modulo.formato}
          </span>
        </span>

        <span className="flex flex-col gap-1 flex-grow">
          <span className="flex items-center gap-2">
            <span className="text-md font-semibold text-slate-800">{modulo.nome}</span>
            {modulo.selo && (
              <span className="text-2xs font-semibold text-success bg-success-light border border-success-border rounded-full px-2 py-0.5">
                {modulo.selo}
              </span>
            )}
          </span>
          <span className="text-sm text-slate-500">{modulo.descricao}</span>
        </span>

        <span className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <span className="text-2xs text-slate-400">{modulo.hint}</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600">
            Abrir
            <AppIcon name="arrow-up-right" size={14} />
          </span>
        </span>
      </span>
    </button>
  );
}

/**
 * Shell do Portal de Relatorios (relat.lima.rio.br).
 *
 * Hub de modulos de relatorio. O primeiro modulo e o construtor do Relatorio
 * Mensal de Acompanhamento dos Servicos; a navegacao e um view-switch simples
 * (sem router) — modulos novos entram como cards.
 */
export default function RelatApp() {
  const { user, loading, logout } = useAuth();
  const [activeModule, setActiveModule] = useState(null);

  if (loading) {
    return (
      <main className="flex items-center justify-center h-screen bg-app-bg">
        <p className="text-sm text-slate-500" aria-live="polite">Carregando portal...</p>
      </main>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (activeModule === 'monthly-report') {
    return <MonthlyReportPage onExit={() => setActiveModule(null)} />;
  }

  if (activeModule === 'geo') {
    return <GeoPhotosKmzPage onExit={() => setActiveModule(null)} />;
  }

  if (activeModule === 'paec') {
    return <PaecPage onExit={() => setActiveModule(null)} />;
  }

  if (activeModule === 'ficha-erosao') {
    return <FichaErosaoPage onExit={() => setActiveModule(null)} />;
  }

  return (
    <ModulesHub
      user={user}
      onLogout={logout}
      onOpenModule={setActiveModule}
    />
  );
}

/**
 * Hub de modulos: barra de identidade + grade de cartoes.
 *
 * Exportado a parte do shell para poder ser montado sem sessao (preview e
 * teste isolado); o `RelatApp` continua sendo quem decide se ele aparece.
 */
export function ModulesHub({ user, onLogout, onOpenModule }) {
  const nomeExibido = user.nome || user.email;
  const iniciais = String(nomeExibido)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('');

  return (
    <main className="min-h-screen bg-app-bg">
      {/* Barra de identidade do portal */}
      <header className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-5xl px-6 h-14 flex items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex items-center justify-center w-7 h-7 rounded bg-brand-600">
              <AppIcon name="clipboard" size={17} className="text-white" />
            </span>
            <span className="text-base font-bold text-slate-800">Portal de Relatorios</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-50 border border-brand-200 text-2xs font-bold text-brand-700"
                aria-hidden="true"
              >
                {iniciais}
              </span>
              <span className="text-sm text-slate-600 hidden sm:inline">{nomeExibido}</span>
            </div>
            <span className="w-px h-5 bg-slate-200" aria-hidden="true" />
            <Button variant="outline" size="sm" onClick={onLogout}>
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Portal de Relatorios"
          subtitle={`Conectado como ${nomeExibido}`}
        />

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {MODULES.map((modulo) => (
            <ModuleCard
              key={modulo.id}
              modulo={modulo}
              onOpen={() => onOpenModule(modulo.id)}
            />
          ))}
        </section>
      </div>
    </main>
  );
}

function LoginScreen() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      toast.show(err?.message || 'Falha ao entrar. Verifique suas credenciais.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-app-bg px-4">
      <Card className="w-full max-w-sm">
        <PageHeader title="Portal de Relatorios" subtitle="Entre com sua conta do GeoMonitor" />
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit}>
          <Input
            id="relat-login-email"
            label="E-mail"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="relat-login-password"
            label="Senha"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
