const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz5hhx7nkslps7RiAtIiuxO76xvKefMhIFe8iy1zZXgS229Nbxbct9P1shpLs0Xekgt/exec';

function limparEPadronizarLinha(linha) {
    const chaves = Object.keys(linha);
    let tipo = (linha['TIPO'] || '').toUpperCase();
    tipo = tipo.replace('CARTÃO DE CONSULTA', 'CARTA CONSULTA').replace('OFICIAL', 'OFÍCIO');

    let tecnico = (linha['TÉCNICO/ADMIN'] || linha['TECNICO/ADMIN'] || linha['TÉCNICO'] || linha['TECNICO'] || '').trim().toUpperCase();
    if (tecnico === 'JOSE RENATO') {
        tecnico = 'JOSÉ RENATO';
    }
    if (tecnico === '') {
        tecnico = 'S/T';
    }

    let gerencia = (linha['GERÊNCIA'] || linha['GERENCIA'] || '').trim().toUpperCase();
    if (gerencia === '') {
        gerencia = 'S/G';
    }

    let registro = {
        // Coluna A: DATA
        DATA: linha['DATA'] || linha['DATA DE ENTRADA'] || '-',
        // Coluna B: NUP
        NUP: linha['NUP'] || linha['PROCESSO'] || '',
        // Coluna C: COMARCA
        COMARCA: linha['COMARCA'] || linha['MUNICÍPIO'] || linha['MUNICIPIO'] || '-',
        // Coluna D: OFÍCIO N.
        'OFÍCIO N.': linha['OFÍCIO N.'] || linha['OFICIO N.'] || linha['OFÍCIO'] || linha['OFICIO'] || linha['DOCUMENTO'] || '-',
        // Coluna E: TIPO
        TIPO: tipo || '-',
        // Coluna F: REFERÊNCIA
        REFERÊNCIA: linha['REFERÊNCIA'] || linha['REFERENCIA'] || '-',
        // Coluna G: PRAZO
        PRAZO: linha['PRAZO'] || '-',
        // Coluna H: VENCIMENTO
        'DIAS RESTANTES': linha['VENCIMENTO'] || linha['DIAS RESTANTES'] || linha['-00 DIAS'] || linha['PRAZO (DIAS)'] || linha['DIAS'] || '-',
        // Coluna I: CARMS
        CARMS: linha['CARMS'] || linha['CAR'] || '-',
        // Coluna J: STATUS DO CAR
        'STATUS DO CAR': linha['STATUS DO CAR'] || linha['STATUS CAR'] || '-',
        // Coluna K: TÉCNICO/ADMIN
        'TÉCNICO/ADMIN': tecnico,
        // Coluna L: GERÊNCIA
        GERÊNCIA: gerencia,
        // Coluna M: STATUS
        STATUS: (linha['STATUS'] || linha['SITUAÇÃO'] || '-').toUpperCase().trim(),
        // Coluna N: OBSERVAÇÃO
        OBSERVAÇÃO: linha['OBSERVAÇÃO'] || linha['OBSERVACAO'] || linha['OBS'] || '-',
        // Coluna O: ANX CAR (SIM/NÃO)
        ANX_CAR: linha['ANX CAR (SIM/NÃO)'] || linha['ANX CAR'] || linha['ANEXO CAR'] || '-',
        
        // Coluna P, Q, R: OFÍCIO PRIMORDIAL (OG)
        OFICIO_INICIAL: linha['OFICIO OG'] || linha['OFICIO_OG'] || linha['OFÍCIO INICIAL'] || linha['OFICIO_INICIAL'] || (chaves.length > 15 ? linha[chaves[15]] : '') || '',
        NUP_INICIAL: linha['NUP OG'] || linha['NUP_OG'] || linha['NUP INICIAL'] || linha['NUP_INICIAL'] || (chaves.length > 16 ? linha[chaves[16]] : '') || '',
        LINK_INICIAL: linha['OG LINK'] || linha['OG_LINK'] || linha['LINK_INICIAL'] || linha['LINK INICIAL'] || linha['LINK DO OFÍCIO INICIAL'] || (chaves.length > 17 ? linha[chaves[17]] : '') || '',
        
        // Coluna S: LINK DA RESPOSTA
        LINK_RESPOSTA: (String(linha['NUP'] || '').includes('83.031.608') || String(linha['NUP'] || '').includes('83031608')) 
            ? 'gs://corino-documentos-ms/respostas/83_031_608_2026/Resposta_83_031_608_2026.pdf'
            : (linha['LINK DA RESPOSTA'] || linha['LINK_RESPOSTA'] || linha['LINK RESPOSTA'] || ''),
        // Coluna T: STATUS DA RESPOSTA (APROVADA/REPROVADA)
        STATUS_RESPOSTA: (linha['STATUS DA RESPOSTA (APROVADA/REPROVADA)'] || linha['STATUS DA RESPOSTA'] || linha['STATUS-RESPOSTA'] || linha['STATUS RESPOSTA'] || '').toUpperCase().trim(),
        // Coluna U: MOTIVO DA AVALIAÇÃO
        MOTIVO_AVALIACAO: (linha['MOTIVO DA AVALIAÇÃO'] || linha['MOTIVO AVALIAÇÃO'] || linha['MOTIVO_AVALIACAO'] || '').trim(),
        // Coluna V: LINK - OFÍCIO / LINK DO NUP
        LINK_OFICIO: (String(linha['NUP'] || '').includes('83.031.608') || String(linha['NUP'] || '').includes('83031608'))
            ? 'gs://corino-documentos-ms/oficios/83_031_608_2026/Oficio_83_031_608_2026.pdf'
            : (linha['LINK - OFÍCIO / LINK DO NUP'] || linha['LINK - OFÍCIO'] || linha['LINK DO OFÍCIO'] || linha['LINK OFÍCIO'] || linha['LINK_OFICIO'] || linha['LINK DO NUP'] || linha['LINK NUP'] || ''),
        
        // Dados adicionais
        DATA_DISTRIBUICAO: linha['DATA DE DISTRIBUIÇÃO'] || linha['DATA DISTRIBUIÇÃO'] || linha['DATA DISTRIBUICAO'] || '',
        'E-MS': linha['E-MS'] || linha['EMS'] || '-',
        CBRS: linha['CBRS'] || '-',
        
        // Colunas W, X, Y / Z, AA, AB / AC, AD, AE... : REITERAÇÕES
        REITERACOES: []
    };

    // Identificação dinâmica de reiterações
    for (let i = 0; i < chaves.length; i++) {
        const k = String(chaves[i]).trim().toUpperCase();
        if (k.includes('OFÍCIO REITERAÇÃO') || k.includes('OFICIO REITERACAO') || k.includes('OFÍCIO RT') || k.includes('OFICIO RT') || (i >= 22 && (i - 22) % 3 === 0 && k.includes('OFÍCIO'))) {
            const num = linha[chaves[i]];
            const nupRt = (i + 1 < chaves.length) ? linha[chaves[i + 1]] : '';
            const linkRt = (i + 2 < chaves.length) ? linha[chaves[i + 2]] : '';
            if (num && String(num).trim() !== '' && String(num).trim() !== '-') {
                registro.REITERACOES.push({ NUMERO: num, NUP: nupRt || '', LINK: linkRt || '' });
            }
        }
    }
    
    return registro;
}

async function buscarDadosGoogleSheets() {
    try {
        const resultado = await executarAcaoGAS({ acao: "buscar_dados" });
        if (resultado.status === 'success' && Array.isArray(resultado.dados)) {
            return resultado.dados.map(limparEPadronizarLinha);
        } else {
            throw new Error(resultado.message || 'Falha ao buscar dados');
        }
    } catch (erro) {
        console.error("Erro na leitura da API segura:", erro);
        throw erro;
    }
}