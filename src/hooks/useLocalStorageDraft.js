import { useEffect, useState } from 'react';

const DRAFT_KEY_PREFIX = 'geomonitor_draft_';

/**
 * Remove todos os drafts do localStorage (chamado no logout).
 */
export function clearAllDrafts() {
    try {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && k.startsWith(DRAFT_KEY_PREFIX)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
        // Ignored
    }
}

/**
 * Persist state locally to avoid losing data when closing the tab/modal accidentally.
 *
 * @param {string} key Unique key for the draft in localStorage
 * @param {any} initialData The initial or definitive remote state
 * @returns {[any, Function, Function]} [formData, setFormData, clearDraft]
 */
export function useLocalStorageDraft(key, initialData) {
    const prefixedKey = `${DRAFT_KEY_PREFIX}${key}`;
    const [data, setData] = useState(() => {
        try {
            const stored = localStorage.getItem(prefixedKey);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch {
            // Ignored
        }
        return initialData;
    });

    useEffect(() => {
        try {
            localStorage.setItem(prefixedKey, JSON.stringify(data));
        } catch {
            // Ignored
        }
    }, [prefixedKey, data]);

    const clearDraft = () => {
        try {
            localStorage.removeItem(prefixedKey);
        } catch {
            // Ignored
        }
    };

    return [data, setData, clearDraft];
}
