import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { OpenAICompatibleProvider } from '../providers/openai-compat.js';
import { getToolRegistry } from '../tools/registry.js';
import {
  initSetup, getSession,
  registerSetupTools, unregisterSetupTools,
  SETUP_TOOL_NAMES,
} from '../projects/setup-agent.js';
import { t } from '../utils/i18n.js';
import { Card, CardHeader } from './card.js';
import { InteractiveFormField } from './interactive-field.js';

interface Props {
  projectName: string;
  languageName: string;
  languageId: string;
  providerConfig: { name: string; apiBase: string; apiKey: string };
  model: string;
  onComplete: (path: string) => void;
  onBack: () => void;
}

interface ToolCallData {
  id: string;
  type: string;
  function: { name: string; arguments: string };
}
interface ChatMsg {
  role: string;
  content: string;
  tool_calls?: ToolCallData[];
  tool_call_id?: string;
}

const SETUP_SYSTEM_PROMPT = `You are guiding the user through creating a new software project.

The user has already selected a LANGUAGE. Do NOT ask about the language again — use it to ask relevant questions.

LANGUAGE: {language}
PROJECT: {project}

YOUR ROLE:
- Ask ONE question at a time, one step per page
- Each step is ONE clear question with options or text input
- Use the project_setup_add_field tool to register each field
- After user answers, use project_setup_set_field to record it
- Tell the user "Press Ctrl+N to mark this step as complete"
- When you see "[USER MARKED STEP AS COMPLETE]", call project_setup_mark
- After marking, present the NEXT question automatically
- Keep each step focused — do NOT ask multiple questions at once

FORMAT:
- For yes/no: type "switch"
- For multiple choice: type "checkbox" (list options in your message)
- For text input: type "input"
- For custom files: use project_setup_add_file

When ALL steps are done, call project_setup_finalize to create the project.`;

export function SetupChat({ projectName, languageName, languageId, providerConfig, model, onComplete, onBack }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'thinking' | 'done'>('idle');
  const [error, setError] = useState('');
  const providerRef = useRef<OpenAICompatibleProvider | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    initSetup(projectName, languageName, languageId, providerConfig, model);
    const registry = getToolRegistry();
    registerSetupTools(registry as any);
    providerRef.current = new OpenAICompatibleProvider(providerConfig.apiBase, providerConfig.apiKey, model);

    const initial: ChatMsg[] = [
      { role: 'system', content: SETUP_SYSTEM_PROMPT.replace('{language}', languageName).replace('{project}', projectName) },
    ];
    setMessages(initial);
    setStatus('thinking');
    void runAiLoop(initial);

    return () => {
      abortRef.current?.abort();
      unregisterSetupTools(registry);
    };
  }, []);

  const runAiLoop = useCallback(async (msgs: ChatMsg[]) => {
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await aiLoop(msgs);
    } finally {
      runningRef.current = false;
    }
  }, []);

  async function aiLoop(msgs: ChatMsg[]) {
    const provider = providerRef.current;
    if (!provider) return;

    let currentMsgs = [...msgs];
    const maxSteps = 15;

    for (let step = 0; step < maxSteps; step++) {
      if (abortRef.current?.signal.aborted) return;

      const toolDefs = getToolRegistry().getDefinitions();
      const activeTools = toolDefs.filter((t) =>
        SETUP_TOOL_NAMES.includes(((t as any).function as any)?.name),
      );

      setStatus('thinking');

      const stream = provider.chat({
        messages: currentMsgs as any,
        tools: activeTools,
        temperature: 0.7,
        maxTokens: 2048,
      });

      let content = '';
      const toolCalls: Map<number, { id: string; name: string; args: string }> = new Map();
      let done = false;

      for await (const chunk of stream) {
        if (abortRef.current?.signal.aborted) return;
        if (chunk.type === 'content') {
          content += chunk.delta;
          setMessages([...currentMsgs, { role: 'assistant', content }]);
        } else if (chunk.type === 'tool_call') {
          const existing = toolCalls.get(chunk.index) || { id: '', name: '', args: '' };
          if (chunk.id) existing.id = chunk.id;
          if (chunk.name) existing.name = chunk.name;
          if (chunk.args) existing.args = (existing.args || '') + chunk.args;
          toolCalls.set(chunk.index, existing);
        } else if (chunk.type === 'done') {
          done = true;
        } else if (chunk.type === 'error') {
          setError(chunk.message);
          setStatus('idle');
          return;
        }
      }

      if (!done) {
        setError('AI response incomplete');
        setStatus('idle');
        return;
      }

      const assistantMsg: ChatMsg = { role: 'assistant', content };
      if (toolCalls.size > 0) {
        assistantMsg.tool_calls = Array.from(toolCalls.values()).map((tc) => ({
          id: tc.id,
          type: 'function',
          function: { name: tc.name, arguments: tc.args },
        }));
      }

      const updatedMsgs = [...currentMsgs, assistantMsg];
      setMessages(updatedMsgs);

      if (toolCalls.size === 0 && content.trim()) {
        setStatus('idle');
        return;
      }

      if (toolCalls.size > 0) {
        const toolResults: ChatMsg[] = [];
        for (const tc of toolCalls.values()) {
          const name = tc.name;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.args); } catch {}

          if (name === 'project_setup_finalize') {
            const registry = getToolRegistry();
            const result = await registry.execute(name, args, { cwd: process.cwd(), workingDir: process.cwd(), allowBash: false });
            toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
            updatedMsgs.push(...toolResults);
            setMessages(updatedMsgs);
            setStatus('done');
            const session = getSession();
            if (session?.createdPath) {
              onComplete(session.createdPath);
            }
            return;
          }

          const registry = getToolRegistry();
          const result = await registry.execute(name, args, { cwd: process.cwd(), workingDir: process.cwd(), allowBash: false });
          toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
        }

        currentMsgs = [...updatedMsgs, ...toolResults];
        setMessages(currentMsgs);
      }
    }

    setStatus('idle');
  }

  useInput((char, key) => {
    if (status === 'done') return;
    if (key.escape) { onBack(); return; }
    if (status === 'thinking') return;

    if (key.ctrl && char === 'n') {
      const markMsg: ChatMsg = { role: 'system', content: '[USER MARKED STEP AS COMPLETE]' };
      const newMsgs = [...messages, markMsg];
      setMessages(newMsgs);
      setInput('');
      void runAiLoop(newMsgs);
      return;
    }

    if (interactiveField) return;

    if (key.return && input.trim()) {
      const userMsg: ChatMsg = { role: 'user', content: input.trim() };
      const newMsgs = [...messages, userMsg];
      setMessages(newMsgs);
      setInput('');
      setStatus('thinking');
      void runAiLoop(newMsgs);
      return;
    }

    if (key.backspace || key.delete || char === '\x7f') {
      setInput((v) => v.slice(0, -1));
      return;
    }

    if (char.length === 1 && char.charCodeAt(0) >= 32 && !key.ctrl && !key.meta) {
      setInput((v) => v + char);
    }
  });

  const session = getSession();
  const allFields = session?.fields || [];
  const activeField = allFields.find((f) => !f.completed && f.type !== 'input');
  const interactiveField = activeField ? { ...activeField, options: [] as string[], autoTimeout: 0 } : null;
  const activeInputField = allFields.find((f) => !f.completed && f.type === 'input');

  function handleFieldSubmit(value: string) {
    const userMsg: ChatMsg = { role: 'user', content: value };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setStatus('thinking');
    void runAiLoop(newMsgs);
  }

  return (
    <Box flexDirection="column" height="100%">
      <Card borderColor="cyan" padding={1} marginBottom={1}>
        <CardHeader icon="⚙" title={t('setup.title', projectName)} titleColor="cyan" />
      </Card>

      <Box flexDirection="column" flexGrow={1} marginBottom={1}>
        {messages.filter((m) => m.role !== 'system').slice(-12).map((m, i) => (
          <Box key={i} marginBottom={0}>
            <Text bold color={m.role === 'user' ? 'green' : m.role === 'tool' ? 'yellow' : 'white'}>
              {m.role === 'user' ? ` ${t('setup.you')} ` : m.role === 'tool' ? ` ${t('setup.tool')} ` : ` ${t('setup.ai')} `}
            </Text>
            <Text wrap="wrap">{formatMsgContent(m)}</Text>
          </Box>
        ))}
      </Box>

      {interactiveField && status === 'idle' && (
        <InteractiveFormField field={interactiveField as any} onSubmitMessage={handleFieldSubmit} />
      )}

      {status === 'idle' && !interactiveField && (
        <Box flexDirection="column">
          <Box>
            <Text bold color="cyan">{t('setup.prompt')}</Text>
            <Text> {input}▎</Text>
          </Box>
          <Text dimColor>  {(activeInputField || allFields.length === 0) ? t('setup.enterHint') : t('setup.enterHint')}</Text>
        </Box>
      )}

      {status === 'thinking' && (
        <Box>
          <Text bold color="yellow">{t('setup.thinking')}</Text>
        </Box>
      )}

      {status === 'done' && (
        <Card borderColor="green" padding={1}>
          <Text bold color="green">{t('setup.done')}</Text>
        </Card>
      )}

      {error && (
        <Card borderColor="red" padding={0}>
          <Text color="red">✗ {error}</Text>
        </Card>
      )}
    </Box>
  );
}

function formatMsgContent(m: ChatMsg): string {
  if (m.content) return m.content as string;
  if (m.tool_calls) {
    return `[${m.tool_calls.map((tc) => `${tc.function.name}()`).join(', ')}]`;
  }
  if (m.role === 'tool') {
    try {
      const d = JSON.parse(m.content as string);
      return d.success ? '✓ done' : `✗ ${d.error || ''}`;
    } catch { return (m.content as string || '').slice(0, 80); }
  }
  return '';
}
