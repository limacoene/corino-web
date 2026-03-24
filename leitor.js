const LINKS_PLANILHAS = [
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQH-FB2y0K914aswDdtivgD5AJv6fpnUIPQpU2XmMHrIvXbRcDbgWdrv_VJBKLZesNueg9Q8AfNUXP2/pub?gid=166704597&single=true&output=csv",
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQH-FB2y0K914aswDdtivgD5AJv6fpnUIPQpU2XmMHrIvXbRcDbgWdrv_VJBKLZesNueg9Q8AfNUXP2/pub?gid=1166060041&single=true&output=csv"
];

function limparEPadronizarLinha(linha) {
    const chaves = Object.keys(linha);
    let tipo = (linha['TIPO'] || '').toUpperCase();
    tipo = tipo.replace('CARTÃO DE CONSULTA', 'CARTA CONSULTA').replace('OFICIAL', 'OFÍCIO');

    let tecnico = (linha['TÉCNICO/ADMIN'] || '').trim();
    if (tecnico === '') {
        tecnico = 'S/T';
    }

    let gerencia = (linha['GERÊNCIA'] || '').trim().toUpperCase();
    if (gerencia === '') {
        gerencia = 'S/G';
    }

    let registro = {
        DATA: linha['DATA'] || linha['DATA DE ENTRADA'] || '-',
        NUP: linha['NUP'] || linha['PROCESSO'] || '',
        COMARCA: linha['COMARCA'] || linha['MUNICÍPIO'] || linha['MUNICIPIO'] || '-',
        'OFÍCIO N.': linha['OFÍCIO N.'] || linha['OFÍCIO'] || linha['OFICIO'] || linha['DOCUMENTO'] || '-',
        TIPO: tipo || '-',
        REFERÊNCIA: linha['REFERÊNCIA'] || linha['REFERENCIA'] || '-',
        PRAZO: linha['PRAZO'] || linha['VENCIMENTO'] || linha['DATA VENCIMENTO'] || '-',
        'DIAS RESTANTES': linha['DIAS RESTANTES'] || linha['-00 DIAS'] || linha['PRAZO (DIAS)'] || linha['DIAS'] || linha['VENCIMENTO'] || '-',
        CARMS: linha['CARMS'] || linha['CAR'] || '-',
        'STATUS DO CAR': linha['STATUS DO CAR'] || linha['STATUS CAR'] || '-',
        'TÉCNICO/ADMIN': tecnico,
        GERÊNCIA: gerencia,
        STATUS: (linha['STATUS'] || linha['SITUAÇÃO'] || '-').toUpperCase(),
        'E-MS': linha['E-MS'] || linha['EMS'] || '-',
        CBRS: linha['CBRS'] || '-',
        OBSERVAÇÃO: linha['OBSERVAÇÃO'] || linha['OBSERVACAO'] || linha['OBS'] || '-',
        LINK_OFICIO: linha['LINK - OFÍCIO'] || linha['LINK_OFICIO'] || linha['LINK OFÍCIO'] || linha['LINK DO OFÍCIO'] || '',
        
        // NOVA COLUNA PARA A ABA DE RESPOSTAS
        LINK_RESPOSTA: linha['LINK DA RESPOSTA'] || linha['LINK_RESPOSTA'] || linha['LINK RESPOSTA'] || '',
        
        OFICIO_INICIAL: linha['OFICIO_INICIAL'] || linha['OFÍCIO INICIAL'] || linha[chaves[17]] || '',
        NUP_INICIAL: linha['NUP_INICIAL'] || linha['NUP INICIAL'] || linha[chaves[18]] || '',
        LINK_INICIAL: linha['LINK_INICIAL'] || linha['LINK INICIAL'] || linha['LINK DO OFÍCIO INICIAL'] || linha[chaves[19]] || '',
        
        REITERACOES: []
    };

    for (let i = 28; i < chaves.length; i += 3) {
        const num = linha[chaves[i]];
        const nup = linha[chaves[i+1]];
        const link = linha[chaves[i+2]];
        if (num && String(num).trim() !== '' && String(num).trim() !== '-') {
            registro.REITERACOES.push({ NUMERO: num, NUP: nup || '', LINK: link || '' });
        }
    }
    
    return registro;
}

async function buscarDadosGoogleSheets() {
    try {
        const promessas = LINKS_PLANILHAS.map(url => new Promise((resolve, reject) => {
            Papa.parse(url, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: (resultados) => {
                    resolve(resultados.data);
                },
                error: (erro) => {
                    reject(erro);
                }
            });
        }));

        const arraysDeDados = await Promise.all(promessas);
        const todosOsDados = [...arraysDeDados[0], ...arraysDeDados[1]];
        
        const dadosLimpos = todosOsDados
            .filter(linha => linha['NUP'])
            .map(limparEPadronizarLinha);

        return dadosLimpos;
    } catch (erro) {
        console.error("Erro na leitura das planilhas:", erro);
        throw erro;
    }
}
