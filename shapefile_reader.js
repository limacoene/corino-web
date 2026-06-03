// ============================================================================
// MÓDULO GIS - LEITOR DE SHAPEFILE (QGIS WEB)
// ============================================================================

let gisDependenciasCarregadas = false;

/**
 * Injeta dinamicamente as bibliotecas Leaflet, ShpJS e Turf.js no documento
 */
async function carregarBibliotecasGIS(silencioso = false) {
    if (gisDependenciasCarregadas) return;
    
    if (!silencioso) {
        mostrarToast('A iniciar Motor GIS...', 'info');
    }

    // Adicionar CSS do Leaflet
    const linkCss = document.createElement('link');
    linkCss.rel = 'stylesheet';
    linkCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(linkCss);

    // Função auxiliar para injetar scripts
    const loadScript = (src) => new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });

    try {
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        await loadScript('https://unpkg.com/shpjs@latest/dist/shp.js');
        await loadScript('https://unpkg.com/@turf/turf@6.5.0/turf.min.js');
        gisDependenciasCarregadas = true;
    } catch (e) {
        mostrarToast('Erro ao carregar bibliotecas de mapeamento.', 'error');
        console.error(e);
    }
}