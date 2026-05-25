// ============================================================================
// OFÍCIOS EXTERNOS (COM MAPEAMENTO EXATO DE COLUNAS)
// ============================================================================
const opcoesExternoStatus = [
    "AGUARDANDO DISTRIBUIÇÃO",
    "AGUARDANDO MANIFESTAÇÃO TÉCNICA",
    "EM ANÁLISE",
    "REVISÃO",
    "FAZER CI",
    "RESPONDIDO",
    "ARQUIVADO"
];

let dadosExternosGlobais = [];
let externosCarregados = false;
let externoSelecionadoMockup = null;

function atualizarCacheExternos() {
    const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
    const keyExternos = `corino_cache_dados_externos_${username}`;
    localStorage.setItem(keyExternos, JSON.stringify(dadosExternosGlobais));
}

function updateFileNameExterno(input) {
    const label = document.getElementById('cadExternoArquivoLabel');
    const textSpan = label.querySelector('.upload-text');
    if (input.files && input.files.length > 0) {
        textSpan.innerHTML = `<strong>Ficheiro selecionado:</strong><br>${input.files[0].name}`;
        label.classList.add('has-file');
    } else {
        textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
        label.classList.remove('has-file');
    }
}

function popularOpcoesExterno() {
    const preencherSelect = (id, opcoes, textoVazio = null) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        if (textoVazio !== null) {
            const elBlank = document.createElement('option');
            elBlank.value = ''; elBlank.textContent = textoVazio;
            select.appendChild(elBlank);
        }
        opcoes.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt; el.textContent = opt;
            select.appendChild(el);
        });
    };
    preencherSelect('cadExtStatus', opcoesExternoStatus);
    preencherSelect('cadExtTecnico', opcoesAutoTecnico, '-- Sem Técnico --');
    preencherSelect('filtro-ext-tecnico', opcoesAutoTecnico, '-- Todos os Técnicos --');
}

function abrirModalCadastroExterno() {
    document.getElementById('cadastroExternoModal').style.display = 'flex';
    popularOpcoesExterno();

    // Iniciar Múltiplos Calendários
    flatpickr(".date-picker-ext", {
        locale: "pt",
        dateFormat: "d/m/Y",
        allowInput: true
    });
}

function fecharModalCadastroExterno() {
    document.getElementById('cadastroExternoModal').style.display = 'none';
    const ids = ['cadExtNup', 'cadExtDataRec', 'cadExtAssunto', 'cadExtRemetente', 'cadExtCarms', 'cadExtTecnico', 'cadExtStatus', 'cadExtDataRep', 'cadExtDataDet', 'cadExtObs', 'cadExtArquivo'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const label = document.getElementById('cadExternoArquivoLabel');
    if (label) {
        label.classList.remove('has-file');
        const textSpan = label.querySelector('.upload-text');
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
    }
}

function renderTabelaExternos(dados) {
    const container = document.getElementById('lista-externos-container');
    const cont = document.getElementById('contador-externos');
    if (!container) return;

    const leftPanelEl = document.getElementById('left-panel-externos-inbox');
    const savedLeftScrollTop = leftPanelEl ? leftPanelEl.scrollTop : 0;

    const rightPanelEl = document.getElementById('right-panel-detalhes-ext');
    const savedRightScrollTop = rightPanelEl ? rightPanelEl.scrollTop : 0;

    const savedWindowScrollY = window.scrollY;

    container.innerHTML = '';

    if (!dados || dados.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888; background-color: #1a1a1a; border-radius: 8px; border: 1px solid #333;">Nenhum Ofício Externo encontrado.</div>';
        cont.innerText = 'Exibindo 0 resultados.';
        return;
    }

    cont.innerText = `Exibindo ${dados.length} resultados.`;

    if (!externoSelecionadoMockup && dados.length > 0) {
        externoSelecionadoMockup = dados[0];
    } else if (externoSelecionadoMockup) {
        const exists = dados.find(r => r['NUP'] === externoSelecionadoMockup['NUP']);
        if (!exists) externoSelecionadoMockup = dados[0];
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '20px';
    container.style.alignItems = 'flex-start';

    const leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel-externos-inbox';
    leftPanel.style.width = '35%';
    leftPanel.style.minWidth = '300px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.gap = '10px';
    leftPanel.style.maxHeight = '75vh';
    leftPanel.style.overflowY = 'auto';
    leftPanel.style.paddingRight = '5px';
    leftPanel.style.animation = leftPanelEl ? 'none' : 'fadeInSlideUp 0.3s ease-out forwards';

    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel-detalhes-ext';
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
    rightPanel.style.animation = rightPanelEl ? 'none' : 'fadeInSlideUp 0.4s ease-out forwards';

    dados.forEach((r, index) => {
        const nupRow = r['NUP'] || '-';
        const isSelected = externoSelecionadoMockup && externoSelecionadoMockup['NUP'] === nupRow;

        const item = document.createElement('div');
        item.style.backgroundColor = isSelected ? 'rgba(142, 68, 173, 0.1)' : '#1a1a1a';
        item.style.border = isSelected ? '1px solid #8e44ad' : '1px solid #333';
        item.style.borderRadius = '6px';
        item.style.padding = '12px 15px';
        item.style.cursor = 'pointer';
        item.style.transition = 'all 0.2s';

        item.onmouseenter = () => { if (!isSelected) item.style.backgroundColor = '#222'; };
        item.onmouseleave = () => { if (!isSelected) item.style.backgroundColor = '#1a1a1a'; };
        item.onclick = () => {
            externoSelecionadoMockup = r;
            renderTabelaExternos(dados);
        };

        let status = (r['STATUS'] || '').toUpperCase();
        if (status === 'TRAMITADO' || status === 'ARQUIVADO' || status === 'RESPONDIDO') {
            status = 'FINALIZADO';
        }
        let dotColor = '#3498db';
        if (status === 'AGUARDANDO DISTRIBUIÇÃO') dotColor = '#f39c12';
        else if (status === 'REVISÃO') dotColor = '#9b59b6';
        else if (status === 'FINALIZADO') dotColor = '#27ae60';

        const statusRespAval = (r['STATUS-RESPOSTA'] || r['STATUS DA RESPOSTA'] || '').toUpperCase();
        let badgeAvaliacao = '';
        if (statusRespAval === 'APROVADO') badgeAvaliacao = `<div style="font-size: 10px; color: #2ecc71; margin-bottom: 5px; font-weight: bold;">✅ APROVADA</div>`;
        else if (statusRespAval === 'REPROVADO') badgeAvaliacao = `<div style="font-size: 10px; color: #e74c3c; margin-bottom: 5px; font-weight: bold;">❌ REPROVADA</div>`;

        item.innerHTML = `
            ${badgeAvaliacao}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <div style="font-size: 14px; font-weight: bold; color: ${isSelected ? '#9b59b6' : '#fff'};">${nupRow}</div>
                <div style="font-size: 10px; padding: 3px 8px; border-radius: 6px; border: 1px solid ${dotColor}; color: ${dotColor}; background-color: rgba(255,255,255,0.03); font-weight: bold;">${status}</div>
            </div>
            <div style="font-size: 12px; color: #aaa; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">🏢 ${r['REMETENTE'] || '-'}</div>
            <div style="font-size: 11px; color: #777;">Téc: ${r['TÉCNICO/ADMIN'] || 'Não atribuído'}</div>
        `;
        leftPanel.appendChild(item);
    });

    if (externoSelecionadoMockup) {
        const s = externoSelecionadoMockup;
        const nupVal = s['NUP'] || '-';
        // Suporte unificado para LINK DO NUP e LINK-NUP para evitar o erro de sumir PDF
        const linkDrive = s['LINK DO NUP'] || s['LINK-NUP'] || s['LINK'] || '';
        const linkResposta = s['LINK DA RESPOSTA'] || s['LINK RESPOSTA'] || s['LINK_RESPOSTA'] || '';
        let status = (s['STATUS'] || '').toUpperCase();
        if (status === 'TRAMITADO' || status === 'ARQUIVADO' || status === 'RESPONDIDO') {
            status = 'FINALIZADO';
        }
        const temResposta = linkResposta && linkResposta.startsWith('http');

        // Botoes do Documento Principal
        let htmlPreviewIcon = '';
        let htmlLink = '';
        let btnAnexar = '';
        let btnAnexarOriginal = '';

        if (usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.perfil === 'gerencia')) {
            if (temResposta) {
                const isAprovado = (s['STATUS-RESPOSTA'] || s['STATUS DA RESPOSTA'] || '').toUpperCase() === 'APROVADO';
                const isGestor = usuarioAtivo.perfil === 'gerencia';
                if (!isGestor && isAprovado) {
                    btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px;">🔒 Documento aprovado.</div>`;
                } else {
                    btnAnexar = `<button onclick="removerDocumentoExt(event, '${nupVal}')" class="btn-drive btn-red-outline">🗑️ Retirar Resposta</button>`;
                }
            } else if (usuarioAtivo.perfil === 'tecnico') {
                btnAnexar = `<button onclick="anexarDocumentoExt(event, '${nupVal}')" class="btn-drive btn-purple">📎 Anexar Resposta</button>`;
            }

            // Botão para anexar o PDF original do Ofício
            btnAnexarOriginal = `<button onclick="anexarPdfOriginalExt(event, '${nupVal}')" class="btn-drive btn-upload" style="background-color: #34495e; border-color: #2c3e50;">📁 Anexar PDF Original</button>`;
        }

        if (linkDrive && linkDrive.startsWith('http')) {
            const fileId = extrairIdDrive(linkDrive);
            if (fileId) {
                const linkPrev = `https://drive.google.com/file/d/${fileId}/preview`;
                const linkDown = `https://drive.google.com/uc?export=download&id=${fileId}`;
                htmlPreviewIcon = `<button onclick="abrirPreviewExterno(event, '${linkPrev}', '${nupVal}')" class="btn-inline-preview" title="Visualizar"></button>`;
                htmlLink = `<div class="modal-buttons"><a href="${linkDown}" class="btn-drive btn-download" onclick="feedbackDownload(this)">⬇️ Download Original</a> ${btnAnexar}</div>`;
            } else {
                htmlLink = `<div class="modal-buttons"><a href="${linkDrive}" target="_blank" class="btn-drive">🔗 Abrir Link Vinculado</a> ${btnAnexar}</div>`;
            }
        } else {
            const btnHtml = btnAnexarOriginal ? `<div class="modal-buttons" style="margin-top: 10px;">${btnAnexarOriginal}</div>` : '';
            htmlLink = `
                <div style="text-align:center; color:#666; font-weight:bold; padding: 15px; border: 1px dashed #333; border-radius: 6px;">
                    <div>🚫 Sem PDF Original</div>
                    ${btnHtml}
                </div>
            `;
            if (btnAnexar) {
                htmlLink += `<div class="modal-buttons" style="margin-top: 15px;">${btnAnexar}</div>`;
            }
        }

        // Botoes de Resposta e Avaliacao
        let htmlResposta = '';
        if (temResposta) {
            const respId = extrairIdDrive(linkResposta);
            let botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive btn-orange-outline">🔗 Abrir Resposta</a>`;
            if (respId) {
                const respPrev = `https://drive.google.com/file/d/${respId}/preview`;
                botaoResp = `<button onclick="abrirPreviewExterno(event, '${respPrev}', '${nupVal}')" class="btn-drive btn-orange-outline">👁️ Ver Resposta</button>`;
            }

            let htmlMotivoReprovacao = '';
            const motivo = s['MOTIVO DA AVALIAÇÃO'] || s['MOTIVO_AVALIACAO'] || '';
            if ((s['STATUS-RESPOSTA'] || s['STATUS DA RESPOSTA'] || '').toUpperCase() === 'REPROVADO' && motivo) {
                htmlMotivoReprovacao = `<div style="margin-top: 15px; padding: 10px; background-color: rgba(231, 76, 60, 0.1); border-left: 4px solid #e74c3c; color: #ffcccc; font-size: 13px;"><strong>Motivo da Reprovação:</strong><br>${motivo}</div>`;
            }

            htmlResposta = `
                <div style="margin: 20px 0; padding: 15px; background-color: rgba(140, 86, 51, 0.1); border: 1px solid rgba(140, 86, 51, 0.3); border-radius: 6px;">
                    <div style="color: #e67e22; font-weight: bold; margin-bottom: 10px;">📁 Resposta Anexada:</div>
                    ${botaoResp} ${htmlMotivoReprovacao}
                </div>
            `;
        }

        let acoesDiflor = '';
        if (usuarioAtivo && usuarioAtivo.username === 'diflor' && temResposta) {
            const statusResp = (s['STATUS-RESPOSTA'] || s['STATUS DA RESPOSTA'] || '').toUpperCase();
            if (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO') {
                acoesDiflor = `
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button onclick="avaliarRespostaExt(event, '${nupVal}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1;">✅ Aprovar</button>
                        <button onclick="avaliarRespostaExt(event, '${nupVal}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1;">❌ Reprovar</button>
                    </div>
                `;
            }
        }

        let htmlDiretoriaBotoes = '';
        const isGestorFinalidade = usuarioAtivo && usuarioAtivo.perfil === 'gerencia';
        const isSemTecnico = !s['TÉCNICO/ADMIN'] || s['TÉCNICO/ADMIN'] === '-' || s['TÉCNICO/ADMIN'] === 'S/T' || s['TÉCNICO/ADMIN'] === 'Sem Técnico' || s['TÉCNICO/ADMIN'] === 'Não atribuído';

        if (isGestorFinalidade && isSemTecnico) {
            htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoExterno('${nupVal}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;">👤 Distribuir / Atribuir Técnico</button>`;
        }

        rightPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                <div>
                    <div style="font-size: 24px; font-weight: bold; color: #fff; margin-bottom: 5px; display: flex; align-items: center; gap: 10px;">${nupVal} ${htmlPreviewIcon}</div>
                    <div style="font-size: 16px; color: #ccc;">🏢 ${s['REMETENTE'] || '-'}</div>
                </div>
                <div style="text-align: right;">
                    <div style="color: #9b59b6; font-size: 14px; font-weight: bold;">${status}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background-color: #222; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">DATA RECEBIMENTO</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['DATA DE RECEBIMENTO'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">Nº CARMS</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['CARMS'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">DATA REPASSE</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['DATA DE REPASSE'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">DATA DETERMINO</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['DATA DETERMINO'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px; grid-column: span 2;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">ASSUNTO</div><div style="font-size: 14px; color: #fff; font-weight: 500; line-height: 1.4;">${s['ASSUNTO'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px; grid-column: span 2;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">TÉCNICO RESPONSÁVEL</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['TÉCNICO/ADMIN'] || '-'}</div></div>
            </div>
            ${s['OBSERVAÇÕES'] ? `<div class="modal-obs" style="margin: 0 0 20px 0;"><strong>Observações:</strong><br>${s['OBSERVAÇÕES']}</div>` : ''}
            
            ${htmlResposta}
            ${acoesDiflor}

            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #333;">
                ${htmlLink}
                ${htmlDiretoriaBotoes}
            </div>
        `;
    }
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);

    // RESTAURAR SCROLLS E POSIÇÕES
    if (leftPanelEl) {
        leftPanel.scrollTop = savedLeftScrollTop;
    }
    if (rightPanelEl) {
        rightPanel.scrollTop = savedRightScrollTop;
    }
    window.scrollTo(0, savedWindowScrollY);
}

function filtrarExternos() {
    const fNupEl = document.getElementById('filtro-ext-nup');
    const fCarmsEl = document.getElementById('filtro-ext-carms');
    const fTecnicoEl = document.getElementById('filtro-ext-tecnico');
    const fRemetenteEl = document.getElementById('filtro-ext-remetente');

    const nup = fNupEl ? fNupEl.value.toLowerCase().trim() : '';
    const carms = fCarmsEl ? fCarmsEl.value.toLowerCase().trim() : '';
    const tecnico = fTecnicoEl ? fTecnicoEl.value.toLowerCase().trim() : '';
    const remetente = fRemetenteEl ? fRemetenteEl.value.toLowerCase().trim() : '';

    const filtrados = dadosExternosGlobais.filter(r => {
        const nupRow = r['NUP'] || '';
        const carmsRow = r['CARMS'] || '';
        const tecRow = r['TÉCNICO/ADMIN'] || '';
        const remetenteRow = r['REMETENTE'] || '';
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();

        const matchNormais = (!nup || String(nupRow).toLowerCase().includes(nup))
            && (!carms || String(carmsRow).toLowerCase().includes(carms))
            && (!tecnico || String(tecRow).toLowerCase().includes(tecnico))
            && (!remetente || String(remetenteRow).toLowerCase().includes(remetente));

        if (!matchNormais) return false;

        const semTecnico = tecRow.trim() === '' || tecRow.trim() === '-' || tecRow.trim() === 'S/T' || tecRow.trim() === 'Sem Técnico' || tecRow.trim() === 'Não atribuído';

        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
            const matchTecnico = tecRow.toUpperCase().trim() === tecnicoLogado;
            if (!matchTecnico) return false;
        }

        const isFinalizado = statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO';
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');

        // =====================================================================
        // REGRAS DE FILTRAGEM DAS SUB-ABAS (SITUAÇÃO GERAL RECONFIGURADA)
        // =====================================================================
        if (subAbaAtiva === 'Geral') {
            // Retorna estritamente TRUE para permitir TRAMITADOS e ARQUIVADOS na listagem total
            return true;
        } else if (subAbaAtiva === 'Aguard. Distribuição') {
            return semTecnico && !isFinalizado && !hasResposta;
        } else if (subAbaAtiva === 'Em Andamento') {
            return !semTecnico && statusRow === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        } else if (subAbaAtiva === 'Aguardando Revisão') {
            return (hasResposta || statusRow === 'REVISÃO') && !isFinalizado;
        }

        return true;
    });
    renderTabelaExternos(filtrados);
}

async function carregarExternos() {
    if (externosCarregados) return;
    
    const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
    const keyExternos = `corino_cache_dados_externos_${username}`;

    // Migrar dados temporários pré-carregados se existirem
    const tempRawExternos = localStorage.getItem('corino_temp_raw_externos');
    if (tempRawExternos) {
        try {
            const dadosBrutos = JSON.parse(tempRawExternos);
            localStorage.setItem(keyExternos, JSON.stringify(dadosBrutos));
            localStorage.removeItem('corino_temp_raw_externos');
            console.log("Externos pré-carregados aplicados com sucesso ao cache do usuário logado.");
        } catch (e) {
            console.error("Erro ao processar dados pré-carregados de Externos:", e);
        }
    }

    const cacheSalvo = localStorage.getItem(keyExternos);
    let carregouDeCache = false;

    if (cacheSalvo) {
        try {
            dadosExternosGlobais = JSON.parse(cacheSalvo);
            carregouDeCache = true;
            document.getElementById('loading-externos').style.display = 'none';
            popularOpcoesExterno();
            filtrarExternos();
        } catch (e) {
            console.error("Erro ao ler cache de Externos:", e);
        }
    } else {
        document.getElementById('loading-externos').style.display = 'block';
    }

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ acao: "buscar_externos" })
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            dadosExternosGlobais = resultado.dados;
            atualizarCacheExternos();
            popularOpcoesExterno();
            filtrarExternos();
            externosCarregados = true;
        }
    } catch (e) {
        console.error(e);
        if (!carregouDeCache) {
            mostrarToast('Erro ao carregar Ofícios Externos.', 'error');
        } else {
            mostrarToast('Conexão instável. Exibindo dados do cache de Externos offline.', 'warning');
        }
    } finally {
        document.getElementById('loading-externos').style.display = 'none';
    }
}

async function salvarNovoExterno() {
    const nup = document.getElementById('cadExtNup').value.trim();
    const remetente = document.getElementById('cadExtRemetente').value.trim();
    if (!nup || !remetente) { mostrarToast('NUP e Remetente são obrigatórios!', 'error'); return; }

    const btn = document.getElementById('btnSalvarCadastroExt');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    const fileInput = document.getElementById('cadExtArquivo');
    let base64File = null; let fileName = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 15 * 1024 * 1024) { mostrarToast('O ficheiro deve ter máx 15MB', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
        fileName = file.name;
        try {
            base64File = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } catch (e) { mostrarToast('Erro ao ler arquivo', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
    }

    const payload = {
        acao: "cadastrar_externo",
        nup: nup,
        data_recebimento: document.getElementById('cadExtDataRec').value,
        assunto: document.getElementById('cadExtAssunto').value.trim(),
        remetente: remetente,
        carms: document.getElementById('cadExtCarms').value.trim(),
        tecnico: document.getElementById('cadExtTecnico').value,
        status_atual: document.getElementById('cadExtStatus').value,
        data_repasse: document.getElementById('cadExtDataRep').value,
        data_determino: document.getElementById('cadExtDataDet').value,
        observacao: document.getElementById('cadExtObs').value,
        base64: base64File,
        fileName: fileName
    };

    const novoItem = {
        'NUP': payload.nup,
        'DATA DE RECEBIMENTO': payload.data_recebimento,
        'ASSUNTO': payload.assunto,
        'REMETENTE': payload.remetente,
        'CARMS': payload.carms,
        'TÉCNICO/ADMIN': payload.tecnico,
        'STATUS': payload.status_atual,
        'DATA DE REPASSE': payload.data_repasse,
        'DATA DETERMINO': payload.data_determino,
        'OBSERVAÇÕES': payload.observacao
    };

    dadosExternosGlobais.unshift(novoItem);
    fecharModalCadastroExterno();
    filtrarExternos();
    atualizarCacheExternos();
    mostrarToast('Ofício Externo lançado localmente. Sincronizando...', 'success');
    btn.innerHTML = textoOriginal; btn.disabled = false;

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') { mostrarToast('Sincronizado com sucesso!', 'success'); }
        else { 
            mostrarToast('Erro: ' + resultado.message, 'error'); 
            dadosExternosGlobais = dadosExternosGlobais.filter(item => item !== novoItem); 
            filtrarExternos(); 
            atualizarCacheExternos();
        }
    } catch (e) {
        console.error(e); mostrarToast('Falha na internet. (Revertendo)', 'error');
        dadosExternosGlobais = dadosExternosGlobais.filter(item => item !== novoItem); 
        filtrarExternos(); 
        atualizarCacheExternos();
    }
}

function abrirPreviewExterno(event, url, nup) {
    if (event) event.preventDefault();
    const modal = document.getElementById('previewModal');
    const iconeOlhoGrande = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    if (!document.getElementById('preview-wrapper-id')) {
        modal.className = 'preview-modal';
        modal.innerHTML = `
            <div class="preview-wrapper" id="preview-wrapper-id">
                <div class="preview-toolbar">
                    <div class="preview-toolbar-title" style="display: flex; align-items: center;">${iconeOlhoGrande} Pré-visualização de Documento</div>
                    <div class="preview-toolbar-buttons">
                        <a id="btn-download-preview" href="#" class="btn-preview-action btn-download-preview-action" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;" download title="Fazer download deste documento" onclick="feedbackDownload(this)">⬇️ Baixar Documento</a>
                        <button class="btn-preview-action" onclick="togglePreviewInfo()">ℹ️ Mostrar/Ocultar Info</button>
                        <button class="btn-preview-action btn-close-preview" onclick="fecharPreview()">✖ Fechar</button>
                    </div>
                </div>
                <div class="preview-body">
                    <iframe id="previewFrame" class="preview-iframe" src=""></iframe>
                    <div id="previewInfo" class="preview-info">
                        <div id="previewInfoContent"></div>
                    </div>
                </div>
            </div>
        `;
    }

    let previewUrl = url;
    const fileId = extrairIdDrive(url);
    const btnDownload = document.getElementById('btn-download-preview');
    if (fileId) {
        previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        btnDownload.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
    } else {
        btnDownload.href = url;
    }

    const linha = dadosExternosGlobais.find(x => x['NUP'] === nup);
    if (!linha) {
        document.getElementById('previewInfoContent').innerHTML = `<div style="padding: 15px; color: #fff;">Visualizando Documento: <strong>${nup}</strong></div>`;
        document.getElementById('previewFrame').src = previewUrl;
        modal.style.display = 'flex';
        return;
    }

    // Formatação de status e cores dinâmicas
    let statusText = (linha['STATUS'] || '').toUpperCase().trim();
    if (statusText === 'TRAMITADO' || statusText === 'ARQUIVADO' || statusText === 'RESPONDIDO') {
        statusText = 'FINALIZADO';
    }
    
    let corTexto = '#3498db';
    if (statusText === 'AGUARDANDO DISTRIBUIÇÃO') {
        corTexto = '#f39c12';
    } else if (statusText === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA') {
        corTexto = '#f1c40f';
    } else if (statusText === 'EM ANÁLISE') {
        corTexto = '#e67e22';
    } else if (statusText === 'REVISÃO') {
        corTexto = '#9b59b6';
    } else if (statusText === 'FAZER CI') {
        corTexto = '#e74c3c';
    } else if (statusText === 'FINALIZADO') {
        corTexto = '#27ae60';
    }

    let iconeStatus = `<span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background-color: ${corTexto}; margin-right: 8px; flex-shrink: 0;"></span>`;
    if (statusText === 'FINALIZADO') {
        iconeStatus = `<span style="margin-right: 6px; font-size: 16px;">✅</span>`;
    }

    const obs = (linha['OBSERVAÇÕES'] || linha['OBSERVAÇÃO'] || '').trim();
    const htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="preview-info-obs"><strong>Observação:</strong><br>${obs}</div>` : '';

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-item">📌 <strong>NUP:</strong> ${linha['NUP']}</div>
        <div class="preview-info-item">🏢 <strong>Remetente:</strong> ${linha['REMETENTE'] || '-'}</div>
        <div class="preview-info-item">📅 <strong>Recebimento:</strong> ${linha['DATA DE RECEBIMENTO'] || '-'}</div>
        <div class="preview-info-item">🆔 <strong>CARMS:</strong> ${linha['CARMS'] || '-'}</div>
        <div class="preview-info-item">📅 <strong>Data de Repasse:</strong> ${linha['DATA DE REPASSE'] || '-'}</div>
        <div class="preview-info-item">📅 <strong>Determino:</strong> ${linha['DATA DETERMINO'] || '-'}</div>
        <div class="preview-info-item">📝 <strong>Assunto:</strong> ${linha['ASSUNTO'] || '-'}</div>
        <div class="preview-info-item">👤 <strong>Responsável:</strong> ${linha['TÉCNICO/ADMIN'] || 'Não atribuído'}</div>
        <div class="preview-info-item" style="display: flex; align-items: center;">🚦 <strong style="margin-right: 6px;">Situação:</strong> <span style="color: ${corTexto}; display: flex; align-items: center; font-weight: bold;">${iconeStatus}${statusText}</span></div>
        ${htmlObs}
    `;

    // Configuração de alternador entre documento original e resposta se ambos existirem
    const linkResposta = linha['LINK DA RESPOSTA'] || linha['LINK RESPOSTA'] || linha['LINK_RESPOSTA'] || '';
    let respPreviewUrl = '';
    let respId = null;
    if (linkResposta && linkResposta.startsWith('http')) {
        respId = extrairIdDrive(linkResposta);
        if (respId) respPreviewUrl = `https://drive.google.com/file/d/${respId}/preview`;
    }

    const linkDrive = linha['LINK DO NUP'] || linha['LINK-NUP'] || linha['LINK'] || '';
    let principalPreviewUrl = '';
    let principalId = null;
    if (linkDrive && linkDrive.startsWith('http')) {
        principalId = extrairIdDrive(linkDrive);
        if (principalId) principalPreviewUrl = `https://drive.google.com/file/d/${principalId}/preview`;
    }

    let toggleBtn = '';
    if (respPreviewUrl && principalPreviewUrl) {
        let downloadPrincipalUrlFull = principalId ? `https://drive.google.com/uc?export=download&id=${principalId}` : linkDrive;
        let downloadRespUrlFull = respId ? `https://drive.google.com/uc?export=download&id=${respId}` : linkResposta;

        // Determina qual aba deve iniciar ativa com base na URL atualmente aberta
        const isPrincipalActive = (url === principalPreviewUrl || url === linkDrive);
        const activePrincipalClass = isPrincipalActive ? 'active' : '';
        const activeRespClass = !isPrincipalActive ? 'active' : '';

        toggleBtn = `
             <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                 <button onclick="alternarVisualizacaoPreview(this, '${principalPreviewUrl}', '${downloadPrincipalUrlFull}')" class="btn-drive btn-preview btn-preview-toggle-tab ${activePrincipalClass}" style="flex: 1; padding: 10px; font-size: 12px;">📜 Ver Ofício Original</button>
                 <button onclick="alternarVisualizacaoPreview(this, '${respPreviewUrl}', '${downloadRespUrlFull}')" class="btn-drive btn-orange-outline btn-preview-toggle-tab ${activeRespClass}" style="flex: 1; padding: 10px; font-size: 12px;">📁 Ver Resposta</button>
             </div>
         `;
    }

    // Ações da Diretoria (Diflor) para avaliar a resposta dentro da pré-visualização
    let acoesDiflorPreview = '';
    const statusRespAval = (linha['STATUS-RESPOSTA'] || linha['STATUS DA RESPOSTA'] || '').toUpperCase();
    if (usuarioAtivo && usuarioAtivo.username === 'diflor' && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && linkResposta && linkResposta.trim().startsWith('http')) {
        acoesDiflorPreview = `
            <div style="margin-top: 20px; padding: 15px; background-color: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 6px;">
                <strong style="color: #ffa500; font-size: 14px; display: block; margin-bottom: 10px;">📋 Avaliar Resposta:</strong>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <button onclick="avaliarRespostaExt(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive btn-green-outline">✅ Aprovar Manifestação</button>
                    <button onclick="avaliarRespostaExt(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive btn-red-outline">❌ Reprovar Manifestação</button>
                </div>
            </div>
        `;
    }

    const contentDiv = document.getElementById('previewInfoContent');
    contentDiv.innerHTML = toggleBtn + contentDiv.innerHTML + acoesDiflorPreview;

    document.getElementById('previewFrame').src = previewUrl;
    modal.style.display = 'flex';
}

function anexarDocumentoExt(event, nup) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'application/pdf';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btn.innerHTML = '⏳ A enviar...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader(); reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });

            const payload = { acao: "upload", nup: nup, fileName: `Resposta_Externo_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, base64: base64, tipo_oficio: "externo" };
            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('Resposta anexada com sucesso!', 'success');
                const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DA RESPOSTA'] = resultado.url;
                    target['STATUS'] = "REVISÃO";
                    target['STATUS-RESPOSTA'] = "";
                    target['MOTIVO DA AVALIAÇÃO'] = "";
                }
                filtrarExternos();
                atualizarCacheExternos();
            } else {
                mostrarToast('Erro: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
            }
        } catch (error) { mostrarToast('Erro de comunicação.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1'; }
    };
    fileInput.click();
}

function anexarPdfOriginalExt(event, nup) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = 'application/pdf';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btn.innerHTML = '⏳ A enviar...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader(); reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });

            const payload = { 
                acao: "anexar_pdf_original_externo", 
                nup: nup, 
                fileName: `Oficio_Externo_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64,
                username: usuarioAtivo.username || ''
            };
            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('PDF Original anexado com sucesso!', 'success');
                const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DO NUP'] = resultado.url;
                    target['LINK-NUP'] = resultado.url;
                }
                filtrarExternos();
                atualizarCacheExternos();
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

async function removerDocumentoExt(event, nup) {
    const btn = event.currentTarget;
    const result = await mostrarConfirmacao('Deseja desvincular a resposta deste NUP Externo?', { titulo: 'Confirmar Remoção', textoBotao: '🗑️ Sim, Remover' });
    if (!result.confirmou) return;

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ A remover...'; btn.disabled = true;

    try {
        const payload = { acao: "remover_resposta", nup: nup };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast('Documento desvinculado.', 'success');
            const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['LINK DA RESPOSTA'] = "";
                target['STATUS'] = "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
                target['STATUS-RESPOSTA'] = "";
                target['MOTIVO DA AVALIAÇÃO'] = "";
            }
            filtrarExternos();
            atualizarCacheExternos();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error'); btn.innerHTML = textoOriginal; btn.disabled = false;
        }
    } catch (error) { mostrarToast('Erro de rede.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

async function avaliarRespostaExt(event, nup, decisao) {
    const btn = event.currentTarget;
    const conf = decisao === 'APROVADO' ? { titulo: 'Aprovar', textoBotao: '✅ Aprovar', corBotao: '#27ae60' } : { titulo: 'Reprovar', textoBotao: '❌ Reprovar', corBotao: '#c0392b', exigeMotivo: true };
    const result = await mostrarConfirmacao(`Deseja ${decisao} esta resposta?`, conf);
    if (!result.confirmou) return;

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ A processar...'; btn.disabled = true;

    try {
        const payload = { acao: "avaliar_resposta", nup: nup, decisao: decisao, motivo: result.motivo };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast(`Processo ${decisao.toLowerCase()}!`, 'success');
            const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS-RESPOSTA'] = decisao;
                target['MOTIVO DA AVALIAÇÃO'] = result.motivo || "";
                target['STATUS'] = (decisao === 'APROVADO') ? "FAZER CI" : "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
            }
            filtrarExternos();
            atualizarCacheExternos();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error'); btn.innerHTML = textoOriginal; btn.disabled = false;
        }
    } catch (error) { mostrarToast('Erro de rede.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

function abrirModalAtribuirTecnicoExterno(nup) {
    document.getElementById('atrExternoNup').value = nup;

    const select = document.getElementById('atrExternoTecnico');
    select.innerHTML = '';
    const elBlank = document.createElement('option');
    elBlank.value = ''; elBlank.textContent = '-- Selecione o Técnico --';
    select.appendChild(elBlank);

    opcoesAutoTecnico.forEach(opt => {
        const el = document.createElement('option'); el.value = opt; el.textContent = opt; select.appendChild(el);
    });

    document.getElementById('atribuirTecnicoExternoModal').style.display = 'flex';
}

function fecharModalAtribuirTecnicoExterno() {
    document.getElementById('atribuirTecnicoExternoModal').style.display = 'none';
}

async function salvarAtribuicaoTecnicoExterno() {
    const nup = document.getElementById('atrExternoNup').value;
    const tecnico = document.getElementById('atrExternoTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico para atribuir.', 'error'); return; }

    const btn = document.getElementById('btnSalvarAtribuicaoExterno');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    // OPTIMISTIC UPDATE
    const procRef = dadosExternosGlobais.find(a => a['NUP'] === nup);
    let statusOriginal = '';
    let tecnicoOriginal = '';
    let dataRepasseOriginal = '';
    const dataProvisoria = new Date().toLocaleDateString('pt-BR');

    if (procRef) {
        statusOriginal = procRef['STATUS'];
        tecnicoOriginal = procRef['TÉCNICO/ADMIN'];
        dataRepasseOriginal = procRef['DATA DE REPASSE'];

        procRef['TÉCNICO/ADMIN'] = tecnico;
        procRef['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        procRef['DATA DE REPASSE'] = dataProvisoria;
    }

    mostrarToast('Processo distribuído localmente. Sincronizando em background...', 'success');

    fecharModalAtribuirTecnicoExterno();
    filtrarExternos();
    atualizarCacheExternos();

    btn.innerHTML = txtOriginal;
    btn.disabled = false;

    try {
        const payload = { acao: "atribuir_tecnico_externo", nup: nup, tecnico: tecnico };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast('Distribuição confirmada na nuvem com sucesso!', 'success');
            if (procRef && resultado.dataRepasse) {
                procRef['DATA DE REPASSE'] = resultado.dataRepasse;
                filtrarExternos();
                atualizarCacheExternos();
            }
        } else {
            throw new Error(resultado.message);
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Falha ao sincronizar atribuição. (Revertendo)', 'error');
        if (procRef) {
            procRef['STATUS'] = statusOriginal;
            procRef['TÉCNICO/ADMIN'] = tecnicoOriginal;
            procRef['DATA DE REPASSE'] = dataRepasseOriginal;
        }
        filtrarExternos();
        atualizarCacheExternos();
    }
}

if (typeof configurarDragAndDrop === 'function') {
    configurarDragAndDrop('cadExtArquivo', 'cadExternoArquivoLabel', updateFileNameExterno);
}