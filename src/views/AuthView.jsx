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
    'auth/invalid-email': 'Email invalido.',
    'auth/missing-email': 'Informe o email.',
    'auth/missing-password': 'Informe a senha.',
    'auth/invalid-credential': 'Email ou senha invalidos.',
    'auth/user-not-found': 'Conta nao encontrada para este email.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/user-disabled': 'Conta desativada. Entre em contato com um administrador.',
    'auth/email-already-in-use': 'Este email ja esta em uso.',
    'auth/weak-password': 'Senha fraca. Use uma senha mais forte.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Falha de rede. Verifique sua conexao.',
  };
  if (byCode[code]) return byCode[code];
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

  return (
    <section className="panel auth auth-card">
      <header className="auth-header">
        <div className="auth-brand-mark">
          <AppIcon name="monitor" size={18} />
        </div>
        <div className="auth-brand-copy">
          <h1>GeoMonitor</h1>
          <p>Acesso seguro e rapido</p>
        </div>
      </header>

      <div className="auth-body">
        <div className="auth-mode-switch" role="tablist" aria-label="Modo de autenticacao">
          <button
            type="button"
            className={`auth-mode-btn ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => switchMode('login')}
            disabled={submitting}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`auth-mode-btn ${mode === 'register' ? 'is-active' : ''}`}
            onClick={() => switchMode('register')}
            disabled={submitting}
          >
            Criar conta
          </button>
          <button
            type="button"
            className={`auth-mode-btn ${mode === 'reset' ? 'is-active' : ''}`}
            onClick={() => switchMode('reset')}
            disabled={submitting}
          >
            Recuperar
          </button>
        </div>

        <div className="auth-context">
          {mode === 'login' && (
            <>
              <h2>Entrar</h2>
              <p className="muted">Use seu email e senha para continuar.</p>
            </>
          )}
          {mode === 'register' && (
            <>
              <h2>Criar conta</h2>
              <p className="muted">A conta sera criada como pendente ate aprovacao do administrador.</p>
            </>
          )}
          {mode === 'reset' && (
            <>
              <h2>Recuperar senha</h2>
              <p className="muted">Informe o email para receber o link de redefinicao.</p>
            </>
          )}
        </div>

        <form onSubmit={onSubmit} className="auth-form">
          {isRegisterMode && (
            <label className="auth-field">
              <span>Nome completo</span>
              <input
                type="text"
                placeholder="Seu nome"
                value={nome}
                onChange={handleInputChange(setNome)}
                autoComplete="name"
                disabled={submitting}
                required={isRegisterMode}
              />
            </label>
          )}

          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              placeholder="email@dominio.com"
              value={email}
              onChange={handleInputChange(setEmail)}
              autoComplete="email"
              disabled={submitting}
              required
            />
          </label>

          {!isResetMode && (
            <label className="auth-field">
              <span>Senha</span>
              <div className="auth-password-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite sua senha"
                  value={password}
                  onChange={handleInputChange(setPassword)}
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  disabled={submitting}
                  required={!isResetMode}
                />
                <button
                  type="button"
                  className="auth-ghost-btn"
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={submitting}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>
          )}

          {isRegisterMode && (
            <>
              <label className="auth-field">
                <span>Confirmar senha</span>
                <div className="auth-password-row">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme a senha"
                    value={confirmPassword}
                    onChange={handleInputChange(setConfirmPassword)}
                    autoComplete="new-password"
                    disabled={submitting}
                    required={isRegisterMode}
                  />
                  <button
                    type="button"
                    className="auth-ghost-btn"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    disabled={submitting}
                >
                  {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </label>

              <div className="auth-password-compact">
                <div className="auth-password-head">
                  <span>Forca</span>
                  <strong>{passwordStrength.label}</strong>
                </div>
                <div className="auth-password-tags">
                  <span className={`auth-password-tag ${passwordRules.minLength ? 'is-ok' : ''}`}>8+ caracteres</span>
                  <span className={`auth-password-tag ${passwordRules.upper ? 'is-ok' : ''}`}>Maiuscula</span>
                  <span className={`auth-password-tag ${passwordRules.lower ? 'is-ok' : ''}`}>Minuscula</span>
                  <span className={`auth-password-tag ${passwordRules.number ? 'is-ok' : ''}`}>Numero</span>
                </div>
              </div>
            </>
          )}

          <button type="submit" className="auth-submit-btn" disabled={submitting}>
            <AppIcon name={isResetMode ? 'lock' : 'login'} />
            {submitting && 'Aguarde...'}
            {!submitting && mode === 'login' && 'Entrar'}
            {!submitting && mode === 'register' && 'Criar conta'}
            {!submitting && mode === 'reset' && 'Enviar recuperacao'}
          </button>
        </form>

        {feedback.text && (
          <div className={`auth-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}`} role="alert">
            {feedback.text}
          </div>
        )}

        <div className="auth-footer-actions">
          {mode !== 'reset' && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => switchMode('reset')}
              disabled={submitting}
            >
              <AppIcon name="lock" />
              Esqueci minha senha
            </button>
          )}
          {mode === 'reset' && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => switchMode('login')}
              disabled={submitting}
            >
              <AppIcon name="login" />
              Voltar para login
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default AuthView;
