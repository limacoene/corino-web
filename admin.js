/**
 * C.O.R.I.N.O. - Módulo Administrativo: Gestão de Usuários & Métricas de Acesso
 * Controlador Frontend para consumo da API REST administrativa
 */

let adminUsuariosCache = [];
let adminPaginacaoAtual = { page: 1, limit: 10, total: 0, totalPages: 1 };
let adminFiltroDebounceTimer = null;

function obterAuthToken() {
    return sessionStorage.getItem('corino_auth_token') || localStorage.getItem('corino_auth_token') || '';
}

/**
 * Wrapper de requisições autenticadas para a API administrativa
 */
async function adminFetch(url, options = {}) {
    const token = obterAuthToken();
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-corino-token': token,
        ...(options.headers || {})
    };

    try {
        const response = await fetch(url, { ...options, headers });
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
        throw err;
    }
}

// ============================================================================
// CARREGAMENTO PRINCIPAL DO PAINEL
// ============================================================================

async function carregarPainelAdmin() {
    try {
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
