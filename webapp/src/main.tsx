import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PublicAdminSession } from './components/PublicAdminSession';
import { registerServiceWorker } from './lib/pwa';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(<PublicAdminSession><App /></PublicAdminSession>);
registerServiceWorker();
