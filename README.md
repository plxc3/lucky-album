# Lucky 的日常

Lucky 的照片、日记、视频和会互动的网页形象，沿用原有相册设计。

正式网站：**https://plxc3.github.io/lucky-album/**

2026-10-16 主人明确选择 GitHub Pages 公开托管：网站与仓库素材可公开访问，不设密码。旧 GPT 站点不再作为本项目的发布目标。

## 本次内容

- 54 条独立记录：30 段视频、24 张照片。新增 17 段已核对的 Lucky 家庭视频；身份未确认的其他猫咪素材暂不收录。
- 16 张既有照片补入更高像素版本。原 JPG 保留；两张 HEIC 同时保留可下载源件和浏览器全尺寸 JPG。
- 在形象页或浮动桌宠上直接点击小猫，会变为猫耳女孩；再点击女孩变回小猫。没有单独的变身按钮。
- 小猫保留呼吸、眨眼、耳尾与爪部动作；女孩有点头、手边回应、摆尾和休息动作。桌宠菜单提供互动，键盘 Enter／空格也能变换形态。
- 声音默认关闭；可选提示音是网页合成音，不冒充 Lucky 的真实猫叫。

Lucky 是主人提供的三个月大长尾母三花。保留第二版柔和坐姿、奶白长毛、烟灰与浅杏斑块、粉鼻及灰尖长尾；旧版站姿和独立拟人设定稿继续保留。

日期均为收录日期，不是已核实的拍摄日期。成长页只做有依据的外观观察，不编造逐月体重、身长或成长曲线。完整媒体不裁切；列表使用轻量预览，详情与放大查看使用完整画面。视频保留现有完整时长和音轨。

## 本地运行与发布

需要 Node.js 20 或更新版本，无需安装第三方依赖。

```sh
node scripts/check.mjs
node scripts/serve.mjs
```

预览地址：`http://127.0.0.1:4180/lucky-album/`。预览使用项目子路径，便于发现 GitHub Pages 路径问题。

GitHub Pages 沿用本仓库 `main` 分支根目录发布，`.nojekyll` 让文件直接作为静态资源提供。路由使用 URL hash，原日记链接继续有效。推送前运行检查，并验证手机与桌面布局、变换、互动及媒体查看。

## 文件

- `content.js`：54 条记录及素材路径；`MATERIALS.md`：来源、去重与历史说明。
- `app.js`、`album.js` 及 CSS：页面、相册翻页、日记与完整媒体查看。
- `character-rig.js`、`pet.js`、`pet.css`：两种形态的图层、动作和互动。
- `assets/`：完整照片、视频、预览、既有角色插画和字体许可。
- `MEDIA_20261016.json`：本轮 69 个媒体文件的字节长度与 SHA-256。
- `QUALITY.md`：本轮验证范围及限制。

变换过渡参考 [Chrome View Transitions 的圆形展开示例](https://view-transitions.chrome.dev/circle/spa/)，使用本项目自己的 CSS 圆形揭示、少量星点与既有角色素材实现，没有引入新的动画依赖。字体为 Noto Serif CJK SC 子集，许可保存在 `assets/lucky-album-serif-LICENSE.txt`。

本轮还参考了主人提供的 [Takayu Motion Reference](https://motion-reference.takayustudio.jp/) 中的圆形展开、角色待机与尾巴跟随示例：变换揭示约 760ms，打招呼时头部先动，手部和尾巴稍后回应，并在返回待机前收住动作。具体图层与动作由本项目独立实现。
