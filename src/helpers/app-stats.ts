import { IApp } from '../types/App.interface.ts';

export type SortKey = 'duration_desc' | 'duration_asc' | 'name_asc' | 'name_desc' | 'pct_change';

/**
 * Returns a formatted percentage-change string ("+12%" / "-5%") or null when
 * the change is zero or yesterday's duration is unavailable.
 */
export function pctChange(today: number, yesterday: number): string | null {
    if (yesterday === 0) return null;
    const pct = Math.round(((today - yesterday) / yesterday) * 100);
    if (pct === 0) return null;
    return pct > 0 ? `+${pct}%` : `${pct}%`;
}

/** Returns a sorted copy of `apps` according to `key`. */
export function sortApps(apps: IApp[], key: SortKey, yesterdayMap: Map<string, number>): IApp[] {
    const copy = [...apps];
    switch (key) {
        case 'duration_asc':  return copy.sort((a, b) => a.duration - b.duration);
        case 'name_asc':      return copy.sort((a, b) => a.app_name.localeCompare(b.app_name));
        case 'name_desc':     return copy.sort((a, b) => b.app_name.localeCompare(a.app_name));
        case 'pct_change': {
            return copy.sort((a, b) => {
                const ya = yesterdayMap.get(a.app_name) ?? 0;
                const yb = yesterdayMap.get(b.app_name) ?? 0;
                const pa = ya > 0 ? (a.duration - ya) / ya : 0;
                const pb = yb > 0 ? (b.duration - yb) / yb : 0;
                return pb - pa;
            });
        }
        default: return copy.sort((a, b) => b.duration - a.duration);
    }
}
