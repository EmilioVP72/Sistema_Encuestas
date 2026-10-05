const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Determine database mode: PostgreSQL if DATABASE_URL or POSTGRES_HOST is provided, else fallback to node:sqlite
const isPostgresConfigured = Boolean(process.env.DATABASE_URL || process.env.POSTGRES_HOST);

let pgPool = null;
let sqliteDb = null;
let currentDbEngine = 'none';

async function initDatabase() {
  if (isPostgresConfigured) {
    try {
      const connectionString = process.env.DATABASE_URL || 
        `postgres://${process.env.POSTGRES_USER || 'survey_user'}:${process.env.POSTGRES_PASSWORD || 'survey_password'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || 5432}/${process.env.POSTGRES_DB || 'survey_db'}`;
      
      console.log('🔄 Intentando conectar a PostgreSQL...');
      pgPool = new Pool({
        connectionString,
        connectionTimeoutMillis: 5000,
      });

      // Test connection with retry for Docker startup synchronization
      let connected = false;
      let retries = 5;
      while (!connected && retries > 0) {
        try {
          await pgPool.query('SELECT 1');
          connected = true;
          currentDbEngine = 'postgres';
          console.log('✅ Conexión exitosa a PostgreSQL');
        } catch (err) {
          retries--;
          console.log(`⏳ Esperando a PostgreSQL (${retries} reintentos restantes)...`);
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, 2000));
        }
      }

      await setupPostgresSchema();
      return;
    } catch (err) {
      console.warn('⚠️ No se pudo conectar a PostgreSQL:', err.message);
      console.log('🔄 Activando base de datos SQLite integrada...');
    }
  }

  // Fallback to SQLite (built-in node:sqlite or file)
  setupSqlite();
}

function setupSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  const dataDir = path.join(__dirname, '../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'survey.db');
  sqliteDb = new DatabaseSync(dbPath);
  currentDbEngine = 'sqlite';
  console.log(`✅ Base de datos SQLite activa en: ${dbPath}`);

  // SQLite Schema
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL,
      options TEXT,
      required INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      respondent_name TEXT,
      user_ip TEXT,
      user_agent TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      answer_value TEXT,
      answer_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (response_id) REFERENCES survey_responses(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function setupPostgresSchema() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name VARCHAR(150),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      type VARCHAR(50) NOT NULL,
      options TEXT,
      required BOOLEAN DEFAULT true,
      order_index INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_responses (
      id SERIAL PRIMARY KEY,
      respondent_name VARCHAR(150),
      user_ip VARCHAR(50),
      user_agent TEXT,
      submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS survey_answers (
      id SERIAL PRIMARY KEY,
      response_id INTEGER NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
      answer_value TEXT,
      answer_json TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Unified query runner
async function query(sql, params = []) {
  if (currentDbEngine === 'postgres') {
    const res = await pgPool.query(sql, params);
    return res;
  } else if (currentDbEngine === 'sqlite') {
    // Transform $1, $2, ... into ?
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    
    // Check if SELECT or INSERT/UPDATE/DELETE
    const trimmed = sqliteSql.trim();
    const isSelect = /^SELECT/i.test(trimmed);
    const hasReturning = /RETURNING/i.test(trimmed);

    const stmt = sqliteDb.prepare(sqliteSql);
    if (isSelect || hasReturning) {
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    } else {
      const info = stmt.run(...params);
      return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }
  } else {
    throw new Error('Base de datos no inicializada');
  }
}

function getEngine() {
  return currentDbEngine;
}

module.exports = {
  initDatabase,
  query,
  getEngine,
};
