# Agent Builders Hackathon · 内部执行计划与落地 Spec
> ⚠️ **本文件仅黑客松现场开发使用，不对外提交、不用于报名表**
>
> 报名提交请使用同目录的 `hackathon-报名提交版.md`
>
> 赛事：Agent Builders Hackathon @ 杭州站 · 2026-08-16 · 赛道 2
> 项目：AutoLaunch —— 一场发布会，一千种打开方式

---

## 一、4 小时现场真实可跑通的落地范围（务实版）

### 核心原则
- **只使用已经存在、可直接调用的 VehicleAction**，不现场写新的 3D 节点映射动画
- **人设落地 2 种（反差足够大）**，不做 4 种
- **RAG 用人工精选 Markdown + 关键词 fallback**，不依赖云端向量服务

### 已存在可直接复用的动作 & 镜头池
| 类别 | 已注册可用 ID |
|---|---|
| 镜头 | hero_front_left / front / driver_side / rear_three_quarter / turntable |
| 动作 | lights_headlight / lights_taillight / trunk / window_driver_front / window_passenger_front / window_driver_rear / window_passenger_rear / window_all |

---

## 二、人设 A × 人设 B 差异化脚本（现场给评委一眼看出差异）

### 人设 🏎️ 性能党 脚本编排
```
章节顺序：front-design → frameless-windows → interactive-finale (turntable)
总时长：约 65 秒
```
| 章节 | 镜头 | 动作 | 字幕侧重 |
|---|---|---|---|
| Ch1 前脸 | front | 2s → 大灯点亮 | 低趴前脸、智能大灯语言 |
| Ch2 驾驶侧 | driver_side | 2s → 主驾车窗打开；10s → 主驾车窗关闭 | 无框车门、运动座舱氛围 |
| Ch3 线条展台 | turntable | 3s → 四车窗全下；12s → 四车窗全关 | 车身线条、黄金比例、赛道涂装 |

### 人设 👨‍👩‍👧 家庭用户 脚本编排
```
章节顺序：rear-hatch → interactive-finale → frameless-windows (driver_side 保持)
总时长：约 75 秒
```
| 章节 | 镜头 | 动作 | 字幕侧重 |
|---|---|---|---|
| Ch1 后备厢 | rear_three_quarter | 2s → 尾灯亮；2s → 后备箱开；14s → 后备箱关 | 587L 官方数据；可竖放儿童推车；587L=2 个 24 寸箱+2 背包 |
| Ch2 全车通风 | turntable | 3s → 四车窗同时下降；12s → 四车窗同时关闭 | 全家出行通风、天幕采光、安静隔音 |
| Ch3 主驾侧 | driver_side | 停留 8s，镜头聚焦后排腿部区域（无动作，靠讲解） | 后排腿部空间、车门储物格、儿童座椅接口 |

---

## 三、RAG 四段式体感答案（不塞行李箱 GLB 模型，靠镜头+引用替代）

### 知识库 Markdown 目录结构（手动整理，约 10 页内）
```
knowledge/
  01_核心参数_三电续航充电.md
  02_空间实测_前后备箱_后排.md
  03_竞品对比_ModelS_Taycan.md
  04_车主实测_冬季续航_充电速度.md
```

### 问答返回结构（强约束 JSON）
```json
{
  "answer": "官方数据 587L，媒体实测可竖放一台标准儿童推车，深度约 108cm。",
  "citations": [
    { "source": "官方发布会 PPT", "page": "P15" },
    { "source": "汽车之家 SU7 空间实测", "page": "P7" }
  ],
  "linkedVehicleActions": [
    { "type": "orbit", "preset": "rear_three_quarter" },
    { "type": "trunk", "open": true }
  ],
  "comparison": "同价位 Model S Plaid 掀背后备箱 793L 更大但前备箱较小；SU7 前备箱官方 110L 可塞标准登机箱。",
  "comparisonCitation": { "source": "汽车之家横评", "page": "P22" },
  "suggestedFollowUps": [
    "要不要看看前备箱容积？",
    "后排腿部空间有多大？"
  ]
}
```

### 体感落地的 4 个优先级
1. **答案 + 引用**（必做，文字可验证）
2. **镜头 + 已注册动作联动**（必做，评委可直接看到 3D 动起来）
3. **竞品对比 + 引用**（必做，差异化加分项）
4. **追问建议（可点击触发）**（时间够才做，不够就只文字展示）

---

## 四、AI Director 输出格式强约束 Schema（前端直接消费）

```json
{
  "$schema": "v0.1-hackathon-only",
  "persona": "performance" | "family",
  "chapters": [
    {
      "id": "string, 例如 ch1_front",
      "title": "10 字以内章节标题",
      "camera": "镜头 ID，必须 ∈ 已注册镜头池",
      "durationMs": 8000 | 10000 | 12000 | 15000 | 20000 | 25000 | 30000,
      "narration": "本章节字幕文案，60 字以内",
      "actions": [
        {
          "atMs": "章节起点后多少毫秒触发，建议 2000 的倍数",
          "action": "必须是已注册 VehicleAction 之一，不能出现新字段"
        }
      ]
    }
  ]
}
```

### 失败兜底（现场 API 挂了或 LLM 胡说八道时）
前端写死 2 套 JSON 文件作为 fallback：
- `/fallbacks/ai-director-performance.json`
- `/fallbacks/ai-director-family.json`

API 超时或 schema 校验不过，自动读本地 fallback，保证评委不冷场。

---

## 五、现场 4 小时时间分配建议

| 时间段 | 做什么 | 验收标准 |
|---|---|---|
| 12:00–13:00 | 搭知识库 + 写 RAG 路由（FastAPI）+ 关键词 fallback | 问"后备箱多大"返回含 citations 的 JSON |
| 13:00–14:30 | 搭 AI Director 路由：2 人设 → 章节 JSON + schema 校验 + 兜底 | 选人设 → 返回 2 套不同的 chapters |
| 14:30–15:30 | 前端 UI：左侧人设标签区 + 右侧问答对话区 + 镜头联动 | 点性能党/家庭用户 → 发布会章节顺序明显不同 |
| 15:30–17:00 | 打磨 + 本地部署双端测试 + 合规定位条 + 手动走通 3 条验收 | 3 条 100% 通过，无报错 |
| 17:00– 路演准备 | 2 分钟讲稿打印 + 演示脚本计时演练 | 自己计时一遍 ≤ 2 分钟讲清楚 |

---

## 六、路演讲稿（2 分钟，背下来）

```
0-15s  痛点引入
  大家好，我做的是 AutoLaunch。
  现在一场新车发布会 50 万起，但所有人看的都是一模一样的 30 分钟视频。
  性能党被迫看儿童座椅，奶爸被迫看赛道数据，信息密度极低。

15-60s  解法 + 现场演示
  我把一场发布会拆成三层：
  第一层是可点击的 3D 展车，五入口统一动作协议，已写好。
  第二层是 AI Director Agent：用户选"性能党"或"家庭用户"，
        AI 从已注册的章节、镜头、动作池里重排脚本。
  第三层是产品知识 RAG：问"后备箱多大？"→ 返回带引用的答案 + 自动打开后备箱。
  （现场操作：切人设 A → 章节顺序变了；再问一个问题 → 3D 动起来）

60-100s  为什么这是 Agent Builders 赛道项目
  这里的 AI 不是聊天机器人，是发布会总导演；
  Agent 输出强约束 JSON，只能从已注册池选，执行端可控；
  RAG 不是客服，是产品讲解员；答案配镜头+引用，评委能看到体感。
  今天 4 小时，我只死磕人设差异化和问答联动这两个核心点。

100-120s  收尾 + 扣题
  赛道 2 "你想做的一切智能体"：我想做的，是一个让每个人，
  都能看懂属于自己的那辆车的发布会智能体。
  谢谢。
```

---

## 七、1 页迷你 BP（入选后路演导出 PDF 用）

### 项目名称
**AutoLaunch —— 一场发布会，一千种打开方式**

### 一句话介绍
用 AI Director 千人千面编排章节 + 可点击 3D 展车 + 产品知识 RAG，
替代一场 50 万成本但所有人看的都一样的线下发布会。

### 🔴 痛点（3 句话）
1. **千人一面**：30 分钟发布会里，每个人真正想看的只有 5 分钟。
2. **参数没体感**：数字念完观众没概念，不如切镜头+打开车门自己看。
3. **成本信息比极低**：发布会 50-200 万，但用户最具体的问题一个都没答。

### 🟢 解决方案（三层架构）
| 层 | 做什么 | 本次黑客松状态 |
|---|---|---|
| 3D 交互基础层 | 真实展车 + 统一 VehicleAction 协议 + 动作分发器 + 镜头系统 | ✅ 已有代码 |
| AI Director Agent | 用户选人设 → 输出已注册池内的结构化章节-镜头-动作计划 | 🔥 本次重点 |
| 产品知识 RAG | 精选 Markdown 知识库，问答带引用 + 切镜头 + 竞品对比 | 🔥 本次重点 |

### 🧠 为什么是 AI + Agent
- AI = 发布会总导演，重组内容顺序、镜头、讲解
- Agent = 强约束 JSON Schema 输出，执行端可控
- RAG = 产品讲解员，答案配镜头+引用

### 🏆 现场 Demo 可验收 4 条
1. ✅ 切"性能党"→ 章节顺序：前脸大灯 → 车窗 → 360° 展台
2. ✅ 切"家庭用户"→ 完全不同的顺序：后视角 → 后备厢打开停留 → 四车窗下降
3. ✅ 问"后备箱多大？"→ RAG 返回带引用答案 + 自动切后视角 + 开后备厢
4. ✅ 全程"非官方概念演示 · Ddiaz Design Sketchfab CC BY-NC-SA 4.0"合规

---

## 八、AI Director 家庭用户人设输出示例

```json
{
  "$schema": "v0.1-hackathon-only",
  "persona": "family",
  "chapters": [
    {
      "id": "ch1_rear_trunk",
      "title": "后备厢空间",
      "camera": "rear_three_quarter",
      "durationMs": 10000,
      "narration": "官方数据 587L，可竖放一台标准儿童推车加两个背包。",
      "actions": [
        { "atMs": 2000, "action": { "type": "trunk", "open": true } }
      ]
    },
    {
      "id": "ch2_all_windows",
      "title": "四门车窗通风",
      "camera": "driver_side",
      "durationMs": 8000,
      "narration": "四车窗同时下降，家庭出行通风更方便。",
      "actions": [
        { "atMs": 2000, "action": { "type": "window", "target": "all", "open": true, "progress": 100 } }
      ]
    }
  ]
}
```
