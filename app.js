const usuarioAtivo = JSON.parse(sessionStorage.getItem('corino_user'));

if (!usuarioAtivo) {
    window.location.href = 'login.html';
} else {
    if (usuarioAtivo.perfil === 'gerencia_consulta') {
        const btnAndamento = document.getElementById('btn-menu-andamento');
        const btnAtrasados = document.getElementById('btn-menu-atrasados');
        if (btnAndamento) btnAndamento.style.display = 'none';
        if (btnAtrasados) btnAtrasados.style.display = 'none';
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
window.onscroll = function() { gerirBotaoTopo() };

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
    const diasStr = (linha['DIAS RESTANTES'] || '').toString().trim();

    if (status === 'ARQUIVADO' || status === 'TRAMITADO') return { texto: '✅ FINALIZADO', classe: 'status-green' };
    if (diasStr === '' || diasStr === '-' || diasStr.toLowerCase() === 'nan') return { texto: '⚪ SEM PRAZO', classe: 'status-gray' };

    const numero = parseInt(diasStr.replace(/[^0-9-]/g, ""));
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
    
    const diasStr = (linha['DIAS RESTANTES'] || '').toString().trim();
    const numeroDiasRestantes = parseInt(diasStr.replace(/[^0-9-]/g, ""));
    const MAX_PRAZO_VISUAL = 30; 

    if (statusVisual.texto.includes('FINALIZADO')) {
        percentual = 100; corFundo = '#00fa9a';
    } else if (isNaN(numeroDiasRestantes) || diasStr === '' || diasStr === '-') {
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
        if(!dropdown || !display) return;

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
        if(chk.value === valor) chk.checked = false;
    });
    const placeholderText = document.getElementById(`ms-${idBase}`).getAttribute('data-placeholder');
    atualizarDisplayNativo(idBase, placeholderText);
    aplicarFiltros();
}

function toggleDropdown(idBase) {
    document.querySelectorAll('.ms-dropdown').forEach(dd => {
        if(dd.id !== `dd-${idBase}`) dd.style.display = 'none';
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
    
    atualizarVisualSubAbas();
    limparInputsDeFiltro();
    aplicarFiltros();
    
    // ==========================================
    // ROLA A PÁGINA PARA O TOPO AO TROCAR DE ABA
    // ==========================================
    scrollToTop();
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
    if(container) {
        Array.from(container.children).forEach(btn => {
            if(btn.textContent === subAbaAtiva) btn.classList.add('active');
        });
    }
}

function limparInputsDeFiltro() {
    ['cgNup', 'cgCarms', 'andNup', 'atrNup', 'respNup'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
    const idsCustom = ['cgGerencia', 'cgMunicipio', 'cgStatus', 'cgTecnico', 'andTecnico', 'andStatus', 'atrTecnico', 'atrStatus', 'respTecnico'];
    idsCustom.forEach(idBase => {
        const dropdown = document.getElementById(`dd-${idBase}`);
        if(dropdown) {
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

function checarTermoBusca(r, termo) {
    if (!termo) return { match: true, info: null };
    
    if (r['NUP'] && r['NUP'].toLowerCase().includes(termo)) return { match: true, info: null };
    
    const oficioPrincipal = (r['OFÍCIO N.'] || r['OFÍCIO'] || '').toLowerCase();
    if (oficioPrincipal.includes(termo)) return { match: true, info: null };
    
    const oficioInicial = (r['OFICIO_INICIAL'] || '').toLowerCase();
    if (oficioInicial.includes(termo)) return { match: true, info: `📌 Encontrado no Ofício Inicial: <strong>${r['OFICIO_INICIAL'].replace(/\.pdf/gi, '')}</strong>` };
    
    const nupInicial = (r['NUP_INICIAL'] || '').toLowerCase();
    if (nupInicial.includes(termo)) return { match: true, info: `📌 Encontrado no NUP Inicial: <strong>${r['NUP_INICIAL']}</strong>` };
    
    if (r['REITERACOES'] && r['REITERACOES'].length > 0) {
        for (let i = 0; i < r['REITERACOES'].length; i++) {
            const reit = r['REITERACOES'][i];
            if (reit.NUMERO && reit.NUMERO.toLowerCase().includes(termo)) {
                return { match: true, info: `📌 Encontrado na ${i+1}ª Reiteração: <strong>${reit.NUMERO.replace(/\.pdf/gi, '')}</strong>` };
            }
            if (reit.NUP && reit.NUP.toLowerCase().includes(termo)) {
                return { match: true, info: `📌 Encontrado no NUP da ${i+1}ª Reiteração: <strong>${reit.NUP}</strong>` };
            }
        }
    }
    return { match: false, info: null };
}

function aplicarFiltros() {
    let filtrados = dadosCoringa;

    if (filtroAtivo === 'todos') {
        const termoBusca = document.getElementById('cgNup').value.toLowerCase().trim();
        const carms = document.getElementById('cgCarms').value.toLowerCase().trim();
        const gersRaw = lerValoresMultiplosNativos('cgGerencia');
        const munsRaw = lerValoresMultiplosNativos('cgMunicipio');
        const stssRaw = lerValoresMultiplosNativos('cgStatus');
        const tecsRaw = lerValoresMultiplosNativos('cgTecnico');
        
        const temFiltroAtivo = termoBusca || carms || gersRaw.length > 0 || munsRaw.length > 0 || stssRaw.length > 0 || tecsRaw.length > 0;
        
        if (!temFiltroAtivo) { 
            if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
                filtrados = filtrados.filter(r => obterStatusVisual(r).texto.includes('FINALIZADO'));
            } else {
                desenharCards([], true); 
                return; 
            }
        } else {
            filtrados = filtrados.filter(r => {
                const busca = checarTermoBusca(r, termoBusca);
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
        const termoBusca = document.getElementById('andNup').value.toLowerCase();
        const tecs = lerValoresMultiplosNativos('andTecnico');
        const stss = lerValoresMultiplosNativos('andStatus');

        filtrados = filtrados.filter(r => !obterStatusVisual(r).texto.includes('🔴') && !obterStatusVisual(r).texto.includes('FINALIZADO') && !(r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-' && (r['STATUS_RESPOSTA'] || '').toUpperCase() !== 'REPROVADO') && (r['STATUS'] || '').toUpperCase() !== 'REVISÃO');
        
        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca);
            r._matchInfo = busca.info;
            return (subAbaAtiva === 'Geral' || r['GERÊNCIA'] === subAbaAtiva)
                && busca.match
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']))
                && (stss.length === 0 || stss.includes('todos') || stss.includes(r['STATUS']));
        });

        filtrados.sort((a, b) => {
            let diasA = parseInt((a['DIAS RESTANTES'] || '').toString().replace(/[^0-9-]/g, ""));
            let diasB = parseInt((b['DIAS RESTANTES'] || '').toString().replace(/[^0-9-]/g, ""));
            
            let aTemPrazo = !isNaN(diasA);
            let bTemPrazo = !isNaN(diasB);

            if (aTemPrazo && bTemPrazo) {
                if (diasA !== diasB) return diasA - diasB;
            } else if (aTemPrazo && !bTemPrazo) {
                return -1;
            } else if (!aTemPrazo && bTemPrazo) {
                return 1;
            }

            const converterDataBR = (str) => {
                if (!str || str === '-') return Infinity; 
                const partes = str.split('/');
                if (partes.length === 3) {
                    return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
                }
                return new Date(str).getTime() || Infinity;
            };

            return converterDataBR(a['DATA']) - converterDataBR(b['DATA']);
        });

        document.getElementById('alerta-andamento').innerText = `ℹ️ Há ${filtrados.length} processos em andamento ${obterNomeSetorFormatado(subAbaAtiva)}.`;
    } 
    else if (filtroAtivo === 'atrasados') {
        const termoBusca = document.getElementById('atrNup').value.toLowerCase();
        const tecs = lerValoresMultiplosNativos('atrTecnico');
        const stss = lerValoresMultiplosNativos('atrStatus');

        filtrados = filtrados.filter(r => obterStatusVisual(r).texto.includes('🔴') && !(r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-' && (r['STATUS_RESPOSTA'] || '').toUpperCase() !== 'REPROVADO') && (r['STATUS'] || '').toUpperCase() !== 'REVISÃO');
        
        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca);
            r._matchInfo = busca.info;
            return (subAbaAtiva === 'Geral' || r['GERÊNCIA'] === subAbaAtiva)
                && busca.match
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']))
                && (stss.length === 0 || stss.includes('todos') || stss.includes(r['STATUS']));
        });

        filtrados.sort((a, b) => {
            const numA = parseInt(a['DIAS RESTANTES'].toString().replace(/[^0-9-]/g, "")) || 0;
            const numB = parseInt(b['DIAS RESTANTES'].toString().replace(/[^0-9-]/g, "")) || 0;
            return numA - numB;
        });
        document.getElementById('alerta-atrasados').innerText = `⚠️ Atenção - Há ${filtrados.length} processos em atraso ${obterNomeSetorFormatado(subAbaAtiva)}.`;
    }
    else if (filtroAtivo === 'respondidos') {
        const termoBusca = document.getElementById('respNup').value.toLowerCase();
        const tecs = lerValoresMultiplosNativos('respTecnico');

        filtrados = filtrados.filter(r => ( (r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-') || (r['STATUS'] || '').toUpperCase() === 'REVISÃO' ) && r['STATUS'] !== 'TRAMITADO' && r['STATUS'] !== 'ARQUIVADO');
        
        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca);
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

function extrairIdDrive(url) {
    let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return null;
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

    let htmlResposta = '';
    const linkResposta = linha['LINK_RESPOSTA'];
    if (linkResposta && linkResposta.startsWith('http')) {
        const respId = extrairIdDrive(linkResposta);
        let botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive" style="background-color: #ffa500; border-color: #cc8400;">🔗 Abrir Resposta no Drive</a>`;
        if (respId) {
            const respPreview = `https://drive.google.com/file/d/${respId}/preview`;
            botaoResp = `<button onclick="abrirPreview('${respPreview}', ${index})" class="btn-drive" style="background-color: #ffa500; border-color: #cc8400; border:none;">👁️ Pré-visualizar Resposta</button>`;
        }
        
        htmlResposta = `
            <div style="margin: 20px 20px 0 20px; padding: 15px; background-color: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 6px;">
                <div style="color: #ffa500; font-weight: bold; margin-bottom: 10px;">📁 Documento de Resposta Anexado:</div>
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
        <div class="modal-footer" style="padding-top: 20px;">${htmlLink}</div>
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
                        <a id="btn-download-preview" href="#" class="btn-preview-action" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; background-color: rgba(0, 250, 154, 0.1); border: 1px solid #00fa9a; color: #00fa9a;" download title="Fazer download deste documento" onclick="feedbackDownload(this)">⬇️ Baixar Documento</a>
                        
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
                 <button onclick="document.getElementById('previewFrame').src='${oficioPreviewUrl}'; document.getElementById('btn-download-preview').href='${downloadOficioUrlFull}';" class="btn-drive" style="flex: 1; padding: 10px; background-color: #1a252f; border-color: #2c3e50; font-size: 12px;">📜 Ver Ofício</button>
                 <button onclick="document.getElementById('previewFrame').src='${respPreviewUrl}'; document.getElementById('btn-download-preview').href='${downloadRespUrlFull}';" class="btn-drive" style="flex: 1; padding: 10px; background-color: #ffa500; border-color: #cc8400; font-size: 12px; color: white;">📁 Ver Resposta</button>
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

window.onclick = function(event) { 
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

iniciarSistema();