# AutoLaunch · AI 驱动的汽车数字发布会开源框架

> **非官方概念演示 · 开源框架**
> AutoLaunch 是一个面向汽车行业的交互式数字发布会框架：AI 可以根据用户兴趣重新选择章节、镜头、车辆动作与讲解；用户可通过点击/文字/语音随时打断并接管控制权。

> ⚠ 当前为 **v0.0.0 初始锚点版本**：仅包含项目规则与 TRAE 子 Agent 配置。首个可运行 Demo（v0.1 homework-mvp，约 90 秒 SU7 Ultra 发布会 × 四入口接管）将在后续提交上线。

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

> 本节描述 **v0.1 homework-mvp** 的预期启动方式；当前仓库为 v0.0.0 锚点，代码骨架尚未提交。

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
   https://sketchfab.com/3d-models/2025-xiaomi-su7-ultra-production-version-9d0a0a9285cb4ca59ccb9322ddf58d24#download
2. 点击 `Download` → 下载 **glTF Binary (.glb)** 格式。
3. 放到 `public\assets\su7_ultra.glb`（推荐）或项目根目录 `su7_ultra.glb`。

### ⚠ 合规强制要求

本项目默认包含的 3D 模型受 **CC BY-NC-SA 4.0** 协议约束，任何公开展示（页面 / 视频 / 截图 / 文章）**必须**同时显示：

- **原作者**：Ddiaz Design
- **来源**：Sketchfab
- **许可协议**：CC BY-NC-SA 4.0（非商业使用 + 署名 + 相同方式共享衍生作品）
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
| Xiaomi SU7 Ultra 3D 模型 | **CC BY-NC-SA 4.0** | Sketchfab · Ddiaz Design | 非商业使用、必须署名；详见上节 |
| 架构文档 / Subagent 配置 | CC BY 4.0（署名即可） | 本仓库 | 自由复用 |

> ⚠ 本项目为**非官方概念演示**，与小米或任何汽车品牌不存在官方合作关系。任何公开内容必须同时显示"非官方"声明。
