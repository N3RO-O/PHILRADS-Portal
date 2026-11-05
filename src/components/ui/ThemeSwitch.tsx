import { MonitorSmartphone, Moon, Sun } from 'lucide-react';
import { setTheme, useTheme } from '../../lib/theme';
import { ChoiceSwitch } from './ChoiceSwitch';

const OPTIONS = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'Auto', icon: MonitorSmartphone },
] as const;

/** Dark, Light, or Auto (follows the device). Saved on this device straight away. */
export function ThemeSwitch({ size = 'md', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const theme = useTheme();
  return <ChoiceSwitch label="Light or dark" value={theme} onChange={setTheme} options={OPTIONS} size={size} className={className} />;
}
