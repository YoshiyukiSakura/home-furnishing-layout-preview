# 在线家庭软装布置预览 / Home Furnishing Layout Preview

一个用于户型软装推敲的 Web 小工具。当前版本聚焦客餐厅俯瞰视角，用米制网格表达家具尺寸、通道余量、门洞和玄关空间，并支持家具碰撞体积检查。

A web tool for exploring home furnishing layouts from a top-down floor-plan view. This first version focuses on the living and dining area, with metric grids, door openings, foyer geometry, furniture clearances, and collision checks.

![应用截图 / App screenshot](docs/screenshots/layout-desktop.jpg)

## 在线预览 / Online Preview

[打开 GitHub Pages 预览 / Open the GitHub Pages preview](https://yoshiyukisakura.github.io/home-furnishing-layout-preview/)

线上预览是静态部署版本。因为 GitHub Pages 没有 Node 后端，布局状态会自动保存到当前浏览器的 `localStorage`。本地运行或自建 Node 服务时，状态会保存到服务端 JSON 文件。

The online preview is a static GitHub Pages build. Since GitHub Pages does not provide a Node backend, layout state falls back to the current browser's `localStorage`. When running locally or on a self-hosted Node server, state is saved to a server-side JSON file.

## 功能 / Features

- 俯瞰式客餐厅布局画布，内置当前 F 户型客餐厅、玄关、阳台和主要房门示意。
- 家具支持拖拽、旋转、复制、删除和尺寸微调。
- 家具碰撞体积按实际尺寸加外扩余量计算，可提示家具互相重叠或越过户型边界。
- 地毯等软装可设置为可叠放，不参与碰撞。
- 定制柜等固定项可锁定，避免误拖动。
- 本地 Node 运行时支持服务端 JSON 保存；静态预览时自动退回浏览器保存。

- Top-down living and dining layout canvas with foyer, balcony direction, and major door openings.
- Drag, rotate, duplicate, delete, and fine-tune furniture dimensions.
- Collision checks use furniture dimensions plus configurable clearance.
- Soft items such as rugs can be marked as stackable and ignored by collision checks.
- Fixed custom cabinetry can be locked to avoid accidental edits.
- Server-side JSON persistence when running with Node; browser persistence fallback for static previews.

## 技术栈 / Tech Stack

- React + TypeScript
- Vite
- SVG 俯瞰画布 / SVG top-down canvas
- Node.js 内置 HTTP 服务 / Node.js built-in HTTP server
- GitHub Pages 静态预览 / GitHub Pages static preview

## 本地运行 / Local Development

```bash
npm install
npm run dev
```

默认访问 / Default URL:

```text
http://localhost:5188/
```

如需换端口 / Use another port:

```bash
PORT=5190 npm run dev
```

## 构建 / Build

```bash
npm run build
npm run preview
```

GitHub Pages 会通过 `.github/workflows/pages.yml` 自动构建静态预览。

GitHub Pages is deployed automatically through `.github/workflows/pages.yml`.

## 状态保存 / Persistence

本地 Node 服务会把当前布局写入：

The local Node server writes the current layout to:

```text
server-data/layout-state.json
```

这个文件属于运行时数据，默认不会提交到 git。删除该文件后，应用会回到源码里的初始布局。静态预览环境无法写入该文件，因此会自动使用浏览器本地保存。

This is runtime data and is ignored by git. Delete it to return to the source-defined initial layout. Static preview environments cannot write this file, so the app automatically uses browser storage instead.

## 目录 / Project Structure

```text
src/
  components/        UI and SVG canvas components
  data.ts            Room, furniture templates, and initial layout data
  geometry.ts        Collision detection, rotated boxes, and room boundary logic
server.mjs           Dev server and layout-state API
public/              Static assets
docs/screenshots/    README screenshots
```

## 许可 / License

MIT
