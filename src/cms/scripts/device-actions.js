// Device Actions Functions

async function runDiscovery(serial) {
    if (!confirm(`¿Ejecutar discovery completo para el dispositivo ${serial}?\n\nEsto puede tomar varios minutos.`)) return;
    
    try {
        const response = await fetch(`/full-discovery?serial=${encodeURIComponent(serial)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Discovery iniciado para ${serial}\n\n${result.message || 'El proceso puede tomar varios minutos. Los resultados aparecerán automáticamente.'}`);
            loadDevices();
        } else {
            alert(`Error al iniciar discovery: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function connectionRequest(serial) {
    if (!confirm(`¿Enviar connection request al dispositivo ${serial}?`)) return;
    
    try {
        const response = await fetch(`/connection-request?serial=${encodeURIComponent(serial)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Connection request enviado a ${serial}`);
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function pullParams(serial) {
    if (!confirm(`¿Obtener parámetros del dispositivo ${serial}?`)) return;
    
    try {
        const response = await fetch(`/pull-params?serial=${encodeURIComponent(serial)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Solicitud enviada a ${serial}\n\nLos parámetros se actualizarán cuando el dispositivo responda.`);
            loadDevices();
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function rebootDevice(serial) {
    if (!confirm(`⚠️ ¿REINICIAR el dispositivo ${serial}?\n\nEsta acción reiniciará completamente el dispositivo.`)) return;
    
    try {
        const response = await fetch('/queue-method', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                serial,
                method: 'Reboot'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`Comando de reinicio enviado a ${serial}\n\nEl dispositivo se reiniciará en los próximos minutos.`);
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

async function discoverAllDevices() {
    if (!confirm('¿Ejecutar discovery en TODOS los dispositivos conectados?\n\nEsto puede tomar mucho tiempo.')) return;
    
    try {
        const devicesResponse = await fetch('/cms/api/devices');
        const devices = await devicesResponse.json();
        
        let successCount = 0;
        let errorCount = 0;
        
        // devices is an array, not an object
        for (const device of devices) {
            try {
                const response = await fetch(`/full-discovery?serial=${encodeURIComponent(device.serialNumber)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (response.ok) {
                    successCount++;
                } else {
                    errorCount++;
                }
            } catch (error) {
                errorCount++;
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        alert(`Discovery global iniciado:\n\n✅ Exitosos: ${successCount}\n❌ Errores: ${errorCount}`);
        loadDevices();
        
    } catch (error) {
        alert(`Error: ${error.message}`);
    }
}

function configureWiFi(serial) {
    window.open(`/cms/wifi/${serial}`, '_blank');
}

// Navigation functions
function showAllDevices() {
    alert('Función de gestión de dispositivos - En desarrollo');
}

function showDiscovery() {
    alert('Panel de discovery - En desarrollo');
}

function showSettings() {
    alert('Configuración del CMS - En desarrollo');
}