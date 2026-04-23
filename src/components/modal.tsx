"use client";

import { useEffect, useRef, type ReactNode } from "react";

type ModalSize = "sm" | "md" | "lg";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: ModalSize;
  children?: ReactNode;
  footer?: ReactNode;
  closeOnBackdrop?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
  closeOnBackdrop = true,
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    function handleClose() {
      onClose();
    }
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (!closeOnBackdrop) return;
    if (e.target === e.currentTarget) {
      ref.current?.close();
    }
  }

  return (
    <dialog
      ref={ref}
      onClick={handleBackdropClick}
      aria-labelledby="modal-title"
      aria-describedby={description ? "modal-description" : undefined}
      className="fixed inset-0 m-auto w-full p-4"
    >
      <div
        data-modal-panel
        className={`relative mx-auto bg-surface-raised border border-border rounded-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] w-full ${sizeClasses[size]} max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden`}
      >
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-lg font-semibold truncate">
              {title}
            </h2>
            {description && (
              <p id="modal-description" className="text-muted text-sm mt-1">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="shrink-0 -mr-2 -mt-1 p-2 text-muted hover:text-foreground hover:bg-surface-hover rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {children && (
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        )}

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 px-6 py-4 border-t border-border bg-surface/40">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

type ConfirmTone = "danger" | "success" | "brand" | "warning";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  loading?: boolean;
}

const toneButtonClasses: Record<ConfirmTone, string> = {
  danger:
    "bg-error hover:bg-error/80 text-white",
  success:
    "bg-success hover:bg-success/80 text-background",
  brand:
    "bg-accent hover:bg-accent-hover text-background",
  warning:
    "bg-warning hover:bg-warning/80 text-background",
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "brand",
  loading = false,
}: ConfirmDialogProps) {
  async function handleConfirm() {
    await onConfirm();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-border-strong hover:bg-surface-hover disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${toneButtonClasses[tone]}`}
          >
            {loading ? "Working..." : confirmLabel}
          </button>
        </>
      }
    />
  );
}
