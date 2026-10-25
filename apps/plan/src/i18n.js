import { useEffect, useState } from 'react'
import { onLang, getLang } from '../../../shared/lift-shell.mjs'

const STR = {
  en: {
    yearOnJan: true, timeline: 'Timeline', nnl: 'Now / Next / Later', views: 'View',
    roadmaps: 'Roadmaps', roadmapName: 'Roadmap name', newRoadmap: 'New roadmap', untitled: 'Untitled roadmap', duplicate: 'Duplicate', copyOf: n => `${n} (copy)`,
    deleteRoadmap: 'Delete roadmap', confirmDeleteRoadmap: n => `Delete “${n}”? This can’t be undone.`, sample: 'Add sample roadmap',
    exportJson: 'Export JSON', importJson: 'Import JSON', print: 'Print / save as PDF', more: 'More', importFail: 'That file isn’t a PlanLift roadmap.',
    share: 'Share', shareTitle: 'Share a read-only link', shareBody: 'Anyone with this link sees this roadmap as it is now. The roadmap lives inside the link itself, nothing is uploaded. Share again after changes.',
    copy: 'Copy link', copied: 'Copied', openLink: 'Open', close: 'Close', longLink: n => `${n.toLocaleString()} characters`,
    todayBtn: 'Today', zoomIn: 'Wider months', zoomOut: 'Narrower months', today: 'Today',
    lanes: 'Lanes', lane: 'Lane', addLane: 'Add lane', newLane: 'New lane', laneName: 'Lane name', laneColour: 'Lane colour', moveUp: 'Move up', moveDown: 'Move down',
    deleteLane: 'Delete lane', confirmDeleteLane: (n, k) => k ? `Delete lane “${n}” and its ${k} item${k === 1 ? '' : 's'}?` : `Delete lane “${n}”?`,
    addHint: 'Click an empty spot in a lane to add an item. Drag to move, drag the ends to resize.',
    newItem: 'New item', item: 'Item', title: 'Title', start: 'Start', end: 'End', status: 'Status', note: 'Note', link: 'Link', linkPh: 'https://…', openLinkShort: 'Open link',
    deleteItem: 'Delete item', confirmDeleteItem: n => `Delete “${n || 'this item'}”?`, untitledItem: 'Untitled',
    st: { idea: 'Idea', planned: 'Planned', progress: 'In progress', done: 'Done' },
    now: 'Now', next: 'Next', later: 'Later', doneCol: 'Done', showDone: 'Show done',
    nowHint: 'Happening now or in progress', nextHint: 'Starting in the next 3 months', laterHint: 'Further out', doneHint: 'Finished',
    empty: 'Nothing here yet',
    dragHint: 'Drag to another column or reorder', moveTo: 'Move to', moveToLabel: n => `Move “${n}”`,
    movedTo: c => `Moved to ${c}`, startSet: d => `start date set to ${d}`, statusSet: s => `status set to ${s}`,
    dayMonth: (y, m, d, withYear) => `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]}${withYear ? ` ${y}` : ''}`,
    readOnly: 'Read-only view', readOnlyBody: 'You’re viewing a shared roadmap.', saveCopy: 'Save a copy to my roadmaps', exitView: 'Back to my roadmaps', badLink: 'This share link is incomplete or damaged.',
    savedCopy: 'Saved to your roadmaps', storageFull: 'Couldn’t save in this browser (storage full or blocked). Export JSON to keep your work.',
    month: (y, m) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1],
    quarter: (y, q) => `Q${q} ${y}`,
    range: (a, b) => a === b ? a : `${a} – ${b}`,
    shortDate: (y, m, d) => `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`,
    monthYear: (y, m) => `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`,
  },
  zh: {
    timeline: '时间线', nnl: '现在 / 下一步 / 以后', views: '视图',
    roadmaps: '路线图', roadmapName: '路线图名称', newRoadmap: '新建路线图', untitled: '未命名路线图', duplicate: '复制一份', copyOf: n => `${n}（副本）`,
    deleteRoadmap: '删除路线图', confirmDeleteRoadmap: n => `删除「${n}」？删除后无法恢复。`, sample: '添加示例路线图',
    exportJson: '导出 JSON', importJson: '导入 JSON', print: '打印 / 存为 PDF', more: '更多', importFail: '这个文件不是 PlanLift 路线图。',
    share: '分享', shareTitle: '分享只读链接', shareBody: '拿到链接的人会看到这份路线图当前的样子。路线图内容就保存在链接里，不会上传到任何服务器。修改后请重新分享。',
    copy: '复制链接', copied: '已复制', openLink: '打开', close: '关闭', longLink: n => `${n.toLocaleString()} 个字符`,
    todayBtn: '今天', zoomIn: '月份加宽', zoomOut: '月份变窄', today: '今天',
    lanes: '泳道', lane: '泳道', addLane: '添加泳道', newLane: '新泳道', laneName: '泳道名称', laneColour: '泳道颜色', moveUp: '上移', moveDown: '下移',
    deleteLane: '删除泳道', confirmDeleteLane: (n, k) => k ? `删除泳道「${n}」及其中 ${k} 个事项？` : `删除泳道「${n}」？`,
    addHint: '点击泳道空白处添加事项。拖动条块改时间，拖动两端改长度。',
    newItem: '新事项', item: '事项', title: '标题', start: '开始', end: '结束', status: '状态', note: '备注', link: '链接', linkPh: 'https://…', openLinkShort: '打开链接',
    deleteItem: '删除事项', confirmDeleteItem: n => `删除「${n || '该事项'}」？`, untitledItem: '未命名',
    st: { idea: '想法', planned: '已计划', progress: '进行中', done: '已完成' },
    now: '现在', next: '下一步', later: '以后', doneCol: '已完成', showDone: '显示已完成',
    nowHint: '正在进行或当下要做', nextHint: '未来 3 个月内开始', laterHint: '更远的计划', doneHint: '已经完成',
    empty: '暂时没有',
    dragHint: '拖到其他列或调整顺序', moveTo: '移动到', moveToLabel: n => `移动「${n}」`,
    movedTo: c => `已移到「${c}」`, startSet: d => `开始日期改为 ${d}`, statusSet: s => `状态改为「${s}」`,
    dayMonth: (y, m, d, withYear) => `${withYear ? `${y}年` : ''}${m}月${d}日`,
    readOnly: '只读视图', readOnlyBody: '你正在查看一份分享的路线图。', saveCopy: '保存副本到我的路线图', exitView: '回到我的路线图', badLink: '这个分享链接不完整或已损坏。',
    savedCopy: '已保存到你的路线图', storageFull: '无法保存在本浏览器（存储已满或被禁用）。请导出 JSON 保留内容。',
    month: (y, m) => `${m}月`,
    quarter: (y, q) => `${y} 年 Q${q}`,
    range: (a, b) => a === b ? a : `${a} – ${b}`,
    shortDate: (y, m, d) => `${y}年${m}月${d}日`,
    monthYear: (y, m) => `${y}年${m}月`,
  },
}

export function useLang() {
  const [lang, setLang] = useState(getLang)
  useEffect(() => onLang(l => { setLang(l); document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en' }), [])
  return [lang, STR[lang]]
}
export { getLang }
