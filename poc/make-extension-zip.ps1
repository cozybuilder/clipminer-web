# 배포용 ClipMiner 확장 ZIP 생성 스크립트 (Windows / PowerShell)
#
# 사용자는 이 ZIP 하나만 받아 압축을 풀고 chrome://extensions 에서
# "압축해제된 확장 프로그램을 로드"로 ClipMiner 폴더를 선택하면 설치된다.
#
# 사용법 (프로젝트 루트에서):
#   powershell -ExecutionPolicy Bypass -File poc/make-extension-zip.ps1
#
# 결과물: public/clipminer-extension.zip
#   압축 해제 시 구조 → ClipMiner/manifest.json, background.js, content.js, web-bridge.js
#
# manifest.json / *.js 를 수정하면 반드시 이 스크립트를 다시 실행해 ZIP을 갱신한다.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot          # 프로젝트 루트
$src  = Join-Path $root "poc/douyin-extractor"
$out  = Join-Path $root "public/clipminer-extension.zip"
$stage = Join-Path $env:TEMP ("clipminer-ext-" + [guid]::NewGuid().ToString("N"))
$pkg  = Join-Path $stage "ClipMiner"             # 사용자가 선택할 폴더명

# 배포 포함 파일 (개발용 README 는 제외)
$files = @("manifest.json", "background.js", "content.js", "web-bridge.js")

New-Item -ItemType Directory -Path $pkg -Force | Out-Null
foreach ($f in $files) {
  Copy-Item (Join-Path $src $f) (Join-Path $pkg $f) -Force
}

if (Test-Path $out) { Remove-Item $out -Force }
Compress-Archive -Path $pkg -DestinationPath $out -Force
Remove-Item $stage -Recurse -Force

$size = [math]::Round((Get-Item $out).Length / 1KB, 1)
Write-Output "OK  $out  ($size KB)  files: $($files -join ', ')"
