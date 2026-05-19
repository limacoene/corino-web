// ============================================================================
// AUTOS DE INFRAÇÃO
// ============================================================================
const opcoesAutoSetor = ["GCAR", "GEAA"];
const opcoesAutoStatus = [
    "AGUARDANDO DISTRIBUIÇÃO",
    "AGUARDANDO MANIFESTAÇÃO",
    "REVISÃO",
    "FAZER DESPACHO",
    "CONCLUIDO"
];
const opcoesAutoTipo = ["CONTRADITA", "MANIFESTAÇÃO"];

let dadosAutosGlobais = [];
let autosPicker = null;
let autosCarregados = false;
let autoSelecionadoMockup = null;

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
    preencherSelect('cadAutoSetor', opcoesAutoSetor);
    preencherSelect('cadAutoStatus', opcoesAutoStatus);
    preencherSelect('cadAutoTipo', opcoesAutoTipo);
    preencherSelect('cadAutoTecnico', opcoesAutoTecnico, '-- Sem Técnico --');

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

    preencherMultiselect('autoTecnico', opcoesAutoTecnico);
    preencherMultiselect('autoStatus', opcoesAutoStatus);
    preencherMultiselect('autoSetor', opcoesAutoSetor);
}

function abrirModalCadastroAuto() {
    document.getElementById('cadastroAutoModal').style.display = 'flex';
    popularOpcoesAuto();
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
    leftPanel.style.width = '35%';
    leftPanel.style.minWidth = '300px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.gap = '10px';
    leftPanel.style.maxHeight = '75vh';
    leftPanel.style.overflowY = 'auto';
    leftPanel.style.paddingRight = '5px';
    leftPanel.style.animation = 'fadeInSlideUp 0.3s ease-out forwards';

    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel-detalhes';
    rightPanel.style.width = '65%';
    rightPanel.style.backgroundColor = '#1a1a1a';
    rightPanel.style.border = '1px solid var(--card-border)';
    rightPanel.style.borderRadius = '8px';
    rightPanel.style.padding = '25px';
    rightPanel.style.position = 'sticky';
    rightPanel.style.top = '20px';
    rightPanel.style.display = 'flex';
    rightPanel.style.flexDirection = 'column';
    rightPanel.style.animation = 'fadeInSlideUp 0.4s ease-out forwards';

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
        let linkPreviewBtn = '';
        if (s['LINK NUP'] && String(s['LINK NUP']).trim() !== '') {
            linkPreviewBtn = `<button onclick="abrirPreviewAuto(event, '${s['LINK NUP']}', '${s['NUP']}')" class="btn-preview-action" style="padding: 8px 15px; font-size: 13px; background-color: rgba(46, 204, 113, 0.1); border-color: var(--primary-green); color: var(--primary-green); font-weight: bold;">👁️ Abrir PDF do Processo</button>`;
        }
        let actionButtons = '';
        if (status === 'AGUARDANDO MANIFESTAÇÃO') {
            actionButtons = `<button class="btn-drive btn-upload" style="width: auto; padding: 10px 20px; font-size: 14px;" onclick="mostrarToast('Mockup: Abre modal de Anexar Manifestação.', 'info')">📎 Enviar Resposta</button>`;
        } else if (status === 'REVISÃO') {
            actionButtons = `<button class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; width: auto; padding: 10px 20px; font-size: 14px;" onclick="mostrarToast('Mockup: Aprova a manifestação.', 'info')">✅ Aprovar</button> <button class="btn-drive" style="background-color: #c0392b; border-color: #a93226; width: auto; padding: 10px 20px; font-size: 14px;" onclick="mostrarToast('Mockup: Reprova a manifestação.', 'info')">❌ Reprovar</button>`;
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
            </div>
            <div style="display: flex; gap: 15px; margin-top: auto; padding-top: 20px; border-top: 1px solid #333;">${linkPreviewBtn}<div style="flex-grow: 1; display: flex; justify-content: flex-end; gap: 10px;">${actionButtons}</div></div>
        `;
    }
    container.appendChild(leftPanel);
    container.appendChild(rightPanel);
}

function abrirPreviewAuto(event, url, nup) {
    if (event) event.preventDefault();
    const linha = dadosAutosGlobais.find(x => x['NUP'] === nup);
    if (!linha) return;

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
                <div class="preview-body"><iframe id="previewFrame" class="preview-iframe" src=""></iframe><div id="previewInfo" class="preview-info"><div id="previewInfoContent"></div></div></div>
            </div>`;
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

    let corBadgeTipo = '#333'; let corTextoTipo = '#ccc'; let iconTipo = '';
    if (linha['TIPO'] === 'CONTRADITA') { corBadgeTipo = 'rgba(207, 102, 121, 0.15)'; corTextoTipo = '#cf6679'; iconTipo = '🛡️ '; }
    else if (linha['TIPO'] === 'MANIFESTAÇÃO') { corBadgeTipo = 'rgba(107, 143, 186, 0.15)'; corTextoTipo = '#6b8fba'; iconTipo = '📄 '; }

    let badgeTipo = linha['TIPO'] ? `<span style="display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; background-color: ${corBadgeTipo}; color: ${corTextoTipo}; border: 1px solid ${corTextoTipo};">${iconTipo}${linha['TIPO']}</span>` : '-';

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-item">📌 <strong>NUP:</strong> ${linha['NUP']}</div>
        <div class="preview-info-item">👤 <strong>Requerente:</strong> ${linha['REQUERENTE'] || '-'}</div>
        <div class="preview-info-item">⚖️ <strong>Auto de Infração:</strong> ${linha['AUTO DE INFRAÇÃO'] || '-'}</div>
        <div class="preview-info-item">📑 <strong>Laudo de Constatação:</strong> ${linha['LAUDO DE CONSTATAÇÃO'] || '-'}</div>
        <div class="preview-info-item">📨 <strong>Notificação:</strong> ${linha['NOTIFICAÇÃO'] || '-'}</div>
        <div class="preview-info-item">📅 <strong>Data de Repasse:</strong> ${linha['DATA DE REPASSE'] || '-'}</div>
        <div class="preview-info-item">🏢 <strong>Setor:</strong> ${linha['SETOR'] || '-'}</div>
        <div class="preview-info-item" style="font-weight: bold; color: #fff;">🚦 <strong>Status Atual:</strong> ${linha['STATUS ATUAL'] || '-'}</div>
        <div class="preview-info-item">👨‍💻 <strong>Técnico:</strong> ${linha['TÉCNICO'] || '-'}</div>
        <div class="preview-info-item">📦 <strong>Formato:</strong> ${linha['FISICO/E-MS'] || '-'}</div>
        <div class="preview-info-item">📄 <strong>Tipo:</strong><br>${badgeTipo}</div>
    `;

    document.getElementById('previewFrame').src = previewUrl;
    modal.style.display = 'flex';
}

function abrirModalAtribuirTecnico(nup) {
    document.getElementById('atrAutoNup').value = nup;
    const select = document.getElementById('atrAutoTecnico');
    select.innerHTML = '';
    const elBlank = document.createElement('option');
    elBlank.value = ''; elBlank.textContent = '-- Selecione o Técnico --';
    select.appendChild(elBlank);
    opcoesAutoTecnico.forEach(opt => { const el = document.createElement('option'); el.value = opt; el.textContent = opt; select.appendChild(el); });
    document.getElementById('atribuirTecnicoModal').style.display = 'flex';
}

function fecharModalAtribuirTecnico() { document.getElementById('atribuirTecnicoModal').style.display = 'none'; }

async function salvarAtribuicaoTecnico() {
    const nup = document.getElementById('atrAutoNup').value;
    const tecnico = document.getElementById('atrAutoTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico para atribuir.', 'error'); return; }

    const btn = document.getElementById('btnSalvarAtribuicao');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    // OPTIMISTIC UPDATE
    const autoRef = dadosAutosGlobais.find(a => a['NUP'] === nup);
    let tecnicoOriginal = '';

    if (autoRef) {
        tecnicoOriginal = autoRef['TÉCNICO'];
        autoRef['TÉCNICO'] = tecnico;
    }

    mostrarToast('Técnico atribuído localmente. Sincronizando em background...', 'success');
    fecharModalAtribuirTecnico();
    filtrarAutos();
    
    btn.innerHTML = txtOriginal; 
    btn.disabled = false;

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ acao: "atribuir_tecnico_auto", nup: nup, tecnico: tecnico })
        });
        const resultado = await resposta.json();
        
        if (resultado.status === 'success') {
            mostrarToast('Atribuição confirmada na nuvem com sucesso!', 'success');
        } else { 
            throw new Error(resultado.message); 
        }
    } catch (e) {
        console.error(e); 
        mostrarToast('Falha na internet ao atribuir técnico. (Revertendo)', 'error');
        if (autoRef) {
            autoRef['TÉCNICO'] = tecnicoOriginal;
        }
        filtrarAutos();
    } 
}

function filtrarAutos() {
    const nup = document.getElementById('filtro-auto-nup').value.toLowerCase().trim();
    const req = document.getElementById('filtro-auto-req').value.toLowerCase().trim();
    const inf = document.getElementById('filtro-auto-inf').value.toLowerCase().trim();
    const laudo = document.getElementById('filtro-auto-laudo').value.toLowerCase().trim();
    const notif = document.getElementById('filtro-auto-notif').value.toLowerCase().trim();
    const setorMulti = lerValoresMultiplosNativos('autoSetor');
    const tecnicoMulti = lerValoresMultiplosNativos('autoTecnico');
    const statusMulti = lerValoresMultiplosNativos('autoStatus');

    const filtrados = dadosAutosGlobais.filter(r => {
        const tipoRow = String(r['TIPO'] || '').toUpperCase().trim();
        const hasAutoInfo = (r['AUTO DE INFRAÇÃO'] && String(r['AUTO DE INFRAÇÃO']).trim() !== '');
        if (!(tipoRow === 'CONTRADITA' || tipoRow === 'MANIFESTAÇÃO' || hasAutoInfo)) return false;

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
    document.getElementById('loading-autos').style.display = 'block';
    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ acao: "buscar_autos" })
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
                dadosAutosGlobais = resultado.dados.filter(linha => (linha['TÉCNICO'] || '').toUpperCase().trim() === usuarioAtivo.nomePlanilha.toUpperCase().trim());
            } else { dadosAutosGlobais = resultado.dados; }
            popularOpcoesAuto(); filtrarAutos(); autosCarregados = true;
        }
    } catch (e) { console.error(e); mostrarToast('Erro ao carregar Autos de Infração.', 'error'); }
    finally { document.getElementById('loading-autos').style.display = 'none'; }
}

async function salvarNovoAuto() {
    const nup = document.getElementById('cadAutoNup').value.trim();
    const req = document.getElementById('cadAutoRequerente').value.trim();
    if (!nup || !req) { mostrarToast('NUP e Requerente são obrigatórios!', 'error'); return; }

    const btn = document.getElementById('btnSalvarCadastroAuto');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando (Pode demorar devido ao PDF)...'; btn.disabled = true;

    const fileInput = document.getElementById('cadAutoArquivo');
    let base64File = null; let fileName = null;
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 15 * 1024 * 1024) { mostrarToast('Erro: O arquivo deve ter no máximo 15MB', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
        fileName = file.name;
        try {
            base64File = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } catch (e) { mostrarToast('Erro ao ler o arquivo', 'error'); btn.innerHTML = textoOriginal; btn.disabled = false; return; }
    }

    const payload = {
        acao: "cadastrar_auto", nup: nup, requerente: req, auto_infracao: document.getElementById('cadAutoInfracao').value.trim(),
        laudo: document.getElementById('cadAutoLaudo').value.trim(), notificacao: document.getElementById('cadAutoNotificacao').value.trim(),
        data_repasse: document.getElementById('cadAutoData').value, setor: document.getElementById('cadAutoSetor').value,
        status_atual: document.getElementById('cadAutoStatus').value, tipo: document.getElementById('cadAutoTipo').value,
        tecnico: document.getElementById('cadAutoTecnico').value, fisico_ems: document.getElementById('cadAutoFisicoEms').value,
        base64: base64File, fileName: fileName
    };

    const novoItem = { 'NUP': payload.nup, 'REQUERENTE': payload.requerente, 'AUTO DE INFRAÇÃO': payload.auto_infracao, 'LAUDO DE CONSTATAÇÃO': payload.laudo, 'NOTIFICAÇÃO': payload.notificacao, 'DATA DE REPASSE': payload.data_repasse, 'SETOR': payload.setor, 'STATUS ATUAL': payload.status_atual, 'TIPO': payload.tipo, 'TÉCNICO': payload.tecnico, 'FISICO/E-MS': payload.fisico_ems };
    dadosAutosGlobais.unshift(novoItem);
    fecharModalCadastroAuto(); filtrarAutos(); mostrarToast('Auto lançado localmente. Sincronizando...', 'success');
    btn.innerHTML = textoOriginal; btn.disabled = false;

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') { mostrarToast('Auto sincronizado com sucesso!', 'success'); }
        else { mostrarToast('Erro: ' + resultado.message + ' (Revertendo)', 'error'); dadosAutosGlobais = dadosAutosGlobais.filter(item => item !== novoItem); filtrarAutos(); }
    } catch (e) {
        console.error(e); mostrarToast('Falha na internet ao salvar Auto. (Revertendo)', 'error');
        dadosAutosGlobais = dadosAutosGlobais.filter(item => item !== novoItem); filtrarAutos();
    }
}

// Inicia o drag & drop deste ecrã se a função do app.js já estiver ativa
if (typeof configurarDragAndDrop === 'function') {
    configurarDragAndDrop('cadAutoArquivo', 'cadAutoArquivoLabel', updateFileNameAuto);
}