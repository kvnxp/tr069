# Troubleshooting Guide

Esta guía documenta los problemas más comunes encontrados en el sistema TR-069 CWMP Management y sus soluciones implementadas.

## 📋 Índice
- [Problemas de Interfaz CMS](#problemas-de-interfaz-cms)
- [Errores de Discovery](#errores-de-discovery)
- [Problemas de Conexión](#problemas-de-conexión)
- [Errores de Parámetros](#errores-de-parámetros)
- [Problemas de Autenticación](#problemas-de-autenticación)

---

## 🖥️ Problemas de Interfaz CMS

### ❌ Problema: Parámetros muestran "[object Object]"

**Síntoma**: En la vista de dispositivos y parámetros, todos los valores aparecen como `[object Object]` en lugar de los valores reales.

**Causa**: Los parámetros se almacenan con estructura anidada `{value: {value: "valor_real"}}` pero el JavaScript intentaba mostrar el objeto completo.

**Solución Implementada**:
```javascript
// ANTES (incorrecto):
${String(value)}

// DESPUÉS (corregido):
const displayValue = value && typeof value === 'object' && value.value !== undefined ? value.value : value;
${String(displayValue)}
```

**Archivos Modificados**:
- `src/cms/scripts/device-management.js` (funciones `viewDevice` y `viewParams`)

**Estado**: ✅ **RESUELTO**

---

### ❌ Problema: Dispositivos aparecen como "Desconectado" cuando están online

**Síntoma**: Dispositivos que están funcionando aparecen como "Desconectado" en el dashboard.

**Causa**: El umbral de detección de dispositivos online era muy estricto (30 minutos).

**Solución Implementada**:
```javascript
// ANTES: 30 minutos
return diffMinutes < 30 ? 'online' : 'offline';

// DESPUÉS: 120 minutos (2 horas)
return diffMinutes < 120 ? 'online' : 'offline';
```

**Archivo Modificado**:
- `src/cms/scripts/dashboard-core.js` (función `getDeviceStatus`)

**Estado**: ✅ **RESUELTO**

---

### ❌ Problema: Navegación horizontal no profesional

**Síntoma**: La navegación horizontal no se veía profesional y ocupaba mucho espacio.

**Solución Implementada**:
- Implementada barra lateral izquierda fija de 260px
- Header fijo con altura de 70px
- Diseño profesional con colores azul oscuro
- Estados hover y active mejorados

**Archivos Modificados**:
- `src/cms/components/layout.ts` (estructura de navegación)
- `src/cms/components/styles.ts` (estilos CSS)
- `src/cms/html/dashboard.ts` (estructura de página)

**Estado**: ✅ **RESUELTO**

---

## 🔍 Errores de Discovery

### ❌ Problema: "Serial number required" en todas las funciones de discovery

**Síntoma**: Al hacer clic en botones de Discovery, Connection Request, o Pull Params, aparece error "Serial number required".

**Causa**: Discrepancia entre frontend y backend:
- Frontend enviaba el serial en el **body** del POST como JSON
- Backend esperaba el serial como **query parameter**

**Solución Implementada**:
```javascript
// ANTES (incorrecto):
fetch('/full-discovery', {
    method: 'POST',
    body: JSON.stringify({ serial })
});

// DESPUÉS (corregido):
fetch(`/full-discovery?serial=${encodeURIComponent(serial)}`, {
    method: 'POST'
});
```

**Funciones Corregidas**:
- `runDiscovery(serial)`
- `connectionRequest(serial)`
- `pullParams(serial)`
- `discoverAllDevices()`

**Archivo Modificado**:
- `src/cms/scripts/device-actions.js`

**Estado**: ✅ **RESUELTO**

---

### ❌ Problema: Discovery global no itera correctamente sobre dispositivos

**Síntoma**: La función "Discovery Global" no procesa todos los dispositivos o falla.

**Causa**: El código asumía que los dispositivos eran un objeto `{serial: device}` cuando la API devuelve un array de objetos.

**Solución Implementada**:
```javascript
// ANTES (incorrecto):
for (const [serial, device] of Object.entries(devices)) {
    // device era undefined
}

// DESPUÉS (corregido):
for (const device of devices) {
    const response = await fetch(`/full-discovery?serial=${encodeURIComponent(device.serialNumber)}`);
}
```

**Estado**: ✅ **RESUELTO**

---

## 📊 Errores de Parámetros

### ❌ Problema: ViewParams muestra metadata en lugar de parámetros

**Síntoma**: Al ver parámetros de un dispositivo, se muestran campos como "total", "offset", "limit", "params" en lugar de los parámetros reales.

**Causa**: El endpoint `/device/:serial/params` devuelve estructura con metadata:
```json
{
  "total": 8,
  "offset": 0,
  "limit": 8,
  "params": [{"name": "param", "value": {"value": "real_value"}}]
}
```

Pero el JavaScript esperaba: `{param1: value1, param2: value2}`

**Solución Implementada**:
```javascript
// ANTES (incorrecto):
const paramEntries = Object.entries(params);

// DESPUÉS (corregido):
const data = await response.json();
const paramsList = data.params || [];
const totalParams = data.total || paramsList.length;

${paramsList.map(param => {
    let displayValue = param.value;
    if (displayValue && typeof displayValue === 'object' && displayValue.value !== undefined) {
        displayValue = displayValue.value;
        if (displayValue && typeof displayValue === 'object') {
            displayValue = JSON.stringify(displayValue);
        }
    }
    return `<td>${String(displayValue)}</td>`;
})}
```

**Estado**: ✅ **RESUELTO**

---

## 🔐 Problemas de Autenticación

### ❌ Problema: Sesión CMS expira rápidamente

**Síntoma**: El usuario debe hacer login frecuentemente.

**Diagnóstico**: Verificar configuración de sesión en `src/auth/session.ts`:
```javascript
cookie: {
  maxAge: 24 * 60 * 60 * 1000, // 24 horas
  httpOnly: true,
  secure: false // cambiar a true en HTTPS
}
```

**Solución**: Ajustar `maxAge` según necesidades de producción.

---

### ❌ Problema: Dispositivo no puede autenticarse

**Síntoma**: Dispositivo no logra conectarse al ACS.

**Diagnóstico**:
1. Verificar credenciales en el dispositivo
2. Revisar logs del servidor: `tail -f server.log`
3. Comprobar que el dispositivo use Digest Auth

**Configuración típica del dispositivo**:
- ACS URL: `http://[server-ip]:7547`
- Username: según configuración del dispositivo
- Password: según configuración del dispositivo
- Auth Method: Digest

---

## 🌐 Problemas de Conexión

### ❌ Problema: "Device busy" en todas las operaciones

**Síntoma**: Todas las operaciones (discovery, connection request) devuelven "Device busy".

**Diagnóstico**: El dispositivo está procesando otra operación TR-069.

**Soluciones**:
1. **Esperar**: El dispositivo completará la operación actual
2. **Reiniciar dispositivo**: Si está colgado
3. **Verificar múltiples ACS**: Asegurar que solo un ACS esté configurado

---

### ❌ Problema: "ConnectionRequestURL not available"

**Síntoma**: No se puede hacer connection request.

**Causa**: El dispositivo no ha enviado su ConnectionRequestURL en el Inform.

**Solución**:
1. Verificar que el dispositivo soporte Connection Request
2. Esperar a que el dispositivo envíe un Inform completo
3. Revisar la configuración de management del dispositivo

---

## 📝 Comandos de Diagnóstico

### Verificar Estado del Servidor
```bash
ps aux | grep "bun run" | grep -v grep
curl -s "http://localhost:7547/devices" | jq
```

### Ver Logs en Tiempo Real
```bash
tail -f server.log
```

### Probar Endpoints Manualmente
```bash
# Login al CMS
curl -c cookies.txt -d "username=admin&password=admin123" -X POST http://localhost:7547/cms/login

# Ver dispositivos
curl -b cookies.txt http://localhost:7547/cms/api/devices | jq

# Ver parámetros
curl "http://localhost:7547/device/SERIAL/params" | jq

# Probar discovery
curl -X POST "http://localhost:7547/full-discovery?serial=SERIAL"
```

### Verificar Estructura de Datos
```bash
# Ver estructura completa del dispositivo
curl -s "http://localhost:7547/device/SERIAL" | jq

# Ver solo parámetros con valores extraídos
curl -s "http://localhost:7547/device/SERIAL" | jq '.params | to_entries | map({key: .key, value: .value.value})'
```

---

## 🆘 Contacto y Soporte

Si encuentras un problema no documentado aquí:

1. **Revisar logs**: `tail -f server.log`
2. **Verificar navegador**: Consola de desarrollador (F12)
3. **Comprobar red**: Herramientas de red del navegador
4. **Revisar configuración**: Archivos `.env` y credenciales

### Estado Actual del Sistema

✅ **Sistema Completamente Funcional** - Todos los problemas conocidos han sido resueltos:
- ✅ Parámetros se muestran correctamente
- ✅ Discovery funciona sin errores
- ✅ Estados de dispositivos precisos  
- ✅ Interfaz profesional y responsive
- ✅ Todas las APIs funcionando correctamente

**Última Actualización**: 2025-09-25