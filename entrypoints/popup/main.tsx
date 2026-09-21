import { createRoot } from 'react-dom/client';
import { Popup } from '../../components/Popup';
import '../../assets/app.css';
import { initTheme } from '../../lib/theme';

initTheme();
createRoot(document.getElementById('root')!).render(<Popup />);
