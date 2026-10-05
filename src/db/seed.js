const bcrypt = require('bcryptjs');
const db = require('./index');

async function seedData() {
  console.log('🌱 Verificando datos iniciales...');
  
  // Seed default admin user
  const adminCheck = await db.query('SELECT COUNT(*) as count FROM admin_users');
  const adminCount = parseInt(adminCheck.rows[0].count, 10);
  if (adminCount === 0) {
    console.log('🌱 Creando usuario administrador por defecto...');
    const passwordHash = await bcrypt.hash('admin123', 10);
    await db.query(
      `INSERT INTO admin_users (username, password_hash, name)
       VALUES ($1, $2, $3)`,
      ['admin', passwordHash, 'Administrador']
    );
    console.log('✅ Usuario administrador creado (Usuario: admin | Clave: admin123)');
  }

  // Check if questions already exist
  const existing = await db.query('SELECT COUNT(*) as count FROM questions');
  const count = parseInt(existing.rows[0].count, 10);

  if (count > 0) {
    console.log(`ℹ️ Base de datos ya cuenta con ${count} preguntas registradas.`);
    return;
  }

  console.log('🌱 Sembrando preguntas por defecto...');

  const defaultQuestions = [
    {
      title: '¿Cómo calificarías la calidad general del servicio recibido?',
      description: 'Selecciona una puntuación del 1 (Muy deficiente) al 5 (Excelente)',
      type: 'rating',
      options: JSON.stringify(['Muy deficiente', 'Deficiente', 'Aceptable', 'Bueno', 'Excelente']),
      required: true,
      order_index: 1,
    },
    {
      title: '¿El tiempo de respuesta cumplió con tus expectativas?',
      description: 'Evalúa la agilidad con la que atendimos tu solicitud',
      type: 'single_choice',
      options: JSON.stringify([
        'Superó mis expectativas',
        'Adecuado y a tiempo',
        'Un poco lento',
        'Tardó demasiado'
      ]),
      required: true,
      order_index: 2,
    },
    {
      title: '¿Qué aspectos destacarías más de nuestra atención?',
      description: 'Puedes seleccionar una o más alternativas que reflejen tu experiencia',
      type: 'multiple_choice',
      options: JSON.stringify([
        'Amabilidad y cortesía del equipo',
        'Rapidez en la resolución',
        'Claridad en las explicaciones',
        'Facilidad del proceso',
        'Disponibilidad del soporte'
      ]),
      required: false,
      order_index: 3,
    },
    {
      title: '¿Qué tan probable es que recomiendes nuestros servicios?',
      description: 'Escala estándar NPS de 0 (Nada probable) a 10 (Totalmente seguro)',
      type: 'nps',
      options: JSON.stringify([]),
      required: true,
      order_index: 4,
    },
    {
      title: '¿Tienes algún comentario, felicitación o sugerencia adicional?',
      description: 'Tu opinión libre nos permite identificar áreas de oportunidad y destacar aciertos',
      type: 'text',
      options: JSON.stringify([]),
      required: false,
      order_index: 5,
    },
  ];

  const insertedQuestionIds = [];
  for (const q of defaultQuestions) {
    const res = await db.query(
      `INSERT INTO questions (title, description, type, options, required, order_index, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [q.title, q.description, q.type, q.options, q.required ? 1 : 0, q.order_index, 1]
    );
    insertedQuestionIds.push(res.rows[0].id);
  }

  console.log(`✅ ${insertedQuestionIds.length} preguntas creadas.`);

  // Seed sample survey responses for demonstration and rich dashboard metrics
  console.log('🌱 Sembrando respuestas de demostración para métricas iniciales...');

  const sampleRespondents = [
    {
      name: 'Carlos Mendoza',
      answers: {
        0: '5',
        1: 'Superó mis expectativas',
        2: ['Amabilidad y cortesía del equipo', 'Rapidez en la resolución'],
        3: '10',
        4: '¡Excelente experiencia de principio a fin! El equipo resolvió mi duda técnica en cuestión de minutos y con una amabilidad impecable.'
      }
    },
    {
      name: 'Valeria Gómez',
      answers: {
        0: '4',
        1: 'Adecuado y a tiempo',
        2: ['Claridad en las explicaciones', 'Facilidad del proceso'],
        3: '9',
        4: 'El proceso fue muy intuitivo y claro. Solo sugeriría tener más tutoriales en video, pero en general gran servicio.'
      }
    },
    {
      name: 'Mateo Fernández',
      answers: {
        0: '5',
        1: 'Superó mis expectativas',
        2: ['Rapidez en la resolución', 'Disponibilidad del soporte'],
        3: '10',
        4: 'Quedé gratamente sorprendido con la rapidez. Definitivamente volveré a contratar sus servicios.'
      }
    },
    {
      name: 'Sofía Navarro',
      answers: {
        0: '3',
        1: 'Un poco lento',
        2: ['Amabilidad y cortesía del equipo'],
        3: '6',
        4: 'El personal es muy educado, sin embargo, tuve que esperar casi 40 minutos para recibir confirmación de mi ticket.'
      }
    },
    {
      name: 'Alejandro Torres',
      answers: {
        0: '5',
        1: 'Superó mis expectativas',
        2: ['Amabilidad y cortesía del equipo', 'Claridad en las explicaciones', 'Facilidad del proceso'],
        3: '10',
        4: 'Todo perfecto. La interfaz es moderna y muy agradable de usar.'
      }
    },
    {
      name: 'Camila Morales',
      answers: {
        0: '4',
        1: 'Adecuado y a tiempo',
        2: ['Facilidad del proceso'],
        3: '8',
        4: 'Buena atención y respuestas precisas.'
      }
    },
    {
      name: 'Diego Rivas',
      answers: {
        0: '5',
        1: 'Adecuado y a tiempo',
        2: ['Rapidez en la resolución', 'Disponibilidad del soporte'],
        3: '9',
        4: 'Muy profesionales. Agradezco mucho el seguimiento personalizado que le dieron a mi caso.'
      }
    },
    {
      name: 'Lucía Benítez',
      answers: {
        0: '4',
        1: 'Adecuado y a tiempo',
        2: ['Amabilidad y cortesía del equipo', 'Claridad en las explicaciones'],
        3: '8',
        4: 'Muy contenta con el servicio, sigan así.'
      }
    }
  ];

  for (const resp of sampleRespondents) {
    const res = await db.query(
      `INSERT INTO survey_responses (respondent_name, user_ip, user_agent)
       VALUES ($1, $2, $3) RETURNING id`,
      [resp.name, '127.0.0.1', 'Demo Client Browser']
    );
    const responseId = res.rows[0].id;

    for (let i = 0; i < insertedQuestionIds.length; i++) {
      const qId = insertedQuestionIds[i];
      const answer = resp.answers[i];
      if (answer !== undefined) {
        if (Array.isArray(answer)) {
          await db.query(
            `INSERT INTO survey_answers (response_id, question_id, answer_value, answer_json)
             VALUES ($1, $2, $3, $4)`,
            [responseId, qId, answer.join(', '), JSON.stringify(answer)]
          );
        } else {
          await db.query(
            `INSERT INTO survey_answers (response_id, question_id, answer_value, answer_json)
             VALUES ($1, $2, $3, $4)`,
            [responseId, qId, String(answer), null]
          );
        }
      }
    }
  }

  console.log(`✅ ${sampleRespondents.length} respuestas de prueba sembradas exitosamente.`);
}

module.exports = { seedData };
