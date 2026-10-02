#!/usr/bin/env bash
# Mesa de Ayuda (Tema 5) · ejecutar desde la RAÍZ del repo:  bash scaffold.sh
# - Crea archivos nuevos siguiendo los nombres de la plantilla (nations_apis.js, XxxPage.jsx, Widget.jsx + Widget.css ...)
# - NO pisa archivos existentes.
# - Parchea (una sola vez) 7 archivos de la plantilla; cada parche está marcado con "Tema 5".
set -e
[ -f server.js ] && [ -d admin ] && [ -d src/entries ] || { echo "Ejecuta este script desde la raíz del repo."; exit 1; }

write() { mkdir -p "$(dirname "$1")"; if [ -e "$1" ]; then cat > /dev/null; echo "  (ya existe, se omite) $1"; else cat > "$1"; fi; }

# =====================================================================
# 1. BACKEND · generador CRUD con el patrón de nations (model → repository → service → api)
# =====================================================================
attrs() { for f in $1; do printf "  %s: { type: DataTypes.%s },\n" "${f%%:*}" "${f#*:}"; done; }

crud() { # crud Singular Plural camel snake_singular snake_plural HU "campo:TIPO campo:TIPO"
  local S="$1" P="$2" c="$3" s="$4" p="$5" hu="$6" spec="$7"

  { cat <<EOF
// admin/models/$s.js · HU-$hu
import { DataTypes } from 'sequelize';
import sequelize from '../../configs/database.js';

const $S = sequelize.define('$S', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
EOF
    attrs "$spec"
    cat <<EOF
}, { tableName: '$p', timestamps: false });

export default $S;
EOF
  } | write "admin/models/$s.js"

  write "admin/repositories/${p}_repositories.js" <<EOF
// admin/repositories/${p}_repositories.js · HU-$hu · ÚNICA capa que consulta la BD
import $S from '../models/$s.js';

const showLogs = process.env.SHOW_DB_ERRORS === 'true' || process.env.NODE_ENV === 'development';

const run = async (label, fn) => {
  try {
    return await fn();
  } catch (error) {
    if (showLogs) console.error('[${S}Repo.' + label + '] Error:', error);
    throw error;
  }
};

class ${S}Repository {
  findAll() {
    return run('findAll', () => $S.findAll());
  }

  findAllPaginated({ where = {}, offset = 0, limit = 10, order = [['id', 'DESC']] } = {}) {
    return run('findAllPaginated', () => $S.findAll({ where, offset, limit, order }));
  }

  count(where = {}) {
    return run('count', () => $S.count({ where }));
  }

  findById(id) {
    return run('findById', () => $S.findByPk(id));
  }

  create(data) {
    return run('create', () => $S.create(data));
  }

  update(id, data) {
    return run('update', async () => {
      const record = await $S.findByPk(id);
      return record ? record.update(data) : null;
    });
  }

  delete(id) {
    return run('delete', async () => {
      const record = await $S.findByPk(id);
      if (!record) return null;
      await record.destroy();
      return true;
    });
  }
}

export default new ${S}Repository();
EOF

  write "admin/services/${p}_services.js" <<EOF
// admin/services/${p}_services.js · HU-$hu · reglas de negocio y validaciones DEL SERVIDOR
import ${c}Repository from '../repositories/${p}_repositories.js';
import { httpError } from '../../configs/helpers.js';

// Nunca exponer el hash de contraseña
const clean = (record) => {
  const json = record.toJSON();
  delete json.password_hash;
  return json;
};

export const fetchAll = async () => (await ${c}Repository.findAll()).map(clean);

export const fetchAllPaginated = async (page = 1, limit = 10, where = {}) => {
  const offset = (page - 1) * limit;
  const total = await ${c}Repository.count(where);
  const items = await ${c}Repository.findAllPaginated({ where, offset, limit });
  return { items: items.map(clean), total, totalPages: Math.ceil(total / limit), offset, page, limit };
};

export const fetchById = async (id) => {
  const record = await ${c}Repository.findById(id);
  return record ? clean(record) : null;
};

export const create = async (data) => {
  // TODO HU-$hu: validar \`data\` en el servidor, ej: if (!data.xxx) throw httpError(400, 'xxx es obligatorio');
  return clean(await ${c}Repository.create(data));
};

export const update = async (id, data) => {
  // TODO HU-$hu: validar \`data\` y reglas de negocio
  const record = await ${c}Repository.update(id, data);
  return record ? clean(record) : null;
};

export const remove = async (id) => {
  // TODO HU-$hu: confirmar reglas antes de eliminar (httpError(409, '...') si hay dependencias)
  return ${c}Repository.delete(id);
};

export { httpError };
EOF

  write "admin/apis/${p}_apis.js" <<EOF
// admin/apis/${p}_apis.js · HU-$hu · respuestas { success, message, data, error }
import * as service from '../services/${p}_services.js';
import $S from '../models/$s.js';
import { pickFilters } from '../../configs/helpers.js';

const ok = (res, status, message, data) => res.status(status).json({ success: true, message, data, error: null });
const fail = (res, status, message, error) => res.status(status).json({ success: false, message, data: null, error });
const handle = (res, error, message) => {
  console.error(error.stack);
  return fail(res, error.statusCode || 500, message, error.message);
};

export async function list${P}(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    // filtros por igualdad: ?status=open&room_id=3 (solo columnas del modelo)
    const result = await service.fetchAllPaginated(page, limit, pickFilters(req.query, $S));
    return ok(res, 200, 'Listado obtenido con éxito', {
      list: result.items, total: result.total, pages: result.totalPages,
      offset: result.offset, limit, page
    });
  } catch (error) {
    return handle(res, error, 'Error al listar');
  }
}

export async function get${S}ById(req, res) {
  try {
    const record = await service.fetchById(req.params.id);
    if (!record) return fail(res, 404, 'Registro no encontrado', 'No existe el id ' + req.params.id);
    return ok(res, 200, 'Registro obtenido con éxito', record);
  } catch (error) {
    return handle(res, error, 'Error al buscar');
  }
}

export async function create${S}(req, res) {
  try {
    return ok(res, 201, 'Registro creado con éxito', await service.create(req.body));
  } catch (error) {
    return handle(res, error, 'Error al crear');
  }
}

export async function update${S}(req, res) {
  try {
    const record = await service.update(req.params.id, req.body);
    if (!record) return fail(res, 404, 'Registro no encontrado', 'No existe el id ' + req.params.id);
    return ok(res, 200, 'Registro actualizado con éxito', record);
  } catch (error) {
    return handle(res, error, 'Error al actualizar');
  }
}

export async function delete${S}(req, res) {
  try {
    const deleted = await service.remove(req.params.id);
    if (!deleted) return fail(res, 404, 'Registro no encontrado', 'No existe el id ' + req.params.id);
    return ok(res, 200, 'Registro eliminado con éxito', null);
  } catch (error) {
    return handle(res, error, 'Error al eliminar');
  }
}
EOF
}

#            Singular            Plural               camel               snake_s              snake_p               HU  columnas
crud User             Users              user               user               users               1 "first_name:STRING(80) last_name:STRING(80) email:STRING(120) password_hash:STRING(200) phone:STRING(20) unit:STRING(120) affiliation:STRING(40) role_id:INTEGER status:STRING(12) block_reason:TEXT habitual_room_id:INTEGER failed_attempts:INTEGER locked_until:DATE created_at:DATE last_login_at:DATE"
crud Category         Categories         category           category           categories          2 "name:STRING(80) parent_id:INTEGER default_priority:STRING(8) expected_hours:INTEGER description:STRING(240) active:BOOLEAN"
crud Room             Rooms              room               room               rooms               2 "code:STRING(20) type:STRING(60) building:STRING(40) floor:INTEGER campus:STRING(80) capacity:INTEGER"
crud TechnicianCategory TechnicianCategories technicianCategory technician_category technician_categories 2 "technician_id:INTEGER category_id:INTEGER"
crud Ticket           Tickets            ticket             ticket             tickets             3 "code:STRING(20) subject:STRING(120) description:STRING(600) category_id:INTEGER subcategory_id:INTEGER room_id:INTEGER requester_id:INTEGER technician_id:INTEGER priority:STRING(8) suggested_priority:STRING(8) status:STRING(12) created_at:DATE due_at:DATE closed_at:DATE solution:TEXT hold_reason:TEXT hold_return_date:DATE"
crud Assignment       Assignments        assignment         assignment         assignments         4 "ticket_id:INTEGER technician_id:INTEGER assigned_by:INTEGER note:TEXT reason:TEXT created_at:DATE"
crud PriorityChange   PriorityChanges    priorityChange     priority_change    priority_changes    4 "ticket_id:INTEGER from_priority:STRING(8) to_priority:STRING(8) reason:TEXT author_id:INTEGER created_at:DATE"
crud TicketLog        TicketLogs         ticketLog          ticket_log         ticket_logs         5 "ticket_id:INTEGER author_id:INTEGER type:STRING(10) body:TEXT created_at:DATE"
crud TicketStatusChange TicketStatusChanges ticketStatusChange ticket_status_change ticket_status_changes 5 "ticket_id:INTEGER from_status:STRING(12) to_status:STRING(12) author_id:INTEGER reason:TEXT created_at:DATE"
crud Survey           Surveys            survey             survey             surveys             6 "ticket_id:INTEGER user_id:INTEGER score:INTEGER speed:INTEGER courtesy:INTEGER solution_score:INTEGER comment:TEXT created_at:DATE editable_until:DATE"

# Modelos sin API propia (HU-1)
write admin/models/role.js <<'EOF'
// admin/models/role.js · HU-1
import { DataTypes } from 'sequelize';
import sequelize from '../../configs/database.js';

const Role = sequelize.define('Role', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(20) } // user | technician | supervisor
}, { tableName: 'roles', timestamps: false });

export default Role;
EOF

write admin/apis/metrics_apis.js <<'EOF'
// admin/apis/metrics_apis.js · HU-7 · tablero de métricas (solo lectura)
// TODO HU-7: agregar services/repositories de métricas (conteos por estado, categoría, ambiente, tiempos)
export async function summary(req, res) {
  return res.status(200).json({
    success: true,
    message: 'TODO HU-7: métricas del periodo',
    data: { tickets: 0, open: 0, avg_minutes: 0, overdue: 0 },
    error: null
  });
}
EOF

# =====================================================================
# 2. BACKEND · rutas por HU  (admin/configs/<dominio>_routes.js)
# =====================================================================
routes_for() { # routes_for plural Singular Plural alias "lectura" "escritura"
  local p="$1" S="$2" P="$3" a="$4" r="$5" w="$6"
  cat <<EOF
router.get('/api/v1/$p', $r, $a.list$P);
router.get('/api/v1/$p/:id', $r, $a.get${S}ById);
router.post('/api/v1/$p', $w, $a.create$S);
router.put('/api/v1/$p/:id', $w, $a.update$S);
router.delete('/api/v1/$p/:id', $w, $a.delete$S);
EOF
}

RD="requireAuth"
SUP="requireAuth, requireRole('supervisor')"
STAFF="requireAuth, requireRole('technician', 'supervisor')"

{ cat <<'EOF'
// admin/configs/catalog_routes.js · HU-2 · catálogo de servicios
import { Router } from 'express';
import { requireAuth, requireRole } from '../../configs/middlewares.js';
import * as categories from '../apis/categories_apis.js';
import * as rooms from '../apis/rooms_apis.js';
import * as technicianCategories from '../apis/technician_categories_apis.js';

const router = Router();

// Lectura: cualquier sesión (el usuario necesita categorías y ambientes para registrar un ticket)
// Escritura: solo supervisor
EOF
  routes_for categories Category Categories categories "$RD" "$SUP"
  routes_for rooms Room Rooms rooms "$RD" "$SUP"
  routes_for technician_categories TechnicianCategory TechnicianCategories technicianCategories "$RD" "$SUP"
  printf '\nexport default router;\n'
} | write admin/configs/catalog_routes.js

{ cat <<'EOF'
// admin/configs/tickets_routes.js · HU-3 · registro y seguimiento de tickets
import { Router } from 'express';
import { requireAuth, requireRole } from '../../configs/middlewares.js';
import * as tickets from '../apis/tickets_apis.js';

const router = Router();

// TODO HU-3: el service debe limitar "mis tickets" al solicitante cuando el rol es user
EOF
  routes_for tickets Ticket Tickets tickets "$RD" "$RD"
  printf '\nexport default router;\n'
} | write admin/configs/tickets_routes.js

{ cat <<'EOF'
// admin/configs/queue_routes.js · HU-4 · cola de atención y asignación
import { Router } from 'express';
import { requireAuth, requireRole } from '../../configs/middlewares.js';
import * as assignments from '../apis/assignments_apis.js';
import * as priorityChanges from '../apis/priority_changes_apis.js';

const router = Router();

// TODO HU-4: autoasignación del técnico (solo sobre sus categorías), asignación en lote, devolver a la cola
EOF
  routes_for assignments Assignment Assignments assignments "$STAFF" "$STAFF"
  routes_for priority_changes PriorityChange PriorityChanges priorityChanges "$STAFF" "$SUP"
  printf '\nexport default router;\n'
} | write admin/configs/queue_routes.js

{ cat <<'EOF'
// admin/configs/attention_routes.js · HU-5 · bitácora, cambio de estado y cierre
import { Router } from 'express';
import { requireAuth, requireRole } from '../../configs/middlewares.js';
import * as ticketLogs from '../apis/ticket_logs_apis.js';
import * as ticketStatusChanges from '../apis/ticket_status_changes_apis.js';

const router = Router();

// OJO HU-5: el usuario solo puede ver comentarios type = 'public'. Las notas internas ('internal')
// se filtran en el SERVICE según el rol, no en el front.
EOF
  routes_for ticket_logs TicketLog TicketLogs ticketLogs "$RD" "$STAFF"
  routes_for ticket_status_changes TicketStatusChange TicketStatusChanges ticketStatusChanges "$RD" "$STAFF"
  printf '\nexport default router;\n'
} | write admin/configs/attention_routes.js

{ cat <<'EOF'
// admin/configs/surveys_routes.js · HU-6 · encuesta de satisfacción
import { Router } from 'express';
import { requireAuth, requireRole } from '../../configs/middlewares.js';
import * as surveys from '../apis/surveys_apis.js';

const router = Router();

// TODO HU-6: una sola encuesta por ticket (UNIQUE ticket_id), editable hasta editable_until
EOF
  routes_for surveys Survey Surveys surveys "$RD" "$RD"
  printf '\nexport default router;\n'
} | write admin/configs/surveys_routes.js

{ cat <<'EOF'
// admin/configs/metrics_routes.js · HU-7 · métricas y gestión de usuarios (solo supervisor)
import { Router } from 'express';
import { requireAuth, requireRole } from '../../configs/middlewares.js';
import * as metrics from '../apis/metrics_apis.js';
import * as users from '../apis/users_apis.js';

const router = Router();

router.get('/api/v1/metrics/summary', requireAuth, requireRole('supervisor'), metrics.summary);
// TODO HU-7: bloqueo/desbloqueo con motivo -> users_services.setStatus(id, status, reason)
EOF
  routes_for users User Users users "$SUP" "$SUP"
  printf '\nexport default router;\n'
} | write admin/configs/metrics_routes.js

# =====================================================================
# 3. BACKEND · utilidades, middleware de rol y vista 403
# =====================================================================
write configs/password.js <<'EOF'
// configs/password.js · contraseñas cifradas (scrypt de Node, sin dependencias nuevas)
import crypto from 'crypto';

export function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return salt + ':' + hash;
}

export function verifyPassword(plain, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(plain, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), test);
}
EOF

if [ ! -e views/403.ejs ] && [ -e views/401.ejs ]; then
  sed -e 's/401/403/g' -e 's/Acceso no autorizado/Acceso denegado/g' views/401.ejs > views/403.ejs
fi

ejs() { write "views/website/$1.ejs" <<EOF
<!-- views/website/$1.ejs · HU-1 -->
<% layout("layouts/website") %>

<div class="container py-5">
  <h1>$2</h1>
  <!-- TODO HU-1: ver mockup $3 -->
</div>
EOF
}
ejs sign-up "Crear mi cuenta" "1.3"
ejs forgot-password "Recuperar mi contraseña" "1.5"
ejs reset-password "Nueva contraseña" "1.5 paso 3"
ejs invitation "Activa tu cuenta" "1.4"

python3 - <<'PY'
import pathlib, re, json

def edit(path, fn):
    p = pathlib.Path(path)
    if not p.exists():
        print('  (no existe, se omite parche) ' + path); return
    s = p.read_text(encoding='utf-8'); n = fn(s)
    if n != s: p.write_text(n, encoding='utf-8'); print('  parche aplicado: ' + path)

# --- configs/helpers.js
def helpers(s):
    if 'pickFilters' in s: return s
    return s.rstrip('\n') + '''

// --- Tema 5 ---------------------------------------------------------
/** Filtros por igualdad tomados del query string, solo para columnas del modelo. */
export function pickFilters(query, model) {
  const where = {};
  for (const key of Object.keys(model.rawAttributes)) {
    if (query[key] !== undefined && query[key] !== '') where[key] = query[key];
  }
  return where;
}

/** Error con código HTTP para lanzar desde los services (lo recogen las apis). */
export function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

/** Primera pantalla tras iniciar sesión según el rol (HU-1). */
export function homePathForSession(session) {
  if (hasRole(session, 'supervisor')) return process.env.SUPERVISOR_HOME || '/admin/supervisor/queue';
  if (hasRole(session, 'technician')) return '/admin/technician/inbox';
  if (hasRole(session, 'user')) return '/admin/user/tickets';
  return '/';
}
'''
edit('configs/helpers.js', helpers)

# --- configs/middlewares.js  (agrega requireRole y corrige el import de roleHasPermission)
def middlewares(s):
    if 'export function requireRole' in s: return s
    s = s.replace("import { hasRole } from '../configs/helpers.js';", "import { hasRole, roleHasPermission } from '../configs/helpers.js';")
    return s.rstrip('\n') + '''

// --- Tema 5 ---------------------------------------------------------
/** Permite solo ciertos roles: requireRole('supervisor') · requireRole('technician', 'supervisor') */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.some((role) => hasRole(req.session, role))) return next();
    if (req.path.startsWith('/api/') || req.method !== 'GET') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado',
        data: null,
        error: 'Error 403: sin permisos para esta operación'
      });
    }
    return res.status(403).render('403', {
      title: 'Acceso denegado',
      message: 'No tienes permiso para ver esta página.',
      statusCode: 403
    });
  };
}
'''
edit('configs/middlewares.js', middlewares)

# --- admin/controllers/admin_controllers.js
def controllers(s):
    if 'export function landing' in s: return s
    return "import { homePathForSession } from '../../configs/helpers.js';\n" + s.rstrip('\n') + '''

// --- Tema 5 ---------------------------------------------------------
/** GET /admin -> redirige a la pantalla de inicio del rol */
export function landing(req, res) {
  return res.redirect(homePathForSession(req.session));
}
'''
edit('admin/controllers/admin_controllers.js', controllers)

# --- admin/configs/routes.js
def routes(s):
    if 'Tema 5' in s: return s
    s = s.replace('{ redirectIfAuthenticated, requireAuth }', '{ redirectIfAuthenticated, requireAuth, requireRole }')
    imports = '''// Tema 5 · rutas por HU
import catalogRoutes from './catalog_routes.js';
import ticketsRoutes from './tickets_routes.js';
import queueRoutes from './queue_routes.js';
import attentionRoutes from './attention_routes.js';
import surveysRoutes from './surveys_routes.js';
import metricsRoutes from './metrics_routes.js';
'''
    s = s.replace('const router = Router();', imports + '\nconst router = Router();', 1)
    s = s.replace("router.get('/admin', requireAuth, admins.home);", "router.get('/admin', requireAuth, admins.landing);")
    block = '''// --- Tema 5 · Mesa de ayuda ---------------------------------------
// APIs REST por HU
router.use(catalogRoutes);     // HU-2
router.use(ticketsRoutes);     // HU-3
router.use(queueRoutes);       // HU-4
router.use(attentionRoutes);   // HU-5
router.use(surveysRoutes);     // HU-6
router.use(metricsRoutes);     // HU-7
// Shell de React por rol (cualquier subruta la resuelve react-router)
router.get('/admin/mi-cuenta', requireAuth, admins.home);
router.get('/admin/user{/*splat}', requireAuth, requireRole('user'), admins.home);
router.get('/admin/technician{/*splat}', requireAuth, requireRole('technician'), admins.home);
router.get('/admin/supervisor{/*splat}', requireAuth, requireRole('supervisor'), admins.home);

'''
    return s.replace('export default router;', block + 'export default router;', 1)
edit('admin/configs/routes.js', routes)

# --- src/entries/admin.jsx
def admin_jsx(s):
    if 'panelRoutes' in s: return s
    s = s.replace("// Layout Principal", "// Tema 5 · rutas del panel de la mesa de ayuda\nimport { panelRoutes } from './panel_routes.jsx';\n\n// Layout Principal", 1)
    return s.replace('<Routes>', '<Routes>\n        {panelRoutes}', 1)
edit('src/entries/admin.jsx', admin_jsx)

# --- tokens en los CSS de las entries
for css in ('src/entries/admin.css', 'src/entries/web.css'):
    def add_tokens(s):
        if 'tokens.css' in s: return s
        return "@import './tokens.css';\n" + s
    edit(css, add_tokens)

# --- package.json: script db:seed
def pkg(s):
    d = json.loads(s)
    if 'db:seed' in d.get('scripts', {}): return s
    d['scripts']['db:seed'] = 'node db/seed_to_migrations.js'
    return json.dumps(d, indent=2, ensure_ascii=False) + '\n'
edit('package.json', pkg)
PY

# =====================================================================
# 4. BASE DE DATOS · migraciones (formato dbmate, nombres como la plantilla) + seed
# =====================================================================
V=20261001120000
mig() { # mig nombre   (SQL por stdin)
  V=$((V + 1))
  write "db/migrations/${V}_$1.sql"
}

mig create_roles <<'EOF'
-- migrate:up

CREATE TABLE roles (
  id    SERIAL PRIMARY KEY,
  name  VARCHAR(20) NOT NULL UNIQUE   -- user | technician | supervisor
);

-- migrate:down

DROP TABLE IF EXISTS roles;
EOF

mig create_users <<'EOF'
-- migrate:up

CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  first_name        VARCHAR(80)  NOT NULL,
  last_name         VARCHAR(80)  NOT NULL,
  email             VARCHAR(120) NOT NULL UNIQUE,
  password_hash     VARCHAR(200) NOT NULL,
  phone             VARCHAR(20),
  unit              VARCHAR(120),
  affiliation       VARCHAR(40),
  role_id           INT NOT NULL REFERENCES roles(id),
  status            VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked')),
  block_reason      TEXT,
  habitual_room_id  INT,
  failed_attempts   INT NOT NULL DEFAULT 0,
  locked_until      TIMESTAMP,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login_at     TIMESTAMP
);

-- migrate:down

DROP TABLE IF EXISTS users;
EOF

mig create_invitations <<'EOF'
-- migrate:up

CREATE TABLE invitations (
  id           SERIAL PRIMARY KEY,
  email        VARCHAR(120) NOT NULL,
  first_name   VARCHAR(80)  NOT NULL,
  last_name    VARCHAR(80)  NOT NULL,
  role_id      INT NOT NULL REFERENCES roles(id),
  token        VARCHAR(100) NOT NULL UNIQUE,
  invited_by   INT NOT NULL REFERENCES users(id),
  expires_at   TIMESTAMP NOT NULL,
  accepted_at  TIMESTAMP
);

-- migrate:down

DROP TABLE IF EXISTS invitations;
EOF

mig create_password_resets <<'EOF'
-- migrate:up

CREATE TABLE password_resets (
  id          SERIAL PRIMARY KEY,
  user_id     INT NOT NULL REFERENCES users(id),
  token_hash  VARCHAR(200) NOT NULL,
  expires_at  TIMESTAMP NOT NULL,
  used_at     TIMESTAMP
);

-- migrate:down

DROP TABLE IF EXISTS password_resets;
EOF

mig create_categories <<'EOF'
-- migrate:up

CREATE TABLE categories (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(80) NOT NULL,
  parent_id         INT REFERENCES categories(id),   -- NULL = categoría · con valor = subcategoría
  default_priority  VARCHAR(8) NOT NULL CHECK (default_priority IN ('critical', 'high', 'medium', 'low')),
  expected_hours    INT NOT NULL CHECK (expected_hours > 0),
  description       VARCHAR(240),
  active            BOOLEAN NOT NULL DEFAULT TRUE
);

-- migrate:down

DROP TABLE IF EXISTS categories;
EOF

mig create_rooms <<'EOF'
-- migrate:up

CREATE TABLE rooms (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(20) NOT NULL UNIQUE,   -- A-201
  type      VARCHAR(60) NOT NULL,
  building  VARCHAR(40),
  floor     INT,
  campus    VARCHAR(80) NOT NULL,
  capacity  INT
);

ALTER TABLE users ADD CONSTRAINT users_habitual_room_fk FOREIGN KEY (habitual_room_id) REFERENCES rooms(id);

-- migrate:down

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_habitual_room_fk;
DROP TABLE IF EXISTS rooms;
EOF

mig create_technician_categories <<'EOF'
-- migrate:up

CREATE TABLE technician_categories (
  id             SERIAL PRIMARY KEY,
  technician_id  INT NOT NULL REFERENCES users(id),
  category_id    INT NOT NULL REFERENCES categories(id),
  UNIQUE (technician_id, category_id)
);

-- migrate:down

DROP TABLE IF EXISTS technician_categories;
EOF

mig create_tickets <<'EOF'
-- migrate:up

CREATE TABLE tickets (
  id                 SERIAL PRIMARY KEY,
  code               VARCHAR(20) NOT NULL UNIQUE,   -- TCK-2026-00147
  subject            VARCHAR(120) NOT NULL,
  description        VARCHAR(600) NOT NULL,
  category_id        INT NOT NULL REFERENCES categories(id),
  subcategory_id     INT REFERENCES categories(id),
  room_id            INT NOT NULL REFERENCES rooms(id),
  requester_id       INT NOT NULL REFERENCES users(id),
  technician_id      INT REFERENCES users(id),
  priority           VARCHAR(8)  NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  suggested_priority VARCHAR(8)  CHECK (suggested_priority IN ('critical', 'high', 'medium', 'low')),
  status             VARCHAR(12) NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'in_progress', 'on_hold', 'resolved', 'closed', 'reopened', 'cancelled')),
  created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
  due_at             TIMESTAMP,
  closed_at          TIMESTAMP,
  solution           TEXT,
  hold_reason        TEXT,
  hold_return_date   DATE
);

-- migrate:down

DROP TABLE IF EXISTS tickets;
EOF

mig create_assignments <<'EOF'
-- migrate:up

CREATE TABLE assignments (
  id             SERIAL PRIMARY KEY,
  ticket_id      INT NOT NULL REFERENCES tickets(id),
  technician_id  INT REFERENCES users(id),     -- NULL = devuelto a la cola
  assigned_by    INT NOT NULL REFERENCES users(id),
  note           TEXT,
  reason         TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- migrate:down

DROP TABLE IF EXISTS assignments;
EOF

mig create_priority_changes <<'EOF'
-- migrate:up

CREATE TABLE priority_changes (
  id             SERIAL PRIMARY KEY,
  ticket_id      INT NOT NULL REFERENCES tickets(id),
  from_priority  VARCHAR(8) NOT NULL,
  to_priority    VARCHAR(8) NOT NULL,
  reason         TEXT NOT NULL,
  author_id      INT NOT NULL REFERENCES users(id),
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- migrate:down

DROP TABLE IF EXISTS priority_changes;
EOF

mig create_ticket_logs <<'EOF'
-- migrate:up

CREATE TABLE ticket_logs (
  id          SERIAL PRIMARY KEY,
  ticket_id   INT NOT NULL REFERENCES tickets(id),
  author_id   INT NOT NULL REFERENCES users(id),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('public', 'internal')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- migrate:down

DROP TABLE IF EXISTS ticket_logs;
EOF

mig create_ticket_status_changes <<'EOF'
-- migrate:up

CREATE TABLE ticket_status_changes (
  id           SERIAL PRIMARY KEY,
  ticket_id    INT NOT NULL REFERENCES tickets(id),
  from_status  VARCHAR(12),
  to_status    VARCHAR(12) NOT NULL,
  author_id    INT NOT NULL REFERENCES users(id),
  reason       TEXT,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

-- migrate:down

DROP TABLE IF EXISTS ticket_status_changes;
EOF

mig create_surveys <<'EOF'
-- migrate:up

CREATE TABLE surveys (
  id              SERIAL PRIMARY KEY,
  ticket_id       INT NOT NULL UNIQUE REFERENCES tickets(id),   -- una sola respuesta por ticket
  user_id         INT NOT NULL REFERENCES users(id),
  score           INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  speed           INT NOT NULL CHECK (speed BETWEEN 1 AND 5),
  courtesy        INT NOT NULL CHECK (courtesy BETWEEN 1 AND 5),
  solution_score  INT NOT NULL CHECK (solution_score BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  editable_until  TIMESTAMP NOT NULL
);

-- migrate:down

DROP TABLE IF EXISTS surveys;
EOF

# --- seed compartido: UNA sola fuente para Entrega 1 (front) y Entrega 2 (BD)
write db/seed.json <<'EOF'
{
  "roles": [
    { "id": 1, "name": "user" },
    { "id": 2, "name": "technician" },
    { "id": 3, "name": "supervisor" }
  ],
  "rooms": [
    { "id": 1, "code": "A-201", "type": "Aula", "building": "A", "floor": 2, "campus": "Campus Monterrico", "capacity": 68 },
    { "id": 2, "code": "H-210", "type": "Laboratorio de Redes", "building": "H", "floor": 2, "campus": "Campus Monterrico", "capacity": 28 },
    { "id": 3, "code": "BIB-P2", "type": "Biblioteca piso 2", "building": "Biblioteca", "floor": 2, "campus": "Campus Monterrico", "capacity": 210 }
  ],
  "users": [
    { "id": 1, "first_name": "Camila Alejandra", "last_name": "Quispe Ramos", "email": "camila.quispe@aloe.ulima.edu.pe", "password": "Demo1234", "phone": "987654321", "unit": "Ingeniería de Sistemas", "affiliation": "student", "role_id": 1, "status": "active", "block_reason": null, "habitual_room_id": 1, "failed_attempts": 0, "locked_until": null, "created_at": "2026-03-14T10:00:00", "last_login_at": "2026-09-07T08:05:00" },
    { "id": 2, "first_name": "Julio César", "last_name": "Paredes Soto", "email": "jparedes@ulima.edu.pe", "password": "Demo1234", "phone": "951220874", "unit": "Audiovisuales · Redes", "affiliation": "staff", "role_id": 2, "status": "active", "block_reason": null, "habitual_room_id": null, "failed_attempts": 0, "locked_until": null, "created_at": "2026-02-01T09:00:00", "last_login_at": null },
    { "id": 3, "first_name": "Iván", "last_name": "Zegarra Pinto", "email": "izegarra@ulima.edu.pe", "password": "Demo1234", "phone": null, "unit": "Eléctrico · Accesos", "affiliation": "staff", "role_id": 2, "status": "active", "block_reason": null, "habitual_room_id": null, "failed_attempts": 0, "locked_until": null, "created_at": "2026-02-01T09:00:00", "last_login_at": null },
    { "id": 4, "first_name": "Lucía", "last_name": "Mendoza Ríos", "email": "lmendoza@ulima.edu.pe", "password": "Demo1234", "phone": null, "unit": "Infraestructura y Servicios", "affiliation": "staff", "role_id": 3, "status": "active", "block_reason": null, "habitual_room_id": null, "failed_attempts": 0, "locked_until": null, "created_at": "2026-01-15T09:00:00", "last_login_at": null },
    { "id": 5, "first_name": "Pedro", "last_name": "Salcedo Ayala", "email": "psalcedo@ulima.edu.pe", "password": "Demo1234", "phone": null, "unit": "Administración", "affiliation": "teacher", "role_id": 1, "status": "blocked", "block_reason": "Registró seis tickets duplicados del mismo ambiente en un día.", "habitual_room_id": null, "failed_attempts": 0, "locked_until": null, "created_at": "2026-04-02T09:00:00", "last_login_at": null }
  ],
  "categories": [
    { "id": 1, "name": "Audiovisuales", "parent_id": null, "default_priority": "high", "expected_hours": 8, "description": null, "active": true },
    { "id": 2, "name": "Proyector no enciende", "parent_id": 1, "default_priority": "critical", "expected_hours": 2, "description": "Falla del proyector o su cableado.", "active": true },
    { "id": 3, "name": "Redes y conectividad", "parent_id": null, "default_priority": "critical", "expected_hours": 2, "description": null, "active": true },
    { "id": 4, "name": "Punto de red caído", "parent_id": 3, "default_priority": "critical", "expected_hours": 2, "description": null, "active": true },
    { "id": 5, "name": "Mobiliario", "parent_id": null, "default_priority": "low", "expected_hours": 72, "description": null, "active": false },
    { "id": 6, "name": "Silla rota", "parent_id": 5, "default_priority": "low", "expected_hours": 72, "description": null, "active": false }
  ],
  "technician_categories": [
    { "id": 1, "technician_id": 2, "category_id": 1 },
    { "id": 2, "technician_id": 2, "category_id": 3 },
    { "id": 3, "technician_id": 3, "category_id": 3 }
  ],
  "tickets": [
    { "id": 1, "code": "TCK-2026-00147", "subject": "Proyector no enciende en aula A-201", "description": "El proyector enciende el foco pero la imagen no llega a la pantalla.", "category_id": 1, "subcategory_id": 2, "room_id": 1, "requester_id": 1, "technician_id": 2, "priority": "critical", "suggested_priority": "critical", "status": "in_progress", "created_at": "2026-09-07T08:12:00", "due_at": "2026-09-07T10:12:00", "closed_at": null, "solution": null, "hold_reason": null, "hold_return_date": null },
    { "id": 2, "code": "TCK-2026-00146", "subject": "Punto de red caído en laboratorio", "description": "Sin enlace en los puestos 4 al 8.", "category_id": 3, "subcategory_id": 4, "room_id": 2, "requester_id": 1, "technician_id": null, "priority": "critical", "suggested_priority": "high", "status": "open", "created_at": "2026-09-07T07:30:00", "due_at": "2026-09-07T09:30:00", "closed_at": null, "solution": null, "hold_reason": null, "hold_return_date": null },
    { "id": 3, "code": "TCK-2026-00126", "subject": "Proyector con imagen verdosa", "description": "La imagen se ve verde en toda la pantalla.", "category_id": 1, "subcategory_id": 2, "room_id": 3, "requester_id": 1, "technician_id": 2, "priority": "medium", "suggested_priority": "medium", "status": "on_hold", "created_at": "2026-09-04T11:00:00", "due_at": "2026-09-05T11:00:00", "closed_at": null, "solution": null, "hold_reason": "Repuesto solicitado al almacén.", "hold_return_date": "2026-09-09" },
    { "id": 4, "code": "TCK-2026-00131", "subject": "Piso con residuos tras evento", "description": "Quedaron restos de pintura junto a la ventana.", "category_id": 5, "subcategory_id": 6, "room_id": 1, "requester_id": 1, "technician_id": 3, "priority": "low", "suggested_priority": "low", "status": "closed", "created_at": "2026-09-01T09:00:00", "due_at": "2026-09-04T09:00:00", "closed_at": "2026-09-03T15:00:00", "solution": "Limpieza profunda del ambiente y retiro de residuos.", "hold_reason": null, "hold_return_date": null }
  ],
  "assignments": [
    { "id": 1, "ticket_id": 1, "technician_id": 2, "assigned_by": 4, "note": "Hay clase de 10:00 a 13:00", "reason": null, "created_at": "2026-09-07T08:20:00" }
  ],
  "priority_changes": [
    { "id": 1, "ticket_id": 2, "from_priority": "high", "to_priority": "critical", "reason": "Afecta una práctica calificada.", "author_id": 4, "created_at": "2026-09-07T07:45:00" }
  ],
  "ticket_logs": [
    { "id": 1, "ticket_id": 1, "author_id": 1, "type": "public", "body": "El proyector enciende el foco pero la imagen no llega.", "created_at": "2026-09-07T08:12:00" },
    { "id": 2, "ticket_id": 1, "author_id": 2, "type": "internal", "body": "El HDMI de la mesa mide 0 V. Probable falla del extensor del rack.", "created_at": "2026-09-07T08:41:00" },
    { "id": 3, "ticket_id": 1, "author_id": 2, "type": "public", "body": "Con un cable de reemplazo la imagen vuelve; el problema está en el extensor.", "created_at": "2026-09-07T09:05:00" }
  ],
  "ticket_status_changes": [
    { "id": 1, "ticket_id": 1, "from_status": null, "to_status": "open", "author_id": 1, "reason": null, "created_at": "2026-09-07T08:12:00" },
    { "id": 2, "ticket_id": 1, "from_status": "open", "to_status": "in_progress", "author_id": 2, "reason": null, "created_at": "2026-09-07T08:41:00" }
  ],
  "surveys": []
}
EOF

write db/seed_to_migrations.js <<'EOF'
// db/seed_to_migrations.js · Entrega 2: convierte db/seed.json en migraciones fill_<tabla>.sql
// Uso: npm run db:seed   (luego: npm run db:up)
// Reglas: cada clave de seed.json es una tabla y cada campo una columna (snake_case).
//         El ORDEN de las claves debe respetar las llaves foráneas.
//         "password" (texto plano, solo para mock) se convierte en password_hash.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPassword } from '../configs/password.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(fs.readFileSync(path.join(dir, 'seed.json'), 'utf8'));

const lit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return "'" + String(v).replace(/'/g, "''") + "'";
};

let i = 0;
for (const [table, rows] of Object.entries(seed)) {
  i += 1;
  const version = String(20261002000000 + i);
  const lines = ['-- migrate:up', ''];

  for (const original of rows) {
    const row = { ...original };
    if ('password' in row) {
      row.password_hash = hashPassword(row.password);
      delete row.password;
    }
    const cols = Object.keys(row);
    lines.push('INSERT INTO ' + table + ' (' + cols.join(', ') + ') VALUES (' + cols.map((c) => lit(row[c])).join(', ') + ');');
  }

  if (rows.some((r) => 'id' in r)) {
    lines.push('', "SELECT setval(pg_get_serial_sequence('" + table + "', 'id'), (SELECT MAX(id) FROM " + table + '));');
  }
  lines.push('', '-- migrate:down', '', 'DELETE FROM ' + table + ';', '');

  fs.writeFileSync(path.join(dir, 'migrations', version + '_fill_' + table + '.sql'), lines.join('\n'));
  console.log('fill_' + table + ': ' + rows.length + ' filas');
}
EOF

# =====================================================================
# 5. FRONT · helpers (http/mock), constantes, navegación
# =====================================================================
write src/helpers/constants.js <<'EOF'
// src/helpers/constants.js
export const ROLES = { USER: 'user', TECHNICIAN: 'technician', SUPERVISOR: 'supervisor' };

// 5 integrantes -> [1,2,3,4,5] · 6 -> [1..6] · 7 -> [1..7]  (oculta del menú lo que no se desarrolla)
export const ACTIVE_HUS = [1, 2, 3, 4, 5];

export const STATUS_LABELS = {
  open: 'Abierto', in_progress: 'En atención', on_hold: 'En espera',
  resolved: 'Resuelto', closed: 'Cerrado', reopened: 'Reabierto', cancelled: 'Cancelado'
};
export const PRIORITY_LABELS = { critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' };

// Transiciones válidas (propuesta; acordar en grupo)
export const TRANSITIONS = {
  open: ['in_progress', 'cancelled'],
  in_progress: ['on_hold', 'resolved'],
  on_hold: ['in_progress'],
  resolved: ['closed'],
  closed: ['reopened'],
  reopened: ['in_progress'],
  cancelled: []
};

export const REOPEN_DAYS = 7;
export const SURVEY_EDIT_DAYS = 7;
EOF

write src/helpers/navigation.js <<'EOF'
// src/helpers/navigation.js · menú lateral por rol (se oculta lo de las HU no activas)
import { ROLES, ACTIVE_HUS } from './constants.js';

const MENU = {
  [ROLES.USER]: [
    { label: 'Nuevo ticket', to: '/admin/user/tickets/new', hu: 3 },
    { label: 'Mis tickets', to: '/admin/user/tickets', hu: 3 },
    { label: 'Mis encuestas', to: '/admin/user/surveys', hu: 6 },
    { label: 'Mi cuenta', to: '/admin/mi-cuenta', hu: 1 }
  ],
  [ROLES.TECHNICIAN]: [
    { label: 'Mi bandeja', to: '/admin/technician/inbox', hu: 4 },
    { label: 'Mi cuenta', to: '/admin/mi-cuenta', hu: 1 }
  ],
  [ROLES.SUPERVISOR]: [
    { label: 'Tablero', to: '/admin/supervisor/dashboard', hu: 7 },
    { label: 'Cola de atención', to: '/admin/supervisor/queue', hu: 4 },
    { label: 'Bandejas de técnicos', to: '/admin/supervisor/inboxes', hu: 4 },
    { label: 'Categorías', to: '/admin/supervisor/categories', hu: 2 },
    { label: 'Sedes y ambientes', to: '/admin/supervisor/rooms', hu: 2 },
    { label: 'Técnicos por categoría', to: '/admin/supervisor/technician-categories', hu: 2 },
    { label: 'Satisfacción', to: '/admin/supervisor/satisfaction', hu: 6 },
    { label: 'Carga por técnico', to: '/admin/supervisor/workload', hu: 7 },
    { label: 'Usuarios', to: '/admin/supervisor/users', hu: 7 },
    { label: 'Mi cuenta', to: '/admin/mi-cuenta', hu: 1 }
  ]
};

export const menuForRole = (role) => (MENU[role] || []).filter((item) => ACTIVE_HUS.includes(item.hu));
EOF

write src/helpers/validators.js <<'EOF'
// src/helpers/validators.js · validaciones del front (se REPITEN en el servidor)
export const isRequired = (v) => String(v ?? '').trim().length > 0;
export const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
export const isStrongPassword = (v) => /^(?=.*[A-Z])(?=.*\d).{8,}$/.test(v || ''); // 8+, 1 mayúscula, 1 número
export const isPhone = (v) => /^[0-9 +()-]{7,20}$/.test(v || '');
EOF

write src/helpers/formatters.js <<'EOF'
// src/helpers/formatters.js
export const formatDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString('es-PE') : '—');

export const minutesToText = (min) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? h + ' h ' + m + ' min' : m + ' min';
};
EOF

write src/helpers/mock_api.js <<'EOF'
// src/helpers/mock_api.js · API simulada para la ENTREGA 1 (misma forma que /api/v1/*)
// CRUD genérico sobre cada tabla de db/seed.json + rutas propias con register().
// Cada HU registra sus acciones especiales (asignar, cambiar estado...) con mockApi.register(...).

const envelope = (success, message, data = null, error = null) => ({ success, message, data, error });
const toRegex = (path) => new RegExp('^' + path.replace(/:[A-Za-z_]+/g, '([^/]+)') + '/?$');

export function createMockApi(seed) {
  const db = JSON.parse(JSON.stringify(seed));
  const custom = [];

  const ok = (data, message = 'OK', status = 200) => Promise.resolve({ status, data: envelope(true, message, data) });
  const fail = (status, message) =>
    Promise.reject({ message, response: { status, data: envelope(false, message, null, message) } });
  const nextId = (rows) => rows.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;

  /** register('post', '/api/v1/tickets/:id/assign', ({ db, params, body, ok, fail, nextId }) => ...) */
  const register = (method, path, handler) => {
    custom.push({
      method: method.toLowerCase(),
      regex: toRegex(path),
      keys: (path.match(/:[A-Za-z_]+/g) || []).map((k) => k.slice(1)),
      handler
    });
  };

  const generic = (method, path, { body, query }) => {
    const m = path.match(/^\/api\/v1\/([a-z_]+)(?:\/(\d+))?\/?$/);
    if (!m || !Array.isArray(db[m[1]])) return null;
    const rows = db[m[1]];
    const id = m[2] ? Number(m[2]) : null;
    const index = id === null ? -1 : rows.findIndex((r) => r.id === id);

    if (method === 'get' && id === null) {
      const { page: p, limit: l, ...filters } = query;
      const page = Number(p) || 1;
      const limit = Number(l) || 10;
      const filtered = rows
        .filter((r) => Object.entries(filters).every(([k, v]) => v === '' || v === undefined || String(r[k]) === String(v)))
        .sort((a, b) => b.id - a.id);
      const offset = (page - 1) * limit;
      return ok({ list: filtered.slice(offset, offset + limit), total: filtered.length, pages: Math.ceil(filtered.length / limit), offset, limit, page }, 'Listado obtenido con éxito');
    }
    if (method === 'post' && id === null) {
      const row = { ...body, id: nextId(rows) };
      rows.push(row);
      return ok(row, 'Registro creado con éxito', 201);
    }
    if (id === null) return null;
    if (index < 0) return fail(404, 'Registro no encontrado');
    if (method === 'get') return ok(rows[index], 'Registro obtenido con éxito');
    if (method === 'put') {
      rows[index] = { ...rows[index], ...body, id };
      return ok(rows[index], 'Registro actualizado con éxito');
    }
    if (method === 'delete') {
      rows.splice(index, 1);
      return ok(null, 'Registro eliminado con éxito');
    }
    return null;
  };

  const request = (method, url, { data, params } = {}) => {
    const m = method.toLowerCase();
    const [path, qs] = url.split('?');
    const query = { ...Object.fromEntries(new URLSearchParams(qs || '')), ...(params || {}) };

    for (const route of custom) {
      const match = path.match(route.regex);
      if (route.method === m && match) {
        const pathParams = {};
        route.keys.forEach((k, i) => (pathParams[k] = match[i + 1]));
        return route.handler({ db, params: pathParams, query, body: data || {}, ok, fail, nextId });
      }
    }
    return generic(m, path, { body: data || {}, query }) || fail(404, 'Recurso no encontrado');
  };

  return { request, register, db };
}
EOF

write src/helpers/http.js <<'EOF'
// src/helpers/http.js · ÚNICO punto de acceso a datos desde React (nada de fetch/axios suelto en las pages)
// Entrega 1: VITE_USE_MOCK=true  -> responde desde db/seed.json (src/helpers/mock_api.js)
// Entrega 2: VITE_USE_MOCK=false -> axios contra /api/v1/* (Express + Sequelize)
// Uso: const res = await http.get('/api/v1/tickets', { params: { status: 'open' } }); res.data.data.list
import axios from 'axios';
import seed from '../../db/seed.json';
import { createMockApi } from './mock_api.js';

const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';
const client = axios.create({ withCredentials: true });

export const mockApi = createMockApi(seed);

// Sesión simulada: usuario según VITE_MOCK_USER_ID (1 = user, 2 = technician, 4 = supervisor)
mockApi.register('get', '/api/v1/sessions', ({ db, ok, fail }) => {
  const id = Number(import.meta.env.VITE_MOCK_USER_ID) || 1;
  const user = db.users.find((u) => u.id === id);
  if (!user) return fail(401, 'No active session');
  const role = db.roles.find((r) => r.id === user.role_id);
  const { password, ...safe } = user;
  return ok({ user: { ...safe, role: role ? role.name : null } });
});

const call = (method, url, data, config = {}) =>
  USE_MOCK
    ? mockApi.request(method, url, { data, params: config.params })
    : client.request({ method, url, data, ...config });

const http = {
  get: (url, config) => call('get', url, undefined, config),
  post: (url, data, config) => call('post', url, data, config),
  put: (url, data, config) => call('put', url, data, config),
  delete: (url, config) => call('delete', url, undefined, config)
};

export default http;
EOF

write src/helpers/useSession.js <<'EOF'
// src/helpers/useSession.js · usuario autenticado (GET /api/v1/sessions) -> { user, role, loading }
// HU-1: el servidor debe guardar session.user = { id, first_name, last_name, email, role } al iniciar sesión.
import { useEffect, useState } from 'react';
import http from './http.js';

export function useSession() {
  const [state, setState] = useState({ user: null, loading: true });

  useEffect(() => {
    http.get('/api/v1/sessions')
      .then((res) => setState({ user: res.data.data.user, loading: false }))
      .catch(() => setState({ user: null, loading: false }));
  }, []);

  return { user: state.user, role: state.user?.role || null, loading: state.loading };
}
EOF

# =====================================================================
# 6. FRONT · estilos (sistema de diseño del PDF sobre Bootstrap)
# =====================================================================
write src/entries/tokens.css <<'EOF'
/* src/entries/tokens.css · sistema de diseño del PDF de mockups, aplicado sobre Bootstrap */
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');

:root {
  --primary: #1F4E79;
  --primary-dark: #163A5A;
  --primary-soft: #E7EFF6;
  --accent: #D2601A;
  --bg: #F4F6F8;
  --surface: #FFFFFF;
  --border: #D6DEE5;
  --text: #141C24;
  --text-muted: #5F6C78;
  --success: #1E7F4D;
  --warning: #B7791F;
  --danger: #B4322B;
  --info: #3B6FA8;

  --priority-critical: #B4322B;
  --priority-high: #D2601A;
  --priority-medium: #B7791F;
  --priority-low: #3B6FA8;

  --status-open: #3B6FA8;
  --status-in_progress: #B7791F;
  --status-on_hold: #5F6C78;
  --status-resolved: #1E7F4D;
  --status-closed: #1E7F4D;
  --status-reopened: #B4322B;
  --status-cancelled: #5F6C78;

  --header-h: 60px;
  --sidebar-w: 236px;
  --footer-h: 44px;
  --content-w: 1200px;
  --row-h: 44px;

  /* Bootstrap */
  --bs-primary: #1F4E79;
  --bs-primary-rgb: 31, 78, 121;
  --bs-link-color: #1F4E79;
  --bs-link-hover-color: #163A5A;
  --bs-body-color: #141C24;
  --bs-body-bg: #F4F6F8;
  --bs-border-color: #D6DEE5;
  --bs-border-radius: 4px;
  --bs-body-font-family: 'IBM Plex Sans', system-ui, sans-serif;
  --bs-font-monospace: 'IBM Plex Mono', ui-monospace, monospace;
}

.btn-primary {
  --bs-btn-bg: #1F4E79;
  --bs-btn-border-color: #1F4E79;
  --bs-btn-hover-bg: #163A5A;
  --bs-btn-hover-border-color: #163A5A;
  --bs-btn-active-bg: #163A5A;
  --bs-btn-active-border-color: #163A5A;
}

.mono { font-family: var(--bs-font-monospace); }
EOF

# =====================================================================
# 7. FRONT · widgets compartidos (módulo común del grupo) y modales por HU
# =====================================================================
widget() { write "src/widgets/$1.jsx" <<EOF
// src/widgets/$1.jsx · $2
import React from 'react';

export default function $1() {
  return <div>$1</div>;
}
EOF
}

write src/widgets/StatusBadge.jsx <<'EOF'
// src/widgets/StatusBadge.jsx · etiqueta de estado del ticket (compartido)
import React from 'react';
import { STATUS_LABELS } from '../helpers/constants.js';
import './StatusBadge.css';

export default function StatusBadge({ status }) {
  return <span className={'status-badge status-badge--' + status}>{STATUS_LABELS[status] || status}</span>;
}
EOF

write src/widgets/StatusBadge.css <<'EOF'
/* src/widgets/StatusBadge.css */
.status-badge {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 12px;
  line-height: 16px;
  background: #fff;
}
.status-badge--open { color: var(--status-open); }
.status-badge--in_progress { color: var(--status-in_progress); }
.status-badge--on_hold { color: var(--status-on_hold); }
.status-badge--resolved { color: var(--status-resolved); }
.status-badge--closed { color: var(--status-closed); }
.status-badge--reopened { color: var(--status-reopened); }
.status-badge--cancelled { color: var(--status-cancelled); }
EOF

write src/widgets/PriorityBadge.jsx <<'EOF'
// src/widgets/PriorityBadge.jsx · etiqueta de prioridad (compartido)
import React from 'react';
import { PRIORITY_LABELS } from '../helpers/constants.js';
import './PriorityBadge.css';

export default function PriorityBadge({ priority }) {
  return <span className={'priority-badge priority-badge--' + priority}>{PRIORITY_LABELS[priority] || priority}</span>;
}
EOF

write src/widgets/PriorityBadge.css <<'EOF'
/* src/widgets/PriorityBadge.css */
.priority-badge {
  display: inline-block;
  padding: 1px 8px;
  border: 1px solid currentColor;
  border-radius: 4px;
  font-size: 12px;
  line-height: 16px;
  background: #fff;
}
.priority-badge--critical { color: var(--priority-critical); }
.priority-badge--high { color: var(--priority-high); }
.priority-badge--medium { color: var(--priority-medium); }
.priority-badge--low { color: var(--priority-low); }
EOF

widget ConfirmDialog "Compartido (grupo) · diálogo de confirmación para acciones destructivas"
widget EmptyState "Compartido (grupo) · estado vacío de listas"
widget TicketCard "Compartido (grupo) · tarjeta/fila de ticket"
widget TicketLog "Compartido (grupo) · bitácora del ticket (HU-3 usuario, HU-5 técnico)"
widget RoomModal "HU-2 · modal Nuevo ambiente"
widget ReopenTicketModal "HU-3 · modal 3.5 Reabrir ticket"
widget AssignModal "HU-4 · modal 4.2 Asignar técnico"
widget PriorityModal "HU-4 · modal 4.3 Cambiar prioridad"
widget ReturnToQueueDialog "HU-4 · confirmación Devolver a la cola"
widget ChangeStatusModal "HU-5 · modal 5.3 Cambiar estado"
widget CloseTicketModal "HU-5 · modal 5.4 Cerrar ticket"
widget BlockUserModal "HU-7 · modal Bloquear cuenta"

# =====================================================================
# 8. FRONT · partials del panel
# =====================================================================
write src/partials/Footer.jsx <<'EOF'
// src/partials/Footer.jsx
import React from 'react';

export default function Footer() {
  return (
    <footer className="border-top bg-white px-4 py-2 small text-secondary d-flex justify-content-between">
      <span>Mesa de Ayuda de Servicios del Campus · Universidad de Lima</span>
      <span>soporte.campus@ulima.edu.pe · anexo 30500</span>
    </footer>
  );
}
EOF

write src/partials/PanelSidebar.jsx <<'EOF'
// src/partials/PanelSidebar.jsx · menú lateral según el rol (ver helpers/navigation.js)
import React from 'react';
import { NavLink } from 'react-router-dom';
import { menuForRole } from '../helpers/navigation.js';

export default function PanelSidebar({ role }) {
  const linkClass = ({ isActive }) =>
    'nav-link ' + (isActive ? 'active bg-primary text-white' : 'text-dark');

  return (
    <div className="d-flex flex-column p-3 bg-white border-end" style={{ width: 'var(--sidebar-w)', minHeight: '100vh' }}>
      <span className="fs-5 fw-bold px-2">Mesa de Ayuda</span>
      <hr />
      <ul className="nav nav-pills flex-column gap-1">
        {menuForRole(role).map((item) => (
          <li key={item.to} className="nav-item">
            <NavLink to={item.to} end className={linkClass}>{item.label}</NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
EOF

write src/partials/PanelLayout.jsx <<'EOF'
// src/partials/PanelLayout.jsx · cabecera + menú por rol + contenido + pie (compartido)
import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import PanelSidebar from './PanelSidebar';
import Footer from './Footer';
import { useSession } from '../helpers/useSession.js';

export default function PanelLayout() {
  const { user, role, loading } = useSession();
  if (loading) return <div className="p-4">Cargando…</div>;

  const name = user ? user.first_name + ' ' + user.last_name : 'Invitado';
  return (
    <div className="d-flex" style={{ minHeight: '100vh' }}>
      <PanelSidebar role={role} />
      <div className="flex-grow-1 d-flex flex-column">
        <Navbar user={{ name }} />
        <main className="p-4 flex-grow-1"><Outlet /></main>
        <Footer />
      </div>
    </div>
  );
}
EOF

# =====================================================================
# 9. FRONT · pages (src/pages/XxxPage.jsx) y rutas del panel
# =====================================================================
page() { write "src/pages/$1.jsx" <<EOF
// src/pages/$1.jsx · HU-$2 · mockup $3
import React from 'react';

export default function $1() {
  return <h2 className="fw-bold">$1</h2>;
}
EOF
}
page AccountPage 1 "1.6"
page CategoriesPage 2 "2.1"
page CategoryFormPage 2 "2.2"
page RoomsPage 2 "2.3"
page TechnicianCategoriesPage 2 "2.4"
page TicketNewPage 3 "3.1"
page TicketCreatedPage 3 "3.2"
page MyTicketsPage 3 "3.3"
page TicketUserDetailPage 3 "3.4"
page QueuePage 4 "4.1"
page TechnicianInboxPage 4 "4.5"
page InboxesPage 4 "navegación del supervisor"
page TicketAttentionPage 5 "5.1 / 5.2"
page TicketHistoryPage 5 "5.5"
page SurveyFormPage 6 "6.1"
page MySurveysPage 6 "6.2"
page SatisfactionPage 6 "6.3"
page WorkloadPage 7 "7.2"
page UsersPage 7 "7.3"
page UserDetailPage 7 "7.4"
# Ya existe en la plantilla (ejemplo de fútbol): DashboardPage.jsx -> HU-7 la reescribe como mockup 7.1

write src/entries/panel_routes.jsx <<'EOF'
// src/entries/panel_routes.jsx · rutas React del panel de la mesa de ayuda (se montan en admin.jsx)
// Express ya protege cada prefijo por rol; aquí solo se resuelve la pantalla.
import React from 'react';
import { Route } from 'react-router-dom';
import PanelLayout from '../partials/PanelLayout.jsx';

import AccountPage from '../pages/AccountPage.jsx';                              // HU-1
import CategoriesPage from '../pages/CategoriesPage.jsx';                        // HU-2
import CategoryFormPage from '../pages/CategoryFormPage.jsx';
import RoomsPage from '../pages/RoomsPage.jsx';
import TechnicianCategoriesPage from '../pages/TechnicianCategoriesPage.jsx';
import TicketNewPage from '../pages/TicketNewPage.jsx';                          // HU-3
import TicketCreatedPage from '../pages/TicketCreatedPage.jsx';
import MyTicketsPage from '../pages/MyTicketsPage.jsx';
import TicketUserDetailPage from '../pages/TicketUserDetailPage.jsx';
import QueuePage from '../pages/QueuePage.jsx';                                  // HU-4
import TechnicianInboxPage from '../pages/TechnicianInboxPage.jsx';
import InboxesPage from '../pages/InboxesPage.jsx';
import TicketAttentionPage from '../pages/TicketAttentionPage.jsx';              // HU-5
import TicketHistoryPage from '../pages/TicketHistoryPage.jsx';
import SurveyFormPage from '../pages/SurveyFormPage.jsx';                        // HU-6
import MySurveysPage from '../pages/MySurveysPage.jsx';
import SatisfactionPage from '../pages/SatisfactionPage.jsx';
import DashboardPage from '../pages/DashboardPage.jsx';                          // HU-7
import WorkloadPage from '../pages/WorkloadPage.jsx';
import UsersPage from '../pages/UsersPage.jsx';
import UserDetailPage from '../pages/UserDetailPage.jsx';

export const panelRoutes = (
  <Route path="/admin" element={<PanelLayout />}>
    <Route path="mi-cuenta" element={<AccountPage />} />

    {/* Usuario */}
    <Route path="user/tickets/new" element={<TicketNewPage />} />
    <Route path="user/tickets/:code/created" element={<TicketCreatedPage />} />
    <Route path="user/tickets" element={<MyTicketsPage />} />
    <Route path="user/tickets/:code" element={<TicketUserDetailPage />} />
    <Route path="user/surveys/:code" element={<SurveyFormPage />} />
    <Route path="user/surveys" element={<MySurveysPage />} />

    {/* Técnico */}
    <Route path="technician/inbox" element={<TechnicianInboxPage />} />
    <Route path="technician/tickets/:code" element={<TicketAttentionPage />} />
    <Route path="technician/tickets/:code/history" element={<TicketHistoryPage />} />

    {/* Supervisor */}
    <Route path="supervisor/dashboard" element={<DashboardPage />} />
    <Route path="supervisor/queue" element={<QueuePage />} />
    <Route path="supervisor/inboxes" element={<InboxesPage />} />
    <Route path="supervisor/categories" element={<CategoriesPage />} />
    <Route path="supervisor/categories/new" element={<CategoryFormPage />} />
    <Route path="supervisor/categories/:id" element={<CategoryFormPage />} />
    <Route path="supervisor/rooms" element={<RoomsPage />} />
    <Route path="supervisor/technician-categories" element={<TechnicianCategoriesPage />} />
    <Route path="supervisor/tickets/:code" element={<TicketAttentionPage />} />
    <Route path="supervisor/tickets/:code/history" element={<TicketHistoryPage />} />
    <Route path="supervisor/satisfaction" element={<SatisfactionPage />} />
    <Route path="supervisor/workload" element={<WorkloadPage />} />
    <Route path="supervisor/users" element={<UsersPage />} />
    <Route path="supervisor/users/:id" element={<UserDetailPage />} />
  </Route>
);
EOF

# =====================================================================
# 10. DOCS · variables de entorno y diagrama
# =====================================================================
write env.example <<'EOF'
# Copiar a .env (el .gitignore ya ignora .env*; este archivo se llama env.example a propósito)
PORT=3000
NODE_ENV=development
SESSION_SECRET=cambia-esto
SITE_TITLE=Mesa de Ayuda

# Base de datos (Supabase / Postgres)
DB_HOST=
DB_PORT=5432
DB_NAME=postgres
DB_USER=
DB_PASS=
DB_SSL=true
DB=postgres://usuario:clave@host:5432/postgres   # para dbmate (npm run db:up)

# Entrega 1: front con datos simulados (db/seed.json). 1 = user · 2 = technician · 4 = supervisor
VITE_USE_MOCK=true
VITE_MOCK_USER_ID=1
EOF

write docs/database_tema5.puml <<'EOF'
@startuml
skinparam linetype ortho
hide circle

entity roles { * id : INT <<PK>> --  name }
entity users { * id : INT <<PK>> -- first_name, last_name, email, password_hash, phone, unit, affiliation, status, block_reason, failed_attempts, locked_until * role_id : INT <<FK>> habitual_room_id : INT <<FK>> }
entity invitations { * id : INT <<PK>> -- email, token, expires_at, accepted_at * role_id <<FK>> * invited_by <<FK>> }
entity password_resets { * id : INT <<PK>> -- token_hash, expires_at, used_at * user_id <<FK>> }
entity categories { * id : INT <<PK>> -- name, default_priority, expected_hours, description, active parent_id : INT <<FK>> }
entity rooms { * id : INT <<PK>> -- code, type, building, floor, campus, capacity }
entity technician_categories { * id : INT <<PK>> -- * technician_id <<FK>> * category_id <<FK>> }
entity tickets { * id : INT <<PK>> -- code, subject, description, priority, suggested_priority, status, created_at, due_at, closed_at, solution, hold_reason, hold_return_date * category_id <<FK>> subcategory_id <<FK>> * room_id <<FK>> * requester_id <<FK>> technician_id <<FK>> }
entity assignments { * id : INT <<PK>> -- note, reason, created_at * ticket_id <<FK>> technician_id <<FK>> * assigned_by <<FK>> }
entity priority_changes { * id : INT <<PK>> -- from_priority, to_priority, reason, created_at * ticket_id <<FK>> * author_id <<FK>> }
entity ticket_logs { * id : INT <<PK>> -- type, body, created_at * ticket_id <<FK>> * author_id <<FK>> }
entity ticket_status_changes { * id : INT <<PK>> -- from_status, to_status, reason, created_at * ticket_id <<FK>> * author_id <<FK>> }
entity surveys { * id : INT <<PK>> -- score, speed, courtesy, solution_score, comment, editable_until * ticket_id <<FK, UNIQUE>> * user_id <<FK>> }

roles ||--o{ users
rooms ||--o{ users
users ||--o{ invitations
users ||--o{ password_resets
categories ||--o{ categories
users ||--o{ technician_categories
categories ||--o{ technician_categories
categories ||--o{ tickets
rooms ||--o{ tickets
users ||--o{ tickets
tickets ||--o{ assignments
tickets ||--o{ priority_changes
tickets ||--o{ ticket_logs
tickets ||--o{ ticket_status_changes
tickets ||--o| surveys
@enduml
EOF

write prompts/README.md <<'EOF'
# Prompts de IA usados en el proyecto

Un archivo por prompt: `AAAA-MM-DD_hu#_tema.md` con el prompt, la respuesta relevante y qué se aceptó o modificó.
EOF

echo
echo "Listo. Siguiente:"
echo "  1) npm install && cp env.example .env   (completa DB_* y SESSION_SECRET)"
echo "  2) npm run db:up                         (crea las tablas)"
echo "  3) npm run dev"
echo "  4) git add -A && git commit -m 'chore: scaffold de la mesa de ayuda'"
