import { cmsStyles } from '../components/styles';
import { createHeader, createNavigation, createStatsGrid, createDeviceModal } from '../components/layout';

export function createDashboardPage(username: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TR-069 CMS - Gestión de Dispositivos</title>
    <style>
        ${cmsStyles}
    </style>
</head>
<body>
    ${createHeader(username)}
    
    <div class="app-container">
        ${createNavigation('dashboard')}
        
        <div class="main-content">
            ${createStatsGrid()}
            
            <div class="devices-section">
                <div class="section-header">
                    <h2>Gestión de Dispositivos</h2>
                    <div>
                        <button class="refresh-btn" onclick="loadDevices()">Actualizar</button>
                        <button class="refresh-btn" onclick="discoverAllDevices()" style="margin-left: 0.5rem; background: #28a745;">Discovery Global</button>
                    </div>
                </div>
                
                <div id="devices-content">
                    <div class="loading">Cargando dispositivos...</div>
                </div>
            </div>
        </div>
    </div>
    
    ${createDeviceModal()}
    
    <script src="/cms/scripts/dashboard.js"></script>
</body>
</html>`;
}