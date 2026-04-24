"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/modal";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, localeLabels, type Locale } from "@/lib/i18n/config";
import { useLocale, useTranslate } from "@/lib/i18n/provider";

export function LanguagePickerModal() {
  const currentLocale = useLocale();
  const t = useTranslate();
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<Locale>(currentLocale);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      await setLocale(selected);
      setOpen(false);
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title={t("languagePicker.title")}
      description={t("languagePicker.description")}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={false}
      footer={
        <button
          type="button"
          onClick={handleConfirm}
          disabled={pending}
          className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-background text-sm font-semibold rounded-lg transition-colors"
        >
          {pending ? t("common.saving") : t("languagePicker.continue")}
        </button>
      }
    >
      <div className="space-y-2">
        {LOCALES.map((loc) => {
          const isSelected = selected === loc;
          return (
            <label
              key={loc}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                isSelected
                  ? "border-accent bg-accent-muted"
                  : "border-border hover:bg-surface-hover"
              }`}
            >
              <input
                type="radio"
                name="locale"
                value={loc}
                checked={isSelected}
                onChange={() => setSelected(loc)}
                className="accent-accent"
              />
              <span className="font-medium">{localeLabels[loc]}</span>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
