// Device Management Functions

async function viewDevice(serial) {
    document.getElementById('modalTitle').textContent = `Dispositivo: ${serial}`;
    document.getElementById('modalBody').innerHTML = '<div class="loading"><div class="loading-spinner"></div>Cargando información del dispositivo...</div>';
    document.getElementById('deviceModal').style.display = 'block';
    
    try {
        const response = await fetch(`/device/${serial}`);
        const device = await response.json();
        
        const paramCount = device.params ? Object.keys(device.params).length : 0;
        const status = getDeviceStatus(device.lastInform);
        
        document.getElementById('modalBody').innerHTML = `
            <div style="margin-bottom: 2rem;">
                <h4>Información General</h4>
                <table class="params-table">
                    <tr><th>Número de Serie</th><td>${device.serialNumber}</td></tr>
                    <tr><th>Fabricante</th><td>${device.manufacturer || 'N/A'}</td></tr>
                    <tr><th>OUI</th><td>${device.oui || 'N/A'}</td></tr>
                    <tr><th>Clase de Producto</th><td>${device.productClass || 'N/A'}</td></tr>
                    <tr><th>Estado</th><td><span class="status-badge status-${status}">${status === 'online' ? 'Conectado' : 'Desconectado'}</span></td></tr>
                    <tr><th>Último Inform</th><td>${formatDate(device.lastInform)}</td></tr>
                    <tr><th>Parámetros Totales</th><td>${paramCount}</td></tr>
                    <tr><th>Usuario CWMP</th><td>${device.username || 'N/A'}</td></tr>
                </table>
            </div>
            
            <div style="margin-bottom: 2rem;">
                <h4>Acciones Rápidas</h4>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <button class="btn btn-success" onclick="runDiscovery('${serial}')">🔍 Ejecutar Discovery</button>
                    <button class="btn btn-warning" onclick="connectionRequest('${serial}')">🔗 Connection Request</button>
                    <button class="btn btn-primary" onclick="viewParams('${serial}')">📋 Ver Parámetros</button>
                    <button class="btn btn-secondary" onclick="pullParams('${serial}')">📥 Obtener Parámetros</button>
                    <button class="btn btn-primary" onclick="configureWiFi('${serial}')">📶 Configurar WiFi</button>
                    <button class="btn btn-danger" onclick="rebootDevice('${serial}')">🔄 Reiniciar Dispositivo</button>
                </div>
            </div>
            
            ${paramCount > 0 ? `
            <div>
                <h4>Parámetros Principales</h4>
                <table class="params-table">
                    ${Object.entries(device.params || {}).slice(0, 20).map(([key, value]) => `
                        <tr>
                            <th style="max-width: 300px; word-break: break-all; font-size: 0.8rem;">${key}</th>
                            <td class="param-value">${String(value).substring(0, 100)}${String(value).length > 100 ? '...' : ''}</td>
                        </tr>
                    `).join('')}
                    ${paramCount > 20 ? `<tr><td colspan="2"><em>... y ${paramCount - 20} parámetros más</em></td></tr>` : ''}
                </table>
            </div>
            ` : ''}
        `;
    } catch (error) {
        document.getElementById('modalBody').innerHTML = `<div class="no-devices"><h3>Error</h3><p>${error.message}</p></div>`;
    }
}

async function viewParams(serial) {
    document.getElementById('modalTitle').textContent = `Parámetros: ${serial}`;
    document.getElementById('modalBody').innerHTML = '<div class="loading"><div class="loading-spinner"></div>Cargando parámetros...</div>';
    document.getElementById('deviceModal').style.display = 'block';
    
    try {
        const response = await fetch(`/device/${serial}/params`);
        const params = await response.json();
        
        const paramEntries = Object.entries(params);
        
        if (paramEntries.length === 0) {
            document.getElementById('modalBody').innerHTML = `
                <div class="no-devices">
                    <h3>Sin Parámetros</h3>
                    <p>Este dispositivo no tiene parámetros registrados.</p>
                    <button class="btn btn-success" onclick="runDiscovery('${serial}')">🔍 Ejecutar Discovery</button>
                </div>
            `;
        } else {
            document.getElementById('modalBody').innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <p><strong>Total de parámetros:</strong> ${paramEntries.length}</p>
                    <input type="text" placeholder="Buscar parámetros..." onkeyup="filterParams(this.value)" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                </div>
                
                <div id="params-container" style="max-height: 400px; overflow-y: auto;">
                    <table class="params-table" id="params-table">
                        <thead>
                            <tr>
                                <th style="width: 60%;">Parámetro</th>
                                <th style="width: 40%;">Valor</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${paramEntries.map(([key, value]) => `
                                <tr class="param-row">
                                    <td style="font-family: monospace; font-size: 0.8rem; word-break: break-all;">${key}</td>
                                    <td class="param-value">${String(value)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (error) {
        document.getElementById('modalBody').innerHTML = `<div class="no-devices"><h3>Error</h3><p>${error.message}</p></div>`;
    }
}

function filterParams(searchTerm) {
    const rows = document.querySelectorAll('.param-row');
    const term = searchTerm.toLowerCase();
    
    rows.forEach(row => {
        const paramName = row.children[0].textContent.toLowerCase();
        const paramValue = row.children[1].textContent.toLowerCase();
        
        if (paramName.includes(term) || paramValue.includes(term)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function closeModal() {
    document.getElementById('deviceModal').style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('deviceModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
}