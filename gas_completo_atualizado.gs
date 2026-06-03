// ===========================================================
// HELPERS — Cartas Consulta
// ===========================================================
function getAbaCartas(sheetDb, sheets) {
  return sheetDb.getSheetByName("CARTAS CONSULTA")
      || sheetDb.getSheetByName("Cartas Consulta")
      || sheetDb.getSheetByName("CARTAS_CONSULTA")
      || sheetDb.getSheetByName("Cartas")
      || sheets[4] || null;
}
function getColunasCartas(cab) {
  var c = {nup:-1,dataRepasse:-1,requerente:-1,gerencia:-1,prioridade:-1,
            fisico:-1,tecnico:-1,status:-1,tramitado:-1,obs:-1,
            linkNup:-1,linkResp:-1,statusResp:-1,motivo:-1,
            linkManifestacao:-1,linkDeclaracao:-1,atividade:-1,linkShapefile:-1,
            prazo:-1};
  for (var i=0;i<cab.length;i++){
    var h=String(cab[i]).trim().toUpperCase();
    if(h==="NUP") c.nup=i;
    if(h==="DATA DO REPASSE"||h==="DATA DE REPASSE") c.dataRepasse=i;
    if(h==="REQUERENTE") c.requerente=i;
    if(h==="GERÊNCIA"||h==="GERENCIA") c.gerencia=i;
    if(h==="GRAU DE PRIORIDADE"||h==="PRIORIDADE") c.prioridade=i;
    if(h==="FÍSICO/E-MS"||h==="FISICO/E-MS") c.fisico=i;
    if(h==="TÉCNICO/ADM"||h==="TECNICO/ADM") c.tecnico=i;
    if(h==="STATUS"||h==="SITUAÇÃO") c.status=i;
    if(h==="TRAMITADO P/"||h==="TRAMITADO PARA") c.tramitado=i;
    if(h==="OBSERVAÇÃO"||h==="OBSERVAÇÕES") c.obs=i;
    if(h==="LINK DO NUP") c.linkNup=i;
    if(h==="LINK DA RESPOSTA") c.linkResp=i;
    if(h==="STATUS DA RESPOSTA") c.statusResp=i;
    if(h==="MOTIVO DA AVALIAÇÃO"||h==="MOTIVO DA AVALIACAO") c.motivo=i;
    if(h==="LINK DA MANIFESTAÇÃO"||h==="LINK DA MANIFESTACAO"||h==="LINK_MANIFESTACAO") c.linkManifestacao=i;
    if(h==="LINK DA DECLARAÇÃO"||h==="LINK DA DECLARACAO"||h==="LINK_DECLARACAO") c.linkDeclaracao=i;
    if(h==="ATIVIDADE") c.atividade=i;
    if(h==="LINK SHAPEFILE"||h==="LINK_SHAPEFILE"||h==="LINK SHAPE"||h==="LINK SHAPEFILE") c.linkShapefile=i;
    if(h==="PRAZO"||h==="PRAZO DE RESPOSTA"||h==="PRAZO (DIAS)") c.prazo=i;
  }
  return c;
}

// ===========================================================
// MAIN doPost
// ===========================================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var data = JSON.parse(e.postData.contents);

    var USUARIOS = {
      "diflor":       {senha:"gonçaloalves",perfil:"gerencia",         nomePlanilha:"DIRETORIA FLORESTAL"},
      "geamb":        {senha:"usop1",        perfil:"gerencia_consulta",nomePlanilha:"GERÊNCIA DE ASSUNTOS AMBIENTAIS"},
      "jhonatan":     {senha:"dev1",         perfil:"tecnico",          nomePlanilha:"JHONATAN"},
      "rcosta":       {senha:"mutumdev",     perfil:"tecnico",          nomePlanilha:"RODRIGO"},
      "marianaopp":   {senha:"marianaopp",   perfil:"tecnico",          nomePlanilha:"MARIANA OPP"},
      "erafael":      {senha:"epaulino",     perfil:"tecnico",          nomePlanilha:"ELERI"},
      "mandressa":    {senha:"mbrito",       perfil:"tecnico",          nomePlanilha:"MILKA"},
      "jribeiro":     {senha:"jferreira",    perfil:"tecnico",          nomePlanilha:"JOELTHON"},
      "bcarneiro":    {senha:"boliveira",    perfil:"tecnico",          nomePlanilha:"BEATRIZ"},
      "aoliveira":    {senha:"atavares",     perfil:"tecnico",          nomePlanilha:"ANDERSON"},
      "hcrodrigues":  {senha:"hcorrea",      perfil:"tecnico",          nomePlanilha:"HELEN CAROLINE"},
      "mshinzato":    {senha:"muemura",      perfil:"tecnico",          nomePlanilha:"MARIANA SH"},
      "lpires":       {senha:"lcarmo",       perfil:"tecnico",          nomePlanilha:"LARISSA"},
      "adpaula":      {senha:"adivino",      perfil:"tecnico",          nomePlanilha:"ALEXANDRE"},
      "mruginski":    {senha:"mmarochi",     perfil:"tecnico",          nomePlanilha:"MATEUS"},
      "mgarcia":      {senha:"mcorona",      perfil:"tecnico",          nomePlanilha:"MARIA"},
      "maguirre":     {senha:"mpereira",     perfil:"tecnico",          nomePlanilha:"MICHAEL"},
      "fvasconcellos":{senha:"fananias",     perfil:"tecnico",          nomePlanilha:"FABIANA"},
      "cfonseca":     {senha:"csilva",       perfil:"tecnico",          nomePlanilha:"CARLOS JULIANO"},
      "jcampos":      {senha:"jazedias",     perfil:"tecnico",          nomePlanilha:"JOSÉ RENATO"},
      "cbarauna":     {senha:"coliveira",    perfil:"tecnico",          nomePlanilha:"CRISTIANE"},
      "hsilva":       {senha:"hrodrigues",   perfil:"tecnico",          nomePlanilha:"HILBATY"},
      "fgortega":     {senha:"fgama",        perfil:"tecnico",          nomePlanilha:"FRANCIELLY"},
      "jpierre":      {senha:"jcosta",       perfil:"tecnico",          nomePlanilha:"JEAN PIERRE"},
      "ccaroline":    {senha:"carlant",      perfil:"tecnico",          nomePlanilha:"CARLA"},
      "snagel":       {senha:"ssilva",       perfil:"tecnico",          nomePlanilha:"SUZIELLY"},
      "msander":      {senha:"mmacedo",      perfil:"tecnico",          nomePlanilha:"MAX SANDER"},
      "emesquita":    {senha:"mesquita13",   perfil:"tecnico",          nomePlanilha:"ETEVALDO"},
      "gcar":         {senha:"gcar1281",     perfil:"gerencia_gcar",    nomePlanilha:"GCAR"},
      "geaa":         {senha:"geaa2026",     perfil:"gerencia_geaa",    nomePlanilha:"GEAA"},
      "acanjos":      {senha:"101215",       perfil:"tecnico",          nomePlanilha:"ALLAN"}
    };

    var sheetDb = SpreadsheetApp.getActiveSpreadsheet();
    var sheets  = sheetDb.getSheets();
    var abaExternos  = sheetDb.getSheetByName("Externos") || sheets[3];
    var abaAutos     = sheetDb.getSheetByName("AUTOS")    || sheets[2];
    var abasProcessos = [sheets[0], sheets[1], abaExternos, abaAutos];
    var abaTramitacao  = sheetDb.getSheetByName("HISTORICO_TRAMITACAO");
    var abaReprovacoes = sheetDb.getSheetByName("HISTORICO_REPROVACOES");
    var dataAtual = new Date();

    // ── LOGIN ──────────────────────────────────────────────
    if (data.acao === "login") {
      var u = data.username, p = data.password;
      if (USUARIOS[u] && USUARIOS[u].senha === p) {
        return ContentService.createTextOutput(JSON.stringify({status:"success",perfil:USUARIOS[u].perfil,nomePlanilha:USUARIOS[u].nomePlanilha})).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Utilizador ou palavra-passe incorretos."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── BUSCAR DADOS (Ofícios) ─────────────────────────────
    if (data.acao === "buscar_dados") {
      var todos = [];
      for (var s=0;s<2;s++) {
        if(s>=sheets.length) break;
        var aba=sheets[s]; var vals=aba.getDataRange().getDisplayValues();
        if(vals.length>1){var cab=vals[0].map(function(h){return String(h).trim().toUpperCase();});
          for(var i=1;i<vals.length;i++){var obj={};for(var c=0;c<cab.length;c++)obj[cab[c]]=vals[i][c];
            var nv=obj['NUP']||obj['PROCESSO']||obj['PROCESSO/NUP']||obj['NUP INICIAL'];if(nv){obj['NUP']=nv;todos.push(obj);}}}
      }
      return ContentService.createTextOutput(JSON.stringify({status:"success",dados:todos})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── UPLOAD DE RESPOSTA (Ofícios/Externos) ─────────────
    if (data.acao === "upload") {
      var fc=data.base64,fn=data.fileName,nupB=data.nup;
      if(fc.indexOf(',')>-1) fc=fc.split(',')[1];
      var pastaId="1c-K2Rlm55yWngXvAGBnhLLpbMSPPKqMU";
      if (data.tipo_oficio === "externo" || data.tipo_oficio === "auto") {
        pastaId = "1aj7ZO5Va91f8725h_S5vKo7OUqazET7d";
      }
      var folder=DriveApp.getFolderById(pastaId);
      var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      var fileUrl=file.getUrl();
      
      var abasFiltradas = [];
      if (data.tipo_oficio === "externo") {
        abasFiltradas = [abaExternos];
      } else if (data.tipo_oficio === "auto") {
        abasFiltradas = [abaAutos];
      } else {
        abasFiltradas = [sheets[0], sheets[1]];
      }
      
      var atualizado=false;
      for(var s=0;s<abasFiltradas.length;s++){
        var aba=abasFiltradas[s]; if(!aba) continue;
        var vals=aba.getDataRange().getValues(); if(vals.length===0) continue;
        var cab=vals[0],colNup=-1,colLink=-1,colStatus=-1,colSR=-1,colMot=-1;
        for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
          if(hl==="NUP")colNup=c;
          if(hl==="LINK DA RESPOSTA"||hl==="LINK RESPOSTA"||hl==="LINK_RESPOSTA")colLink=c;
          if(hl==="STATUS"||hl==="SITUAÇÃO"||hl==="STATUS ATUAL")colStatus=c;
          if(hl==="STATUS-RESPOSTA"||hl==="STATUS DA RESPOSTA"||hl==="STATUS_RESPOSTA")colSR=c;
          if(hl==="MOTIVO DA AVALIAÇÃO"||hl==="MOTIVO AVALIAÇÃO"||hl==="MOTIVO_AVALIACAO")colMot=c;}
        if(colNup===-1)continue;
        if(colLink===-1){colLink=12;aba.getRange(1,colLink+1).setValue("LINK DA RESPOSTA");}
        if(colStatus===-1){
          colStatus=6;
          var statusColName = (aba.getName() === "AUTOS") ? "STATUS ATUAL" : "STATUS";
          aba.getRange(1,colStatus+1).setValue(statusColName);
        }
        if(colSR===-1){colSR=13;aba.getRange(1,colSR+1).setValue("STATUS-RESPOSTA");}
        if(colMot===-1){colMot=14;aba.getRange(1,colMot+1).setValue("MOTIVO DA AVALIAÇÃO");}
        for(var i=1;i<vals.length;i++){
          if(String(vals[i][colNup]).trim()===String(nupB).trim()){
            aba.getRange(i+1,colLink+1).setValue(fileUrl);
            aba.getRange(i+1,colStatus+1).setValue("REVISÃO");
            aba.getRange(i+1,colSR+1).setValue("");
            aba.getRange(i+1,colMot+1).setValue("");
            atualizado=true;break;}}
        if(atualizado)break;}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"UPLOAD DE RESPOSTA",fileUrl]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success",url:fileUrl})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── REMOVER RESPOSTA (Ofícios/Externos) ───────────────
    if (data.acao === "remover_resposta") {
      var nupB=data.nup,atualizado=false;
      for(var s=0;s<abasProcessos.length;s++){
        var aba=abasProcessos[s];if(!aba)continue;
        var vals=aba.getDataRange().getValues();if(vals.length===0)continue;
        var cab=vals[0],colNup=-1,colLink=-1,colStatus=-1,colSR=-1,colMot=-1;
        for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
          if(hl==="NUP")colNup=c;
          if(hl==="LINK DA RESPOSTA"||hl==="LINK RESPOSTA"||hl==="LINK_RESPOSTA")colLink=c;
          if(hl==="STATUS"||hl==="SITUAÇÃO"||hl==="STATUS ATUAL")colStatus=c;
          if(hl==="STATUS-RESPOSTA"||hl==="STATUS DA RESPOSTA"||hl==="STATUS_RESPOSTA")colSR=c;
          if(hl==="MOTIVO DA AVALIAÇÃO"||hl==="MOTIVO AVALIAÇÃO"||hl==="MOTIVO_AVALIACAO")colMot=c;}
        if(colNup===-1)continue;
        if(colLink===-1){colLink=12;aba.getRange(1,colLink+1).setValue("LINK DA RESPOSTA");}
        if(colStatus===-1){colStatus=6;}if(colSR===-1){colSR=13;}if(colMot===-1){colMot=14;}
        for(var i=1;i<vals.length;i++){
          if(String(vals[i][colNup]).trim()===String(nupB).trim()){
            aba.getRange(i+1,colLink+1).setValue("");
            var statusVal = (aba.getName() === "AUTOS") ? "AGUARDANDO MANIFESTAÇÃO" : "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
            aba.getRange(i+1,colStatus+1).setValue(statusVal);
            aba.getRange(i+1,colSR+1).setValue("");aba.getRange(i+1,colMot+1).setValue("");
            atualizado=true;break;}}
        if(atualizado)break;}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"RESPOSTA REMOVIDA","Link apagado pelo utilizador"]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── AVALIAR RESPOSTA (Ofícios/Externos) ───────────────
    if (data.acao === "avaliar_resposta") {
      var nupB=data.nup,decisao=data.decisao,motivo=data.motivo||"",atualizado=false;
      for(var s=0;s<abasProcessos.length;s++){
        var aba=abasProcessos[s];if(!aba)continue;
        var vals=aba.getDataRange().getValues();if(vals.length===0)continue;
        var cab=vals[0],colNup=-1,colLink=-1,colStatus=-1,colSR=-1,colMot=-1;
        for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
          if(hl==="NUP")colNup=c;if(hl==="LINK DA RESPOSTA"||hl==="LINK RESPOSTA"||hl==="LINK_RESPOSTA")colLink=c;
          if(hl==="STATUS"||hl==="SITUAÇÃO"||hl==="STATUS ATUAL")colStatus=c;
          if(hl==="STATUS-RESPOSTA"||hl==="STATUS DA RESPOSTA"||hl==="STATUS_RESPOSTA")colSR=c;
          if(hl==="MOTIVO DA AVALIAÇÃO"||hl==="MOTIVO AVALIAÇÃO"||hl==="MOTIVO_AVALIACAO")colMot=c;}
        if(colNup===-1)continue;
        if(colLink===-1){colLink=12;}if(colStatus===-1){colStatus=6;}if(colSR===-1){colSR=13;}if(colMot===-1){colMot=14;}
        for(var i=1;i<vals.length;i++){
          if(String(vals[i][colNup]).trim()===String(nupB).trim()){
            aba.getRange(i+1,colSR+1).setValue(decisao);
            if(decisao==="APROVADO") {
              var val = (aba.getName() === "AUTOS") ? "FAZER DESPACHO" : "FAZER CI";
              aba.getRange(i+1,colStatus+1).setValue(val);
            } else if(decisao==="REPROVADO") {
              var val = (aba.getName() === "AUTOS") ? "AGUARDANDO MANIFESTAÇÃO" : "AGUARDANDO MANIFESTAÇÃO TÉCNICA";
              aba.getRange(i+1,colStatus+1).setValue(val);
            }
            aba.getRange(i+1,colMot+1).setValue(motivo);atualizado=true;break;}}
        if(atualizado)break;}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"AVALIAÇÃO DA MANIFESTAÇÃO: "+decisao,motivo]);
      if(decisao==="REPROVADO"&&abaReprovacoes)abaReprovacoes.appendRow([dataAtual,nupB,motivo]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── CADASTRAR OFÍCIO ───────────────────────────────────
    if (data.acao === "cadastrar_oficio") {
      var fc=data.base64,fn=data.fileName,linkDrive="";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("1c-K2Rlm55yWngXvAGBnhLLpbMSPPKqMU");
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);linkDrive=file.getUrl();}
      var abaIdx=parseInt(data.aba_destino)||0;if(abaIdx>=2)abaIdx=0;
      var abaSel=sheets[abaIdx];var vals=abaSel.getDataRange().getValues();var cab=vals[0];
      var novaLinha=new Array(cab.length).fill("");
      var mapa={"NUP":data.nup,"DATA":data.data_oficio,"TIPO":data.tipo,"COMARCA":data.comarca,
        "REFERÊNCIA":data.referencia,"REFERENCIA":data.referencia,"PRAZO":data.prazo,
        "OFÍCIO N.":data.oficio_n,"TÉCNICO/ADMIN":data.tecnico,"GERÊNCIA":data.gerencia,
        "CARMS":data.carms,"OBSERVAÇÃO":data.observacao,"STATUS":"AGUARDANDO DISTRIBUIÇÃO",
        "LINK - OFÍCIO":linkDrive,"LINK OFÍCIO":linkDrive,"LINK_OFICIO":linkDrive,"LINK DO OFÍCIO":linkDrive};
      for(var c=0;c<cab.length;c++){var cn=String(cab[c]).trim().toUpperCase();
        if(mapa[cn]!==undefined)novaLinha[c]=mapa[cn];else if(cn==="OFÍCIO")novaLinha[c]=data.oficio_n;}
      abaSel.appendRow(novaLinha);
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"OFÍCIO CADASTRADO NO SISTEMA",data.tecnico]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── BUSCAR AUTOS ───────────────────────────────────────
    if (data.acao === "buscar_autos") {
      var todos=[];
      if(abaAutos){var vals=abaAutos.getDataRange().getDisplayValues();
        if(vals.length>1){var cab=vals[0].map(function(h){return String(h).trim().toUpperCase();});
          for(var i=1;i<vals.length;i++){var obj={};for(var c=0;c<cab.length;c++)obj[cab[c]]=vals[i][c];
            var nv=obj['NUP']||obj['PROCESSO']||obj['PROCESSO/NUP']||obj['NUP INICIAL'];if(nv){obj['NUP']=nv;todos.push(obj);}}}}
      return ContentService.createTextOutput(JSON.stringify({status:"success",dados:todos})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── BUSCAR EXTERNOS ────────────────────────────────────
    if (data.acao === "buscar_externos") {
      var todos=[];
      if(abaExternos){var vals=abaExternos.getDataRange().getDisplayValues();
        if(vals.length>1){var cab=vals[0].map(function(h){return String(h).trim().toUpperCase();});
          for(var i=1;i<vals.length;i++){var obj={};for(var c=0;c<cab.length;c++)obj[cab[c]]=vals[i][c];
            var nv=obj['NUP']||obj['PROCESSO']||obj['PROCESSO/NUP']||obj['NUP INICIAL'];if(nv){obj['NUP']=nv;todos.push(obj);}}}}
      return ContentService.createTextOutput(JSON.stringify({status:"success",dados:todos})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── CADASTRAR EXTERNO ──────────────────────────────────
    if (data.acao === "cadastrar_externo") {
      var fc=data.base64,fn=data.fileName,linkDrive=data.linkDrive||"";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("1aj7ZO5Va91f8725h_S5vKo7OUqazET7d");
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn||data.nup+"_Externo.pdf"));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);linkDrive=file.getUrl();}
      var vals=abaExternos.getDataRange().getValues();
      if(vals.length>0){var cab=vals[0];var novaLinha=new Array(cab.length).fill("");
        var mapa={"NUP":data.nup,"DATA DE RECEBIMENTO":data.data_recebimento,"ASSUNTO":data.assunto,
          "REMETENTE":data.remetente,"CARMS":data.carms,"TÉCNICO/ADMIN":data.tecnico,
          "STATUS":data.status_atual,"DATA DE REPASSE":data.data_repasse,"DATA DETERMINO":data.data_determino,
          "OBSERVAÇÕES":data.observacao,"LINK DO NUP":linkDrive,"LINK-NUP":linkDrive,
          "LINK NUP":linkDrive,"LINK_NUP":linkDrive,"LINK":linkDrive};
        for(var c=0;c<cab.length;c++){var cn=String(cab[c]).trim().toUpperCase();if(mapa[cn]!==undefined)novaLinha[c]=mapa[cn];}
        abaExternos.appendRow(novaLinha);
        if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"OFÍCIO EXTERNO CADASTRADO",data.tecnico]);
        SpreadsheetApp.flush();}
      return ContentService.createTextOutput(JSON.stringify({status:"success",message:"Ofício Externo cadastrado!",url:linkDrive})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── CADASTRAR AUTO ─────────────────────────────────────
    if (data.acao === "cadastrar_auto") {
      var fc=data.base64,fn=data.fileName,linkDrive="";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("1aj7ZO5Va91f8725h_S5vKo7OUqazET7d");
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn||data.nup+"_Auto.pdf"));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);linkDrive=file.getUrl();}
      if(abaAutos){var vals=abaAutos.getDataRange().getValues();
        if(vals.length>0){var cab=vals[0];var novaLinha=new Array(cab.length).fill("");
          var mapa={"NUP":data.nup,"REQUERENTE":data.requerente,"AUTO DE INFRAÇÃO":data.auto_infracao,
            "LAUDO DE CONSTATAÇÃO":data.laudo,"NOTIFICAÇÃO":data.notificacao,
            "DATA DE REPASSE":data.data_repasse,"SETOR":data.setor,"STATUS ATUAL":data.status_atual,
            "TIPO":data.tipo,"TÉCNICO":data.tecnico,"FISICO/E-MS":data.fisico_ems,
            "LINK NUP":linkDrive,"LINK-NUP":linkDrive,"LINK DO NUP":linkDrive,"LINK_NUP":linkDrive,"LINK":linkDrive};
          for(var c=0;c<cab.length;c++){var cn=String(cab[c]).trim().toUpperCase();if(mapa[cn]!==undefined)novaLinha[c]=mapa[cn];}
          abaAutos.appendRow(novaLinha);
          if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"AUTO DE INFRAÇÃO CADASTRADO",data.tecnico]);
          SpreadsheetApp.flush();}}
      return ContentService.createTextOutput(JSON.stringify({status:"success",message:"Auto cadastrado!",url:linkDrive})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── BUSCAR CARTAS ──────────────────────────────────────
    if (data.acao === "buscar_cartas") {
      var abaC=getAbaCartas(sheetDb,sheets),todos=[];
      if(abaC){var vals=abaC.getDataRange().getDisplayValues();
        if(vals.length>1){var cab=vals[0].map(function(h){return String(h).trim().toUpperCase();});
          for(var i=1;i<vals.length;i++){var obj={};for(var c=0;c<cab.length;c++)obj[cab[c]]=vals[i][c];
            var nv=obj['NUP']||obj['PROCESSO']||obj['PROCESSO/NUP'];if(nv){obj['NUP']=nv;todos.push(obj);}}}}
      return ContentService.createTextOutput(JSON.stringify({status:"success",dados:todos})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── DOWNLOAD DRIVE FILE (Para Shapefile) ───────────────
    if (data.acao === "download_drive_file") {
      try {
        var fileId = data.fileId;
        var file = DriveApp.getFileById(fileId);
        var blob = file.getBlob();
        var bytes = blob.getBytes();
        var base64 = Utilities.base64Encode(bytes);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          base64: base64,
          fileName: file.getName(),
          mimeType: blob.getContentType()
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (err) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          message: "Erro ao ler arquivo do Drive: " + err.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── CADASTRAR CARTA CONSULTA ────────────────────────────
    if (data.acao === "cadastrar_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var fc=data.base64,fn=data.fileName,linkDrive="";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("14DqSHchmIZfBJ5_Ew_Y0lbM2m7VEieZS"); // Pasta: Cartas Consulta (PDFs originais)
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn||data.nup+"_Carta.pdf"));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);linkDrive=file.getUrl();}
      var linkShapefileUrl = "";
      var fcs=data.base64Shape,fns=data.fileNameShape;
      if(fcs){if(fcs.indexOf(',')>-1)fcs=fcs.split(',')[1];
        var folderShape=DriveApp.getFolderById("14DqSHchmIZfBJ5_Ew_Y0lbM2m7VEieZS"); // Pasta: Cartas Consulta (Shapefiles/ZIPs)
        var fileShape=folderShape.createFile(Utilities.newBlob(Utilities.base64Decode(fcs),"application/zip",fns||data.nup+"_Shape.zip"));
        fileShape.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);linkShapefileUrl=fileShape.getUrl();}
      var vals=abaC.getDataRange().getValues();var cab=vals[0];
      var novaLinha=new Array(cab.length).fill("");var cols=getColunasCartas(cab);
      
      // Garante que a coluna Q (índice 16) possui o cabeçalho e está mapeada
      if (cols.prazo === -1) {
        cols.prazo = 16;
        if (cab.length <= 16) {
          abaC.getRange(1, 17).setValue("PRAZO");
          while (novaLinha.length <= 16) {
            novaLinha.push("");
          }
        }
      }

      var m={};
      if(cols.nup>=0)m[cols.nup]=data.nup;
      if(cols.dataRepasse>=0)m[cols.dataRepasse]=data.data_repasse;
      if(cols.requerente>=0)m[cols.requerente]=data.requerente;
      if(cols.gerencia>=0)m[cols.gerencia]=data.gerencia;
      if(cols.prioridade>=0)m[cols.prioridade]=data.prioridade;
      if(cols.fisico>=0)m[cols.fisico]=data.fisico_ems;
      if(cols.tecnico>=0)m[cols.tecnico]=data.tecnico||"";
      if(cols.status>=0)m[cols.status]=data.status||"AGUARDANDO DISTRIBUIÇÃO";
      if(cols.tramitado>=0)m[cols.tramitado]=data.tramitado_para||"";
      if(cols.obs>=0)m[cols.obs]=data.observacao||"";
      if(cols.linkNup>=0)m[cols.linkNup]=linkDrive;
      if(cols.linkShapefile>=0)m[cols.linkShapefile]=linkShapefileUrl;
      if(cols.atividade>=0)m[cols.atividade]="CARTA CONSULTA";
      if(cols.prazo>=0)m[cols.prazo]=data.prazo||"";
      for(var k in m)novaLinha[parseInt(k)]=m[k];
      abaC.appendRow(novaLinha);
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"CARTA CONSULTA CADASTRADA",data.tecnico||""]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success",url:linkDrive})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── UPLOAD RESPOSTA CARTA (Compatibilidade) ──────────────
    if (data.acao === "upload_resposta_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var fc=data.base64;if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
      var folder=DriveApp.getFolderById("1-b6Z6E3gdLHWJsVuUfdPoIFslWxREJnq"); // Pasta: Respostas das Cartas
      var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",data.fileName||"Resposta_Carta.pdf"));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      var fileUrl=file.getUrl();
      var vals=abaC.getDataRange().getValues();var cols=getColunasCartas(vals[0]);
      if(cols.nup<0||cols.linkResp<0) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Colunas não encontradas."})).setMimeType(ContentService.MimeType.JSON);
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          abaC.getRange(i+1,cols.linkResp+1).setValue(fileUrl);
          if(cols.status>=0)abaC.getRange(i+1,cols.status+1).setValue("REVISÃO");
          if(cols.statusResp>=0)abaC.getRange(i+1,cols.statusResp+1).setValue("");
          if(cols.motivo>=0)abaC.getRange(i+1,cols.motivo+1).setValue("");break;}}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"UPLOAD DE RESPOSTA (CARTA)",fileUrl]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success",url:fileUrl})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── REMOVER RESPOSTA CARTA (Compatibilidade) ─────────────
    if (data.acao === "remover_resposta_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var vals=abaC.getDataRange().getValues();var cols=getColunasCartas(vals[0]);
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          if(cols.linkResp>=0)abaC.getRange(i+1,cols.linkResp+1).setValue("");
          if(cols.status>=0)abaC.getRange(i+1,cols.status+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");
          if(cols.statusResp>=0)abaC.getRange(i+1,cols.statusResp+1).setValue("");
          if(cols.motivo>=0)abaC.getRange(i+1,cols.motivo+1).setValue("");break;}}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"RESPOSTA REMOVIDA (CARTA)",""]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ANEXAR RESPOSTA DOCUMENTO CARTA (Manifestação / Declaração) ────────
    if (data.acao === "anexar_resposta_documento_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      
      var fc=data.base64; if(fc.indexOf(',')>-1) fc=fc.split(',')[1];
      var folder=DriveApp.getFolderById("1-b6Z6E3gdLHWJsVuUfdPoIFslWxREJnq"); // Pasta: Respostas das Cartas
      var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",data.fileName||"Resposta_Carta.pdf"));
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
      var fileUrl=file.getUrl();
      
      var vals=abaC.getDataRange().getValues(); var cols=getColunasCartas(vals[0]);
      if(cols.nup<0) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Coluna NUP não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      
      var colManifestacao = cols.linkManifestacao >= 0 ? cols.linkManifestacao : cols.linkResp;
      var colDeclaracao = cols.linkDeclaracao >= 0 ? cols.linkDeclaracao : 15; // coluna P (0-based index 15)
      
      // Cria a coluna de declaração se ela não existir
      if (colDeclaracao === -1 || (colDeclaracao === 15 && vals[0].length <= 15)) {
        colDeclaracao = 15;
        abaC.getRange(1, colDeclaracao + 1).setValue("LINK DA DECLARAÇÃO");
      }
      
      var tipo = data.tipo; // "manifestacao" ou "declaracao"
      var colDestino = (tipo === "manifestacao") ? colManifestacao : colDeclaracao;
      
      if (colDestino < 0) {
        return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Coluna de destino para " + tipo + " não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      }
      
      var encontrado = false;
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          abaC.getRange(i+1, colDestino+1).setValue(fileUrl);
          
          // Se for manifestação, também atualiza linkResp para compatibilidade histórica
          if (tipo === "manifestacao" && cols.linkManifestacao >= 0 && cols.linkResp >= 0) {
            abaC.getRange(i+1, cols.linkResp+1).setValue(fileUrl);
          }
          
          if(cols.status>=0) abaC.getRange(i+1,cols.status+1).setValue("REVISÃO");
          if(cols.statusResp>=0) abaC.getRange(i+1,cols.statusResp+1).setValue("");
          if(cols.motivo>=0) abaC.getRange(i+1,cols.motivo+1).setValue("");
          encontrado = true;
          break;
        }
      }
      
      if (encontrado) {
        if(abaTramitacao) abaTramitacao.appendRow([dataAtual,data.nup,"ANEXAR " + tipo.toUpperCase() + " (CARTA)",fileUrl]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success",url:fileUrl})).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP " + data.nup + " não encontrado."})).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── REMOVER RESPOSTA DOCUMENTO CARTA (Manifestação / Declaração) ────────
    if (data.acao === "remover_resposta_documento_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      
      var vals=abaC.getDataRange().getValues(); var cols=getColunasCartas(vals[0]);
      if(cols.nup<0) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Coluna NUP não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      
      var colManifestacao = cols.linkManifestacao >= 0 ? cols.linkManifestacao : cols.linkResp;
      var colDeclaracao = cols.linkDeclaracao >= 0 ? cols.linkDeclaracao : 15;
      
      var tipo = data.tipo; // "manifestacao" ou "declaracao"
      var colDestino = (tipo === "manifestacao") ? colManifestacao : colDeclaracao;
      
      var encontrado = false;
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          abaC.getRange(i+1, colDestino+1).setValue("");
          
          if (tipo === "manifestacao" && cols.linkManifestacao >= 0 && cols.linkResp >= 0) {
            abaC.getRange(i+1, cols.linkResp+1).setValue("");
          }
          
          // Verifica se ambos os documentos estão agora em branco
          var valM = (tipo === "manifestacao") ? "" : String(vals[i][colManifestacao]).trim();
          var valD = (tipo === "declaracao") ? "" : String(vals[i][colDeclaracao]).trim();
          
          var temM = valM && valM.startsWith("http");
          var temD = valD && valD.startsWith("http");
          
          if (!temM && !temD) {
            if(cols.status>=0) abaC.getRange(i+1,cols.status+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");
            if(cols.statusResp>=0) abaC.getRange(i+1,cols.statusResp+1).setValue("");
            if(cols.motivo>=0) abaC.getRange(i+1,cols.motivo+1).setValue("");
          }
          encontrado = true;
          break;
        }
      }
      
      if (encontrado) {
        if(abaTramitacao) abaTramitacao.appendRow([dataAtual,data.nup,"REMOVER " + tipo.toUpperCase() + " (CARTA)",""]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP " + data.nup + " não encontrado."})).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ── AVALIAR RESPOSTA CARTA ─────────────────────────────
    if (data.acao === "avaliar_resposta_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var decisao=data.decisao,motivo=data.motivo||"";
      var vals=abaC.getDataRange().getValues();var cols=getColunasCartas(vals[0]);
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          if(cols.statusResp>=0)abaC.getRange(i+1,cols.statusResp+1).setValue(decisao);
          if(cols.motivo>=0)abaC.getRange(i+1,cols.motivo+1).setValue(motivo);
          if(cols.status>=0){var ns=decisao==="APROVADO"?"AGUARDANDO ASSINATURA":"AGUARDANDO MANIFESTAÇÃO TÉCNICA";
            abaC.getRange(i+1,cols.status+1).setValue(ns);}break;}}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"AVALIAÇÃO DE RESPOSTA (CARTA): "+decisao,motivo]);
      if(decisao==="REPROVADO"&&abaReprovacoes)abaReprovacoes.appendRow([dataAtual,data.nup,motivo]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ATRIBUIR TÉCNICO CARTA ─────────────────────────────
    if (data.acao === "atribuir_tecnico_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var vals=abaC.getDataRange().getValues();var cols=getColunasCartas(vals[0]);
      var dataHoje=Utilities.formatDate(new Date(),"GMT-3","dd/MM/yyyy");
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          if(cols.tecnico>=0)abaC.getRange(i+1,cols.tecnico+1).setValue(data.tecnico);
          if(cols.status>=0)abaC.getRange(i+1,cols.status+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");
          if(cols.dataRepasse>=0)abaC.getRange(i+1,cols.dataRepasse+1).setValue(dataHoje);break;}}
      if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"TÉCNICO ATRIBUÍDO (CARTA)",data.tecnico]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ANEXAR PDF ORIGINAL EXTERNO ────────────────────────
    if (data.acao === "anexar_pdf_original_externo") {
      var nupB=data.nup,fc=data.base64,fn=data.fileName,fileUrl="";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("1aj7ZO5Va91f8725h_S5vKo7OUqazET7d");
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);fileUrl=file.getUrl();}
      var atualizado=false;
      if(abaExternos){var vals=abaExternos.getDataRange().getValues();
        if(vals.length>0){var cab=vals[0],colNup=-1,colLinkNup=-1;
          for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
            if(hl==="NUP")colNup=c;
            if(hl==="LINK DO NUP"||hl==="LINK NUP"||hl==="LINK_NUP"||hl==="LINK-NUP"||hl==="LINK")colLinkNup=c;}
          if(colNup!==-1&&colLinkNup!==-1){
            for(var i=1;i<vals.length;i++){
              if(String(vals[i][colNup]).trim()===String(nupB).trim()){
                abaExternos.getRange(i+1,colLinkNup+1).setValue(fileUrl);atualizado=true;break;}}}}}
      if(atualizado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"PDF ORIGINAL VINCULADO",data.username||""]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success",url:fileUrl})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+nupB+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ATUALIZAR STATUS CI ────────────────────────────────
    if (data.acao === "atualizar_status_ci") {
      var nupB=data.nup,novoStatus=data.novoStatus,atualizado=false;
      for(var s=0;s<abasProcessos.length;s++){
        var aba=abasProcessos[s];if(!aba)continue;
        var vals=aba.getDataRange().getValues();if(vals.length===0)continue;
        var cab=vals[0],colNup=-1,colStatus=-1;
        for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
          if(hl==="NUP")colNup=c;if(hl==="STATUS"||hl==="SITUAÇÃO")colStatus=c;}
        if(colNup!==-1){if(colStatus===-1)colStatus=6;
          for(var i=1;i<vals.length;i++){
            if(String(vals[i][colNup]).trim()===String(nupB).trim()){
              aba.getRange(i+1,colStatus+1).setValue(novoStatus);atualizado=true;break;}}}
        if(atualizado)break;}
      if(atualizado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"ATUALIZAÇÃO DE STATUS CI: "+novoStatus,data.username]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+nupB+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ATRIBUIR TÉCNICO OFÍCIO ────────────────────────────
    if (data.acao === "atribuir_tecnico_oficio") {
      var nupB=data.nup,tecnico=data.tecnico,atualizado=false;
      for(var s=0;s<abasProcessos.length;s++){
        var aba=abasProcessos[s];if(!aba)continue;
        var vals=aba.getDataRange().getValues();if(vals.length===0)continue;
        var cab=vals[0],colNup=-1,colTec=-1,colStatus=-1;
        for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
          if(hl==="NUP")colNup=c;
          if(hl==="TÉCNICO/ADMIN"||hl==="TECNICO/ADMIN"||hl==="TÉCNICO"||hl==="TECNICO")colTec=c;
          if(hl==="STATUS"||hl==="SITUAÇÃO")colStatus=c;}
        if(colNup!==-1&&colTec!==-1){if(colStatus===-1)colStatus=6;
          for(var i=1;i<vals.length;i++){
            if(String(vals[i][colNup]).trim()===String(nupB).trim()){
              aba.getRange(i+1,colTec+1).setValue(tecnico);
              if(String(vals[i][colStatus]).toUpperCase()==="AGUARDANDO DISTRIBUIÇÃO")
                aba.getRange(i+1,colStatus+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");
              atualizado=true;break;}}}
        if(atualizado)break;}
      if(atualizado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"TÉCNICO ATRIBUÍDO",tecnico]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+nupB+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ATRIBUIR TÉCNICO AUTO ──────────────────────────────
    if (data.acao === "atribuir_tecnico_auto") {
      var nupB=data.nup,tecnico=data.tecnico,atualizado=false;
      if(abaAutos){var vals=abaAutos.getDataRange().getValues();
        if(vals.length>0){var cab=vals[0],colNup=-1,colTec=-1,colStatus=-1;
          for(var c=0;c<cab.length;c++){var hl=String(cab[c]).trim().toUpperCase();
            if(hl==="NUP")colNup=c;
            if(hl==="TÉCNICO/ADMIN"||hl==="TECNICO/ADMIN"||hl==="TÉCNICO"||hl==="TECNICO")colTec=c;
            if(hl==="STATUS ATUAL"||hl==="STATUS"||hl==="SITUAÇÃO")colStatus=c;}
          if(colNup!==-1&&colTec!==-1){
            for(var i=1;i<vals.length;i++){
              if(String(vals[i][colNup]).trim()===String(nupB).trim()){
                abaAutos.getRange(i+1,colTec+1).setValue(tecnico);
                if (colStatus !== -1) {
                  abaAutos.getRange(i+1,colStatus+1).setValue("AGUARDANDO MANIFESTAÇÃO");
                }
                atualizado=true;break;}}}}}
      if(atualizado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nupB,"TÉCNICO ATRIBUÍDO A AUTO",tecnico]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success"})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+nupB+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ATRIBUIR TÉCNICO EXTERNO ───────────────────────────
    if (data.acao === "atribuir_tecnico_externo") {
      if(!abaExternos) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Externos não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var vals=abaExternos.getDataRange().getValues();var nup=data.nup;var tecnico=data.tecnico;
      var dataHoje=Utilities.formatDate(new Date(),"GMT-3","dd/MM/yyyy");
      var headers=vals[0],colNup=-1,colTec=-1,colStatus=-1,colDataRep=-1;
      for(var c=0;c<headers.length;c++){var hl=String(headers[c]).trim().toUpperCase();
        if(hl==="NUP")colNup=c;
        if(hl==="TÉCNICO/ADMIN"||hl==="TECNICO/ADMIN"||hl==="TÉCNICO"||hl==="TECNICO")colTec=c;
        if(hl==="STATUS"||hl==="SITUAÇÃO")colStatus=c;
        if(hl==="DATA DE REPASSE"||hl==="DATA REPASSE"||hl==="DATA DE ATRIBUIÇÃO"||hl==="DATA_REPASSE")colDataRep=c;}
      if(colNup===-1||colTec===-1) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Colunas NUP/TÉCNICO não encontradas."})).setMimeType(ContentService.MimeType.JSON);
      var encontrado=false;
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][colNup]).trim()===String(nup).trim()){
          abaExternos.getRange(i+1,colTec+1).setValue(tecnico);
          if(colStatus!==-1)abaExternos.getRange(i+1,colStatus+1).setValue("AGUARDANDO MANIFESTAÇÃO TÉCNICA");
          if(colDataRep!==-1)abaExternos.getRange(i+1,colDataRep+1).setValue(dataHoje);
          encontrado=true;break;}}
      if(encontrado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,nup,"TÉCNICO ATRIBUÍDO A OFÍCIO EXTERNO",tecnico]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success",dataRepasse:dataHoje})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+nup+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ANEXAR PDF ORIGINAL CARTA ──────────────────────────
    if (data.acao === "anexar_pdf_original_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var fc=data.base64,fn=data.fileName,fileUrl="";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("14DqSHchmIZfBJ5_Ew_Y0lbM2m7VEieZS");
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/pdf",fn));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);fileUrl=file.getUrl();}
      var vals=abaC.getDataRange().getValues();var cols=getColunasCartas(vals[0]);
      if(cols.nup<0||cols.linkNup<0) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Colunas NUP/LINK DO NUP não encontradas."})).setMimeType(ContentService.MimeType.JSON);
      var encontrado=false;
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          abaC.getRange(i+1,cols.linkNup+1).setValue(fileUrl);encontrado=true;break;}}
      if(encontrado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"PDF ORIGINAL VINCULADO (CARTA)",fileUrl]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success",url:fileUrl})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+data.nup+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

    // ── ANEXAR SHAPEFILE CARTA ─────────────────────────────
    if (data.acao === "anexar_shapefile_carta") {
      var abaC=getAbaCartas(sheetDb,sheets);
      if(!abaC) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Aba de Cartas não encontrada."})).setMimeType(ContentService.MimeType.JSON);
      var fc=data.base64,fn=data.fileName,fileUrl="";
      if(fc){if(fc.indexOf(',')>-1)fc=fc.split(',')[1];
        var folder=DriveApp.getFolderById("14DqSHchmIZfBJ5_Ew_Y0lbM2m7VEieZS");
        var file=folder.createFile(Utilities.newBlob(Utilities.base64Decode(fc),"application/zip",fn));
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);fileUrl=file.getUrl();}
      var vals=abaC.getDataRange().getValues();var cols=getColunasCartas(vals[0]);
      if(cols.nup<0||cols.linkShapefile<0) return ContentService.createTextOutput(JSON.stringify({status:"error",message:"Colunas NUP/LINK SHAPEFILE não encontradas."})).setMimeType(ContentService.MimeType.JSON);
      var encontrado=false;
      for(var i=1;i<vals.length;i++){
        if(String(vals[i][cols.nup]).trim()===String(data.nup).trim()){
          abaC.getRange(i+1,cols.linkShapefile+1).setValue(fileUrl);encontrado=true;break;}}
      if(encontrado){if(abaTramitacao)abaTramitacao.appendRow([dataAtual,data.nup,"SHAPEFILE VINCULADO (CARTA)",fileUrl]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({status:"success",url:fileUrl})).setMimeType(ContentService.MimeType.JSON);}
      return ContentService.createTextOutput(JSON.stringify({status:"error",message:"NUP "+data.nup+" não encontrado."})).setMimeType(ContentService.MimeType.JSON);
    }

  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({status:"error",message:error.toString()})).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}
