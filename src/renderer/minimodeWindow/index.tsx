import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import bootstrapAuxiliaryWindow from '../bootstrap/auxiliaryWindow';
import App from './App';

document.body.dataset.window = 'minimode';

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element not found');
}

const root = createRoot(container);

bootstrapAuxiliaryWindow().then(() => {
    root.render(
        <StrictMode>
            <App />
        </StrictMode>,
    );
});
