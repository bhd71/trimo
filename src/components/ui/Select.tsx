import React, { useEffect, useRef, useState } from 'react';

export interface ISelectOption<T extends string = string> {
    value: T;
    label: string;
}

interface IProps<T extends string> {
    value: T;
    options: ISelectOption<T>[];
    onChange: (value: T) => void;
}

function Select<T extends string>({ value, options, onChange }: IProps<T>) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const selected = options.find(o => o.value === value);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative inline-block">
            <button
                onClick={() => setOpen(o => !o)}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border ${
                    open
                        ? 'bg-[#282828] text-white border-white/20'
                        : 'bg-[#282828] text-white/70 border-white/10 hover:bg-[#2e2e2e] hover:text-white hover:border-white/20'
                }`}
            >
                <span>{selected?.label}</span>
                <svg
                    className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <path d="M2 4l4 4 4-4" />
                </svg>
            </button>

            {open && (
                <div className="absolute top-full left-0 mt-2 min-w-full rounded-xl border border-white/10 bg-[#282828] shadow-2xl z-50 overflow-hidden py-1">
                    {options.map(opt => {
                        const isActive = opt.value === value;
                        return (
                            <button
                                key={opt.value}
                                onClick={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors duration-150 ${
                                    isActive
                                        ? 'bg-purple-600/20 text-purple-300'
                                        : 'text-white/60 hover:bg-white/8 hover:text-white'
                                }`}
                            >
                                {opt.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default Select;
