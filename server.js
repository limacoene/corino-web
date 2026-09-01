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
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end(JSON.stringify(data));
}

/**
 * Servidor HTTP Principal
 */
const server = http.createServer(async (req, res) => {
    // Tratamento de CORS Preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

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
