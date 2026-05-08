const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./backend/middleware/error');
const supabaseApi = require('./backend/middleware/supabaseApi');
const supabaseConfig = require('./backend/config/supabase');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
if (process.env.NETLIFY !== 'true') {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false
  }));
}

app.use(express.static(__dirname));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Codex Fitness',
    database: 'supabase',
    configured: supabaseConfig.configured(),
    time: new Date().toISOString()
  });
});

app.use('/api', supabaseApi);
app.use('/api', (req, res) => {
  res.status(503).json({
    message: 'Supabase is not configured. Set USE_SUPABASE=true, SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.'
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Codex Fitness running on http://localhost:${PORT}`);
  });
}

module.exports = app;
