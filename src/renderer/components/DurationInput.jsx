import React, { useState, useRef, useEffect } from 'react';
import './TimecodeInput.css';

/**
 * DurationInput component for HH:MM:SS duration entry (for images)
 * Works directly in seconds - no frame rate needed
 */
export default function DurationInput({
  value, // Value in seconds
  onChange, // Callback with new seconds value
  disabled = false
}) {
  // Convert seconds to time components
  const secondsToTime = (secs) => {
    if (!secs || secs <= 0) {
      return { hours: '00', minutes: '00', seconds: '00' };
    }
    const totalSeconds = Math.floor(secs);
    const s = totalSeconds % 60;
    const m = Math.floor(totalSeconds / 60) % 60;
    const h = Math.floor(totalSeconds / 3600);
    return {
      hours: h.toString().padStart(2, '0'),
      minutes: m.toString().padStart(2, '0'),
      seconds: s.toString().padStart(2, '0')
    };
  };

  // Convert time components to seconds
  const timeToSeconds = (tc) => {
    const h = parseInt(tc.hours) || 0;
    const m = parseInt(tc.minutes) || 0;
    const s = parseInt(tc.seconds) || 0;
    return (h * 3600) + (m * 60) + s;
  };

  const [time, setTime] = useState(secondsToTime(value));
  const hoursRef = useRef(null);
  const minutesRef = useRef(null);
  const secondsRef = useRef(null);

  // Sync internal state when value prop changes
  useEffect(() => {
    setTime(secondsToTime(value));
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
      default:
        return num;
    }
  };

  // Handle field change
  const handleFieldChange = (field, inputValue) => {
    const newTime = { ...time, [field]: inputValue };
    setTime(newTime);
  };

  // Handle blur - validate and emit change
  const handleBlur = (field) => {
    const validated = validateField(field, time[field]);
    const newTime = {
      ...time,
      [field]: validated.toString().padStart(2, '0')
    };
    setTime(newTime);

    let seconds = timeToSeconds(newTime);
    // Minimum 1 second for images
    if (seconds < 1) {
      seconds = 1;
      setTime(secondsToTime(seconds));
    }
    onChange(seconds);
  };

  // Handle key navigation
  const handleKeyDown = (e, field) => {
    const refs = {
      hours: { prev: null, next: minutesRef },
      minutes: { prev: hoursRef, next: secondsRef },
      seconds: { prev: minutesRef, next: null }
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
      const current = parseInt(time[field]) || 0;
      const max = field === 'hours' ? 99 : 59;
      const newVal = Math.min(max, current + 1);
      const newTime = { ...time, [field]: newVal.toString().padStart(2, '0') };
      setTime(newTime);
      onChange(timeToSeconds(newTime) || 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(time[field]) || 0;
      const newVal = Math.max(0, current - 1);
      const newTime = { ...time, [field]: newVal.toString().padStart(2, '0') };
      setTime(newTime);
      onChange(Math.max(1, timeToSeconds(newTime)));
    } else if (e.key === 'Enter') {
      handleBlur(field);
    }
  };

  // Auto-advance to next field when 2 digits entered
  const handleInput = (e, field) => {
    const val = e.target.value.replace(/\D/g, '').slice(-2);
    handleFieldChange(field, val);

    // Auto-advance after 2 digits
    if (val.length === 2) {
      const refs = { hours: minutesRef, minutes: secondsRef, seconds: null };
      if (refs[field]) {
        setTimeout(() => {
          refs[field].current?.focus();
          refs[field].current?.select();
        }, 0);
      }
    }
  };

  return (
    <div className={`timecode-input duration-input ${disabled ? 'disabled' : ''}`}>
      <div className="timecode-fields">
        <input
          ref={hoursRef}
          type="text"
          className="timecode-field"
          value={time.hours}
          onChange={(e) => handleInput(e, 'hours')}
          onBlur={() => handleBlur('hours')}
          onKeyDown={(e) => handleKeyDown(e, 'hours')}
          onFocus={(e) => e.target.select()}
          placeholder="HH"
          disabled={disabled}
          maxLength={2}
        />
        <span className="timecode-separator">:</span>
        <input
          ref={minutesRef}
          type="text"
          className="timecode-field"
          value={time.minutes}
          onChange={(e) => handleInput(e, 'minutes')}
          onBlur={() => handleBlur('minutes')}
          onKeyDown={(e) => handleKeyDown(e, 'minutes')}
          onFocus={(e) => e.target.select()}
          placeholder="MM"
          disabled={disabled}
          maxLength={2}
        />
        <span className="timecode-separator">:</span>
        <input
          ref={secondsRef}
          type="text"
          className="timecode-field"
          value={time.seconds}
          onChange={(e) => handleInput(e, 'seconds')}
          onBlur={() => handleBlur('seconds')}
          onKeyDown={(e) => handleKeyDown(e, 'seconds')}
          onFocus={(e) => e.target.select()}
          placeholder="SS"
          disabled={disabled}
          maxLength={2}
        />
      </div>
    </div>
  );
}
