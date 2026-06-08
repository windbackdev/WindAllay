import { getConfig, setConfig } from './config.js';

export type Lang = 'en' | 'zh';

type TranslationValue = string | ((...args: any[]) => string);

type TranslationTree = {
  [key: string]: TranslationTree | TranslationValue;
};

const ZH: TranslationTree = {
  app: {
    title: 'WindAllay AI 助手',
    tagline: '由 AI 驱动的智能命令行助手',
    langSwitch: '切换语言',
    langName: '中文',
  },
  menu: {
    startChat: '开始对话',
    configureProvider: '配置提供商',
    createProject: '创建项目',
    manageSkills: '管理技能',
    settings: '设置',
    exit: '退出',
    startChatDesc: '进入 AI 交互式对话',
    configureProviderDesc: '设置 API 提供商和模型',
    createProjectDesc: '搭建新项目',
    manageSkillsDesc: '查看和选择技能配置',
    settingsDesc: '调整应用设置',
    exitDesc: '退出 WindAllay',
  },
  provider: {
    title: '提供商配置',
    apiBase: 'API 地址',
    apiKey: 'API 密钥',
    model: '模型',
    maxTokens: '最大 Token 数',
    temperature: '温度',
    testConnection: '测试连接',
    testing: '测试中...',
    connected: '连接成功！可用模型数:',
    failed: '连接失败：',
    back: '← 返回主菜单',
    updated: '已更新',
    editHint: '输入修改 • Enter 确认 • ESC 取消',
    navHint: '↑↓ 导航 • Enter 编辑 • ESC/q 返回',
    placeholder: '输入值...',
    fetching: '获取模型列表中...',
    fromEnv: '(来自环境变量)',
    deleteConfirm: (name: string) => `删除 "${name}"?`,
    confirmDelete: 'Enter 确认 • ESC 取消',
    modelSelect: '↑↓·Enter 选择·ESC 返回',
  },
  providerManager: {
    title: '提供商管理器',
    addProvider: '添加提供商',
    deleteProvider: '删除',
    setDefault: '设为默认',
    noProviders: '暂无其他提供商',
    defaultLabel: '默认',
    name: '名称',
    namePlaceholder: '例如: Azure, DeepSeek...',
  },
  project: {
    title: '创建项目',
    stepName: '步骤 1: 项目名称',
    namePrompt: '名称：',
    nameHint: '输入项目名称后按 Enter 确认',
    namePlaceholder: '(输入项目名称)',
    stepType: '步骤 2: 项目类型',
    typeHint: '↑↓ 选择 • Enter 确认 • ESC 返回上一步',
    stepConfirm: '步骤 3: 确认',
    confirmText: (name: string, type: string, path: string) =>
      `确认创建 "${name}" (${type}) 在 ${path}？`,
    confirmHint: 'Enter 确认 • ESC/n 取消',
    created: (name: string, path: string) =>
      `项目 "${name}" 已创建于 ${path}`,
    exists: (name: string) => `目录 "${name}" 已存在`,
    failed: '创建失败：',
    enterToNavigate: '按 Enter 进入项目目录并开始对话',
    continue: '按 Enter 继续',
    stepLanguage: '步骤 2: 编程语言',
    languageHint: '↑↓ 选择 • Enter 确认 • ESC 返回',
    stepProvider: '步骤 3: 模型提供商',
    providerHint: '↑↓ 选择 • Enter 确认 • ESC 返回',
    stepModel: '步骤 4: 模型',
    modelHint: '↑↓ 选择 • Enter 确认 • ESC 返回',
    noModels: '没有可用模型',
    stepIndicator: (current: string, total: string) => `步骤 ${current}/${total}`,
    nodeTs: 'Node.js + TypeScript',
    nodeTsDesc: '使用 TypeScript 的现代 Node 项目',
    nodeJs: 'Node.js + JavaScript',
    nodeJsDesc: '简单的 Node.js 项目',
    empty: '空目录',
    emptyDesc: '仅创建文件夹',
  },
  form: {
    title: '表单',
  },
  todo: {
    title: '任务',
  },
  file: {
    preview: '文件预览',
    lines: (n: number) => `${n} 行`,
    truncated: (n: number) => `... 还有 ${n} 行`,
    error: '错误',
  },
  input: {
    placeholder: '输入消息或 /help...',
    thinking: '⏳ AI 思考中...',
  },
  paginated: {
    empty: '(空)',
    page: (n: number, total: number) => `第 ${n}/${total} 页`,
  },
  setup: {
    title: (name: string) => `项目设置: ${name}`,
    you: '你：',
    ai: 'AI：',
    tool: '⚙',
    fields: '字段',
    prompt: '❯',
    enterHint: 'Enter 发送，Ctrl+N = 标记完成',
    thinking: '思考中...',
    done: '项目已创建！按 Enter 继续',
    detected: '检测到项目设置文件',
    executePrompt: '是否按照设置初始化项目？(y/n)',
  },
  settings: {
    title: '设置',
    page: (n: number, total: number) => `设置 ${n}/${total}`,
    memory: '记忆',
    memoryDesc: '启用对话记忆持久化',
    temperature: '温度',
    temperatureDesc: 'AI 回复创造力 (0.0 - 2.0)',
    maxTokens: '最大 Token',
    maxTokensDesc: '每次回复的最大 Token 数',
    contextLimit: '上下文限制',
    contextLimitDesc: '最大上下文窗口大小',
    compactionThreshold: '压缩阈值',
    compactionThresholdDesc: '触发自动压缩的上下文占比 (0=关闭)',
    back: '← 返回主菜单',
    currentConfig: '当前配置：',
    context: (n: number) => `上下文：${n}k tokens`,
    memoryStatus: (on: boolean) => `记忆：${on ? '已启用' : '已禁用'}`,
    tempAndTokens: (t: number, m: number) => `温度：${t} | 最大 Token：${m}`,
    on: '开',
    off: '关',
    navHint: '↑↓ 导航 • Enter 切换 • ESC/q 返回',
  },
  chat: {
    welcome: '欢迎使用 WindAllay！',
    subtitle: '你的 AI 驱动命令行助手',
    status: '状态',
    ready: '就绪',
    thinking: '思考中...',
    compacting: '压缩上下文...',
    compacted: '上下文已压缩',
    compactResult: (saved: number) => `上下文压缩完成，节省约 ${saved} tokens 空间`,
    streaming: '流式输出',
    toolCall: '使用工具中...',
    error: '错误',
    msgs: '消息',
    ctx: '上下文',
    inputPlaceholder: '输入消息或 /help...',
    noKeyWarning: '⚠ 未设置 API 密钥 — 请先配置提供商',
    langChainReady: 'LangChain 记忆已就绪',
    langChainOff: 'LangChain 未启用',
    mcpServers: (n: number) => `${n} 个 MCP 服务`,
    lspReady: 'LSP 已就绪',
    compactUnnecessary: '上下文已足够精简，无需压缩。',
    hint: '输入消息开始对话，/help 查看命令，/compact 压缩上下文',
  },
  dialog: {
    confirm: '确认',
    cancel: '取消',
    close: '关闭',
    edit: '编辑',
    save: '保存',
  },
  commands: {
    title: '可用命令：',
    help: '帮助',
    clear: '清空对话',
    new: '新建会话',
    session: '浏览历史会话',
    skill: '选择技能',
    model: '切换模型',
    context: '查看上下文用量',
    memory: '查看记忆信息',
    langchain: '查看 LangChain 状态',
    mcp: '列出 MCP 服务器和工具',
    lsp: '对文件运行 LSP 诊断',
    exit: '退出 WindAllay',
    unknown: (cmd: string) => `未知命令: ${cmd}。输入 /help 查看可用命令。`,
  },
  nav: {
    upDown: '↑↓ 导航',
    enter: 'Enter 选择',
    quit: 'q/ESC 退出',
    back: 'ESC/q 返回',
  },
  skills: {
    title: '技能管理',
    none: '无 (默认)',
    close: '↑↓ 导航 • Enter 选择 • q/ESC 关闭',
  },
  models: {
    title: (n: number) => `模型列表 (${n} 个可用)`,
    close: '↑↓ 导航 • Enter 选择 • q/ESC 关闭',
  },
  session: {
    title: '对话历史',
    newSession: '+ 新建对话',
    current: '(当前)',
    confirmDelete: '确认删除此会话？(y/n)',
    created: '已创建新会话。',
    restored: '已恢复会话。',
    deleted: '已删除会话。',
    noSessions: '暂无历史会话',
    messagesCount: (n: number) => `${n} 条消息`,
    timeAgo: {
      justNow: '刚刚',
      minutesAgo: (n: number) => `${n} 分钟前`,
      hoursAgo: (n: number) => `${n} 小时前`,
      daysAgo: (n: number) => `${n} 天前`,
    },
    hint: '↑↓ 导航 · Enter 选择 · d 删除 · ESC/q 关闭',
  },
};

const EN: TranslationTree = {
  app: {
    title: 'WindAllay AI Agent',
    tagline: 'Your intelligent CLI companion powered by AI',
    langSwitch: 'Switch Language',
    langName: 'English',
  },
  menu: {
    startChat: 'Start Chat',
    configureProvider: 'Configure Provider',
    createProject: 'Create Project',
    manageSkills: 'Manage Skills',
    settings: 'Settings',
    exit: 'Exit',
    startChatDesc: 'Enter interactive AI chat session',
    configureProviderDesc: 'Set up API provider and model',
    createProjectDesc: 'Scaffold a new project',
    manageSkillsDesc: 'View and select skill profiles',
    settingsDesc: 'Adjust application settings',
    exitDesc: 'Quit WindAllay',
  },
  provider: {
    title: 'Provider Configuration',
    apiBase: 'API Base URL',
    apiKey: 'API Key',
    model: 'Model',
    maxTokens: 'Max Tokens',
    temperature: 'Temperature',
    testConnection: 'Test Connection',
    testing: 'Testing...',
    connected: 'Connected! Models available:',
    failed: 'Connection failed:',
    back: '← Back to Main Menu',
    updated: 'updated',
    editHint: 'Type to edit • Enter confirm • ESC cancel',
    navHint: '↑↓ Navigate • Enter Edit • ESC/q Back',
    placeholder: 'Enter value...',
    fetching: 'Fetching models...',
    fromEnv: '(from env)',
    deleteConfirm: (name: string) => `Delete "${name}"?`,
    confirmDelete: 'Enter confirm • ESC cancel',
    modelSelect: '↑↓·Enter select·ESC back',
  },
  providerManager: {
    title: 'Provider Manager',
    addProvider: 'Add Provider',
    deleteProvider: 'Delete',
    setDefault: 'Set Default',
    noProviders: 'No other providers',
    defaultLabel: 'Default',
    name: 'Name',
    namePlaceholder: 'e.g. Azure, DeepSeek...',
  },
  project: {
    title: 'Create Project',
    stepName: 'Step 1: Project Name',
    namePrompt: 'Name:',
    nameHint: 'Type project name then press Enter',
    namePlaceholder: '(type project name)',
    stepType: 'Step 2: Project Type',
    typeHint: '↑↓ Select • Enter confirm • ESC back',
    stepConfirm: 'Step 3: Confirm',
    confirmText: (name: string, type: string, path: string) =>
      `Create "${name}" (${type}) at ${path}?`,
    confirmHint: 'Enter Yes • ESC/n No',
    created: (name: string, path: string) =>
      `Project "${name}" created at ${path}`,
    exists: (name: string) => `Directory "${name}" already exists`,
    failed: 'Failed to create project:',
    enterToNavigate: 'Press Enter to enter project directory and start chat',
    continue: 'Press Enter to continue',
    stepLanguage: 'Step 2: Language',
    languageHint: '↑↓ Select • Enter confirm • ESC back',
    stepProvider: 'Step 3: Provider',
    providerHint: '↑↓ Select • Enter confirm • ESC back',
    stepModel: 'Step 4: Model',
    modelHint: '↑↓ Select • Enter confirm • ESC back',
    noModels: 'No models available',
    stepIndicator: (current: string, total: string) => `Step ${current}/${total}`,
    nodeTs: 'Node.js + TypeScript',
    nodeTsDesc: 'Modern Node project with TypeScript',
    nodeJs: 'Node.js + JavaScript',
    nodeJsDesc: 'Simple Node.js project',
    empty: 'Empty Directory',
    emptyDesc: 'Just create the folder',
  },
  form: {
    title: 'Form',
  },
  todo: {
    title: 'Tasks',
  },
  file: {
    preview: 'File Preview',
    lines: (n: number) => `${n} line${n !== 1 ? 's' : ''}`,
    truncated: (n: number) => `... ${n} more line${n !== 1 ? 's' : ''}`,
    error: 'Error',
  },
  input: {
    placeholder: 'Type a message or /help...',
    thinking: '⏳ AI is thinking...',
  },
  paginated: {
    empty: '(empty)',
    page: (n: number, total: number) => `Page ${n}/${total}`,
  },
  setup: {
    title: (name: string) => `Setup: ${name}`,
    you: 'You:',
    ai: 'AI:',
    tool: '\u2699',
    fields: 'Fields',
    prompt: '\u276f',
    enterHint: 'Enter to send, Ctrl+N = mark complete',
    thinking: 'Thinking...',
    done: 'Project created! Press Enter to continue',
    detected: 'Project setup files detected',
    executePrompt: 'Initialize project according to setup? (y/n)',
  },
  settings: {
    title: 'Settings',
    memory: 'Memory',
    memoryDesc: 'Enable conversation memory persistence',
    temperature: 'Temperature',
    temperatureDesc: 'AI response creativity (0.0 - 2.0)',
    maxTokens: 'Max Tokens',
    maxTokensDesc: 'Maximum tokens per response',
    contextLimit: 'Context Limit',
    contextLimitDesc: 'Maximum context window size',
    compactionThreshold: 'Compaction Threshold',
    compactionThresholdDesc: 'Context % that triggers auto-compaction (0=off)',
    back: '← Back to Main Menu',
    page: (n: number, total: number) => `Settings ${n}/${total}`,
    currentConfig: 'Current Config:',
    context: (n: number) => `Context: ${n}k tokens`,
    memoryStatus: (on: boolean) => `Memory: ${on ? 'Enabled' : 'Disabled'}`,
    tempAndTokens: (t: number, m: number) => `Temp: ${t} | Max Tokens: ${m}`,
    on: 'ON',
    off: 'OFF',
    navHint: '↑↓ Navigate • Enter Toggle • ESC/q Back',
  },
  chat: {
    welcome: 'Welcome to WindAllay!',
    subtitle: 'Your AI-powered CLI assistant',
    status: 'Status',
    ready: 'Ready',
    thinking: 'Thinking...',
    compacting: 'Compacting context...',
    compacted: 'Context compacted',
    compactResult: (saved: number) => `Context compacted, saved ~${saved} tokens`,
    streaming: 'Streaming',
    toolCall: 'Using tools...',
    error: 'Error',
    msgs: 'msgs',
    ctx: 'ctx',
    inputPlaceholder: 'Type a message or /help...',
    noKeyWarning: '⚠ API Key not set — configure provider first',
    langChainReady: 'LangChain memory ready',
    langChainOff: 'LangChain not enabled',
    mcpServers: (n: number) => `${n} MCP server${n > 1 ? 's' : ''}`,
    lspReady: 'LSP ready',
    compactUnnecessary: 'Context already concise, no compression needed.',
    hint: 'Type a message to start, /help for commands, /compact to compress context',
  },
  dialog: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    edit: 'Edit',
    save: 'Save',
  },
  commands: {
    title: 'Available commands:',
    help: 'Show this help',
    clear: 'Clear conversation',
    new: 'Start new session',
    session: 'Browse session history',
    skill: 'Select a skill',
    model: 'Change model',
    context: 'Show context usage',
    memory: 'Show memory info',
    langchain: 'Show LangChain memory status',
    mcp: 'List MCP servers and tools',
    lsp: 'Run LSP diagnostics on a file',
    exit: 'Exit WindAllay',
    unknown: (cmd: string) => `Unknown command: ${cmd}. Type /help for available commands.`,
  },
  nav: {
    upDown: '↑↓ Navigate',
    enter: 'Enter Select',
    quit: 'q/ESC Quit',
    back: 'ESC/q Back',
  },
  skills: {
    title: 'Skills Manager',
    none: 'None (default)',
    close: '↑↓ Navigate • Enter Select • q/ESC Close',
  },
  models: {
    title: (n: number) => `Models (${n} available)`,
    close: '↑↓ Navigate • Enter Select • q/ESC Close',
  },
  session: {
    title: 'Session History',
    newSession: '+ New Session',
    current: '(current)',
    confirmDelete: 'Delete this session? (y/n)',
    created: 'New session created.',
    restored: 'Session restored.',
    deleted: 'Session deleted.',
    noSessions: 'No saved sessions',
    messagesCount: (n: number) => `${n} message${n > 1 ? 's' : ''}`,
    timeAgo: {
      justNow: 'just now',
      minutesAgo: (n: number) => `${n}m ago`,
      hoursAgo: (n: number) => `${n}h ago`,
      daysAgo: (n: number) => `${n}d ago`,
    },
    hint: '↑↓ Navigate · Enter Select · d Delete · ESC/q Close',
  },
};

function resolve(obj: TranslationTree, path: string[]): TranslationValue | undefined {
  let current: any = obj;
  for (const key of path) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  return current as TranslationValue;
}

function getLang(): Lang {
  const cfg = getConfig();
  return (cfg as any).language || 'en';
}

export function t(path: string, ...args: any[]): string {
  const parts = path.split('.');
  const lang = getLang();
  const dict = lang === 'zh' ? ZH : EN;

  const val = resolve(dict, parts);
  if (typeof val === 'function') {
    return (val as (...a: any[]) => string)(...args);
  }
  if (typeof val === 'string') {
    return args.length > 0
      ? val.replace(/\{(\d+)\}/g, (_, i) => args[parseInt(i)] ?? '')
      : val;
  }
  return path;
}

export function setLang(lang: Lang): void {
  setConfig('language' as any, lang);
}

export function getCurrentLang(): Lang {
  return getLang();
}
