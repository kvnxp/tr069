# CMS Styles Reference

Este archivo documenta todos los estilos CSS utilizados en el sistema CMS de TR-069.

## 📋 Índice
- [Layout Principal](#layout-principal)
- [Header](#header)
- [Barra Lateral](#barra-lateral)
- [Contenido Principal](#contenido-principal)
- [Tablas](#tablas)
- [Botones](#botones)
- [Modales](#modales)
- [Estados y Badges](#estados-y-badges)
- [Utilidades](#utilidades)

## 🏗️ Layout Principal

### Estructura Base
- **Reset CSS**: Elimina márgenes y paddings por defecto
- **Box-sizing**: `border-box` para todos los elementos
- **Fuente**: Segoe UI, Tahoma, Geneva, Verdana, sans-serif
- **Fondo**: `#f5f7fa` (gris claro)

### Container Principal
```css
.app-container {
    display: flex;
    min-height: calc(100vh - 70px);
}
```

## 🎯 Header

### Estructura
- **Posición**: Fija en la parte superior
- **Altura**: 70px
- **Fondo**: Gradiente linear `#667eea` a `#764ba2`
- **Z-index**: 1000

### Elementos
- **Título**: TR-069 CMS
- **Info de Usuario**: Alineado a la derecha
- **Botón Logout**: Con hover transparente

## 📋 Barra Lateral

### Sidebar Principal
```css
.sidebar {
    width: 260px;
    background: #2c3e50;
    position: fixed;
    left: 0;
    top: 70px;
    height: calc(100vh - 70px);
}
```

### Header de Sidebar
- **Fondo**: `#34495e`
- **Padding**: 1.5rem
- **Borde inferior**: `#3d566e`

### Enlaces de Navegación
- **Color normal**: `#bdc3c7`
- **Color hover**: `white` con fondo `#34495e`
- **Color activo**: `white` con fondo `#667eea`
- **Borde izquierdo**: Indicador de 3px en hover/activo

## 📄 Contenido Principal

### Main Content
```css
.main-content {
    margin-left: 260px;
    padding: 2rem;
    width: calc(100% - 260px);
    min-height: calc(100vh - 70px);
}
```

### Stats Grid
```css
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1.5rem;
    margin-bottom: 2rem;
}
```

### Tarjetas de Estadísticas
- **Fondo**: Blanco
- **Sombra**: `0 2px 10px rgba(0,0,0,0.1)`
- **Border-radius**: 8px
- **Padding**: 1.5rem

## 📊 Tablas

### Tabla de Dispositivos
```css
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
```

### Header de Tabla
- **Fondo**: `#f8f9fa`
- **Font-weight**: 600
- **Color**: `#333`

### Tabla de Parámetros
```css
.params-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
}
```

## 🔘 Botones

### Clases Base
```css
.btn {
    padding: 0.4rem 0.8rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.8rem;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
}
```

### Variantes de Color
- **Primary**: `#667eea` (Azul principal)
- **Secondary**: `#6c757d` (Gris)
- **Success**: `#28a745` (Verde)
- **Warning**: `#ffc107` (Amarillo)
- **Danger**: `#dc3545` (Rojo)

### Efectos Hover
```css
.btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
}
```

### Botón Refresh
```css
.refresh-btn {
    background: #667eea;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
}
```

## 🪟 Modales

### Estructura Modal
```css
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
```

### Contenido Modal
```css
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
```

### Header Modal
- **Display**: Flex con justify-content space-between
- **Border-bottom**: `1px solid #e9ecef`
- **Padding-bottom**: 1rem

## 🏷️ Estados y Badges

### Status Badge Base
```css
.status-badge {
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
}
```

### Estados de Conexión
```css
.status-online {
    background: #d4edda;
    color: #155724;
}

.status-offline {
    background: #f8d7da;
    color: #721c24;
}
```

## 🔧 Utilidades

### Loading Spinner
```css
.loading-spinner {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #667eea;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
```

### No Devices State
```css
.no-devices {
    text-align: center;
    padding: 3rem;
    color: #666;
}
```

### Actions Container
```css
.device-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}
```

## 📱 Responsive Design

### WiFi Config Page
- **Formularios**: Grid responsivo con minmax(300px, 1fr)
- **Form Groups**: Margin-bottom de 1rem
- **Inputs**: Width 100% con padding 0.75rem
- **Focus States**: Border-color `#667eea`

## 🎨 Paleta de Colores

### Colores Principales
- **Azul Principal**: `#667eea`
- **Azul Hover**: `#5a67d8`
- **Sidebar**: `#2c3e50`
- **Sidebar Header**: `#34495e`

### Colores de Estado
- **Success**: `#28a745`
- **Warning**: `#ffc107`
- **Danger**: `#dc3545`
- **Info**: `#17a2b8`

### Colores Neutros
- **Fondo**: `#f5f7fa`
- **Blanco**: `#ffffff`
- **Gris Claro**: `#f8f9fa`
- **Gris Medio**: `#6c757d`
- **Gris Oscuro**: `#333`
- **Bordes**: `#e9ecef`

## 📐 Espaciado

### Padding Estándar
- **Pequeño**: 0.5rem
- **Medio**: 1rem
- **Grande**: 1.5rem
- **Extra Grande**: 2rem

### Margins
- **Entre secciones**: 2rem
- **Entre elementos**: 1rem
- **Entre botones**: 0.5rem

## 🔤 Tipografía

### Tamaños de Fuente
- **H1**: 1.5rem
- **H2**: 1.2rem
- **H3**: 1.1rem
- **Normal**: 1rem (16px)
- **Pequeño**: 0.9rem
- **Muy pequeño**: 0.8rem

### Pesos de Fuente
- **Normal**: 400
- **Medium**: 500
- **Semibold**: 600

## 📦 Componentes Reutilizables

### Section Header
```css
.section-header {
    background: #f8f9fa;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e9ecef;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
```

### Error/Success Messages
```css
.error-message {
    background: #fee;
    color: #c33;
    padding: 1rem;
    border-radius: 6px;
    border-left: 4px solid #c33;
}

.success-message {
    background: #efe;
    color: #3c763d;
    padding: 1rem;
    border-radius: 6px;
    border-left: 4px solid #3c763d;
}
```

---

## 💡 Notas de Implementación

1. **Box Shadow Estándar**: `0 2px 10px rgba(0,0,0,0.1)`
2. **Border Radius Estándar**: 8px para contenedores, 4px para botones
3. **Transiciones**: `all 0.3s ease` para hover effects
4. **Z-index**: Header (1000), Sidebar (100), Modal (1000)
5. **Fuente Monospace**: Para valores de parámetros y códigos