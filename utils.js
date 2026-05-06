/**
 * Converte uma string de data no formato BR (DD/MM/YYYY) para timestamp (milissegundos).
 * Útil para ordenação de arrays e cálculos de prazos.
 */
function converterDataBR(str) {
    if (!str || str === '-') return Infinity;
    const partes = str.split('/');
    if (partes.length === 3) {
        return new Date(partes[2], partes[1] - 1, partes[0]).getTime();
    }
    return new Date(str).getTime() || Infinity;
}

/**
 * Extrai o valor numérico dos dias restantes de uma string.
 * Exemplo: "- 15 dias" -> -15, ou "1 dia" -> 1
 */
function extrairDiasRestantes(str) {
    if (!str || str === '-' || String(str).toLowerCase() === 'nan') return NaN;
    return parseInt(String(str).replace(/[^0-9-]/g, ""));
}

/**
 * Aplica a máscara de NUP (XX.XXX.XXX-XXXX) num input de texto.
 */
function maskNUP(event) {
    let v = event.target.value.replace(/\D/g, '');
    v = v.substring(0, 12);
    let formatted = '';
    if (v.length > 0) formatted += v.substring(0, 2);
    if (v.length > 2) formatted += '.' + v.substring(2, 5);
    if (v.length > 5) formatted += '.' + v.substring(5, 8);
    if (v.length > 8) formatted += '-' + v.substring(8, 12);
    event.target.value = formatted;
}

/**
 * Extrai o ID de um ficheiro do Google Drive a partir do link partilhado.
 */
function extrairIdDrive(url) {
    let match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match) return match[1];
    return null;
}