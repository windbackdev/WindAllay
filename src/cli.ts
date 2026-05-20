import { Command } from 'commander';
import { getConfig, setConfig } from './utils/config.js';
import { loadSkills } from './skills/loader.js';


export function setupCLI(): Command {
  const program = new Command();

  program
    .name('windallay')
    .description('WindAllay - AI Agent CLI powered by Ink')
    .version('0.1.0');

  // Interactive chat mode (default)
  program
    .command('chat', { isDefault: true })
    .description('Start interactive chat session')
    .option('-m, --model <name>', 'Model to use')
    .option('-s, --skill <name>', 'Skill to load')
    .option('-q, --quiet', 'Reduce output verbosity')
    .action((opts) => {
      if (opts.model) setConfig('model', opts.model);
      return { mode: 'chat', ...opts };
    });

  // One-shot message
  program
    .command('run')
    .description('Run a single message and exit')
    .argument('<message>', 'Message to send')
    .option('-m, --model <name>', 'Model to use')
    .action((message, opts) => {
      if (opts.model) setConfig('model', opts.model);
      return { mode: 'run', message, ...opts };
    });

  // List models
  program
    .command('models')
    .description('List available models')
    .action(async () => {
      const { getModels } = await import('./models/cache.js');
      try {
        const models = await getModels(true);
        console.log(`\n  Available models (${models.length}):\n`);
        for (const m of models.slice(0, 30)) {
          console.log(`    ${m.id}`);
        }
        if (models.length > 30) {
          console.log(`    ... and ${models.length - 30} more`);
        }
      } catch (err: any) {
        console.error(`  Failed to fetch models: ${err.message}`);
      }
      process.exit(0);
    });

  // List skills
  program
    .command('skills')
    .description('List and manage skills')
    .option('-l, --list', 'List available skills')
    .option('-c, --create <name>', 'Create a new skill')
    .action(async (opts) => {
      if (opts.create) {
        const { createSkill } = await import('./skills/loader.js');
        createSkill(opts.create, `Instructions for ${opts.create}`);
        console.log(`  Created skill: ${opts.create}`);
      } else {
        const skills = loadSkills();
        if (skills.length === 0) {
          console.log('  No skills found. Use --create to make one.');
        } else {
          console.log(`\n  Available skills (${skills.length}):\n`);
          for (const s of skills) {
            console.log(`    ${s.name}: ${s.description}`);
          }
        }
      }
      process.exit(0);
    });

  // Init / config
  program
    .command('init')
    .description('Initialize WindAllay configuration')
    .option('--api-base <url>', 'API base URL')
    .option('--api-key <key>', 'API key')
    .option('--model <name>', 'Default model')
    .action((opts) => {
      if (opts.apiBase) setConfig('apiBase', opts.apiBase);
      if (opts.apiKey) setConfig('apiKey', opts.apiKey);
      if (opts.model) setConfig('model', opts.model);
      const config = getConfig();
      console.log('\n  WindAllay configuration:\n');
      console.log(`    API Base: ${config.apiBase}`);
      console.log(`    Model:    ${config.model}`);
      console.log(`    API Key:  ${config.apiKey ? '****' : '(not set)'}`);
      console.log(`    Context:  ${config.contextLimit} tokens`);
      console.log(`    Memory:   ${config.memoryEnabled ? 'enabled' : 'disabled'}`);
      process.exit(0);
    });

  // Config command
  program
    .command('config')
    .description('View or set configuration')
    .option('-g, --get <key>', 'Get a config value')
    .option('-s, --set <key>', 'Set a config key')
    .option('-v, --value <value>', 'Value to set')
    .action((opts) => {
      if (opts.get && opts.set) {
        setConfig(opts.set as any, opts.value);
        console.log(`  Set ${opts.set} = ${opts.value}`);
      } else if (opts.get) {
        const config = getConfig();
        console.log(`  ${opts.get}: ${(config as any)[opts.get]}`);
      } else {
        const config = getConfig();
        for (const [k, v] of Object.entries(config)) {
          const display = k === 'apiKey' && v ? '****' : v;
          console.log(`  ${k}: ${display}`);
        }
      }
      process.exit(0);
    });

  return program;
}
