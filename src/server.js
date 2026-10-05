require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { seedData } = require('./db/seed');
const surveyRouter = require('./routes/survey');
const adminRouter = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, 'public')));

// Specific page routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Health check for Docker container orchestrations
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    dbEngine: db.getEngine(),
  });
});

// API Routes
app.use('/api/survey', surveyRouter);
app.use('/api/admin', adminRouter);

// Catch-all route to serve customer survey (Express 5 compatible)
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Startup sequence
async function startServer() {
  try {
    await db.initDatabase();
    await seedData();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('========================================================');
      console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
      console.log(`📋 Portal de Encuesta: http://localhost:${PORT}`);
      console.log(`📊 Panel de Admin:    http://localhost:${PORT}/admin`);
      console.log(`🗄️  Motor de BD:        ${db.getEngine().toUpperCase()}`);
      console.log('========================================================');
    });
  } catch (error) {
    console.error('❌ Error fatal al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();
