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

function limparEPadronizarExternos(r) {
    if (!r) return r;
    r['NUP'] = r['NUP'] || r['PROCESSO'] || '';
    r['DATA DE RECEBIMENTO'] = r['DATA RECEBIMENTO'] || r['DATA DE RECEBIMENTO'] || r['DATA'] || '';
    r['DATA RECEBIMENTO'] = r['DATA DE RECEBIMENTO'];
    r['ASSUNTO'] = r['ASSUNTO'] || '';
    r['REMETENTE'] = r['REMETENTE'] || '';
    let tecExt = (r['TÉCNICO/ADMIN'] || r['TECNICO/ADMIN'] || r['TÉCNICO'] || r['TECNICO'] || 'S/T').trim().toUpperCase();
    if (tecExt === 'JOSE RENATO') tecExt = 'JOSÉ RENATO';
    r['TÉCNICO/ADMIN'] = tecExt;
    r['TÉCNICO'] = tecExt;
    r['OBSERVAÇÕES'] = r['OBSERVAÇÃO'] || r['OBSERVAÇÕES'] || r['OBS'] || '-';
    r['OBSERVAÇÃO'] = r['OBSERVAÇÕES'];
    r['LINK DO NUP'] = r['LINK DO NUP'] || r['LINK-NUP'] || r['LINK NUP'] || r['LINK_NUP'] || r['LINK'] || '';
    
    const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
    r['LINK DA RESPOSTA'] = linkResposta;
    r['LINK RESPOSTA'] = linkResposta;
    const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
    
    const statusResp = (r['STATUS-RESPOSTA'] || r['STATUS DA RESPOSTA'] || r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
    r['STATUS-RESPOSTA'] = statusResp;
    r['STATUS DA RESPOSTA'] = statusResp;
    r['STATUS_RESPOSTA'] = statusResp;

    r['MOTIVO DA AVALIAÇÃO'] = r['MOTIVO DA AVALIAÇÃO'] || r['MOTIVO AVALIAÇÃO'] || r['MOTIVO_AVALIACAO'] || '';

    let statusRow = (r['STATUS'] || '').toUpperCase().trim();

    // 1. Se tem resposta anexada e não foi aprovada nem reprovada, mas o status geral ainda diz AGUARDANDO MANIFESTAÇÃO TÉCNICA:
    // Promove o status para REVISÃO para figurar corretamente na aba de Aguardando Revisão com o indicativo roxo REVISÃO
    if (hasResposta && statusResp !== 'APROVADO' && statusResp !== 'REPROVADO' && (statusRow === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusRow === 'AGUARDANDO MANIFESTACAO TECNICA')) {
        r['STATUS'] = 'REVISÃO';
    }

    // 2. Se a resposta foi APROVADA e o status geral é AGUARDANDO MANIFESTAÇÃO TÉCNICA ou REVISÃO:
    if (statusResp === 'APROVADO' && (statusRow === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusRow === 'AGUARDANDO MANIFESTACAO TECNICA' || statusRow === 'REVISÃO' || statusRow === 'REVISAO')) {
        r['STATUS'] = 'FAZER DESPACHO';
    }

    // 3. Se a resposta foi REPROVADA e o status geral é REVISÃO:
    if (statusResp === 'REPROVADO' && (statusRow === 'REVISÃO' || statusRow === 'REVISAO')) {
        r['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }

    return r;
}

function atualizarCacheExternos() {
    const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
    const keyExternos = `corino_cache_dados_externos_${username}`;
    localStorage.setItem(keyExternos, JSON.stringify(dadosExternosGlobais));
    if (typeof window.limparCacheHistoricoGlobal === 'function') window.limparCacheHistoricoGlobal();
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

    let listaTecnicosExt = (typeof opcoesAutoTecnico !== 'undefined' && Array.isArray(opcoesAutoTecnico)) ? [...opcoesAutoTecnico] : [];
    if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
        listaTecnicosExt = listaTecnicosExt.filter(tec => {
            const t = tec.trim().toUpperCase();
            return MAPA_TECNICOS_SETORES[t] === usuarioAtivo.setor;
        });
    }

    preencherSelect('cadExtStatus', opcoesExternoStatus);
    preencherSelect('cadExtTecnico', listaTecnicosExt, '-- Sem Técnico --');
    preencherSelect('filtro-ext-tecnico', listaTecnicosExt, '-- Todos os Técnicos --');
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

    // Definir data de hoje por padrão no campo de recebimento
    const recPicker = document.getElementById('cadExtDataRec');
    if (recPicker && recPicker._flatpickr) {
        recPicker._flatpickr.setDate(new Date());
    }
}

function fecharModalCadastroExterno() {
    document.getElementById('cadastroExternoModal').style.display = 'none';
    if (typeof fecharModalCadastroUnificado === 'function') fecharModalCadastroUnificado();
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
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-muted); background-color: var(--card-bg); border-radius: 8px; border: 1px solid var(--card-border);">Nenhum Ofício Externo encontrado.</div>';
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
        const temResposta = linkResposta && linkResposta.trim() !== '' && linkResposta.trim() !== '-';

        // Botoes do Documento Principal
        let htmlPreviewIcon = '';
        let htmlLink = '';
        let btnAnexar = '';
        let btnAnexarOriginal = '';

        if (usuarioAtivo) {
            if (temResposta) {
                const isAprovado = (s['STATUS-RESPOSTA'] || s['STATUS DA RESPOSTA'] || '').toUpperCase() === 'APROVADO';
                const isGestor = (typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
                if (!isGestor && isAprovado) {
                    btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px;"><i class="ci ci-lock"></i> Documento aprovado.</div>`;
                } else {
                    btnAnexar = `<button onclick="removerDocumentoExt(event, '${nupVal}')" class="btn-drive btn-red-outline"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
                }
            } else if (usuarioAtivo.perfil === 'tecnico' || (typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo())) {
                btnAnexar = `<button onclick="anexarDocumentoExt(event, '${nupVal}')" class="btn-drive btn-purple"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
            }

            // Botão para anexar o PDF original do Ofício
            btnAnexarOriginal = `<button onclick="anexarPdfOriginalExt(event, '${nupVal}')" class="btn-drive btn-upload" style="background-color: #34495e; border-color: #2c3e50;">📁 Anexar PDF Original</button>`;
        }

        if (linkDrive && linkDrive.trim() !== '' && linkDrive.trim() !== '-') {
            if (isLinkGCS(linkDrive)) {
                htmlPreviewIcon = `<button onclick="abrirPreviewExterno(event, '${linkDrive}', '${nupVal}')" class="btn-inline-preview" title="Visualizar (LGPD Seguro)"></button>`;
                htmlLink = `<div class="modal-buttons"><button onclick="dispararDownloadSeguro('${linkDrive}', 'Oficio_Ext_${nupVal}.pdf')" class="btn-drive btn-download">⬇️ Download (LGPD)</button> ${btnAnexar}</div>`;
            } else {
                const fileId = extrairIdDrive(linkDrive);
                if (fileId) {
                    const linkPrev = `https://drive.google.com/file/d/${fileId}/preview`;
                    const linkDown = `https://drive.google.com/uc?export=download&id=${fileId}`;
                    htmlPreviewIcon = `<button onclick="abrirPreviewExterno(event, '${linkPrev}', '${nupVal}')" class="btn-inline-preview" title="Visualizar"></button>`;
                    htmlLink = `<div class="modal-buttons"><a href="${linkDown}" class="btn-drive btn-download" onclick="feedbackDownload(this)">⬇️ Download Original</a> ${btnAnexar}</div>`;
                } else {
                    htmlLink = `<div class="modal-buttons"><a href="${linkDrive}" target="_blank" class="btn-drive"><i class="ci ci-external"></i> Abrir Link Vinculado</a> ${btnAnexar}</div>`;
                }
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
            let botaoResp = '';
            if (isLinkGCS(linkResposta)) {
                botaoResp = `<button onclick="abrirPreviewExterno(event, '${linkResposta}', '${nupVal}')" class="btn-drive btn-orange-outline"><i class="ci ci-eye"></i> Ver Resposta (LGPD)</button>`;
            } else {
                const respId = extrairIdDrive(linkResposta);
                if (respId) {
                    const respPrev = `https://drive.google.com/file/d/${respId}/preview`;
                    botaoResp = `<button onclick="abrirPreviewExterno(event, '${respPrev}', '${nupVal}')" class="btn-drive btn-orange-outline"><i class="ci ci-eye"></i> Ver Resposta</button>`;
                } else {
                    botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive btn-orange-outline"><i class="ci ci-external"></i> Abrir Resposta</a>`;
                }
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
        const tecExt = (s['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
        const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' && MAPA_TECNICOS_SETORES[tecExt]) ? MAPA_TECNICOS_SETORES[tecExt] : 'GCAR';
        const podeAvaliar = (typeof window.podeAvaliarManifestacao === 'function') ? window.podeAvaliarManifestacao(setorInternoDoTecnico) : isGestor;
        const podeRedistExt = (typeof window.podeRedistribuirTecnico === 'function') ? window.podeRedistribuirTecnico(setorInternoDoTecnico) : isGestor;
        const podeAdmExt = (typeof window.podeConfeccionarDespachoOuCI === 'function') ? window.podeConfeccionarDespachoOuCI(setorInternoDoTecnico) : isGestor;

        if (podeAvaliar && temResposta) {
            const statusResp = (s['STATUS-RESPOSTA'] || s['STATUS DA RESPOSTA'] || '').toUpperCase();
            if (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO') {
                acoesDiflor = `
                    <div style="margin-top: 20px; display: flex; gap: 10px;">
                        <button onclick="avaliarRespostaExt(event, '${nupVal}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1;"><i class="ci ci-check"></i> Aprovar</button>
                        <button onclick="avaliarRespostaExt(event, '${nupVal}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1;"><i class="ci ci-close"></i> Reprovar</button>
                    </div>
                `;
            }
        }

        let htmlDiretoriaBotoes = '';
        const tecValExt = String(s['TÉCNICO/ADMIN'] || '').toUpperCase().trim();
        const isSemTecnico = !tecValExt || tecValExt === '-' || tecValExt === 'S/T' || tecValExt === 'SEM TÉCNICO' || tecValExt === 'NÃO ATRIBUÍDO' || tecValExt === 'SEM TÉCNICO/ADM';

        if (podeRedistExt) {
            if (isSemTecnico) {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoExterno('${nupVal}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Distribuir / Atribuir Técnico</button>`;
            } else {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoExterno('${nupVal}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Redistribuir Técnico</button>`;
            }
        }

        if (podeAdmExt) {
            const rawStatus = (s['STATUS'] || '').toUpperCase().trim();
            if (rawStatus === 'FAZER DESPACHO' || rawStatus === 'FAZER CI') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top:15px;padding:15px;background-color:rgba(41,128,185,0.07);border:1px solid rgba(41,128,185,0.3);border-radius:6px;">
                        <strong style="color:#2980b9;font-size:13px;display:block;margin-bottom:10px;">📋 Ações de Fluxo (Despacho):</strong>
                        <div style="display:flex;gap:10px;flex-direction:column;">
                            <button onclick="atualizarStatusExt(event, '${nupVal}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background-color: #2980b9; border-color: #1c5986; color: white; width: 100%; margin: 0; font-size: 14px;">✅ Confirmar Realização do Despacho</button>
                            <button onclick="if(typeof abrirModalSobrestar==='function') abrirModalSobrestar('${nupVal}', 'externo');" class="btn-drive" style="background-color: #f39c12; border-color: #d68910; color: #111; font-weight: bold; width: 100%; margin: 0; font-size: 14px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                        </div>
                    </div>`;
            } else if (rawStatus === 'SOBRESTADO') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top:15px;padding:15px;background-color:rgba(243,156,18,0.1);border:1px solid rgba(243,156,18,0.4);border-radius:6px;">
                        <strong style="color:#f39c12;font-size:13px;display:block;margin-bottom:8px;">⏸️ Processo Sobrestado (Encaminhado para: ${s['SOBRESTADO_SETOR'] || 'Setor Externo'})</strong>
                        ${s['SOBRESTADO_MOTIVO'] ? `<div style="font-size:12px;color:#ccc;margin-bottom:12px;"><strong>Motivo:</strong> ${s['SOBRESTADO_MOTIVO']}</div>` : ''}
                        <button onclick="if(typeof abrirModalRetornoSobrestamento==='function') abrirModalRetornoSobrestamento('${nupVal}', 'externo');" class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; color: white; width: 100%; margin: 0; font-size: 14px; font-weight: bold;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
                    </div>`;
            } else if (rawStatus === 'AGUARDANDO ASSINATURA') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top:15px;padding:15px;background-color:rgba(142,68,173,0.07);border:1px solid rgba(142,68,173,0.3);border-radius:6px;">
                        <strong style="color:#8e44ad;font-size:13px;display:block;margin-bottom:10px;">📋 Ações de Fluxo (Assinatura):</strong>
                        <button onclick="atualizarStatusExt(event, '${nupVal}', 'FINALIZADO')" class="btn-drive" style="background-color: #8e44ad; border-color: #6c3483; color: white; width: 100%; margin: 0; font-size: 14px;">✍️ Confirmar Assinatura Realizada</button>
                    </div>`;
            }
        }

        if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR')) {
            const rawStatus = (s['STATUS'] || '').toUpperCase().trim();
            const opcoesExtStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "REVISÃO", "FAZER DESPACHO", "SOBRESTADO", "AGUARDANDO ASSINATURA", "FINALIZADO", "DEVOLVIDO"];
            let optionsHtml = opcoesExtStatus.map(st => `<option value="${st}" ${st === rawStatus ? 'selected' : ''}>${st}</option>`).join('');
            
            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;"><i class="ci ci-settings"></i> GESTÃO DE STATUS (DIRETORIA)</div>
                    <div style="display: flex; gap: 8px;">
                        <select id="changeStatusSelectExt-${nupVal}" style="flex: 1; padding: 8px; background-color: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 13px; outline: none; height: 38px;">
                            ${optionsHtml}
                        </select>
                        <button onclick="salvarStatusManualExterno(event, '${nupVal}')" id="btnSalvarStatusExt-${nupVal}" class="btn-drive btn-blue" style="width: auto; padding: 8px 15px; margin: 0; font-size: 13px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">Alterar</button>
                    </div>
                </div>
            `;
        }

        let htmlDossieExt = '';
        if (s['MANIFESTACAO_PRELIMINAR']) {
            htmlDossieExt += `<div style="background-color: #1a252f; border: 1px solid #2c3e50; border-radius: 6px; padding: 10px; margin-top: 10px;"><div style="color: #00fa9a; font-weight: bold; margin-bottom: 5px; font-size: 13px;">📄 Manifestação Preliminar Aprovada (Sobrestamento)</div><button onclick="abrirPreviewExterno(event, '${s['MANIFESTACAO_PRELIMINAR']}', '${s['NUP']}')" class="btn-drive btn-orange-outline" style="width: auto; padding: 5px 12px; font-size: 12px; margin: 0;"><i class="ci ci-eye"></i> Ver Arquivo</button></div>`;
        }
        if (s['LINK_PARECER_EXTERNO']) {
            htmlDossieExt += `<div style="background-color: #1a252f; border: 1px solid #2c3e50; border-radius: 6px; padding: 10px; margin-top: 10px;"><div style="color: #00fa9a; font-weight: bold; margin-bottom: 5px; font-size: 13px;">🏛️ Parecer do Setor Externo</div><button onclick="abrirPreviewExterno(event, '${s['LINK_PARECER_EXTERNO']}', '${s['NUP']}')" class="btn-drive btn-orange-outline" style="width: auto; padding: 5px 12px; font-size: 12px; margin: 0;"><i class="ci ci-eye"></i> Ver Parecer</button></div>`;
        }
        if (htmlDossieExt !== '') {
            htmlDossieExt = `<div style="margin-top: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;">📚 Dossiê de Documentos</strong>${htmlDossieExt}</div>`;
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
            ${htmlDossieExt}
            <div id="timeline-container-ext" style="margin-top: 25px; margin-bottom: 25px;"></div>

            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #333;">
                ${htmlLink}
                ${htmlDiretoriaBotoes}
            </div>
        `;
    }
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);

    if (externoSelecionadoMockup) {
        renderizarLinhaTempoSistema(externoSelecionadoMockup['NUP'], 'timeline-container-ext');
    }

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
    const fStatusEl = document.getElementById('filtro-ext-status');

    const nup = fNupEl ? fNupEl.value.toLowerCase().trim() : '';
    const carms = fCarmsEl ? fCarmsEl.value.toLowerCase().trim() : '';
    const tecnico = fTecnicoEl ? fTecnicoEl.value.toLowerCase().trim() : '';
    const remetente = fRemetenteEl ? fRemetenteEl.value.toLowerCase().trim() : '';
    const status = fStatusEl ? fStatusEl.value.toUpperCase().trim() : '';

    if (typeof dadosExternosGlobais !== 'undefined' && Array.isArray(dadosExternosGlobais)) {
        dadosExternosGlobais.forEach(limparEPadronizarExternos);
    }

    const filtrados = dadosExternosGlobais.filter(r => {
        const nupRow = r['NUP'] || '';
        const carmsRow = r['CARMS'] || '';
        const tecRow = r['TÉCNICO/ADMIN'] || '';
        const remetenteRow = r['REMETENTE'] || '';
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const statusResp = (r['STATUS-RESPOSTA'] || r['STATUS DA RESPOSTA'] || r['STATUS_RESPOSTA'] || '').toUpperCase().trim();

        let matchesStatusFilter = true;
        if (status) {
            if (status === 'FINALIZADO') {
                matchesStatusFilter = (statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO');
            } else {
                matchesStatusFilter = (statusRow === status);
            }
        }

        const matchNormais = (!nup || String(nupRow).toLowerCase().includes(nup))
            && (!carms || String(carmsRow).toLowerCase().includes(carms))
            && (!tecnico || String(tecRow).toLowerCase().includes(tecnico))
            && (!remetente || String(remetenteRow).toLowerCase().includes(remetente))
            && matchesStatusFilter;

        if (!matchNormais) return false;

        const tecUpper = tecRow.toUpperCase().trim();
        const semTecnico = tecUpper === '' || tecUpper === '-' || tecUpper === 'S/T' || tecUpper === 'SEM TÉCNICO' || tecUpper === 'NÃO ATRIBUÍDO' || tecUpper === 'SEM TÉCNICO/ADM';

        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            const matchTecnico = (typeof window.isMesmoTecnico === 'function')
                ? window.isMesmoTecnico(tecUpper, usuarioAtivo)
                : (tecUpper === (usuarioAtivo.nomePlanilha || '').toUpperCase().trim());
            if (!matchTecnico) return false;
        }

        // Restrição de Gerência para GCAR / GEAA / GEAMB
        if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            const semTecnico = tecUpper === '' || tecUpper === '-' || tecUpper === 'S/T' || tecUpper === 'SEM TÉCNICO' || tecUpper === 'NÃO ATRIBUÍDO' || tecUpper === 'SEM TÉCNICO/ADM';
            if (!semTecnico) {
                const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecUpper] : null) || 'S/G';
                const gerenciaRow = (r['GERÊNCIA'] || '').trim().toUpperCase();
                if (setorInternoDoTecnico !== usuarioAtivo.setor && gerenciaRow !== usuarioAtivo.setor) return false;
            } else {
                const gerenciaRow = (r['GERÊNCIA'] || '').trim().toUpperCase();
                if (gerenciaRow !== usuarioAtivo.setor) return false;
            }
        }

        const isFinalizado = statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO';
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');

        let matchesSubAba = true;
        if (subAbaAtiva === 'Aguardando Revisão') {
            if (subAbaExternosRevisaoAtiva === 'Pendentes') {
                matchesSubAba = (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO');
            } else if (subAbaExternosRevisaoAtiva === 'Reprovados') {
                matchesSubAba = (statusResp === 'REPROVADO');
            }
        } else {
            if (typeof subAbaExternosAtiva !== 'undefined' && subAbaExternosAtiva !== 'Geral') {
                const tecSector = semTecnico ? 'S/T' : ((typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecUpper] : null) || 'S/G');
                matchesSubAba = (tecSector === subAbaExternosAtiva);
            }
        }

        if (!matchesSubAba) return false;

        // =====================================================================
        // REGRAS DE FILTRAGEM DAS SUB-ABAS (SITUAÇÃO GERAL RECONFIGURADA)
        // =====================================================================
        if (subAbaAtiva === 'Geral') {
            return true;
        } else if (subAbaAtiva === 'Aguard. Distribuição') {
            return semTecnico && !isFinalizado && !hasResposta && statusRow !== 'FAZER DESPACHO' && statusRow !== 'FAZER CI' && statusRow !== 'AGUARDANDO ASSINATURA' && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO';
        } else if (subAbaAtiva === 'Em Andamento') {
            const isEmAndamentoStatus = (statusRow === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusRow === 'AGUARDANDO MANIFESTACAO TECNICA');
            const isReprovado = (statusResp === 'REPROVADO');
            return !semTecnico && isEmAndamentoStatus && (!hasResposta || isReprovado) && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO';
        } else if (subAbaAtiva === 'Aguardando Revisão') {
            const isReprovado = (statusResp === 'REPROVADO');
            if (subAbaExternosRevisaoAtiva === 'Reprovados') {
                return isReprovado && !isFinalizado;
            }
            if (isReprovado) return false;
            return (hasResposta || statusRow === 'REVISÃO' || statusRow === 'REVISAO') && statusRow !== 'FAZER DESPACHO' && statusRow !== 'FAZER CI' && statusRow !== 'AGUARDANDO ASSINATURA' && !isFinalizado;
        } else if (subAbaAtiva === 'Fazer Despacho') {
            return (statusRow === 'FAZER DESPACHO' || statusRow === 'FAZER CI') && !isFinalizado;
        } else if (subAbaAtiva === 'Aguardando Assinatura') {
            return statusRow === 'AGUARDANDO ASSINATURA' && !isFinalizado;
        }

        return false;
    });
    renderTabelaExternos(filtrados);
    if (typeof atualizarBadgesNotificacao === 'function') {
        atualizarBadgesNotificacao(dadosCoringa);
    }
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
            dadosExternosGlobais = JSON.parse(cacheSalvo).map(limparEPadronizarExternos);
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
        const resultado = await executarAcaoGAS({ acao: "buscar_externos" });
        if (resultado.status === 'success') {
            dadosExternosGlobais = (resultado.dados || []).map(limparEPadronizarExternos);
            atualizarCacheExternos();
            if (typeof atualizarDashboardInicio === 'function' && typeof filtroAtivo !== 'undefined' && filtroAtivo === 'inicio') {
                atualizarDashboardInicio();
            }
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
    const dataRecebimento = document.getElementById('cadExtDataRec').value.trim();
    if (!nup || !remetente || !dataRecebimento) { mostrarToast('NUP, Remetente e Data do Recebimento são obrigatórios!', 'error'); return; }

    const btn = document.getElementById('btnSalvarCadastroExt');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    const fileInput = document.getElementById('cadExtArquivo');
    let base64File = null; let fileName = null; let gcsUri = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 25 * 1024 * 1024) { mostrarToast('O ficheiro deve ter máx 25MB', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
        fileName = file.name;

        // 1. Upload Seguro no GCS
        if (typeof GCSStorage !== 'undefined') {
            try {
                const gcsRes = await GCSStorage.fazerUpload(file, {
                    modulo: 'externos',
                    nup: nup,
                    nomePersonalizado: fileName,
                    username: usuarioAtivo ? usuarioAtivo.username : 'sistema'
                });
                if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                    gcsUri = gcsRes.fullGcsUri || gcsRes.gcsPath;
                }
            } catch (gcsErr) {
                console.warn('⚠️ [GCS] Fallback para envio base64:', gcsErr.message);
            }
        }

        if (!gcsUri) {
            try {
                base64File = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                    reader.onerror = (e) => reject(e);
                    reader.readAsDataURL(file);
                });
            } catch (e) { mostrarToast('Erro ao ler arquivo', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
        }
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
        url: gcsUri,
        linkGcs: gcsUri,
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
        'OBSERVAÇÕES': payload.observacao,
        'LINK DO NUP': gcsUri || '',
        'LINK-NUP': gcsUri || '',
        'LINK': gcsUri || ''
    };

    dadosExternosGlobais.unshift(novoItem);
    fecharModalCadastroExterno();
    filtrarExternos();
    atualizarCacheExternos();
    mostrarToast('Ofício Externo lançado localmente. Sincronizando com a nuvem...', 'success');
    btn.innerHTML = textoOriginal; btn.disabled = false;

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Sincronizado com sucesso no Google Cloud Storage (LGPD)!', 'success');
            const linkFinal = gcsUri || resultado.url;
            if (linkFinal) {
                novoItem['LINK DO NUP'] = linkFinal;
                novoItem['LINK-NUP'] = linkFinal;
                novoItem['LINK'] = linkFinal;
                atualizarCacheExternos();
                filtrarExternos();
            }
        } else { 
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

async function abrirPreviewExterno(arg1, arg2, arg3) {
    let event = null;
    let url = '';
    let linha = null;
    let nup = null;

    // 1. Classificação flexível de argumentos independentemente da ordem
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
        }
    }

    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const modalPequeno = document.getElementById('detalhesModal');
    if (modalPequeno) modalPequeno.style.display = 'none';

    const listaExt = (typeof dadosExternosGlobais !== 'undefined' ? dadosExternosGlobais : (typeof dadosExternos !== 'undefined' ? dadosExternos : []));

    // Se temos a linha (objeto), extrai o NUP
    if (linha && linha['NUP']) {
        nup = linha['NUP'];
    }

    // Se não temos a linha mas temos o NUP
    if (!linha && nup && typeof nup === 'string' && nup !== '-') {
        const nupBusca = nup.trim().toUpperCase();
        const nupSemPdf = nupBusca.replace(/\.PDF$/i, '');
        linha = listaExt.find(x => {
            const n = String(x['NUP'] || '').trim().toUpperCase();
            return n === nupBusca || n.replace(/\.PDF$/i, '') === nupSemPdf;
        });
    }

    // Se ainda não temos a linha mas temos URL, pesquisa por correspondência no dossiê
    if (!linha && url) {
        const urlStr = String(url).trim();
        const driveId = typeof extrairIdDrive === 'function' ? extrairIdDrive(urlStr) : null;
        linha = listaExt.find(x => {
            const campos = [
                x['LINK_OFICIO'], x['LINK DO NUP'], x['LINK-NUP'], x['LINK'],
                x['LINK DA RESPOSTA'], x['LINK RESPOSTA'], x['LINK_RESPOSTA'],
                x['MANIFESTACAO_PRELIMINAR'], x['LINK_PARECER_EXTERNO']
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
    if (typeof nupOriginal === 'string' && (nupOriginal.startsWith('http') || nupOriginal.startsWith('/') || nupOriginal.includes('://'))) {
        nupOriginal = '-';
    }
    const nupDisplay = typeof limparNupDisplay === 'function' ? limparNupDisplay(nupOriginal) : String(nupOriginal).replace(/\.pdf$/gi, '');
    const nupFormatado = String(nupOriginal).replace(/[^a-zA-Z0-9]/g, '_');
    const nupEsc = typeof escaparParaAtributo === 'function' ? escaparParaAtributo(nupOriginal) : nupOriginal;

    const iconeOlhoGrande = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-wrapper" id="preview-wrapper-id">
            <div class="preview-toolbar">
                <div class="preview-toolbar-title">
                    ${iconeOlhoGrande}
                    <span class="modal-detail-module-tag modal-detail-tag-externo" style="margin-right: 8px;"><i class="ci ci-building"></i> Ofício Externo</span>
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
                <div id="previewInfo" class="preview-info">
                    <div id="previewInfoContent"></div>
                </div>
            </div>
        </div>
    `;

    const linkResposta = linha ? (linha['LINK DA RESPOSTA'] || linha['LINK RESPOSTA'] || linha['LINK_RESPOSTA'] || '') : '';
    let respPreviewUrl = (linkResposta && linkResposta.trim() !== '' && linkResposta.trim() !== '-') ? linkResposta : '';
    const linkDrive = linha ? (linha['LINK_OFICIO'] || linha['LINK DO NUP'] || linha['LINK-NUP'] || linha['LINK'] || '') : (url || '');
    let principalPreviewUrl = (linkDrive && linkDrive.trim() !== '' && linkDrive.trim() !== '-') ? linkDrive : '';
    let preliminarPreviewUrl = linha ? (linha['MANIFESTACAO_PRELIMINAR'] && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '' && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '-' ? linha['MANIFESTACAO_PRELIMINAR'] : '') : '';
    let parecerPreviewUrl = linha ? (linha['LINK_PARECER_EXTERNO'] && linha['LINK_PARECER_EXTERNO'].trim() !== '' && linha['LINK_PARECER_EXTERNO'].trim() !== '-' ? linha['LINK_PARECER_EXTERNO'] : '') : '';

    const statusStr = String(linha ? (linha['STATUS'] || 'AGUARDANDO DISTRIBUIÇÃO') : '').toUpperCase();
    const statusLimpo = statusStr.replace(/\./g, '').trim().toUpperCase();
    const isSobrestado = statusLimpo === 'SOBRESTADO' || statusLimpo.includes('SOBRESTADO');

    let urlAtual = url;
    if (!urlAtual) {
        if (isSobrestado && preliminarPreviewUrl) {
            urlAtual = preliminarPreviewUrl;
        } else {
            urlAtual = principalPreviewUrl || preliminarPreviewUrl || parecerPreviewUrl || respPreviewUrl || '';
        }
    }

    let previewUrl = urlAtual;
    let downloadUrl = urlAtual;

    try {
        if (typeof obterLinkVisualizacaoSeguro === 'function' && urlAtual) previewUrl = await obterLinkVisualizacaoSeguro(urlAtual);
        if (typeof obterLinkDownloadSeguro === 'function' && urlAtual) downloadUrl = await obterLinkDownloadSeguro(urlAtual, `Oficio_Ext_${nupFormatado}.pdf`);
    } catch (e) {
        console.warn('Erro ao resolver link seguro do Ofício Externo:', e);
    }

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) btnDownload.href = downloadUrl;
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) btnOpenPreview.href = previewUrl;
    const previewFrame = document.getElementById('previewFrame');
    if (previewFrame) previewFrame.src = previewUrl;

    if (!linha) {
        const previewInfoEl = document.getElementById('previewInfoContent');
        if (previewInfoEl) previewInfoEl.innerHTML = `<div class="preview-info-card"><div class="preview-info-item">📄 Visualizando Ofício Externo: <strong>${nupDisplay}</strong></div></div>`;
        modal.style.display = 'flex'; const infoPanel = document.getElementById('previewInfo'); if (infoPanel) infoPanel.scrollTop = 0;
        return;
    }

    const obs = (linha['OBSERVAÇÕES'] || linha['OBSERVAÇÃO'] || '').trim();
    const htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="preview-info-obs"><strong>📋 Observação:</strong><br>${obs}</div>` : '';

    let docsDisponiveis = [];
    if (principalPreviewUrl) docsDisponiveis.push({ label: '📜 Ofício Original', url: principalPreviewUrl });
    if (preliminarPreviewUrl) docsDisponiveis.push({ label: '📄 Manifestação Preliminar (Sobrestamento)', url: preliminarPreviewUrl });
    if (parecerPreviewUrl) docsDisponiveis.push({ label: '🏛️ Parecer Externo', url: parecerPreviewUrl });
    if (respPreviewUrl) docsDisponiveis.push({ label: '📁 Resposta', url: respPreviewUrl });

    let toggleBtn = '';
    if (docsDisponiveis.length > 1) {
        const botoesHtml = docsDisponiveis.map(doc => {
            const isActive = (urlAtual === doc.url || previewUrl === doc.url || (typeof url === 'string' && url === doc.url));
            const activeClass = isActive ? 'active' : '';
            return `<button onclick="alternarVisualizacaoPreview(this, '${doc.url}', '${doc.url}')" class="btn-drive btn-preview-toggle-tab ${activeClass}" style="flex: 1; min-width: 120px; padding: 8px 12px; font-size: 11.5px;">${doc.label}</button>`;
        }).join('');

        toggleBtn = `
             <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
                 ${botoesHtml}
             </div>
         `;
    }

    let botoesAcoesHtml = '';
    const isGestor = usuarioAtivo && ((typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo()) || (typeof window.podeDistribuirProcesso === 'function' && window.podeDistribuirProcesso()) || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
    const isTecnico = usuarioAtivo && usuarioAtivo.perfil === 'tecnico';

    if (usuarioAtivo) {
        if (respPreviewUrl) {
            botoesAcoesHtml += `<button onclick="removerDocumentoExt(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-danger" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
        } else if (isTecnico || isGestor) {
            botoesAcoesHtml += `<button onclick="anexarDocumentoExt(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
        }

        if (!principalPreviewUrl) {
            botoesAcoesHtml += `<button onclick="anexarPdfOriginalExt(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar Ofício Inicial</button>`;
        }
    }

    if (isGestor) {
        const tec = linha['TÉCNICO/ADMIN'] || linha['TÉCNICO'] || '';
        const isSemTecnico = !tec || tec === '-' || tec === 'S/T' || tec === 'Não atribuído';
        const labelTec = isSemTecnico ? '<i class="ci ci-user"></i> Distribuir / Atribuir Técnico' : '<i class="ci ci-user"></i> Redistribuir Técnico';
        botoesAcoesHtml += `<button onclick="abrirModalAtribuirTecnicoExterno('${nupEsc}')" class="modal-detail-btn modal-detail-btn-gestao" style="width: 100%; margin-bottom: 8px;">${labelTec}</button>`;
    }

    let acoesRevisorHtml = '';
    const statusRespAval = (linha['STATUS-RESPOSTA'] || linha['STATUS DA RESPOSTA'] || '').toUpperCase();
    const tecExt = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
    const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecExt] : null) || 'S/G';
    const podeAvaliar = usuarioAtivo && (usuarioAtivo.username === 'diflor' || (typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() && (usuarioAtivo.setor === 'DIFLOR' || setorInternoDoTecnico === usuarioAtivo.setor)));

    if (podeAvaliar && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && respPreviewUrl) {
        acoesRevisorHtml = `
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; margin-bottom: 8px;">
                <div style="color: #fbbf24; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">📋 Avaliação da Resposta (Revisor):</div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="avaliarRespostaExt(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-check"></i> Aprovar</button>
                    <button onclick="avaliarRespostaExt(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-close"></i> Reprovar</button>
                </div>
            </div>
        `;
    }

    let acoesStatusDiretoria = '';
    if (isGestor) {
        const opcoesExtStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER DESPACHO", "SOBRESTADO", "REVISÃO", "AGUARDANDO ASSINATURA", "FINALIZADO", "TRAMITADO"];
        const optionsHtml = opcoesExtStatus.map(st => `<option value="${st}" ${st === statusStr ? 'selected' : ''}>${st}</option>`).join('');
        acoesStatusDiretoria = `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px; font-weight: 700;"><i class="ci ci-settings"></i> GESTÃO DE STATUS</div>
                <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box; align-items: center;">
                    <select id="changeStatusSelectExt-${nupEsc}" style="flex: 1; min-width: 0; padding: 6px 10px; background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12px; outline: none; height: 36px; box-sizing: border-box;">
                        ${optionsHtml}
                    </select>
                    <button onclick="salvarStatusManualExterno(event, '${nupEsc}')" id="btnSalvarStatusExt-${nupEsc}" class="btn-drive btn-blue" style="flex-shrink: 0; width: auto; min-width: 70px; padding: 6px 12px; margin: 0; font-size: 12px; height: 36px; box-sizing: border-box;">Salvar</button>
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
                ${preliminarPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${preliminarPreviewUrl}', '${preliminarPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(0, 250, 154, 0.15); border: 1px solid #00fa9a; color: #00fa9a; width: 100%; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-eye"></i> Visualizar Manifestação Preliminar</button>` : ''}
                ${parecerPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${parecerPreviewUrl}', '${parecerPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; width: 100%; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-court"></i> Visualizar Parecer Externo</button>` : ''}
                ${principalPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${principalPreviewUrl}', '${principalPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; width: 100%; margin-bottom: 8px; font-size: 12px; font-weight: 600; padding: 7px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-folder"></i> Visualizar Ofício Original</button>` : ''}
                <button onclick="if(typeof abrirModalRetornoSobrestamento==='function') abrirModalRetornoSobrestamento('${nupEsc}', 'externo');" class="btn-drive" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border: 1px solid #22c55e; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
            </div>
        `;
    } else if (podeAcaoFluxo) {
        if (statusLimpo === 'FAZER DESPACHO' || statusLimpo === 'FAZER CI') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(41, 128, 185, 0.12); border: 1px solid rgba(41, 128, 185, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #38bdf8; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;"><i class="ci ci-megaphone"></i> Ações de Fluxo (Despacho):</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="atualizarStatusExt(event, '${nupEsc}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: 1px solid #3b82f6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Realização do Despacho</button>
                        <button onclick="if(typeof abrirModalSobrestar==='function') abrirModalSobrestar('${nupEsc}', 'externo');" class="btn-drive" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; width: 100%; margin: 0; font-size: 13px; font-weight: 600; padding: 9px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                    </div>
                </div>
            `;
        } else if (statusLimpo === 'AGUARDANDO ASSINATURA') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #c084fc; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">✍️ Ações de Fluxo (Assinatura):</div>
                    <button onclick="atualizarStatusExt(event, '${nupEsc}', 'FINALIZADO')" class="btn-drive" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: 1px solid #8b5cf6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Assinatura Realizada</button>
                </div>
            `;
        }
    }

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-header">
            <div class="preview-info-tag-and-status">
                <span class="modal-detail-module-tag modal-detail-tag-externo"><i class="ci ci-building"></i> Ofício Externo</span>
                <span class="modal-detail-status-value modal-detail-status-externo">${statusStr}</span>
            </div>
            <h3 class="preview-info-nup-title">${nupDisplay}</h3>
        </div>

        ${toggleBtn}

        <div class="preview-info-card">
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-building"></i></span><div><strong>Remetente / Órgão:</strong> ${linha['REMETENTE'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-calendar"></i></span><div><strong>Recebimento:</strong> ${linha['DATA DE RECEBIMENTO'] || linha['DATA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-doc"></i></span><div><strong>Assunto / Referência:</strong> ${linha['ASSUNTO'] || linha['REFERÊNCIA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-clock"></i></span><div><strong>Prazo:</strong> ${linha['PRAZO'] ? linha['PRAZO'] + ' dias' : '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-user"></i></span><div><strong>Responsável:</strong> <span style="color: #2dd4bf; font-weight: 600;">${linha['TÉCNICO/ADMIN'] || linha['TÉCNICO'] || 'Não atribuído'}</span></div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-building"></i></span><div><strong>Gerência / Setor:</strong> ${linha['GERÊNCIA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-doc"></i></span><div><strong>CAR:</strong> ${linha['CARMS'] || '-'}</div></div>
        </div>

        ${htmlObs}

        <div id="preview-ext-timeline-container" style="margin-top: 15px;"></div>

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
        renderizarLinhaTempoSistema(linha['NUP'], 'preview-ext-timeline-container');
    }
}


function anexarDocumentoExt(event, nup) {
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
                        modulo: 'externos',
                        nup: nup,
                        username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
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
                acao: "upload", 
                nup: nup, 
                fileName: `Resposta_Externo_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64, 
                url: gcsUri,
                linkGcs: gcsUri,
                tipo_oficio: "externo", 
                username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || '' 
            };
            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('Resposta anexada com sucesso no Google Cloud Storage (LGPD)!', 'success');
                const linkFinal = gcsUri || resultado.url;
                const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DA RESPOSTA'] = linkFinal;
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

        btn.innerHTML = '⏳ A enviar com segurança (LGPD)...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            let gcsUri = null;
            if (typeof GCSStorage !== 'undefined') {
                try {
                    const gcsRes = await GCSStorage.fazerUpload(file, {
                        modulo: 'externos',
                        nup: nup,
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
                acao: "anexar_pdf_original_externo", 
                nup: nup, 
                fileName: `Oficio_Externo_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64,
                url: gcsUri,
                linkGcs: gcsUri,
                username: usuarioAtivo.username || ''
            };
            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('PDF Original anexado com sucesso no Google Cloud Storage (LGPD)!', 'success');
                const linkFinal = gcsUri || resultado.url;
                const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DO NUP'] = linkFinal;
                    target['LINK-NUP'] = linkFinal;
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
        const payload = { acao: "remover_resposta", nup: nup, username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || '' };
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
    const conf = decisao === 'APROVADO' ? { titulo: 'Aprovar', textoBotao: '<i class="ci ci-check"></i> Aprovar', corBotao: '#27ae60' } : { titulo: 'Reprovar', textoBotao: '<i class="ci ci-close"></i> Reprovar', corBotao: '#c0392b', exigeMotivo: true };
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
                target['STATUS'] = (decisao === 'APROVADO') ? "FAZER DESPACHO" : "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
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

    const m = document.getElementById('atribuirTecnicoExternoModal');
    if (m) {
        m.style.zIndex = '2000';
        m.style.display = 'flex';
    }
}

function fecharModalAtribuirTecnicoExterno() {
    document.getElementById('atribuirTecnicoExternoModal').style.display = 'none';
}

async function salvarStatusManualExterno(event, nup) {
    if (event) event.preventDefault();
    const select = document.getElementById(`changeStatusSelectExt-${nup}`);
    const novoStatus = select ? select.value : '';
    if (!novoStatus) return;

    const btn = document.getElementById(`btnSalvarStatusExt-${nup}`) || (event && event.target);
    const txtOriginal = btn ? btn.innerHTML : 'Salvar';
    if (btn) { btn.innerHTML = '⏳ ...'; btn.disabled = true; }

    // Optimistic Update
    const ref = dadosExternosGlobais.find(a => a['NUP'] === nup);
    let statusOriginal = '';
    if (ref) {
        statusOriginal = ref['STATUS'];
        ref['STATUS'] = novoStatus;
        if (ref['STATUS ATUAL']) ref['STATUS ATUAL'] = novoStatus;
    }

    mostrarToast('Status alterado localmente. Sincronizando...', 'success');
    filtrarExternos();
    atualizarCacheExternos();
    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Atualiza badge de status no preview se aberto
    const badgePreview = document.querySelector('#previewInfoContent .modal-detail-status-externo');
    if (badgePreview) badgePreview.textContent = novoStatus;

    try {
        const resultado = await executarAcaoGAS({
            acao: "alterar_status_manual_generico",
            tipoAba: "externo",
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
        console.error('Erro ao alterar status externo:', e);
        mostrarToast('Falha na sincronização ao alterar status. (Revertendo)', 'error');
        if (ref) {
            ref['STATUS'] = statusOriginal;
            if (ref['STATUS ATUAL']) ref['STATUS ATUAL'] = statusOriginal;
        }
        filtrarExternos();
        atualizarCacheExternos();
        if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
        if (badgePreview) badgePreview.textContent = statusOriginal;
    } finally {
        if (btn) { btn.innerHTML = txtOriginal; btn.disabled = false; }
    }
}
window.salvarStatusManualExt = salvarStatusManualExterno;

async function salvarAtribuicaoTecnicoExterno() {
    const nup = document.getElementById('atrExternoNup').value;
    const tecnico = document.getElementById('atrExternoTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico para atribuir.', 'error'); return; }

    const btn = document.getElementById('btnSalvarAtribuicaoExterno');
    const txtOriginal = btn ? btn.innerHTML : 'Salvar Distribuição';
    if (btn) { btn.innerHTML = '⏳ Preparando...'; btn.disabled = true; }

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
        const stBadge = infoContent.querySelector('.modal-detail-status-externo');
        if (stBadge) stBadge.textContent = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }

    if (btn) { btn.innerHTML = txtOriginal; btn.disabled = false; }

    try {
        const payload = { acao: "atribuir_tecnico_externo", nup: nup, tecnico: tecnico };
        const resultado = await executarAcaoGAS(payload);

        if (resultado.status === 'success') {
            mostrarToast('Distribuição confirmada na nuvem com sucesso!', 'success');
            if (procRef && resultado.dataDistribuicao) {
                procRef['DATA DE REPASSE'] = resultado.dataDistribuicao;
                atualizarCacheExternos();
            }
        } else {
            throw new Error(resultado.message);
        }
    } catch (e) {
        console.error('Erro ao atribuir técnico externo:', e);
        mostrarToast('Falha na internet ao atribuir técnico. (Revertendo)', 'error');
        if (procRef) {
            procRef['TÉCNICO/ADMIN'] = tecnicoOriginal;
            procRef['STATUS'] = statusOriginal;
            procRef['DATA DE REPASSE'] = dataRepasseOriginal;
        }
        filtrarExternos();
        atualizarCacheExternos();
        if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
    }
}

/**
 * Realiza a transição de status dos Ofícios Externos (Fazer Despacho / Confirmar Assinatura)
 */
async function atualizarStatusExt(event, nup, novoStatus) {
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
            acao: "atualizar_status_ci", // abasProcessos no script inclui abaExternos!
            nup: nup,
            novoStatus: novoStatus,
            username: (usuarioAtivo && usuarioAtivo.username) ? usuarioAtivo.username : ''
        };

        const resultado = await executarAcaoGAS(payload);
        if (resultado.status === 'success') {
            mostrarToast('Status atualizado com sucesso!', 'success');

            const target = dadosExternosGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS'] = novoStatus;
                if (target['STATUS ATUAL']) target['STATUS ATUAL'] = novoStatus;
            }
            atualizarCacheExternos();
            filtrarExternos();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

            // Atualiza os badges globais
            if (typeof atualizarBadgesNotificacao === 'function') atualizarBadgesNotificacao(dadosCoringa);

            // Se o preview estiver aberto, recarrega com o novo status
            const prev = document.getElementById('previewModal');
            if (prev && prev.style.display === 'flex' && target) {
                const linkExt = target['LINK'] || target['LINK_OFICIO'] || target['LINK_RESPOSTA'] || '';
                abrirPreviewExterno(linkExt, target);
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

let subAbaExternosAtiva = 'Geral';
let subAbaExternosRevisaoAtiva = 'Geral';

/**
 * Define a sub-aba de setor ativa para Ofícios Externos e atualiza os filtros
 */
function setSubAbaExternos(aba) {
    subAbaExternosAtiva = aba;
    const container = document.getElementById('mini-tabs-externos');
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (btn.textContent === aba) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    filtrarExternos();
}

/**
 * Define a sub-aba de revisão ativa para Ofícios Externos e atualiza os filtros
 */
function setSubAbaExternosRevisao(aba) {
    subAbaExternosRevisaoAtiva = aba;
    const container = document.getElementById('mini-tabs-externos-revisao');
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (btn.textContent === aba) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    filtrarExternos();
}

if (typeof configurarDragAndDrop === 'function') {
    configurarDragAndDrop('cadExtArquivo', 'cadExternoArquivoLabel', updateFileNameExterno);
}