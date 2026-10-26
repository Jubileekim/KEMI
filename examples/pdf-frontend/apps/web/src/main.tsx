import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/index.css';
import './styles/product.css';

const root = document.getElementById('root');
if (!root) throw new Error('KEMI root element is missing');

async function start() {
  if (import.meta.env.DEV && import.meta.env.VITE_ENABLE_MOCKS === 'true') {
    const { worker } = await import('./mocks/browser');
    await worker.start();
  }
  createRoot(root!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
void start().catch(() => {
  root.textContent =
    '개발 Mock 시작에 실패했어요. 설정을 확인하고 새로고침해 주세요.';
});
