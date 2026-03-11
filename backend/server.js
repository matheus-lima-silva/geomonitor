require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// In future steps, we will configure Firebase Admin properly
const { initFirebase } = require('./utils/firebaseSetup');

// Initialize Firebase Admin on startup
initFirebase();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'geomonitor-api' });
});

// Register routes
const erosionsRouter = require('./routes/erosions');
const projectsRouter = require('./routes/projects');
const licensesRouter = require('./routes/licenses');
const inspectionsRouter = require('./routes/inspections');

app.use('/api/erosions', erosionsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/licenses', licensesRouter);
app.use('/api/inspections', inspectionsRouter);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Geomonitor API] Server running on port ${PORT}`);
  });
}

module.exports = app;
