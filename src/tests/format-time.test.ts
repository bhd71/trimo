import { describe, it, expect } from 'vitest';
import { formatSeconds, yAxisTick, formatDateLabel } from '../helpers/format-time.ts';

describe('formatSeconds', () => {
    it('shows seconds only when under a minute', () => {
        expect(formatSeconds(0)).toBe('0s');
        expect(formatSeconds(45)).toBe('45s');
        expect(formatSeconds(59)).toBe('59s');
    });

    it('shows minutes and seconds when under an hour', () => {
        expect(formatSeconds(60)).toBe('1m 0s');
        expect(formatSeconds(90)).toBe('1m 30s');
        expect(formatSeconds(3599)).toBe('59m 59s');
    });

    it('shows hours and minutes (drops seconds) when over an hour', () => {
        expect(formatSeconds(3600)).toBe('1h 0m');
        expect(formatSeconds(3661)).toBe('1h 1m');
        expect(formatSeconds(7384)).toBe('2h 3m');
    });
});

describe('yAxisTick', () => {
    it('returns seconds label under a minute', () => {
        expect(yAxisTick(0)).toBe('0s');
        expect(yAxisTick(30)).toBe('30s');
    });

    it('returns minutes label under an hour', () => {
        expect(yAxisTick(60)).toBe('1m');
        expect(yAxisTick(3599)).toBe('59m');
    });

    it('returns hours label at or over an hour', () => {
        expect(yAxisTick(3600)).toBe('1h');
        expect(yAxisTick(7200)).toBe('2h');
    });
});

describe('formatDateLabel', () => {
    it('formats a YYYY-MM-DD string to short locale label', () => {
        const result = formatDateLabel('2024-01-05');
        expect(result).toMatch(/Jan/);
        expect(result).toMatch(/5/);
    });

    it('formats month and day correctly', () => {
        const result = formatDateLabel('2024-12-25');
        expect(result).toMatch(/Dec/);
        expect(result).toMatch(/25/);
    });
});
