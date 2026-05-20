import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export interface ProjectFile {
  path: string;
  content: string;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  files: ProjectFile[];
  gitignore?: string[];
}

function tmpl(content: string): string {
  return content;
}

const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'empty',
    name: 'Empty Directory',
    description: 'Just create the folder',
    files: [],
    gitignore: ['node_modules/', 'dist/'],
  },
  {
    id: 'node-js',
    name: 'Node.js + JavaScript',
    description: 'Simple Node.js project',
    files: [
      {
        path: 'package.json',
        content: tmpl(`{\n  "name": "{{name}}",\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "start": "node index.js"\n  }\n}\n`),
      },
      {
        path: 'index.js',
        content: 'console.log("Hello, WindAllay!");\n',
      },
    ],
    gitignore: ['node_modules/'],
  },
  {
    id: 'node-ts',
    name: 'Node.js + TypeScript',
    description: 'Modern Node project with TypeScript',
    files: [
      {
        path: 'package.json',
        content: tmpl(`{\n  "name": "{{name}}",\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "tsx src/index.ts",\n    "build": "tsc",\n    "start": "node dist/index.js"\n  }\n}\n`),
      },
      {
        path: 'tsconfig.json',
        content: '{\n  "compilerOptions": {\n    "target": "ESNext",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "strict": true,\n    "outDir": "dist",\n    "rootDir": "src"\n  },\n  "include": ["src"]\n}\n',
      },
      {
        path: 'src/index.ts',
        content: 'console.log("Hello, WindAllay!");\n',
      },
    ],
    gitignore: ['node_modules/', 'dist/'],
  },
  {
    id: 'python',
    name: 'Python',
    description: 'Python project with venv and requirements',
    files: [
      {
        path: 'requirements.txt',
        content: '# dependencies\n',
      },
      {
        path: 'main.py',
        content: 'def main():\n    print("Hello, WindAllay!")\n\n\nif __name__ == "__main__":\n    main()\n',
      },
      {
        path: '.python-version',
        content: '3.12\n',
      },
    ],
    gitignore: ['__pycache__/', 'venv/', '.venv/', '*.pyc'],
  },
  {
    id: 'rust',
    name: 'Rust',
    description: 'Rust project with Cargo',
    files: [
      {
        path: 'Cargo.toml',
        content: tmpl(`[package]\nname = "{{name}}"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n`),
      },
      {
        path: 'src/main.rs',
        content: 'fn main() {\n    println!("Hello, WindAllay!");\n}\n',
      },
    ],
    gitignore: ['target/'],
  },
  {
    id: 'web',
    name: 'HTML + CSS + JS',
    description: 'Static web project',
    files: [
      {
        path: 'index.html',
        content: tmpl(`<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{name}}</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>{{name}}</h1>\n  <script src="script.js"></script>\n</body>\n</html>\n`),
      },
      {
        path: 'style.css',
        content: '* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: sans-serif; padding: 2rem; }\n',
      },
      {
        path: 'script.js',
        content: 'console.log("Hello, WindAllay!");\n',
      },
    ],
  },
  {
    id: 'react-ts',
    name: 'React + TypeScript',
    description: 'React project with TypeScript (Vite-like)',
    files: [
      {
        path: 'package.json',
        content: tmpl(`{\n  "name": "{{name}}",\n  "version": "0.1.0",\n  "type": "module",\n  "scripts": {\n    "dev": "vite",\n    "build": "tsc && vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^19.0.0",\n    "react-dom": "^19.0.0"\n  },\n  "devDependencies": {\n    "@types/react": "^19.0.0",\n    "@types/react-dom": "^19.0.0",\n    "typescript": "^5.8.0",\n    "vite": "^6.0.0",\n    "@vitejs/plugin-react": "^4.0.0"\n  }\n}\n`),
      },
      {
        path: 'tsconfig.json',
        content: '{\n  "compilerOptions": {\n    "target": "ESNext",\n    "module": "ESNext",\n    "moduleResolution": "bundler",\n    "strict": true,\n    "jsx": "react-jsx",\n    "outDir": "dist",\n    "rootDir": "src"\n  },\n  "include": ["src"]\n}\n',
      },
      {
        path: 'vite.config.ts',
        content: 'import { defineConfig } from "vite";\nimport react from "@vitejs/plugin-react";\n\nexport default defineConfig({\n  plugins: [react()],\n});\n',
      },
      {
        path: 'index.html',
        content: tmpl(`<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>{{name}}</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`),
      },
      {
        path: 'src/main.tsx',
        content: 'import React from "react";\nimport ReactDOM from "react-dom/client";\n\nfunction App() {\n  return <h1>Hello, WindAllay!</h1>;\n}\n\nReactDOM.createRoot(document.getElementById("root")!).render(<App />);\n',
      },
    ],
    gitignore: ['node_modules/', 'dist/'],
  },
];

function replaceVars(content: string, name: string): string {
  return content.replace(/\{\{name\}\}/g, name);
}

export function getBuiltinTemplates(): ProjectTemplate[] {
  return BUILTIN_TEMPLATES;
}

export function loadUserTemplates(configDir: string): ProjectTemplate[] {
  const configPath = join(configDir, 'project-templates.json');
  if (!existsSync(configPath)) return [];

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const data = JSON.parse(raw);
    const templates = Array.isArray(data) ? data : data.templates;
    if (!Array.isArray(templates)) return [];
    return templates.map((t: any) => ({
      id: t.id,
      name: t.name || t.id,
      description: t.description || '',
      files: Array.isArray(t.files) ? t.files.map((f: any) => ({
        path: f.path,
        content: typeof f.content === 'string' ? f.content : JSON.stringify(f.content, null, 2),
      })) : [],
      gitignore: t.gitignore,
    }));
  } catch {
    return [];
  }
}

export function getAllTemplates(configDir: string): ProjectTemplate[] {
  const builtin = getBuiltinTemplates();
  const user = loadUserTemplates(configDir);
  const userIds = new Set(user.map((t) => t.id));
  return [...builtin.filter((t) => !userIds.has(t.id)), ...user];
}

export function createProjectFromTemplate(
  basePath: string,
  template: ProjectTemplate,
  projectName: string,
): void {
  mkdirSync(basePath, { recursive: true });

  for (const file of template.files) {
    const parts = file.path.split('/');
    if (parts.length > 1) {
      mkdirSync(join(basePath, ...parts.slice(0, -1)), { recursive: true });
    }
    const content = replaceVars(file.content, projectName);
    writeFileSync(join(basePath, file.path), content, 'utf-8');
  }

  const gitignorePatterns = [...(template.gitignore || ['dist/', '.env'])].join('\n') + '\n';
  writeFileSync(join(basePath, '.gitignore'), gitignorePatterns, 'utf-8');
}
