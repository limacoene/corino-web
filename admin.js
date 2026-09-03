/**
 * C.O.R.I.N.O. - Módulo Administrativo: Gestão de Usuários & Métricas de Acesso
 * Controlador Frontend para consumo da API REST administrativa (com Fallback Estático para GitHub Pages)
 */

let adminUsuariosCache = [];
let adminPaginacaoAtual = { page: 1, limit: 10, total: 0, totalPages: 1 };
let adminFiltroDebounceTimer = null;
let modoEstaticoAtivo = null;

const DEFAULT_SEED_USERS = [
    { id: 1, username: "diflor", senha: "gonçaloalves", nome_completo: "DIRETORIA FLORESTAL", setor: "DIFLOR", funcao: "Diretoria Florestal", role: "admin", status: "ativo" },
    { id: 2, username: "jcoene", senha: "jlima", nome_completo: "Jhonatan Coene", setor: "DIFLOR", funcao: "Administrador de Sistemas", role: "admin", status: "ativo" },
    { id: 3, username: "jhonatan", senha: "dev1", nome_completo: "Jhonatan Lima (Dev)", setor: "DIFLOR", funcao: "Desenvolvedor Full Stack", role: "admin", status: "ativo" },
    { id: 4, username: "geamb", senha: "usop1", nome_completo: "Gerência de Assuntos Ambientais", setor: "GEAMB", funcao: "Gerente Revisor", role: "revisor", status: "ativo" },
    { id: 5, username: "gcar", senha: "gcar1281", nome_completo: "Gerência de Cadastro Ambiental Rural", setor: "GCAR", funcao: "Gerente Revisor", role: "revisor", status: "ativo" },
    { id: 6, username: "geaa", senha: "geaa2026", nome_completo: "Gerência de Autorizações Ambientais", setor: "GEAA", funcao: "Gerente Revisor", role: "revisor", status: "ativo" },
    { id: 7, username: "erocha", senha: "esouza", nome_completo: "Erlisson Rocha", setor: "GCAR", funcao: "Revisor Técnico", role: "revisor", status: "ativo" },
    { id: 8, username: "jcampos", senha: "jazedias", nome_completo: "José Renato Campos", setor: "GEAA", funcao: "Revisor Técnico", role: "revisor", status: "ativo" },
    { id: 9, username: "lteixeira", senha: "lcarlos", nome_completo: "Luiz Teixeira", setor: "GEAA", funcao: "Revisor Técnico", role: "revisor", status: "ativo" },
    { id: 10, username: "anogueira", senha: "acunha", nome_completo: "Alcebíades Nogueira", setor: "GEAA", funcao: "Assistente Administrativo", role: "user", status: "ativo" },
    { id: 11, username: "ccarvalho", senha: "corinad", nome_completo: "Corina Carvalho", setor: "GEAA", funcao: "Assistente Administrativa", role: "user", status: "ativo" },
    { id: 12, username: "ggimenes", senha: "rcouto", nome_completo: "Gabriela Gimenes", setor: "GCAR", funcao: "Assistente Administrativa", role: "user", status: "ativo" },
    { id: 13, username: "ldias", senha: "lcosta", nome_completo: "Lívya Dias", setor: "DIFLOR", funcao: "Assistente Administrativa", role: "user", status: "ativo" },
    { id: 14, username: "nmendonca", senha: "nnunes", nome_completo: "Nattana Mendonça", setor: "GCAR", funcao: "Assistente Administrativa", role: "user", status: "ativo" },
    { id: 15, username: "osantos", senha: "oantonio", nome_completo: "Osvaldo Santos", setor: "DIFLOR", funcao: "Assistente Administrativo", role: "user", status: "ativo" },
    { id: 16, username: "asantos", senha: "abilar", nome_completo: "Adriana Santos", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 17, username: "adpaula", senha: "adivino", nome_completo: "Alexandre de Paula", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 18, username: "acanjos", senha: "101215", nome_completo: "Allan dos Anjos", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 19, username: "aoliveira", senha: "atavares", nome_completo: "Anderson Oliveira", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 20, username: "bbrito", senha: "balmeida", nome_completo: "Bárbara Brito", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 21, username: "bcarneiro", senha: "boliveira", nome_completo: "Beatriz Carneiro", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 22, username: "ccaroline", senha: "carlant", nome_completo: "Carla Caroline", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 23, username: "cfonseca", senha: "csilva", nome_completo: "Carlos Juliano Fonseca", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 24, username: "cbarauna", senha: "coliveira", nome_completo: "Cristiane Baraúna", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 25, username: "dmartins", senha: "dtiago", nome_completo: "Dianessa Martins", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 26, username: "dmara", senha: "dfigueiredo", nome_completo: "Dina Mara", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 27, username: "erafael", senha: "epaulino", nome_completo: "Eleri Rafael", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 28, username: "emesquita", senha: "mesquita13", nome_completo: "Etevaldo Mesquita", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 29, username: "fvasconcellos", senha: "fananias", nome_completo: "Fabiana Vasconcellos", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 30, username: "fgortega", senha: "fgama", nome_completo: "Francielly Ortega", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 31, username: "hcrodrigues", senha: "hcorrea", nome_completo: "Helen Caroline Rodrigues", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 32, username: "hgomes", senha: "hpelissaro", nome_completo: "Hellen Gomes", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 33, username: "hconcone", senha: "villasboas", nome_completo: "Henrique Concone", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 34, username: "hbrufao", senha: "hravaza", nome_completo: "Herus Brufão", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 35, username: "hsilva", senha: "hrodrigues", nome_completo: "Hilbaty Silva", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 36, username: "jpierre", senha: "jcosta", nome_completo: "Jean Pierre", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 37, username: "jribeiro", senha: "jferreira", nome_completo: "Joelthon Ribeiro", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 38, username: "jguimaraes", senha: "jrocha", nome_completo: "Joniel Guimarães", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 39, username: "lpires", senha: "lcarmo", nome_completo: "Larissa Pires", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 40, username: "lricardo", senha: "loliveira", nome_completo: "Luciano Ricardo", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 41, username: "mgarcia", senha: "mcorona", nome_completo: "Maria Garcia", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 42, username: "mshinzato", senha: "muemura", nome_completo: "Mariana Shinzato", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 43, username: "marianaopp", senha: "marianaopp", nome_completo: "Mariana Opp", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 44, username: "msander", senha: "mmacedo", nome_completo: "Max Sander", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 45, username: "maguirre", senha: "mpereira", nome_completo: "Michael Aguirre", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 46, username: "mandressa", senha: "mbrito", nome_completo: "Milka Andressa", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 47, username: "rgarcia", senha: "rfreitas", nome_completo: "Rhoander Garcia", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 48, username: "rcosta", senha: "mutumdev", nome_completo: "Rodrigo Costa", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" },
    { id: 49, username: "snagel", senha: "ssilva", nome_completo: "Suzielly Nagel", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico", status: "ativo" }
];

function isModoEstatico() {
    if (modoEstaticoAtivo !== null) return modoEstaticoAtivo;
    if (window.location.hostname.includes('github.io') || window.location.protocol === 'file:') {
        modoEstaticoAtivo = true;
        return true;
    }
    return false;
}

function ativarModoEstatico() {
    modoEstaticoAtivo = true;
}

function obterUsuariosLocaisAdmin() {
    let users = [];
    try {
        const stored = localStorage.getItem('corino_users_admin_db');
        if (stored) users = JSON.parse(stored);
    } catch (e) {}
    if (!users || !Array.isArray(users) || users.length === 0) {
        users = DEFAULT_SEED_USERS.map(u => ({ ...u, created_at: new Date().toISOString() }));
        localStorage.setItem('corino_users_admin_db', JSON.stringify(users));
    }
    return users;
}

function salvarUsuariosLocaisAdmin(users) {
    localStorage.setItem('corino_users_admin_db', JSON.stringify(users));
}

async function handleAdminStaticRequest(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const urlObj = new URL(url, window.location.origin);
    const pathname = urlObj.pathname;

    // 1. GET /admin/metrics/logins
    if (pathname.includes('/metrics/logins')) {
        const users = obterUsuariosLocaisAdmin();
        let logs = [];
        try {
            logs = JSON.parse(localStorage.getItem('corino_login_audit_logs') || '[]');
        } catch (e) {}
        if (logs.length === 0) {
            logs = [
                { id: 1, username_attempted: 'diflor', nome_completo: 'DIRETORIA FLORESTAL (DIFLOR)', ip_address: '127.0.0.1 (Navegador)', status: 'SUCCESS', failure_reason: null, timestamp: new Date().toISOString() }
            ];
            localStorage.setItem('corino_login_audit_logs', JSON.stringify(logs));
        }
        return {
            status: 'success',
            metrics: {
                totalLogins: logs.length,
                successfulLogins: logs.filter(l => l.status === 'SUCCESS').length,
                failedLogins: logs.filter(l => l.status === 'FAILED').length,
                activeUsersCount: users.filter(u => u.status === 'ativo').length
            },
            recentActivity: logs.slice(0, 15)
        };
    }

    // 2. GET /admin/users
    if (pathname.endsWith('/users') && method === 'GET') {
        const users = obterUsuariosLocaisAdmin();
        const search = (urlObj.searchParams.get('search') || '').toLowerCase().trim();
        const setor = (urlObj.searchParams.get('setor') || '').toUpperCase().trim();
        const funcao = (urlObj.searchParams.get('funcao') || '').toLowerCase().trim();
        const role = (urlObj.searchParams.get('role') || '').toLowerCase().trim();
        const status = (urlObj.searchParams.get('status') || '').toLowerCase().trim();
        const page = parseInt(urlObj.searchParams.get('page') || '1', 10);
        const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);

        let filtered = users.filter(u => {
            if (search) {
                const matchSearch = (u.username && u.username.toLowerCase().includes(search)) ||
                                    (u.nome_completo && u.nome_completo.toLowerCase().includes(search)) ||
                                    (u.funcao && u.funcao.toLowerCase().includes(search));
                if (!matchSearch) return false;
            }
            if (setor && u.setor !== setor) return false;
            if (funcao && (!u.funcao || !u.funcao.toLowerCase().includes(funcao))) return false;
            if (role && u.role !== role) return false;
            if (status && u.status !== status) return false;
            return true;
        });

        const offset = (page - 1) * limit;
        const pagedData = filtered.slice(offset, offset + limit);

        return {
            status: 'success',
            data: pagedData,
            pagination: {
                page: page,
                limit: limit,
                total: filtered.length,
                totalPages: Math.ceil(filtered.length / limit) || 1
            }
        };
    }

    // 3. POST /admin/users (Novo Usuário)
    if (pathname.endsWith('/users') && method === 'POST') {
        const body = JSON.parse(options.body || '{}');
        const users = obterUsuariosLocaisAdmin();
        const novoId = Math.max(...users.map(u => u.id || 0), 0) + 1;
        const novoUsuario = {
            id: novoId,
            username: (body.username || '').toLowerCase().trim(),
            nome_completo: body.nome_completo || '',
            setor: body.setor || 'DIFLOR',
            funcao: body.funcao || '',
            role: body.role || 'user',
            status: body.status || 'ativo',
            senha: body.password || 'corino123',
            created_at: new Date().toISOString()
        };
        users.push(novoUsuario);
        salvarUsuariosLocaisAdmin(users);
        return { status: 'success', user: novoUsuario, message: 'Usuário cadastrado com sucesso (modo local)!' };
    }

    // 4. POST /admin/users/:id/reset-password
    if (pathname.includes('/reset-password') && method === 'POST') {
        const parts = pathname.split('/');
        const idIdx = parts.indexOf('users') + 1;
        const userId = parseInt(parts[idIdx], 10);
        const body = JSON.parse(options.body || '{}');
        const users = obterUsuariosLocaisAdmin();
        const user = users.find(u => u.id === userId);
        if (!user) throw new Error('Usuário não encontrado.');

        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        let newPwd = body.newPassword || '';
        if (!newPwd) {
            for (let i = 0; i < 10; i++) newPwd += chars[Math.floor(Math.random() * chars.length)];
        }
        user.senha = newPwd;
        salvarUsuariosLocaisAdmin(users);
        return { status: 'success', newPassword: newPwd, message: 'Senha redefinida com sucesso (modo local)!' };
    }

    // 5. PATCH /admin/users/:id (Edição / Status)
    if (method === 'PATCH' && pathname.includes('/users/')) {
        const parts = pathname.split('/');
        const idIdx = parts.indexOf('users') + 1;
        const userId = parseInt(parts[idIdx], 10);
        const body = JSON.parse(options.body || '{}');
        const users = obterUsuariosLocaisAdmin();
        const user = users.find(u => u.id === userId);
        if (!user) throw new Error('Usuário não encontrado.');

        if (body.nome_completo !== undefined) user.nome_completo = body.nome_completo;
        if (body.setor !== undefined) user.setor = body.setor;
        if (body.funcao !== undefined) user.funcao = body.funcao;
        if (body.role !== undefined) user.role = body.role;
        if (body.status !== undefined) user.status = body.status;

        salvarUsuariosLocaisAdmin(users);
        return { status: 'success', user, message: 'Dados do usuário atualizados com sucesso (modo local)!' };
    }

    return { status: 'success' };
}

function obterAuthToken() {
    return sessionStorage.getItem('corino_auth_token') || localStorage.getItem('corino_auth_token') || '';
}

/**
 * Wrapper de requisições autenticadas para a API administrativa
 */
async function adminFetch(url, options = {}) {
    if (isModoEstatico()) {
        return handleAdminStaticRequest(url, options);
    }

    const token = obterAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-corino-token': token,
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, { ...options, headers });
        const contentType = response.headers.get('content-type') || '';

        if (!response.ok || !contentType.includes('application/json')) {
            console.warn(`[Admin] Backend indisponível (${response.status}). Alternando para modo estático.`);
            ativarModoEstatico();
            return handleAdminStaticRequest(url, options);
        }

        const data = await response.json();

        if (response.status === 401) {
            mostrarToast('Sessão administrativa expirada. Por favor, faça login novamente.', 'error');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            throw new Error('Sessão expirada');
        }

        if (response.status === 403) {
            mostrarToast('Acesso negado: você não possui privilégios de administrador.', 'error');
            throw new Error('Acesso negado');
        }

        if (!response.ok) {
            throw new Error(data.message || `Erro na requisição (${response.status})`);
        }

        return data;
    } catch (err) {
        ativarModoEstatico();
        return handleAdminStaticRequest(url, options);
    }
}

// ============================================================================
// CARREGAMENTO PRINCIPAL DO PAINEL
// ============================================================================

async function carregarPainelAdmin() {
    try {
        const statusBanner = document.getElementById('admin-status-badge');
        if (!statusBanner) {
            const headerActions = document.querySelector('.admin-header-actions');
            if (headerActions) {
                const badge = document.createElement('div');
                badge.id = 'admin-status-badge';
                badge.style.cssText = 'font-size: 12px; padding: 6px 14px; border-radius: 6px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px;';
                if (isModoEstatico()) {
                    badge.style.background = 'rgba(56, 189, 248, 0.15)';
                    badge.style.color = '#38bdf8';
                    badge.style.border = '1px solid rgba(56, 189, 248, 0.3)';
                    badge.innerHTML = '<i class="ci ci-cloud"></i> Armazenamento Local (GitHub Pages)';
                } else {
                    badge.style.background = 'rgba(74, 222, 128, 0.15)';
                    badge.style.color = '#4ade80';
                    badge.style.border = '1px solid rgba(74, 222, 128, 0.3)';
                    badge.innerHTML = '<i class="ci ci-check"></i> Servidor Node.js Conectado';
                }
                headerActions.prepend(badge);
            }
        }

        await Promise.all([
            carregarMetricasAdmin(),
            carregarUsuariosAdmin(adminPaginacaoAtual.page)
        ]);
    } catch (err) {
        console.error('❌ Erro ao carregar painel administrativo:', err);
    }
}

// ============================================================================
// 1. MÉTRICAS DE ACESSO & AUDITORIA DE LOGINS
// ============================================================================

async function carregarMetricasAdmin() {
    try {
        const data = await adminFetch('/admin/metrics/logins');
        if (!data || data.status !== 'success') return;

        const m = data.metrics || {};
        const elTotal = document.getElementById('admin-kpi-total-logins');
        const elSucesso = document.getElementById('admin-kpi-active-logins');
        const elFalhas = document.getElementById('admin-kpi-failed-logins');
        const elAtivos = document.getElementById('admin-kpi-active-users');

        if (elTotal) elTotal.innerText = m.totalLogins || 0;
        if (elSucesso) elSucesso.innerText = m.successfulLogins || 0;
        if (elFalhas) elFalhas.innerText = m.failedLogins || 0;
        if (elAtivos) elAtivos.innerText = m.activeUsersCount || 0;

        // Renderiza tabela de atividade recente
        renderizarTabelaLogs(data.recentActivity || []);
    } catch (err) {
        console.error('❌ Erro ao carregar métricas:', err);
    }
}

function renderizarTabelaLogs(logs) {
    const tbody = document.getElementById('tabela-logs-body');
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 25px; color: #888;">Nenhum registro de acesso recente encontrado.</td></tr>`;
        return;
    }

    let html = '';
    logs.forEach(item => {
        const isSuccess = item.status === 'SUCCESS';
        const badgeStatus = isSuccess
            ? `<span class="badge-status-operacional" style="background: rgba(46,160,67,0.15); color: #3fb950; border-color: rgba(46,160,67,0.4);"><i class="ci ci-check"></i> Sucesso</span>`
            : `<span class="badge-status-operacional" style="background: rgba(239,68,68,0.15); color: #ef4444; border-color: rgba(239,68,68,0.4);"><i class="ci ci-alert"></i> Falha</span>`;

        const dataFormatada = formatarDataHoraLog(item.timestamp);
        const nomeUsuario = item.nome_completo ? `${item.nome_completo} (${item.setor || '-'})` : '<span style="color:#777;">Não associado</span>';
        const detalhes = item.failure_reason ? `<span style="color: #ef4444; font-size: 11.5px;">${item.failure_reason}</span>` : '<span style="color: #64748b;">Autenticado com sucesso</span>';

        html += `
            <tr>
                <td style="font-family: monospace; font-size: 12px; color: #94a3b8; white-space: nowrap;">${dataFormatada}</td>
                <td style="font-weight: 700; color: #e2e8f0;">${escapeHtml(item.username_attempted || '-')}</td>
                <td>${nomeUsuario}</td>
                <td style="font-family: monospace; font-size: 12px; color: #38bdf8;">${escapeHtml(item.ip_address || '-')}</td>
                <td>${badgeStatus}</td>
                <td>${detalhes}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function formatarDataHoraLog(isoString) {
    if (!isoString) return '-';
    try {
        const d = new Date(isoString.replace(' ', 'T'));
        if (isNaN(d.getTime())) return isoString;
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const ano = d.getFullYear();
        const hora = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        const seg = String(d.getSeconds()).padStart(2, '0');
        return `${dia}/${mes}/${ano} ${hora}:${min}:${seg}`;
    } catch (e) {
        return isoString;
    }
}

// ============================================================================
// 2. LISTAGEM & PAGINAÇÃO DE USUÁRIOS
// ============================================================================

async function carregarUsuariosAdmin(pagina = 1) {
    const loadingEl = document.getElementById('admin-usuarios-loading');
    const tbody = document.getElementById('tabela-usuarios-body');
    if (loadingEl) loadingEl.style.display = 'block';

    const busca = (document.getElementById('filtroAdminBusca')?.value || '').trim();
    const setor = (document.getElementById('filtroAdminSetor')?.value || '').trim();
    const funcao = (document.getElementById('filtroAdminFuncao')?.value || '').trim();
    const role = (document.getElementById('filtroAdminRole')?.value || '').trim();
    const status = (document.getElementById('filtroAdminStatus')?.value || '').trim();
    const limit = parseInt(document.getElementById('admin-page-limit')?.value || 10, 10);

    const queryParams = new URLSearchParams({
        page: pagina,
        limit: limit,
        search: busca,
        setor: setor,
        funcao: funcao,
        role: role,
        status: status
    });

    try {
        const res = await adminFetch(`/admin/users?${queryParams.toString()}`);
        if (!res || res.status !== 'success') return;

        adminUsuariosCache = res.data || [];
        adminPaginacaoAtual = res.pagination || { page: pagina, limit: limit, total: 0, totalPages: 1 };

        renderizarTabelaUsuarios(adminUsuariosCache);
        renderizarPaginacaoUsuarios(adminPaginacaoAtual);
    } catch (err) {
        console.error('❌ Erro ao listar usuários:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 25px; color: #ef4444;">Erro ao carregar usuários: ${err.message}</td></tr>`;
        }
    } finally {
        if (loadingEl) loadingEl.style.display = 'none';
    }
}

function renderizarTabelaUsuarios(usuarios) {
    const tbody = document.getElementById('tabela-usuarios-body');
    const contadorEl = document.getElementById('admin-contador-usuarios');
    if (!tbody) return;

    if (contadorEl) {
        contadorEl.innerText = `Total: ${adminPaginacaoAtual.total} usuário(s) encontrado(s).`;
    }

    if (!usuarios || usuarios.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 35px; color: #888;">Nenhum usuário corresponde aos filtros aplicados.</td></tr>`;
        return;
    }

    let html = '';
    usuarios.forEach(u => {
        const iniciais = (u.nome_completo || u.username || 'U')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(p => p[0].toUpperCase())
            .join('');

        // Badges estéticos por role
        let badgeRole = '';
        if (u.role === 'admin') {
            badgeRole = `<span class="badge-role badge-role-admin"><i class="ci ci-shield"></i> Admin</span>`;
        } else if (u.role === 'revisor') {
            badgeRole = `<span class="badge-role badge-role-revisor"><i class="ci ci-folder-check"></i> Revisor</span>`;
        } else if (u.role === 'tecnico') {
            badgeRole = `<span class="badge-role badge-role-tecnico"><i class="ci ci-pen"></i> Técnico</span>`;
        } else {
            badgeRole = `<span class="badge-role badge-role-user"><i class="ci ci-user"></i> Usuário</span>`;
        }

        // Badges estéticos por setor
        let setorClass = 'badge-setor-default';
        if (u.setor === 'DIFLOR') setorClass = 'badge-setor-diflor';
        if (u.setor === 'GCAR') setorClass = 'badge-setor-gcar';
        if (u.setor === 'GEAA') setorClass = 'badge-setor-geaa';
        if (u.setor === 'GEAMB') setorClass = 'badge-setor-geamb';
        const badgeSetor = `<span class="badge-setor ${setorClass}">${escapeHtml(u.setor || '-')}</span>`;

        // Status
        const isAtivo = u.status === 'ativo';
        const badgeStatus = isAtivo
            ? `<span class="badge-status-pill badge-status-ativo"><span class="status-dot green"></span> Ativo</span>`
            : `<span class="badge-status-pill badge-status-inativo"><span class="status-dot red"></span> Inativo</span>`;

        const ultimoAcessoStr = u.ultimo_acesso ? formatarDataHoraLog(u.ultimo_acesso) : '<span style="color:#64748b;">Nunca acessou</span>';

        html += `
            <tr data-user-id="${u.id}">
                <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="user-avatar-initials">${iniciais}</span>
                        <div>
                            <div style="font-weight: 700; color: #f8fafc;">${escapeHtml(u.username)}</div>
                            <small style="color: #64748b;">ID #${u.id}</small>
                        </div>
                    </div>
                </td>
                <td style="font-weight: 600; color: #cbd5e1;">${escapeHtml(u.nome_completo || '-')}</td>
                <td>${badgeSetor}</td>
                <td style="color: #94a3b8; font-size: 12.5px;">${escapeHtml(u.funcao || '-')}</td>
                <td>${badgeRole}</td>
                <td>${badgeStatus}</td>
                <td style="font-size: 11.5px; white-space: nowrap;">${ultimoAcessoStr}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <button class="btn-action-icon btn-edit" title="Editar dados e transferir setor" onclick="abrirModalEditarUsuario(${u.id})">
                            <i class="ci ci-pen"></i>
                        </button>
                        <button class="btn-action-icon btn-key" title="Redefinir senha de acesso" onclick="abrirModalResetSenha(${u.id}, '${escapeHtml(u.username)}')">
                            <i class="ci ci-lock"></i>
                        </button>
                        <button class="btn-action-icon ${isAtivo ? 'btn-toggle-deactivate' : 'btn-toggle-activate'}" 
                                title="${isAtivo ? 'Desativar usuário' : 'Ativar usuário'}" 
                                onclick="alternarStatusUsuario(${u.id}, '${u.status}')">
                            <i class="ci ${isAtivo ? 'ci-close' : 'ci-check'}"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function renderizarPaginacaoUsuarios(p) {
    const container = document.getElementById('admin-pagination-container');
    if (!container) return;

    const start = p.total === 0 ? 0 : (p.page - 1) * p.limit + 1;
    const end = Math.min(p.page * p.limit, p.total);

    container.innerHTML = `
        <div style="font-size: 13px; color: #94a3b8;">
            Exibindo <strong>${start} - ${end}</strong> de <strong>${p.total}</strong> usuários
        </div>
        <div class="pagination-buttons" style="display: flex; gap: 8px; align-items: center;">
            <button class="page-btn" ${p.page <= 1 ? 'disabled' : ''} onclick="carregarUsuariosAdmin(${p.page - 1})">
                <i class="ci ci-arrow-left"></i> Anterior
            </button>
            <span style="font-size: 13px; color: #cbd5e1; padding: 0 8px;">
                Página <strong>${p.page}</strong> de <strong>${p.totalPages}</strong>
            </span>
            <button class="page-btn" ${p.page >= p.totalPages ? 'disabled' : ''} onclick="carregarUsuariosAdmin(${p.page + 1})">
                Próxima <i class="ci ci-arrow-right"></i>
            </button>
        </div>
    `;
}

function aplicarFiltrosAdminComDebounce() {
    clearTimeout(adminFiltroDebounceTimer);
    adminFiltroDebounceTimer = setTimeout(() => {
        carregarUsuariosAdmin(1);
    }, 250);
}

function limparFiltrosAdmin() {
    const ids = ['filtroAdminBusca', 'filtroAdminSetor', 'filtroAdminFuncao', 'filtroAdminRole', 'filtroAdminStatus'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    carregarUsuariosAdmin(1);
}

// ============================================================================
// 3. MODAL: CRIAÇÃO DE USUÁRIO (POST /admin/users)
// ============================================================================

function abrirModalNovoUsuario() {
    const form = document.getElementById('formNovoUsuario');
    if (form) form.reset();

    // Gera uma senha inicial aleatória segura como sugestão
    gerarSenhaAleatoriaNovo();

    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.style.display = 'flex';
}

function fecharModalNovoUsuario() {
    const modal = document.getElementById('modalNovoUsuario');
    if (modal) modal.style.display = 'none';
}

function gerarSenhaAleatoriaNovo() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('novoUserPassword');
    if (input) input.value = pwd;
}

function alternarVisibilidadeSenha(inputId, btnEl) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === 'password') {
        input.type = 'text';
        if (btnEl) btnEl.innerHTML = '<i class="ci ci-eye-off"></i>';
    } else {
        input.type = 'password';
        if (btnEl) btnEl.innerHTML = '<i class="ci ci-eye"></i>';
    }
}

async function salvarNovoUsuario(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSalvarNovoUsuario');
    const textoOriginal = btn ? btn.innerHTML : 'Salvar';

    const username = (document.getElementById('novoUserUsername')?.value || '').trim().toLowerCase();
    const nome_completo = (document.getElementById('novoUserNome')?.value || '').trim();
    const setor = (document.getElementById('novoUserSetor')?.value || '').trim();
    const funcao = (document.getElementById('novoUserFuncao')?.value || '').trim();
    const role = (document.getElementById('novoUserRole')?.value || '').trim();
    const password = (document.getElementById('novoUserPassword')?.value || '').trim();
    const status = (document.getElementById('novoUserStatus')?.value || 'ativo').trim();

    if (!username || !nome_completo || !setor || !funcao || !role) {
        mostrarToast('Por favor, preencha todos os campos obrigatórios (*).', 'error');
        return;
    }

    try {
        if (btn) {
            btn.innerHTML = '⏳ Criando usuário...';
            btn.disabled = true;
        }

        const payload = { username, nome_completo, setor, funcao, role, password, status };
        const res = await adminFetch('/admin/users', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        mostrarToast(`Usuário "${res.user.username}" cadastrado com sucesso!`, 'success');
        fecharModalNovoUsuario();

        // Recarrega lista e métricas
        await carregarPainelAdmin();

        // Se uma senha aleatória foi gerada, exibe modal de cópia
        if (res.temporaryPassword) {
            exibirAlertaCredenciaisCriadas(res.user.username, res.temporaryPassword);
        }
    } catch (err) {
        mostrarToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    }
}

function exibirAlertaCredenciaisCriadas(username, password) {
    const msg = `Usuário: ${username}\nSenha Inicial: ${password}\n\nCopie e envie estas credenciais de forma segura ao colaborador.`;
    navigator.clipboard?.writeText?.(msg);
    alert(`✅ Usuário criado com sucesso!\n\n${msg}\n(Os dados já foram copiados para sua área de transferência)`);
}

// ============================================================================
// 4. MODAL: EDIÇÃO DE USUÁRIO & TRANSFERÊNCIA (PATCH /admin/users/:id)
// ============================================================================

function abrirModalEditarUsuario(id) {
    const user = adminUsuariosCache.find(u => u.id === id);
    if (!user) {
        mostrarToast('Usuário não encontrado na lista atual.', 'error');
        return;
    }

    document.getElementById('editUserId').value = user.id;
    document.getElementById('editUserUsername').value = user.username;
    document.getElementById('editUserNome').value = user.nome_completo || '';
    document.getElementById('editUserSetor').value = user.setor || '';
    document.getElementById('editUserFuncao').value = user.funcao || '';
    document.getElementById('editUserRole').value = user.role || 'user';
    document.getElementById('editUserStatus').value = user.status || 'ativo';

    // Preenche o Banner de Resumo do Usuário
    const elInitials = document.getElementById('editUserAvatarInitials');
    if (elInitials) {
        const iniciais = (user.nome_completo || user.username || 'U')
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map(p => p[0].toUpperCase())
            .join('');
        elInitials.innerText = iniciais || 'U';
    }

    const elUsername = document.getElementById('editUserBadgeUsername');
    if (elUsername) elUsername.innerText = `@${user.username}`;

    const elId = document.getElementById('editUserBadgeId');
    if (elId) elId.innerText = `ID #${user.id}`;

    const elRole = document.getElementById('editUserBadgeRole');
    if (elRole) {
        elRole.className = `badge-role badge-role-${user.role || 'user'}`;
        elRole.innerHTML = `<i class="ci ci-shield"></i> ${(user.role || 'user').toUpperCase()}`;
    }

    const elSetor = document.getElementById('editUserBadgeSetor');
    if (elSetor) {
        let setorCls = 'badge-setor-default';
        if (user.setor === 'DIFLOR') setorCls = 'badge-setor-diflor';
        if (user.setor === 'GCAR') setorCls = 'badge-setor-gcar';
        if (user.setor === 'GEAA') setorCls = 'badge-setor-geaa';
        if (user.setor === 'GEAMB') setorCls = 'badge-setor-geamb';
        elSetor.className = `badge-setor ${setorCls}`;
        elSetor.innerText = user.setor || '-';
    }

    const modal = document.getElementById('modalEditarUsuario');
    if (modal) modal.style.display = 'flex';
}

function fecharModalEditarUsuario() {
    const modal = document.getElementById('modalEditarUsuario');
    if (modal) modal.style.display = 'none';
}

async function salvarEdicaoUsuario(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSalvarEdicaoUsuario');
    const textoOriginal = btn ? btn.innerHTML : 'Salvar Alterações';

    const id = document.getElementById('editUserId')?.value;
    const nome_completo = document.getElementById('editUserNome')?.value.trim();
    const setor = document.getElementById('editUserSetor')?.value.trim();
    const funcao = document.getElementById('editUserFuncao')?.value.trim();
    const role = document.getElementById('editUserRole')?.value.trim();
    const status = document.getElementById('editUserStatus')?.value.trim();

    if (!nome_completo || !setor || !funcao || !role) {
        mostrarToast('Por favor, preencha todos os campos obrigatórios (*).', 'error');
        return;
    }

    try {
        if (btn) {
            btn.innerHTML = '⏳ Salvando alterações...';
            btn.disabled = true;
        }

        const payload = { nome_completo, setor, funcao, role, status };
        await adminFetch(`/admin/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });

        mostrarToast('Dados cadastrais atualizados com sucesso!', 'success');
        fecharModalEditarUsuario();
        await carregarPainelAdmin();
    } catch (err) {
        mostrarToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    }
}

// ============================================================================
// 5. MODAL: REDEFINIÇÃO DE SENHA (POST /admin/users/:id/reset-password)
// ============================================================================

function abrirModalResetSenha(id, username) {
    document.getElementById('resetUserId').value = id;
    document.getElementById('resetUserUsernameDisplay').innerText = username;
    
    // Sugere nova senha aleatória
    gerarSenhaAleatoriaReset();

    const modal = document.getElementById('modalResetSenha');
    if (modal) modal.style.display = 'flex';
}

function fecharModalResetSenha() {
    const modal = document.getElementById('modalResetSenha');
    if (modal) modal.style.display = 'none';
}

function gerarSenhaAleatoriaReset() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('resetNewPassword');
    if (input) input.value = pwd;
}

function copiarSenhaReset() {
    const input = document.getElementById('resetNewPassword');
    if (input && input.value) {
        navigator.clipboard?.writeText?.(input.value);
        mostrarToast('Nova senha copiada para a área de transferência!', 'success');
    }
}

async function executarResetSenha(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnExecutarResetSenha');
    const textoOriginal = btn ? btn.innerHTML : 'Confirmar Redefinição';

    const id = document.getElementById('resetUserId')?.value;
    const new_password = (document.getElementById('resetNewPassword')?.value || '').trim();

    if (!new_password || new_password.length < 4) {
        mostrarToast('A nova senha deve possuir no mínimo 4 caracteres.', 'error');
        return;
    }

    try {
        if (btn) {
            btn.innerHTML = '⏳ Redefinindo senha...';
            btn.disabled = true;
        }

        const res = await adminFetch(`/admin/users/${id}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ new_password })
        });

        copiarSenhaReset();
        alert(`✅ Senha redefinida com sucesso!\n\nUsuário: ${res.username}\nNova Senha: ${res.temporaryPassword}\n\nA senha foi copiada para sua área de transferência.`);
        fecharModalResetSenha();
    } catch (err) {
        mostrarToast(err.message, 'error');
    } finally {
        if (btn) {
            btn.innerHTML = textoOriginal;
            btn.disabled = false;
        }
    }
}

// ============================================================================
// 6. AÇÃO RÁPIDA: ATIVAR / DESATIVAR USUÁRIO
// ============================================================================

async function alternarStatusUsuario(id, statusAtual) {
    const user = adminUsuariosCache.find(u => u.id === id);
    const novoStatus = (statusAtual === 'ativo') ? 'inativo' : 'ativo';
    const acaoTexto = novoStatus === 'ativo' ? 'ativar' : 'desativar';

    if (!confirm(`Deseja realmente ${acaoTexto} o acesso do usuário "${user?.username || id}"?`)) {
        return;
    }

    try {
        await adminFetch(`/admin/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: novoStatus })
        });

        mostrarToast(`Usuário ${novoStatus === 'ativo' ? 'ativado' : 'desativado'} com sucesso!`, 'success');
        await carregarPainelAdmin();
    } catch (err) {
        mostrarToast(err.message, 'error');
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
