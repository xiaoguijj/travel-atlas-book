import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { activeTheme, applyThemeToDocument } from './config/theme';
import './styles/global.css';

// 先把主题写成 CSS 变量再渲染，避免第一帧出现没有颜色的页面
applyThemeToDocument(activeTheme);

const container = document.getElementById('root');
if (!container) throw new Error('找不到 #root 挂载点');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
