import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import { t } from '../utils/i18n.js';
import type { FormField } from '../projects/chat-tools.js';
import { setFormField, markFormField } from '../projects/chat-tools.js';

interface Props {
  field: FormField;
  onSubmitMessage: (message: string) => void;
}

export function InteractiveFormField({ field, onSubmitMessage }: Props) {
  if (field.type === 'checkbox') {
    return <CheckboxField field={field} onSubmitMessage={onSubmitMessage} />;
  }
  if (field.type === 'select') {
    return <SelectField field={field} onSubmitMessage={onSubmitMessage} />;
  }
  return null;
}

function CheckboxField({ field, onSubmitMessage }: Props) {
  const [cursor, setCursor] = useState(0);
  const [toggles, setToggles] = useState<boolean[]>(() => Array.from({ length: field.options.length }).fill(false) as boolean[]);

  useInput((_input, key) => {
    if (key.upArrow) setCursor((i) => (i > 0 ? i - 1 : field.options.length - 1));
    if (key.downArrow) setCursor((i) => (i < field.options.length - 1 ? i + 1 : 0));
    if (key.return) {
      const selected = field.options.filter((_, i) => toggles[i]);
      setFormField(field.name, selected);
      markFormField(field.name);
      onSubmitMessage(selected.join(', ') || '(none)');
    }
    if (_input === ' ') {
      setToggles((prev) => {
        const next = [...prev];
        next[cursor] = !next[cursor];
        return next;
      });
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold>{field.label}</Text>
      </Box>
      {field.options.map((opt, i) => (
        <Box key={i} marginBottom={0}>
          <Text bold color={cursor === i ? 'cyan' : 'gray'}>
            {cursor === i ? '› ' : '  '}
            [{toggles[i] ? '✓' : ' '}]
          </Text>
          <Text color={cursor === i ? 'white' : 'gray'}> {opt}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>{'  '}{t('nav.upDown')} • Space toggle • Enter confirm</Text>
      </Box>
    </Box>
  );
}

function SelectField({ field, onSubmitMessage }: Props) {
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) setCursor((i) => (i > 0 ? i - 1 : field.options.length - 1));
    if (key.downArrow) setCursor((i) => (i < field.options.length - 1 ? i + 1 : 0));
    if (key.return) {
      const value = field.options[cursor];
      setFormField(field.name, value);
      markFormField(field.name);
      onSubmitMessage(value);
    }
  });

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold>{field.label}</Text>
      </Box>
      {field.options.map((opt, i) => (
        <Box key={i} marginBottom={0}>
          <Text bold color={cursor === i ? 'cyan' : 'gray'}>
            {cursor === i ? '● ' : '○ '}
          </Text>
          <Text color={cursor === i ? 'white' : 'gray'}>{opt}</Text>
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>  ↑↓ navigate • Enter select</Text>
      </Box>
    </Box>
  );
}
