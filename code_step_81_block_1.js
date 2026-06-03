
function doPost(e) {
  var lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(10000); 
    var data = JSON.parse(e.postData.contents);
    
    var USUARIOS = {
      "diflor": { senha: "gonçaloalves", perfil: "gerencia", nomePlanilha: "DIRETORIA FLORESTAL" },
      "geamb": { senha: "usop1", perfil: "gerencia_consulta", nomePlanilha: "GERÊNCIA DE ASSUNTOS AMBIENTAIS" },
      "jhonatan": { senha: "dev1", perfil: "tecnico", nomePlanilha: "JHONATAN" },
      "rcosta": { senha: "mutumdev", perfil: "tecnico", nomePlanilha: "RODRIGO" },
      "marianaopp": { senha: "marianaopp", perfil: "tecnico", nomePlanilha: "MARIANA OPP" },
      "erafael": { senha: "epaulino", perfil: "tecnico", nomePlanilha: "ELERI" },
      "mandressa": { senha: "mbrito", perfil: "tecnico", nomePlanilha: "MILKA" },
      "jribeiro": { senha: "jferreira", perfil: "tecnico", nomePlanilha: "JOELTHON" },
      "bcarneiro": { senha: "boliveira", perfil: "tecnico", nomePlanilha: "BEATRIZ" },
      "aoliveira": { senha: "atavares", perfil: "tecnico", nomePlanilha: "ANDERSON" },
      "hcrodrigues": { senha: "hcorrea", perfil: "tecnico", nomePlanilha: "HELEN CAROLINE" },
      "mshinzato": { senha: "muemura", perfil: "tecnico", nomePlanilha: "MARIANA SH" },
      
<truncated 31027 bytes>
colTecnico + 1).setValue(tecnico);
          if (colStatus !== -1) {
            abaExternos.getRange(i + 1, colStatus + 1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");
          }
          if (colDataRepasse !== -1) {
            abaExternos.getRange(i + 1, colDataRepasse + 1).setValue(dataHoje);
          }
          encontrado = true;
          break;
        }
      }
      
      if (encontrado) {
        if (abaTramitacao) {
          abaTramitacao.appendRow([dataAtual, nup, "TÉCNICO ATRIBUÍDO A OFÍCIO EXTERNO", tecnico]);
        }
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "success", 
          dataRepasse: dataHoje 
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ 
          status: "error", 
          message: "Processo com NUP " + nup + " não encontrado." 
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

  } catch (error) { 
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
