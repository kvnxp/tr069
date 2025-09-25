# API Routes Reference

Esta documentación presenta todas las rutas API disponibles en el sistema TR-069 CWMP Management con CMS integrado.

## 📋 Índice
- [Rutas CWMP Core](#rutas-cwmp-core)
- [Rutas CMS Web Interface](#rutas-cms-web-interface)
- [Rutas CMS API](#rutas-cms-api)
- [Rutas de Gestión de Dispositivos](#rutas-de-gestión-de-dispositivos)
- [Rutas de Discovery y Conexión](#rutas-de-discovery-y-conexión)
- [Rutas de Scripts Estáticos](#rutas-de-scripts-estáticos)

---

## 🌐 Rutas CWMP Core

### SOAP/XML Endpoints

| Endpoint | Método | Descripción | Autenticación |
|----------|--------|-------------|---------------|
| `/` | POST | Endpoint principal SOAP para comunicación TR-069 | Digest Auth |
| `/acs` | POST | Endpoint alternativo ACS para dispositivos | Digest Auth |

**Detalles**:
- Maneja mensajes SOAP TR-069 (Inform, GetRPC, etc.)
- Autenticación Digest con credenciales del dispositivo
- Content-Type: `text/xml` o `application/soap+xml`

---

## 🎛️ Rutas CMS Web Interface

### Páginas de Interfaz

| Endpoint | Método | Descripción | Autenticación |
|----------|--------|-------------|---------------|
| `/cms` | GET | Página principal CMS (redirige según autenticación) | - |
| `/cms/login` | GET | Página de login del CMS | - |
| `/cms/login` | POST | Procesamiento de autenticación | - |
| `/cms/dashboard` | GET | Dashboard principal con gestión de dispositivos | CMS Session |
| `/cms/wifi/:serial` | GET | Página de configuración WiFi para dispositivo específico | CMS Session |
| `/cms/logout` | GET | Cerrar sesión y destruir sesión | CMS Session |

**Autenticación CMS**:
- Usuario: `admin`
- Password: `admin123`
- Sesión basada en cookies con secret key

---

## 🔌 Rutas CMS API

### API de Dispositivos

| Endpoint | Método | Descripción | Autenticación |
|----------|--------|-------------|---------------|
| `/cms/api/devices` | GET | Lista completa de dispositivos con información detallada | CMS Session |
| `/cms/api/device/:serial/params` | GET | Parámetros específicos de un dispositivo | CMS Session |
| `/cms/api/device/:serial/params` | POST | Establecer parámetros en un dispositivo | CMS Session |
| `/cms/api/device/:serial/action` | POST | Ejecutar acción en dispositivo (reboot, factory_reset, etc.) | CMS Session |

**Ejemplo de Acciones Disponibles**:
```json
{
  "action": "reboot",           // Reiniciar dispositivo
  "action": "factory_reset",    // Reset de fábrica
  "action": "download",         // Descargar firmware
  "action": "wifi_restart"      // Reiniciar WiFi
}
```

---

## 📱 Rutas de Gestión de Dispositivos

### API Core de Dispositivos

| Endpoint | Método | Descripción | Respuesta |
|----------|--------|-------------|-----------|
| `/devices` | GET | Lista de números de serie de dispositivos | `[{"serial": "xxx"}]` |
| `/device/:serial` | GET | Información completa de un dispositivo | Objeto Device completo |
| `/device/:serial/params` | GET | Parámetros paginados de un dispositivo | Objeto con parámetros |

**Estructura de Device**:
```json
{
  "serialNumber": "4857544387806FB0",
  "manufacturer": "Huawei",
  "oui": "48575443",
  "productClass": "EchoLife",
  "params": {
    "InternetGatewayDevice.DeviceInfo.SerialNumber": {
      "value": "4857544387806FB0"
    }
  },
  "lastInform": "2025-09-25T18:54:45.870Z",
  "username": "admin",
  "password": "admin"
}
```

**Parámetros de Query**:
- `offset`: Desplazamiento para paginación (default: 0)
- `limit`: Límite de resultados (default: 200, max: 1000)

---

## 🔍 Rutas de Discovery y Conexión

### Discovery de Parámetros

| Endpoint | Método | Descripción | Parámetros |
|----------|--------|-------------|------------|
| `/pull-params` | POST | Obtener parámetros específicos de un dispositivo | `{serial, connUrl?, username?, password?}` |
| `/full-discovery` | POST | Discovery completo de todos los parámetros | `{serial, connUrl?, username?, password?}` |
| `/schedule-discovery` | POST | Programar discovery automático | `{serial, interval?}` |
| `/pending-discovery` | GET | Ver discoveries pendientes | - |

### Connection Request

| Endpoint | Método | Descripción | Parámetros |
|----------|--------|-------------|------------|
| `/connection-request` | POST | Solicitar conexión a dispositivo | `serial` (query param) |

**Respuestas típicas**:
```json
{
  "success": true,
  "message": "Connection request sent successfully",
  "status": 200
}

{
  "success": false,
  "message": "Device 4857544387806FB0 is busy (503)",
  "status": 503,
  "suggestion": "Device is busy. Try again later."
}
```

---

## 📋 Rutas de Queue Management

### Cola de Métodos

| Endpoint | Método | Descripción | Body |
|----------|--------|-------------|------|
| `/queue-method` | POST | Encolar método RPC para dispositivo | `{serial, method, parameters?}` |

**Métodos RPC Soportados**:
- `GetParameterValues`
- `SetParameterValues`
- `GetParameterNames`
- `Reboot`
- `FactoryReset`
- `Download`

**Ejemplo de Request**:
```json
{
  "serial": "4857544387806FB0",
  "method": "SetParameterValues",
  "parameters": {
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID": "NuevoSSID",
    "InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.KeyPassphrase": "nuevapassword"
  }
}
```

---

## 📄 Rutas de Scripts Estáticos

### JavaScript Modules

| Endpoint | Método | Descripción | Contenido |
|----------|--------|-------------|-----------|
| `/cms/scripts/dashboard.js` | GET | JavaScript principal del dashboard | Alias a dashboard-core.js |
| `/cms/scripts/dashboard-core.js` | GET | Funciones core del dashboard | loadDevices(), formatDate(), getDeviceStatus() |
| `/cms/scripts/device-management.js` | GET | Gestión de dispositivos | viewDevice(), viewParams(), filterParams() |
| `/cms/scripts/device-actions.js` | GET | Acciones de dispositivos | runDiscovery(), rebootDevice(), pullParams() |
| `/cms/scripts/wifi-config.js` | GET | Configuración WiFi | Funciones específicas para WiFi |

---

## 🔐 Autenticación y Seguridad

### Tipos de Autenticación

1. **CWMP Digest Auth**: Para comunicación con dispositivos
   - Username/Password específicos por dispositivo
   - Digest authentication según RFC 2617

2. **CMS Session Auth**: Para interfaz web
   - Sesión basada en cookies
   - Secret key configurable via `CMS_SESSION_SECRET`
   - Middleware `requireAuth` para proteger rutas

3. **Redirect Logic**: 
   - `redirectIfAuthenticated`: Redirige usuarios ya logueados
   - `requireAuth`: Requiere autenticación para acceder

---

## 📊 Estados y Códigos de Respuesta

### Códigos HTTP Comunes

| Código | Significado | Contextos |
|--------|-------------|-----------|
| 200 | OK | Operación exitosa |
| 302 | Found/Redirect | Login exitoso, redirección |
| 400 | Bad Request | Parámetros faltantes o inválidos |
| 401 | Unauthorized | Credenciales inválidas |
| 404 | Not Found | Dispositivo o recurso no encontrado |
| 500 | Server Error | Error interno del servidor |
| 503 | Service Unavailable | Dispositivo ocupado |

### Estados de Dispositivos

- **Online**: Último inform < 120 minutos
- **Offline**: Último inform > 120 minutos o nunca
- **Busy**: Dispositivo procesando otra operación

---

## 🚀 Ejemplos de Uso

### Obtener Lista de Dispositivos (CMS)
```bash
curl -b cookies.txt http://localhost:7547/cms/api/devices
```

### Ejecutar Reboot de Dispositivo
```bash
curl -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"action":"reboot"}' \
  http://localhost:7547/cms/api/device/4857544387806FB0/action
```

### Connection Request (Corrected - Query Parameter)
```bash
curl -X POST \
  "http://localhost:7547/connection-request?serial=4857544387806FB0"
```

### Full Discovery (Corrected - Query Parameter)
```bash
curl -X POST \
  "http://localhost:7547/full-discovery?serial=4857544387806FB0"
```

### Pull Parameters (Corrected - Query Parameter)
```bash
curl -X POST \
  "http://localhost:7547/pull-params?serial=4857544387806FB0"
```

### Get Device Parameters (Structured Response)
```bash
curl "http://localhost:7547/device/4857544387806FB0/params"
# Returns: {"total": 8, "offset": 0, "limit": 8, "params": [...]}
```

---

## 🔧 Configuración de Rutas

### Variables de Entorno

- `PORT`: Puerto del servidor (default: 7547)
- `HOST`: Host del servidor (default: 0.0.0.0)
- `CMS_SESSION_SECRET`: Secret para sesiones CMS
- `DEBUG_MODE`: Modo debug (true/false)

### Headers Importantes

- **CWMP**: `Content-Type: text/xml`, `SOAPAction`
- **CMS API**: `Content-Type: application/json`
- **Autenticación**: `Authorization: Digest ...` para CWMP

---

## 📝 Notas Técnicas

1. **CORS**: No configurado, solo same-origin
2. **Rate Limiting**: No implementado
3. **Logging**: Requests loggeados en modo debug
4. **File Uploads**: No soportado actualmente
5. **WebSockets**: No utilizados
6. **API Versioning**: No implementado, API v1 implícito

---

## 🔄 Flujo de Comunicación TR-069

```
Device → POST / (Inform) → Server
Server → Response (GetParameterNames) → Device  
Device → POST / (GetParameterNamesResponse) → Server
Server → Response (GetParameterValues) → Device
Device → POST / (GetParameterValuesResponse) → Server
Server → Response (Empty) → Device
```

Cada intercambio puede contener múltiples métodos RPC dependiendo de la cola de operaciones pendientes para el dispositivo.

---

## 🔧 Recent Fixes & Corrections (September 2025)

### Parameter Display Issues (RESOLVED ✅)
- **Problem**: Parameters showing as `[object Object]` in CMS interface
- **Cause**: Frontend expecting simple objects, backend returning nested `{value: {value: "actual"}}` structure  
- **Solution**: Updated `viewDevice()` and `viewParams()` functions to extract `param.value.value`
- **Files Modified**: `src/cms/scripts/device-management.js`
- **Impact**: All parameter values now display correctly in both device details and parameter list views

### Discovery Serial Number Errors (RESOLVED ✅)  
- **Problem**: "Serial number required" errors on all discovery functions
- **Cause**: Frontend sending serial in POST body, backend expecting query parameter
- **Solution**: Updated all discovery functions to use query parameters with `encodeURIComponent()`
- **Functions Fixed**: `runDiscovery()`, `connectionRequest()`, `pullParams()`, `discoverAllDevices()`
- **Impact**: All discovery and connection operations now work correctly

### API Response Structure Handling (UPDATED ✅)
The `/device/:serial/params` endpoint returns structured response with metadata:
```json
{
  "total": 8,
  "offset": 0, 
  "limit": 8,
  "params": [
    {"name": "InternetGatewayDevice.DeviceInfo.HardwareVersion", "value": {"value": "31FD.A"}},
    {"name": "InternetGatewayDevice.DeviceInfo.SoftwareVersion", "value": {"value": "V5R021C00S230"}}
  ]
}
```

### Device Status Detection Improved (ENHANCED ✅)
- **Online Threshold**: Extended from 30 minutes to 120 minutes  
- **Better Detection**: Devices now show "online" for 2 hours after last inform
- **File Modified**: `src/cms/scripts/dashboard-core.js`
- **Impact**: More accurate device status representation in dashboard

### UI/UX Enhancements (IMPLEMENTED ✅)
- **Sidebar Navigation**: Modern left sidebar replacing horizontal navigation
- **Professional Design**: Improved color scheme and hover effects
- **Fixed Layout**: Header and sidebar with proper positioning
- **Files Modified**: `src/cms/components/layout.ts`, `src/cms/components/styles.ts`, `src/cms/html/dashboard.ts`

### Corrected API Examples
All examples now use proper query parameters instead of POST body for discovery operations:
```bash
# CORRECT (Fixed):
curl -X POST "http://localhost:7547/full-discovery?serial=DEVICE_SERIAL"
curl -X POST "http://localhost:7547/connection-request?serial=DEVICE_SERIAL"  
curl -X POST "http://localhost:7547/pull-params?serial=DEVICE_SERIAL"

# INCORRECT (Previous):
curl -X POST -d '{"serial":"DEVICE_SERIAL"}' http://localhost:7547/full-discovery
```