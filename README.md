# AutoLaunch · AI 驱动的汽车数字发布会开源框架

> **非官方概念演示 · 开源框架**
> AutoLaunch 是一个面向汽车行业的交互式数字发布会框架：AI 可以根据用户兴趣重新选择章节、镜头、车辆动作与讲解；用户可通过点击/文字/语音随时打断并接管控制权。

> 当前为可运行的 **3D VehicleAction Preview**：已实现 SU7 Ultra 模型展示、五个注册镜头、八个车辆控制按钮、文字与浏览器语音统一派发 `VehicleAction`、真实车窗升降、前后灯光以及由原始 GLB 外壳、内衬与尾翼组成的真实后备箱开合。90 秒四章节发布会与完整接管流程仍属于后续 v0.1 homework-mvp 里程碑。

---

## 目录

- [项目定位](#项目定位)
- [快速开始（3 小时 MVP / v0.1）](#快速开始3-小时-mvp--v01)
- [SU7 Ultra 模型下载与合规声明](#su7-ultra-模型下载与合规声明)
- [TRAE 多 Agent 开发配置](#trae-多-agent-开发配置)
- [版本里程碑](#版本里程碑)
- [半年 Roadmap](#半年-roadmap)
- [版权与素材授权](#版权与素材授权)

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

## 快速开始（3 小时 MVP / v0.1）

> 当前仓库已包含可运行的前端预览；以下命令用于启动、检查模型节点并验收已实现的 VehicleAction。

```powershell
# 1. 安装依赖
npm install

# 2. 准备 SU7 Ultra GLB 模型（Sketchfab 登录后免费下载，见下一节）
.\scripts\download-su7-glb.ps1

# 3. 启动开发服务器（Vite）
npm run dev

# 4. 打开 http://localhost:5173
#    - 自动开始 90 秒 4 章节发布会
#    - 点击控制栏按钮 / 输入文字 / 语音 / 拖动视角 → 随时接管
#    - 接管后首次弹出 [恢复 / 保持手动] 提示；选保持后，同会话不再重复弹
```

**运行测试（TDD）：**

```powershell
npm test                 # vitest 运行全部用例
npm run test:coverage    # 生成覆盖率报告
```

---

## SU7 Ultra 模型下载与合规声明

### 一键准备脚本

```powershell
.\scripts\download-su7-glb.ps1
```

脚本逻辑：
1. 若 `public\assets\su7_ultra.glb` 已存在 → 直接退出。
2. 若项目根目录存在 `su7_ultra.glb` → 自动复制到目标路径。
3. 否则打开 Sketchfab 页面供用户手动下载，并给出拷贝位置指引。

### 手动下载

1. 访问（需注册 Sketchfab 免费账号登录）：
   https://skfb.ly/pKv9Z
2. 点击 `Download` → 下载 **glTF Binary (.glb)** 格式。
3. 放到 `public\assets\su7_ultra.glb`（推荐）或项目根目录 `su7_ultra.glb`。

### ⚠ 合规强制要求

当前页面实际加载的 `su7_ultra.glb` 内嵌元数据显示其受 **CC BY-NC-SA 4.0** 协议约束，任何公开展示（页面 / 视频 / 截图 / 文章）**必须**同时显示：

- **原作者**：Ddiaz Design
- **来源**：Sketchfab
- **许可协议**：CC BY-NC-SA 4.0（非商业使用 + 署名 + 相同方式共享）
- **非官方声明**：本演示为非官方概念作品，不代表小米或任何品牌官方立场

**禁止事项**：不得将 SU7 模型用于直接商业用途（出售、广告、品牌合作物料、暗示官方合作等）。对外商业化演示前，请替换为原创或商业授权明确的模型。

---

## TRAE 多 Agent 开发配置

这是给 TRAE IDE 内置 `Agent` 使用的项目级 Subagent 配置，不是 Codex 的目录级拆分包。

### 目录结构

```text
AutoLaunch/
├── AGENTS.md              # 所有 Agent 共用的项目规则（架构/约束/验收/完成定义）
├── README.md              # 项目说明（你正在看的这个文件）
├── scripts/
│   └── download-su7-glb.ps1
└── .trae/
    └── agents/            # TRAE Subagent 分工定义（5 个专业子智能体）
        ├── experience-planner.md     # 产品/范围/验收条件（不改代码）
        ├── r3f-runtime-engineer.md   # R3F / Three.js / 3D 运行时
        ├── ai-director-engineer.md   # FastAPI / LLM / RAG / 结构化导演计划
        ├── product-pack-engineer.md  # 车型/产品 Pack（node-map / 动作 / 镜头 / 脚本）
        └── demo-qa-engineer.md       # TDD / 回归 / E2E / 演示验收（只改测试）
```

### 分工速查

| Subagent | 负责什么 | 是否改生产代码 |
|---|---|---|
| `experience-planner` | 产品范围、体验流程、章节、验收条件 | ❌ 只做分析 |
| `r3f-runtime-engineer` | React Three Fiber、模型、镜头、动画、交互 | ✅ |
| `ai-director-engineer` | FastAPI、LLM/RAG、结构化导演计划、兜底 | ✅ |
| `product-pack-engineer` | 车型/产品包、Mesh 映射、动作和镜头配置 | ✅ |
| `demo-qa-engineer` | TDD、回归、E2E、演示验收 | 只改测试和测试配置 |

### 安装与启用

1. 在 TRAE 中进入 `设置 > Beta`，确认启用 Subagents 目录。
2. 在 `设置 > 规则 > 导入设置` 中启用 **「将 AGENTS.md 包含在上下文中」**。
3. 新建对话并选择内置 **`Agent`**（不要选普通 Chat）。
4. 在 Agent 的工具配置中确认上述 5 个 Subagent 已可用。

### 推荐的第一条指令

```text
请先让 experience-planner 把"语音打开主驾车窗，并允许用户打断自动发布会"的需求拆成最小闭环和验收条件；确认后让 r3f-runtime-engineer 实现，再让 demo-qa-engineer 独立验证。不要扩展到后台、账号系统或开放式多 Agent。
```

日常可以不点名，让主 Agent 按 `description` 自动调度；复杂任务显式点名会更稳定。

### 分工边界

- **主 Agent**：理解你的最终目标、拆任务、选 Subagent、汇总结果交付。
- **Subagent**：只处理边界明确的专业子任务，不自行扩大产品范围。
- **AGENTS.md**：所有参与者都必须遵守的架构与产品规则。
- **Skill**：适合后续沉淀可复用流程（GLB 检查器、Product Pack 校验、录制清单等）；第一版不必先做。

---

## 版本里程碑

| 日期 / 月份 | 版本 | 里程碑内容 |
|---|---|---|
| 2026-08-02 | **v0.0.0** | 📍 当前锚点：规则文档 + Subagent 配置 + SU7 GLB 下载脚本 |
| 2026-08 | v0.1.x | homework-mvp：90 秒发布会 + 按钮/文字/语音/Orbit 四入口 + 打断接管 + Product Pack 最小骨架 |
| 2026-09 | v0.2.x | AI Director：三条固定兴趣路线（智能化/家庭/性能）→ 结构化章节-镜头-动作计划 |
| 2026-10 | v0.3.x | 产品知识与可追问：小型知识库 + 问答驱动镜头/动作 + 引用与可观测性 |
| 2026-11 | v0.4.x | 第二款 Product Pack 上线，验证可迁移性（≥70% 代码不改） |
| 2026-12 | v0.5.x | 轻量创作工具 / JSON 编辑器：改章节、改字幕、选镜头、导出配置 |
| 2027-01 | **v1.0.0** | 公开体验版：中英文 README、3 分钟介绍视频、案例研究、路径决策 |

---

## 半年 Roadmap 精要

```text
8 月：做出来        → 作业级 SU7 非官方 Demo，能交作业、能录屏
9 月：让 AI 能导演  → 用户表达兴趣后，系统自动选章节/镜头/动作
10 月：让用户能追问  → 产品知识库 + 问答同步驱动镜头和动作
11 月：证明能换产品  → 第二个 Product Pack，总时间显著下降
12 月：让别人能创作  → 轻量编辑器，第三方不改源码也能调发布会
1 月：按证据做决策   → 开源 / 项目服务 / 平台创业，三条路径凭数据选
```

关键约束：
- **秋招优先（8–9 月 70%/55%）**，项目每周 10–15 小时保持可见进展。
- 8–10 月不做：后台、账号、支付、多车型同时运营、真实车辆 API。
- 任何版本：通用代码不得硬编码 SU7 原始 Mesh 名 → 必须走 Product Pack.node-map 查找层。

---

## 版权与素材授权

| 组成 | 版权/协议 | 来源 | 说明 |
|---|---|---|---|
| AutoLaunch 项目源码 | MIT（待 v0.1 时补 LICENSE 文件） | 本仓库 | 框架代码 |
| Xiaomi SU7 Ultra 3D 模型 | **CC BY-NC-SA 4.0** | Sketchfab · Ddiaz Design | 非商业使用、署名、相同方式共享；详见上节 |
| 架构文档 / Subagent 配置 | CC BY 4.0（署名即可） | 本仓库 | 自由复用 |

> ⚠ 本项目为**非官方概念演示**，与小米或任何汽车品牌不存在官方合作关系。任何公开内容必须同时显示"非官方"声明。

## 当前界面、发布会展位与加载策略

- 常驻车辆操作由 8 个开/关按钮收拢为 4 个状态切换：主驾车窗、后备箱、大灯、尾灯；底层仍统一派发同一套 `VehicleAction`。
- 镜头入口收拢为主视觉、前脸、车尾、360° 四项；360° 展台环绕速度由 `0.9` 提高到 `2.25`，即原速度的 2.5 倍，鼠标拖动仍会立即停止自动环绕。
- 顶栏“发布会模式”可切换带发光双环、金属展台和顶部舞台光的发布会展位，不改变车辆动作状态。
- `index.html` 在应用脚本执行前预加载 `su7_ultra.glb`，`useGLTF` 继续复用缓存；加载界面显示 LoadingManager 实际进度，模型材质初始化完成后才进入 `3D READY`。
- `ContactShadows` 只计算初始有限帧，减少模型就绪后的持续 GPU 负担。

## 当前 3D 展示、语音与 VehicleAction 验收

页面提供五个注册镜头和八个车辆按钮。按钮、文字以及 Web Speech API 的 `zh-CN` 转写都会生成同一套 `VehicleAction`，再经 `ActionDispatcher` 执行幂等检查、冲突组取消、5 秒超时和状态提交。鼠标拖动会立即停止自动环绕，且不会自动恢复。

手动验收：

1. 执行 `npm run inspect:glb`，确认输出 `su7_ultra.glb`、307 个节点和有效包围盒。
2. 执行 `npm run dev`，打开 `http://localhost:5173`；10 秒内应看到黄色车模、黑色轮圈、完整署名且无 404。
3. 依次点击五个镜头按钮，再输入“旋转一圈”；确认 450ms 平滑切换，拖动车模后提示“不会自动恢复镜头”。
4. 切换到“主驾侧”，执行“打开车窗 / 关闭车窗”；确认独立车窗节点在约 800ms 内升降，重复目标不会重复动画。
5. 在正面和车尾镜头分别执行“开启大灯 / 开启尾灯”；确认灯罩发光，并在地面、前保险杠或后保险杠附近出现柔和的冷白/红色光影，再执行关闭命令确认光影同步渐灭。
6. 展开底部“文字 / 语音控制”抽屉；Chrome/Edge 授权麦克风后说“开灯”，转写文本应进入输入框并走同一解析器。不支持或拒绝权限时按钮置灰并显示“麦克风不可用，请使用文字或按钮”。
7. 先由用户主动选择车尾镜头，再执行“打开后备箱”；动作不得强制改变当前镜头，原始 GLB 的尾门外壳、黑色内衬、尾翼及其支架、中央尾灯三层 Mesh 应围绕固定铰链平滑打开，两侧尾灯保持固定；关闭后应严丝合缝复位。临时移除任一尾门 node-map 条目时，应显示降级提示且页面不得白屏。

当前 Pack 保留 Ddiaz 模型原生 `CarPaint` 贴图中的车头/车尾银线、侧身银条与 `Ultra` 字样，同时隐藏原始牌照并使用前白后黑的 `SU7 Ultra` 牌照。大灯和尾灯采用内外分层：内部灯芯使用较高 emissive，外层灯罩只保留低强度透光与反射细节，同时同步控制定向地面投射光；不使用会误照亮前后下包围的全方向点光。后备箱动作通过 Product Pack 声明尾门外壳、内衬、尾翼与 GLB 局部铰链，运行时只按语义 ID 组装和旋转真实 Mesh。所有车型相关的节点、铰链、光源位置、颜色、距离和强度仍由 Product Pack 声明。

FBX 源文件对照记录：`2025-xiaomi-su7-ultra/source/FINAL_MODEL_SU7U/FINAL_MODEL_SU7U.fbx` 与 GLB 使用同一套对象命名。银色条纹来自 GLB 内嵌的 `CarPaint.baseColorTexture`；运行时保留该原生贴图并使用中性白色 tint，不再创建或加载额外 Overlay Mesh。

银色饰条节点仍分别注册为 `trim_front_silver`、`trim_side_silver`、`trim_rear_silver` 和 `trim_rear_silver_center`，用于车型语义映射和独立材质微调；它们不是运行时生成的 Mesh。轮内刹车盘使用石墨黑节点覆盖，卡钳使用黄色覆盖。

尾部车身徽标 `xiaomi`、中文“小米”和车型字样由独立 `carXiaoMi_1` 节点承载，Product Pack 将其注册为 `rear_badges` 并覆盖为低金属度黑色。React 创建的前后车牌不属于该节点，因此车牌文字颜色不受影响。

左右后视镜的上壳、下壳与镜面组件分别注册为六个 `mirror_*` 语义节点。上下壳使用低金属度纯黑材质，镜面使用带轻微反射的深黑材质，避免共享 `CarPaint` 和 `CHROME_Logo` 令后视镜出现黄色或银白色。

车尾拼接高光修正：左右尾灯玻璃在关闭状态下保持均匀深黑，尾门上沿两块独立车漆面降低金属度并提高粗糙度，以减弱尾灯边缘银白描边和尾门右肩的白色高光；`lights:taillight:on/off` 只在动作期间调整灯罩 emissive，不修改尾部徽标或车牌。

二次定位确认残留细线来自车尾 `carLightPlastic_BrilliantBlack_2 / Plastic_Light` 外壳，而非位于车头的 `Light_Chroaming` 镀铬节点。该尾灯外壳现已关闭环境反射并清除颜色、法线、粗糙度、金属度与 AO 贴图；左右尾灯玻璃的环境反射也降至接近零，以消除侧后视角下的银青色接缝。

边缘瑕疵校正：FBX/GLB 材质表显示 `Brilliant_Black`、`BrilliantGray` 与 `Brilliant_Silver` 共享亮色贴图，且原 `Brilliant_Silver` 带异常发光因子。Pack 会清除这些贴图和发光，将前后唇、窗框及侧裙统一为低金属度深黑材质；`Roof`、`Roof_Glass`、`Windows` 同样去除白色源贴图。Canvas 使用 1.5–2 倍像素比和最高 8 倍各向异性过滤，并降低展示灯光强度以减少边缘锯齿、摩尔纹与过曝白边。

## FastAPI 一键部署

Windows 本地部署（首次执行会创建 `.venv` 并安装 FastAPI）：

```powershell
npm run deploy
```

启动完成后访问 `http://localhost:8000`。健康检查位于 `http://localhost:8000/api/health`，接口文档位于 `http://localhost:8000/api/docs`。若已安装依赖，可执行 `scripts\deploy.ps1 -SkipInstall -Port 8080` 加快再次启动。

Docker 部署：

```powershell
docker compose up --build
```

部署前会强制检查 `public/assets/su7_ultra.glb`，Vite 构建后 FastAPI 同源托管页面、JS/CSS 与模型文件；模型缺失或构建产物不完整时会直接失败，不会启动一个空白站点。
