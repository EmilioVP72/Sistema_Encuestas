# 📊 Sistema Web Monolítico de Encuestas de Satisfacción & Métricas (Dockerizado)

Aplicación web completa construida desde cero con arquitectura **Monolítica**, contenedorizada con **Docker & Docker Compose**, y respaldada por una **Base de Datos Relacional PostgreSQL** (con soporte de respaldo SQLite para desarrollo local ultrarrápido).

---

## 🌟 Características Principales

### 1. Experiencia del Cliente / Usuario (`/`)
* **Pantalla de Bienvenida:** Hero moderno con saludo, tiempo estimado (~2 minutos), confidencialidad garantizada y campo opcional para el nombre del encuestado.
* **Encuesta de Satisfacción Interactiva:**
  * Barra de progreso superior en tiempo real con porcentaje y contador de preguntas respondidas.
  * Soporte dinámico para múltiples tipos de preguntas:
    * ⭐ **Calificación CSAT (1 a 5 estrellas)** con animaciones e interactividad táctil/hover.
    * 🚀 **Escala NPS (0 a 10)** con semáforo de colores (Detractores, Pasivos y Promotores).
    * 🔘 **Selección Única (Radio cards)** con marcado visual e indicador seleccionado.
    * ☑️ **Selección Múltiple (Checkboxes)** para aspectos destacados.
    * ✍️ **Preguntas Abiertas (Texto Libre)** con contador de caracteres en tiempo real.
  * Validación reactiva con desplazamiento suave hacia la pregunta faltante.
* **Pantalla de Despedida y Agradecimiento:**
  * Animación de celebración con explosión de confeti (`canvas-confetti`).
  * Mensaje cálido de agradecimiento por su tiempo y aportes.
  * Botón **"Cerrar Página"** (`window.close()` con notificación amigable).
  * Opción para realizar otra encuesta de prueba o acceder al panel administrativo.

### 2. Panel de Administración & Analítica (`/admin`)
* **Autenticación Segura con JWT:**
  * Nueva tabla `admin_users` en la base de datos (PostgreSQL/SQLite) con almacenamiento de contraseñas hasheadas mediante **bcrypt**.
  * Pantalla de inicio de sesión dedicada con generación y validación de tokens **JWT**.
  * Cierre de sesión seguro y protección de todos los endpoints de analítica y gestión.
  * **Credenciales por defecto:**
    * **Usuario:** `admin`
    * **Contraseña:** `admin123`
* **KPIs Globales en Tiempo Real:**
  * Total de encuestas respondidas.
  * CSAT Promedio (*Customer Satisfaction Score* de 1.0 a 5.0 ⭐).
  * Net Promoter Score (*NPS* de -100 a +100).
  * Tasa de Promotores (% de clientes que califican 9 o 10).
* **Gráficos Interactivos (Chart.js):**
  * Histograma de distribución de calificaciones (1 a 5 estrellas).
  * Gráfico de anillo / dona con segmentación NPS (Promotores, Pasivos y Detractores).
  * Desglose individual tarjeta por tarjeta para cada pregunta registrada.
* **Bandeja de Respuestas Abiertas:**
  * Visualización dedicada para todas las respuestas de texto libre.
  * Filtro y buscador en tiempo real por palabra clave, nombre de cliente o pregunta.
  * Timestamps con fecha y hora formateada.
* **Gestor Dinámico de Preguntas (CRUD):**
  * Crear nuevas preguntas con título, descripción, tipo y orden.
  * Creador dinámico de opciones para preguntas de selección única o múltiple.
  * Activar / Desactivar preguntas al instante con un solo clic.
  * Edición y eliminación de preguntas.
* **Exportación de Datos:**
  * Botón para descargar un reporte completo en formato **CSV** compatible con Excel (codificación UTF-8 con BOM).

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Frontend** | HTML5 Semántico, Vanilla CSS (Design System con variables CSS y Glassmorphism), JavaScript ES6+, Chart.js, Canvas Confetti |
| **Backend** | Node.js v22 con Express 5, CORS, Dotenv, Client PostgreSQL (`pg`) |
| **Base de Datos** | PostgreSQL 16 (en Docker) / SQLite integrado (en entorno local) |
| **Contenedores** | Dockerfile multi-arquitectura & Docker Compose con Healthchecks y Volúmenes persistentes |

---

## 🚀 Despliegue con Docker (Recomendado)

Asegúrate de tener instalado **Docker** y **Docker Compose**.

1. **Iniciar todos los servicios (Base de Datos + Monolito Web):**
   ```bash
   docker compose up -d --build
   ```

2. **Acceder a la aplicación:**
   * **Portal de Encuesta (Cliente):** [http://localhost:3000](http://localhost:3000)
   * **Panel de Administración:** [http://localhost:3000/admin](http://localhost:3000/admin)
   * **Healthcheck:** [http://localhost:3000/health](http://localhost:3000/health)

3. **Ver logs de los contenedores:**
   ```bash
   docker compose logs -f app
   ```

4. **Detener la aplicación:**
   ```bash
   docker compose down
   ```

---

## 💻 Ejecución Local (Sin Docker)

Si prefieres ejecutar la aplicación directamente en tu máquina con Node.js:

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Iniciar el servidor:**
   ```bash
   npm start
   ```
   *(La aplicación detectará que no hay PostgreSQL externo y activará automáticamente la base de datos SQLite integrada en `data/survey.db` sin requerir configuraciones adicionales).*

3. **Abrir en el navegador:**
   * Encuesta: [http://localhost:3000](http://localhost:3000)
   * Admin: [http://localhost:3000/admin](http://localhost:3000/admin)

---

## 📡 Endpoints del API REST

### Encuesta Pública (`/api/survey`)
* `GET /api/survey/questions` - Obtiene las preguntas activas ordenadas para el cliente.
* `POST /api/survey/submit` - Registra las respuestas de un cliente con validación de obligatoriedad.

### Administración (`/api/admin`)
* `GET /api/admin/metrics` - Retorna los KPIs consolidados, CSAT, NPS y distribución de respuestas.
* `GET /api/admin/open-feedback` - Lista todas las respuestas a preguntas de texto libre.
* `GET /api/admin/questions` - Lista todas las preguntas (activas e inactivas) con contador de respuestas.
* `POST /api/admin/questions` - Crea una nueva pregunta con sus opciones.
* `PUT /api/admin/questions/:id` - Actualiza los datos o estado de una pregunta existente.
* `DELETE /api/admin/questions/:id` - Elimina una pregunta y sus respuestas asociadas.
* `GET /api/admin/export` - Descarga un archivo CSV con todas las respuestas.
