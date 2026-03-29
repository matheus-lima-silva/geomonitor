import { useMemo, useState } from 'react';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeAuthEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return EMAIL_PATTERN.test(normalizeAuthEmail(email));
}

function getPasswordRules(password) {
  const value = String(password || '');
  return {
    minLength: value.length >= 8,
    upper: /[A-Z]/.test(value),
    lower: /[a-z]/.test(value),
    number: /\d/.test(value),
  };
}

function getPasswordStrength(rules) {
  const score = Object.values(rules).filter(Boolean).length;
  if (score <= 1) return { score, label: 'Fraca' };
  if (score === 2) return { score, label: 'Regular' };
  if (score === 3) return { score, label: 'Boa' };
  return { score, label: 'Forte' };
}

function getAuthErrorMessage(error) {
  const code = String(error?.code || '').trim();
  const byCode = {
    INVALID_EMAIL: 'Email invalido.',
    MISSING_NAME: 'Informe o nome.',
    MISSING_CREDENTIALS: 'Informe email e senha.',
    INVALID_CREDENTIALS: 'Email ou senha incorretos.',
    EMAIL_IN_USE: 'Este email ja esta em uso.',
    WEAK_PASSWORD: 'Senha fraca. Use uma senha mais forte.',
    PROFILE_NOT_FOUND: 'Perfil nao encontrado. Contate um administrador.',
    MIGRATION_RESET_REQUIRED: 'Sua conta foi migrada. Redefina sua senha clicando em "Esqueci minha senha".',
  };
  if (byCode[code]) return byCode[code];
  if (error?.message) return error.message;
  return 'Nao foi possivel concluir a acao. Tente novamente.';
}

function AuthView() {
  const { login, register, resetPassword, logout } = useAuth();
  const { show } = useToast();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nome, setNome] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', text: '' });

  const isRegisterMode = mode === 'register';
  const isResetMode = mode === 'reset';
  const passwordRules = useMemo(() => getPasswordRules(password), [password]);
  const passwordStrength = useMemo(() => getPasswordStrength(passwordRules), [passwordRules]);
  const allPasswordRulesOk = Object.values(passwordRules).every(Boolean);

  function clearSensitiveFields() {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  function switchMode(nextMode) {
    if (submitting) return;
    setMode(nextMode);
    setFeedback({ type: '', text: '' });
    clearSensitiveFields();
    if (nextMode !== 'register') setNome('');
  }

  function clearFeedback() {
    if (feedback.text) {
      setFeedback({ type: '', text: '' });
    }
  }

  function handleInputChange(setter) {
    return (event) => {
      clearFeedback();
      setter(event.target.value);
    };
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const normalizedEmail = normalizeAuthEmail(email);
    const trimmedName = String(nome || '').trim();

    if (!normalizedEmail) {
      setFeedback({ type: 'error', text: 'Informe o email.' });
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setFeedback({ type: 'error', text: 'Informe um email valido.' });
      return;
    }
    if (!isResetMode && !password) {
      setFeedback({ type: 'error', text: 'Informe a senha.' });
      return;
    }
    if (isRegisterMode) {
      if (trimmedName.length < 3) {
        setFeedback({ type: 'error', text: 'Nome deve ter pelo menos 3 caracteres.' });
        return;
      }
      if (!allPasswordRulesOk) {
        setFeedback({ type: 'error', text: 'Senha deve ter 8+ caracteres, maiuscula, minuscula e numero.' });
        return;
      }
      if (password !== confirmPassword) {
        setFeedback({ type: 'error', text: 'As senhas nao coincidem.' });
        return;
      }
    }

    setSubmitting(true);
    setFeedback({ type: '', text: '' });

    try {
      if (isRegisterMode) {
        await register(normalizedEmail, password, trimmedName);
        await logout();
        setEmail(normalizedEmail);
        clearSensitiveFields();
        setNome('');
        setMode('login');
        const text = 'Conta criada com sucesso. Aguarde aprovacao de um administrador.';
        setFeedback({ type: 'success', text });
        show(text, 'success');
        return;
      }

      if (isResetMode) {
        await resetPassword(normalizedEmail);
        setEmail(normalizedEmail);
        clearSensitiveFields();
        setMode('login');
        const text = 'Email de recuperacao enviado. Verifique sua caixa de entrada.';
        setFeedback({ type: 'success', text });
        show(text, 'success');
        return;
      }

      await login(normalizedEmail, password);
      show('Login realizado com sucesso.', 'success');
    } catch (error) {
      const text = getAuthErrorMessage(error);
      setFeedback({ type: 'error', text });
      show(text, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const strengthColors = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];

  return (
    <div className="flex items-start sm:items-center justify-center min-h-[100dvh] bg-app-bg p-4 sm:p-6 overflow-y-auto">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-panel border border-slate-200 overflow-x-hidden overflow-y-auto max-h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-3rem)]">
        {/* Brand Header */}
        <header className="flex items-center gap-4 px-8 pt-8 pb-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-600 text-white shadow-md">
            <AppIcon name="monitor" size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 leading-tight">GeoMonitor</h1>
            <p className="text-sm text-slate-500">Acesso seguro e rapido</p>
          </div>
        </header>

        <div className="px-8 pb-8 pt-2 flex flex-col gap-5">
          {/* Tab Switch */}
          <div className="flex rounded-lg bg-slate-100 p-1 gap-1" role="tablist" aria-label="Modo de autenticacao">
            {[
              { id: 'login', label: 'Entrar' },
              { id: 'register', label: 'Criar conta' },
              { id: 'reset', label: 'Recuperar' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`flex-1 py-2 px-3 text-sm font-semibold rounded-md transition-all duration-200 ${mode === tab.id
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                  }`}
                onClick={() => switchMode(tab.id)}
                disabled={submitting}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Context */}
          <div>
            {mode === 'login' && (
              <>
                <h2 className="text-lg font-bold text-slate-800">Entrar</h2>
                <p className="text-sm text-slate-500 mt-0.5">Use seu email e senha para continuar.</p>
              </>
            )}
            {mode === 'register' && (
              <>
                <h2 className="text-lg font-bold text-slate-800">Criar conta</h2>
                <p className="text-sm text-slate-500 mt-0.5">A conta sera criada como pendente ate aprovacao do administrador.</p>
              </>
            )}
            {mode === 'reset' && (
              <>
                <h2 className="text-lg font-bold text-slate-800">Recuperar senha</h2>
                <p className="text-sm text-slate-500 mt-0.5">Informe o email para receber o link de redefinicao.</p>
              </>
            )}
          </div>

          {/* Form */}
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {isRegisterMode && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Nome completo</span>
                <input
                  type="text"
                  placeholder="Seu nome"
                  value={nome}
                  onChange={handleInputChange(setNome)}
                  autoComplete="name"
                  disabled={submitting}
                  required={isRegisterMode}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
                />
              </label>
            )}

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                placeholder="email@dominio.com"
                value={email}
                onChange={handleInputChange(setEmail)}
                autoComplete="email"
                disabled={submitting}
                required
                className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
              />
            </label>

            {!isResetMode && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700">Senha</span>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={handleInputChange(setPassword)}
                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                    disabled={submitting}
                    required={!isResetMode}
                    className="w-full px-3 py-2.5 pr-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={submitting}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    <AppIcon name={showPassword ? 'eye-off' : 'eye'} size={18} />
                  </button>
                </div>
              </label>
            )}

            {isRegisterMode && (
              <>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-semibold text-slate-700">Confirmar senha</span>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirme a senha"
                      value={confirmPassword}
                      onChange={handleInputChange(setConfirmPassword)}
                      autoComplete="new-password"
                      disabled={submitting}
                      required={isRegisterMode}
                      className="w-full px-3 py-2.5 pr-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors disabled:opacity-60"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md text-slate-500 hover:text-brand-700 hover:bg-brand-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      disabled={submitting}
                      aria-label={showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                      title={showConfirmPassword ? 'Ocultar confirmacao de senha' : 'Mostrar confirmacao de senha'}
                    >
                      <AppIcon name={showConfirmPassword ? 'eye-off' : 'eye'} size={18} />
                    </button>
                  </div>
                </label>

                {/* Password Strength */}
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-slate-500">Forca</span>
                    <strong className="text-xs font-bold text-slate-700">{passwordStrength.label}</strong>
                  </div>
                  {/* Strength bar */}
                  <div className="flex gap-1 mb-2.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={`str-${idx}`}
                        className={`h-1 flex-1 rounded-full transition-colors ${idx < passwordStrength.score ? strengthColors[Math.min(passwordStrength.score - 1, 3)] : 'bg-slate-200'
                          }`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { key: 'minLength', label: '8+ caracteres' },
                      { key: 'upper', label: 'Maiuscula' },
                      { key: 'lower', label: 'Minuscula' },
                      { key: 'number', label: 'Numero' },
                    ].map((rule) => (
                      <span
                        key={rule.key}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-semibold transition-colors ${passwordRules[rule.key]
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}
                      >
                        {passwordRules[rule.key] ? '✓' : '○'} {rule.label}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-brand-600 hover:bg-brand-700 text-white font-semibold rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={submitting}
            >
              <AppIcon name={isResetMode ? 'lock' : 'login'} size={18} />
              {submitting && 'Aguarde...'}
              {!submitting && mode === 'login' && 'Entrar'}
              {!submitting && mode === 'register' && 'Criar conta'}
              {!submitting && mode === 'reset' && 'Enviar recuperacao'}
            </button>
          </form>

          {/* Feedback */}
          {feedback.text && (
            <div
              className={`rounded-lg px-4 py-3 text-sm font-medium ${feedback.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
                }`}
              role="alert"
            >
              {feedback.text}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-center pt-1">
            {mode !== 'reset' && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 font-medium transition-colors"
                onClick={() => switchMode('reset')}
                disabled={submitting}
              >
                <AppIcon name="lock" size={14} />
                Esqueci minha senha
              </button>
            )}
            {mode === 'reset' && (
              <button
                type="button"
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-brand-600 font-medium transition-colors"
                onClick={() => switchMode('login')}
                disabled={submitting}
              >
                <AppIcon name="login" size={14} />
                Voltar para login
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default AuthView;
