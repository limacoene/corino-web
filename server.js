/**
 * C.O.R.I.N.O. - Servidor Web & API Google Cloud Storage (LGPD)
 * 
 * Este servidor:
 * 1. Serve a aplicação web local estática (HTML, CSS, JS, etc.)
 * 2. Provê endpoints seguros de API para geração de Signed URLs temporárias (GCS)
 * 3. Gerencia uploads seguros e privados para o Google Cloud Storage
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { Storage } = require('@google-cloud/storage');
const db = require('./db.js');

// Carrega configurações de gcs-config.json ou variáveis de ambiente
let config = {
    porta: process.env.PORT ? parseInt(process.env.PORT, 10) : 5502,
    bucketName: process.env.GCS_BUCKET_NAME || '',
    projectId: process.env.GCS_PROJECT_ID || '',
    keyFilename: process.env.GCS_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcs-key.json',
    urlExpirationMinutes: process.env.GCS_URL_EXPIRATION_MINUTES ? parseInt(process.env.GCS_URL_EXPIRATION_MINUTES, 10) : 15
};

const configPath = path.join(__dirname, 'gcs-config.json');
if (fs.existsSync(configPath)) {
    try {
        const configFile = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        config = { ...config, ...configFile };
    } catch (e) {
        console.warn('⚠️ Erro ao ler gcs-config.json:', e.message);
    }
}

// Inicializa cliente Google Cloud Storage
let storageClient = null;
let bucketInstance = null;

function inicializarGCS() {
    try {
        const storageOptions = {};
        if (config.projectId) {
            storageOptions.projectId = config.projectId;
        }

        // Se as credenciais foram passadas diretamente via variável de ambiente (Deploy em Nuvem)
        if (process.env.GCS_CREDENTIALS_JSON) {
            try {
                storageOptions.credentials = JSON.parse(process.env.GCS_CREDENTIALS_JSON);
                console.log('🔑 [GCS] Utilizando credenciais da variável de ambiente GCS_CREDENTIALS_JSON');
            } catch (e) {
                console.warn('⚠️ [GCS] Erro ao fazer parse de GCS_CREDENTIALS_JSON:', e.message);
            }
        }

        // Se o arquivo de chave existir no caminho especificado
        const resolvedKey = path.isAbsolute(config.keyFilename) 
            ? config.keyFilename 
            : path.join(__dirname, config.keyFilename);

        if (!storageOptions.credentials && fs.existsSync(resolvedKey)) {
            storageOptions.keyFilename = resolvedKey;
            console.log(`🔑 [GCS] Utilizando chave de credencial: ${resolvedKey}`);
        } else if (!storageOptions.credentials && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            console.log(`🔑 [GCS] Utilizando GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
        } else if (!storageOptions.credentials) {
            console.warn(`ℹ️ [GCS] Chave '${config.keyFilename}' não encontrada. Operando em modo de espera por credenciais.`);
        }

        storageClient = new Storage(storageOptions);
        if (config.bucketName) {
            bucketInstance = storageClient.bucket(config.bucketName);
            console.log(`📦 [GCS] Bucket configurado: ${config.bucketName}`);
        }
    } catch (err) {
        console.error('❌ [GCS] Falha na inicialização do cliente Storage:', err.message);
    }
}

inicializarGCS();

/**
 * Normaliza o caminho do objeto no GCS (remove prefixos desnecessários como gs://bucket/)
 */
function normalizarCaminhoGCS(caminho) {
    if (!caminho || typeof caminho !== 'string') return '';
    let limpo = caminho.trim();
    if (limpo.startsWith('gs://')) {
        limpo = limpo.substring(5);
        const primeiroSlash = limpo.indexOf('/');
        if (primeiroSlash !== -1) {
            limpo = limpo.substring(primeiroSlash + 1);
        }
    }
    if (limpo.startsWith('gcs:')) {
        limpo = limpo.substring(4);
    }
    return limpo.replace(/^\/+/, '');
}

const https = require('https');
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec';
global.gasCache = {};
let gasQueue = Promise.resolve();

function requestRawGas(payload) {
    const postData = JSON.stringify(payload);
    return new Promise((resolve, reject) => {
        function doRequest(targetUrl, isGet = false, postBody = null) {
            const options = {
                method: isGet ? 'GET' : 'POST'
            };
            if (!isGet && postBody) {
                options.headers = {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postBody)
                };
            }
            const req = https.request(targetUrl, options, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return doRequest(res.headers.location, true);
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed);
                    } catch (e) {
                        reject(new Error('Resposta inválida do Google Apps Script: ' + data.substring(0, 100)));
                    }
                });
            });
            req.on('error', reject);
            if (!isGet && postBody) req.write(postBody);
            req.end();
        }
        doRequest(GAS_URL, false, postData);
    });
}

async function requestGasComRetry(payload, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await requestRawGas(payload);
            if (res && res.status === 'error' && String(res.message).toLowerCase().includes('bloqueio')) {
                console.warn(`⚠️ [GAS Queue] Tentativa ${attempt} encontrou bloqueio no Apps Script. Aguardando 2s para retry...`);
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            return res;
        } catch (err) {
            if (attempt === maxRetries) throw err;
            console.warn(`⚠️ [GAS Queue] Erro de comunicação na tentativa ${attempt}. Retentando em 1.5s...`);
            await new Promise(r => setTimeout(r, 1500));
        }
    }
}

function fetchGasFromNode(payload) {
    const p = gasQueue.then(async () => {
        const res = await requestGasComRetry(payload);
        await new Promise(r => setTimeout(r, 250));
        return res;
    });
    gasQueue = p.catch(() => {});
    return p;
}

/**
 * MIME Types suportados para o servidor estático
 */
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.txt': 'text/plain; charset=utf-8'
};

/**
 * Helper para leitura do corpo da requisição JSON
 */
function parseRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Limite de 60MB para uploads base64 de PDFs grandes / Shapefiles
            if (body.length > 60 * 1024 * 1024) {
                reject(new Error('Payload Too Large'));
            }
        });
        req.on('end', () => {
            if (!body) return resolve({});
            try {
                const parsed = JSON.parse(body);
                resolve(parsed);
            } catch (err) {
                reject(new Error('Invalid JSON format'));
            }
        });
        req.on('error', err => reject(err));
    });
}

/**
 * Envia resposta JSON com cabeçalhos CORS
 */
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-corino-token',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify(data));
}

function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket ? req.socket.remoteAddress || '127.0.0.1' : '127.0.0.1';
}

function verificarAuthAdmin(req) {
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
    } else if (req.headers['x-corino-token']) {
        token = req.headers['x-corino-token'];
    }

    if (!token) {
        return { ok: false, status: 401, message: 'Autenticação necessária. Token não fornecido.' };
    }

    const sessionUser = db.validarSessao(token);
    if (!sessionUser) {
        return { ok: false, status: 401, message: 'Sessão expirada ou inválida. Por favor, realize novo login.' };
    }

    if (sessionUser.role !== 'admin') {
        return { ok: false, status: 403, message: 'Acesso negado: operação exclusiva para administradores.' };
    }

    return { ok: true, user: sessionUser };
}

/**
 * Servidor HTTP Principal
 */
const server = http.createServer(async (req, res) => {
    // Tratamento de CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-corino-token',
            'Access-Control-Max-Age': '86400'
        });
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // ==========================================
    // ROTAS DE AUTENTICAÇÃO & CONTROLE DE ACESSO
    // ==========================================

    // 1. Login com registro de métricas (login_logs)
    if ((pathname === '/api/auth/login' || pathname === '/auth/login') && req.method === 'POST') {
        try {
            const body = await parseRequestBody(req);
            const ip = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';
            const authResult = db.autenticarUsuario(body.username, body.password, ip, userAgent);
            if (!authResult.success) {
                return sendJson(res, authResult.status || 401, {
                    status: 'error',
                    message: authResult.message
                });
            }
            return sendJson(res, 200, {
                status: 'success',
                token: authResult.token,
                user: authResult.user
            });
        } catch (err) {
            console.error('❌ Erro no login:', err);
            return sendJson(res, 500, { status: 'error', message: 'Erro interno ao processar login.' });
        }
    }

    // 2. Perfil do Usuário Autenticado
    if ((pathname === '/api/auth/me' || pathname === '/auth/me') && req.method === 'GET') {
        let token = (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim() || req.headers['x-corino-token'];
        const sessionUser = db.validarSessao(token);
        if (!sessionUser) {
            return sendJson(res, 401, { status: 'error', message: 'Sessão inválida ou expirada.' });
        }
        return sendJson(res, 200, { status: 'success', user: sessionUser });
    }

    // ==========================================
    // MÓDULO ADMINISTRATIVO (EXCLUSIVO ADMIN)
    // ==========================================

    // 3. GET /admin/metrics/logins - Contagem e histórico de acessos
    if ((pathname === '/admin/metrics/logins' || pathname === '/api/admin/metrics/logins') && req.method === 'GET') {
        const auth = verificarAuthAdmin(req);
        if (!auth.ok) return sendJson(res, auth.status, { status: 'error', message: auth.message });
        try {
            const data = db.obterMetricasLogins();
            return sendJson(res, 200, { status: 'success', ...data });
        } catch (err) {
            console.error('❌ Erro ao obter métricas:', err);
            return sendJson(res, 500, { status: 'error', message: err.message });
        }
    }

    // 4. GET /admin/users - Listagem paginada de usuários com filtros
    if ((pathname === '/admin/users' || pathname === '/api/admin/users') && req.method === 'GET') {
        const auth = verificarAuthAdmin(req);
        if (!auth.ok) return sendJson(res, auth.status, { status: 'error', message: auth.message });
        try {
            const query = parsedUrl.query || {};
            const result = db.listarUsuariosPaginados({
                page: query.page,
                limit: query.limit,
                setor: query.setor,
                funcao: query.funcao,
                role: query.role,
                status: query.status,
                search: query.search
            });
            return sendJson(res, 200, { status: 'success', ...result });
        } catch (err) {
            console.error('❌ Erro ao listar usuários:', err);
            return sendJson(res, 500, { status: 'error', message: err.message });
        }
    }

    // 5. POST /admin/users - Criação de usuário com credenciais seguras
    if ((pathname === '/admin/users' || pathname === '/api/admin/users') && req.method === 'POST') {
        const auth = verificarAuthAdmin(req);
        if (!auth.ok) return sendJson(res, auth.status, { status: 'error', message: auth.message });
        try {
            const body = await parseRequestBody(req);
            const result = db.criarUsuario(body);
            return sendJson(res, 201, {
                status: 'success',
                message: 'Usuário criado com sucesso.',
                ...result
            });
        } catch (err) {
            console.error('❌ Erro ao criar usuário:', err.message);
            return sendJson(res, 400, { status: 'error', message: err.message });
        }
    }

    // 6. POST /admin/users/:id/reset-password - Redefinição administrativa de senha
    const matchReset = pathname.match(/^(?:\/api)?\/admin\/users\/(\d+)\/reset-password$/);
    if (matchReset && req.method === 'POST') {
        const auth = verificarAuthAdmin(req);
        if (!auth.ok) return sendJson(res, auth.status, { status: 'error', message: auth.message });
        try {
            const userId = matchReset[1];
            const body = await parseRequestBody(req);
            const result = db.resetarSenhaUsuario(userId, body.new_password);
            return sendJson(res, 200, {
                status: 'success',
                message: 'Senha redefinida com sucesso.',
                ...result
            });
        } catch (err) {
            console.error('❌ Erro ao redefinir senha:', err.message);
            return sendJson(res, 400, { status: 'error', message: err.message });
        }
    }

    // 7. PATCH /admin/users/:id - Edição cadastral, setor e função
    const matchPatch = pathname.match(/^(?:\/api)?\/admin\/users\/(\d+)$/);
    if (matchPatch && req.method === 'PATCH') {
        const auth = verificarAuthAdmin(req);
        if (!auth.ok) return sendJson(res, auth.status, { status: 'error', message: auth.message });
        try {
            const userId = matchPatch[1];
            const body = await parseRequestBody(req);
            const updated = db.atualizarUsuario(userId, body);
            return sendJson(res, 200, {
                status: 'success',
                message: 'Usuário atualizado com sucesso.',
                user: updated
            });
        } catch (err) {
            console.error('❌ Erro ao atualizar usuário:', err.message);
            return sendJson(res, 400, { status: 'error', message: err.message });
        }
    }

    // ==========================================
    // ROTAS DE API GOOGLE CLOUD STORAGE
    // ==========================================

    // 1. Status do GCS / Diagnóstico
    if (pathname === '/api/storage/status' && req.method === 'GET') {
        const hasKey = config.keyFilename && fs.existsSync(
            path.isAbsolute(config.keyFilename) ? config.keyFilename : path.join(__dirname, config.keyFilename)
        );
        return sendJson(res, 200, {
            status: 'success',
            configured: Boolean(config.bucketName && (hasKey || process.env.GOOGLE_APPLICATION_CREDENTIALS)),
            bucketName: config.bucketName || 'Não configurado',
            projectId: config.projectId || 'Não configurado',
            keyFileExists: Boolean(hasKey),
            defaultExpirationMinutes: config.urlExpirationMinutes,
            lgpdCompliance: {
                privateBucket: true,
                temporarySignedUrlsV4: true,
                maxUrlLifetimeMinutes: config.urlExpirationMinutes
            }
        });
    }

    // 2. Geração de URL Assinada de Leitura Temporária (Signed URL V4)
    if (pathname === '/api/storage/signed-url' && req.method === 'POST') {
        try {
            if (!bucketInstance) {
                return sendJson(res, 503, {
                    status: 'error',
                    message: 'Bucket Google Cloud Storage não configurado. Verifique o arquivo gcs-config.json.'
                });
            }

            const body = await parseRequestBody(req);
            const rawPath = body.gcsPath || body.path || body.filename;
            if (!rawPath) {
                return sendJson(res, 400, { status: 'error', message: 'Parâmetro "gcsPath" obrigatório.' });
            }

            const cleanPath = normalizarCaminhoGCS(rawPath);
            const minutos = body.expiresInMinutes || config.urlExpirationMinutes || 15;
            const expiresAtMs = Date.now() + minutos * 60 * 1000;

            const file = bucketInstance.file(cleanPath);

            const signOptions = {
                version: 'v4',
                action: 'read',
                expires: expiresAtMs
            };

            // Se for download forçado com nome amigável
            if (body.download) {
                const downloadName = body.filename || path.basename(cleanPath);
                signOptions.responseDisposition = `attachment; filename="${downloadName}"`;
            } else {
                signOptions.responseDisposition = 'inline';
            }

            const [signedUrl] = await file.getSignedUrl(signOptions);

            return sendJson(res, 200, {
                status: 'success',
                signedUrl: signedUrl,
                gcsPath: cleanPath,
                expiresAt: new Date(expiresAtMs).toISOString(),
                expiresInMinutes: minutos
            });
        } catch (err) {
            console.error('❌ [GCS] Erro ao gerar Signed URL:', err);
            return sendJson(res, 500, {
                status: 'error',
                message: 'Falha ao gerar link temporário: ' + err.message
            });
        }
    }

    // 3. Geração de URL Assinada de Upload Direto (Signed Upload URL)
    if (pathname === '/api/storage/upload-url' && req.method === 'POST') {
        try {
            if (!bucketInstance) {
                return sendJson(res, 503, {
                    status: 'error',
                    message: 'Bucket GCS não configurado.'
                });
            }

            const body = await parseRequestBody(req);
            const rawPath = body.gcsPath || body.path || body.filename;
            if (!rawPath) {
                return sendJson(res, 400, { status: 'error', message: 'Parâmetro "gcsPath" obrigatório.' });
            }

            const cleanPath = normalizarCaminhoGCS(rawPath);
            const contentType = body.contentType || 'application/pdf';
            const minutos = body.expiresInMinutes || 15;
            const expiresAtMs = Date.now() + minutos * 60 * 1000;

            const file = bucketInstance.file(cleanPath);

            const [uploadUrl] = await file.getSignedUrl({
                version: 'v4',
                action: 'write',
                expires: expiresAtMs,
                contentType: contentType
            });

            return sendJson(res, 200, {
                status: 'success',
                uploadUrl: uploadUrl,
                gcsPath: cleanPath,
                fullGcsUri: `gs://${config.bucketName}/${cleanPath}`,
                expiresAt: new Date(expiresAtMs).toISOString()
            });
        } catch (err) {
            console.error('❌ [GCS] Erro ao gerar Upload URL:', err);
            return sendJson(res, 500, { status: 'error', message: err.message });
        }
    }

    // 4. Upload Direto via Servidor (Base64 -> GCS)
    if (pathname === '/api/storage/upload' && req.method === 'POST') {
        try {
            if (!bucketInstance) {
                return sendJson(res, 503, {
                    status: 'error',
                    message: 'Bucket GCS não configurado.'
                });
            }

            const body = await parseRequestBody(req);
            const rawPath = body.gcsPath || body.path || body.filename;
            const base64Data = body.base64;

            if (!rawPath || !base64Data) {
                return sendJson(res, 400, {
                    status: 'error',
                    message: 'Parâmetros "gcsPath" e "base64" são obrigatórios.'
                });
            }

            const cleanPath = normalizarCaminhoGCS(rawPath);
            const buffer = Buffer.from(base64Data, 'base64');
            const file = bucketInstance.file(cleanPath);

            const contentType = body.contentType || (
                cleanPath.endsWith('.zip') ? 'application/zip' :
                cleanPath.endsWith('.png') ? 'image/png' :
                cleanPath.endsWith('.jpg') || cleanPath.endsWith('.jpeg') ? 'image/jpeg' :
                'application/pdf'
            );

            await file.save(buffer, {
                metadata: {
                    contentType: contentType,
                    metadata: {
                        uploadedBy: body.username || 'sistema',
                        uploadedAt: new Date().toISOString(),
                        nup: body.nup || ''
                    }
                },
                resumable: false
            });

            console.log(`✅ [GCS] Arquivo salvo com sucesso: ${cleanPath} (${buffer.length} bytes)`);

            return sendJson(res, 200, {
                status: 'success',
                gcsPath: cleanPath,
                fullGcsUri: `gs://${config.bucketName}/${cleanPath}`,
                size: buffer.length
            });
        } catch (err) {
            console.error('❌ [GCS] Erro no upload:', err);
            return sendJson(res, 500, { status: 'error', message: 'Erro no upload: ' + err.message });
        }
    }

    // 5. Exclusão de Arquivo no GCS
    if (pathname === '/api/storage/delete' && req.method === 'POST') {
        try {
            if (!bucketInstance) {
                return sendJson(res, 503, { status: 'error', message: 'Bucket GCS não configurado.' });
            }

            const body = await parseRequestBody(req);
            const cleanPath = normalizarCaminhoGCS(body.gcsPath || body.path);
            if (!cleanPath) {
                return sendJson(res, 400, { status: 'error', message: 'Parâmetro "gcsPath" obrigatório.' });
            }

            const file = bucketInstance.file(cleanPath);
            const [exists] = await file.exists();
            if (exists) {
                await file.delete();
                console.log(`🗑️ [GCS] Arquivo excluído: ${cleanPath}`);
            }

            return sendJson(res, 200, { status: 'success', message: 'Arquivo excluído com sucesso.' });
        } catch (err) {
            console.error('❌ [GCS] Erro ao excluir:', err);
            return sendJson(res, 500, { status: 'error', message: err.message });
        }
    }

        // ==========================================
    // 5. Proxy Central de Dados (Google Apps Script com Cache em Memória)
    // ==========================================
    if (pathname === '/api/dados-central' && (req.method === 'GET' || req.method === 'POST')) {
        let payload = { acao: parsedUrl.query.acao || 'buscar_dados' };
        if (req.method === 'POST') {
            try {
                const b = await parseRequestBody(req);
                if (b && typeof b === 'object') payload = { ...b };
            } catch (e) {}
        }
        const acao = payload.acao || 'buscar_dados';
        const isBuscar = String(acao).startsWith('buscar_');
        // Para buscas, a chave de cache depende exclusivamente da ação para compartilhar entre GET e POST
        const cacheKey = isBuscar ? String(acao).trim() : JSON.stringify(payload);
        const now = Date.now();

        if (!global.gasCache) global.gasCache = {};

        // Retorna do cache fresco se for busca e tiver menos de 3 minutos (180s)
        if (isBuscar && global.gasCache[cacheKey] && (now - global.gasCache[cacheKey].timestamp < 180000)) {
            return sendJson(res, 200, global.gasCache[cacheKey].data);
        }

        try {
            const data = await fetchGasFromNode(payload);
            if (data && data.status === 'success' && isBuscar) {
                global.gasCache[cacheKey] = { timestamp: now, data };
            }
            // Se for ação de gravação, limpa o cache de buscas para refletir atualizações
            if (!isBuscar) {
                global.gasCache = {};
            }
            return sendJson(res, 200, data);
        } catch (err) {
            console.error('❌ [GAS Proxy] Erro ao consultar Apps Script:', err.message);
            // Padrão Stale-While-Revalidate: Se houver qualquer versão em cache anterior, entrega ao invés de quebrar
            if (isBuscar && global.gasCache[cacheKey] && global.gasCache[cacheKey].data) {
                console.log('⚠️ [GAS Proxy] Entregando versão persistida em cache após instabilidade no Apps Script:', acao);
                return sendJson(res, 200, global.gasCache[cacheKey].data);
            }
            return sendJson(res, 500, { status: 'error', message: err.message });
        }
    }

    // ==========================================
    // SERVIDOR ESTÁTICO (CORINO - WEB)
    // ==========================================
    if (req.method === 'GET' || req.method === 'HEAD') {
        let cleanPath = pathname;
        if (cleanPath === '/' || cleanPath === '') {
            cleanPath = '/login.html';
        }

        // Previne Directory Traversal
        const safePath = path.normalize(cleanPath).replace(/^(\.\.[\/\\])+/, '');
        const filePath = path.join(__dirname, safePath);

        fs.stat(filePath, (err, stats) => {
            if (err || !stats.isFile()) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                return res.end(`404 - Arquivo não encontrado: ${pathname}`);
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': stats.size,
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });

            if (req.method === 'HEAD') {
                return res.end();
            }

            const readStream = fs.createReadStream(filePath);
            readStream.pipe(res);
        });
        return;
    }

    // Método não suportado
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('405 - Método não permitido');
});

server.listen(config.porta, () => {
    console.log('\n==================================================');
    console.log(' [OK] Servidor CORINO (Node.js + GCS LGPD) Iniciado!');
    console.log(` [URL] Endereço Local: http://127.0.0.1:${config.porta}/login.html`);
    console.log(` [GCS] Bucket: ${config.bucketName || '(Aguardando configuração em gcs-config.json)'}`);
    console.log(` [GCS] Expiração de Links: ${config.urlExpirationMinutes} minutos`);
    console.log('==================================================\n');
});
