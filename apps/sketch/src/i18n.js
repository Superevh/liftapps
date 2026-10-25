import { useEffect, useState } from 'react'
import { onLang, getLang } from '../../../shared/lift-shell.mjs'

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
export const MOD = isMac ? 'Cmd' : 'Ctrl'

const STR = {
  en: {
    tools: { hand: 'Hand (pan)', selection: 'Select', rectangle: 'Rectangle', diamond: 'Diamond', ellipse: 'Ellipse', arrow: 'Arrow', line: 'Line', freedraw: 'Draw', text: 'Text', eraser: 'Eraser' },
    keepTool: 'Keep selected tool active after drawing', or: 'or',
    close: 'Close', menu: 'Main menu', open: 'Open file…', save: 'Save to file…', exportImg: 'Export image…', help: 'Shortcuts & help', reset: 'Clear the canvas',
    canvasBg: 'Canvas background', customColor: 'Custom colour',
    stroke: 'Stroke', background: 'Background', fill: 'Fill', hachure: 'Hachure', cross: 'Cross-hatch', solid: 'Solid',
    strokeWidth: 'Stroke width', thin: 'Thin', bold: 'Bold', xbold: 'Extra bold',
    strokeStyle: 'Stroke style', dashed: 'Dashed', dotted: 'Dotted',
    sloppiness: 'Sloppiness', neat: 'Neat', sketchy: 'Sketchy', loose: 'Loose',
    edges: 'Edges', sharp: 'Sharp', round: 'Round',
    fontSize: 'Font size', fs: { S: 'Small', M: 'Medium', L: 'Large', XL: 'Very large' },
    opacity: 'Opacity', layers: 'Layers', actions: 'Actions',
    toBack: 'Send to back', backward: 'Send backward', forward: 'Bring forward', toFront: 'Bring to front', duplicate: 'Duplicate', del: 'Delete',
    props: 'Selected shape style', canvas: 'Drawing canvas', canvasActions: 'Canvas actions',
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', resetZoom: 'Reset zoom', undo: 'Undo', redo: 'Redo',
    welcomeLine: 'A hand-drawn whiteboard for quick team sketches.',
    welcomeNote: 'Drawings are saved in this browser. Save to a file to keep a copy.',
    hintMenu: 'Open, save, export', hintTools: 'Pick a tool and start drawing', hintHelp: 'Shortcuts',
    loadSample: 'Load a sample sketch',
    resetTitle: 'Clear the canvas', resetBody: `This removes everything on the canvas. You can undo with ${MOD}+Z.`, cancel: 'Cancel', confirm: 'Clear',
    error: 'Something went wrong', openFail: 'Couldn’t open that file: ',
    exportTitle: 'Export image', nothing: 'Nothing to export', withBg: 'Background', scale: 'Scale', onlySel: 'Selected shapes only',
    shortcuts: 'Keyboard shortcuts', gTools: 'Tools', gView: 'View', gEditor: 'Editing',
    sc: {
      keep: 'Keep tool active', zin: 'Zoom in', zout: 'Zoom out', zreset: 'Reset zoom', fit: 'Zoom to fit everything', fitSel: 'Zoom to selection',
      pan: 'Move the canvas', wheelZoom: 'Zoom with wheel', del: 'Delete', cut: 'Cut', copy: 'Copy', paste: 'Paste', all: 'Select all', add: 'Add to selection',
      dup: 'Duplicate', dragDup: 'Duplicate by dragging', edit: 'Edit text / add label', undo: 'Undo', redo: 'Redo', fwd: 'Bring forward / send backward',
      front: 'Bring to front / send to back', nudge: 'Nudge (Shift = 5px)', constrain: 'Keep proportions / snap angle', save: 'Save', open: 'Open', exp: 'Export image',
      spaceDrag: 'Space drag or Wheel', shiftClick: 'Shift click', altDrag: 'Alt drag', enter: 'Enter or double-click', arrows: 'Arrows', shiftDrag: 'Shift drag',
    },
    sample: { title: 'Sketch a flow', idea: 'Idea', decide: 'Try it?', ship: 'Ship it', draft: 'Draft', neat: 'Neat', note: 'Double-click a shape\nto edit its label' },
  },
  zh: {
    tools: { hand: '抓手（平移）', selection: '选择', rectangle: '矩形', diamond: '菱形', ellipse: '椭圆', arrow: '箭头', line: '直线', freedraw: '画笔', text: '文字', eraser: '橡皮擦' },
    keepTool: '画完后保持当前工具', or: '或',
    close: '关闭', menu: '主菜单', open: '打开文件…', save: '保存到文件…', exportImg: '导出图片…', help: '快捷键与帮助', reset: '清空画布',
    canvasBg: '画布背景', customColor: '自定义颜色',
    stroke: '描边', background: '背景', fill: '填充', hachure: '斜线', cross: '交叉线', solid: '实心',
    strokeWidth: '线宽', thin: '细', bold: '粗', xbold: '特粗',
    strokeStyle: '线条样式', dashed: '虚线', dotted: '点线',
    sloppiness: '手绘感', neat: '工整', sketchy: '手绘', loose: '潦草',
    edges: '边角', sharp: '直角', round: '圆角',
    fontSize: '字号', fs: { S: '小', M: '中', L: '大', XL: '特大' },
    opacity: '透明度', layers: '图层', actions: '操作',
    toBack: '置于底层', backward: '下移一层', forward: '上移一层', toFront: '置于顶层', duplicate: '复制', del: '删除',
    props: '所选图形样式', canvas: '绘图画布', canvasActions: '画布操作',
    zoomIn: '放大', zoomOut: '缩小', resetZoom: '重置缩放', undo: '撤销', redo: '重做',
    welcomeLine: '一块手绘风白板，随手画出团队的想法。',
    welcomeNote: '内容自动保存在本浏览器。想留底请保存到文件。',
    hintMenu: '打开、保存、导出', hintTools: '选个工具，开始画', hintHelp: '快捷键',
    loadSample: '加载示例草图',
    resetTitle: '清空画布', resetBody: `将移除画布上的所有内容，可用 ${MOD}+Z 撤销。`, cancel: '取消', confirm: '清空',
    error: '出错了', openFail: '无法打开该文件：',
    exportTitle: '导出图片', nothing: '没有可导出的内容', withBg: '背景', scale: '倍率', onlySel: '仅导出所选图形',
    shortcuts: '键盘快捷键', gTools: '工具', gView: '视图', gEditor: '编辑',
    sc: {
      keep: '保持工具', zin: '放大', zout: '缩小', zreset: '重置缩放', fit: '缩放到全部内容', fitSel: '缩放到所选',
      pan: '移动画布', wheelZoom: '滚轮缩放', del: '删除', cut: '剪切', copy: '复制', paste: '粘贴', all: '全选', add: '加入选择',
      dup: '复制一份', dragDup: '拖动复制', edit: '编辑文字 / 添加标签', undo: '撤销', redo: '重做', fwd: '上移 / 下移一层',
      front: '置于顶层 / 底层', nudge: '微调（Shift = 5px）', constrain: '保持比例 / 吸附角度', save: '保存', open: '打开', exp: '导出图片',
      spaceDrag: 'Space 拖动 或 滚轮', shiftClick: 'Shift 点击', altDrag: 'Alt 拖动', enter: 'Enter 或 双击', arrows: '方向键', shiftDrag: 'Shift 拖动',
    },
    sample: { title: '画一个流程', idea: '想法', decide: '试试？', ship: '上线', draft: '草稿', neat: '工整', note: '双击图形\n即可编辑标签' },
  },
}

export function useLang() {
  const [lang, setLang] = useState(getLang)
  useEffect(() => onLang(l => { setLang(l); document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en' }), [])
  return [lang, STR[lang]]
}
export const tFor = lang => STR[lang]
export { getLang }
