import React from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import bootstrapMainWindow from '../bootstrap/mainWindow';
import router from './router';

document.body.dataset.window = 'main';

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element not found');
}

const root = createRoot(container);

bootstrapMainWindow().then(() => {
    root.render(
        <React.StrictMode>
            <RouterProvider router={router} />
        </React.StrictMode>,
    );
});
