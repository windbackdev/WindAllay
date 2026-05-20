#!/usr/bin/env node

import React from 'react';
import { render } from 'ink';
import { setupCLI } from './cli.js';

async function main() {
  const program = setupCLI();

  try {
    const opts = program.parse(process.argv);
    const args = opts.args;
    const command = args[0];
    const isInteractive = !command || command === 'chat';

    if (isInteractive) {
      process.stdout.write('\u001B[2J\u001B[0;0f');
    }

    if (isInteractive) {
      const chatOpts = opts.opts();
      const { App } = await import('./app.js');
      render(React.createElement(App, {
        options: { model: chatOpts.model, skill: chatOpts.skill },
      }));
    } else if (command === 'run') {
      const runOpts = opts.opts();
      const { App } = await import('./app.js');
      render(React.createElement(App, {
        options: { message: args[1], model: runOpts.model },
      }));
    }
  } catch (err: any) {
    if (err.code !== 'commander.unknownCommand' && err.code !== 'commander.help') {
      console.error('Error:', err.message);
      process.exit(1);
    }
  }
}

main();
