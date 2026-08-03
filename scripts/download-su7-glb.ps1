<#
.SYNOPSIS
    AutoLaunch v0.1 · Xiaomi SU7 Ultra GLB 一键下载脚本
.DESCRIPTION
    将 Sketchfab 发布的 2025 Xiaomi SU7 Ultra
    (Ddiaz Design, CC BY-NC-SA 4.0) 下载到 public/assets/su7_ultra.glb。
    因 Sketchfab 下载接口需要浏览器登录态，脚本默认检查本地是否已有模型，
    若无则打开模型页面供用户手动下载，下载后放到脚本要求的路径即可。
.NOTES
    模型来源: https://skfb.ly/pKv9Z
    许可证 : CC BY-NC-SA 4.0 (非商业使用 + 署名 + 相同方式共享)
    作者   : Ddiaz Design
    合规   : 任何公开展示必须同时保留原作者、Sketchfab 来源、
             CC BY-NC-SA 4.0 许可及"非官方概念演示"声明。
#>

param(
    [string]$TargetPath = "public\assets\su7_ultra.glb",
    [string]$FallbackLocalPath = "su7_ultra.glb"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host " AutoLaunch · SU7 Ultra GLB 准备脚本" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor DarkCyan
Write-Host ""

# 1. 保证目标目录存在
$TargetDir = Split-Path -Parent $TargetPath
if (-not (Test-Path $TargetDir)) {
    New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
    Write-Host "[OK] 创建目标目录: $TargetDir" -ForegroundColor Green
}

# 2. 若目标已存在则跳过
if (Test-Path $TargetPath) {
    $Size = (Get-Item $TargetPath).Length / 1MB
    Write-Host "[Skip] $TargetPath 已存在 ( $([math]::Round($Size, 2)) MB )，无需重复下载。" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# 3. 回退：若根目录已有 su7_ultra.glb（用户手动放的），直接复制
if (Test-Path $FallbackLocalPath) {
    $Size = (Get-Item $FallbackLocalPath).Length / 1MB
    Write-Host "[Copy] 发现根目录 $FallbackLocalPath ( $([math]::Round($Size, 2)) MB )" -ForegroundColor Cyan
    Copy-Item $FallbackLocalPath $TargetPath -Force
    Write-Host "[OK] 已复制到 $TargetPath" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# 4. 无法自动下载：提示用户操作
$ModelUrl = "https://skfb.ly/pKv9Z"

Write-Host "[!] 当前无法自动下载 Sketchfab 资源（需浏览器登录态）。" -ForegroundColor Magenta
Write-Host ""
Write-Host "请按以下 3 步手动完成：" -ForegroundColor White
Write-Host ""
Write-Host "  1) 在浏览器中打开 Sketchfab 模型页并登录（免费）："
Write-Host "     $ModelUrl"
Write-Host ""
Write-Host "  2) 点击右侧 Download 按钮，下载 glTF Binary (.glb) 文件。"
Write-Host ""
Write-Host "  3) 将下载得到的 .glb 文件："
Write-Host "     - 方案 A（推荐，脚本下次自动处理）：放到项目根目录并命名为 su7_ultra.glb，然后重新运行本脚本。"
Write-Host "     - 方案 B（直接）：直接拷贝到 $TargetPath"
Write-Host ""

# 尝试帮用户打开浏览器
try {
    Start-Process $ModelUrl | Out-Null
    Write-Host "[Info] 已尝试在默认浏览器中打开下载页面。" -ForegroundColor Gray
}
catch {
    Write-Host "[Info] 请手动复制上方 URL 到浏览器打开。" -ForegroundColor Gray
}

Write-Host ""
Write-Host "完成后重新运行： .\scripts\download-su7-glb.ps1" -ForegroundColor DarkGray
exit 1
