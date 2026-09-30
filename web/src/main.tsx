import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/pages.css';
import './styles/v3.css';
import { App } from './App';
import { loadServerCatalog } from './lib/catalog';

if (!__MOCK_MODE__ && __API_ORIGIN__) await loadServerCatalog(__API_ORIGIN__);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
