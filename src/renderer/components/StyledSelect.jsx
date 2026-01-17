import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './StyledSelect.css';

export default function StyledSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  groupBy = null,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  // Find the selected option
  const selectedOption = options.find(opt => opt.value === value);

  // Filter options by search term
  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.description && opt.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group options if groupBy is provided
  const groupedOptions = groupBy
    ? filteredOptions.reduce((acc, opt) => {
        const group = opt[groupBy] || 'Other';
        if (!acc[group]) acc[group] = [];
        acc[group].push(opt);
        return acc;
      }, {})
    : { '': filteredOptions };

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      const clickedContainer = containerRef.current && containerRef.current.contains(e.target);
      const clickedDropdown = dropdownRef.current && dropdownRef.current.contains(e.target);

      if (!clickedContainer && !clickedDropdown) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setSearchTerm('');
    }
  };

  const handleSelect = (option) => {
    onChange(option.value);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  // Render dropdown via portal to avoid clipping by parent overflow
  const renderDropdown = () => {
    if (!isOpen) return null;

    const dropdown = (
      <div
        ref={dropdownRef}
        className="styled-select-dropdown styled-select-dropdown-portal"
        style={{
          position: 'fixed',
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width,
          zIndex: 10000
        }}
      >
        {options.length > 5 && (
          <div className="styled-select-search">
            <input
              ref={searchRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search..."
            />
          </div>
        )}

        <div className="styled-select-options">
          {Object.entries(groupedOptions).map(([group, groupOptions]) => (
            <div key={group || 'default'} className="styled-select-group">
              {group && <div className="styled-select-group-label">{group}</div>}
              {groupOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`styled-select-option ${option.value === value ? 'selected' : ''}`}
                  onClick={() => handleSelect(option)}
                >
                  <span className="option-label">{option.label}</span>
                  {option.description && (
                    <span className="option-description">{option.description}</span>
                  )}
                </button>
              ))}
            </div>
          ))}

          {filteredOptions.length === 0 && (
            <div className="styled-select-empty">No options found</div>
          )}
        </div>
      </div>
    );

    return createPortal(dropdown, document.body);
  };

  return (
    <div className={`styled-select ${className} ${isOpen ? 'open' : ''}`} ref={containerRef}>
      <button
        type="button"
        className="styled-select-trigger"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
      >
        <span className="styled-select-value">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className="styled-select-arrow"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <polyline points="6 9 12 15 18 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {renderDropdown()}
    </div>
  );
}
