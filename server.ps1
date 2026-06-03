# C.O.R.I.N.O. - Servidor de Teste Local (PowerShell)
# Este script inicia um servidor web local super leve na porta 5500 para servir a aplicacao.

$port = 5501
$workspacePath = "c:\Users\jcoene\Desktop\CORINO - WEB"

# Garante que o HttpListener esta disponivel
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Prefixes.Add("http://127.0.0.1:$port/")

try {
    $listener.Start()
    Write-Host "`n==================================================" -ForegroundColor Green
    Write-Host " [OK] Servidor de Teste CORINO Iniciado com Sucesso!" -ForegroundColor Green
    Write-Host " [URL] Endereco Local: http://127.0.0.1:5501/login.html" -ForegroundColor Cyan
    Write-Host " Pressione Ctrl+C neste terminal para encerrar." -ForegroundColor Yellow
    Write-Host "==================================================`n" -ForegroundColor Green

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $urlPath = $request.Url.LocalPath
        
        # Remove prefixos redundantes
        $cleanUrlPath = $urlPath
        if ($cleanUrlPath.ToUpper().StartsWith("/CORINO - WEB")) {
            $cleanUrlPath = $cleanUrlPath.Substring(13)
        } elseif ($cleanUrlPath.ToUpper().StartsWith("/CORINO")) {
            $cleanUrlPath = $cleanUrlPath.Substring(7)
        }
        
        if ($cleanUrlPath -eq "/" -or $cleanUrlPath -eq "") {
            $cleanUrlPath = "/login.html"
        }
        
        $cleanUrlPath = "/" + $cleanUrlPath.TrimStart('/')
        
        # Mapeia o arquivo local
        $relPath = $cleanUrlPath.TrimStart('/').Replace('/', '\')
        $filePath = Join-Path $workspacePath $relPath
        
        Write-Host "Request: $urlPath -> Resolved: $filePath" -ForegroundColor Gray
        
        if (Test-Path $filePath -PathType Leaf) {
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $extension = [System.IO.Path]::GetExtension($filePath).ToLower()
            
            # Define o Content-Type apropriado
            switch ($extension) {
                ".html" { $response.ContentType = "text/html; charset=utf-8" }
                ".css"  { $response.ContentType = "text/css; charset=utf-8" }
                ".js"   { $response.ContentType = "application/javascript; charset=utf-8" }
                ".png"  { $response.ContentType = "image/png" }
                ".jpg"  { $response.ContentType = "image/jpeg" }
                ".jpeg" { $response.ContentType = "image/jpeg" }
                ".gif"  { $response.ContentType = "image/gif" }
                ".svg"  { $response.ContentType = "image/svg+xml" }
                ".webp" { $response.ContentType = "image/webp" }
                ".ico"  { $response.ContentType = "image/x-icon" }
                default { $response.ContentType = "application/octet-stream" }
            }
            
            # Adiciona cabecalhos CORS basicos e de cache
            $response.Headers.Add("Access-Control-Allow-Origin", "*")
            $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
            
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            # Arquivo nao encontrado
            $response.StatusCode = 404
            $errorMessage = "404 - Arquivo nao encontrado: $urlPath"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($errorMessage)
            $response.ContentType = "text/plain; charset=utf-8"
            $response.ContentLength64 = $bytes.Length
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        }
        
        $response.Close()
    }
}
catch {
    $err = $_.Exception.Message
    Write-Error "Erro ao iniciar o servidor: $err"
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
