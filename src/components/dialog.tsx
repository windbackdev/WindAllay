import React, { useState } from 'react';
import { Text, Box } from 'ink';
import { useInput } from 'ink';
import TextInput from 'ink-text-input';
import { t } from '../utils/i18n.js';

interface Props {
  title: string;
  initialValue?: string;
  isSecret?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  width?: number;
}

export function Dialog({ title, initialValue = '', isSecret, onConfirm, onCancel, width = 50 }: Props) {
  const [value, setValue] = useState(initialValue);

  useInput((_input, key) => {
    if (key.escape) onCancel();
  });

  return (
    <Box
      borderStyle="round"
      borderColor="cyan"
      padding={1}
      width={width}
      flexDirection="column"
    >
      <Text bold color="cyan">  {title}</Text>

      <Box marginY={1} paddingX={1}>
        <Text color="white">{'>'} </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={onConfirm}
          placeholder="input value..."
          mask={isSecret ? '•' : undefined}
        />
      </Box>

      <Box>
        <Text dimColor>  Enter {t('dialog.confirm')} • ESC {t('dialog.cancel')}</Text>
      </Box>
    </Box>
  );
}
