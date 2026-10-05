const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'survey_jwt_secret_super_secure_key_2026';

// Helper to parse options
function parseOptions(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? raw : [];
}

// POST /api/admin/login - Iniciar sesión de administrador
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Ingresa usuario y contraseña' });
    }

    const result = await db.query(
      'SELECT id, username, password_hash, name FROM admin_users WHERE username = $1',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Error en login de admin:', error);
    res.status(500).json({ success: false, message: 'Error interno en el servidor' });
  }
});

// Middleware de Autenticación JWT
function requireAuth(req, res, next) {
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.query && req.query.token) {
    // Allows token via query parameter for direct CSV export downloads
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Acceso no autorizado. Inicia sesión para continuar.',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Sesión expirada o token inválido. Por favor inicia sesión nuevamente.',
    });
  }
}

// Proteger todas las rutas subsiguientes con el middleware requireAuth
router.use(requireAuth);

// GET /api/admin/metrics - Obtener métricas y KPIs consolidados
router.get('/metrics', async (req, res) => {
  try {
    // 1. Total survey responses
    const totalRespRes = await db.query('SELECT COUNT(*) as count FROM survey_responses');
    const totalResponses = parseInt(totalRespRes.rows[0].count, 10);

    // 2. Fetch all active questions and their answers
    const questionsRes = await db.query(
      `SELECT id, title, description, type, options, required, order_index, is_active
       FROM questions
       ORDER BY order_index ASC, id ASC`
    );
    const questions = questionsRes.rows;

    const answersRes = await db.query(
      `SELECT sa.id, sa.response_id, sa.question_id, sa.answer_value, sa.answer_json, sa.created_at,
              sr.submitted_at
       FROM survey_answers sa
       JOIN survey_responses sr ON sa.response_id = sr.id
       ORDER BY sa.created_at DESC`
    );
    const allAnswers = answersRes.rows;

    // Global KPIs
    let totalRatingsSum = 0;
    let totalRatingsCount = 0;

    let npsPromoters = 0;
    let npsPassives = 0;
    let npsDetractors = 0;
    let totalNpsResponses = 0;

    // Process metric per question
    const questionMetrics = questions.map(q => {
      const qAnswers = allAnswers.filter(a => a.question_id === q.id);
      const parsedOptions = parseOptions(q.options);

      const metric = {
        id: q.id,
        title: q.title,
        type: q.type,
        totalAnswers: qAnswers.length,
        options: parsedOptions,
      };

      if (q.type === 'rating') {
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        let sum = 0;
        let count = 0;

        qAnswers.forEach(a => {
          const val = parseInt(a.answer_value, 10);
          if (val >= 1 && val <= 5) {
            distribution[val] = (distribution[val] || 0) + 1;
            sum += val;
            count++;
            totalRatingsSum += val;
            totalRatingsCount++;
          }
        });

        const avg = count > 0 ? Number((sum / count).toFixed(2)) : 0;
        const satisfactionRate = count > 0 
          ? Number((((distribution[4] + distribution[5]) / count) * 100).toFixed(1)) 
          : 0;

        metric.average = avg;
        metric.distribution = distribution;
        metric.satisfactionRate = satisfactionRate;
      } else if (q.type === 'nps') {
        const distribution = {};
        for (let i = 0; i <= 10; i++) distribution[i] = 0;
        let qPromoters = 0;
        let qPassives = 0;
        let qDetractors = 0;
        let qTotal = 0;

        qAnswers.forEach(a => {
          const val = parseInt(a.answer_value, 10);
          if (!isNaN(val) && val >= 0 && val <= 10) {
            distribution[val] = (distribution[val] || 0) + 1;
            qTotal++;
            totalNpsResponses++;
            if (val >= 9) {
              qPromoters++;
              npsPromoters++;
            } else if (val >= 7) {
              qPassives++;
              npsPassives++;
            } else {
              qDetractors++;
              npsDetractors++;
            }
          }
        });

        const npsScore = qTotal > 0 
          ? Math.round(((qPromoters - qDetractors) / qTotal) * 100) 
          : 0;

        metric.distribution = distribution;
        metric.npsScore = npsScore;
        metric.promotersPercent = qTotal > 0 ? Number(((qPromoters / qTotal) * 100).toFixed(1)) : 0;
        metric.passivesPercent = qTotal > 0 ? Number(((qPassives / qTotal) * 100).toFixed(1)) : 0;
        metric.detractorsPercent = qTotal > 0 ? Number(((qDetractors / qTotal) * 100).toFixed(1)) : 0;
      } else if (q.type === 'single_choice' || q.type === 'multiple_choice') {
        const counts = {};
        parsedOptions.forEach(opt => { counts[opt] = 0; });

        let totalPicks = 0;
        qAnswers.forEach(a => {
          if (q.type === 'multiple_choice' && a.answer_json) {
            try {
              const selectedList = JSON.parse(a.answer_json);
              selectedList.forEach(opt => {
                counts[opt] = (counts[opt] || 0) + 1;
                totalPicks++;
              });
            } catch {
              const opt = a.answer_value;
              counts[opt] = (counts[opt] || 0) + 1;
              totalPicks++;
            }
          } else {
            const opt = a.answer_value;
            counts[opt] = (counts[opt] || 0) + 1;
            totalPicks++;
          }
        });

        metric.counts = counts;
        metric.totalPicks = totalPicks;
      } else if (q.type === 'text') {
        metric.recentAnswers = qAnswers.slice(0, 5).map(a => ({
          id: a.id,
          text: a.answer_value,
          date: a.submitted_at,
        }));
      }

      return metric;
    });

    // Compute Global CSAT (out of 5)
    const globalCsat = totalRatingsCount > 0 
      ? Number((totalRatingsSum / totalRatingsCount).toFixed(2)) 
      : 0;

    // Compute Global NPS Score (-100 to +100)
    const globalNps = totalNpsResponses > 0 
      ? Math.round(((npsPromoters - npsDetractors) / totalNpsResponses) * 100) 
      : 0;

    const promotersPercent = totalNpsResponses > 0 
      ? Number(((npsPromoters / totalNpsResponses) * 100).toFixed(1)) 
      : 0;

    res.json({
      success: true,
      kpis: {
        totalResponses,
        globalCsat,
        globalNps,
        promotersPercent,
        totalFeedbackAnswers: allAnswers.length,
      },
      questionMetrics,
    });
  } catch (error) {
    console.error('Error al generar métricas:', error);
    res.status(500).json({ success: false, message: 'Error interno al calcular métricas' });
  }
});

// GET /api/admin/open-feedback - Visualizar todas las respuestas a preguntas abiertas
router.get('/open-feedback', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sa.id, sa.answer_value, sa.created_at,
              q.id as question_id, q.title as question_title,
              sr.id as response_id, sr.respondent_name
       FROM survey_answers sa
       JOIN questions q ON sa.question_id = q.id
       JOIN survey_responses sr ON sa.response_id = sr.id
       WHERE q.type = 'text' AND sa.answer_value IS NOT NULL AND TRIM(sa.answer_value) != ''
       ORDER BY sa.created_at DESC`
    );

    res.json({
      success: true,
      feedback: result.rows.map(row => ({
        id: row.id,
        questionId: row.question_id,
        questionTitle: row.question_title,
        responseId: row.response_id,
        respondentName: row.respondent_name || 'Anónimo',
        content: row.answer_value,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error('Error al cargar feedback abierto:', error);
    res.status(500).json({ success: false, message: 'Error al consultar respuestas abiertas' });
  }
});

// GET /api/admin/questions - Listar preguntas para gestión
router.get('/questions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT q.*, COUNT(sa.id) as answer_count
       FROM questions q
       LEFT JOIN survey_answers sa ON q.id = sa.question_id
       GROUP BY q.id
       ORDER BY q.order_index ASC, q.id ASC`
    );

    const questions = result.rows.map(q => ({
      id: q.id,
      title: q.title,
      description: q.description || '',
      type: q.type,
      options: parseOptions(q.options),
      required: Boolean(q.required),
      orderIndex: q.order_index,
      isActive: Boolean(q.is_active),
      answerCount: parseInt(q.answer_count || 0, 10),
      createdAt: q.created_at,
    }));

    res.json({ success: true, questions });
  } catch (error) {
    console.error('Error al listar preguntas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener listado de preguntas' });
  }
});

// POST /api/admin/questions - Crear nueva pregunta
router.post('/questions', async (req, res) => {
  try {
    const { title, description, type, options, required, orderIndex } = req.body;

    if (!title || !type) {
      return res.status(400).json({ success: false, message: 'El título y el tipo de pregunta son requeridos' });
    }

    const validTypes = ['rating', 'nps', 'single_choice', 'multiple_choice', 'text'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: 'Tipo de pregunta inválido' });
    }

    const optionsJson = JSON.stringify(Array.isArray(options) ? options : []);
    const reqFlag = Boolean(required);
    const order = typeof orderIndex === 'number' ? orderIndex : 10;

    const result = await db.query(
      `INSERT INTO questions (title, description, type, options, required, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title.trim(), description ? description.trim() : '', type, optionsJson, reqFlag, order, true]
    );

    const created = result.rows[0];
    res.json({
      success: true,
      message: 'Pregunta creada exitosamente',
      question: {
        id: created.id,
        title: created.title,
        description: created.description,
        type: created.type,
        options: parseOptions(created.options),
        required: Boolean(created.required),
        orderIndex: created.order_index,
        isActive: Boolean(created.is_active),
      }
    });
  } catch (error) {
    console.error('Error al crear pregunta:', error);
    res.status(500).json({ success: false, message: 'Error al registrar la pregunta' });
  }
});

// PUT /api/admin/questions/:id - Modificar pregunta existente
router.put('/questions/:id', async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    const { title, description, type, options, required, orderIndex, isActive } = req.body;

    const existing = await db.query('SELECT * FROM questions WHERE id = $1', [questionId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
    }

    const current = existing.rows[0];
    const newTitle = title !== undefined ? title.trim() : current.title;
    const newDesc = description !== undefined ? description.trim() : current.description;
    const newType = type !== undefined ? type : current.type;
    const newOptions = options !== undefined ? JSON.stringify(options) : current.options;
    const newRequired = required !== undefined ? Boolean(required) : Boolean(current.required);
    const newOrder = orderIndex !== undefined ? orderIndex : current.order_index;
    const newActive = isActive !== undefined ? Boolean(isActive) : Boolean(current.is_active);

    await db.query(
      `UPDATE questions
       SET title = $1, description = $2, type = $3, options = $4, required = $5, order_index = $6, is_active = $7
       WHERE id = $8`,
      [newTitle, newDesc, newType, newOptions, newRequired, newOrder, newActive, questionId]
    );

    res.json({ success: true, message: 'Pregunta actualizada exitosamente' });
  } catch (error) {
    console.error('Error al actualizar pregunta:', error);
    res.status(500).json({ success: false, message: 'Error al modificar pregunta' });
  }
});

// DELETE /api/admin/questions/:id - Eliminar pregunta
router.delete('/questions/:id', async (req, res) => {
  try {
    const questionId = parseInt(req.params.id, 10);
    
    // Delete associated answers first, then the question
    await db.query('DELETE FROM survey_answers WHERE question_id = $1', [questionId]);
    const result = await db.query('DELETE FROM questions WHERE id = $1', [questionId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Pregunta no encontrada' });
    }

    res.json({ success: true, message: 'Pregunta eliminada con éxito' });
  } catch (error) {
    console.error('Error al eliminar pregunta:', error);
    res.status(500).json({ success: false, message: 'Error al eliminar pregunta' });
  }
});

// GET /api/admin/export - Descargar datos en formato CSV
router.get('/export', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT sr.id as response_id, sr.respondent_name, sr.submitted_at,
              q.title as question_title, q.type as question_type,
              sa.answer_value
       FROM survey_responses sr
       JOIN survey_answers sa ON sr.id = sa.response_id
       JOIN questions q ON sa.question_id = q.id
       ORDER BY sr.submitted_at DESC, q.order_index ASC`
    );

    let csv = 'ID Respuesta,Nombre,Fecha,Pregunta,Tipo,Respuesta\n';
    result.rows.forEach(r => {
      const escape = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
      csv += `${r.response_id},${escape(r.respondent_name)},${escape(r.submitted_at)},${escape(r.question_title)},${escape(r.question_type)},${escape(r.answer_value)}\n`;
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="encuesta_satisfaccion_reporte.csv"');
    res.send('\uFEFF' + csv); // Include BOM for Excel Spanish accent compatibility
  } catch (error) {
    console.error('Error al exportar CSV:', error);
    res.status(500).send('Error al exportar datos');
  }
});

module.exports = router;
