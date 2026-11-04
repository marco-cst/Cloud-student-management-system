# Cloud Student Management System · StudentHub

Portal administrativo de gestión estudiantil con React, Vite, Express y MongoDB.

## Funciones

- Directorio de estudiantes: altas, consultas, edición, búsqueda y filtros.
- Carreras configurables y niveles académicos según su duración.
- Roles `administrador` y `coordinador`; solo el administrador elimina estudiantes y gestiona usuarios/carreras.
- Sesión JWT en cookie HttpOnly, protección CSRF y validación en servidor.
- Auditoría administrativa y recuperación asistida con clave temporal de 24 horas y cambio obligatorio.
- Interfaz adaptable, textos legibles y avisos con cierre automático.

## Requisitos

- Node.js 22.12+ o 24 LTS y npm.
- MongoDB Atlas o MongoDB local con **replica set**: las operaciones auditadas utilizan transacciones.

## Ejecutar en desarrollo

1. En `server/`, ejecutar `npm ci`.
2. Copiar `server/.env.example` a `server/.env`. Configurar `MONGODB_URI` con una base de desarrollo y reemplazar `JWT_SECRET` por un secreto aleatorio de al menos 32 caracteres. Se puede generar con:

   ```sh
   node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

3. Desde `server/`, ejecutar `npm run create-admin` en una terminal interactiva para crear el administrador inicial. La contraseña se solicita de forma oculta. El script no sobrescribe cuentas existentes.
4. En una terminal, desde `server/`, ejecutar `npm run dev`.
5. En otra terminal, desde `client/`, ejecutar `npm ci` y `npm run dev`.
6. Abrir `http://localhost:5173`. La API escucha por defecto en `127.0.0.1:5000`; Vite redirige `/api` al servidor.

No existe registro público. El administrador crea las cuentas del equipo y puede restablecer la clave de otra cuenta activa tras confirmar su propia contraseña. La clave temporal solo se muestra al generarla; entregarla por un canal privado.

## Pruebas

Ejecutar secuencialmente:

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

Las pruebas de integración y navegador usan MongoDB temporal y cuentas ficticias, sin cargar la configuración de Atlas. El primer uso descarga el binario de MongoDB. Las pruebas de navegador requieren libres los puertos 5100 y 5180. Sus capturas y resultados generados están excluidos de Git.

## Seguridad

- No publicar `.env`, claves, respaldos ni datos personales. El archivo de ejemplo contiene solo valores de referencia.
- En producción usar HTTPS, `COOKIE_SECURE=true`, `APP_ORIGIN` HTTPS y secretos exclusivos del entorno. No exponer directamente Express ni usar Vite como servidor público.
- Los comandos `maintenance:accounts` y `migrate:academic` son mantenimiento de desarrollo: con `--apply` pueden eliminar datos. No son pasos de instalación; requieren autorización explícita y respaldo/restauración verificados.
- Cerrar sesión elimina la cookie local. Restablecer o cambiar la contraseña invalida también las sesiones anteriores.

Este repositorio publica código, pruebas y configuración. Planes, propuestas, documentos internos, capturas y respaldos se conservan fuera del historial público.
