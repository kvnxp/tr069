import { cmsStyles } from '../components/styles';
import { createHeader } from '../components/layout';

export function createWiFiConfigPage(serial: string): string {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TR-069 CMS - Configuración WiFi</title>
    <style>
        ${cmsStyles}
        
        .config-section {
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
            overflow: hidden;
        }
        
        .config-form {
            padding: 1.5rem;
        }
        
        .form-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: #333;
            font-weight: 500;
        }
        
        .form-group input,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            border: 2px solid #e1e5e9;
            border-radius: 6px;
            font-size: 1rem;
            transition: border-color 0.3s;
        }
        
        .form-group input:focus,
        .form-group select:focus {
            outline: none;
            border-color: #667eea;
        }
        
        .error-message {
            background: #fee;
            color: #c33;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            border-left: 4px solid #c33;
        }
        
        .success-message {
            background: #efe;
            color: #3c763d;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            border-left: 4px solid #3c763d;
        }
        
        .wifi-network {
            border: 1px solid #e9ecef;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1rem;
        }
        
        .wifi-network h3 {
            color: #333;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .status-indicator {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #28a745;
        }
        
        .status-indicator.disabled {
            background: #dc3545;
        }
    </style>
</head>
<body>
    ${createHeader('Admin').replace('TR-069 CMS', `Configuración WiFi - ${serial}`).replace('/cms/logout', '/cms/dashboard')}
    
    <div class="main-content">
        <div id="loading" class="loading">
            <div>Cargando configuración WiFi...</div>
        </div>
        
        <div id="wifi-config" style="display: none;">
            <!-- WiFi networks will be loaded here -->
        </div>
    </div>
    
    <script src="/cms/scripts/wifi-config.js"></script>
    <script>
        const deviceSerial = '${serial}';
    </script>
    <script src="/cms/scripts/wifi-config.js"></script>
</body>
</html>`;
}