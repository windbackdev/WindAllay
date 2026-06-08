import { Text } from 'ink';
import React from 'react';
import { useTheme } from './theme-provider.js';
import { useAnimation } from '../../hooks/use-animation.js';

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export interface SpinnerProps {
  type?: 'dots' | 'line' | 'dots2';
  label?: string;
  color?: string;
}

export const Spinner = ({ type = 'dots', label, color }: SpinnerProps) => {
  const theme = useTheme();
  const frame = useAnimation(12);

  let frames: string[];
  switch (type) {
    case 'dots2': frames = ['◴', '◷', '◶', '◵']; break;
    case 'line': frames = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█', '▇', '▆', '▅', '▄', '▃', '▂', '▁']; break;
    default: frames = SPINNER_FRAMES;
  }

  const icon = frames[frame % frames.length];
  const resolvedColor = color ?? theme.colors.primary;

  return React.createElement(Text, null,
    React.createElement(Text, { color: resolvedColor }, icon),
    label ? React.createElement(Text, null, ' ' + label) : null
  );
};
