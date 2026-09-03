/**
 * C.O.R.I.N.O. - Módulo de Banco de Dados Relacional & Segurança
 * Utiliza o SQLite nativo do Node.js (node:sqlite) e criptografia nativa (node:crypto).
 */

const { DatabaseSync } = require('node:sqlite');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, 'corino.db');
const db = new DatabaseSync(DB_PATH);

// Habilita chaves estrangeiras e modo WAL para alta concorrência
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA journal_mode = WAL;');

// ============================================================================
// CRIPTOGRAFIA DE SENHAS (OWASP SCRYPT + TIMING-SAFE EQUAL)
// ============================================================================

function generateSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password, salt, storedHash) {
    try {
        const hash = crypto.scryptSync(password, salt, 64).toString('hex');
        const hashBuf = Buffer.from(hash, 'hex');
        const storedBuf = Buffer.from(storedHash, 'hex');
        if (hashBuf.length !== storedBuf.length) return false;
        return crypto.timingSafeEqual(hashBuf, storedBuf);
    } catch (e) {
        return false;
    }
}

function generateRandomPassword(length = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = crypto.randomBytes(length);
    let pwd = '';
    for (let i = 0; i < length; i++) {
        pwd += chars[bytes[i] % chars.length];
    }
    return pwd;
}

// ============================================================================
// SISTEMA DE MIGRAÇÕES & SCHEMA
// ============================================================================

function executarMigracoes() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER UNIQUE NOT NULL,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const migracoes = [
        {
            version: 1,
            name: 'initial_schema_users_login_logs_sessions',
            run: () => {
                db.exec(`
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                        password_hash TEXT NOT NULL,
                        salt TEXT NOT NULL,
                        nome_completo TEXT NOT NULL,
                        setor TEXT NOT NULL,
                        funcao TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'user',
                        status TEXT NOT NULL DEFAULT 'ativo',
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS login_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                        username_attempted TEXT NOT NULL,
                        ip_address TEXT NOT NULL,
                        user_agent TEXT,
                        status TEXT NOT NULL,
                        failure_reason TEXT,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS sessions (
                        token TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        expires_at DATETIME NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
                    CREATE INDEX IF NOT EXISTS idx_users_setor ON users(setor);
                    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
                    CREATE INDEX IF NOT EXISTS idx_login_logs_timestamp ON login_logs(timestamp);
                    CREATE INDEX IF NOT EXISTS idx_login_logs_status ON login_logs(status);
                    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
                    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
                `);
            }
        },
        {
            version: 2,
            name: 'add_nome_planilha_to_users',
            run: () => {
                db.exec(`
                    ALTER TABLE users ADD COLUMN nome_planilha TEXT;
                `);

                const MAPA_NOMES_PLANILHA = {
                    "diflor": "DIRETORIA FLORESTAL",
                    "geamb": "GERÊNCIA DE ASSUNTOS AMBIENTAIS",
                    "gcar": "GCAR",
                    "geaa": "GEAA",
                    "asantos": "ADRIANA",
                    "anogueira": "ALCEBIADES",
                    "adpaula": "ALEXANDRE",
                    "acanjos": "ALLAN",
                    "aoliveira": "ANDERSON",
                    "bbrito": "BARBARA",
                    "bcarneiro": "BEATRIZ",
                    "ccaroline": "CARLA",
                    "cfonseca": "CARLOS JULIANO",
                    "ccarvalho": "CORINA",
                    "cbarauna": "CRISTIANE",
                    "dmartins": "DIANESSA",
                    "dmara": "DINA",
                    "erafael": "ELERI",
                    "erocha": "ERLISSON",
                    "emesquita": "ETEVALDO",
                    "fvasconcellos": "FABIANA",
                    "fgortega": "FRANCIELLY",
                    "ggimenes": "GABRIELA",
                    "hcrodrigues": "HELEN CAROLINE",
                    "hgomes": "HELLEN",
                    "hconcone": "HENRIQUE",
                    "hbrufao": "HERUS",
                    "hsilva": "HILBATY",
                    "jpierre": "JEAN PIERRE",
                    "jcoene": "JHONATAN",
                    "jhonatan": "JHONATAN",
                    "jribeiro": "JOELTHON",
                    "jguimaraes": "JONIEL",
                    "jcampos": "JOSÉ RENATO",
                    "lpires": "LARISSA",
                    "ldias": "LIVYA",
                    "lricardo": "LUCIANO",
                    "lteixeira": "LUIZ",
                    "mgarcia": "MARIA",
                    "mshinzato": "MARIANA SH",
                    "marianaopp": "MARIANA OPP",
                    "msander": "MAX SANDER",
                    "maguirre": "MICHAEL",
                    "mandressa": "MILKA",
                    "nmendonça": "NATTANA",
                    "nmendonca": "NATTANA",
                    "osantos": "OSVALDO",
                    "rgarcia": "RHOANDER",
                    "rcosta": "RODRIGO",
                    "snagel": "SUZIELLY"
                };

                const stmtUpdate = db.prepare('UPDATE users SET nome_planilha = ? WHERE username = ?');
                for (const [uname, nPlanilha] of Object.entries(MAPA_NOMES_PLANILHA)) {
                    stmtUpdate.run(nPlanilha, uname);
                }

                // Fallback para qualquer outro usuário: primeiro nome em maiúsculas
                db.exec(`
                    UPDATE users
                    SET nome_planilha = UPPER(SUBSTR(nome_completo, 1, INSTR(nome_completo || ' ', ' ') - 1))
                    WHERE nome_planilha IS NULL OR nome_planilha = '';
                `);
            }
        }
    ];

    const stmtCheck = db.prepare('SELECT version FROM migrations WHERE version = ?');
    const stmtInsert = db.prepare('INSERT INTO migrations (version, name) VALUES (?, ?)');

    for (const m of migracoes) {
        const row = stmtCheck.get(m.version);
        if (!row) {
            console.log(`🚀 [DB Migration] Aplicando migração v${m.version}: ${m.name}`);
            m.run();
            stmtInsert.run(m.version, m.name);
        }
    }
}

// ============================================================================
// CARGA INICIAL DE USUÁRIOS (SEEDING AUTOMÁTICO)
// ============================================================================

const SEED_USERS = [
    // Contas de Administração
    { username: "diflor", senha: "gonçaloalves", nome_completo: "DIRETORIA FLORESTAL", setor: "DIFLOR", funcao: "Diretoria Florestal", role: "admin" },
    { username: "jcoene", senha: "jlima", nome_completo: "Jhonatan Coene", setor: "DIFLOR", funcao: "Administrador de Sistemas", role: "admin" },
    { username: "jhonatan", senha: "dev1", nome_completo: "Jhonatan Lima (Dev)", setor: "DIFLOR", funcao: "Desenvolvedor Full Stack", role: "admin" },
    
    // Gerências / Revisores
    { username: "geamb", senha: "usop1", nome_completo: "Gerência de Assuntos Ambientais", setor: "GEAMB", funcao: "Gerente Revisor", role: "revisor" },
    { username: "gcar", senha: "gcar1281", nome_completo: "Gerência de Cadastro Ambiental Rural", setor: "GCAR", funcao: "Gerente Revisor", role: "revisor" },
    { username: "geaa", senha: "geaa2026", nome_completo: "Gerência de Autorizações Ambientais", setor: "GEAA", funcao: "Gerente Revisor", role: "revisor" },
    { username: "erocha", senha: "esouza", nome_completo: "Erlisson Rocha", setor: "GCAR", funcao: "Revisor Técnico", role: "revisor" },
    { username: "jcampos", senha: "jazedias", nome_completo: "José Renato Campos", setor: "GEAA", funcao: "Revisor Técnico", role: "revisor" },
    { username: "lteixeira", senha: "lcarlos", nome_completo: "Luiz Teixeira", setor: "GEAA", funcao: "Revisor Técnico", role: "revisor" },

    // Equipe Administrativa
    { username: "anogueira", senha: "acunha", nome_completo: "Alcebíades Nogueira", setor: "GEAA", funcao: "Assistente Administrativo", role: "user" },
    { username: "ccarvalho", senha: "corinad", nome_completo: "Corina Carvalho", setor: "GEAA", funcao: "Assistente Administrativa", role: "user" },
    { username: "ggimenes", senha: "rcouto", nome_completo: "Gabriela Gimenes", setor: "GCAR", funcao: "Assistente Administrativa", role: "user" },
    { username: "ldias", senha: "lcosta", nome_completo: "Lívya Dias", setor: "DIFLOR", funcao: "Assistente Administrativa", role: "user" },
    { username: "nmendonca", senha: "nnunes", nome_completo: "Nattana Mendonça", setor: "GCAR", funcao: "Assistente Administrativa", role: "user" },
    { username: "osantos", senha: "oantonio", nome_completo: "Osvaldo Santos", setor: "DIFLOR", funcao: "Assistente Administrativo", role: "user" },

    // Equipe Técnica / Analistas
    { username: "asantos", senha: "abilar", nome_completo: "Adriana Santos", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "adpaula", senha: "adivino", nome_completo: "Alexandre de Paula", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "acanjos", senha: "101215", nome_completo: "Allan dos Anjos", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "aoliveira", senha: "atavares", nome_completo: "Anderson Oliveira", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "bbrito", senha: "balmeida", nome_completo: "Bárbara Brito", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "bcarneiro", senha: "boliveira", nome_completo: "Beatriz Carneiro", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "ccaroline", senha: "carlant", nome_completo: "Carla Caroline", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "cfonseca", senha: "csilva", nome_completo: "Carlos Juliano Fonseca", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "cbarauna", senha: "coliveira", nome_completo: "Cristiane Baraúna", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "dmartins", senha: "dtiago", nome_completo: "Dianessa Martins", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "dmara", senha: "dfigueiredo", nome_completo: "Dina Mara", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "erafael", senha: "epaulino", nome_completo: "Eleri Rafael", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "emesquita", senha: "mesquita13", nome_completo: "Etevaldo Mesquita", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "fvasconcellos", senha: "fananias", nome_completo: "Fabiana Vasconcellos", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "fgortega", senha: "fgama", nome_completo: "Francielly Ortega", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "hcrodrigues", senha: "hcorrea", nome_completo: "Helen Caroline Rodrigues", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "hgomes", senha: "hpelissaro", nome_completo: "Hellen Gomes", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "hconcone", senha: "villasboas", nome_completo: "Henrique Concone", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "hbrufao", senha: "hravaza", nome_completo: "Herus Brufão", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "hsilva", senha: "hrodrigues", nome_completo: "Hilbaty Silva", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "jpierre", senha: "jcosta", nome_completo: "Jean Pierre", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "jribeiro", senha: "jferreira", nome_completo: "Joelthon Ribeiro", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "jguimaraes", senha: "jrocha", nome_completo: "Joniel Guimarães", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "lpires", senha: "lcarmo", nome_completo: "Larissa Pires", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "lricardo", senha: "loliveira", nome_completo: "Luciano Ricardo", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "mgarcia", senha: "mcorona", nome_completo: "Maria Garcia", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "mshinzato", senha: "muemura", nome_completo: "Mariana Shinzato", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "marianaopp", senha: "marianaopp", nome_completo: "Mariana Opp", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "msander", senha: "mmacedo", nome_completo: "Max Sander", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "maguirre", senha: "mpereira", nome_completo: "Michael Aguirre", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "mandressa", senha: "mbrito", nome_completo: "Milka Andressa", setor: "GCAR", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "rgarcia", senha: "rfreitas", nome_completo: "Rhoander Garcia", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "rcosta", senha: "mutumdev", nome_completo: "Rodrigo Costa", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" },
    { username: "snagel", senha: "ssilva", nome_completo: "Suzielly Nagel", setor: "GEAA", funcao: "Analista Ambiental / Técnico", role: "tecnico" }
];

function executarSeedUsuarios() {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (totalUsers === 0) {
        console.log('🌱 [DB Seed] Populando tabela users com usuários iniciais...');
        const stmtInsert = db.prepare(`
            INSERT INTO users (username, password_hash, salt, nome_completo, setor, funcao, role, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'ativo')
        `);

        for (const u of SEED_USERS) {
            const salt = generateSalt();
            const hash = hashPassword(u.senha, salt);
            stmtInsert.run(u.username, hash, salt, u.nome_completo, u.setor, u.funcao, u.role);
        }
        console.log(`✅ [DB Seed] ${SEED_USERS.length} usuários cadastrados com sucesso!`);
    }
}

// Inicializa banco de dados e migrações
executarMigracoes();
executarSeedUsuarios();

// ============================================================================
// REPOSITÓRIO: GESTÃO DE SESSÕES & AUTENTICAÇÃO
// ============================================================================

function registrarLogLogin(userId, username, ip, userAgent, status, failureReason = null) {
    try {
        const stmt = db.prepare(`
            INSERT INTO login_logs (user_id, username_attempted, ip_address, user_agent, status, failure_reason)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run(userId || null, username || 'desconhecido', ip || '127.0.0.1', userAgent || '', status, failureReason);
    } catch (err) {
        console.error('❌ Erro ao registrar login_logs:', err.message);
    }
}

function autenticarUsuario(username, password, ip, userAgent) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    if (!cleanUser || !cleanPass) {
        registrarLogLogin(null, cleanUser, ip, userAgent, 'FAILED', 'Campos de login obrigatórios em branco');
        return { success: false, status: 400, message: 'Usuário e senha são obrigatórios.' };
    }

    const stmt = db.prepare(`
        SELECT id, username, password_hash, salt, nome_completo, nome_planilha, setor, funcao, role, status
        FROM users
        WHERE username = ?
    `);
    const user = stmt.get(cleanUser);

    if (!user) {
        registrarLogLogin(null, cleanUser, ip, userAgent, 'FAILED', 'Usuário não cadastrado');
        return { success: false, status: 401, message: 'Usuário ou senha incorretos.' };
    }

    if (user.status !== 'ativo') {
        registrarLogLogin(user.id, cleanUser, ip, userAgent, 'FAILED', 'Conta desativada pelo administrador');
        return { success: false, status: 403, message: 'Esta conta de usuário está desativada. Consulte a administração.' };
    }

    const isValid = verifyPassword(cleanPass, user.salt, user.password_hash);
    if (!isValid) {
        registrarLogLogin(user.id, cleanUser, ip, userAgent, 'FAILED', 'Senha incorreta');
        return { success: false, status: 401, message: 'Usuário ou senha incorretos.' };
    }

    // Sucesso na autenticação
    registrarLogLogin(user.id, cleanUser, ip, userAgent, 'SUCCESS', null);

    // Cria token de sessão válido por 12 horas
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    db.prepare(`
        INSERT INTO sessions (token, user_id, expires_at)
        VALUES (?, ?, ?)
    `).run(token, user.id, expiresAt);

    return {
        success: true,
        token: token,
        user: {
            id: user.id,
            username: user.username,
            nomeCompleto: user.nome_completo,
            nomePlanilha: user.nome_planilha || user.nome_completo,
            setor: user.setor,
            funcao: user.funcao,
            role: user.role,
            perfil: (user.role === 'admin') ? 'administrativo' : user.role
        }
    };
}

function validarSessao(token) {
    if (!token) return null;
    const stmt = db.prepare(`
        SELECT s.token, s.expires_at, u.id, u.username, u.nome_completo, u.nome_planilha, u.setor, u.funcao, u.role, u.status
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.token = ?
    `);
    const session = stmt.get(token);

    if (!session) return null;
    if (new Date(session.expires_at).getTime() < Date.now()) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
        return null;
    }
    if (session.status !== 'ativo') return null;

    return {
        id: session.id,
        username: session.username,
        nomeCompleto: session.nome_completo,
        nomePlanilha: session.nome_planilha || session.nome_completo,
        setor: session.setor,
        funcao: session.funcao,
        role: session.role,
        perfil: (session.role === 'admin') ? 'administrativo' : session.role
    };
}

// ============================================================================
// REPOSITÓRIO: MÉTRICAS DE ACESSO (GET /admin/metrics/logins)
// ============================================================================

function obterMetricasLogins() {
    // 1. Contagens agregadas
    const totalLogins = db.prepare('SELECT COUNT(*) as count FROM login_logs').get().count;
    const successfulLogins = db.prepare("SELECT COUNT(*) as count FROM login_logs WHERE status = 'SUCCESS'").get().count;
    const failedLogins = db.prepare("SELECT COUNT(*) as count FROM login_logs WHERE status = 'FAILED'").get().count;
    const activeUsersCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'ativo'").get().count;

    // Logins nas últimas 24 horas
    const logins24h = db.prepare(`
        SELECT COUNT(*) as count 
        FROM login_logs 
        WHERE timestamp >= datetime('now', '-24 hours')
    `).get().count;

    // 2. Falhas recentes de acesso (últimas 15)
    const recentFailures = db.prepare(`
        SELECT id, username_attempted, ip_address, failure_reason, timestamp
        FROM login_logs
        WHERE status = 'FAILED'
        ORDER BY timestamp DESC
        LIMIT 15
    `).all();

    // 3. Histórico geral recente de tentativas (últimas 25)
    const recentActivity = db.prepare(`
        SELECT l.id, l.username_attempted, l.ip_address, l.status, l.failure_reason, l.timestamp,
               u.nome_completo, u.setor, u.role
        FROM login_logs l
        LEFT JOIN users u ON l.user_id = u.id
        ORDER BY l.timestamp DESC
        LIMIT 25
    `).all();

    return {
        metrics: {
            totalLogins,
            successfulLogins,
            failedLogins,
            activeUsersCount,
            logins24h
        },
        recentFailures,
        recentActivity
    };
}

// ============================================================================
// REPOSITÓRIO: GESTÃO DE USUÁRIOS (CRUD & PAGINAÇÃO)
// ============================================================================

function listarUsuariosPaginados({ page = 1, limit = 10, setor, funcao, role, status, search }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let params = [];

    if (setor && setor.trim() !== '') {
        whereClauses.push('u.setor = ?');
        params.push(setor.trim());
    }

    if (funcao && funcao.trim() !== '') {
        whereClauses.push('u.funcao LIKE ?');
        params.push(`%${funcao.trim()}%`);
    }

    if (role && role.trim() !== '') {
        whereClauses.push('u.role = ?');
        params.push(role.trim());
    }

    if (status && status.trim() !== '') {
        whereClauses.push('u.status = ?');
        params.push(status.trim().toLowerCase());
    }

    if (search && search.trim() !== '') {
        const s = `%${search.trim()}%`;
        whereClauses.push('(u.username LIKE ? OR u.nome_completo LIKE ?)');
        params.push(s, s);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Consulta do total de registros
    const countQuery = `SELECT COUNT(*) as total FROM users u ${whereSql}`;
    const total = db.prepare(countQuery).get(...params).total;

    // Consulta paginada dos usuários (com último acesso correlacionado)
    const selectQuery = `
        SELECT u.id, u.username, u.nome_completo, u.nome_planilha, u.setor, u.funcao, u.role, u.status, u.created_at, u.updated_at,
               (SELECT MAX(timestamp) FROM login_logs WHERE user_id = u.id AND status = 'SUCCESS') as ultimo_acesso
        FROM users u
        ${whereSql}
        ORDER BY u.id ASC
        LIMIT ? OFFSET ?
    `;

    const users = db.prepare(selectQuery).all(...params, limitNum, offset);

    return {
        data: users,
        pagination: {
            page: pageNum,
            limit: limitNum,
            total: total,
            totalPages: Math.ceil(total / limitNum) || 1
        }
    };
}

function criarUsuario({ username, nome_completo, nome_planilha, setor, funcao, role, password, status = 'ativo' }) {
    const cleanUser = String(username || '').trim().toLowerCase();
    const cleanNome = String(nome_completo || '').trim();
    const cleanNomePlanilha = String(nome_planilha || '').trim().toUpperCase() || cleanNome.split(' ')[0].toUpperCase();
    const cleanSetor = String(setor || '').trim().toUpperCase();
    const cleanFuncao = String(funcao || '').trim();
    const cleanRole = String(role || 'user').trim().toLowerCase();
    const cleanStatus = (status === 'inativo') ? 'inativo' : 'ativo';

    if (!cleanUser || cleanUser.length < 3) {
        throw new Error('Nome de usuário deve conter no mínimo 3 caracteres.');
    }
    if (!cleanNome) {
        throw new Error('Nome completo é obrigatório.');
    }
    if (!cleanSetor) {
        throw new Error('Setor é obrigatório.');
    }
    if (!cleanFuncao) {
        throw new Error('Função/Cargo é obrigatória.');
    }

    // Verifica se já existe
    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUser);
    if (exists) {
        throw new Error(`O usuário "${cleanUser}" já está cadastrado.`);
    }

    // Se a senha não foi informada, gera uma temporária segura
    let initialPassword = String(password || '').trim();
    let wasGenerated = false;
    if (!initialPassword) {
        initialPassword = generateRandomPassword(10);
        wasGenerated = true;
    } else if (initialPassword.length < 4) {
        throw new Error('A senha deve conter no mínimo 4 caracteres.');
    }

    const salt = generateSalt();
    const hash = hashPassword(initialPassword, salt);

    const stmt = db.prepare(`
        INSERT INTO users (username, password_hash, salt, nome_completo, nome_planilha, setor, funcao, role, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(cleanUser, hash, salt, cleanNome, cleanNomePlanilha, cleanSetor, cleanFuncao, cleanRole, cleanStatus);
    const newId = Number(result.lastInsertRowid);

    const newUser = db.prepare(`
        SELECT id, username, nome_completo, nome_planilha, setor, funcao, role, status, created_at
        FROM users WHERE id = ?
    `).get(newId);

    return {
        user: newUser,
        temporaryPassword: wasGenerated ? initialPassword : null
    };
}

function atualizarUsuario(id, { nome_completo, nome_planilha, setor, funcao, role, status }) {
    const userId = parseInt(id, 10);
    if (!userId) throw new Error('ID de usuário inválido.');

    const current = db.prepare('SELECT id, username, role, status FROM users WHERE id = ?').get(userId);
    if (!current) throw new Error('Usuário não encontrado.');

    // Prevenção: não permitir desativar ou rebaixar o único admin do sistema
    if (current.role === 'admin' && (role && role !== 'admin' || status === 'inativo')) {
        const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin' AND status = 'ativo'").get().count;
        if (adminCount <= 1) {
            throw new Error('Operação negada: o sistema precisa manter ao menos um administrador ativo.');
        }
    }

    let updates = [];
    let params = [];

    if (nome_completo !== undefined) {
        updates.push('nome_completo = ?');
        params.push(String(nome_completo).trim());
    }
    if (nome_planilha !== undefined) {
        updates.push('nome_planilha = ?');
        params.push(String(nome_planilha).trim().toUpperCase());
    }
    if (setor !== undefined) {
        updates.push('setor = ?');
        params.push(String(setor).trim().toUpperCase());
    }
    if (funcao !== undefined) {
        updates.push('funcao = ?');
        params.push(String(funcao).trim());
    }
    if (role !== undefined) {
        updates.push('role = ?');
        params.push(String(role).trim().toLowerCase());
    }
    if (status !== undefined) {
        const s = (status === 'inativo') ? 'inativo' : 'ativo';
        updates.push('status = ?');
        params.push(s);
        // Se desativado, encerra todas as sessões ativas do usuário
        if (s === 'inativo') {
            db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
        }
    }

    if (updates.length === 0) {
        throw new Error('Nenhum dado informado para atualização.');
    }

    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(userId);

    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(updateQuery).run(...params);

    return db.prepare(`
        SELECT id, username, nome_completo, nome_planilha, setor, funcao, role, status, updated_at
        FROM users WHERE id = ?
    `).get(userId);
}

function resetarSenhaUsuario(id, newPassword) {
    const userId = parseInt(id, 10);
    if (!userId) throw new Error('ID de usuário inválido.');

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(userId);
    if (!user) throw new Error('Usuário não encontrado.');

    let finalPassword = String(newPassword || '').trim();
    let wasGenerated = false;

    if (!finalPassword) {
        finalPassword = generateRandomPassword(10);
        wasGenerated = true;
    } else if (finalPassword.length < 4) {
        throw new Error('A nova senha deve conter no mínimo 4 caracteres.');
    }

    const salt = generateSalt();
    const hash = hashPassword(finalPassword, salt);

    db.prepare(`
        UPDATE users 
        SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(hash, salt, userId);

    // Invalida sessões existentes para forçar novo login com a nova senha
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

    return {
        username: user.username,
        temporaryPassword: finalPassword,
        wasGenerated
    };
}

module.exports = {
    db,
    hashPassword,
    verifyPassword,
    generateRandomPassword,
    autenticarUsuario,
    validarSessao,
    obterMetricasLogins,
    listarUsuariosPaginados,
    criarUsuario,
    atualizarUsuario,
    resetarSenhaUsuario
};
