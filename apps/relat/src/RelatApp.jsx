import { useState } from 'react';
import { Button, Card, Input, PageHeader } from '@app/components/ui';
import { useAuth } from '@app/context/AuthContext';
import { useToast } from '@app/context/ToastContext';
import MonthlyReportPage from './features/monthly-report/MonthlyReportPage';
import GeoPhotosKmzPage from './features/geo/GeoPhotosKmzPage';

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

  return (
    <main className="min-h-screen bg-app-bg">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <PageHeader
          title="Portal de Relatorios"
          subtitle={`Conectado como ${user.nome || user.email}`}
          action={
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Sair
            </Button>
          }
        />

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0">Relatorio Mensal de Servicos</h3>
            <p className="text-sm text-slate-500 mt-1 mb-3">
              Calendario de atividades por engenheiro, resumo por projeto e geracao do .docx pronto.
            </p>
            <Button variant="primary" size="sm" onClick={() => setActiveModule('monthly-report')}>
              Abrir
            </Button>
          </Card>

          <Card>
            <h3 className="text-base font-semibold text-slate-800 m-0">Geo · Fotos para KMZ</h3>
            <p className="text-sm text-slate-500 mt-1 mb-3">
              Um lote de fotos vira um KMZ com marcadores no GPS do EXIF — montado no navegador, sem upload.
            </p>
            <Button variant="primary" size="sm" onClick={() => setActiveModule('geo')}>
              Abrir
            </Button>
          </Card>
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
