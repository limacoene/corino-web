/**
 * Converte uma string de data no formato BR (DD/MM/YYYY) para timestamp (milissegundos).
 * Útil para ordenação de arrays e cálculos de prazos.
 */
function converterDataBR(str) {
    if (!str || str === '-') return Infinity;
    const partes = str.split('/');
    if (partes.length === 3) {
        return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
    }
    return new Date(str).getTime() || Infinity;
}

/**
 * Extrai o valor numérico dos dias restantes de uma string.
 * Exemplo: "- 15 dias" -> -15, ou "1 dia" -> 1
 */
function extrairDiasRestantes(str) {
    if (!str || str === '-' || String(str).toLowerCase() === 'nan') return NaN;
    return parseInt(String(str).replace(/[^0-9-]/g, ""));
}

/**
 * Aplica a máscara de NUP (XX.XXX.XXX-XXXX) num input de texto.
 */
function maskNUP(event) {
    let v = event.target.value.replace(/\D/g, '');
    v = v.substring(0, 12);
    let formatted = '';
    if (v.length > 0) formatted += v.substring(0, 2);
    if (v.length > 2) formatted += '.' + v.substring(2, 5);
    if (v.length > 5) formatted += '.' + v.substring(5, 8);
    if (v.length > 8) formatted += '-' + v.substring(8, 12);
    event.target.value = formatted;
}

/**
 * Extrai o ID de um ficheiro do Google Drive a partir do link partilhado.
 */
function extrairIdDrive(url) {
    if (!url || typeof url !== 'string') return null;
    let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return null;
}

/**
 * Identifica se uma referência é do Google Cloud Storage
 */
function isLinkGCS(url) {
    if (typeof GCSStorage !== 'undefined' && GCSStorage.isGCS) {
        return GCSStorage.isGCS(url);
    }
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('gs://') || url.startsWith('gcs:') || url.includes('storage.googleapis.com');
}

/**
 * Resolve de forma assíncrona o link de visualização (Signed URL temporária no GCS ou link de preview no Drive)
 */
async function obterLinkVisualizacaoSeguro(urlOuCaminho) {
    if (!urlOuCaminho || typeof urlOuCaminho !== 'string') return '';
    const raw = urlOuCaminho.trim();
    if (isLinkGCS(raw)) {
        if (typeof GCSStorage !== 'undefined' && GCSStorage.obterUrlTemporaria) {
            const signed = await GCSStorage.obterUrlTemporaria(raw, false);
            if (signed && !signed.includes('#')) {
                return signed + '#toolbar=1&navpanes=0&page=1&zoom=page-width';
            }
            return signed;
        }
    }
    const fileId = extrairIdDrive(raw);
    if (fileId) {
        return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    if ((raw.endsWith('.pdf') || raw.includes('.pdf?')) && !raw.includes('#')) {
        return raw + '#toolbar=1&navpanes=0&page=1&zoom=page-width';
    }
    return raw;
}

/**
 * Resolve de forma assíncrona o link de download temporário
 */
async function obterLinkDownloadSeguro(urlOuCaminho, nomeArquivo = '') {
    if (!urlOuCaminho || typeof urlOuCaminho !== 'string') return '';
    const raw = urlOuCaminho.trim();
    if (isLinkGCS(raw)) {
        if (typeof GCSStorage !== 'undefined' && GCSStorage.obterUrlTemporaria) {
            return await GCSStorage.obterUrlTemporaria(raw, true, nomeArquivo);
        }
    }
    const fileId = extrairIdDrive(raw);
    if (fileId) {
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return raw;
}

/**
 * Alterna a visualização no iframe de preview de documentos e atualiza o estado visual (ativação) das abas.
 * Suporta resolução transparente de links GCS temporários.
 */
async function alternarVisualizacaoPreview(btn, url, downloadUrl) {
    let resolvedUrl = url;
    let resolvedDownloadUrl = downloadUrl;

    if (isLinkGCS(url)) {
        try {
            resolvedUrl = await obterLinkVisualizacaoSeguro(url);
        } catch (e) {
            console.error('Erro ao resolver preview GCS:', e);
        }
    }

    if (isLinkGCS(downloadUrl)) {
        try {
            resolvedDownloadUrl = await obterLinkDownloadSeguro(downloadUrl);
        } catch (e) {
            console.error('Erro ao resolver download GCS:', e);
        }
    }

    const iframe = document.getElementById('previewFrame');
    if (iframe) {
        iframe.src = resolvedUrl;
    }
    const downloadBtn = document.getElementById('btn-download-preview');
    if (downloadBtn) {
        downloadBtn.href = resolvedDownloadUrl;
    }
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) {
        btnOpenPreview.href = resolvedUrl.replace('/preview', '/view');
    }
    
    // Remove classe ativa de outros botões e aplica ao atual
    const container = btn.parentElement;
    if (container) {
        const botoes = container.querySelectorAll('.btn-preview-toggle-tab');
        botoes.forEach(b => {
            b.classList.remove('active');
        });
    }
    btn.classList.add('active');
}

/**
 * Dispara o download de um documento seguro do GCS ou Drive
 */
async function dispararDownloadSeguro(urlOuCaminho, nomeArquivo = '') {
    try {
        if (typeof mostrarToast === 'function') {
            mostrarToast('A preparar download seguro com link temporário...', 'success');
        }
        const urlDownload = await obterLinkDownloadSeguro(urlOuCaminho, nomeArquivo);
        if (urlDownload) {
            const a = document.createElement('a');
            a.href = urlDownload;
            a.target = '_blank';
            if (nomeArquivo) a.download = nomeArquivo;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    } catch (err) {
        console.error('Erro ao realizar download:', err);
        if (typeof mostrarToast === 'function') {
            mostrarToast('Não foi possível iniciar o download: ' + err.message, 'error');
        }
    }
}

/**
 * Calcula a quantidade de dias restantes para um determinado prazo.
 * Suporta prazos em dias corridos (ex: "15 DIAS" ou apenas "15") e dias úteis (ex: "15 DIAS UTEIS" ou "15 DIAS ÚTEIS").
 * @param {string|Date} dataInicioStr - Data inicial (DD/MM/YYYY ou objeto Date ou string ISO)
 * @param {string|number} prazoStr - Prazo (ex: "15 DIAS", "15 DIAS UTEIS", 15, "15")
 * @returns {number} Número de dias restantes (pode ser negativo) ou NaN se inválido
 */
function calcularDiasRestantes(dataInicioStr, prazoStr) {
    if (!dataInicioStr || dataInicioStr === '-' || !prazoStr || prazoStr === '-') {
        return NaN;
    }

    // Parse dataInicioStr (DD/MM/YYYY ou Date ou string genérica)
    let dataInicio;
    if (dataInicioStr instanceof Date) {
        dataInicio = new Date(dataInicioStr);
    } else {
        const partes = String(dataInicioStr).split('/');
        if (partes.length === 3) {
            dataInicio = new Date(parseInt(partes[2], 10), parseInt(partes[1], 10) - 1, parseInt(partes[0], 10));
        } else {
            dataInicio = new Date(dataInicioStr);
        }
    }

    if (isNaN(dataInicio.getTime())) return NaN;

    // Parse prazoStr (extrai o número)
    const numPrazo = parseInt(String(prazoStr).replace(/\D/g, ''), 10);
    if (isNaN(numPrazo)) return NaN;

    const prazoLower = String(prazoStr).toLowerCase();
    const esUteis = prazoLower.includes('uteis') || prazoLower.includes('úteis');

    // 1. CÁLCULO DA DATA DE VENCIMENTO
    let dataVencimento = new Date(dataInicio);
    if (esUteis) {
        // Adiciona dias úteis (pulando sábados e domingos)
        let diasAdicionados = 0;
        while (diasAdicionados < numPrazo) {
            dataVencimento.setDate(dataVencimento.getDate() + 1);
            const diaDaSemana = dataVencimento.getDay(); // 0 = Domingo, 6 = Sábado
            if (diaDaSemana !== 0 && diaDaSemana !== 6) {
                diasAdicionados++;
            }
        }
    } else {
        // Adiciona dias corridos
        dataVencimento.setDate(dataVencimento.getDate() + numPrazo);
    }

    // 2. CÁLCULO DOS DIAS RESTANTES (Contagem regressiva coerente)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    dataVencimento.setHours(0, 0, 0, 0);

    let diasRestantes = 0;
    if (esUteis) {
        // Contagem regressiva em dias úteis
        let tempContador = new Date(hoje);
        if (tempContador < dataVencimento) {
            while (tempContador < dataVencimento) {
                tempContador.setDate(tempContador.getDate() + 1);
                const diaDaSemana = tempContador.getDay();
                if (diaDaSemana !== 0 && diaDaSemana !== 6) {
                    diasRestantes++;
                }
            }
        } else if (tempContador > dataVencimento) {
            // Se já venceu, conta dias úteis negativos
            while (tempContador > dataVencimento) {
                const diaDaSemana = tempContador.getDay();
                if (diaDaSemana !== 0 && diaDaSemana !== 6) {
                    diasRestantes--;
                }
                tempContador.setDate(tempContador.getDate() - 1);
            }
        }
    } else {
        // Contagem regressiva em dias corridos
        const diffTime = dataVencimento.getTime() - hoje.getTime();
        diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    return diasRestantes;
}

/**
 * Executa chamadas à API central com prioridade para o Proxy Local (sem CORS/bloqueios do Google)
 * e com fallback seguro para Google Apps Script direto.
 */
async function executarAcaoGAS(payload) {
    if (!payload || typeof payload !== 'object') payload = {};

    // 1. Prioridade: Proxy local Node.js (mesma origem, zero CORS, cache em RAM)
    try {
        const resposta = await fetch('/api/dados-central', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (resposta.ok) {
            const texto = await resposta.text();
            if (!texto.trim().startsWith('<')) {
                const json = JSON.parse(texto);
                if (json && (json.status === 'success' || json.dados)) {
                    return json;
                }
            }
        }
    } catch (eLocal) {
        // Prossegue para o fallback
    }

    // 2. Fallback direto para Google Apps Script
    const appsScriptUrl = (typeof APPS_SCRIPT_URL !== 'undefined') ? APPS_SCRIPT_URL : 'https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec';
    try {
        const resposta = await fetch(appsScriptUrl, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const texto = await resposta.text();
        if (texto.trim().startsWith('<')) {
            throw new Error('Google Apps Script retornou uma página HTML em vez de dados JSON.');
        }
        return JSON.parse(texto);
    } catch (erro) {
        console.error('Erro na comunicação com a API Central:', erro);
        throw erro;
    }
}