// Dashboard JavaScript Functions
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
}

function getDiscoveryStatus(device) {
    const status = device.discoveryStatus;
    if (!status || !status.isCompleted) {
        return '<span class="discovery-badge discovery-pending">🔍 Pendiente</span>';
    }
    
    const paramCount = status.parameterCount || 0;
    const lastDiscovery = status.lastDiscovery;
    const isManual = status.isManual;
    
    if (paramCount < 50) {
        return '<span class="discovery-badge discovery-incomplete">⚠️ Incompleto</span>';
    }
    
    let statusText = `✅ Completo (${paramCount} params)`;
    if (isManual) {
        statusText += ' - Manual';
    } else if (lastDiscovery) {
        const daysSince = Math.floor((Date.now() - new Date(lastDiscovery).getTime()) / (1000 * 60 * 60 * 24));
        statusText += ` - ${daysSince}d ago`;
    }
    
    return `<span class="discovery-badge discovery-complete" title="Último discovery: ${formatDate(lastDiscovery)}">${statusText}</span>`;
}

function getDiscoveryButton(device) {
    const status = device.discoveryStatus;
    const isDiscovered = status && status.isCompleted && (status.parameterCount || 0) >= 50;
    
    if (isDiscovered && status.isManual) {
        // Already manually discovered - show re-discovery button
        return `<button class="btn btn-warning" onclick="runDiscovery('${device.serialNumber}')" title="Re-ejecutar discovery manual">
                    🔄 Re-Discovery
                </button>`;
    } else if (isDiscovered) {
        // Auto-discovered - show manual discovery button  
        return `<button class="btn btn-success" onclick="runDiscovery('${device.serialNumber}')" title="Ejecutar discovery manual">
                    🔍 Discovery Manual
                </button>`;
    } else {
        // Not discovered or incomplete
        return `<button class="btn btn-success" onclick="runDiscovery('${device.serialNumber}')" title="Ejecutar discovery">
                    🔍 Discovery
                </button>`;
    }
}

function getDeviceStatus(lastInform) {
    if (!lastInform) return 'offline';
    const last = new Date(lastInform);
    const now = new Date();
    const diffMinutes = (now.getTime() - last.getTime()) / (1000 * 60);
    return diffMinutes < 120 ? 'online' : 'offline'; // 2 hours instead of 30 minutes
}

async function loadDevices() {
    try {
        const response = await fetch('/cms/api/devices');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Error loading devices');
        }
        
        const devices = Object.values(data);
        
        // Update stats
        document.getElementById('total-devices').textContent = devices.length;
        
        const onlineDevices = devices.filter(d => getDeviceStatus(d.lastInform) === 'online');
        document.getElementById('online-devices').textContent = onlineDevices.length;
        
        const lastInformTimes = devices.map(d => d.lastInform).filter(Boolean);
        const latestInform = lastInformTimes.length > 0 ? 
            Math.max(...lastInformTimes.map(t => new Date(t).getTime())) : null;
        document.getElementById('last-inform').textContent = 
            latestInform ? formatDate(new Date(latestInform)) : 'Nunca';
        
        // Update devices table
        const content = document.getElementById('devices-content');
        
        if (devices.length === 0) {
            content.innerHTML = `
                <div class="no-devices">
                    <h3>No hay dispositivos registrados</h3>
                    <p>Los dispositivos aparecerán aquí cuando se conecten por primera vez al servidor TR-069.</p>
                </div>
            `;
        } else {
            content.innerHTML = `
                <table class="devices-table">
                    <thead>
                        <tr>
                            <th>Número de Serie</th>
                            <th>Fabricante</th>
                            <th>Clase de Producto</th>
                            <th>Estado</th>
                            <th>Último Inform</th>
                            <th>Acciones & Discovery</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${devices.map(device => {
                            const status = getDeviceStatus(device.lastInform);
                            const paramCount = device.params ? Object.keys(device.params).length : 0;
                            return `
                                <tr>
                                    <td>
                                        <strong>${device.serialNumber}</strong>
                                        <br><small>${paramCount} parámetros</small>
                                    </td>
                                    <td>${device.manufacturer || 'N/A'}</td>
                                    <td>${device.productClass || 'N/A'}</td>
                                    <td>
                                        <span class="status-badge status-${status}">
                                            ${status === 'online' ? 'Conectado' : 'Desconectado'}
                                        </span>
                                    </td>
                                    <td>${formatDate(device.lastInform)}</td>
                                    <td>
                                        <div class="device-actions">
                                            <button class="btn btn-primary" onclick="viewDevice('${device.serialNumber}')" title="Ver detalles">
                                                👁️ Ver
                                            </button>
                                            <button class="btn btn-secondary" onclick="viewParams('${device.serialNumber}')" title="Ver parámetros">
                                                📋 Params
                                            </button>
                                            ${getDiscoveryButton(device)}
                                            <div class="discovery-status">${getDiscoveryStatus(device)}</div>
                                            <button class="btn btn-warning" onclick="connectionRequest('${device.serialNumber}')" title="Solicitar conexión">
                                                🔗 Connect
                                            </button>
                                            <button class="btn btn-danger" onclick="rebootDevice('${device.serialNumber}')" title="Reiniciar dispositivo">
                                                🔄 Reboot
                                            </button>
                                            <br style="margin: 0.25rem 0;">
                                            <button class="btn btn-primary" onclick="configureWiFi('${device.serialNumber}')" title="Configurar WiFi">
                                                📶 WiFi Config
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }
    } catch (error) {
        console.error('Error loading devices:', error);
        document.getElementById('devices-content').innerHTML = `
            <div class="no-devices">
                <h3>Error al cargar dispositivos</h3>
                <p>${error.message}</p>
                <button class="refresh-btn" onclick="loadDevices()">Reintentar</button>
            </div>
        `;
    }
}

// Load devices on page load
loadDevices();

// Auto-refresh every 30 seconds
setInterval(loadDevices, 30000);