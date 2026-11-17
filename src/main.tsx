import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useStore } from './store';
import './styles.css';

// 개발 중 콘솔에서 상태를 확인·조작하기 위한 훅 (배포 빌드에는 포함되지 않음)
if (import.meta.env.DEV) (window as unknown as { __store: typeof useStore }).__store = useStore;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
