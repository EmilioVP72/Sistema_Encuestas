const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/survey/questions - Obtener preguntas activas para el usuario
router.get('/questions', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, title, description, type, options, required, order_index
       FROM questions
       WHERE is_active = TRUE
       ORDER BY order_index ASC, id ASC`
    );

    const questions = result.rows.map(q => {
      let parsedOptions = [];
      if (typeof q.options === 'string') {
        try {
          parsedOptions = JSON.parse(q.options);
        } catch {
          parsedOptions = [];
        }
      } else if (Array.isArray(q.options)) {
        parsedOptions = q.options;
      }

      return {
        id: q.id,
        title: q.title,
        description: q.description || '',
        type: q.type,
        options: parsedOptions,
        required: Boolean(q.required),
        orderIndex: q.order_index,
      };
    });

    res.json({ success: true, questions });
  } catch (error) {
    console.error('Error al obtener preguntas:', error);
    res.status(500).json({ success: false, message: 'Error interno al cargar la encuesta' });
  }
});

// POST /api/survey/submit - Enviar respuestas de la encuesta
router.post('/submit', async (req, res) => {
  try {
    const { respondentName, answers } = req.body;

    if (!answers || typeof answers !== 'object') {
      return res.status(400).json({ success: false, message: 'Formato de respuestas inválido' });
    }

    // Fetch active questions to validate required fields
    const questionsRes = await db.query(
      `SELECT id, title, required, type FROM questions WHERE is_active = TRUE`
    );
    const activeQuestions = questionsRes.rows;

    for (const q of activeQuestions) {
      const isReq = Boolean(q.required);
      const userAns = answers[q.id];
      if (isReq) {
        if (userAns === undefined || userAns === null || userAns === '' || (Array.isArray(userAns) && userAns.length === 0)) {
          return res.status(400).json({
            success: false,
            message: `La pregunta "${q.title}" es obligatoria.`
          });
        }
      }
    }

    // Create response header record
    const userIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Desconocido';

    const respResult = await db.query(
      `INSERT INTO survey_responses (respondent_name, user_ip, user_agent)
       VALUES ($1, $2, $3) RETURNING id`,
      [respondentName ? respondentName.trim() : 'Anónimo', userIp, userAgent]
    );

    const responseId = respResult.rows[0].id;

    // Insert each answer
    for (const [qIdStr, val] of Object.entries(answers)) {
      const questionId = parseInt(qIdStr, 10);
      if (isNaN(questionId)) continue;

      if (val === undefined || val === null || val === '') continue;

      if (Array.isArray(val)) {
        await db.query(
          `INSERT INTO survey_answers (response_id, question_id, answer_value, answer_json)
           VALUES ($1, $2, $3, $4)`,
          [responseId, questionId, val.join(', '), JSON.stringify(val)]
        );
      } else {
        await db.query(
          `INSERT INTO survey_answers (response_id, question_id, answer_value, answer_json)
           VALUES ($1, $2, $3, $4)`,
          [responseId, questionId, String(val), null]
        );
      }
    }

    res.json({
      success: true,
      message: '¡Encuesta registrada con éxito!',
      responseId,
    });
  } catch (error) {
    console.error('Error al registrar respuestas:', error);
    res.status(500).json({ success: false, message: 'Error al guardar la encuesta' });
  }
});

module.exports = router;
