/**
 * GCSStorage - Cliente de Armazenamento Seguro no Google Cloud Storage (LGPD)
 * 
 * Responsável por:
 * 1. Gerar e gerenciar URLs Assinadas Temporárias (Signed URLs V4) sob demanda
 * 2. Implementar Cache em memória com TTL para evitar requisições redundantes
 * 3. Padronizar o envio de arquivos diretamente para pastas estruturadas no GCS
 * 4. Garantir retrocompatibilidade com links legados do Google Drive
 */

const GCSStorage = (function () {
    // Cache de URLs temporárias: chave -> { url, expiraEmMs }
    const cacheUrls = new Map();

    /**
     * Identifica se uma referência de arquivo pertence ao Google Cloud Storage
     */
    function isGCS(urlOuCaminho) {
        if (!urlOuCaminho || typeof urlOuCaminho !== 'string') return false;
        const str = urlOuCaminho.trim();
        if (str.startsWith('gs://') || str.startsWith('gcs:')) return true;
        if (str.includes('storage.googleapis.com')) return true;
        // Caminho relativo estruturado do GCS (ex: oficios/..., respostas/..., autos/..., cartas/...)
        if (!str.startsWith('http') && (
            str.startsWith('oficios/') || 
            str.startsWith('respostas/') || 
            str.startsWith('autos/') || 
            str.startsWith('cartas/') || 
            str.startsWith('externos/')
        )) {
            return true;
        }
        return false;
    }

    /**
     * Extrai o caminho limpo do objeto no GCS
     */
    function extrairCaminho(urlOuCaminho) {
        if (!urlOuCaminho || typeof urlOuCaminho !== 'string') return '';
        let limpo = urlOuCaminho.trim();
        if (limpo.startsWith('gs://')) {
            limpo = limpo.substring(5);
            const slashIndex = limpo.indexOf('/');
            if (slashIndex !== -1) {
                limpo = limpo.substring(slashIndex + 1);
            }
        } else if (limpo.startsWith('gcs:')) {
            limpo = limpo.substring(4);
        } else if (limpo.includes('storage.googleapis.com/')) {
            const parts = limpo.split('storage.googleapis.com/');
            const afterHost = parts[1] || '';
            const slashIndex = afterHost.indexOf('/');
            limpo = slashIndex !== -1 ? afterHost.substring(slashIndex + 1) : afterHost;
            // Remove query params se existirem
            limpo = limpo.split('?')[0];
        }
        return limpo.replace(/^\/+/, '');
    }

    /**
     * Obtém uma URL temporária assinada para visualização ou download.
     * Utiliza cache em memória para reaproveitar URLs válidas (com margem de 2 minutos).
     * 
     * @param {string} urlOuCaminho - Caminho no GCS (gs://bucket/path ou path) ou URL de fallback
     * @param {boolean} [download=false] - Se true, configura headers para forçar download
     * @param {string} [nomeArquivo=''] - Nome do arquivo sugerido para download
     * @returns {Promise<string>} URL temporária pronta para uso no iframe ou tag <a>
     */
    async function obterUrlTemporaria(urlOuCaminho, download = false, nomeArquivo = '') {
        if (!urlOuCaminho || typeof urlOuCaminho !== 'string') return '';
        const raw = urlOuCaminho.trim();

        // Se for um link legado do Google Drive, não passa pelo GCS
        if (!isGCS(raw)) {
            return raw;
        }

        const cleanPath = extrairCaminho(raw);
        if (!cleanPath) return raw;

        const cacheKey = `${cleanPath}::download=${download}::name=${nomeArquivo}`;
        const agora = Date.now();

        // Verifica cache (se expira em mais de 2 minutos, reutiliza)
        if (cacheUrls.has(cacheKey)) {
            const item = cacheUrls.get(cacheKey);
            if (item.expiraEmMs - agora > 2 * 60 * 1000) {
                return item.url;
            } else {
                cacheUrls.delete(cacheKey);
            }
        // Em ambiente estático sem backend Node.js (ex: GitHub Pages), retorna URL direta do storage
        if (window.location.hostname.includes('github.io') || window.location.protocol === 'file:') {
            return raw.startsWith('http') ? raw : `https://storage.googleapis.com/corino-documentos-ms/${cleanPath}`;
        }

        try {
            const res = await fetch('/api/storage/signed-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    gcsPath: cleanPath,
                    download: download,
                    filename: nomeArquivo
                })
            });

            if (!res.ok) {
                return raw.startsWith('http') ? raw : `https://storage.googleapis.com/corino-documentos-ms/${cleanPath}`;
            }

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                return raw.startsWith('http') ? raw : `https://storage.googleapis.com/corino-documentos-ms/${cleanPath}`;
            }

            const data = await res.json();
            if (data.status === 'success' && data.signedUrl) {
                const expiraEmMs = data.expiresAt ? new Date(data.expiresAt).getTime() : (agora + 13 * 60 * 1000);
                cacheUrls.set(cacheKey, {
                    url: data.signedUrl,
                    expiraEmMs: expiraEmMs
                });
                return data.signedUrl;
            } else {
                console.warn('⚠️ [GCS] Não foi possível gerar signed URL:', data.message);
                throw new Error(data.message || 'Erro ao gerar link seguro.');
            }
        } catch (err) {
            console.error('❌ [GCS] Erro ao obter link temporário:', err);
            throw err;
        }
    }

    /**
     * Realiza o upload de um arquivo para o GCS na estrutura segura
     * 
     * @param {File} file - Objeto File selecionado pelo usuário
     * @param {Object} options - { modulo, nup, nomePersonalizado, username }
     * @returns {Promise<{ gcsPath: string, fullGcsUri: string }>}
     */
    async function fazerUpload(file, options = {}) {
        if (!file) throw new Error('Nenhum arquivo fornecido para upload.');

        const modulo = options.modulo || 'oficios';
        const nup = options.nup || 'geral';
        const nupLimpo = String(nup).replace(/[^a-zA-Z0-9]/g, '_');
        const timestamp = Date.now();

        let nomeArquivo = options.nomePersonalizado;
        if (!nomeArquivo) {
            const ext = file.name.split('.').pop();
            nomeArquivo = `${modulo}_${nupLimpo}_${timestamp}.${ext}`;
        }

        const gcsPath = `${modulo}/${nupLimpo}/${nomeArquivo}`;

        // Converte arquivo para Base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result;
                const base64Content = result.includes(',') ? result.split(',')[1] : result;
                resolve(base64Content);
            };
            reader.onerror = error => reject(error);
        });

        const res = await fetch('/api/storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gcsPath: gcsPath,
                base64: base64,
                contentType: file.type || 'application/octet-stream',
                nup: nup,
                username: options.username || ''
            })
        });

        const data = await res.json();
        if (data.status === 'success') {
            return {
                gcsPath: data.gcsPath,
                fullGcsUri: data.fullGcsUri
            };
        } else {
            throw new Error(data.message || 'Erro no upload para o Google Cloud Storage.');
        }
    }

    /**
     * Verifica o status da integração com o Google Cloud Storage
     */
    async function verificarStatus() {
        try {
            const res = await fetch('/api/storage/status');
            return await res.json();
        } catch (err) {
            return { status: 'offline', configured: false, message: 'Servidor local offline.' };
        }
    }

    return {
        isGCS,
        extrairCaminho,
        obterUrlTemporaria,
        fazerUpload,
        verificarStatus
    };
})();

// Expõe globalmente
window.GCSStorage = GCSStorage;
