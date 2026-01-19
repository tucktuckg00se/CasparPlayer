import React, { useState, useRef, useEffect } from 'react';
import { createDefaultOffset } from '../utils/timecode';
import './OffsetTimecodeInput.css';

/**
 * OffsetTimecodeInput component for HH:MM:SS:FF offset entry with +/- toggle
 * Works with offset objects: { hours, minutes, seconds, frames, negative }
 */
export default function OffsetTimecodeInput({
  value,           // Offset object { hours, minutes, seconds, frames, negative }
  onChange,        // Callback with new offset object
  frameRate = 25,
  allowNegative = true,
  disabled = false,
  compact = false
}) {
  // Initialize from value or create default
  const getInitialTimecode = (offset) => {
    if (!offset) {
      return { hours: '00', minutes: '00', seconds: '00', frames: '00' };
    }
    return {
      hours: (offset.hours || 0).toString().padStart(2, '0'),
      minutes: (offset.minutes || 0).toString().padStart(2, '0'),
      seconds: (offset.seconds || 0).toString().padStart(2, '0'),
      frames: (offset.frames || 0).toString().padStart(2, '0')
    };
  };

  const [timecode, setTimecode] = useState(getInitialTimecode(value));
  const [isNegative, setIsNegative] = useState(value?.negative || false);

  const hoursRef = useRef(null);
  const minutesRef = useRef(null);
  const secondsRef = useRef(null);
  const framesRef = useRef(null);

  // Sync internal state when value prop changes
  useEffect(() => {
    setTimecode(getInitialTimecode(value));
    setIsNegative(value?.negative || false);
  }, [value]);

  // Validate and clamp field values
  const validateField = (field, val) => {
    const num = parseInt(val) || 0;
    switch (field) {
      case 'hours':
        return Math.max(0, Math.min(99, num));
      case 'minutes':
      case 'seconds':
        return Math.max(0, Math.min(59, num));
      case 'frames':
        return Math.max(0, Math.min(Math.floor(frameRate) - 1, num));
      default:
        return num;
    }
  };

  // Emit change to parent
  const emitChange = (newTimecode, negative) => {
    const offset = {
      hours: parseInt(newTimecode.hours) || 0,
      minutes: parseInt(newTimecode.minutes) || 0,
      seconds: parseInt(newTimecode.seconds) || 0,
      frames: parseInt(newTimecode.frames) || 0,
      negative
    };
    onChange(offset);
  };

  // Handle field change
  const handleFieldChange = (field, inputValue) => {
    const newTimecode = { ...timecode, [field]: inputValue };
    setTimecode(newTimecode);
  };

  // Handle blur - validate and emit change
  const handleBlur = (field) => {
    const validated = validateField(field, timecode[field]);
    const newTimecode = {
      ...timecode,
      [field]: validated.toString().padStart(2, '0')
    };
    setTimecode(newTimecode);
    emitChange(newTimecode, isNegative);
  };

  // Handle key navigation
  const handleKeyDown = (e, field) => {
    const refs = {
      hours: { prev: null, next: minutesRef },
      minutes: { prev: hoursRef, next: secondsRef },
      seconds: { prev: minutesRef, next: framesRef },
      frames: { prev: secondsRef, next: null }
    };

    if (e.key === ':' || (e.key === 'Tab' && !e.shiftKey)) {
      if (refs[field].next) {
        e.preventDefault();
        refs[field].next.current?.focus();
        refs[field].next.current?.select();
      }
    } else if (e.key === 'Tab' && e.shiftKey) {
      if (refs[field].prev) {
        e.preventDefault();
        refs[field].prev.current?.focus();
        refs[field].prev.current?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseInt(timecode[field]) || 0;
      const max = field === 'frames' ? Math.floor(frameRate) - 1 : (field === 'hours' ? 99 : 59);
      const newVal = Math.min(max, current + 1);
      const newTimecode = { ...timecode, [field]: newVal.toString().padStart(2, '0') };
      setTimecode(newTimecode);
      emitChange(newTimecode, isNegative);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(timecode[field]) || 0;
      const newVal = Math.max(0, current - 1);
      const newTimecode = { ...timecode, [field]: newVal.toString().padStart(2, '0') };
      setTimecode(newTimecode);
      emitChange(newTimecode, isNegative);
    } else if (e.key === 'Enter') {
      handleBlur(field);
    }
  };

  // Auto-advance to next field when 2 digits entered
  const handleInput = (e, field) => {
    const val = e.target.value.replace(/\D/g, '').slice(-2);
    handleFieldChange(field, val);

    if (val.length === 2) {
      const refs = { hours: minutesRef, minutes: secondsRef, seconds: framesRef, frames: null };
      if (refs[field]) {
        setTimeout(() => {
          refs[field].current?.focus();
          refs[field].current?.select();
        }, 0);
      }
    }
  };

  // Toggle negative/positive
  const handleToggleNegative = () => {
    if (!allowNegative) return;
    const newNegative = !isNegative;
    setIsNegative(newNegative);
    emitChange(timecode, newNegative);
  };

  return (
    <div className={`offset-timecode-input ${disabled ? 'disabled' : ''} ${compact ? 'compact' : ''}`}>
      {allowNegative && (
        <button
          type="button"
          className={`offset-sign-toggle ${isNegative ? 'negative' : 'positive'}`}
          onClick={handleToggleNegative}
          disabled={disabled}
          title={isNegative ? 'Before trigger (negative offset)' : 'After trigger (positive offset)'}
        >
          {isNegative ? '-' : '+'}
        </button>
      )}
      <div className="offset-timecode-fields">
        <input
          ref={hoursRef}
          type="text"
          className="offset-timecode-field"
          value={timecode.hours}
          onChange={(e) => handleInput(e, 'hours')}
          onBlur={() => handleBlur('hours')}
          onKeyDown={(e) => handleKeyDown(e, 'hours')}
          onFocus={(e) => e.target.select()}
          placeholder="HH"
          disabled={disabled}
          maxLength={2}
        />
        <span className="offset-timecode-separator">:</span>
        <input
          ref={minutesRef}
          type="text"
          className="offset-timecode-field"
          value={timecode.minutes}
          onChange={(e) => handleInput(e, 'minutes')}
          onBlur={() => handleBlur('minutes')}
          onKeyDown={(e) => handleKeyDown(e, 'minutes')}
          onFocus={(e) => e.target.select()}
          placeholder="MM"
          disabled={disabled}
          maxLength={2}
        />
        <span className="offset-timecode-separator">:</span>
        <input
          ref={secondsRef}
          type="text"
          className="offset-timecode-field"
          value={timecode.seconds}
          onChange={(e) => handleInput(e, 'seconds')}
          onBlur={() => handleBlur('seconds')}
          onKeyDown={(e) => handleKeyDown(e, 'seconds')}
          onFocus={(e) => e.target.select()}
          placeholder="SS"
          disabled={disabled}
          maxLength={2}
        />
        <span className="offset-timecode-separator">:</span>
        <input
          ref={framesRef}
          type="text"
          className="offset-timecode-field"
          value={timecode.frames}
          onChange={(e) => handleInput(e, 'frames')}
          onBlur={() => handleBlur('frames')}
          onKeyDown={(e) => handleKeyDown(e, 'frames')}
          onFocus={(e) => e.target.select()}
          placeholder="FF"
          disabled={disabled}
          maxLength={2}
        />
      </div>
      {!compact && <span className="offset-timecode-fps">{frameRate}fps</span>}
    </div>
  );
}
