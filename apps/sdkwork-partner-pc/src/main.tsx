import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

function AppShell() {
  return (
    <main style={{ padding: 32 }}>
      <h1>SDKWork Partner PC</h1>
      <p>多级合作伙伴（代理商）管理体系 — 管理端页面由宿主应用（sdkwork-cloudrouter）装配。</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
);
