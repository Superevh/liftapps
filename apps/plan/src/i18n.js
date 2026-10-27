import { useEffect, useState } from 'react'
import { onLang, getLang } from '../../../shared/lift-shell.mjs'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

const STR = {
  en: {
    yearOnJan: true,
    // views
    timeline: 'Timeline', board: 'Now / Next / Later', boardShort: 'Board', list: 'List', changes: 'Changes', present: 'Present', views: 'Views',
    // workspace & sidebar
    workspace: 'Workspace', workspaceName: 'Workspace name', untitledWs: 'Untitled workspace', overview: 'Overview', roadmaps: 'Roadmaps', newRoadmap: 'New roadmap',
    you: 'You', yourName: 'Your name', namePh: 'e.g. Alex', nameHelp: 'Shown next to your changes so the team knows who moved what. Saved in this browser.',
    setName: 'Add your name', shortcuts: 'Keyboard shortcuts', menu: 'Menu', closeMenu: 'Close menu', hideSidebar: 'Hide sidebar', showSidebar: 'Show sidebar',
    // toolbar
    roadmapName: 'Roadmap name', untitled: 'Untitled roadmap', addItem: 'Add item', add: 'Add', addMilestone: 'Add milestone', addLane: 'Add lane', more: 'More',
    search: 'Search items', filter: 'Filter', filters: 'Filters', clear: 'Clear', clearFilters: 'Clear filters', groupBy: 'Group by',
    gb: { lane: 'Lane', status: 'Status', owner: 'Owner', theme: 'Theme' },
    zoomIn: 'Zoom in', zoomOut: 'Zoom out', months: 'Months', quarters: 'Quarters', todayBtn: 'Today', today: 'Today', showDone: 'Show done',
    itemsCount: n => plural(n, 'item'), shownOf: (a, b) => `${a} of ${b} items`,
    // more menu
    exportCsv: 'Download CSV', copyMd: 'Copy as Markdown', copyText: 'Copy as plain text', print: 'Print / save as PDF', snapshotLink: 'Read-only snapshot link',
    exportJson: 'Export JSON backup', importJson: 'Import JSON', duplicateRm: 'Duplicate roadmap', deleteRm: 'Delete roadmap', rmDetails: 'Roadmap details',
    exportGroup: 'Share & export', manageGroup: 'Roadmap',
    // statuses etc.
    st: { idea: 'Idea', planned: 'Planned', progress: 'In progress', risk: 'At risk', done: 'Done' },
    hz: { now: 'Now', next: 'Next', later: 'Later' },
    pr: { high: 'High', medium: 'Medium', low: 'Low' },
    // item fields
    item: 'Item', title: 'Title', status: 'Status', lane: 'Lane', owner: 'Owner', start: 'Start', end: 'End', dates: 'Dates', schedule: 'Schedule',
    onTimeline: 'On the timeline', noDates: 'No dates yet', horizon: 'Horizon', progress: 'Progress', priority: 'Priority', size: 'Size', themes: 'Themes', theme: 'Theme',
    addTheme: 'Add a theme…', removeTheme: n => `Remove theme ${n}`, description: 'Description', descPh: 'Why this matters, scope, success criteria…',
    dependsOn: 'Waits on', blocks: 'Blocks', addDep: 'Add an item it waits on…', removeDep: 'Remove dependency', depLoop: 'That would create a loop of dependencies.',
    comments: 'Comments', commentPh: 'Add a comment… (⌘Enter to post)', postComment: 'Comment', deleteComment: 'Delete comment', noComments: 'No comments yet.', commentAs: n => `Commenting as ${n}`, commentNoName: 'Add your name so people know who commented',
    links: 'Links', addLink: 'Paste a link (spec, ticket, design)…', removeLink: 'Remove link', history: 'History', duplicate: 'Duplicate', deleteItem: 'Delete item',
    newItem: 'New item', untitledItem: 'Untitled', none: 'None', unassigned: 'Unassigned', noTheme: 'No theme', ownerPh: 'Who’s accountable',
    // milestones
    milestone: 'Milestone', milestones: 'Milestones', release: 'Release', untitledMilestone: 'Untitled milestone', newMilestone: 'New milestone', date: 'Date', note: 'Note',
    allLanes: 'Whole roadmap', deleteMilestone: 'Delete milestone', kind: 'Type', msHint: 'Click the strip to add a milestone',
    // dependencies
    depConflict: (n, d) => `Starts before “${n}” finishes (${d}).`, lateBadge: 'Dependency conflict', conflictsCount: n => plural(n, 'dependency conflict'),
    // toasts
    deletedItem: n => `Deleted “${n}”`, deletedMs: n => `Deleted milestone “${n}”`, deletedLane: n => `Deleted lane “${n}”`, deletedRm: n => `Deleted “${n}”`,
    undo: 'Undo', undone: 'Undone', nothingToUndo: 'Nothing to undo', copied: 'Copied', copiedMd: 'Copied to the clipboard', csvDone: 'CSV downloaded',
    movedTo: c => `Moved to ${c}`, startSet: d => `start date ${d}`, statusSet: s => `status ${s}`, duplicated: 'Duplicated', createdRm: n => `Created “${n}”`,
    importFail: 'That file isn’t a PlanLift roadmap.', importDone: n => `Imported “${n}”`,
    storageFull: 'Couldn’t save in this browser (storage full or blocked). Export a JSON backup to keep your work.',
    // confirm
    confirmDeleteRm: (n, k) => `Delete “${n}” and its ${plural(k, 'item')}? You can undo for a few seconds.`, confirmDeleteLane: (n, k) => `Delete lane “${n}” and its ${plural(k, 'item')}?`,
    cancel: 'Cancel', delete: 'Delete', close: 'Close', save: 'Save', create: 'Create roadmap',
    // home
    overviewTitle: 'Overview', overviewSub: n => `${plural(n, 'roadmap')} in this workspace`, startFromTemplate: 'Start a new roadmap', withExamples: 'Include example items', replaceExample: 'Replace the example roadmaps',
    tpl: {
      product: ['Product roadmap', 'Themes and bets by area, across the next few quarters.'],
      okr: ['Quarterly plan', 'Objectives as lanes, the initiatives that move them inside.'],
      release: ['Release plan', 'Workstreams, code freeze and release dates for one launch.'],
      pi: ['Quarter planning across teams', 'One lane per team, features by iteration, cross-team dependencies.'],
      blank: ['Blank roadmap', 'Product, Design and Engineering lanes, no items. Rename them to fit.'],
    },
    statItems: n => plural(n, 'item'), statProgress: n => `${n} in progress`, statRisk: n => `${n} at risk`, statDone: p => `${p}% done`, nextMs: 'Next milestone', noMs: 'No upcoming milestones',
    recentChanges: 'Recent changes', noChanges: 'No changes yet. Moves, status changes and new items will show up here.', openRm: 'Open',
    noRoadmaps: 'No roadmaps yet', noRoadmapsBody: 'Start from a template below. Each one comes with lanes, a few example items and milestones you can edit.',
    // welcome
    welcomeTitle: 'This is an example workspace', welcomeBody: 'Drag bars to reschedule, open an item to edit it, or press Present to see what stakeholders see. When you’re ready, start your own roadmap from a template.',
    welcomeCta: 'Start from a template', dismiss: 'Dismiss',
    // changes
    changesTitle: 'What changed', changesSub: 'Moves, status changes, new and deleted items, with who and when.', period: { 7: 'Last 7 days', 30: 'Last 30 days', all: 'All time' },
    thisRoadmap: 'This roadmap', allRoadmaps: 'All roadmaps', copyUpdate: 'Copy as update', nameAsk: 'Add your name so teammates can see who made each change.',
    ch: {
      add: 'added', delete: 'deleted', status: (a, b) => `changed status ${a} → ${b}`, dates: (a, b) => `moved dates ${a} → ${b}`, lane: (a, b) => `moved from ${a} to ${b}`,
      madd: 'added milestone', mdate: (a, b) => `moved milestone ${a} → ${b}`, mdelete: 'deleted milestone', comment: x => `commented: “${x}”`,
    },
    statLater: 'moved later', statEarlier: 'pulled in', statAdded: 'added',
    someone: 'Someone', youLabel: 'you', slip: d => { const w = Math.round(Math.abs(d) / 7); const s = w >= 1 ? `${w} wk` : `${Math.abs(d)} d`; return d > 0 ? `${s} later` : `${s} earlier` },
    updateTitle: (n, p) => `${n}: changes, ${p}`,
    ago: ms => { const m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m} min ago`; const h = Math.round(m / 60); if (h < 24) return `${h} h ago`; const d = Math.round(h / 24); return d === 1 ? 'yesterday' : `${d} days ago` },
    // present
    recentNote: 'Moves and status changes on this roadmap in the last 14 days.',
    exitPresent: 'Exit', presentHint: '← → switch roadmap · Esc to exit', presentHintView: '← → switch roadmap', updatedOn: d => `Updated ${d}`, filteredNote: 'Filtered view', fullscreen: 'Full screen', legend: 'Legend',
    stakeholderLink: 'Copy view-only link', viewLink: 'View-only link (live)', viewOnly: 'View only', viewOnlyLive: 'View only · live',
    viewLinkTitle: 'Live view-only link', viewEmpty: 'This workspace has no roadmaps yet',
    viewLinkBody: 'People with this link see your roadmaps in presentation mode, always up to date, with no way to edit. It opens a separate published copy, so it never reveals your editing link.',
    viewLinkNote: 'Anyone with the view link can read the published copy, so share it with people you trust. “Stop sharing” turns the link off for good; you can make a new one any time.',
    viewLinkCreate: 'Create view-only link', viewLinkStop: 'Stop sharing', viewLinkOffTitle: 'This view link has been turned off', viewLinkOffBody: 'Ask the roadmap owner for a new link.',
    nothingToRedo: 'Nothing to redo', redone: 'Redone',
    // shared snapshot
    readOnly: 'Read-only snapshot', readOnlyBody: 'You’re viewing a roadmap someone shared as it was when they made the link.', saveCopy: 'Save a copy to my workspace', exitView: 'Back to my roadmaps',
    badLink: 'This snapshot link is incomplete or damaged.', savedCopy: 'Saved to your workspace',
    snapshotTitle: 'Read-only snapshot link', snapshotBody: 'Anyone with this link sees this roadmap as it is right now and can’t change it. The roadmap lives inside the link itself. For live editing together, use Share instead.',
    copyLink: 'Copy link', openLink: 'Open', chars: n => `${n.toLocaleString()} characters`,
    // loading / missing
    opening: 'Opening the shared workspace…', missingTitle: 'This link doesn’t open a workspace', missingBody: 'It may have been mistyped or deleted. Your own roadmaps are safe.',
    openMine: 'Your workspaces', startNew: 'Start a new workspace', couldNotCreate: 'Couldn’t create it right now. Check your connection and try again.',
    // empty states
    emptyTimeline: 'This roadmap is empty', emptyTimelineBody: 'Click anywhere in a lane to add an item, or press N.', emptyCol: 'Nothing here yet', noPickMatch: 'No matching items', noMatch: 'No items match these filters',
    // timeline
    lanes: 'Lanes', addHint: 'Click a lane to add. Drag to move, drag the ends to resize, drag the dot on a selected bar onto another to link them. Arrow keys nudge.',
    resizeLanes: 'Drag to resize the lane column (double-click to reset)', expand: 'Expand', collapse: 'Collapse', expandLane: n => `Expand ${n}`, collapseLane: n => `Collapse ${n}`,
    laneActions: n => `Lane actions: ${n}`, linkHint: 'Drag onto another item: it will wait on this one', printedOn: d => `Printed ${d}`, notScheduled: n => `Not on the timeline · ${n}`,
    notScheduledHint: 'Drag onto a lane to schedule', laneName: 'Lane name', laneColour: 'Lane colour', moveUp: 'Move up', moveDown: 'Move down', deleteLane: 'Delete lane', newLane: 'New lane',
    dragHint: 'Drag to another column or reorder', moveTo: 'Move to', moveToLabel: n => `Move “${n}”`,
    // list
    sortBy: n => `Sort by ${n}`, rowOpen: 'Open details',
    // shortcuts
    keys: [['N', 'Add an item'], ['M', 'Add a milestone'], ['1 – 4', 'Timeline, Board, List, Changes'], ['P', 'Present'], ['/', 'Search'], ['F', 'Filters'],
      ['T', 'Jump to today'], ['+ / −', 'Zoom the timeline'], ['← →', 'Nudge the selected bar a week (Shift: resize)'], ['D', 'Duplicate the selected item'],
      ['Delete', 'Delete the selected item'], ['⌘Z / Ctrl+Z', 'Undo'], ['⌘⇧Z / Ctrl+Y', 'Redo'], ['Esc', 'Close panel or menu'], ['?', 'This list']],
    // dates
    month: (y, m) => MON[m - 1], monthShort: (y, m) => MON[m - 1][0], quarter: (y, q) => `Q${q} ${y}`, range: (a, b) => (a === b ? a : `${a} – ${b}`),
    shortDate: (y, m, d) => `${d} ${MON[m - 1]} ${y}`, monthYear: (y, m) => `${MON[m - 1]} ${y}`, dayMonth: (y, m, d, withYear) => `${d} ${MON[m - 1]}${withYear ? ` ${y}` : ''}`,
    csv: { type: 'Type', item: 'Item' },
    doneCol: 'Done', now: 'Now', next: 'Next', later: 'Later', nowHint: 'Under way, or should be', nextHint: 'Starting in the next 3 months', laterHint: 'Further out', doneHint: 'Finished',
    myWorkspace: 'My roadmaps',
  },
  zh: {
    yearOnJan: false,
    timeline: '时间线', board: '现在 / 接下来 / 以后', boardShort: '看板', list: '列表', changes: '变更', present: '演示', views: '视图',
    workspace: '工作区', workspaceName: '工作区名称', untitledWs: '未命名工作区', overview: '概览', roadmaps: '路线图', newRoadmap: '新建路线图',
    you: '你', yourName: '你的名字', namePh: '例如：小王', nameHelp: '显示在你的改动旁边，团队就知道是谁调整的。只保存在这个浏览器里。',
    setName: '填写你的名字', shortcuts: '键盘快捷键', menu: '菜单', closeMenu: '关闭菜单', hideSidebar: '隐藏侧栏', showSidebar: '显示侧栏',
    roadmapName: '路线图名称', untitled: '未命名路线图', addItem: '添加事项', add: '添加', addMilestone: '添加里程碑', addLane: '添加泳道', more: '更多',
    search: '搜索事项', filter: '筛选', filters: '筛选', clear: '清除', clearFilters: '清除筛选', groupBy: '分组',
    gb: { lane: '泳道', status: '状态', owner: '负责人', theme: '主题' },
    zoomIn: '放大', zoomOut: '缩小', months: '月', quarters: '季度', todayBtn: '今天', today: '今天', showDone: '显示已完成',
    itemsCount: n => `${n} 个事项`, shownOf: (a, b) => `显示 ${a} / ${b} 个事项`,
    exportCsv: '下载 CSV', copyMd: '复制为 Markdown', copyText: '复制为纯文本', print: '打印 / 存为 PDF', snapshotLink: '只读快照链接',
    exportJson: '导出 JSON 备份', importJson: '导入 JSON', duplicateRm: '复制路线图', deleteRm: '删除路线图', rmDetails: '路线图详情',
    exportGroup: '分享与导出', manageGroup: '路线图',
    st: { idea: '想法', planned: '已计划', progress: '进行中', risk: '有风险', done: '已完成' },
    hz: { now: '现在', next: '接下来', later: '以后' },
    pr: { high: '高', medium: '中', low: '低' },
    item: '事项', title: '标题', status: '状态', lane: '泳道', owner: '负责人', start: '开始', end: '结束', dates: '日期', schedule: '排期',
    onTimeline: '放在时间线上', noDates: '暂不定日期', horizon: '阶段', progress: '进度', priority: '优先级', size: '规模', themes: '主题', theme: '主题',
    addTheme: '添加主题…', removeTheme: n => `移除主题 ${n}`, description: '描述', descPh: '为什么重要、范围、成功标准…',
    dependsOn: '依赖于', blocks: '阻塞', addDep: '添加它依赖的事项…', removeDep: '移除依赖', depLoop: '这样会形成循环依赖。',
    comments: '评论', commentPh: '写一条评论…（⌘Enter 发送）', postComment: '评论', deleteComment: '删除评论', noComments: '还没有评论。', commentAs: n => `以 ${n} 的身份评论`, commentNoName: '填写名字，大家就知道是谁评论的',
    links: '链接', addLink: '粘贴链接（需求、工单、设计稿）…', removeLink: '移除链接', history: '历史', duplicate: '复制', deleteItem: '删除事项',
    newItem: '新事项', untitledItem: '未命名', none: '无', unassigned: '未分配', noTheme: '无主题', ownerPh: '谁来负责',
    milestone: '里程碑', milestones: '里程碑', release: '发布', untitledMilestone: '未命名里程碑', newMilestone: '新里程碑', date: '日期', note: '备注',
    allLanes: '整个路线图', deleteMilestone: '删除里程碑', kind: '类型', msHint: '点击这一行添加里程碑',
    depConflict: (n, d) => `在「${n}」完成前就开始了（${d}）。`, lateBadge: '依赖冲突', conflictsCount: n => `${n} 个依赖冲突`,
    deletedItem: n => `已删除「${n}」`, deletedMs: n => `已删除里程碑「${n}」`, deletedLane: n => `已删除泳道「${n}」`, deletedRm: n => `已删除「${n}」`,
    undo: '撤销', undone: '已撤销', nothingToUndo: '没有可撤销的操作', copied: '已复制', copiedMd: '已复制到剪贴板', csvDone: 'CSV 已下载',
    movedTo: c => `已移到「${c}」`, startSet: d => `开始日期 ${d}`, statusSet: s => `状态「${s}」`, duplicated: '已复制', createdRm: n => `已创建「${n}」`,
    importFail: '这个文件不是 PlanLift 路线图。', importDone: n => `已导入「${n}」`,
    storageFull: '无法保存在本浏览器（存储已满或被禁用）。请导出 JSON 备份。',
    confirmDeleteRm: (n, k) => `删除「${n}」及其中 ${k} 个事项？几秒内可以撤销。`, confirmDeleteLane: (n, k) => `删除泳道「${n}」及其中 ${k} 个事项？`,
    cancel: '取消', delete: '删除', close: '关闭', save: '保存', create: '创建路线图',
    overviewTitle: '概览', overviewSub: n => `这个工作区有 ${n} 张路线图`, startFromTemplate: '新建路线图', withExamples: '包含示例事项', replaceExample: '替换示例路线图',
    tpl: {
      product: ['产品路线图', '按领域排列主题和投入，覆盖未来几个季度。'],
      okr: ['季度计划', '每个目标一条泳道，里面放推动它的举措。'],
      release: ['发布计划', '一次发布的工作流、代码冻结和发布日期。'],
      pi: ['跨团队季度规划', '每个团队一条泳道，按迭代排特性，标出跨团队依赖。'],
      blank: ['空白路线图', '产品、设计、研发三条空泳道，可随意改名。'],
    },
    statItems: n => `${n} 个事项`, statProgress: n => `${n} 个进行中`, statRisk: n => `${n} 个有风险`, statDone: p => `完成 ${p}%`, nextMs: '下一个里程碑', noMs: '暂无即将到来的里程碑',
    recentChanges: '最近变更', noChanges: '还没有变更。调整日期、状态，新建或删除事项都会记录在这里。', openRm: '打开',
    noRoadmaps: '还没有路线图', noRoadmapsBody: '从下面选一个模板开始。每个模板都带有泳道、几个示例事项和里程碑，可以随意修改。',
    welcomeTitle: '这是一个示例工作区', welcomeBody: '拖动条块调整排期，点开事项编辑，或者点「演示」看看干系人会看到什么。准备好了，就用模板新建你自己的路线图。',
    welcomeCta: '从模板开始', dismiss: '知道了',
    changesTitle: '变更记录', changesSub: '日期调整、状态变化、新增和删除，谁在什么时候改的。', period: { 7: '最近 7 天', 30: '最近 30 天', all: '全部' },
    thisRoadmap: '当前路线图', allRoadmaps: '全部路线图', copyUpdate: '复制为进展更新', nameAsk: '填写你的名字，队友就能看到每处改动是谁做的。',
    ch: {
      add: '新增了', delete: '删除了', status: (a, b) => `把状态从 ${a} 改为 ${b}`, dates: (a, b) => `把日期从 ${a} 调整为 ${b}`, lane: (a, b) => `从「${a}」移到「${b}」`,
      madd: '新增了里程碑', mdate: (a, b) => `把里程碑从 ${a} 调整为 ${b}`, mdelete: '删除了里程碑', comment: x => `评论：「${x}」`,
    },
    statLater: '推迟', statEarlier: '提前', statAdded: '新增',
    someone: '有人', youLabel: '你', slip: d => { const w = Math.round(Math.abs(d) / 7); const s = w >= 1 ? `${w} 周` : `${Math.abs(d)} 天`; return d > 0 ? `推迟 ${s}` : `提前 ${s}` },
    updateTitle: (n, p) => `${n}：变更（${p}）`,
    ago: ms => { const m = Math.round(ms / 60000); if (m < 1) return '刚刚'; if (m < 60) return `${m} 分钟前`; const h = Math.round(m / 60); if (h < 24) return `${h} 小时前`; const d = Math.round(h / 24); return d === 1 ? '昨天' : `${d} 天前` },
    recentNote: '这张路线图最近 14 天的日期调整和状态变化。',
    exitPresent: '退出', presentHint: '← → 切换路线图 · Esc 退出', presentHintView: '← → 切换路线图', updatedOn: d => `更新于 ${d}`, filteredNote: '已筛选', fullscreen: '全屏', legend: '图例',
    stakeholderLink: '复制只读链接', viewLink: '只读链接（实时）', viewOnly: '只读', viewOnlyLive: '只读 · 实时',
    viewLinkTitle: '实时只读链接', viewEmpty: '这个工作区还没有路线图',
    viewLinkBody: '拿到链接的人会以演示模式看到你的路线图，内容始终是最新的，但无法编辑。它打开的是单独发布的副本，不会暴露你的编辑链接。',
    viewLinkNote: '任何拿到只读链接的人都能查看发布的副本，请只分享给信任的人。「停止分享」会让这个链接永久失效，之后可以随时生成新链接。',
    viewLinkCreate: '生成只读链接', viewLinkStop: '停止分享', viewLinkOffTitle: '这个只读链接已停用', viewLinkOffBody: '请向路线图负责人索取新链接。',
    nothingToRedo: '没有可重做的操作', redone: '已重做',
    readOnly: '只读快照', readOnlyBody: '你看到的是分享者生成链接那一刻的路线图。', saveCopy: '保存副本到我的工作区', exitView: '回到我的路线图',
    badLink: '这个快照链接不完整或已损坏。', savedCopy: '已保存到你的工作区',
    snapshotTitle: '只读快照链接', snapshotBody: '拿到链接的人会看到这份路线图此刻的样子，但不能修改。路线图内容就保存在链接里。如果要一起实时编辑，请用「分享」。',
    copyLink: '复制链接', openLink: '打开', chars: n => `${n.toLocaleString()} 个字符`,
    opening: '正在打开分享的工作区…', missingTitle: '这个链接打不开工作区', missingBody: '链接可能输错了，或者工作区已被删除。你自己的路线图不受影响。',
    openMine: '你的工作区', startNew: '新建工作区', couldNotCreate: '暂时无法创建，请检查网络后再试。',
    emptyTimeline: '这张路线图还是空的', emptyTimelineBody: '点击泳道任意位置添加事项，或按 N。', emptyCol: '暂时没有', noPickMatch: '没有匹配的事项', noMatch: '没有符合筛选条件的事项',
    lanes: '泳道', addHint: '点击泳道添加。拖动条块改时间，拖两端改长度；把选中条块末端的圆点拖到另一个事项上即可建立依赖。方向键可微调。',
    resizeLanes: '拖动调整泳道列宽（双击恢复）', expand: '展开', collapse: '收起', expandLane: n => `展开「${n}」`, collapseLane: n => `收起「${n}」`,
    laneActions: n => `泳道操作：${n}`, linkHint: '拖到另一个事项上：它将依赖于这个事项', printedOn: d => `打印于 ${d}`, notScheduled: n => `未排期 · ${n}`,
    notScheduledHint: '拖到泳道上即可排期', laneName: '泳道名称', laneColour: '泳道颜色', moveUp: '上移', moveDown: '下移', deleteLane: '删除泳道', newLane: '新泳道',
    dragHint: '拖到其他列或调整顺序', moveTo: '移动到', moveToLabel: n => `移动「${n}」`,
    sortBy: n => `按${n}排序`, rowOpen: '打开详情',
    keys: [['N', '添加事项'], ['M', '添加里程碑'], ['1 – 4', '时间线、看板、列表、变更'], ['P', '演示'], ['/', '搜索'], ['F', '筛选'],
      ['T', '回到今天'], ['+ / −', '缩放时间线'], ['← →', '把选中的条块移动一周（Shift：改长度）'], ['D', '复制选中的事项'],
      ['Delete', '删除选中的事项'], ['⌘Z / Ctrl+Z', '撤销'], ['⌘⇧Z / Ctrl+Y', '重做'], ['Esc', '关闭面板或菜单'], ['?', '查看快捷键']],
    month: (y, m) => `${m}月`, monthShort: (y, m) => `${m}`, quarter: (y, q) => `${y} Q${q}`, range: (a, b) => (a === b ? a : `${a} – ${b}`),
    shortDate: (y, m, d) => `${y}年${m}月${d}日`, monthYear: (y, m) => `${y}年${m}月`, dayMonth: (y, m, d, withYear) => `${withYear ? `${y}年` : ''}${m}月${d}日`,
    csv: { type: '类型', item: '事项' },
    doneCol: '已完成', now: '现在', next: '接下来', later: '以后', nowHint: '正在进行，或应该已经开始', nextHint: '未来 3 个月内开始', laterHint: '更远的计划', doneHint: '已经完成',
    myWorkspace: '我的路线图',
  },
}

export function useLang() {
  const [lang, setLang] = useState(getLang)
  useEffect(() => onLang(l => { setLang(l); document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en' }), [])
  return [lang, STR[lang] || STR.en]
}
export { getLang, STR }
