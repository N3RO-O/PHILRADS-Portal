import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Imported first so the install prompt is captured before React mounts.
import './lib/installPrompt';
import { envProblems } from './config/env';
import App from './App';
import { startErrorSound } from './lib/errorSound';
import { startNotificationSound } from './lib/notificationSound';
import { installPressRipple } from './lib/ripple';
import { startTheme } from './lib/theme';
import './index.css';

if (envProblems.length) console.warn('[config]', envProblems.join('\n'));
startErrorSound();
startNotificationSound();
installPressRipple();
startTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
