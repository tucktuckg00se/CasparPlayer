import React from 'react';
import { formatDuration, formatRemainingTime, calculateProgress } from '../utils/timecode';
import './TimeDisplay.css';

export default function TimeDisplay({ currentTime, totalTime, isPlaying }) {
  const progress = calculateProgress(currentTime, totalTime);
  const remaining = totalTime - currentTime;

  return (
    <div className="time-display">
      <div className="time-progress">
        <div
          className={`time-progress-bar ${isPlaying ? 'playing' : ''}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="time-values">
        <span className="time-current">{formatDuration(currentTime)}</span>
        <span className="time-remaining">{formatRemainingTime(remaining)}</span>
        <span className="time-total">{formatDuration(totalTime)}</span>
      </div>
    </div>
  );
}
