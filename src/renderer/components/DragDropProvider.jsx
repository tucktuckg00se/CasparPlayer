import React, { createContext, useContext, useState, useCallback } from 'react';

const DragDropContext = createContext();

export function useDragDrop() {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDrop must be used within DragDropProvider');
  }
  return context;
}

export default function DragDropProvider({ children }) {
  const [dragData, setDragData] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dropTarget, setDropTarget] = useState(null);

  const startDrag = useCallback((data) => {
    setDragData(data);
    setIsDragging(true);
  }, []);

  const endDrag = useCallback(() => {
    setDragData(null);
    setIsDragging(false);
    setDropTarget(null);
  }, []);

  const setTarget = useCallback((target) => {
    setDropTarget(target);
  }, []);

  const value = {
    dragData,
    isDragging,
    dropTarget,
    startDrag,
    endDrag,
    setTarget
  };

  return (
    <DragDropContext.Provider value={value}>
      {children}
    </DragDropContext.Provider>
  );
}

// Drag types
export const DRAG_TYPES = {
  MEDIA_FILE: 'media_file',
  PLAYLIST_ITEM: 'playlist_item',
  MACRO: 'macro'
};

// Helper to create drag data
export function createDragData(type, data) {
  return {
    type,
    data,
    timestamp: Date.now()
  };
}

// Helper to parse drag data from event
export function parseDragData(event) {
  try {
    const json = event.dataTransfer.getData('application/json');
    if (json) {
      return JSON.parse(json);
    }
  } catch (e) {
    console.error('Failed to parse drag data:', e);
  }
  return null;
}

// Helper to set drag data on event
export function setDragEventData(event, type, data) {
  const dragData = createDragData(type, data);
  event.dataTransfer.setData('application/json', JSON.stringify(dragData));
  event.dataTransfer.effectAllowed = 'copyMove';
}
