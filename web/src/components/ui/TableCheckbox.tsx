import React, { useRef, useEffect } from 'react';

export interface TableCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  title?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const TableCheckbox: React.FC<TableCheckboxProps> = ({
  checked,
  indeterminate = false,
  onChange,
  title,
  disabled = false,
  className = '',
  id,
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      <input
        ref={checkboxRef}
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        title={title}
        onChange={onChange}
        className={`w-4 h-4 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500/30 focus:ring-offset-0 focus:ring-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed accent-emerald-500 ${className}`}
      />
    </div>
  );
};
