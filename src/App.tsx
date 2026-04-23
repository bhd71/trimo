import './App.css';
import AppsList from './components/apps/AppsList.tsx';
import { useEffect, useRef } from 'react';
import DashboardLayout from './components/dashboard/DashboardLayout.tsx';
import { useAppStore } from './store/appStore.ts';
import { useSettingsStore } from './store/settingsStore.ts';

function App() {
    const cleanupRef = useRef<(() => void) | undefined>(undefined);
    const initializedRef = useRef(false);

    useEffect(() => {
        // Guard against React StrictMode double-invocation
        if (initializedRef.current) return;
        initializedRef.current = true;

        useAppStore.getState().initListeners()
            .then(fn => { cleanupRef.current = fn; })
            .catch(err => console.error('[App] initListeners failed:', err));

        useSettingsStore.getState().loadPreferences()
            .catch(err => console.error('[App] loadPreferences failed:', err));

        return () => {
            cleanupRef.current?.();
            cleanupRef.current = undefined;
            // Do NOT reset initializedRef here — StrictMode calls cleanup then re-runs
            // the effect, and resetting would let the second invocation slip through the
            // guard before the first async initListeners resolves, creating duplicate listeners.
        };
    }, []);

    return (
        <DashboardLayout>
            <AppsList />
        </DashboardLayout>
    );
}

export default App;
