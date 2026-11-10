import { useState, useRef, useCallback } from 'react';
import { persistEntries, recoverPending } from '../lib/persistence.js';

export function useLocalStorage(key, initialValue) {
    const [initial] = useState(() => {
        try {
            recoverPending(window.localStorage);
            const raw = window.localStorage.getItem(key);
            return { value: raw === null ? initialValue : JSON.parse(raw), error: null, raw };
        } catch {
            return { value: initialValue, error: '保存データを読み出せません。原本を保護するため更新を停止しています。' };
        }
    });
    const [storedValue, setStoredValue] = useState(initial.value);
    const [error, setError] = useState(initial.error);
    const current = useRef(storedValue);
    const expectedRaw = useRef(initial.raw);
    const setValue = useCallback((value, relatedEntries = {}) => {
        if (initial.error) return { success: false, error: initial.error };
        try {
            recoverPending(window.localStorage);
            if (window.localStorage.getItem(key) !== expectedRaw.current) {
                setError('別の画面で保存データが更新されています。上書きを停止しました。入力を退避して再読み込みしてください。');
                return { success: false, error: '別の画面でデータが更新されたため、保存を停止しました。入力を退避してください。' };
            }
            const next = typeof value === 'function' ? value(current.current) : value;
            persistEntries({ ...relatedEntries, [key]: JSON.stringify(next) });
            expectedRaw.current = JSON.stringify(next);
            current.current = next;
            setStoredValue(next);
            setError(null);
            return { success: true };
        } catch (cause) {
            const message = `保存に失敗しました（${cause.name || 'Error'}）。入力を保持しています。再試行または未保存データを退避してください。`;
            setError(message);
            return { success: false, error: message };
        }
    }, [key, initial.error]);
    return [storedValue, setValue, error];
}
