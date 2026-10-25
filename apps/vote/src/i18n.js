import { useLang } from './lang.js'

// Interface strings, English and Chinese. Each screen keeps its own dictionary next to it and calls
// useT(DICT); shared strings live here in BASE and are available everywhere.
// Placeholders: t('hello', { name }) replaces {name}.
export const BASE = {
  en: {
    appName: 'VoteLift', tagline: 'Live polls, quizzes and Q&A that bring every voice into the room.',
    signIn: 'Sign in', signOut: 'Sign out', signInTitle: 'Sign in to VoteLift', signInHint: 'Sign in to create presentations and keep them on every device. Joining a presentation never needs an account.',
    withGoogle: 'Continue with Google', withGithub: 'Continue with GitHub', orEmail: 'or use your email', emailPh: 'you@company.com', sendLink: 'Email me a sign-in link',
    tabLink: 'Email link', tabPassword: 'Password', passwordPh: 'Password (at least 6 characters)', createAccount: 'Create account', forgotPassword: 'Forgot password?',
    linkSent: 'Check your inbox: we sent a sign-in link to {email}. Open it in this browser.', confirmSent: 'Almost done: we sent a confirmation link to {email}. Open it in this browser to finish creating your account.',
    resetSent: 'We sent a password reset link to {email}. Open it in this browser.', enterEmailFirst: 'Enter your email first.', signInFailed: 'Sign-in failed: {e}',
    newPasswordTitle: 'Set a new password', newPasswordHint: 'Choose a new password for your account.', savePassword: 'Save new password', passwordSaved: 'Your new password is saved.',
    localMode: 'Local demo mode: any email signs you in, no password needed.',
    save: 'Save', cancel: 'Cancel', close: 'Close', delete: 'Delete', add: 'Add', continue: 'Continue', back: 'Back', loading: 'Loading…', retry: 'Retry',
    darkTheme: 'Switch to dark theme', lightTheme: 'Switch to light theme', language: 'Language',
    myPresentations: 'My presentations', joinCode: 'Join with a code', error: 'Something went wrong: {e}', notFound: 'Not found', backHome: 'Back to my presentations',
  },
  zh: {
    appName: 'VoteLift', tagline: '实时投票、抢答和问答，让现场每个人都能发声。',
    signIn: '登录', signOut: '退出登录', signInTitle: '登录 VoteLift', signInHint: '登录后即可创建演示，并在任何设备上访问。参与演示无需账号。',
    withGoogle: '使用 Google 继续', withGithub: '使用 GitHub 继续', orEmail: '或使用邮箱', emailPh: 'you@company.com', sendLink: '给我发送登录链接',
    tabLink: '邮件链接', tabPassword: '密码', passwordPh: '密码（至少 6 位）', createAccount: '创建账号', forgotPassword: '忘记密码？',
    linkSent: '请查收邮件：登录链接已发送到 {email}，请在此浏览器中打开。', confirmSent: '就差一步：确认链接已发送到 {email}，请在此浏览器中打开以完成注册。',
    resetSent: '重置密码链接已发送到 {email}，请在此浏览器中打开。', enterEmailFirst: '请先输入邮箱。', signInFailed: '登录失败：{e}',
    newPasswordTitle: '设置新密码', newPasswordHint: '为你的账号设置一个新密码。', savePassword: '保存新密码', passwordSaved: '新密码已保存。',
    localMode: '本地演示模式：输入任意邮箱即可登录，无需密码。',
    save: '保存', cancel: '取消', close: '关闭', delete: '删除', add: '添加', continue: '继续', back: '返回', loading: '加载中…', retry: '重试',
    darkTheme: '切换到深色主题', lightTheme: '切换到浅色主题', language: '语言',
    myPresentations: '我的演示', joinCode: '输入代码参与', error: '出错了：{e}', notFound: '未找到', backHome: '返回我的演示',
  },
}

export function translate(dict, lang, key, vars) {
  let s = dict?.[lang]?.[key] ?? BASE[lang]?.[key] ?? dict?.en?.[key] ?? BASE.en[key] ?? key
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}

export function useT(dict) {
  const lang = useLang()
  const t = (key, vars) => translate(dict, lang, key, vars)
  t.lang = lang
  return t
}
