import { Command } from 'commander';
import YAML from 'yaml';
import { getConfigValue, loadConfig, setConfigValue } from '@/core/config.js';
import { cliAction } from './helpers.js';

export const configCommand = new Command('config').description('Manage configuration');

configCommand
  .command('show')
  .description('Show current configuration')
  .action(
    cliAction(() => {
      const config = loadConfig();
      console.log(YAML.stringify(config));
    }),
  );

configCommand
  .command('get')
  .description('Get a configuration value')
  .argument('<key>', 'Config key (dot notation supported)')
  .action(
    cliAction((key: string) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.error(`Config key "${key}" not found.`);
        process.exit(1);
      }
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    }),
  );

configCommand
  .command('set')
  .description('Set a configuration value')
  .argument('<key>', 'Config key')
  .argument('<value>', 'Config value')
  .action(
    cliAction((key: string, value: string) => {
      const parsed =
        value === 'true'
          ? true
          : value === 'false'
            ? false
            : !Number.isNaN(Number(value)) && value.trim() !== ''
              ? Number(value)
              : value;
      setConfigValue(key, parsed);
      console.log(`Set ${key} = ${String(parsed)}`);
    }),
  );
