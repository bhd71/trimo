import React, { FC } from 'react';

interface IProps {
    label: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
    ariaLabel: string;
}

const ToggleRow: FC<IProps> = ({ label, description, checked, onToggle, ariaLabel }) => (
    <div className="flex items-center justify-between">
        <div className="flex flex-col">
            <span className="text-xs text-white/60">{label}</span>
            <span className="text-xs text-white/25 mt-0.5">{description}</span>
        </div>
        <button
            onClick={onToggle}
            className={`relative w-11 h-6 rounded-full overflow-hidden transition-colors duration-200 ${
                checked ? 'bg-purple-600' : 'bg-white/10'
            }`}
            aria-label={ariaLabel}
        >
            <span
                className={`absolute top-1 left-0 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                    checked ? 'translate-x-6' : 'translate-x-1'
                }`}
            />
        </button>
    </div>
);

export default ToggleRow;
