# StudentHub · Student Management System

Sistema administrativo de gestión estudiantil desarrollado como proyecto académico de **Cloud Computing, Hito 1**. Integra un frontend React, una API Express y persistencia MongoDB, con separación de roles y trazabilidad de operaciones.

Esta publicación contiene código, pruebas y configuración de ejemplo. No publica una demo, direcciones de producción, credenciales ni datos del despliegue. Las instrucciones siguientes son exclusivamente para un entorno local independiente.

## Funcionalidades y alcance

- **Estudiantes:** crear, consultar, editar y eliminar; búsqueda, filtros y asociación con una carrera y nivel académico.
- **Carreras:** crear, editar, activar e inactivar; duración configurable en años o semestres y validación de asignaciones.
- **Usuarios:** creación de cuentas, edición de nombre/rol/estado y restablecimiento asistido de contraseña.
- **Acceso:** login/logout, sesión JWT y cambio obligatorio tras un restablecimiento temporal.
- **Auditoría:** registro de accesos, denegaciones y operaciones administrativas; consulta filtrada para administradores.
- **Interfaz:** diseño adaptable, navegación por teclado, notificaciones y estados de carga/error.

El alcance es administrativo: no incluye matrícula financiera, calificaciones, asistencia ni autoservicio estudiantil. Las carreras y cuentas se inactivan; no tienen eliminación física mediante la API.

## Arquitectura

```text
Navegador
   | HTTPS
   v
VM Azure IaaS · Ubuntu ARM64
   Nginx
     |-- /       -> frontend React/Vite compilado
     `-- /api/   -> Express en loopback, gestionado por systemd
                            | TLS
                            v
                      MongoDB Atlas
```

La arquitectura académica utiliza una sola VM. Atlas es un servicio externo; no se presupone una conexión privada, alta disponibilidad ni MongoDB instalado en la VM. La renovación TLS se realiza con Certbot y un hook que valida Nginx antes de recargarlo.

En desarrollo, Vite sirve el cliente y redirige `/api` a `127.0.0.1:5000`. El navegador no recibe credenciales de base de datos.

## Tecnologías

| Capa | Tecnologías |
|---|---|
| Cliente | React 19, Vite 8, React Router, Axios, Lucide React, CSS |
| API | Node.js, Express 5, Mongoose 9, Zod |
| Seguridad | Argon2id, JSON Web Tokens, cookies HttpOnly, Helmet, express-rate-limit |
| Persistencia | MongoDB con replica set; MongoDB Atlas en la arquitectura desplegada |
| Infraestructura | Azure IaaS, Ubuntu, Nginx, systemd, Let's Encrypt/Certbot |
| Pruebas | node:test, Supertest, mongodb-memory-server, Vitest, Testing Library, Playwright |

Las versiones exactas están fijadas en los lockfiles de `server/` y `client/`.

## Roles

| Operación | Administrador | Coordinador |
|---|:---:|:---:|
| Consultar estudiantes y catálogo de carreras | Sí | Sí |
| Crear/editar estudiantes | Sí | Sí |
| Eliminar estudiantes | Sí | No |
| Crear/editar/inactivar carreras | Sí | No |
| Gestionar cuentas y consultar auditoría | Sí | No |

Las páginas administrativas también están restringidas en la interfaz. La autorización efectiva se comprueba en la API; ocultar un botón no sustituye esa comprobación. Estos roles no equivalen a roles de Azure IAM.

## Requisitos locales

- Node.js **24 LTS** y npm. Alternativa: Node.js 22.13 o posterior de esa línea, mínimo compatible también con el linter fijado.
- Git y dos terminales.
- MongoDB con **replica set**, necesario para las transacciones. Para la alternativa siguiente, Docker Engine o Docker Desktop en modo contenedores Linux.
- Chromium de Playwright, solo para las pruebas de navegador.

No utilices una URI ni una copia de datos de producción para desarrollar o probar.

## Instalación local

### 1. Preparar MongoDB independiente

Desde una terminal, crea un contenedor y volumen exclusivos de desarrollo. El puerto se publica solo en loopback:

```sh
docker volume create studenthub-mongo-dev
docker run --detach --name studenthub-mongo-dev --publish 127.0.0.1:27017:27017 --mount source=studenthub-mongo-dev,target=/data/db mongo:8.0 --replSet rs0 --bind_ip_all
```

Espera a que MongoDB acepte conexiones. Inicializa el replica set **una sola vez**:

```sh
docker exec studenthub-mongo-dev mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
docker exec studenthub-mongo-dev mongosh --quiet --eval "db.hello().isWritablePrimary"
```

La última consulta debe devolver `true`; si todavía hay una elección en curso, repite solo esa consulta. Si el contenedor ya existe, revísalo y usa `docker start studenthub-mongo-dev` cuando corresponda: no lo borres ni reinicialices a ciegas. El volumen conserva los datos locales entre ejecuciones.

Esta configuración sin autenticación es únicamente de desarrollo, ligada a loopback; no debe reutilizarse como configuración pública. También puedes usar un replica set ya existente con una base propia de desarrollo.

### 2. Configurar el backend

Desde la raíz de una copia del repositorio:

```sh
node -e "require('node:fs').copyFileSync('server/.env.example','server/.env',require('node:fs').constants.COPYFILE_EXCL)"
cd server
npm ci --include=dev --include=optional --ignore-scripts
```

El comando de copia funciona en Bash y PowerShell y se detiene si `server/.env` ya existe; no sobrescribas una configuración propia para repetir la instalación.

Edita `server/.env` privadamente. Conserva la URI local del ejemplo y sustituye `JWT_SECRET` por un secreto nuevo de al menos 32 caracteres. Puedes generar uno en tu terminal privada:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

No compartas su salida ni la incorpores a Git. El placeholder del ejemplo se rechaza deliberadamente al arrancar.

### 3. Crear el administrador local y arrancar la API

Desde `server/`, con el replica set disponible:

```sh
npm run create-admin
npm run dev
```

El bootstrap requiere una terminal interactiva, solicita una contraseña oculta de 12 a 128 caracteres y no sobrescribe una cuenta con el mismo correo. Si ya existe un administrador activo, no crea otro. Este paso escribe en **tu base local**; no lo ejecutes con configuración de producción.

La API escucha en `127.0.0.1:5000`. No existe registro público ni se distribuyen credenciales predeterminadas de acceso.

### 4. Arrancar el frontend

En otra terminal, desde la raíz:

```sh
cd client
npm ci --include=dev --include=optional --ignore-scripts
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con la cuenta local recién creada. No necesitas instalar dependencias desde la raíz ni crear un `.env` del cliente para esta configuración.

Los comandos de instalación bloquean lifecycle scripts. Si una dependencia nativa no carga en tu plataforma, detente y revisa el error; no apruebes scripts globalmente ni cambies automáticamente el lockfile.

## Variables de entorno

| Variable | Desarrollo local |
|---|---|
| `MONGODB_URI` | Base independiente en replica set `rs0`; ejemplo en `server/.env.example` |
| `JWT_SECRET` | Secreto nuevo, nunca versionado |
| `JWT_EXPIRES_IN` | `15m` |
| `HOST` / `PORT` | `127.0.0.1` / `5000` |
| `NODE_ENV` | `development` |
| `APP_ORIGIN` | `http://localhost:5173`, sin barra final |
| `COOKIE_SECURE` | `false` únicamente para HTTP local |
| `TRUST_PROXY` | `false` sin proxy de confianza |

`deploy/server.env.example` es una plantilla genérica para un entorno HTTPS, no un archivo listo para ejecutar. Sustituye todos los valores de ejemplo en un archivo protegido fuera de Git. En un despliegue público, usar HTTPS, cookies Secure y secretos exclusivos; `loopback` solo corresponde a un proxy local confiable que sobrescribe las cabeceras reenviadas. No colocar URI, claves o contraseñas en variables `VITE_*`.

## Seguridad implementada

- Hash de contraseñas con Argon2id; no se retornan hashes en respuestas de usuario.
- JWT en cookie `HttpOnly`, `SameSite=Strict` y `Path=/api`; `Secure` obligatorio en producción. La cookie es de sesión y el JWT tiene su propia expiración, sin renovación automática.
- Token CSRF vinculado a la sesión, mantenido en memoria del cliente y enviado en `X-CSRF-Token` para mutaciones.
- Verificación exacta de `Origin`, autenticación, autorización por rol y validación Zod en el servidor.
- Límites de intentos en operaciones de autenticación sensibles y mensajes de error controlados.
- Actualización transaccional de datos y auditoría en las operaciones administrativas revisadas.
- Auditoría append-only a través de la aplicación; no equivale a inmutabilidad frente a un administrador de base de datos.
- Cuenta de servicio no privilegiada y entorno protegido en la arquitectura desplegada; Express no se expone directamente a Internet.

## Pruebas

Ejecuta las suites secuencialmente. No configures el runner con direcciones públicas ni bases reales.

```sh
# Desde server/
npm test

# Desde client/
npm test
npm run lint
npm run build
npx playwright install chromium
npm run test:e2e
```

Las suites backend y E2E usan `MongoMemoryReplSet` con bases temporales y datos ficticios. El harness E2E no carga `.env` ni utiliza Atlas; requiere libres los puertos locales 5100 y 5180. Puede descargar el binario de MongoDB al primer uso. Las capturas/resultados generados no se publican. Vite/Rolldown y Argon2 necesitan binarios compatibles con la plataforma; no copies `node_modules` entre Windows, Linux o arquitecturas distintas.

### Resultados locales de esta preparación

Ejecución del 7 de noviembre de 2026 en Windows, con Node.js 24.13.0 y npm 11.6.2, conservando los lockfiles y sin usar una base de producción:

| Comprobación | Resultado |
|---|---|
| API e integración, `npm test` en server | 42/42 aprobadas |
| Componentes, `npm test` en client | 32/32 aprobadas, 4 archivos |
| ESLint | Sin errores |
| Build Vite 8.3.5 | Correcto |
| Playwright/Chromium | 7/7 aprobadas |

Las pruebas backend incluyen RBAC, CSRF, transacciones y auditoría con fallos controlados **en bases temporales**, no en Atlas. El procedimiento Docker de instalación local está documentado, pero no se ejecutó en esta revisión porque el daemon Docker no estaba disponible.

### Evidencia y alcance

- **Automatización local:** resultados de la tabla anterior; los comandos indicados permiten repetir las suites en un entorno aislado. No equivalen a aceptación completa de la infraestructura pública.
- **Comprobación directa del despliegue académico:** HTTPS, redirección HTTP, rechazo de acceso anónimo, errores de formato y exclusión de archivos privados. No se publica su dirección.
- **Pruebas manuales reportadas:** login/logout, atributos de cookie, expiración, CSRF ausente/incorrecto, lecturas administrativas y creación/edición persistente de entidades con ambos roles.
- **Pendientes de cierre independiente:** DELETE denegado con sesión real de coordinador y lectura de su auditoría, contraste actual de registros en Atlas y recuperación efectiva tras reinicio. No se afirma eliminación real de registros ni limpieza: se conservaron los datos existentes.

## Limitaciones conocidas

- Una sola VM no ofrece alta disponibilidad; el reinicio automático del backend y la prueba de reboot requieren validación operativa separada.
- Logout borra la cookie del navegador, pero no revoca por sí solo una copia del JWT. Cambiar/restablecer contraseña sí incrementa la versión de sesión.
- El endpoint de logout no es idempotente: solicitudes válidas independientes pueden producir varios eventos. Se observaron dos eventos separados; su origen no se atribuyó definitivamente ni se confirmó una falla.
- Algunas reglas semánticas pueden incrementar revisiones internas antes de retornar 400/409. Un rechazo HTTP no garantiza ausencia de toda escritura; no usar esas solicitudes como pruebas de solo lectura.
- No hay recuperación automática por correo. El restablecimiento es asistido por un administrador autorizado; no se envían contraseñas por email.
- `maintenance:accounts` y `migrate:academic` son herramientas de mantenimiento de desarrollo que pueden alterar o eliminar datos con `--apply`; no son pasos de instalación ni de prueba de producción.
- Las credenciales ficticias presentes en tests pertenecen solo a los harnesses temporales; no constituyen acceso a ningún despliegue.
- El procedimiento Docker de desarrollo debe comprobarse en el equipo del lector; su disponibilidad no implica que se haya validado la recuperación de una VM pública.

## Contenido de la publicación

Se incluyen fuentes, pruebas, lockfiles y plantillas sin secretos. Se excluyen entornos reales, dependencias instaladas, builds, logs, respaldos, certificados, capturas, informes y planes internos. `.gitignore` previene altas accidentales, pero no elimina archivos ya versionados ni secretos del historial: revisa ambos antes de publicar cambios.

No conectes las pruebas a producción ni uses el proyecto como justificación para publicar datos personales. Los datos y recursos existentes del despliegue académico no se modifican como parte de esta preparación.
