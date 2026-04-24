import React, { FC } from 'react';
import { AppLogo } from '../../../helpers/image-convert.tsx';

interface IProps {
    appName: string;
    onClose: () => void;
}

const ModalHeader: FC<IProps> = ({ appName, onClose }) => (
    <div className="flex items-center gap-3">
        <AppLogo appName={appName} />
        <span className="text-lg font-bold text-white flex-1">{appName}</span>
        <button
            onClick={onClose}
            className="p-1.5 rounded-md text-white/40 hover:text-white/70 hover:bg-white/[0.08] transition-all duration-150 leading-none"
            aria-label="Close"
        >
            ✕
        </button>
    </div>
);

export default ModalHeader;
