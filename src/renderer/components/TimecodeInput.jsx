import React, { useState, useRef, useEffect } from 'react';
import './TimecodeInput.css';

/**
 * TimecodeInput component for HH:MM:SS:FF timecode entry
 * Stores values as frames internally for precision with AMCP commands
 */
export default function TimecodeInput({
  value, // Value in frames (or null)
  onChange, // Callback with new frame value (or null)
  frameRate = 25,
  maxFrames = null, // Maximum allowed frames (e.g., video duration)
  placeholder = '00:00:00:00',
  disabled = false
}) {
  // Convert frames to timecode components
  const framesToTimecode = (frames) => {
    if (frames === null || frames === undefined || frames < 0) {
      return { hours: '', minutes: '', seconds: '', frames: '' };
    }
    const totalSeconds = Math.floor(frames / frameRate);
    const frameComponent = Math.floor(frames % frameRate);
    const secs = totalSeconds % 60;
    const mins = Math.floor(totalSeconds / 60) % 60;
    const hrs = Math.floor(totalSeconds / 3600);
    return {
      hours: hrs.toString().padStart(2, '0'),
      minutes: mins.toString().padStart(2, '0'),
      seconds: secs.toString().padStart(2, '0'),
      frames: frameComponent.toString().padStart(2, '0')
    };
  };

  // Convert timecode components to frames
  const timecodeToFrames = (tc) => {
    const h = parseInt(tc.hours) || 0;
    const m = parseInt(tc.minutes) || 0;
    const s = parseInt(tc.seconds) || 0;
    const f = parseInt(tc.frames) || 0;
    return (h * 3600 * frameRate) + (m * 60 * frameRate) + (s * frameRate) + f;
  };

  const [timecode, setTimecode] = useState(framesToTimecode(value));
  const hoursRef = useRef(null);
  const minutesRef = useRef(null);
  const secondsRef = useRef(null);
  const framesRef = useRef(null);

  // Sync internal state when value prop changes
  useEffect(() => {
    setTimecode(framesToTimecode(value));
  }, [value, frameRate]);

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

  // Handle field change
  const handleFieldChange = (field, inputValue) => {
    // Allow empty or partial input during editing
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

    // Check if all fields are empty (clear the value)
    const isEmpty = !newTimecode.hours && !newTimecode.minutes &&
                    !newTimecode.seconds && !newTimecode.frames;

    if (isEmpty || (newTimecode.hours === '00' && newTimecode.minutes === '00' &&
                    newTimecode.seconds === '00' && newTimecode.frames === '00')) {
      // Only emit null if the original value was also empty/null
      if (value === null || value === undefined) {
        onChange(null);
      } else {
        onChange(timecodeToFrames(newTimecode));
      }
    } else {
      let frames = timecodeToFrames(newTimecode);
      // Clamp to max if specified
      if (maxFrames !== null && frames > maxFrames) {
        frames = maxFrames;
        setTimecode(framesToTimecode(frames));
      }
      onChange(frames);
    }
  };

  // Handle key navigation
  const handleKeyDown = (e, field, ref) => {
    const refs = {
      hours: { prev: null, next: minutesRef },
      minutes: { prev: hoursRef, next: secondsRef },
      seconds: { prev: minutesRef, next: framesRef },
      frames: { prev: secondsRef, next: null }
    };

    if (e.key === ':' || e.key === 'Tab' && !e.shiftKey) {
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
      handleFieldChange(field, newVal.toString().padStart(2, '0'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseInt(timecode[field]) || 0;
      const newVal = Math.max(0, current - 1);
      handleFieldChange(field, newVal.toString().padStart(2, '0'));
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
      const refs = { hours: minutesRef, minutes: secondsRef, seconds: framesRef, frames: null };
      if (refs[field]) {
        setTimeout(() => {
          refs[field].current?.focus();
          refs[field].current?.select();
        }, 0);
      }
    }
  };

  // Clear all fields
  const handleClear = () => {
    setTimecode({ hours: '', minutes: '', seconds: '', frames: '' });
    onChange(null);
  };

  return (
    <div className={`timecode-input ${disabled ? 'disabled' : ''}`}>
      <div className="timecode-fields">
        <input
          ref={hoursRef}
          type="text"
          className="timecode-field"
          value={timecode.hours}
          onChange={(e) => handleInput(e, 'hours')}
          onBlur={() => handleBlur('hours')}
          onKeyDown={(e) => handleKeyDown(e, 'hours', hoursRef)}
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
          value={timecode.minutes}
          onChange={(e) => handleInput(e, 'minutes')}
          onBlur={() => handleBlur('minutes')}
          onKeyDown={(e) => handleKeyDown(e, 'minutes', minutesRef)}
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
          value={timecode.seconds}
          onChange={(e) => handleInput(e, 'seconds')}
          onBlur={() => handleBlur('seconds')}
          onKeyDown={(e) => handleKeyDown(e, 'seconds', secondsRef)}
          onFocus={(e) => e.target.select()}
          placeholder="SS"
          disabled={disabled}
          maxLength={2}
        />
        <span className="timecode-separator">:</span>
        <input
          ref={framesRef}
          type="text"
          className="timecode-field"
          value={timecode.frames}
          onChange={(e) => handleInput(e, 'frames')}
          onBlur={() => handleBlur('frames')}
          onKeyDown={(e) => handleKeyDown(e, 'frames', framesRef)}
          onFocus={(e) => e.target.select()}
          placeholder="FF"
          disabled={disabled}
          maxLength={2}
        />
      </div>
      <span className="timecode-fps">{frameRate}fps</span>
    </div>
  );
}
