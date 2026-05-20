import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { Skill } from '../skills/registry.js';
import { t } from '../utils/i18n.js';
import { Card, CardHeader, CardDivider } from './card.js';

interface Props {
  skills: Skill[];
  activeSkill?: string;
  onSelect: (name: string | undefined) => void;
  onClose: () => void;
}

export function SkillPanel({ skills, activeSkill, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) setSelectedIndex((i) => Math.max(0, i - 1));
    else if (key.downArrow) setSelectedIndex((i) => Math.min(skills.length, i + 1));
    else if (key.return) onSelect(selectedIndex === 0 ? undefined : skills[selectedIndex - 1]?.name);
    else if (key.escape || _input === 'q') onClose();
  });

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Card borderColor="yellow" padding={1} marginBottom={1}>
        <CardHeader icon="🧩" title={t('skills.title')} titleColor="yellow" />
      </Card>

      <Card borderColor={selectedIndex === 0 ? 'cyan' : 'gray'} selected={selectedIndex === 0} padding={1} marginBottom={0}>
        <Text bold color={selectedIndex === 0 ? 'white' : 'gray'}>
          {selectedIndex === 0 ? '❯ ' : '  '}○ {t('skills.none')}
        </Text>
      </Card>

      {skills.map((skill, i) => {
        const sel = selectedIndex === i + 1;
        const isActive = activeSkill === skill.name;
        return (
          <Card key={skill.name} borderColor={sel ? 'cyan' : 'gray'} selected={sel} padding={1} marginBottom={0}>
            <Box>
              <Box flexGrow={1}>
                <Text bold color={sel ? 'white' : 'gray'}>
                  {sel ? '❯ ' : '  '}{isActive ? '●' : '○'} {skill.name}
                </Text>
                <Text dimColor> — {skill.description}</Text>
              </Box>
              {isActive && <Text color="green">{t('providerManager.defaultLabel')}</Text>}
            </Box>
          </Card>
        );
      })}

      <CardDivider />

      <Card borderColor="gray" padding={1}>
        <Text dimColor>  {t('skills.close')}</Text>
      </Card>
    </Box>
  );
}
