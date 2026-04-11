export function formatSeconds(s: number): string {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

/** Short tick label for a Y-axis measured in seconds ("2h", "30m", "45s"). */
export function yAxisTick(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h`;
    if (m > 0) return `${m}m`;
    return `${seconds}s`;
}

/** Format a "YYYY-MM-DD" date string to a short locale label ("Jan 5"). */
export function formatDateLabel(dateStr: string): string {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
}
