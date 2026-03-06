import { useEffect, useState } from 'react';

/**
 * Persist state locally to avoid losing data when closing the tab/modal accidentally.
 *
 * @param {string} key Unique key for the draft in localStorage
 * @param {any} initialData The initial or definitive remote state
 * @returns {[any, Function, Function]} [formData, setFormData, clearDraft]
 */
export function useLocalStorageDraft(key, initialData) {
    const [data, setData] = useState(() => {
        try {
            const stored = localStorage.getItem(key);
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
            localStorage.setItem(key, JSON.stringify(data));
        } catch {
            // Ignored
        }
    }, [key, data]);

    const clearDraft = () => {
        try {
            localStorage.removeItem(key);
        } catch {
            // Ignored
        }
    };

    return [data, setData, clearDraft];
}
