# **Arquitectura — Mesa de ayuda de servicios del campus (Tema 5)**

Programación Web 2026-2 · Universidad de Lima
Base: plantilla del curso (React + Vite · Node + Express · Supabase · Vercel).

---

## **1. Decisiones clave**

| # | Decisión | Por qué |
| :- | :------- | :------ |
| 1 | Se mantiene **la misma estructura de carpetas de la plantilla** (admin, api, configs, db, docs, public, src, views, website). | Es lo que se ve en clase y lo que pide el docente. |
| 2 | **Una mini-app React por rol** (`web`, `usuario`, `tecnico`, `supervisor`), cada una con su `home.ejs`. | Forma de trabajo del docente: cada rol solo descarga y ve lo suyo. |
| 3 | **Login validado en el servidor con sesión** (`express-session`): `req.session.userId`, `username` y `role`. | El front ya no decide quién está logueado; solo pregunta `GET /api/v1/sessions`. |
| 4 | **Rutas protegidas con middlewares por rol** (`soloLogueado`, `soloUsuario`, `soloTecnico`, `soloSupervisor`). Una línea de Express por cada ruta de React Router. | F5 funciona en cualquier ruta y el servidor corta el acceso antes de enviar la app. |
| 5 | Backend en **capas**: routes → controllers / apis → services → repositories. | Sin acceso a datos en controladores ni consultas en componentes. |
| 6 | Organización del front **por rol, no por historia**. Cada página empieza con `// HU-x · mockup · Rol`. | Se ubica rápido qué historia y qué mockup cubre cada archivo. |
| 7 | **Una sola fuente de datos de prueba**: `db/seed/seed.json`. El servidor la usa para las cuentas y el front para tickets, catálogo, cola y atención; en la Entrega 2 se carga a Supabase. | Pide el docente: mismo JSON en ambas entregas. |
| 8 | El front nunca llama a `axios`/`fetch` ni lee el JSON dentro de los componentes: usa `src/services/*`. | Entrega 1 → Entrega 2 sin reescribir pantallas. |

---

## **2. Estructura de carpetas**

```
PROYECTO-PW-T5/
├── admin/
│   ├── configs/routes.js        ← una línea por ruta de React Router de cada rol (+ APIs de nations)
│   ├── controllers/             usuario_controllers.js, tecnico_controllers.js, supervisor_controllers.js
│   └── apis/ models/ repositories/ services/   ← nations (ejemplo del docente para la Entrega 2)
├── api/index.js                 ← entrada serverless de Vercel (exporta la app Express)
├── configs/
│   ├── bootstrap.js             sesión (express-session + session-file-store), vistas, estáticos, rutas
│   ├── middlewares.js           soloLogueado, soloUsuario, soloTecnico, soloSupervisor, redireccionarSiLogueado, 404
│   └── helpers.js               rutaInicio(role)
├── db/
│   ├── seed/seed.json           ← fuente compartida de datos semilla para la Entrega 1 y 2
│   └── migrations/, schema.sql
├── docs/
├── public/
│   ├── assets/css/site.css      ← sistema de diseño para las páginas EJS sin React
│   ├── assets/img/claude-bailando.svg   (easter egg de la landing)
│   └── dist/                    ← build de Vite: css/app.css, css/<rol>.css, js/app.js, js/atencion.js, js/<rol>.js
├── src/
│   ├── entries/
│   │   ├── visitante.jsx        /registro, /recuperar, /invitacion/:token (sin sesión; cabecera y pie en website.ejs)
│   │   ├── usuario.jsx          UsuarioLayout = CabeceraUsuario + SideBarUsuario + <Outlet/> + FooterUsuario
│   │   ├── tecnico.jsx          TecnicoLayout
│   │   ├── supervisor.jsx       SupervisorLayout (reutiliza el detalle e historial del técnico)
│   │   └── app.css              sistema de diseño (colores, IBM Plex…), lo importan todas las entries
│   ├── partials/                Cabecera<Rol>, SideBar<Rol>, Footer<Rol> (cada SideBar tiene su menú)
│   ├── pages/
│   │   ├── visitante/           Registro, RecuperarPassword, AltaInvitacion            (HU-1)
│   │   ├── usuario/             MisTickets, NuevoTicket, ConfirmacionTicket, DetalleTicket (HU-3)
│   │   ├── tecnico/             Bandeja (HU-4), DetalleTicket, HistorialCambios (HU-5)
│   │   └── supervisor/          Cola, BandejasTecnicos (HU-4), Categorias, CategoriaForm, Ambientes,
│   │                            TecnicosPorCategoria (HU-2)
│   ├── context/AuthContext.jsx  GET /api/v1/sessions al iniciar; no pinta la app hasta tener respuesta
│   ├── services/                api.client, auth (APIs del servidor), tickets, catalogo, cola, atencion (seed + localStorage)
│   ├── widgets/                 comunes a todos los roles: Badges, Modal, ConfirmDialog, EmptyState, Bitacora,
│   │                            TicketCard, Paginacion, FormField, MiCuenta, NoEncontrado, BuscadorTicket, ScrollToTop
│   └── helpers/                 datetime.js, validation.js, navigation.js (ROLES, rutaInicio)
├── views/
│   ├── layouts/website.ejs      <head> + _navbar + body + _footer (vistas del visitante)
│   ├── layouts/access.ejs       página centrada sin navbar (login, 401, 403, 404; el 403 con cabecera de la sesión)
│   ├── layouts/admin.ejs        solo body + css/app.css + css/<rol>.css + js/<rol>.js (recibe "rol")
│   ├── partials/                _navbar.ejs, _footer.ejs, _flash_message.ejs
│   ├── visitante/               home.ejs (1.1), login.ejs (1.2), cuenta.ejs (#root + visitante.js)
│   ├── usuario/ tecnico/ supervisor/   home.ejs (#root)
│   └── 401.ejs, 403.ejs, 404.ejs
├── website/                     ← visitante y cuenta (HU-1), misma forma que admin/
│   ├── configs/routes.js        /, /login, /logout, /registro, /recuperar, /invitacion/:token y /api/v1/...
│   ├── controllers/visitante_controllers.js   home, login, ingresar, logout, cuenta
│   ├── apis/cuenta_apis.js      JSON { success, message, data, error } (las usan visitante y roles logueados)
│   ├── services/cuenta_services.js        reglas de negocio de HU-1
│   └── repositories/cuenta_repositories.js única capa que toca usuarios, invitaciones, unidades y tokens (memoria)
└── package.json, server.js, vercel.json, vite.config.js
```

---

## **3. Reglas de capas (backend)**

| Capa | Hace | NO hace |
| :--- | :--- | :------ |
| routes | Declara endpoint + middlewares (`soloLogueado`, `solo<Rol>`, `redireccionarSiLogueado`) | Lógica |
| controllers / apis | Leen `req`, llaman al service, responden con el código HTTP correcto (vista EJS o JSON) | Tocar datos, reglas de negocio |
| services | Reglas de negocio (bloqueo de login, validaciones, invitaciones, recuperación) | Tocar `req`/`res` |
| repositories | Única capa que lee y escribe los datos (Entrega 1: memoria cargada del seed; Entrega 2: Supabase) | Reglas de negocio |

Reglas extra:

* Las validaciones del front se repiten en el servidor.
* Credenciales solo en `.env` (nunca en el repo). Se sube `.env.example`.
* Códigos HTTP: 200/201 ok · 400 validación · **401 sin sesión · 403 con sesión pero con otro rol** (mockup 1.7) y
  también cuenta bloqueada o inactiva · 404 no existe · 409 conflicto (correo ya registrado, invitación usada o vencida).
* En errores 400 de las APIs, `error` trae los mensajes por campo: `{ campo: mensaje }`.

---

## **4. Sesión: cómo funciona**

1. `GET /login` (EJS). El formulario hace `POST /login` con `email`, `password` y `recordar`.
2. `controllers.ingresar` llama a `services.login`:
   * correo o contraseña incorrectos → suma un intento; a los 5, bloqueo de 15 minutos;
   * cuenta `bloqueado` o `inactivo` → no entra.
   Si falla, vuelve a pintar `login.ejs` con `mensaje` (alerta roja).
3. Si es correcto guarda `req.session.userId`, `req.session.username` (correo) y `req.session.role`, y hace
   `req.session.save(() => res.redirect(rutaInicio(role)))`: usuario → `/usuario/tickets`,
   técnico → `/tecnico/bandeja`, supervisor → `/supervisor/cola`.
4. Cada ruta de un rol pasa por `soloLogueado` + `solo<Rol>` y renderiza `<rol>/home.ejs`, que carga
   `css/app.css` y `js/<rol>.js`. Sin sesión → `401.ejs` ("Debes iniciar sesión"); con sesión de otro rol → `403.ejs` con la sección a la que
   quiso entrar (calculada de `req.path`), el rol de la cuenta y botones "Ir a mi vista principal" / "Solicitar acceso".
   En las APIs con rol (`POST /api/v1/invitaciones`) el mismo caso responde 401 / 403 en JSON.
5. La mini-app arranca con `AuthProvider`: pide `GET /api/v1/sessions` y no se pinta hasta tener la respuesta.
   Si la sesión expiró vuelve a `/login`.
6. Registro (`POST /api/v1/registro`) y alta por invitación (`POST /api/v1/invitaciones/:token/aceptar`) dejan la
   sesión iniciada; la página redirige con `window.location` al panel del rol.
7. `GET /logout` destruye la sesión, borra la cookie `connect.sid` y redirige a `/login`. "Cerrar sesión" en la
   cabecera y en el menú es un `<a href="/logout">`.
8. `redireccionarSiLogueado` manda al panel a quien ya tiene sesión y entra a `/login` o `/registro`.

APIs de cuenta (`website/apis/cuenta_apis.js`):

| Método y ruta | Middleware | Uso |
| ------------- | ---------- | --- |
| `GET /api/v1/sessions` | soloLogueado | Usuario de la sesión (sin contraseña) |
| `GET /api/v1/unidades` | — | Unidades para el registro y "Mi cuenta" |
| `GET /api/v1/registro/disponible?email=` | — | Correo libre (validación en línea del registro) |
| `POST /api/v1/registro` | — | Crea la cuenta de usuario e inicia sesión |
| `GET /api/v1/invitaciones/:token` | — | Datos de la invitación |
| `POST /api/v1/invitaciones/:token/aceptar` | — | Activa la cuenta (técnico: 1 a 3 especialidades) e inicia sesión |
| `POST /api/v1/invitaciones/:token/rechazar` | — | Rechaza la invitación |
| `POST /api/v1/invitaciones` | soloSupervisor | Crea una invitación (HU-2 · Técnicos por categoría) |
| `POST /api/v1/recuperar` | — | Genera el enlace de recuperación (se muestra en pantalla, sin correo real) |
| `GET /api/v1/recuperar/:token` | — | Valida el enlace |
| `POST /api/v1/restablecer` | — | Guarda la nueva contraseña |
| `PUT /api/v1/cuenta` | soloLogueado | Actualiza los datos de "Mi cuenta" |
| `PUT /api/v1/cuenta/password` | soloLogueado | Cambia la contraseña |

---

## **5. Rutas**

### **EJS (sin React)**

* `/` landing (1.1) · `/login` (1.2) · `/logout` · `401` · `403` (1.7) · `404` (cualquier ruta desconocida)

### **Mini-app del visitante (`visitante.js`, sin sesión)**

* `/registro` (con `redireccionarSiLogueado`) · `/recuperar` · `/invitacion/:token`

### **Usuario (`usuario.js`)**

* `/usuario` → `/usuario/tickets` · `/usuario/tickets` · `/usuario/tickets/nuevo` · `/usuario/tickets/:codigo`
* `/usuario/tickets/:codigo/confirmacion` · `/usuario/mi-cuenta`

### **Técnico (`tecnico.js`)**

* `/tecnico` → `/tecnico/bandeja` · `/tecnico/bandeja` · `/tecnico/tickets/:codigo` · `/tecnico/tickets/:codigo/historial`
* `/tecnico/mi-cuenta`

### **Supervisor (`supervisor.js`)**

* `/supervisor` → `/supervisor/cola` · `/supervisor/cola` · `/supervisor/bandejas`
* `/supervisor/categorias` · `/supervisor/categorias/nueva` · `/supervisor/categorias/:id` · `/supervisor/ambientes`
* `/supervisor/tecnicos-categoria` · `/supervisor/tickets/:codigo` · `/supervisor/tickets/:codigo/historial`
* `/supervisor/mi-cuenta`

Cada app tiene su propia ruta `*` con `NoEncontrado` para los enlaces internos que no existan. Los enlaces dentro de
una app usan `Link`; los que saltan entre apps (landing → registro, registro → login, cerrar sesión) son `<a href>`.
El detalle y el historial del ticket del supervisor son las mismas páginas del técnico: sus enlaces salen del
prefijo del rol actual (`/${usuario.rol}`).

### **Pruebas de acceso**

| Caso | Resultado esperado |
| ---- | ------------------ |
| Sin sesión: `/usuario/tickets`, `/tecnico/bandeja`, `/supervisor/cola` | 401 "Debes iniciar sesión" |
| Usuario → `/supervisor/cola` | 403 "No tienes permiso para ver la cola de atención" |
| Técnico → `/supervisor/categorias` · supervisor → `/usuario/tickets` (y cruzando los demás roles) | 403 con la sección correspondiente |
| Cada rol en sus propias rutas | 200 |
| `POST /api/v1/invitaciones` sin sesión / con otro rol | 401 / 403 en JSON |
| Login correcto | Redirige a la vista inicial de su rol |
| Login incorrecto | `login` con alerta roja |
| 5 intentos fallidos | Mensaje de bloqueo por 15 minutos |
| `psalcedo@ulima.edu.pe` | Cuenta bloqueada |
| Logueado → `/login` | Vuelve a su panel |
| `/logout` | Destruye la sesión y va a `/login` |
| F5 en cualquier ruta interna de cada rol | Sigue mostrando la página |
| Registro nuevo / `/invitacion/inv-tec-7f3a9c` | Entra como usuario / técnico |
| Recuperar contraseña | El enlace en pantalla funciona y la nueva contraseña sirve para el login |

---

## **6. Entrega 1 → Entrega 2**

### **Entrega 1 (semana 9):**

* Cuenta y sesión: servidor (`website/`), datos en memoria cargados de `seed.json`.
* Tickets, catálogo, cola y atención: `src/services/*.service.js` leen `seed.json` y guardan en `localStorage`.
  Exponen funciones `async` aunque el dato sea local. El usuario de la sesión se copia al `localStorage` para que
  las cuentas nuevas también se vean en esas vistas.

### **Entrega 2 (semana 15):**

* `website/repositories/cuenta_repositories.js` pasa a consultar Supabase (contraseñas con hash).
* Mismas funciones en los services del front, pero con `apiGet/apiPost` de `src/services/api.client.js`.
* Interruptor: `VITE_USE_MOCK=true|false`.

Build de Vite (`vite.config.js`):

* `css/app.css` y `js/app.js`: lo común (librerías, Bootstrap, `src/entries/app.css`, context, services, helpers y widgets).
* `js/atencion.js`: detalle e historial del ticket, compartidos por técnico y supervisor.
* `js/<rol>.js` + `css/<rol>.css` (visitante, usuario, tecnico, supervisor): páginas, parciales y CSS propio de cada app
  (importan solos `app.js` y `atencion.js`).

---

## **7. Contrato de datos**

### **usuario**

`id`, `nombres`, `apellidos`, `email`, `password` *(solo seed; en BD `passwordHash`)*, `telefono`, `unidad`, `vinculo`, `rol` (`usuario|tecnico|supervisor`), `estado` (`activo|inactivo|bloqueado`), `motivoBloqueo`, `especialidades[]` (ids de categoría), `ambienteHabitualId`, `creadoEn`, `ultimoAcceso`

### **categoria**

(con `parentId` nulo = categoría; con valor = subcategoría): `id`, `nombre`, `parentId`, `prioridadDefecto` (`critica|alta|media|baja`), `tiempoEsperadoHoras`, `descripcion` (máx. 240), `activa`

### **ambiente**

`id`, `codigo` (A-201), `tipo`, `pabellon`, `piso`, `sede`, `capacidad`

### **tecnico_categoria**

`tecnicoId`, `categoriaId`

### **ticket**

`id`, `codigo` (`TCK-2026-00147`), `asunto`, `descripcion` (máx. 600), `categoriaId`, `subcategoriaId`, `ambienteId`, `solicitanteId`, `tecnicoId|null`, `prioridad`, `prioridadSugerida`, `estado`, `creadoEn`, `venceEn`, `cerradoEn`, `solucion`, `motivoEspera`, `fechaRetorno`

### **bitacora_entrada**

`id`, `ticketId`, `autorId`, `tipo` (`publico|interno`), `texto`, `creadoEn`

### **historial_estado**

`id`, `ticketId`, `estadoAnterior`, `estadoNuevo`, `autorId`, `motivo`, `creadoEn`

### **asignacion**

`id`, `ticketId`, `tecnicoId`, `asignadoPorId`, `motivo`, `nota`, `creadoEn`

### **cambio_prioridad**

`id`, `ticketId`, `anterior`, `nueva`, `motivo`, `autorId`, `creadoEn`

Transiciones de estado (HU-5): `abierto → en_atencion` · `en_atencion → en_espera | resuelto` · `en_espera → en_atencion` · `resuelto → cerrado` · `cerrado → reabierto` (≤ 7 días) · `reabierto → en_atencion`. "Asignado" es un **evento** (tabla `asignacion`), no un estado.

## **8. Git**

* Un repositorio, rama por integrante o por cambio (`feature/hu1-<nombre>`, `refactor/roles-sesion`).
* Integración con pull request revisado por otro integrante. La rama por defecto de la plantilla es `master`.
* Commits pequeños y con mensaje claro (`feat(hu3): formulario de nuevo ticket`). El historial cuenta para la nota individual.
* Los `src/widgets` comunes solo se modifican con PR aprobado por todos.

---

## **9. Observaciones al leer el Word y el PDF**

1. **Tiempos esperados inconsistentes en los mockups.** La leyenda dice Crítica 2 h · Alta 8 h · Media 24 h · Baja 72 h, pero la tabla 2.1 muestra otros valores. HU-2 fija el criterio en el contrato.
2. Adjuntos fuera de alcance: "Evidencia (opcional)" (3.1) y "Adjuntar foto" (5.2) se dejan fuera.
3. Sin mockup: cancelación de ticket propio (HU-3), autoasignación del técnico y reasignación (HU-4). Se diseñaron con los mismos patrones (modal de confirmación).
4. Correos fuera de alcance: la invitación (1.4) y la recuperación de contraseña (1.5) muestran el enlace en pantalla.
5. Equipo de 5: se desarrollan HU-1 a HU-5; Encuestas, Tablero, Carga y Usuarios no existen en el menú. El supervisor aterriza en la cola.
6. Estado "Reabierto" se maneja como estado propio.
7. Entrega 1: semana 9 · Entrega final: semana 15.
