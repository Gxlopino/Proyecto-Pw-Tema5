# **Arquitectura — Mesa de ayuda de servicios del campus (Tema 5\)**

Programación Web 2026-2 · Universidad de Lima
Base: plantilla del curso (React \+ Vite · Node \+ Express · Supabase · Vercel).
-----------------------------------------------------------------------------------

## **1\. Decisiones clave**

| \# | Decisión                                                                                                                                                                      | Por qué                                                                                |
| :- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------- |
| 1  | Se mantiene**la misma estructura de carpetas de la plantilla** (admin, api, configs, db, docs, prompts, public, src, views, website). No se crean carpetas raíz nuevas. | Es lo que se ve en clase y lo que pide el docente.                                      |
| 2  | code:website/\= backend de **Visitante \+ Usuario**. code:admin/ \= backend de **Técnico \+ Supervisor**.                                                         | Encaja con "sitio web" vs "panel administrativo" de la plantilla.                       |
| 3  | Backend en**capas**: code:routes → controllers → services → repositories → Supabase.                                                                                 | Requisito del docente: sin acceso a datos en controladores ni consultas en componentes. |
| 4  | Cada archivo pertenece a**una sola HU** (el nombre del archivo lo deja claro).                                                                                           | "Nadie escribe sobre las entidades de otro" → casi cero conflictos de merge.           |
| 5  | **Una sola fuente de datos de prueba**: code:db/seed/seed.json. El front la consume en la Entrega 1; en la Entrega 2 se carga a Supabase.                                | Pide el docente: mismo JSON en ambas entregas.                                          |
| 6  | El front nunca llama a code:fetch ni lee el JSON dentro de los componentes: usa code:src/services/\*. En la Entrega 2 solo se cambia la implementación de los services.       | Entrega 1 → Entrega 2 sin reescribir pantallas.                                        |
| 7  | Rutas del front separadas por rol: code:/usuario/\*, code:/tecnico/\*, code:/supervisor/\*.                                                                                    | Facilita proteger rutas por rol (HU-1) y entender el árbol.                            |

---

## **2\. Estructura de carpetas**

```
Proyecto-Pw-Tema5/
├── admin/                     ← backend Técnico + Supervisor
│   ├── apis/                    categorias_apis.js, ambientes_apis.js, tecnico_categorias_apis.js, cola_apis.js, atencion_apis.js, satisfaccion_apis.js, metricas_apis.js, usuarios_apis.js
│   ├── configs/                 routes.js
│   ├── controllers/             (controladores separados por cada HU mencionada arriba)
│   ├── models/                  categoria.js, ambiente.js, tecnico_categoria.js, asignacion.js, cambio_prioridad.js, bitacora_entrada.js, historial_estado.js[cite: 5]
│   ├── repositories/            (repositorios separados por cada HU)[cite: 5]
│   └── services/                (servicios con reglas de negocio separados por cada HU)[cite: 5]
├── api/
│   └── index.js               ← entrada serverless de Vercel (exporta la app Express)
├── configs/
│   ├── bootstrap.js, database.js, helpers.js, middlewares.js
├── db/
│   ├── schema.sql
│   ├── seed/
│   │   └── seed.json            ← fuente compartida de datos semilla para Entrega 1 y 2[cite: 5]
│   └── migrations/              ← migraciones por HU (reemplazan a las de la plantilla)[cite: 5]
│       ├── 001_hu1_usuarios.sql[cite: 5]
│       ├── 002_hu2_catalogo.sql[cite: 5]
│       ├── 003_hu3_tickets.sql[cite: 5]
│       ├── 004_hu4_cola.sql[cite: 5]
│       ├── 005_hu5_atencion.sql[cite: 5]
│       ├── 006_hu6_encuestas.sql[cite: 5]
│       └── 007_hu7_metricas.sql[cite: 5]
├── docs/
│   └── Arquitectura.md, database.puml, estructura.txt, Proyecto_PW_2026-2_Tema5_Mesa_de_Ayuda.docx, Tema5_Mockups_f.pdf
├── prompts/               
├── public/                
│   ├── favicon.ico
│   └── assets/img/          
├── src/                       ← React
│   ├── context/                 AuthContext.jsx, NotificationContext.jsx (para sesión global)[cite: 5]
│   ├── routes/                  AppRouter.jsx, ProtectedRoute.jsx (para proteger rutas según rol)[cite: 5]
│   ├── services/                api.client.js, tickets.service.js, auth.service.js, etc. (consumen seed.json o fetch)[cite: 5]
│   ├── assets/                  hero.png, react.svg, vite.svg
│   ├── entries/                 admin.jsx, web.jsx, admin.css, web.css
│   ├── helpers/                 datetime.js, random.js, navigation.js (para ocultar HU_ACTIVAS)[cite: 5]
│   ├── pages/                   ← Páginas organizadas por HU (reemplazan a DashboardPage, PlayersPage, etc.)[cite: 5]
│   │   ├── hu1-cuenta/          Landing.jsx, Login.jsx, Registro.jsx, AltaInvitacion.jsx, RecuperarPassword.jsx, MiCuenta.jsx, AccesoDenegado.jsx, NoEncontrado.jsx[cite: 5]
│   │   ├── hu2-catalogo/        Categorias.jsx, CategoriaForm.jsx, Ambientes.jsx, TecnicosPorCategoria.jsx[cite: 5]
│   │   ├── hu3-tickets/         NuevoTicket.jsx, ConfirmacionTicket.jsx, MisTickets.jsx, DetalleTicketUsuario.jsx[cite: 5]
│   │   ├── hu4-cola/            ColaAtencion.jsx, BandejaTecnico.jsx, BandejasTecnicos.jsx[cite: 5]
│   │   ├── hu5-atencion/        DetalleTicketTecnico.jsx, HistorialCambios.jsx[cite: 5]
│   │   ├── hu6-encuestas/       Encuesta.jsx, MisEncuestas.jsx, Satisfaccion.jsx[cite: 5]
│   │   └── hu7-metricas/        Tablero.jsx, CargaTecnicos.jsx, Usuarios.jsx, FichaUsuario.jsx[cite: 5]
│   ├── partials/                Navbar.jsx, Sidebar.jsx, Footer.jsx[cite: 5]
│   └── widgets/                 Modal.jsx, ConfirmDialog.jsx, EmptyState.jsx, Toast.jsx, Bitacora.jsx, TicketCard.jsx (módulo común del grupo)[cite: 5]
├── views/                     ← plantillas EJS
│   ├── 401.ejs, 404.ejs
│   ├── admin/                   home.ejs
│   ├── layouts/                 admin.ejs, website.ejs
│   ├── partials/                _flash_message.ejs, _footer.ejs, _navbar.ejs
│   └── website/                 home.ejs, about.ejs, sign-in.ejs...
├── website/                   ← backend Visitante + Usuario[cite: 5]
│   ├── apis/                    auth_apis.js, cuenta_apis.js, tickets_apis.js, encuestas_apis.js (desplegar en carpetas igual que admin)[cite: 5]
│   ├── configs/                 routes.js
│   ├── controllers/             (controladores por HU)[cite: 5]
│   ├── models/                  usuario.js, ticket.js, encuesta.js[cite: 5]
│   ├── repositories/            (repositorios por HU)[cite: 5]
│   └── services/                (servicios por HU)[cite: 5]
├── .gitignore  .vercelignore
├── package.json  package-lock.json
└── README.md  server.js  vercel.json  vite.config.js
```

---

## **3\. Reglas de capas (backend)**

| Capa              | Hace                                                                  | NO hace                           |
| :---------------- | :-------------------------------------------------------------------- | :-------------------------------- |
| code:routes       | Declara endpoint\+ middlewares (code:auth, code:roles, code:validate) | Lógica                           |
| code:controllers  | Lee code:req, llama al service, responde con código HTTP correcto    | Consultas a BD, reglas de negocio |
| code:services     | Reglas de negocio (transiciones de estado, plazos, validaciones)      | Tocar code:req/res                |
| code:repositories | Única capa que habla con Supabase                                    | Reglas de negocio                 |

Reglas extra:

* Las validaciones del front se repiten en el servidor.
* Contraseñas con code:bcryptjs. Sesión con JWT.
* Credenciales solo en code:.env (nunca en el repo). Se sube code:.env.example.
* Códigos HTTP: 200/201 ok · 400 validación · 401 sin sesión · 403 rol incorrecto · 404 no existe · 409 conflicto (ticket duplicado, transición inválida).
* Un repository puede ser importado para leer por otra HU, nunca para escribir en entidades ajenas.

Prefijos de API:

* code:website/ → code:/api/website/...
* code:admin/ → code:/api/admin/...

---

## **4\. Mapa HU → archivos**

| HU                                                     | Entidades que posee                                       | Páginas (code:src/pages)                                                                           | Back                                                  | Migración |
| :----------------------------------------------------- | :-------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- | :---------------------------------------------------- | :--------- |
| **HU-1** Cuenta y acceso                         | usuario, invitación                                      | Landing, Login, Registro, AltaInvitacion, RecuperarPassword, MiCuenta, AccesoDenegado, NoEncontrado | code:website: auth, cuenta                            | 001        |
| **HU-2** Catálogo                               | categoría, subcategoría, ambiente, técnico\_categoría | Categorias, CategoriaForm, Ambientes, TecnicosPorCategoria                                          | code:admin: categorias, ambientes, tecnico-categorias | 002        |
| **HU-3** Registro de tickets                     | ticket                                                    | NuevoTicket, ConfirmacionTicket, MisTickets, DetalleTicketUsuario                                   | code:website: tickets                                 | 003        |
| **HU-4** Cola y asignación                      | asignación, cambio\_prioridad                            | ColaAtencion, BandejaTecnico, BandejasTecnicos                                                      | code:admin: cola                                      | 004        |
| **HU-5** Atención y cierre                      | bitácora\_entrada, historial\_estado                     | DetalleTicketTecnico, HistorialCambios                                                              | code:admin: atencion                                  | 005        |
| **HU-6** Encuestas *(equipo de 6\)*            | encuesta                                                  | Encuesta, MisEncuestas, Satisfaccion                                                                | code:website: encuestas · code:admin: satisfaccion   | 006        |
| **HU-7** Métricas y usuarios *(equipo de 7\)* | solo lectura\+ bloqueo                                    | Tablero, CargaTecnicos, Usuarios, FichaUsuario                                                      | code:admin: metricas, usuarios                        | 007        |

Excepción conocida: HU-7 bloquea cuentas (escribe code:estado y code:motivoBloqueo en usuario, que es de HU-1). Se resuelve con un único método code:usuarios.repository.cambiarEstado() escrito por HU-1 y usado por HU-7.
------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## **5\. Rutas del front**

### **Públicas (PublicLayout):**

* code:/
* code:/login
* code:/registro
* code:/invitacion/:token
* code:/recuperar
* code:/403
* code:\* (404)

### **Autenticado, todos los roles:**

* code:/mi-cuenta

### **Usuario:**

* code:/usuario/tickets/nuevo
* code:/usuario/tickets/:codigo/confirmacion
* code:/usuario/tickets
* code:/usuario/tickets/:codigo
* code:/usuario/encuesta/:codigo
* code:/usuario/encuestas

### **Técnico:**

* code:/tecnico/bandeja
* code:/tecnico/tickets/:codigo
* code:/tecnico/tickets/:codigo/historial

### **Supervisor:**

* code:/supervisor/categorias
* code:/supervisor/categorias/nueva
* code:/supervisor/categorias/:id
* code:/supervisor/ambientes
* code:/supervisor/tecnicos-categoria
* code:/supervisor/cola
* code:/supervisor/bandejas
* code:/supervisor/tickets/:codigo
* code:/supervisor/tickets/:codigo/historial
* code:/supervisor/satisfaccion
* code:/supervisor/tablero
* code:/supervisor/carga
* code:/supervisor/usuarios
* code:/supervisor/usuarios/:id
* Redirección tras login (HU-1): usuario → code:/usuario/tickets
* técnico → code:/tecnico/bandeja
* supervisor → code:/supervisor/tablero si existe HU-7, si no code:/supervisor/cola.

El menú lateral oculta automáticamente las HU que no se desarrollan (code:HU\_ACTIVAS en code:src/helpers/navigation.js).
---------------------------------------------------------------------------------------------------------------------------

## **6\. Entrega 1 → Entrega 2**

### **Entrega 1 (semana 9, solo interfaz):**

* code:src/services/\*.service.js lee code:db/seed/seed.json y mantiene el estado en memoria (opcional: code:sessionStorage).
* Cada service expone funciones code:async (devuelven Promesas) aunque el dato sea local.

### **Entrega 2 (semana 15):**

* Mismas funciones, pero con code:fetch('/api/...') vía code:src/services/api.client.js.
* El code:seed.json se carga en Supabase con un script (hasheando las contraseñas).
* Interruptor: code:VITE\_USE\_MOCK=true|false.

Ejemplo de service:

```js
// src/services/tickets.service.js
import seed from '@seed/seed.json';
import { apiGet } from './api.client';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';
let tickets = structuredClone(seed.tickets);

export async function listarMisTickets(usuarioId) {
  if (USE_MOCK) return tickets.filter(t => t.solicitanteId === usuarioId);
  return apiGet(`/api/website/tickets?mios=true`);
}
```

Alias necesarios en code:vite.config.js:

```js
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

resolve: {
  alias: {
    '@': path.resolve(__dirname, 'src'),
    '@seed': path.resolve(__dirname, 'db/seed'),
  },
},
```

---

## **7\. Contrato de datos (borrador para acordar en grupo)**

### **usuario**:

code:id, code:nombres, code:apellidos, code:email, code:password *(solo seed; en BD code:passwordHash)*, code:telefono, code:unidad, code:vinculo, code:rol (code:usuario|tecnico|supervisor), code:estado (code:activo|inactivo|bloqueado), code:motivoBloqueo, code:especialidades\[\] (ids de categoría), code:ambienteHabitualId, code:creadoEn, code:ultimoAcceso

### **categoria**

(con code:parentId nulo \= categoría; con valor \= subcategoría): code:id, code:nombre, code:parentId, code:prioridadDefecto (code:critica|alta|media|baja), code:tiempoEsperadoHoras, code:descripcion (máx. 240), code:activa

### **ambiente**:

code:id, code:codigo (A-201), code:tipo, code:pabellon, code:piso, code:sede, code:capacidad

### **tecnico\_categoria**:

code:tecnicoId, code:categoriaId

### **ticket**:

code:id, code:codigo (code:TCK-2026-00147), code:asunto, code:descripcion (máx. 600), code:categoriaId, code:subcategoriaId, code:ambienteId, code:solicitanteId, code:tecnicoId|null, code:prioridad, code:prioridadSugerida, code:estado, code:creadoEn, code:venceEn, code:cerradoEn, code:solucion, code:motivoEspera, code:fechaRetorno

### **bitacora\_entrada**:

code:id, code:ticketId, code:autorId, code:tipo (code:publico|interno), code:texto, code:creadoEn

### **historial\_estado**:

code:id, code:ticketId, code:estadoAnterior, code:estadoNuevo, code:autorId, code:motivo, code:creadoEn

### **asignacion**:

code:id, code:ticketId, code:tecnicoId, code:asignadoPorId, code:motivo, code:nota, code:creadoEn

### **cambio_prioridad**:

code:id, code:ticketId, code:anterior, code:nueva, code:motivo, code:autorId, code:creadoEn

### **encuesta**:

code:id, code:ticketId *(único)*, code:usuarioId, code:puntaje, code:rapidez, code:trato, code:solucion, code:comentario, code:creadoEn, code:editableHasta
Transiciones de estado propuestas (HU-5): code:abierto → en\_atencion · code:en\_atencion → en\_espera | resuelto · code:en\_espera → en\_atencion · code:resuelto → cerrado · code:cerrado → reabierto (≤ 7 días) · code:reabierto → en\_atencion. "Asignado" es un **evento** (tabla code:asignacion), no un estado.

## **8\. Git**

* Un repositorio, rama por integrante: code:feature/hu1-\&lt;nombre\&gt;, code:feature/hu2-\&lt;nombre\&gt;, etc.
* Integración con pull request revisado por otro integrante. La rama por defecto de la plantilla es code:master.
* Commits pequeños y con mensaje claro (code:feat(hu3): formulario de nuevo ticket). El historial cuenta para la nota individual.
* El módulo code:components/common/ solo se modifica con PR aprobado por todos.

---

## **9\. Observaciones al leer el Word y el PDF**

1. **Tiempos esperados inconsistentes en los mockups.**
   1. La leyenda dice Crítica 2 h · Alta 8 h · Media 24 h · Baja 72 h, pero la tabla 2.1 muestra Media 8 h, Media 12 h, Baja 24 h y 48 h. Hay que fijar un criterio único en el contrato (HU-2 lo define).
2. Adjuntos fuera de alcance. El Word excluye "carga de archivos adjuntos", pero los mockups muestran "Evidencia (opcional)" (3.1) y "Adjuntar foto" (5.2). Sugiero dejarlos solo como UI deshabilitada u omitirlos; confirmar con el docente.
3. Sin mockup: cancelación de ticket propio (HU-3), autoasignación del técnico y reasignación (HU-4). Diseñarlos con los mismos patrones (modal de confirmación).
4. Correos fuera de alcance. La invitación de técnico/supervisor (1.4) y la recuperación de contraseña (1.5) no envían correo real: mostrar el enlace/token en pantalla.
5. Equipo de 5\. Se desarrollan HU-1 a HU-5; Encuestas, Tablero, Carga y Usuarios quedan ocultos del menú. El supervisor aterriza en la cola.
6. Estado "Reabierto" aparece en el sistema de diseño pero no en la lista de estados del Word; decidir si es estado propio o vuelve a code:abierto.
7. Entrega 1: semana 9 · Entrega final: semana 15 · Asignación de HU al docente: semana 4 (no se puede cambiar).

---

## **10\. Orden de arranque sugerido**

1. Un integrante ejecuta code:scaffold.sh, hace commit en code:master y avisa al grupo.
2. Todos hacen code:git pull y crean su rama code:feature/hu\#-nombre.
3. Grupo acuerda code:docs/contrato-datos.md y arma code:db/seed/seed.json con casos límite.
4. Grupo implementa code:components/common/ (Header, Sidebar, Footer, badges, Modal, ConfirmDialog, EmptyState, Toast, Bitácora, TicketCard).
5. HU-1 entrega primero code:AuthContext \+ code:ProtectedRoute (los demás dependen de eso).
6. Cada HU construye sus páginas contra code:seed.json vía code:src/services.
