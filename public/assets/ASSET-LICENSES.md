# 3D 资产授权清单

本目录中的 3D 模型不因项目源码采用 MIT 而自动改为 MIT；使用或分发模型时，须分别遵守下列资产许可证。

## 展示环境与表面素材

以下素材均来自 [Poly Haven](https://polyhaven.com)，使用 [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)；核对依据：[Poly Haven 资产许可](https://polyhaven.com/license)。场景不代表拍摄地、赛道或素材作者与汽车品牌存在合作。

| 本地文件（`environments/`） | 作者 | 原始来源 | 处理 |
|---|---|---|---|
| `studio_small_09_1k.hdr` | Sergej Majboroda | [Studio Small 09](https://polyhaven.com/a/studio_small_09) | 原始 1K HDR，仅用于环境光与反射 |
| `zwartkops_start_sunset_1k.hdr`、`zwartkops_start_sunset_8k.webp` | Dimitrios Savva、Jarod Guest | [Zwartkops Start Sunset](https://polyhaven.com/a/zwartkops_start_sunset) | HDR 保留原样；官方 tonemapped JPG 缩至 8192×4096、WebP quality 90 |
| `toposcope_sunset_1k.hdr`、`toposcope_sunset_8k.webp` | Dario Barresi | [Toposcope Sunset](https://polyhaven.com/a/toposcope_sunset) | HDR 保留原样；官方 tonemapped JPG 缩至 8192×4096、WebP quality 90 |
| `concrete_floor_02_*_1k.jpg` | Rob Tuytel | [Concrete Floor 02](https://polyhaven.com/a/concrete_floor_02) | 原始 diffuse、OpenGL normal、roughness 贴图 |

精确下载地址、字节数、SHA-256 与处理记录见 [`environments/manifest.json`](environments/manifest.json)。素材在本地自托管，访客运行时无需连接 Poly Haven。拱形展廊为 AutoLaunch 程序化几何，户外使用接地全景背景与独立 HDR 环境光，不提供实景道路或地形仿真。

## AutoLaunch 原创行李箱

| 文件 | 规格 | 作者与来源 | 许可证 |
|---|---|---|---|
| `suitcase-carry-on-20.glb` | 56 × 37 × 23 cm，黑色铝镁合金硬箱 | AutoLaunch Contributors，原创程序化资产 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |
| `suitcase-checked-24.glb` | 66.5 × 43.3 × 27.5 cm，银色铝镁合金硬箱 | AutoLaunch Contributors，原创程序化资产 | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |

Copyright © 2026 AutoLaunch Contributors.

允许在署名、非商业和相同方式共享的条件下复制、展示及修改上述两个模型；分发修改版本时须注明改动。CC 公开许可不包含商业使用权，商业使用须另行取得版权所有者的书面授权。

上述模型为无品牌原创设计，不包含第三方商标，也不声明与任何行李箱品牌存在关联或获得其认可。

## Xiaomi SU7 Ultra 模型

| 文件 | 作者 | 来源 | 许可证 |
|---|---|---|---|
| `su7_ultra.glb` | Ddiaz Design | [Sketchfab](https://skfb.ly/pKv9Z) | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) |

该车辆模型为第三方资产。本项目是非官方概念演示，与小米或任何汽车品牌不存在官方合作关系。公开展示、截图、视频或衍生版本均须保留作者、来源、许可证及非官方声明。

闪电黄、太空银、鹦鹉绿、珍珠白、曜石黑的名称与视觉方向参考[小米 SU7 Ultra 官方页面](https://www.xiaomiev.com/ultra)及其 2025-02-27 发布图片（`su7_ultra_20250227/pc/5.jpg`、`8-1.jpg`、`8-2.jpg`、`9-1.jpg`、`9-2.jpg`）。这些是视觉近似，不是厂家实测色值；闪电黄保留银色拉花，其他颜色在着色器中隐藏拉花。原始 GLB 不变，不代表完整的官方选装配置。

`vehicle/seat-front-original.png`（63,893 字节）、`vehicle/seat-rear-original.png`（139,237 字节）分别从原始 Ddiaz Design GLB 的 `S_Seat`、`SeatB` 基色纹理逐字节提取，未重新绘制，继续适用同一 **CC BY-NC-SA 4.0** 许可与署名。它们恢复黑色座椅、黄色缝线和 Ultra 字样，视觉参考官方 `su7_ultra_20250227/pc/14-1.jpg`。红/灰缝线仅为演示自定义，不宣称对应官方可售内饰组合；座椅造型仍受原模型精度限制。官网图片仅用于核对，没有打包分发。
