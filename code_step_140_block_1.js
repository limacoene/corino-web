
14: function doPost(e) {
15:   var lock = LockService.getScriptLock();
16:   
17:   try {
18:     lock.waitLock(10000); 
19:     var data = JSON.parse(e.postData.contents);
20:     
21:     var USUARIOS = {
22:       "diflor": { senha: "gonçaloalves", perfil: "gerencia", nomePlanilha: "DIRETORIA FLORESTAL" },
23:       "geamb": { senha: "usop1", perfil: "gerencia_consulta", nomePlanilha: "GERÊNCIA DE ASSUNTOS AMBIENTAIS" },
24:       "jhonatan": { senha: "dev1", perfil: "tecnico", nomePlanilha: "JHONATAN" },
25:       "rcosta": { senha: "mutumdev", perfil: "tecnico", nomePlanilha: "RODRIGO" },
26:       "marianaopp": { senha: "marianaopp", perfil: "tecnico", nomePlanilha: "MARIANA OPP" },
27:       "erafael": { senha: "epaulino", perfil: "tecnico", nomePlan
<truncated 884 bytes>
(i + 1, colDataRepasse + 1).setValue(dataHoje);
42:           }
43:           encontrado = true;
44:           break;
45:         }
46:       }
47:       
48:       if (encontrado) {
49:         if (abaTramitacao) {
50:           abaTramitacao.appendRow([dataAtual, nup, "TÉCNICO ATRIBUÍDO A OFÍCIO EXTERNO", tecnico]);
51:         }
52:         SpreadsheetApp.flush();
53:         return ContentService.createTextOutput(JSON.stringify({ 
54:           status: "success", 
55:           dataRepasse: dataHoje 
56:         })).setMimeType(ContentService.MimeType.JSON);
57:       } else {
58:         return ContentService.createTextOutput(JSON.stringify({ 
59:           status: "error", 
60:           message: "Processo com NUP " + nup + " não encontrado." 
61:         })).setMimeType(ContentService.MimeType.JSON);
62:       }
63:     }
64: 
65:   } catch (error) { 
66:     return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
67:   } finally {
68:     lock.releaseLock();
69:   }
70: }
71: 