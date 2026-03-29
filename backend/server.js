require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// In future steps, we will configure Firebase Admin properly
const { initFirebase } = require('./utils/firebaseSetup');

// Initialize Firebase Admin on startup
initFirebase();

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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 600, // Limite de requisições por IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Aplicar rate limiter apenas em rotas da API
app.use('/api', apiLimiter);

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
const reportTemplatesRouter = require('./routes/reportTemplates');
const authRouter = require('./routes/auth');

app.use('/api/auth', authRouter);
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
app.use('/api/report-jobs', reportJobsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/report-delivery-tracking', reportDeliveryTrackingRouter);
app.use('/api/report-templates', reportTemplatesRouter);
app.use('/api/rules', rulesRouter);

// Global Error Handler para não expor erros ao cliente em prod
app.use((err, req, res, next) => {
  console.error('[Geomonitor API] Global Error:', err);
  const message = process.env.NODE_ENV === 'production' 
    ? 'Ocorreu um erro interno no servidor.' 
    : err.message;
  res.status(err.status || 500).json({ status: 'error', message });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Geomonitor API] Server running on port ${PORT}`);
  });
}

module.exports = app;
