import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Text, Box, Static } from 'ink';
import { useInput } from 'ink';
import { Message } from '../providers/types.js';
import { useTerminalSize } from './responsive.js';
import { OpenAICompatibleProvider } from '../providers/openai-compat.js';
import { LLMProvider } from '../providers/types.js';
import { getConfig, setConfig, getApiBase, getApiKey } from '../utils/config.js';
import { getToolRegistry } from '../tools/registry.js';
import type { ToolContext } from '../tools/registry.js';
import { ToolExecutor, ToolCallRequest } from '../tools/executor.js';
import { getSkillRegistry } from '../skills/registry.js';
import { getEnhancedSkillLoader } from '../skills/enhanced.js';
import { MemoryManager } from '../memory/manager.js';
import { createContextWindow } from '../context/compressor.js';
import { getContextStats } from '../context/monitor.js';
import { getModels } from '../models/cache.js';
import { refreshMCPTools } from '../tools/mcp-tools.js';
import { getMCPServerManager } from '../mcp/mcp-client.js';
import { getLSPServiceManager } from '../lsp/lsp-client.js';
import { compactMessages, pruneToolOutputs } from '../context/compactor.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getTodos, getActiveFormFields, getFormTimeoutFields } from '../projects/chat-tools.js';
import { InteractiveFormField } from './interactive-field.js';

import { MessageItem } from './message-item.js';
import { InputBox } from './input-box.js';
import { StatusLine } from './status-line.js';
import { SkillPanel } from './skill-panel.js';
import { ModelPicker } from './model-picker.js';
import { SessionPicker } from './session-picker.js';
import { Card, CardDivider } from './card.js';
import { FullScreen } from './fullscreen.js';
import { t } from '../utils/i18n.js';

type AppStatus = 'idle' | 'thinking' | 'streaming' | 'tool_call' | 'error';

interface ToolCallAccumulator {
  index: number;
  id: string;
  name: string;
  args: string;
}

interface Props {
  onBack?: () => void;
}

export function ChatView({ onBack }: Props) {
  const { columns } = useTerminalSize();
  const messagesRef = useRef<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<AppStatus>('idle');
  const [showSkills, setShowSkills] = useState(false);
  const [showModels, setShowModels] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const [skillName, setSkillName] = useState<string | undefined>();
  const [modelName, setModelName] = useState(getConfig().model);
  const [models, setModels] = useState<any[]>([]);
  const [providerIdx, setProviderIdx] = useState(0);
  const [providerList] = useState(() => {
    const cfg = getConfig();
    const def = { name: t('providerManager.defaultLabel'), apiBase: cfg.apiBase, apiKey: cfg.apiKey, model: cfg.model };
    try {
      const saved = JSON.parse((cfg as any).savedProviders || '[]');
      return [def, ...saved];
    } catch { return [def]; }
  });
  const [langChainReady, setLangChainReady] = useState(false);
  const [inputFocus, setInputFocus] = useState(true);
  const [, setAbortRequested] = useState(false);
  const abortRef = useRef(false);
  const [executingTool, setExecutingTool] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [setupFiles, setSetupFiles] = useState<string[]>([]);
  const [setupContent, setSetupContent] = useState('');
  const setupInjectedRef = useRef(false);
  const [activeFormFields, setActiveFormFields] = useState<import('../projects/chat-tools.js').FormField[]>([]);
  const [todoItems, setTodoItems] = useState<import('../projects/chat-tools.js').TodoItem[]>([]);
  const idleStartRef = useRef<number>(Date.now());
  const lastTimeoutSentRef = useRef<number>(0);

  const providerRef = useRef<LLMProvider>(
    new OpenAICompatibleProvider(getApiBase(), getApiKey(), modelName)
  );
  const memoryRef = useRef(new MemoryManager());
  const [messageCount, setMessageCount] = useState(0);

  const toolCtxRef = useRef<ToolContext>({
    cwd: process.cwd(),
    workingDir: process.cwd(),
    allowBash: true,
  });

  const escPressRef = useRef<{ count: number; time: number }>({ count: 0, time: 0 });

  useEffect(() => {
    const config = getConfig();
    setModelName(config.model);

    getModels().then((m) => setModels(m as any)).catch(() => {});

    // Try to restore last session or start fresh
    const sessions = memoryRef.current.listSessions();
    if (sessions.length > 0) {
      const lastSession = sessions.sort((a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )[0];
      // Only auto-restore if the session is recent (within 1 hour)
      const sessionAge = Date.now() - new Date(lastSession.startedAt).getTime();
      if (sessionAge < 3600000 && lastSession.messageCount > 0) {
        memoryRef.current.loadSession(lastSession.id);
        const restored = memoryRef.current.getMessages();
        setMessages(restored);
        setMessageCount(lastSession.messageCount);
        setSessionTitle(memoryRef.current.getSessionTitle());
      }
    }

    const setupDir = join(process.cwd(), 'agent', 'setup');
    if (existsSync(setupDir)) {
      try {
        const files = readdirSync(setupDir).filter((f) => f.endsWith('.md'));
        if (files.length > 0) {
          setSetupFiles(files);
          const content = files.map((f) => {
            const p = join(setupDir, f);
            return `--- ${f} ---\n${readFileSync(p, 'utf-8')}`;
          }).join('\n\n');
          setSetupContent(content);
        }
      } catch {}
    }
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (status === 'idle') idleStartRef.current = Date.now();
  }, [status]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFormFields(getActiveFormFields());
      setTodoItems([...getTodos()]);

      if (status === 'idle') {
        const idleTime = (Date.now() - idleStartRef.current) / 1000;
        const timeoutFields = getFormTimeoutFields();
        for (const f of timeoutFields) {
          if (idleTime >= f.autoTimeout && (Date.now() - lastTimeoutSentRef.current) > f.autoTimeout * 1000) {
            lastTimeoutSentRef.current = Date.now();
            const timeoutMsg: Message = {
              role: 'system',
              content: `[User idle for ${Math.floor(idleTime)}s. Auto-timeout for field "${f.label}". You may auto-select or continue.]`,
            };
            setMessages((prev) => {
              const updated = [...prev, timeoutMsg];
              messagesRef.current = updated;
              return updated;
            });
            break;
          }
        }
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [status]);

  // Initialize LangChain memory and MCP
  useEffect(() => {
    const init = async () => {
      try {
        await memoryRef.current.enableLangChainMemory();
        setLangChainReady(true);
      } catch { }

      try {
        const mcpManager = getMCPServerManager();
        mcpManager.loadConfigs();
        await mcpManager.connectAll();
        refreshMCPTools();
      } catch { }
    };
    init();
  }, []);

  useInput((input, key) => {
    if (setupFiles.length > 0 && !setupInjectedRef.current) {
      if (input === 'y' || input === 'Y') {
        setupInjectedRef.current = true;
        const specMsg: Message = {
          role: 'system',
          content: `The following project setup specifications were found. Please review and initialize the project accordingly:\n\n${setupContent}`,
        };
        setMessages((prev) => {
          const updated = [...prev, specMsg];
          messagesRef.current = updated;
          return updated;
        });
        setSetupFiles([]);
      } else if (input === 'n' || input === 'N' || key.escape) {
        setupInjectedRef.current = true;
        setSetupFiles([]);
      }
      return;
    }

    if (showProviders) {
      if (key.return && providerList[providerIdx]) {
        handleProviderSelect(providerIdx);
      } else if (key.escape) {
        setShowProviders(false);
      } else if (key.upArrow) {
        setProviderIdx((i) => (i > 0 ? i - 1 : providerList.length - 1));
      } else if (key.downArrow) {
        setProviderIdx((i) => (i < providerList.length - 1 ? i + 1 : 0));
      }
      return;
    }
    if (showSkills || showModels || showSessions) return;

    if (key.ctrl && input === 'n' && status === 'idle') {
      const markMsg: Message = { role: 'system', content: '[USER MARKED FIELD AS COMPLETE]' };
      setMessages((prev) => {
        const updated = [...prev, markMsg];
        messagesRef.current = updated;
        return updated;
      });
      setStatus('thinking');
      setTimeout(() => { void handleAiResponse(messagesRef.current); }, 0);
      return;
    }

    // Only handle 'i' key when input is NOT focused (avoid interference while typing)
    if (!inputFocus && status === 'idle') {
      if ((key.shift && input.toLowerCase() === 'i') || input === 'i') {
        setInputFocus(true);
      }
    }

    if (key.escape) {
      const now = Date.now();
      const last = escPressRef.current;
      if (now - last.time < 500) {
        last.count++;
        if (last.count >= 2) {
          setAbortRequested(true);
          abortRef.current = true;
          setStatus('idle');
          last.count = 0;
        }
      } else {
        last.count = 1;
      }
      last.time = now;
    }
  });

  const handleModelSelect = useCallback(async (id: string) => {
    setModelName(id);
    providerRef.current = new OpenAICompatibleProvider(getApiBase(), getApiKey(), id);
    setMessages([]);
    memoryRef.current.clear();
    setMessageCount(0);
    setShowModels(false);
  }, []);

  const handleProviderSelect = useCallback((idx: number) => {
    const p = providerList[idx];
    if (p) {
      setConfig('apiBase', p.apiBase);
      setConfig('apiKey', p.apiKey);
      setConfig('model', p.model);
      providerRef.current = new OpenAICompatibleProvider(p.apiBase, p.apiKey, p.model);
      setModelName(p.model);
      setMessages([]);
      memoryRef.current.clear();
      setMessageCount(0);
    }
    setShowProviders(false);
  }, [providerList]);

  const handleSessionSelect = useCallback((sessionId: string) => {
    if (sessionId === '__new__') {
      // Create new session
      memoryRef.current.newSession();
      setMessages([]);
      setMessageCount(0);
      setSessionTitle('');
    } else {
      // Load existing session
      const loaded = memoryRef.current.loadSession(sessionId);
      if (loaded) {
        const restored = memoryRef.current.getMessages();
        setMessages(restored);
        setMessageCount(restored.length);
        setSessionTitle(memoryRef.current.getSessionTitle());
      }
    }
    setShowSessions(false);
  }, []);

  const handleSessionDelete = useCallback((sessionId: string) => {
    memoryRef.current.deleteSession(sessionId);
  }, []);

  const handleCommand = useCallback(
    (cmd: string) => {
      const parts = cmd.slice(1).split(' ');
      const command = parts[0].toLowerCase();

      switch (command) {
        case 'help':
          showHelp();
          break;
        case 'clear':
          setMessages([]);
          memoryRef.current.clear();
          setMessageCount(0);
          break;
        case 'new':
          memoryRef.current.newSession();
          setMessages([]);
          setMessageCount(0);
          setSessionTitle('');
          setMessages((prev) => [
            ...prev,
            { role: 'system', content: '已创建新会话。' } as Message,
          ]);
          break;
        case 'session':
        case 'sessions':
        case 'history':
          setShowSessions(true);
          break;
        case 'skill':
          setShowSkills(true);
          break;
        case 'model':
          setShowModels(true);
          getModels(true).then((m) => {
            setModels(m as any);
          }).catch(() => {});
          break;
        case 'provider':
          setProviderIdx(0);
          setShowProviders(true);
          break;
        case 'context':
          showContextStats();
          break;
        case 'mcp':
          showMCPInfo();
          break;
        case 'lsp':
          handleLSPCommand(parts.slice(1));
          break;
        case 'memory':
          showMemoryInfo();
          break;
        case 'langchain':
          showLangChainInfo();
          break;
        case 'exit':
        case 'quit':
          process.exit(0);
          break;
        case 'back':
        case 'menu':
          if (onBack) onBack();
          break;
        default:
          setMessages((prev) => [
            ...prev,
            {
              role: 'system',
              content: `Unknown command: ${cmd}. Type /help for available commands.`,
            } as Message,
          ]);
      }
    },
    [onBack]
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      idleStartRef.current = Date.now();
      setAbortRequested(false);
      abortRef.current = false;

      if (value.startsWith('/')) {
        handleCommand(value);
        return;
      }

      const userMsg: Message = { role: 'user', content: value };
      const currentMessages = messagesRef.current;
      const newMessages = [...currentMessages, userMsg];
      setMessages(newMessages as any);
      await memoryRef.current.addMessage(userMsg);
      setMessageCount((c) => c + 1);
      setStatus('thinking');

      // Update session title from first user message
      if (!sessionTitle) {
        const title = value.slice(0, 50) + (value.length > 50 ? '...' : '');
        setSessionTitle(title);
      }

      try {
        await handleAiResponse(newMessages);
      } catch (err: any) {
        const errMsg: Message = {
          role: 'assistant',
          content: `Error: ${err.message}`,
        };
        setMessages((prev) => [...prev, errMsg]);
        setStatus('error');
      }
    },
    [handleCommand, sessionTitle]
  );

  function showHelp() {
    const helpText = [
      'Available commands:',
      '  /help        - Show this help',
      '  /clear       - Clear conversation',
      '  /new         - Start a new session',
      '  /session     - Browse session history',
      '  /skill       - Select a skill',
      '  /model       - Change model',
      '  /context     - Show context usage',
      '  /memory      - Show memory info',
      '  /langchain   - Show LangChain memory status',
      '  /mcp         - List connected MCP servers and tools',
      '  /lsp diag    - Run LSP diagnostics on a file',
      '  /exit        - Exit WindAllay',
      '  /back        - Back to main menu',
      '',
      'Shortcuts:',
      '  i or Shift+I - Focus input box',
      '  ESC×3        - Abort current request',
    ].join('\n');
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: helpText } as Message,
    ]);
  }

  function showContextStats() {
    const stats = getContextStats(memoryRef.current.getMessages());
    const text = `Context: ${stats.formatted}${stats.isNearLimit ? ' (near limit!)' : ''}`;
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: text } as Message,
    ]);
  }

  function showMemoryInfo() {
    const sessions = memoryRef.current.listSessions();
    const currentSession = memoryRef.current.getSession();
    const lines = [
      `📋 Memory & Session Info`,
      `─────────────────────────`,
      `Current session: ${currentSession.title || currentSession.id.slice(-8)}`,
      `Session ID: ${currentSession.id}`,
      `Messages: ${currentSession.messageCount}`,
      `Started: ${currentSession.startedAt}`,
      `LangChain: ${langChainReady ? '✓ active' : '○ inactive'}`,
      ``,
      `📚 Saved sessions: ${sessions.length}`,
    ];
    if (sessions.length > 0) {
      const recent = sessions
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 5);
      for (const s of recent) {
        const title = s.title || s.id.slice(-8);
        lines.push(`  • ${title} (${s.messageCount} msgs, ${s.model})`);
      }
      if (sessions.length > 5) {
        lines.push(`  ... and ${sessions.length - 5} more`);
      }
      lines.push('');
      lines.push('Use /session to browse and restore sessions.');
    }
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: lines.join('\n') } as Message,
    ]);
  }

  function showLangChainInfo() {
    const info = [
      `LangChain Memory: ${langChainReady ? '✓ Enabled' : '○ Disabled'}`,
      `Provides: conversation summarization + semantic retrieval`,
      `Uses: OpenAI embeddings + ConversationSummaryMemory`,
    ].join('\n');
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: info } as Message,
    ]);
  }

  function showMCPInfo() {
    const mcpManager = getMCPServerManager();
    const clients = mcpManager.getAllClients();
    const configs = mcpManager.getAllConfigs();
    const allTools = mcpManager.getAllTools();

    const lines: string[] = [];
    lines.push(`MCP Servers (${configs.length} configured, ${clients.length} connected):`);
    for (const c of clients) {
      const tools = c.getTools();
      lines.push(`  ● ${c.name} (${tools.length} tools)`);
      for (const t of tools.slice(0, 5)) {
        lines.push(`    └ ${t.name}: ${t.description.slice(0, 60)}`);
      }
      if (tools.length > 5) lines.push(`    └ ... and ${tools.length - 5} more`);
    }
    if (clients.length === 0) {
      lines.push('  (no MCP servers connected)');
    }
    lines.push(`\nTotal MCP tools available: ${allTools.length}`);

    setMessages((prev) => [
      ...prev,
      { role: 'system', content: lines.join('\n') } as Message,
    ]);
  }

  async function handleLSPCommand(args: string[]) {
    if (args[0] === 'diag' && args[1]) {
      const filePath = args[1];
      try {
        const lspManager = getLSPServiceManager();
        const diagnostics = await lspManager.getDiagnostics(filePath);
        const lines = [`LSP Diagnostics for ${filePath}:`];
        if (diagnostics.length === 0) {
          lines.push('  No issues found');
        } else {
          for (const d of diagnostics) {
            const pos = `${d.range.start.line}:${d.range.start.character}`;
            lines.push(`  ${d.severity === 'error' ? '✗' : '⚠'} [${d.severity}] ${pos} ${d.message}`);
          }
        }
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: lines.join('\n') } as Message,
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: `LSP error: ${err.message}` } as Message,
        ]);
      }
    } else {
      setMessages((prev) => [
        ...prev,
        { role: 'system', content: 'Usage: /lsp diag <filepath>' } as Message,
      ]);
    }
  }

  const MAX_TOOL_STEPS = 25;
  const MAX_CONSECUTIVE_ERRORS = 3;

  async function handleAiResponse(initialMessages: Message[]) {
    let stepCount = 0;
    let messages = initialMessages;
    let consecutiveErrors = 0;
    let lastErrorTool = '';

    const executor = new ToolExecutor(
      getToolRegistry(),
      toolCtxRef.current,
      (toolName, _toolCallId, status) => {
        if (status === 'executing') setExecutingTool(toolName);
        else if (status === 'error') setExecutingTool(`✗ ${toolName}`);
        else setExecutingTool(null);
      },
    );

    const provider = providerRef.current;

    async function maybeCompact(): Promise<boolean> {
      const limit = getConfig().contextLimit;
      const result = await compactMessages(messages, limit, provider);
      if (result.summary) {
        messages = result.messages;
        return true;
      }
      return false;
    }

    await maybeCompact();

    // Pre-compute things that don't change across tool-call iterations
    const skillRegistry = getSkillRegistry();
    const enhancedLoader = getEnhancedSkillLoader();
    let skillInstructions = skillRegistry.getSystemInstructions(skillName);

    if (skillName) {
      const enhanced = enhancedLoader.getEnhanced(skillName);
      if (enhanced) {
        await enhancedLoader.resolveDependencies(enhanced);
        skillInstructions = enhancedLoader.getSystemPromptWithVars(enhanced);
      }
    }

    const systemPrompt = getConfig().systemPrompt;

    // Fetch memory context ONCE before the loop (avoid repeated embedding API calls)
    let memoryContext = '';
    if (langChainReady && messages.length > 0) {
      const lastUserMsg = messages.filter((m) => m.role === 'user').pop();
      const query = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';
      if (query) {
        try {
          memoryContext = await memoryRef.current.getHistoryContext(query);
        } catch { }
      }
    }

    while (stepCount < MAX_TOOL_STEPS) {
      if (abortRef.current) {
        setAbortRequested(false);
        abortRef.current = false;
        setStatus('idle');
        return;
      }

      const compacted = await maybeCompact();
      if (compacted) setStatus('thinking');

      const fullSystemPrompt = [systemPrompt, skillInstructions, memoryContext]
        .filter(Boolean)
        .join('\n\n');

      const contextMessages = createContextWindow(
        fullSystemPrompt,
        '',
        messages,
        []
      );

      const toolRegistry = getToolRegistry();
      const tools = toolRegistry.getDefinitions();

      let accumulatedContent = '';
      let accumulatedReasoning = '';
      let toolCalls: ToolCallAccumulator[] = [];
      let lastStreamUpdate = 0;
      const STREAM_UPDATE_INTERVAL = 50;

      const stream = provider.chat({
        messages: contextMessages,
        tools: tools.length > 0 ? tools : undefined,
        temperature: getConfig().temperature,
        maxTokens: getConfig().maxTokens,
      });

      for await (const chunk of stream) {
        switch (chunk.type) {
          case 'content':
            accumulatedContent += chunk.delta;
            setStatus('streaming');
            if (Date.now() - lastStreamUpdate >= STREAM_UPDATE_INTERVAL) {
              setStreamingContent(accumulatedContent);
              lastStreamUpdate = Date.now();
            }
            break;

          case 'reasoning':
            accumulatedReasoning += chunk.delta;
            break;

          case 'tool_call': {
            setStatus('tool_call');
            let existing = toolCalls.find((tc) => tc.index === chunk.index);
            if (!existing) {
              existing = { index: chunk.index, id: chunk.id ?? `call_${chunk.index}`, name: chunk.name ?? '', args: chunk.args ?? '' };
              toolCalls.push(existing);
            } else {
              if (chunk.id) existing.id = chunk.id;
              if (chunk.name) existing.name += chunk.name;
              if (chunk.args) existing.args += chunk.args;
            }
            break;
          }

          case 'done': {
            try {
              setStreamingContent('');
              const assistantMsg: any = {
                role: 'assistant',
                content: accumulatedContent || null,
              };
              if (accumulatedReasoning) {
                assistantMsg.reasoning_content = accumulatedReasoning;
              }
              if (toolCalls.length > 0) {
                assistantMsg.tool_calls = toolCalls.map((tc) => ({
                  id: tc.id,
                  type: 'function',
                  function: { name: tc.name, arguments: tc.args },
                }));
              }
              if (accumulatedContent || toolCalls.length > 0 || accumulatedReasoning) {
                setMessages((prev) => [...prev, assistantMsg]);
                await memoryRef.current.addMessage(assistantMsg);
                messages = [...messages, assistantMsg];
              }

              if (toolCalls.length > 0) {
                const requests: ToolCallRequest[] = toolCalls.map((tc) => ({
                  id: tc.id,
                  name: tc.name,
                  args: (() => { try { return JSON.parse(tc.args); } catch { return { raw: tc.args }; } })(),
                }));

                const results = await executor.executeBatch(requests);
                let allSucceeded = true;

                for (const toolMsg of results) {
                  setMessages((prev) => [...prev, toolMsg as any]);
                  await memoryRef.current.addMessage(toolMsg as any);
                  messages = [...messages, toolMsg as any];
                  if (typeof toolMsg.content === 'string' && toolMsg.content.startsWith('__execution_error__')) {
                    allSucceeded = false;
                  }
                }

                messages = pruneToolOutputs(messages) as Message[];

                if (!allSucceeded) {
                  consecutiveErrors++;
                  const firstFailedTool = requests[0]?.name ?? '';
                  if (firstFailedTool === lastErrorTool) {
                    if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
                      const stopMsg: Message = {
                        role: 'system',
                        content: `Tool "${firstFailedTool}" failed ${consecutiveErrors} consecutive times. Stop using this tool and respond with text.`,
                      };
                      setMessages((prev) => [...prev, stopMsg]);
                      await memoryRef.current.addMessage(stopMsg);
                      messages = [...messages, stopMsg];
                      stepCount++;
                      setStatus('thinking');
                      break;
                    }
                  } else {
                    consecutiveErrors = 1;
                    lastErrorTool = firstFailedTool;
                  }
                } else {
                  consecutiveErrors = 0;
                  lastErrorTool = '';
                }

                stepCount++;
                setStatus('thinking');
              } else {
                setStatus('idle');
                messages = [];
              }
              break;
            } catch (err) {
              setMessages((prev) => [
                ...prev,
                { role: 'system', content: `Tool execution error: ${err instanceof Error ? err.message : String(err)}` } as Message,
              ]);
              setStatus('error');
              messages = [];
              break;
            }
          }

          case 'error':
            setMessages((prev) => [
              ...prev,
              { role: 'system', content: `Error: ${chunk.message}` } as Message,
            ]);
            setStatus('error');
            messages = [];
            break;
        }
      }

      if (messages.length === 0) break;

      if (stepCount >= MAX_TOOL_STEPS) {
        setMessages((prev) => [
          ...prev,
          { role: 'system', content: `Reached maximum tool call steps (${MAX_TOOL_STEPS}). Continuing conversation.` } as Message,
        ]);
        setStatus('idle');
        messages = [];
      }
    }
  }

  const contextStats = getContextStats(memoryRef.current.getMessages());

  if (showSkills) {
    return (
      <FullScreen>
        <SkillPanel
          skills={getSkillRegistry().getAll()}
          activeSkill={skillName}
          onSelect={(name) => {
            setSkillName(name);
            setShowSkills(false);
          }}
          onClose={() => setShowSkills(false)}
        />
      </FullScreen>
    );
  }

  if (showModels) {
    return (
      <FullScreen>
        <ModelPicker
          models={models}
          activeModel={modelName}
          onSelect={handleModelSelect}
          onClose={() => setShowModels(false)}
        />
      </FullScreen>
    );
  }

  if (showProviders) {
    return (
      <FullScreen>
        <Card borderColor="cyan" padding={1} marginBottom={1}>
          <Text bold color="cyan">{t('provider.title')}</Text>
        </Card>
        <Box flexDirection="column" width={56}>
          {providerList.map((p: any, i: number) => {
            const sel = providerIdx === i;
            return (
              <Card key={i} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={0} marginBottom={0}>
                <Box>
                  <Text bold color={sel ? 'white' : 'gray'}>
                    {sel ? '› ' : '  '}{p.name}
                  </Text>
                  <Text dimColor>  {p.apiBase}</Text>
                </Box>
              </Card>
            );
          })}
        </Box>
        <CardDivider />
        <Card borderColor="gray" padding={0}>
          <Text dimColor>{t('provider.navHint')}</Text>
        </Card>
      </FullScreen>
    );
  }

  if (showSessions) {
    const sessions = memoryRef.current.listSessions();
    return (
      <FullScreen>
        <SessionPicker
          sessions={sessions}
          currentSessionId={memoryRef.current.getSession().id}
          onSelect={handleSessionSelect}
          onDelete={handleSessionDelete}
          onClose={() => setShowSessions(false)}
        />
      </FullScreen>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexGrow={1} flexDirection="column">
        {messages.length === 0 && (
          <Card borderColor="gray" padding={2} marginBottom={1} fillWidth>
            <Text>
              <Text bold color="cyan">{t('chat.welcome')}</Text>
              {'\n'}
              <Text dimColor>{t('chat.subtitle')}</Text>
              {'\n'}
              <Text dimColor>
                LangChain: {langChainReady ? '✓' : '○'} {' '}
                MCP: {getMCPServerManager().getAllClients().length} {' '}
                LSP: ready
              </Text>
              {'\n'}
              <Text dimColor>输入消息开始对话，或 /help 查看命令，/session 浏览历史</Text>
            </Text>
          </Card>
        )}
        {setupFiles.length > 0 && !setupInjectedRef.current && (
          <Card borderColor="yellow" padding={1} marginBottom={1} fillWidth>
            <Text bold color="yellow">{t('setup.detected')}</Text>
            <Text>  {setupFiles.map((f) => `📄 ${f}`).join('\n  ')}</Text>
            <Text dimColor>  {t('setup.executePrompt')}</Text>
          </Card>
        )}
        <Static items={messages}>
          {(msg, i) => (
            <MessageItem
              key={i}
              message={msg}
              isLast={false}
            />
          )}
        </Static>
        {streamingContent && (
          <MessageItem
            message={{ role: 'assistant', content: streamingContent } as Message}
            isLast={true}
          />
        )}
      </Box>

      {activeFormFields.length > 0 && activeFormFields[0].type !== 'input' && (
        <InteractiveFormField
          field={activeFormFields[0]}
          onSubmitMessage={(value) => {
            const markMsg: Message = { role: 'system', content: `[USER ANSWER: ${value}]` };
            setMessages((prev) => {
              const updated = [...prev, markMsg];
              messagesRef.current = updated;
              return updated;
            });
            if (status === 'idle') {
              setStatus('thinking');
              setTimeout(() => { void handleAiResponse(messagesRef.current); }, 0);
            }
          }}
        />
      )}
      {todoItems.length > 0 && (
        <Card borderColor="cyan" padding={0} marginBottom={0} width={columns - 2}>
          <Text bold color="cyan"> {t('todo.title')} ({todoItems.filter((t) => t.done).length}/{todoItems.length})</Text>
          <Text dimColor>  {todoItems.map((t) => `${t.done ? '✓' : '○'} ${t.description}`).join('  |  ')}</Text>
        </Card>
      )}
      <Card borderColor="gray" padding={1} marginBottom={0} width={columns - 2}>
        <StatusLine
          model={modelName}
          contextStats={contextStats}
          status={status}
          messageCount={messageCount}
          executingTool={executingTool}
        />
        <Box marginLeft={2}>
          <Text dimColor>
            {sessionTitle && <Text> · {sessionTitle}</Text>}
            {langChainReady && <Text color="green"> [LC]</Text>}
            {getMCPServerManager().getAllClients().length > 0 && <Text color="yellow"> [MCP]</Text>}
          </Text>
        </Box>
        <InputBox
          onSubmit={handleSubmit}
           disabled={status !== 'idle' || showSkills || showModels || showSessions || showProviders}
          placeholder="输入消息或 /help..."
          focus={inputFocus && status === 'idle'}
        />
      </Card>
    </Box>
  );
}
