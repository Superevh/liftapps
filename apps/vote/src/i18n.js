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
    notAvailable: 'Not available yet', providerOff: 'Some sign-in options aren’t switched on yet. Use another option below.',
    linkHint: 'Open the link on this device, in this browser.', confirmHint: 'New accounts get a confirmation email first.',
    resendConfirm: 'Resend confirmation email', confirmResent: 'We sent a new confirmation link to {email}.',
    strandedNote: 'Your last {p} sign-in didn’t come back to VoteLift. If you ended up on another site, sign in here with your email and password instead.',
    errCredentials: 'Wrong email or password. If you normally use Google or GitHub, use that button; or choose “Forgot password?” to set a password.',
    errNotConfirmed: 'This email isn’t confirmed yet. Open the confirmation link we emailed you, or resend it below.',
    errExists: 'There’s already an account with this email. Sign in with your password, Google or GitHub, or choose “Forgot password?”.',
    errRateLimit: 'Too many sign-in emails were sent recently. Wait a little and try again, or use a password, Google or GitHub.',
    errEmailNotAuthorized: 'Sign-in emails can’t be sent to this address yet. Use Google, GitHub or an existing password.',
    errEmailSend: 'The email couldn’t be sent right now. Use Google, GitHub or an existing password, or try again later.',
    errSignupDisabled: 'New accounts are switched off right now.',
    errEmailDisabled: 'Email sign-in is switched off right now. Use Google or GitHub.',
    errProviderDisabled: 'This sign-in option isn’t switched on yet. Use another option.',
    errEmailInvalid: 'That email address doesn’t look right.',
    errLinkExpired: 'That sign-in link has expired or was already used. Ask for a new one.',
    errOtherBrowser: 'Sign-in couldn’t finish here: the link was opened in a different browser, or it expired. Start again from this browser.',
    errCancelled: 'Sign-in was cancelled.',
    errNetwork: 'Can’t reach the sign-in server. Check your connection and try again.',
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
    notAvailable: '暂未开通', providerOff: '部分登录方式尚未开通，请使用下面的其他方式。',
    linkHint: '请在本设备、本浏览器中打开邮件里的链接。', confirmHint: '新账号需要先通过邮件确认。',
    resendConfirm: '重新发送确认邮件', confirmResent: '新的确认链接已发送到 {email}。',
    strandedNote: '上次使用 {p} 登录没有回到 VoteLift。如果你被带到了别的网站，请在这里改用邮箱和密码登录。',
    errCredentials: '邮箱或密码不对。如果你平时用 Google 或 GitHub 登录，请点对应按钮；也可以点「忘记密码？」设置密码。',
    errNotConfirmed: '这个邮箱还没有确认。请打开我们发给你的确认链接，或在下方重新发送。',
    errExists: '这个邮箱已经有账号了。请用密码、Google 或 GitHub 登录，或点「忘记密码？」。',
    errRateLimit: '最近发送的登录邮件太多了。请稍后再试，或改用密码、Google、GitHub 登录。',
    errEmailNotAuthorized: '暂时无法向这个邮箱发送登录邮件。请用 Google、GitHub 或已有密码登录。',
    errEmailSend: '邮件暂时发不出去。请用 Google、GitHub 或已有密码登录，或稍后再试。',
    errSignupDisabled: '目前暂停注册新账号。',
    errEmailDisabled: '目前未开通邮箱登录，请使用 Google 或 GitHub。',
    errProviderDisabled: '这个登录方式尚未开通，请换一种方式。',
    errEmailInvalid: '邮箱地址格式不对。',
    errLinkExpired: '这个登录链接已过期或已被使用，请重新获取。',
    errOtherBrowser: '登录未能完成：链接是在另一个浏览器中打开的，或已经过期。请在本浏览器中重新开始。',
    errCancelled: '已取消登录。',
    errNetwork: '无法连接登录服务器，请检查网络后重试。',
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
