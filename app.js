const usuarioAtivo = JSON.parse(sessionStorage.getItem('corino_user'));

if (!usuarioAtivo) {
    window.location.href = 'login.html';
} else {
    if (usuarioAtivo.perfil === 'gerencia_consulta') {
        const btnAndamento = document.getElementById('btn-menu-andamento');
        const btnAtrasados = document.getElementById('btn-menu-atrasados');
        const btnRespondidos = document.getElementById('btn-menu-respondidos');

        if (btnAndamento) btnAndamento.style.display = 'none';
        if (btnAtrasados) btnAtrasados.style.display = 'none';
        if (btnRespondidos) btnRespondidos.style.display = 'none';
    }

    // Ocultar Autos de Infração para GEAMB
    if (usuarioAtivo.username === 'geamb' || usuarioAtivo.perfil === 'gerencia_consulta') {
        const modAutosHeader = document.getElementById('header-mod-autos');
        if (modAutosHeader && modAutosHeader.parentElement) {
            modAutosHeader.parentElement.style.display = 'none';
        }
    }
}

function fazerLogout() {
    sessionStorage.removeItem('corino_user');
    window.location.href = 'login.html';
}

// TOAST NOTIFICATIONS
function mostrarToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    const icon = tipo === 'success' ? '✅' : '❌';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-msg">${mensagem.replace(/\n/g, '<br>')}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}

// ============================================================================
// LÓGICA DO BOTÃO "VOLTAR AO TOPO"
// ============================================================================
window.onscroll = function () { gerirBotaoTopo() };

function gerirBotaoTopo() {
    const btnTop = document.getElementById("btn-back-to-top");
    if (!btnTop) return;
    if (document.body.scrollTop > 400 || document.documentElement.scrollTop > 400) {
        btnTop.style.display = "block";
    } else {
        btnTop.style.display = "none";
    }
}

function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
}
// ============================================================================


let dadosCoringa = [];
let filtroAtivo = 'todos';
let subAbaAtiva = 'Geral';
let incluirReiteracoes = false; // Nova variável para o toggle
let dadosExibidos = [];

function obterStatusVisual(linha) {
    const status = (linha['STATUS'] || '').toUpperCase().trim();

    if (status === 'ARQUIVADO' || status === 'TRAMITADO') return { texto: '✅ FINALIZADO', classe: 'status-green' };

    const numero = extrairDiasRestantes(linha['DIAS RESTANTES']);
    if (isNaN(numero)) return { texto: '⚪ SEM PRAZO', classe: 'status-gray' };

    if (numero < 0) return { texto: `⚠️ 🔴 ${Math.abs(numero)} DIAS DE ATRASO`, classe: 'status-red' };
    if (numero === 0) return { texto: ' VENCE HOJE', classe: 'status-yellow' };
    if (numero === 1) return { texto: `🟢 ${numero} dia`, classe: 'status-green' };

    return { texto: `🟢 ${numero} dias`, classe: 'status-green' }; // Para 2 ou mais dias
}

// Função auxiliar para calcular a formatação dinâmica (cores HSL, texto e ícone de bolinha)
function obterInfoDinamicaStatus(linha) {
    const statusVisual = obterStatusVisual(linha);
    let percentual = 100;
    let corFundo = 'transparent';
    let pulsingClass = '';

    const numeroDiasRestantes = extrairDiasRestantes(linha['DIAS RESTANTES']);
    const MAX_PRAZO_VISUAL = 30;

    if (statusVisual.texto.includes('FINALIZADO')) {
        percentual = 100; corFundo = '#00fa9a';
    } else if (isNaN(numeroDiasRestantes)) {
        percentual = 0; corFundo = 'transparent';
    } else {
        if (numeroDiasRestantes < 0) {
            percentual = 100; corFundo = '#ff4b4b'; pulsingClass = 'pulse-bar';
        } else {
            const diasDecorridosVisual = MAX_PRAZO_VISUAL - numeroDiasRestantes;
            percentual = Math.min(Math.max(0, (diasDecorridosVisual / MAX_PRAZO_VISUAL) * 100), 99);
            const hue = 120 - (percentual * 1.2);
            corFundo = `hsl(${hue}, 100%, 50%)`;
            if (percentual >= 70) pulsingClass = 'pulse-bar-warning';
        }
    }

    let corTexto = corFundo === 'transparent' ? '#aaaaaa' : corFundo;
    let textoStatusLimpo = statusVisual.texto.replace(/🟢|🟡|🔴|⚪|✅/g, '').trim();

    let iconeStatus = `<span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: ${corTexto}; margin-right: 8px; flex-shrink: 0;"></span>`;
    if (statusVisual.texto.includes('FINALIZADO')) iconeStatus = `<span style="margin-right: 6px; font-size: 16px;">✅</span>`;
    else if (statusVisual.texto.includes('SEM PRAZO')) iconeStatus = `<span style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background-color: transparent; border: 2px solid #aaaaaa; margin-right: 8px; flex-shrink: 0;"></span>`;

    return { percentual, corFundo, pulsingClass, corTexto, textoStatusLimpo, iconeStatus };
}

async function iniciarSistema() {
    try {
        const displayDiv = document.getElementById('user-display-name');
        if (displayDiv && usuarioAtivo) {
            let textoPerfil = usuarioAtivo.perfil.includes('gerencia') ? 'GERÊNCIA' : usuarioAtivo.perfil.toUpperCase();
            displayDiv.innerText = `${usuarioAtivo.nomePlanilha} (${textoPerfil})`;
        }

        if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.perfil === 'tecnico')) {
            const btnResp = document.getElementById('btn-menu-respondidos');
            if (btnResp) btnResp.style.display = 'block';
        }

        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            ['btn-tab-aprovados', 'btn-tab-reprovados', 'btn-tab-todos'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
            document.querySelectorAll('.fab-button').forEach(btn => {
                btn.style.display = 'none';
            });
        }

        const dadosBrutos = await buscarDadosGoogleSheets();

        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            dadosCoringa = dadosBrutos.filter(linha => {
                const tecnicoLinha = (linha['TÉCNICO/ADMIN'] || '').toUpperCase().trim();
                const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
                return tecnicoLinha === tecnicoLogado;
            });
        } else {
            dadosCoringa = dadosBrutos;
        }

        document.getElementById('loading').style.display = 'none';

        ['cgNup', 'andNup', 'atrNup', 'respNup'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.placeholder = 'Pesquisar NUP ou Ofício...';
        });

        popularTodosOsSelectsNativos();

        // Event listener para o toggle de reiterações
        const toggleReiteracoes = document.getElementById('toggleReiteracoes');
        if (toggleReiteracoes) {
            toggleReiteracoes.addEventListener('change', (event) => {
                incluirReiteracoes = event.target.checked;
                aplicarFiltros(); // Re-aplicar filtros para atualizar a contagem
            });
        }
        atualizarBadgesNotificacao(dadosCoringa);
        mudarAbaPrincipal('todos');

        // Pré-carrega os autos em background para ser instantâneo ao abrir a aba
        carregarAutos();
    } catch (erro) {
        document.getElementById('loading').innerText = "Erro ao conectar com a base de dados central.";
        console.error(erro);
    }
}

function popularTodosOsSelectsNativos() {
    const gerencias = [...new Set(dadosCoringa.map(d => d['GERÊNCIA']))].filter(x => x && x !== 'S/G').sort();
    const municipios = [...new Set(dadosCoringa.map(d => d['COMARCA']))].filter(x => x && x !== '-').sort();
    const statusList = [...new Set(dadosCoringa.map(d => d['STATUS']))].filter(x => x && x !== '-').sort();
    const tecnicos = [...new Set(dadosCoringa.map(d => d['TÉCNICO/ADMIN']))].filter(x => x && x !== 'S/T').sort();

    const inicializar = (idBase, arrayValores) => {
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
                aplicarFiltros();
            });
        });

        atualizarDisplayNativo(idBase, placeholderText);
    };

    inicializar('cgGerencia', gerencias);
    inicializar('cgMunicipio', municipios);
    inicializar('cgStatus', statusList);
    inicializar('cgTecnico', tecnicos);
    inicializar('andTecnico', tecnicos);
    inicializar('andStatus', statusList);
    inicializar('atrTecnico', tecnicos);
    inicializar('atrStatus', statusList);
    inicializar('respTecnico', tecnicos);
}

function atualizarDisplayNativo(idBase, placeholderText) {
    const display = document.getElementById(`ms-${idBase}`).querySelector('.ms-display');
    const valoresSelecionados = lerValoresMultiplosNativos(idBase);
    display.innerHTML = '';
    if (valoresSelecionados.length === 0) {
        display.innerHTML = `<span class="ms-placeholder">Ex: ${placeholderText}</span>`;
    } else {
        valoresSelecionados.forEach(val => {
            let pill = document.createElement('span');
            pill.className = 'ms-pill';
            pill.innerHTML = `${val} <span class="ms-pill-remove" onclick="removerPill(event, '${idBase}', '${val}')">×</span>`;
            display.appendChild(pill);
        });
    }
}

function removerPill(event, idBase, valor) {
    event.stopPropagation();
    const dropdown = document.getElementById(`dd-${idBase}`);
    dropdown.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        if (chk.value === valor) chk.checked = false;
    });
    const placeholderText = document.getElementById(`ms-${idBase}`).getAttribute('data-placeholder');
    atualizarDisplayNativo(idBase, placeholderText);

    if (idBase === 'autoSetor' || idBase === 'autoTecnico' || idBase === 'autoStatus') {
        if (typeof filtrarAutos === 'function') filtrarAutos();
    } else {
        aplicarFiltros();
    }
}

function toggleDropdown(idBase) {
    document.querySelectorAll('.ms-dropdown').forEach(dd => {
        if (dd.id !== `dd-${idBase}`) dd.style.display = 'none';
    });
    const dd = document.getElementById(`dd-${idBase}`);
    dd.style.display = dd.style.display === 'block' ? 'none' : 'block';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-multiselect')) {
        document.querySelectorAll('.ms-dropdown').forEach(dd => dd.style.display = 'none');
    }
});

function lerValoresMultiplosNativos(idBase) {
    const dropdown = document.getElementById(`dd-${idBase}`);
    if (!dropdown) return [];
    return Array.from(dropdown.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
}

function mudarAbaPrincipal(tipo) {
    filtroAtivo = tipo;
    subAbaAtiva = (tipo === 'respondidos') ? 'Pendentes' : 'Geral';
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-menu-${tipo}`).classList.add('active');

    document.getElementById('aba-todos').style.display = (tipo === 'todos') ? 'block' : 'none';
    document.getElementById('aba-andamento').style.display = (tipo === 'andamento') ? 'block' : 'none';
    document.getElementById('aba-atrasados').style.display = (tipo === 'atrasados') ? 'block' : 'none';
    document.getElementById('aba-respondidos').style.display = (tipo === 'respondidos') ? 'block' : 'none';
    document.getElementById('aba-autos').style.display = (tipo === 'autos') ? 'block' : 'none';

    // Hide export count on autos
    if (tipo === 'autos') {
        document.getElementById('export-section').style.display = 'none';
    }

    if (tipo === 'autos') {
        carregarAutos();
    }

    atualizarVisualSubAbas();
    limparInputsDeFiltro();
    aplicarFiltros();

    // ==========================================
    // ROLA A PÁGINA PARA O TOPO AO TROCAR DE ABA
    // ==========================================
    scrollToTop();
}

function toggleModule(moduleId) {
    const content = document.getElementById(moduleId);
    const header = document.getElementById(`header-${moduleId}`);
    if (content) {
        content.classList.toggle('collapsed');
    }
    if (header) {
        header.classList.toggle('collapsed');
    }
}


function setSubAba(aba) {
    subAbaAtiva = aba;
    atualizarVisualSubAbas();
    aplicarFiltros();

    // Opcional: Rolar para o topo ao trocar as sub-abas (DIFLOR, GCAR, etc) também
    scrollToTop();
}

function atualizarVisualSubAbas() {
    document.querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
    const container = document.getElementById(`mini-tabs-${filtroAtivo}`);
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (btn.textContent === subAbaAtiva) btn.classList.add('active');
        });
    }
}

function limparInputsDeFiltro() {
    ['cgNup', 'cgCarms', 'andNup', 'atrNup', 'respNup'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const idsCustom = ['cgGerencia', 'cgMunicipio', 'cgStatus', 'cgTecnico', 'andTecnico', 'andStatus', 'atrTecnico', 'atrStatus', 'respTecnico'];
    idsCustom.forEach(idBase => {
        const dropdown = document.getElementById(`dd-${idBase}`);
        if (dropdown) {
            dropdown.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = false);
            const placeholder = document.getElementById(`ms-${idBase}`).getAttribute('data-placeholder');
            atualizarDisplayNativo(idBase, placeholder);
        }
    });
}

function obterNomeSetorFormatado(sigla) {
    if (sigla === 'Geral') return 'no sistema';
    if (sigla === 'DIFLOR') return 'na Diretoria Florestal - DIFLOR';
    if (sigla === 'GEAA') return 'na Gerência de Autorização Ambiental - GEAA';
    if (sigla === 'GCAR') return 'na Gerência de Cadastro Ambiental Rural - GCAR';
    return `no setor ${sigla}`;
}

function checarTermoBusca(r, nupTermo, oficioTermo) {
    if (!nupTermo && !oficioTermo) return { match: true, info: null };

    let infoStr = null;

    if (nupTermo) {
        let matchNup = false;
        if (r['NUP'] && r['NUP'].toLowerCase().includes(nupTermo)) matchNup = true;

        const nupInicial = (r['NUP_INICIAL'] || '').toLowerCase();
        if (!matchNup && nupInicial.includes(nupTermo)) {
            matchNup = true;
            infoStr = `📌 Encontrado no NUP Inicial: <strong>${r['NUP_INICIAL']}</strong>`;
        }

        if (!matchNup && r['REITERACOES'] && r['REITERACOES'].length > 0) {
            for (let i = 0; i < r['REITERACOES'].length; i++) {
                if (r['REITERACOES'][i].NUP && r['REITERACOES'][i].NUP.toLowerCase().includes(nupTermo)) {
                    matchNup = true;
                    if (!infoStr) infoStr = `📌 Encontrado no NUP da ${i + 1}ª Reiteração: <strong>${r['REITERACOES'][i].NUP}</strong>`;
                    break;
                }
            }
        }
        if (!matchNup) return { match: false, info: null };
    }

    if (oficioTermo) {
        let matchOf = false;
        const oficioPrincipal = (r['OFÍCIO N.'] || r['OFÍCIO'] || '').toLowerCase();
        if (oficioPrincipal.includes(oficioTermo)) matchOf = true;

        const oficioInicial = (r['OFICIO_INICIAL'] || '').toLowerCase();
        if (!matchOf && oficioInicial.includes(oficioTermo)) {
            matchOf = true;
            if (!infoStr) infoStr = `📌 Encontrado no Ofício Inicial: <strong>${r['OFICIO_INICIAL'].replace(/\.pdf/gi, '')}</strong>`;
        }

        if (!matchOf && r['REITERACOES'] && r['REITERACOES'].length > 0) {
            for (let i = 0; i < r['REITERACOES'].length; i++) {
                if (r['REITERACOES'][i].NUMERO && r['REITERACOES'][i].NUMERO.toLowerCase().includes(oficioTermo)) {
                    matchOf = true;
                    if (!infoStr) infoStr = `📌 Encontrado na ${i + 1}ª Reiteração: <strong>${r['REITERACOES'][i].NUMERO.replace(/\.pdf/gi, '')}</strong>`;
                    break;
                }
            }
        }
        if (!matchOf) return { match: false, info: null };
    }

    return { match: true, info: infoStr };
}

function aplicarFiltros() {
    if (filtroAtivo === 'autos') {
        document.getElementById('cards-container').innerHTML = '';
        document.getElementById('export-section').style.display = 'none';
        return;
    }

    let filtrados = dadosCoringa;

    if (filtroAtivo === 'todos') {
        const termoBusca = document.getElementById('cgNup').value.toLowerCase().trim();
        const ofTermo = document.getElementById('cgOficio') ? document.getElementById('cgOficio').value.toLowerCase().trim() : '';
        const carms = document.getElementById('cgCarms').value.toLowerCase().trim();
        const gersRaw = lerValoresMultiplosNativos('cgGerencia');
        const munsRaw = lerValoresMultiplosNativos('cgMunicipio');
        const stssRaw = lerValoresMultiplosNativos('cgStatus');
        const tecsRaw = lerValoresMultiplosNativos('cgTecnico');

        const temFiltroAtivo = termoBusca || ofTermo || carms || gersRaw.length > 0 || munsRaw.length > 0 || stssRaw.length > 0 || tecsRaw.length > 0;

        if (!temFiltroAtivo) {
            if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
                filtrados = filtrados.filter(r => obterStatusVisual(r).texto.includes('FINALIZADO'));
            } else {
                desenharCards([], true);
                return;
            }
        } else {
            filtrados = filtrados.filter(r => {
                const busca = checarTermoBusca(r, termoBusca, ofTermo);
                r._matchInfo = busca.info;
                return busca.match
                    && (!carms || (r['CARMS'] && r['CARMS'].toLowerCase().includes(carms)))
                    && (gersRaw.length === 0 || gersRaw.includes('todos') || gersRaw.includes(r['GERÊNCIA']))
                    && (munsRaw.length === 0 || munsRaw.includes('todos') || munsRaw.includes(r['COMARCA']))
                    && (stssRaw.length === 0 || stssRaw.includes('todos') || stssRaw.includes(r['STATUS']))
                    && (tecsRaw.length === 0 || tecsRaw.includes('todos') || tecsRaw.includes(r['TÉCNICO/ADMIN']));
            });
        }
    }
    else if (filtroAtivo === 'andamento') {
        const termoBusca = document.getElementById('andNup').value.toLowerCase().trim();
        const ofTermo = document.getElementById('andOficio') ? document.getElementById('andOficio').value.toLowerCase().trim() : '';
        const tecs = lerValoresMultiplosNativos('andTecnico');
        const stss = lerValoresMultiplosNativos('andStatus');

        filtrados = filtrados.filter(r => !obterStatusVisual(r).texto.includes('🔴') && !obterStatusVisual(r).texto.includes('FINALIZADO') && !(r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-' && (r['STATUS_RESPOSTA'] || '').toUpperCase() !== 'REPROVADO') && (r['STATUS'] || '').toUpperCase() !== 'REVISÃO');

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            return (subAbaAtiva === 'Geral' || r['GERÊNCIA'] === subAbaAtiva)
                && busca.match
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']))
                && (stss.length === 0 || stss.includes('todos') || stss.includes(r['STATUS']));
        });

        filtrados.sort((a, b) => {
            let diasA = extrairDiasRestantes(a['DIAS RESTANTES']);
            let diasB = extrairDiasRestantes(b['DIAS RESTANTES']);

            let aTemPrazo = !isNaN(diasA);
            let bTemPrazo = !isNaN(diasB);

            if (aTemPrazo && bTemPrazo) {
                if (diasA !== diasB) return diasA - diasB;
            } else if (aTemPrazo && !bTemPrazo) {
                return -1;
            } else if (!aTemPrazo && bTemPrazo) {
                return 1;
            }

            return converterDataBR(a['DATA']) - converterDataBR(b['DATA']);
        });

        document.getElementById('alerta-andamento').innerText = `ℹ️ Há ${filtrados.length} processos em andamento ${obterNomeSetorFormatado(subAbaAtiva)}.`;
    }
    else if (filtroAtivo === 'atrasados') {
        const termoBusca = document.getElementById('atrNup').value.toLowerCase().trim();
        const ofTermo = document.getElementById('atrOficio') ? document.getElementById('atrOficio').value.toLowerCase().trim() : '';
        const tecs = lerValoresMultiplosNativos('atrTecnico');
        const stss = lerValoresMultiplosNativos('atrStatus');

        filtrados = filtrados.filter(r => obterStatusVisual(r).texto.includes('🔴') && !(r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-' && (r['STATUS_RESPOSTA'] || '').toUpperCase() !== 'REPROVADO') && (r['STATUS'] || '').toUpperCase() !== 'REVISÃO');

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            return (subAbaAtiva === 'Geral' || r['GERÊNCIA'] === subAbaAtiva)
                && busca.match
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']))
                && (stss.length === 0 || stss.includes('todos') || stss.includes(r['STATUS']));
        });

        filtrados.sort((a, b) => {
            const numA = extrairDiasRestantes(a['DIAS RESTANTES']) || 0;
            const numB = extrairDiasRestantes(b['DIAS RESTANTES']) || 0;
            return numA - numB;
        });
        document.getElementById('alerta-atrasados').innerText = `⚠️ Atenção - Há ${filtrados.length} processos em atraso ${obterNomeSetorFormatado(subAbaAtiva)}.`;
    }
    else if (filtroAtivo === 'respondidos') {
        const termoBusca = document.getElementById('respNup').value.toLowerCase().trim();
        const ofTermo = document.getElementById('respOficio') ? document.getElementById('respOficio').value.toLowerCase().trim() : '';
        const tecs = lerValoresMultiplosNativos('respTecnico');

        filtrados = filtrados.filter(r => ((r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-') || (r['STATUS'] || '').toUpperCase() === 'REVISÃO') && r['STATUS'] !== 'TRAMITADO' && r['STATUS'] !== 'ARQUIVADO');

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;

            let statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase();
            let statusGeral = (r['STATUS'] || '').toUpperCase();
            let subAbaFiltro = true;

            if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
                subAbaFiltro = (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO' && statusGeral === 'REVISÃO');
            } else {
                if (subAbaAtiva === 'Pendentes') subAbaFiltro = (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO' && statusGeral === 'REVISÃO');
                else if (subAbaAtiva === 'Aprovados') subAbaFiltro = (statusResp === 'APROVADO');
                else if (subAbaAtiva === 'Reprovados') subAbaFiltro = (statusResp === 'REPROVADO');
            }

            return busca.match && subAbaFiltro
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']));
        });
        document.getElementById('alerta-respondidos').innerText = `📁 Há ${filtrados.length} processos nesta aba.`;
    }

    desenharCards(filtrados);
}

function exportarCSV() {
    if (dadosExibidos.length === 0) {
        mostrarToast("Não existem dados para exportar com o filtro atual.", "error");
        return;
    }

    const chaves = Object.keys(dadosExibidos[0]).filter(k => k !== 'REITERACOES' && k !== '_matchInfo');

    let csvContent = chaves.join(",") + "\n";

    dadosExibidos.forEach(linha => {
        let valores = chaves.map(chave => {
            let valor = linha[chave] === null || linha[chave] === undefined ? "" : String(linha[chave]);
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
    a.download = `C.O.R.I.N.O._Exportacao_${filtroAtivo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function desenharCards(dados, estadoInicialConsultaGeral = false) {
    dadosExibidos = dados;
    const container = document.getElementById('cards-container');
    const exportSection = document.getElementById('export-section');
    container.innerHTML = '';

    if (estadoInicialConsultaGeral) {
        exportSection.style.display = 'none';
        container.innerHTML = `
            <div style="width: 100%; grid-column: 1 / -1; background-color: #0e1117; border: 1px solid #1a252f; border-radius: 8px; padding: 16px 20px; font-weight: bold; color: #ddd; font-size: 15px; display: flex; align-items: center; gap: 10px; animation: fadeInSlideUp 0.3s ease-out forwards;">
                👆 Utilize os filtros acima para localizar processos.
            </div>
        `;
        return;
    }

    exportSection.style.display = 'block';
    const qtd = dados.length;
    let totalItensContados = qtd; // Começa com os ofícios principais

    // Se o filtro ativo for 'todos' e o toggle de reiterações estiver ligado, adiciona as reiterações à contagem
    if (filtroAtivo === 'todos' && incluirReiteracoes) {
        dados.forEach(linha => {
            if (linha.REITERACOES && linha.REITERACOES.length > 0) {
                totalItensContados += linha.REITERACOES.length;
            }
        });
    }
    const textoItens = totalItensContados === 1 ? '1 item' : `${totalItensContados} itens`;
    const textoResultados = totalItensContados === 1 ? '1 resultado' : `${totalItensContados} resultados`;
    document.getElementById('btnExport').innerText = `📥 Exportar lista filtrada (${textoItens})`;

    const contadorProcessos = document.getElementById('contador-processos');
    if (filtroAtivo === 'todos') {
        contadorProcessos.style.display = 'block';
        contadorProcessos.innerText = `Exibindo ${textoResultados}.`;
    } else {
        contadorProcessos.style.display = 'none'; // Oculta o contador para outras abas
    }

    if (dados.length === 0) {
        container.innerHTML = '<h3 style="color: #666; width: 100%; grid-column: 1 / -1; animation: fadeInSlideUp 0.3s ease forwards;">Nenhum registo encontrado com estes critérios.</h3>';
        return;
    }

    dados.forEach((linha, index) => {
        const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();
        const infoStatus = obterInfoDinamicaStatus(linha);

        let barraProgressoHtml = `
            <div class="progress-container" title="Indicador de Prazo">
                <div class="progress-bar ${infoStatus.pulsingClass}" style="width: 100%; background-color: ${infoStatus.corFundo};"></div>
            </div>
        `;

        let htmlMatchInfo = '';
        if (linha._matchInfo) {
            htmlMatchInfo = `<div style="background-color: rgba(0, 250, 154, 0.1); border: 1px dashed rgba(0, 250, 154, 0.4); color: #00fa9a; padding: 6px 10px; border-radius: 6px; font-size: 13px; margin-bottom: 12px; text-align: center;">${linha._matchInfo}</div>`;
        }

        const div = document.createElement('div');
        div.className = 'card';

        const delay = Math.min(index * 0.05, 1.5);
        div.style.animationDelay = `${delay}s`;

        const statusRespAval = (linha['STATUS_RESPOSTA'] || '').toUpperCase();
        let badgeAvaliacao = '';
        if (statusRespAval === 'APROVADO') {
            badgeAvaliacao = `<div style="background-color: rgba(39, 174, 96, 0.15); border: 1px solid #27ae60; color: #2ecc71; text-align: center; padding: 6px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 12px;">✅ MANIFESTAÇÃO APROVADA</div>`;
        } else if (statusRespAval === 'REPROVADO') {
            badgeAvaliacao = `<div style="background-color: rgba(192, 57, 43, 0.15); border: 1px solid #c0392b; color: #e74c3c; text-align: center; padding: 6px; border-radius: 6px; font-weight: bold; font-size: 13px; margin-bottom: 12px; animation: pulseRed 2s infinite;">❌ MANIFESTAÇÃO REPROVADA</div>`;
            if (linha['MOTIVO_AVALIACAO']) {
                badgeAvaliacao += `<div style="background-color: rgba(192, 57, 43, 0.05); color: #e74c3c; font-size: 13px; text-align: left; padding: 10px; border-left: 3px solid #c0392b; margin-top: -5px; margin-bottom: 12px; line-height: 1.4;"><strong>📝 Motivo da Reprovação:</strong><br>${linha['MOTIVO_AVALIACAO']}</div>`;
            }
        }

        div.innerHTML = `
            ${badgeAvaliacao}
            <div class="card-status" style="color: ${infoStatus.corTexto}; display: flex; align-items: center;">${infoStatus.iconeStatus}${infoStatus.textoStatusLimpo}</div>
            ${barraProgressoHtml}
            ${htmlMatchInfo}
            <!-- 
                Lógica de Movimentação de Aba:
                A "movimentação" de um ofício para a aba de "Ofícios Atrasados" é tratada pela função 'aplicarFiltros'.
                Quando um ofício tem 'DIAS RESTANTES' negativo, 'obterStatusVisual' o marca como "ATRASO".
                A função 'aplicarFiltros' para a aba 'andamento' exclui automaticamente ofícios com status "ATRASO",
                enquanto a aba 'atrasados' os inclui. Assim, a mudança de aba ou a atualização dos filtros reflete essa "movimentação".
            -->
            <div class="badge-nup">NUP: ${linha['NUP']}</div>
            <div class="badge-oficio">📜 OFÍCIO N.: ${oficioRaw}</div>
            <button class="btn-expander" onclick="abrirModal(${index})">📖 VER INFORMAÇÕES COMPLEMENTARES</button>
        `;
        container.appendChild(div);
    });
}

function gerarHtmlDocExtra(titulo, num, nup, linkRaw, index) {
    if (!num || String(num).trim() === '' || String(num).trim() === '-') return '';
    const numFormatado = String(num).replace(/\.pdf/gi, '').trim();
    let htmlBotao = `<span style="font-size:12px; color:#888;">Sem Link</span>`;

    if (linkRaw && linkRaw.startsWith('http')) {
        const fileId = extrairIdDrive(linkRaw);
        if (fileId) {
            const linkPreview = `https://drive.google.com/file/d/${fileId}/preview`;
            htmlBotao = `<button onclick="abrirPreview('${linkPreview}', ${index})" class="btn-inline-preview" title="Pré-visualizar"></button>`;
        } else {
            htmlBotao = `<a href="${linkRaw}" target="_blank" class="btn-inline-preview" style="background-image: none; width: auto; height: auto; padding: 3px 8px;">🔗 Abrir</a>`;
        }
    }
    return `
        <div style="background-color: #1a252f; border: 1px solid #2c3e50; border-radius: 6px; padding: 10px; margin-top: 10px;">
            <div style="color: #00fa9a; font-weight: bold; margin-bottom: 5px; font-size: 13px;">📌 ${titulo}</div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 13px; color: #ddd; line-height: 1.4;"><strong>Ofício:</strong> ${numFormatado} <br><strong>NUP:</strong> ${nup || '-'}</span>
                <div>${htmlBotao}</div>
            </div>
        </div>
    `;
}

function anexarDocumento(event, nup) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';

    fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        btn.innerHTML = '⏳ A enviar... (Aguarde)';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });

            const nupLimpo = nup.replace(/[^a-zA-Z0-9]/g, '');
            const payload = {
                acao: "upload",
                nup: nup,
                fileName: `Resposta_${nupLimpo}.pdf`,
                base64: base64
            };

            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const resultado = await resposta.json();
            if (resultado.status === 'success') {
                mostrarToast('Documento guardado com sucesso!\nPode demorar até 5 min para a Diretoria visualizar.', 'success');
                btn.innerHTML = '✅ Concluído!';
                btn.style.backgroundColor = '#228B22';
                btn.style.borderColor = '#1a6b1a';
                btn.style.opacity = '1';

                const target = dadosCoringa.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK_RESPOSTA'] = resultado.url || "-";
                    target['STATUS'] = "REVISÃO";
                    target['STATUS_RESPOSTA'] = "";
                    target['MOTIVO_AVALIACAO'] = "";
                }
                atualizarBadgesNotificacao(dadosCoringa);
                fecharModal();
                aplicarFiltros();
            } else {
                mostrarToast('Erro no Servidor: ' + resultado.message, 'error');
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                btn.style.opacity = '1';
            }
        } catch (error) {
            console.error(error);
            mostrarToast('Erro de comunicação. O ficheiro pode ser muito grande ou a internet falhou.', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    };
    fileInput.click();
}

function mostrarConfirmacao(mensagem, options = {}) {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmModal');
        document.getElementById('confirmMessage').innerText = mensagem;
        const btnYes = document.getElementById('btnConfirmYes');
        const btnCancel = document.getElementById('btnConfirmCancel');

        const titleEl = document.getElementById('confirmTitle');
        const iconEl = document.getElementById('confirmIcon');
        const modalContent = modal.querySelector('.modal-content');

        if (titleEl) titleEl.innerText = options.titulo || 'Confirmar Ação';
        if (btnYes) {
            btnYes.innerHTML = options.textoBotao || 'Confirmar';
            btnYes.style.backgroundColor = options.corBotao || '#c0392b';
            btnYes.style.borderColor = options.corBorda || '#a93226';
        }
        if (iconEl) {
            iconEl.innerHTML = options.icone || '⚠️';
            iconEl.style.animation = options.animacao || 'none';
        }
        if (modalContent) {
            modalContent.style.borderTopColor = options.corBordaTop || '#ff4b4b';
        }

        const inputContainer = document.getElementById('confirmInputContainer');
        const inputText = document.getElementById('confirmInputText');
        if (options.exigeMotivo) {
            inputContainer.style.display = 'block';
            inputText.value = '';
            inputText.style.border = '1px solid #c0392b';
        } else {
            inputContainer.style.display = 'none';
            inputText.value = '';
        }

        // Remove listeners antigos
        const newBtnYes = btnYes.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        modal.style.display = 'flex';

        newBtnYes.onclick = () => {
            if (options.exigeMotivo && inputText.value.trim() === '') {
                inputText.style.border = '2px solid #ff4b4b';
                inputText.focus();
                return;
            }
            modal.style.display = 'none';
            resolve({ confirmou: true, motivo: inputText.value.trim() });
        };
        newBtnCancel.onclick = () => {
            modal.style.display = 'none';
            resolve({ confirmou: false, motivo: '' });
        };
    });
}

async function removerDocumento(event, nup) {
    const btn = event.currentTarget; // Guarda elemento antes de ir async
    const result = await mostrarConfirmacao('Tem certeza de que deseja desvincular a resposta deste NUP?\n\nO link será apagado e o status voltará para Aguardando Manifestação Técnica.', {
        titulo: 'Confirmar Remoção',
        textoBotao: '🗑️ Sim, Remover',
        corBotao: '#c0392b',
        corBorda: '#a93226',
        icone: '⚠️',
        animacao: 'pulseRed 1.5s infinite',
        corBordaTop: '#ff4b4b',
        exigeMotivo: false
    });
    if (!result.confirmou) return;

    const textoOriginal = btn.innerHTML;

    btn.innerHTML = '⏳ A remover...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
        const payload = {
            acao: "remover_resposta",
            nup: nup
        };

        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Documento desvinculado com sucesso!', 'success');
            btn.innerHTML = '✅ Removido!';
            btn.style.backgroundColor = '#228B22';
            btn.style.borderColor = '#1a6b1a';
            btn.style.opacity = '1';

            const target = dadosCoringa.find(r => r['NUP'] === nup);
            if (target) {
                target['LINK_RESPOSTA'] = "";
                target['STATUS'] = "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
                target['STATUS_RESPOSTA'] = "";
                target['MOTIVO_AVALIACAO'] = "";
            }
            atualizarBadgesNotificacao(dadosCoringa);
            fecharModal();
            aplicarFiltros();
        } else {
            mostrarToast('Erro do Servidor: ' + resultado.message, 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro de comunicação. A internet pode ter falhado.', 'error');
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

async function avaliarResposta(event, nup, decisao) {
    const btn = event.currentTarget;
    let config = {};
    if (decisao === 'APROVADO') {
        config = {
            titulo: 'Confirmar Aprovação',
            textoBotao: '✅ Sim, Aprovar',
            corBotao: '#27ae60',
            corBorda: '#1e8449',
            icone: '✅',
            animacao: 'pulseAlert 1.5s infinite',
            corBordaTop: '#27ae60',
            exigeMotivo: false
        };
    } else {
        config = {
            titulo: 'Confirmar Reprovação',
            textoBotao: '❌ Sim, Reprovar',
            corBotao: '#c0392b',
            corBorda: '#a93226',
            icone: '❌',
            animacao: 'pulseRed 1.5s infinite',
            corBordaTop: '#ff4b4b',
            exigeMotivo: true
        };
    }

    const result = await mostrarConfirmacao(`Tem certeza de que deseja ${decisao === 'APROVADO' ? 'APROVAR' : 'REPROVAR'} a resposta deste NUP?`, config);
    if (!result.confirmou) return;

    const textoOriginal = btn.innerHTML;

    btn.innerHTML = '⏳ A processar...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
        const payload = { acao: "avaliar_resposta", nup: nup, decisao: decisao, motivo: result.motivo };

        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast(`Processo ${decisao.toLowerCase()} com sucesso!`, 'success');
            btn.innerHTML = `✅ ${decisao}`;

            const target = dadosCoringa.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS_RESPOSTA'] = decisao;
                target['MOTIVO_AVALIACAO'] = result.motivo || "";
                if (decisao === 'APROVADO') {
                    target['STATUS'] = "FAZER CI";
                } else if (decisao === 'REPROVADO') {
                    target['STATUS'] = "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
                }
            }
            atualizarBadgesNotificacao(dadosCoringa);
            fecharPreview();
            fecharModal();
            aplicarFiltros();
        } else {
            mostrarToast('Erro do Servidor: ' + resultado.message, 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro de comunicação. A internet pode ter falhado.', 'error');
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

async function atualizarStatusCI(event, nup, novoStatus) {
    const btn = event.currentTarget;
    const textoOriginal = btn.innerHTML;

    btn.innerHTML = '⏳ A processar...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    try {
        const payload = {
            acao: "atualizar_status_ci",
            nup: nup,
            novoStatus: novoStatus,
            username: usuarioAtivo.username || ''
        };

        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Status atualizado com sucesso!', 'success');

            const target = dadosCoringa.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS'] = novoStatus;
            }
            atualizarBadgesNotificacao(dadosCoringa);
            aplicarFiltros();

            // Manter a janela de detalhes aberta com o estado visual atualizado sem recarregar e crer em travamentos
            const newIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
            if (newIndex !== -1) {
                abrirModal(newIndex);
            } else {
                fecharModal();
            }
        } else {
            mostrarToast('Operação Cancelada ou Sem Permissão: ' + (resultado.message || 'Erro Desconhecido'), 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Erro de comunicação. A internet pode ter falhado.', 'error');
        btn.innerHTML = textoOriginal;
        btn.disabled = false;
        btn.style.opacity = '1';
    }
}

function feedbackDownload(btn) {
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Baixando...';
    btn.style.opacity = '0.7';
    btn.style.pointerEvents = 'none';

    mostrarToast('O download foi iniciado. Aguarde um momento...', 'success');

    setTimeout(() => {
        btn.innerHTML = textoOriginal;
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
    }, 3500);
}

function abrirModal(index) {
    const linha = dadosExibidos[index];
    const modal = document.getElementById('detalhesModal');
    const modalBody = document.getElementById('modalBody');
    const infoStatus = obterInfoDinamicaStatus(linha);
    const obs = (linha['OBSERVAÇÃO'] || '').trim();
    const linkRaw = linha['LINK_OFICIO'] || '';
    const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();

    let htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="modal-obs"><strong>Observação:</strong><br>${obs}</div>` : '';
    let htmlPreviewIcon = '';
    let htmlLink = `<div style="text-align:center; color:#666; font-weight:bold; padding: 12px; border: 1px dashed #333; border-radius: 6px;">🚫 Sem Link Vinculado</div>`;
    let btnAnexar = '';
    const linkRespostaVerificacao = linha['LINK_RESPOSTA'];
    const temRespostaVinculada = linkRespostaVerificacao && linkRespostaVerificacao.startsWith('http');

    if (usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.perfil === 'gerencia')) {
        if (temRespostaVinculada) {
            const isAprovadoBackend = (linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
            const isFazerCI = (linha['STATUS'] || '').toUpperCase() === 'FAZER CI';
            const isGestor = usuarioAtivo.perfil === 'gerencia';

            let blockRemoval = false;
            if (!isGestor && (isAprovadoBackend || isFazerCI)) {
                blockRemoval = true;
            }

            if (blockRemoval) {
                btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px;">🔒 Documento aprovado. Apenas a Diretoria pode removê-lo.</div>`;
            } else {
                btnAnexar = `<button onclick="removerDocumento(event, '${linha['NUP']}')" class="btn-drive btn-upload" style="background-color: #c0392b; border-color: #a93226; color: white;">🗑️ Retirar Resposta</button>`;
            }
        } else if (usuarioAtivo.perfil === 'tecnico') {
            btnAnexar = `<button onclick="anexarDocumento(event, '${linha['NUP']}')" class="btn-drive btn-upload">📎 Anexar Resposta</button>`;
        }
    }

    if (linkRaw && linkRaw.startsWith('http')) {
        const fileId = extrairIdDrive(linkRaw);
        if (fileId) {
            const linkPreview = `https://drive.google.com/file/d/${fileId}/preview`;
            const linkDownload = `https://drive.google.com/uc?export=download&id=${fileId}`;
            htmlPreviewIcon = `<button onclick="abrirPreview('${linkPreview}', ${index})" class="btn-inline-preview" title="Pré-visualizar Ofício"></button>`;
            htmlLink = `
                <div class="modal-buttons">
                    <a href="${linkDownload}" class="btn-drive btn-download" onclick="feedbackDownload(this)">⬇️ Download</a>
                    ${btnAnexar}
                </div>
            `;
        } else {
            htmlLink = `
                <div class="modal-buttons">
                    <a href="${linkRaw}" target="_blank" class="btn-drive">🔗 Abrir Link Vinculado</a>
                    ${btnAnexar}
                </div>
            `;
        }
    } else {
        if (btnAnexar) {
            htmlLink += `<div class="modal-buttons" style="margin-top: 15px;">${btnAnexar}</div>`;
        }
    }

    let htmlDiretoriaBotoes = '';
    const isGestorFinalidade = usuarioAtivo.perfil === 'gerencia';
    const statusGeralAtualizado = (linha['STATUS'] || '').toUpperCase();

    if (isGestorFinalidade) {
        if (statusGeralAtualizado === 'FAZER CI') {
            htmlDiretoriaBotoes = `<button onclick="atualizarStatusCI(event, '${linha['NUP']}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background-color: #2980b9; border-color: #1c5986; color: white; width: 100%; margin-top: 15px; font-size: 15px;">✅ Confirmar Realização de C.I.</button>`;
        } else if (statusGeralAtualizado === 'AGUARDANDO ASSINATURA') {
            htmlDiretoriaBotoes = `<button onclick="atualizarStatusCI(event, '${linha['NUP']}', 'TRAMITADO')" class="btn-drive" style="background-color: #8e44ad; border-color: #6c3483; color: white; width: 100%; margin-top: 15px; font-size: 15px;">✍️ Confirmar Assinatura Realizada</button>`;
        }
    }

    let htmlResposta = '';
    const linkResposta = linha['LINK_RESPOSTA'];
    if (linkResposta && linkResposta.startsWith('http')) {
        const respId = extrairIdDrive(linkResposta);
        let botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive btn-upload">🔗 Abrir Resposta no Drive</a>`;
        if (respId) {
            const respPreview = `https://drive.google.com/file/d/${respId}/preview`;
            botaoResp = `<button onclick="abrirPreview('${respPreview}', ${index})" class="btn-drive btn-upload" style="border:none;">👁️ Pré-visualizar Resposta</button>`;
        }

        htmlResposta = `
            <div style="margin: 20px 20px 0 20px; padding: 15px; background-color: rgba(140, 86, 51, 0.1); border: 1px solid rgba(140, 86, 51, 0.3); border-radius: 6px;">
                <div style="color: #e67e22; font-weight: bold; margin-bottom: 10px;">📁 Documento de Resposta Anexado:</div>
                ${botaoResp}
            </div>
        `;
    }

    let htmlHistorico = '';
    htmlHistorico += gerarHtmlDocExtra('Ofício Inicial', linha['OFICIO_INICIAL'], linha['NUP_INICIAL'], linha['LINK_INICIAL'], index);
    if (linha['REITERACOES'] && linha['REITERACOES'].length > 0) {
        linha['REITERACOES'].forEach((reit, i) => {
            htmlHistorico += gerarHtmlDocExtra(`${i + 1}ª Reiteração`, reit.NUMERO, reit.NUP, reit.LINK, index);
        });
    }

    if (htmlHistorico !== '') {
        htmlHistorico = `<div style="margin: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;">📚 Histórico de Documentos</strong>${htmlHistorico}</div>`;
    }

    modalBody.innerHTML = `
        <div class="modal-grid" style="margin-top: 25px;">
            <div>
                <div style="margin-bottom: 8px;">📌 <strong>NUP:</strong> ${linha['NUP']}</div>
                <div style="margin-bottom: 8px;">📅 <strong>Data:</strong> ${linha['DATA']}</div>
                <div style="margin-bottom: 8px;">📄 <strong>Tipo:</strong> ${linha['TIPO']}</div>
                <div style="margin-bottom: 8px;">📍 <strong>Município:</strong> ${linha['COMARCA']}</div>
                <div style="margin-bottom: 8px;">📝 <strong>Referência:</strong> ${linha['REFERÊNCIA']}</div>
                <div style="margin-bottom: 8px;">⏳ <strong>Prazo:</strong> ${linha['PRAZO'] || '-'}</div>
            </div>
            <div>
                <div style="margin-bottom: 8px; display: flex; align-items: center;">📜 <strong>Ofício N.:</strong> &nbsp;${oficioRaw} ${htmlPreviewIcon}</div>
                <div style="margin-bottom: 8px;">👤 <strong>Responsável:</strong> ${linha['TÉCNICO/ADMIN']}</div>
                <div style="margin-bottom: 8px;">🏢 <strong>Gerência:</strong> ${linha['GERÊNCIA']}</div>
                <div style="margin-bottom: 8px;">🔗 <strong>Status:</strong> ${linha['STATUS']}</div>
                <div style="margin-bottom: 8px;">🆔 <strong>CAR:</strong> ${linha['CARMS']}</div>
                <div style="margin-bottom: 8px; display: flex; align-items: center;">🚦 <strong style="margin-right: 6px;">Situação:</strong> <span style="color: ${infoStatus.corTexto}; display: flex; align-items: center; font-weight: bold;">${infoStatus.iconeStatus}${infoStatus.textoStatusLimpo}</span></div>
            </div>
        </div>
        ${htmlObs} 
        ${htmlResposta}
        ${htmlHistorico}
        <div class="modal-footer" style="padding-top: 20px;">
            ${htmlLink}
            ${htmlDiretoriaBotoes}
        </div>
    `;
    modal.style.display = 'flex';
}

function fecharModal() { document.getElementById('detalhesModal').style.display = 'none'; }

function abrirPreview(url, index) {
    const modal = document.getElementById('previewModal');
    const iconeOlhoGrande = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    if (!document.getElementById('preview-wrapper-id')) {
        modal.className = 'preview-modal';
        modal.innerHTML = `
            <div class="preview-wrapper" id="preview-wrapper-id">
                <div class="preview-toolbar">
                    <div class="preview-toolbar-title" style="display: flex; align-items: center;">
                        ${iconeOlhoGrande} Pré-visualização de Documento
                    </div>
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

    // Atualiza o link do botão de download de acordo com o documento atualmente aberto
    const btnDownload = document.getElementById('btn-download-preview');
    const fileId = extrairIdDrive(url);
    if (fileId) {
        btnDownload.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
    } else {
        btnDownload.href = url; // Fallback caso não seja um formato padrão do Drive
    }

    const linha = dadosExibidos[index];
    const infoStatus = obterInfoDinamicaStatus(linha);
    const obs = (linha['OBSERVAÇÃO'] || '').trim();
    const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();
    const htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="preview-info-obs"><strong>Observação:</strong><br>${obs}</div>` : '';

    let htmlHistoricoPreview = '';
    htmlHistoricoPreview += gerarHtmlDocExtra('Ofício Inicial', linha['OFICIO_INICIAL'], linha['NUP_INICIAL'], linha['LINK_INICIAL'], index);
    if (linha['REITERACOES'] && linha['REITERACOES'].length > 0) {
        linha['REITERACOES'].forEach((reit, i) => {
            htmlHistoricoPreview += gerarHtmlDocExtra(`${i + 1}ª Reiteração`, reit.NUMERO, reit.NUP, reit.LINK, index);
        });
    }

    if (htmlHistoricoPreview !== '') {
        htmlHistoricoPreview = `<div style="margin-top: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;">📚 Histórico de Documentos</strong>${htmlHistoricoPreview}</div>`;
    }

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-item">📌 <strong>NUP:</strong> ${linha['NUP']}</div>
        <div class="preview-info-item">📜 <strong>Ofício N.:</strong> ${oficioRaw}</div>
        <div class="preview-info-item">📅 <strong>Data:</strong> ${linha['DATA']}</div>
        <div class="preview-info-item">📄 <strong>Tipo:</strong> ${linha['TIPO']}</div>
        <div class="preview-info-item">📍 <strong>Município:</strong> ${linha['COMARCA']}</div>
        <div class="preview-info-item">📝 <strong>Referência:</strong> ${linha['REFERÊNCIA']}</div>
        <div class="preview-info-item">⏳ <strong>Prazo:</strong> ${linha['PRAZO'] || '-'}</div>
        <div class="preview-info-item">👤 <strong>Responsável:</strong> ${linha['TÉCNICO/ADMIN']}</div>
        <div class="preview-info-item">🏢 <strong>Gerência:</strong> ${linha['GERÊNCIA']}</div>
        <div class="preview-info-item">🆔 <strong>CAR:</strong> ${linha['CARMS']}</div>
        <div class="preview-info-item" style="display: flex; align-items: center;">🚦 <strong style="margin-right: 6px;">Situação:</strong> <span style="color: ${infoStatus.corTexto}; display: flex; align-items: center; font-weight: bold;">${infoStatus.iconeStatus}${infoStatus.textoStatusLimpo}</span></div>
        ${htmlObs}
        ${htmlHistoricoPreview}
    `;

    // Botões Toggles
    const linkResposta = linha['LINK_RESPOSTA'];
    let respPreviewUrl = '';
    let respId = null;
    if (linkResposta && linkResposta.startsWith('http')) {
        respId = extrairIdDrive(linkResposta);
        if (respId) respPreviewUrl = `https://drive.google.com/file/d/${respId}/preview`;
    }

    const linkOficio = linha['LINK_OFICIO'];
    let oficioPreviewUrl = '';
    let ofId = null;
    if (linkOficio && linkOficio.startsWith('http')) {
        ofId = extrairIdDrive(linkOficio);
        if (ofId) oficioPreviewUrl = `https://drive.google.com/file/d/${ofId}/preview`;
    }

    let toggleBtn = '';
    if (respPreviewUrl && oficioPreviewUrl) {
        let downloadOficioUrlFull = ofId ? `https://drive.google.com/uc?export=download&id=${ofId}` : linkOficio;
        let downloadRespUrlFull = respId ? `https://drive.google.com/uc?export=download&id=${respId}` : linkResposta;

        toggleBtn = `
             <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                 <button onclick="document.getElementById('previewFrame').src='${oficioPreviewUrl}'; document.getElementById('btn-download-preview').href='${downloadOficioUrlFull}';" class="btn-drive btn-preview" style="flex: 1; padding: 10px; font-size: 12px;">📜 Ver Ofício</button>
                 <button onclick="document.getElementById('previewFrame').src='${respPreviewUrl}'; document.getElementById('btn-download-preview').href='${downloadRespUrlFull}';" class="btn-drive btn-upload" style="flex: 1; padding: 10px; font-size: 12px; color: white;">📁 Ver Resposta</button>
             </div>
         `;
    }

    // Botões Avaliar (DIFLOR)
    let acoesDiflorPreview = '';
    const statusRespAval = (linha['STATUS_RESPOSTA'] || '').toUpperCase();
    const isLinkRespostaValido = linha['LINK_RESPOSTA'] && linha['LINK_RESPOSTA'].trim() !== '' && linha['LINK_RESPOSTA'].trim() !== '-';
    if (usuarioAtivo && usuarioAtivo.username === 'diflor' && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && isLinkRespostaValido) {
        acoesDiflorPreview = `
            <div style="margin-top: 20px; padding: 15px; background-color: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 6px;">
                <strong style="color: #ffa500; font-size: 14px; display: block; margin-bottom: 10px;">📋 Avaliar Resposta:</strong>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <button onclick="avaliarResposta(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive" style="background-color: #27ae60; border-color: #1e8449;">✅ Aprovar Manifestação</button>
                    <button onclick="avaliarResposta(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive" style="background-color: #c0392b; border-color: #a93226;">❌ Reprovar Manifestação</button>
                </div>
            </div>
        `;
    }

    const contentDiv = document.getElementById('previewInfoContent');
    contentDiv.innerHTML = toggleBtn + contentDiv.innerHTML + acoesDiflorPreview;

    document.getElementById('previewFrame').src = url;
    modal.style.display = 'flex';
}

function togglePreviewInfo() {
    const infoPanel = document.getElementById('previewInfo');
    if (infoPanel) {
        infoPanel.classList.toggle('hidden');
    }
}

function fecharPreview() {
    document.getElementById('previewModal').style.display = 'none';
    const frame = document.getElementById('previewFrame');
    if (frame) frame.src = '';
}

window.onclick = function (event) {
    if (event.target === document.getElementById('detalhesModal')) fecharModal();
    if (event.target === document.getElementById('previewModal')) fecharPreview();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('collapsed'); document.getElementById('mainContent').classList.toggle('expanded'); }

// ============================================================================
// BADGES DE NOTIFICAÇÃO
// ============================================================================
function atualizarBadgesNotificacao(dados) {
    if (!usuarioAtivo) return;

    let totalAndamento = 0;
    let totalAtrasados = 0;
    let totalRespReprovados = 0;
    let totalRespPendentes = 0;

    if (usuarioAtivo.perfil === 'tecnico') {
        const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
        const dadosTecnico = dados.filter(r => (r['TÉCNICO/ADMIN'] || '').toUpperCase().trim() === tecnicoLogado);

        totalAndamento = dadosTecnico.filter(r => {
            const hasResponse = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            const isReprovado = (r['STATUS_RESPOSTA'] || '').toUpperCase() === 'REPROVADO';
            const isRevisao = (r['STATUS'] || '').toUpperCase() === 'REVISÃO';
            return !obterStatusVisual(r).texto.includes('🔴') && !obterStatusVisual(r).texto.includes('FINALIZADO') && (!hasResponse || isReprovado) && !isRevisao;
        }).length;

        totalAtrasados = dadosTecnico.filter(r => {
            const hasResponse = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            const isReprovado = (r['STATUS_RESPOSTA'] || '').toUpperCase() === 'REPROVADO';
            const isRevisao = (r['STATUS'] || '').toUpperCase() === 'REVISÃO';
            return obterStatusVisual(r).texto.includes('🔴') && (!hasResponse || isReprovado) && !isRevisao;
        }).length;

        totalRespPendentes = dadosTecnico.filter(r => {
            const hasResponse = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            const isAprovado = (r['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
            const isReprovado = (r['STATUS_RESPOSTA'] || '').toUpperCase() === 'REPROVADO';
            const isRevisao = (r['STATUS'] || '').toUpperCase() === 'REVISÃO';
            return (hasResponse || isRevisao) && !isAprovado && !isReprovado && r['STATUS'] !== 'TRAMITADO' && r['STATUS'] !== 'ARQUIVADO';
        }).length;

        atualizarBadgeDOM('badge-menu-respondidos', totalRespPendentes);
        atualizarBadgeDOM('badge-menu-andamento', totalAndamento);
        atualizarBadgeDOM('badge-menu-atrasados', totalAtrasados);

    } else if (usuarioAtivo.username === 'diflor') {
        totalRespPendentes = dados.filter(r => {
            const linkResposta = r['LINK_RESPOSTA'];
            const temLink = linkResposta && linkResposta.trim() !== '' && linkResposta.trim() !== '-';
            const statusResposta = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
            const statusGeral = (r['STATUS'] || '').toUpperCase().trim();

            return (temLink || statusGeral === 'REVISÃO') &&
                statusGeral === 'REVISÃO' &&
                statusGeral !== 'TRAMITADO' &&
                statusGeral !== 'ARQUIVADO' &&
                statusResposta !== 'APROVADO' &&
                statusResposta !== 'REPROVADO';
        }).length;

        atualizarBadgeDOM('badge-menu-respondidos', totalRespPendentes);
        atualizarBadgeDOM('badge-tab-pendentes', totalRespPendentes);
    }
}

function atualizarBadgeDOM(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
        el.innerText = count;
        el.style.display = 'inline-flex';
    } else {
        el.style.display = 'none';
        el.innerText = '0';
    }
}

// ============================================================================
// CADASTRO DE NOVO OFÍCIO
// ============================================================================
const opcoesTipoAba0 = [
    "IBAMA",
    "CJUR-PGE",
    "MPF",
    "POLICIA FEDERAL",
    "PODER JUDICIÁRIO",
    "PGJ-MPMS",
    "MPMS",
    "GEAMB",
    "INCRA",
    "ICMBio",
    "SEGOV",
    "SES",
    "DIFLOR",
    "DIPRE",
    "CBM",
    "Polícia Civil",
    "SEMADESC",
    "DPU",
    "DIBIO"
];

const opcoesTipoAba1 = [
    "JUNTADA",
    "OFÍCIO",
    "MT",
    "CARTA CONSULTA"
];

function atualizarOpcoesTipo() {
    const aba = document.getElementById('cadAbaDestino').value;
    const selectTipo = document.getElementById('cadTipo');
    selectTipo.innerHTML = '';

    let opcoes = (aba === "0") ? opcoesTipoAba0 : opcoesTipoAba1;

    opcoes.forEach(tipo => {
        let opt = document.createElement('option');
        opt.value = tipo;
        opt.textContent = tipo;
        selectTipo.appendChild(opt);
    });
}

let dataPicker = null;

function abrirModalCadastro() {
    document.getElementById('cadastroModal').style.display = 'flex';
    document.getElementById('cadAbaDestino').value = '0';
    atualizarOpcoesTipo();

    if (!dataPicker) {
        dataPicker = flatpickr("#cadData", {
            locale: "pt",
            dateFormat: "d/m/Y",
            allowInput: true
        });
    }
    dataPicker.setDate(new Date());
}

function fecharModalCadastro() {
    document.getElementById('cadastroModal').style.display = 'none';
    // Limpar os campos
    ['cadNup', 'cadOficioN', 'cadData', 'cadPrazo', 'cadComarca', 'cadTecnico', 'cadGerencia', 'cadCarms', 'cadReferencia', 'cadObservacao'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('cadAbaDestino').value = '0';
    document.getElementById('cadTipoPrazo').value = 'corridos';
}

async function salvarNovoOficio() {
    const nup = document.getElementById('cadNup').value.trim();
    const oficioN = document.getElementById('cadOficioN').value.trim();

    if (!nup || !oficioN) {
        mostrarToast('Por favor, preencha pelo menos o NUP e o Ofício N.', 'error');
        return;
    }

    const btn = document.getElementById('btnSalvarCadastro');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...';
    btn.disabled = true;
    btn.style.opacity = '0.7';

    let dataBr = document.getElementById('cadData').value;

    const numPrazo = document.getElementById('cadPrazo').value;
    const tipoPrazo = document.getElementById('cadTipoPrazo').value;
    const prazoFinal = numPrazo ? `${numPrazo} ${tipoPrazo}` : "";

    const payload = {
        acao: "cadastrar_oficio",
        aba_destino: document.getElementById('cadAbaDestino').value,
        nup: nup,
        oficio_n: oficioN,
        data_oficio: dataBr,
        prazo: prazoFinal,
        tipo: document.getElementById('cadTipo').value,
        comarca: document.getElementById('cadComarca').value,
        tecnico: document.getElementById('cadTecnico').value,
        gerencia: document.getElementById('cadGerencia').value,
        carms: document.getElementById('cadCarms').value,
        referencia: document.getElementById('cadReferencia').value,
        observacao: document.getElementById('cadObservacao').value
    };

    // OPTIMISTIC UPDATE: Atualiza a interface instantaneamente
    const novoObj = {
        'NUP': payload.nup,
        'OFÍCIO N.': payload.oficio_n,
        'DATA': payload.data_oficio,
        'PRAZO': payload.prazo,
        'TIPO': payload.tipo,
        'COMARCA': payload.comarca,
        'TÉCNICO/ADMIN': payload.tecnico,
        'GERÊNCIA': payload.gerencia,
        'CARMS': payload.carms,
        'REFERÊNCIA': payload.referencia,
        'OBSERVAÇÃO': payload.observacao,
        'STATUS': 'AGUARDANDO DISTRIBUIÇÃO',
        'DIAS RESTANTES': payload.prazo ? payload.prazo + ' dias' : '-'
    };

    dadosCoringa.unshift(novoObj);
    fecharModalCadastro();
    aplicarFiltros();
    atualizarBadgesNotificacao(dadosCoringa);
    mostrarToast('Ofício lançado localmente. Sincronizando em background...', 'success');

    btn.innerHTML = textoOriginal;
    btn.disabled = false;
    btn.style.opacity = '1';

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Ofício sincronizado com a nuvem com sucesso!', 'success');
        } else {
            mostrarToast('Erro do Servidor ao salvar ofício: ' + resultado.message + ' (Revertendo)', 'error');
            dadosCoringa = dadosCoringa.filter(item => item !== novoObj);
            aplicarFiltros();
            atualizarBadgesNotificacao(dadosCoringa);
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Falha na internet. O ofício não foi salvo na nuvem. (Revertendo)', 'error');
        dadosCoringa = dadosCoringa.filter(item => item !== novoObj);
        aplicarFiltros();
        atualizarBadgesNotificacao(dadosCoringa);
    }
}

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
const opcoesAutoTecnico = [
    "ALLAN", "ALEXANDRE", "ANDERSON", "ADRIANA", "BEATRIZ", "CRISTIANE",
    "CARLA", "CARLOS JULIANO", "DIANESSA", "ELERI", "ELEN MARA", "ETEVALDO",
    "FABIANA", "FRANCIELLY", "GABRIELA", "HELLEN", "HERUS", "HELEN CAROLINE",
    "HILBATY", "HENRIQUE", "JOSÉ RENATO", "JOELTHON", "JONIEL", "JEAN",
    "LIVYA", "LARISSA", "MAX SANDER", "MARIA", "MARIANA OPP", "MARIANA SH",
    "MICHAEL", "MILKA", "MATEUS", "NETO", "RHOANDER", "RODRIGO", "JHONATAN",
    "SUZIELLY"
];

let dadosAutosGlobais = [];
let autosPicker = null;
let autosCarregados = false;

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
        document.getElementById(id).value = '';
    });
    const label = document.getElementById('cadAutoArquivoLabel');
    if (label) {
        label.classList.remove('has-file');
        const textSpan = label.querySelector('.upload-text');
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
    }
}

function updateFileName(input) {
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

function renderTabelaAutos(dados) {
    const tbody = document.getElementById('tabela-autos-body');
    const cont = document.getElementById('contador-autos');
    tbody.innerHTML = '';

    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 15px;">Nenhum auto de infração encontrado.</td></tr>';
        cont.innerText = 'Exibindo 0 resultados.';
        return;
    }

    cont.innerText = `Exibindo ${dados.length} resultados.`;

    dados.forEach(r => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #333';

        const displayTecnico = r['TÉCNICO']
            ? r['TÉCNICO']
            : `<button class="btn-drive" style="padding: 4px 10px; font-size: 11px; background-color: #3498db; border: none; cursor: pointer; color: #fff;" onclick="abrirModalAtribuirTecnico('${r['NUP']}')">Atribuir Técnico</button>`;

        let corBadgeTipo = '#333';
        let corTextoTipo = '#ccc';
        let iconTipo = '';
        if (r['TIPO'] === 'CONTRADITA') {
            corBadgeTipo = 'rgba(207, 102, 121, 0.15)';
            corTextoTipo = '#cf6679';
            iconTipo = '🛡️ ';
        } else if (r['TIPO'] === 'MANIFESTAÇÃO') {
            corBadgeTipo = 'rgba(107, 143, 186, 0.15)';
            corTextoTipo = '#6b8fba';
            iconTipo = '📄 ';
        }

        let badgeTipo = r['TIPO']
            ? `<span style="display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; background-color: ${corBadgeTipo}; color: ${corTextoTipo}; border: 1px solid ${corTextoTipo};">${iconTipo}${r['TIPO']}</span>`
            : '-';

        let formatoBadge = '';
        const formatoStr = (r['FISICO/E-MS'] || '').trim().toUpperCase();
        if (formatoStr === 'FÍSICO' || formatoStr === 'FISICO') {
            formatoBadge = `<br><span style="display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; background-color: rgba(211, 84, 0, 0.15); color: #e67e22; border: 1px solid #e67e22;">📦 FÍSICO</span>`;
        } else if (formatoStr === 'E-MS') {
            formatoBadge = `<br><span style="display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; background-color: rgba(46, 160, 67, 0.15); color: #2ea043; border: 1px solid #2ea043;">💻 E-MS</span>`;
        }

        let nupText = r['NUP'] || '-';
        if (r['LINK NUP'] && String(r['LINK NUP']).trim() !== '') {
            nupText += ` <a href="#" onclick="abrirPreviewAuto(event, '${r['LINK NUP']}', '${r['NUP']}')" class="icon-preview-nup" title="Visualizar Documento PDF">🔍</a>`;
        }

        tr.innerHTML = `
            <td style="padding: 12px; white-space: nowrap;">${nupText}${formatoBadge}</td>
            <td style="padding: 12px;">${r['REQUERENTE'] || '-'}</td>
            <td style="padding: 12px;">${r['AUTO DE INFRAÇÃO'] || '-'}</td>
            <td style="padding: 12px;">L: ${r['LAUDO DE CONSTATAÇÃO'] || '-'}<br>N: ${r['NOTIFICAÇÃO'] || '-'}</td>
            <td style="padding: 12px;">${r['DATA DE REPASSE'] || '-'}</td>
            <td style="padding: 12px; vertical-align: middle;">${r['SETOR'] || '-'}<br>${badgeTipo}</td>
            <td style="padding: 12px; font-weight: bold;">${r['STATUS ATUAL'] || '-'}</td>
            <td style="padding: 12px;">${displayTecnico}</td>
        `;
        tbody.appendChild(tr);
    });
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
                    <div class="preview-toolbar-title" style="display: flex; align-items: center;">
                        ${iconeOlhoGrande} Pré-visualização de Documento
                    </div>
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

    let corBadgeTipo = '#333';
    let corTextoTipo = '#ccc';
    let iconTipo = '';
    if (linha['TIPO'] === 'CONTRADITA') {
        corBadgeTipo = 'rgba(207, 102, 121, 0.15)';
        corTextoTipo = '#cf6679';
        iconTipo = '🛡️ ';
    } else if (linha['TIPO'] === 'MANIFESTAÇÃO') {
        corBadgeTipo = 'rgba(107, 143, 186, 0.15)';
        corTextoTipo = '#6b8fba';
        iconTipo = '📄 ';
    }

    let badgeTipo = linha['TIPO']
        ? `<span style="display: inline-block; margin-top: 6px; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 800; letter-spacing: 0.5px; background-color: ${corBadgeTipo}; color: ${corTextoTipo}; border: 1px solid ${corTextoTipo};">${iconTipo}${linha['TIPO']}</span>`
        : '-';

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
    opcoesAutoTecnico.forEach(opt => {
        const el = document.createElement('option');
        el.value = opt; el.textContent = opt;
        select.appendChild(el);
    });
    document.getElementById('atribuirTecnicoModal').style.display = 'flex';
}

function fecharModalAtribuirTecnico() {
    document.getElementById('atribuirTecnicoModal').style.display = 'none';
}

async function salvarAtribuicaoTecnico() {
    const nup = document.getElementById('atrAutoNup').value;
    const tecnico = document.getElementById('atrAutoTecnico').value;

    if (!tecnico) {
        mostrarToast('Selecione um técnico para atribuir.', 'error');
        return;
    }

    const btn = document.getElementById('btnSalvarAtribuicao');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Salvando...';
    btn.disabled = true;

    const payload = {
        acao: "atribuir_tecnico_auto",
        nup: nup,
        tecnico: tecnico
    };

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Técnico atribuído com sucesso!', 'success');

            const autoRef = dadosAutosGlobais.find(a => a['NUP'] === nup);
            if (autoRef) {
                autoRef['TÉCNICO'] = tecnico;
            }

            fecharModalAtribuirTecnico();
            filtrarAutos();
        } else {
            mostrarToast('Erro: ' + resultado.message, 'error');
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Erro ao atribuir técnico.', 'error');
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
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
        // Ignorar ofícios misturados (garantir que é um Auto)
        const tipoRow = String(r['TIPO'] || '').toUpperCase().trim();
        const hasAutoInfo = (r['AUTO DE INFRAÇÃO'] && String(r['AUTO DE INFRAÇÃO']).trim() !== '');
        const isAuto = tipoRow === 'CONTRADITA' || tipoRow === 'MANIFESTAÇÃO' || hasAutoInfo;
        if (!isAuto) return false;

        const matchNup = !nup || (r['NUP'] && String(r['NUP']).toLowerCase().includes(nup));
        const matchReq = !req || (r['REQUERENTE'] && String(r['REQUERENTE']).toLowerCase().includes(req));
        const matchInf = !inf || (r['AUTO DE INFRAÇÃO'] && String(r['AUTO DE INFRAÇÃO']).toLowerCase().includes(inf));
        const matchLaudo = !laudo || (r['LAUDO DE CONSTATAÇÃO'] && String(r['LAUDO DE CONSTATAÇÃO']).toLowerCase().includes(laudo));
        const matchNotif = !notif || (r['NOTIFICAÇÃO'] && String(r['NOTIFICAÇÃO']).toLowerCase().includes(notif));

        const matchSetor = setorMulti.length === 0 || setorMulti.includes('todos') || setorMulti.includes(r['SETOR']);
        const matchTecnico = tecnicoMulti.length === 0 || tecnicoMulti.includes('todos') || tecnicoMulti.includes(r['TÉCNICO']);
        const matchStatus = statusMulti.length === 0 || statusMulti.includes('todos') || statusMulti.includes(r['STATUS ATUAL']);

        return matchNup && matchReq && matchInf && matchLaudo && matchNotif && matchSetor && matchTecnico && matchStatus;
    });

    renderTabelaAutos(filtrados);
}

async function carregarAutos() {
    if (autosCarregados) return;
    document.getElementById('loading-autos').style.display = 'block';

    try {
        const payload = { acao: "buscar_autos" };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
                dadosAutosGlobais = resultado.dados.filter(linha => {
                    const tecnicoLinha = (linha['TÉCNICO'] || '').toUpperCase().trim();
                    const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
                    return tecnicoLinha === tecnicoLogado;
                });
            } else {
                dadosAutosGlobais = resultado.dados;
            }
            popularOpcoesAuto();
            filtrarAutos();
            autosCarregados = true;
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Erro ao carregar Autos de Infração.', 'error');
    } finally {
        document.getElementById('loading-autos').style.display = 'none';
    }
}

async function salvarNovoAuto() {
    const nup = document.getElementById('cadAutoNup').value.trim();
    const req = document.getElementById('cadAutoRequerente').value.trim();

    if (!nup || !req) {
        mostrarToast('NUP e Requerente são obrigatórios!', 'error');
        return;
    }

    const btn = document.getElementById('btnSalvarCadastroAuto');
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando (Pode demorar devido ao PDF)...';
    btn.disabled = true;

    const fileInput = document.getElementById('cadAutoArquivo');
    let base64File = null;
    let fileName = null;

    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 15 * 1024 * 1024) {
            mostrarToast('Erro: O arquivo deve ter no máximo 15MB', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            return;
        }
        fileName = file.name;
        try {
            base64File = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } catch (e) {
            mostrarToast('Erro ao ler o arquivo', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            return;
        }
    }

    const payload = {
        acao: "cadastrar_auto",
        nup: nup,
        requerente: req,
        auto_infracao: document.getElementById('cadAutoInfracao').value.trim(),
        laudo: document.getElementById('cadAutoLaudo').value.trim(),
        notificacao: document.getElementById('cadAutoNotificacao').value.trim(),
        data_repasse: document.getElementById('cadAutoData').value,
        setor: document.getElementById('cadAutoSetor').value,
        status_atual: document.getElementById('cadAutoStatus').value,
        tipo: document.getElementById('cadAutoTipo').value,
        tecnico: document.getElementById('cadAutoTecnico').value,
        fisico_ems: document.getElementById('cadAutoFisicoEms').value,
        base64: base64File,
        fileName: fileName
    };

    // OPTIMISTIC UPDATE: Atualiza a interface instantaneamente
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
        'FISICO/E-MS': payload.fisico_ems
    };

    dadosAutosGlobais.unshift(novoItem);
    fecharModalCadastroAuto();
    filtrarAutos();
    mostrarToast('Auto lançado localmente. Sincronizando em background...', 'success');

    btn.innerHTML = textoOriginal;
    btn.disabled = false;

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Auto sincronizado com a nuvem com sucesso!', 'success');
        } else {
            mostrarToast('Erro: ' + resultado.message + ' (Revertendo)', 'error');
            dadosAutosGlobais = dadosAutosGlobais.filter(item => item !== novoItem);
            filtrarAutos();
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Falha na internet ao salvar Auto. (Revertendo)', 'error');
        dadosAutosGlobais = dadosAutosGlobais.filter(item => item !== novoItem);
        filtrarAutos();
    }
}

iniciarSistema();