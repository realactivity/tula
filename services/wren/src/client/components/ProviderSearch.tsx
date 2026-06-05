import { useState, useEffect, useRef, type RefObject } from 'react';

interface Props {
  onSearch: (query: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  autoFocus?: boolean;
}

const DEBOUNCE_MS = 400;

export default function ProviderSearch({ onSearch, disabled, placeholder, inputRef, autoFocus = true }: Props) {
  const [value, setValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="provider-search">
      <input
        type="text"
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder || 'Search for your healthcare provider...'}
        disabled={disabled}
        className="provider-search-input"
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          className="provider-search-clear"
          onClick={() => setValue('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
