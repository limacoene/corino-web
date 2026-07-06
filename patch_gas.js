const fs = require('fs');
let code = fs.readFileSync('gas_completo_atualizado.gs', 'utf8');

const newEndpoint = \
    if (data.acao === "alterar_status_manual_generico") {
      var nupB = data.nup, novoStatus = data.novoStatus, operador = data.username, tipoAba = data.tipoAba, atualizado = false;
      var aba;
      if (tipoAba === "oficio") {
        for(var s=0;s<abasProcessos.length;s++){
          var tempAba=abasProcessos[s];if(!tempAba)continue;
          var v=tempAba.getDataRange().getValues();
          if(v.length>0){
             var c=v[0], cn=-1;
             for(var x=0;x<c.length;x++){if(String(c[x]).trim().toUpperCase()==="NUP")cn=x;}
             if(cn!==-1){
               for(var y=1;y<v.length;y++){
                 if(String(v[y][cn]).trim()===String(nupB).trim()){aba=tempAba;break;}
               }
             }
          }
          if(aba)break;
        }
      } else if (tipoAba === "externo") { aba = abaExternos; } 
      else if (tipoAba === "carta") { aba = getAbaCartas(sheetDb, sheets); }
      
      if (aba) {
        var vals = aba.getDataRange().getValues();
        if (vals.length > 0) {
          var cab = vals[0], colNup = -1, colStatus = -1, colDataStatus = -1, colTec = -1, colSetor = -1;
          for (var c = 0; c < cab.length; c++) {
            var hl = String(cab[c]).trim().toUpperCase();
            if (hl === "NUP" || hl === "PROCESSO" || hl === "PROCESSO/NUP") colNup = c;
            if (hl === "STATUS ATUAL" || hl === "STATUS" || hl === "SITUAÇÃO") colStatus = c;
            if (hl === "DATA STATUS ATUAL" || hl === "DATA_STATUS_ATUAL" || hl === "DATA DE ENTRADA") colDataStatus = c;
            if (hl === "TÉCNICO/ADMIN" || hl === "TECNICO/ADMIN" || hl === "TÉCNICO" || hl === "TECNICO") colTec = c;
            if (hl === "SETOR" || hl === "GERÊNCIA" || hl === "GERENCIA") colSetor = c;
          }
          if (colNup !== -1 && colStatus !== -1) {
            for (var i = 1; i < vals.length; i++) {
              if (String(vals[i][colNup]).trim() === String(nupB).trim()) {
                aba.getRange(i + 1, colStatus + 1).setValue(novoStatus);
                if (colDataStatus !== -1) {
                  aba.getRange(i + 1, colDataStatus + 1).setValue(dataAtual);
                }
                var tecnicoOriginal = colTec !== -1 ? vals[i][colTec] : "S/T";
                var setorOriginal = colSetor !== -1 ? vals[i][colSetor] : "S/G";
                if (abaTramitacao) {
                  abaTramitacao.appendRow([dataAtual, nupB, "ALTERACAO_MANUAL_STATUS", novoStatus, setorOriginal, tecnicoOriginal, operador, "Status alterado manualmente pela Diretoria"]);
                }
                atualizado = true; break;
              }
            }
          }
        }
      }
      if (atualizado) { SpreadsheetApp.flush(); return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON); }
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP não encontrado ou erro"})).setMimeType(ContentService.MimeType.JSON);
    }
\;

if (!code.includes("alterar_status_manual_generico")) {
    code = code.replace('if (data.acao === "alterar_status_manual_auto") {', newEndpoint + '\n    if (data.acao === "alterar_status_manual_auto") {');
    
    // Altera atribuir_tecnico_oficio para setar status incondicionalmente
    code = code.replace(
      'if(String(vals[i][colStatus]).toUpperCase()==="AGUARDANDO DISTRIBUIÇÃO")\\n                aba.getRange(i+1,colStatus+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");',
      'aba.getRange(i+1,colStatus+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");'
    );
    // Para resolver o erro do replace, vamos usar fallback caso haja encoding utf8 nas strings do gs
    
    fs.writeFileSync('gas_completo_atualizado.gs', code);
    console.log("Endpoints adicionados!");
} else {
    console.log("Endpoints ja existem.");
}
