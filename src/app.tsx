import React, { useEffect, useState } from 'react';
import { Text, Box } from 'ink';
import { TerminalSizeProvider } from './components/responsive.js';
import { FullScreen } from './components/fullscreen.js';
import { MainMenu, MenuPage } from './components/main-menu.js';
import { ChatView } from './components/chat-view.js';
import { ProviderPage } from './components/provider-page.js';
import { CreateProject } from './components/create-project.js';
import { SettingsPanel } from './components/settings-panel.js';
import { SkillPanel } from './components/skill-panel.js';
import { loadSkills } from './skills/loader.js';
import { getModels } from './models/cache.js';
import { getSkillRegistry } from './skills/registry.js';
import { getMCPServerManager } from './mcp/mcp-client.js';
import { refreshMCPTools } from './tools/mcp-tools.js';
import { ThemeProvider } from './components/ui/theme-provider.js';
import { getConfig } from './utils/config.js';


interface Props {
  options?: {
    skill?: string;
    model?: string;
    message?: string;
  };
}

function AppContent({ options, page, setPage }: Props & { page: MenuPage; setPage: (p: MenuPage) => void }) {
  const [skills] = useState(getSkillRegistry().getAll());

  const handleNavigate = (p: MenuPage) => {
    if (p === 'exit') process.exit(0);
    setPage(p);
  };

  if (options?.message) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Running with message: {options.message}</Text>
      </Box>
    );
  }

  switch (page) {
    case 'chat':
      return <ChatView onBack={() => setPage('main')} />;
    case 'provider':
      return <ProviderPage onBack={() => setPage('main')} />;
    case 'project':
      return <CreateProject onBack={() => setPage('main')} onCreated={(path) => { process.chdir(path); setPage('chat'); }} />;
    case 'skills':
      return (
        <FullScreen justifyContent="center">
          <SkillPanel skills={skills} onSelect={() => setPage('main')} onClose={() => setPage('main')} />
        </FullScreen>
      );
    case 'settings':
      return <SettingsPanel onBack={() => setPage('main')} />;
    case 'main':
    default:
      return <MainMenu onNavigate={handleNavigate} />;
  }
}

export function App({ options }: Props) {
  const [page, setPage] = useState<MenuPage>('main');

  useEffect(() => {
    const init = async () => {
      loadSkills();
      getModels().catch(() => {});
      const mcp = getMCPServerManager();
      mcp.loadConfigs();
      await mcp.connectAll();
      refreshMCPTools();

      
    };
    init();
  }, []);

  return (
    <TerminalSizeProvider>
      <ThemeProvider>
        <AppContent options={options} page={page} setPage={setPage} />
      </ThemeProvider>
    </TerminalSizeProvider>
  );
}
