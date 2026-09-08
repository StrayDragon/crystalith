import { ThemeProvider as MTThemeProvider } from '@material-tailwind/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'streamdown/styles.css';

import './tailwind.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <MTThemeProvider>
      <App />
    </MTThemeProvider>
  </StrictMode>,
);
