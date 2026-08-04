# AutoLaunch · 汽车线上 AI 数字发布会开源框架 项目共同规则

## 项目定位与版本锚点

### 项目定位

**AutoLaunch** 是一个面向汽车行业的、开源的 AI 数字发布会 / 交互式产品演示框架。

* 开发者友好：通过声明式 `Product Pack`（node-map + actions + cameras + launch-script + knowledge）接入任意车型或硬件产品，无需维护五套动画路径。
* 交互优先：自动发布会脚本 × 点击 × 文字 × 语音 × AI Director 五条入口统一派发 `VehicleAction`，用户可随时打断接管控制权。
* AI 可插拔：AI Director 输出结构化计划（章节 / 镜头 / 动作 / 讲解风格），3D 运行时只执行已注册动作，杜绝大模型直接操作任意坐标或代码。
* 合规友好：自带模型来源、许可证、非官方声明与第三方素材署名栏，适合展示非官方概念 Demo、作品集、产品案例。

### v0.0.0 初始版本锚点（2026-08-02）

> 以 **当前工作目录状态** 作为项目 `v0.0.0` 起点，任何后续代码 / 脚手架 / 测试 / Pack 均在此之上增量构建，不再回溯。

**v0.0.0 已包含内容（后续提交视为 v0.0.1+）：**

```
AutoLaunch/
├── AGENTS.md              ← 项目共同规则、架构约束、验收标准、完成定义
├── README.md              ← Subagent 调度说明、推荐第一条指令
├── su7_ultra.glb          ← 小米 SU7 Ultra 模型（Sketchfab CC BY-NC-SA 4.0 · Ddiaz Design）
└── .trae/
    └── agents/            ← TRAE 子智能体配置（experience-planner / r3f-runtime-engineer /
                              ai-director-engineer / product-pack-engineer / demo-qa-engineer）
```

**v0.0.0 不含内容（后续版本增量开发）：**
* 任何 `package.json`、`src/`、`public/`、Vite / R3F 脚手架
* 任何自动化测试文件
* `.env` 与 `.env.example`
* Product Pack TS/JSON 对象

### 半年里程碑与版本对应（与半年规划书对齐）

| 目标月份 | 版本号 | 里程碑内容 |
| --- | --- | --- |
| 2026-08-02 | v0.0.0 | **当前锚点**：规则文档 + 子 Agent 配置 + SU7 GLB |
| 2026-08 | v0.1.x | homework-mvp：90 秒发布会 + 按钮/文字/语音/Orbit 四入口 + 打断接管 + Product Pack 最小骨架 |
| 2026-09 | v0.2.x | AI Director：三条固定兴趣路线（智能化/家庭/性能）→ 结构化章节-镜头-动作计划 |
| 2026-10 | v0.3.x | 产品知识与可追问：小型知识库 + 问答驱动镜头 / 动作 + 引用与可观测性 |
| 2026-11 | v0.4.x | 第二款 Product Pack 上线，验证可迁移性；70%+ 代码不改 |
| 2026-12 | v0.5.x | 轻量创作工具 / JSON 编辑器：改章节、改字幕、选镜头、导出配置 |
| 2027-01 | v1.0.0 | 公开体验版：中英文 README、3 分钟介绍视频、案例研究、路径决策材料 |

### 外部项目代号

对外传播 / 社区账号 / 视频标题可使用 **AutoLaunch** 作为品牌名；若后续需要强调"汽车发布会专用"，可附加标题：
> AutoLaunch · AI-Driven Automotive Digital Launch Framework（AI 驱动的汽车数字发布会框架）

## 产品目标

AutoLaunch 要验证的核心观点是：用户不必观看完全相同的产品发布会，AI 可以根据用户兴趣，重新选择章节、镜头、车辆动作与讲解，并允许用户中途接管。

当前阶段优先完成一个稳定、可录制、可公开体验的非官方概念 Demo，而不是开发完整 SaaS 平台。

## 当前优先级

### 长期优先级（v1.0 前通用）

1. 60～120 秒自动发布会能够连续稳定播放。
2. 用户可通过点击、文字或语音接管，并明确暂停、恢复或退出。
3. 所有输入统一转换为 `VehicleAction`，再由确定性 3D 引擎执行。
4. 先打磨主驾车窗、后备箱、灯光和镜头聚焦等少量动作。
5. 车型差异进入 Product Pack，通用代码不得写死 SU7 的 Mesh 名称。
6. AI、语音或网络不可用时，文字和手动操作仍可完成演示。
7. 每个功能都要有自动化测试、手动视觉验收和清晰的失败反馈。

### v0.1.0 已完成基线（2026-08-04 当前状态）

> 以下内容均已在当前代码库中可运行，视为黑客松现场「不用再搭」的基础层。

**已交付完整闭环 90 秒 × 4 章节发布会：**

```
按钮 / 点击车模 / 文字输入 / 语音转写 / 发布会脚本
                    ↓
            VehicleAction（统一入口）
                    ↓
          ActionDispatcher（幂等/冲突/超时）
                    ↓
              车辆领域状态
                    ↓
        3D 动画 + 已注册镜头 + UI 反馈
```

**v0.1 已注册镜头池（AI 只能从这里选）：**
| 镜头 ID | 说明 |
|---|---|
| `hero_front_left` | 前左 45° 英雄视角 |
| `front` | 前脸正视角 |
| `driver_side` | 主驾侧视角 |
| `rear_three_quarter` | 后右 45° 三视图 |
| `turntable` | 360° 自动旋转展台 |

**v0.1 已注册动作池（AI 只能从这里选，按 VehicleAction 格式调用）：**
| 动作类别 | 已注册可用 ID 与参数组合 |
|---|---|
| 灯光 | `lights:headlight:on/off`、`lights:taillight:on/off` |
| 车窗 | `window:driver_front:open/close(:progress)`、`window:passenger_front:open/close`、`window:driver_rear:open/close`、`window:passenger_rear:open/close`、`window:all:open/close`（四车窗同步） |
| 尾门 | `trunk:open/close`（真实铰链动画，含 body/liner/spoiler/taillight 协同） |
| 镜头 | `orbit:preset`（5 个 preset，同镜头池） |

**v0.1 已完成四入口：**
- 按钮：8 个（开窗/关窗/开后备箱/关后备箱/开灯/关灯/播放/暂停）
- 文字输入：回车提交，确定性关键字/正则匹配
- 语音：Web Speech API `zh-CN`，走文字同一解析通道
- OrbitControls：左键拖动立即打断脚本镜头

**v0.1 已完成架构基础设施：**
- Vite + React + TS + R3F（@react-three/fiber + drei OrbitControls）脚手架
- `su7_ultra.glb` 放置于 `public/assets/`，启动时存在性检查
- 完整 Product Pack：node-map（37 个语义节点已映射）+ 动作声明 + 镜头声明 + 90 秒脚本 + 录制脚本
- ActionDispatcher：幂等 / 冲突组取消（每车窗独立冲突组 + 前后灯组 + rear 组）/ 超时 > 5s / 失败回滚
- 自动发布会打断状态机：takeover → 首次弹窗 [恢复/保持手动] → 会话内二次接管不重复弹
- 左下角永久可见非官方声明条 + 顶部错误通知条（模型加载失败 / 节点缺失 / 麦克风拒绝 / 动作超时）
- 8 条 vitest 用例（≥ 要求 5 条）
- FastAPI 后端骨架：`/api/health` + 前端静态文件服务（dist/）+ Dockerfile + compose.yaml + vercel.json
- knowledge/ 目录 4 个人工精选 md：核心参数、空间实测、竞品对比、车主实测（黑客松 RAG 直接复用）

**黑客松现场不重复做（除非用户明确改变范围）：**
- 账号、支付、大型后台、真实车辆 API、任意动画生成、复杂多 Agent 对话或通用低代码平台
- GLB 材质精修 / PBR 调优 / 模型切分重拓扑（v0.1 已有尾门真实铰链 + 四车窗真实 Mesh 升降 + 环境光投影）

### 8 月 v0.1 范围边界

**✅ 已完成（2026-08-04 状态）：**

1. ✅ Vite + React + TS + R3F（@react-three/fiber + drei OrbitControls）脚手架
2. ✅ `su7_ultra.glb` 放置于 `public/assets/`，启动时存在性检查
3. ✅ 完整 Product Pack：node-map（37 语义节点）+ 动作声明 + 镜头声明 + 90 秒脚本 + 录制脚本
4. ✅ ActionDispatcher：幂等 / 冲突组取消 / 超时 > 5s / 失败回滚
5. ✅ 自动发布会打断状态机：takeover → 首次弹窗 [恢复/保持手动] → 会话内二次接管不重复弹
6. ✅ 左下角永久可见非官方声明条 + 顶部错误通知条（模型加载失败 / 节点缺失 / 麦克风拒绝 / 动作超时）
7. ✅ 8 条 vitest 用例（≥ 要求 5 条）
8. ✅ `.env.example` + `.env` 同步更新（VITE_* 配置）
9. ✅ README 更新（启动命令 + 手动验收 + 授权说明）
10. ✅ FastAPI 后端骨架（/api/health + 静态文件服务 + Dockerfile + compose.yaml + vercel.json）
11. ✅ knowledge/ 4 个 md 知识库（核心参数 / 空间实测 / 竞品对比 / 车主实测）

**🔥 黑客松现场本次必须（基于 v0.1 基线）：**

12. AI Director 路由（FastAPI）：选 2 人设之一 → 返回章节-镜头-动作 JSON + schema 校验 + fallback
13. RAG 路由（FastAPI）：人工精选 Markdown + 关键词 fallback + 联动镜头/动作
14. 前端 UI：左侧人设标签区 + 右侧问答对话区 + 镜头动作联动
15. 合规定位条：全程显示「非官方概念演示 · Ddiaz Design Sketchfab CC BY-NC-SA 4.0」
16. 4 个实体注册表 JSON（persona-chapters / chapter-pool / rag-intent-actions / registry-whitelist）预置到 public/fallbacks/

**⏳ 延后（黑客松不做，回到主版本继续推进）：**

- Product Pack 多文件拆分、Zod schema 版本校验器（8 月下旬视情况）
- 复杂章节跳转 / 点击进度条跳转（首版只顺序播放）
- TTS 语音合成旁白（只用字幕）
- 移动端触控精修、响应式断点（仅保证 ≥1280px 桌面端）
- Playwright / Cypress E2E（首版仅 vitest + 手动视觉验收）

**❌ 明确不做（半年内除非用户明确改变）：**

- 账号、支付、团队空间、审批流等 SaaS 后台
- 真实车辆 OBD / CAN / API 对接
- 开放式多 Agent 对话、自由工具调用
- 同时开发 ≥2 款车型（11 月前第二款仅用于验证可迁移性，且不选热门整车）
- 通用低代码平台、可视化拖拽编辑器
- SU7 模型用于任何直接商业用途（必须标注非官方、保留原作者署名）

### 授权合规强制要求（所有版本必遵守）

Sketchfab 下载的 `su7_ultra.glb` 适用 **CC BY-NC-SA 4.0**，因此：

1. 所有公开展示（页面、视频、截图、README）**必须**同时显示：
   - 原作者：Ddiaz Design
   - 来源：Sketchfab
   - 许可：CC BY-NC-SA 4.0
   - 非官方声明：本演示为非官方概念作品，不代表小米或任何品牌官方立场
2. **不得**用于直接商业用途（出售、广告、品牌合作物料）
3. 衍生作品（切分模型、形变目标）**必须**保持相同许可协议

## 架构原则

### 通用约束

- AI 只负责理解、检索和生成受限结构化计划；不得输出或执行任意代码、原始 Mesh 名、任意三维坐标或未注册工具。
- Three.js / R3F 层只执行已注册的动作、镜头和章节。
- 点击、文字、语音、发布会脚本和 AI Director 必须经过同一动作分发器，禁止维护五套动画路径。
- 车辆与发布会状态必须有单一事实来源。
- 优先单 Agent + 显式工作流。Subagent 用于工程分工，不代表产品运行时也要采用多 Agent。

### 单一事实来源（领域状态）

React/Zustand 只保存以下有意义的领域状态，**不得每帧触发 React 渲染**：

```typescript
appPhase: 'loading' | 'autoplay' | 'takeover' | 'finished' | 'error'
currentChapter: { id, startAt, duration, remainingMs }
activeActions: Map<actionId, { state, startedAt, timeoutAt }>
cameraControlOwner: 'script' | 'orbit'
inputMode: { text: true, voice: 'available'|'unsupported'|'denied'|'listening' }
packValidation: { version, valid, missingNodes: string[] }
vehiclePartStates: Map<partId, 'open'|'closed'|'moving'>  // e.g. window_driver_front
takeoverPromptDismissed: boolean   // 会话级标记：首次接管弹窗，用户点"保持手动"后为 true，刷新重置
```

### 动作分发器（ActionDispatcher）硬性约束

1. **幂等**：部件已处于目标状态时，跳过动画并提示"已打开/已关闭"，不重复执行。
2. **冲突组**：同组新动作到达时，先取消旧动作再执行新动作；冲突组示例：
   - `windows`：所有车窗与升降电机
   - `lights_front`：前灯组
   - `lights_rear`：尾灯组
   - `rear`：后备箱与尾翼
3. **超时**：单动作 > 5 秒未完成，强制标记为 failed 并回滚到起始状态，UI 顶部显示超时提示。
4. **完成/取消/失败**：所有长动作必须具备这三种终态，最终状态必须提交到单一事实来源。
5. **跨入口一致性**：同一 VehicleAction（如 `{type:'window', target:'driver_front', open:true}`）从按钮/文字/语音/脚本触发时，必须产生完全相同的动画曲线、时长和状态变更。

### 自动发布会打断与接管状态机

状态流转：

```
loading → autoplay（自动开始）
  autoplay → 用户触发按钮/文字/语音动作 → takeover（暂停章节计时）
  autoplay → OrbitControls 拖动开始 → cameraControlOwner='orbit'（不暂停章节字幕）

  takeover 进入时：
    → 若 takeoverPromptDismissed=false（会话内首次 / 刷新后首次）：
         弹出非阻塞提示条："已接管自动发布会" + 二选一按钮 [▶ 恢复自动发布会] / [✋ 保持手动控制]
           → 用户点击 [恢复自动发布会] → 立即回到 autoplay（从下一章节起点继续）
           → 用户点击 [保持手动控制] → 设置 takeoverPromptDismissed=true，保持 takeover
              本次会话剩余时间里，再发生接管不再弹出提示，用户可随时点底部 [播放] 或 [退出接管] 恢复
    → 若 takeoverPromptDismissed=true（本会话内用户已主动选择保持过手动）：
         不弹提示，直接进入 takeover，控制权完全交由用户

  takeover → 用户点击底部 [播放] 按钮 / 右下角 [退出接管] 按钮 → 立即回到 autoplay
  autoplay → 四章节播放完成 → finished（显示"演示完成，您可自由体验"）
  任何阶段 → 模型加载失败/节点缺失 → error（不白屏，显示降级提示与重启按钮）
```

**关于刷新重置：** 刷新页面后 `takeoverPromptDismissed` 重置为 `false`（浏览器会话级状态即可，不做持久化）。3 小时 MVP 内不做"重新登录后重置"，因为 v0.1 无账号系统。

**硬性规则：**
- **禁止自动恢复**：任何情况下，系统不得在接管后自动倒计时切回 autoplay；恢复必须由用户显式点击。
- 禁止脚本镜头与 OrbitControls 同时控制相机（由 `cameraControlOwner` 互斥）。
- script 模式下：只在 `cameraControlOwner='script'` 时 LERP 到目标 pose，OrbitControls.enabled=false。
- orbit 模式下：OrbitControls.enabled=true，脚本不得写入 camera.position。
- 控制权切换时必须用 300–500ms LERP 平滑过渡，禁止跳变/抖动。
- 接管提示条不得遮挡 8 按钮控制栏、文字输入框或字幕区域；建议放置于顶部章节进度条下方，或右下角"退出接管"按钮旁。
- 会话内一旦用户选择"保持手动控制"，后续接管不得再次弹出同样提示，避免打扰。

### GLB 节点访问与 Product Pack 查找层

**绝对禁止**：通用 R3F 组件代码中出现 `scene.getObjectByName('Window_FL')`、`children[2]` 等硬编码原始节点名或索引。

**必须遵守**：所有 GLB 节点访问必须通过 Product Pack 的两层查找：

```
通用代码请求语义ID → node-map[semanticId] → 原始节点名
                                         → 若缺失 → 走降级动作（见下）
```

首版最小 Product Pack（单文件 TS 对象即可，不必拆包 JSON）至少包含：

```typescript
{
  version: '0.1.0',
  attribution: { author: 'Ddiaz Design', source: 'Sketchfab', license: 'CC BY-NC-SA 4.0' },
  nodeMap: {
    window_driver_front: '???',   // 探测后填入实际 Mesh 名
    trunk:             '???',
    headlight_left:    '???',
    headlight_right:   '???',
    taillight_left:    '???',
    taillight_right:   '???',
    body:              '???'
  },
  actions: {
    window_driver_front: { axis: 'Y', range: [0, 0.3], durationMs: 800, reversible: true, conflictGroup: 'windows' },
    trunk:             { axis: 'Z', range: [0, 1.2], durationMs: 1200, conflictGroup: 'rear' },
    lights_headlight:  { emissiveIntensity: [0, 2], conflictGroup: 'lights_front' },
    lights_taillight:  { emissiveIntensity: [0, 2], conflictGroup: 'lights_rear' }
  },
  cameras: {
    front_face:        { position: [ 0,  1.2,  6  ], target: [0, 0.8, 0], transitionMs: 800 },
    side_driver:       { position: [ 5,  1.5,  2  ], target: [0, 0.8, 0], transitionMs: 1000 },
    rear_3q:           { position: [-4,  1.8, -5  ], target: [0, 0.8, 0], transitionMs: 1000 },
    interior_overview: { position: [ 0,  2.5,  1  ], target: [0, 1.0, 0], transitionMs: 1200 }
  },
  launchScript: [
    { id: 'ch1', startAt: 0,  durationMs: 15000, camera: 'front_face',        actions: [{t: 2000, a:'lights_headlight:on'}],                                              narration: '前脸设计与智能大灯点亮展示' },
    { id: 'ch2', startAt: 15, durationMs: 20000, camera: 'side_driver',       actions: [{t: 2000, a:'window_driver_front:open'}, {t: 10000, a:'window_driver_front:close'}], narration: '无框车门主驾车窗升降展示', orbit360: true },
    { id: 'ch3', startAt: 35, durationMs: 25000, camera: 'rear_3q',           actions: [{t: 2000, a:'trunk:open'}, {t: 14000, a:'trunk:close'}, {t: 2000, a:'lights_taillight:on'}], narration: '掀背电动后备箱开合与贯穿尾灯' },
    { id: 'ch4', startAt: 60, durationMs: 30000, camera: 'interior_overview', actions: [{t: 3000, a:'window_driver_front:open'}, {t: 6000, a:'lights_headlight:on'}],        narration: '座舱与综合交互能力演示' }
  ]
}
```

### 动作降级策略（GLB 节点缺失时必须执行）

3 小时 MVP 内**不得**为了真实部件动画而切分模型/做形变目标。若 Product Pack.nodeMap 中某语义 ID 未找到实际节点，必须执行以下**镜头+材质**降级：

| 语义动作 | 节点不可用时的降级行为 | UI 同步提示 |
| --- | --- | --- |
| `window_driver_front:open/close` | 切换 camera 到 `side_driver` 并略拉近（LERP），不实际移动任何 Mesh | 顶部提示："当前演示模型车窗节点暂不可用，已用镜头聚焦代替。v0.1 后续版本将替换为真实动画" |
| `trunk:open/close` | 切换 camera 到 `rear_3q`，同时 body 整体沿 Y 轴微抬 0.05（仅视觉标记） | 同上，替换为"后备箱" |
| `lights_headlight/taillight:on/off` | 若 headlight Mesh 找不到，则 body 材质 emissiveIntensity 加亮度 | 无单独提示（视觉可见），但 console 记录 missing node |

**必须**：UI 顶部用浅灰色小字永久显示（仅当存在 ≥1 个缺失节点时）：
> "⚠ 当前演示模型部分动作节点暂未映射，仅展示交互闭环；完整真实部件动画将在 v0.1 后续迭代中上线。"

### 文字/语音命令解析器（8 月纯前端无 AI）

首版解析器**不得**调用任何 LLM/后端。确定性关键字/正则匹配即可，匹配失败时返回固定 fallback 提示。

最小命令集合（匹配时中文简体 + 忽略空格）：

```
打开主驾车窗 / 降下车窗 / 开窗
→ {type:'window', target:'driver_front', open:true}

关闭主驾车窗 / 升起车窗 / 关窗
→ {type:'window', target:'driver_front', open:false}

打开后备箱 / 开后备箱 / 开尾门
→ {type:'trunk', open:true}

关闭后备箱 / 关后备箱 / 关尾门
→ {type:'trunk', open:false}

开大灯 / 开灯 / 打开灯光
→ {type:'lights', target:'headlight', on:true}

关大灯 / 关灯 / 关闭灯光
→ {type:'lights', target:'headlight', on:false}

开尾灯 / 刹车灯
→ {type:'lights', target:'taillight', on:true}
```

解析返回结构：
```typescript
{ matched: true,  action: VehicleAction }
{ matched: false, suggestion: '暂不支持该命令，请尝试：打开主驾车窗、打开后备箱、开灯' }
```

**语音入口**：Web Speech API `SpeechRecognition.lang = 'zh-CN'`，转写文本**不加任何修改**直接送入同一文字解析器。浏览器不支持 / 麦克风被拒时：
- `inputMode.voice = 'unsupported' | 'denied'`
- 语音按钮置灰，tooltip 显示"麦克风不可用，请使用文字或按钮"
- 页面不报错、不崩溃

### 黑客松合规边界（赛前允许做 vs 严格现场 4 小时做）

> ⚠️ **书面合规依据**：本节内容严格对应赛事「赛前允许准备静态资产，不允许提前编写业务代码/接入 LLM」的常规规则。任何赛前开发行为不得越界。

**✅ 赛前允许做（2026-08-04 至 2026-08-16 开赛之前）：**

| 类别 | 允许的具体内容 | 相关目录 |
|---|---|---|
| 3D 模型资产 | 新增 GLB 模型：儿童推车.glb / 24 寸行李箱.glb / 儿童座椅.glb 等后备箱可视化道具；前备箱内部件；轮毂/刹车卡钳变体；车身拉花/涂装变体；任意额外 3D 素材 | `public/assets/` |
| 知识库文档 | knowledge/ 目录下 01–04.md 继续补充数据、补更多对比项、补权威媒体来源；新增额外 md 文档；排版与内容增强 | `knowledge/` |
| Product Pack 扩展 | su7-concept.pack.ts 的 nodeMap 新增更多语义节点映射；新增 appearance 材质覆盖；新增 orbitActions 镜头位姿；新增已注册动作的参数调优（如 durationMs、虚拟窗尺寸）；**不得新增未在 v0.1 注册过的动作类型** | `src/pack/su7-concept.pack.ts`、`glb-nodes.json` |

**❌ 严格禁止赛前做（必须留在黑客松现场 4 小时内开发）：**

- 实体注册表 JSON 实际写入 `public/fallbacks/` 目录（可保留设计文档，但不落地成代码文件）
- FastAPI 任何新增路由骨架（`/api/ai-director`、`/api/rag` 等）
- `expandChapterIdsToLaunchScript` 展开函数、fallback 读取逻辑、关键词匹配逻辑
- 前端任何新增 UI（人设标签区、问答对话区、气泡、追问按钮）
- 任何 TDD 测试、业务代码测试、E2E 测试用例
- 任何 LLM API Key 配置、Prompt 编写、few-shot 示例注入、网络请求代码
- 任何与 AI Director / RAG 相关的 `.env` 新增变量写入
- 设计文档以外的实际代码（AGENTS.md、docs/ 文档允许更新）

---

### 黑客松实体注册表设计规范（一鱼三吃）

**详细设计文档（纯 Schema 稿，赛前允许写）**：见 [2026-08-04-hackathon-entity-registry-design.md](file:///C:/Users/11873/Desktop/AutoLaunch/docs/superpowers/specs/2026-08-04-hackathon-entity-registry-design.md)

**⚠️ 合规提醒：以下 4 个 JSON 的实际内容，赛前只允许以 Schema 形式存在于设计文档，禁止提前写入 `public/fallbacks/` 目录，写入操作必须发生在现场 4 小时内。**

**现场写入位置**：`public/fallbacks/`（Vite 构建后 dist/fallbacks/ 同步，FastAPI 也能读）

```
public/fallbacks/         ← 赛前留空，现场 Step0 填入
├── persona-chapters.json          ← ① 人设层（AI 决策用）：性能党/家庭用户 → 章节权重与推荐顺序
├── chapter-pool.json              ← ② 执行层（前端执行用）：6 个可复用 chapter 模板
├── rag-intent-actions.json        ← ③ RAG 回填层：15 个高频问题意图 → 联动动作映射
└── registry-whitelist.json        ← ④ 白名单校验层：镜头/动作/人设 ID 枚举（三者共享）
```

**「一鱼三吃」设计原则**：每个 JSON 同时承担三重身份

| 身份 | 消费方 | 用法 |
|---|---|---|
| ① AI Prompt 注入的「白名单注册表」 | LLM（AI Director / RAG） | 整个 JSON 作为 system prompt 一部分喂入，LLM 只能从白名单选 |
| ② 后端路由的「fallback 数据源」 | FastAPI | LLM 超时 / 挂了 / schema 不对时，后端直接读 JSON 返回正确格式 |
| ③ 前端的「运行时配置 + 校验器」 | React 前端 | 收到 Agent 返回结果后，用 registry 校验字段合法；失败则切 fallback |

**两层编排架构（核心约束）**：

```
用户选人设
    ↓
① persona-chapters.json（AI 决策层：选哪些 chapter + 排顺序）
    ↓ LLM 仅输出：{ persona, chapterIds: ["ch1", "ch2", "ch3"] } ← 极简，出错概率低
    ↓ 后端/前端「展开函数」根据 chapterIds 查询
② chapter-pool.json（执行层：每个 chapter 的具体镜头、动作、字幕）
    ↓ 拼成符合 Schema 的完整 chapters 数组
前端 LaunchPlayer 执行
    ↓ 用 ④ registry-whitelist.json 校验每个镜头/动作 ID
3D 场景动起来
```

**硬性规则**：
- AI Director 输出 **只能是 chapterIds 数组**，严禁输出完整 chapters（容易瞎写 narration、atMs）
- 展开函数在前端/后端完成，从 chapter-pool.json 里取预存的 narration + defaultActions
- 前端校验失败率 > 30% 直接切 persona fallback，不尝试局部修复

---

### 黑客松 4 小时现场落地步骤（基于 v0.1 已完成基线 + 合规边界）

> 旧版「3 小时 MVP 开发顺序」已作废，v0.1 基线全部完成。本节所有步骤**严格要求在黑客松现场 4 小时计时窗口内完成**，赛前不得提前编写。

```
Step 0（45 min）：实体 JSON 落地 + 环境校验  ← 新增：填入 public/fallbacks/
  → 按照 docs/superpowers/specs/2026-08-04-hackathon-entity-registry-design.md 的 Schema
  → 手动创建 4 个 JSON 文件写入 public/fallbacks/：
      1. persona-chapters.json（2 人设 + fallbackChapterIdsByPersona）
      2. chapter-pool.json（6 chapter 模板，每套 2 份 narration 文案）
      3. rag-intent-actions.json（15 intent，keywords + linkedVehicleActions）
      4. registry-whitelist.json（5 镜头 + 10 动作 + 2 人设白名单）
  → npm i && npm run build 验证 dist/fallbacks/ 4 个 JSON 可通过浏览器访问
  → FastAPI /api/health 返回 status=ok，模型字节数正常
  → Chrome 打开页面，确认左下角合规条 + v0.1 90 秒发布会无报错
  → 输出：4 JSON 就位，跳过任何脚手架重搭工作

Step 1（45 min）：RAG 路由（FastAPI）+ 知识库接入
  → 新增 POST /api/rag (question: string) 路由骨架
  → 读取 rag-intent-actions.json 做关键词匹配 → 回填 linkedVehicleActions + suggestedFollowUps
  → 读取 knowledge/ 4 个 md → 简单关键词搜索 + 拼接 answer + citations（不用向量库）
  → comparison 字段：命中 defaultComparisonTopic 时从 03_竞品对比.md 取对应段落
  → demo-qa-engineer 同步写 3 条测试：
      1. 问"后备箱多大"→ 返回含 rear_three_quarter + trunk open 联动
      2. 问"零百加速几秒"→ 返回含 front + 大灯联动
      3. 问"今天天气"→ 返回空 linkedActions 但 answer 不报错

Step 2（75 min）：AI Director 路由（FastAPI）+ 两层编排
  → 新增 POST /api/ai-director (persona: "performance" | "family") 路由骨架
  → 后端实现 expandChapterIdsToLaunchScript(chapterIds, persona) 展开函数
    → 去 chapter-pool.json 取对应 chapter 模板
    → 填 narrationTemplates[persona] + defaultActions + recommendedDurationMs
  → Schema 校验失败或 LLM 超时 → 直接读 persona-chapters.json.fallbackChapterIdsByPersona 展开
  → Prompt 注入：registry-whitelist.json（白名单）+ persona-chapters.json（权重）
  → 要求 LLM 仅输出 { persona, chapterIds: string[] }（3 个字符串）+ 接 LLM API
  → demo-qa-engineer 同步写 3 条测试：
      4. persona=performance → 返回 chapters[0].camera == "front"
      5. persona=family → 返回 chapters[0].camera == "rear_three_quarter"
      6. 临时 mock LLM 抛异常 → 自动切 fallback，返回格式依然合法

Step 3（55 min）：前端 UI 与联动
  → 左侧新增 2 个「人设标签」：性能党 🏎️ / 家庭用户 👨‍👩‍👧
  → 点击人设 → POST /api/ai-director → 取回 chapters → 调用 LaunchPlayer 替换脚本并播放
  → 右下角新增问答对话区：输入框 + 历史气泡 + 发送按钮
  → 发送问题 → POST /api/rag → 收到 answer 气泡 + 自动 dispatch linkedVehicleActions
  → suggestedFollowUps 以蓝色小按钮形式展示在气泡下方，点击自动发相同问题
  → 顶部合规定位条保持可见，不被新 UI 遮挡
  → .env.example + .env 同步新增：AI_API_KEY / AI_API_BASE_URL / VITE_ENABLE_HACKATHON_PANELS 等

Step 4（20 min + buffer 40 min）：独立验收 + 讲稿演练
  → demo-qa-engineer 跑 hackathon-spec 4 条验收：
      1. 切「性能党」→ 章节顺序：前脸大灯 → 车窗 → 360° 展台
      2. 切「家庭用户」→ 章节顺序：后视角 → 后备厢打开停留 → 四车窗下降
      3. 问「后备箱多大？」→ RAG 返回带引用答案 + 自动切后视角 + 开后备厢
      4. 全程合规声明不消失
  → 断网模拟：切断 LLM API → AI Director 切 fallback，RAG 走关键词匹配
  → 自己计时 2 分钟路演一遍，确保 3 个核心演示动作（切人设 A / 切人设 B / 问一个 RAG 问题）2 分钟内能完整做完
```

## Product Pack 契约（v0.1 最简版）

首版 Product Pack 以**单个 TypeScript 对象**存放于 `src/pack/su7-concept.pack.ts`，不必拆分为多 JSON 文件。8 月下旬可迁移为 `products/su7-concept/` 目录，但结构字段保持一致。

```
products/
└── {pack-id}/
    ├── pack.ts              # 或 pack.json
    ├── model.glb            # 或其他被 node-map 引用的模型路径
    ├── node-map.json        # 语义ID → 原始节点名
    ├── actions.json         # 动作声明
    ├── camera-shots.json    # 镜头声明
    ├── launch-script.json   # 发布会章节脚本
    └── knowledge/           # 10 月 v0.3 起引入产品知识库
```

`packValidation` 加载时必须检查：
1. `model.glb` 路径文件存在
2. `nodeMap` 中所有 key 在 GLB 中能找到 → 未找到者加入 `missingNodes`，走降级
3. `actions`、`cameras`、`launchScript[*].camera` 引用的 ID 均存在 → 不存在则该条目跳过，记录 warning
4. `attribution` 作者、来源、许可不为空 → 缺失则加载失败（合规原因）

## 工作方式

实施前：

1. 阅读相关代码、现有测试和项目规则。
2. 说明用户可见行为、最小修改范围和验收条件。
3. 找出现有权威实现，禁止另起一套平行架构。
4. 涉及素材和事实时检查授权、来源、品牌与隐私风险。

**GLB 新增前置步骤：** 在任何 3D 动作开发前，**必须**先运行 GLB 节点探测脚本/页面，将 `nodeMap` 中能映射的语义 ID 先填完；无法映射的部分，优先采用降级策略，不得在 3 小时 MVP 内切分模型。

实施时：

- 保持改动聚焦，保留用户已有且无关的修改。
- 遵循仓库现有包管理器、测试框架、格式化和命名习惯。
- 不提交密钥、私有地址、未授权模型、用户录音或大型生成媒体。
- 公开界面保留"非官方概念演示"及素材来源，不暗示与小米或其他品牌存在官方合作。
- 跨前后端契约变更必须同步更新类型、校验器、夹具与契约测试。
- 每次新增/修改环境变量后，**必须同步更新** `.env` 和 `.env.example` 两个文件。

交付前：

1. 先运行聚焦测试，再运行可行的相关测试。
2. 镜头、动画、声音、时序和接管行为必须手动验证。
3. 汇报修改、测试、未验证项、已知限制和下一项高风险假设。
4. 仅测试 Mock 或兜底路径时，不得宣称真实能力已完成。

## v0.1 验收标准（7 条硬门槛，全部满足方可标记 v0.1 完成）

1. **启动可见性**：`npm i && npm run dev` 执行后，浏览器控制台无报错；10 秒内 su7_ultra 模型出现在页面中央；左下角可见完整非官方声明；无任何 404 资源请求。
2. **自动发布会完整性**：不进行任何操作，页面自动在约 90 秒（±10 秒）内顺序完成 4 章节；顶部进度条 0 → 100%；字幕依次出现；结束后显示"演示完成"且不自动重复。
3. **接管打断（按钮入口 + 首次弹窗）**：第 20 秒点击"打开后备箱" → 章节进度条立即暂停；后备箱（或其降级行为）1.2 秒内完成；顶部/侧边**弹出提示条**显示"已接管自动发布会" + 二选一按钮 [▶ 恢复自动发布会] / [✋ 保持手动控制] → 点击 [恢复] → 立即从下一章节起点继续播放；首次点击 [保持手动] → 保持 takeover，底部 [播放] 按钮随时可手动恢复。
4. **接管打断（会话内二次接管 + 不重复弹窗）**：在验收条件 3 中已点击过 [保持手动] 后，刷新前再次点击任何按钮触发接管 → **不再弹出** [恢复/保持手动] 提示条，直接进入 takeover；用户可随时点底部 [播放] 或 [退出接管] 手动恢复。
5. **文字解析 + 幂等**：输入"打开主驾车窗"回车 → 车窗动作执行；再次输入相同命令 → UI 提示"主驾车窗已处于打开状态"且不重复动画；输入"关闭主驾车窗" → 反向动作；输入"起飞" → UI 提示 3 个示例命令。
6. **语音入口 + 降级**：Chrome 授予麦克风权限时点击语音按钮 → 说"开灯" → 转写短暂出现在输入框 → 大灯/body emissive 亮度提升；麦克风被拒绝或浏览器不支持时 → 语音按钮置灰 + 明确提示"麦克风不可用，请使用文字或按钮" → 页面不崩溃。
7. **OrbitControls 与脚本镜头切换**：自动发布会期间（首次接管，弹窗未关闭时）拖动视角 → 自动镜头立即停止，OrbitControls 允许自由观察；镜头控制权完全交给用户，**不自动恢复**；点击接管提示条 [恢复] 或右下角 [退出接管] → 相机平滑 LERP 回脚本 pose 并恢复发布会。
8. **测试覆盖 + 降级不白屏**：`npm test` 至少 5 条 vitest 通过（幂等 / 冲突组 / 已知解析 / 未知解析 / 节点缺失降级 / takeoverPromptDismissed 置位后不重复弹窗）；临时清空 nodeMap 中 window_driver_front 后点击"开窗" → 顶部出现降级提示条，页面不白屏、console 有 missing node 记录。

## 完成定义

### 3 小时 MVP 完成定义

- 满足 v0.1 验收标准第 1–7 条。
- 正常、边界（重复点击/未知命令/麦克风光）、最可能失败（节点缺失）路径已处理。
- 通用运行时代码中没有任何硬编码 SU7 原始 Mesh 名。
- 自动化测试 ≥5 条，覆盖领域状态 / 解析器 / 降级。
- 视觉交互有手动验收截图或记录。
- 无需打开开发者工具即可演示（错误提示在 UI 层可见）。
- `.env.example` 与 `.env` 已同步新增配置项。
- README 包含启动命令、模型来源与授权、3 条手动验收步骤。

### 月度交付完成定义（8–12 月通用）

在 3 小时 MVP 基础上，每月交付额外满足：
- 对应月份 Roadmap 中"核心目标"的用户场景端到端可用。
- 上月功能未发生回归（demo-qa-engineer 独立验证）。
- 架构或 Product Pack 协议变化已同步文档。
- 留下可量化的开发时间与效果数据（为第二款产品对比做准备）。

