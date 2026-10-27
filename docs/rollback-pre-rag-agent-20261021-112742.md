# RAG/Agent 开发前基线与回退记录

保存时间：2026-10-21 11:27:42（Asia/Shanghai）。本次仅保存版本和验证恢复，未修改 RAG/Agent 业务代码。

## 基线身份

- 原始分支：`main`
- 原始 HEAD / 基线完整 SHA：`0e59f09bc070f33636df98f2d9f51f302e2b4416`
- Annotated tag：`baseline/pre-rag-agent-20261021-112742`
- 开发分支：`codex/rag-agent-20261021-112742`
- 本机备份：`C:\Users\11873\AutoLaunch-backups\pre-rag-agent-20261021-112742`
- 已验证恢复目录：`C:\Users\11873\AutoLaunch-backups\pre-rag-agent-20261021-112742\restore-validation`

清点时 `git status --porcelain=v1 --untracked-files=all` 为空，没有暂存、未暂存或非忽略未跟踪变更，因此直接复用原有提交。Git 忽略项另外保存；没有仅记录 HEAD 就视为完整备份。标签说明记录了原始分支、提交和备份位置。未推送任何分支、标签或备份。

## 覆盖范围与清单

`files/` 按仓库相对路径保存 232 个文件，共 512,011,730 字节，包括全部已跟踪文件，以及本机 `.env`、AGENTS.md、docs、scripts、skills、.trae、原始模型和纹理、glb-nodes.json、截图、视频及 .tmp 中的现有材料。保留现有素材与署名文件，不改变素材许可证。`.env` 仅保存在本机，未写入文档或提交；部署关联配置也保存在本地备份中。

- `files-sha256.json`：逐文件相对路径、字节数、SHA-256、tracked/ignored/untracked 分类。
- `repository.bundle`：本地 Git 历史和 refs，可在原仓库不可用时独立克隆。
- `metadata.json`、`initial-status.txt`、`ignored-status.txt`、`index.txt`：初始状态和身份。
- `environment.json`、`npm-environment.json`、`python-environment.txt`：环境和依赖记录。依赖记录可能含本机信息，仅留在备份目录。
- `baseline-*.log` / `baseline-results.json`：原工作目录测试和构建结果。
- `restore-*.log` / `restore-results.json`、`restore-integrity.json`：独立恢复、安装、测试和构建结果。
- `service-audit.json`：服务相关文件路径与指标分类，不含配置值。
- `evidence-sha256.json`：备份元数据、Git bundle 和验证记录的 SHA-256。

未保存可再生成的 node_modules、dist、构建缓存、Python 缓存、tsbuildinfo 和日志；package-lock.json 已保存。空目录不纳入逐文件清单。对 .tmp 和媒体采用保守保留策略，不删除用户材料。

## 环境与验证结果

Node v24.14.0；npm 11.9.0；Python 3.13.5；Git 2.52.0.windows.1。项目当前实际为 Vite 静态前端；server 目录没有文件，不依据历史规则宣称 FastAPI 已存在。

1. 标签解析到上述完整 SHA，Git bundle verify 成功。
2. 备份 232/232 个文件校验成功；独立检出并覆盖恢复后，232/232 个文件校验成功，已跟踪工作区干净。
3. 原目录：npm test 成功，7 个文件 / 83 条测试通过；npm run build 成功，无已有失败。
4. 恢复目录：npm ci --no-audit --no-fund 成功；npm test 成功，7 个文件 / 83 条测试通过；npm run build 成功。
5. 恢复检查在独立目录进行，未覆盖当前工作目录，没有执行 reset --hard 或 clean。

仅核验文件、依赖安装、自动化测试和生产构建；未进行浏览器视觉、麦克风或完整 90 秒演示验收。后续环境升级或包源不可用仍可能影响重新安装；node_modules 未离线归档。

## 默认回退：恢复到新的独立目录

以下 PowerShell 命令保留当前开发目录及新版本成果。目标目录已存在时停止，避免覆盖。命令中的标签、SHA 和路径均对应本次真实备份。

```powershell
$backupRoot = 'C:\Users\11873\AutoLaunch-backups\pre-rag-agent-20261021-112742'
$restoreRoot = 'C:\Users\11873\AutoLaunch-backups\pre-rag-agent-20261021-112742\restore-on-demand-20261021-112742'
if (Test-Path -LiteralPath $restoreRoot) { throw '恢复目标已存在，请保留现有目录，另选新的独立目录。' }

# 先核验备份及验证记录。
$evidence = Get-Content -LiteralPath (Join-Path $backupRoot 'evidence-sha256.json') -Raw | ConvertFrom-Json
foreach ($item in $evidence) {
    $file = Join-Path $backupRoot $item.path
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "证据文件校验失败：$($item.path)" }
}
$manifest = Get-Content -LiteralPath (Join-Path $backupRoot 'files-sha256.json') -Raw | ConvertFrom-Json
foreach ($item in $manifest) {
    $source = Join-Path (Join-Path $backupRoot 'files') $item.path
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "备份校验失败：$($item.path)" }
}

git clone --no-checkout (Join-Path $backupRoot 'repository.bundle') $restoreRoot
if ($LASTEXITCODE -ne 0) { throw '克隆失败' }
git -C $restoreRoot checkout --detach 'baseline/pre-rag-agent-20261021-112742'
if ($LASTEXITCODE -ne 0) { throw '检出失败' }
if ((git -C $restoreRoot rev-parse HEAD) -ne '0e59f09bc070f33636df98f2d9f51f302e2b4416') { throw '基线提交不匹配' }

foreach ($item in $manifest) {
    $source = Join-Path (Join-Path $backupRoot 'files') $item.path
    $target = Join-Path $restoreRoot $item.path
    [System.IO.Directory]::CreateDirectory((Split-Path -Parent $target)) | Out-Null
    Copy-Item -LiteralPath $source -Destination $target -Force
    if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.sha256) { throw "恢复校验失败：$($item.path)" }
}
Push-Location -LiteralPath $restoreRoot
try {
    npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败' }
    npm test
    if ($LASTEXITCODE -ne 0) { throw '测试失败' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw '构建失败' }
} finally { Pop-Location }
```

需要继续开发时，可在新恢复目录自行创建新分支；不要覆盖现有开发分支。验证过的 restore-validation 目录也保留供本机检查。

## 外部状态及未覆盖项

静态前端运行代码未发现数据库连接或需迁移的远程服务；根目录没有数据库文件，server 为空。`.env` 中存在服务/凭据指标，本地原件已经备份；未输出其值，未调用或修改对应服务。没有备份远程部署、远程数据库、云端凭据状态、DNS 或浏览器权限，也不宣称 Git 标签能恢复这些外部状态。后续若要修改任何外部服务，必须先单独核实并备份相关外部状态。

本回退文档是在基线之后新增，提交在开发分支；其副本也保存在本机备份目录。基线标签保持指向原始工作状态，不移动标签来纳入后续文档。
