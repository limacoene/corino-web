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
let dadosExibidos = [];  

function obterStatusVisual(linha) {
    const status = (linha['STATUS'] || '').toUpperCase().trim();
    const diasStr = (linha['DIAS RESTANTES'] || '').toString().trim();

    if (status === 'ARQUIVADO' || status === 'TRAMITADO') return { texto: '✅ FINALIZADO', classe: 'status-green' };
    if (diasStr === '' || diasStr === '-' || diasStr.toLowerCase() === 'nan') return { texto: '⚪ SEM PRAZO', classe: 'status-gray' };

    const numero = parseInt(diasStr.replace(/[^0-9-]/g, ""));
    if (isNaN(numero)) return { texto: '⚪ SEM PRAZO', classe: 'status-gray' };

    if (numero < 0) return { texto: `⚠️ 🔴 ${Math.abs(numero)} DIAS DE ATRASO`, classe: 'status-red' };
    return { texto: `🟢 ${numero} dias`, classe: 'status-green' };
}

async function iniciarSistema() {
    try {
        const displayDiv = document.getElementById('user-display-name');
        if (displayDiv && usuarioAtivo) {
            let textoPerfil = usuarioAtivo.perfil.includes('gerencia') ? 'GERÊNCIA' : usuarioAtivo.perfil.toUpperCase();
            displayDiv.innerText = `${usuarioAtivo.nomePlanilha} (${textoPerfil})`;
        }

        if (usuarioAtivo && usuarioAtivo.username === 'diflor') {
            const btnResp = document.getElementById('btn-menu-respondidos');
            if (btnResp) btnResp.style.display = 'block';
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
    subAbaAtiva = 'Geral'; 
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
            desenharCards([], true); 
            return; 
        }
        
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
    else if (filtroAtivo === 'andamento') {
        const termoBusca = document.getElementById('andNup').value.toLowerCase();
        const tecs = lerValoresMultiplosNativos('andTecnico');
        const stss = lerValoresMultiplosNativos('andStatus');

        filtrados = filtrados.filter(r => !obterStatusVisual(r).texto.includes('🔴') && !obterStatusVisual(r).texto.includes('FINALIZADO'));
        
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

        filtrados = filtrados.filter(r => obterStatusVisual(r).texto.includes('🔴'));
        
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

        filtrados = filtrados.filter(r => r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-' && r['STATUS'] !== 'TRAMITADO' && r['STATUS'] !== 'ARQUIVADO');
        
        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca);
            r._matchInfo = busca.info;
            return busca.match
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']));
        });
        document.getElementById('alerta-respondidos').innerText = `📁 Há ${filtrados.length} processos com respostas anexadas aguardando revisão.`;
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
    const textoItens = qtd === 1 ? '1 item' : `${qtd} itens`;
    const textoResultados = qtd === 1 ? '1 resultado' : `${qtd} resultados`;
    document.getElementById('btnExport').innerText = `📥 Exportar lista filtrada (${textoItens})`;
    
    const contadorProcessos = document.getElementById('contador-processos');
    if (filtroAtivo === 'todos') {
        contadorProcessos.style.display = 'block';
        contadorProcessos.innerText = `Exibindo ${textoResultados}.`;
    } else {
        contadorProcessos.style.display = 'none';
    }

    if (dados.length === 0) { 
        container.innerHTML = '<h3 style="color: #666; width: 100%; grid-column: 1 / -1; animation: fadeInSlideUp 0.3s ease forwards;">Nenhum registo encontrado com estes critérios.</h3>'; 
        return; 
    }

    dados.forEach((linha, index) => {
        const statusVisual = obterStatusVisual(linha);
        const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();
        
        let percentual = 100;
        let corBarra = '#aaaaaa';
        let pulsingClass = '';
        
        if (statusVisual.texto.includes('FINALIZADO')) {
            percentual = 100; corBarra = '#00fa9a'; 
        } else if (statusVisual.texto.includes('SEM PRAZO')) {
            percentual = 0; corBarra = '#333333'; 
        } else if (statusVisual.texto.includes('ATRASO')) {
            percentual = 100; corBarra = '#ff4b4b'; pulsingClass = 'pulse-bar'; 
        } else {
            const diasStr = (linha['DIAS RESTANTES'] || '').toString().trim();
            const numero = parseInt(diasStr.replace(/[^0-9-]/g, ""));
            if (!isNaN(numero)) {
                // Preenche a barra simulando um prazo máximo "confortável" de 30 dias
                percentual = Math.max(5, (numero / 30) * 100); 
                if (numero <= 5) {
                    corBarra = '#ffa500'; // Laranja alerta
                    pulsingClass = 'pulse-bar-warning';
                } else {
                    corBarra = '#00fa9a'; // Verde OK
                }
            }
        }
        
        let barraProgressoHtml = `
            <div class="progress-container" title="Indicador de Prazo">
                <div class="progress-bar ${pulsingClass}" style="width: ${Math.min(percentual, 100)}%; background-color: ${corBarra};"></div>
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

        div.innerHTML = `
            <div class="card-status ${statusVisual.classe}">${statusVisual.texto}</div>
            ${barraProgressoHtml}
            ${htmlMatchInfo}
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

function abrirModal(index) {
    const linha = dadosExibidos[index];
    const modal = document.getElementById('detalhesModal');
    const modalBody = document.getElementById('modalBody');
    const statusVisual = obterStatusVisual(linha);
    const obs = (linha['OBSERVAÇÃO'] || '').trim();
    const linkRaw = linha['LINK_OFICIO'] || '';
    const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();

    let htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="modal-obs"><strong>Observação:</strong><br>${obs}</div>` : '';
    let htmlPreviewIcon = '';
    let htmlLink = `<div style="text-align:center; color:#666; font-weight:bold; padding: 12px; border: 1px dashed #333; border-radius: 6px;">🚫 Sem Link Vinculado</div>`;
    let btnAnexar = '';
    
    if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
        btnAnexar = `<button onclick="anexarDocumento(event, '${linha['NUP']}')" class="btn-drive btn-upload">📎 Anexar Resposta</button>`;
    }

    if (linkRaw && linkRaw.startsWith('http')) {
        const fileId = extrairIdDrive(linkRaw);
        if (fileId) {
            const linkPreview = `https://drive.google.com/file/d/${fileId}/preview`;
            const linkDownload = `https://drive.google.com/uc?export=download&id=${fileId}`;
            htmlPreviewIcon = `<button onclick="abrirPreview('${linkPreview}', ${index})" class="btn-inline-preview" title="Pré-visualizar Ofício"></button>`;
            htmlLink = `
                <div class="modal-buttons">
                    <a href="${linkDownload}" class="btn-drive btn-download">⬇️ Download</a>
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
                <div style="margin-bottom: 8px;">🚦 <strong>Situação:</strong> <span class="${statusVisual.classe}">${statusVisual.texto}</span></div>
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
                        <a id="btn-preview-download" href="#" target="_blank" class="btn-preview-action btn-download-preview">⬇️ Download</a>
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

    const linha = dadosExibidos[index];
    const statusVisual = obterStatusVisual(linha);
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
        <div class="preview-info-item">🚦 <strong>Situação:</strong> <span class="${statusVisual.classe}">${statusVisual.texto}</span></div>
        ${htmlObs}
        ${htmlHistoricoPreview}
    `;

    document.getElementById('previewFrame').src = url;
    
    const btnDownload = document.getElementById('btn-preview-download');
    if (btnDownload) {
        const fileId = extrairIdDrive(url);
        if (fileId) {
            btnDownload.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
            btnDownload.style.display = 'inline-flex';
        } else if (url && url.trim() !== '') {
            btnDownload.href = url;
            btnDownload.style.display = 'inline-flex';
        } else {
            btnDownload.style.display = 'none';
        }
    }
    
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

iniciarSistema();

// ============================================================================
// SISTEMA KONAMI CODE (SANDBOX)
// ============================================================================
const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
let konamiPos = 0;

document.addEventListener('keydown', (e) => {
    // Ignora se estiver a escrever num input (pesquisa)
    if (e.target.tagName === 'INPUT') return; 

    if (e.key === konamiCode[konamiPos]) {
        konamiPos++;
        if (konamiPos === konamiCode.length) {
            abrirStreetFighter();
            konamiPos = 0;
        }
    } else {
        konamiPos = 0;
    }
});

function abrirStreetFighter() {
    const modal = document.getElementById('sf-modal');
    const iframe = document.getElementById('sf-iframe');
    
    if (modal && iframe) {
        modal.style.display = 'flex';
        // Só injeta o jogo quando a janela abre (poupa memória!)
        iframe.src = 'game/jogo.html'; 
    }
}

function fecharStreetFighter() {
    const modal = document.getElementById('sf-modal');
    const iframe = document.getElementById('sf-iframe');
    
    if (modal && iframe) {
        modal.style.display = 'none';
        // Arranca o jogo da memória e corta o som imediatamente
        iframe.src = ''; 
    }
}