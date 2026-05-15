import { FaFilePdf } from "react-icons/fa6";

type PdfFileIconProps = {
    size?: number;
    className?: string;
};

export function PdfFileIcon({ size = 28, className }: PdfFileIconProps) {
    return <FaFilePdf aria-hidden="true" size={size} className={className} />;
}
