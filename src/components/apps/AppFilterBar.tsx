import React, { FC, RefObject } from 'react';
import Select, { ISelectOption } from '../ui/Select.tsx';
import { SortKey } from '../../helpers/app-stats.ts';

interface IProps {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    sortKey: SortKey;
    onSortChange: (key: SortKey) => void;
    sortOptions: ISelectOption<SortKey>[];
    searchRef: RefObject<HTMLInputElement>;
}

const AppFilterBar: FC<IProps> = ({ searchQuery, onSearchChange, sortKey, onSortChange, sortOptions, searchRef }) => (
    <div className="flex items-center gap-3">
        <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm pointer-events-none">⌕</span>
            <input
                ref={searchRef}
                type="text"
                placeholder="Search apps…"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="w-full bg-[#282828] border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white/80 placeholder-white/25 outline-none focus:border-purple-500/50 focus:bg-[#2e2e2e] transition-all"
            />
            {searchQuery && (
                <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                    ✕
                </button>
            )}
        </div>
        <div className="w-36 shrink-0">
            <Select<SortKey>
                value={sortKey}
                options={sortOptions}
                onChange={onSortChange}
            />
        </div>
    </div>
);

export default AppFilterBar;
