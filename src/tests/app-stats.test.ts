import { describe, it, expect } from 'vitest';
import { pctChange, sortApps, SortKey } from '../helpers/app-stats.ts';
import { IApp } from '../types/App.interface.ts';

function makeApp(app_name: string, duration: number): IApp {
    return { id: app_name, app_name, duration, formatted_duration: '' };
}

describe('pctChange', () => {
    it('returns null when yesterday is 0', () => {
        expect(pctChange(100, 0)).toBeNull();
    });

    it('returns null when change is exactly 0%', () => {
        expect(pctChange(100, 100)).toBeNull();
    });

    it('returns positive string with + prefix', () => {
        expect(pctChange(150, 100)).toBe('+50%');
    });

    it('returns negative string without + prefix', () => {
        expect(pctChange(50, 100)).toBe('-50%');
    });

    it('rounds to nearest integer', () => {
        expect(pctChange(133, 100)).toBe('+33%');
        expect(pctChange(67, 100)).toBe('-33%');
    });
});

describe('sortApps', () => {
    const apps = [
        makeApp('Chrome', 300),
        makeApp('Spotify', 100),
        makeApp('Discord', 200),
    ];
    const emptyMap = new Map<string, number>();

    it('duration_desc sorts highest first (default)', () => {
        const result = sortApps(apps, 'duration_desc', emptyMap);
        expect(result.map(a => a.app_name)).toEqual(['Chrome', 'Discord', 'Spotify']);
    });

    it('duration_asc sorts lowest first', () => {
        const result = sortApps(apps, 'duration_asc', emptyMap);
        expect(result.map(a => a.app_name)).toEqual(['Spotify', 'Discord', 'Chrome']);
    });

    it('name_asc sorts alphabetically A→Z', () => {
        const result = sortApps(apps, 'name_asc', emptyMap);
        expect(result.map(a => a.app_name)).toEqual(['Chrome', 'Discord', 'Spotify']);
    });

    it('name_desc sorts alphabetically Z→A', () => {
        const result = sortApps(apps, 'name_desc', emptyMap);
        expect(result.map(a => a.app_name)).toEqual(['Spotify', 'Discord', 'Chrome']);
    });

    it('pct_change sorts by highest growth first', () => {
        const yesterdayMap = new Map([
            ['Chrome', 100],   // +200%
            ['Spotify', 90],   // +11%
            ['Discord', 400],  // -50%
        ]);
        const result = sortApps(apps, 'pct_change', yesterdayMap);
        expect(result.map(a => a.app_name)).toEqual(['Chrome', 'Spotify', 'Discord']);
    });

    it('does not mutate the original array', () => {
        const original = [...apps];
        sortApps(apps, 'duration_asc', emptyMap);
        expect(apps).toEqual(original);
    });
});
