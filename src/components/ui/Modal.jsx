import { useEffect } from 'react';
import AppIcon from '../AppIcon';
import Button from './Button';

/**
 * Modal padronizado.
 *
 * Props:
 *   open       — controla visibilidade
 *   onClose    — callback ao fechar
 *   title      — título do modal
 *   subtitle   — subtítulo opcional (linha menor abaixo do título)
 *   icon       — nome de ícone opcional; renderiza um tile + header surface-muted
 *   size       — 'sm' | 'md' | 'lg' | 'xl'  (padrão: 'md')
 *   children   — conteúdo
 *   footer     — slot para botões de ação (ReactNode)
 */
const SIZE_CLASSES = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-7xl',
};

export default function Modal({
    open,
    onClose,
    title,
    subtitle,
    icon,
    size = 'md',
    children,
    footer,
}) {
    // Fecha com Escape
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-850/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onPointerDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
        >
            <div
                className={[
                    'relative w-full bg-white rounded-2xl shadow-modal',
                    'flex flex-col max-h-[90vh]',
                    SIZE_CLASSES[size] ?? SIZE_CLASSES.md,
                ].join(' ')}
            >
                {/* Header */}
                {(title || subtitle || onClose) && (
                    <div
                        className={[
                            'flex items-center gap-3 px-5 py-3.5 border-b border-slate-200 rounded-t-2xl',
                            icon ? 'bg-app-surfaceMuted' : '',
                        ].filter(Boolean).join(' ')}
                    >
                        {icon && (
                            <span
                                className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-50 border border-brand-200 text-brand-600 shrink-0"
                                aria-hidden="true"
                            >
                                <AppIcon name={icon} className="w-[18px] h-[18px]" />
                            </span>
                        )}
                        {(title || subtitle) && (
                            <div className="min-w-0 flex-1">
                                {title && (
                                    <h2 className="text-md font-bold text-slate-800 m-0 truncate">{title}</h2>
                                )}
                                {subtitle && (
                                    <p className="text-xs text-slate-500 m-0 truncate">{subtitle}</p>
                                )}
                            </div>
                        )}
                        {onClose && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                aria-label="Fechar"
                                className="ml-auto"
                            >
                                <AppIcon name="close" />
                            </Button>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-slate-200">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
}
