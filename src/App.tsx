import { invoke } from '@tauri-apps/api/core';
import './App.css';
import AppsList from './components/apps/AppsList.tsx';
import { useEffect, useState } from 'react';
import DashboardLayout from './components/dashboard/DashboardLayout.tsx';
import { AppDataProvider } from './store/AppDataContext.tsx';

function App() {
    const [monitoring, setMonitoring] = useState(false);

    // Sync with backend — monitoring auto-starts on app launch
    useEffect(() => {
        invoke<boolean>('get_monitoring_status').then(active => {
            setMonitoring(active);
        });
    }, []);

    async function toggleMonitoring() {
        setMonitoring(prev => !prev);
        await invoke('toggle_monitoring');
    }

    return (
        <AppDataProvider>
            <DashboardLayout
                isMonitoring={monitoring}
                onToggle={toggleMonitoring}
            >
                <AppsList />
            </DashboardLayout>
        </AppDataProvider>
    );
}

export default App;
