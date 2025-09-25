// Dashboard JavaScript Functions
function formatDate(isoString) {
    if (!isoString) return 'Nunca';
    const date = new Date(isoString);
    return date.toLocaleString('es-ES');
}

function getDeviceStatus(lastInform) {
    if (!lastInform) return 'offline';
    const last = new Date(lastInform);
    const now = new Date();
    const diffMinutes = (now.getTime() - last.getTime()) / (1000 * 60);
    return diffMinutes < 30 ? 'online' : 'offline';
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
                            <th>Acciones</th>
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
                                            <button class="btn btn-success" onclick="runDiscovery('${device.serialNumber}')" title="Ejecutar discovery">
                                                🔍 Discovery
                                            </button>
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