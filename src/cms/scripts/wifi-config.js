// WiFi Configuration JavaScript

async function loadWiFiConfig() {
    try {
        const response = await fetch(`/cms/api/device/${deviceSerial}/params`);
        const params = await response.json();
        
        if (!response.ok) {
            throw new Error(params.error || 'Failed to load parameters');
        }
        
        // Find WiFi related parameters
        const wifiParams = {};
        Object.keys(params).forEach(key => {
            if (key.includes('WiFi') || key.includes('WLAN') || key.includes('Wireless')) {
                wifiParams[key] = params[key];
            }
        });
        
        displayWiFiConfig(wifiParams, params);
        
    } catch (error) {
        document.getElementById('loading').innerHTML = `
            <div class="error-message">
                <h3>Error al cargar configuración</h3>
                <p>${error.message}</p>
                <button class="btn btn-primary" onclick="loadWiFiConfig()">Reintentar</button>
            </div>
        `;
    }
}

function displayWiFiConfig(wifiParams, allParams) {
    document.getElementById('loading').style.display = 'none';
    const configDiv = document.getElementById('wifi-config');
    configDiv.style.display = 'block';
    
    if (Object.keys(wifiParams).length === 0) {
        configDiv.innerHTML = `
            <div class="config-section">
                <div class="section-header">
                    <h2>Sin Configuración WiFi</h2>
                    <p>No se encontraron parámetros WiFi para este dispositivo.</p>
                </div>
                <div class="config-form">
                    <button class="btn btn-primary" onclick="loadWiFiConfig()">🔄 Recargar</button>
                    <a href="/cms/dashboard" class="btn btn-secondary">← Volver</a>
                </div>
            </div>
        `;
        return;
    }
    
    // Extract WiFi networks (assuming TR-069 structure)
    const networks = extractWiFiNetworks(wifiParams);
    
    configDiv.innerHTML = `
        <div class="config-section">
            <div class="section-header">
                <h2>📶 Redes WiFi Detectadas</h2>
                <p>Configuración de redes inalámbricas del dispositivo ${deviceSerial}</p>
            </div>
            <div class="config-form">
                <div id="message-area"></div>
                ${networks.map((network, index) => createNetworkForm(network, index)).join('')}
                
                <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e9ecef;">
                    <h3>Acciones Globales</h3>
                    <button class="btn btn-success" onclick="saveAllChanges()">💾 Guardar Todos los Cambios</button>
                    <button class="btn btn-warning" onclick="loadWiFiConfig()">🔄 Recargar Configuración</button>
                    <button class="btn btn-danger" onclick="restartWiFi()">⚡ Reiniciar WiFi</button>
                </div>
            </div>
        </div>
        
        <div class="config-section">
            <div class="section-header">
                <h2>🔧 Parámetros WiFi Completos</h2>
                <p>Todos los parámetros WiFi encontrados</p>
            </div>
            <div class="config-form">
                <div style="max-height: 400px; overflow-y: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 0.5rem; text-align: left; border-bottom: 1px solid #ddd;">Parámetro</th>
                                <th style="padding: 0.5rem; text-align: left; border-bottom: 1px solid #ddd;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(wifiParams).map(([key, value]) => `
                                <tr>
                                    <td style="padding: 0.5rem; font-family: monospace; font-size: 0.8rem; border-bottom: 1px solid #eee;">${key}</td>
                                    <td style="padding: 0.5rem; border-bottom: 1px solid #eee;">${String(value)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function extractWiFiNetworks(wifiParams) {
    // Try to identify WiFi networks from TR-069 parameters
    const networks = [];
    const processedSSIDs = new Set();
    
    // Look for SSID parameters to identify networks
    Object.keys(wifiParams).forEach(key => {
        if (key.includes('SSID') && !key.includes('Advertisement') && wifiParams[key]) {
            const ssid = wifiParams[key];
            if (!processedSSIDs.has(ssid)) {
                processedSSIDs.add(ssid);
                
                // Try to find related parameters for this network
                const networkParams = {};
                const keyPrefix = key.substring(0, key.lastIndexOf('.') + 1);
                
                Object.keys(wifiParams).forEach(paramKey => {
                    if (paramKey.startsWith(keyPrefix)) {
                        networkParams[paramKey] = wifiParams[paramKey];
                    }
                });
                
                networks.push({
                    ssid: ssid,
                    keyPrefix: keyPrefix,
                    params: networkParams
                });
            }
        }
    });
    
    return networks;
}

function createNetworkForm(network, index) {
    const params = network.params;
    
    // Extract common WiFi parameters
    const ssid = network.ssid;
    const enabled = findParamValue(params, ['Enable', 'Enabled']) || 'true';
    const security = findParamValue(params, ['SecurityMode', 'AuthMode', 'Security']) || 'WPA2-PSK';
    const password = findParamValue(params, ['PreSharedKey', 'Password', 'Key']) || '';
    const channel = findParamValue(params, ['Channel']) || 'Auto';
    const bandwidth = findParamValue(params, ['Bandwidth', 'ChannelWidth']) || '20MHz';
    
    return `
        <div class="wifi-network" id="network-${index}">
            <h3>
                <span class="status-indicator ${enabled === 'true' ? '' : 'disabled'}"></span>
                Red WiFi: ${ssid}
            </h3>
            
            <div class="form-grid">
                <div class="form-group">
                    <label>SSID (Nombre de Red):</label>
                    <input type="text" id="ssid-${index}" value="${ssid}" />
                </div>
                
                <div class="form-group">
                    <label>Estado:</label>
                    <select id="enabled-${index}">
                        <option value="true" ${enabled === 'true' ? 'selected' : ''}>Habilitado</option>
                        <option value="false" ${enabled === 'false' ? 'selected' : ''}>Deshabilitado</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Modo de Seguridad:</label>
                    <select id="security-${index}">
                        <option value="None" ${security === 'None' ? 'selected' : ''}>Sin Seguridad</option>
                        <option value="WEP" ${security === 'WEP' ? 'selected' : ''}>WEP</option>
                        <option value="WPA-PSK" ${security === 'WPA-PSK' ? 'selected' : ''}>WPA-PSK</option>
                        <option value="WPA2-PSK" ${security === 'WPA2-PSK' ? 'selected' : ''}>WPA2-PSK</option>
                        <option value="WPA-WPA2-PSK" ${security === 'WPA-WPA2-PSK' ? 'selected' : ''}>WPA/WPA2-PSK</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Contraseña WiFi:</label>
                    <input type="password" id="password-${index}" value="${password}" />
                    <button type="button" onclick="togglePassword('password-${index}')" style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; border: 1px solid #ddd; background: #f8f9fa;">👁️ Mostrar</button>
                </div>
                
                <div class="form-group">
                    <label>Canal:</label>
                    <input type="text" id="channel-${index}" value="${channel}" />
                </div>
                
                <div class="form-group">
                    <label>Ancho de Banda:</label>
                    <select id="bandwidth-${index}">
                        <option value="20MHz" ${bandwidth === '20MHz' ? 'selected' : ''}>20 MHz</option>
                        <option value="40MHz" ${bandwidth === '40MHz' ? 'selected' : ''}>40 MHz</option>
                        <option value="80MHz" ${bandwidth === '80MHz' ? 'selected' : ''}>80 MHz</option>
                        <option value="160MHz" ${bandwidth === '160MHz' ? 'selected' : ''}>160 MHz</option>
                    </select>
                </div>
            </div>
            
            <div style="margin-top: 1rem;">
                <button class="btn btn-primary" onclick="saveNetwork(${index})">💾 Guardar Red</button>
                <button class="btn btn-warning" onclick="testConnection('${ssid}')">📶 Probar Conexión</button>
            </div>
            
            <div style="margin-top: 1rem; font-size: 0.9rem; color: #666;">
                <strong>Prefijo de parámetros:</strong> ${network.keyPrefix}
            </div>
        </div>
    `;
}

function findParamValue(params, possibleKeys) {
    for (const key of Object.keys(params)) {
        for (const searchKey of possibleKeys) {
            if (key.includes(searchKey)) {
                return params[key];
            }
        }
    }
    return null;
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

async function saveNetwork(networkIndex) {
    showMessage('Función de guardado en desarrollo...', 'warning');
}

async function saveAllChanges() {
    showMessage('Función de guardado global en desarrollo...', 'warning');
}

async function restartWiFi() {
    if (!confirm('¿Reiniciar el servicio WiFi del dispositivo?\n\nEsto desconectará temporalmente todos los clientes.')) return;
    
    try {
        const response = await fetch(`/cms/api/device/${deviceSerial}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'wifi_restart' })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMessage('Comando de reinicio WiFi enviado correctamente.', 'success');
        } else {
            showMessage(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        showMessage(`Error: ${error.message}`, 'error');
    }
}

function testConnection(ssid) {
    showMessage(`Probando conexión a la red: ${ssid}...\n\nEsta función estará disponible próximamente.`, 'info');
}

function showMessage(message, type = 'info') {
    const messageArea = document.getElementById('message-area');
    const className = type === 'error' ? 'error-message' : type === 'success' ? 'success-message' : 'success-message';
    
    messageArea.innerHTML = `<div class="${className}">${message}</div>`;
    
    setTimeout(() => {
        messageArea.innerHTML = '';
    }, 5000);
}

// Load WiFi configuration on page load when deviceSerial is defined
if (typeof deviceSerial !== 'undefined') {
    loadWiFiConfig();
}