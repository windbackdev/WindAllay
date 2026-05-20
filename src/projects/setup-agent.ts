import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildToolDef, type ToolFunction } from '../tools/builtins.js';
import type { ToolHandler } from '../tools/registry.js';
import { getAllTemplates, createProjectFromTemplate } from './template.js';

export interface SetupField {
  name: string;
  label: string;
  type: 'input' | 'checkbox' | 'switch';
  value: string | boolean | string[];
  completed: boolean;
}

interface PendingFile {
  path: string;
  content: string;
}

interface SessionData {
  projectName: string;
  languageName: string;
  languageId: string;
  providerName: string;
  providerApiBase: string;
  providerApiKey: string;
  model: string;
  fields: SetupField[];
  files: PendingFile[];
  finalized: boolean;
  createdPath: string;
}

let session: SessionData | null = null;

export function initSetup(
  name: string,
  langName: string,
  langId: string,
  prov: { name: string; apiBase: string; apiKey: string },
  model: string,
): void {
  session = {
    projectName: name,
    languageName: langName,
    languageId: langId,
    providerName: prov.name,
    providerApiBase: prov.apiBase,
    providerApiKey: prov.apiKey,
    model,
    fields: [],
    files: [],
    finalized: false,
    createdPath: '',
  };
}

export function getSession(): SessionData | null {
  return session;
}

export function addField(name: string, label: string, type: 'input' | 'checkbox' | 'switch'): void {
  if (!session) return;
  if (session.fields.some((f) => f.name === name)) return;
  session.fields.push({
    name,
    label,
    type,
    value: type === 'switch' ? false : type === 'checkbox' ? [] : '',
    completed: false,
  });
}

export function setFieldValue(name: string, value: string | boolean | string[]): void {
  if (!session) return;
  const f = session.fields.find((f) => f.name === name);
  if (f) f.value = value;
  else session.fields.push({ name, label: name, type: 'input', value, completed: false });
}

export function markField(name: string): boolean {
  if (!session) return false;
  const f = session.fields.find((f) => f.name === name);
  if (f) { f.completed = true; return true; }
  return false;
}

export function addPendingFile(path: string, content: string): void {
  if (!session) return;
  if (session.files.some((f) => f.path === path)) return;
  session.files.push({ path, content });
}

export function getStatusString(): string {
  if (!session) return 'No active session';
  const total = session.fields.length;
  const done = session.fields.filter((f) => f.completed).length;
  return `Fields: ${done}/${total} completed | Files: ${session.files.length} pending | Finalized: ${session.finalized}`;
}

export function finalizeProject(basePath: string): boolean {
  const s = session;
  if (!s) return false;
  const templates = getAllTemplates(process.cwd());
  const template = templates.find((t) => t.id === s.languageId) || templates[0];
  try {
    createProjectFromTemplate(basePath, template, s.projectName);
    for (const file of s.files) {
      const filePath = join(basePath, file.path);
      const dir = filePath.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
      if (dir) mkdirSync(dir, { recursive: true });
      writeFileSync(filePath, file.content, 'utf-8');
    }
    const setupDir = join(basePath, 'agent', 'setup');
    mkdirSync(setupDir, { recursive: true });
    writeFileSync(join(setupDir, 'project-spec.md'), generateSpec(), 'utf-8');
    s.finalized = true;
    s.createdPath = basePath;
    return true;
  } catch {
    return false;
  }
}

export function getCreatedPath(): string {
  return session?.createdPath || '';
}

export function clearSession(): void {
  session = null;
}

function generateSpec(): string {
  if (!session) return '';
  const lines: string[] = [
    `# ${session.projectName}`,
    '',
    `- **Language**: ${session.languageName}`,
    `- **Type**: ${session.languageId}`,
    `- **Created**: ${new Date().toISOString()}`,
    '',
    '## Requirements',
    '',
  ];
  for (const f of session.fields) {
    const v = typeof f.value === 'boolean' ? (f.value ? 'Yes' : 'No') : Array.isArray(f.value) ? f.value.join(', ') : f.value;
    lines.push(`- **${f.label}**: ${v}`);
  }
  lines.push('', '## Files', '');
  for (const f of session.files) {
    lines.push(`- \`${f.path}\``);
  }
  lines.push('');
  return lines.join('\n');
}

export const SETUP_TOOL_NAMES = [
  'project_setup_add_field',
  'project_setup_set_field',
  'project_setup_mark',
  'project_setup_add_file',
  'project_setup_status',
  'project_setup_finalize',
] as const;

export function getSetupToolDefs(): ToolFunction[] {
  return [
    buildToolDef(
      'project_setup_add_field',
      'Register a new form field for user input during project setup. Call this when you want to present a new question/option to the user.',
      {
        name: { type: 'string', description: 'Unique field identifier (e.g. "features", "port")' },
        label: { type: 'string', description: 'Human-readable label shown to the user' },
        type: { type: 'string', enum: ['input', 'checkbox', 'switch'], description: 'Field type: input=text, checkbox=multi-select, switch=yes-no' },
      },
      ['name', 'label', 'type'],
    ),
    buildToolDef(
      'project_setup_set_field',
      'Record a value for a form field. Call this when the user provides an answer.',
      {
        name: { type: 'string', description: 'Field identifier' },
        value: { description: 'Field value: string for input, boolean for switch, array of strings for checkbox' },
      },
      ['name', 'value'],
    ),
    buildToolDef(
      'project_setup_mark',
      'Mark a field as complete. Use this when the user signals they are done with a section (Shift+Enter) or when you decide the field is resolved.',
      {
        name: { type: 'string', description: 'Field identifier to mark complete' },
      },
      ['name'],
    ),
    buildToolDef(
      'project_setup_add_file',
      'Add a custom file to be created with the project. Use for additional config files, source files, etc.',
      {
        path: { type: 'string', description: 'File path relative to project root (e.g. "src/config.ts")' },
        content: { type: 'string', description: 'File content' },
      },
      ['path', 'content'],
    ),
    buildToolDef(
      'project_setup_status',
      'Get the current project setup status including fields and pending files.',
      {},
      [],
    ),
    buildToolDef(
      'project_setup_finalize',
      'Finalize the project setup and create the project. Call this when all configuration is complete and you are ready to create the project.',
      {},
      [],
    ),
  ];
}

export function getSetupToolHandlers(): Record<string, ToolHandler> {
  return {
    project_setup_add_field: async (args) => {
      if (!session) return JSON.stringify({ error: 'No active setup session' });
      addField(args.name as string, args.label as string, args.type as 'input' | 'checkbox' | 'switch');
      return JSON.stringify({ success: true, field: args.name });
    },
    project_setup_set_field: async (args) => {
      if (!session) return JSON.stringify({ error: 'No active setup session' });
      setFieldValue(args.name as string, args.value as any);
      return JSON.stringify({ success: true, field: args.name, value: args.value });
    },
    project_setup_mark: async (args) => {
      if (!session) return JSON.stringify({ error: 'No active setup session' });
      const ok = markField(args.name as string);
      return JSON.stringify({ success: ok, field: args.name });
    },
    project_setup_add_file: async (args) => {
      if (!session) return JSON.stringify({ error: 'No active setup session' });
      addPendingFile(args.path as string, args.content as string);
      return JSON.stringify({ success: true, path: args.path });
    },
    project_setup_status: async () => {
      return JSON.stringify({ session: session ? {
        projectName: session.projectName,
        language: session.languageName,
        fields: session.fields,
        files: session.files.map((f) => f.path),
        finalized: session.finalized,
      } : null });
    },
    project_setup_finalize: async (_args, ctx) => {
      if (!session) return JSON.stringify({ error: 'No active setup session' });
      const basePath = resolve(ctx.cwd, session.projectName);
      const ok = finalizeProject(basePath);
      if (!ok) return JSON.stringify({ error: 'Failed to create project' });
      return JSON.stringify({ success: true, path: basePath });
    },
  };
}

export function registerSetupTools(registry: { register: (name: string, handler: ToolHandler, def: ToolFunction, source: string) => void }): void {
  const handlers = getSetupToolHandlers();
  const defs = getSetupToolDefs();
  for (const def of defs) {
    const handler = handlers[def.name];
    if (handler) {
      registry.register(def.name, handler, def, 'custom');
    }
  }
}

export function unregisterSetupTools(registry: { remove: (name: string) => boolean }): void {
  for (const name of SETUP_TOOL_NAMES) {
    registry.remove(name);
  }
}
