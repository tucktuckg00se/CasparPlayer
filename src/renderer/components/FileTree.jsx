import React from 'react';
import FileTreeItem from './FileTreeItem';
import './FileTree.css';

export default function FileTree({ items, onSelect, onToggle, selectedFile }) {
  if (!items || items.length === 0) {
    return (
      <div className="file-tree-empty">
        <p>No media files found</p>
      </div>
    );
  }

  return (
    <div className="file-tree">
      {items.map(item => (
        <FileTreeItem
          key={item.id}
          item={item}
          depth={0}
          onSelect={onSelect}
          onToggle={onToggle}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
}
