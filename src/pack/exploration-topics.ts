import type { VehicleAction } from '../types'

export const explorationTopics = [
  {
    id: 'performance', title: '驾趣与性能', summary: '性能定位、外观与日常取舍',
    headline: '从看得见的设计，了解性能定位。',
    description: '观察前脸、灯光和车身，再了解参数的适用配置与测试条件。赛道环境只表达氛围，不模拟真实驾驶。',
    questions: ['零百加速的测试条件是什么？', '性能配置有哪些日常使用取舍？'],
    previewLabel: '观察前脸与灯光',
    actions: [{ type: 'orbit', preset: 'front' }, { type: 'lights', target: 'headlight', on: true }],
    requirement: '来一段性能与外观展示，先看灯光，再看车身。',
  },
  {
    id: 'family', title: '全家与装载', summary: '行李怎么放，装卸是否方便',
    headline: '带上家人，也带上行李。',
    description: '先看尾门开口，再用现有行李道具探索装卸。模型摆放是交互示意，不代表实车容量或所有行李都能装下。',
    questions: ['后备箱容量资料为什么不一样？', '当前演示支持怎样的行李装载？'],
    previewLabel: '观察尾门开口',
    actions: [{ type: 'orbit', preset: 'rear_three_quarter' }, { type: 'trunk', open: true }],
    requirement: '一家三口周末出游，请演示后备箱与双箱装载。',
  },
  {
    id: 'comfort', title: '舒适与日常', summary: '上下车、乘坐空间与待确认项',
    headline: '把舒适拆成具体的问题。',
    description: '从侧面观察上下车与车窗操作，再查阅适用资料。座椅感受、后排实测和隔音仍需相应证据或实际试乘，不能从开窗动画推断。',
    questions: ['后排空间有哪些适用资料？', '当前模型能演示哪些车窗操作？'],
    previewLabel: '观察主驾侧面', actions: [{ type: 'orbit', preset: 'driver_side' }],
    requirement: null,
  },
] as const satisfies readonly {
  id: string; title: string; summary: string; headline: string; description: string
  questions: readonly string[]; previewLabel: string; actions: readonly VehicleAction[]; requirement: string | null
}[]
