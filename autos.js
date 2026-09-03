// ============================================================================
// AUTOS DE INFRAÇÃO
// ============================================================================
const opcoesAutoSetor = ["GCAR", "GEAA", "DIFLOR"];
const opcoesAutoStatus = [
    "AGUARDANDO DISTRIBUIÇÃO",
    "AGUARDANDO MANIFESTAÇÃO",
    "REVISÃO",
    "FAZER DESPACHO",
    "CONCLUIDO"
];
const opcoesAutoTipo = ["AUTO DE INFRAÇÃO", "CONTRADITA", "MANIFESTAÇÃO"];

let dadosAutosGlobais = [];
let autosPicker = null;
let autosCarregados = false;
let autoSelecionadoMockup = null;

function atualizarCacheAutos() {
    const keyAutos = `corino_cache_dados_autos_v3`;
    localStorage.setItem(keyAutos, JSON.stringify(dadosAutosGlobais));
    if (typeof window.limparCacheHistoricoGlobal === 'function') window.limparCacheHistoricoGlobal();
}

function updateFileNameAuto(input) {
    const label = document.getElementById('cadAutoArquivoLabel');
    const textSpan = label.querySelector('.upload-text');
    if (input.files && input.files.length > 0) {
        textSpan.innerHTML = `<strong>Ficheiro selecionado:</strong><br>${input.files[0].name}`;
        label.classList.add('has-file');
    } else {
        textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
        label.classList.remove('has-file');
    }
}

function popularOpcoesAuto() {
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
    let listaTecnicosAuto = (typeof opcoesAutoTecnico !== 'undefined' && Array.isArray(opcoesAutoTecnico)) ? [...opcoesAutoTecnico] : [];
    if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
        listaTecnicosAuto = listaTecnicosAuto.filter(tec => {
            const t = tec.trim().toUpperCase();
            return MAPA_TECNICOS_SETORES[t] === usuarioAtivo.setor;
        });
    }

    preencherSelect('cadAutoSetor', opcoesAutoSetor, '-- Selecione o Setor --');
    preencherSelect('cadAutoStatus', opcoesAutoStatus);
    preencherSelect('cadAutoTipo', opcoesAutoTipo);
    preencherSelect('cadAutoTecnico', listaTecnicosAuto, '-- Sem Técnico --');

    // Filtros
    const preencherMultiselect = (idBase, arrayValores) => {
        const dropdown = document.getElementById(`dd-${idBase}`);
        const display = document.getElementById(`ms-${idBase}`);
        if (!dropdown || !display) return;

        const placeholderText = display.getAttribute('data-placeholder');
        dropdown.innerHTML = '';

        let opTodos = document.createElement('div');
        opTodos.className = 'ms-option';
        opTodos.innerHTML = `<input type="checkbox" value="todos" id="chk-${idBase}-todos"> <label for="chk-${idBase}-todos">-- Todos --</label>`;
        dropdown.appendChild(opTodos);

        arrayValores.forEach((val, i) => {
            let op = document.createElement('div');
            op.className = 'ms-option';
            op.innerHTML = `<input type="checkbox" value="${val}" id="chk-${idBase}-${i}"> <label for="chk-${idBase}-${i}">${val}</label>`;
            dropdown.appendChild(op);
        });

        dropdown.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            chk.addEventListener('change', () => {
                atualizarDisplayNativo(idBase, placeholderText);
                filtrarAutos();
            });
        });

        atualizarDisplayNativo(idBase, placeholderText);
    };

    preencherMultiselect('autoTecnico', listaTecnicosAuto);
    preencherMultiselect('autoStatus', opcoesAutoStatus);
    preencherMultiselect('autoSetor', opcoesAutoSetor);
}

function abrirModalCadastroAuto() {
    document.getElementById('cadastroAutoModal').style.display = 'flex';
    popularOpcoesAuto();
    if (usuarioAtivo && usuarioAtivo.setor && usuarioAtivo.setor !== 'S/G') {
        const selectSetor = document.getElementById('cadAutoSetor');
        if (selectSetor) selectSetor.value = usuarioAtivo.setor;
    }
    if (!autosPicker) {
        autosPicker = flatpickr("#cadAutoData", {
            locale: "pt",
            dateFormat: "d/m/Y",
            allowInput: true
        });
    }
    autosPicker.setDate(new Date());
}

function fecharModalCadastroAuto() {
    document.getElementById('cadastroAutoModal').style.display = 'none';
    if (typeof fecharModalCadastroUnificado === 'function') fecharModalCadastroUnificado();
    ['cadAutoNup', 'cadAutoRequerente', 'cadAutoInfracao', 'cadAutoLaudo', 'cadAutoNotificacao', 'cadAutoData', 'cadAutoFisicoEms', 'cadAutoArquivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const label = document.getElementById('cadAutoArquivoLabel');
    if (label) {
        label.classList.remove('has-file');
        const textSpan = label.querySelector('.upload-text');
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
    }
}

function renderTabelaAutos(dados) {
    const container = document.getElementById('lista-autos-container');
    const cont = document.getElementById('contador-autos');
    if (!container) return;

    const leftPanelEl = document.getElementById('left-panel-autos-inbox');
    const savedLeftScrollTop = leftPanelEl ? leftPanelEl.scrollTop : 0;

    const rightPanelEl = document.getElementById('right-panel-detalhes-autos');
    const savedRightScrollTop = rightPanelEl ? rightPanelEl.scrollTop : 0;

    const savedWindowScrollY = window.scrollY;

    container.innerHTML = '';

    if (!dados || dados.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: #888; background-color: #1a1a1a; border-radius: 8px; border: 1px solid #333;">Nenhum auto de infração encontrado.</div>';
        cont.innerText = 'Exibindo 0 resultados.';
        return;
    }

    cont.innerText = `Exibindo ${dados.length} resultados.`;

    if (!autoSelecionadoMockup && dados.length > 0) {
        autoSelecionadoMockup = dados[0];
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '20px';
    container.style.alignItems = 'flex-start';

    const leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel-autos-inbox';
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
    rightPanel.id = 'right-panel-detalhes-autos';
    rightPanel.style.width = '65%';
    rightPanel.style.backgroundColor = '#1a1a1a';
    rightPanel.style.border = '1px solid var(--card-border)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '25px';
    rightPanel.style.position = 'sticky';
    rightPanel.style.top = '20px';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.animation = rightPanelEl ? 'none' : 'fadeInSlideUp 0.4s ease-out forwards';

    dados.forEach((r, index) => {
        const isSelected = autoSelecionadoMockup && autoSelecionadoMockup['NUP'] === r['NUP'];
        const item = document.createElement('div');
        item.style.backgroundColor = isSelected ? 'rgba(46, 204, 113, 0.1)' : '#1a1a1a';
        item.style.border = isSelected ? '1px solid var(--primary-green)' : '1px solid #333';
        item.style.borderRadius = '6px';
        item.style.padding = '12px 15px';
        item.style.cursor = 'pointer';
        item.style.transition = 'all 0.2s';

        item.onmouseenter = () => { if (!isSelected) item.style.backgroundColor = '#222'; };
        item.onmouseleave = () => { if (!isSelected) item.style.backgroundColor = '#1a1a1a'; };
        item.onclick = () => {
            autoSelecionadoMockup = r;
            renderTabelaAutos(dados);
        };

        const status = (r['STATUS ATUAL'] || '').toUpperCase();
        let dotColor = '#888';
        if (status === 'AGUARDANDO MANIFESTAÇÃO') dotColor = '#f39c12';
        else if (status === 'REVISÃO') dotColor = '#3498db';
        else if (status === 'CONCLUIDO') dotColor = '#27ae60';

        item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <div style="font-size: 14px; font-weight: bold; color: ${isSelected ? 'var(--primary-green)' : '#fff'};">${r['NUP'] || '-'}</div>
                <div style="width: 10px; height: 10px; border-radius: 50%; background-color: ${dotColor};" title="${status}"></div>
            </div>
            <div style="font-size: 12px; color: #aaa; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r['REQUERENTE'] || '-'}</div>
            <div style="font-size: 11px; color: #777;">Téc: ${r['TÉCNICO'] || 'Não atribuído'}</div>
        `;
        leftPanel.appendChild(item);
    });

    if (autoSelecionadoMockup) {
        const s = autoSelecionadoMockup;
        const status = (s['STATUS ATUAL'] || '').toUpperCase();
        const linkResposta = s['LINK DA RESPOSTA'] || s['LINK RESPOSTA'] || s['LINK_RESPOSTA'] || '';
        const temResposta = linkResposta && linkResposta.trim() !== '' && linkResposta.trim() !== '-';
        const statusResp = (s['STATUS-RESPOSTA'] || s['STATUS DA RESPOSTA'] || '').toUpperCase();

        const isGestor = usuarioAtivo && (typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
        const isTecnico = usuarioAtivo && usuarioAtivo.perfil === 'tecnico';

        let linkPreviewBtn = '';
        if (s['LINK NUP'] && String(s['LINK NUP']).trim() !== '' && String(s['LINK NUP']).trim() !== '-') {
            linkPreviewBtn = `<button onclick="abrirPreviewAuto(event, '${s['LINK NUP']}', '${s['NUP']}')" class="btn-preview-action" style="padding: 8px 15px; font-size: 13px; background-color: rgba(46, 204, 113, 0.1); border-color: var(--primary-green); color: var(--primary-green); font-weight: bold;">👁️ Abrir PDF do Processo (LGPD)</button>`;
        }

        let actionButtons = '';
        let htmlResposta = '';

        if (temResposta) {
            let botaoResp = '';
            if (isLinkGCS(linkResposta)) {
                botaoResp = `<button onclick="abrirPreviewAuto(event, '${linkResposta}', '${s['NUP']}')" class="btn-drive btn-orange-outline" style="width: auto; padding: 10px 20px; font-size: 14px; margin: 0;"><i class="ci ci-eye"></i> Ver Resposta (LGPD)</button>`;
            } else {
                const respId = extrairIdDrive(linkResposta);
                if (respId) {
                    const respPrev = `https://drive.google.com/file/d/${respId}/preview`;
                    botaoResp = `<button onclick="abrirPreviewAuto(event, '${respPrev}', '${s['NUP']}')" class="btn-drive btn-orange-outline" style="width: auto; padding: 10px 20px; font-size: 14px; margin: 0;"><i class="ci ci-eye"></i> Ver Resposta</button>`;
                } else {
                    botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive btn-orange-outline" style="width: auto; padding: 10px 20px; font-size: 14px; margin: 0; display: inline-flex; align-items: center; justify-content: center; text-decoration: none;"><i class="ci ci-external"></i> Abrir Resposta</a>`;
                }
            }

            let btnRetirar = '';
            if (usuarioAtivo && (isTecnico || isGestor)) {
                const isAprovado = statusResp === 'APROVADO';
                if (!isGestor && isAprovado) {
                    btnRetirar = `<div style="padding: 8px 12px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px; font-weight: bold; border-radius: 4px;">🔒 Aprovado</div>`;
                } else {
                    btnRetirar = `<button onclick="removerDocumentoAuto(event, '${s['NUP']}')" class="btn-drive btn-red-outline" style="width: auto; padding: 10px 20px; font-size: 14px; margin: 0;"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
                }
            }

            let htmlMotivoReprovacao = '';
            const motivo = s['MOTIVO DA AVALIAÇÃO'] || s['MOTIVO_AVALIACAO'] || '';
            if (statusResp === 'REPROVADO' && motivo) {
                htmlMotivoReprovacao = `<div style="margin-top: 10px; padding: 10px; background-color: rgba(231, 76, 60, 0.1); border-left: 4px solid #e74c3c; color: #ffcccc; font-size: 13px; border-radius: 4px; grid-column: span 2;"><strong>Motivo da Reprovação:</strong><br>${motivo}</div>`;
            }

            htmlResposta = `
                <div style="margin: 20px 0 0 0; padding: 15px; background-color: rgba(140, 86, 51, 0.05); border: 1px solid rgba(140, 86, 51, 0.3); border-radius: 6px; grid-column: span 2;">
                    <div style="color: #e67e22; font-weight: bold; margin-bottom: 10px; font-size: 13px;">📁 Manifestação/Resposta Técnica:</div>
                    <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
                        ${botaoResp}
                        ${btnRetirar}
                    </div>
                    ${htmlMotivoReprovacao}
                </div>
            `;
        }

        const tecAuto = (s['TÉCNICO'] || '').trim().toUpperCase();
        const setorAuto = (typeof MAPA_TECNICOS_SETORES !== 'undefined' && MAPA_TECNICOS_SETORES[tecAuto]) ? MAPA_TECNICOS_SETORES[tecAuto] : 'GCAR';
        const podeAvaliarAuto = (typeof window.podeAvaliarManifestacao === 'function') ? window.podeAvaliarManifestacao(setorAuto) : isGestor;
        const podeAdmAuto = (typeof window.podeConfeccionarDespachoOuCI === 'function') ? window.podeConfeccionarDespachoOuCI(setorAuto) : isGestor;
        const podeRedistAuto = (typeof window.podeRedistribuirTecnico === 'function') ? window.podeRedistribuirTecnico(setorAuto) : isGestor;

        if (status === 'AGUARDANDO MANIFESTAÇÃO' && !temResposta && isTecnico) {
            actionButtons = `<button class="btn-drive btn-upload" style="width: auto; padding: 10px 20px; font-size: 14px; margin: 0;" onclick="anexarDocumentoAuto(event, '${s['NUP']}')">📎 Enviar Resposta</button>`;
        } else if (status === 'REVISÃO' && podeAvaliarAuto && temResposta && statusResp !== 'APROVADO' && statusResp !== 'REPROVADO') {
            actionButtons = `
                <button class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; width: auto; padding: 10px 20px; font-size: 14px; margin: 0;" onclick="avaliarRespostaAuto(event, '${s['NUP']}', 'APROVADO')"><i class="ci ci-check"></i> Aprovar</button>
                <button class="btn-drive" style="background-color: #c0392b; border-color: #a93226; width: auto; padding: 10px 20px; font-size: 14px; margin: 0;" onclick="avaliarRespostaAuto(event, '${s['NUP']}', 'REPROVADO')"><i class="ci ci-close"></i> Reprovar</button>
            `;
        }

        let htmlDiretoriaBotoes = '';
        const isSemTecnico = !s['TÉCNICO'] || s['TÉCNICO'] === '-' || s['TÉCNICO'] === 'S/T' || s['TÉCNICO'] === 'Sem Técnico' || s['TÉCNICO'] === 'Não atribuído' || s['TÉCNICO'].trim() === '';

        if (podeRedistAuto) {
            if (isSemTecnico) {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnico('${s['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Distribuir / Atribuir Técnico</button>`;
            } else {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnico('${s['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Redistribuir Técnico</button>`;
            }
        }

        if (podeAdmAuto) {
            const statusGeralFormatado = status.replace(/\./g, '').trim().toUpperCase();
            if (statusGeralFormatado === 'FAZER DESPACHO') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(41, 128, 185, 0.08); border: 1px solid rgba(41, 128, 185, 0.3); border-radius: 6px;">
                        <strong style="color: #2980b9; font-size: 13px; display: block; margin-bottom: 10px;">📋 Ações de Fluxo (Despacho):</strong>
                        <div style="display: flex; gap: 10px; flex-direction: column;">
                            <button onclick="atualizarStatusAuto(event, '${s['NUP']}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background-color: #2980b9; border-color: #1c5986; color: white; margin: 0; font-size: 14px;">✅ Confirmar Realização do Despacho</button>
                            <button onclick="if(typeof abrirModalSobrestar==='function') abrirModalSobrestar('${s['NUP']}', 'auto');" class="btn-drive" style="background-color: #f39c12; border-color: #d68910; color: #111; font-weight: bold; margin: 0; font-size: 14px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                        </div>
                    </div>
                `;
            } else if (statusGeralFormatado === 'SOBRESTADO') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.4); border-radius: 6px;">
                        <strong style="color: #f39c12; font-size: 13px; display: block; margin-bottom: 8px;">⏸️ Processo Sobrestado (Encaminhado para: ${s['SOBRESTADO_SETOR'] || 'Setor Externo'})</strong>
                        ${s['SOBRESTADO_MOTIVO'] ? `<div style="font-size: 12px; color: #ccc; margin-bottom: 12px;"><strong>Motivo:</strong> ${s['SOBRESTADO_MOTIVO']}</div>` : ''}
                        <button onclick="if(typeof abrirModalRetornoSobrestamento==='function') abrirModalRetornoSobrestamento('${s['NUP']}', 'auto');" class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; color: white; width: 100%; margin: 0; font-size: 14px; font-weight: bold;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
                    </div>
                `;
            } else if (statusGeralFormatado === 'AGUARDANDO ASSINATURA') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(142, 68, 173, 0.08); border: 1px solid rgba(142, 68, 173, 0.3); border-radius: 6px;">
                        <strong style="color: #8e44ad; font-size: 13px; display: block; margin-bottom: 10px;">📋 Ações de Fluxo (Assinatura):</strong>
                        <button onclick="atualizarStatusAuto(event, '${s['NUP']}', 'FINALIZADO')" class="btn-drive" style="background-color: #8e44ad; border-color: #6c3483; color: white; width: 100%; margin: 0; font-size: 14px;">✍️ Confirmar Assinatura Realizada</button>
                    </div>
                `;
            }
        }

        if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR')) {
            let optionsHtml = opcoesAutoStatus.map(st => `<option value="${st}" ${st === status ? 'selected' : ''}>${st}</option>`).join('');
            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;"><i class="ci ci-settings"></i> GESTÃO DE STATUS (DIRETORIA)</div>
                    <div style="display: flex; gap: 8px;">
                        <select id="changeStatusSelect-${s['NUP']}" style="flex: 1; padding: 8px; background-color: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 13px; outline: none; height: 38px;">
                            ${optionsHtml}
                        </select>
                        <button onclick="salvarStatusManualAuto(event, '${s['NUP']}')" id="btnSalvarStatus-${s['NUP']}" class="btn-drive btn-blue" style="width: auto; padding: 8px 15px; margin: 0; font-size: 13px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">Alterar</button>
                    </div>
                </div>
            `;
        }

        let htmlDossieAuto = '';
        if (s['MANIFESTACAO_PRELIMINAR']) {
            htmlDossieAuto += `<div style="background-color: #1a252f; border: 1px solid #2c3e50; border-radius: 6px; padding: 10px; margin-top: 10px;"><div style="color: #00fa9a; font-weight: bold; margin-bottom: 5px; font-size: 13px;">📄 Manifestação Preliminar Aprovada (Sobrestamento)</div><button onclick="abrirPreviewAuto(event, '${s['MANIFESTACAO_PRELIMINAR']}', '${s['NUP']}')" class="btn-drive btn-orange-outline" style="width: auto; padding: 5px 12px; font-size: 12px; margin: 0;"><i class="ci ci-eye"></i> Ver Arquivo</button></div>`;
        }
        if (s['LINK_PARECER_EXTERNO']) {
            htmlDossieAuto += `<div style="background-color: #1a252f; border: 1px solid #2c3e50; border-radius: 6px; padding: 10px; margin-top: 10px;"><div style="color: #00fa9a; font-weight: bold; margin-bottom: 5px; font-size: 13px;">🏛️ Parecer do Setor Externo</div><button onclick="abrirPreviewAuto(event, '${s['LINK_PARECER_EXTERNO']}', '${s['NUP']}')" class="btn-drive btn-orange-outline" style="width: auto; padding: 5px 12px; font-size: 12px; margin: 0;"><i class="ci ci-eye"></i> Ver Parecer</button></div>`;
        }
        if (htmlDossieAuto !== '') {
            htmlDossieAuto = `<div style="margin-top: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;">📚 Dossiê de Documentos</strong>${htmlDossieAuto}</div>`;
        }

        rightPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                <div><div style="font-size: 24px; font-weight: bold; color: #fff; margin-bottom: 5px;">${s['NUP']}</div><div style="font-size: 16px; color: #ccc;">${s['REQUERENTE']}</div></div>
                <div style="text-align: right;"><div style="background-color: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: #eee; display: inline-block; margin-bottom: 5px;">${s['TIPO'] || '-'}</div><div style="color: var(--primary-green); font-size: 14px; font-weight: bold;">${status}</div></div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">AUTO DE INFRAÇÃO</div><div style="font-size: 14px; color: #fff; font-weight: 500; word-break: break-word;">${s['AUTO DE INFRAÇÃO'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">LAUDO DE CONSTATAÇÃO</div><div style="font-size: 14px; color: #fff; font-weight: 500; word-break: break-word;">${s['LAUDO DE CONSTATAÇÃO'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">TÉCNICO RESPONSÁVEL</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['TÉCNICO'] || '-'}</div></div>
                <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;"><div style="font-size: 11px; color: #888; margin-bottom: 4px;">FORMATO DO PROCESSO</div><div style="font-size: 14px; color: #fff; font-weight: 500;">${s['FISICO/E-MS'] || '-'}</div></div>
                ${htmlResposta}
            </div>
            ${s['OBSERVAÇÕES'] ? `<div class="modal-obs" style="margin: 0 0 20px 0;"><strong>Observações:</strong><br>${s['OBSERVAÇÕES']}</div>` : ''}
            ${htmlDossieAuto}
            <div id="timeline-container-auto" style="margin-top: 25px; margin-bottom: 25px;"></div>
            <div style="display: flex; gap: 15px; margin-top: auto; padding-top: 20px; border-top: 1px solid #333;">
                ${linkPreviewBtn}
                <div style="flex-grow: 1; display: flex; justify-content: flex-end; gap: 10px;">
                    ${actionButtons}
                </div>
            </div>
            ${htmlDiretoriaBotoes}
        `;
    }
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);

    if (autoSelecionadoMockup) {
        renderizarLinhaTempoSistema(autoSelecionadoMockup['NUP'], 'timeline-container-auto');
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

async function abrirPreviewAuto(arg1, arg2, arg3) {
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

    const listaAutos = (typeof dadosAutosGlobais !== 'undefined' ? dadosAutosGlobais : (typeof dadosAutos !== 'undefined' ? dadosAutos : []));

    // Se temos a linha (objeto), extrai o NUP
    if (linha && linha['NUP']) {
        nup = linha['NUP'];
    }

    // Se não temos a linha mas temos o NUP
    if (!linha && nup && typeof nup === 'string' && nup !== '-') {
        const nupBusca = nup.trim().toUpperCase();
        const nupSemPdf = nupBusca.replace(/\.PDF$/i, '');
        linha = listaAutos.find(x => {
            const n = String(x['NUP'] || '').trim().toUpperCase();
            return n === nupBusca || n.replace(/\.PDF$/i, '') === nupSemPdf;
        });
    }

    // Se ainda não temos a linha mas temos URL, pesquisa por correspondência no dossiê
    if (!linha && url) {
        const urlStr = String(url).trim();
        const driveId = typeof extrairIdDrive === 'function' ? extrairIdDrive(urlStr) : null;
        linha = listaAutos.find(x => {
            const campos = [
                x['LINK NUP'], x['LINK DO NUP'], x['LINK-NUP'], x['LINK'],
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
    if (typeof nupOriginal === 'string' && (nupOriginal.startsWith('http') || nupOriginal.includes('/'))) {
        nupOriginal = '-';
    }
    const nupDisplay = typeof limparNupDisplay === 'function' ? limparNupDisplay(nupOriginal) : String(nupOriginal).replace(/\.pdf$/gi, '');
    const nupFormatado = String(nupOriginal).replace(/[^a-zA-Z0-9]/g, '_');
    const nupEsc = typeof escaparParaAtributo === 'function' ? escaparParaAtributo(nupOriginal) : nupOriginal;

    const iconeOlhoGrande = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fb923c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-wrapper" id="preview-wrapper-id">
            <div class="preview-toolbar">
                <div class="preview-toolbar-title">
                    ${iconeOlhoGrande}
                    <span class="modal-detail-module-tag modal-detail-tag-auto" style="margin-right: 8px;"><i class="ci ci-scale"></i> Auto de Infração</span>
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
    const linkDrive = linha ? (linha['LINK NUP'] || linha['LINK-NUP'] || linha['LINK DO NUP'] || linha['LINK_NUP'] || '') : (url || '');
    let principalPreviewUrl = (linkDrive && linkDrive.trim() !== '' && linkDrive.trim() !== '-') ? linkDrive : '';
    let preliminarPreviewUrl = linha ? (linha['MANIFESTACAO_PRELIMINAR'] && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '' && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '-' ? linha['MANIFESTACAO_PRELIMINAR'] : '') : '';
    let parecerPreviewUrl = linha ? (linha['LINK_PARECER_EXTERNO'] && linha['LINK_PARECER_EXTERNO'].trim() !== '' && linha['LINK_PARECER_EXTERNO'].trim() !== '-' ? linha['LINK_PARECER_EXTERNO'] : '') : '';

    const statusStr = String(linha ? (linha['STATUS ATUAL'] || linha['STATUS'] || 'AGUARDANDO DISTRIBUIÇÃO') : '').toUpperCase();
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
        if (typeof obterLinkDownloadSeguro === 'function' && urlAtual) downloadUrl = await obterLinkDownloadSeguro(urlAtual, `Auto_${nupFormatado}.pdf`);
    } catch (e) {
        console.warn('Erro ao resolver link seguro do Auto:', e);
    }

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) btnDownload.href = downloadUrl;
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) btnOpenPreview.href = previewUrl;
    const previewFrame = document.getElementById('previewFrame');
    if (previewFrame) previewFrame.src = previewUrl;

    if (!linha) {
        const previewInfoEl = document.getElementById('previewInfoContent');
        if (previewInfoEl) previewInfoEl.innerHTML = `<div class="preview-info-card"><div class="preview-info-item">📄 Visualizando Auto de Infração: <strong>${nupDisplay}</strong></div></div>`;
        modal.style.display = 'flex'; const infoPanel = document.getElementById('previewInfo'); if (infoPanel) infoPanel.scrollTop = 0;
        return;
    }

    const obs = (linha['OBSERVAÇÃO'] || linha['OBSERVAÇÕES'] || '').trim();
    const htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="preview-info-obs"><strong>📋 Observação:</strong><br>${obs}</div>` : '';

    let docsDisponiveis = [];
    if (principalPreviewUrl) docsDisponiveis.push({ label: '📜 Processo Original', url: principalPreviewUrl });
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
            botoesAcoesHtml += `<button onclick="removerDocumentoAuto(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-danger" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
        } else if (isTecnico || isGestor) {
            botoesAcoesHtml += `<button onclick="anexarDocumentoAuto(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
        }
    }

    if (isGestor) {
        const tec = linha['TÉCNICO'] || '';
        const isSemTecnico = !tec || tec === '-' || tec === 'S/T' || tec === 'Não atribuído';
        const labelTec = isSemTecnico ? '<i class="ci ci-user"></i> Distribuir / Atribuir Técnico' : '<i class="ci ci-user"></i> Redistribuir Técnico';
        botoesAcoesHtml += `<button onclick="abrirModalAtribuirTecnico('${nupEsc}')" class="modal-detail-btn modal-detail-btn-gestao" style="width: 100%; margin-bottom: 8px;">${labelTec}</button>`;
    }

    let acoesRevisorHtml = '';
    const statusRespAval = (linha['STATUS-RESPOSTA'] || linha['STATUS DA RESPOSTA'] || '').toUpperCase();
    const tecAuto = (linha['TÉCNICO'] || '').trim().toUpperCase();
    const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecAuto] : null) || 'S/G';
    const podeAvaliar = usuarioAtivo && (usuarioAtivo.username === 'diflor' || (typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() && (usuarioAtivo.setor === 'DIFLOR' || setorInternoDoTecnico === usuarioAtivo.setor)));

    if (podeAvaliar && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && respPreviewUrl) {
        acoesRevisorHtml = `
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; margin-bottom: 8px;">
                <div style="color: #fbbf24; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">📋 Avaliação da Resposta (Revisor):</div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="avaliarRespostaAuto(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-check"></i> Aprovar</button>
                    <button onclick="avaliarRespostaAuto(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-close"></i> Reprovar</button>
                </div>
            </div>
        `;
    }

    let acoesStatusDiretoria = '';
    if (isGestor) {
        const opcoesAutoStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER DESPACHO", "SOBRESTADO", "REVISÃO", "AGUARDANDO ASSINATURA", "FINALIZADO", "TRAMITADO"];
        const optionsHtml = opcoesAutoStatus.map(st => `<option value="${st}" ${st === statusStr ? 'selected' : ''}>${st}</option>`).join('');
        acoesStatusDiretoria = `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px; font-weight: 700;"><i class="ci ci-settings"></i> GESTÃO DE STATUS</div>
                <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box; align-items: center;">
                    <select id="changeStatusSelectAuto-${nupEsc}" style="flex: 1; min-width: 0; padding: 6px 10px; background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12px; outline: none; height: 36px; box-sizing: border-box;">
                        ${optionsHtml}
                    </select>
                    <button onclick="salvarStatusManualAuto(event, '${nupEsc}')" id="btnSalvarStatusAuto-${nupEsc}" class="btn-drive btn-blue" style="flex-shrink: 0; width: auto; min-width: 70px; padding: 6px 12px; margin: 0; font-size: 12px; height: 36px; box-sizing: border-box;">Salvar</button>
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
                ${principalPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${principalPreviewUrl}', '${principalPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; width: 100%; margin-bottom: 8px; font-size: 12px; font-weight: 600; padding: 7px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-folder"></i> Visualizar Auto Original</button>` : ''}
                <button onclick="if(typeof abrirModalRetornoSobrestamento==='function') abrirModalRetornoSobrestamento('${nupEsc}', 'auto');" class="btn-drive" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border: 1px solid #22c55e; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
            </div>
        `;
    } else if (podeAcaoFluxo) {
        if (statusLimpo === 'FAZER DESPACHO') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(41, 128, 185, 0.12); border: 1px solid rgba(41, 128, 185, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #38bdf8; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;"><i class="ci ci-megaphone"></i> Ações de Fluxo (Despacho):</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="atualizarStatusAuto(event, '${nupEsc}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: 1px solid #3b82f6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Realização do Despacho</button>
                        <button onclick="if(typeof abrirModalSobrestar==='function') abrirModalSobrestar('${nupEsc}', 'auto');" class="btn-drive" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; width: 100%; margin: 0; font-size: 13px; font-weight: 600; padding: 9px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                    </div>
                </div>
            `;
        } else if (statusLimpo === 'AGUARDANDO ASSINATURA') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #c084fc; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">✍️ Ações de Fluxo (Assinatura):</div>
                    <button onclick="atualizarStatusAuto(event, '${nupEsc}', 'FINALIZADO')" class="btn-drive" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: 1px solid #8b5cf6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Assinatura Realizada</button>
                </div>
            `;
        }
    }

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-header">
            <div class="preview-info-tag-and-status">
                <span class="modal-detail-module-tag modal-detail-tag-auto"><i class="ci ci-scale"></i> Auto de Infração</span>
                <span class="modal-detail-status-value modal-detail-status-auto">${statusStr}</span>
            </div>
            <h3 class="preview-info-nup-title">${nupDisplay}</h3>
        </div>

        ${toggleBtn}

        <div class="preview-info-card">
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-user"></i></span><div><strong>Autuado / Requerente:</strong> ${linha['AUTUADO'] || linha['REQUERENTE'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon">⚖️</span><div><strong>Auto de Infração N.:</strong> ${linha['AUTO DE INFRAÇÃO'] || linha['AUTO_INFRACAO'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-calendar"></i></span><div><strong>Data:</strong> ${linha['DATA'] || linha['DATA AUTUAÇÃO'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-map"></i></span><div><strong>Município:</strong> ${linha['MUNICÍPIO'] || linha['LOCAL'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-doc"></i></span><div><strong>Referência:</strong> ${linha['REFERÊNCIA'] || linha['MOTIVO'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-clock"></i></span><div><strong>Prazo:</strong> ${linha['PRAZO'] ? linha['PRAZO'] + ' dias' : '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-user"></i></span><div><strong>Responsável:</strong> <span style="color: #fb923c; font-weight: 600;">${linha['TÉCNICO'] || 'Não atribuído'}</span></div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-building"></i></span><div><strong>Setor:</strong> ${linha['SETOR'] || 'GEAA'}</div></div>
        </div>

        ${htmlObs}

        <div id="preview-autos-timeline-container" style="margin-top: 15px;"></div>

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
        renderizarLinhaTempoSistema(linha['NUP'], 'preview-autos-timeline-container');
    }
}


function abrirModalAtribuirTecnico(nup) {
    const titleEl = document.getElementById('atribuirTecnicoModalTitle');
    if (titleEl) titleEl.innerText = '👤 Distribuir Auto';
    document.getElementById('atrAutoNup').value = nup;
    const select = document.getElementById('atrAutoTecnico');
    select.innerHTML = '';
    const elBlank = document.createElement('option');
    elBlank.value = ''; elBlank.textContent = '-- Selecione o Técnico --';
    select.appendChild(elBlank);
    opcoesAutoTecnico.forEach(opt => { const el = document.createElement('option'); el.value = opt; el.textContent = opt; select.appendChild(el); });
    
    const m = document.getElementById('atribuirTecnicoModal');
    if (m) {
        m.style.zIndex = '2000';
        m.style.display = 'flex';
    }
}

function fecharModalAtribuirTecnico() { 
    document.getElementById('atribuirTecnicoModal').style.display = 'none'; 
    document.getElementById('atrAutoNup').value = '';
    document.getElementById('atrAutoTecnico').value = '';
}

async function salvarStatusManualAuto(event, nup) {
    if (event) event.preventDefault();
    const select = document.getElementById(`changeStatusSelectAuto-${nup}`) || document.getElementById(`changeStatusSelect-${nup}`);
    if (!select) return;
    const novoStatus = select.value;
    if (!novoStatus) return;

    const btn = document.getElementById(`btnSalvarStatusAuto-${nup}`) || document.getElementById(`btnSalvarStatus-${nup}`) || (event && event.target);
    const txtOriginal = btn ? btn.innerHTML : 'Salvar';
    if (btn) { btn.innerHTML = '⏳ ...'; btn.disabled = true; }

    const autoRef = dadosAutosGlobais.find(x => x['NUP'] === nup);
    let statusOriginal = '';
    if (autoRef) {
        statusOriginal = autoRef['STATUS ATUAL'];
        autoRef['STATUS ATUAL'] = novoStatus;
        if (autoRef['DATA STATUS ATUAL'] !== undefined) {
            autoRef['DATA STATUS ATUAL'] = new Date().toLocaleString('pt-BR');
        }
        autoSelecionadoMockup = autoRef;
        atualizarCacheAutos();
    }

    mostrarToast('Status alterado localmente. Sincronizando...', 'success');
    filtrarAutos();
    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Atualiza badge no preview se aberto
    const badgePreview = document.querySelector('#previewInfoContent .modal-detail-status-auto');
    if (badgePreview) badgePreview.textContent = novoStatus;

    try {
        const payload = {
            acao: "alterar_status_manual_auto",
            nup: nup,
            novoStatus: novoStatus,
            username: (usuarioAtivo && usuarioAtivo.username) ? usuarioAtivo.username : 'sistema'
        };

        const resultado = await executarAcaoGAS(payload);

        if (resultado.status === 'success') {
            mostrarToast('Status atualizado com sucesso!', 'success');
        } else {
            throw new Error(resultado.message || 'Erro ao sincronizar status na nuvem.');
        }
    } catch (e) {
        console.error('Erro ao salvar status de auto:', e);
        mostrarToast('Falha ao sincronizar status na nuvem. (Revertendo)', 'error');
        if (autoRef) {
            autoRef['STATUS ATUAL'] = statusOriginal;
            atualizarCacheAutos();
            filtrarAutos();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
            if (badgePreview) badgePreview.textContent = statusOriginal;
        }
    } finally {
        if (btn) {
            btn.innerHTML = txtOriginal;
            btn.disabled = false;
        }
    }
}

async function salvarAtribuicaoTecnico() {
    const nup = document.getElementById('atrAutoNup').value;
    if (nup && nup.startsWith('__CARTA__')) {
        await salvarAtribuicaoTecnicoCarta();
        return;
    }
    const tecnico = document.getElementById('atrAutoTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico para atribuir.', 'error'); return; }

    const btn = document.getElementById('btnSalvarAtribuicao');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    // OPTIMISTIC UPDATE
    const autoRef = dadosAutosGlobais.find(a => a['NUP'] === nup);
    let tecnicoOriginal = '';
    let statusOriginal = '';

    if (autoRef) {
        tecnicoOriginal = autoRef['TÉCNICO'];
        statusOriginal = autoRef['STATUS ATUAL'];
        autoRef['TÉCNICO'] = tecnico;
        autoRef['STATUS ATUAL'] = 'AGUARDANDO MANIFESTAÇÃO';
    }

    mostrarToast('Técnico atribuído localmente. Sincronizando em background...', 'success');
    fecharModalAtribuirTecnico();
    filtrarAutos();
    atualizarCacheAutos();
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
        const stBadge = infoContent.querySelector('.modal-detail-status-auto');
        if (stBadge) stBadge.textContent = 'AGUARDANDO MANIFESTAÇÃO';
    }
    
    btn.innerHTML = txtOriginal; 
    btn.disabled = false;

    try {
        const resultado = await executarAcaoGAS({
            acao: "atribuir_tecnico_auto",
            nup: nup,
            tecnico: tecnico,
            username: (usuarioAtivo && usuarioAtivo.username) ? usuarioAtivo.username : 'sistema'
        });
        
        if (resultado.status === 'success') {
            mostrarToast('Atribuição confirmada na nuvem com sucesso!', 'success');
        } else { 
            throw new Error(resultado.message || 'Erro ao sincronizar na nuvem.'); 
        }
    } catch(e) {
        console.error('Erro ao atribuir técnico no auto:', e);
        mostrarToast('Erro de sincronização na nuvem. (Revertendo)', 'error');
        if (autoRef) {
            autoRef['TÉCNICO'] = tecnicoOriginal;
            autoRef['STATUS ATUAL'] = statusOriginal;
            filtrarAutos();
            atualizarCacheAutos();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
        }
    }
}

function filtrarAutos() {
    const fNupEl = document.getElementById('filtro-auto-nup');
    const fReqEl = document.getElementById('filtro-auto-req');
    const fInfEl = document.getElementById('filtro-auto-inf');
    const fLaudoEl = document.getElementById('filtro-auto-laudo');
    const fNotifEl = document.getElementById('filtro-auto-notif');

    const nup = fNupEl ? fNupEl.value.toLowerCase().trim() : '';
    const req = fReqEl ? fReqEl.value.toLowerCase().trim() : '';
    const inf = fInfEl ? fInfEl.value.toLowerCase().trim() : '';
    const laudo = fLaudoEl ? fLaudoEl.value.toLowerCase().trim() : '';
    const notif = fNotifEl ? fNotifEl.value.toLowerCase().trim() : '';
    const setorMulti = lerValoresMultiplosNativos('autoSetor');
    const tecnicoMulti = lerValoresMultiplosNativos('autoTecnico');
    const statusMulti = lerValoresMultiplosNativos('autoStatus');

    const filtrados = dadosAutosGlobais.filter(r => {
        if (!r['NUP'] || String(r['NUP']).trim() === '') return false;

        // Failsafe RBAC
        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            if (typeof window.isMesmoTecnico === 'function' ? !window.isMesmoTecnico(r['TÉCNICO'], usuarioAtivo) : (r['TÉCNICO'] || '').toUpperCase().trim() !== (usuarioAtivo.nomePlanilha || '').toUpperCase().trim()) {
                return false;
            }
        } else if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            const tec = (r['TÉCNICO'] || '').trim().toUpperCase();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
            if (!semTecnico) {
                if (MAPA_TECNICOS_SETORES[tec] !== usuarioAtivo.setor) return false;
            } else {
                if ((r['SETOR'] || '').trim().toUpperCase() !== usuarioAtivo.setor) return false;
            }
        }

        return (!nup || (r['NUP'] && String(r['NUP']).toLowerCase().includes(nup)))
            && (!req || (r['REQUERENTE'] && String(r['REQUERENTE']).toLowerCase().includes(req)))
            && (!inf || (r['AUTO DE INFRAÇÃO'] && String(r['AUTO DE INFRAÇÃO']).toLowerCase().includes(inf)))
            && (!laudo || (r['LAUDO DE CONSTATAÇÃO'] && String(r['LAUDO DE CONSTATAÇÃO']).toLowerCase().includes(laudo)))
            && (!notif || (r['NOTIFICAÇÃO'] && String(r['NOTIFICAÇÃO']).toLowerCase().includes(notif)))
            && (setorMulti.length === 0 || setorMulti.includes('todos') || setorMulti.includes(r['SETOR']))
            && (tecnicoMulti.length === 0 || tecnicoMulti.includes('todos') || tecnicoMulti.includes(r['TÉCNICO']))
            && (statusMulti.length === 0 || statusMulti.includes('todos') || statusMulti.includes(r['STATUS ATUAL']));
    });
    renderTabelaAutos(filtrados);
}

async function carregarAutos() {
    if (autosCarregados) return;
    
    const keyAutos = `corino_cache_dados_autos_v3`;

    // Migrar dados temporários pré-carregados se existirem
    const tempRawAutos = localStorage.getItem('corino_temp_raw_autos');
    if (tempRawAutos) {
        try {
            const dadosBrutos = JSON.parse(tempRawAutos).map(linha => {
                linha['TÉCNICO'] = linha['TÉCNICO/ADMIN'] || linha['TECNICO/ADMIN'] || linha['TÉCNICO'] || linha['TECNICO'] || 'S/T';
                linha['STATUS-RESPOSTA'] = linha['STATUS-RESPOSTA'] || linha['STATUS DA RESPOSTA'] || '';
                linha['MOTIVO DA AVALIAÇÃO'] = linha['MOTIVO DA AVALIAÇÃO'] || linha['MOTIVO AVALIAÇÃO'] || '';
                linha['LINK RESPOSTA'] = linha['LINK RESPOSTA'] || linha['LINK DA RESPOSTA'] || '';
                linha['LINK NUP'] = linha['LINK NUP'] || linha['LINK DO NUP'] || '';
                return linha;
            });
            dadosAutosGlobais = dadosBrutos;
            localStorage.setItem(keyAutos, JSON.stringify(dadosAutosGlobais));
            localStorage.removeItem('corino_temp_raw_autos');
        } catch (e) {
            console.error("Erro ao processar dados pré-carregados de Autos:", e);
        }
    }

    const cacheSalvo = localStorage.getItem(keyAutos);
    let carregouDeCache = false;

    if (cacheSalvo) {
        try {
            const parsed = JSON.parse(cacheSalvo);
            if (Array.isArray(parsed) && parsed.length > 0) {
                dadosAutosGlobais = parsed;
                dadosAutosGlobais.forEach(linha => {
                    let tec = (linha['TÉCNICO'] || '').trim().toUpperCase();
                    if (tec === 'JOSE RENATO') linha['TÉCNICO'] = 'JOSÉ RENATO';
                });
                carregouDeCache = true;
                document.getElementById('loading-autos').style.display = 'none';
                popularOpcoesAuto();
                filtrarAutos();
                if (typeof atualizarDashboardInicio === 'function' && typeof filtroAtivo !== 'undefined' && filtroAtivo === 'inicio') {
                    atualizarDashboardInicio();
                }
            }
        } catch (e) {
            console.error("Erro ao ler cache de Autos:", e);
        }
    } else {
        document.getElementById('loading-autos').style.display = 'block';
    }

    try {
        const resultado = await executarAcaoGAS({ acao: "buscar_autos" });
        if (resultado.status === 'success') {
            const dadosTratados = (resultado.dados || []).map(linha => {
                let tec = (linha['TÉCNICO/ADMIN'] || linha['TECNICO/ADMIN'] || linha['TÉCNICO'] || linha['TECNICO'] || 'S/T').trim().toUpperCase();
                if (tec === 'JOSE RENATO') tec = 'JOSÉ RENATO';
                linha['TÉCNICO'] = tec;
                linha['STATUS-RESPOSTA'] = linha['STATUS-RESPOSTA'] || linha['STATUS DA RESPOSTA'] || '';
                linha['MOTIVO DA AVALIAÇÃO'] = linha['MOTIVO DA AVALIAÇÃO'] || linha['MOTIVO AVALIAÇÃO'] || '';
                linha['LINK RESPOSTA'] = linha['LINK RESPOSTA'] || linha['LINK DA RESPOSTA'] || '';
                linha['LINK NUP'] = linha['LINK NUP'] || linha['LINK DO NUP'] || '';
                return linha;
            });
            
            dadosAutosGlobais = dadosTratados;
            atualizarCacheAutos();
            if (typeof atualizarDashboardInicio === 'function' && typeof filtroAtivo !== 'undefined' && filtroAtivo === 'inicio') {
                atualizarDashboardInicio();
            }
            
            popularOpcoesAuto();
            filtrarAutos();
            autosCarregados = true;
        }
    } catch (e) {
        console.error(e);
        if (!carregouDeCache) {
            mostrarToast('Erro ao carregar Autos de Infração.', 'error');
        } else {
            mostrarToast('Conexão instável. Exibindo dados do cache de Autos offline.', 'warning');
        }
    } finally {
        document.getElementById('loading-autos').style.display = 'none';
    }
}

async function salvarNovoAuto() {
    const nup = document.getElementById('cadAutoNup').value.trim();
    const req = document.getElementById('cadAutoRequerente').value.trim();
    const dataRepasse = document.getElementById('cadAutoData').value.trim();
    if (!nup || !req || !dataRepasse) { mostrarToast('NUP, Requerente e Data de Repasse são obrigatórios!', 'error'); return; }

    const btn = document.getElementById('btnSalvarCadastroAuto');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando (Pode demorar devido ao PDF)...'; btn.disabled = true;

    const fileInput = document.getElementById('cadAutoArquivo');
    let base64File = null; let fileName = null; let gcsUri = null;
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 25 * 1024 * 1024) { mostrarToast('Erro: O arquivo deve ter no máximo 25MB', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
        fileName = file.name;

        // 1. Upload Seguro no GCS
        if (typeof GCSStorage !== 'undefined') {
            try {
                const gcsRes = await GCSStorage.fazerUpload(file, {
                    modulo: 'autos',
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
            } catch (e) { mostrarToast('Erro ao ler o arquivo', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
        }
    }

    const tecnicoVal = document.getElementById('cadAutoTecnico').value;
    let statusVal = document.getElementById('cadAutoStatus').value;
    if (tecnicoVal && tecnicoVal !== '' && tecnicoVal !== '-- Sem Técnico --' && tecnicoVal !== 'S/T' && statusVal === 'AGUARDANDO DISTRIBUIÇÃO') {
        statusVal = 'AGUARDANDO MANIFESTAÇÃO';
    }

    const payload = {
        acao: "cadastrar_auto", nup: nup, requerente: req, auto_infracao: document.getElementById('cadAutoInfracao').value.trim(),
        laudo: document.getElementById('cadAutoLaudo').value.trim(), notificacao: document.getElementById('cadAutoNotificacao').value.trim(),
        data_repasse: dataRepasse, setor: document.getElementById('cadAutoSetor').value,
        status_atual: statusVal, tipo: document.getElementById('cadAutoTipo').value,
        tecnico: tecnicoVal, fisico_ems: document.getElementById('cadAutoFisicoEms').value.trim(),
        base64: base64File, fileName: fileName,
        url: gcsUri, linkGcs: gcsUri,
        username: usuarioAtivo ? usuarioAtivo.username : 'sistema'
    };

    const novoItem = {
        'NUP': payload.nup,
        'REQUERENTE': payload.requerente,
        'AUTO DE INFRAÇÃO': payload.auto_infracao,
        'LAUDO DE CONSTATAÇÃO': payload.laudo,
        'NOTIFICAÇÃO': payload.notificacao,
        'DATA DE REPASSE': payload.data_repasse,
        'SETOR': payload.setor,
        'STATUS ATUAL': payload.status_atual,
        'TIPO': payload.tipo,
        'TÉCNICO': payload.tecnico,
        'FISICO/E-MS': payload.fisico_ems,
        'LINK NUP': gcsUri || ''
    };

    dadosAutosGlobais.unshift(novoItem);
    autoSelecionadoMockup = novoItem;
    fecharModalCadastroAuto();
    filtrarAutos();
    atualizarCacheAutos();
    mostrarToast('Auto lançado localmente. Sincronizando com a nuvem...', 'success');
    btn.innerHTML = textoOriginal;
    btn.disabled = false;

    try {
        const resposta = await fetch(APPS_SCRIPT_URL, {
            method: 'POST', body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Auto sincronizado com sucesso no Google Cloud Storage (LGPD)!', 'success');
            const linkFinal = gcsUri || resultado.url;
            if (linkFinal) {
                novoItem['LINK NUP'] = linkFinal;
                novoItem['LINK-NUP'] = linkFinal;
                atualizarCacheAutos();
                filtrarAutos();
            }
        }
        else {
            mostrarToast('Erro: ' + resultado.message + ' (Revertendo)', 'error');
            dadosAutosGlobais = dadosAutosGlobais.filter(item => item !== novoItem);
            if (autoSelecionadoMockup === novoItem) autoSelecionadoMockup = dadosAutosGlobais[0] || null;
            filtrarAutos();
            atualizarCacheAutos();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Falha na internet ao salvar Auto. (Revertendo)', 'error');
        dadosAutosGlobais = dadosAutosGlobais.filter(item => item !== novoItem);
        if (autoSelecionadoMockup === novoItem) autoSelecionadoMockup = dadosAutosGlobais[0] || null;
        filtrarAutos();
        atualizarCacheAutos();
    }
}

// Inicia o drag & drop deste ecrã se a função do app.js já estiver ativa
if (typeof configurarDragAndDrop === 'function') {
    configurarDragAndDrop('cadAutoArquivo', 'cadAutoArquivoLabel', updateFileNameAuto);
}

/**
 * Técnico: anexa o PDF de resposta ao Auto de Infração e envia para o backend
 */
function anexarDocumentoAuto(event, nup) {
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
                        modulo: 'autos',
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
                fileName: `Resposta_Auto_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64, 
                url: gcsUri,
                linkGcs: gcsUri,
                tipo_oficio: "auto", 
                username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || '' 
            };
            const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('Resposta anexada com sucesso no Google Cloud Storage (LGPD)!', 'success');
                const linkFinal = gcsUri || resultado.url;
                const target = dadosAutosGlobais.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK DA RESPOSTA'] = linkFinal;
                    target['STATUS ATUAL'] = "REVISÃO";
                    target['STATUS-RESPOSTA'] = "";
                    target['MOTIVO DA AVALIAÇÃO'] = "";
                }
                filtrarAutos();
                atualizarCacheAutos();
            } else {
                mostrarToast('Erro: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1';
            }
        } catch (error) { mostrarToast('Erro de comunicação.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; btn.style.opacity = '1'; }
    };
    fileInput.click();
}

/**
 * Remove o PDF de resposta do Auto de Infração
 */
async function removerDocumentoAuto(event, nup) {
    if (event) event.stopPropagation();
    const btn = event.currentTarget;
    const result = await mostrarConfirmacao('Deseja desvincular a resposta deste Auto de Infração?', { titulo: 'Confirmar Remoção', textoBotao: '🗑️ Sim, Remover' });
    if (!result.confirmou) return;

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ A remover...'; btn.disabled = true;

    try {
        const payload = { acao: "remover_resposta", nup: nup, username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || '' };
        const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast('Documento desvinculado.', 'success');
            const target = dadosAutosGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['LINK DA RESPOSTA'] = "";
                target['STATUS ATUAL'] = "AGUARDANDO MANIFESTAÇÃO";
                target['STATUS-RESPOSTA'] = "";
                target['MOTIVO DA AVALIAÇÃO'] = "";
            }
            filtrarAutos();
            atualizarCacheAutos();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error'); btn.innerHTML = textoOriginal; btn.disabled = false;
        }
    } catch (error) { mostrarToast('Erro de rede.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

/**
 * Avalia (aprova/reprova) a resposta do Auto de Infração
 */
async function avaliarRespostaAuto(event, nup, decisao) {
    if (event) event.stopPropagation();
    const btn = event.currentTarget;
    const conf = decisao === 'APROVADO' ? { titulo: 'Aprovar', textoBotao: '<i class="ci ci-check"></i> Aprovar', corBotao: '#27ae60' } : { titulo: 'Reprovar', textoBotao: '<i class="ci ci-close"></i> Reprovar', corBotao: '#c0392b', exigeMotivo: true };
    const result = await mostrarConfirmacao(`Deseja ${decisao === 'APROVADO' ? 'aprovar' : 'reprovar'} esta resposta?`, conf);
    if (!result.confirmou) return;

    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ A processar...'; btn.disabled = true;

    try {
        const payload = { acao: "avaliar_resposta", nup: nup, decisao: decisao, motivo: result.motivo || '' };
        const resposta = await fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(payload) });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast(`Processo ${decisao.toLowerCase()}!`, 'success');
            const target = dadosAutosGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS-RESPOSTA'] = decisao;
                target['MOTIVO DA AVALIAÇÃO'] = result.motivo || "";
                target['STATUS ATUAL'] = (decisao === 'APROVADO') ? "FAZER DESPACHO" : "AGUARDANDO MANIFESTAÇÃO";
            }
            filtrarAutos();
            atualizarCacheAutos();
            fecharPreview();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error'); btn.innerHTML = textoOriginal; btn.disabled = false;
        }
    } catch (error) { mostrarToast('Erro de rede.', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

/**
 * Realiza a transição de status dos Autos de Infração (Fazer Despacho / Confirmar Assinatura)
 */
async function atualizarStatusAuto(event, nup, novoStatus) {
    const btn = event ? event.currentTarget : null;
    const textoOriginal = btn ? btn.innerHTML : '';

    let msg = '';
    let options = {};

    if (novoStatus === 'AGUARDANDO ASSINATURA') {
        msg = "Tem certeza de que deseja confirmar a realização do despacho para este auto?\n\nO status mudará para Aguardando Assinatura.";
        options = {
            titulo: "Confirmar Realização de Despacho",
            textoBotao: "✅ Confirmar Despacho",
            corBotao: "#2980b9",
            corBorda: "#1c5986",
            corBordaTop: "#2980b9",
            icone: "📑"
        };
    } else if (novoStatus === 'FINALIZADO') {
        msg = "Tem certeza de que deseja confirmar a assinatura realizada para este auto?\n\nO status mudará para Finalizado e o processo será concluído.";
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

            const target = dadosAutosGlobais.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS ATUAL'] = novoStatus;
                target['STATUS'] = novoStatus;
            }
            atualizarCacheAutos();
            filtrarAutos();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

            // Se o preview estiver aberto, recarrega com o novo status
            const prev = document.getElementById('previewModal');
            if (prev && prev.style.display === 'flex' && target) {
                const linkDrive = target['LINK NUP'] || target['LINK-NUP'] || target['LINK DO NUP'] || target['LINK_NUP'] || target['LINK DA RESPOSTA'] || '';
                abrirPreviewAuto(linkDrive, target);
            }
        } else {
            mostrarToast('Erro ao atualizar: ' + (resultado.message || 'Erro Desconhecido'), 'error');
            if (btn) {
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro de comunicação.', 'error');
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    }
}