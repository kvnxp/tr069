// CMS CSS Styles
export const cmsStyles = `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background: #f5f7fa;
}

.header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.header h1 {
    font-size: 1.5rem;
}

.header .user-info {
    display: flex;
    align-items: center;
    gap: 1rem;
}

.logout-btn {
    background: rgba(255,255,255,0.2);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    font-size: 0.9rem;
}

.logout-btn:hover {
    background: rgba(255,255,255,0.3);
}

.main-content {
    padding: 2rem;
}

.nav-menu {
    background: white;
    padding: 0;
    margin-bottom: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow: hidden;
}

.nav-menu ul {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
}

.nav-menu li {
    flex: 1;
}

.nav-menu a {
    display: block;
    padding: 1rem 1.5rem;
    text-decoration: none;
    color: #666;
    border-right: 1px solid #e9ecef;
    text-align: center;
    transition: all 0.3s;
}

.nav-menu li:last-child a {
    border-right: none;
}

.nav-menu a:hover, .nav-menu a.active {
    background: #667eea;
    color: white;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}

.stat-card {
    background: white;
    padding: 1.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    text-align: center;
}

.stat-card h3 {
    color: #333;
    font-size: 2rem;
    margin-bottom: 0.5rem;
}

.stat-card p {
    color: #666;
    font-size: 0.9rem;
}

.devices-section {
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    overflow: hidden;
}

.section-header {
    background: #f8f9fa;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.section-header h2 {
    color: #333;
    font-size: 1.2rem;
}

.refresh-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
}

.refresh-btn:hover {
    background: #5a67d8;
}

.devices-table {
    width: 100%;
    border-collapse: collapse;
}

.devices-table th,
.devices-table td {
    padding: 1rem 1.5rem;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
}

.devices-table th {
    background: #f8f9fa;
    font-weight: 600;
    color: #333;
}

.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
}

.status-online {
    background: #d4edda;
    color: #155724;
}

.status-offline {
    background: #f8d7da;
    color: #721c24;
}

.device-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.btn {
    padding: 0.4rem 0.8rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}

.btn-primary {
    background: #667eea;
    color: white;
}

.btn-secondary {
    background: #6c757d;
    color: white;
}

.btn-success {
    background: #28a745;
    color: white;
}

.btn-warning {
    background: #ffc107;
    color: #212529;
}

.btn-danger {
    background: #dc3545;
    color: white;
}

.btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}

.modal {
    display: none;
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
}

.modal-content {
    background: white;
    margin: 5% auto;
    padding: 2rem;
    border-radius: 8px;
    width: 90%;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e9ecef;
}

.modal-header h3 {
    margin: 0;
    color: #333;
}

.close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #666;
}

.close:hover {
    color: #000;
}

.params-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}

.params-table th,
.params-table td {
    padding: 0.5rem;
    text-align: left;
    border-bottom: 1px solid #e9ecef;
    font-size: 0.9rem;
}

.params-table th {
    background: #f8f9fa;
    font-weight: 600;
}

.param-value {
    max-width: 200px;
    word-break: break-all;
    font-family: monospace;
    font-size: 0.8rem;
}

.loading {
    text-align: center;
    padding: 2rem;
    color: #666;
}

.loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
    display: inline-block;
    margin-right: 0.5rem;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.no-devices {
    text-align: center;
    padding: 3rem;
    color: #666;
}

.no-devices h3 {
    margin-bottom: 1rem;
    color: #333;
}
`;