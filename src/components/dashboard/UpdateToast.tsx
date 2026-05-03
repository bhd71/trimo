import React, { FC, useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const UpdateToast: FC = () => {
    const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
    const [installing, setInstalling] = useState(false);

    useEffect(() => {
        if (import.meta.env.DEV) return;
        check()
            .then(update => {
                if (update?.available) setUpdateAvailable(update.version);
            })
            .catch(() => {});
    }, []);

    const handleInstall = async () => {
        setInstalling(true);
        try {
            const update = await check();
            if (update?.available) {
                await update.downloadAndInstall();
                await relaunch();
            }
        } catch {
            setInstalling(false);
        }
    };

    if (!updateAvailable && !installing) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-neutral-800 border border-white/10 backdrop-blur-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
            {installing ? (
                <span className="text-sm text-white/60">Downloading update…</span>
            ) : (
                <>
                    <span className="text-lg">🔄</span>
                    <span className="text-sm text-white/80 font-medium">Update available</span>
                    <button
                        onClick={handleInstall}
                        className="ml-1 px-3 py-1 rounded-full text-xs font-medium bg-purple-600/20 text-purple-300 hover:bg-purple-600/40 hover:text-white transition-all"
                    >
                        Install &amp; Restart
                    </button>
                    <button
                        onClick={() => setUpdateAvailable(null)}
                        className="text-white/30 hover:text-white/70 transition-colors text-base leading-none"
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </>
            )}
        </div>
    );
};

export default UpdateToast;
