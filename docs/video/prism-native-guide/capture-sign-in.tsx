import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { SignInPage } from '../../../src/pages/SignInPage';
import { AuthProvider } from '../../../src/components/auth/AuthProvider';
import '../../../src/index.css';

createRoot(document.getElementById('root')!).render(
  <AuthProvider><BrowserRouter><SignInPage /></BrowserRouter></AuthProvider>,
);
