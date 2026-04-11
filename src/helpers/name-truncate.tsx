type TruncatedTextProps = {
    text: string;
    maxLength: number;
};

export function TruncatedText({ text, maxLength }: TruncatedTextProps) {
    const displayText =
        text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text;

    return <span title={text}>{displayText}</span>;
}