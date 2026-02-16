import { Cron } from 'croner';
import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';
import { translateCron } from '@/core/claude.js';
import { errorMessage } from '@/core/errors.js';
import { TextInput } from './TextInput.js';

interface Props {
  width: number;
  onSubmit: (name: string, prompt: string, cron: string) => void;
  onCancel: () => void;
  initialName?: string;
  initialPrompt?: string;
  initialCron?: string;
  title?: string;
}

type Step = 1 | 2 | 3;

const STEP_LABELS: Record<Step, string> = {
  1: 'name',
  2: 'prompt',
  3: 'schedule',
};

export function EditSchedule({ width, onSubmit, onCancel, initialName, initialPrompt, initialCron, title }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState(initialName ?? '');
  const [prompt, setPrompt] = useState(initialPrompt ?? '');
  const [cronExpr, setCronExpr] = useState(initialCron ?? '');
  const [error, setError] = useState('');
  const [translating, setTranslating] = useState(false);
  const heading = title ?? 'edit schedule';

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

  const looksLikeNaturalLanguage = useCallback((val: string) => {
    return /[a-zA-Z]/.test(
      val.replace(/[jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|sun|mon|tue|wed|thu|fri|sat]/gi, ''),
    );
  }, []);

  const handleSubmitStep3 = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!trimmed || translating) return;
      try {
        new Cron(trimmed);
        onSubmit(name, prompt, trimmed);
      } catch (err) {
        if (looksLikeNaturalLanguage(trimmed)) {
          setError('');
          setTranslating(true);
          translateCron(trimmed)
            .then((cron) => {
              setCronExpr(cron);
              setTranslating(false);
            })
            .catch((e) => {
              setError(`translation failed: ${errorMessage(e)}`);
              setTranslating(false);
            });
        } else {
          setError(`invalid cron: ${errorMessage(err)}`);
        }
      }
    },
    [name, prompt, onSubmit, translating, looksLikeNaturalLanguage],
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

  const handleCronChange = useCallback(
    (val: string) => {
      setCronExpr(val);
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
              placeholder="schedule name"
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
              value={cronExpr}
              onChange={handleCronChange}
              onSubmit={handleSubmitStep3}
              onEscape={handleEscape}
              focus={true}
              placeholder="every weekday at 9am"
            />
          )}
        </Box>
        {error && <Text color="red">{error}</Text>}
        {translating && <Text color="yellow">translating…</Text>}
      </Box>
    </Box>
  );
}
