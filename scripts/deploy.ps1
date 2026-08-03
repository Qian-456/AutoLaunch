param(
    [string]$BindAddress = "0.0.0.0",
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ModelPath = Join-Path $ProjectRoot "public\assets\2025_xiaomi_su7_ultra.glb"
$VirtualEnvironment = Join-Path $ProjectRoot ".venv"
$PythonExecutable = Join-Path $VirtualEnvironment "Scripts\python.exe"

Push-Location $ProjectRoot
try {
    if (-not (Test-Path -LiteralPath $ModelPath -PathType Leaf)) {
        throw "缺少模型：$ModelPath。请先准备 2025_xiaomi_su7_ultra.glb。"
    }

    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "未找到 npm，请安装 Node.js 20+。"
    }
    if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
        throw "未找到 python，请安装 Python 3.11+。"
    }

    Write-Host "[1/3] 构建 AutoLaunch 前端..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "前端构建失败。" }

    if (-not (Test-Path -LiteralPath $PythonExecutable -PathType Leaf)) {
        Write-Host "[2/3] 创建 Python 虚拟环境..." -ForegroundColor Cyan
        python -m venv $VirtualEnvironment
        if ($LASTEXITCODE -ne 0) { throw "虚拟环境创建失败。" }
    }

    if (-not $SkipInstall) {
        Write-Host "[2/3] 安装 FastAPI 部署依赖..." -ForegroundColor Cyan
        & $PythonExecutable -m pip install --disable-pip-version-check -r requirements.txt
        if ($LASTEXITCODE -ne 0) { throw "Python 依赖安装失败。" }
    }

    Write-Host "[3/3] AutoLaunch 已启动：http://localhost:$Port" -ForegroundColor Green
    & $PythonExecutable -m uvicorn server.app:create_app --factory --host $BindAddress --port $Port
}
finally {
    Pop-Location
}
