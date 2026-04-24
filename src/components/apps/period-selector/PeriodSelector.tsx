import React, { FC } from 'react';
import { Period } from '../../../store/appStore.ts';

export { Period };

const PERIODS: { value: Period; label: string }[] = [
    { value: Period.Today,     label: 'Today' },
    { value: Period.Yesterday, label: 'Yesterday' },
    { value: Period.Week,      label: 'This Week' },
    { value: Period.Month,     label: 'This Month' },
];

interface IProps {
    value: Period;
    onChange: (period: Period) => void;
}

const PeriodSelector: FC<IProps> = ({ value, onChange }) => {
    return (
        <div className="flex gap-2">
            {PERIODS.map(({ value: p, label }) => {
                const isActive = value === p;
                return (
                    <button
                        key={p}
                        onClick={() => onChange(p)}
                        style={isActive ? { boxShadow: '0 0 12px rgba(147,51,234,0.8), 0 0 28px rgba(147,51,234,0.4)' } : undefined}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                            isActive
                                ? 'bg-neutral-700 border-white/15 text-white shadow-sm'
                                : 'bg-neutral-800 border-white/5 text-white/50 shadow-sm hover:shadow-md hover:border-white/15 hover:bg-neutral-700 hover:text-white/80'
                        }`}
                    >
                        {label}
                    </button>
                );
            })}
        </div>
    );
};

export default PeriodSelector;
