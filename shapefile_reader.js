// ============================================================================
// MÓDULO GIS - LEITOR DE SHAPEFILE (QGIS WEB)
// ============================================================================

let gisDependenciasCarregadas = false;

/**
 * Injeta dinamicamente as bibliotecas Leaflet, ShpJS, Turf.js, JSZip e Proj4js no documento
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
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.11.0/proj4.js');
        await loadScript('https://unpkg.com/shpjs@latest/dist/shp.js');
        await loadScript('https://unpkg.com/@turf/turf@6.5.0/turf.min.js');
        gisDependenciasCarregadas = true;
    } catch (e) {
        mostrarToast('Erro ao carregar bibliotecas de mapeamento.', 'error');
        console.error(e);
    }
}

/**
 * Retorna a primeira coordenada [lng, lat] encontrada em uma estrutura de coordenadas do GeoJSON
 */
function obterPrimeiraCoordenada(coords, tipo) {
    if (!coords) return null;
    try {
        if (tipo === 'Point') return coords;
        if (tipo === 'MultiPoint' || tipo === 'LineString') return coords[0];
        if (tipo === 'MultiLineString' || tipo === 'Polygon') return coords[0] ? coords[0][0] : null;
        if (tipo === 'MultiPolygon') return coords[0] && coords[0][0] ? coords[0][0][0] : null;
    } catch (e) {
        console.warn('Erro ao obter primeira coordenada:', e);
    }
    return null;
}

/**
 * Detecta se uma feature específica está em coordenadas UTM (métricas)
 */
function verificarSeFeatureEhUTM(feature) {
    if (!feature || !feature.geometry || !feature.geometry.coordinates) return false;
    const coord = obterPrimeiraCoordenada(feature.geometry.coordinates, feature.geometry.type);
    return coord && (Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90);
}

/**
 * Detecta se as coordenadas de um GeoJSON são provavelmente UTM (métricas)
 */
function verificarSeGeoJsonEhUTM(geojson) {
    if (!geojson || !geojson.features || geojson.features.length === 0) return false;
    for (let feature of geojson.features) {
        if (verificarSeFeatureEhUTM(feature)) {
            return true;
        }
    }
    return false;
}

/**
 * Traduz um WKT de projeção contido em um arquivo .prj em uma string de definição Proj4
 */
function parseWktParaProj4(wkt) {
    if (!wkt) return null;
    wkt = String(wkt).trim();
    
    // Se for coordenadas geográficas normais
    if (wkt.includes('GEOGCS') && !wkt.includes('PROJCS')) {
        return '+proj=longlat +datum=WGS84 +no_defs';
    }
    
    // Procurar por parâmetros do Transverse Mercator (UTM)
    const cmMatch = wkt.match(/PARAMETER\s*\[\s*["']central_meridian["']\s*,\s*(-?\d+\.?\d*)\s*\]/i);
    const centralMeridian = cmMatch ? parseFloat(cmMatch[1]) : null;
    
    const feMatch = wkt.match(/PARAMETER\s*\[\s*["']false_easting["']\s*,\s*(-?\d+\.?\d*)\s*\]/i);
    const falseEasting = feMatch ? parseFloat(feMatch[1]) : 500000;
    
    const fnMatch = wkt.match(/PARAMETER\s*\[\s*["']false_northing["']\s*,\s*(-?\d+\.?\d*)\s*\]/i);
    const falseNorthing = fnMatch ? parseFloat(fnMatch[1]) : 0;
    
    const sfMatch = wkt.match(/PARAMETER\s*\[\s*["']scale_factor["']\s*,\s*(-?\d+\.?\d*)\s*\]/i);
    const scaleFactor = sfMatch ? parseFloat(sfMatch[1]) : 0.9996;
    
    const latMatch = wkt.match(/PARAMETER\s*\[\s*["']latitude_of_origin["']\s*,\s*(-?\d+\.?\d*)\s*\]/i);
    const latOrigin = latMatch ? parseFloat(latMatch[1]) : 0;
    
    if (centralMeridian === null) return null;
    
    // Determinar o datum (SIRGAS 2000 é o oficial do Brasil, SAD69 é legado)
    let datumPart = '+ellps=GRS80 +towgs84=0,0,0,0,0,0,0';
    const upperWkt = wkt.toUpperCase();
    if (upperWkt.includes('SAD') || upperWkt.includes('SOUTH_AMERICAN_1969')) {
        datumPart = '+ellps=aust_SA +towgs84=-57,1,-41,0,0,0,0'; // SAD69 -> WGS84
    } else if (upperWkt.includes('WGS_1984') || upperWkt.includes('WGS84')) {
        datumPart = '+ellps=WGS84 +datum=WGS84';
    }
    
    if (upperWkt.includes('TRANSVERSE_MERCATOR') || upperWkt.includes('TMERC')) {
        return `+proj=tmerc +lat_0=${latOrigin} +lon_0=${centralMeridian} +k=${scaleFactor} +x_0=${falseEasting} +y_0=${falseNorthing} ${datumPart} +units=m +no_defs`;
    }
    
    return null;
}

/**
 * Lista de municípios de MS que estão predominantemente no Fuso 22S (meridiano central -51)
 */
const MUNICIPIOS_MS_FUSO_22S = [
    'TRES LAGOAS', 'TRÊS LAGOAS', 'PARANAIBA', 'PARANAÍBA', 'CASSILANDIA', 'CASSILÂNDIA',
    'CHAPADAO DO SUL', 'CHAPADÃO DO SUL', 'APARECIDA DO TABOADO', 'INOCENCIA', 'INOCÊNCIA',
    'SELVIRIA', 'SELVÍRIA', 'AGUA CLARA', 'ÁGUA CLARA', 'BRASILANDIA', 'BRASILÂNDIA',
    'SANTA RITA DO PARDO', 'BATAGUASSU', 'NOVA ANDRADINA', 'ANAURILANDIA', 'ANAURILÂNDIA',
    'BATAIPORA', 'BATAIPORÃ', 'TAQUARUSSU', 'TAQUARUSSÚ', 'IVINHEMA', 'ANGELICA', 'ANGÉLICA',
    'NOVO HORIZONTE DO SUL'
];

/**
 * Tenta adivinhar a string de projeção UTM com base no município do registro
 */
function obterProjecaoPadraoMatoGrossoDoSul(municipio) {
    if (municipio) {
        const munNorm = String(municipio).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        // Verifica se é algum dos municípios do Leste (Fuso 22S)
        const ehFuso22 = MUNICIPIOS_MS_FUSO_22S.some(m => {
            const mNorm = m.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            return munNorm.includes(mNorm);
        });
        if (ehFuso22) {
            console.log(`[GIS] Município '${municipio}' mapeado para o fuso UTM 22S (EPSG:31982)`);
            return '+proj=utm +zone=22 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
        }
    }
    // Default para Fuso 21S (Mato Grosso do Sul centro/oeste, Campo Grande)
    console.log(`[GIS] Município '${municipio || 'N/A'}' mapeado para o fuso UTM 21S (EPSG:31981)`);
    return '+proj=utm +zone=21 +south +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
}

/**
 * Reprojeta um GeoJSON de UTM para WGS84
 */
function reprojetarGeoJson(geojson, fromProjStr) {
    if (!geojson || !window.proj4) return geojson;
    
    function projectPoint(coord) {
        try {
            return proj4(fromProjStr, 'EPSG:4326', coord);
        } catch (e) {
            console.error('Erro ao reprojetar ponto:', coord, e);
            return coord;
        }
    }
    
    function processCoordinates(coords, type) {
        if (type === 'Point') {
            return projectPoint(coords);
        } else if (type === 'MultiPoint' || type === 'LineString') {
            return coords.map(projectPoint);
        } else if (type === 'MultiLineString' || type === 'Polygon') {
            return coords.map(ring => ring.map(projectPoint));
        } else if (type === 'MultiPolygon') {
            return coords.map(poly => poly.map(ring => ring.map(projectPoint)));
        }
        return coords;
    }
    
    if (geojson.type === 'FeatureCollection') {
        geojson.features.forEach(f => {
            if (f.geometry && f.geometry.coordinates) {
                if (verificarSeFeatureEhUTM(f)) {
                    f.geometry.coordinates = processCoordinates(f.geometry.coordinates, f.geometry.type);
                }
            }
        });
    } else if (geojson.type === 'Feature') {
        if (geojson.geometry && geojson.geometry.coordinates) {
            if (verificarSeFeatureEhUTM(geojson)) {
                geojson.geometry.coordinates = processCoordinates(geojson.geometry.coordinates, geojson.geometry.type);
            }
        }
    } else if (geojson.geometry && geojson.geometry.coordinates) {
        const coord = obterPrimeiraCoordenada(geojson.geometry.coordinates, geojson.geometry.type);
        const ehUtm = coord && (Math.abs(coord[0]) > 180 || Math.abs(coord[1]) > 90);
        if (ehUtm) {
            geojson.coordinates = processCoordinates(geojson.geometry.coordinates, geojson.geometry.type);
        }
    }
    
    return geojson;
}

/**
 * Função principal que processa o buffer do shapefile ZIP, extrai o .prj e corrige a projeção do GeoJSON se necessário
 */
async function normalizarProjecaoShapefile(buffer, geojson, municipio = '') {
    if (!verificarSeGeoJsonEhUTM(geojson)) {
        console.log('[GIS] Shapefile já está em coordenadas geográficas (WGS84).');
        return geojson;
    }
    
    console.log('[GIS] Detectado coordenadas UTM. Iniciando reprojeção...');
    let projStr = null;
    
    // Tenta ler o arquivo .prj do ZIP usando JSZip
    if (window.JSZip) {
        try {
            const zip = await JSZip.loadAsync(buffer);
            let prjFilename = null;
            
            // Procura o primeiro arquivo .prj
            for (let relativePath in zip.files) {
                if (relativePath.toLowerCase().endsWith('.prj')) {
                    prjFilename = relativePath;
                    break;
                }
            }
            
            if (prjFilename) {
                const wkt = await zip.file(prjFilename).async('text');
                console.log('[GIS] Encontrado arquivo .prj:', prjFilename, wkt);
                projStr = parseWktParaProj4(wkt);
                if (projStr) {
                    console.log('[GIS] Projeção interpretada com sucesso do .prj:', projStr);
                } else {
                    console.warn('[GIS] Não foi possível mapear o WKT do .prj para Proj4. Usando fallback...');
                }
            } else {
                console.log('[GIS] Nenhum arquivo .prj encontrado no ZIP.');
            }
        } catch (e) {
            console.error('[GIS] Erro ao extrair .prj do zip:', e);
        }
    }
    
    // Fallback: se não encontrou ou falhou em interpretar o .prj, deduz pelo município
    if (!projStr) {
        projStr = obterProjecaoPadraoMatoGrossoDoSul(municipio);
    }
    
    // Executa a reprojeção
    return reprojetarGeoJson(geojson, projStr);
}