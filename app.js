const usuarioAtivo = JSON.parse(sessionStorage.getItem('corino_user'));

if (!usuarioAtivo) {
    window.location.href = 'login.html';
} else {
    // Ocultar aba de Aguardando Distribuição para quem não for da Diretoria
    // Ocultar aba de Aguardando Distribuição para quem não for Gerência (DIFLOR, GCAR, GEAA)
    if (!usuarioAtivo.perfil.startsWith('gerencia') || usuarioAtivo.perfil === 'gerencia_consulta') {
        const btnDistribuicao = document.getElementById('btn-menu-distribuicao');
        if (btnDistribuicao) btnDistribuicao.style.display = 'none';

        const btnCartasDistribuicao = document.getElementById('btn-menu-cartas-distribuicao');
        if (btnCartasDistribuicao) btnCartasDistribuicao.style.display = 'none';
    }

    if (usuarioAtivo.perfil === 'gerencia_consulta') {
        const btnAndamento = document.getElementById('btn-menu-andamento');
        const btnAtrasados = document.getElementById('btn-menu-atrasados');
        const btnRespondidos = document.getElementById('btn-menu-respondidos');

        if (btnAndamento) btnAndamento.style.display = 'none';
        if (btnAtrasados) btnAtrasados.style.display = 'none';
        if (btnRespondidos) btnRespondidos.style.display = 'none';

        const btnCartasAndamento = document.getElementById('btn-menu-cartas-andamento');
        const btnCartasAtrasados = document.getElementById('btn-menu-cartas-atrasados');
        const btnCartasRevisao = document.getElementById('btn-menu-cartas-revisao');
        const btnCartasAssinatura = document.getElementById('btn-menu-cartas-assinatura');

        if (btnCartasAndamento) btnCartasAndamento.style.display = 'none';
        if (btnCartasAtrasados) btnCartasAtrasados.style.display = 'none';
        if (btnCartasRevisao) btnCartasRevisao.style.display = 'none';
        if (btnCartasAssinatura) btnCartasAssinatura.style.display = 'none';
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

// CONTROLE DE INATIVIDADE (DESLOGAR APÓS 8 MINUTOS)
(function iniciarControleInatividade() {
    const TEMPO_LIMITE_INATIVIDADE = 8 * 60 * 1000; // 8 minutos em milissegundos
    let tempoInatividade;

    function resetarTemporizador() {
        clearTimeout(tempoInatividade);
        tempoInatividade = setTimeout(deslogarPorInatividade, TEMPO_LIMITE_INATIVIDADE);
    }

    function deslogarPorInatividade() {
        console.warn("Usuário inativo por mais de 8 minutos. Efetuando logout...");
        sessionStorage.setItem('corino_logout_reason', 'inactivity');
        fazerLogout();
    }

    // Ouvintes para capturar qualquer atividade do usuário
    const eventos = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll', 'click'];
    eventos.forEach(evento => {
        window.addEventListener(evento, resetarTemporizador, { passive: true });
    });

    // Inicializa o temporizador ao carregar a página
    resetarTemporizador();
})();


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
let incluirReiteracoes = false;
let dadosExibidos = [];

function atualizarCacheOficios() {
    const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
    const keyOficios = `corino_cache_dados_coringa_${username}`;
    localStorage.setItem(keyOficios, JSON.stringify(dadosCoringa));
    if (typeof window.limparCacheHistoricoGlobal === 'function') window.limparCacheHistoricoGlobal();
}

function obterStatusVisual(linha) {
    const status = (linha['STATUS'] || '').toUpperCase().trim();

    if (status === 'ARQUIVADO' || status === 'TRAMITADO' || status === 'FINALIZADO') return { texto: '✅ FINALIZADO', classe: 'status-green' };

    const numero = extrairDiasRestantes(linha['DIAS RESTANTES']);
    if (isNaN(numero)) return { texto: '⚪ SEM PRAZO', classe: 'status-gray' };

    if (numero < 0) return { texto: `⚠️ 🔴 ${Math.abs(numero)} DIAS DE ATRASO`, classe: 'status-red' };
    if (numero === 0) return { texto: ' VENCE HOJE', classe: 'status-yellow' };
    if (numero === 1) return { texto: `🟢 ${numero} DIA RESTANTE`, classe: 'status-green' };

    return { texto: `🟢 ${numero} DIAS RESTANTES`, classe: 'status-green' };
}

function obterInfoDinamicaStatus(linha) {
    const statusVisual = obterStatusVisual(linha);
    let percentual = 100;
    let corFundo = 'transparent';
    let pulsingClass = '';

    const numeroDiasRestantes = extrairDiasRestantes(linha['DIAS RESTANTES']);
    const MAX_PRAZO_VISUAL = 30;

    if (statusVisual.texto.includes('FINALIZADO')) {
        percentual = 100; corFundo = 'var(--status-finalizado, #00fa9a)';
    } else if (isNaN(numeroDiasRestantes)) {
        percentual = 0; corFundo = 'transparent';
    } else {
        if (numeroDiasRestantes < 0) {
            percentual = 100; corFundo = 'var(--status-atrasado, #ff4b4b)'; pulsingClass = 'pulse-bar';
        } else {
            const diasDecorridosVisual = MAX_PRAZO_VISUAL - numeroDiasRestantes;
            percentual = Math.min(Math.max(0, (diasDecorridosVisual / MAX_PRAZO_VISUAL) * 100), 99);
            const hue = 120 - (percentual * 1.2);
            corFundo = `hsl(${hue}, var(--status-saturation, 100%), var(--status-lightness, 50%))`;
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

        if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.perfil === 'gerencia_gcar' || usuarioAtivo.perfil === 'gerencia_geaa' || usuarioAtivo.perfil === 'tecnico')) {
            const btnResp = document.getElementById('btn-menu-respondidos');
            if (btnResp) btnResp.style.display = 'block';

            const btnCartasResp = document.getElementById('btn-menu-cartas-revisao');
            if (btnCartasResp) btnCartasResp.style.display = 'block';
        }

        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            ['btn-tab-aprovados', 'btn-tab-reprovados', 'btn-tab-todos'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Ocultar sub-abas exclusivas de gerência para o perfil técnico
            const subAbasGerencia = [
                'btn-menu-comunicacao', 'btn-menu-assinatura-oficios',
                'btn-menu-cartas-despacho', 'btn-menu-cartas-assinatura',
                'btn-menu-externos-despacho', 'btn-menu-externos-assinatura'
            ];
            subAbasGerencia.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Ocultar filtros de Técnico de todas as telas para o perfil técnico
            const filtrosTecnico = [
                'ms-cgTecnico', 'ms-andTecnico', 'ms-atrTecnico',
                'respTecnico', 'ms-autoTecnico', 'filtro-ext-tecnico',
                'filtro-cartas-tec'
            ];
            filtrosTecnico.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const parent = el.closest('.filter-group');
                    if (parent) parent.style.display = 'none';
                }
            });

            // Ocultar mini-tabs de setores para o perfil técnico
            const miniTabsSetores = [
                'mini-tabs-distribuicao', 'mini-tabs-andamento', 'mini-tabs-atrasados',
                'mini-tabs-cartas', 'mini-tabs-externos'
            ];
            miniTabsSetores.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });

            // Ocultar filtro avançado de Gerência (CARMS) para o perfil técnico
            const filtrosGerencia = ['cgCarms', 'ms-cgGerencia', 'filtro-ext-carms'];
            filtrosGerencia.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const parent = el.closest('.filter-group');
                    if (parent) parent.style.display = 'none';
                }
            });
        } else {
            // Garantir que estejam visíveis para gerência/diretoria
            const subAbasGerencia = [
                'btn-menu-comunicacao', 'btn-menu-assinatura-oficios',
                'btn-menu-cartas-despacho', 'btn-menu-cartas-assinatura',
                'btn-menu-externos-despacho', 'btn-menu-externos-assinatura'
            ];
            subAbasGerencia.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'block';
            });

            const filtrosTecnico = [
                'ms-cgTecnico', 'ms-andTecnico', 'ms-atrTecnico',
                'respTecnico', 'ms-autoTecnico', 'filtro-ext-tecnico',
                'filtro-cartas-tec'
            ];
            filtrosTecnico.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const parent = el.closest('.filter-group');
                    if (parent) parent.style.display = '';
                }
            });

            // Garantir que as mini-tabs de setores de Ofícios Internos estejam visíveis para gerência/diretoria
            const miniTabsSetoresOficios = [
                'mini-tabs-distribuicao', 'mini-tabs-andamento', 'mini-tabs-atrasados'
            ];
            miniTabsSetoresOficios.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'flex';
            });

            // Garantir que os filtros avançados de gerência estejam visíveis para gerência/diretoria
            const filtrosGerencia = ['cgCarms', 'ms-cgGerencia', 'filtro-ext-carms'];
            filtrosGerencia.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const parent = el.closest('.filter-group');
                    if (parent) parent.style.display = '';
                }
            });
        }

        const username = usuarioAtivo ? usuarioAtivo.username : 'guest';
        const keyOficios = `corino_cache_dados_coringa_${username}`;

        // Migrar dados temporários pré-carregados se existirem
        const tempRawDados = localStorage.getItem('corino_temp_raw_dados');
        if (tempRawDados) {
            try {
                const dadosBrutos = JSON.parse(tempRawDados);
                const dadosProcessados = dadosBrutos.map(limparEPadronizarLinha);
                
                let novosDados = [];
                if (usuarioAtivo) {
                    novosDados = dadosProcessados.filter(linha => {
                        const tec = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
                        const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
                        const statusGeral = (linha['STATUS'] || '').toUpperCase().trim();
                        const statusVisual = obterStatusVisual(linha);
                        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || statusGeral === 'TRAMITADO' || statusGeral === 'ARQUIVADO' || statusGeral.includes('FINALIZADO');

                        if (semTecnico && isFinalizado && !usuarioAtivo.perfil.startsWith('gerencia')) {
                            return false;
                        }

                        if (usuarioAtivo.perfil === 'tecnico') {
                            const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
                            if (tec !== tecnicoLogado) {
                                return false;
                            }
                        }

                        // Gerências setoriais (GCAR / GEAA) só visualizam processos de competência direta
                        if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.perfil.startsWith('gerencia')) {
                            if (!semTecnico) {
                                const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tec] || 'S/G';
                                if (setorInternoDoTecnico !== usuarioAtivo.setor) return false;
                            } else {
                                const gerenciaRegistro = (linha['GERÊNCIA'] || '').trim().toUpperCase();
                                if (gerenciaRegistro !== usuarioAtivo.setor) return false;
                            }
                        }

                        return true;
                    });
                } else {
                    novosDados = dadosProcessados;
                }

                localStorage.setItem(keyOficios, JSON.stringify(novosDados));
                localStorage.removeItem('corino_temp_raw_dados');
                console.log("Ofícios pré-carregados aplicados com sucesso ao cache do usuário logado.");
            } catch (e) {
                console.error("Erro ao processar dados pré-carregados de Ofícios:", e);
            }
        }

        const cacheSalvo = localStorage.getItem(keyOficios);
        let carregouDeCache = false;

        if (cacheSalvo) {
            try {
                dadosCoringa = JSON.parse(cacheSalvo);
                if (Array.isArray(dadosCoringa)) {
                    dadosCoringa.forEach(linha => {
                        const diasRestantesVal = calcularDiasRestantes(linha['DATA'], linha['PRAZO']);
                        linha['DIAS RESTANTES'] = !isNaN(diasRestantesVal) ? String(diasRestantesVal) : '-';
                    });
                }
                carregouDeCache = true;

                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.style.display = 'none';

                ['cgNup', 'andNup', 'atrNup', 'respNup'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.placeholder = 'Pesquisar NUP ou Ofício...';
                });

                popularTodosOsSelectsNativos();

                const toggleReiteracoes = document.getElementById('toggleReiteracoes');
                if (toggleReiteracoes && !toggleReiteracoes.dataset.listenerAdded) {
                    toggleReiteracoes.addEventListener('change', (event) => {
                        incluirReiteracoes = event.target.checked;
                        aplicarFiltros();
                    });
                    toggleReiteracoes.dataset.listenerAdded = 'true';
                }
                atualizarBadgesNotificacao(dadosCoringa);
                mudarAbaPrincipal('todos');
            } catch (e) {
                console.error("Erro ao processar cache de Ofícios:", e);
            }
        }

        buscarDadosGoogleSheets().then(dadosBrutos => {
            if (Array.isArray(dadosBrutos)) {
                dadosBrutos.forEach(linha => {
                    const diasRestantesVal = calcularDiasRestantes(linha['DATA'], linha['PRAZO']);
                    linha['DIAS RESTANTES'] = !isNaN(diasRestantesVal) ? String(diasRestantesVal) : '-';
                });
            }
            let novosDados = [];
            if (usuarioAtivo) {
                novosDados = dadosBrutos.filter(linha => {
                    const tec = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
                    const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
                    const statusGeral = (linha['STATUS'] || '').toUpperCase().trim();
                    const statusVisual = obterStatusVisual(linha);
                    const isFinalizado = statusVisual.texto.includes('FINALIZADO') || statusGeral === 'TRAMITADO' || statusGeral === 'ARQUIVADO' || statusGeral.includes('FINALIZADO');

                    if (semTecnico && isFinalizado && !usuarioAtivo.perfil.startsWith('gerencia')) {
                        return false;
                    }

                    if (usuarioAtivo.perfil === 'tecnico') {
                        const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
                        return tec === tecnicoLogado;
                    }

                    // Gerências setoriais (GCAR / GEAA) só visualizam processos de competência direta
                    if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.perfil.startsWith('gerencia')) {
                        if (!semTecnico) {
                            const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tec] || 'S/G';
                            if (setorInternoDoTecnico !== usuarioAtivo.setor) return false;
                        } else {
                            const gerenciaRegistro = (linha['GERÊNCIA'] || '').trim().toUpperCase();
                            if (gerenciaRegistro !== usuarioAtivo.setor) return false;
                        }
                    }

                    return true;
                });
            } else {
                novosDados = dadosBrutos;
            }

            dadosCoringa = novosDados;
            atualizarCacheOficios();

            const loadingEl = document.getElementById('loading');
            if (loadingEl) loadingEl.style.display = 'none';

            popularTodosOsSelectsNativos();

            const toggleReiteracoes = document.getElementById('toggleReiteracoes');
            if (toggleReiteracoes && !toggleReiteracoes.dataset.listenerAdded) {
                toggleReiteracoes.addEventListener('change', (event) => {
                    incluirReiteracoes = event.target.checked;
                    aplicarFiltros();
                });
                toggleReiteracoes.dataset.listenerAdded = 'true';
            }
            atualizarBadgesNotificacao(dadosCoringa);

            if (filtroAtivo !== 'autos' && !filtroAtivo.startsWith('externos') && !filtroAtivo.startsWith('cartas')) {
                aplicarFiltros();
            }
        }).catch(erro => {
            console.error("Erro ao sincronizar dados em background:", erro);
            if (!carregouDeCache) {
                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.innerText = "Erro ao conectar com a base de dados central.";
            } else {
                mostrarToast("Conexão instável. Exibindo dados do cache offline.", "warning");
            }
        });

        carregarAutos();
        if (typeof carregarCartas === 'function') carregarCartas();
        if (typeof carregarExternos === 'function') carregarExternos();
        carregarHistoricoGlobalBackground();
    } catch (erro) {
        if (!localStorage.getItem(`corino_cache_dados_coringa_${usuarioAtivo ? usuarioAtivo.username : 'guest'}`)) {
            document.getElementById('loading').innerText = "Erro ao conectar com a base de dados central.";
        }
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

    const btnAtivo = document.getElementById(`btn-menu-${tipo}`);
    if (btnAtivo) btnAtivo.classList.add('active');

    document.getElementById('aba-todos').style.display = (tipo === 'todos') ? 'block' : 'none';
    document.getElementById('aba-distribuicao').style.display = (tipo === 'distribuicao') ? 'block' : 'none';
    document.getElementById('aba-andamento').style.display = (tipo === 'andamento') ? 'block' : 'none';
    document.getElementById('aba-atrasados').style.display = (tipo === 'atrasados') ? 'block' : 'none';
    document.getElementById('aba-respondidos').style.display = (tipo === 'respondidos') ? 'block' : 'none';
    document.getElementById('aba-comunicacao').style.display = (tipo === 'comunicacao') ? 'block' : 'none';
    document.getElementById('aba-assinatura-oficios').style.display = (tipo === 'assinatura-oficios') ? 'block' : 'none';
    document.getElementById('aba-autos').style.display = (tipo === 'autos') ? 'block' : 'none';
    document.getElementById('aba-externos').style.display = (tipo.startsWith('externos')) ? 'block' : 'none';
    const abaCartas = document.getElementById('aba-cartas');
    if (abaCartas) abaCartas.style.display = (tipo.startsWith('cartas')) ? 'block' : 'none';

    const fabOficio = document.getElementById('fab-novo-oficio');
    const fabAuto = document.getElementById('fab-novo-auto');
    const fabExterno = document.getElementById('fab-novo-externo');
    const fabCarta = document.getElementById('fab-novo-carta');

    if (fabOficio) fabOficio.style.display = 'none';
    if (fabAuto) fabAuto.style.display = 'none';
    if (fabExterno) fabExterno.style.display = 'none';
    if (fabCarta) fabCarta.style.display = 'none';

    if (usuarioAtivo && usuarioAtivo.perfil !== 'tecnico') {
        if (tipo === 'todos' && fabOficio) fabOficio.style.display = 'flex';

        if (tipo === 'autos' && fabAuto) {
            const modAutosHeader = document.getElementById('header-mod-autos');
            const isAutosModuleVisible = modAutosHeader && modAutosHeader.parentElement.style.display !== 'none';
            if (isAutosModuleVisible) fabAuto.style.display = 'flex';
        }

        if (tipo.startsWith('externos') && fabExterno) fabExterno.style.display = 'flex';

        if (tipo.startsWith('cartas') && fabCarta && (usuarioAtivo.perfil.startsWith('gerencia') || usuarioAtivo.perfil === 'diretoria')) fabCarta.style.display = 'flex';
    }

    if (tipo === 'autos' || tipo.startsWith('externos') || tipo.startsWith('cartas')) {
        document.getElementById('export-section').style.display = 'none';
        document.getElementById('cards-container').innerHTML = ''; // LIMPEZA DA ABA ANTERIOR (CORREÇÃO DE SOBREPOSIÇÃO)
    } else {
        document.getElementById('export-section').style.display = 'block';
    }

    if (tipo === 'autos') {
        carregarAutos();
    }

    if (tipo.startsWith('externos')) {
        carregarExternos();

        let subAba = 'Geral';
        if (tipo === 'externos-distribuicao') {
            subAba = 'Aguard. Distribuição';
        } else if (tipo === 'externos-andamento') {
            subAba = 'Em Andamento';
        } else if (tipo === 'externos-revisao') {
            subAba = 'Aguardando Revisão';
        } else if (tipo === 'externos-despacho') {
            subAba = 'Fazer Despacho';
        } else if (tipo === 'externos-assinatura') {
            subAba = 'Aguardando Assinatura';
        }
        subAbaAtiva = subAba;

        const titleEl = document.querySelector('#aba-externos .page-title');
        if (titleEl) {
            if (tipo === 'externos-distribuicao') {
                titleEl.innerHTML = '📥 Ofícios Externos - Aguardando Distribuição';
            } else if (tipo === 'externos-andamento') {
                titleEl.innerHTML = '⏳ Ofícios Externos - Em Andamento';
            } else if (tipo === 'externos-revisao') {
                titleEl.innerHTML = '📁 Ofícios Externos - Aguardando Revisão';
            } else if (tipo === 'externos-despacho') {
                titleEl.innerHTML = '📢 Ofícios Externos - Fazer Despacho';
            } else if (tipo === 'externos-assinatura') {
                titleEl.innerHTML = '✍️ Ofícios Externos - Aguardando Assinatura';
            } else {
                titleEl.innerHTML = '🏢 Ofícios Externos';
            }
        }

        const isRevisao = (tipo === 'externos-revisao');
        const isConsultaGeral = (tipo === 'externos');
        const isManager = usuarioAtivo && (usuarioAtivo.perfil.startsWith('gerencia') || usuarioAtivo.perfil === 'diretoria');
        
        const miniTabsExternos = document.getElementById('mini-tabs-externos');
        const miniTabsExternosRevisao = document.getElementById('mini-tabs-externos-revisao');
        
        if (miniTabsExternos) miniTabsExternos.style.display = (isManager && !isRevisao && !isConsultaGeral) ? 'flex' : 'none';
        if (miniTabsExternosRevisao) miniTabsExternosRevisao.style.display = (isManager && isRevisao) ? 'flex' : 'none';

        if (isConsultaGeral) {
            if (typeof subAbaExternosAtiva !== 'undefined') subAbaExternosAtiva = 'Geral';
            if (miniTabsExternos) {
                Array.from(miniTabsExternos.children).forEach((btn, idx) => {
                    if (idx === 0) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
        }

        if (typeof filtrarExternos === 'function') {
            filtrarExternos();
        }
    }

    if (tipo.startsWith('cartas')) {
        const filterStatusSelect = document.getElementById('filtro-cartas-status');
        if (filterStatusSelect) {
            if (tipo === 'cartas-distribuicao') {
                filterStatusSelect.value = 'AGUARDANDO DISTRIBUIÇÃO';
            } else if (tipo === 'cartas-andamento') {
                filterStatusSelect.value = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
            } else if (tipo === 'cartas-revisao') {
                filterStatusSelect.value = 'REVISÃO';
            } else if (tipo === 'cartas-despacho') {
                filterStatusSelect.value = 'FAZER DESPACHO';
            } else if (tipo === 'cartas-assinatura') {
                filterStatusSelect.value = 'AGUARDANDO ASSINATURA';
            } else {
                filterStatusSelect.value = ''; // Consulta Geral / Painel de Atrasos
            }
        }

        const titleEl = document.querySelector('#aba-cartas .page-title');
        if (titleEl) {
            if (tipo === 'cartas-distribuicao') {
                titleEl.innerHTML = '📥 Cartas Consulta - Aguardando Distribuição';
            } else if (tipo === 'cartas-andamento') {
                titleEl.innerHTML = '⏳ Cartas Consulta - Em Andamento';
            } else if (tipo === 'cartas-revisao') {
                titleEl.innerHTML = '📁 Cartas Consulta - Aguardando Revisão';
            } else if (tipo === 'cartas-despacho') {
                titleEl.innerHTML = '📢 Cartas Consulta - Fazer Despacho';
            } else if (tipo === 'cartas-assinatura') {
                titleEl.innerHTML = '✍️ Cartas Consulta - Aguardando Assinatura';
            } else if (tipo === 'cartas-atrasados') {
                titleEl.innerHTML = '🚨 Cartas Consulta - Painel de Atrasos';
            } else {
                titleEl.innerHTML = '✉️ Controle de Cartas Consulta';
            }
        }

        const isRevisao = (tipo === 'cartas-revisao');
        const isConsultaGeral = (tipo === 'cartas');
        const isManager = usuarioAtivo && (usuarioAtivo.perfil.startsWith('gerencia') || usuarioAtivo.perfil === 'diretoria');
        
        const miniTabsCartas = document.getElementById('mini-tabs-cartas');
        const miniTabsCartasRevisao = document.getElementById('mini-tabs-cartas-revisao');
        
        if (miniTabsCartas) miniTabsCartas.style.display = (isManager && !isRevisao && !isConsultaGeral) ? 'flex' : 'none';
        if (miniTabsCartasRevisao) miniTabsCartasRevisao.style.display = (isManager && isRevisao) ? 'flex' : 'none';

        if (isConsultaGeral) {
            if (typeof subAbaCartasAtiva !== 'undefined') subAbaCartasAtiva = 'Geral';
            if (miniTabsCartas) {
                Array.from(miniTabsCartas.children).forEach((btn, idx) => {
                    if (idx === 0) btn.classList.add('active');
                    else btn.classList.remove('active');
                });
            }
        }

        if (typeof carregarCartas === 'function') {
            carregarCartas();
        }
        if (typeof aplicarFiltrosCartas === 'function') {
            aplicarFiltrosCartas();
        }
    }

    atualizarVisualSubAbas();
    limparInputsDeFiltro();

    if (tipo !== 'autos' && !tipo.startsWith('externos') && !tipo.startsWith('cartas')) {
        aplicarFiltros();
    }

    scrollToTop();
}

function toggleModule(moduleId) {
    const modules = ['mod-oficios', 'mod-autos', 'mod-externos', 'mod-cartas'];
    modules.forEach(id => {
        const content = document.getElementById(id);
        const header = document.getElementById(`header-${id}`);
        if (id === moduleId) {
            if (content) content.classList.toggle('collapsed');
            if (header) header.classList.toggle('collapsed');
        } else {
            if (content) content.classList.add('collapsed');
            if (header) header.classList.add('collapsed');
        }
    });
}

function setSubAba(aba) {
    subAbaAtiva = aba;
    atualizarVisualSubAbas();
    if (filtroAtivo === 'externos') {
        if (typeof filtrarExternos === 'function') filtrarExternos();
    } else {
        aplicarFiltros();
    }
    scrollToTop();
}

function atualizarVisualSubAbas() {
    document.querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
    
    let idContainer = `mini-tabs-${filtroAtivo}`;
    if (filtroAtivo.startsWith('cartas')) {
        idContainer = 'mini-tabs-cartas';
    }
    
    const container = document.getElementById(idContainer);
    if (container) {
        Array.from(container.children).forEach(btn => {
            if (filtroAtivo.startsWith('cartas')) {
                if (typeof subAbaCartasAtiva !== 'undefined') {
                    if (btn.textContent === subAbaCartasAtiva) btn.classList.add('active');
                } else {
                    btn.classList.add('active');
                }
            } else {
                if (btn.textContent === subAbaAtiva) btn.classList.add('active');
            }
        });
    }
}

function limparInputsDeFiltro() {
    ['cgNup', 'cgCarms', 'andNup', 'atrNup', 'respNup', 'comNup', 'comOficio', 'assNup', 'assOficio', 'filtro-ext-nup', 'filtro-ext-carms', 'filtro-ext-tecnico', 'filtro-ext-remetente', 'filtro-ext-status', 'filtro-cartas-nup', 'filtro-cartas-req'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    const selectTec = document.getElementById('filtro-cartas-tec');
    if (selectTec) selectTec.value = '';
    const selectStatus = document.getElementById('filtro-cartas-status');
    if (selectStatus && !filtroAtivo.startsWith('cartas-')) selectStatus.value = '';
    const selectPrioridade = document.getElementById('filtro-cartas-prioridade');
    if (selectPrioridade) selectPrioridade.value = '';

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
    if (filtroAtivo === 'autos' || filtroAtivo.startsWith('externos') || filtroAtivo.startsWith('cartas')) { // CORREÇÃO DE SOBREPOSIÇÃO
        document.getElementById('cards-container').innerHTML = '';
        document.getElementById('export-section').style.display = 'none';
        return;
    }

    let filtrados = dadosCoringa;

    // Failsafe de Segurança e Restrição de Acesso
    if (usuarioAtivo) {
        filtrados = filtrados.filter(linha => {
            const tec = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
            const statusGeral = (linha['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(linha);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || statusGeral === 'TRAMITADO' || statusGeral === 'ARQUIVADO' || statusGeral.includes('FINALIZADO');

            // 1. Ocultar processos "Sem Técnico" + "Finalizado" para não-gestores
            if (semTecnico && isFinalizado && !usuarioAtivo.perfil.startsWith('gerencia')) {
                return false;
            }

            // 2. Técnicos só visualizam processos de competência direta
            if (usuarioAtivo.perfil === 'tecnico') {
                const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
                if (tec !== tecnicoLogado) {
                    return false;
                }
            }

            // 3. Gerências setoriais (GCAR / GEAA) só visualizam processos de competência direta
            if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.perfil.startsWith('gerencia')) {
                if (!semTecnico) {
                    const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tec] || 'S/G';
                    if (setorInternoDoTecnico !== usuarioAtivo.setor) return false;
                } else {
                    const gerenciaRegistro = (linha['GERÊNCIA'] || '').trim().toUpperCase();
                    if (gerenciaRegistro !== usuarioAtivo.setor) return false;
                }
            }

            return true;
        });
    }

    if (filtroAtivo === 'todos') {
        const cgNupEl = document.getElementById('cgNup');
        const cgOficioEl = document.getElementById('cgOficio');
        const cgCarmsEl = document.getElementById('cgCarms');

        const termoBusca = cgNupEl ? cgNupEl.value.toLowerCase().trim() : '';
        const ofTermo = cgOficioEl ? cgOficioEl.value.toLowerCase().trim() : '';
        const carms = cgCarmsEl ? cgCarmsEl.value.toLowerCase().trim() : '';
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
    else if (filtroAtivo === 'distribuicao') {
        const distNupEl = document.getElementById('distNup');
        const distOficioEl = document.getElementById('distOficio');

        const termoBusca = distNupEl ? distNupEl.value.toLowerCase().trim() : '';
        const ofTermo = distOficioEl ? distOficioEl.value.toLowerCase().trim() : '';

        filtrados = filtrados.filter(r => {
            const tec = (r['TÉCNICO/ADMIN'] || '').trim();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
            const status = (r['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(r);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || (r['STATUS'] || '').toUpperCase() === 'FINALIZADO' || (r['STATUS'] || '').toUpperCase() === 'TRAMITADO' || (r['STATUS'] || '').toUpperCase() === 'ARQUIVADO';
            
            const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
            const isRevisao = (status === 'REVISÃO' || status === 'REVISAO' || hasResposta) && statusResp !== 'REPROVADO';
            const isFazerCi = status === 'FAZER CI';
            const isAssinatura = status === 'AGUARDANDO ASSINATURA';

            return semTecnico && !isFinalizado && !isRevisao && !isFazerCi && !isAssinatura;
        });

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            
            const tecnicoDoRegistro = (r['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const semTecnico = tecnicoDoRegistro === '' || tecnicoDoRegistro === '-' || tecnicoDoRegistro === 'S/T';
            const setorRegistro = semTecnico
                ? (r['GERÊNCIA'] || '').trim().toUpperCase()
                : (MAPA_TECNICOS_SETORES[tecnicoDoRegistro] || 'S/G');
            
            return (subAbaAtiva === 'Geral' || setorRegistro === subAbaAtiva)
                && busca.match;
        });

        const alertaDistribuicaoEl = document.getElementById('alerta-distribuicao');
        if (alertaDistribuicaoEl) {
            alertaDistribuicaoEl.innerText = `ℹ️ Há ${filtrados.length} processos aguardando distribuição ${obterNomeSetorFormatado(subAbaAtiva)}.`;
        }
    }
    else if (filtroAtivo === 'andamento') {
        const andNupEl = document.getElementById('andNup');
        const andOficioEl = document.getElementById('andOficio');

        const termoBusca = andNupEl ? andNupEl.value.toLowerCase().trim() : '';
        const ofTermo = andOficioEl ? andOficioEl.value.toLowerCase().trim() : '';
        const tecs = lerValoresMultiplosNativos('andTecnico');
        const stss = lerValoresMultiplosNativos('andStatus');

        filtrados = filtrados.filter(r => {
            const tec = (r['TÉCNICO/ADMIN'] || '').trim();
            const temTecnico = tec !== '' && tec !== '-' && tec !== 'S/T';
            const status = (r['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(r);
            const isAtrasado = statusVisual.texto.includes('🔴') || (extrairDiasRestantes(r['DIAS RESTANTES']) < 0);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
            const isAguardandoManifestacao = status.includes('AGUARDANDO MANIFESTAÇÃO') || status.includes('AGUARDANDO MANIFESTACAO');
            
            const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
            const isRevisao = (status === 'REVISÃO' || status === 'REVISAO' || hasResposta) && statusResp !== 'REPROVADO';

            return temTecnico && isAguardandoManifestacao && !isAtrasado && !isFinalizado && !isRevisao;
        });

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            
            const tecnicoDoRegistro = (r['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tecnicoDoRegistro] || 'S/G';
            
            return (subAbaAtiva === 'Geral' || setorInternoDoTecnico === subAbaAtiva)
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

        const alertaAndamentoEl = document.getElementById('alerta-andamento');
        if (alertaAndamentoEl) {
            alertaAndamentoEl.innerText = `ℹ️ Há ${filtrados.length} processos em andamento ${obterNomeSetorFormatado(subAbaAtiva)}.`;
        }
    }
    else if (filtroAtivo === 'atrasados') {
        const atrNupEl = document.getElementById('atrNup');
        const atrOficioEl = document.getElementById('atrOficio');

        const termoBusca = atrNupEl ? atrNupEl.value.toLowerCase().trim() : '';
        const ofTermo = atrOficioEl ? atrOficioEl.value.toLowerCase().trim() : '';
        const tecs = lerValoresMultiplosNativos('atrTecnico');
        const stss = lerValoresMultiplosNativos('atrStatus');

        filtrados = filtrados.filter(r => {
            const status = (r['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(r);
            const isAtrasado = statusVisual.texto.includes('🔴') || (extrairDiasRestantes(r['DIAS RESTANTES']) < 0);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
            const isAguardando = status.includes('AGUARDANDO MANIFESTAÇÃO') || status.includes('AGUARDANDO MANIFESTACAO') || status.includes('AGUARDANDO DISTRIBUIÇÃO') || status.includes('AGUARDANDO DISTRIBUICAO');
            
            const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
            const isRevisao = (status === 'REVISÃO' || status === 'REVISAO' || hasResposta) && statusResp !== 'REPROVADO';

            return isAguardando && isAtrasado && !isFinalizado && !isRevisao;
        });

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            
            const tecnicoDoRegistro = (r['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const semTecnico = tecnicoDoRegistro === '' || tecnicoDoRegistro === '-' || tecnicoDoRegistro === 'S/T';
            const setorRegistro = semTecnico
                ? (r['GERÊNCIA'] || '').trim().toUpperCase()
                : (MAPA_TECNICOS_SETORES[tecnicoDoRegistro] || 'S/G');
            
            return (subAbaAtiva === 'Geral' || setorRegistro === subAbaAtiva)
                && busca.match
                && (tecs.length === 0 || tecs.includes('todos') || tecs.includes(r['TÉCNICO/ADMIN']))
                && (stss.length === 0 || stss.includes('todos') || stss.includes(r['STATUS']));
        });

        filtrados.sort((a, b) => {
            const numA = extrairDiasRestantes(a['DIAS RESTANTES']) || 0;
            const numB = extrairDiasRestantes(b['DIAS RESTANTES']) || 0;
            return numA - numB;
        });

        const alertaAtrasadosEl = document.getElementById('alerta-atrasados');
        if (alertaAtrasadosEl) {
            alertaAtrasadosEl.innerText = `⚠️ Atenção - Há ${filtrados.length} processos em atraso ${obterNomeSetorFormatado(subAbaAtiva)}.`;
        }
    }
    else if (filtroAtivo === 'respondidos') {
        const respNupEl = document.getElementById('respNup');
        const respOficioEl = document.getElementById('respOficio');

        const termoBusca = respNupEl ? respNupEl.value.toLowerCase().trim() : '';
        const ofTermo = respOficioEl ? respOficioEl.value.toLowerCase().trim() : '';
        const tecs = lerValoresMultiplosNativos('respTecnico');

        filtrados = filtrados.filter(r => {
            const status = (r['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(r);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
            const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
            return hasResposta && status !== 'FAZER CI' && status !== 'AGUARDANDO ASSINATURA' && !isFinalizado;
        });

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

        const alertaRespondidosEl = document.getElementById('alerta-respondidos');
        if (alertaRespondidosEl) {
            alertaRespondidosEl.innerText = `📁 Há ${filtrados.length} processos nesta aba.`;
        }
    }
    else if (filtroAtivo === 'comunicacao') {
        const comNupEl = document.getElementById('comNup');
        const comOficioEl = document.getElementById('comOficio');
        const termoBusca = comNupEl ? comNupEl.value.toLowerCase().trim() : '';
        const ofTermo = comOficioEl ? comOficioEl.value.toLowerCase().trim() : '';

        filtrados = filtrados.filter(r => {
            const status = (r['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(r);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
            return status === 'FAZER CI' && !isFinalizado;
        });

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            
            const tecnicoDoRegistro = (r['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const semTecnico = tecnicoDoRegistro === '' || tecnicoDoRegistro === '-' || tecnicoDoRegistro === 'S/T';
            const setorRegistro = semTecnico
                ? (r['GERÊNCIA'] || '').trim().toUpperCase()
                : (MAPA_TECNICOS_SETORES[tecnicoDoRegistro] || 'S/G');
            
            return (subAbaAtiva === 'Geral' || setorRegistro === subAbaAtiva) && busca.match;
        });

        const alertaComunicacaoEl = document.getElementById('alerta-comunicacao');
        if (alertaComunicacaoEl) {
            alertaComunicacaoEl.innerText = `ℹ️ Há ${filtrados.length} processos aguardando realização de C.I. ${obterNomeSetorFormatado(subAbaAtiva)}.`;
        }
    }
    else if (filtroAtivo === 'assinatura-oficios') {
        const assNupEl = document.getElementById('assNup');
        const assOficioEl = document.getElementById('assOficio');
        const termoBusca = assNupEl ? assNupEl.value.toLowerCase().trim() : '';
        const ofTermo = assOficioEl ? assOficioEl.value.toLowerCase().trim() : '';

        filtrados = filtrados.filter(r => {
            const status = (r['STATUS'] || '').toUpperCase().trim();
            const statusVisual = obterStatusVisual(r);
            const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
            return status === 'AGUARDANDO ASSINATURA' && !isFinalizado;
        });

        filtrados = filtrados.filter(r => {
            const busca = checarTermoBusca(r, termoBusca, ofTermo);
            r._matchInfo = busca.info;
            
            const tecnicoDoRegistro = (r['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const semTecnico = tecnicoDoRegistro === '' || tecnicoDoRegistro === '-' || tecnicoDoRegistro === 'S/T';
            const setorRegistro = semTecnico
                ? (r['GERÊNCIA'] || '').trim().toUpperCase()
                : (MAPA_TECNICOS_SETORES[tecnicoDoRegistro] || 'S/G');
            
            return (subAbaAtiva === 'Geral' || setorRegistro === subAbaAtiva) && busca.match;
        });

        const alertaAssinaturaEl = document.getElementById('alerta-assinatura-oficios');
        if (alertaAssinaturaEl) {
            alertaAssinaturaEl.innerText = `ℹ️ Há ${filtrados.length} processos aguardando assinatura ${obterNomeSetorFormatado(subAbaAtiva)}.`;
        }
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

let oficioSelecionadoMockup = null;

function desenharCards(dados, estadoInicialConsultaGeral = false) {
    dadosExibidos = dados;
    const container = document.getElementById('cards-container');
    const exportSection = document.getElementById('export-section');

    const leftPanelEl = document.getElementById('left-panel-inbox-oficios');
    const savedLeftScrollTop = leftPanelEl ? leftPanelEl.scrollTop : 0;

    const rightPanelEl = document.getElementById('right-panel-detalhes-oficios');
    const savedRightScrollTop = rightPanelEl ? rightPanelEl.scrollTop : 0;

    const savedWindowScrollY = window.scrollY;

    container.innerHTML = '';

    if (estadoInicialConsultaGeral) {
        container.style.display = 'grid';
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
    let totalItensContados = qtd;

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
        contadorProcessos.style.display = 'none';
    }

    if (dados.length === 0) {
        container.style.display = 'grid';
        container.innerHTML = '<h3 style="color: #666; width: 100%; grid-column: 1 / -1; animation: fadeInSlideUp 0.3s ease forwards;">Nenhum registo encontrado com estes critérios.</h3>';
        return;
    }

    if (!oficioSelecionadoMockup && dados.length > 0) {
        oficioSelecionadoMockup = dados[0];
    } else if (oficioSelecionadoMockup) {
        const exists = dados.find(r => r['NUP'] === oficioSelecionadoMockup['NUP']);
        if (exists) {
            oficioSelecionadoMockup = exists;
        } else {
            oficioSelecionadoMockup = dados[0];
        }
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '20px';
    container.style.alignItems = 'flex-start';

    // LADO ESQUERDO: LISTA (INBOX)
    const leftPanel = document.createElement('div');
    leftPanel.id = 'left-panel-inbox-oficios';
    leftPanel.style.width = '35%';
    leftPanel.style.minWidth = '300px';
    leftPanel.style.display = 'flex';
    leftPanel.style.flexDirection = 'column';
    leftPanel.style.gap = '10px';
    leftPanel.style.maxHeight = '75vh';
    leftPanel.style.overflowY = 'auto';
    leftPanel.style.paddingRight = '5px';
    leftPanel.style.animation = leftPanelEl ? 'none' : 'fadeInSlideUp 0.3s ease-out forwards';

    // LADO DIREITO: DETALHES
    const rightPanel = document.createElement('div');
    rightPanel.id = 'right-panel-detalhes-oficios';
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

    dados.forEach((linha, index) => {
        const isSelected = oficioSelecionadoMockup && oficioSelecionadoMockup['NUP'] === linha['NUP'];
        const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();
        const infoStatus = obterInfoDinamicaStatus(linha);

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
            oficioSelecionadoMockup = linha;
            desenharCards(dados);
        };

        const isAtrasado = infoStatus.textoStatusLimpo.includes('ATRASO');
        if (isAtrasado) {
            item.classList.add('pulse-border-red');
        }

        const statusRespAval = (linha['STATUS_RESPOSTA'] || '').toUpperCase();
        let badgeAvaliacao = '';
        if (statusRespAval === 'APROVADO') {
            badgeAvaliacao = `<div style="font-size: 10px; color: #2ecc71; margin-bottom: 5px; font-weight: bold;">✅ APROVADA</div>`;
        } else if (statusRespAval === 'REPROVADO') {
            badgeAvaliacao = `<div style="font-size: 10px; color: #e74c3c; margin-bottom: 5px; font-weight: bold;">❌ REPROVADA</div>`;
        }

        let htmlMatchInfo = '';
        if (linha._matchInfo) {
            htmlMatchInfo = `<div style="color: #00fa9a; font-size: 11px; margin-bottom: 5px;">${linha._matchInfo}</div>`;
        }

        item.innerHTML = `
            ${badgeAvaliacao}
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                <div style="font-size: 14px; font-weight: bold; color: ${isSelected ? 'var(--primary-green)' : '#fff'};">
                    ${linha['NUP'] || '-'}
                </div>
                <div style="font-size: 10px; padding: 3px 8px; border-radius: 6px; border: 1px solid ${infoStatus.corTexto}; color: ${infoStatus.corTexto}; background-color: rgba(255,255,255,0.03); font-weight: bold; display: flex; align-items: center;">${infoStatus.iconeStatus}${infoStatus.textoStatusLimpo}</div>
            </div>
            ${htmlMatchInfo}
            <div style="font-size: 12px; color: #aaa; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                Ofício: ${oficioRaw}
            </div>
            <div style="font-size: 11px; color: #777;">
                Téc: ${linha['TÉCNICO/ADMIN'] || 'Não atribuído'}
            </div>
        `;
        leftPanel.appendChild(item);
    });

    if (oficioSelecionadoMockup) {
        const linha = oficioSelecionadoMockup;
        const index = dadosExibidos.findIndex(r => r['NUP'] === linha['NUP']);
        const infoStatus = obterInfoDinamicaStatus(linha);
        const obs = (linha['OBSERVAÇÃO'] || '').trim();
        const linkRaw = linha['LINK_OFICIO'] || '';
        const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();

        let htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="modal-obs" style="margin-top: 15px;"><strong>Observação:</strong><br>${obs}</div>` : '';
        let htmlPreviewIcon = '';
        let htmlLink = `<div style="text-align:center; color:#666; font-weight:bold; padding: 12px; border: 1px dashed #333; border-radius: 6px; width: 100%;">🚫 Sem Link Vinculado</div>`;
        if (usuarioAtivo) {
            htmlLink = `
                <div style="text-align:center; color:#666; font-weight:bold; padding: 12px; border: 1px dashed #333; border-radius: 6px; width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span>🚫 Sem Link Vinculado</span>
                    <button onclick="anexarPdfOriginalOficio(event, '${linha['NUP']}')" class="btn-drive btn-upload" style="font-size: 12px; padding: 6px 12px; width: auto; height: auto;">📎 Anexar Ofício Inicial</button>
                </div>
            `;
        }
        let btnAnexar = '';
        const linkRespostaVerificacao = linha['LINK_RESPOSTA'];
        const temRespostaVinculada = linkRespostaVerificacao && linkRespostaVerificacao.startsWith('http');

        if (usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.perfil.startsWith('gerencia'))) {
            if (temRespostaVinculada) {
                const isAprovadoBackend = (linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
                const isFazerCI = (linha['STATUS'] || '').toUpperCase().trim().replace(/\./g, '') === 'FAZER CI';
                const isGestor = usuarioAtivo.perfil.startsWith('gerencia') && usuarioAtivo.perfil !== 'gerencia_consulta';

                let blockRemoval = false;
                if (!isGestor && (isAprovadoBackend || isFazerCI)) {
                    blockRemoval = true;
                }

                if (blockRemoval) {
                    btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px; width: 100%;">🔒 Documento aprovado. Apenas a Diretoria pode removê-lo.</div>`;
                } else {
                    btnAnexar = `<button onclick="removerDocumento(event, '${linha['NUP']}')" class="btn-drive btn-red-outline">🗑️ Retirar Resposta</button>`;
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
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <a href="${linkDownload}" class="btn-drive btn-download" onclick="feedbackDownload(this)">⬇️ Download</a>
                        ${btnAnexar}
                    </div>
                `;
            } else {
                htmlLink = `
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <a href="${linkRaw}" target="_blank" class="btn-drive">🔗 Abrir Link Vinculado</a>
                        ${btnAnexar}
                    </div>
                `;
            }
        } else {
            if (btnAnexar) {
                htmlLink = `<div style="display: flex; gap: 10px; flex-wrap: wrap;">${btnAnexar}</div>`;
            }
        }

        let htmlDiretoriaBotoes = '';
        const isGestorFinalidade = usuarioAtivo && usuarioAtivo.perfil.startsWith('gerencia') && usuarioAtivo.perfil !== 'gerencia_consulta';
        const statusGeralAtualizado = (linha['STATUS'] || '').toUpperCase();
        const isSemTecnico = !linha['TÉCNICO/ADMIN'] || linha['TÉCNICO/ADMIN'] === '-' || linha['TÉCNICO/ADMIN'] === 'S/T';

        if (isGestorFinalidade) {
            if (isSemTecnico) {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;">👤 Distribuir / Atribuir Técnico</button>`;
            } else {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;">👤 Redistribuir Técnico</button>`;
            }
            
            const opcoesOficioStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER CI", "AGUARDANDO ASSINATURA", "REVISÃO", "FINALIZADO", "TRAMITADO", "ARQUIVADO"];
            let optionsHtml = opcoesOficioStatus.map(st => `<option value="${st}" ${st === statusGeralAtualizado ? 'selected' : ''}>${st}</option>`).join('');
            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;">⚙️ GESTÃO DE STATUS (DIRETORIA)</div>
                    <div style="display: flex; gap: 8px;">
                        <select id="changeStatusSelectOficioPainel-${linha['NUP']}" style="flex: 1; padding: 8px; background-color: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 13px; outline: none; height: 38px;">
                            ${optionsHtml}
                        </select>
                        <button onclick="salvarStatusManualOficioPainel(event, '${linha['NUP']}')" id="btnSalvarStatusOficioPainel-${linha['NUP']}" class="btn-drive btn-blue" style="width: auto; padding: 8px 15px; margin: 0; font-size: 13px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">Alterar</button>
                    </div>
                </div>
            `;
        }

        let htmlResposta = '';
        if (temRespostaVinculada) {
            const respId = extrairIdDrive(linkRespostaVerificacao);
            let botaoResp = `<a href="${linkRespostaVerificacao}" target="_blank" class="btn-drive btn-orange-outline">🔗 Abrir Resposta no Drive</a>`;
            if (respId) {
                const respPreview = `https://drive.google.com/file/d/${respId}/preview`;
                botaoResp = `<button onclick="abrirPreview('${respPreview}', ${index})" class="btn-drive btn-orange-outline">👁️ Pré-visualizar Resposta</button>`;
            }

            let htmlMotivoReprovacao = '';
            if ((linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'REPROVADO' && linha['MOTIVO_AVALIACAO']) {
                htmlMotivoReprovacao = `
                    <div style="margin-top: 15px; padding: 10px; background-color: rgba(231, 76, 60, 0.1); border-left: 4px solid #e74c3c; color: #ffcccc; font-size: 13px; border-radius: 0 4px 4px 0;">
                        <strong style="color: #e74c3c;">Motivo da Reprovação:</strong><br>
                        ${linha['MOTIVO_AVALIACAO']}
                    </div>
                `;
            }

            htmlResposta = `
                <div style="margin: 20px 0; padding: 15px; background-color: rgba(140, 86, 51, 0.1); border: 1px solid rgba(140, 86, 51, 0.3); border-radius: 6px;">
                    <div style="color: #e67e22; font-weight: bold; margin-bottom: 10px;">📁 Documento de Resposta Anexado:</div>
                    ${botaoResp}
                    ${htmlMotivoReprovacao}
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

        let historicoReprovacoes = [];
        if (linha['HISTORICO_REPROVACOES']) {
            try {
                historicoReprovacoes = JSON.parse(linha['HISTORICO_REPROVACOES']);
            } catch (e) { console.error('Erro ao parsear HISTORICO_REPROVACOES', e); }
        }

        if (historicoReprovacoes.length > 0) {
            historicoReprovacoes.forEach((rep, i) => {
                htmlHistorico += gerarHtmlDocExtra(`Manifestação Recusada (${rep.data || 'Data Indisponível'})`, 'Ver Arquivo', 'RECUSADA', rep.link, index);
            });
        }

        if (htmlHistorico !== '') {
            htmlHistorico = `<div style="margin-top: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;">📚 Histórico de Documentos</strong>${htmlHistorico}</div>`;
        }

        let htmlTimeline = `<div id="timeline-container-oficio" style="margin-top: 25px; margin-bottom: 25px;"></div>`;

        let reitBtnHtml = '';
        if (usuarioAtivo) {
            reitBtnHtml = `<button onclick="abrirModalCadastroReiteracao('${linha['NUP']}')" class="btn-inline-reiteracao" title="Cadastrar Reiteração"></button>`;
        }

        rightPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #333; padding-bottom: 15px; margin-bottom: 20px;">
                <div>
                    <div style="font-size: 24px; font-weight: bold; color: #fff; margin-bottom: 5px;">${linha['NUP']}</div>
                    <div style="font-size: 16px; color: #ccc;">${linha['TÉCNICO/ADMIN']}</div>
                </div>
                <div style="text-align: right;">
                    <div style="background-color: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; color: #eee; display: inline-block; margin-bottom: 5px;">
                        ${linha['TIPO'] || '-'}
                    </div>
                    <div style="color: ${infoStatus.corTexto}; font-size: 14px; font-weight: bold; display: flex; align-items: center; justify-content: flex-end;">${infoStatus.iconeStatus}${infoStatus.textoStatusLimpo}</div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">DATA DO OFÍCIO</div>
                    <div style="font-size: 14px; color: #fff; font-weight: 500;">${linha['DATA'] || '-'}</div>
                </div>
            <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">PRAZO / DIAS RESTANTES</div>
                    <div style="font-size: 14px; color: #fff; font-weight: 500;">${linha['PRAZO'] || '-'}</div>
                </div>
            <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">OFÍCIO N.</div>
                    <div style="font-size: 14px; color: #fff; font-weight: 500; display: flex; align-items: center; justify-content: space-between;">
                    <span style="word-break: break-word; padding-right: 10px; display: inline-flex; align-items: center;">
                        ${oficioRaw}
                        ${reitBtnHtml}
                    </span>
                        ${htmlPreviewIcon}
                    </div>
                </div>
            <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">N. DO CAR</div>
                <div style="font-size: 14px; color: #fff; font-weight: 500; word-break: break-word;">${linha['CARMS'] || '-'}</div>
                </div>
            <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">LOCAL / MUNICÍPIO</div>
                <div style="font-size: 14px; color: #fff; font-weight: 500; word-break: break-word;">${linha['COMARCA'] || '-'}</div>
                </div>
            <div style="background-color: #222; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">GERÊNCIA</div>
                    <div style="font-size: 14px; color: #fff; font-weight: 500;">${linha['GERÊNCIA'] || '-'}</div>
                </div>
            <div style="background-color: #222; padding: 15px; border-radius: 8px; grid-column: span 2; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 4px;">REFERÊNCIA</div>
                <div style="font-size: 14px; color: #fff; font-weight: 500; line-height: 1.4;">${linha['REFERÊNCIA'] || '-'}</div>
                </div>
            </div>

            ${htmlObs}
            ${htmlResposta}
            ${htmlHistorico}
            ${htmlTimeline}

            <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid #333;">
                ${htmlLink}
                ${htmlDiretoriaBotoes}
            </div>
        `;
    }

    container.appendChild(leftPanel);
    container.appendChild(rightPanel);

    if (oficioSelecionadoMockup) {
        renderizarLinhaTempoSistema(oficioSelecionadoMockup['NUP'], 'timeline-container-oficio');
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
                base64: base64,
                username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
            };

            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
                method: 'POST',
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
                atualizarCacheOficios();
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

function anexarPdfOriginalOficio(event, nup) {
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
                acao: "anexar_pdf_original_oficio", 
                nup: nup, 
                fileName: `Oficio_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
                base64: base64,
                username: usuarioAtivo.username || ''
            };
            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', { method: 'POST', body: JSON.stringify(payload) });
            const resultado = await resposta.json();

            if (resultado.status === 'success') {
                mostrarToast('PDF Original anexado com sucesso!', 'success');
                const target = dadosCoringa.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK_OFICIO'] = resultado.url;
                    target['LINK - OFÍCIO'] = resultado.url;
                    target['LINK OFÍCIO'] = resultado.url;
                    target['LINK_OFÍCIO'] = resultado.url;
                }
                atualizarCacheOficios();
                aplicarFiltros();
                fecharModal();
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

window.cacheHistoricoGlobal = null;
window.historicoCarregando = false;

async function carregarHistoricoGlobalBackground() {
    if (window.cacheHistoricoGlobal || window.historicoCarregando) return;
    window.historicoCarregando = true;
    try {
        const payload = { acao: "buscar_historico_processo" };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            window.cacheHistoricoGlobal = resultado.dados || [];
            console.log(`Cache de Histórico Global carregado em background: ${window.cacheHistoricoGlobal.length} registros.`);
        }
    } catch (e) {
        console.error("Erro ao pré-carregar histórico em background:", e);
    } finally {
        window.historicoCarregando = false;
    }
}

window.limparCacheHistoricoGlobal = function() {
    window.cacheHistoricoGlobal = null;
    setTimeout(carregarHistoricoGlobalBackground, 1500); // 1.5s delay to allow Google Sheets write synchronization
};

function exibirLinhaTempo(dados, container) {
    if (dados.length === 0) {
        container.innerHTML = `
            <div style="font-size: 15px; font-weight: bold; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 15px;">⏳ Histórico de Tramitação</div>
            <div style="text-align: center; color: #666; font-size: 13px; padding: 15px; border: 1px dashed #333; border-radius: 6px;">Nenhum evento registrado para este processo.</div>
        `;
        return;
    }

    const obterEstiloEvento = (acao, detalhe = '') => {
        const acaoUpper = acao.toUpperCase();
        const detalheUpper = String(detalhe).toUpperCase();
        
        if (acaoUpper.includes('CADASTRADO') || acaoUpper.includes('CADASTRO') || acaoUpper.includes('INICIAL')) {
            return { cor: '#3498db', icone: '📥' };
        }
        if (acaoUpper.includes('ATRIBUÍDO') || acaoUpper.includes('ATRIBUIDO') || acaoUpper.includes('DISTRIBUIÇÃO') || acaoUpper.includes('DISTRIBUIDO') || acaoUpper.includes('REDISTRIBUIR') || acaoUpper.includes('TÉCNICO')) {
            return { cor: '#9b59b6', icone: '👤' };
        }
        if (acaoUpper.includes('UPLOAD DE RESPOSTA') || acaoUpper.includes('ANEXAR') || acaoUpper.includes('ANEXADO')) {
            return { cor: '#e67e22', icone: '📎' };
        }
        if (acaoUpper.includes('REMOVER') || acaoUpper.includes('REMOVIDA') || acaoUpper.includes('RETIRAR')) {
            return { cor: '#7f8c8d', icone: '🗑️' };
        }
        if (acaoUpper.includes('APROVADO') || acaoUpper.includes('ACEITO') || detalheUpper === 'TRAMITADO' || detalheUpper === 'FINALIZADO' || detalheUpper === 'ARQUIVADO') {
            return { cor: '#2ecc71', icone: '✅' };
        }
        if (acaoUpper.includes('REPROVADO') || acaoUpper.includes('RECUSADO') || acaoUpper.includes('RECUSADA')) {
            return { cor: '#e74c3c', icone: '❌' };
        }
        if (acaoUpper.includes('STATUS CI') || acaoUpper.includes('STATUS')) {
            return { cor: '#f1c40f', icone: '⚙️' };
        }
        return { cor: '#1abc9c', icone: '📌' };
    };

    let htmlEvents = '';
    [...dados].reverse().forEach((ev, i) => {
        const estilo = obterEstiloEvento(ev.acao, ev.detalhe);
        let descricao = ev.extra ? `${ev.acao} (${ev.extra})` : ev.acao;
        let detalheText = ev.detalhe && !ev.detalhe.startsWith('http') ? `<div style="font-size: 11px; color: #888; margin-top: 2px;">Detalhe: ${ev.detalhe}</div>` : '';
        
        if (ev.acao === 'ALTERACAO_MANUAL_STATUS') {
            descricao = ev.extra || 'Status alterado manualmente';
            detalheText = '';
        }
        
        htmlEvents += `
            <div style="position: relative; margin-bottom: 20px; padding-left: 15px;">
                <div style="position: absolute; left: -29px; top: 0; width: 16px; height: 16px; background-color: #1a1a1a; border: 2px solid ${estilo.cor}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px;" title="${ev.acao}">${estilo.icone}</div>
                <div style="font-size: 11px; color: #777;">${ev.data}</div>
                <div style="font-size: 13px; color: ${i === 0 ? '#fff' : '#ccc'}; margin-top: 2px; font-weight: ${i === 0 ? 'bold' : 'normal'};">${descricao}</div>
                ${detalheText}
            </div>
        `;
    });

    container.innerHTML = `
        <div style="margin-top: 25px; margin-bottom: 25px;">
            <div style="font-size: 15px; font-weight: bold; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 15px;">⏳ Histórico de Tramitação</div>
            <div style="position: relative; padding-left: 20px; border-left: 2px solid #444; margin-left: 17px;">
                ${htmlEvents}
            </div>
        </div>
    `;
}

async function renderizarLinhaTempoSistema(nup, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (window.cacheHistoricoGlobal) {
        const dadosLocais = window.cacheHistoricoGlobal.filter(ev => String(ev.nup).trim() === String(nup).trim());
        exibirLinhaTempo(dadosLocais, container);
        return;
    }

    container.innerHTML = `<div style="text-align: center; color: #888; font-size: 13px; padding: 15px;">⏳ Carregando histórico...</div>`;

    try {
        const payload = { acao: "buscar_historico_processo", nup: nup };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();

        if (resultado.status !== 'success') {
            container.innerHTML = `<div style="color: #c0392b; font-size: 13px; padding: 10px;">❌ Erro ao carregar histórico: ${resultado.message}</div>`;
            return;
        }

        const dados = resultado.dados || [];
        exibirLinhaTempo(dados, container);

        carregarHistoricoGlobalBackground();
    } catch (error) {
        console.error(error);
        container.innerHTML = `<div style="color: #c0392b; font-size: 13px; padding: 10px;">❌ Falha na conexão ao buscar histórico.</div>`;
    }
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
    const btn = event.currentTarget;
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
            nup: nup,
            username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
        };

        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
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
            atualizarCacheOficios();
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
            atualizarCacheOficios();
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
    const btn = event ? event.currentTarget : null;
    const textoOriginal = btn ? btn.innerHTML : '';

    let confirmou = false;
    let msg = '';
    let options = {};

    if (novoStatus === 'AGUARDANDO ASSINATURA') {
        msg = "Tem certeza de que deseja confirmar a realização da C.I. para este processo?\n\nO status mudará para Aguardando Assinatura.";
        options = {
            titulo: "Confirmar Realização de C.I.",
            textoBotao: "✅ Confirmar C.I.",
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
            username: usuarioAtivo.username || ''
        };

        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
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
            atualizarCacheOficios();
            aplicarFiltros();

            const newIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
            if (newIndex !== -1) {
                abrirModal(newIndex);
            } else {
                fecharModal();
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

async function salvarStatusManualOficio(event, nup) {
    if (event) event.preventDefault();
    const select = document.getElementById(`changeStatusSelectOficio-${nup}`);
    const novoStatus = select ? select.value : '';
    if (!novoStatus) return;
    await realizarAlteracaoStatusOficio(nup, novoStatus, `btnSalvarStatusOficio-${nup}`);
}

async function salvarStatusManualOficioPainel(event, nup) {
    if (event) event.preventDefault();
    const select = document.getElementById(`changeStatusSelectOficioPainel-${nup}`);
    const novoStatus = select ? select.value : '';
    if (!novoStatus) return;
    await realizarAlteracaoStatusOficio(nup, novoStatus, `btnSalvarStatusOficioPainel-${nup}`);
}

async function realizarAlteracaoStatusOficio(nup, novoStatus, btnId) {
    const btn = document.getElementById(btnId);
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ ...'; btn.disabled = true;

    // Optimistic Update
    const oficioRef = dadosCoringa.find(a => a['NUP'] === nup);
    let statusOriginal = '';
    if (oficioRef) {
        statusOriginal = oficioRef['STATUS'];
        oficioRef['STATUS'] = novoStatus;
    }

    mostrarToast('Status alterado localmente. Sincronizando...', 'success');
    atualizarCacheOficios();
    aplicarFiltros();

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            body: JSON.stringify({
                acao: "alterar_status_manual_generico",
                tipoAba: "oficio",
                nup: nup,
                novoStatus: novoStatus,
                username: usuarioAtivo.username || "sistema"
            })
        });
        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Status confirmado na nuvem!', 'success');
        } else {
            throw new Error(resultado.message);
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Falha na internet ao alterar status. (Revertendo)', 'error');
        if (oficioRef) {
            oficioRef['STATUS'] = statusOriginal;
        }
        atualizarCacheOficios();
        aplicarFiltros();
    } finally {
        if(btn) { btn.innerHTML = txtOriginal; btn.disabled = false; }
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
    if (usuarioAtivo) {
        htmlLink = `
            <div style="text-align:center; color:#666; font-weight:bold; padding: 12px; border: 1px dashed #333; border-radius: 6px; display: flex; flex-direction: column; align-items: center; gap: 8px;">
                <span>🚫 Sem Link Vinculado</span>
                <button onclick="anexarPdfOriginalOficio(event, '${linha['NUP']}')" class="btn-drive btn-upload" style="font-size: 12px; padding: 6px 12px; width: auto; height: auto;">📎 Anexar Ofício Inicial</button>
            </div>
        `;
    }
    let btnAnexar = '';
    const linkRespostaVerificacao = linha['LINK_RESPOSTA'];
    const temRespostaVinculada = linkRespostaVerificacao && linkRespostaVerificacao.startsWith('http');

    if (usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.perfil.startsWith('gerencia'))) {
        if (temRespostaVinculada) {
            const isAprovadoBackend = (linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
            const isFazerCI = (linha['STATUS'] || '').toUpperCase().trim().replace(/\./g, '') === 'FAZER CI';
            const isGestor = usuarioAtivo.perfil.startsWith('gerencia') && usuarioAtivo.perfil !== 'gerencia_consulta';

            let blockRemoval = false;
            if (!isGestor && (isAprovadoBackend || isFazerCI)) {
                blockRemoval = true;
            }

            if (blockRemoval) {
                btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px;">🔒 Documento aprovado. Apenas a Diretoria pode removê-lo.</div>`;
            } else {
                btnAnexar = `<button onclick="removerDocumento(event, '${linha['NUP']}')" class="btn-drive btn-red-outline">🗑️ Retirar Resposta</button>`;
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
    const isGestorFinalidade = usuarioAtivo && usuarioAtivo.perfil.startsWith('gerencia') && usuarioAtivo.perfil !== 'gerencia_consulta';
    const statusGeralAtualizado = (linha['STATUS'] || '').toUpperCase();
    const isSemTecnico = !linha['TÉCNICO/ADMIN'] || linha['TÉCNICO/ADMIN'] === '-' || linha['TÉCNICO/ADMIN'] === 'S/T';

    if (isGestorFinalidade) {
        if (isSemTecnico) {
            htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;">👤 Distribuir / Atribuir Técnico</button>`;
        } else {
            htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;">👤 Redistribuir Técnico</button>`;
        }
        
        const opcoesOficioStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER CI", "AGUARDANDO ASSINATURA", "REVISÃO", "FINALIZADO", "TRAMITADO", "ARQUIVADO"];
        let optionsHtml = opcoesOficioStatus.map(st => `<option value="${st}" ${st === statusGeralAtualizado ? 'selected' : ''}>${st}</option>`).join('');
        htmlDiretoriaBotoes += `
            <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;">⚙️ GESTÃO DE STATUS (DIRETORIA)</div>
                <div style="display: flex; gap: 8px;">
                    <select id="changeStatusSelectOficio-${linha['NUP']}" style="flex: 1; padding: 8px; background-color: #1a1a1a; color: #fff; border: 1px solid #444; border-radius: 4px; font-size: 13px; outline: none; height: 38px;">
                        ${optionsHtml}
                    </select>
                    <button onclick="salvarStatusManualOficio(event, '${linha['NUP']}')" id="btnSalvarStatusOficio-${linha['NUP']}" class="btn-drive btn-blue" style="width: auto; padding: 8px 15px; margin: 0; font-size: 13px; height: 38px; display: inline-flex; align-items: center; justify-content: center;">Alterar</button>
                </div>
            </div>
        `;
    }

    let htmlResposta = '';
    const linkResposta = linha['LINK_RESPOSTA'];
    if (linkResposta && linkResposta.startsWith('http')) {
        const respId = extrairIdDrive(linkResposta);
        let botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive btn-orange-outline">🔗 Abrir Resposta no Drive</a>`;
        if (respId) {
            const respPreview = `https://drive.google.com/file/d/${respId}/preview`;
            botaoResp = `<button onclick="abrirPreview('${respPreview}', ${index})" class="btn-drive btn-orange-outline">👁️ Pré-visualizar Resposta</button>`;
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
            <div style="display: flex; flex-direction: column; gap: 10px; background-color: #222; padding: 15px; border-radius: 8px;">
                <div style="margin-bottom: 8px;">📌 <strong>NUP:</strong> ${linha['NUP']}</div>
                <div style="margin-bottom: 8px;">📅 <strong>Data:</strong> ${linha['DATA']}</div>
                <div style="margin-bottom: 8px;">📄 <strong>Tipo:</strong> ${linha['TIPO']}</div>
                <div style="margin-bottom: 8px;">📍 <strong>Município:</strong> ${linha['COMARCA']}</div>
                <div style="margin-bottom: 8px;">📝 <strong>Referência:</strong> ${linha['REFERÊNCIA']}</div>
                <div style="margin-bottom: 8px;">⏳ <strong>Prazo:</strong> ${linha['PRAZO'] || '-'}</div>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; background-color: #222; padding: 15px; border-radius: 8px;">
                <div style="margin-bottom: 8px; display: flex; align-items: center; justify-content: space-between;"><span>📜 <strong>Ofício N.:</strong> &nbsp;${oficioRaw}</span> ${htmlPreviewIcon}</div>
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

    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-wrapper" id="preview-wrapper-id">
            <div class="preview-toolbar">
                <div class="preview-toolbar-title" style="display: flex; align-items: center;">
                    ${iconeOlhoGrande} Pré-visualização de Documento
                </div>
                <div class="preview-toolbar-buttons">
                    <a id="btn-open-preview" href="#" target="_blank" class="btn-preview-action" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center;" title="Abrir em Nova Aba">🔗 Abrir em Nova Aba</a>
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

    const btnDownload = document.getElementById('btn-download-preview');
    const fileId = extrairIdDrive(url);
    if (fileId) {
        btnDownload.href = `https://drive.google.com/uc?export=download&id=${fileId}`;
    } else {
        btnDownload.href = url;
    }

    // Failsafe: Obtém o registro de forma robusta e segura
    let linha = (index >= 0 && index < dadosExibidos.length) ? dadosExibidos[index] : null;
    if (!linha) {
        // Se o index for inválido (-1 ou fora de limites), busca por NUP comparando com o mockup ativo
        const targetNup = oficioSelecionadoMockup ? oficioSelecionadoMockup['NUP'] : '';
        linha = dadosCoringa.find(r => r['NUP'] === targetNup) || dadosExibidos.find(r => r['NUP'] === targetNup) || oficioSelecionadoMockup;
    }
    
    // Se ainda assim não encontrar, aborta com aviso
    if (!linha) {
        mostrarToast("Erro ao carregar detalhes do documento.", "error");
        return;
    }
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

        // Determina qual aba deve iniciar ativa com base na URL atualmente aberta
        const isOficioActive = (url === oficioPreviewUrl || url === linkOficio);
        const activeOficioClass = isOficioActive ? 'active' : '';
        const activeRespClass = !isOficioActive ? 'active' : '';

        toggleBtn = `
             <div style="display: flex; gap: 10px; margin-bottom: 20px;">
                 <button onclick="alternarVisualizacaoPreview(this, '${oficioPreviewUrl}', '${downloadOficioUrlFull}')" class="btn-drive btn-preview btn-preview-toggle-tab ${activeOficioClass}" style="flex: 1; padding: 10px; font-size: 12px;">📜 Ver Ofício</button>
                 <button onclick="alternarVisualizacaoPreview(this, '${respPreviewUrl}', '${downloadRespUrlFull}')" class="btn-drive btn-orange-outline btn-preview-toggle-tab ${activeRespClass}" style="flex: 1; padding: 10px; font-size: 12px;">📁 Ver Resposta</button>
             </div>
         `;
    }

    let acoesDiflorPreview = '';
    const statusRespAval = (linha['STATUS_RESPOSTA'] || '').toUpperCase();
    const isLinkRespostaValido = linha['LINK_RESPOSTA'] && linha['LINK_RESPOSTA'].trim() !== '' && linha['LINK_RESPOSTA'].trim() !== '-';
    const tecRegistro = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
    const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tecRegistro] || 'S/G';
    const podeAvaliar = usuarioAtivo && (usuarioAtivo.username === 'diflor' || (usuarioAtivo.perfil.startsWith('gerencia') && setorInternoDoTecnico === usuarioAtivo.setor));
    
    if (podeAvaliar && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && isLinkRespostaValido) {
        acoesDiflorPreview = `
            <div style="margin-top: 20px; padding: 15px; background-color: rgba(255, 165, 0, 0.1); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 6px;">
                <strong style="color: #ffa500; font-size: 14px; display: block; margin-bottom: 10px;">📋 Avaliar Resposta:</strong>
                <div style="display: flex; gap: 10px; flex-direction: column;">
                    <button onclick="avaliarResposta(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive btn-green-outline">✅ Aprovar Manifestação</button>
                    <button onclick="avaliarResposta(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive btn-red-outline">❌ Reprovar Manifestação</button>
                </div>
            </div>
        `;
    }

    const contentDiv = document.getElementById('previewInfoContent');
    contentDiv.innerHTML = toggleBtn + contentDiv.innerHTML + acoesDiflorPreview;

    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) {
        btnOpenPreview.href = url.replace('/preview', '/view');
    }
    document.getElementById('previewFrame').src = url;
    modal.style.display = 'flex';
}

function togglePreviewInfo() {
    const infoPanel = document.getElementById('previewInfo');
    if (infoPanel) {
        infoPanel.classList.toggle('hidden');
    }
}

function alternarVisualizacaoPreview(btn, urlPreview, urlDownload) {
    const botoes = btn.parentElement.querySelectorAll('.btn-preview-toggle-tab');
    botoes.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const iframe = document.getElementById('previewFrame');
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = urlPreview;
    }
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) {
        btnOpenPreview.href = urlPreview.replace('/preview', '/view');
    }

    const gisContainer = document.getElementById('gisMapContainerModal');
    if (gisContainer) gisContainer.style.display = 'none';

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) btnDownload.href = urlDownload;
}

function fecharPreview() {
    const modal = document.getElementById('previewModal');
    if (!modal) return;
    
    if (window.mapaGisModal) {
        window.mapaGisModal.remove();
        window.mapaGisModal = null;
        window.camadaGeoJsonModal = null;
    }
    
    modal.style.display = 'none';
    modal.innerHTML = '';
}

function abrirModalAtribuirTecnicoOficio(nup) {
    document.getElementById('atrOficioNup').value = nup;

    const select = document.getElementById('atrOficioTecnico');
    select.innerHTML = '';
    const elBlank = document.createElement('option');
    elBlank.value = ''; elBlank.textContent = '-- Selecione o Técnico --';
    select.appendChild(elBlank);

    opcoesAutoTecnico.forEach(opt => {
        const el = document.createElement('option'); el.value = opt; el.textContent = opt; select.appendChild(el);
    });

    document.getElementById('atribuirTecnicoOficioModal').style.display = 'flex';
}

function fecharModalAtribuirTecnicoOficio() {
    document.getElementById('atribuirTecnicoOficioModal').style.display = 'none';
}


async function salvarAtribuicaoTecnicoOficio() {
    const nup = document.getElementById('atrOficioNup').value;
    const tecnico = document.getElementById('atrOficioTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico para atribuir.', 'error'); return; }

    const btn = document.getElementById('btnSalvarAtribuicaoOficio');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    const procRef = dadosCoringa.find(a => a['NUP'] === nup);
    let statusOriginal = '';
    let tecnicoOriginal = '';
    let dataDistOriginal = '';
    const dataProvisoria = new Date().toLocaleDateString('pt-BR');

    if (procRef) {
        statusOriginal = procRef['STATUS'];
        tecnicoOriginal = procRef['TÉCNICO/ADMIN'];
        dataDistOriginal = procRef['DATA_DISTRIBUICAO'];

        procRef['TÉCNICO/ADMIN'] = tecnico;
        procRef['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        procRef['DATA_DISTRIBUICAO'] = dataProvisoria;
    }

    mostrarToast('Processo distribuído localmente. Sincronizando em background...', 'success');

    atualizarBadgesNotificacao(dadosCoringa);
    atualizarCacheOficios();
    fecharModalAtribuirTecnicoOficio();
    aplicarFiltros();

    const newIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
    if (newIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') {
        abrirModal(newIndex);
    }

    btn.innerHTML = txtOriginal;
    btn.disabled = false;

    try {
        const payload = { acao: "atribuir_tecnico_oficio", nup: nup, tecnico: tecnico };
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST', body: JSON.stringify(payload)
        });
        const resultado = await resposta.json();

        if (resultado.status === 'success') {
            mostrarToast('Distribuição confirmada na nuvem com sucesso!', 'success');
            if (procRef && resultado.dataDistribuicao) {
                procRef['DATA_DISTRIBUICAO'] = resultado.dataDistribuicao;
                atualizarCacheOficios();
                const currIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
                if (currIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') { abrirModal(currIndex); }
            }
        } else {
            throw new Error(resultado.message);
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Falha na internet ao distribuir. (Revertendo alterações)', 'error');
        if (procRef) {
            procRef['TÉCNICO/ADMIN'] = tecnicoOriginal;
            procRef['STATUS'] = statusOriginal;
            procRef['DATA_DISTRIBUICAO'] = dataDistOriginal;
        }
        atualizarBadgesNotificacao(dadosCoringa);
        atualizarCacheOficios();
        aplicarFiltros();
        const currIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
        if (currIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') { abrirModal(currIndex); }
    }
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

    let dadosFiltradosBadge = dados;
    if (usuarioAtivo.perfil === 'tecnico') {
        const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
        dadosFiltradosBadge = dados.filter(r => (r['TÉCNICO/ADMIN'] || '').toUpperCase().trim() === tecnicoLogado);
    } else if (usuarioAtivo.perfil.startsWith('gerencia') && usuarioAtivo.username !== 'diflor') {
        dadosFiltradosBadge = dados.filter(r => {
            const tec = (r['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
            const setor = semTecnico 
                ? (r['GERÊNCIA'] || '').trim().toUpperCase()
                : (MAPA_TECNICOS_SETORES[tec] || 'S/G');
            return setor === usuarioAtivo.setor;
        });
    }

    // 1. Aguardando Distribuição
    let totalDistribuicao = dadosFiltradosBadge.filter(r => {
        const tec = (r['TÉCNICO/ADMIN'] || '').trim();
        const semTecnico = tec === '' || tec === '-' || tec === 'S/T';
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const statusVisual = obterStatusVisual(r);
        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
        
        const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
        const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const isRevisao = (status === 'REVISÃO' || status === 'REVISAO' || hasResposta) && statusResp !== 'REPROVADO';
        const isFazerCi = status === 'FAZER CI';
        const isAssinatura = status === 'AGUARDANDO ASSINATURA';

        return semTecnico && !isFinalizado && !isRevisao && !isFazerCi && !isAssinatura;
    }).length;

    // 2. Em Andamento
    let totalAndamento = dadosFiltradosBadge.filter(r => {
        const tec = (r['TÉCNICO/ADMIN'] || '').trim();
        const temTecnico = tec !== '' && tec !== '-' && tec !== 'S/T';
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const statusVisual = obterStatusVisual(r);
        const isAtrasado = statusVisual.texto.includes('🔴') || (extrairDiasRestantes(r['DIAS RESTANTES']) < 0);
        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
        const isAguardandoManifestacao = status.includes('AGUARDANDO MANIFESTAÇÃO') || status.includes('AGUARDANDO MANIFESTACAO');
        
        const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
        const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const isRevisao = (status === 'REVISÃO' || status === 'REVISAO' || hasResposta) && statusResp !== 'REPROVADO';

        return temTecnico && isAguardandoManifestacao && !isAtrasado && !isFinalizado && !isRevisao;
    }).length;

    // 3. Painel de Atrasados
    let totalAtrasados = dadosFiltradosBadge.filter(r => {
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const statusVisual = obterStatusVisual(r);
        const isAtrasado = statusVisual.texto.includes('🔴') || (extrairDiasRestantes(r['DIAS RESTANTES']) < 0);
        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
        const isAguardando = status.includes('AGUARDANDO MANIFESTAÇÃO') || status.includes('AGUARDANDO MANIFESTACAO') || status.includes('AGUARDANDO DISTRIBUIÇÃO') || status.includes('AGUARDANDO DISTRIBUICAO');
        
        const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
        const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const isRevisao = (status === 'REVISÃO' || status === 'REVISAO' || hasResposta) && statusResp !== 'REPROVADO';

        return isAguardando && isAtrasado && !isFinalizado && !isRevisao;
    }).length;

    // 4. Aguardando Revisão
    let totalRespPendentes = dadosFiltradosBadge.filter(r => {
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const statusVisual = obterStatusVisual(r);
        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
        const hasResposta = r['LINK_RESPOSTA'] && r['LINK_RESPOSTA'].trim() !== '' && r['LINK_RESPOSTA'].trim() !== '-';
        
        const statusResp = (r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const isPendente = statusResp !== 'APROVADO' && statusResp !== 'REPROVADO' && (status === 'REVISÃO' || status === 'REVISAO');
        
        return hasResposta && status !== 'FAZER CI' && status !== 'AGUARDANDO ASSINATURA' && !isFinalizado && isPendente;
    }).length;

    // 5. Fazer Comunicação
    let totalComunicacao = dadosFiltradosBadge.filter(r => {
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const statusVisual = obterStatusVisual(r);
        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
        return status === 'FAZER CI' && !isFinalizado;
    }).length;

    // 6. Aguardand. Assinatura
    let totalAssinaturaOficios = dadosFiltradosBadge.filter(r => {
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const statusVisual = obterStatusVisual(r);
        const isFinalizado = statusVisual.texto.includes('FINALIZADO') || status === 'FINALIZADO' || status === 'TRAMITADO' || status === 'ARQUIVADO';
        return status === 'AGUARDANDO ASSINATURA' && !isFinalizado;
    }).length;

    atualizarBadgeDOM('badge-menu-distribuicao', totalDistribuicao);
    atualizarBadgeDOM('badge-menu-andamento', totalAndamento);
    atualizarBadgeDOM('badge-menu-atrasados', totalAtrasados);
    atualizarBadgeDOM('badge-menu-respondidos', totalRespPendentes);
    atualizarBadgeDOM('badge-tab-pendentes', totalRespPendentes);
    atualizarBadgeDOM('badge-menu-comunicacao', totalComunicacao);
    atualizarBadgeDOM('badge-menu-assinatura-oficios', totalAssinaturaOficios);

    // BADGES CARTAS CONSULTA
    let cartasFiltradas = typeof dadosCartasGlobais !== 'undefined' ? dadosCartasGlobais : [];
    if (usuarioAtivo.perfil === 'tecnico') {
        const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
        cartasFiltradas = cartasFiltradas.filter(r => (r['TÉCNICO/ADM'] || r['TECNICO/ADM'] || '').toUpperCase().trim() === tecnicoLogado);
    } else if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.perfil.startsWith('gerencia')) {
        cartasFiltradas = cartasFiltradas.filter(r => {
            const tec = String(r['TÉCNICO/ADM'] || r['TECNICO/ADM'] || '').toUpperCase().trim();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO';
            const gerenciaRow = String(r['GERÊNCIA'] || '').toUpperCase().trim();
            if (!semTecnico) {
                const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tec] || 'S/G';
                return (setorInternoDoTecnico === usuarioAtivo.setor);
            } else {
                return (gerenciaRow === usuarioAtivo.setor);
            }
        });
    }

    let totalCartasDistribuicao = cartasFiltradas.filter(r => (r['STATUS'] || '').toUpperCase().trim() === 'AGUARDANDO DISTRIBUIÇÃO').length;
    let totalCartasAndamento = cartasFiltradas.filter(r => (r['STATUS'] || '').toUpperCase().trim() === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA').length;
    let totalCartasRevisao = cartasFiltradas.filter(r => {
        const statusGeral = (r['STATUS'] || '').toUpperCase().trim();
        const statusResp = (r['STATUS DA RESPOSTA'] || r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        return statusGeral === 'REVISÃO' && statusResp !== 'APROVADO' && statusResp !== 'REPROVADO';
    }).length;
    let totalCartasDespacho = cartasFiltradas.filter(r => (r['STATUS'] || '').toUpperCase().trim() === 'FAZER DESPACHO').length;
    let totalCartasAssinatura = cartasFiltradas.filter(r => (r['STATUS'] || '').toUpperCase().trim() === 'AGUARDANDO ASSINATURA').length;
    let totalCartasAtrasados = cartasFiltradas.filter(r => {
        const status = (r['STATUS'] || '').toUpperCase().trim();
        const diasRestantes = Number(r['DIAS RESTANTES']);
        return !isNaN(diasRestantes) && diasRestantes < 0 
            && status !== 'TRAMITADO' && status !== 'ARQUIVADO' && status !== 'FINALIZADO'
            && status !== 'REVISÃO' && status !== 'REVISAO'
            && status !== 'FAZER DESPACHO' && status !== 'AGUARDANDO ASSINATURA';
    }).length;

    atualizarBadgeDOM('badge-menu-cartas-distribuicao', totalCartasDistribuicao);
    atualizarBadgeDOM('badge-menu-cartas-andamento', totalCartasAndamento);
    atualizarBadgeDOM('badge-menu-cartas-atrasados', totalCartasAtrasados);
    atualizarBadgeDOM('badge-menu-cartas-revisao', totalCartasRevisao);
    atualizarBadgeDOM('badge-menu-cartas-despacho', totalCartasDespacho);
    atualizarBadgeDOM('badge-menu-cartas-assinatura', totalCartasAssinatura);

    // BADGES OFÍCIOS EXTERNOS
    let externosFiltrados = typeof dadosExternosGlobais !== 'undefined' ? dadosExternosGlobais : [];
    if (usuarioAtivo.perfil === 'tecnico') {
        const tecnicoLogado = usuarioAtivo.nomePlanilha.toUpperCase().trim();
        externosFiltrados = externosFiltrados.filter(r => (r['TÉCNICO/ADMIN'] || '').toUpperCase().trim() === tecnicoLogado);
    } else if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.perfil.startsWith('gerencia')) {
        externosFiltrados = externosFiltrados.filter(r => {
            const tec = String(r['TÉCNICO/ADMIN'] || '').toUpperCase().trim();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO';
            if (!semTecnico) {
                const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tec] || 'S/G';
                return (setorInternoDoTecnico === usuarioAtivo.setor);
            }
            return true;
        });
    }

    let totalExtDist = externosFiltrados.filter(r => {
        const tec = String(r['TÉCNICO/ADMIN'] || '').trim();
        const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'Sem Técnico' || tec === 'Não atribuído';
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const isFinalizado = statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO';
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        return semTecnico && !isFinalizado && !hasResposta && statusRow !== 'FAZER DESPACHO' && statusRow !== 'AGUARDANDO ASSINATURA' && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO';
    }).length;

    let totalExtAndamento = externosFiltrados.filter(r => {
        const tec = String(r['TÉCNICO/ADMIN'] || '').trim();
        const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'Sem Técnico' || tec === 'Não atribuído';
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        return !semTecnico && (statusRow === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusRow === 'AGUARDANDO MANIFESTACAO TECNICA') && !hasResposta && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO';
    }).length;

    let totalExtRevisao = externosFiltrados.filter(r => {
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const isFinalizado = statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO';
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        return (hasResposta || statusRow === 'REVISÃO' || statusRow === 'REVISAO') && statusRow !== 'FAZER DESPACHO' && statusRow !== 'AGUARDANDO ASSINATURA' && !isFinalizado;
    }).length;

    let totalExtDespacho = externosFiltrados.filter(r => {
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        return (statusRow === 'FAZER DESPACHO' || statusRow === 'FAZER CI');
    }).length;

    let totalExtAssinatura = externosFiltrados.filter(r => {
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        return statusRow === 'AGUARDANDO ASSINATURA';
    }).length;

    atualizarBadgeDOM('badge-menu-externos-distribuicao', totalExtDist);
    atualizarBadgeDOM('badge-menu-externos-andamento', totalExtAndamento);
    atualizarBadgeDOM('badge-menu-externos-revisao', totalExtRevisao);
    atualizarBadgeDOM('badge-menu-externos-despacho', totalExtDespacho);
    atualizarBadgeDOM('badge-menu-externos-assinatura', totalExtAssinatura);
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
    "DIBIO",
    "PREFEITURA"
];

const opcoesTipoAba1 = [
    "JUNTADA",
    "OFÍCIO",
    "MT",
    "CARTA CONSULTA"
];

// MAPA INTERNO DE TÉCNICOS E SEUS RESPECTIVOS SETORES (SUB-ABAS)
const MAPA_TECNICOS_SETORES = {
    "JHONATAN": "DIFLOR",
    "LIVYA": "DIFLOR",
    "RODRIGO": "GEAA",
    "MARIANA OPP": "GEAA",
    "ELERI": "GCAR",
    "MILKA": "GCAR",
    "JOELTHON": "GEAA",
    "BEATRIZ": "GEAA",
    "ANDERSON": "GEAA",
    "HELEN CAROLINE": "GCAR",
    
    "MARIANA SH": "GEAA",
    "LARISSA": "GCAR",
    "ALEXANDRE": "GEAA",
    "MATEUS": "GEAA",
    
    "MARIA": "GEAA",
    "MICHAEL": "GCAR",
    "FABIANA": "GCAR",
    "CARLOS JULIANO": "GCAR",
    "JOSÉ RENATO": "GEAA",
    "JOSE RENATO": "GEAA",
    "CRISTIANE": "GCAR",
    "HILBATY": "GCAR",
    "FRANCIELLY": "GCAR",
    "JEAN PIERRE": "GEAA",
    "CARLA": "GEAA",
    "SUZIELLY": "GEAA",
    "MAX SANDER": "GEAA",
    "ETEVALDO": "GEAA",
    "ALLAN": "GEAA",
    "HENRIQUE": "GEAA"
};

// Mantém o array simples apenas para popular os seletores (<select>) da interface
const opcoesAutoTecnico = Object.keys(MAPA_TECNICOS_SETORES).sort();

const opcoesGerencia = [
    "DIFLOR",
    "GCAR",
    "GEAA"
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

    const selectTecnico = document.getElementById('cadTecnico');
    if (selectTecnico && selectTecnico.options.length === 0) {
        const elBlank = document.createElement('option');
        elBlank.value = ''; elBlank.textContent = '-- Selecione o Técnico --';
        selectTecnico.appendChild(elBlank);
        opcoesAutoTecnico.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt; el.textContent = opt;
            selectTecnico.appendChild(el);
        });
    }

    const selectGerencia = document.getElementById('cadGerencia');
    if (selectGerencia && selectGerencia.options.length === 0) {
        const elBlank = document.createElement('option');
        elBlank.value = ''; elBlank.textContent = '-- Selecione a Gerência --';
        selectGerencia.appendChild(elBlank);
        opcoesGerencia.forEach(opt => {
            const el = document.createElement('option');
            el.value = opt; el.textContent = opt;
            selectGerencia.appendChild(el);
        });
    }

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
    ['cadNup', 'cadOficioN', 'cadData', 'cadPrazo', 'cadComarca', 'cadTecnico', 'cadGerencia', 'cadCarms', 'cadReferencia', 'cadObservacao', 'cadOficioArquivo'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('cadAbaDestino').value = '0';
    document.getElementById('cadTipoPrazo').value = 'corridos';

    const label = document.getElementById('cadOficioArquivoLabel');
    if (label) {
        label.classList.remove('has-file');
        const textSpan = label.querySelector('.upload-text');
        if (textSpan) textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
    }
}

function updateFileNameOficio(input) {
    const label = document.getElementById('cadOficioArquivoLabel');
    const textSpan = label.querySelector('.upload-text');
    if (input.files && input.files.length > 0) {
        textSpan.innerHTML = `<strong>Ficheiro selecionado:</strong><br>${input.files[0].name}`;
        label.classList.add('has-file');
    } else {
        textSpan.innerText = 'Clique para selecionar ou arraste o ficheiro PDF';
        label.classList.remove('has-file');
    }
}

async function salvarNovoOficio() {
    const nup = document.getElementById('cadNup').value.trim();
    const oficioN = document.getElementById('cadOficioN').value.trim();
    const dataOficio = document.getElementById('cadData').value.trim();

    if (!nup || !oficioN || !dataOficio) {
        mostrarToast('NUP, Ofício N. e Data do Ofício são obrigatórios!', 'error');
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
    const prazoFinal = numPrazo ? (tipoPrazo === "uteis" ? `${numPrazo} DIAS UTEIS` : `${numPrazo} DIAS`) : "";

    const abaDestino = document.getElementById('cadAbaDestino').value;
    const fileInput = document.getElementById('cadOficioArquivo');
    let base64File = null;
    let fileName = null;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 15 * 1024 * 1024) {
            mostrarToast('Erro: O arquivo deve ter no máximo 15MB', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
            return;
        }

        const nupFormatado = nup;
        const oficioFormatado = oficioN.replace(/\//g, '-');

        fileName = (abaDestino === "1") ? `${oficioFormatado}.pdf` : `${nupFormatado}.pdf`;

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
            btn.style.opacity = '1';
            return;
        }
    }

    const payload = {
        acao: "cadastrar_oficio",
        aba_destino: abaDestino,
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
        observacao: document.getElementById('cadObservacao').value,
        base64: base64File,
        fileName: fileName
    };

    const novoObj = {
        'DATA': payload.data_oficio || '-',
        'NUP': payload.nup,
        'COMARCA': payload.comarca || '-',
        'OFÍCIO N.': payload.oficio_n,
        'TIPO': payload.tipo || '-',
        'REFERÊNCIA': payload.referencia || '-',
        'PRAZO': payload.prazo || '-',
        'DIAS RESTANTES': (payload.data_oficio && payload.prazo) ? String(calcularDiasRestantes(payload.data_oficio, payload.prazo)) : '-',
        'CARMS': payload.carms || '-',
        'STATUS DO CAR': '-',
        'TÉCNICO/ADMIN': payload.tecnico || 'S/T',
        'GERÊNCIA': payload.gerencia || 'S/G',
        'STATUS': 'AGUARDANDO DISTRIBUIÇÃO',
        'STATUS_RESPOSTA': '',
        'MOTIVO_AVALIACAO': '',
        'DATA_DISTRIBUICAO': '',
        'E-MS': '-',
        'CBRS': '-',
        'OBSERVAÇÃO': payload.observacao || '-',
        'LINK_OFICIO': '',
        'LINK_RESPOSTA': '',
        'OFICIO_INICIAL': '',
        'NUP_INICIAL': '',
        'LINK_INICIAL': '',
        'REITERACOES': []
    };

    dadosCoringa.unshift(novoObj);
    fecharModalCadastro();
    aplicarFiltros();
    atualizarBadgesNotificacao(dadosCoringa);
    atualizarCacheOficios();
    mostrarToast('Ofício lançado localmente. Sincronizando em background...', 'success');

    btn.innerHTML = textoOriginal;
    btn.disabled = false;
    btn.style.opacity = '1';

    try {
        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Ofício sincronizado com a nuvem com sucesso!', 'success');
            if (resultado.url) {
                novoObj['LINK_OFICIO'] = resultado.url;
                atualizarCacheOficios();
                aplicarFiltros();
            }
        } else {
            mostrarToast('Erro do Servidor ao salvar ofício: ' + resultado.message + ' (Revertendo)', 'error');
            dadosCoringa = dadosCoringa.filter(item => item !== novoObj);
            aplicarFiltros();
            atualizarBadgesNotificacao(dadosCoringa);
            atualizarCacheOficios();
        }
    } catch (error) {
        console.error(error);
        mostrarToast('Falha na internet. O ofício não foi salvo na nuvem. (Revertendo)', 'error');
        dadosCoringa = dadosCoringa.filter(item => item !== novoObj);
        aplicarFiltros();
        atualizarBadgesNotificacao(dadosCoringa);
        atualizarCacheOficios();
    }
}

// ============================================================================
// DRAG AND DROP - ARRASTAR E SOLTAR ARQUIVOS
// ============================================================================
function configurarDragAndDrop(inputId, labelId, updateCallback) {
    const input = document.getElementById(inputId);
    const label = document.getElementById(labelId);

    if (!input || !label) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        label.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        label.addEventListener(eventName, () => {
            label.style.backgroundColor = 'rgba(46, 160, 67, 0.2)';
            label.style.borderColor = '#3fb950';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        label.addEventListener(eventName, () => {
            label.style.backgroundColor = '';
            label.style.borderColor = '';
        }, false);
    });

    label.addEventListener('drop', (e) => {
        let dt = e.dataTransfer;
        let files = dt.files;

        if (files && files.length > 0) {
            const acceptedTypes = input.getAttribute('accept') || '';
            const fileName = files[0].name.toLowerCase();
            
            if (acceptedTypes.includes('.zip')) {
                if (!fileName.endsWith('.zip')) {
                    mostrarToast('Apenas ficheiros ZIP são permitidos para o Shapefile.', 'error');
                    return;
                }
            } else {
                if (files[0].type !== 'application/pdf' && !fileName.endsWith('.pdf')) {
                    mostrarToast('Apenas ficheiros PDF são permitidos.', 'error');
                    return;
                }
            }
            input.files = files;
            updateCallback(input);
        }
    }, false);
}

let reitDataPicker = null;

function abrirModalCadastroReiteracao(nup) {
    document.getElementById('reitOriginalNup').value = nup;
    document.getElementById('reitNovoNup').value = '';
    document.getElementById('reitNovoOficio').value = '';
    document.getElementById('reitNovaData').value = '';
    document.getElementById('reitNovoPrazoQtd').value = '';
    document.getElementById('reitNovoPrazoTipo').value = 'corridos';
    document.getElementById('reitNovoPdfFile').value = '';
    document.getElementById('reitPdfFileName').innerText = 'Nenhum arquivo selecionado';

    document.getElementById('cadastroReiteracaoModal').style.display = 'flex';

    if (!reitDataPicker) {
        reitDataPicker = flatpickr("#reitNovaData", {
            locale: "pt",
            dateFormat: "d/m/Y",
            allowInput: true
        });
    }
}

function fecharModalCadastroReiteracao() {
    document.getElementById('cadastroReiteracaoModal').style.display = 'none';
}

function updateReitFileName(input) {
    const span = document.getElementById('reitPdfFileName');
    if (input.files && input.files.length > 0) {
        span.innerText = input.files[0].name;
    } else {
        span.innerText = 'Nenhum arquivo selecionado';
    }
}

async function salvarReiteracaoOficio() {
    const nupOriginal = document.getElementById('reitOriginalNup').value;
    const novoNup = document.getElementById('reitNovoNup').value.trim();
    const novoOficio = document.getElementById('reitNovoOficio').value.trim();
    const novoData = document.getElementById('reitNovaData').value.trim();
    const prazoQtd = document.getElementById('reitNovoPrazoQtd').value.trim();
    const prazoTipo = document.getElementById('reitNovoPrazoTipo').value;

    if (!novoNup || !novoOficio || !novoData) {
        mostrarToast('NUP, Ofício N. e Data de Recebimento da Reiteração são obrigatórios!', 'error');
        return;
    }

    const btn = document.getElementById('btnSalvarReiteracao');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Preparando...'; btn.disabled = true;

    let prazoFinal = '';
    if (prazoQtd) {
        prazoFinal = (prazoTipo === "uteis") ? `${prazoQtd} DIAS UTEIS` : `${prazoQtd} DIAS`;
    }

    const fileInput = document.getElementById('reitNovoPdfFile');
    let base64File = null;
    let fileName = null;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 15 * 1024 * 1024) {
            mostrarToast('Erro: O arquivo deve ter no máximo 15MB', 'error');
            btn.innerHTML = txtOriginal; btn.disabled = false;
            return;
        }
        const oficioFormatado = novoOficio.replace(/\//g, '-');
        fileName = `${oficioFormatado}.pdf`;

        try {
            base64File = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result.split(',')[1]);
                reader.onerror = (e) => reject(e);
                reader.readAsDataURL(file);
            });
        } catch (e) {
            mostrarToast('Erro ao ler o arquivo', 'error');
            btn.innerHTML = txtOriginal; btn.disabled = false;
            return;
        }
    }

    // Optimistic Update
    const procRef = dadosCoringa.find(a => a['NUP'] === nupOriginal);
    let origData = '', origPrazo = '', origStatus = '', origStatusResp = '', origMot = '', origLinkResp = '';
    
    if (procRef) {
        origData = procRef['DATA'];
        origPrazo = procRef['PRAZO'];
        origStatus = procRef['STATUS'];
        origStatusResp = procRef['STATUS_RESPOSTA'];
        origMot = procRef['MOTIVO_AVALIACAO'];
        origLinkResp = procRef['LINK_RESPOSTA'];

        if (!procRef['REITERACOES']) procRef['REITERACOES'] = [];
        
        procRef['REITERACOES'].push({
            NUMERO: novoOficio,
            NUP: novoNup,
            LINK: '' // Will be updated when synced with cloud
        });

        procRef['DATA'] = novoData;
        if (prazoFinal) {
            procRef['PRAZO'] = prazoFinal;
        }
        
        const tec = (procRef['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
        const temTec = tec !== '' && tec !== '-' && tec !== 'S/T';
        procRef['STATUS'] = temTec ? 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' : 'AGUARDANDO DISTRIBUIÇÃO';
        procRef['STATUS_RESPOSTA'] = '';
        procRef['MOTIVO_AVALIACAO'] = '';
        procRef['LINK_RESPOSTA'] = '';

        const dr = calcularDiasRestantes(procRef['DATA'], procRef['PRAZO']);
        procRef['DIAS RESTANTES'] = !isNaN(dr) ? String(dr) : '-';
    }

    mostrarToast('Reiteração lançada localmente. Sincronizando...', 'success');
    fecharModalCadastroReiteracao();
    atualizarCacheOficios();
    aplicarFiltros();
    atualizarBadgesNotificacao(dadosCoringa);

    const newIndex = dadosExibidos.findIndex(r => r['NUP'] === nupOriginal);
    if (newIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') {
        abrirModal(newIndex);
    }

    try {
        const payload = {
            acao: "cadastrar_reiteracao_oficio",
            nupOriginal: nupOriginal,
            novoNup: novoNup,
            novoOficio: novoOficio,
            novoData: novoData,
            novoPrazo: prazoFinal,
            base64: base64File,
            fileName: fileName,
            username: usuarioAtivo ? usuarioAtivo.username : 'sistema'
        };

        const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const resultado = await resposta.json();
        if (resultado.status === 'success') {
            mostrarToast('Reiteração registrada na nuvem com sucesso!', 'success');
            if (procRef && resultado.url) {
                // Update the link of the last reiteration we added
                const reitList = procRef['REITERACOES'];
                if (reitList.length > 0) {
                    reitList[reitList.length - 1].LINK = resultado.url;
                }
                atualizarCacheOficios();
                aplicarFiltros();
                const currIndex = dadosExibidos.findIndex(r => r['NUP'] === nupOriginal);
                if (currIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') {
                    abrirModal(currIndex);
                }
            }
            if (typeof window.limparCacheHistoricoGlobal === 'function') window.limparCacheHistoricoGlobal();
        } else {
            throw new Error(resultado.message);
        }
    } catch (e) {
        console.error(e);
        mostrarToast('Erro ao sincronizar reiteração. Revertendo...', 'error');
        if (procRef) {
            procRef['REITERACOES'].pop();
            procRef['DATA'] = origData;
            procRef['PRAZO'] = origPrazo;
            procRef['STATUS'] = origStatus;
            procRef['STATUS_RESPOSTA'] = origStatusResp;
            procRef['MOTIVO_AVALIACAO'] = origMot;
            procRef['LINK_RESPOSTA'] = origLinkResp;

            const dr = calcularDiasRestantes(procRef['DATA'], procRef['PRAZO']);
            procRef['DIAS RESTANTES'] = !isNaN(dr) ? String(dr) : '-';
        }
        atualizarCacheOficios();
        aplicarFiltros();
        const currIndex = dadosExibidos.findIndex(r => r['NUP'] === nupOriginal);
        if (currIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') {
            abrirModal(currIndex);
        }
    } finally {
        btn.innerHTML = txtOriginal; btn.disabled = false;
    }
}

configurarDragAndDrop('cadOficioArquivo', 'cadOficioArquivoLabel', updateFileNameOficio);
document.addEventListener('DOMContentLoaded', iniciarSistema);