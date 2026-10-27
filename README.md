# AutoLaunch · AI 驱动的汽车数字发布会开源框架

> **非官方概念演示 · 开源框架**
> AutoLaunch 是一个面向汽车行业的交互式数字发布会框架：AI 可以根据用户兴趣重新选择章节、镜头、车辆动作与讲解；用户可通过点击/文字/语音随时打断并接管控制权。

> 当前为可运行的 **3D VehicleAction Preview**：已实现 SU7 Ultra 模型展示、五个注册镜头、八个车辆控制按钮、文字与浏览器语音统一派发 `VehicleAction`、真实车窗升降、前后灯光以及由原始 GLB 外壳、内衬与尾翼组成的真实后备箱开合。工作室模式还提供独立“道具仓库”，可在车辆旁展示 20 寸登机箱与 24 寸托运行李箱；道具不参与车辆动作、碰撞或装载。

---

## 目录

- [项目定位](#项目定位)
- [快速开始](#快速开始)
- [SU7 Ultra 模型下载与合规声明](#su7-ultra-模型下载与合规声明)
- [版本里程碑](#版本里程碑)
- [半年 Roadmap](#半年-roadmap)
- [版权与素材授权](#版权与素材授权)

---

## 自然语言导演与 RAG（本次交付）

页面以自主探索为主：左侧选择「驾趣与性能 / 全家与装载 / 舒适与日常」，在主题详情中观察部位、提出问题或主动开始演示。底部共用一个文字与语音入口，产品问题走 RAG，明确的演示需求走 Director，直接指令（如“主驾车窗50%”）继续优先走确定性解析器。

例如输入「后备箱多大？」查看资料和车辆联动；输入「带我看看家庭出游与双箱装载」生成并播放审核过的章节。默认只显示一条对话输入栏；自动识别不符合预期时，点击输入栏的设置图标改选「了解产品 / 编排演示」。左侧对话图标可重新打开最近回答，停止按钮按播放或请求状态出现。资料与原始出处按需展开，界面不展示供应商、内部证据 ID 等诊断信息。

「光之展廊 / 暮色赛道 / 日落旷野」可独立切换，保留当前镜头、部件状态和问答。展廊使用连续拱形灯带、混凝土 PBR 与地面反射；户外采用 8K 全景背景和独立 HDR 环境光，主光方向对应旋转后的 HDR 太阳方向，供围绕车辆观察，不提供实景道路或地形仿真。背景按场景加载，整套环境素材控制在 20 MiB 内。素材在本地自托管，清单、来源、许可与处理记录见 [资产授权清单](public/assets/ASSET-LICENSES.md) 和 [资源校验清单](public/assets/environments/manifest.json)。布景载入失败会保留基础灯光和车辆控制。

默认展示闪电黄与黑黄座椅。左下角「外观自定义」展开后，可选择五种官方车色的视觉近似及三种座椅点缀色；非黄色隐藏银色拉花。面板临时替换左侧导航，并为整车留出相机安全区域，不添加遮罩。选择即时预览，完成或 Esc 收起后保留搭配，也可恢复默认。开关面板与换色不重载模型，不改变当前部件或播放状态。8K 背景提升近景清晰度，也会增加首次场景载入和显存开销；离开场景时释放背景 GPU 纹理，回访复用已缓存图片。车色未经实车色卡校准，座椅点缀是演示自定义，不代表完整官方选装配置。

环境是展示布景，不构成车辆性能、实车容量或乘坐舒适性的证明；舒适主题提供观察与资料入口，没有新增舒适性仿真或运行时人设。

常规看车镜头使用较低的机位和竖直透视校正，减少俯视下车身向一侧倾斜的观感；通过镜头移轴保持车辆焦点位于界面安全区域，不旋转或拉伸车辆模型。「容量俯视」保留原俯角，与常规镜头平滑切换；自由拖动、缩放和接管机制保持可用。

### 本地启动

需要 Node 24 / npm 11、Python 3.13。依赖实际验证版本：Node 24.14.0、npm 11.9.0、Python 3.13.5。

```powershell
npm ci
python -m venv .venv
.\.venv\Scripts\python -m pip install -r server/requirements.txt

# 终端一：后端和生产静态页面（首次先 npm run build）
.\.venv\Scripts\python -m uvicorn server.main:app --host 127.0.0.1 --port 8000

# 终端二：开发前端，/api 自动代理到 8000
npm run dev
```

开发地址为 http://localhost:5173；构建后可直接访问 http://127.0.0.1:8000。`GET /api/health` 返回模型字节数、Pack/注册表版本和已配置的供应商名称，不返回密钥。没有配置密钥时服务照常启动。

### 服务端模型配置与降级

在本机 `.env` 填写 `DEEPSEEK_API_KEY` 和/或 `QWEN_API_KEY`；不能使用 `VITE_*` 保存密钥。`.env.example` 列出全部新增变量；已有本地配置不被覆盖。后端启动时读取 `.env`，修改后重启。客户端唯一新增开关为 `VITE_ENABLE_AI_PANELS=1`。

| 供应商 | 模型 | 默认 base URL | 结构化策略 / 思考参数 |
|---|---|---|---|
| DeepSeek | `deepseek-flash` | `https://api.deepseek.com` | `json_object` + `thinking: {type: disabled}` |
| Qwen | `qwen3.8-flash` | `https://dashscope.aliyuncs.com/compatible-mode/v1`（北京兼容域名） | `json_object` + `enable_thinking: false`；可单独改为 `json_schema` |

两家分别有 `*_BASE_URL`、`*_MODEL`、`*_TIMEOUT`、`*_OUTPUT_STRATEGY`。百炼新工作空间可改用控制台给出的地域专属完整地址，如北京 `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`；新加坡、香港、弗吉尼亚有独立地域域名和密钥适用范围，不能只换模型名沿用其他地域地址。此处 WorkspaceId 是供应商文档的地址格式说明，不是已配置的本机地址。

核对日期：2026-10-21。官方依据：[DeepSeek 接口与模型名](https://api-docs.deepseek.com/)、[JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)、[DeepSeek Chat 参数](https://api-docs.deepseek.com/api/create-chat-completion/)、[百炼 OpenAI 兼容接口与地域](https://www.alibabacloud.com/help/en/model-studio/qwen-api-via-openai-chat-completions)、[Qwen 结构化输出](https://help.aliyun.com/en/model-studio/qwen-structured-output)。

默认顺序：DeepSeek → 已配置 Qwen → 本地确定性规则。每家默认最多 7 秒，整个模型流程默认 14 秒（`AI_TOTAL_TIMEOUT`），SDK 和模型输出重试均关闭。API 响应保留认证、限流、超时、服务错误、连接错误和非法输出等诊断信息；访客界面区分在线检索结果与精选资料/本地规则。两家都不配置时，导演和问答仍可在本地后端演示；后端不可用时，前端导演使用有限本地模板，问答显示不可用，不伪造检索结果。

### 契约与知识边界

- LLM 导演只能返回 `{persona, chapterIds}`；章节、字幕、时间轴、相机和动作来自审核模板。最大 6 章、120 秒，不允许重复章。当前无自由时长适配。
- 权威能力仍是 `su7-concept.pack.ts` 与 `prop-catalog.ts`。`src/pack/ai-registry.ts` 定义 AI 可用的有限能力子集；`npm run registry:export` 生成 `public/fallbacks/` 四个 JSON。`npm run registry:check` 与构建检查漂移，前后端消费相同数据。
- 新装载章节只允许 `cargo:demonstrate:two_suitcases`，调用现有 dispatcher、cargo-layout 和碰撞检查；不允许 LLM spawn、旋转或生成坐标。模型代理不代表实车装载能力。
- Markdown 按标题、段落及表格行切块；先过滤 Pack 和车型适用范围，再用中文别名和 BM25 排序。普通版实测、推算、索引关键词不作为 Ultra 参数证据。对来源差异保留原始口径，不把媒体资料自动升级为官方事实。
- 当前答案是可核验的证据摘录；在线模型只重排本次检索的证据 ID，不自由生成参数。服务端验证 ID 并回填出处链接。`/api/knowledge/{chunkId}` 可查完整证据，`/api/registry` 可查软件能力来源。知识资料的外部来源链接未全部重新核验，界面明确标注。
- `Retriever.search(query, pack_id, limit)` 是后续 embedding/Qdrant 的替换接口；替换实现必须保留 scope 预过滤、Chunk 元数据与引用校验，不能改变动作执行路径。
- 实体定义区分 `packId/entityId/instanceId`、能力、归属/装载关系、署名和知识关联。相机与章节单列为资源。实例从 Zustand 投影；可选 `TargetedVehicleAction` 适配器校验实例存在、Pack 及能力后交给同一 dispatcher，不新增动画状态。当前没有第二款完整车型。

### 播放、打断与验收

明确的演示需求与“带我看一段演示”是显式播放授权；浏览主题本身不启动播放。停止、按钮、文字、语音或 Orbit 接管后不会自动恢复。首次提示可选“恢复自动发布会 / 保持手动控制”；选择保持后本次页面会话不再提示。恢复从下一章起点开始；最后一章则继续未执行部分。新请求、取消、收起详情或手动接管会取消尚未完成的请求；计划标识与控制权代次拦截迟到响应。空脚本安全退出。

```powershell
npm test
npm run build
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m server.fixtures --check

# 以下显式启用真实付费 API；常规测试全部使用可控 Mock/本地 fallback。
.\.venv\Scripts\python -m server.smoke --live --provider deepseek
.\.venv\Scripts\python -m server.smoke --live --provider qwen
.\.venv\Scripts\python -m server.smoke --live --provider qwen --workflow
```

手动检查：主题选择不自动播放 → 在统一入口问“后备箱多大？”并查看资料与尾门/镜头联动 → 切环境保留状态 → 明确要求家庭演示 → 车辆按钮或 Orbit 接管 → 显式恢复；问“今天天气”应无动作；关闭后端验证错误反馈；1280px 桌面确保字幕、按钮、输入和合规条可见，部件标签水平可读且不覆盖操作面板。麦克风授权由浏览器管理，不在自动测试中录音。

### 部署与依赖许可

这已是需要后端的应用；纯静态 Vercel/ESA 页面只提供前端本地模板与手动入口，不能保管服务端密钥或执行在线 RAG。生产推荐运行本仓库 FastAPI + dist，由已有反向代理提供 HTTPS；不在本次自动发布远程服务。

```powershell
npm run build
.\.venv\Scripts\python -m uvicorn server.main:app --host 127.0.0.1 --port 8000
# 或（需已安装 Docker）：
docker compose up --build -d
```

Docker 多阶段构建不会复制 `.env`；compose 仅在运行时从本机注入配置。Docker 路径本次未在此机器实测。

Python 新增依赖由 `server/requirements.txt` 和 `requirements.lock.txt` 固定，已在 Python 3.13.5 验证：FastAPI 0.156.4（MIT）、Pydantic 2.14.1（MIT）、Pydantic AI Slim 2.58.0（MIT，仅 OpenAI extra）、Uvicorn 0.54.0（BSD-3-Clause）、OpenAI Python SDK 3.35.1（Apache-2.0）、httpx 0.28.1（BSD-3-Clause）、python-dotenv 1.2.4（BSD-3-Clause），测试使用 pytest 9.1.1（MIT）、pytest-asyncio 1.4.0（Apache-2.0）。未引入 LangGraph、LlamaIndex、向量数据库或第二套前端状态库；原有 npm 锁文件继续保留。

---

## 项目定位

AutoLaunch 要验证的核心观点：**用户不必观看完全相同的产品发布会**。AI 可以根据用户兴趣，重新选择章节、镜头、车辆动作与讲解，并允许用户中途接管。

```
按钮 / 点击车模 / 文字输入 / 语音转写 / 发布会脚本 / AI Director
                          ↓
                  VehicleAction（统一入口）
                          ↓
                ActionDispatcher（幂等/冲突/超时）
                          ↓
                      车辆领域状态
                          ↓
                3D 动画 + 已注册镜头 + UI 反馈
```

**不做什么（除非范围明确变更）：** 账号、支付、大型后台、真实车辆 API、任意动画生成、开放式多 Agent 对话、通用低代码平台。

---

## 快速开始

> 当前仓库已包含可运行的前端预览；以下命令用于启动、检查模型节点并验收已实现的 VehicleAction。

```powershell
# 1. 安装依赖
npm install

# 2. 启动开发服务器（Vite）
npm run dev

# 3. 打开 http://localhost:5173
#    - 自动开始 90 秒 4 章节发布会
#    - 点击控制栏按钮 / 输入文字 / 语音 / 拖动视角 → 随时接管
#    - 接管后首次弹出 [恢复 / 保持手动] 提示；选保持后，同会话不再重复弹
```

**运行测试：**

```powershell
npm test                 # vitest 运行全部用例
npm run build            # TypeScript 检查并生成生产构建
```

---

## SU7 Ultra 模型下载与合规声明

### 模型来源

仓库已经包含运行所需的 `public/assets/su7_ultra.glb`。原始模型页面位于 [Sketchfab](https://skfb.ly/pKv9Z)；替换或重新导出模型时，仍须保留下面的署名与许可信息。

### ⚠ 合规强制要求

当前页面实际加载的 `su7_ultra.glb` 内嵌元数据显示其受 **CC BY-NC-SA 4.0** 协议约束，任何公开展示（页面 / 视频 / 截图 / 文章）**必须**同时显示：

- **原作者**：Ddiaz Design
- **来源**：Sketchfab
- **许可协议**：CC BY-NC-SA 4.0（非商业使用 + 署名 + 相同方式共享）
- **非官方声明**：本演示为非官方概念作品，不代表小米或任何品牌官方立场

**禁止事项**：不得将 SU7 模型用于直接商业用途（出售、广告、品牌合作物料、暗示官方合作等）。对外商业化演示前，请替换为原创或商业授权明确的模型。

---

## 目录结构

```text
AutoLaunch/
├── README.md              # 项目说明（你正在看的这个文件）
├── LICENSE                # AutoLaunch 源码的 MIT 许可证
├── public/assets/
│   ├── su7_ultra.glb                  # Xiaomi SU7 Ultra 模型（Sketchfab CC BY-NC-SA 4.0）
│   ├── suitcase-carry-on-20.glb       # 20 寸黑色铝镁合金登机箱（原创 · CC BY-NC-SA 4.0）
│   ├── suitcase-checked-24.glb        # 24 寸银色铝镁合金托运行李箱（原创 · CC BY-NC-SA 4.0）
│   └── ASSET-LICENSES.md              # 所有 3D 资产的来源与许可证
├── src/                               # React / R3F 应用与测试
└── dist/                              # npm run build 生成的静态部署产物
```

---

## 版本里程碑

| 日期 / 月份 | 版本 | 里程碑内容 |
|---|---|---|
| 2026-08-02 | **v0.0.0** | 📍 当前锚点：项目规则 + SU7 GLB 模型 |
| 2026-08 | **v0.1.x** | 可运行预览：发布会脚本 + 按钮/文字/语音/Orbit 四入口 + 接管流程 + Product Pack + 行李道具仓库 |
| 2026-09 | v0.2.x | AI Director：三条固定兴趣路线（智能化/家庭/性能）→ 结构化章节-镜头-动作计划 |
| 2026-10 | v0.3.x | 产品知识与可追问：小型知识库 + 问答驱动镜头/动作 + 引用与可观测性 |
| 2026-11 | v0.4.x | 第二款 Product Pack 上线，验证可迁移性（≥70% 代码不改） |
| 2026-12 | v0.5.x | 轻量创作工具 / JSON 编辑器：改章节、改字幕、选镜头、导出配置 |
| 2027-01 | **v1.0.0** | 公开体验版：中英文 README、3 分钟介绍视频、案例研究、路径决策 |

---

## 半年 Roadmap 精要

```text
8 月：可运行预览    → SU7 非官方概念 Demo、统一动作入口与静态道具展示
9 月：让 AI 能导演  → 用户表达兴趣后，系统自动选章节/镜头/动作
10 月：让用户能追问  → 产品知识库 + 问答同步驱动镜头和动作
11 月：证明能换产品  → 第二个 Product Pack，总时间显著下降
12 月：让别人能创作  → 轻量编辑器，第三方不改源码也能调发布会
1 月：按证据做决策   → 开源 / 项目服务 / 平台创业，三条路径凭数据选
```

关键约束：通用运行时代码不得硬编码 SU7 原始 Mesh 名，车型差异必须通过 Product Pack 的语义节点映射与注册动作表达。

---

## 版权与素材授权

| 组成 | 版权/协议 | 来源 | 说明 |
|---|---|---|---|
| AutoLaunch 项目源码 | MIT | 本仓库 | 详见根目录 `LICENSE`；允许商业使用 |
| Xiaomi SU7 Ultra 3D 模型 | **CC BY-NC-SA 4.0** | Sketchfab · Ddiaz Design | 非商业使用、署名、相同方式共享；详见上节 |
| 20/24 寸原创行李箱 GLB | **CC BY-NC-SA 4.0** | AutoLaunch Contributors | 非商业使用、署名、相同方式共享；商业授权需另行书面许可 |

> 源码与模型资产采用不同许可证。MIT 许可不覆盖 `public/assets/` 中另行标注许可证的 3D 模型；复用或分发模型时须遵守对应资产说明。

> ⚠ 本项目为**非官方概念演示**，与小米或任何汽车品牌不存在官方合作关系。任何公开内容必须同时显示"非官方"声明。

## 当前功能与验收

- 车辆按钮、文字命令和浏览器语音转写统一生成 `VehicleAction`，由同一分发器执行幂等、冲突取消、超时和状态提交。
- 注册镜头与 OrbitControls 互斥控制相机；用户拖动后不会被脚本自动抢回控制权。
- 主驾车窗、尾门和前后灯光使用真实模型节点；节点缺失时显示明确降级提示，页面不会白屏。
- 工作室模式可展示 20/24 寸行李箱；“尺寸对照”默认关闭，开启后可水平拖动模型与等尺寸参照盒重叠比较。
- 页面持续展示车辆模型的作者、来源、许可证和非官方声明。
- 外观默认参考 2025 SU7 Ultra 闪电黄，提供官网五种车色的视觉近似；非黄色隐藏银色拉花。座椅恢复原模型黑色/黄色缝线纹理，并支持红/灰点缀色自定义。参考来源和纹理许可见 `public/assets/ASSET-LICENSES.md`，不作为官方选装配置器。
- 后续外观细节先核对同年款、同车型的官方图片与配置资料；记录来源后再调整。缺乏依据时保留已核对版本、说明缺少的参考，不把自定义效果标成原厂配置。
- 外观验收：在三种环境切换五种车色，确认闪电黄保留拉花、其他颜色隐藏拉花；开关前灯时灯带发亮、灯罩保持通透；换色不重置已打开的尾门或播放状态。座椅贴图加载失败时保留模型材质并显示提示。

提交前运行 `npm test` 与 `npm run build`。浏览器验收至少覆盖车辆动作、镜头接管、文字/语音入口、两款行李箱加载、尺寸对照开关及模型加载失败提示。

## 静态部署

本项目是纯 Vite 静态前端，只需 Node.js 与 npm。

```powershell
# 本地开发：监听 5173 端口
npm run dev

# 生产构建：将 dist/ 目录完整上传到 OSS
npm run build
```

Vite 使用相对资源基址，`dist/` 可部署在 OSS 根路径或子目录。OSS 应为 `.glb` 文件配置 `model/gltf-binary` Content-Type；若通过自定义域名跨域加载资源，还需允许对应的 CORS 来源。
