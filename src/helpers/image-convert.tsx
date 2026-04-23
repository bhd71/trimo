import React, { useEffect, useState, ReactElement } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function base64ToBlob(base64: string, mime = 'image/png'): Blob {
    const byteCharacters = atob(base64);
    const byteArrays: number[] = new Array(byteCharacters.length);

    for (let i = 0; i < byteCharacters.length; i++) {
        byteArrays[i] = byteCharacters.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteArrays);
    return new Blob([byteArray], { type: mime });
}

interface Base64ImageProps {
    base64Data: string; // Must be raw base64, without "data:image/*;base64,"
    mimeType?: string;  // Optional override for mime type
}

export function Base64Image({ base64Data, mimeType = 'image/png' }: Base64ImageProps): ReactElement | null {
    const [url, setUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!base64Data) return;

        const blob = base64ToBlob(base64Data, mimeType);
        const objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);

        return () => {
            URL.revokeObjectURL(objectUrl);
        };
    }, [base64Data, mimeType]);

    return url ? <img className='object-contain w-[48px] h-[48px]' src={url} alt="Converted" /> : null;
}

// Module-level logo cache — persists for the lifetime of the app session
const logoCache = new Map<string, string>();

export function useLogo(appName: string): string | null {
    const [logo, setLogo] = useState<string | null>(logoCache.get(appName) ?? null);

    useEffect(() => {
        if (!appName || logoCache.has(appName)) return;
        invoke<string | null>('get_app_logo', { appName }).then(data => {
            if (data) {
                logoCache.set(appName, data);
                setLogo(data);
            }
        });
    }, [appName]);

    return logo;
}

export function AppLogo({ appName }: { appName: string }): ReactElement {
    const logo = useLogo(appName);
    return logo
        ? <Base64Image base64Data={logo} />
        : <div className="w-[48px] h-[48px] rounded-lg bg-white/5 shrink-0" />;
}
