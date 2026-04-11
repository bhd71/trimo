import React, { FC } from 'react';
import { Base64Image } from '../../../helpers/image-convert.tsx';

interface IProps {
    logoBase64: string;
    appName: string;
    onClose: () => void;
}

const ModalHeader: FC<IProps> = ({ logoBase64, appName, onClose }) => (
    <div className="flex items-center gap-3">
        <Base64Image base64Data={logoBase64} />
        <span className="text-lg font-bold text-white flex-1">{appName}</span>
        <button
            onClick={onClose}
            className="text-white/30 hover:text-white/80 transition-colors text-xl leading-none"
            aria-label="Close"
        >
            ✕
        </button>
    </div>
);

export default ModalHeader;
