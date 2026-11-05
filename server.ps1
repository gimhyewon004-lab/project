# Cat Sticker WebApp Static HTTP Server
param(
  [int]$Port = 8088
)

$HostIP = "127.0.0.1"
$Root = $PSScriptRoot
if (-not $Root) { $Root = Get-Location }

$listener = New-Object System.Net.HttpListener
$prefix = "http://$HostIP`:$Port/"
$listener.Prefixes.Add($prefix)

try {
  $listener.Start()
  Write-Host "==========================================================" -ForegroundColor Green
  Write-Host "🐾 고양이 스티커 다이어리 웹서버가 시작되었습니다!" -ForegroundColor Yellow
  Write-Host "👉 브라우저 주소: $prefix" -ForegroundColor Cyan
  Write-Host "종료하려면 Ctrl+C 를 누르세요." -ForegroundColor Gray
  Write-Host "==========================================================" -ForegroundColor Green

  # Open default browser
  Start-Process $prefix

  $mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".ogg"  = "audio/ogg"
    ".wav"  = "audio/wav"
    ".mp3"  = "audio/mpeg"
  }

  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    # Add CORS headers
    $response.Headers.Add("Access-Control-Allow-Origin", "*")

    $rawUrl = $request.RawUrl.Split('?')[0]
    if ($rawUrl -eq "/" -or [string]::IsNullOrEmpty($rawUrl)) {
      $rawUrl = "/index.html"
    }

    $filePath = [System.IO.Path]::Combine($Root, $rawUrl.TrimStart('/'))

    if ([System.IO.File]::Exists($filePath)) {
      $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
      $contentType = $mimeTypes[$ext]
      if (-not $contentType) { $contentType = "application/octet-stream" }
      $response.ContentType = $contentType

      $buffer = [System.IO.File]::ReadAllBytes($filePath)
      $response.ContentLength64 = $buffer.Length
      $response.OutputStream.Write($buffer, 0, $buffer.Length)
    } else {
      $response.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found")
      $response.OutputStream.Write($msg, 0, $msg.Length)
    }

    $response.OutputStream.Close()
  }
} catch {
  Write-Error $_
} finally {
  $listener.Stop()
  $listener.Close()
}
