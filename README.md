# StudentHub · Student Management System

StudentHub es una aplicación web de gestión estudiantil desarrollada como proyecto académico de **Cloud Computing, Hito 1**. Fue desplegada en **Microsoft Azure bajo el modelo Infrastructure as a Service (IaaS)**, integrando una interfaz React, una API REST con Node.js y Express, y MongoDB Atlas para la persistencia de información.

El proyecto reúne desarrollo full-stack, administración de una máquina virtual Linux, configuración de un proxy inverso con HTTPS y controles de acceso para los perfiles de administrador y coordinador académico.

## Funcionalidades principales

- **Gestión de estudiantes:** creación, consulta, edición y eliminación, con búsqueda, filtros y asociación a una carrera y nivel académico.
- **Catálogo de carreras:** creación, edición, activación e inactivación; duración configurable en años o semestres y validación de asignaciones.
- **Administración de usuarios:** creación de cuentas, actualización de nombre, rol y estado, y restablecimiento asistido de contraseña.
- **Autenticación y autorización:** inicio y cierre de sesión, permisos por rol y cambio obligatorio después de un restablecimiento temporal.
- **Auditoría administrativa:** registro de accesos y operaciones, con consulta filtrada para administradores.
- **Experiencia de uso:** interfaz adaptable, navegación por teclado, notificaciones y estados de carga y error.

## Arquitectura del sistema

La solución sigue una arquitectura cliente-servidor con separación entre presentación, lógica de aplicación y persistencia. El frontend consume la API REST mediante rutas relativas `/api/`; las credenciales de la base de datos permanecen en el backend.

```text
Navegador
   | HTTPS
   v
Microsoft Azure IaaS · VM Ubuntu ARM64
   Nginx
     |-- /       -> frontend React/Vite compilado
     `-- /api/   -> API Node.js/Express en loopback
                   administrada mediante systemd
                            | TLS
                            v
                      MongoDB Atlas
```

React y Express son componentes separados, aunque se alojan en la misma VM. MongoDB Atlas funciona como servicio externo de persistencia, no como una base instalada en la máquina virtual.

## Tecnologías utilizadas

| Capa | Tecnologías |
|---|---|
| Frontend | React 19, Vite 8, React Router, Axios, Lucide React, CSS |
| Backend | Node.js, Express 5, Mongoose 9, Zod |
| Seguridad | Argon2id, JSON Web Tokens, cookies HttpOnly, Helmet, express-rate-limit |
| Persistencia | MongoDB y replica sets; MongoDB Atlas en el despliegue académico |
| Infraestructura | Microsoft Azure IaaS, Ubuntu, Nginx, systemd, Let's Encrypt y Certbot |
| Pruebas | node:test, Supertest, mongodb-memory-server, Vitest, Testing Library, Playwright |

Las versiones exactas de las dependencias están fijadas en los lockfiles de `server/` y `client/`.

## Despliegue en Microsoft Azure

El proyecto **fue desplegado y probado en Microsoft Azure** con los siguientes componentes:

| Componente implementado | Responsabilidad |
|---|---|
| Máquina virtual Ubuntu 24.04 ARM64 | Entorno Linux para alojar y administrar la aplicación bajo el modelo IaaS |
| Nginx | Servir el frontend compilado y actuar como proxy inverso de la API |
| React + Vite | Interfaz de usuario compilada para producción |
| Node.js + Express | API REST ejecutada como servicio mediante systemd y una cuenta dedicada sin privilegios administrativos |
| MongoDB Atlas | Persistencia externa con conexión TLS y usuario limitado a la base de la aplicación |
| Let's Encrypt + Certbot | Certificado HTTPS y renovación automática configurada, comprobada mediante una simulación con recarga validada de Nginx |

Nginx centraliza el acceso HTTPS y reenvía las peticiones de la API a Express, que escucha únicamente en loopback. La configuración del backend se conserva en un archivo protegido fuera del repositorio.

Las comprobaciones realizadas y las validaciones operativas pendientes se distinguen en [Pruebas y resultados](#pruebas-y-resultados). Las direcciones y credenciales del despliegue no forman parte de esta publicación.

## Roles y permisos

| Operación | Administrador | Coordinador |
|---|:---:|:---:|
| Consultar estudiantes y catálogo de carreras | Sí | Sí |
| Crear y editar estudiantes | Sí | Sí |
| Eliminar estudiantes | Sí | No |
| Crear, editar e inactivar carreras | Sí | No |
| Gestionar cuentas y consultar auditoría | Sí | No |

El coordinador consulta el catálogo desde el formulario de estudiantes; las páginas de gestión administrativa se reservan al administrador. Los permisos se comprueban en la API además de reflejarse en la interfaz. Estos perfiles de aplicación son independientes de los roles de Azure IAM.

## Instalación y ejecución local

### Requisitos

- Node.js **24 LTS** y npm. Alternativa: Node.js 22.13 o posterior de esa línea, compatible también con el linter fijado.
- Git y dos terminales.
- MongoDB con **replica set**, necesario para las transacciones. La alternativa descrita a continuación utiliza Docker Engine o Docker Desktop en modo contenedores Linux.
- Chromium de Playwright, únicamente para las pruebas de navegador.

La instalación utiliza una base independiente de desarrollo. No reutilices credenciales ni datos de producción.

### 1. Preparar MongoDB

Crea un contenedor y un volumen exclusivos de desarrollo. El puerto se publica solo en loopback:

```sh
docker volume create studenthub-mongo-dev
docker run --detach --name studenthub-mongo-dev --publish 127.0.0.1:27017:27017 --mount source=studenthub-mongo-dev,target=/data/db mongo:8.0 --replSet rs0 --bind_ip_all
```

Espera a que MongoDB acepte conexiones e inicializa el replica set **una sola vez**:

```sh
docker exec studenthub-mongo-dev mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:27017'}]})"
docker exec studenthub-mongo-dev mongosh --quiet --eval "db.hello().isWritablePrimary"
```

La última consulta debe devolver `true`. Si todavía hay una elección en curso, repite solo esa consulta. Si el contenedor ya existe, revísalo y usa `docker start studenthub-mongo-dev` cuando corresponda; el volumen conserva los datos locales entre ejecuciones.

Esta configuración sin autenticación es exclusivamente local y no debe exponerse a Internet. También puedes utilizar un replica set existente con una base propia de desarrollo.

### 2. Configurar el backend

Desde la raíz de una copia del repositorio:

```sh
node -e "require('node:fs').copyFileSync('server/.env.example','server/.env',require('node:fs').constants.COPYFILE_EXCL)"
cd server
npm ci --include=dev --include=optional --ignore-scripts
```

El comando de copia funciona en Bash y PowerShell y se detiene si `server/.env` ya existe. Edita ese archivo privadamente: conserva la URI local del ejemplo y reemplaza `JWT_SECRET` por un secreto nuevo de al menos 32 caracteres. Puedes generarlo en una terminal privada:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

No compartas su salida ni la incorpores a Git. La aplicación rechaza el placeholder del ejemplo.

### 3. Crear el administrador local y arrancar la API

Desde `server/`, con el replica set disponible:

```sh
npm run create-admin
npm run dev
```

El bootstrap requiere una terminal interactiva y solicita una contraseña oculta de 12 a 128 caracteres. No sobrescribe una cuenta con el mismo correo ni crea otro administrador si ya existe uno activo. Este paso escribe en la base local configurada.

La API escucha en `127.0.0.1:5000`. No existe registro público ni se distribuyen credenciales predeterminadas.

### 4. Arrancar el frontend

En otra terminal, desde la raíz:

```sh
cd client
npm ci --include=dev --include=optional --ignore-scripts
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con la cuenta local recién creada. Vite redirige `/api` al backend. No necesitas instalar dependencias desde la raíz ni crear un `.env` del cliente para esta configuración.

Las instalaciones indicadas bloquean scripts de instalación. Si una dependencia nativa no carga, revisa su compatibilidad antes de aprobar scripts o cambiar el lockfile. No copies `node_modules` entre sistemas operativos o arquitecturas distintas.

### Variables de entorno

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

`deploy/server.env.example` contiene una plantilla genérica para HTTPS. Sustituye sus valores de ejemplo en un archivo protegido fuera de Git antes de utilizarla. Un despliegue público requiere HTTPS, cookies Secure y secretos exclusivos. Usa `TRUST_PROXY=loopback` solo con un proxy local confiable que sobrescriba las cabeceras reenviadas; no habilites confianza global. Nunca coloques URI, claves o contraseñas en variables `VITE_*`.

## Seguridad implementada

- **Contraseñas:** hash Argon2id, sin devolver hashes en las respuestas de usuario.
- **Sesiones:** JWT de 15 minutos en cookie `HttpOnly`, `SameSite=Strict` y `Path=/api`; `Secure` obligatorio en producción. La cookie es de sesión y el JWT tiene una expiración independiente, sin renovación automática.
- **Protección de solicitudes:** comprobación exacta de `Origin` y token CSRF vinculado a la sesión, conservado en memoria del cliente y enviado en `X-CSRF-Token` para mutaciones.
- **Control de acceso:** autenticación y autorización por rol en el backend, validación Zod, límites de intentos en operaciones sensibles y mensajes de error controlados.
- **Persistencia y trazabilidad:** transacciones en las mutaciones administrativas implementadas y auditoría de accesos y operaciones. El registro es append-only a través de la aplicación, no inmutable frente a un administrador de base de datos.
- **Aislamiento del servicio:** cuenta no privilegiada, configuración protegida y acceso a Express a través de Nginx en el despliegue realizado.

El cierre de sesión elimina la cookie del navegador, pero no revoca por sí solo una copia del JWT; cambiar o restablecer la contraseña invalida las sesiones anteriores mediante su versión. Asimismo, algunas validaciones de reglas pueden actualizar metadatos internos aunque rechacen una operación: no deben utilizarse como pruebas de solo lectura sobre datos reales.

## Pruebas y resultados

### Pruebas automatizadas locales

Resultados obtenidos el 7 de noviembre de 2026 en Windows, con Node.js 24.13.0 y npm 11.6.2, sin cambiar lockfiles ni utilizar una base de producción:

| Comprobación | Resultado |
|---|---|
| Backend: API e integración | **42/42 aprobadas** |
| Frontend: componentes | **32/32 aprobadas**, 4 archivos |
| Playwright E2E con Chromium | **7/7 aprobadas** |
| ESLint | **Sin errores** |
| Compilación de producción, Vite 8.3.5 | **Correcta** |

Las suites cubren autenticación, roles, CSRF, validación, persistencia, auditoría y flujos de interfaz. Backend y E2E utilizan `MongoMemoryReplSet`, bases temporales y datos ficticios; las pruebas de rollback con fallos controlados se realizaron en ese entorno aislado, no en Atlas.

Para reproducirlas, ejecuta secuencialmente:

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

El harness E2E no carga `.env` ni conecta a Atlas; requiere libres los puertos locales 5100 y 5180. El primer uso puede descargar MongoDB y Chromium. Los resultados y capturas generados se excluyen de Git, y las credenciales ficticias de los tests solo pertenecen a esos entornos temporales.

El procedimiento Docker de instalación local está documentado, pero no se ejecutó durante esta revisión porque el daemon Docker no estaba disponible.

### Comprobaciones sobre el despliegue en Azure

- **Comprobación directa:** acceso HTTPS con certificado válido, redirección HTTP a HTTPS, rechazo de acceso anónimo a endpoints protegidos, manejo de errores de formato y bloqueo de rutas de archivos privados.
- **Validación manual reportada:** login/logout, atributos de cookie, expiración de sesión, rechazos CSRF, consultas administrativas y creación/edición persistente de entidades con ambos roles, con revisión de auditoría.

Estas evidencias corresponden a comprobaciones realizadas, no a una garantía de disponibilidad continua. Los resultados locales no sustituyen la aceptación de la infraestructura desplegada.

### Validaciones operativas pendientes

- Cierre independiente de la prueba DELETE denegado con sesión real de coordinador y consulta de su auditoría.
- Contraste independiente actualizado de los registros en Atlas, exclusivamente de lectura.
- Habilitación y verificación del arranque automático del backend y recuperación efectiva tras reiniciar la VM.

No se afirma una prueba de eliminación real ni limpieza de datos del despliegue; los registros existentes se conservan.

## Consideraciones técnicas y alcance

- **Alcance académico y administrativo:** el sistema no incluye calificaciones, asistencia, matrícula financiera ni autoservicio estudiantil.
- **Una sola VM:** la implementación no ofrece alta disponibilidad ni presupone operación permanente. La recuperación tras reinicio requiere la validación indicada anteriormente.
- **Persistencia externa:** Atlas se utiliza mediante TLS; no se presenta como una base instalada en la VM ni como una integración privada de red demostrada.
- **Ciclo de vida de entidades:** estudiantes cuentan con eliminación restringida al administrador; carreras y usuarios se inactivan para conservar su historial.
- **Recuperación de acceso:** el restablecimiento es asistido por un administrador autorizado; no existe recuperación automática por correo.
- **Mantenimiento:** los scripts de mantenimiento pueden alterar o eliminar datos y no forman parte de la instalación normal. Su uso requiere autorización y respaldos verificados.

El repositorio incluye fuentes, pruebas, lockfiles y plantillas ficticias. Los entornos reales, secretos, datos personales, respaldos y documentos internos permanecen fuera de la publicación. Antes de publicar cambios, revisa tanto los archivos como el historial: `.gitignore` no elimina contenido ya versionado.
