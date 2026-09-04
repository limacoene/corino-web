// ============================================================================
// MÓDULO: CARTAS CONSULTA
// ============================================================================

let dadosCartasGlobais = [];
let cartasCarregadas = false;
let cartasExibidas = [];
const cacheShapesCartas = {};

// ============================================================================
// CADASTRO DE CARTA CONSULTA
// ============================================================================

/**
 * Abre o modal de cadastro de nova Carta Consulta e popula o select de técnicos
 */
function abrirModalCadastroCarta() {
    document.getElementById('cadastroCartaModal').style.display = 'flex';

    // Popula o select de técnicos a partir da lista global dos Autos
    const selectTec = document.getElementById('cadCartaTecnico');
    if (selectTec) {
        selectTec.innerHTML = '<option value="">-- Sem Técnico --</option>';
        if (typeof opcoesAutoTecnico !== 'undefined' && Array.isArray(opcoesAutoTecnico)) {
            opcoesAutoTecnico.forEach(tec => {
                const opt = document.createElement('option');
                opt.value = tec;
                opt.textContent = tec;
                selectTec.appendChild(opt);
            });
        }
    }

    // Inicializa o flatpickr no campo de data
    if (typeof flatpickr !== 'undefined') {
        flatpickr('.date-picker-carta', {
            locale: 'pt',
            dateFormat: 'd/m/Y',
            allowInput: true,
            defaultDate: new Date()
        });
    }
}

/**
 * Atualiza o nome do ficheiro Shapefile selecionado no campo de upload
 */
function updateFileNameCartaShape(input) {
    const label = document.getElementById('cadCartaShapeLabel');
    if (!label) return;
    const textSpan = label.querySelector('.upload-text');
    if (input.files && input.files.length > 0) {
        if (textSpan) textSpan.innerText = `🗺️ ${input.files[0].name}`;
        label.classList.add('has-file');
    } else {
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro ZIP';
        label.classList.remove('has-file');
    }
}

/**
 * Fecha e limpa o modal de cadastro de Carta Consulta
 */
function fecharModalCadastroCarta() {
    document.getElementById('cadastroCartaModal').style.display = 'none';
    if (typeof fecharModalCadastroUnificado === 'function') fecharModalCadastroUnificado();
    ['cadCartaNup', 'cadCartaDataRepasse', 'cadCartaPrazo', 'cadCartaRequerente', 'cadCartaGerencia',
     'cadCartaPrioridade', 'cadCartaFisico', 'cadCartaTecnico', 'cadCartaStatus',
     'cadCartaTramitado', 'cadCartaObs', 'cadCartaArquivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Reset label do upload
    const label = document.getElementById('cadCartaArquivoLabel');
    if (label) {
        label.classList.remove('has-file');
        const textSpan = label.querySelector('.upload-text');
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
    }
    
    const labelShape = document.getElementById('cadCartaShapeLabel');
    if (labelShape) {
        labelShape.classList.remove('has-file');
        const textSpanShape = labelShape.querySelector('.upload-text');
        if (textSpanShape) textSpanShape.innerText = 'Clique para selecionar ou arraste o ficheiro ZIP';
    }
    const inputShape = document.getElementById('cadCartaShape');
    if (inputShape) inputShape.value = '';
}

/**
 * Atualiza o nome do ficheiro selecionado no campo de upload
 */
function updateFileNameCarta(input) {
    const label = document.getElementById('cadCartaArquivoLabel');
    if (!label) return;
    const textSpan = label.querySelector('.upload-text');
    if (input.files && input.files.length > 0) {
        if (textSpan) textSpan.innerText = `📄 ${input.files[0].name}`;
        label.classList.add('has-file');
    } else {
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
        label.classList.remove('has-file');
    }
}

/**
 * Salva a nova Carta Consulta — optimistic update local + sincronização em background
 */
async function salvarNovaCarta() {
    const nup = document.getElementById('cadCartaNup').value.trim();
    const dataRepasse = document.getElementById('cadCartaDataRepasse').value.trim();
    const requerente = document.getElementById('cadCartaRequerente').value.trim();
    const gerencia = document.getElementById('cadCartaGerencia').value.trim();

    if (!nup || !dataRepasse || !requerente || !gerencia) {
        mostrarToast('NUP, Data do Repasse, Requerente e Gerência são obrigatórios!', 'error');
        return;
    }

    const btn = document.getElementById('btnSalvarCadastroCarta');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...';
    btn.disabled = true;

    // Leitura do ficheiro PDF se existir
    const fileInput = document.getElementById('cadCartaArquivo');
    let base64File = null;
    let fileName = null;
    let gcsUriPdf = null;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 25 * 1024 * 1024) {
            mostrarToast('O ficheiro deve ter no máximo 25MB.', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            return;
        }
        fileName = file.name;

        // 1. Upload Seguro no GCS
        if (typeof GCSStorage !== 'undefined') {
            try {
                const gcsRes = await GCSStorage.fazerUpload(file, {
                    modulo: 'cartas',
                    nup: nup,
                    nomePersonalizado: `Carta_Consulta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
                    username: usuarioAtivo ? usuarioAtivo.username : 'sistema'
                });
                if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                    gcsUriPdf = gcsRes.fullGcsUri || gcsRes.gcsPath;
                }
            } catch (gcsErr) {
                console.warn('⚠️ [GCS] Fallback para envio base64:', gcsErr.message);
            }
        }

        if (!gcsUriPdf) {
            try {
                base64File = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                    reader.onerror = (e) => reject(e);
                    reader.readAsDataURL(file);
                });
            } catch (e) {
                mostrarToast('Erro ao ler o ficheiro.', 'error');
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                return;
            }
        }
    }

    // Leitura do ficheiro Shapefile (ZIP)
    const shapeInput = document.getElementById('cadCartaShape');
    let base64Shape = null;
    let shapeName = null;
    let gcsUriShape = null;

    if (shapeInput && shapeInput.files.length > 0) {
        const fileShape = shapeInput.files[0];
        if (fileShape.size > 30 * 1024 * 1024) {
            mostrarToast('O Shapefile deve ter no máximo 30MB.', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            return;
        }
        shapeName = fileShape.name;

        // Upload Shapefile no GCS
        if (typeof GCSStorage !== 'undefined') {
            try {
                const gcsRes = await GCSStorage.fazerUpload(fileShape, {
                    modulo: 'cartas',
                    nup: nup,
                    nomePersonalizado: `Shapefile_Carta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.zip`,
                    username: usuarioAtivo ? usuarioAtivo.username : 'sistema'
                });
                if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                    gcsUriShape = gcsRes.fullGcsUri || gcsRes.gcsPath;
                }
            } catch (gcsErr) {
                console.warn('⚠️ [GCS] Fallback shapefile base64:', gcsErr.message);
            }
        }

        if (!gcsUriShape) {
            try {
                base64Shape = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                    reader.onerror = (e) => reject(e);
                    reader.readAsDataURL(fileShape);
                });
            } catch (e) {
                mostrarToast('Erro ao ler o Shapefile.', 'error');
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                return;
            }
        }
    }

    const prazoVal = document.getElementById('cadCartaPrazo').value.trim();

    const payload = {
        acao: 'cadastrar_carta',
        nup: nup,
        data_repasse: document.getElementById('cadCartaDataRepasse').value.trim(),
        prazo: prazoVal,
        requerente: requerente,
        gerencia: gerencia,
        prioridade: document.getElementById('cadCartaPrioridade').value,
        fisico_ems: document.getElementById('cadCartaFisico').value,
        tecnico: document.getElementById('cadCartaTecnico').value,
        status: document.getElementById('cadCartaStatus').value,
        tramitado_para: document.getElementById('cadCartaTramitado').value.trim(),
        observacao: document.getElementById('cadCartaObs').value.trim(),
        base64: base64File,
        fileName: fileName,
        url_arquivo: gcsUriPdf,
        linkGcs: gcsUriPdf,
        base64Shape: base64Shape,
        fileNameShape: shapeName,
        url_shapefile: gcsUriShape
    };

    // Calcular dias restantes inicial para a inserção otimista
    const diasRestantes = (payload.data_repasse && payload.prazo) ? calcularDiasRestantes(payload.data_repasse, payload.prazo) : '-';

    // Optimistic update: insere localmente de imediato
    const novoItem = {
        'NUP': payload.nup,
        'DATA DO REPASSE': payload.data_repasse,
        'PRAZO': payload.prazo,
        'DIAS RESTANTES': isNaN(diasRestantes) ? '-' : String(diasRestantes),
        'REQUERENTE': payload.requerente,
        'GERÊNCIA': payload.gerencia,
        'PRIORIDADE': payload.prioridade,
        'FÍSICO/E-MS': payload.fisico_ems,
        'TÉCNICO/ADM': payload.tecnico || 'Não atribuído',
        'STATUS': payload.status,
        'TRAMITADO P/': payload.tramitado_para,
        'OBSERVAÇÃO': payload.observacao,
        'LINK DO NUP': gcsUriPdf || '',
        'LINK SHAPEFILE': gcsUriShape || ''
    };

    dadosCartasGlobais.unshift(novoItem);
    atualizarCacheCartas();
    fecharModalCadastroCarta();
    aplicarFiltrosCartas();
    mostrarToast('Carta lançada localmente. Sincronizando com a nuvem...', 'success');
    btn.innerHTML = textoOriginal;
    btn.disabled = false;

    // Sincronização em background com Google Apps Script
    try {
        const resposta = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Carta Consulta sincronizada no Google Cloud Storage (LGPD)! ✅', 'success');
            if (resultado.url || gcsUriPdf) {
                novoItem['LINK DO NUP'] = gcsUriPdf || resultado.url;
            }
            if (resultado.shapeUrl || gcsUriShape) {
                novoItem['LINK SHAPEFILE'] = gcsUriShape || resultado.shapeUrl;
            }
            atualizarCacheCartas();
            aplicarFiltrosCartas();
        } else {
            mostrarToast('Erro ao sincronizar: ' + resultado.message, 'error');
            dadosCartasGlobais = dadosCartasGlobais.filter(item => item !== novoItem);
            atualizarCacheCartas();
            aplicarFiltrosCartas();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Falha na ligação. Carta revertida.', 'error');
        dadosCartasGlobais = dadosCartasGlobais.filter(item => item !== novoItem);
        atualizarCacheCartas();
        aplicarFiltrosCartas();
    }
}



/**
 * Parseia uma linha de CSV contendo aspas e vírgulas internas de forma robusta.
 */
function parseCSVLine(line) {
    const result = [];
    let curVal = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(curVal.trim());
            curVal = '';
        } else {
            curVal += char;
        }
    }
    result.push(curVal.trim());
    return result;
}

/**
 * Normaliza o status das Cartas Consulta para o padrão do painel de filtros
 */
function normalizarStatusCartas(status) {
    if (!status) return 'AGUARDANDO DISTRIBUIÇÃO';
    const s = String(status).toUpperCase();
    if (s.includes('DISTRIBUIÇÃO') || s.includes('1-')) {
        return 'AGUARDANDO DISTRIBUIÇÃO';
    }
    if (s.includes('MANIFESTAÇÃO') || s.includes('2-')) {
        return 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }
    if (s.includes('REVISÃO') || s.includes('REVISAO')) {
        return 'REVISÃO';
    }
    if (s.includes('ASSINATURA') || s.includes('3-')) {
        return 'AGUARDANDO ASSINATURA';
    }
    if (s.includes('TRAMITADO') || s.includes('4-')) {
        return 'TRAMITADO';
    }
    return status.trim();
}

/**
 * Normaliza o grau de prioridade para o padrão do painel de filtros
 */
function normalizarPrioridadeCartas(prioridade) {
    if (!prioridade) return '2- NÃO SE APLICA';
    const p = String(prioridade).toUpperCase();
    if (p.includes('1-') || p.includes('PREFERENCIAL')) {
        return '1- PREFERENCIAL - ACIMA DE 60 ANOS';
    }
    if (p.includes('3-') || p.includes('URGENTE')) {
        return '3- URGENTE';
    }
    return '2- NÃO SE APLICA';
}

function atualizarCacheCartas() {
    const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
    const keyCartas = `corino_cache_dados_cartas_${username}`;
    localStorage.setItem(keyCartas, JSON.stringify(dadosCartasGlobais));
    if (typeof atualizarBadgesNotificacao === 'function') {
        atualizarBadgesNotificacao(dadosCoringa);
    }
    if (typeof window.limparCacheHistoricoGlobal === 'function') window.limparCacheHistoricoGlobal();
}

function processarCSVTextCartas(csvText) {
    const lines = csvText.split('\n');
    let headerIndex = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('DATA DO REPASSE') && lines[i].includes('NUP')) {
            headerIndex = i;
            break;
        }
    }

    if (headerIndex === -1) {
        throw new Error("Cabeçalhos da planilha de Cartas Consulta não encontrados.");
    }

    const headers = parseCSVLine(lines[headerIndex]);
    const rows = [];

    for (let i = headerIndex + 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseCSVLine(line);
        if (cols.length < 2) continue;

        const row = {};
        headers.forEach((header, index) => {
            if (header) {
                let val = cols[index] || '';
                if (val.startsWith('"') && val.endsWith('"')) {
                    val = val.substring(1, val.length - 1).replace(/""/g, '"');
                }
                row[header] = val.trim();
            }
        });

        // Ignorar linhas em branco da planilha
        if (!row['NUP'] && !row['REQUERENTE']) {
            continue;
        }

        // Normalizações obrigatórias para compatibilidade de chaves e filtros robustos
        row['GERÊNCIA'] = row['GERÊNCIA'] || row['GERENCIA'] || '-';
        row['PRIORIDADE'] = normalizarPrioridadeCartas(row['GRAU DE PRIORIDADE (1/2/3)'] || row['GRAU DE PRIORIDADE'] || row['PRIORIDADE']);
        row['STATUS'] = normalizarStatusCartas(row['STATUS']);
        row['FÍSICO/E-MS'] = row['FISICO/E-MS'] || row['FÍSICO/E-MS'] || '-';
        row['TÉCNICO/ADM'] = row['TÉCNICO/ADMIN'] || row['TECNICO/ADMIN'] || row['TÉCNICO/ADM'] || row['TECNICO/ADM'] || row['TÉCNICO'] || 'Não atribuído';
        row['OBSERVAÇÃO'] = row['OBSERVAÇÃO'] || row['OBSERVAÇÕES'] || '-';
        row['LINK DO NUP'] = row['LINK DO NUP'] || row['LINK_NUP'] || '';
        row['LINK DA RESPOSTA'] = row['LINK DA RESPOSTA'] || row['LINK_RESPOSTA'] || '';
        row['LINK DA MANIFESTAÇÃO'] = row['LINK DA MANIFESTAÇÃO'] || row['LINK_MANIFESTACAO'] || row['LINK DA RESPOSTA'] || '';
        row['LINK DA DECLARAÇÃO'] = row['LINK DA DECLARAÇÃO'] || row['LINK_DECLARACAO'] || '';
        row['STATUS DA RESPOSTA'] = row['STATUS DA RESPOSTA'] || row['STATUS_RESPOSTA'] || row['STATUS-RESPOSTA'] || '';
        row['LINK SHAPEFILE'] = row['LINK SHAPEFILE'] || row['LINK_SHAPEFILE'] || '';
        row['MOTIVO DA AVALIAÇÃO'] = row['MOTIVO DA RECUSA'] || row['MOTIVO DA AVALIAÇÃO'] || row['MOTIVO_AVALIACAO'] || '';
        row['CARMS'] = row['Número do CARMS'] || row['NUMERO DO CARMS'] || row['NÚMERO DO CARMS'] || row['CARMS'] || '-';

        // Se tem resposta anexada e o status da resposta não é APROVADO, e o status geral ainda é AGUARDANDO MANIFESTAÇÃO TÉCNICA,
        // movemos para REVISÃO para constar corretamente na aba de Aguardando Revisão e sair de Em Andamento.
        const linkResposta = row['LINK DA RESPOSTA'] || row['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        const statusGeral = (row['STATUS'] || '').toUpperCase().trim();
        const statusResp = (row['STATUS DA RESPOSTA'] || '').toUpperCase().trim();

        if (hasResposta && statusResp !== 'APROVADO' && statusResp !== 'REPROVADO' && (statusGeral === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusGeral === 'AGUARDANDO MANIFESTACAO TECNICA')) {
            row['STATUS'] = 'REVISÃO';
        }

        // Se a resposta está APROVADA mas o status geral ainda diz AGUARDANDO MANIFESTAÇÃO TÉCNICA ou REVISÃO,
        // movemos automaticamente para FAZER DESPACHO no frontend para evitar inconsistências de dados históricos.
        const statusGeralNovo = (row['STATUS'] || '').toUpperCase().trim();
        if (statusResp === 'APROVADO' && (statusGeralNovo === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusGeralNovo === 'AGUARDANDO MANIFESTACAO TECNICA' || statusGeralNovo === 'REVISÃO' || statusGeralNovo === 'REVISAO')) {
            row['STATUS'] = 'FAZER DESPACHO';
        }

        // Se a resposta foi REPROVADA e o status geral ainda diz REVISÃO,
        // movemos para AGUARDANDO MANIFESTAÇÃO TÉCNICA para retornar ao fluxo do técnico.
        if (statusResp === 'REPROVADO' && (statusGeralNovo === 'REVISÃO' || statusGeralNovo === 'REVISAO')) {
            row['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        }

        // Prazos e Dias Restantes
        const dataRepasse = row['DATA DO REPASSE'] || row['DATA DE REPASSE'] || row['DATA'] || '';
        const prazo = row['PRAZO'] || row['PRAZO DE RESPOSTA'] || row['PRAZO (DIAS)'] || '';
        row['PRAZO'] = prazo;

        const diasRestantes = calcularDiasRestantes(dataRepasse, prazo);
        row['DIAS RESTANTES'] = String(diasRestantes);

        rows.push(row);
    }
    return rows;
}

/**
 * Normaliza e padroniza os campos de um registro de Carta Consulta recebido em formato JSON
 */
function limparEPadronizarCartas(linha) {
    const row = { ...linha };
    
    // Normalizações obrigatórias para compatibilidade de chaves e filtros robustos
    row['NUP'] = row['NUP'] || row['PROCESSO'] || row['PROCESSO/NUP'] || '';
    row['GERÊNCIA'] = row['GERÊNCIA'] || row['GERENCIA'] || '-';
    row['PRIORIDADE'] = normalizarPrioridadeCartas(row['GRAU DE PRIORIDADE (1/2/3)'] || row['GRAU DE PRIORIDADE'] || row['PRIORIDADE']);
    row['STATUS'] = normalizarStatusCartas(row['STATUS']);
    let tecCarta = (row['TÉCNICO/ADMIN'] || row['TECNICO/ADMIN'] || row['TÉCNICO/ADM'] || row['TECNICO/ADM'] || row['TÉCNICO'] || 'Não atribuído').trim();
    if (tecCarta.toUpperCase() === 'JOSE RENATO') {
        tecCarta = 'JOSÉ RENATO';
    }
    row['TÉCNICO/ADM'] = tecCarta;
    row['OBSERVAÇÃO'] = row['OBSERVAÇÃO'] || row['OBSERVAÇÕES'] || '-';
    row['LINK DO NUP'] = row['LINK DO NUP'] || row['LINK_NUP'] || '';
    row['LINK DA RESPOSTA'] = row['LINK DA RESPOSTA'] || row['LINK_RESPOSTA'] || '';
    row['LINK DA MANIFESTAÇÃO'] = row['LINK DA MANIFESTAÇÃO'] || row['LINK_MANIFESTACAO'] || row['LINK DA RESPOSTA'] || '';
    row['LINK DA DECLARAÇÃO'] = row['LINK DA DECLARAÇÃO'] || row['LINK_DECLARACAO'] || '';
    row['STATUS DA RESPOSTA'] = row['STATUS DA RESPOSTA'] || row['STATUS_RESPOSTA'] || row['STATUS-RESPOSTA'] || '';
    row['LINK SHAPEFILE'] = row['LINK SHAPEFILE'] || row['LINK_SHAPEFILE'] || '';
    row['MOTIVO DA AVALIAÇÃO'] = row['MOTIVO DA RECUSA'] || row['MOTIVO DA AVALIAÇÃO'] || row['MOTIVO_AVALIACAO'] || '';
    row['CARMS'] = row['Número do CARMS'] || row['NUMERO DO CARMS'] || row['NÚMERO DO CARMS'] || row['CARMS'] || '-';

    // Se tem resposta anexada e o status da resposta não é APROVADO nem REPROVADO, e o status geral ainda é AGUARDANDO MANIFESTAÇÃO TÉCNICA,
    // movemos para REVISÃO para constar corretamente na aba de Aguardando Revisão e sair de Em Andamento.
    const linkResposta = row['LINK DA RESPOSTA'] || row['LINK_RESPOSTA'] || '';
    const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
    const statusGeral = (row['STATUS'] || '').toUpperCase().trim();
    const statusResp = (row['STATUS DA RESPOSTA'] || '').toUpperCase().trim();

    if (hasResposta && statusResp !== 'APROVADO' && statusResp !== 'REPROVADO' && (statusGeral === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusGeral === 'AGUARDANDO MANIFESTACAO TECNICA')) {
        row['STATUS'] = 'REVISÃO';
    }

    // Se a resposta está APROVADA mas o status geral ainda diz AGUARDANDO MANIFESTAÇÃO TÉCNICA ou REVISÃO,
    // movemos automaticamente para FAZER DESPACHO no frontend para evitar inconsistências de dados históricos.
    const statusGeralNovo = (row['STATUS'] || '').toUpperCase().trim();
    if (statusResp === 'APROVADO' && (statusGeralNovo === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusGeralNovo === 'AGUARDANDO MANIFESTACAO TECNICA' || statusGeralNovo === 'REVISÃO' || statusGeralNovo === 'REVISAO')) {
        row['STATUS'] = 'FAZER DESPACHO';
    }

    // Se a resposta foi REPROVADA e o status geral ainda diz REVISÃO,
    // movemos para AGUARDANDO MANIFESTAÇÃO TÉCNICA para retornar ao fluxo do técnico.
    if (statusResp === 'REPROVADO' && (statusGeralNovo === 'REVISÃO' || statusGeralNovo === 'REVISAO')) {
        row['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }

    // Prazos e Dias Restantes (Coluna Q na Planilha)
    const prazo = row['PRAZO'] || row['PRAZO DE RESPOSTA'] || row['PRAZO (DIAS)'] || '-';
    row['PRAZO'] = prazo;
    const dataRepasse = row['DATA DO REPASSE'] || row['DATA DE REPASSE'] || '';
    row['DIAS RESTANTES'] = (dataRepasse && prazo && prazo !== '-') ? calcularDiasRestantes(dataRepasse, prazo) : '-';

    return row;
}

/**
 * Carrega a lista de Cartas Consulta do Google Apps Script
 */
async function carregarCartas() {
    if (cartasCarregadas) return;

    const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
    const keyCartas = `corino_cache_dados_cartas_${username}`;

    // Processar dados temporários pré-carregados se existirem
    const tempRawCartas = localStorage.getItem('corino_temp_raw_cartas');
    if (tempRawCartas) {
        try {
            const dadosBrutos = JSON.parse(tempRawCartas);
            const parsedRows = dadosBrutos.map(limparEPadronizarCartas);
            if (parsedRows && parsedRows.length > 0) {
                dadosCartasGlobais = parsedRows;
                atualizarCacheCartas();
                localStorage.removeItem('corino_temp_raw_cartas');
                console.log("Cartas Consulta pré-carregadas aplicadas com sucesso ao cache do usuário logado.");
            }
        } catch (e) {
            console.error("Erro ao processar dados pré-carregados de Cartas Consulta:", e);
        }
    }

    const cacheSalvo = localStorage.getItem(keyCartas);
    let carregouDeCache = false;

    if (cacheSalvo) {
        try {
            dadosCartasGlobais = JSON.parse(cacheSalvo).map(limparEPadronizarCartas);
            carregouDeCache = true;
            
            const loadingEl = document.getElementById('loading-cartas');
            if (loadingEl) loadingEl.style.display = 'none';

            popularFiltrosCartas();

            // Exibe as sub-abas de setores de Cartas Consulta apenas para a Diretoria Global (DIFLOR)
            const miniTabsCartas = document.getElementById('mini-tabs-cartas');
            if (miniTabsCartas) {
                if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR')) {
                    miniTabsCartas.style.display = 'flex';
                } else {
                    miniTabsCartas.style.display = 'none';
                }
            }

            aplicarFiltrosCartas();
            cartasCarregadas = true;
            if (typeof atualizarBadgesNotificacao === 'function') {
                atualizarBadgesNotificacao(dadosCoringa);
            }
        } catch (e) {
            console.error("Erro ao ler cache de Cartas Consulta:", e);
        }
    }

    const loadingEl = document.getElementById('loading-cartas');
    if (!carregouDeCache && loadingEl) loadingEl.style.display = 'block';

    popularFiltrosCartas();

    try {
        const resultado = await executarAcaoGAS({ acao: "buscar_cartas" });

        if (resultado.status === 'success') {
            const parsedRows = resultado.dados.map(limparEPadronizarCartas);
            dadosCartasGlobais = parsedRows;
            atualizarCacheCartas();
            cartasCarregadas = true;
            if (typeof atualizarDashboardInicio === 'function' && typeof filtroAtivo !== 'undefined' && filtroAtivo === 'inicio') {
                atualizarDashboardInicio();
            }

            // Exibe as sub-abas de setores de Cartas Consulta apenas para a Diretoria Global (DIFLOR)
            const miniTabsCartas = document.getElementById('mini-tabs-cartas');
            if (miniTabsCartas) {
                if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR')) {
                    miniTabsCartas.style.display = 'flex';
                } else {
                    miniTabsCartas.style.display = 'none';
                }
            }

            aplicarFiltrosCartas();
        } else {
            throw new Error(resultado.message);
        }
    } catch (e) {
        console.error("Erro ao carregar Cartas Consulta:", e);
        if (!carregouDeCache) {
            mostrarToast("Erro ao carregar Cartas Consulta diretamente da nuvem. Exibindo dados vazios.", "error");
            dadosCartasGlobais = [];
            renderTabelaCartas([]);
        } else {
            mostrarToast("Conexão instável. Exibindo dados do cache de Cartas offline.", "warning");
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

let isPreloadingShapes = false;

async function preloadShapesCartas() {
    // Shapefiles são processados sob demanda no clique do mapa para evitar concorrência e bloqueio no Google Apps Script
    return;
}

let subAbaCartasAtiva = 'Geral';

/**
 * Define a sub-aba ativa de Cartas Consulta e atualiza os filtros
 */
function setSubAbaCartas(aba) {
    subAbaCartasAtiva = aba;
    
    // Atualiza o estado visual das mini-tabs de cartas
    const container = document.getElementById('mini-tabs-cartas');
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (btn.textContent === aba) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    aplicarFiltrosCartas();
}

let subAbaCartasRevisaoAtiva = 'Geral';

/**
 * Define a sub-aba ativa de revisão de Cartas Consulta e atualiza os filtros
 */
function setSubAbaCartasRevisao(aba) {
    subAbaCartasRevisaoAtiva = aba;
    
    // Atualiza o estado visual das mini-tabs de revisão de cartas
    const container = document.getElementById('mini-tabs-cartas-revisao');
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (btn.textContent === aba) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    aplicarFiltrosCartas();
}

/**
 * Preenche as opções de filtros no Painel Lateral
 */
function popularFiltrosCartas() {
    const selectTec = document.getElementById('filtro-cartas-tec');
    if (!selectTec) return;

    selectTec.innerHTML = '<option value="">-- Todos os Técnicos --</option>';
    
    // opcoesAutoTecnico está no escopo global (definido em app.js)
    if (typeof opcoesAutoTecnico !== 'undefined' && Array.isArray(opcoesAutoTecnico)) {
        let listaTecnicos = [...opcoesAutoTecnico];
        if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            listaTecnicos = listaTecnicos.filter(tec => {
                const t = tec.trim().toUpperCase();
                return MAPA_TECNICOS_SETORES[t] === usuarioAtivo.setor;
            });
        }
        listaTecnicos.forEach(tec => {
            const opt = document.createElement('option');
            opt.value = tec.toUpperCase();
            opt.textContent = tec;
            selectTec.appendChild(opt);
        });
    }
}

/**
 * Controla a renderização das Cartas Consulta (Apenas Visão Inbox Split da Diretoria)
 */
function renderTabelaCartas(dados) {
    cartasExibidas = dados;
    const cont = document.getElementById('contador-cartas');
    
    if (cont) {
        const texto = dados.length === 1 ? '1 resultado' : `${dados.length} resultados`;
        cont.innerText = `Exibindo ${texto}.`;
    }
    
    renderTabelaView(dados);
}

let cartaSelecionada = null;

/**
 * Renderiza os dados no formato de Tabela (Modelo Inbox Split da Diretoria)
 */
function renderTabelaView(dados) {
    const container = document.getElementById('cartas-tabela-view');
    if (!container) return;

    // Guardar posições de scroll para evitar "saltos" visuais ao atualizar
    const leftPanelEl = document.getElementById('left-panel-cartas');
    const savedLeftScrollTop = leftPanelEl ? leftPanelEl.scrollTop : 0;

    const rightPanelEl = document.getElementById('right-panel-cartas');
    const savedRightScrollTop = rightPanelEl ? rightPanelEl.scrollTop : 0;

    const savedWindowScrollY = window.scrollY;

    container.innerHTML = '';

    if (!dados || dados.length === 0) {
        container.style.display = 'grid';
        container.innerHTML = `
            <div style="width: 100%; background-color: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 25px; text-align: center; color: var(--text-muted);">
                📭 Nenhum registo de Carta Consulta encontrado.
            </div>
        `;
        return;
    }

    // Define a carta selecionada inicial se não houver nenhuma ativa
    if (!cartaSelecionada && dados.length > 0) {
        cartaSelecionada = dados[0];
    } else if (cartaSelecionada) {
        const exists = dados.find(r => r['NUP'] === cartaSelecionada['NUP']);
        if (exists) {
            cartaSelecionada = exists;
        } else {
            cartaSelecionada = dados[0];
        }
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '20px';
    container.style.alignItems = 'flex-start';
    container.style.width = '100%';

    // LADO ESQUERDO: LISTA (INBOX)
    const leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel-cartas';
    leftPanel.style.width = '35%';
    leftPanel.style.minWidth = '300px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.gap = '10px';
    leftPanel.style.maxHeight = '75vh';
    leftPanel.style.overflowY = 'auto';
    leftPanel.style.paddingRight = '5px';
    leftPanel.style.boxSizing = 'border-box';

    // LADO DIREITO: DETALHES
    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel-cartas';
    rightPanel.style.width = '65%';
    rightPanel.style.backgroundColor = '#1a1a1a';
    rightPanel.style.border = '1px solid var(--card-border)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '25px';
    rightPanel.style.position = 'sticky';
    rightPanel.style.top = '20px';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.maxHeight = '85vh';
    rightPanel.style.overflowY = 'auto';
    rightPanel.style.boxSizing = 'border-box';

    // Popular o painel esquerdo com os cards
    dados.forEach((linha, index) => {
        const isSelected = cartaSelecionada && cartaSelecionada['NUP'] === linha['NUP'];
        
        // Cores de Status
        const statusStr = String(linha['STATUS'] || '').toUpperCase();
        let statusColor = '#95a5a6';
        let statusIcon = '⚙️ ';
        if (statusStr === 'AGUARDANDO DISTRIBUIÇÃO') { statusColor = '#e67e22'; statusIcon = '📥 '; }
        else if (statusStr === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA') { statusColor = '#3498db'; statusIcon = '⏳ '; }
        else if (statusStr === 'REVISÃO') { statusColor = '#f1c40f'; statusIcon = '📝 '; }
        else if (statusStr === 'AGUARDANDO ASSINATURA') { statusColor = '#9b59b6'; statusIcon = '✍️ '; }
        else if (statusStr === 'TRAMITADO') { statusColor = '#2ecc71'; statusIcon = '✅ '; }

        const card = document.createElement('div');
        card.style.backgroundColor = isSelected ? 'rgba(46, 204, 113, 0.1)' : '#1a1a1a';
        card.style.border = isSelected ? '1px solid var(--primary-green)' : '1px solid #333';
        card.style.borderRadius = '6px';
        card.style.padding = '12px 15px';
        card.style.cursor = 'pointer';
        card.style.transition = 'all 0.2s';
        card.style.boxSizing = 'border-box';

        card.onmouseenter = () => { if (!isSelected) card.style.backgroundColor = '#222'; };
        card.onmouseleave = () => { if (!isSelected) card.style.backgroundColor = '#1a1a1a'; };
        card.onclick = () => {
            cartaSelecionada = linha;
            renderTabelaView(dados);
        };

        // Badge de prioridade
        let prioridadeHtml = '';
        const prioridadeStr = String(linha['PRIORIDADE'] || '').toUpperCase();
        if (prioridadeStr.includes('1-')) prioridadeHtml = `<div style="font-size:10px;color:#e74c3c;font-weight:bold;margin-bottom:5px;">🚨 PREFERENCIAL</div>`;
        else if (prioridadeStr.includes('3-')) prioridadeHtml = `<div style="font-size:10px;color:#f1c40f;font-weight:bold;margin-bottom:5px;">⚡ URGENTE</div>`;

        // Badge de avaliação da resposta no card
        let badgeAvaliacao = '';
        const statusRespCard = (linha['STATUS DA RESPOSTA'] || '').toUpperCase();
        if (statusRespCard === 'APROVADO') badgeAvaliacao = `<div style="font-size: 10px; color: #2ecc71; font-weight: bold; margin-bottom: 5px;">✅ RESPOSTA APROVADA</div>`;
        else if (statusRespCard === 'REPROVADO') badgeAvaliacao = `<div style="font-size: 10px; color: #e74c3c; font-weight: bold; margin-bottom: 5px;">❌ RESPOSTA REPROVADA</div>`;

        const infoStatus = obterStatusVisual(linha);
        let corStatus = '#fff';
        if (infoStatus.classe === 'status-red') corStatus = '#ff4b4b';
        else if (infoStatus.classe === 'status-yellow') corStatus = '#f1c40f';
        else if (infoStatus.classe === 'status-green') corStatus = '#2ecc71';
        else if (infoStatus.classe === 'status-gray') corStatus = '#888';

        card.innerHTML = `
            ${prioridadeHtml}
            ${badgeAvaliacao}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <div style="font-size: 14px; font-weight: bold; color: ${isSelected ? 'var(--primary-green)' : '#fff'};">
                    ${linha['NUP'] || '-'}
                </div>
                <div style="font-size: 10px; padding: 3px 8px; border-radius: 6px; border: 1px solid ${statusColor}; color: ${statusColor}; background-color: rgba(255,255,255,0.03); font-weight: bold; display: flex; align-items: center;">
                    ${statusIcon}${linha['STATUS']}
                </div>
            </div>
            <div style="font-size: 12px; color: #aaa; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${linha['REQUERENTE'] || ''}">
                <strong>Req:</strong> ${linha['REQUERENTE'] || '-'}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #777;">
                <div><strong>Téc:</strong> ${linha['TÉCNICO/ADM'] || linha['TECNICO/ADM'] || 'Não atribuído'}</div>
                <div style="color: ${corStatus}; font-weight: bold;">${infoStatus.texto}</div>
            </div>
        `;
        leftPanel.appendChild(card);
    });

    // Detalhes da carta selecionada no painel direito
    if (cartaSelecionada) {
        const linha = cartaSelecionada;
        const absIndex = dadosCartasGlobais.indexOf(linha);
        const nupVal = linha['NUP'] || '-';

        const statusStr = String(linha['STATUS'] || '').toUpperCase();
        let statusColor = '#95a5a6';
        let statusIcon = '⚙️ ';
        if (statusStr === 'AGUARDANDO DISTRIBUIÇÃO') { statusColor = '#e67e22'; statusIcon = '📥 '; }
        else if (statusStr === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA') { statusColor = '#3498db'; statusIcon = '⏳ '; }
        else if (statusStr === 'REVISÃO') { statusColor = '#f1c40f'; statusIcon = '📝 '; }
        else if (statusStr === 'AGUARDANDO ASSINATURA') { statusColor = '#9b59b6'; statusIcon = '✍️ '; }
        else if (statusStr === 'TRAMITADO') { statusColor = '#2ecc71'; statusIcon = '✅ '; }

        const obs = (linha['OBSERVAÇÃO'] || linha['OBSERVAÇÕES'] || '').trim();
        let htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-')
            ? `<div class="modal-obs" style="margin-top: 15px; margin-left: 0; margin-right: 0;"><strong>Observação:</strong><br>${obs}</div>` : '';

        const linkOriginal  = linha['LINK DO NUP']      || '';
        const linkResposta  = linha['LINK DA RESPOSTA']  || '';
        const linkManifestacao = linha['LINK DA MANIFESTAÇÃO'] || linha['LINK_MANIFESTACAO'] || linkResposta || '';
        const linkDeclaracao   = linha['LINK DA DECLARAÇÃO']   || linha['LINK_DECLARACAO']   || '';
        const linkShapefile = linha['LINK SHAPEFILE']    || linha['LINK_SHAPEFILE'] || '';
        const statusResp    = (linha['STATUS DA RESPOSTA'] || '').toUpperCase();
        const motivoResp    = (linha['MOTIVO DA AVALIAÇÃO'] || '').trim();
        const temManifestacao = linkManifestacao && linkManifestacao.startsWith('http');
        const temDeclaracao   = linkDeclaracao && linkDeclaracao.startsWith('http');
        const temResposta   = temManifestacao && temDeclaracao;

        const isGestor = usuarioAtivo && (typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
        const isTecnico = usuarioAtivo && usuarioAtivo.perfil === 'tecnico';

        // ── BOTÕES DE AÇÃO (NUP / Shapefile) ───────────────────────────────
        let htmlPreviewIcon = '';
        let htmlBotoesAcao = '';
        
        const hasOriginal = linkOriginal && linkOriginal.startsWith('http');
        const hasResposta = linkResposta && linkResposta.startsWith('http');
        const hasShapefile = linkShapefile && linkShapefile.startsWith('http');

        if (hasOriginal || hasResposta || hasShapefile) {
            htmlPreviewIcon = `<button onclick="abrirModalPreviewCartas(${absIndex >= 0 ? absIndex : 0})" class="btn-inline-preview" title="Pré-visualizar Documentos"></button>`;
        }

        if (hasOriginal) {
            if (isLinkGCS(linkOriginal)) {
                htmlBotoesAcao += `<button onclick="dispararDownloadSeguro('${linkOriginal}', 'Carta_Original_${nupVal}.pdf')" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;">⬇️ Baixar PDF (LGPD)</button>`;
            } else {
                const origId = extrairIdDrive(linkOriginal);
                if (origId) {
                    const linkDown = `https://drive.google.com/uc?export=download&id=${origId}`;
                    htmlBotoesAcao += `<a href="${linkDown}" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="feedbackDownload(this)">⬇️ Baixar PDF Original</a>`;
                } else {
                    htmlBotoesAcao += `<a href="${linkOriginal}" target="_blank" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;">🔗 Abrir PDF Original</a>`;
                }
            }
        } else {
            let btnAnexarOriginal = '';
            if (usuarioAtivo) {
                btnAnexarOriginal = `<button onclick="anexarPdfOriginalCarta(event, '${nupVal}')" class="btn-drive btn-upload" style="background-color: #34495e; border-color: #2c3e50; flex:1; min-width:140px; display:flex; align-items:center; justify-content:center; gap:8px;">📁 Anexar PDF Original</button>`;
            }
            
            if (btnAnexarOriginal) {
                htmlBotoesAcao += btnAnexarOriginal;
            } else {
                htmlBotoesAcao += `<div style="text-align:center;color:#666;font-weight:bold;padding:10px;border:1px dashed #333;border-radius:6px;flex:1;font-size:13px;">🚫 Sem PDF Original</div>`;
            }
        }

        if (hasShapefile) {
            htmlBotoesAcao += `<button onclick="abrirModalPreviewCartasShapefile(${absIndex >= 0 ? absIndex : 0}, '${linkShapefile}')" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;">🗺️ Ver Mapa</button>`;
            
            if (isLinkGCS(linkShapefile)) {
                htmlBotoesAcao += `<button onclick="dispararDownloadSeguro('${linkShapefile}', 'Shapefile_${nupVal}.zip')" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;">⬇️ Baixar Shapefile (LGPD)</button>`;
            } else {
                const shapeId = extrairIdDrive(linkShapefile);
                if (shapeId) {
                    const shapeDown = `https://drive.google.com/uc?export=download&id=${shapeId}`;
                    htmlBotoesAcao += `<a href="${shapeDown}" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;" onclick="feedbackDownload(this)">⬇️ Baixar Shapefile</a>`;
                } else {
                    htmlBotoesAcao += `<a href="${linkShapefile}" target="_blank" class="btn-drive btn-orange-outline" style="flex:1;min-width:140px;display:flex;align-items:center;justify-content:center;gap:8px;">🔗 Baixar Shapefile</a>`;
                }
            }
        } else {
            let btnAnexarShapefile = '';
            if (usuarioAtivo) {
                btnAnexarShapefile = `<button onclick="anexarShapefileCarta(event, '${nupVal}')" class="btn-drive btn-upload" style="background-color: #2c3e50; border-color: #1a252f; flex:1; min-width:140px; display:flex; align-items:center; justify-content:center; gap:8px;">🗺️ Anexar Shapefile</button>`;
            }
            
            if (btnAnexarShapefile) {
                htmlBotoesAcao += btnAnexarShapefile;
            } else {
                htmlBotoesAcao += `<div style="text-align:center;color:#666;font-weight:bold;padding:10px;border:1px dashed #333;border-radius:6px;flex:1;font-size:13px;">🚫 Sem Shapefile</div>`;
            }
        }

        // ── BLOCO DE RESPOSTA (MANIFESTAÇÃO / DECLARAÇÃO) ───────────────────
        let htmlBlocoResposta = '<div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">';
        
        let htmlManifestacao = '';
        if (temManifestacao) {
            const btnExcluir = (statusStr !== 'TRAMITADO' && (isTecnico || isGestor) && !(statusResp === 'APROVADO' && !isGestor))
                ? `<button onclick="removerDocumentoRespostaCarta(event,'${nupVal}','manifestacao')" class="btn-drive btn-red-outline" style="padding:0;width:28px;height:28px;font-size:12px;margin:0;display:inline-flex;align-items:center;justify-content:center;">🗑️</button>` : '';
            
            let btnBaixarManifest = '';
            if (isLinkGCS(linkManifestacao)) {
                btnBaixarManifest = `<button onclick="dispararDownloadSeguro('${linkManifestacao}', 'Manifestacao_${nupVal}.pdf')" class="btn-drive btn-download-bounce" style="width:28px;height:28px;padding:0;background:#111111;border:1px solid #e67e22;color:#f39c12;display:inline-flex;align-items:center;justify-content:center;margin:0;border-radius:4px;" title="Baixar Manifestação (LGPD)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="12" y1="3" x2="12" y2="15"></line><polyline points="7 10 12 15 17 10"></polyline><line x1="5" y1="20" x2="19" y2="20"></line></svg></button>`;
            } else {
                const mId = extrairIdDrive(linkManifestacao);
                const mDownload = mId ? `https://drive.google.com/uc?export=download&id=${mId}` : linkManifestacao;
                btnBaixarManifest = `<a href="${mDownload}" target="_blank" class="btn-drive btn-download-bounce" style="width:28px;height:28px;padding:0;background:#111111;border:1px solid #e67e22;color:#f39c12;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;margin:0;border-radius:4px;" title="Baixar Manifestação"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="12" y1="3" x2="12" y2="15"></line><polyline points="7 10 12 15 17 10"></polyline><line x1="5" y1="20" x2="19" y2="20"></line></svg></a>`;
            }

            htmlManifestacao = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.02);padding:10px;border-radius:6px;border:1px solid #333;">
                    <span style="font-size:13px;color:#f39c12;font-weight:bold;display:flex;align-items:center;gap:6px;">📄 Manifestação Anexada</span>
                    <div style="display:flex;gap:5px;margin-left:auto;align-items:center;">
                        ${btnBaixarManifest}
                        ${btnExcluir}
                    </div>
                </div>`;
        } else if (statusStr !== 'TRAMITADO') {
            if (isTecnico) {
                htmlManifestacao = `<button onclick="anexarDocumentoRespostaCarta(event,'${nupVal}','manifestacao')" class="btn-drive btn-orange-outline" style="width:100%;margin:0;display:flex;align-items:center;justify-content:center;gap:8px;"><i class="ci ci-paperclip"></i> Anexar Manifestação</button>`;
            } else {
                htmlManifestacao = `<div style="text-align:center;color:#666;font-size:13px;padding:10px;border:1px dashed #333;border-radius:6px;">🚫 Sem Manifestação</div>`;
            }
        }

        let htmlDeclaracao = '';
        if (temDeclaracao) {
            const btnExcluir = (statusStr !== 'TRAMITADO' && (isTecnico || isGestor) && !(statusResp === 'APROVADO' && !isGestor))
                ? `<button onclick="removerDocumentoRespostaCarta(event,'${nupVal}','declaracao')" class="btn-drive btn-red-outline" style="padding:0;width:28px;height:28px;font-size:12px;margin:0;display:inline-flex;align-items:center;justify-content:center;">🗑️</button>` : '';
            
            let btnBaixarDeclar = '';
            if (isLinkGCS(linkDeclaracao)) {
                btnBaixarDeclar = `<button onclick="dispararDownloadSeguro('${linkDeclaracao}', 'Declaracao_${nupVal}.pdf')" class="btn-drive btn-download-bounce" style="width:28px;height:28px;padding:0;background:#111111;border:1px solid #e67e22;color:#f39c12;display:inline-flex;align-items:center;justify-content:center;margin:0;border-radius:4px;" title="Baixar Declaração (LGPD)"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="12" y1="3" x2="12" y2="15"></line><polyline points="7 10 12 15 17 10"></polyline><line x1="5" y1="20" x2="19" y2="20"></line></svg></button>`;
            } else {
                const dId = extrairIdDrive(linkDeclaracao);
                const dDownload = dId ? `https://drive.google.com/uc?export=download&id=${dId}` : linkDeclaracao;
                btnBaixarDeclar = `<a href="${dDownload}" target="_blank" class="btn-drive btn-download-bounce" style="width:28px;height:28px;padding:0;background:#111111;border:1px solid #e67e22;color:#f39c12;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;margin:0;border-radius:4px;" title="Baixar Declaração"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:block;"><line x1="12" y1="3" x2="12" y2="15"></line><polyline points="7 10 12 15 17 10"></polyline><line x1="5" y1="20" x2="19" y2="20"></line></svg></a>`;
            }

            htmlDeclaracao = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;background:rgba(255,255,255,0.02);padding:10px;border-radius:6px;border:1px solid #333;">
                    <span style="font-size:13px;color:#f39c12;font-weight:bold;display:flex;align-items:center;gap:6px;">📜 Declaração Anexada</span>
                    <div style="display:flex;gap:5px;margin-left:auto;align-items:center;">
                        ${btnBaixarDeclar}
                        ${btnExcluir}
                    </div>
                </div>`;
        } else if (statusStr !== 'TRAMITADO') {
            if (isTecnico) {
                htmlDeclaracao = `<button onclick="anexarDocumentoRespostaCarta(event,'${nupVal}','declaracao')" class="btn-drive btn-orange-outline" style="width:100%;margin:0;display:flex;align-items:center;justify-content:center;gap:8px;"><i class="ci ci-paperclip"></i> Anexar Declaração</button>`;
            } else {
                htmlDeclaracao = `<div style="text-align:center;color:#666;font-size:13px;padding:10px;border:1px dashed #333;border-radius:6px;">🚫 Sem Declaração</div>`;
            }
        }

        let htmlRespostaAprovacaoStatus = '';
        if (statusResp === 'APROVADO') {
            htmlRespostaAprovacaoStatus = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px; border-radius: 4px; font-weight:bold;">🔒 Resposta Aprovada.</div>`;
        } else if (statusResp === 'REPROVADO') {
            let htmlMotivo = motivoResp ? `<div style="margin-top:8px;padding:10px;background-color:rgba(231,76,60,0.1);border-left:4px solid #e74c3c;color:#ffcccc;font-size:13px;border-radius:4px;"><strong>Motivo da Reprovação:</strong><br>${motivoResp}</div>` : '';
            htmlRespostaAprovacaoStatus = `
                <div style="padding:10px;background-color:rgba(231,76,60,0.05);border:1px solid #e74c3c44;border-radius:6px;">
                    <div style="color:#e74c3c;font-weight:bold;font-size:13px;display:flex;align-items:center;gap:6px;">❌ Resposta Reprovada</div>
                    ${htmlMotivo}
                </div>`;
        } else if (temManifestacao || temDeclaracao) {
            htmlRespostaAprovacaoStatus = `<div style="padding: 10px; background-color: rgba(230, 126, 34, 0.1); border-left: 4px solid #e67e22; color: #e67e22; font-size: 13px; border-radius: 4px; font-weight:bold; display:flex; align-items:center; gap:6px;">⏳ Em Revisão</div>`;
        }

        htmlBlocoResposta += htmlManifestacao + htmlDeclaracao + htmlRespostaAprovacaoStatus + '</div>';

        let htmlAnexarResposta = '';

        const tecCarta = (linha['TÉCNICO/ADM'] || '').trim().toUpperCase();
        const setorCarta = (typeof MAPA_TECNICOS_SETORES !== 'undefined' && MAPA_TECNICOS_SETORES[tecCarta]) ? MAPA_TECNICOS_SETORES[tecCarta] : 'GCAR';

        // ── AÇÕES DE REVISÃO (Exclusivo Revisor) ─────────────────────────
        let htmlAcoesDiretoria = '';
        const podeAvaliarCarta = (typeof window.podeAvaliarManifestacao === 'function') 
            ? window.podeAvaliarManifestacao(setorCarta)
            : isGestor;

        if (podeAvaliarCarta && (temManifestacao || temDeclaracao) && statusResp !== 'APROVADO' && statusResp !== 'REPROVADO') {
            htmlAcoesDiretoria = `
                <div style="margin-top:15px;padding:15px;background-color:rgba(255,165,0,0.07);border:1px solid rgba(255,165,0,0.3);border-radius:6px;">
                    <strong style="color:#ffa500;font-size:13px;display:block;margin-bottom:10px;">📋 Avaliar Resposta Técnica (Revisor):</strong>
                    <div style="display:flex;gap:10px;">
                        <button onclick="avaliarRespostaCarta(event,'${nupVal}','APROVADO')" class="btn-drive btn-green-outline" style="flex:1;margin:0;"><i class="ci ci-check"></i> Aprovar</button>
                        <button onclick="avaliarRespostaCarta(event,'${nupVal}','REPROVADO')" class="btn-drive btn-red-outline" style="flex:1;margin:0;"><i class="ci ci-close"></i> Reprovar</button>
                    </div>
                </div>`;
        }

        // ── AÇÕES DE STATUS DA CARTA (DESPACHO / SOBRESTADO / ASSINATURA) ────────
        let htmlAcoesStatusCarta = '';
        let htmlAtribuirTecnico = '';
        const podeAdmCarta = (typeof window.podeConfeccionarDespachoOuCI === 'function')
            ? window.podeConfeccionarDespachoOuCI(setorCarta)
            : isGestor;

        if (podeAdmCarta) {
            const statusGeralFormatado = statusStr.replace(/\./g, '').trim().toUpperCase();
            if (statusGeralFormatado === 'FAZER DESPACHO') {
                htmlAcoesStatusCarta = `
                    <div style="margin-top:15px;padding:15px;background-color:rgba(41,128,185,0.07);border:1px solid rgba(41,128,185,0.3);border-radius:6px;">
                        <strong style="color:#2980b9;font-size:13px;display:block;margin-bottom:10px;">📋 Ações de Fluxo (Despacho):</strong>
                        <div style="display:flex;gap:10px;flex-direction:column;">
                            <button onclick="atualizarStatusCarta(event, '${nupVal}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background-color: #2980b9; border-color: #1c5986; color: white; width: 100%; margin: 0; font-size: 14px;">✅ Confirmar Realização do Despacho</button>
                            <button onclick="if(typeof abrirModalSobrestar==='function') abrirModalSobrestar('${nupVal}', 'carta');" class="btn-drive" style="background-color: #f39c12; border-color: #d68910; color: #111; font-weight: bold; width: 100%; margin: 0; font-size: 14px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                        </div>
                    </div>`;
            } else if (statusGeralFormatado === 'SOBRESTADO') {
                htmlAcoesStatusCarta = `
                    <div style="margin-top:15px;padding:15px;background-color:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.4);border-radius:6px;">
                        <strong style="color:#f39c12;font-size:13px;display:block;margin-bottom:8px;">⏸️ Processo Sobrestado (Encaminhado para: ${linha['SOBRESTADO_SETOR'] || 'Setor Externo'})</strong>
                        ${linha['SOBRESTADO_MOTIVO'] ? `<div style="font-size:12px;color:#ccc;margin-bottom:12px;"><strong>Motivo:</strong> ${linha['SOBRESTADO_MOTIVO']}</div>` : ''}
                        <button onclick="if(typeof abrirModalRetornoSobrestamento==='function') abrirModalRetornoSobrestamento('${nupVal}', 'carta');" class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; color: white; width: 100%; margin: 0; font-size: 14px; font-weight: bold;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
                    </div>`;
            } else if (statusGeralFormatado === 'AGUARDANDO ASSINATURA') {
                htmlAcoesStatusCarta = `
                    <div style="margin-top:15px;padding:15px;background-color:rgba(142,68,173,0.07);border:1px solid rgba(142,68,173,0.3);border-radius:6px;">
                        <strong style="color:#8e44ad;font-size:13px;display:block;margin-bottom:10px;">📋 Ações de Fluxo (Assinatura):</strong>
                        <button onclick="atualizarStatusCarta(event, '${nupVal}', 'FINALIZADO')" class="btn-drive" style="background-color: #8e44ad; border-color: #6c3483; color: white; width: 100%; margin: 0; font-size: 14px;">✍️ Confirmar Assinatura Realizada</button>
                    </div>`;
            }
            
            const isSemTecnico = !linha['TÉCNICO/ADM'] || 
                                 linha['TÉCNICO/ADM'] === '-' || 
                                 linha['TÉCNICO/ADM'] === 'S/T' || 
                                 linha['TÉCNICO/ADM'] === 'Sem Técnico' || 
                                 linha['TÉCNICO/ADM'] === 'Não atribuído' || 
                                 linha['TÉCNICO/ADM'].trim() === '';

            if (isSemTecnico) {
                htmlAtribuirTecnico = `<button onclick="abrirAtribuirTecnicoCarta('${nupVal}')" class="btn-drive btn-blue" style="width:100%;margin-top:12px;font-size:14px;"><i class="ci ci-user"></i> Distribuir / Atribuir Técnico</button>`;
            } else {
                htmlAtribuirTecnico = `<button onclick="abrirAtribuirTecnicoCarta('${nupVal}')" class="btn-drive btn-blue" style="width:100%;margin-top:12px;font-size:14px;"><i class="ci ci-user"></i> Redistribuir Técnico</button>`;
            }
            
            if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR')) {
                const rawStatus = (linha['STATUS'] || '').toUpperCase().trim();
                const opcoesCartaStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "REVISÃO", "FAZER DESPACHO", "SOBRESTADO", "AGUARDANDO ASSINATURA", "FINALIZADO", "DEVOLVIDO"];
                let optionsHtml = opcoesCartaStatus.map(st => `<option value="${st}" ${st === rawStatus ? 'selected' : ''}>${st}</option>`).join('');
                
                htmlAcoesStatusCarta += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                        <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;"><i class="ci ci-settings"></i> GESTÃO DE STATUS (DIRETORIA)</div>
                        <div style="display: flex; gap: 8px;">
                            <select id="changeStatusSelectCarta-${nupVal}" style="flex: 1; padding: 8px; background-color: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 13px; outline: none; height: 38px;">
                                ${optionsHtml}
                            </select>
                            <button onclick="salvarStatusManualCarta(event, '${nupVal}')" id="btnSalvarStatusCarta-${nupVal}" class="btn-drive btn-blue" style="width: auto; padding: 8px 15px; margin: 0; font-size: 13px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">Alterar</button>
                        </div>
                    </div>
                `;
            }
        }

        const infoStatus = obterStatusVisual(linha);
        let corStatus = '#fff';
        if (infoStatus.classe === 'status-red') corStatus = '#ff4b4b';
        else if (infoStatus.classe === 'status-yellow') corStatus = '#f1c40f';
        else if (infoStatus.classe === 'status-green') corStatus = '#2ecc71';
        else if (infoStatus.classe === 'status-gray') corStatus = '#888';

        rightPanel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #333;padding-bottom:15px;margin-bottom:20px;">
                <div>
                    <div style="font-size:24px;font-weight:bold;color:#fff;margin-bottom:5px;display:flex;align-items:center;gap:10px;">${nupVal} ${htmlPreviewIcon}</div>
                    <div style="font-size:16px;color:#ccc;">${linha['TÉCNICO/ADM'] || 'Não atribuído'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="background-color:rgba(255,255,255,0.1);padding:5px 12px;border-radius:20px;font-size:12px;font-weight:bold;color:#eee;display:inline-block;margin-bottom:5px;">${linha['ATIVIDADE'] || 'CARTA CONSULTA'}</div>
                    <div style="color:${statusColor};font-size:14px;font-weight:bold;display:flex;align-items:center;justify-content:flex-end;">${statusIcon}${linha['STATUS']}</div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-bottom:15px;">
                <div style="background-color:#222;padding:15px;border-radius:8px;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">DATA DO REPASSE</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;">${linha['DATA DO REPASSE'] || linha['DATA DE REPASSE'] || '-'}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">GRAU DE PRIORIDADE</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;">${linha['PRIORIDADE'] || '-'}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">PRAZO DE RESPOSTA</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;">${linha['PRAZO'] ? linha['PRAZO'] + ' dias' : '-'}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">DIAS RESTANTES</div>
                    <div style="font-size:14px;color:${corStatus};font-weight:bold;">${infoStatus.texto}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">FÍSICO / E-MS</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;">${linha['FÍSICO/E-MS'] || '-'}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">GERÊNCIA</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;">${linha['GERÊNCIA'] || '-'}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;grid-column:span 2;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">REQUERENTE</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;line-height:1.4;">${linha['REQUERENTE'] || '-'}</div>
                </div>
                <div style="background-color:#222;padding:15px;border-radius:8px;grid-column:span 2;">
                    <div style="font-size:11px;color:#888;margin-bottom:4px;font-weight:bold;">TRAMITADO PARA</div>
                    <div style="font-size:14px;color:#fff;font-weight:500;line-height:1.4;">${linha['TRAMITADO P/'] || linha['TRAMITADO_P'] || '-'}</div>
                </div>
            </div>

            ${htmlObs}
            ${htmlBlocoResposta}
            ${htmlAcoesDiretoria}
            ${htmlAcoesStatusCarta}
            <div id="timeline-container-carta" style="margin-top: 25px; margin-bottom: 25px;"></div>

            <div style="margin-top:auto;padding-top:20px;border-top:1px solid #333;">
                ${htmlBotoesAcao ? `<div style="display:flex;gap:10px;flex-wrap:wrap;">${htmlBotoesAcao}</div>` : ''}
                ${htmlAnexarResposta}
                ${htmlAtribuirTecnico}
            </div>
        `;
    }

    container.appendChild(leftPanel);
    container.appendChild(rightPanel);

    if (cartaSelecionada) {
        renderizarLinhaTempoSistema(cartaSelecionada['NUP'], 'timeline-container-carta');
    }

    if (leftPanelEl)  leftPanel.scrollTop  = savedLeftScrollTop;
    if (rightPanelEl) rightPanel.scrollTop = savedRightScrollTop;
    window.scrollTo(0, savedWindowScrollY);
}




/**
 * Filtra as cartas com base nos campos do painel esquerdo e sub-aba ativa (Gerência)
 */
function aplicarFiltrosCartas() {
    if (typeof dadosCartasGlobais !== 'undefined' && Array.isArray(dadosCartasGlobais)) {
        dadosCartasGlobais = dadosCartasGlobais.map(limparEPadronizarCartas);
    }
    const fNup = document.getElementById('filtro-cartas-nup').value.toLowerCase().trim();
    const fReq = document.getElementById('filtro-cartas-req').value.toLowerCase().trim();
    const fTec = document.getElementById('filtro-cartas-tec').value.toUpperCase().trim();
    const fStatus = document.getElementById('filtro-cartas-status').value.toUpperCase().trim();
    const fPrioridade = document.getElementById('filtro-cartas-prioridade').value.toUpperCase().trim();

    const filtrados = dadosCartasGlobais.filter(r => {
        const nupRow = String(r['NUP'] || '').toLowerCase();
        const reqRow = String(r['REQUERENTE'] || '').toLowerCase();
        const tecRow = String(r['TÉCNICO/ADM'] || r['TECNICO/ADM'] || '').toUpperCase().trim();
        const statusRow = String(r['STATUS'] || '').toUpperCase();
        const prioridadeRow = String(r['PRIORIDADE'] || '').toUpperCase();
        const gerenciaRow = String(r['GERÊNCIA'] || '').toUpperCase().trim();

        let matchesSubAba = true;
        if (filtroAtivo === 'cartas-revisao') {
            const statusResp = String(r['STATUS DA RESPOSTA'] || r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
            if (subAbaCartasRevisaoAtiva === 'Pendentes') {
                matchesSubAba = (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO');
            } else if (subAbaCartasRevisaoAtiva === 'Reprovados') {
                matchesSubAba = (statusResp === 'REPROVADO');
            } else if (subAbaCartasRevisaoAtiva === 'Geral') {
                matchesSubAba = (statusResp !== 'REPROVADO');
            }
        } else {
            const semTecnico = tecRow === '' || tecRow === '-' || tecRow === 'S/T' || tecRow === 'SEM TÉCNICO' || tecRow === 'NÃO ATRIBUÍDO';
            const setorRegistro = semTecnico
                ? gerenciaRow
                : (MAPA_TECNICOS_SETORES[tecRow] || 'S/G');
            matchesSubAba = (subAbaCartasAtiva === 'Geral' || setorRegistro === subAbaCartasAtiva);
        }

        let matchesTecnicoLogado = true;
        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            matchesTecnicoLogado = (typeof window.isMesmoTecnico === 'function') 
                ? window.isMesmoTecnico(tecRow, usuarioAtivo) 
                : (tecRow === String(usuarioAtivo.nomePlanilha || '').toUpperCase().trim());
        }

        // Restrição de Gerência para GCAR / GEAA / GEAMB
        if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            const semTecnico = tecRow === '' || tecRow === '-' || tecRow === 'S/T' || tecRow === 'SEM TÉCNICO' || tecRow === 'NÃO ATRIBUÍDO' || tecRow === 'SEM TÉCNICO/ADM';
            if (!semTecnico) {
                const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecRow] : null) || 'S/G';
                if (setorInternoDoTecnico !== usuarioAtivo.setor && gerenciaRow !== usuarioAtivo.setor) return false;
            } else {
                if (gerenciaRow !== usuarioAtivo.setor) return false;
            }
        }

        const isAtrasadoProcess = (Number(r['DIAS RESTANTES']) < 0 && statusRow !== 'TRAMITADO' && statusRow !== 'ARQUIVADO' && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO' && statusRow !== 'FAZER DESPACHO' && statusRow !== 'AGUARDANDO ASSINATURA' && statusRow !== 'FINALIZADO');
        const matchesAtrasoTab = (filtroAtivo !== 'cartas-atrasados' || isAtrasadoProcess);

        return matchesSubAba
            && matchesTecnicoLogado
            && matchesAtrasoTab
            && (!fNup || nupRow.includes(fNup))
            && (!fReq || reqRow.includes(fReq))
            && (!fTec || tecRow.includes(fTec))
            && (!fStatus || statusRow === fStatus)
            && (!fPrioridade || prioridadeRow === fPrioridade);
    });

    if (filtroAtivo === 'cartas-atrasados') {
        filtrados.sort((a, b) => {
            const numA = Number(a['DIAS RESTANTES']) || 0;
            const numB = Number(b['DIAS RESTANTES']) || 0;
            return numA - numB;
        });
    }

    renderTabelaCartas(filtrados);
}

/**
 * Limpa todos os filtros laterais e redefine a sub-aba ativa para Geral
 */
function limparFiltrosCartas() {
    document.getElementById('filtro-cartas-nup').value = '';
    document.getElementById('filtro-cartas-req').value = '';
    document.getElementById('filtro-cartas-tec').value = '';
    document.getElementById('filtro-cartas-status').value = '';
    document.getElementById('filtro-cartas-prioridade').value = '';

    setSubAbaCartas('Geral');
    mostrarToast("Filtros limpos com sucesso!", "success");
}

/**
 * Exporta a listagem atualmente filtrada para CSV
 */
function exportarCSVCartas() {
    if (cartasExibidas.length === 0) {
        mostrarToast("Não existem dados para exportar com o filtro atual.", "error");
        return;
    }

    // Colunas exclusivas da exportação
    const colunasParaExportar = [
        "DATA DO REPASSE",
        "NUP",
        "FÍSICO/E-MS",
        "ATIVIDADE",
        "PRIORIDADE",
        "REQUERENTE",
        "GERÊNCIA",
        "TÉCNICO/ADM",
        "STATUS",
        "TRAMITADO P/",
        "OBSERVAÇÃO"
    ];

    let csvContent = colunasParaExportar.join(",") + "\n";

    cartasExibidas.forEach(linha => {
        let valores = colunasParaExportar.map(col => {
            // Mapeia chaves que possam ter pequenas variações no objeto
            let valorChave = linha[col];
            if (valorChave === undefined) {
                if (col === "FÍSICO/E-MS") valorChave = linha["FISICO/E-MS"];
                else if (col === "TÉCNICO/ADM") valorChave = linha["TECNICO/ADM"];
                else if (col === "TRAMITADO P/") valorChave = linha["TRAMITADO_P"];
                else if (col === "DATA DO REPASSE") valorChave = linha["DATA DE REPASSE"] || linha["DATA"];
                else if (col === "OBSERVAÇÃO") valorChave = linha["OBSERVAÇÕES"];
            }

            let valor = (valorChave === null || valorChave === undefined) ? "" : String(valorChave);
            if (valor.includes(",") || valor.includes('"') || valor.includes("\n")) {
                valor = `"${valor.replace(/"/g, '""')}"`;
            }
            return valor;
        });
        csvContent += valores.join(",") + "\n";
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `C.O.R.I.N.O._CartasConsulta_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    mostrarToast("Lista de Cartas Consulta exportada com sucesso!", "success");
}

/**
 * Helper para normalizar o link do Drive ou GCS e construir o Preview do iFrame
 */
function obterPreviewLink(url) {
    if (!url || !url.trim() || url.trim() === '-') return null;
    if (typeof isLinkGCS === 'function' && isLinkGCS(url)) {
        return url;
    }
    if (!url.startsWith('http')) return null;
    const fileId = extrairIdDrive(url);
    if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    // Fallback: Substitui /view?usp=sharing por /preview
    return url.replace(/\/view\?usp=sharing/gi, '/preview').replace(/\/view/gi, '/preview');
}

/**
 * Abre o Modal de Pré-visualização Largo específico do módulo
 */
async function abrirModalPreviewCartas(arg1, arg2, arg3) {
    const modalPequeno = document.getElementById('detalhesModal');
    if (modalPequeno) modalPequeno.style.display = 'none';

    let event = null;
    let url = '';
    let linha = null;
    let nup = null;

    const args = [arg1, arg2, arg3].filter(a => a !== null && a !== undefined && a !== '');
    for (const a of args) {
        if (typeof a === 'object') {
            if (typeof a.preventDefault === 'function') {
                event = a;
            } else {
                linha = a;
            }
        } else if (typeof a === 'string') {
            const str = a.trim();
            if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('gs://') || str.includes('drive.google.com') || str.includes('storage.googleapis.com')) {
                if (!url) url = str;
            } else if (!nup && !str.includes('/') && !str.includes('http')) {
                nup = str;
            } else if (!url) {
                url = str;
            }
        } else if (typeof a === 'number' && !linha) {
            const lista = (typeof dadosCartasGlobais !== 'undefined' ? dadosCartasGlobais : (typeof dadosCartas !== 'undefined' ? dadosCartas : []));
            if (a >= 0 && a < lista.length) linha = lista[a];
        }
    }

    if (event && typeof event.preventDefault === 'function') event.preventDefault();

    const listaCartas = (typeof dadosCartasGlobais !== 'undefined' ? dadosCartasGlobais : (typeof dadosCartas !== 'undefined' ? dadosCartas : []));
    
    if (linha && linha['NUP']) {
        nup = linha['NUP'];
    }

    if (!linha && nup && typeof nup === 'string' && nup !== '-') {
        const nupBusca = nup.trim().toUpperCase();
        const nupSemPdf = nupBusca.replace(/\.PDF$/i, '');
        linha = listaCartas.find(x => {
            const n = String(x['NUP'] || '').trim().toUpperCase();
            return n === nupBusca || n.replace(/\.PDF$/i, '') === nupSemPdf;
        });
    }

    if (!linha && url) {
        const urlStr = String(url).trim();
        const driveId = typeof extrairIdDrive === 'function' ? extrairIdDrive(urlStr) : null;
        linha = listaCartas.find(x => {
            const campos = [
                x['LINK DO NUP'], x['LINK_NUP'], x['LINK'], x['LINK_PROCESSO'],
                x['LINK DA MANIFESTAÇÃO'], x['LINK DA RESPOSTA'], x['LINK RESPOSTA'],
                x['LINK DA DECLARAÇÃO'], x['MANIFESTACAO_PRELIMINAR'], x['LINK_PARECER_EXTERNO']
            ];
            return campos.some(c => {
                if (!c) return false;
                const cStr = String(c).trim();
                if (cStr === urlStr || cStr.includes(urlStr) || urlStr.includes(cStr)) return true;
                if (driveId && cStr.includes(driveId)) return true;
                return false;
            });
        });
        if (linha && !nup) {
            nup = linha['NUP'];
        }
    }

    const modal = document.getElementById('previewModal');
    if (!modal) return;

    let nupOriginal = (linha && linha['NUP']) ? linha['NUP'] : (nup || '-');
    if (typeof nupOriginal === 'string' && (nupOriginal.startsWith('http') || nupOriginal.includes('/'))) {
        nupOriginal = '-';
    }
    const nupDisplay = typeof limparNupDisplay === 'function' ? limparNupDisplay(nupOriginal) : String(nupOriginal).replace(/\.pdf$/gi, '');
    const nupFormatado = String(nupOriginal).replace(/[^a-zA-Z0-9]/g, '_');
    const nupEsc = typeof escaparParaAtributo === 'function' ? escaparParaAtributo(nupOriginal) : nupOriginal;

    const linkOriginal = (linha ? (linha['LINK DO NUP'] || linha['LINK_NUP'] || linha['LINK'] || linha['LINK_PROCESSO']) : (url || '')) || '';
    const linkResposta = linha ? (linha['LINK DA RESPOSTA'] || linha['LINK RESPOSTA'] || linha['LINK_RESPOSTA'] || '') : '';
    const linkManifestacao = linha ? (linha['LINK DA MANIFESTAÇÃO'] || linha['LINK_MANIFESTACAO'] || linkResposta || '') : '';
    const linkDeclaracao = linha ? (linha['LINK DA DECLARAÇÃO'] || linha['LINK_DECLARACAO'] || '') : '';
    const linkShapefile = linha ? (linha['LINK SHAPEFILE'] || linha['LINK_SHAPEFILE'] || '') : '';
    const linkPreliminar = linha ? (linha['MANIFESTACAO_PRELIMINAR'] && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '' && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '-' ? linha['MANIFESTACAO_PRELIMINAR'] : '') : '';
    const linkParecerExterno = linha ? (linha['LINK_PARECER_EXTERNO'] && linha['LINK_PARECER_EXTERNO'].trim() !== '' && linha['LINK_PARECER_EXTERNO'].trim() !== '-' ? linha['LINK_PARECER_EXTERNO'] : '') : '';

    const previewOriginalUrl = typeof obterPreviewLink === 'function' ? obterPreviewLink(linkOriginal) : linkOriginal;
    const previewManifestacaoUrl = typeof obterPreviewLink === 'function' ? obterPreviewLink(linkManifestacao) : linkManifestacao;
    const previewDeclaracaoUrl = typeof obterPreviewLink === 'function' ? obterPreviewLink(linkDeclaracao) : linkDeclaracao;
    const previewPreliminarUrl = typeof obterPreviewLink === 'function' ? obterPreviewLink(linkPreliminar) : linkPreliminar;
    const previewParecerUrl = typeof obterPreviewLink === 'function' ? obterPreviewLink(linkParecerExterno) : linkParecerExterno;

    const iconeOlhoGrande = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-wrapper" id="preview-wrapper-id">
            <div class="preview-toolbar">
                <div class="preview-toolbar-title">
                    ${iconeOlhoGrande}
                    <span class="modal-detail-module-tag modal-detail-tag-carta" style="margin-right: 8px;"><i class="ci ci-mail"></i> Carta Consulta</span>
                    <span>${nupDisplay}</span>
                </div>
                <div class="preview-toolbar-buttons">
                    <a id="btn-open-preview" href="#" target="_blank" class="btn-preview-action" title="Abrir em Nova Aba"><i class="ci ci-external"></i> Abrir em Nova Aba</a>
                    <a id="btn-download-preview" href="#" class="btn-preview-action btn-download-preview-action" download title="Fazer download deste documento" onclick="feedbackDownload(this)"><i class="ci ci-download"></i> Baixar Documento</a>
                    <button class="btn-preview-action" onclick="togglePreviewInfo()"><i class="ci ci-info"></i> Painel de Informações</button>
                    <button class="btn-preview-action btn-close-preview" onclick="fecharPreview()"><i class="ci ci-close"></i> Fechar</button>
                </div>
            </div>
            <div class="preview-body">
                <iframe id="previewFrame" class="preview-iframe" src=""></iframe>
                <div id="gisMapContainerModal" style="display: none; flex: 1; position: relative; background-color: #1a1a1a;">
                    <div id="gisLoadingModal" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.8); padding: 20px; border-radius: 8px; color: #f39c12; font-weight: bold; z-index: 999; display: none;">
                        ⏳ A carregar Shapefile com segurança...
                    </div>
                </div>
                <div id="previewInfo" class="preview-info">
                    <div id="previewInfoContent"></div>
                </div>
            </div>
        </div>
    `;

    const statusStr = String(linha ? (linha['STATUS'] || 'AGUARDANDO DISTRIBUIÇÃO') : '').toUpperCase();
    const statusLimpo = statusStr.replace(/\./g, '').trim().toUpperCase();
    const isSobrestado = statusLimpo === 'SOBRESTADO' || statusLimpo.includes('SOBRESTADO');

    let urlPreviewRaw = url;
    if (!urlPreviewRaw) {
        if (isSobrestado && previewPreliminarUrl) {
            urlPreviewRaw = previewPreliminarUrl;
        } else {
            urlPreviewRaw = previewOriginalUrl || previewPreliminarUrl || previewParecerUrl || previewManifestacaoUrl || previewDeclaracaoUrl || '';
        }
    }

    let urlPreview = '';
    let urlDownload = '#';

    if (urlPreviewRaw) {
        try {
            if (typeof obterLinkVisualizacaoSeguro === 'function') urlPreview = await obterLinkVisualizacaoSeguro(urlPreviewRaw);
            if (typeof obterLinkDownloadSeguro === 'function') urlDownload = await obterLinkDownloadSeguro(urlPreviewRaw, `Carta_${nupFormatado}.pdf`);
        } catch (e) {
            console.warn('Erro ao resolver link seguro da Carta:', e);
            urlPreview = urlPreviewRaw;
            urlDownload = urlPreviewRaw;
        }
    }

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) btnDownload.href = urlDownload;
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) btnOpenPreview.href = urlPreview || urlPreviewRaw;
    const previewFrame = document.getElementById('previewFrame');
    if (previewFrame) previewFrame.src = urlPreview || urlPreviewRaw;

    if (!linha) {
        const previewInfoEl = document.getElementById('previewInfoContent');
        if (previewInfoEl) previewInfoEl.innerHTML = `<div class="preview-info-card"><div class="preview-info-item">📄 Visualizando Carta Consulta: <strong>${nupDisplay}</strong></div></div>`;
        modal.style.display = 'flex'; const infoPanel = document.getElementById('previewInfo'); if (infoPanel) infoPanel.scrollTop = 0;
        return;
    }

    const obs = (linha['OBSERVAÇÃO'] || linha['OBSERVAÇÕES'] || '').trim();
    const htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="preview-info-obs"><strong>📋 Observação:</strong><br>${obs}</div>` : '';

    // Toggles
    let hasOrig = !!previewOriginalUrl;
    let hasPreliminar = !!previewPreliminarUrl;
    let hasParecer = !!previewParecerUrl;
    let hasManifest = !!previewManifestacaoUrl;
    let hasDeclar = !!previewDeclaracaoUrl;
    let hasShape = !!(linkShapefile && linkShapefile.trim() !== '' && linkShapefile.trim() !== '-');

    let docsDisponiveis = [];
    if (hasOrig) docsDisponiveis.push({ label: '📜 Ver NUP', url: previewOriginalUrl });
    if (hasPreliminar) docsDisponiveis.push({ label: '📄 Manifestação Preliminar (Sobrestamento)', url: previewPreliminarUrl });
    if (hasParecer) docsDisponiveis.push({ label: '🏛️ Parecer Externo', url: previewParecerUrl });
    if (hasManifest) docsDisponiveis.push({ label: '📄 Manifestação', url: previewManifestacaoUrl });
    if (hasDeclar) docsDisponiveis.push({ label: '📜 Declaração', url: previewDeclaracaoUrl });

    let toggleBtn = '';
    if (docsDisponiveis.length > 1 || hasShape) {
        toggleBtn = `<div style="display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap;">`;
        docsDisponiveis.forEach(doc => {
            const isActive = (urlPreviewRaw === doc.url || urlPreview === doc.url);
            toggleBtn += `<button onclick="alternarVisualizacaoPreview(this, '${doc.url}', '${doc.url}')" class="btn-drive btn-preview-toggle-tab ${isActive ? 'active' : ''}" style="flex: 1; padding: 8px 10px; font-size: 11.5px; min-width: 90px;">${doc.label}</button>`;
        });
        if (hasShape) {
            toggleBtn += `<button onclick="alternarParaShapefileCartas(this, '${linkShapefile}', '${index}')" class="btn-drive btn-preview-toggle-tab" style="flex: 1; padding: 8px 10px; font-size: 11.5px; min-width: 90px;">🗺️ Ver Mapa</button>`;
        }
        toggleBtn += `</div>`;
    }

    // Ações Rápidas de Interação
    let botoesAcoesHtml = '';
    const isGestor = usuarioAtivo && ((typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo()) || (typeof window.podeDistribuirProcesso === 'function' && window.podeDistribuirProcesso()) || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
    const isTecnico = usuarioAtivo && usuarioAtivo.perfil === 'tecnico';

    if (usuarioAtivo) {
        if (hasManifest || hasDeclar) {
            botoesAcoesHtml += `<button onclick="removerRespostaCarta(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-danger" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-trash"></i> Retirar Resposta/Manifestação</button>`;
        } else if (isTecnico || isGestor) {
            botoesAcoesHtml += `<button onclick="anexarRespostaCarta(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
        }

        if (!hasOrig) {
            botoesAcoesHtml += `<button onclick="anexarPdfOriginalCarta(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar PDF Inicial</button>`;
        }
        if (!hasShape) {
            botoesAcoesHtml += `<button onclick="anexarShapefileCarta(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-link" style="width: 100%; margin-bottom: 8px;">🗺️ Anexar Shapefile (.zip)</button>`;
        }
    }

    if (isGestor) {
        const tec = linha['TÉCNICO/ADM'] || linha['TECNICO/ADM'] || linha['TÉCNICO'] || '';
        const isSemTecnico = !tec || tec === '-' || tec === 'S/T' || tec === 'Não atribuído';
        const labelTec = isSemTecnico ? '<i class="ci ci-user"></i> Distribuir / Atribuir Técnico' : '<i class="ci ci-user"></i> Redistribuir Técnico';
        botoesAcoesHtml += `<button onclick="abrirAtribuirTecnicoCarta('${nupEsc}')" class="modal-detail-btn modal-detail-btn-gestao" style="width: 100%; margin-bottom: 8px;">${labelTec}</button>`;
    }

    // Avaliação Revisor
    let acoesRevisorHtml = '';
    const statusRespAval = (linha['STATUS DA RESPOSTA'] || '').toUpperCase();
    const tecRowCarta = String(linha['TÉCNICO/ADM'] || linha['TECNICO/ADM'] || '').toUpperCase().trim();
    const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecRowCarta] : null) || 'S/G';
    const podeAvaliar = usuarioAtivo && (usuarioAtivo.username === 'diflor' || (typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() && (usuarioAtivo.setor === 'DIFLOR' || setorInternoDoTecnico === usuarioAtivo.setor)));

    if (podeAvaliar && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && hasManifest) {
        acoesRevisorHtml = `
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; margin-bottom: 8px;">
                <div style="color: #fbbf24; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">📋 Avaliação da Manifestação (Revisor):</div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="avaliarRespostaCarta(event, '${nupEsc}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-check"></i> Aprovar</button>
                    <button onclick="avaliarRespostaCarta(event, '${nupEsc}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-close"></i> Reprovar</button>
                </div>
            </div>
        `;
    }

    // Gestão Status
    let acoesStatusDiretoria = '';
    if (isGestor) {
        const opcoesCartaStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER DESPACHO", "SOBRESTADO", "REVISÃO", "AGUARDANDO ASSINATURA", "FINALIZADO", "DEVOLVIDO"];
        const optionsHtml = opcoesCartaStatus.map(st => `<option value="${st}" ${st === statusStr ? 'selected' : ''}>${st}</option>`).join('');
        acoesStatusDiretoria = `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px; font-weight: 700;"><i class="ci ci-settings"></i> GESTÃO DE STATUS</div>
                <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box; align-items: center;">
                    <select id="changeStatusSelectCarta-${nupEsc}" style="flex: 1; min-width: 0; padding: 6px 10px; background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12px; outline: none; height: 36px; box-sizing: border-box;">
                        ${optionsHtml}
                    </select>
                    <button onclick="salvarStatusManualCarta(event, '${nupEsc}')" id="btnSalvarStatusCarta-${nupEsc}" class="btn-drive btn-blue" style="flex-shrink: 0; width: auto; min-width: 70px; padding: 6px 12px; margin: 0; font-size: 12px; height: 36px; box-sizing: border-box;">Salvar</button>
                </div>
            </div>
        `;
    }

    let acoesFluxoHtml = '';
    const podeAcaoFluxo = isGestor || (typeof window.podeConfeccionarDespachoOuCI === 'function' && window.podeConfeccionarDespachoOuCI(setorInternoDoTecnico));

    if (statusLimpo === 'SOBRESTADO') {
        acoesFluxoHtml = `
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; margin-bottom: 10px;">
                <div style="color: #fbbf24; font-weight: 700; font-size: 12.5px; margin-bottom: 8px;">⏸️ Processo Sobrestado ${linha['SOBRESTADO_SETOR'] ? `(Encaminhado para: ${linha['SOBRESTADO_SETOR']})` : ''}</div>
                ${linha['SOBRESTADO_MOTIVO'] ? `<div style="font-size: 12px; color: #cbd5e1; margin-bottom: 10px;"><strong>Motivo:</strong> ${linha['SOBRESTADO_MOTIVO']}</div>` : ''}
                ${previewPreliminarUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${previewPreliminarUrl}', '${previewPreliminarUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(0, 250, 154, 0.15); border: 1px solid #00fa9a; color: #00fa9a; width: 100%; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-eye"></i> Visualizar Manifestação Preliminar</button>` : ''}
                ${previewParecerUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${previewParecerUrl}', '${previewParecerUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; width: 100%; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-court"></i> Visualizar Parecer Externo</button>` : ''}
                ${previewOriginalUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${previewOriginalUrl}', '${previewOriginalUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; width: 100%; margin-bottom: 8px; font-size: 12px; font-weight: 600; padding: 7px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-folder"></i> Visualizar NUP Original</button>` : ''}
                <button onclick="if(typeof abrirModalRetornoSobrestamento==='function') abrirModalRetornoSobrestamento('${nupEsc}', 'carta');" class="btn-drive" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border: 1px solid #22c55e; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
            </div>
        `;
    } else if (podeAcaoFluxo) {
        if (statusLimpo === 'FAZER DESPACHO') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(41, 128, 185, 0.12); border: 1px solid rgba(41, 128, 185, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #38bdf8; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;"><i class="ci ci-megaphone"></i> Ações de Fluxo (Despacho):</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="atualizarStatusCarta(event, '${nupEsc}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: 1px solid #3b82f6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Realização do Despacho</button>
                        <button onclick="if(typeof abrirModalSobrestar==='function') abrirModalSobrestar('${nupEsc}', 'carta');" class="btn-drive" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; width: 100%; margin: 0; font-size: 13px; font-weight: 600; padding: 9px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                    </div>
                </div>
            `;
        } else if (statusLimpo === 'AGUARDANDO ASSINATURA') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #c084fc; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">✍️ Ações de Fluxo (Assinatura):</div>
                    <button onclick="atualizarStatusCarta(event, '${nupEsc}', 'FINALIZADO')" class="btn-drive" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: 1px solid #8b5cf6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Assinatura Realizada</button>
                </div>
            `;
        }
    }

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-header">
            <div class="preview-info-tag-and-status">
                <span class="modal-detail-module-tag modal-detail-tag-carta"><i class="ci ci-mail"></i> Carta Consulta</span>
                <span class="modal-detail-status-value modal-detail-status-carta">${statusStr}</span>
            </div>
            <h3 class="preview-info-nup-title">${nupDisplay}</h3>
        </div>

        ${toggleBtn}

        <div class="preview-info-card">
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-user"></i></span><div><strong>Requerente:</strong> ${linha['REQUERENTE'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-calendar"></i></span><div><strong>Data Entrada:</strong> ${linha['DATA DO REPASSE'] || linha['DATA DE REPASSE'] || linha['DATA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-map"></i></span><div><strong>Município/Local:</strong> ${linha['MUNICÍPIO'] || linha['LOCAL'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-home"></i></span><div><strong>CAR / Imóvel:</strong> ${linha['CAR'] || linha['CARMS'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-pin"></i></span><div><strong>Tipo de Carta:</strong> ${linha['TIPO'] || 'Consulta Prévia'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-clock"></i></span><div><strong>Prazo:</strong> ${linha['PRAZO'] ? linha['PRAZO'] + ' dias' : '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-user"></i></span><div><strong>Responsável:</strong> <span style="color: #c084fc; font-weight: 600;">${linha['TÉCNICO/ADM'] || linha['TECNICO/ADM'] || 'Não atribuído'}</span></div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-building"></i></span><div><strong>Gerência:</strong> ${linha['GERÊNCIA'] || 'GCAR'}</div></div>
        </div>

        ${htmlObs}

        <div id="preview-cartas-timeline-container" style="margin-top: 15px;"></div>

        <div class="preview-actions-section">
            <div class="preview-actions-title">Ações e Interações</div>
            ${acoesFluxoHtml}
            ${botoesAcoesHtml}
            ${acoesRevisorHtml}
            ${acoesStatusDiretoria}
        </div>
    `;

    modal.style.display = 'flex';
    if (linha && linha['NUP'] && typeof renderizarLinhaTempoSistema === 'function') {
        renderizarLinhaTempoSistema(linha['NUP'], 'preview-cartas-timeline-container');
    }
}


/**
 * Abre o modal de pré-visualização e ativa diretamente a aba do Shapefile
 */
function abrirModalPreviewCartasShapefile(index, linkShapefile) {
    abrirModalPreviewCartas(index);
    setTimeout(() => {
        const toggleTabs = document.querySelectorAll('#previewModal .btn-preview-toggle-tab');
        let shapeBtn = null;
        for (let i = 0; i < toggleTabs.length; i++) {
            if (toggleTabs[i].textContent.includes('Mapa')) {
                shapeBtn = toggleTabs[i];
                break;
            }
        }
        if (shapeBtn) {
            alternarParaShapefileCartas(shapeBtn, linkShapefile, index);
        }
    }, 150);
}

/**
 * Habilita a visualização Geoespacial integrando-a com a janela de pré-visualização principal.
 */
async function alternarParaShapefileCartas(btn, shapeUrl, indexStr) {
    const container = btn.parentElement;
    if (container) {
        const botoes = container.querySelectorAll('.btn-preview-toggle-tab');
        botoes.forEach(b => b.classList.remove('active'));
    }
    btn.classList.add('active');

    const iframe = document.getElementById('previewFrame');
    if (iframe) iframe.style.display = 'none';
    
    const gisContainer = document.getElementById('gisMapContainerModal');
    if (gisContainer) gisContainer.style.display = 'block';

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) {
        if (typeof isLinkGCS === 'function' && isLinkGCS(shapeUrl)) {
            const recordNup = (dadosCartasGlobais[indexStr] && dadosCartasGlobais[indexStr]['NUP']) ? dadosCartasGlobais[indexStr]['NUP'] : 'carta';
            obterLinkDownloadSeguro(shapeUrl, `Shapefile_${recordNup}.zip`).then(dl => {
                btnDownload.href = dl;
            }).catch(() => { btnDownload.href = shapeUrl; });
        } else {
            const fileId = extrairIdDrive(shapeUrl);
            btnDownload.href = fileId ? `https://drive.google.com/uc?export=download&id=${fileId}` : shapeUrl;
        }
    }

    if (typeof carregarBibliotecasGIS === 'function') {
        await carregarBibliotecasGIS();
    }

    if (!window.mapaGisModal) {
        window.mapaGisModal = L.map('gisMapContainerModal').setView([-20.44278, -54.64639], 6);
        L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3']
        }).addTo(window.mapaGisModal);
        L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',{
            maxZoom: 20,
            subdomains:['mt0','mt1','mt2','mt3'],
            opacity: 0.8
        }).addTo(window.mapaGisModal);
    }

    setTimeout(() => { window.mapaGisModal.invalidateSize(); }, 300);

    const loadingEl = document.getElementById('gisLoadingModal');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
        const record = dadosCartasGlobais[indexStr];
        const nup = record ? record['NUP'] : '';
        let geojson = nup ? cacheShapesCartas[nup] : null;

        if (!geojson) {
            let buffer = null;
            if (typeof isLinkGCS === 'function' && isLinkGCS(shapeUrl)) {
                console.log(`[GIS] Baixando Shapefile seguro do GCS para NUP: ${nup}`);
                const signedUrl = await GCSStorage.obterUrlTemporaria(shapeUrl, { responseDisposition: 'inline' });
                const resp = await fetch(signedUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status} ao obter Shapefile do GCS`);
                buffer = await resp.arrayBuffer();
            } else {
                const fileId = extrairIdDrive(shapeUrl);
                if (!fileId) throw new Error('ID do Google Drive não encontrado no link.');

                // Baixa o ZIP em formato binário encapsulado em base64 da nossa API sem sofrer CORS block do Google Drive
                const payload = { acao: 'download_drive_file', fileId: fileId };
                const resultado = await executarAcaoGAS(payload);

                if (resultado.status !== 'success') throw new Error(resultado.message || 'Erro ao baixar Shapefile.');

                const binaryString = window.atob(resultado.base64);
                const len = binaryString.length;
                const bytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
                buffer = bytes.buffer;
            }

            geojson = await shp(buffer);
            if (Array.isArray(geojson)) {
                // Se for um array de FeatureCollections (múltiplas camadas no ZIP), consolida em uma única FeatureCollection
                let allFeatures = [];
                geojson.forEach(fc => {
                    if (fc && fc.features) {
                        allFeatures = allFeatures.concat(fc.features);
                    }
                });
                geojson = {
                    type: "FeatureCollection",
                    features: allFeatures
                };
            }

            // Reprojetar coordenadas UTM para WGS84 se necessário
            if (typeof normalizarProjecaoShapefile === 'function') {
                const comarca = record ? record['COMARCA'] : '';
                geojson = await normalizarProjecaoShapefile(buffer, geojson, comarca);
            }

            if (nup) {
                cacheShapesCartas[nup] = geojson;
            }
        }

        if (window.camadaGeoJsonModal) window.mapaGisModal.removeLayer(window.camadaGeoJsonModal);

        // Dicionário de Classes do CARMS
        const descricoesCARMS = {
            "101": "ÁREA TOTAL DO IMÓVEL",
            "102": "ÁREA DO IMÓVEL CERTIFICADA PELO INCRA",
            "103": "ÁREA DE REMANESCENTE DE VEGETAÇÃO NATIVA",
            "104": "AREA DE OCUPAÇÃO AGROSILVIPASTORIL, ECOTURISMO E TURISMO RURAL ANTERIOR A 22/07/2008",
            "105": "ÁREA DE OCUPAÇÃO POR OUTRAS ATIVIDADES",
            "106": "ÁREA DE OCUPAÇÃO AGROSILVIPASTORIL, ECOTURISMO E TURISMO RURAL POSTERIOR A 22/07/2008",
            "107": "ÁREA DE ATIVIDADE DE MANEJO FLORESTAL ANTERIOR A 28/05/2012",
            "108": "ÁREA DE ATIVIDADE DE BAIXO IMPAСТО INDICADA NO INCISO 10 DO ART. 2º DO DECRETO ESTADUAL",
            "109": "ÁREA DE INTERESSE SOCIAL INDICADA NO INCISO 11 DO ART. 2º DO DECRETO ESTADUAL n°13.977/14",
            "110": "AREA DE UTILIDADE PÚBLICA INDICADA NO INCISO 12 DO ART. 2º DO DECRETO ESTADUAL n°13.977/14",
            "111": "AREA DE RESERVA PARTICULAR DE PATRIMÔNIO NATURAL",
            "112": "ÁREA DE SERVIDÃO AMBIENTAL",
            "113": "ÁREA DE POUSIO",
            "114": "ÁREA DE PASTAGEM NATIVA",
            "115": "SEDE DO IMÓVEL",
            "116": "BENEFEITORIAS DO IMÓVEL",
            "117": "VIAS INTERNAS NÃO REGISTRADAS COMO ÁREA DE SERVIDÃO ADMINISTRATIVA",
            "118": "ÁREA DE SERVIDÃO ADMINISTRATIVA UTILIDADE PÚBLICA",
            "119": "AREA DE SERVIDÃO ADMINISTRATIVA RESERVATÓRIO D'ÁGUA ARTIFICIAL DESTINADO A GERAÇÃO DE ENERGIA",
            "120": "ÁREA DO CURSO D'ÁGUA EFÊMERO",
            "121": "ÁREA DO CURSO D'ÁGUA NATURAL PERENE OU INTERMITENTE COM LARGURA INFERIOR A 10 M",
            "122": "ÁREA DO CURSO D'ÁGUA NATURAL PERENE OU INTERMITENTE COM LARGURA DE 10 A 50 M",
            "123": "ÁREA DO CURSO D'ÁGUA NATURAL PERENE OU INTERMITENTE COM LARGURA SUPERIOR A 50 E ATÉ 200 M",
            "124": "ÁREA DO CURSO D'ÁGUA NATURAL PERENE OU INTERMITENTE COM LARGURA SUPERIOR A 200 E ATÉ 600 M",
            "125": "ÁREA DO CURSO D'ÁGUA NATURAL PERENE OU INTERMITENTE COM LARGURA SUPERIOR A 600 M",
            "126": "AREA DO LAGO E LAGOA NATURAL",
            "127": "AREA DO RESERVATÓRIO D'ÁGUA ARTIFICIAL DECORRENTE DE BARRAMENTO OU REPRESAMENTO",
            "128": "ÁREA DO RESERVATÓRIO D'ÁGUA ARTIFICIAL DESTINADO A GERAÇÃO DE ENERGIA OU ABASTECIMENTO PÚBLICO",
            "129": "ÁREA DA NASCENTE E OLHO D'ÁGUA PERENE",
            "130": "ÁREA DA ENCOSTA COM DECLIVIDADE SUPERIOR A 45 GRAUS",
            "131": "ÁREA DA BORDA DE TABULEIRO E CHAPADAS",
            "132": "ÁREA DO TOPO DE MORRO",
            "133": "ÁREA SUPERIOR A 1.800 METROS",
            "134": "ÁREA DA VEREDA",
            "135": "APP DO RESERVATÓRIO D'ÁGUA ARTIFICIAL DECORRENTE DE BARRAMENTO OU REPRESAMENTO",
            "136": "APP DO RESERVATÓRIO D'ÁGUA ARTIFICIAL DESTINADO A GERAÇÃO DE ENERGIA OU ABASTECIMENTO PÚBLICO",
            "137": "ÁREA DE USO RESTRITO COM INCLINAÇÃO DE 25 A 45 GRAUS DE DECLIVIDADE",
            "140": "ÁREA DE REMANESCENTE DE VEGETAÇÃO NATIVA PROPOSTA PARA CONSTITUIÇÃO DE RESERVA LEGAL",
            "141": "ÁREA DE RECUPERAÇÃO DE VEGETAÇÃO PROPOSTA PARA CONSTITUIÇÃO DE RESERVA LEGAL",
            "142": "AREA DE RESERVA LEGAL APROVADA E AVERBADA EM MATRÍCULA",
            "143": "ÁREA DE RESERVA LEGAL EM CONDOMÍNIO",
            "144": "AREA PARA CONSTITUIÇÃO DE COTA DE RESERVA AMBIENTAL ESTADUAL",
            "145": "ÁREA DO PERÍMETRO DAS MATRÍCULAS INDIVIDUALIZADAS",
            "146": "ÁREA DE VEGETAÇÃO REMANESCENTE A SER INCORPORADA A RESERVA LEGAL DO IMÓVEL (TACs)",
            "147": "ÁREA DAS BENFEITORIAS EM APP CONSOLIDADAS ANTERIORES A 22/07/2008",
            "148": "50% DA VEGETAÇÃO NATIVA DE FORMAÇÕES DE CERRADO EXISTENTES NA AUR DO PANTANAL",
            "149": "40% DA VEGETAÇÃO NATIVA DE FORMAÇÕES CAMPESTRES EXISTENTES NA AUR DO PANTANAL",
            "150": "AREA DE PRESERVAÇÃO PERMANENTE ESTABELECIDA EM LEGISLAÇÃO ESPECÍFICA",
            "151": "AREA SUPRIMIDA EM ATIVIDADE DE LICENCIAMENTO OU A SUPRIMIR",
            "152": "ÁREAS INDÍGENAS",
            "153": "ÁREAS QUILOMBOLAS",
            "154": "ÁREAS DE UNIDADES DE CONSERVAÇÃO DE DOMÍNIO PÚBLICO",
            "155": "ÁREA EMBARGADA POR DECISÃO JUDICIAL OU POR DETERMINAÇÃO DE ÓRGÃO DO SISNAMA",
            "156": "ÁREA ÚMIDA BREJOSA",
            "157": "ÁREA ÚMIDA CAMPO DE INUNDAÇÃO",
            "158": "ÁREA INUNDADA",
            "159": "ÁREA INUNDADA OU A SER INUNDADA POR PCH",
            "160": "ÁREA PRIORITÁRIA BANHADOS DE USO RESTRITO DO DECRETO NORMATIVO 15197/2019",
            "161": "FAIXA DE PROTEÇÃO ESPECIAL DAS MARGENS DOS RIOS PRATA, FORMOSO E SEUS AFLUENTES",
            "162": "APP LANDIS E DE TODA VEGETAÇÃO ARBOREA QUE COBRE O CURSO D'ÁGUA NA AUR DA PLANÍCIE PANTANEIRA",
            "163": "AREAS DE SALINAS, O CORPO DE ÁGUA NA AUR DA PLANÍCIE PANTANEIRA",
            "164": "ÁREA PROTEGIDA DE 80% DE VEGETAÇÃO ARBOREA-ARBUSTIVA DE CAPÕES E CORDILHEIRAS",
            "165": "ÁREA DOS 20% DE VEGETAÇÃO ARBÓREA ARBUSTIVA DE CAPÕES E CORDILHEIRAS",
            "166": "AREA BAIXAS COMPREENDIDAS POR PASTAGENS NATIVAS DE QUALIDADE CONFORME A LEI 6160/2023",
            "167": "MURUNDUS NA AUR DA PLANÍCIE PANTANEIRA",
            "168": "ÁREA DE ATIVIDADE AGROSSILVIPASTORIL NO PERIODO DE 22/07/2008 A 28/05/2012",
            "169": "CORREDORES ECOLÓGICOS IDENTIFICADOS NA AUR DA PLANÍCIE PANTANEIRA",
            "170": "APP DE SALINAS, UMA FAIXA MARGINAL DE 100 (CEM) METROS NA AUR DA PLANÍCIE PANTANEIRA",
            "171": "ÁREA DE AGRICULTURA IMPLANTADA NA AUR DA PLANÍCIE PANTANEIRA",
            "172": "ÁREA DO RESERVATÓRIO D'ÁGUA ARTIFICIAL DECORRENTE DE BARRAMENTO (LEI ESTADUAL N. 6165/2023)",
            "173": "ÁREA DE INFORMATIVO DE PRADE, FORA DAS ÁREAS DE RESERVA LEGAL E PRESERVAÇÃO PERMANENTE"
        };

        const palette = ['#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4', '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000', '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'];
        let colorMap = {};
        let colorIndex = 0;

        function getFeatureColor(feature) {
            if (!feature.properties) return '#3498db';
            let classKey = null;
            const keys = Object.keys(feature.properties);
            const commonNames = ['CLASSE', 'CLASS', 'TIPO', 'TEMA', 'CATEGORIA', 'USO', 'DESCRICAO', 'NOME', 'CODIGO'];
            for (let name of commonNames) {
                const found = keys.find(k => k.toUpperCase() === name);
                if (found) { classKey = found; break; }
            }
            if (!classKey && keys.length > 0) classKey = keys[0]; // Fallback para a primeira coluna
            if (!classKey) return '#3498db';

            const val = String(feature.properties[classKey]).trim().toUpperCase();
            if (!colorMap[val]) {
                colorMap[val] = palette[colorIndex % palette.length];
                colorIndex++;
            }
            return colorMap[val];
        }

        // 1. Group features by class code
        const featuresByClass = {};
        const classNames = {}; 
        
        geojson.features.forEach(feature => {
            let classCod = 'UNDEFINED';
            const keys = Object.keys(feature.properties || {});
            const commonNames = ['CLASSE', 'CLASS', 'TIPO', 'TEMA', 'CATEGORIA', 'USO', 'DESCRICAO', 'NOME', 'CODIGO'];
            let classKey = keys.find(k => commonNames.includes(k.toUpperCase()));
            if (!classKey && keys.length > 0) classKey = keys[0];
            if (classKey) {
                classCod = String(feature.properties[classKey]).trim();
            }
            
            if (!featuresByClass[classCod]) {
                featuresByClass[classCod] = [];
            }
            featuresByClass[classCod].push(feature);
            
            if (descricoesCARMS[classCod]) {
                classNames[classCod] = descricoesCARMS[classCod];
            } else {
                classNames[classCod] = classCod;
            }
        });

        // 2. Clear old Layers Control if it exists
        if (window.controleCamadasGis) {
            try {
                window.mapaGisModal.removeControl(window.controleCamadasGis);
            } catch (e) {}
            window.controleCamadasGis = null;
        }

        // 3. We will create a parent layer group for all layers
        window.camadaGeoJsonModal = L.layerGroup().addTo(window.mapaGisModal);
        window.camadasGisIndividuais = {};

        // 4. Create Leaflet GeoJSON layers for each class
        Object.keys(featuresByClass).forEach(classCod => {
            const classFeatures = featuresByClass[classCod];
            const isAreaTotal = classCod === '101' || String(classNames[classCod]).toUpperCase().includes('ÁREA TOTAL') || String(classNames[classCod]).toUpperCase().includes('AREA TOTAL');
            
            // Calcula a área total da classe (em hectares) para uso em popups agrupados
            let classTotalAreaHa = 0;
            try {
                classTotalAreaHa = (turf.area({ type: "FeatureCollection", features: classFeatures }) / 10000).toFixed(4);
            } catch (e) {}

            const subLayer = L.geoJSON({
                type: "FeatureCollection",
                features: classFeatures
            }, {
                style: function(feature) {
                    const c = getFeatureColor(feature);
                    if (isAreaTotal) {
                        // Border only, no fill, slightly thicker border
                        return { color: c, weight: 3, opacity: 1, fill: false, fillColor: 'none', fillOpacity: 0 };
                    } else {
                        // Thinner border, more transparent fill (opacity 0.2)
                        return { color: c, weight: 1.5, opacity: 0.8, fillColor: c, fillOpacity: 0.2 };
                    }
                },
                onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                        let popupContent = '<div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">';
                        
                        let featureAreaHa = 0;
                        if (feature.geometry) {
                            try {
                                featureAreaHa = (turf.area(feature) / 10000).toFixed(4);
                            } catch (e) {}
                        }
                        
                        if (descricoesCARMS[classCod]) {
                            popupContent += `<div style="margin-bottom: 10px; padding: 10px; background-color: rgba(52, 152, 219, 0.1); border-left: 3px solid #3498db; border-radius: 4px;">
                                <strong style="color: #3498db; font-size: 11px;">🗺️ CATEGORIA CARMS (${classCod})</strong><br>
                                <span style="color: #444; font-size: 13px; font-weight: bold; line-height: 1.4;">${descricoesCARMS[classCod]}</span>
                            </div>`;
                        }
                        
                        if (classCod === '140') {
                            popupContent += `<div style="margin-bottom: 10px; padding: 8px; background-color: rgba(46, 204, 113, 0.1); border-left: 3px solid #2ecc71; border-radius: 4px;">
                                <strong style="color: #2ecc71; font-size: 11px;">📏 ÁREA TOTAL DA RESERVA LEGAL (CLASSE 140)</strong><br>
                                <span style="color: #222; font-size: 14px; font-weight: bold;">${classTotalAreaHa} ha</span>
                            </div>`;
                        } else if (featureAreaHa > 0) {
                            popupContent += `<div style="margin-bottom: 10px; padding: 8px; background-color: rgba(46, 204, 113, 0.1); border-left: 3px solid #2ecc71; border-radius: 4px;">
                                <strong style="color: #2ecc71; font-size: 11px;">📏 ÁREA DESTE ITEM DELIMITADO</strong><br>
                                <span style="color: #222; font-size: 14px; font-weight: bold;">${featureAreaHa} ha</span>
                            </div>`;
                        }
                        
                        popupContent += '<b>Atributos Adicionais:</b><br><table style="width:100%; border-collapse: collapse; margin-top: 5px;">';
                        for (let key in feature.properties) {
                            popupContent += `<tr style="border-bottom: 1px solid #eee;"><td style="color:#888; font-size:11px; padding: 4px 0;">${key}:</td><td style="font-size:12px; padding: 4px 0 4px 8px; word-break: break-word; color:#222;"><b>${feature.properties[key]}</b></td></tr>`;
                        }
                        popupContent += '</table></div>';
                        layer.bindPopup(popupContent);
                    }
                }
            });

            // Save subLayer reference
            window.camadasGisIndividuais[classCod] = subLayer;

            // ONLY Area Total is added to the map by default!
            if (isAreaTotal) {
                subLayer.addTo(window.camadaGeoJsonModal);
            }
        });

        // Fit bounds to entire GeoJSON area
        const entireBounds = L.geoJSON(geojson).getBounds();
        window.mapaGisModal.fitBounds(entireBounds, { padding: [30, 30] });

        if (geojson.features && geojson.features.length > 0) {
            // Calcula a área total somando apenas as feições de "Área Total do Imóvel" (Classe 101) para evitar duplicidade
            let totalAreaM2 = 0;
            let areaTotalFeatures = [];
            
            geojson.features.forEach(feature => {
                let classCod = 'UNDEFINED';
                const keys = Object.keys(feature.properties || {});
                const commonNames = ['CLASSE', 'CLASS', 'TIPO', 'TEMA', 'CATEGORIA', 'USO', 'DESCRICAO', 'NOME', 'CODIGO'];
                let classKey = keys.find(k => commonNames.includes(k.toUpperCase()));
                if (!classKey && keys.length > 0) classKey = keys[0];
                if (classKey) {
                    classCod = String(feature.properties[classKey]).trim();
                }
                
                const desc = descricoesCARMS[classCod] || classCod;
                const isAreaTotal = classCod === '101' || String(desc).toUpperCase().includes('ÁREA TOTAL') || String(desc).toUpperCase().includes('AREA TOTAL');
                if (isAreaTotal) {
                    areaTotalFeatures.push(feature);
                }
            });
            
            if (areaTotalFeatures.length > 0) {
                totalAreaM2 = turf.area({ type: "FeatureCollection", features: areaTotalFeatures });
            } else {
                totalAreaM2 = turf.area(geojson); // Fallback caso não encontre classe de área total
            }
            
            const areaHectares = (totalAreaM2 / 10000).toFixed(4);
            
            let legendHtml = '<div style="margin-top: 15px; font-size: 11px; display: flex; flex-direction: column; gap: 6px;">';
            if (Object.keys(colorMap).length > 0) {
                legendHtml += '<div style="color:#888; margin-bottom:5px; font-weight:bold;">CAMADAS (Marque para ativar no mapa):</div>';
                for (let val in colorMap) {
                    const labelStr = (val === 'UNDEFINED' || val === 'NULL') ? 'Não Classificado' : val;
                    const descricao = descricoesCARMS[val] ? ` - ${descricoesCARMS[val]}` : '';
                    const isAreaTotal = val === '101' || String(classNames[val] || val).toUpperCase().includes('ÁREA TOTAL') || String(classNames[val] || val).toUpperCase().includes('AREA TOTAL');
                    const checkedAttr = isAreaTotal ? 'checked' : '';

                    legendHtml += `
                    <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:6px; background: rgba(255,255,255,0.02); border: 1px solid #333; transition:background 0.2s;">
                        <div onclick="toggleGisClassLabel('${val.replace(/'/g, "\\'")}')" title="Clique para ativar/desativar e focar esta classe" style="display:flex; align-items:flex-start; cursor:pointer; flex: 1; padding-right: 8px;" onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                            <span style="display:inline-block; width:12px; height:12px; background-color:${colorMap[val]}; border:1px solid rgba(255,255,255,0.2); border-radius:3px; margin-right:8px; flex-shrink: 0; margin-top: 2px;"></span>
                            <span style="color:#ddd; font-size:11px; line-height:1.3; font-weight:500;"><strong>${labelStr}</strong>${descricao}</span>
                        </div>
                        <input type="checkbox" id="chk-layer-${val}" ${checkedAttr} onchange="toggleGisLayer('${val.replace(/'/g, "\\'")}', this.checked)" style="width: 14px; height: 14px; cursor: pointer; accent-color: #3498db; margin: 0;">
                    </div>`;
                }
            }
            legendHtml += '</div>';
 
            let infoCard = document.getElementById('gisInfoCardModal') || Object.assign(document.createElement('div'), { id: 'gisInfoCardModal', style: 'margin-top: 15px; background-color: rgba(52, 152, 219, 0.1); border: 1px solid #3498db; border-radius: 6px; padding: 15px;' });
            infoCard.innerHTML = `<div style="font-size: 11px; color: #3498db; font-weight: bold; margin-bottom: 5px;">ÁREA (SHAPEFILE)</div><div style="font-size: 20px; color: white; font-weight: bold;">${areaHectares} ha</div>${legendHtml}`;
            if (!document.getElementById('gisInfoCardModal')) document.getElementById('previewInfoContent').appendChild(infoCard);
        }
    } catch (e) {
        console.error("Erro GIS:", e); mostrarToast('Erro ao ler ou processar o Shapefile ZIP.', 'error');
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

/**
 * Alterna a visibilidade de uma camada e sincroniza o checkbox e zoom
 */
function toggleGisClassLabel(className) {
    if (!window.mapaGisModal || !window.camadasGisIndividuais || !window.camadaGeoJsonModal) return;

    const layer = window.camadasGisIndividuais[className];
    if (layer) {
        const isCurrentlyVisible = window.mapaGisModal.hasLayer(layer);
        const newVisibility = !isCurrentlyVisible;

        toggleGisLayer(className, newVisibility);

        const chk = document.getElementById(`chk-layer-${className}`);
        if (chk) chk.checked = newVisibility;

        if (newVisibility && layer.getBounds) {
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                window.mapaGisModal.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true, duration: 1 });
            }
        }
    }
}



/**
 * Ativa ou remove uma camada específica do mapa
 */
function toggleGisLayer(classCod, isVisible) {
    if (!window.mapaGisModal || !window.camadasGisIndividuais || !window.camadaGeoJsonModal) return;
    const layer = window.camadasGisIndividuais[classCod];
    if (layer) {
        if (isVisible) {
            if (!window.mapaGisModal.hasLayer(layer)) {
                layer.addTo(window.camadaGeoJsonModal);
            }
        } else {
            if (window.mapaGisModal.hasLayer(layer)) {
                window.camadaGeoJsonModal.removeLayer(layer);
            }
        }
    }
}

/**
 * Foca o mapa Leaflet nas coordenadas precisas de uma classe (legenda) específica
 */
function zoomToGisClass(className) {
    if (!window.mapaGisModal || !window.camadasGisIndividuais) return;

    const layer = window.camadasGisIndividuais[className];
    if (layer) {
        // Se a camada não estiver ativa no mapa, adiciona e marca o checkbox correspondente
        if (!window.mapaGisModal.hasLayer(layer)) {
            layer.addTo(window.camadaGeoJsonModal);
            const chk = document.getElementById(`chk-layer-${className}`);
            if (chk) chk.checked = true;
        }
        
        if (layer.getBounds) {
            const bounds = layer.getBounds();
            if (bounds.isValid()) {
                window.mapaGisModal.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true, duration: 1 });
            }
        }
    }
}

// ============================================================================
// AÇÕES DE RESPOSTA — CARTAS CONSULTA
// ============================================================================

/**
 * Técnico: anexa o PDF de resposta à carta e envia para o backend
 */
function anexarRespostaCarta(event, nup) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        btn.innerHTML = '⏳ A enviar...'; btn.disabled = true; btn.style.opacity = '0.7';
        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = err => reject(err);
            });
            const payload = {
                acao: 'upload_resposta_carta',
                nup,
                fileName: `Resposta_Carta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
                base64
            };
            const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();
            if (resultado.status === 'success') {
                mostrarToast('Resposta anexada com sucesso!', 'success');
                const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DA RESPOSTA'] = resultado.url;
                    target['STATUS'] = 'REVISÃO';
                    target['STATUS DA RESPOSTA'] = '';
                    target['MOTIVO DA AVALIAÇÃO'] = '';
                }
                atualizarCacheCartas();
                aplicarFiltrosCartas();
            } else {
                mostrarToast('Erro: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
            }
        } catch (err) {
            mostrarToast('Erro de comunicação.', 'error');
            btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
        }
    };
    fileInput.click();
}

/**
 * Técnico: remove a resposta já enviada (caso ainda não aprovada)
 */
async function removerRespostaCarta(event, nup) {
    const btn = event.currentTarget;
    const result = await mostrarConfirmacao('Deseja desvincular a resposta desta Carta Consulta?', { titulo: 'Confirmar Remoção', textoBotao: '🗑️ Sim, Remover' });
    if (!result.confirmou) return;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ A remover...'; btn.disabled = true;
    try {
        const payload = { acao: 'remover_resposta_carta', nup, username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || '' };
        const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Resposta desvinculada.', 'success');
            const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['LINK DA RESPOSTA'] = '';
                target['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
                target['STATUS DA RESPOSTA'] = '';
                target['MOTIVO DA AVALIAÇÃO'] = '';
            }
            atualizarCacheCartas();
            aplicarFiltrosCartas();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error');
            btn.innerHTML = textoOriginal; btn.disabled = false;
        }
    } catch (err) { mostrarToast('Erro de rede.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

/**
 * Diretoria: aprova ou reprova a resposta técnica da Carta Consulta
 */
async function avaliarRespostaCarta(event, nup, decisao) {
    const btn = event.currentTarget;
    const conf = decisao === 'APROVADO'
        ? { titulo: 'Aprovar', textoBotao: '<i class="ci ci-check"></i> Aprovar', corBotao: '#27ae60' }
        : { titulo: 'Reprovar', textoBotao: '<i class="ci ci-close"></i> Reprovar', corBotao: '#c0392b', exigeMotivo: true };
    const result = await mostrarConfirmacao(`Deseja ${decisao === 'APROVADO' ? 'aprovar' : 'reprovar'} esta resposta?`, conf);
    if (!result.confirmou) return;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ A processar...'; btn.disabled = true;
    try {
        const payload = { acao: 'avaliar_resposta_carta', nup, decisao, motivo: result.motivo || '' };
        const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast(`Resposta ${decisao.toLowerCase()}!`, 'success');
            const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS DA RESPOSTA'] = decisao;
                target['MOTIVO DA AVALIAÇÃO'] = result.motivo || '';
                target['STATUS'] = decisao === 'APROVADO' ? 'FAZER DESPACHO' : 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
            }
            atualizarCacheCartas();
            aplicarFiltrosCartas();
            fecharPreview();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error');
            btn.innerHTML = textoOriginal; btn.disabled = false;
        }
    } catch (err) { mostrarToast('Erro de rede.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

async function salvarStatusManualCarta(event, nup) {
    if (event) event.preventDefault();
    const select = document.getElementById(`changeStatusSelectCarta-${nup}`);
    const novoStatus = select ? select.value : '';
    if (!novoStatus) return;

    const btn = document.getElementById(`btnSalvarStatusCarta-${nup}`) || (event && event.target);
    const txtOriginal = btn ? btn.innerHTML : 'Salvar';
    if (btn) { btn.innerHTML = '⏳ ...'; btn.disabled = true; }

    // Optimistic Update
    const ref = dadosCartasGlobais.find(a => (a['NUP'] || a['PROCESSO'] || a['PROCESSO/NUP']) === nup);
    let statusOriginal = '';
    if (ref) {
        statusOriginal = ref['STATUS'];
        ref['STATUS'] = novoStatus;
        if (ref['STATUS ATUAL']) ref['STATUS ATUAL'] = novoStatus;
    }

    mostrarToast('Status alterado localmente. Sincronizando...', 'success');
    aplicarFiltrosCartas();
    atualizarCacheCartas();
    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Atualiza badge de status no preview se aberto
    const badgePreview = document.querySelector('#previewInfoContent .modal-detail-status-carta');
    if (badgePreview) badgePreview.textContent = novoStatus;

    try {
        const resultado = await executarAcaoGAS({
            acao: "alterar_status_manual_generico",
            tipoAba: "carta",
            nup: nup,
            novoStatus: novoStatus,
            username: (usuarioAtivo && usuarioAtivo.username) ? usuarioAtivo.username : "sistema"
        });
        if (resultado.status === 'success') {
            mostrarToast('Status confirmado na nuvem!', 'success');
        } else {
            throw new Error(resultado.message || 'Erro ao sincronizar status.');
        }
    } catch (e) {
        console.error('Erro ao alterar status de Carta:', e);
        mostrarToast('Falha na sincronização ao alterar status. (Revertendo)', 'error');
        if (ref) {
            ref['STATUS'] = statusOriginal;
            if (ref['STATUS ATUAL']) ref['STATUS ATUAL'] = statusOriginal;
        }
        aplicarFiltrosCartas();
        atualizarCacheCartas();
        if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
        if (badgePreview) badgePreview.textContent = statusOriginal;
    } finally {
        if (btn) { btn.innerHTML = txtOriginal; btn.disabled = false; }
    }
}

/**
 * Diretoria: abre modal para atribuir técnico a uma carta sem responsável
 */
function abrirAtribuirTecnicoCarta(nup) {
    // Reutiliza o modal de atribuição de técnico dos Autos
    const modal = document.getElementById('atribuirTecnicoModal');
    if (!modal) { mostrarToast('Modal de atribuição não disponível.', 'error'); return; }

    const titleEl = document.getElementById('atribuirTecnicoModalTitle');
    if (titleEl) titleEl.innerText = '👤 Distribuir Carta Consulta';

    document.getElementById('atrAutoNup').value = '__CARTA__' + nup;

    const select = document.getElementById('atrAutoTecnico');
    select.innerHTML = '<option value="">-- Selecione o Técnico --</option>';
    if (typeof opcoesAutoTecnico !== 'undefined') {
        opcoesAutoTecnico.forEach(tec => {
            const opt = document.createElement('option');
            opt.value = tec; opt.textContent = tec;
            select.appendChild(opt);
        });
    }

    modal.style.zIndex = '2000';
    modal.style.display = 'flex';
}

/**
 * Diretoria: salva a atribuição de técnico a uma carta
 */
async function salvarAtribuicaoTecnicoCarta() {
    const nupRaw = document.getElementById('atrAutoNup').value;
    const nup = nupRaw.replace('__CARTA__', '');
    const tecnico = document.getElementById('atrAutoTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico.', 'error'); return; }

    // Optimistic update
    const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
    let tecOriginal = '';
    let statusOriginal = '';
    if (target) {
        tecOriginal = target['TÉCNICO/ADM'] || '';
        statusOriginal = target['STATUS'] || '';
        target['TÉCNICO/ADM'] = tecnico;
        target['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }

    fecharModalAtribuirTecnico();

    atualizarCacheCartas();
    aplicarFiltrosCartas();
    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Atualiza campos visuais no modal de preview se estiver aberto
    const infoContent = document.getElementById('previewInfoContent');
    if (infoContent) {
        infoContent.querySelectorAll('.preview-info-item').forEach(item => {
            if (item.textContent.includes('Responsável:')) {
                const s = item.querySelector('span:last-child');
                if (s) s.textContent = tecnico;
            }
        });
        const stBadge = infoContent.querySelector('.modal-detail-status-carta');
        if (stBadge) stBadge.textContent = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }

    mostrarToast('Técnico atribuído localmente. Sincronizando...', 'success');

    try {
        const payload = { acao: 'atribuir_tecnico_carta', nup, tecnico };
        const resultado = await executarAcaoGAS(payload);
        if (resultado.status === 'success') {
            mostrarToast('Atribuição sincronizada! ✅', 'success');
        } else {
            throw new Error(resultado.message || 'Erro ao sincronizar na nuvem.');
        }
    } catch (e) {
        console.error('Erro ao atribuir técnico na carta:', e);
        mostrarToast('Erro de sincronização na nuvem. (Revertendo)', 'error');
        if (target) {
            target['TÉCNICO/ADM'] = tecOriginal;
            target['STATUS'] = statusOriginal;
            atualizarCacheCartas();
            aplicarFiltrosCartas();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
        }
    }
}

/**
 * Anexa o PDF original do processo à Carta Consulta
 */
function anexarPdfOriginalCarta(event, nup) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'application/pdf';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btn.innerHTML = '⏳ A enviar com segurança (LGPD)...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            let gcsUri = null;
            if (typeof GCSStorage !== 'undefined') {
                try {
                    const gcsRes = await GCSStorage.fazerUpload(file, {
                        modulo: 'cartas',
                        nup: nup,
                        nomePersonalizado: `Carta_Consulta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
                        username: usuarioAtivo.username || ''
                    });
                    if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                        gcsUri = gcsRes.fullGcsUri || gcsRes.gcsPath;
                    }
                } catch (gcsErr) {
                    console.warn('⚠️ [GCS] Fallback para envio padrão GAS:', gcsErr.message);
                }
            }

            let base64 = null;
            if (!gcsUri) {
                base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader(); reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
            }

            const payload = { 
                acao: "anexar_pdf_original_carta", 
                nup: nup, 
                fileName: `Carta_Consulta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64,
                url: gcsUri,
                linkGcs: gcsUri,
                username: usuarioAtivo.username || ''
            };
            const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('PDF Original anexado com sucesso no Google Cloud Storage (LGPD)!', 'success');
                const linkFinal = gcsUri || resultado.url;
                const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DO NUP'] = linkFinal;
                }
                atualizarCacheCartas();
                aplicarFiltrosCartas();
            } else {
                mostrarToast('Erro: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
            }
        } catch (error) { 
            mostrarToast('Erro de comunicação.', 'error'); 
            btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1'; 
        }
    };
    fileInput.click();
}

/**
 * Anexa o Shapefile (ZIP) do processo à Carta Consulta
 */
function anexarShapefileCarta(event, nup) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.zip,application/zip,application/x-zip-compressed';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btn.innerHTML = '⏳ A enviar Shapefile com segurança (LGPD)...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            let gcsUri = null;
            if (typeof GCSStorage !== 'undefined') {
                try {
                    const gcsRes = await GCSStorage.fazerUpload(file, {
                        modulo: 'cartas',
                        nup: nup,
                        nomePersonalizado: `Shapefile_Carta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.zip`,
                        username: usuarioAtivo.username || ''
                    });
                    if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                        gcsUri = gcsRes.fullGcsUri || gcsRes.gcsPath;
                    }
                } catch (gcsErr) {
                    console.warn('⚠️ [GCS] Fallback shapefile GAS:', gcsErr.message);
                }
            }

            let base64 = null;
            if (!gcsUri) {
                base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader(); reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
            }

            const payload = { 
                acao: "anexar_shapefile_carta", 
                nup: nup, 
                fileName: `Shapefile_Carta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.zip`, 
                base64: base64,
                url: gcsUri,
                linkGcs: gcsUri,
                username: usuarioAtivo.username || ''
            };
            const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('Shapefile anexado com sucesso no Google Cloud Storage (LGPD)!', 'success');
                const linkFinal = gcsUri || resultado.url;
                const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK SHAPEFILE'] = linkFinal;
                }
                atualizarCacheCartas();
                aplicarFiltrosCartas();
            } else {
                mostrarToast('Erro: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
            }
        } catch (error) { 
            mostrarToast('Erro de comunicação.', 'error'); 
            btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1'; 
        }
    };
    fileInput.click();
}

/**
 * Anexa a Manifestação ou a Declaração da resposta da Carta Consulta
 */
function anexarDocumentoRespostaCarta(event, nup, tipo) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'application/pdf';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btn.innerHTML = '⏳ A enviar com segurança (LGPD)...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            const labelTipo = tipo === 'manifestacao' ? 'Manifestacao' : 'Declaracao';
            let gcsUri = null;
            if (typeof GCSStorage !== 'undefined') {
                try {
                    const gcsRes = await GCSStorage.fazerUpload(file, {
                        modulo: 'cartas',
                        nup: nup,
                        nomePersonalizado: `${labelTipo}_Carta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
                        username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
                    });
                    if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                        gcsUri = gcsRes.fullGcsUri || gcsRes.gcsPath;
                    }
                } catch (gcsErr) {
                    console.warn('⚠️ [GCS] Fallback resposta carta GAS:', gcsErr.message);
                }
            }

            let base64 = null;
            if (!gcsUri) {
                base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader(); reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
            }

            const payload = { 
                acao: "anexar_resposta_documento_carta", 
                nup: nup, 
                tipo: tipo,
                fileName: `${labelTipo}_Carta_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64,
                url: gcsUri,
                linkGcs: gcsUri,
                username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
            };
            const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                const linkFinal = gcsUri || resultado.url;
                const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    if (tipo === 'manifestacao') {
                        target['LINK DA MANIFESTAÇÃO'] = linkFinal;
                        target['LINK DA RESPOSTA'] = linkFinal; // fallback/compatibilidade
                    } else {
                        target['LINK DA DECLARAÇÃO'] = linkFinal;
                    }

                    // Regra de Negócio: Exige AMBOS os documentos para avançar para REVISÃO
                    const temM = target['LINK DA MANIFESTAÇÃO'] && target['LINK DA MANIFESTAÇÃO'].trim() !== '' && target['LINK DA MANIFESTAÇÃO'].trim() !== '-';
                    const temD = target['LINK DA DECLARAÇÃO'] && target['LINK DA DECLARAÇÃO'].trim() !== '' && target['LINK DA DECLARAÇÃO'].trim() !== '-';

                    if (temM && temD) {
                        target['STATUS'] = 'REVISÃO';
                        mostrarToast('Manifestação e Declaração anexadas! O processo avançou para REVISÃO.', 'success');
                    } else {
                        target['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
                        mostrarToast(`${tipo === 'manifestacao' ? 'Manifestação' : 'Declaração'} anexada! O processo aguarda o outro documento para avançar para REVISÃO.`, 'info');
                    }

                    // Se foi reprovada anteriormente, limpa status da resposta para entrar em nova revisão
                    if (target['STATUS DA RESPOSTA'] === 'REPROVADO') {
                        target['STATUS DA RESPOSTA'] = '';
                        target['MOTIVO DA AVALIAÇÃO'] = '';
                    }
                }
                atualizarCacheCartas();
                aplicarFiltrosCartas();
                
                // Recarregar os detalhes no painel lateral
                renderTabelaView(dadosCartasGlobais);
            } else {
                mostrarToast('Erro: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
            }
        } catch (error) { 
            mostrarToast('Erro de comunicação.', 'error'); 
            btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1'; 
        }
    };
    fileInput.click();
}

/**
 * Remove a Manifestação ou a Declaração da resposta da Carta Consulta
 */
async function removerDocumentoRespostaCarta(event, nup, tipo) {
    event.stopPropagation();
    const confirmado = await mostrarConfirmacao(`Deseja realmente remover este documento (${tipo === 'manifestacao' ? 'Manifestação' : 'Declaração'})?`);
    if (!confirmado) return;

    mostrarToast('A remover documento...', 'info');

    try {
        const payload = { 
            acao: "remover_resposta_documento_carta", 
            nup: nup, 
            tipo: tipo,
            username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
        };
        const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast('Documento removido com sucesso!', 'success');
            const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
            if (target) {
                if (tipo === 'manifestacao') {
                    target['LINK DA MANIFESTAÇÃO'] = '';
                    target['LINK DA RESPOSTA'] = '';
                } else {
                    target['LINK DA DECLARAÇÃO'] = '';
                }
                
                // Se qualquer um dos documentos faltar, volta o status para Aguardando Manifestação
                const temM = target['LINK DA MANIFESTAÇÃO'] && target['LINK DA MANIFESTAÇÃO'].trim() !== '' && target['LINK DA MANIFESTAÇÃO'].trim() !== '-';
                const temD = target['LINK DA DECLARAÇÃO'] && target['LINK DA DECLARAÇÃO'].trim() !== '' && target['LINK DA DECLARAÇÃO'].trim() !== '-';
                if (!temM || !temD) {
                    target['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
                    target['STATUS DA RESPOSTA'] = '';
                    target['MOTIVO DA AVALIAÇÃO'] = '';
                }
            }
            atualizarCacheCartas();
            aplicarFiltrosCartas();

            // Recarregar os detalhes no painel lateral
            renderTabelaView(dadosCartasGlobais);
        } else {
            mostrarToast('Erro ao remover: ' + resultado.message, 'error');
        }
    } catch (error) {
        mostrarToast('Erro de comunicação.', 'error');
    }
}

/**
 * Realiza a transição de status das Cartas Consulta (Fazer Despacho / Confirmar Assinatura)
 */
async function atualizarStatusCarta(event, nup, novoStatus) {
    const btn = event ? event.currentTarget : null;
    const textoOriginal = btn ? btn.innerHTML : '';

    let msg = '';
    let options = {};

    if (novoStatus === 'AGUARDANDO ASSINATURA') {
        msg = "Tem certeza de que deseja confirmar a realização do despacho para este processo?\n\nO status mudará para Aguardando Assinatura.";
        options = {
            titulo: "Confirmar Realização de Despacho",
            textoBotao: "✅ Confirmar Despacho",
            corBotao: "#2980b9",
            corBorda: "#1c5986",
            corBordaTop: "#2980b9",
            icone: "📑"
        };
    } else if (novoStatus === 'FINALIZADO') {
        msg = "Tem certeza de que deseja confirmar a assinatura realizada para este processo?\n\nO status mudará para Finalizado e o ciclo de vida deste processo será encerrado.";
        options = {
            titulo: "Confirmar Assinatura Realizada",
            textoBotao: "✍️ Confirmar Assinatura",
            corBotao: "#8e44ad",
            corBorda: "#6c3483",
            corBordaTop: "#8e44ad",
            icone: "✍️"
        };
    } else {
        msg = `Tem certeza de que deseja alterar o status para ${novoStatus}?`;
        options = {
            titulo: "Confirmar Alteração de Status",
            textoBotao: "Confirmar",
            corBotao: "#27ae60",
            corBorda: "#1e824c",
            corBordaTop: "#27ae60",
            icone: "🔄"
        };
    }

    const resultadoConfirmacao = await mostrarConfirmacao(msg, options);
    if (!resultadoConfirmacao.confirmou) {
        return;
    }

    if (btn) {
        btn.innerHTML = '⏳ A processar...';
        btn.disabled = true;
        btn.style.opacity = '0.7';
    }

    try {
        const payload = {
            acao: "atualizar_status_ci",
            nup: nup,
            novoStatus: novoStatus,
            username: (usuarioAtivo && usuarioAtivo.username) ? usuarioAtivo.username : ''
        };

        const resultado = await executarAcaoGAS(payload);
        if (resultado.status === 'success') {
            mostrarToast('Status atualizado com sucesso!', 'success');

            const target = dadosCartasGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS'] = novoStatus;
            }
            atualizarCacheCartas();
            aplicarFiltrosCartas();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

            // Atualiza os badges globais
            if (typeof atualizarBadgesNotificacao === 'function') atualizarBadgesNotificacao(dadosCoringa);
            
            // Recarrega os detalhes no painel lateral
            if (typeof cartaSelecionada !== 'undefined' && cartaSelecionada && cartaSelecionada['NUP'] === nup) {
                cartaSelecionada = target;
            }
            if (typeof renderTabelaView === 'function') renderTabelaView(cartasExibidas);

            // Se o preview estiver aberto, recarrega com o novo status
            const prev = document.getElementById('previewModal');
            if (prev && prev.style.display === 'flex' && target) {
                const linkCarta = target['LINK DO NUP'] || target['LINK_NUP'] || target['LINK'] || target['LINK_PROCESSO'] || target['LINK DA RESPOSTA'] || '';
                abrirModalPreviewCartas(target, linkCarta, nup);
            }
        } else {
            mostrarToast('Operação Cancelada ou Sem Permissão: ' + (resultado.message || 'Erro Desconhecido'), 'error');
            if (btn) {
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro de comunicação. A internet pode ter falhado.', 'error');
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}

// Iniciar áreas de Drop para as Cartas Consulta
if (typeof configurarDragAndDrop === 'function') {
    configurarDragAndDrop('cadCartaArquivo', 'cadCartaArquivoLabel', updateFileNameCarta);
    configurarDragAndDrop('cadCartaShape', 'cadCartaShapeLabel', updateFileNameCartaShape);
}
