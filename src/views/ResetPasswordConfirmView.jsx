import { useState } from 'react';
import AppIcon from '../components/AppIcon';
import { confirmResetPassword } from '../services/authService';
import { useToast } from '../context/ToastContext';

function ResetPasswordConfirmView({ token, onDone }) {
  const { show } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    if (!password || password.length < 8) {
      setFeedback({ type: 'error', text: 'Senha deve ter pelo menos 8 caracteres.' });
      return;
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      setFeedback({ type: 'error', text: 'Senha deve ter maiuscula, minuscula e numero.' });
      return;
    }
    if (password !== confirmPw) {
      setFeedback({ type: 'error', text: 'As senhas nao coincidem.' });
      return;
    }

    setSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      await confirmResetPassword(token, password);
      setFeedback({ type: 'success', text: 'Senha redefinida com sucesso! Voce ja pode fazer login.' });
      show('Senha redefinida com sucesso!', 'success');
    } catch (error) {
      const text = error?.message || 'Erro ao redefinir senha. O link pode ter expirado.';
      setFeedback({ type: 'error', text });
      show(text, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-start sm:items-center justify-center min-h-[100dvh] bg-app-bg p-4 sm:p-6 overflow-y-auto">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-panel border border-slate-200 overflow-hidden">
        <header className="flex items-center gap-4 px-8 pt-8 pb-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-600 text-white shadow-md">
            <AppIcon name="lock" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">GeoMonitor</h1>
            <p className="text-sm text-slate-500">Redefinir senha</p>
          </div>
        </header>

        <div className="px-8 pb-8 pt-2 flex flex-col gap-5">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Nova senha</h2>
            <p className="text-sm text-slate-500 mt-0.5">Defina sua nova senha abaixo.</p>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Nova senha</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite a nova senha"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFeedback({ type: '', text: '' }); }}
                  autoComplete="new-password"
                  disabled={submitting}
                  required
                  className="w-full px-3 py-2.5 pr-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                  onClick={() => setShowPassword((v) => !v)}
                  disabled={submitting}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Confirmar senha</span>
              <input
                type="password"
                placeholder="Confirme a nova senha"
                value={confirmPw}
                onChange={(e) => { setConfirmPw(e.target.value); setFeedback({ type: '', text: '' }); }}
                autoComplete="new-password"
                disabled={submitting}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
              />
            </label>

            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              <AppIcon name="lock" size={18} />
              {submitting ? 'Aguarde...' : 'Redefinir senha'}
            </button>
          </form>

          {feedback.text && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${
                feedback.type === 'error'
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}
              role="alert"
            >
              {feedback.text}
            </div>
          )}

          <div className="flex justify-center pt-1">
            <button
              type="button"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 font-medium transition-colors"
              onClick={onDone}
              disabled={submitting}
            >
              <AppIcon name="login" size={14} />
              Voltar para login
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ResetPasswordConfirmView;
