import { buildToolDef, type ToolFunction } from '../tools/builtins.js';
import type { ToolHandler } from '../tools/registry.js';

export interface FormField {
  name: string;
  label: string;
  type: 'input' | 'checkbox' | 'select';
  options: string[];
  value: string | boolean | string[];
  completed: boolean;
  autoTimeout: number;
}

export interface TodoItem {
  description: string;
  done: boolean;
}

let formFields: FormField[] = [];
let todoList: TodoItem[] = [];

export function resetFormFields(): void { formFields = []; }
export function getFormFields(): FormField[] { return formFields; }

export function addFormField(
  name: string, label: string, type: 'input' | 'checkbox' | 'select',
  options?: string[], autoTimeout = 0,
): boolean {
  if (formFields.some((f) => f.name === name)) return false;
  formFields.push({
    name, label, type,
    options: options || [],
    value: type === 'checkbox' ? [] : type === 'select' ? '' : '',
    completed: false,
    autoTimeout,
  });
  return true;
}

export function setFormField(name: string, value: string | boolean | string[]): boolean {
  const f = formFields.find((f) => f.name === name);
  if (!f) return false;
  f.value = value;
  return true;
}

export function markFormField(name: string): boolean {
  const f = formFields.find((f) => f.name === name);
  if (!f) return false;
  f.completed = true;
  return true;
}

export function getFormStatus(): string {
  if (formFields.length === 0) return 'No active form fields';
  return formFields.map((f) =>
    `${f.completed ? '✓' : '○'} ${f.label} = ${Array.isArray(f.value) ? f.value.join(', ') || '(none)' : String(f.value)}`
  ).join('\n');
}

export function getActiveFormFields(): FormField[] {
  return formFields.filter((f) => !f.completed);
}

export function getFormTimeoutFields(): FormField[] {
  return formFields.filter((f) => !f.completed && f.autoTimeout > 0);
}

export function resetAll(): void { formFields = []; todoList = []; }

export function getTodos(): TodoItem[] { return todoList; }

export function addTodo(description: string): number {
  todoList.push({ description, done: false });
  return todoList.length;
}

export function updateTodo(index: number, description: string): boolean {
  if (index < 0 || index >= todoList.length) return false;
  todoList[index].description = description;
  return true;
}

export function markTodo(index: number, done: boolean): boolean {
  if (index < 0 || index >= todoList.length) return false;
  todoList[index].done = done;
  return true;
}

export function deleteTodo(index: number): boolean {
  if (index < 0 || index >= todoList.length) return false;
  todoList.splice(index, 1);
  return true;
}

export const CHAT_TOOL_DEFS: ToolFunction[] = [
  buildToolDef(
    'form_add_field',
    'Create a new form field to collect user input. Use this to present questions, choices, or text inputs to the user during conversation.',
    {
      name: { type: 'string', description: 'Unique field identifier' },
      label: { type: 'string', description: 'Display label shown to the user' },
      type: { type: 'string', enum: ['input', 'checkbox', 'select'], description: 'input=free text, checkbox=multi-select, select=single choice from options' },
      options: { type: 'array', items: { type: 'string' }, description: 'Choices for checkbox or select types (AI should generate these)' },
      auto_timeout: { type: 'number', description: 'Seconds of user inactivity after which AI can auto-select' },
    },
    ['name', 'label', 'type'],
  ),
  buildToolDef(
    'form_set_field',
    'Record a value for a form field after the user provides an answer.',
    {
      name: { type: 'string', description: 'Field identifier' },
      value: { description: 'Value: string for input, boolean for select yes/no, array of strings for checkbox' },
    },
    ['name', 'value'],
  ),
  buildToolDef(
    'form_mark',
    'Mark a form field as complete. Call this when the user confirms a section is done (Shift+Enter) or you decide it is resolved.',
    {
      name: { type: 'string', description: 'Field identifier to mark complete' },
    },
    ['name'],
  ),
  buildToolDef(
    'form_status',
    'Get the current state of all form fields.',
    {}, [],
  ),
  buildToolDef(
    'form_clear',
    'Clear all form fields. Call this to reset the form state.',
    {}, [],
  ),
  buildToolDef(
    'todo_add',
    'Add a new task to the todo list.',
    {
      description: { type: 'string', description: 'Task description' },
    },
    ['description'],
  ),
  buildToolDef(
    'todo_update',
    'Update the description of an existing todo item by its 0-based index.',
    {
      index: { type: 'number', description: '0-based index of the todo item' },
      description: { type: 'string', description: 'New task description' },
    },
    ['index', 'description'],
  ),
  buildToolDef(
    'todo_mark',
    'Mark a todo item as done or not done.',
    {
      index: { type: 'number', description: '0-based index of the todo item' },
      done: { type: 'boolean', description: 'true = completed, false = not completed' },
    },
    ['index', 'done'],
  ),
  buildToolDef(
    'todo_delete',
    'Remove a todo item by its 0-based index.',
    {
      index: { type: 'number', description: '0-based index to delete' },
    },
    ['index'],
  ),
  buildToolDef(
    'todo_list',
    'List all current todo items with their completion status.',
    {}, [],
  ),
];

export const CHAT_TOOL_HANDLERS: Record<string, ToolHandler> = {
  form_add_field: async (args) => {
    const ok = addFormField(
      args.name as string,
      args.label as string,
      args.type as 'input' | 'checkbox' | 'select',
      args.options as string[] | undefined,
      (args.auto_timeout as number) || 0,
    );
    return JSON.stringify({ success: ok, field: args.name });
  },
  form_set_field: async (args) => {
    const ok = setFormField(args.name as string, args.value as any);
    return JSON.stringify({ success: ok, field: args.name, value: args.value });
  },
  form_mark: async (args) => {
    const ok = markFormField(args.name as string);
    return JSON.stringify({ success: ok, field: args.name });
  },
  form_status: async () => {
    return JSON.stringify({
      fields: formFields,
      count: formFields.length,
      active: getActiveFormFields().length,
    });
  },
  form_clear: async () => {
    resetFormFields();
    return JSON.stringify({ success: true });
  },
  todo_add: async (args) => {
    const count = addTodo(args.description as string);
    return JSON.stringify({ success: true, index: count - 1, total: count });
  },
  todo_update: async (args) => {
    const ok = updateTodo(args.index as number, args.description as string);
    return JSON.stringify({ success: ok });
  },
  todo_mark: async (args) => {
    const ok = markTodo(args.index as number, args.done as boolean);
    return JSON.stringify({ success: ok });
  },
  todo_delete: async (args) => {
    const ok = deleteTodo(args.index as number);
    return JSON.stringify({ success: ok });
  },
  todo_list: async () => {
    return JSON.stringify({
      todos: todoList.map((t, i) => ({ index: i, description: t.description, done: t.done })),
      count: todoList.length,
      completed: todoList.filter((t) => t.done).length,
    });
  },
};

export const CHAT_TOOL_NAMES = [
  'form_add_field', 'form_set_field', 'form_mark', 'form_status', 'form_clear',
  'todo_add', 'todo_update', 'todo_mark', 'todo_delete', 'todo_list',
];
