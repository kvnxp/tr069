# TR-069 Management System with CMS

Sistema de gestión TR-069/CWMP con interfaz web integrada.

## Características

- **Servidor TR-069/CWMP** completo para gestión de dispositivos CPE
- **CMS Web integrado** con autenticación y dashboard
- **Dashboard en tiempo real** con información de dispositivos conectados
- **API REST** para integración con otros sistemas

## Instalación

```bash
# Instalar dependencias
bun install

# Ejecutar en desarrollo
bun run dev

# Compilar para producción
bun run build
bun run start
```

## Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
# Configuración del servidor TR-069
PORT=7547
HOST=0.0.0.0

# Configuración del CMS
CMS_SESSION_SECRET=tu-clave-secreta-aqui
```

## Uso del CMS

### Acceso al CMS
- **URL**: `http://localhost:7547/cms`
- **Credenciales por defecto**:
  - Usuario: `admin` / Contraseña: `admin123`
  - Usuario: `tr069` / Contraseña: `cwmp2024`

### Funcionalidades del CMS

1. **Login seguro** con sesiones
2. **Dashboard principal** que muestra:
   - Número total de dispositivos
   - Dispositivos conectados (última conexión < 30 minutos)
   - Fecha del último Inform recibido
   - Tabla de dispositivos con estado en tiempo real

3. **Auto-refresh**: El dashboard se actualiza automáticamente cada 30 segundos

### API Endpoints

#### TR-069 API (para dispositivos CPE)
- `POST /` - Endpoint SOAP principal para dispositivos TR-069
- `POST /connection-request` - Solicitudes de conexión
- `GET /devices` - Lista de dispositivos registrados
- `GET /device/:serial` - Información de dispositivo específico
- `POST /pull-params` - Solicitar parámetros de dispositivo

#### CMS API (requiere autenticación)
- `GET /cms/api/devices` - Lista de dispositivos para el dashboard
- `GET /cms/dashboard` - Dashboard principal
- `POST /cms/login` - Autenticación
- `GET /cms/logout` - Cerrar sesión

## Estructura del Proyecto

```
src/
├── auth/
│   └── session.ts          # Manejo de sesiones y autenticación CMS
├── routes/
│   ├── cms.ts              # Rutas del CMS web
│   ├── devices.ts          # API de dispositivos TR-069
│   ├── soap.ts             # Manejo de protocolos SOAP/CWMP
│   ├── connection.ts       # Requests de conexión TR-069
│   ├── discovery.ts        # Discovery de dispositivos
│   └── queue.ts            # Cola de comandos
├── server.ts               # Configuración del servidor Express
├── index.ts                # Punto de entrada principal
└── store.ts                # Almacenamiento de datos de dispositivos
```

## Seguridad

⚠️ **IMPORTANTE para Producción**:

1. **Cambiar credenciales por defecto** en `src/auth/session.ts`
2. **Configurar HTTPS** y establecer `cookie.secure: true`
3. **Usar una clave secreta fuerte** en `CMS_SESSION_SECRET`
4. **Configurar firewall** para limitar acceso al CMS

## Estados de Dispositivos

- **Conectado**: Último Inform recibido hace menos de 30 minutos
- **Desconectado**: Último Inform recibido hace más de 30 minutos o nunca

## Desarrollo

El proyecto utiliza:
- **Express.js** para el servidor web
- **TypeScript** para type safety
- **Bun** como runtime y package manager
- **Express-session** para manejo de sesiones
- **XML parsing** para protocolos TR-069/CWMP

## Soporte

Para problemas o sugerencias, revisa la documentación en `docs/` o consulta los logs del servidor.