import React from 'react';
import { DRAG_TYPES, setDragEventData } from './DragDropProvider';
import './FileTreeItem.css';

const FileIcon = ({ type }) => {
  switch (type) {
    case 'folder':
      return (
        <svg className="file-icon folder" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
        </svg>
      );
    case 'video':
      return (
        <svg className="file-icon video" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z" />
        </svg>
      );
    case 'image':
      return (
        <svg className="file-icon image" viewBox="0 0 24 24" fill="currentColor">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
        </svg>
      );
    case 'audio':
      return (
        <svg className="file-icon audio" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      );
    case 'template':
      return (
        <svg className="file-icon template" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z" />
        </svg>
      );
    default:
      return (
        <svg className="file-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
        </svg>
      );
  }
};

const ChevronIcon = ({ expanded }) => (
  <svg
    className={`chevron-icon ${expanded ? 'expanded' : ''}`}
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
  </svg>
);

export default function FileTreeItem({ item, depth, onSelect, onToggle, selectedFile }) {
  const isFolder = item.type === 'folder';
  const isSelected = selectedFile?.id === item.id;

  const handleClick = () => {
    if (isFolder) {
      onToggle(item.id);
    } else {
      onSelect(item);
    }
  };

  const handleDoubleClick = () => {
    if (isFolder) {
      onToggle(item.id);
    }
  };

  const handleDragStart = (e) => {
    if (isFolder) {
      e.preventDefault();
      return;
    }

    setDragEventData(e, DRAG_TYPES.MEDIA_FILE, {
      id: item.id,
      name: item.name,
      path: item.path,
      type: item.type,
      metadata: item.metadata
    });

    e.currentTarget.classList.add('dragging');
  };

  const handleDragEnd = (e) => {
    e.currentTarget.classList.remove('dragging');
  };

  return (
    <div className="file-tree-item-container">
      <div
        className={`file-tree-item ${isSelected ? 'selected' : ''} ${isFolder ? 'folder' : 'file'}`}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        draggable={!isFolder}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        data-path={item.path}
        data-type={item.type}
        data-name={item.name}
      >
        {isFolder && (
          <ChevronIcon expanded={item.expanded} />
        )}
        <FileIcon type={item.type} />
        <span className="file-name">{item.name}</span>
        {item.metadata?.duration && (
          <span className="file-duration">
            {formatDuration(item.metadata.duration)}
          </span>
        )}
      </div>

      {isFolder && item.expanded && item.children && (
        <div className="file-tree-children">
          {item.children.map(child => (
            <FileTreeItem
              key={child.id}
              item={child}
              depth={depth + 1}
              onSelect={onSelect}
              onToggle={onToggle}
              selectedFile={selectedFile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
