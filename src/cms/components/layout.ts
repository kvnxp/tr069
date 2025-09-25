// CMS Layout Components
export interface LayoutProps {
  title: string;
  username?: string;
  currentPage?: string;
}

export function createHeader(username: string): string {
  return `
    <div class="header">
        <h1>TR-069 CMS</h1>
        <div class="user-info">
            <span>Bienvenido, ${username}</span>
            <a href="/cms/logout" class="logout-btn">Cerrar Sesión</a>
        </div>
    </div>
  `;
}

export function createNavigation(currentPage = 'dashboard'): string {
  const pages = [
    { id: 'dashboard', url: '/cms/dashboard', icon: '📊', title: 'Dashboard' },
    { id: 'devices', url: '#', icon: '📱', title: 'Dispositivos', onclick: 'showAllDevices()' },
    { id: 'discovery', url: '#', icon: '🔍', title: 'Discovery', onclick: 'showDiscovery()' },
    { id: 'settings', url: '#', icon: '⚙️', title: 'Configuración', onclick: 'showSettings()' }
  ];

  return `
    <nav class="sidebar">
        <div class="sidebar-header">
            <h3>💻 TR-069 CMS</h3>
        </div>
        <ul class="sidebar-menu">
            ${pages.map(page => `
                <li>
                    <a href="${page.url}" 
                       class="sidebar-link ${page.id === currentPage ? 'active' : ''}"
                       ${page.onclick ? `onclick="${page.onclick}"` : ''}>
                        <span class="sidebar-icon">${page.icon}</span>
                        <span class="sidebar-text">${page.title}</span>
                    </a>
                </li>
            `).join('')}
        </ul>
    </nav>
  `;
}

export function createStatsGrid(): string {
  return `
    <div class="stats-grid">
        <div class="stat-card">
            <h3 id="total-devices">-</h3>
            <p>Dispositivos Totales</p>
        </div>
        <div class="stat-card">
            <h3 id="online-devices">-</h3>
            <p>Dispositivos Conectados</p>
        </div>
        <div class="stat-card">
            <h3 id="last-inform">-</h3>
            <p>Último Inform</p>
        </div>
    </div>
  `;
}

export function createDeviceModal(): string {
  return `
    <div id="deviceModal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="modalTitle">Detalles del Dispositivo</h3>
                <button class="close" onclick="closeModal()">&times;</button>
            </div>
            <div id="modalBody">
                <div class="loading">Cargando detalles...</div>
            </div>
        </div>
    </div>
  `;
}