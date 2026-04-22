require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());

const isProd = process.env.NODE_ENV === 'production';
const trustProxyRaw = String(process.env.TRUST_PROXY || (isProd ? '1' : 'false')).trim().toLowerCase();
const trustProxyValue = trustProxyRaw === 'true'
  ? true
  : trustProxyRaw === 'false'
    ? false
    : Number.isFinite(Number(trustProxyRaw))
      ? Number(trustProxyRaw)
      : trustProxyRaw;

app.set('trust proxy', trustProxyValue);

const corsOriginEnv = process.env.FRONTEND_URL;
const corsOrigin = corsOriginEnv
  ? corsOriginEnv.split(',').map(o => o.trim()).filter(Boolean)
  : (isProd ? false : '*');

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));

// Request logger — essencial pra diagnosticar uploads em lote em produção.
// Formato 'tiny' para manter os logs do Fly leves.
app.use(morgan(isProd ? 'tiny' : 'dev'));

// Contador de queries por request (AsyncLocalStorage). Emite log WARN e
// persiste alerta em `system_alerts` quando uma request passa de N queries
// (default 15, configuravel via QUERY_COUNT_ALERT_THRESHOLD). Ver painel
// "Alertas do sistema" na aba Estatisticas do gerenciamento.
const { createQueryCounterMiddleware } = require('./middleware/queryCounter');
const systemAlertsRepository = require('./repositories/systemAlertsRepository');
app.use(createQueryCounterMiddleware({ repository: systemAlertsRepository }));

// Rotas que participam de importações em lote (775+ fotos num único clique).
// Essas rotas recebem rajadas legítimas que estouram o rate limit padrão de 600/15min,
// então ficam fora do limiter global. Elas continuam protegidas por auth + RBAC.
const BULK_UPLOAD_SKIP_PATTERNS = [
  /^\/api\/media(\/|$)/,
  /^\/api\/report-workspaces\/[^/]+\/photos(\/|$)/,
];

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 600, // Limite de requisições por IP para rotas "normais"
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => BULK_UPLOAD_SKIP_PATTERNS.some((pattern) => pattern.test(req.originalUrl || req.url || '')),
});

// Limiter dedicado para endpoints de autenticação — protege contra brute force
// em /login, /register, /reset-password e /refresh. skipSuccessfulRequests evita
// punir usuários legítimos que logam corretamente.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { status: 'error', code: 'RATE_LIMITED', message: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

// Limiter dedicado para o console SQL admin — 20 req / 5 min. Mesmo que
// requireAdmin ja proteja, previne loop acidental de execucao.
const adminSqlLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', code: 'RATE_LIMITED', message: 'Limite de execucoes SQL excedido. Aguarde alguns minutos.' },
});

// Aplicar rate limiter apenas em rotas da API
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/admin/sql/execute', adminSqlLimiter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'geomonitor-api' });
});

// Register routes
const erosionsRouter = require('./routes/erosions');
const projectsRouter = require('./routes/projects');
const licensesRouter = require('./routes/licenses');
const inspectionsRouter = require('./routes/inspections');
const usersRouter = require('./routes/users');
const reportDeliveryTrackingRouter = require('./routes/reportDeliveryTracking');
const rulesRouter = require('./routes/rules');
const mediaRouter = require('./routes/media');
const reportsRouter = require('./routes/reports');
const reportJobsRouter = require('./routes/reportJobs');
const reportWorkspacesRouter = require('./routes/reportWorkspaces');
const projectReportDefaultsRouter = require('./routes/projectReportDefaults');
const projectPhotosRouter = require('./routes/projectPhotos');
const projectDossiersRouter = require('./routes/projectDossiers');
const reportCompoundsRouter = require('./routes/reportCompounds');
const reportArchivesRouter = require('./routes/reportArchives');
const reportTemplatesRouter = require('./routes/reportTemplates');
const authRouter = require('./routes/auth');
const profissoesRouter = require('./routes/profissoes');
const adminMetricsRouter = require('./routes/adminMetrics');
const adminSqlExecutorRouter = require('./routes/adminSqlExecutor');
const adminAlertsRouter = require('./routes/adminAlerts');

app.use('/api/auth', authRouter);
app.use('/api/profissoes', profissoesRouter);
app.use('/api/erosions', erosionsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/projects', projectReportDefaultsRouter);
app.use('/api/projects', projectPhotosRouter);
app.use('/api/projects', projectDossiersRouter);
app.use('/api/licenses', licensesRouter);
app.use('/api/inspections', inspectionsRouter);
app.use('/api/users', usersRouter);
app.use('/api/media', mediaRouter);
app.use('/api/report-workspaces', reportWorkspacesRouter);
app.use('/api/report-compounds', reportCompoundsRouter);
app.use('/api/report-archives', reportArchivesRouter);
app.use('/api/report-jobs', reportJobsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/report-delivery-tracking', reportDeliveryTrackingRouter);
app.use('/api/report-templates', reportTemplatesRouter);
app.use('/api/rules', rulesRouter);
app.use('/api/admin/metrics', adminMetricsRouter);
app.use('/api/admin/sql', adminSqlExecutorRouter);
app.use('/api/admin/alerts', adminAlertsRouter);

// Global Error Handler para não expor erros ao cliente em prod
const { logError } = require('./utils/asyncHandler');
app.use((err, req, res, next) => {
  logError('Geomonitor API Global', err, {
    headers: req.headers,
    body: req.body,
    route: `${req.method} ${req.originalUrl || req.url}`,
    userId: req.user?.uid,
  });
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';
  // Erros do Zod validator (via middleware/validate) ja sao 400 com code VALIDATION_ERROR,
  // mas quando caem aqui (lancados fora do middleware) precisam ser tratados.
  if (err.name === 'ZodError' || err.code === 'VALIDATION_ERROR') {
    return res.status(400).json({
      status: 'error',
      code: 'VALIDATION_ERROR',
      message: err.message || 'Dados invalidos.',
    });
  }
  const message = isProd
    ? 'Ocorreu um erro interno no servidor.'
    : err.message;
  res.status(status).json({ status: 'error', message });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Geomonitor API] Server running on port ${PORT}`);
  });
}

module.exports = app;
