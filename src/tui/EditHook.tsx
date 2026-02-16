import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';
import { TextInput } from './TextInput.js';

interface Props {
  width: number;
  onSubmit: (name: string, prompt: string, checkFn: string) => void;
  onCancel: () => void;
  initialName?: string;
  initialPrompt?: string;
  initialCheckFn?: string;
  title?: string;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'name',
  2: 'prompt',
  3: 'check function',
};

export function EditHook({ width, onSubmit, onCancel, initialName, initialPrompt, initialCheckFn, title }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(initialName ?? '');
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const [checkFn, setCheckFn] = useState(initialCheckFn ?? '');
  const [error, setError] = useState('');
  const heading = title ?? 'edit hook';

  const handleSubmitStep1 = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setName(trimmed);
    setError('');
    setStep(2);
  }, []);

  const handleSubmitStep2 = useCallback((val: string) => {
    const trimmed = val.trim();
    if (!trimmed) return;
    setPrompt(trimmed);
    setError('');
    setStep(3);
  }, []);

  const handleSubmitStep3 = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed) return;
      try {
        new Function('ctx', trimmed);
        onSubmit(name, prompt, trimmed);
      } catch (err) {
        setError(`invalid JS: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
    [name, prompt, onSubmit],
  );

  const handleEscape = useCallback(() => {
    setError('');
    if (step === 1) {
      onCancel();
    } else if (step === 2) {
      setStep(1);
    } else {
      setStep(2);
    }
  }, [step, onCancel]);

  const handleNameChange = useCallback(
    (val: string) => {
      setName(val);
      if (error) setError('');
    },
    [error],
  );

  const handlePromptChange = useCallback(
    (val: string) => {
      setPrompt(val);
      if (error) setError('');
    },
    [error],
  );

  const handleCheckFnChange = useCallback(
    (val: string) => {
      setCheckFn(val);
      if (error) setError('');
    },
    [error],
  );

  const formWidth = Math.min(50, width - 4);

  return (
    <Box flexDirection="column" width={formWidth}>
      <Box borderStyle="round" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text dimColor>
          {heading} — step {step}/3 — {STEP_LABELS[step]}
        </Text>
        <Box marginTop={0}>
          {step === 1 && (
            <TextInput
              value={name}
              onChange={handleNameChange}
              onSubmit={handleSubmitStep1}
              onEscape={handleEscape}
              focus={true}
              placeholder="hook name"
            />
          )}
          {step === 2 && (
            <TextInput
              value={prompt}
              onChange={handlePromptChange}
              onSubmit={handleSubmitStep2}
              onEscape={handleEscape}
              focus={true}
              placeholder="task instructions"
            />
          )}
          {step === 3 && (
            <TextInput
              value={checkFn}
              onChange={handleCheckFnChange}
              onSubmit={handleSubmitStep3}
              onEscape={handleEscape}
              focus={true}
              placeholder="JS function body (use ctx.git, ctx.state, etc.)"
            />
          )}
        </Box>
        {error && <Text color="red">{error}</Text>}
      </Box>
    </Box>
  );
}
