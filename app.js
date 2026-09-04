let usuarioAtivo = JSON.parse(sessionStorage.getItem('corino_user'));

if (!usuarioAtivo) {
    window.location.href = 'login.html';
} else if (usuarioAtivo.username === 'rcosta' && (!usuarioAtivo.nomePlanilha || usuarioAtivo.nomePlanilha === 'Rodrigo Costa')) {
    usuarioAtivo.nomePlanilha = 'RODRIGO';
    sessionStorage.setItem('corino_user', JSON.stringify(usuarioAtivo));
}

// ============================================================================
// MAPA COMPLETO DE TÉCNICOS, ADMINISTRATIVOS E REVISORES (RBAC)
// ============================================================================
window.MAPA_TECNICOS_SETORES = {
    // GEAA
    "ADRIANA": "GEAA",
    "ALCEBIADES": "GEAA",
    "ALEXANDRE": "GEAA",
    "ALLAN": "GEAA",
    "ANDERSON": "GEAA",
    "BARBARA": "GEAA",
    "BEATRIZ": "GEAA",
    "CARLA": "GEAA",
    "CORINA": "GEAA",
    "DINA": "GEAA",
    "ETEVALDO": "GEAA",
    "HELLEN": "GEAA",
    "HENRIQUE": "GEAA",
    "HERUS": "GEAA",
    "JEAN PIERRE": "GEAA",
    "JOELTHON": "GEAA",
    "JONIEL": "GEAA",
    "JOSÉ RENATO": "GEAA",
    "LUCIANO": "GEAA",
    "LUIZ": "GEAA",
    "MARIA": "GEAA",
    "MARIANA SH": "GEAA",
    "MARIANA OPP": "GEAA",
    "MATEUS": "GEAA",
    "MAX SANDER": "GEAA",
    "RHOANDER": "GEAA",
    "RODRIGO": "GEAA",
    "SUZIELLY": "GEAA",

    // GCAR
    "CARLOS JULIANO": "GCAR",
    "CRISTIANE": "GCAR",
    "DIANESSA": "GCAR",
    "ELERI": "GCAR",
    "ERLISSON": "GCAR",
    "FABIANA": "GCAR",
    "FRANCIELLY": "GCAR",
    "GABRIELA": "GCAR",
    "HELEN CAROLINE": "GCAR",
    "HILBATY": "GCAR",
    "LARISSA": "GCAR",
    "MICHAEL": "GCAR",
    "MILKA": "GCAR",
    "NATTANA": "GCAR",

    // DIFLOR
    "JHONATAN": "DIFLOR",
    "LIVYA": "DIFLOR",
    "OSVALDO": "DIFLOR"
};

// Aliases de compatibilidade para buscas de setor em registros legados
const ALIASES_SETORES = {
    "JOSE RENATO": "GEAA",
    "GEAA": "GEAA",
    "GCAR": "GCAR",
    "GEAMB": "GEAMB",
    "GERÊNCIA DE ASSUNTOS AMBIENTAIS": "GEAMB",
    "DIFLOR": "DIFLOR",
    "DIRETORIA FLORESTAL": "DIFLOR"
};

const MAPA_TECNICOS_SETORES = new Proxy(window.MAPA_TECNICOS_SETORES, {
    get: function(target, prop) {
        if (typeof prop === 'string') {
            const pUpper = prop.trim().toUpperCase();
            return target[pUpper] || ALIASES_SETORES[pUpper] || undefined;
        }
        return target[prop];
    }
});

window.opcoesAutoTecnico = Object.keys(window.MAPA_TECNICOS_SETORES).sort((a, b) => a.localeCompare(b, 'pt-BR'));
const opcoesAutoTecnico = window.opcoesAutoTecnico;

function normalizarTextoTecnico(str) {
    if (!str) return '';
    return String(str)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
}

/**
 * Verifica se um registro de processo pertence ao técnico logado de forma resiliente e precisa.
 * - Suporta insensibilidade a acentos (ex: "JOSÉ RENATO" === "JOSE RENATO").
 * - Suporta primeiro nome ("RODRIGO" === "RODRIGO COSTA").
 * - Evita colisões de substring (ex: "MARIA" NÃO colide com "MARIANA SH" ou "MARIANA OPP").
 */
window.isMesmoTecnico = function(tecRegistro, usuario) {
    if (!tecRegistro || !usuario) return false;
    const t = normalizarTextoTecnico(tecRegistro);
    if (!t || t === '-' || t === 'S/T' || t === 'SEM TECNICO' || t === 'NAO ATRIBUIDO' || t === 'SEM TECNICO/ADM') {
        return false;
    }

    const tecPlanilha = normalizarTextoTecnico(usuario.nomePlanilha);
    const tecNome = normalizarTextoTecnico(usuario.nomeCompleto || usuario.nome_completo);
    const tecUser = normalizarTextoTecnico(usuario.username);

    // 1. Igualdade direta normalizada (sem acentos)
    if (tecPlanilha && t === tecPlanilha) return true;
    if (tecNome && t === tecNome) return true;
    if (tecUser && t === tecUser) return true;

    // 2. Quebra em palavras / tokens
    const wordsT = t.split(/\s+/).filter(Boolean);
    const wordsNome = tecNome.split(/\s+/).filter(Boolean);
    const wordsPlanilha = tecPlanilha.split(/\s+/).filter(Boolean);

    // 3. Se o registro tem apenas 1 palavra (ex: "RODRIGO", "MARIA", "MICHAEL")
    if (wordsT.length === 1) {
        const palavraT = wordsT[0];
        if (wordsPlanilha.length > 0 && palavraT === wordsPlanilha[0]) return true;
        if (wordsNome.length > 0 && palavraT === wordsNome[0]) return true;
        return false;
    }

    // 4. Se o registro tem mais de uma palavra (ex: "CARLOS JULIANO", "MARIANA SH", "JOSE RENATO")
    if (wordsPlanilha.length >= wordsT.length) {
        const matchPlanilha = wordsT.every((w, idx) => w === wordsPlanilha[idx]);
        if (matchPlanilha) return true;
    }
    if (wordsNome.length >= wordsT.length) {
        const matchNome = wordsT.every((w, idx) => w === wordsNome[idx]);
        if (matchNome) return true;
    }

    // 5. Inclusão de prefixo completo (ex: "CARLOS JULIANO" vs "CARLOS JULIANO FONSECA")
    if (tecPlanilha && tecNome.startsWith(t + ' ')) return true;
    if (tecPlanilha && t.startsWith(tecPlanilha + ' ')) return true;

    return false;
};

// ============================================================================
// MATRIZ DE PERFIS E PERMISSÕES (RBAC) - CORINO WEB
// ============================================================================
window.isPerfilTecnico = function() {
    return usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.role === 'tecnico');
};

window.isPerfilRevisor = function() {
    return usuarioAtivo && (usuarioAtivo.perfil === 'revisor');
};

window.isPerfilAdministrativo = function() {
    return usuarioAtivo && (usuarioAtivo.perfil === 'administrativo' || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
};

window.isPerfilAdmin = function() {
    return usuarioAtivo && (usuarioAtivo.role === 'admin' || usuarioAtivo.perfil === 'administrativo' || usuarioAtivo.username === 'diflor' || usuarioAtivo.username === 'jcoene' || usuarioAtivo.username === 'jhonatan');
};

window.podeCadastrarProcesso = function() {
    return window.isPerfilAdministrativo();
};

window.podeRedistribuirTecnico = function(setorItem) {
    if (!usuarioAtivo) return false;
    if (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR') return true;
    if (usuarioAtivo.perfil === 'administrativo') {
        if (!setorItem) return true;
        return usuarioAtivo.setor === setorItem;
    }
    return false;
};

window.podeAvaliarManifestacao = function(setorItem) {
    if (!usuarioAtivo) return false;
    if (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR') return true;
    if (usuarioAtivo.perfil === 'revisor') {
        if (!setorItem) return true;
        return usuarioAtivo.setor === setorItem;
    }
    return false;
};

window.podeConfeccionarDespachoOuCI = function(setorItem) {
    return window.isPerfilAdministrativo();
};

window.podeSobrestarProcesso = function(setorItem) {
    return window.isPerfilAdministrativo();
};

window.podeAssinarOuConcluir = function(setorItem) {
    return window.isPerfilAdministrativo();
};

window.podeCadastrarReiteracao = function(setorItem) {
    if (!usuarioAtivo) return false;
    if (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR') return true;
    if (usuarioAtivo.perfil === 'administrativo') {
        if (!setorItem) return true;
        return usuarioAtivo.setor === setorItem;
    }
    return false;
};
// ============================================================================

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
    const keyOficios = `corino_cache_dados_coringa_v3`;
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
        if (typeof iniciarRelogioNavbar === 'function') iniciarRelogioNavbar();

        const displayDiv = document.getElementById('user-display-name');
        if (displayDiv && usuarioAtivo) {
            let textoPerfil = usuarioAtivo.perfil.toUpperCase();
            displayDiv.innerText = `${usuarioAtivo.nomePlanilha} (${textoPerfil} - ${usuarioAtivo.setor || 'DIFLOR'})`;
        }

        const isTec = window.isPerfilTecnico();
        const isRev = window.isPerfilRevisor();
        const isAdm = window.isPerfilAdministrativo();
        const isAdminMaster = window.isPerfilAdmin();

        // Exibe botão de Administração na top navbar para administradores
        const topAdminBtn = document.getElementById('top-btn-admin');
        if (topAdminBtn) {
            topAdminBtn.style.display = isAdminMaster ? 'inline-flex' : 'none';
        }

        // Configuração de abas por perfil
        const btnDistribuicao = document.getElementById('btn-menu-distribuicao');
        const btnCartasDistribuicao = document.getElementById('btn-menu-cartas-distribuicao');
        const btnExtDistribuicao = document.getElementById('btn-menu-externos-distribuicao');

        if (btnDistribuicao) btnDistribuicao.style.display = isAdm ? 'block' : 'none';
        if (btnCartasDistribuicao) btnCartasDistribuicao.style.display = isAdm ? 'block' : 'none';
        if (btnExtDistribuicao) btnExtDistribuicao.style.display = isAdm ? 'block' : 'none';

        const btnResp = document.getElementById('btn-menu-respondidos');
        const btnCartasResp = document.getElementById('btn-menu-cartas-revisao');
        const btnExtResp = document.getElementById('btn-menu-externos-revisao');

        if (btnResp) btnResp.style.display = (isRev || isAdm || isTec) ? 'block' : 'none';
        if (btnCartasResp) btnCartasResp.style.display = (isRev || isAdm || isTec) ? 'block' : 'none';
        if (btnExtResp) btnExtResp.style.display = (isRev || isAdm || isTec) ? 'block' : 'none';

        // Sub-abas de despacho e assinatura (exclusivas do administrativo)
        const subAbasAdm = [
            'btn-menu-comunicacao', 'btn-menu-assinatura-oficios',
            'btn-menu-cartas-despacho', 'btn-menu-cartas-assinatura',
            'btn-menu-externos-despacho', 'btn-menu-externos-assinatura',
            'link-top-comunicacao', 'link-top-assinatura-oficios',
            'link-top-cartas-despacho', 'link-top-cartas-assinatura',
            'link-top-externos-despacho', 'link-top-externos-assinatura'
        ];
        subAbasAdm.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = isAdm ? '' : 'none';
        });

        const linksTopRevisao = ['link-top-respondidos', 'link-top-cartas-revisao', 'link-top-externos-revisao'];
        linksTopRevisao.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = (isRev || isAdm || isTec) ? '' : 'none';
        });

        if (isTec) {
            document.body.classList.add('perfil-tecnico');
            const cardDist = document.getElementById('kpi-card-distribuicao');
            if (cardDist) cardDist.style.display = 'none';
            const kpiGrid = document.querySelector('.kpi-row-grid');
            if (kpiGrid) kpiGrid.classList.add('kpi-grid-5');

            ['btn-tab-aprovados', 'btn-tab-reprovados', 'btn-tab-todos'].forEach(id => {
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

            const filtrosGerencia = ['cgCarms', 'ms-cgGerencia', 'filtro-ext-carms'];
            filtrosGerencia.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const parent = el.closest('.filter-group');
                    if (parent) parent.style.display = 'none';
                }
            });
        } else {
            document.body.classList.remove('perfil-tecnico');
            const cardDist = document.getElementById('kpi-card-distribuicao');
            if (cardDist) cardDist.style.display = '';
            const kpiGrid = document.querySelector('.kpi-row-grid');
            if (kpiGrid) kpiGrid.classList.remove('kpi-grid-5');

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

            const miniTabsSetoresOficios = [
                'mini-tabs-distribuicao', 'mini-tabs-andamento', 'mini-tabs-atrasados'
            ];
            miniTabsSetoresOficios.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = isAdm ? 'flex' : 'none';
            });

            const filtrosGerencia = ['cgCarms', 'ms-cgGerencia', 'filtro-ext-carms'];
            filtrosGerencia.forEach(id => {
                const el = document.getElementById(id);
                if (el) {
                    const parent = el.closest('.filter-group');
                    if (parent) parent.style.display = '';
                }
            });
        }

        const savedAba = localStorage.getItem('corino_aba_ativa') || 'inicio';
        mudarAbaPrincipal(savedAba);

        const keyOficios = `corino_cache_dados_coringa_v3`;

        // Migrar dados temporários pré-carregados se existirem
        const tempRawDados = localStorage.getItem('corino_temp_raw_dados');
        if (tempRawDados) {
            try {
                const dadosBrutos = JSON.parse(tempRawDados);
                const dadosProcessados = dadosBrutos.map(limparEPadronizarLinha);
                dadosCoringa = dadosProcessados;
                localStorage.setItem(keyOficios, JSON.stringify(dadosCoringa));
                localStorage.removeItem('corino_temp_raw_dados');
            } catch (e) {
                console.error("Erro ao processar dados pré-carregados de Ofícios:", e);
            }
        }

        const cacheSalvo = localStorage.getItem(keyOficios);
        let carregouDeCache = false;

        if (cacheSalvo) {
            try {
                const parsed = JSON.parse(cacheSalvo);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    dadosCoringa = parsed;
                    dadosCoringa.forEach(linha => {
                        let t = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
                        if (t === 'JOSE RENATO') linha['TÉCNICO/ADMIN'] = 'JOSÉ RENATO';
                        const diasRestantesVal = calcularDiasRestantes(linha['DATA'], linha['PRAZO']);
                        linha['DIAS RESTANTES'] = !isNaN(diasRestantesVal) ? String(diasRestantesVal) : '-';
                    });
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
                    if (filtroAtivo === 'inicio') {
                        atualizarDashboardInicio();
                    } else {
                        aplicarFiltros();
                    }
                }
            } catch (e) {
                console.error("Erro ao processar cache de Ofícios:", e);
            }
        }

        buscarDadosGoogleSheets().then(dadosBrutos => {
            if (Array.isArray(dadosBrutos) && dadosBrutos.length > 0) {
                dadosBrutos.forEach(linha => {
                    let t = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
                    if (t === 'JOSE RENATO') linha['TÉCNICO/ADMIN'] = 'JOSÉ RENATO';
                    const diasRestantesVal = calcularDiasRestantes(linha['DATA'], linha['PRAZO']);
                    linha['DIAS RESTANTES'] = !isNaN(diasRestantesVal) ? String(diasRestantesVal) : '-';
                });

                dadosCoringa = dadosBrutos;
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

                if (filtroAtivo === 'inicio') {
                    atualizarDashboardInicio();
                } else if (filtroAtivo !== 'autos' && !filtroAtivo.startsWith('externos') && !filtroAtivo.startsWith('cartas')) {
                    aplicarFiltros();
                }
            }
        }).catch(erro => {
            console.error("Erro ao sincronizar dados em background:", erro);
            if (!carregouDeCache) {
                const loadingEl = document.getElementById('loading');
                if (loadingEl) loadingEl.innerText = "Erro ao conectar com a base de dados central.";
            }
        });

        carregarHistoricoGlobalBackground();
        if (typeof carregarAutos === 'function') carregarAutos();
        if (typeof carregarExternos === 'function') carregarExternos();
        if (typeof carregarCartas === 'function') carregarCartas();
    } catch (e) {
        console.error("Erro fatal ao iniciar sistema:", e);
    }
}

function popularTodosOsSelectsNativos() {
    const gerencias = [...new Set(dadosCoringa.map(d => d['GERÊNCIA']))].filter(x => x && x !== 'S/G').sort();
    const municipios = [...new Set(dadosCoringa.map(d => d['COMARCA']))].filter(x => x && x !== '-').sort();
    const statusList = [...new Set(dadosCoringa.map(d => d['STATUS']))].filter(x => x && x !== '-').sort();

    // Normaliza os técnicos nos próprios registros para consistência total
    dadosCoringa.forEach(d => {
        let t = (d['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
        if (t === 'JOSE RENATO') {
            d['TÉCNICO/ADMIN'] = 'JOSÉ RENATO';
        }
    });

    const nomesSetoresOcultos = new Set(['GCAR', 'GEAA', 'GEAMB', 'DIFLOR', 'DIRETORIA FLORESTAL', 'GERÊNCIA DE ASSUNTOS AMBIENTAIS', 'S/T', 'S/G', '-', 'SEM TÉCNICO', 'SEM TÉCNICO/ADM', 'NÃO ATRIBUÍDO']);

    const tecnicos = [...new Set(dadosCoringa.map(d => {
        let t = (d['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
        if (t === 'JOSE RENATO') t = 'JOSÉ RENATO';
        return t;
    }))].filter(x => x && !nomesSetoresOcultos.has(x)).sort((a, b) => a.localeCompare(b, 'pt-BR'));

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
    document.querySelectorAll('.top-nav-btn').forEach(b => b.classList.remove('active'));

    const btnAtivo = document.getElementById(`btn-menu-${tipo}`);
    if (btnAtivo) btnAtivo.classList.add('active');

    // Ativa botão no Top Navbar
    if (tipo === 'inicio') {
        const topInicio = document.getElementById('top-btn-inicio');
        if (topInicio) topInicio.classList.add('active');
    } else if (tipo === 'todos' || tipo === 'distribuicao' || tipo === 'andamento' || tipo === 'atrasados' || tipo === 'respondidos' || tipo === 'comunicacao' || tipo === 'assinatura-oficios') {
        const topOficios = document.getElementById('top-btn-oficios');
        if (topOficios) topOficios.classList.add('active');
    } else if (tipo.startsWith('cartas')) {
        const topCartas = document.getElementById('top-btn-cartas');
        if (topCartas) topCartas.classList.add('active');
    } else if (tipo === 'autos') {
        const topAutos = document.getElementById('top-btn-autos');
        if (topAutos) topAutos.classList.add('active');
    } else if (tipo.startsWith('externos')) {
        const topExternos = document.getElementById('top-btn-externos');
        if (topExternos) topExternos.classList.add('active');
    } else if (tipo === 'admin') {
        const topAdmin = document.getElementById('top-btn-admin');
        if (topAdmin) topAdmin.classList.add('active');
    }

    // Fecha dropdowns do Top Navbar
    document.querySelectorAll('.top-dropdown-content').forEach(d => d.style.display = 'none');

    // Sincroniza classes active e display de todas as seções
    document.querySelectorAll('.tab-section').forEach(d => {
        d.style.display = 'none';
        d.classList.remove('active');
    });

    const targetAbaId = (tipo === 'inicio') ? 'aba-inicio' :
                        (tipo.startsWith('cartas')) ? 'aba-cartas' :
                        (tipo === 'autos') ? 'aba-autos' :
                        (tipo === 'admin') ? 'aba-admin' :
                        (tipo.startsWith('externos')) ? 'aba-externos' : `aba-${tipo}`;
    
    const targetAbaEl = document.getElementById(targetAbaId);
    if (targetAbaEl) {
        targetAbaEl.style.display = 'block';
        targetAbaEl.classList.add('active');
    }

    if (tipo === 'inicio') {
        atualizarDashboardInicio();
    } else if (tipo === 'admin') {
        if (typeof carregarPainelAdmin === 'function') {
            carregarPainelAdmin();
        }
    }

    const btnCTA = document.getElementById('btn-cadastrar-processo');
    if (btnCTA) {
        btnCTA.style.display = (tipo === 'inicio' && window.podeCadastrarProcesso()) ? 'inline-flex' : 'none';
    }

    const fabOficio = document.getElementById('fab-novo-oficio');
    const fabAuto = document.getElementById('fab-novo-auto');
    const fabExterno = document.getElementById('fab-novo-externo');
    const fabCarta = document.getElementById('fab-novo-carta');

    if (fabOficio) fabOficio.style.display = 'none';
    if (fabAuto) fabAuto.style.display = 'none';
    if (fabExterno) fabExterno.style.display = 'none';
    if (fabCarta) fabCarta.style.display = 'none';

    if (window.podeCadastrarProcesso()) {
        if (tipo === 'todos' && fabOficio) fabOficio.style.display = 'flex';

        if (tipo === 'autos' && fabAuto) {
            const modAutosHeader = document.getElementById('header-mod-autos');
            const isAutosModuleVisible = modAutosHeader && modAutosHeader.parentElement.style.display !== 'none';
            if (isAutosModuleVisible) fabAuto.style.display = 'flex';
        }

        if (tipo.startsWith('externos') && fabExterno) fabExterno.style.display = 'flex';

        if (tipo.startsWith('cartas') && fabCarta) fabCarta.style.display = 'flex';
    }

    const isOficio = (tipo === 'todos' || tipo === 'distribuicao' || tipo === 'andamento' || tipo === 'atrasados' || tipo === 'respondidos' || tipo === 'comunicacao' || tipo === 'assinatura-oficios');
    const cc = document.getElementById('cards-container');
    const es = document.getElementById('export-section');

    if (!isOficio) {
        if (es) es.style.display = 'none';
        if (cc) {
            cc.innerHTML = '';
            cc.style.display = 'none';
        }
    } else {
        if (es) es.style.display = 'flex';
        if (cc) cc.style.display = 'grid';
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
        const isGlobalManager = usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
        const isRevisorOrAdm = usuarioAtivo && (typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || isGlobalManager);
        
        const miniTabsExternos = document.getElementById('mini-tabs-externos');
        const miniTabsExternosRevisao = document.getElementById('mini-tabs-externos-revisao');
        
        if (miniTabsExternos) miniTabsExternos.style.display = (isGlobalManager && !isRevisao && !isConsultaGeral) ? 'flex' : 'none';
        if (miniTabsExternosRevisao) miniTabsExternosRevisao.style.display = (isRevisorOrAdm && isRevisao) ? 'flex' : 'none';

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
        const isGlobalManager = usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
        const isRevisorOrAdm = usuarioAtivo && (typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || isGlobalManager);
        
        const miniTabsCartas = document.getElementById('mini-tabs-cartas');
        const miniTabsCartasRevisao = document.getElementById('mini-tabs-cartas-revisao');
        
        if (miniTabsCartas) miniTabsCartas.style.display = (isGlobalManager && !isRevisao && !isConsultaGeral) ? 'flex' : 'none';
        if (miniTabsCartasRevisao) miniTabsCartasRevisao.style.display = (isRevisorOrAdm && isRevisao) ? 'flex' : 'none';

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
            infoStr = `<i class="ci ci-pin"></i> Encontrado no NUP Inicial: <strong>${r['NUP_INICIAL']}</strong>`;
        }

        if (!matchNup && r['REITERACOES'] && r['REITERACOES'].length > 0) {
            for (let i = 0; i < r['REITERACOES'].length; i++) {
                if (r['REITERACOES'][i].NUP && r['REITERACOES'][i].NUP.toLowerCase().includes(nupTermo)) {
                    matchNup = true;
                    if (!infoStr) infoStr = `<i class="ci ci-pin"></i> Encontrado no NUP da ${i + 1}ª Reiteração: <strong>${r['REITERACOES'][i].NUP}</strong>`;
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
            if (!infoStr) infoStr = `<i class="ci ci-pin"></i> Encontrado no Ofício Inicial: <strong>${r['OFICIO_INICIAL'].replace(/\.pdf/gi, '')}</strong>`;
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
    const isOficio = (filtroAtivo === 'todos' || filtroAtivo === 'distribuicao' || filtroAtivo === 'andamento' || filtroAtivo === 'atrasados' || filtroAtivo === 'respondidos' || filtroAtivo === 'comunicacao' || filtroAtivo === 'assinatura-oficios');

    if (!isOficio) {
        const cc = document.getElementById('cards-container');
        if (cc) { cc.innerHTML = ''; cc.style.display = 'none'; }
        const es = document.getElementById('export-section');
        if (es) es.style.display = 'none';
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

            // 1. Ocultar processos "Sem Técnico" + "Finalizado" para técnicos
            if (semTecnico && isFinalizado && usuarioAtivo.perfil === 'tecnico') {
                return false;
            }

            // 2. Técnicos só visualizam processos de competência direta
            if (usuarioAtivo.perfil === 'tecnico') {
                if (!window.isMesmoTecnico(tec, usuarioAtivo)) {
                    return false;
                }
            }

            // 3. Usuários setoriais (GCAR / GEAA / GEAMB) só visualizam processos de competência da sua gerência
            if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
                if (!semTecnico) {
                    const setorInternoDoTecnico = MAPA_TECNICOS_SETORES[tec] || 'S/G';
                    const gerenciaRegistro = (linha['GERÊNCIA'] || '').trim().toUpperCase();
                    if (setorInternoDoTecnico !== usuarioAtivo.setor && gerenciaRegistro !== usuarioAtivo.setor) return false;
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
    const isOficio = (filtroAtivo === 'todos' || filtroAtivo === 'distribuicao' || filtroAtivo === 'andamento' || filtroAtivo === 'atrasados' || filtroAtivo === 'respondidos' || filtroAtivo === 'comunicacao' || filtroAtivo === 'assinatura-oficios');
    const container = document.getElementById('cards-container');
    const exportSection = document.getElementById('export-section');

    if (!isOficio) {
        if (container) { container.innerHTML = ''; container.style.display = 'none'; }
        if (exportSection) exportSection.style.display = 'none';
        return;
    }

    dadosExibidos = dados;

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
                    <button onclick="anexarPdfOriginalOficio(event, '${linha['NUP']}')" class="btn-drive btn-upload" style="font-size: 12px; padding: 6px 12px; width: auto; height: auto;"><i class="ci ci-paperclip"></i> Anexar Ofício Inicial</button>
                </div>
            `;
        }
        let btnAnexar = '';
        const linkRespostaVerificacao = linha['LINK_RESPOSTA'];
        const temRespostaVinculada = linkRespostaVerificacao && linkRespostaVerificacao.trim() !== '' && linkRespostaVerificacao.trim() !== '-';

        if (usuarioAtivo) {
            if (temRespostaVinculada) {
                const isAprovadoBackend = (linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
                const isFazerCI = (linha['STATUS'] || '').toUpperCase().trim().replace(/\./g, '') === 'FAZER CI';
                const isGestor = typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');

                let blockRemoval = false;
                if (!isGestor && (isAprovadoBackend || isFazerCI)) {
                    blockRemoval = true;
                }

                if (blockRemoval) {
                    btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px; width: 100%;"><i class="ci ci-lock"></i> Documento aprovado. Apenas a Diretoria pode removê-lo.</div>`;
                } else {
                    btnAnexar = `<button onclick="removerDocumento(event, '${linha['NUP']}')" class="btn-drive btn-red-outline"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
                }
            } else if (usuarioAtivo.perfil === 'tecnico' || (typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo())) {
                btnAnexar = `<button onclick="anexarDocumento(event, '${linha['NUP']}')" class="btn-drive btn-upload"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
            }
        }

        if (linkRaw && linkRaw.trim() !== '' && linkRaw.trim() !== '-') {
            if (isLinkGCS(linkRaw)) {
                htmlPreviewIcon = `<button onclick="abrirPreview('${linkRaw}', ${index})" class="btn-inline-preview" title="Pré-visualizar Ofício (LGPD Seguro)"></button>`;
                htmlLink = `
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button onclick="dispararDownloadSeguro('${linkRaw}', 'Oficio_${linha['NUP']}.pdf')" class="btn-drive btn-download">⬇️ Download (LGPD)</button>
                        ${btnAnexar}
                    </div>
                `;
            } else {
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
                            <a href="${linkRaw}" target="_blank" class="btn-drive"><i class="ci ci-external"></i> Abrir Link Vinculado</a>
                            ${btnAnexar}
                        </div>
                    `;
                }
            }
        } else {
            if (btnAnexar) {
                htmlLink = `<div style="display: flex; gap: 10px; flex-wrap: wrap;">${btnAnexar}</div>`;
            }
        }

        let htmlDiretoriaBotoes = '';
        const tecUpper = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
        const setorItem = MAPA_TECNICOS_SETORES[tecUpper] || (linha['GERÊNCIA'] || '').trim().toUpperCase();
        const statusGeralAtualizado = (linha['STATUS'] || '').toUpperCase().trim();
        const isSemTecnico = !linha['TÉCNICO/ADMIN'] || linha['TÉCNICO/ADMIN'] === '-' || linha['TÉCNICO/ADMIN'] === 'S/T';

        // 1. Ações de Distribuição e Redistribuição (Exclusivo Administrativo)
        if (window.podeRedistribuirTecnico(setorItem)) {
            if (isSemTecnico) {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Distribuir / Atribuir Técnico</button>`;
            } else {
                htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Redistribuir Técnico</button>`;
            }
        }

        // 2. Ações de Fluxo: Fazer C.I e Sobrestar (Exclusivo Administrativo)
        if (window.podeConfeccionarDespachoOuCI(setorItem)) {
            if (statusGeralAtualizado === 'FAZER CI' || statusGeralAtualizado === 'FAZER C.I') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(41, 128, 185, 0.08); border: 1px solid rgba(41, 128, 185, 0.3); border-radius: 6px;">
                        <strong style="color: #2980b9; font-size: 13px; display: block; margin-bottom: 10px;">📋 Ações de Fluxo (Comunicação Interna - C.I):</strong>
                        <div style="display: flex; gap: 10px; flex-direction: column;">
                            <button onclick="atualizarStatusCI(event, '${linha['NUP']}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background-color: #2980b9; border-color: #1c5986; color: white; margin: 0; font-size: 14px;">✅ Confirmar Confecção da C.I</button>
                            <button onclick="abrirModalSobrestar('${linha['NUP']}', 'oficio')" class="btn-drive" style="background-color: #f39c12; border-color: #d68910; color: #111; font-weight: bold; margin: 0; font-size: 14px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                        </div>
                    </div>
                `;
            } else if (statusGeralAtualizado === 'SOBRESTADO') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.4); border-radius: 6px;">
                        <strong style="color: #f39c12; font-size: 13px; display: block; margin-bottom: 8px;">⏸️ Processo Sobrestado (Encaminhado para: ${linha['SOBRESTADO_SETOR'] || 'Setor Externo'})</strong>
                        ${linha['SOBRESTADO_MOTIVO'] ? `<div style="font-size: 12px; color: #ccc; margin-bottom: 12px;"><strong>Motivo:</strong> ${linha['SOBRESTADO_MOTIVO']}</div>` : ''}
                        <button onclick="abrirModalRetornoSobrestamento('${linha['NUP']}', 'oficio')" class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; color: white; width: 100%; margin: 0; font-size: 14px; font-weight: bold;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
                    </div>
                `;
            } else if (statusGeralAtualizado === 'AGUARDANDO ASSINATURA') {
                htmlDiretoriaBotoes += `
                    <div style="margin-top: 15px; padding: 15px; background-color: rgba(142, 68, 173, 0.08); border: 1px solid rgba(142, 68, 173, 0.3); border-radius: 6px;">
                        <strong style="color: #8e44ad; font-size: 13px; display: block; margin-bottom: 10px;">📋 Ações de Fluxo (Assinatura):</strong>
                        <button onclick="atualizarStatusCI(event, '${linha['NUP']}', 'FINALIZADO')" class="btn-drive" style="background-color: #8e44ad; border-color: #6c3483; color: white; width: 100%; margin: 0; font-size: 14px;">✍️ Confirmar Assinatura Realizada</button>
                    </div>
                `;
            }
        }

        // 3. Ações de Revisão (Exclusivo Revisor)
        let acoesRevisorHtml = '';
        const statusRespAval = (linha['STATUS_RESPOSTA'] || '').toUpperCase();
        if (window.podeAvaliarManifestacao(setorItem) && temRespostaVinculada && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO') {
            acoesRevisorHtml = `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(255, 165, 0, 0.08); border: 1px solid rgba(255, 165, 0, 0.3); border-radius: 6px;">
                    <strong style="color: #ffa500; font-size: 13px; display: block; margin-bottom: 10px;">📋 Avaliação de Resposta Técnica (Revisor):</strong>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="avaliarResposta(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1; margin: 0;"><i class="ci ci-check"></i> Aprovar</button>
                        <button onclick="avaliarResposta(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1; margin: 0;"><i class="ci ci-close"></i> Reprovar</button>
                    </div>
                </div>
            `;
        }

        // 4. Seletor de Status Manual (Apenas Administrativo DIFLOR / Diretoria)
        if (usuarioAtivo && (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR')) {
            const opcoesOficioStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "REVISÃO", "FAZER CI", "SOBRESTADO", "AGUARDANDO ASSINATURA", "FINALIZADO", "TRAMITADO", "ARQUIVADO"];
            let optionsHtml = opcoesOficioStatus.map(st => `<option value="${st}" ${st === statusGeralAtualizado ? 'selected' : ''}>${st}</option>`).join('');
            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                    <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;"><i class="ci ci-settings"></i> GESTÃO DE STATUS (DIRETORIA)</div>
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
            let botaoResp = '';
            if (isLinkGCS(linkRespostaVerificacao)) {
                botaoResp = `<button onclick="abrirPreview('${linkRespostaVerificacao}', ${index})" class="btn-drive btn-orange-outline"><i class="ci ci-eye"></i> Pré-visualizar Resposta (LGPD)</button>`;
            } else {
                const respId = extrairIdDrive(linkRespostaVerificacao);
                if (respId) {
                    const respPreview = `https://drive.google.com/file/d/${respId}/preview`;
                    botaoResp = `<button onclick="abrirPreview('${respPreview}', ${index})" class="btn-drive btn-orange-outline"><i class="ci ci-eye"></i> Pré-visualizar Resposta</button>`;
                } else {
                    botaoResp = `<a href="${linkRespostaVerificacao}" target="_blank" class="btn-drive btn-orange-outline"><i class="ci ci-external"></i> Abrir Resposta no Drive</a>`;
                }
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
        
        if (linha['MANIFESTACAO_PRELIMINAR']) {
            htmlHistorico += gerarHtmlDocExtra('Manifestação Preliminar Aprovada (Sobrestamento)', 'Ver Arquivo', 'CONSOLIDADA', linha['MANIFESTACAO_PRELIMINAR'], index);
        }
        if (linha['LINK_PARECER_EXTERNO']) {
            htmlHistorico += gerarHtmlDocExtra('Parecer do Setor Externo', 'Ver Parecer', 'RETORNO', linha['LINK_PARECER_EXTERNO'], index);
        }

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
            htmlHistorico = `<div style="margin-top: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;"><i class="ci ci-folder"></i> Dossiê e Histórico de Documentos</strong>${htmlHistorico}</div>`;
        }

        let htmlTimeline = `<div id="timeline-container-oficio" style="margin-top: 25px; margin-bottom: 25px;"></div>`;

        let reitBtnHtml = '';
        if (window.podeCadastrarReiteracao(setorItem)) {
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
            ${acoesRevisorHtml}
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

    if (linkRaw && linkRaw.trim() !== '' && linkRaw.trim() !== '-') {
        let indexArg = "''";
        if (typeof index === 'number' && index >= 0) {
            indexArg = index;
        } else if (typeof index === 'string' && index.trim() !== '') {
            indexArg = (index.startsWith("'") || index.startsWith('"')) ? index : `'${index.replace(/'/g, "\\'")}'`;
        } else if (nup && String(nup).trim() !== '' && String(nup).trim() !== '-') {
            indexArg = `'${String(nup).replace(/'/g, "\\'")}'`;
        }

        if (isLinkGCS(linkRaw)) {
            htmlBotao = `<button onclick="abrirPreview('${linkRaw}', ${indexArg})" class="btn-inline-preview" title="Pré-visualizar (LGPD Seguro)"></button>`;
        } else {
            const fileId = extrairIdDrive(linkRaw);
            if (fileId) {
                const linkPreview = `https://drive.google.com/file/d/${fileId}/preview`;
                htmlBotao = `<button onclick="abrirPreview('${linkPreview}', ${indexArg})" class="btn-inline-preview" title="Pré-visualizar"></button>`;
            } else {
                htmlBotao = `<a href="${linkRaw}" target="_blank" class="btn-inline-preview" style="background-image: none; width: auto; height: auto; padding: 3px 8px;"><i class="ci ci-external"></i> Abrir</a>`;
            }
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

        btn.innerHTML = '⏳ A enviar com segurança (LGPD)...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        try {
            let gcsUri = null;
            // 1. Tenta Upload Direto para o Google Cloud Storage
            if (typeof GCSStorage !== 'undefined') {
                try {
                    const gcsRes = await GCSStorage.fazerUpload(file, {
                        modulo: 'respostas',
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

            const nupLimpo = nup.replace(/[^a-zA-Z0-9]/g, '');
            let base64 = null;
            if (!gcsUri) {
                base64 = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = () => resolve(reader.result.split(',')[1]);
                    reader.onerror = error => reject(error);
                });
            }

            const payload = {
                acao: "upload",
                nup: nup,
                fileName: `Resposta_${nupLimpo}.pdf`,
                base64: base64,
                url: gcsUri,
                linkGcs: gcsUri,
                username: usuarioAtivo.nomePlanilha || usuarioAtivo.username || ''
            };

            const resposta = await fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            const resultado = await resposta.json();
            if (resultado.status === 'success') {
                mostrarToast('Documento guardado com sucesso no Google Cloud Storage (LGPD)!', 'success');
                btn.innerHTML = '✅ Concluído!';
                btn.style.backgroundColor = '#228B22';
                btn.style.borderColor = '#1a6b1a';
                btn.style.opacity = '1';

                const linkFinal = gcsUri || resultado.url || "-";
                const target = dadosCoringa.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK_RESPOSTA'] = linkFinal;
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

        btn.innerHTML = '⏳ A enviar com segurança (LGPD)...'; btn.disabled = true; btn.style.opacity = '0.7';

        try {
            let gcsUri = null;
            if (typeof GCSStorage !== 'undefined') {
                try {
                    const gcsRes = await GCSStorage.fazerUpload(file, {
                        modulo: 'oficios',
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
                acao: "anexar_pdf_original_oficio", 
                nup: nup, 
                fileName: `Oficio_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`, 
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
                const target = dadosCoringa.find(r => r['NUP'] === nup);
                if (target) {
                    target['LINK_OFICIO'] = linkFinal;
                    target['LINK - OFÍCIO'] = linkFinal;
                    target['LINK OFÍCIO'] = linkFinal;
                    target['LINK_OFÍCIO'] = linkFinal;
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

window.registrarMovimentacaoHistorico = async function(nup, acao, detalhe = '', extra = '') {
    const autor = (usuarioAtivo ? (usuarioAtivo.nomePlanilha || usuarioAtivo.username) : 'Sistema');
    const novoEvento = {
        nup: nup,
        data: new Date().toLocaleString('pt-BR'),
        acao: acao,
        detalhe: detalhe,
        extra: extra || autor
    };
    
    if (window.cacheHistoricoGlobal) {
        window.cacheHistoricoGlobal.push(novoEvento);
    }
    
    try {
        const payload = {
            acao: "registrar_historico",
            nup: nup,
            eventoAcao: acao,
            detalhe: detalhe,
            extra: extra || autor,
            username: usuarioAtivo ? usuarioAtivo.username : 'sistema'
        };
        fetch('https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec', {
            method: 'POST',
            body: JSON.stringify(payload)
        }).catch(err => console.warn('Erro assíncrono ao registrar histórico:', err));
    } catch(e) {
        console.warn('Falha no registro de histórico:', e);
    }
};

async function carregarHistoricoGlobalBackground() {
    if (window.cacheHistoricoGlobal || window.historicoCarregando) return;
    window.historicoCarregando = true;
    try {
        const resultado = await executarAcaoGAS({ acao: "buscar_historico_processo" });
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

// ============================================================================
// GESTÃO DE SOBRESTAMENTO E RETORNO COM CONSOLIDAÇÃO DE DOCUMENTOS
// ============================================================================
window.abrirModalSobrestar = function(nup, tipo = 'oficio') {
    const modal = document.getElementById('sobrestarModal');
    if (!modal) return;
    document.getElementById('sobrestarNup').value = nup;
    document.getElementById('sobrestarTipo').value = tipo;
    document.getElementById('sobrestarSetor').value = '';
    document.getElementById('sobrestarOutroSetor').value = '';
    document.getElementById('containerSobrestarOutroSetor').style.display = 'none';
    document.getElementById('sobrestarMotivo').value = '';

    const selectSetor = document.getElementById('sobrestarSetor');
    if (selectSetor && !selectSetor.dataset.listener) {
        selectSetor.addEventListener('change', () => {
            const containerOutro = document.getElementById('containerSobrestarOutroSetor');
            if (containerOutro) {
                containerOutro.style.display = (selectSetor.value === 'OUTRO') ? 'block' : 'none';
            }
        });
        selectSetor.dataset.listener = 'true';
    }

    modal.style.display = 'flex';
};

window.fecharModalSobrestar = function() {
    const modal = document.getElementById('sobrestarModal');
    if (modal) modal.style.display = 'none';
};

window.executarSobrestamentoProcesso = async function() {
    const nup = document.getElementById('sobrestarNup').value;
    const tipo = document.getElementById('sobrestarTipo').value || 'oficio';
    let setor = document.getElementById('sobrestarSetor').value;
    if (setor === 'OUTRO') {
        setor = document.getElementById('sobrestarOutroSetor').value.trim();
    }
    const motivo = document.getElementById('sobrestarMotivo').value.trim();

    if (!setor) {
        mostrarToast('Por favor, selecione ou informe o setor de encaminhamento.', 'error');
        return;
    }
    if (!motivo) {
        mostrarToast('Por favor, preencha a justificativa do sobrestamento.', 'error');
        return;
    }

    const btn = document.getElementById('btnConfirmarSobrestamento');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Sobrestando...'; btn.disabled = true;

    const nupBusca = String(nup || '').trim().toUpperCase();
    const nupSemPdf = nupBusca.replace(/\.PDF$/i, '');
    const matchNup = r => {
        const n = String(r['NUP'] || '').trim().toUpperCase();
        return n === nupBusca || n.replace(/\.PDF$/i, '') === nupSemPdf;
    };

    // Optimistic Update & Consolidação de Documento no Dossiê
    if (tipo === 'oficio') {
        const item = dadosCoringa.find(matchNup);
        if (item) {
            if (item['LINK_RESPOSTA'] && item['LINK_RESPOSTA'].trim() !== '') {
                item['MANIFESTACAO_PRELIMINAR'] = item['LINK_RESPOSTA'];
                item['LINK_RESPOSTA'] = '';
            }
            item['STATUS'] = 'SOBRESTADO';
            item['SOBRESTADO_SETOR'] = setor;
            item['SOBRESTADO_MOTIVO'] = motivo;
        }
        atualizarCacheOficios();
        aplicarFiltros();
    } else if (tipo === 'auto') {
        const item = dadosAutosGlobais.find(matchNup);
        if (item) {
            const resp = item['LINK DA RESPOSTA'] || item['LINK RESPOSTA'] || '';
            if (resp && resp.trim() !== '') {
                item['MANIFESTACAO_PRELIMINAR'] = resp;
                item['LINK DA RESPOSTA'] = '';
                item['LINK RESPOSTA'] = '';
            }
            item['STATUS ATUAL'] = 'SOBRESTADO';
            item['STATUS'] = 'SOBRESTADO';
            item['SOBRESTADO_SETOR'] = setor;
            item['SOBRESTADO_MOTIVO'] = motivo;
        }
        if (typeof atualizarCacheAutos === 'function') atualizarCacheAutos();
        if (typeof filtrarAutos === 'function') filtrarAutos();
    } else if (tipo === 'carta') {
        const item = dadosCartasGlobais.find(matchNup);
        if (item) {
            const resp = item['LINK DA MANIFESTAÇÃO'] || item['LINK DA RESPOSTA'] || '';
            if (resp && resp.trim() !== '') {
                item['MANIFESTACAO_PRELIMINAR'] = resp;
                item['LINK DA MANIFESTAÇÃO'] = '';
                item['LINK DA RESPOSTA'] = '';
            }
            item['STATUS'] = 'SOBRESTADO';
            item['SOBRESTADO_SETOR'] = setor;
            item['SOBRESTADO_MOTIVO'] = motivo;
        }
        if (typeof atualizarCacheCartas === 'function') atualizarCacheCartas();
        if (typeof aplicarFiltrosCartas === 'function') aplicarFiltrosCartas();
    } else if (tipo === 'externo') {
        const item = dadosExternosGlobais.find(matchNup);
        if (item) {
            const resp = item['LINK DA RESPOSTA'] || item['LINK RESPOSTA'] || '';
            if (resp && resp.trim() !== '') {
                item['MANIFESTACAO_PRELIMINAR'] = resp;
                item['LINK DA RESPOSTA'] = '';
                item['LINK RESPOSTA'] = '';
            }
            item['STATUS'] = 'SOBRESTADO';
            item['SOBRESTADO_SETOR'] = setor;
            item['SOBRESTADO_MOTIVO'] = motivo;
        }
        if (typeof atualizarCacheExternos === 'function') atualizarCacheExternos();
        if (typeof filtrarExternos === 'function') filtrarExternos();
    }

    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Se o preview estiver aberto, recarrega com o novo status SOBRESTADO
    const prevSobrestar = document.getElementById('previewModal');
    if (prevSobrestar && prevSobrestar.style.display === 'flex') {
        if (tipo === 'oficio') {
            const it = dadosCoringa.find(matchNup);
            if (it) abrirPreview(it['LINK_OFICIO'] || it['LINK - OFÍCIO'] || it['LINK'] || '', it, nup);
        } else if (tipo === 'auto' && typeof abrirPreviewAuto === 'function') {
            const it = dadosAutosGlobais.find(matchNup);
            if (it) abrirPreviewAuto(it['LINK NUP'] || it['LINK-NUP'] || it['LINK DO NUP'] || '', it, nup);
        } else if (tipo === 'carta' && typeof abrirModalPreviewCartas === 'function') {
            const it = dadosCartasGlobais.find(matchNup);
            if (it) abrirModalPreviewCartas(it, it['LINK DO NUP'] || it['LINK_NUP'] || '', nup);
        } else if (tipo === 'externo' && typeof abrirPreviewExterno === 'function') {
            const it = dadosExternosGlobais.find(matchNup);
            if (it) abrirPreviewExterno(it['LINK_OFICIO'] || it['LINK'] || '', it, nup);
        }
    }

    window.registrarMovimentacaoHistorico(nup, 'PROCESSO_SOBRESTADO', motivo, `Encaminhado para: ${setor}`);
    fecharModalSobrestar();
    mostrarToast('Processo sobrestado com sucesso! Manifestação consolidada no dossiê.', 'success');

    btn.innerHTML = txtOriginal; btn.disabled = false;

    try {
        const payload = {
            acao: "sobrestar_processo",
            nup: nup,
            tipo: tipo,
            setor: setor,
            motivo: motivo,
            username: usuarioAtivo ? (usuarioAtivo.nomePlanilha || usuarioAtivo.username) : 'sistema'
        };
        const resultado = await executarAcaoGAS(payload);
        if (resultado.status === 'success') {
            mostrarToast('Sobrestamento sincronizado na nuvem!', 'success');
        }
    } catch(e) {
        console.warn('Falha na sincronização de sobrestamento:', e);
    }
};

window.abrirModalRetornoSobrestamento = function(nup, tipo = 'oficio') {
    const modal = document.getElementById('retornoSobrestamentoModal');
    if (!modal) return;
    document.getElementById('retornoSobrestamentoNup').value = nup;
    document.getElementById('retornoSobrestamentoTipo').value = tipo;
    document.getElementById('retornoParecerArquivo').value = '';
    document.getElementById('retornoParecerArquivoNome').innerText = 'Clique para selecionar o PDF do Parecer Externo';
    document.getElementById('retornoParecerObs').value = '';

    modal.style.display = 'flex';
};

window.fecharModalRetornoSobrestamento = function() {
    const modal = document.getElementById('retornoSobrestamentoModal');
    if (modal) modal.style.display = 'none';
};

window.updateFileNameParecerRetorno = function(input) {
    const label = document.getElementById('retornoParecerArquivoNome');
    if (input.files && input.files[0]) {
        label.innerText = `📄 ${input.files[0].name} (${(input.files[0].size / (1024 * 1024)).toFixed(2)} MB)`;
    } else {
        label.innerText = 'Clique para selecionar o PDF do Parecer Externo';
    }
};

window.executarRetornoSobrestamentoProcesso = async function() {
    const nup = document.getElementById('retornoSobrestamentoNup').value;
    const tipo = document.getElementById('retornoSobrestamentoTipo').value || 'oficio';
    const obs = document.getElementById('retornoParecerObs').value.trim();
    const fileInput = document.getElementById('retornoParecerArquivo');
    const file = fileInput.files ? fileInput.files[0] : null;

    const btn = document.getElementById('btnConfirmarRetornoSobrestamento');
    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '⏳ Retomando...'; btn.disabled = true;

    let gcsUri = null;
    if (file) {
        try {
            if (typeof GCSStorage !== 'undefined') {
                const gcsRes = await GCSStorage.fazerUpload(file, {
                    modulo: 'pareceres_externos',
                    nup: nup,
                    nomePersonalizado: `Parecer_Externo_${nup.replace(/[^a-zA-Z0-9]/g, '')}.pdf`,
                    username: usuarioAtivo ? (usuarioAtivo.nomePlanilha || usuarioAtivo.username) : ''
                });
                if (gcsRes && (gcsRes.fullGcsUri || gcsRes.gcsPath)) {
                    gcsUri = gcsRes.fullGcsUri || gcsRes.gcsPath;
                }
            }
        } catch(e) {
            console.warn('Fallback upload parecer:', e);
        }
    }

    const nupBusca = String(nup || '').trim().toUpperCase();
    const nupSemPdf = nupBusca.replace(/\.PDF$/i, '');
    const matchNup = r => {
        const n = String(r['NUP'] || '').trim().toUpperCase();
        return n === nupBusca || n.replace(/\.PDF$/i, '') === nupSemPdf;
    };

    // Optimistic Update: Volta para Aguardando Manifestação
    if (tipo === 'oficio') {
        const item = dadosCoringa.find(matchNup);
        if (item) {
            if (gcsUri) item['LINK_PARECER_EXTERNO'] = gcsUri;
            item['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        }
        atualizarCacheOficios();
        aplicarFiltros();
    } else if (tipo === 'auto') {
        const item = dadosAutosGlobais.find(matchNup);
        if (item) {
            if (gcsUri) item['LINK_PARECER_EXTERNO'] = gcsUri;
            item['STATUS ATUAL'] = 'AGUARDANDO MANIFESTAÇÃO';
            item['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO';
        }
        if (typeof atualizarCacheAutos === 'function') atualizarCacheAutos();
        if (typeof filtrarAutos === 'function') filtrarAutos();
    } else if (tipo === 'carta') {
        const item = dadosCartasGlobais.find(matchNup);
        if (item) {
            if (gcsUri) item['LINK_PARECER_EXTERNO'] = gcsUri;
            item['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        }
        if (typeof atualizarCacheCartas === 'function') atualizarCacheCartas();
        if (typeof aplicarFiltrosCartas === 'function') aplicarFiltrosCartas();
    } else if (tipo === 'externo') {
        const item = dadosExternosGlobais.find(matchNup);
        if (item) {
            if (gcsUri) item['LINK_PARECER_EXTERNO'] = gcsUri;
            item['STATUS'] = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
        }
        if (typeof atualizarCacheExternos === 'function') atualizarCacheExternos();
        if (typeof filtrarExternos === 'function') filtrarExternos();
    }

    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Se o preview estiver aberto, recarrega com o status AGUARDANDO MANIFESTAÇÃO TÉCNICA
    const prevRetorno = document.getElementById('previewModal');
    if (prevRetorno && prevRetorno.style.display === 'flex') {
        if (tipo === 'oficio') {
            const it = dadosCoringa.find(matchNup);
            if (it) abrirPreview(it['LINK_OFICIO'] || it['LINK - OFÍCIO'] || it['LINK'] || '', it, nup);
        } else if (tipo === 'auto' && typeof abrirPreviewAuto === 'function') {
            const it = dadosAutosGlobais.find(matchNup);
            if (it) abrirPreviewAuto(it['LINK NUP'] || it['LINK-NUP'] || it['LINK DO NUP'] || '', it, nup);
        } else if (tipo === 'carta' && typeof abrirModalPreviewCartas === 'function') {
            const it = dadosCartasGlobais.find(matchNup);
            if (it) abrirModalPreviewCartas(it, it['LINK DO NUP'] || it['LINK_NUP'] || '', nup);
        } else if (tipo === 'externo' && typeof abrirPreviewExterno === 'function') {
            const it = dadosExternosGlobais.find(matchNup);
            if (it) abrirPreviewExterno(it['LINK_OFICIO'] || it['LINK'] || '', it, nup);
        }
    }

    window.registrarMovimentacaoHistorico(nup, 'RETORNO_SOBRESTAMENTO', obs || 'Retornado para elaboração de manifestação final', gcsUri ? 'Parecer Externo Anexado' : 'Sem Parecer');
    fecharModalRetornoSobrestamento();
    mostrarToast('Processo retomado para Aguardando Manifestação com sucesso!', 'success');

    btn.innerHTML = txtOriginal; btn.disabled = false;

    try {
        let base64 = null;
        if (file && !gcsUri) {
            base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader(); reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });
        }

        const payload = {
            acao: "retorno_sobrestamento",
            nup: nup,
            tipo: tipo,
            url: gcsUri,
            linkGcs: gcsUri,
            base64: base64,
            fileName: file ? file.name : '',
            obs: obs,
            username: usuarioAtivo ? (usuarioAtivo.nomePlanilha || usuarioAtivo.username) : 'sistema'
        };
        const resultado = await executarAcaoGAS(payload);
        if (resultado.status === 'success') {
            mostrarToast('Retorno sincronizado na nuvem!', 'success');
        }
    } catch(e) {
        console.warn('Falha na sincronização de retorno:', e);
    }
};

function exibirLinhaTempo(dados, container) {
    if (dados.length === 0) {
        container.innerHTML = `
            <div style="font-size: 15px; font-weight: bold; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 15px;"><i class="ci ci-clock"></i> Histórico de Tramitação</div>
            <div style="text-align: center; color: #666; font-size: 13px; padding: 15px; border: 1px dashed #333; border-radius: 6px;">Nenhum evento registrado para este processo.</div>
        `;
        return;
    }

    const obterEstiloEvento = (acao, detalhe = '') => {
        const acaoUpper = acao.toUpperCase();
        const detalheUpper = String(detalhe).toUpperCase();
        
        if (acaoUpper.includes('SOBRESTADO') || acaoUpper.includes('SOBRESTAMENTO')) {
            return { cor: '#f39c12', icone: '<i class="ci ci-pause" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('RETORNO_SOBRESTAMENTO') || acaoUpper.includes('RETORNO')) {
            return { cor: '#27ae60', icone: '<i class="ci ci-refresh" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('PARECER') || acaoUpper.includes('EXTERNO')) {
            return { cor: '#8e44ad', icone: '<i class="ci ci-court" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('CADASTRADO') || acaoUpper.includes('CADASTRO') || acaoUpper.includes('INICIAL')) {
            return { cor: '#3498db', icone: '<i class="ci ci-inbox" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('ATRIBUÍDO') || acaoUpper.includes('ATRIBUIDO') || acaoUpper.includes('DISTRIBUIÇÃO') || acaoUpper.includes('DISTRIBUIDO') || acaoUpper.includes('REDISTRIBUIR') || acaoUpper.includes('TÉCNICO')) {
            return { cor: '#9b59b6', icone: '<i class="ci ci-user" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('UPLOAD DE RESPOSTA') || acaoUpper.includes('ANEXAR') || acaoUpper.includes('ANEXADO')) {
            return { cor: '#e67e22', icone: '<i class="ci ci-paperclip" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('REMOVER') || acaoUpper.includes('REMOVIDA') || acaoUpper.includes('RETIRAR')) {
            return { cor: '#7f8c8d', icone: '<i class="ci ci-trash" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('APROVADO') || acaoUpper.includes('ACEITO') || detalheUpper === 'TRAMITADO' || detalheUpper === 'FINALIZADO' || detalheUpper === 'ARQUIVADO') {
            return { cor: '#2ecc71', icone: '<i class="ci ci-check" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('REPROVADO') || acaoUpper.includes('RECUSADO') || acaoUpper.includes('RECUSADA')) {
            return { cor: '#e74c3c', icone: '<i class="ci ci-close" style="width:10px;height:10px;"></i>' };
        }
        if (acaoUpper.includes('STATUS CI') || acaoUpper.includes('STATUS')) {
            return { cor: '#f1c40f', icone: '<i class="ci ci-settings" style="width:10px;height:10px;"></i>' };
        }
        return { cor: '#1abc9c', icone: '<i class="ci ci-pin" style="width:10px;height:10px;"></i>' };
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
            <div style="font-size: 15px; font-weight: bold; color: #fff; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 15px;"><i class="ci ci-clock"></i> Histórico de Tramitação</div>
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
        const resultado = await executarAcaoGAS({ acao: "buscar_historico_processo", nup: nup });

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
        textoBotao: '<i class="ci ci-trash"></i> Sim, Remover',
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
            username: (usuarioAtivo && usuarioAtivo.username) ? usuarioAtivo.username : ''
        };

        const resultado = await executarAcaoGAS(payload);
        if (resultado.status === 'success') {
            mostrarToast('Status atualizado com sucesso!', 'success');

            const target = dadosCoringa.find(r => r['NUP'] === nup);
            if (target) {
                target['STATUS'] = novoStatus;
            }
            atualizarBadgesNotificacao(dadosCoringa);
            atualizarCacheOficios();
            if (typeof aplicarFiltros === 'function') aplicarFiltros();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

            // Se o preview estiver aberto, recarrega com o novo status
            const prev = document.getElementById('previewModal');
            if (prev && prev.style.display === 'flex' && target) {
                const linkOficio = target['LINK_OFICIO'] || target['LINK - OFÍCIO'] || target['LINK'] || target['LINK_RESPOSTA'] || '';
                abrirPreview(linkOficio, target);
            }

            const newIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
            if (newIndex !== -1 && document.getElementById('detalhesModal') && document.getElementById('detalhesModal').style.display === 'flex') {
                abrirModal(newIndex);
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
    const btn = (btnId ? document.getElementById(btnId) : null);
    const txtOriginal = btn ? btn.innerHTML : 'Salvar';
    if (btn) { btn.innerHTML = '⏳ ...'; btn.disabled = true; }

    // Optimistic Update
    const oficioRef = dadosCoringa.find(a => a['NUP'] === nup);
    let statusOriginal = '';
    if (oficioRef) {
        statusOriginal = oficioRef['STATUS'];
        oficioRef['STATUS'] = novoStatus;
    }

    mostrarToast('Status alterado localmente. Sincronizando...', 'success');
    atualizarCacheOficios();
    if (typeof aplicarFiltros === 'function') aplicarFiltros();
    if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();

    // Atualiza o badge de status no modal de preview se estiver aberto
    const badgePreview = document.querySelector('#previewInfoContent .modal-detail-status-oficio');
    if (badgePreview) badgePreview.textContent = novoStatus;

    try {
        const resultado = await executarAcaoGAS({
            acao: "alterar_status_manual_generico",
            tipoAba: "oficio",
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
        console.error('Erro ao alterar status de Ofício:', e);
        mostrarToast('Falha na sincronização ao alterar status. (Revertendo)', 'error');
        if (oficioRef) {
            oficioRef['STATUS'] = statusOriginal;
            atualizarCacheOficios();
            if (typeof aplicarFiltros === 'function') aplicarFiltros();
            if (typeof atualizarDashboardInicio === 'function') atualizarDashboardInicio();
            if (badgePreview) badgePreview.textContent = statusOriginal;
        }
    } finally {
        if (btn) { btn.innerHTML = txtOriginal; btn.disabled = false; }
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
                <button onclick="anexarPdfOriginalOficio(event, '${linha['NUP']}')" class="btn-drive btn-upload" style="font-size: 12px; padding: 6px 12px; width: auto; height: auto;"><i class="ci ci-paperclip"></i> Anexar Ofício Inicial</button>
            </div>
        `;
    }
    let btnAnexar = '';
    const linkRespostaVerificacao = linha['LINK_RESPOSTA'];
    const temRespostaVinculada = linkRespostaVerificacao && linkRespostaVerificacao.trim() !== '' && linkRespostaVerificacao.trim() !== '-';

    if (usuarioAtivo) {
        if (temRespostaVinculada) {
            const isAprovadoBackend = (linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
            const isFazerCI = (linha['STATUS'] || '').toUpperCase().trim().replace(/\./g, '') === 'FAZER CI';
            const isGestor = typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo() || typeof window.isPerfilRevisor === 'function' && window.isPerfilRevisor() || (usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');

            let blockRemoval = false;
            if (!isGestor && (isAprovadoBackend || isFazerCI)) {
                blockRemoval = true;
            }

            if (blockRemoval) {
                btnAnexar = `<div style="padding: 10px; background-color: rgba(39, 174, 96, 0.1); border-left: 4px solid #27ae60; color: #2ecc71; font-size: 13px;"><i class="ci ci-lock"></i> Documento aprovado. Apenas a Diretoria pode removê-lo.</div>`;
            } else {
                btnAnexar = `<button onclick="removerDocumento(event, '${linha['NUP']}')" class="btn-drive btn-red-outline"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
            }
        } else if (usuarioAtivo.perfil === 'tecnico' || (typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo())) {
            btnAnexar = `<button onclick="anexarDocumento(event, '${linha['NUP']}')" class="btn-drive btn-upload"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
        }
    }

    if (linkRaw && linkRaw.trim() !== '' && linkRaw.trim() !== '-') {
        if (isLinkGCS(linkRaw)) {
            htmlPreviewIcon = `<button onclick="abrirPreview('${linkRaw}', ${index})" class="btn-inline-preview" title="Pré-visualizar Ofício (LGPD Seguro)"></button>`;
            htmlLink = `
                <div class="modal-buttons">
                    <button onclick="dispararDownloadSeguro('${linkRaw}', 'Oficio_${linha['NUP']}.pdf')" class="btn-drive btn-download">⬇️ Download (LGPD)</button>
                    ${btnAnexar}
                </div>
            `;
        } else {
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
                        <a href="${linkRaw}" target="_blank" class="btn-drive"><i class="ci ci-external"></i> Abrir Link Vinculado</a>
                        ${btnAnexar}
                    </div>
                `;
            }
        }
    } else {
        if (btnAnexar) {
            htmlLink += `<div class="modal-buttons" style="margin-top: 15px;">${btnAnexar}</div>`;
        }
    }

    let htmlDiretoriaBotoes = '';
    const isGestorFinalidade = usuarioAtivo && (typeof window.podeDistribuirProcesso === 'function' && window.podeDistribuirProcesso() || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
    const statusGeralAtualizado = (linha['STATUS'] || '').toUpperCase();
    const isSemTecnico = !linha['TÉCNICO/ADMIN'] || linha['TÉCNICO/ADMIN'] === '-' || linha['TÉCNICO/ADMIN'] === 'S/T';

    if (isGestorFinalidade) {
        if (statusGeralAtualizado === 'FAZER CI' || statusGeralAtualizado === 'FAZER C.I') {
            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(41, 128, 185, 0.08); border: 1px solid rgba(41, 128, 185, 0.3); border-radius: 6px;">
                    <strong style="color: #2980b9; font-size: 13px; display: block; margin-bottom: 10px;">📋 Ações de Fluxo (Comunicação Interna - C.I):</strong>
                    <div style="display: flex; gap: 10px; flex-direction: column;">
                        <button onclick="atualizarStatusCI(event, '${linha['NUP']}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background-color: #2980b9; border-color: #1c5986; color: white; margin: 0; font-size: 14px;">✅ Confirmar Confecção da C.I</button>
                        <button onclick="abrirModalSobrestar('${linha['NUP']}', 'oficio')" class="btn-drive" style="background-color: #f39c12; border-color: #d68910; color: #111; font-weight: bold; margin: 0; font-size: 14px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                    </div>
                </div>
            `;
        } else if (statusGeralAtualizado === 'SOBRESTADO') {
            const preliminarUrl = (linha['MANIFESTACAO_PRELIMINAR'] && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '') ? linha['MANIFESTACAO_PRELIMINAR'] : '';
            const parecerUrl = (linha['LINK_PARECER_EXTERNO'] && linha['LINK_PARECER_EXTERNO'].trim() !== '') ? linha['LINK_PARECER_EXTERNO'] : '';
            const oficioUrl = linha['LINK_OFICIO'] || linha['LINK - OFÍCIO'] || linha['LINK'] || '';

            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(243, 156, 18, 0.1); border: 1px solid rgba(243, 156, 18, 0.4); border-radius: 6px;">
                    <strong style="color: #f39c12; font-size: 13px; display: block; margin-bottom: 8px;">⏸️ Processo Sobrestado (Encaminhado para: ${linha['SOBRESTADO_SETOR'] || 'Setor Externo'})</strong>
                    ${linha['SOBRESTADO_MOTIVO'] ? `<div style="font-size: 12px; color: #ccc; margin-bottom: 12px;"><strong>Motivo:</strong> ${linha['SOBRESTADO_MOTIVO']}</div>` : ''}
                    ${preliminarUrl ? `<button onclick="abrirPreview('${preliminarUrl}', dadosCoringa.find(r => r['NUP']==='${linha['NUP']}'))" class="btn-drive" style="background-color: rgba(0, 250, 154, 0.15); border: 1px solid #00fa9a; color: #00fa9a; width: 100%; margin-bottom: 8px; font-size: 13px; font-weight: bold; padding: 8px; cursor: pointer;"><i class="ci ci-eye"></i> Visualizar Manifestação Preliminar</button>` : ''}
                    ${parecerUrl ? `<button onclick="abrirPreview('${parecerUrl}', dadosCoringa.find(r => r['NUP']==='${linha['NUP']}'))" class="btn-drive" style="background-color: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; width: 100%; margin-bottom: 8px; font-size: 13px; font-weight: bold; padding: 8px; cursor: pointer;"><i class="ci ci-court"></i> Visualizar Parecer Externo</button>` : ''}
                    ${oficioUrl ? `<button onclick="abrirPreview('${oficioUrl}', dadosCoringa.find(r => r['NUP']==='${linha['NUP']}'))" class="btn-drive" style="background-color: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.2); color: #cbd5e1; width: 100%; margin-bottom: 8px; font-size: 12px; padding: 7px; cursor: pointer;"><i class="ci ci-folder"></i> Visualizar Ofício Original</button>` : ''}
                    <button onclick="abrirModalRetornoSobrestamento('${linha['NUP']}', 'oficio')" class="btn-drive" style="background-color: #27ae60; border-color: #1e8449; color: white; width: 100%; margin: 0; font-size: 14px; font-weight: bold;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
                </div>
            `;
        } else if (statusGeralAtualizado === 'AGUARDANDO ASSINATURA') {
            htmlDiretoriaBotoes += `
                <div style="margin-top: 15px; padding: 15px; background-color: rgba(142, 68, 173, 0.08); border: 1px solid rgba(142, 68, 173, 0.3); border-radius: 6px;">
                    <strong style="color: #8e44ad; font-size: 13px; display: block; margin-bottom: 10px;">📋 Ações de Fluxo (Assinatura):</strong>
                    <button onclick="atualizarStatusCI(event, '${linha['NUP']}', 'FINALIZADO')" class="btn-drive" style="background-color: #8e44ad; border-color: #6c3483; color: white; width: 100%; margin: 0; font-size: 14px;">✍️ Confirmar Assinatura Realizada</button>
                </div>
            `;
        }

        if (isSemTecnico) {
            htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Distribuir / Atribuir Técnico</button>`;
        } else {
            htmlDiretoriaBotoes += `<button onclick="abrirModalAtribuirTecnicoOficio('${linha['NUP']}')" class="btn-drive btn-blue" style="width: 100%; margin-top: 15px; font-size: 15px;"><i class="ci ci-user"></i> Redistribuir Técnico</button>`;
        }
        
        const opcoesOficioStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER CI", "AGUARDANDO ASSINATURA", "REVISÃO", "FINALIZADO", "TRAMITADO", "ARQUIVADO"];
        let optionsHtml = opcoesOficioStatus.map(st => `<option value="${st}" ${st === statusGeralAtualizado ? 'selected' : ''}>${st}</option>`).join('');
        htmlDiretoriaBotoes += `
            <div style="margin-top: 15px; padding: 15px; background-color: rgba(255,255,255,0.03); border: 1px dashed #444; border-radius: 6px;">
                <div style="font-size: 11px; color: #888; margin-bottom: 8px; font-weight: bold; letter-spacing: 0.5px;"><i class="ci ci-settings"></i> GESTÃO DE STATUS (DIRETORIA)</div>
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
    if (linkResposta && linkResposta.trim() !== '' && linkResposta.trim() !== '-') {
        let botaoResp = '';
        if (isLinkGCS(linkResposta)) {
            botaoResp = `<button onclick="abrirPreview('${linkResposta}', ${index})" class="btn-drive btn-orange-outline"><i class="ci ci-eye"></i> Pré-visualizar Resposta (LGPD)</button>`;
        } else {
            const respId = extrairIdDrive(linkResposta);
            if (respId) {
                const respPreview = `https://drive.google.com/file/d/${respId}/preview`;
                botaoResp = `<button onclick="abrirPreview('${respPreview}', ${index})" class="btn-drive btn-orange-outline"><i class="ci ci-eye"></i> Pré-visualizar Resposta</button>`;
            } else {
                botaoResp = `<a href="${linkResposta}" target="_blank" class="btn-drive btn-orange-outline"><i class="ci ci-external"></i> Abrir Resposta no Drive</a>`;
            }
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
        htmlHistorico = `<div style="margin: 20px; border-top: 1px dashed #333; padding-top: 15px;"><strong style="color: white; font-size: 14px;"><i class="ci ci-folder"></i> Histórico de Documentos</strong>${htmlHistorico}</div>`;
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

async function abrirPreview(arg1, arg2, arg3) {
    const modal = document.getElementById('previewModal');
    const modalPequeno = document.getElementById('detalhesModal');
    if (modalPequeno) modalPequeno.style.display = 'none';
    if (!modal) return;
    const iconeOlhoGrande = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;

    let event = null;
    let url = '';
    let linha = null;
    let nup = null;
    let index = -1;

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
            const isWebUrl = str.startsWith('http://') || str.startsWith('https://') || str.startsWith('gs://') || str.includes('drive.google.com') || str.includes('storage.googleapis.com') || (typeof GCSStorage !== 'undefined' && GCSStorage.isGCS(str));
            if (isWebUrl) {
                if (!url) url = str;
            } else if (!nup && !str.startsWith('http')) {
                nup = str;
            } else if (!url) {
                url = str;
            }
        } else if (typeof a === 'number') {
            index = a;
            if (!linha && a >= 0 && typeof dadosExibidos !== 'undefined' && a < dadosExibidos.length) {
                linha = dadosExibidos[a];
            }
        }
    }

    if (event && typeof event.preventDefault === 'function') event.preventDefault();

    if (linha && linha['NUP']) {
        nup = linha['NUP'];
    }

    if (!linha && nup && typeof nup === 'string' && nup !== '-') {
        const nupBusca = nup.trim().toUpperCase();
        const nupSemPdf = nupBusca.replace(/\.PDF$/i, '');
        linha = (dadosCoringa || []).find(r => {
            const n = String(r['NUP'] || '').trim().toUpperCase();
            return n === nupBusca || n.replace(/\.PDF$/i, '') === nupSemPdf;
        });
    }

    if (!linha && typeof oficioSelecionadoMockup !== 'undefined' && oficioSelecionadoMockup) {
        linha = oficioSelecionadoMockup;
    }

    if (!linha && url && typeof dadosCoringa !== 'undefined') {
        const urlStr = String(url).trim();
        const driveId = typeof extrairIdDrive === 'function' ? extrairIdDrive(urlStr) : null;
        linha = (dadosCoringa || []).find(r => {
            const campos = [
                r['LINK_OFICIO'], r['LINK - OFÍCIO'], r['LINK'],
                r['LINK_RESPOSTA'], r['MANIFESTACAO_PRELIMINAR'], r['LINK_PARECER_EXTERNO']
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

    if (index === -1 && linha) {
        if (typeof dadosExibidos !== 'undefined' && Array.isArray(dadosExibidos)) {
            index = dadosExibidos.indexOf(linha);
        }
        if (index === -1 && typeof dadosCoringa !== 'undefined' && Array.isArray(dadosCoringa)) {
            index = dadosCoringa.indexOf(linha);
        }
    }

    let nupOriginal = (linha && linha['NUP']) ? linha['NUP'] : (nup || '-');
    if (typeof nupOriginal === 'string' && (nupOriginal.startsWith('http') || nupOriginal.startsWith('/') || nupOriginal.includes('://'))) {
        nupOriginal = '-';
    }
    const nupDisplay = typeof limparNupDisplay === 'function' ? limparNupDisplay(nupOriginal) : String(nupOriginal).replace(/\.pdf$/gi, '');
    const nupFormatado = String(nupOriginal).replace(/[^a-zA-Z0-9]/g, '_');
    const nupEsc = typeof escaparParaAtributo === 'function' ? escaparParaAtributo(nupOriginal) : nupOriginal;

    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-wrapper" id="preview-wrapper-id">
            <div class="preview-toolbar">
                <div class="preview-toolbar-title">
                    ${iconeOlhoGrande}
                    <span class="modal-detail-module-tag modal-detail-tag-oficio" style="margin-right: 8px;"><i class="ci ci-folder"></i> Ofício</span>
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

    const statusOperacional = (linha ? (linha['STATUS'] || 'AGUARDANDO DISTRIBUIÇÃO') : '').toUpperCase();
    const statusLimpoCI = statusOperacional.replace(/\./g, '').trim().toUpperCase();
    const isSobrestado = statusLimpoCI === 'SOBRESTADO' || statusLimpoCI.includes('SOBRESTADO');

    const linkResposta = linha ? (linha['LINK_RESPOSTA'] || '') : '';
    let respPreviewUrl = (linkResposta && linkResposta.trim() !== '' && linkResposta.trim() !== '-') ? linkResposta : '';
    const linkOficio = linha ? (linha['LINK_OFICIO'] || linha['LINK - OFÍCIO'] || linha['LINK'] || '') : '';
    let oficioPreviewUrl = (linkOficio && linkOficio.trim() !== '' && linkOficio.trim() !== '-') ? linkOficio : '';
    let preliminarPreviewUrl = (linha && linha['MANIFESTACAO_PRELIMINAR'] && linha['MANIFESTACAO_PRELIMINAR'].trim() !== '') ? linha['MANIFESTACAO_PRELIMINAR'] : '';
    let parecerPreviewUrl = (linha && linha['LINK_PARECER_EXTERNO'] && linha['LINK_PARECER_EXTERNO'].trim() !== '') ? linha['LINK_PARECER_EXTERNO'] : '';

    let urlAtual = url;
    if (!urlAtual) {
        if (isSobrestado && preliminarPreviewUrl) {
            urlAtual = preliminarPreviewUrl;
        } else {
            urlAtual = oficioPreviewUrl || preliminarPreviewUrl || parecerPreviewUrl || respPreviewUrl || '';
        }
    }

    let resolvedUrl = urlAtual;
    let resolvedDownloadUrl = urlAtual;

    try {
        if (typeof obterLinkVisualizacaoSeguro === 'function' && urlAtual) {
            resolvedUrl = await obterLinkVisualizacaoSeguro(urlAtual);
        }
        if (typeof obterLinkDownloadSeguro === 'function' && urlAtual) {
            resolvedDownloadUrl = await obterLinkDownloadSeguro(urlAtual, `Oficio_${nupFormatado}.pdf`);
        }
    } catch (e) {
        console.warn('Erro ao resolver URL segura:', e);
    }

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) {
        btnDownload.href = resolvedDownloadUrl;
    }
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) {
        btnOpenPreview.href = resolvedUrl;
    }
    const frame = document.getElementById('previewFrame');
    if (frame) {
        frame.src = resolvedUrl;
    }

    if (!linha) {
        const infoContent = document.getElementById('previewInfoContent');
        if (infoContent) {
            infoContent.innerHTML = `<div class="preview-info-card"><div class="preview-info-item">📄 Visualizando Documento: <strong>${nupDisplay}</strong></div></div>`;
        }
        modal.style.display = 'flex';
        return;
    }

    const obs = (linha['OBSERVAÇÃO'] || '').trim();
    const oficioRaw = (linha['OFÍCIO N.'] || linha['OFÍCIO'] || '-').replace(/\.pdf/gi, '').trim();
    const htmlObs = (obs && obs.toLowerCase() !== 'nan' && obs !== '-') ? `<div class="preview-info-obs"><strong>📋 Observação:</strong><br>${obs}</div>` : '';

    let docsDisponiveis = [];
    if (oficioPreviewUrl) docsDisponiveis.push({ label: '📜 Processo Original', url: oficioPreviewUrl });
    if (preliminarPreviewUrl) docsDisponiveis.push({ label: '📄 Manifestação Preliminar (Sobrestamento)', url: preliminarPreviewUrl });
    if (parecerPreviewUrl) docsDisponiveis.push({ label: '🏛️ Parecer Externo', url: parecerPreviewUrl });
    if (respPreviewUrl) docsDisponiveis.push({ label: '📁 Resposta Conclusiva', url: respPreviewUrl });

    let toggleBtn = '';
    if (docsDisponiveis.length > 1) {
        const botoesHtml = docsDisponiveis.map(doc => {
            const isActive = (urlAtual === doc.url || resolvedUrl === doc.url || (typeof url === 'string' && url === doc.url));
            const activeClass = isActive ? 'active' : '';
            return `<button onclick="alternarVisualizacaoPreview(this, '${doc.url}', '${doc.url}')" class="btn-drive btn-preview-toggle-tab ${activeClass}" style="flex: 1; min-width: 120px; padding: 8px 12px; font-size: 11.5px;">${doc.label}</button>`;
        }).join('');

        toggleBtn = `
             <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; padding: 10px; background: rgba(255,255,255,0.02); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
                 ${botoesHtml}
             </div>
         `;
    }

    let htmlHistoricoPreview = '';
    if (typeof gerarHtmlDocExtra === 'function') {
        const safeIndex = (typeof index === 'number' && index >= 0) ? index : (linha && linha['NUP'] ? `'${linha['NUP']}'` : -1);
        htmlHistoricoPreview += gerarHtmlDocExtra('Ofício Inicial', linha['OFICIO_INICIAL'], linha['NUP_INICIAL'], linha['LINK_INICIAL'], safeIndex);
        if (linha['REITERACOES'] && linha['REITERACOES'].length > 0) {
            linha['REITERACOES'].forEach((reit, i) => {
                htmlHistoricoPreview += gerarHtmlDocExtra(`${i + 1}ª Reiteração`, reit.NUMERO, reit.NUP, reit.LINK, safeIndex);
            });
        }
    }
    if (htmlHistoricoPreview !== '') {
        htmlHistoricoPreview = `<div style="margin-top: 15px; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 12px;"><strong style="color: #f1f5f9; font-size: 13px;"><i class="ci ci-folder"></i> Histórico de Documentos</strong>${htmlHistoricoPreview}</div>`;
    }

    let botoesAcoesHtml = '';
    const isGestor = usuarioAtivo && ((typeof window.isPerfilAdministrativo === 'function' && window.isPerfilAdministrativo()) || (typeof window.podeDistribuirProcesso === 'function' && window.podeDistribuirProcesso()) || usuarioAtivo.username === 'diflor' || usuarioAtivo.setor === 'DIFLOR');
    const isTecnico = usuarioAtivo && usuarioAtivo.perfil === 'tecnico';
    const temResposta = respPreviewUrl !== '';

    if (usuarioAtivo) {
        if (temResposta) {
            const isAprovadoBackend = (linha['STATUS_RESPOSTA'] || '').toUpperCase() === 'APROVADO';
            const isFazerCI = statusOperacional.replace(/\./g, '') === 'FAZER CI';
            if (!isGestor && (isAprovadoBackend || isFazerCI)) {
                botoesAcoesHtml += `<div class="modal-detail-approved" style="margin-bottom: 8px;"><i class="ci ci-lock"></i> Resposta aprovada pela Diretoria.</div>`;
            } else {
                botoesAcoesHtml += `<button onclick="removerDocumento(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-danger" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-trash"></i> Retirar Resposta</button>`;
            }
        } else if (isTecnico || isGestor) {
            botoesAcoesHtml += `<button onclick="anexarDocumento(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar Resposta</button>`;
        }

        if (!oficioPreviewUrl) {
            botoesAcoesHtml += `<button onclick="anexarPdfOriginalOficio(event, '${nupEsc}')" class="modal-detail-btn modal-detail-btn-upload" style="width: 100%; margin-bottom: 8px;"><i class="ci ci-paperclip"></i> Anexar Ofício Inicial</button>`;
        }
    }

    if (isGestor) {
        const isSemTecnico = !linha['TÉCNICO/ADMIN'] || linha['TÉCNICO/ADMIN'] === '-' || linha['TÉCNICO/ADMIN'] === 'S/T';
        const labelTec = isSemTecnico ? '<i class="ci ci-user"></i> Distribuir / Atribuir Técnico' : '<i class="ci ci-user"></i> Redistribuir Técnico';
        botoesAcoesHtml += `<button onclick="abrirModalAtribuirTecnicoOficio('${nupEsc}')" class="modal-detail-btn modal-detail-btn-gestao" style="width: 100%; margin-bottom: 8px;">${labelTec}</button>`;
    }

    let acoesFluxoHtml = '';
    const tecRegistro = (linha['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
    const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tecRegistro] : null) || (linha['GERÊNCIA'] || '').trim().toUpperCase();
    const podeAcaoFluxo = isGestor || (typeof window.podeConfeccionarDespachoOuCI === 'function' && window.podeConfeccionarDespachoOuCI(setorInternoDoTecnico));

    if (statusLimpoCI === 'SOBRESTADO') {
        acoesFluxoHtml = `
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; margin-bottom: 10px;">
                <div style="color: #fbbf24; font-weight: 700; font-size: 12.5px; margin-bottom: 8px;">⏸️ Processo Sobrestado ${linha['SOBRESTADO_SETOR'] ? `(Encaminhado para: ${linha['SOBRESTADO_SETOR']})` : ''}</div>
                ${linha['SOBRESTADO_MOTIVO'] ? `<div style="font-size: 12px; color: #cbd5e1; margin-bottom: 10px;"><strong>Motivo:</strong> ${linha['SOBRESTADO_MOTIVO']}</div>` : ''}
                ${preliminarPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${preliminarPreviewUrl}', '${preliminarPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(0, 250, 154, 0.15); border: 1px solid #00fa9a; color: #00fa9a; width: 100%; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-eye"></i> Visualizar Manifestação Preliminar</button>` : ''}
                ${parecerPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${parecerPreviewUrl}', '${parecerPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; width: 100%; margin-bottom: 8px; font-size: 12.5px; font-weight: 600; padding: 8px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-court"></i> Visualizar Parecer Externo</button>` : ''}
                ${oficioPreviewUrl ? `<button onclick="alternarVisualizacaoPreview(this, '${oficioPreviewUrl}', '${oficioPreviewUrl}')" class="btn-drive btn-preview-toggle-tab" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; width: 100%; margin-bottom: 8px; font-size: 12px; font-weight: 600; padding: 7px; display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;"><i class="ci ci-folder"></i> Visualizar Ofício Original</button>` : ''}
                <button onclick="abrirModalRetornoSobrestamento('${nupEsc}', 'oficio')" class="btn-drive" style="background: linear-gradient(135deg, #16a34a 0%, #15803d 100%); border: 1px solid #22c55e; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">▶️ Retomar do Sobrestamento (Anexar Parecer Externo)</button>
            </div>
        `;
    } else if (podeAcaoFluxo) {
        if (statusLimpoCI === 'FAZER CI') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(41, 128, 185, 0.12); border: 1px solid rgba(41, 128, 185, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #38bdf8; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;"><i class="ci ci-megaphone"></i> Ações de Fluxo (Comunicação Interna - C.I):</div>
                    <div style="display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="atualizarStatusCI(event, '${nupEsc}', 'AGUARDANDO ASSINATURA')" class="btn-drive" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); border: 1px solid #3b82f6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Confecção da C.I</button>
                        <button onclick="abrirModalSobrestar('${nupEsc}', 'oficio')" class="btn-drive" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24; width: 100%; margin: 0; font-size: 13px; font-weight: 600; padding: 9px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;"><i class="ci ci-pause"></i> Sobrestar Processo</button>
                    </div>
                </div>
            `;
        } else if (statusLimpoCI === 'AGUARDANDO ASSINATURA') {
            acoesFluxoHtml = `
                <div style="padding: 14px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 8px; margin-bottom: 10px;">
                    <div style="color: #c084fc; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">✍️ Ações de Fluxo (Assinatura):</div>
                    <button onclick="atualizarStatusCI(event, '${nupEsc}', 'FINALIZADO')" class="btn-drive" style="background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: 1px solid #8b5cf6; color: white; width: 100%; margin: 0; font-size: 13.5px; font-weight: 700; padding: 11px; border-radius: 8px; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.35); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;"><i class="ci ci-check"></i> Confirmar Assinatura Realizada</button>
                </div>
            `;
        }
    }

    let acoesRevisorHtml = '';
    const statusRespAval = (linha['STATUS_RESPOSTA'] || '').toUpperCase();
    const podeAvaliar = (typeof window.podeAvaliarManifestacao === 'function') && window.podeAvaliarManifestacao(setorInternoDoTecnico);

    if (podeAvaliar && statusRespAval !== 'APROVADO' && statusRespAval !== 'REPROVADO' && temResposta) {
        acoesRevisorHtml = `
            <div style="padding: 14px; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; margin-bottom: 8px;">
                <div style="color: #fbbf24; font-weight: 700; font-size: 12.5px; margin-bottom: 10px;">📋 Avaliação da Resposta Técnica:</div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="avaliarResposta(event, '${linha['NUP']}', 'APROVADO')" class="btn-drive btn-green-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-check"></i> Aprovar</button>
                    <button onclick="avaliarResposta(event, '${linha['NUP']}', 'REPROVADO')" class="btn-drive btn-red-outline" style="flex: 1; margin: 0; font-size: 12px; padding: 8px;"><i class="ci ci-close"></i> Reprovar</button>
                </div>
            </div>
        `;
    }

    let acoesStatusDiretoria = '';
    if (isGestor) {
        const opcoesOficioStatus = ["AGUARDANDO DISTRIBUIÇÃO", "AGUARDANDO MANIFESTAÇÃO TÉCNICA", "FAZER CI", "AGUARDANDO ASSINATURA", "REVISÃO", "FINALIZADO", "TRAMITADO", "ARQUIVADO"];
        const optionsHtml = opcoesOficioStatus.map(st => `<option value="${st}" ${st === statusOperacional ? 'selected' : ''}>${st}</option>`).join('');
        acoesStatusDiretoria = `
            <div style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; width: 100%; box-sizing: border-box;">
                <div style="font-size: 11px; color: #94a3b8; margin-bottom: 8px; font-weight: 700;"><i class="ci ci-settings"></i> GESTÃO DE STATUS</div>
                <div style="display: flex; gap: 8px; width: 100%; box-sizing: border-box; align-items: center;">
                    <select id="changeStatusSelectOficio-${nupEsc}" style="flex: 1; min-width: 0; padding: 6px 10px; background: #1e293b; color: #fff; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; font-size: 12px; outline: none; height: 36px; box-sizing: border-box;">
                        ${optionsHtml}
                    </select>
                    <button onclick="salvarStatusManualOficio(event, '${nupEsc}')" id="btnSalvarStatusOficio-${nupEsc}" class="btn-drive btn-blue" style="flex-shrink: 0; width: auto; min-width: 70px; padding: 6px 12px; margin: 0; font-size: 12px; height: 36px; box-sizing: border-box;">Salvar</button>
                </div>
            </div>
        `;
    }

    document.getElementById('previewInfoContent').innerHTML = `
        <div class="preview-info-header">
            <div class="preview-info-tag-and-status">
                <span class="modal-detail-module-tag modal-detail-tag-oficio"><i class="ci ci-folder"></i> Ofício</span>
                <span class="modal-detail-status-value modal-detail-status-oficio">${statusOperacional}</span>
            </div>
            <h3 class="preview-info-nup-title">${nupDisplay}</h3>
        </div>

        ${toggleBtn}

        <div class="preview-info-card">
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-calendar"></i></span><div><strong>Data:</strong> ${linha['DATA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-folder"></i></span><div><strong>Ofício N.:</strong> ${oficioRaw}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-doc"></i></span><div><strong>Tipo:</strong> ${linha['TIPO'] || 'Ofício'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-map"></i></span><div><strong>Comarca/Município:</strong> ${linha['COMARCA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-doc"></i></span><div><strong>Referência:</strong> ${linha['REFERÊNCIA'] || '-'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-clock"></i></span><div><strong>Prazo:</strong> ${(function(p){ let s = String(p || '-').trim(); return (s !== '-' && s !== '') ? (s.toLowerCase().includes('dia') ? s : s + ' dias') : '-'; })(linha['PRAZO'])}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-user"></i></span><div><strong>Responsável:</strong> <span style="color: #38bdf8; font-weight: 600;">${linha['TÉCNICO/ADMIN'] || 'Não atribuído'}</span></div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-building"></i></span><div><strong>Gerência:</strong> ${linha['GERÊNCIA'] || 'GEAA'}</div></div>
            <div class="preview-info-item"><span class="preview-icon"><i class="ci ci-doc"></i></span><div><strong>CAR:</strong> ${linha['CARMS'] || '-'}</div></div>
        </div>

        ${htmlObs}
        ${htmlHistoricoPreview}

        <div id="preview-timeline-container" style="margin-top: 15px;"></div>

        <div class="preview-actions-section">
            <div class="preview-actions-title">Ações e Interações</div>
            ${acoesFluxoHtml}
            ${botoesAcoesHtml}
            ${acoesRevisorHtml}
            ${acoesStatusDiretoria}
        </div>
    `;

    modal.style.display = 'flex';
    const infoPanel = document.getElementById('previewInfo');
    if (infoPanel) infoPanel.scrollTop = 0;

    if (linha && linha['NUP'] && typeof renderizarLinhaTempoSistema === 'function') {
        renderizarLinhaTempoSistema(linha['NUP'], 'preview-timeline-container');
    }
}

function togglePreviewInfo() {
    const infoPanel = document.getElementById('previewInfo');
    if (infoPanel) {
        infoPanel.classList.toggle('hidden');
        const iframe = document.getElementById('previewFrame');
        if (iframe && iframe.src) {
            setTimeout(() => {
                try { iframe.src = iframe.src; } catch (e) {}
            }, 50);
        }
    }
}

async function alternarVisualizacaoPreview(btn, urlPreview, urlDownload) {
    if (btn && btn.parentElement) {
        const botoes = btn.parentElement.querySelectorAll('.btn-preview-toggle-tab');
        botoes.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }

    let resolvedUrl = urlPreview || '';
    let resolvedDownloadUrl = urlDownload || urlPreview || '';

    try {
        if (typeof obterLinkVisualizacaoSeguro === 'function') {
            resolvedUrl = await obterLinkVisualizacaoSeguro(urlPreview);
        }
        if (typeof obterLinkDownloadSeguro === 'function') {
            resolvedDownloadUrl = await obterLinkDownloadSeguro(urlDownload || urlPreview);
        }
    } catch (e) {
        console.error('Erro ao alternar preview:', e);
    }

    const iframe = document.getElementById('previewFrame');
    if (iframe) {
        iframe.style.display = 'block';
        iframe.src = resolvedUrl;
    }
    const btnOpenPreview = document.getElementById('btn-open-preview');
    if (btnOpenPreview) {
        btnOpenPreview.href = resolvedUrl.replace('/preview', '/view');
    }

    const gisContainer = document.getElementById('gisMapContainerModal');
    if (gisContainer) gisContainer.style.display = 'none';

    const btnDownload = document.getElementById('btn-download-preview');
    if (btnDownload) btnDownload.href = resolvedDownloadUrl;
}

function fecharPreview() {
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.style.display = 'none';
        modal.innerHTML = '';
    }
    const modalPequeno = document.getElementById('detalhesModal');
    if (modalPequeno) {
        modalPequeno.style.display = 'none';
    }
    if (window.mapaGisModal) {
        window.mapaGisModal.remove();
        window.mapaGisModal = null;
        window.camadaGeoJsonModal = null;
    }
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

    const m = document.getElementById('atribuirTecnicoOficioModal');
    if (m) {
        m.style.zIndex = '2000';
        m.style.display = 'flex';
    }
}

function fecharModalAtribuirTecnicoOficio() {
    document.getElementById('atribuirTecnicoOficioModal').style.display = 'none';
}


async function salvarAtribuicaoTecnicoOficio() {
    const nup = document.getElementById('atrOficioNup').value;
    const tecnico = document.getElementById('atrOficioTecnico').value;
    if (!tecnico) { mostrarToast('Selecione um técnico para atribuir.', 'error'); return; }

    const btn = document.getElementById('btnSalvarAtribuicaoOficio');
    const txtOriginal = btn ? btn.innerHTML : 'Salvar Distribuição';
    if (btn) { btn.innerHTML = '⏳ Preparando...'; btn.disabled = true; }

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
    if (typeof aplicarFiltros === 'function') aplicarFiltros();
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
        const stBadge = infoContent.querySelector('.modal-detail-status-oficio');
        if (stBadge) stBadge.textContent = 'AGUARDANDO MANIFESTAÇÃO TÉCNICA';
    }

    const newIndex = dadosExibidos.findIndex(r => r['NUP'] === nup);
    if (newIndex !== -1 && document.getElementById('detalhesModal').style.display === 'flex') {
        abrirModal(newIndex);
    }

    if (btn) { btn.innerHTML = txtOriginal; btn.disabled = false; }

    try {
        const payload = { acao: "atribuir_tecnico_oficio", nup: nup, tecnico: tecnico };
        const resultado = await executarAcaoGAS(payload);

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
        dadosFiltradosBadge = dados.filter(r => window.isMesmoTecnico(r['TÉCNICO/ADMIN'], usuarioAtivo));
    } else if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
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
        cartasFiltradas = cartasFiltradas.filter(r => window.isMesmoTecnico(r['TÉCNICO/ADM'] || r['TECNICO/ADM'], usuarioAtivo));
    } else if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
        cartasFiltradas = cartasFiltradas.filter(r => {
            const tec = String(r['TÉCNICO/ADM'] || r['TECNICO/ADM'] || '').toUpperCase().trim();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';
            const gerenciaRow = String(r['GERÊNCIA'] || '').toUpperCase().trim();
            if (!semTecnico) {
                const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tec] : null) || 'S/G';
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
    if (typeof limparEPadronizarExternos === 'function' && typeof dadosExternosGlobais !== 'undefined' && Array.isArray(dadosExternosGlobais)) {
        dadosExternosGlobais.forEach(limparEPadronizarExternos);
    }
    let externosFiltrados = typeof dadosExternosGlobais !== 'undefined' ? dadosExternosGlobais : [];
    if (usuarioAtivo.perfil === 'tecnico') {
        externosFiltrados = externosFiltrados.filter(r => window.isMesmoTecnico(r['TÉCNICO/ADMIN'], usuarioAtivo));
    } else if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
        externosFiltrados = externosFiltrados.filter(r => {
            const tec = String(r['TÉCNICO/ADMIN'] || '').toUpperCase().trim();
            const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';
            const gerenciaRow = String(r['GERÊNCIA'] || '').toUpperCase().trim();
            if (!semTecnico) {
                const setorInternoDoTecnico = (typeof MAPA_TECNICOS_SETORES !== 'undefined' ? MAPA_TECNICOS_SETORES[tec] : null) || 'S/G';
                return (setorInternoDoTecnico === usuarioAtivo.setor);
            } else {
                return (gerenciaRow === usuarioAtivo.setor);
            }
        });
    }

    let totalExtDist = externosFiltrados.filter(r => {
        const tec = String(r['TÉCNICO/ADMIN'] || '').toUpperCase().trim();
        const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const isFinalizado = statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO';
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        return semTecnico && !isFinalizado && !hasResposta && statusRow !== 'FAZER DESPACHO' && statusRow !== 'FAZER CI' && statusRow !== 'AGUARDANDO ASSINATURA' && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO';
    }).length;

    let totalExtAndamento = externosFiltrados.filter(r => {
        const tec = String(r['TÉCNICO/ADMIN'] || '').toUpperCase().trim();
        const semTecnico = tec === '' || tec === '-' || tec === 'S/T' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        const statusResp = (r['STATUS-RESPOSTA'] || r['STATUS DA RESPOSTA'] || r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const isReprovado = (statusResp === 'REPROVADO');
        const isEmAndamentoStatus = (statusRow === 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' || statusRow === 'AGUARDANDO MANIFESTACAO TECNICA');

        return !semTecnico && isEmAndamentoStatus && (!hasResposta || isReprovado) && statusRow !== 'REVISÃO' && statusRow !== 'REVISAO';
    }).length;

    let totalExtRevisao = externosFiltrados.filter(r => {
        const statusRow = (r['STATUS'] || '').toUpperCase().trim();
        const isFinalizado = statusRow === 'RESPONDIDO' || statusRow === 'ARQUIVADO' || statusRow === 'TRAMITADO' || statusRow === 'FINALIZADO';
        const linkResposta = r['LINK DA RESPOSTA'] || r['LINK RESPOSTA'] || r['LINK_RESPOSTA'] || '';
        const hasResposta = linkResposta && String(linkResposta).trim().startsWith('http');
        const statusResp = (r['STATUS-RESPOSTA'] || r['STATUS DA RESPOSTA'] || r['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const isReprovado = (statusResp === 'REPROVADO');

        let matchesSubAba = true;
        if (typeof subAbaExternosRevisaoAtiva !== 'undefined' && typeof subAbaAtiva !== 'undefined' && subAbaAtiva === 'Aguardando Revisão') {
            if (subAbaExternosRevisaoAtiva === 'Pendentes') {
                matchesSubAba = (statusResp !== 'APROVADO' && statusResp !== 'REPROVADO');
            } else if (subAbaExternosRevisaoAtiva === 'Reprovados') {
                matchesSubAba = isReprovado;
            } else if (subAbaExternosRevisaoAtiva === 'Geral') {
                matchesSubAba = !isReprovado;
            }
        } else {
            matchesSubAba = !isReprovado;
        }

        return matchesSubAba && (hasResposta || statusRow === 'REVISÃO' || statusRow === 'REVISAO') && statusRow !== 'FAZER DESPACHO' && statusRow !== 'FAZER CI' && statusRow !== 'AGUARDANDO ASSINATURA' && !isFinalizado;
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

    // TOP NAVBAR BADGES
    atualizarBadgeDOM('badge-top-distribuicao', totalDistribuicao);
    atualizarBadgeDOM('badge-top-andamento', totalAndamento);
    atualizarBadgeDOM('badge-top-atrasados', totalAtrasados);
    atualizarBadgeDOM('badge-top-respondidos', totalRespPendentes);
    atualizarBadgeDOM('badge-top-comunicacao', totalComunicacao);
    atualizarBadgeDOM('badge-top-assinatura-oficios', totalAssinaturaOficios);

    atualizarBadgeDOM('badge-top-cartas-distribuicao', totalCartasDistribuicao);
    atualizarBadgeDOM('badge-top-cartas-andamento', totalCartasAndamento);
    atualizarBadgeDOM('badge-top-cartas-atrasados', totalCartasAtrasados);
    atualizarBadgeDOM('badge-top-cartas-revisao', totalCartasRevisao);
    atualizarBadgeDOM('badge-top-cartas-despacho', totalCartasDespacho);
    atualizarBadgeDOM('badge-top-cartas-assinatura', totalCartasAssinatura);

    atualizarBadgeDOM('badge-top-externos-distribuicao', totalExtDist);
    atualizarBadgeDOM('badge-top-externos-andamento', totalExtAndamento);
    atualizarBadgeDOM('badge-top-externos-revisao', totalExtRevisao);
    atualizarBadgeDOM('badge-top-externos-despacho', totalExtDespacho);
    atualizarBadgeDOM('badge-top-externos-assinatura', totalExtAssinatura);

    if (filtroAtivo === 'inicio' && typeof atualizarDashboardInicio === 'function') {
        atualizarDashboardInicio();
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
    "DIBIO",
    "PREFEITURA"
];

const opcoesTipoAba1 = [
    "JUNTADA",
    "OFÍCIO",
    "MT",
    "CARTA CONSULTA"
];

const opcoesGerencia = [
    "DIFLOR",
    "GCAR",
    "GEAA",
    "GEAMB"
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
    if (typeof fecharModalCadastroUnificado === 'function') fecharModalCadastroUnificado();
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
    let gcsUri = null;

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        if (file.size > 25 * 1024 * 1024) {
            mostrarToast('Erro: O arquivo deve ter no máximo 25MB', 'error');
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
            btn.style.opacity = '1';
            return;
        }

        const nupFormatado = nup;
        const oficioFormatado = oficioN.replace(/\//g, '-');
        fileName = (abaDestino === "1") ? `${oficioFormatado}.pdf` : `${nupFormatado}.pdf`;

        // 1. Upload Seguro no GCS
        if (typeof GCSStorage !== 'undefined') {
            try {
                const gcsRes = await GCSStorage.fazerUpload(file, {
                    modulo: 'oficios',
                    nup: nup,
                    nomePersonalizado: fileName,
                    username: usuarioAtivo.username || ''
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
            } catch (e) {
                mostrarToast('Erro ao ler o arquivo', 'error');
                btn.innerHTML = textoOriginal;
                btn.disabled = false;
                btn.style.opacity = '1';
                return;
            }
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
        url: gcsUri,
        linkGcs: gcsUri,
        fileName: fileName
    };

    const tecVal = (payload.tecnico || '').trim().toUpperCase();
    const temTecnico = tecVal !== '' && tecVal !== '-' && tecVal !== 'S/T' && tecVal !== 'SEM TÉCNICO' && tecVal !== 'NÃO ATRIBUÍDO' && tecVal !== 'SEM TÉCNICO/ADM';
    const statusInicial = temTecnico ? 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' : 'AGUARDANDO DISTRIBUIÇÃO';

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
        'STATUS': statusInicial,
        'STATUS_RESPOSTA': '',
        'MOTIVO_AVALIACAO': '',
        'DATA_DISTRIBUICAO': temTecnico ? (payload.data_oficio || '') : '',
        'E-MS': '-',
        'CBRS': '-',
        'OBSERVAÇÃO': payload.observacao || '-',
        'LINK_OFICIO': gcsUri || '',
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
            const linkFinal = gcsUri || resultado.url;
            if (linkFinal) {
                novoObj['LINK_OFICIO'] = linkFinal;
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
        
        const hasResposta = (procRef['LINK_RESPOSTA'] || procRef['LINK DA RESPOSTA'] || '').trim() !== '' && (procRef['LINK_RESPOSTA'] || procRef['LINK DA RESPOSTA'] || '').trim() !== '-';
        const statusRespUpper = (procRef['STATUS_RESPOSTA'] || '').toUpperCase().trim();
        const statusUpperNorm = (procRef['STATUS'] || '').toUpperCase().trim().replace(/\./g, '');
        const fluxosManterStatus = ['REVISÃO', 'REVISAO', 'FAZER CI', 'FAZER DESPACHO', 'AGUARDANDO ASSINATURA', 'FINALIZADO', 'TRAMITADO', 'ARQUIVADO'];
        const possuiManifestacaoOuFluxoFinal = hasResposta || statusRespUpper !== '' || fluxosManterStatus.includes(statusUpperNorm);

        if (!possuiManifestacaoOuFluxoFinal) {
            const tec = (procRef['TÉCNICO/ADMIN'] || '').trim().toUpperCase();
            const temTec = tec !== '' && tec !== '-' && tec !== 'S/T';
            procRef['STATUS'] = temTec ? 'AGUARDANDO MANIFESTAÇÃO TÉCNICA' : 'AGUARDANDO DISTRIBUIÇÃO';
            procRef['STATUS_RESPOSTA'] = '';
            procRef['MOTIVO_AVALIACAO'] = '';
            procRef['LINK_RESPOSTA'] = '';
        }

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

/* ==========================================================================
   DASHBOARD INÍCIO: PROCESSOS EM ANDAMENTO, KPIS, GRÁFICOS E TABELA UNIFICADA
   ========================================================================== */

let processosInicioFiltrados = [];
let filtroModuloInicioAtivo = 'todos';
let filtrosKpiInicioAtivos = new Set();
let chartTecnicosInstancia = null;

function iniciarRelogioNavbar() {
    function atualizar() {
        const agora = new Date();
        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        
        const diaSemana = diasSemana[agora.getDay()];
        const dia = agora.getDate();
        const mes = meses[agora.getMonth()];
        const ano = agora.getFullYear();
        const horas = String(agora.getHours()).padStart(2, '0');
        const minutos = String(agora.getMinutes()).padStart(2, '0');
        const segundos = String(agora.getSeconds()).padStart(2, '0');
        
        const horaStr = `${horas}:${minutos}:${segundos}`;
        const dataCompleta = `${diaSemana}, ${dia} de ${mes} de ${ano} | ${horaStr}`;
        
        const clockTop = document.getElementById('topLiveClock');
        if (clockTop) clockTop.innerText = horaStr;
        
        const clockHero = document.getElementById('dashHeroClock');
        if (clockHero) clockHero.innerText = dataCompleta;
    }
    atualizar();
    setInterval(atualizar, 1000);
}

function toggleTopDropdown(id) {
    const el = document.getElementById(id);
    if (!el) return;
    const content = el.querySelector('.top-dropdown-content');
    if (!content) return;
    
    const isVisible = content.style.display === 'block';
    document.querySelectorAll('.top-dropdown-content').forEach(d => d.style.display = 'none');
    
    if (!isVisible) {
        content.style.display = 'block';
    }
}

document.addEventListener('click', function(e) {
    if (!e.target.closest('.top-nav-dropdown')) {
        document.querySelectorAll('.top-dropdown-content').forEach(d => d.style.display = 'none');
    }
});

function isProcessoFinalizado(status, statusVisual) {
    const s = String(status || '').toUpperCase().trim();
    const sv = String(statusVisual || '').toUpperCase().trim();
    return s === 'FINALIZADO' || s === 'TRAMITADO' || s === 'ARQUIVADO' || s === 'CONCLUIDO' || s === 'CONCLUÍDO' || s === 'RESPONDIDO'
        || sv.includes('FINALIZADO') || sv.includes('TRAMITADO') || sv.includes('ARQUIVADO') || sv.includes('CONCLUÍDO');
}

function obterSetorDesignadoProcesso(p) {
    if (!p) return 'GEAA';

    // 1. Técnico designado
    const tec = (p.tecnico || '').trim().toUpperCase();
    const semTecnico = !tec || tec === 'S/T' || tec === '-' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';

    if (!semTecnico && typeof MAPA_TECNICOS_SETORES !== 'undefined') {
        const setorTec = MAPA_TECNICOS_SETORES[tec];
        if (setorTec) {
            if (setorTec === 'GEAMB') return 'GEAA';
            return setorTec;
        }
    }

    // 2. Campo explícito de gerência ou setor registrado na linha
    const raw = p.raw || {};
    const gerenciaRaw = (p.gerencia || raw['GERÊNCIA'] || raw['GERENCIA'] || raw['SETOR'] || '').trim().toUpperCase();
    if (gerenciaRaw) {
        if (gerenciaRaw.includes('GEAA') || gerenciaRaw.includes('GEAMB') || gerenciaRaw.includes('ASSUNTOS AMBIENTAIS')) return 'GEAA';
        if (gerenciaRaw.includes('GCAR') || gerenciaRaw.includes('CAR')) return 'GCAR';
        if (gerenciaRaw.includes('DIFLOR') || gerenciaRaw.includes('FLORESTAL')) return 'DIFLOR';
    }

    // 3. Fallback de acordo com o módulo operacional
    if (p.moduloKey === 'cartas' || p.moduloKey === 'autos') {
        return 'GCAR';
    }

    return 'GEAA';
}
window.obterSetorDesignadoProcesso = obterSetorDesignadoProcesso;

function obterProcessosEmAndamentoUnificados() {
    const lista = [];

    // 1. Ofícios Internos
    if (Array.isArray(dadosCoringa)) {
        dadosCoringa.forEach(row => {
            const statusVisual = (typeof obterStatusVisual === 'function') ? obterStatusVisual(row).texto : (row['STATUS'] || '');
            if (!isProcessoFinalizado(row['STATUS'], statusVisual)) {
                let dias = parseInt(row['DIAS RESTANTES']);
                if (isNaN(dias)) dias = calcularDiasRestantes(row['DATA'], row['PRAZO']);
                lista.push({
                    modulo: 'Ofícios',
                    moduloKey: 'oficios',
                    nup: row['NUP'] || '-',
                    interessado: row['OFÍCIO N.'] || row['OFÍCIO'] || row['ASSUNTO'] || row['COMARCA'] || '-',
                    tecnico: (row['TÉCNICO/ADMIN'] || 'S/T').trim().toUpperCase(),
                    gerencia: (row['OFÍCIO'] && row['GERÊNCIA'] ? row['GERÊNCIA'] : (row['GERÊNCIA'] || '')).trim().toUpperCase(),
                    status: row['STATUS'] || 'EM ANDAMENTO',
                    statusVisual: statusVisual,
                    diasRestantes: isNaN(dias) ? '-' : dias,
                    dataEntrada: row['DATA'] || '-',
                    raw: row
                });
            }
        });
    }

    // 2. Cartas Consulta
    if (typeof dadosCartasGlobais !== 'undefined' && Array.isArray(dadosCartasGlobais)) {
        dadosCartasGlobais.forEach(row => {
            const statusVisual = row['STATUS'] || '';
            if (!isProcessoFinalizado(row['STATUS'], statusVisual)) {
                let dias = parseInt(row['DIAS RESTANTES'] || row['DIAS_RESTANTES']);
                if (isNaN(dias) && typeof calcularDiasRestantes === 'function') dias = calcularDiasRestantes(row['DATA DE ENTRADA'] || row['DATA'], row['PRAZO']);
                lista.push({
                    modulo: 'Cartas Consulta',
                    moduloKey: 'cartas',
                    nup: row['NUP'] || row['PROCESSO'] || row['PROCESSO/NUP'] || '-',
                    interessado: row['REQUERENTE'] || row['MUNICÍPIO'] || row['ASSUNTO'] || row['CARMS'] || '-',
                    tecnico: (row['TÉCNICO/ADM'] || row['TÉCNICO'] || 'S/T').trim().toUpperCase(),
                    gerencia: (row['GERÊNCIA'] || '').trim().toUpperCase(),
                    status: row['STATUS'] || 'EM ANDAMENTO',
                    statusVisual: statusVisual,
                    diasRestantes: isNaN(dias) ? '-' : dias,
                    dataEntrada: row['DATA DE ENTRADA'] || row['DATA'] || '-',
                    raw: row
                });
            }
        });
    }

    // 3. Autos de Infração
    if (typeof dadosAutosGlobais !== 'undefined' && Array.isArray(dadosAutosGlobais)) {
        dadosAutosGlobais.forEach(row => {
            const statusVisual = row['STATUS ATUAL'] || row['STATUS'] || '';
            if (!isProcessoFinalizado(statusVisual, statusVisual)) {
                let dias = parseInt(row['DIAS RESTANTES']);
                if (isNaN(dias) && typeof calcularDiasRestantes === 'function') dias = calcularDiasRestantes(row['DATA AUTUAÇÃO'] || row['DATA'], row['PRAZO']);
                lista.push({
                    modulo: 'Autos de Infração',
                    moduloKey: 'autos',
                    nup: row['NUP'] || '-',
                    interessado: row['AUTUADO'] || row['ASSUNTO'] || row['MUNICÍPIO'] || row['TIPO'] || '-',
                    tecnico: (row['TÉCNICO'] || 'S/T').trim().toUpperCase(),
                    gerencia: (row['SETOR'] || row['GERÊNCIA'] || '').trim().toUpperCase(),
                    status: statusVisual,
                    statusVisual: statusVisual,
                    diasRestantes: isNaN(dias) ? '-' : dias,
                    dataEntrada: row['DATA AUTUAÇÃO'] || row['DATA'] || '-',
                    raw: row
                });
            }
        });
    }

    // 4. Ofícios Externos
    if (typeof dadosExternosGlobais !== 'undefined' && Array.isArray(dadosExternosGlobais)) {
        dadosExternosGlobais.forEach(row => {
            const statusVisual = row['STATUS'] || '';
            if (!isProcessoFinalizado(row['STATUS'], statusVisual)) {
                let dias = parseInt(row['DIAS RESTANTES']);
                if (isNaN(dias) && typeof calcularDiasRestantes === 'function') dias = calcularDiasRestantes(row['DATA DE RECEBIMENTO'] || row['DATA'], row['PRAZO']);
                lista.push({
                    modulo: 'Ofícios Externos',
                    moduloKey: 'externos',
                    nup: row['NUP'] || '-',
                    interessado: row['REMETENTE'] || row['ASSUNTO'] || row['CARMS'] || '-',
                    tecnico: (row['TÉCNICO/ADMIN'] || row['TÉCNICO'] || 'S/T').trim().toUpperCase(),
                    gerencia: (row['GERÊNCIA'] || '').trim().toUpperCase(),
                    status: row['STATUS'] || 'EM ANDAMENTO',
                    statusVisual: statusVisual,
                    diasRestantes: isNaN(dias) ? '-' : dias,
                    dataEntrada: row['DATA DE RECEBIMENTO'] || row['DATA'] || '-',
                    raw: row
                });
            }
        });
    }

    // Atribuição de Setor em cada processo
    lista.forEach(p => {
        p.setor = obterSetorDesignadoProcesso(p);
    });

    // Filtragem de Permissões RBAC e Setorial
    if (usuarioAtivo) {
        if (usuarioAtivo.perfil === 'tecnico') {
            return lista.filter(p => window.isMesmoTecnico(p.tecnico, usuarioAtivo));
        }
        
        if (usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            return lista.filter(p => p.setor === usuarioAtivo.setor);
        }
    }

    return lista;
}

function atualizarDashboardInicio() {
    const todosEmAndamento = obterProcessosEmAndamentoUnificados();
    
    // Filtra pelo módulo ativo na barra superior se não for 'todos'
    let processosParaKpis = todosEmAndamento;
    if (filtroModuloInicioAtivo !== 'todos') {
        processosParaKpis = todosEmAndamento.filter(p => p.moduloKey === filtroModuloInicioAtivo);
    }
    const totalGeral = processosParaKpis.length;

    let countDistribuicao = 0;
    let countManifestacao = 0;
    let countRevisao = 0;
    let countAssinatura = 0;
    let countAtrasados = 0;
    let countSobrestados = 0;

    processosParaKpis.forEach(p => {
        const s = String(p.status || '').toUpperCase();
        const tec = p.tecnico;
        const semTecnico = !tec || tec === 'S/T' || tec === '-' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';

        // KPI 1: Aguard. Distribuição
        if (semTecnico || s.includes('DISTRIBUIÇÃO') || s.includes('DISTRIBUICAO')) {
            countDistribuicao++;
        }
        // KPI 6: Sobrestados
        else if (s.includes('SOBRESTADO')) {
            countSobrestados++;
        }
        // KPI 3: Aguard. Revisão
        else if (s.includes('REVISÃO') || s.includes('REVISAO')) {
            countRevisao++;
        }
        // KPI 4: Aguard. Assinatura
        else if (s.includes('ASSINATURA') || s === 'FAZER CI' || s === 'FAZER DESPACHO') {
            countAssinatura++;
        }
        // KPI 2: Aguard. Manifestação
        else {
            countManifestacao++;
        }

        // KPI 5: Atrasados
        if (!isNaN(p.diasRestantes) && p.diasRestantes < 0) {
            countAtrasados++;
        }
    });

    const calcPct = (c) => totalGeral > 0 ? `${Math.round((c / totalGeral) * 100)}%` : '0%';

    const isTec = typeof window.isPerfilTecnico === 'function' ? window.isPerfilTecnico() : (usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.role === 'tecnico'));
    const elCardDist = document.getElementById('kpi-card-distribuicao');
    if (elCardDist) {
        elCardDist.style.display = isTec ? 'none' : '';
    }
    const kpiGrid = document.querySelector('.kpi-row-grid');
    if (kpiGrid) {
        if (isTec) kpiGrid.classList.add('kpi-grid-5');
        else kpiGrid.classList.remove('kpi-grid-5');
    }

    const elDist = document.getElementById('kpi-num-distribuicao');
    if (elDist) {
        elDist.innerText = countDistribuicao;
        const b = document.getElementById('kpi-badge-distribuicao');
        if (b) b.innerText = calcPct(countDistribuicao);
    }
    const elManif = document.getElementById('kpi-num-manifestacao');
    if (elManif) {
        elManif.innerText = countManifestacao;
        const b = document.getElementById('kpi-badge-manifestacao');
        if (b) b.innerText = calcPct(countManifestacao);
    }
    const elRev = document.getElementById('kpi-num-revisao');
    if (elRev) {
        elRev.innerText = countRevisao;
        const b = document.getElementById('kpi-badge-revisao');
        if (b) b.innerText = calcPct(countRevisao);
    }
    const elAss = document.getElementById('kpi-num-assinatura');
    if (elAss) {
        elAss.innerText = countAssinatura;
        const b = document.getElementById('kpi-badge-assinatura');
        if (b) b.innerText = calcPct(countAssinatura);
    }
    const elAtr = document.getElementById('kpi-num-atrasados');
    if (elAtr) {
        elAtr.innerText = countAtrasados;
        const b = document.getElementById('kpi-badge-atrasados');
        if (b) b.innerText = calcPct(countAtrasados);
    }
    const elSob = document.getElementById('kpi-num-sobrestados');
    if (elSob) {
        elSob.innerText = countSobrestados;
        const b = document.getElementById('kpi-badge-sobrestados');
        if (b) b.innerText = calcPct(countSobrestados);
    }

    // Popular Selects de Setores e Técnicos do filtro de Início
    popularSelectSetoresInicio();
    popularSelectTecnicosInicio();

    // Filtrar e Renderizar Gráfico e Tabela Unificada Dinamicamente
    filtrarDashboardInicio();
}

function renderizarGraficoTecnicos(contagem) {
    const canvas = document.getElementById('chartTecnicosProcessos');
    if (!canvas || typeof Chart === 'undefined') return;

    const entries = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(e => e[0]);
    const data = entries.map(e => e[1]);
    const bgColors = labels.map(l => l === '(Sem Técnico)' ? '#e67e22' : '#3b82f6');

    // Se já existir instância ativa no mesmo canvas, atualiza in-place para manter hitboxes e interações sincronizadas
    if (chartTecnicosInstancia && chartTecnicosInstancia.ctx) {
        chartTecnicosInstancia.data.labels = labels;
        chartTecnicosInstancia.data.datasets[0].data = data;
        chartTecnicosInstancia.data.datasets[0].backgroundColor = bgColors;
        chartTecnicosInstancia.update();
        return;
    }

    const ctx = canvas.getContext('2d');
    chartTecnicosInstancia = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Processos em Andamento',
                data: data,
                backgroundColor: bgColors,
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.7,
                categoryPercentage: 0.8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Sincronização estrita de coordenadas por coluna/eixo X (elimina divergência de tooltip)
            interaction: {
                mode: 'index',
                axis: 'x',
                intersect: false
            },
            hover: {
                mode: 'index',
                axis: 'x',
                intersect: false
            },
            onHover: (event, chartElement) => {
                const target = event.native && event.native.target;
                if (target) target.style.cursor = (chartElement && chartElement.length > 0) ? 'pointer' : 'default';
            },
            onClick: (event, elements) => {
                if (elements && elements.length > 0) {
                    const idx = elements[0].index;
                    const tec = labels[idx];
                    const sel = document.getElementById('filtroInicioTecnico');
                    if (sel && tec) {
                        sel.value = tec === '(Sem Técnico)' ? '' : tec;
                        filtrarDashboardInicio();
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    axis: 'x',
                    intersect: false,
                    position: 'nearest',
                    backgroundColor: '#1e293b',
                    titleColor: '#ffffff',
                    bodyColor: '#cbd5e1',
                    borderColor: 'rgba(255,255,255,0.15)',
                    borderWidth: 1,
                    padding: 10,
                    titleFont: {
                        family: 'Inter',
                        size: 12,
                        weight: '700'
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 11
                    },
                    callbacks: {
                        title: function(context) {
                            return (context && context[0]) ? context[0].label : '';
                        },
                        label: function(context) {
                            const val = context.parsed.y !== undefined ? context.parsed.y : context.raw;
                            return ` ${val} processos em andamento`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false,
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            size: 11,
                            family: 'Inter',
                            weight: '600'
                        },
                        maxRotation: 45,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            size: 11,
                            family: 'Inter'
                        },
                        stepSize: 1
                    }
                }
            }
        }
    });
}

function popularSelectSetoresInicio() {
    const sel = document.getElementById('filtroInicioSetor');
    if (!sel) return;

    if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
        sel.value = usuarioAtivo.setor;
        sel.disabled = true;
        sel.style.opacity = '0.85';
    } else {
        sel.disabled = false;
        sel.style.opacity = '1';
    }
}
window.popularSelectSetoresInicio = popularSelectSetoresInicio;

function popularSelectTecnicosInicio(setorFiltro) {
    const sel = document.getElementById('filtroInicioTecnico');
    if (!sel) return;

    if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
        const nomeTec = (usuarioAtivo.nomePlanilha || usuarioAtivo.nomeCompleto || '').toUpperCase().trim();
        sel.innerHTML = `<option value="${nomeTec}">${nomeTec}</option>`;
        sel.value = nomeTec;
        sel.disabled = true;
        sel.style.opacity = '0.85';
        return;
    }

    const valorAnterior = sel.value;
    sel.innerHTML = '<option value="">-- Todos os Técnicos --</option>';

    if (typeof window.opcoesAutoTecnico !== 'undefined' && Array.isArray(window.opcoesAutoTecnico)) {
        let listaTecnicos = [...window.opcoesAutoTecnico];
        
        // Restrição de usuário não-DIFLOR
        if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            listaTecnicos = listaTecnicos.filter(tec => {
                const t = tec.trim().toUpperCase();
                return MAPA_TECNICOS_SETORES[t] === usuarioAtivo.setor;
            });
        }

        // Restrição pelo setor selecionado no filtro (GEAA, GCAR, DIFLOR)
        const setorAtivo = setorFiltro !== undefined ? setorFiltro : (document.getElementById('filtroInicioSetor') ? document.getElementById('filtroInicioSetor').value : '');
        if (setorAtivo) {
            listaTecnicos = listaTecnicos.filter(tec => {
                const t = tec.trim().toUpperCase();
                return MAPA_TECNICOS_SETORES[t] === setorAtivo;
            });
        }

        let encontrou = false;
        listaTecnicos.forEach(tec => {
            const opt = document.createElement('option');
            opt.value = tec.toUpperCase();
            opt.textContent = tec;
            if (opt.value === valorAnterior) encontrou = true;
            sel.appendChild(opt);
        });

        if (encontrou) {
            sel.value = valorAnterior;
        } else {
            sel.value = '';
        }
    }
}
window.popularSelectTecnicosInicio = popularSelectTecnicosInicio;

function aoMudarFiltroInicioSetor() {
    const setorVal = (document.getElementById('filtroInicioSetor') ? document.getElementById('filtroInicioSetor').value : '').toUpperCase().trim();
    popularSelectTecnicosInicio(setorVal);
    filtrarDashboardInicio();
}
window.aoMudarFiltroInicioSetor = aoMudarFiltroInicioSetor;

function selecionarModuloInicio(modulo, btn) {
    filtroModuloInicioAtivo = modulo || 'todos';

    // Se estiver em outra aba principal, navega para o Início
    if (typeof mudarAbaPrincipal === 'function') {
        const abaAtual = document.querySelector('.tab-section.active');
        if (!abaAtual || abaAtual.id !== 'aba-inicio') {
            mudarAbaPrincipal('inicio');
        }
    }

    // Sincroniza estado ativo nos botões da barra superior
    const mapaTopBtns = {
        'todos': 'top-btn-inicio',
        'oficios': 'top-btn-oficios',
        'cartas': 'top-btn-cartas',
        'autos': 'top-btn-autos',
        'externos': 'top-btn-externos'
    };
    document.querySelectorAll('.top-nav-menu .top-nav-btn').forEach(b => b.classList.remove('active'));
    const targetTopBtnId = mapaTopBtns[filtroModuloInicioAtivo] || 'top-btn-inicio';
    const targetTopBtn = document.getElementById(targetTopBtnId);
    if (targetTopBtn) targetTopBtn.classList.add('active');

    // Atualiza os indicadores de KPIs, Gráfico e Tabela para o módulo selecionado
    atualizarDashboardInicio();
}

function filtrarKpiInicio(kpiTipo) {
    if (!kpiTipo) return;

    const isTec = typeof window.isPerfilTecnico === 'function' ? window.isPerfilTecnico() : (usuarioAtivo && (usuarioAtivo.perfil === 'tecnico' || usuarioAtivo.role === 'tecnico'));
    if (isTec && kpiTipo === 'distribuicao') return;

    // Toggle multi-seleção no Set
    if (filtrosKpiInicioAtivos.has(kpiTipo)) {
        filtrosKpiInicioAtivos.delete(kpiTipo);
    } else {
        filtrosKpiInicioAtivos.add(kpiTipo);
    }

    // Atualiza classes visuais nos 6 cards de KPI
    const todosKpis = ['distribuicao', 'manifestacao', 'revisao', 'assinatura', 'atrasados', 'sobrestados'];
    todosKpis.forEach(tipo => {
        const cardEl = document.getElementById(`kpi-card-${tipo}`);
        if (cardEl) {
            if (filtrosKpiInicioAtivos.has(tipo)) {
                cardEl.classList.add('active');
            } else {
                cardEl.classList.remove('active');
            }
        }
    });

    filtrarDashboardInicio();
}

function limparFiltrosInicio() {
    const buscaInput = document.getElementById('filtroInicioBusca');
    if (buscaInput) buscaInput.value = '';
    
    const setorSelect = document.getElementById('filtroInicioSetor');
    if (setorSelect) {
        if (usuarioAtivo && usuarioAtivo.username !== 'diflor' && usuarioAtivo.setor !== 'DIFLOR') {
            setorSelect.value = usuarioAtivo.setor;
        } else {
            setorSelect.value = '';
        }
    }

    popularSelectTecnicosInicio(setorSelect ? setorSelect.value : '');

    const tecSelect = document.getElementById('filtroInicioTecnico');
    if (tecSelect) {
        if (usuarioAtivo && usuarioAtivo.perfil === 'tecnico') {
            tecSelect.value = (usuarioAtivo.nomePlanilha || usuarioAtivo.nomeCompleto || '').toUpperCase().trim();
        } else {
            tecSelect.value = '';
        }
    }
    
    const statusSelect = document.getElementById('filtroInicioStatus');
    if (statusSelect) statusSelect.value = '';
    
    // Limpa filtros de KPI e remove estado ativo dos cards
    filtrosKpiInicioAtivos.clear();
    const todosKpis = ['distribuicao', 'manifestacao', 'revisao', 'assinatura', 'atrasados', 'sobrestados'];
    todosKpis.forEach(tipo => {
        const cardEl = document.getElementById(`kpi-card-${tipo}`);
        if (cardEl) cardEl.classList.remove('active');
    });

    // Restaura módulo para todos
    selecionarModuloInicio('todos');
}

function filtrarDashboardInicio() {
    const todosEmAndamento = obterProcessosEmAndamentoUnificados();
    const buscaVal = (document.getElementById('filtroInicioBusca') ? document.getElementById('filtroInicioBusca').value : '').toLowerCase().trim();
    const setorVal = (document.getElementById('filtroInicioSetor') ? document.getElementById('filtroInicioSetor').value : '').toUpperCase().trim();
    const tecVal = (document.getElementById('filtroInicioTecnico') ? document.getElementById('filtroInicioTecnico').value : '').toUpperCase().trim();
    const statusVal = (document.getElementById('filtroInicioStatus') ? document.getElementById('filtroInicioStatus').value : '').toUpperCase().trim();

    const filtrados = todosEmAndamento.filter(p => {
        // 1. Filtro por Módulo
        if (filtroModuloInicioAtivo !== 'todos' && p.moduloKey !== filtroModuloInicioAtivo) {
            return false;
        }

        // 2. Filtro por Setor (GEAA, GCAR, DIFLOR)
        if (setorVal) {
            const setorP = p.setor || obterSetorDesignadoProcesso(p);
            if (setorP !== setorVal) return false;
        }

        // 3. Filtro Multi-Seleção de Blocos de Status (KPIs)
        if (filtrosKpiInicioAtivos.size > 0) {
            const s = String(p.status || '').toUpperCase();
            const tec = p.tecnico;
            const semTecnico = !tec || tec === 'S/T' || tec === '-' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';
            
            let matchesAnyKpi = false;

            if (filtrosKpiInicioAtivos.has('distribuicao')) {
                if (semTecnico || s.includes('DISTRIBUIÇÃO') || s.includes('DISTRIBUICAO')) matchesAnyKpi = true;
            }
            if (filtrosKpiInicioAtivos.has('manifestacao')) {
                if (!semTecnico && (s.includes('MANIFESTAÇÃO') || s.includes('MANIFESTACAO') || s.includes('ANDAMENTO')) && !s.includes('REVISÃO') && !s.includes('REVISAO') && !s.includes('ASSINATURA') && !s.includes('SOBRESTADO') && s !== 'FAZER CI' && s !== 'FAZER DESPACHO') {
                    matchesAnyKpi = true;
                }
            }
            if (filtrosKpiInicioAtivos.has('revisao')) {
                if (s.includes('REVISÃO') || s.includes('REVISAO')) matchesAnyKpi = true;
            }
            if (filtrosKpiInicioAtivos.has('assinatura')) {
                if (s.includes('ASSINATURA') || s === 'FAZER CI' || s === 'FAZER DESPACHO') matchesAnyKpi = true;
            }
            if (filtrosKpiInicioAtivos.has('atrasados')) {
                if (!isNaN(p.diasRestantes) && p.diasRestantes < 0) matchesAnyKpi = true;
            }
            if (filtrosKpiInicioAtivos.has('sobrestados')) {
                if (s.includes('SOBRESTADO')) matchesAnyKpi = true;
            }

            if (!matchesAnyKpi) return false;
        }

        // 3. Busca Textual
        if (buscaVal) {
            const matchNup = p.nup.toLowerCase().includes(buscaVal);
            const matchInteressado = p.interessado.toLowerCase().includes(buscaVal);
            if (!matchNup && !matchInteressado) return false;
        }

        // 4. Select de Técnico
        if (tecVal) {
            if (typeof window.isMesmoTecnico === 'function') {
                if (!window.isMesmoTecnico(p.tecnico, { nomePlanilha: tecVal, nomeCompleto: tecVal, username: tecVal })) return false;
            } else {
                if (p.tecnico !== tecVal) return false;
            }
        }

        // 5. Select de Status Dropdown
        if (statusVal) {
            if (statusVal === 'ATRASADOS') {
                if (isNaN(p.diasRestantes) || p.diasRestantes >= 0) return false;
            } else if (statusVal === 'AGUARDANDO DISTRIBUIÇÃO') {
                const s = String(p.status).toUpperCase();
                const semTec = !p.tecnico || p.tecnico === 'S/T' || p.tecnico === '-';
                if (!semTec && !s.includes('DISTRIBUIÇÃO') && !s.includes('DISTRIBUICAO')) return false;
            } else if (statusVal === 'AGUARDANDO MANIFESTAÇÃO') {
                const s = String(p.status).toUpperCase();
                if (!s.includes('MANIFESTAÇÃO') && !s.includes('MANIFESTACAO') && !s.includes('ANDAMENTO')) return false;
            } else if (statusVal === 'REVISÃO') {
                const s = String(p.status).toUpperCase();
                if (!s.includes('REVISÃO') && !s.includes('REVISAO')) return false;
            } else if (statusVal === 'AGUARDANDO ASSINATURA') {
                const s = String(p.status).toUpperCase();
                if (!s.includes('ASSINATURA')) return false;
            } else if (statusVal === 'SOBRESTADO') {
                const s = String(p.status).toUpperCase();
                if (!s.includes('SOBRESTADO')) return false;
            } else {
                if (!String(p.status).toUpperCase().includes(statusVal)) return false;
            }
        }

        return true;
    });

    // Renderiza a Tabela Unificada
    renderTabelaInicio(filtrados);

    // Recalcula e Atualiza o Gráfico de Técnicos com o subconjunto filtrado
    const contagemPorTecnico = {};
    filtrados.forEach(p => {
        const tec = p.tecnico;
        const semTecnico = !tec || tec === 'S/T' || tec === '-' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';
        if (!semTecnico) {
            contagemPorTecnico[tec] = (contagemPorTecnico[tec] || 0) + 1;
        } else {
            contagemPorTecnico['(Sem Técnico)'] = (contagemPorTecnico['(Sem Técnico)'] || 0) + 1;
        }
    });
    renderizarGraficoTecnicos(contagemPorTecnico);

    const totalEl = document.getElementById('dashChartTotal');
    if (totalEl) totalEl.innerText = `Total em Andamento: ${filtrados.length}`;
}

const filtrarTabelaInicio = filtrarDashboardInicio;

function obterStatusOperacionalFormatado(p) {
    const s = String(p.status || '').toUpperCase().trim();
    const tec = p.tecnico;
    const semTecnico = !tec || tec === 'S/T' || tec === '-' || tec === 'SEM TÉCNICO' || tec === 'NÃO ATRIBUÍDO' || tec === 'SEM TÉCNICO/ADM';

    if (semTecnico || s.includes('DISTRIBUIÇÃO') || s.includes('DISTRIBUICAO')) {
        return { texto: 'AGUARD. DISTRIBUIÇÃO', classe: 'badge-status-distribuicao', icon: '<i class="ci ci-inbox"></i>' };
    }
    if (s.includes('SOBRESTADO')) {
        return { texto: 'SOBRESTADO', classe: 'badge-status-sobrestado', icon: '<i class="ci ci-pause"></i>' };
    }
    if (s.includes('REVISÃO') || s.includes('REVISAO')) {
        return { texto: 'AGUARD. REVISÃO', classe: 'badge-status-revisao', icon: '<i class="ci ci-folder-check"></i>' };
    }
    if (s.includes('ASSINATURA')) {
        return { texto: 'AGUARD. ASSINATURA', classe: 'badge-status-assinatura', icon: '<i class="ci ci-pen"></i>' };
    }
    if (s === 'FAZER CI' || s === 'FAZER C.I.') {
        return { texto: 'FAZER C.I.', classe: 'badge-status-assinatura', icon: '<i class="ci ci-megaphone"></i>' };
    }
    if (s === 'FAZER DESPACHO') {
        return { texto: 'FAZER DESPACHO', classe: 'badge-status-assinatura', icon: '<i class="ci ci-megaphone"></i>' };
    }
    if (s.includes('MANIFESTAÇÃO') || s.includes('MANIFESTACAO') || s.includes('ANDAMENTO')) {
        return { texto: 'AGUARD. MANIFESTAÇÃO', classe: 'badge-status-manifestacao', icon: '<i class="ci ci-clock"></i>' };
    }
    if (!s || s === '-' || s === 'NAN') {
        return { texto: 'AGUARD. MANIFESTAÇÃO', classe: 'badge-status-manifestacao', icon: '<i class="ci ci-clock"></i>' };
    }
    return { texto: s, classe: 'badge-status-default', icon: '<i class="ci ci-doc"></i>' };
}

function limparNupDisplay(nup) {
    return String(nup || '-').replace(/\.pdf$/gi, '').trim();
}

function escaparParaAtributo(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function abrirModalVisualizacaoUnificado(moduloKey, nup) {
    if (!moduloKey || !nup) return;

    // Fecha qualquer modal de detalhes pequeno
    const modalPequeno = document.getElementById('detalhesModal');
    if (modalPequeno) modalPequeno.style.display = 'none';

    const nupLimpo = String(nup).trim().toUpperCase();
    const nupSemPdf = nupLimpo.replace(/\.PDF$/i, '');

    try {
        if (moduloKey === 'oficios') {
            const item = (dadosCoringa || []).find(d => {
                const n = String(d['NUP'] || '').trim().toUpperCase();
                return n === nupLimpo || n.replace(/\.PDF$/i, '') === nupSemPdf;
            });
            if (item) {
                const isSob = String(item['STATUS'] || '').toUpperCase().includes('SOBRESTADO');
                const linkOficio = (isSob && item['MANIFESTACAO_PRELIMINAR']) ? item['MANIFESTACAO_PRELIMINAR'] : (item['LINK_OFICIO'] || item['LINK - OFÍCIO'] || item['LINK'] || item['MANIFESTACAO_PRELIMINAR'] || item['LINK_PARECER_EXTERNO'] || item['LINK_RESPOSTA'] || '');
                abrirPreview(linkOficio, item);
                return;
            }
        } else if (moduloKey === 'cartas') {
            const listaCartas = (typeof dadosCartasGlobais !== 'undefined' ? dadosCartasGlobais : (typeof dadosCartas !== 'undefined' ? dadosCartas : []));
            const nupDigitos = nupLimpo.replace(/[^A-Z0-9]/g, '');
            const item = listaCartas.find(d => {
                const n = String(d['NUP'] || d['PROCESSO'] || d['PROCESSO/NUP'] || '').trim().toUpperCase();
                if (n === nupLimpo || n.replace(/\.PDF$/i, '') === nupSemPdf) return true;
                const dDigitos = n.replace(/[^A-Z0-9]/g, '');
                if (nupDigitos && dDigitos && (dDigitos === nupDigitos || dDigitos.includes(nupDigitos) || nupDigitos.includes(dDigitos))) return true;
                return false;
            });
            if (item) {
                const isSob = String(item['STATUS'] || '').toUpperCase().includes('SOBRESTADO');
                const linkCarta = (isSob && item['MANIFESTACAO_PRELIMINAR']) ? item['MANIFESTACAO_PRELIMINAR'] : (item['LINK DO NUP'] || item['LINK_NUP'] || item['LINK'] || item['LINK_PROCESSO'] || item['MANIFESTACAO_PRELIMINAR'] || item['LINK_PARECER_EXTERNO'] || item['LINK DA RESPOSTA'] || '');
                if (typeof abrirModalPreviewCartas === 'function') {
                    abrirModalPreviewCartas(item, linkCarta, nup);
                    return;
                }
            }
        } else if (moduloKey === 'autos') {
            const listaAutos = (typeof dadosAutosGlobais !== 'undefined' ? dadosAutosGlobais : (typeof dadosAutos !== 'undefined' ? dadosAutos : []));
            const item = listaAutos.find(d => {
                const n = String(d['NUP'] || '').trim().toUpperCase();
                return n === nupLimpo || n.replace(/\.PDF$/i, '') === nupSemPdf;
            });
            if (item) {
                const isSob = String(item['STATUS ATUAL'] || item['STATUS'] || '').toUpperCase().includes('SOBRESTADO');
                const linkAuto = (isSob && item['MANIFESTACAO_PRELIMINAR']) ? item['MANIFESTACAO_PRELIMINAR'] : (item['LINK NUP'] || item['LINK-NUP'] || item['LINK DO NUP'] || item['LINK_NUP'] || item['LINK'] || item['MANIFESTACAO_PRELIMINAR'] || item['LINK_PARECER_EXTERNO'] || item['LINK DA RESPOSTA'] || '');
                if (typeof abrirPreviewAuto === 'function') {
                    abrirPreviewAuto(linkAuto, item, nup);
                    return;
                }
            }
        } else if (moduloKey === 'externos') {
            const listaExt = (typeof dadosExternosGlobais !== 'undefined' ? dadosExternosGlobais : (typeof dadosExternos !== 'undefined' ? dadosExternos : []));
            const item = listaExt.find(d => {
                const n = String(d['NUP'] || '').trim().toUpperCase();
                return n === nupLimpo || n.replace(/\.PDF$/i, '') === nupSemPdf;
            });
            if (item) {
                const isSob = String(item['STATUS'] || '').toUpperCase().includes('SOBRESTADO');
                const linkExt = (isSob && item['MANIFESTACAO_PRELIMINAR']) ? item['MANIFESTACAO_PRELIMINAR'] : (item['LINK_OFICIO'] || item['LINK DO NUP'] || item['LINK-NUP'] || item['LINK'] || item['MANIFESTACAO_PRELIMINAR'] || item['LINK_PARECER_EXTERNO'] || item['LINK DA RESPOSTA'] || '');
                if (typeof abrirPreviewExterno === 'function') {
                    abrirPreviewExterno(linkExt, item, nup);
                    return;
                }
            }
        }

        mostrarToast('Processo não encontrado para visualização.', 'warning');
    } catch (err) {
        console.error('Erro ao abrir visualização do processo:', err);
        mostrarToast('Erro ao carregar visualização do documento.', 'error');
    }
}

function renderTabelaInicio(processos) {
    const tbody = document.getElementById('tabela-inicio-body');
    const footer = document.getElementById('tabela-inicio-footer');
    if (!tbody) return;

    if (processos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #8899a6;">Nenhum processo em andamento encontrado com os filtros selecionados.</td></tr>';
        if (footer) footer.innerText = 'Exibindo 0 processos em andamento.';
        return;
    }

    if (footer) footer.innerText = 'Exibindo ' + processos.length + ' processos em andamento.';

    const svgEye = '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';

    let html = '';
    processos.forEach(p => {
        let badgeModClass = 'badge-mod-oficio';
        let badgeModIcon = '<i class="ci ci-folder"></i>';
        if (p.moduloKey === 'cartas') { badgeModClass = 'badge-mod-carta'; badgeModIcon = '<i class="ci ci-mail"></i>'; }
        else if (p.moduloKey === 'autos') { badgeModClass = 'badge-mod-auto'; badgeModIcon = '<i class="ci ci-scale"></i>'; }
        else if (p.moduloKey === 'externos') { badgeModClass = 'badge-mod-externo'; badgeModIcon = '<i class="ci ci-building"></i>'; }

        const stOperacional = obterStatusOperacionalFormatado(p);

        let badgeDias = '';
        if (!isNaN(p.diasRestantes)) {
            if (p.diasRestantes < 0) {
                badgeDias = '<span class="badge-prazo-dias badge-prazo-atrasado"><i class="ci ci-alert"></i> ' + Math.abs(p.diasRestantes) + 'd atrasado</span>';
            } else if (p.diasRestantes === 0) {
                badgeDias = '<span class="badge-prazo-dias badge-prazo-hoje"><i class="ci ci-alert"></i> Vence hoje</span>';
            } else {
                badgeDias = '<span class="badge-prazo-dias badge-prazo-emdia"><i class="ci ci-clock"></i> ' + p.diasRestantes + 'd restantes</span>';
            }
        } else {
            badgeDias = '<span class="badge-prazo-dias badge-prazo-semprazo">Sem Prazo</span>';
        }

        const nupDisplay = limparNupDisplay(p.nup);
        const setorBadge = p.setor ? '<span style="display: inline-block; margin-top: 3px; padding: 1px 6px; font-size: 10px; font-weight: 700; border-radius: 4px; background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.25); letter-spacing: 0.5px;">' + p.setor + '</span>' : '';

        const acaoBtn = '<button class="btn-table-action-ver" data-modulo="' + escaparParaAtributo(p.moduloKey) + '" data-nup="' + escaparParaAtributo(p.nup) + '">' + svgEye + '<span>Ver</span></button>';

        html += '<tr>' +
            '<td style="text-align: center;"><span class="badge-modulo ' + badgeModClass + '"><span class="badge-icon">' + badgeModIcon + '</span> <span>' + p.modulo + '</span></span></td>' +
            '<td><strong style="color: #f8fafc; font-family: monospace; font-size: 13px; letter-spacing: 0.3px;">' + nupDisplay + '</strong></td>' +
            '<td><div style="max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #cbd5e1;" title="' + escaparParaAtributo(p.interessado) + '">' + p.interessado + '</div></td>' +
            '<td><div><span style="font-weight: 600; color: #e2e8f0;">' + (p.tecnico || 'S/T') + '</span></div>' + (setorBadge ? '<div>' + setorBadge + '</div>' : '') + '</td>' +
            '<td style="text-align: center;"><span class="badge-status-operacional ' + stOperacional.classe + '">' + stOperacional.icon + ' ' + stOperacional.texto + '</span></td>' +
            '<td style="text-align: center;">' + badgeDias + '</td>' +
            '<td style="text-align: center;">' + acaoBtn + '</td>' +
            '</tr>';
    });

    tbody.innerHTML = html;

    // Delegação de evento: clique no botão Ver
    tbody.querySelectorAll('.btn-table-action-ver').forEach(btn => {
        btn.addEventListener('click', function() {
            const moduloKey = this.getAttribute('data-modulo');
            const nup = this.getAttribute('data-nup');
            abrirModalVisualizacaoUnificado(moduloKey, nup);
        });
    });
}

configurarDragAndDrop('cadOficioArquivo', 'cadOficioArquivoLabel', updateFileNameOficio);
document.addEventListener('DOMContentLoaded', iniciarSistema);

// ============================================================================
// MODAL UNIFICADO DE CADASTRO DE PROCESSOS (STEPPER)
// ============================================================================

let tipoDocumentoSelecionado = null;
let _origemMontada = null;

// Registry modular — facilita adição de novos tipos de documento no futuro
const TIPOS_DOCUMENTO_REGISTRO = {
    oficio: {
        titulo: 'Cadastrar Novo Ofício',
        icone: 'ci-folder',
        modalOrigemId: 'cadastroModal',
        abrirFn: function() { if (typeof abrirModalCadastro === 'function') abrirModalCadastro(); },
        fecharFn: function() { if (typeof fecharModalCadastro === 'function') fecharModalCadastro(); }
    },
    externo: {
        titulo: 'Cadastrar Ofício Externo',
        icone: 'ci-inbox',
        modalOrigemId: 'cadastroExternoModal',
        abrirFn: function() { if (typeof abrirModalCadastroExterno === 'function') abrirModalCadastroExterno(); },
        fecharFn: function() { if (typeof fecharModalCadastroExterno === 'function') fecharModalCadastroExterno(); }
    },
    auto: {
        titulo: 'Cadastrar Auto de Infração',
        icone: 'ci-scale',
        modalOrigemId: 'cadastroAutoModal',
        abrirFn: function() { if (typeof abrirModalCadastroAuto === 'function') abrirModalCadastroAuto(); },
        fecharFn: function() { if (typeof fecharModalCadastroAuto === 'function') fecharModalCadastroAuto(); }
    },
    carta: {
        titulo: 'Cadastrar Carta Consulta',
        icone: 'ci-pen',
        modalOrigemId: 'cadastroCartaModal',
        abrirFn: function() { if (typeof abrirModalCadastroCarta === 'function') abrirModalCadastroCarta(); },
        fecharFn: function() { if (typeof fecharModalCadastroCarta === 'function') fecharModalCadastroCarta(); }
    }
};

function abrirModalCadastroUnificado(tipoPreSelecionado) {
    desmontarFormularioAtual();
    const modal = document.getElementById('cadastroUnificadoModal');
    if (!modal) return;
    modal.style.display = 'flex';

    if (tipoPreSelecionado && TIPOS_DOCUMENTO_REGISTRO[tipoPreSelecionado]) {
        selecionarTipoDocumento(tipoPreSelecionado);
    } else {
        tipoDocumentoSelecionado = null;
        const stepSel = document.getElementById('step-selecao-tipo');
        const stepForm = document.getElementById('step-formulario');
        if (stepSel) stepSel.style.display = 'block';
        if (stepForm) stepForm.style.display = 'none';
        const container = document.getElementById('formulario-dinamico-container');
        if (container) container.innerHTML = '';
    }
}

function fecharModalCadastroUnificado() {
    const modal = document.getElementById('cadastroUnificadoModal');
    if (modal) modal.style.display = 'none';
    desmontarFormularioAtual();
    tipoDocumentoSelecionado = null;
    const stepSel = document.getElementById('step-selecao-tipo');
    const stepForm = document.getElementById('step-formulario');
    if (stepSel) stepSel.style.display = 'block';
    if (stepForm) stepForm.style.display = 'none';
}

function desmontarFormularioAtual() {
    if (_origemMontada) {
        const { modalContent, grid, footer, modalOrigem } = _origemMontada;
        if (modalContent) {
            if (grid) modalContent.appendChild(grid);
            if (footer) modalContent.appendChild(footer);
        }
        if (modalOrigem) {
            modalOrigem.style.display = 'none';
        }
        _origemMontada = null;
    }
    const container = document.getElementById('formulario-dinamico-container');
    if (container) container.innerHTML = '';
}

function selecionarTipoDocumento(tipo) {
    const config = TIPOS_DOCUMENTO_REGISTRO[tipo];
    if (!config) return;

    // Desmonta qualquer formulário ativo anteriormente
    desmontarFormularioAtual();
    tipoDocumentoSelecionado = tipo;

    const modalOrigem = document.getElementById(config.modalOrigemId);
    if (!modalOrigem) {
        mostrarToast('Módulo de formulário não encontrado.', 'error');
        return;
    }

    const modalContent = modalOrigem.querySelector('.modal-content');
    const grid = modalContent ? modalContent.querySelector('.modal-grid') : null;
    const footer = modalContent ? modalContent.querySelector('.modal-footer') : null;

    if (!grid || !footer) {
        mostrarToast('Estrutura de campos não encontrada.', 'error');
        return;
    }

    // Guarda referências para retorno
    _origemMontada = {
        tipo: tipo,
        modalOrigem: modalOrigem,
        modalContent: modalContent,
        grid: grid,
        footer: footer,
        fecharFn: config.fecharFn
    };

    // Monta o grid e footer dentro de Step 2
    const container = document.getElementById('formulario-dinamico-container');
    container.innerHTML = '';
    container.appendChild(grid);
    container.appendChild(footer);

    // Transição visual limpa
    const stepSel = document.getElementById('step-selecao-tipo');
    const stepForm = document.getElementById('step-formulario');
    if (stepSel) stepSel.style.display = 'none';
    if (stepForm) stepForm.style.display = 'block';
    
    const tituloEl = document.getElementById('titulo-formulario-dinamico');
    if (tituloEl) tituloEl.innerHTML = `<i class="ci ${config.icone}"></i> ${config.titulo}`;

    // Executa a inicialização padrão (popula selects, flatpickr, etc.)
    if (typeof config.abrirFn === 'function') {
        config.abrirFn();
        modalOrigem.style.display = 'none'; // Garante que o modal de origem não sobreponha
    }
}

function voltarParaSelecao() {
    if (_origemMontada && typeof _origemMontada.fecharFn === 'function') {
        _origemMontada.fecharFn();
    }
    desmontarFormularioAtual();
    tipoDocumentoSelecionado = null;
    const stepSel = document.getElementById('step-selecao-tipo');
    const stepForm = document.getElementById('step-formulario');
    if (stepSel) stepSel.style.display = 'block';
    if (stepForm) stepForm.style.display = 'none';
}

// Fechamento ao clicar no backdrop escuro do modal unificado
window.addEventListener('click', function(event) {
    const modal = document.getElementById('cadastroUnificadoModal');
    if (event.target === modal) {
        fecharModalCadastroUnificado();
    }
});