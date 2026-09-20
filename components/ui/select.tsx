import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export type SelectOption = {
  value: string;
  label: string;
};

export function CustomSelect({
  value,
  onChange,
  options,
  name,
  id,
  'aria-label': ariaLabel,
  className = '',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[] | string[];
  name?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { value: opt, label: opt } : opt,
  );

  const selectedIndex = normalizedOptions.findIndex((o) => o.value === value);
  const selectedOption =
    selectedIndex >= 0 ? normalizedOptions[selectedIndex] : normalizedOptions[0];

  const [highlightedIndex, setHighlightedIndex] = useState<number>(
    selectedIndex >= 0 ? selectedIndex : 0,
  );

  useEffect(() => {
    if (open) {
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [open, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const selectOption = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      triggerRef.current?.focus();
    },
    [onChange],
  );

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (
        event.key === 'ArrowDown' ||
        event.key === 'ArrowUp' ||
        event.key === 'Enter' ||
        event.key === ' '
      ) {
        event.preventDefault();
        setOpen(true);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % normalizedOptions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex(
        (prev) => (prev - 1 + normalizedOptions.length) % normalizedOptions.length,
      );
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (normalizedOptions[highlightedIndex]) {
        selectOption(normalizedOptions[highlightedIndex].value);
      }
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  // Scroll active option into view when navigating via keyboard
  useEffect(() => {
    if (open && listboxRef.current) {
      const optionElements = listboxRef.current.querySelectorAll('.custom-select-option');
      const activeEl = optionElements[highlightedIndex] as HTMLElement | undefined;
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, open]);

  return (
    <div
      className={`custom-select-container ${className}`}
      ref={containerRef}
      onKeyDown={handleKeyDown}
    >
      {/* Hidden native select for full browser accessibility & automated testing */}
      <select
        name={name}
        aria-label={ariaLabel}
        value={value}
        tabIndex={-1}
        className="sr-select"
        onChange={(e) => onChange(e.target.value)}
      >
        {normalizedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Styled custom trigger button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`custom-select-trigger ${open ? 'open' : ''}`}
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="custom-select-value">{selectedOption?.label}</span>
        <ChevronDown className={`custom-select-chevron ${open ? 'rotate' : ''}`} size={16} />
      </button>

      {/* High-tech Glassmorphism Dropdown Menu */}
      {open && (
        <div ref={listboxRef} className="custom-select-dropdown" role="listbox" tabIndex={-1}>
          {normalizedOptions.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightedIndex;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`custom-select-option ${isSelected ? 'selected' : ''} ${
                  isHighlighted ? 'highlighted' : ''
                }`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => selectOption(opt.value)}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={15} className="custom-select-check" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
