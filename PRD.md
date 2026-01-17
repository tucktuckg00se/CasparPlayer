# Product Requirements Document: CasparCG Advanced Client

**Version:** 1.0  
**Date:** January 2026  
**Status:** Active Development

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Product Overview](#product-overview)
3. [Target Users](#target-users)
4. [Core Features](#core-features)
5. [Technical Architecture](#technical-architecture)
6. [Detailed Feature Specifications](#detailed-feature-specifications)
7. [User Interface Requirements](#user-interface-requirements)
8. [Data Management](#data-management)
9. [Performance Requirements](#performance-requirements)
10. [Security & Reliability](#security--reliability)
11. [Future Enhancements](#future-enhancements)

---

## Executive Summary

The CasparCG Advanced Client is a professional broadcast playout application built on Electron, designed to control CasparCG Server instances. It provides an intuitive, visually modern interface for managing multi-channel broadcast workflows with unlimited layers, advanced playlist management, macro automation, and real-time preview capabilities.

### Key Objectives
- Provide a superior user experience compared to existing CasparCG clients
- Enable efficient multi-channel, multi-layer broadcast operations
- Support complex automation through customizable macros
- Deliver real-time visual feedback through live channel previews
- Maintain professional-grade reliability for broadcast environments

---

## Product Overview

### Problem Statement
Current CasparCG clients lack modern UI/UX design, have limited automation capabilities, and don't provide intuitive multi-channel management. Broadcast professionals need a tool that combines power with ease of use while maintaining the reliability required in live production environments.

### Solution
A modern Electron-based client application that provides:
- Unlimited channels and layers with dynamic layout management
- Real-time video preview for all channels
- Drag-and-drop playlist management
- Advanced macro system for automation
- Comprehensive media library with recursive folder support
- Professional dark-themed UI optimized for control room environments

---

## Target Users

### Primary Users
- **Broadcast Operators**: Running live television playout
- **Church Media Teams**: Managing worship service media
- **Corporate AV Teams**: Handling presentations and events
- **Esports Production**: Managing tournament broadcasts
- **Live Event Producers**: Controlling multiple video sources

### User Expertise Levels
- **Novice**: Basic understanding of video playback concepts
- **Intermediate**: Experience with broadcast workflows
- **Expert**: CasparCG veterans requiring advanced automation

---

## Core Features

### 1. Multi-Channel Architecture
- **Unlimited Channels**: Add/remove channels dynamically
- **Independent Control**: Each channel operates independently
- **Live Preview**: Real-time H.264 stream preview for each channel
- **Channel Management**: Create, delete (with confirmation), and configure channels
- **Dynamic Width**: Channels automatically resize based on layer count

### 2. Layer Management
- **Unlimited Layers**: Each channel supports unlimited layers
- **Horizontal Layout**: Layers arranged side-by-side within channels
- **Independent Playlists**: Each layer has its own media playlist
- **Layer Controls**: Play, pause, stop, clear operations per layer
- **Add Layer Button**: Positioned on right side of layer stack

### 3. Playlist System
- **Drag-and-Drop**: Intuitive media placement into playlists
- **Visual Feedback**: Clear indication of selected/playing items
- **Playlist Modes**:
  - Manual: Operator controls each transition
  - Auto-play: Automatically advances to next item
  - Loop: Returns to first item after last
- **In/Out Points**: Set custom start/end markers for clips
- **Reordering**: Drag items within and between playlists

### 4. Media Management
- **Recursive Folder Scanning**: Index all media in selected folder and all subfolders
- **Supported Formats**:
  - Video: MP4, MOV, AVI, MXF, MPG, MPEG
  - Audio: MP3, WAV, AAC, OGG, FLAC
  - Images: JPG, JPEG, PNG, BMP, TGA, TIF
- **Hierarchical Display**: Show folder structure as tree view
- **Collapsible Folders**: Expand/collapse folder contents
- **Standard Sorting**: Alphabetical with folders first
- **Thumbnail Preview**: Visual preview of selected media
- **File Metadata**: Display resolution, duration, codec, file size
- **Drag-and-Drop**: Drag files from browser to playlists
- **Watch Mode**: Auto-refresh when files added/removed

### 5. Macro System
- **Macro Editor**: Create/edit/delete custom macros
- **Command Types**:
  - Server Commands: PLAY, STOP, CLEAR, LOAD, etc.
  - Client Commands: Toggle playlist mode, select items, etc.
  - Custom AMCP: Raw command execution
- **Macro Properties**:
  - Name and description
  - Delay before execution (milliseconds)
  - Duration/hold time (milliseconds)
  - Command sequence (JSON array)
- **Playlist Integration**: Drag macros into playlists like media items
- **Visual Distinction**: Macros appear in red/orange color scheme
- **Execution Logging**: Track macro execution for debugging

### 6. Playback Controls

#### Media Controls (Per Item)
- **Play**: Start selected item
- **Pause**: Pause current playback
- **Resume**: Continue after pause
- **Stop**: Stop and reset to beginning
- **Loop Item**: Continuously replay current item
- **In Point**: Set custom start position
- **Out Point**: Set custom end position

#### Playlist Controls (Per Layer)
- **Previous**: Jump to previous item
- **Next**: Jump to next item
- **Playlist Mode**: Enable auto-play on item completion
- **Loop Playlist**: Return to first item after last

### 7. Live Preview System
- **Channel Preview**: Real-time video stream for each channel
- **FFmpeg/H.264**: Server-side encoding and streaming
- **Fullscreen Mode**: Expand preview to fullscreen
- **Aspect Ratio**: Maintain proper 16:9 (or source) aspect ratio
- **Low Latency**: Minimize delay between server and client
- **Quality Settings**: Configurable bitrate/resolution

### 8. Expanded Channel View
- **Single Channel Focus**: Maximize one channel to full interface
- **Large Preview**: Top section with expandable video preview
- **Resizable Preview**: Click-drag boundary to adjust preview size
- **Horizontal Layer Layout**: All layers displayed side-by-side below
- **Quick Return**: Button to return to multi-channel view
- **Sidebar Access**: Media browser and macros remain accessible

### 9. Time Display & Progress
- **Timecode Format**: HH:MM:SS:FF (frames)
- **Current Time**: Display playback position
- **Remaining Time**: Display time until end (-HH:MM:SS:FF)
- **Progress Bar**: Visual representation of position
- **Frame-Accurate**: Updates at frame rate (25/30/60 fps)
- **OSC Updates**: Real-time feedback from CasparCG Server

### 10. Connection Management
- **Connection Dialog**: Configure server on startup/reconnect
- **Settings**:
  - Host IP address
  - AMCP port (default: 5250)
  - OSC port (default: 6250)
- **Status Indicator**: Visual feedback on connection state
- **Auto-Reconnect**: Attempt reconnection on disconnect
- **Connection Profiles**: Save multiple server configurations

---

## Technical Architecture

### Application Structure (Modular)

### Technology Stack

**Core Framework**
- **Electron**: v28+ (Desktop application framework)
- **Node.js**: v18+ (Runtime environment)

**Key Dependencies**
- **casparcg-connection**: v5.1+ (CasparCG AMCP protocol)
- **node-osc**: v9.1+ (OSC protocol for feedback)
- **chokidar**: v3.5+ (File system watching)
- **ffmpeg**: v2.1+ (Video thumbnail generation)
- **sharp**: v0.32+ (Image processing)
- **musicmetadata**: v2.0+ (Audio file metadata)

**Build Tools**
- **electron-builder**: v24+ (Application packaging)
- **webpack**: v5+ (Module bundling)
- **babel**: v7+ (JavaScript transpilation)

---

## Detailed Feature Specifications

### 1. Channel Management

#### 1.1 Creating Channels
**User Story**: As a broadcast operator, I want to add new channels dynamically so I can expand my output configuration.

**Requirements**:
- Click "+ Add Channel" button in channels container
- New channel appears with default configuration:
  - One empty layer
  - Channel ID auto-incremented (Channel 1, 2, 3...)
  - Live preview placeholder
- Channel immediately available for use
- No limit on channel count (system resource permitting)

**Acceptance Criteria**:
- Channel width: 420px minimum, expands with layers
- Channel persists across app restarts (if saved workspace)

#### 1.2 Deleting Channels
**User Story**: As a broadcast operator, I want to safely delete channels I no longer need.

**Requirements**:
- Delete button (trash icon) in channel header
- Clicking triggers confirmation dialog:
  - Title: "Delete Channel?"
  - Message: "Are you sure you want to delete Channel X? All layers and playlist items will be removed. This cannot be undone."
  - Buttons: "Cancel" (default) | "Delete" (destructive)
- Keyboard shortcuts:
  - Escape: Cancel
  - Enter: Confirm (when focused)
- On confirmation:
  - Send CLEAR command to all layers
  - Remove channel from state
  - Smooth animation (fade out, slide)
  - Adjacent channels reposition

**Acceptance Criteria**:
- Accidental clicks prevented by confirmation
- CasparCG server layers properly cleared
- No orphaned data in state
- Smooth visual transition (300ms animation)

#### 1.3 Channel Width Management
**User Story**: As an operator, I want channels to automatically size based on their content.

**Requirements**:
- Base width: 420px (preview + 1 layer)
- Each additional layer adds: 392px (380px layer + 12px gap)
- Add layer button: +60px
- Formula: `420px + (layers.length - 1) * 392px + 60px`
- Maximum width: 3000px (then scroll within channel)
- Minimum width: 420px
- Smooth transition when layers added/removed (300ms ease)

**Example Widths**:
- 1 layer: 480px
- 2 layers: 872px  
- 3 layers: 1264px
- 4 layers: 1656px

### 2. Layer Management

#### 2.1 Adding Layers
**User Story**: As an operator, I want to add multiple layers to composite content.

**Requirements**:
- Circular "+" button on right side of layers container
- Button properties:
  - Size: 50px diameter
  - Position: Vertically centered
  - Style: Dashed border, teal theme
  - Hover: Scale 1.1, glow effect
- Clicking adds new layer:
  - Width: 380px
  - Appears immediately after last layer
  - Layer ID auto-incremented (Layer 1, 2, 3...)
  - Empty playlist
  - Default controls configuration
- Channel width updates automatically
- No layer limit (practical limit: ~10 per channel)

**Acceptance Criteria**:
- Layer appears within 100ms
- Smooth insertion animation
- Channel resizes smoothly
- Horizontal scroll if needed

#### 2.2 Layer Width & Layout
**Requirements**:
- Fixed width: 380px per layer
- Gap between layers: 12px
- Horizontal scrolling if total width exceeds container
- Scroll behavior: Smooth, touch-pad optimized
- Last layer has 15px right padding

#### 2.3 Layer Controls
**Requirements**:
Each layer includes:

**Status Bar** (top):
- Current time display (left)
- Progress bar (center)
- Remaining time display (right)
- Updates at 10fps minimum

**Playlist Area** (middle):
- Scrollable item list
- Drag-drop target
- Empty state: "Drop media here"
- Height: Flexible (fills available space)

**Control Buttons** (bottom):
Two columns:

*Column 1 - Media Controls*:
- Play (▶): Start selected item
- Pause (⏸): Pause current playback  
- Loop (🔁): Toggle item loop
- In Point ([): Set start marker
- Out Point (]): Set end marker

*Column 2 - Playlist Controls*:
- Previous (⏮): Previous item
- Next (⏭): Next item
- Playlist Mode (📋): Toggle auto-play
- Loop Playlist (🔄): Toggle playlist loop

**Active State Indicators**:
- Active buttons: Teal glow, gradient background
- Playing items: Teal left border, pulse animation
- Selected items: Teal background gradient

### 3. Media Library

#### 3.1 Folder Selection
**User Story**: As an operator, I want to select my media folder and see all available content.

**Requirements**:
- "Open Media Folder" button in File Browser tab
- Opens native OS folder picker
- On selection:
  - Start recursive scan
  - Display loading indicator
  - Show progress (e.g., "Scanning... 450 files")
- Scan algorithm:
  - Start at root folder
  - Recursively traverse all subfolders
  - Identify media files by extension
  - Extract metadata (resolution, duration, codec)
  - Generate thumbnails (async, cached)
  - Build hierarchical tree structure
- Watch folder for changes:
  - Add: Automatically appear in list
  - Remove: Automatically disappear
  - Modify: Update metadata

**Performance Targets**:
- Thumbnails generated in background
- UI remains responsive during scan

#### 3.2 File Tree Display
**User Story**: As an operator, I want to browse media in a familiar folder structure.

**Requirements**:
- Hierarchical tree view
- Display structure:
  ```
  ▼ Media/
    ▼ Bumpers/
      - bumper_01.mp4
      - bumper_02.mp4
    ▼ Graphics/
      ▼ Lower Thirds/
        - lt_name_01.png
        - lt_name_02.png
    - main_video.mp4
  ```
- Folder indicators:
  - Expandable: ▶ icon (collapsed) / ▼ icon (expanded)
  - Color: Teal (#00ff88)
  - Hover: Background highlight
  - Click: Toggle expand/collapse
- File indicators:
  - Icon based on type (video/audio/image)
  - Name truncated with ellipsis if long
  - Hover: Show full name as tooltip
  - Click: Select, show preview
  - Drag: Enable drag operation
- Sorting:
  - Folders first (alphabetical)
  - Then files (alphabetical)
  - Case-insensitive
- Indentation: 20px per level

#### 3.3 Media Preview
**User Story**: As an operator, I want to preview media before adding to playlist.

**Requirements**:
- "Media Info" panel appears when file selected
- Contents:
  - **Thumbnail**: 
    - Fallback: Media icon
    - Videos: Frame at 10% duration
    - Images: Scaled version
    - Audio: Speaker icon
    - Size: 320x180px (16:9)
  - **Metadata**:
    - File name
    - Resolution (video/image)
    - Duration (video/audio) 
    - Frame rate (video)
    - Codec/format
    - File size
    - Date modified
- Thumbnail generation:
  - FFmpeg for video (extract frame)
  - Sharp for images (resize)
  - Font Awesome Icons for audio and others
  - Cache thumbnails in temp directory
  - Background generation, don't block UI

#### 3.4 Drag-and-Drop to Playlist
**User Story**: As an operator, I want to drag files into playlists quickly.

**Requirements**:
**Drag Start**:
- Mouse down on file item or shift + click multiple
- Visual feedback: Item semi-transparent, cursor changes
- Store reference to file data

**Drag Over Playlist**:
- Playlist highlights with border glow
- Show insertion point (line between items)
- Cursor shows "add" icon

**Drop**:
- Create playlist item from file:
  - Name
  - Path/filename
  - Duration
  - Resolution  
  - Thumbnail reference
- Insert at drop position
- Reset visual feedback
- Item(s) appears immediately
- Dragged item(s) remains in browser

**Validation**:
- Only accept media files and macros
- Show "not allowed" cursor for non-media
- Ignore drops on non-playlist areas

### 4. Playlist Operations

#### 4.1 Item Selection
**Requirements**:
- Click item to select
- Only one item selected per layer
- Selected state:
  - Background: Teal gradient
  - Border: Teal glow
  - Shadow: Teal glow
- Keyboard navigation:
  - Up/Down arrows: Change selection
  - Enter: Play selected
  - Delete: Remove selected

#### 4.2 Item Reordering
**User Story**: As an operator, I want to reorder playlist items.

**Requirements**:
- Drag selected item(s)
- Visual feedback: Semi-transparent
- Show insertion line between unselected items
- Drop to reposition
- Animation: Smooth slide to new position
- Works within same playlist
- Works between playlists (move operation)
- Hold Ctrl/Cmd: Copy instead of move

#### 4.3 Item Removal
**Requirements**:
- Trash icon on each item (right side)
- Shift + click: Select multiple items
- Hover: Icon highlights red
- Click: Remove immediately (no confirmation)
- Animation: Fade out, collapse space
- Items below shift up smoothly
- Keyboard: Delete key removes selected
- Undo: Replace items if accidentally removed

### 5. Playback System

#### 5.1 Playing Media
**Requirements**:
- Select item in playlist
- Click Play button (or press Enter)
- Command sent to CasparCG:
  ```
  PLAY <channel>-<layer> "<filename>" [LOOP] [SEEK <frames>] [LENGTH <frames>]
  ```
- Visual feedback:
  - Item marked as "playing" (teal border)
  - Progress bar starts moving
  - Time displays update
- Previous playing item (if any) stops
- If Playlist Mode active: Prepare next item

#### 5.2 Time Display & Updates
**Requirements**:
- OSC subscription for time updates
- OSC message format: `/channel/<n>/stage/layer/<n>/file/time`
- Update frequency: 10 Hz (10 times per second)
- Display format: `HH:MM:SS:FF`
- Current time: Left side of status bar
- Remaining time: Right side (prefixed with `-`)
- Progress bar: Percentage of total duration
- Frame accuracy: Use frame count, not seconds

**Example**:
- Duration: 00:14:43:00 (14m 43s at 25fps)
- Current: 00:03:12:15
- Remaining: -00:11:30:10
- Progress: 22%

#### 5.3 Pause & Resume
**Requirements**:
- Pause button: Send `PAUSE <channel>-<layer>`
- Resume: Click Play again, sends `RESUME <channel>-<layer>`
- Visual feedback:
  - Pause: Progress bar stops, Play icon changes to "Resume"
  - Time displays frozen
- Playing state maintained during pause

#### 5.4 Stop
**Requirements**:
- Stop: Send `STOP <channel>-<layer>`
- Effect:
  - Playback stops
  - Time resets to 00:00:00:00
  - Playing state removed
  - Progress bar resets
- Layer still displays last frame until cleared or new play

#### 5.5 Loop Mode
**Requirements**:
- Loop button toggles item loop
- Active state: Button highlighted
- Command: Adds `LOOP` parameter to PLAY command
- Behavior: Item restarts automatically on completion
- Works with in/out points

#### 5.6 In/Out Points
**Requirements**:
- In Point button: Set start position
- Out Point button: Set end position
- Storage: Store frame numbers with playlist item
- Display: Show markers on progress bar (visual indicators)
- Playback: Send as `SEEK` and `LENGTH` parameters
- Reset: Ctrl+Click button to clear

**Example**:
- Full duration: 1000 frames
- In point: 100 frames (4 seconds @ 25fps)
- Out point: 800 frames (32 seconds @ 25fps)
- Play command: `PLAY 1-1 "video.mp4" SEEK 100 LENGTH 700`

#### 5.7 Playlist Navigation
**Requirements**:
- **Previous**: Play previous item in list
- **Next**: Play next item in list
- **Playlist Mode**: 
  - When enabled: Automatically play next item on current completion
  - OSC message triggers next item
  - Works with macros (respects duration)
- **Loop Playlist**:
  - When enabled + Playlist Mode: Return to first item after last
  - When disabled: Stop at last item

### 6. Macro System

#### 6.1 Macro Creation
**User Story**: As an operator, I want to create automation sequences.

**Requirements**:
- "+ New Macro" button in Macros tab
- Opens Macro Editor dialog
- Fields:
  - **Name**: Text input (required)
  - **Description**: Text input (optional)
  - **Delay**: Number input, milliseconds (default: 0)
  - **Duration**: Number input, milliseconds (default: 1000)
  - **Commands**: JSON textarea (array of command objects)
- Command structure:
  ```json
  [
    {
      "type": "play|stop|clear|custom|client",
      "params": { /* command-specific */ }
    }
  ]
  ```
- Validation:
  - Name required, max 50 chars
  - Delay >= 0
  - Duration >= 0
  - Commands must be valid JSON array
- Save: Store to disk (JSON file per macro)
- Cancel: Discard changes

#### 6.2 Macro Types

**Server Commands** (type: "play", "stop", "clear"):
```json
{
  "type": "play",
  "params": {
    "channel": 1,
    "layer": 10,
    "file": "overlay.png",
    "transition": "MIX 25"
  }
}
```

**Custom AMCP** (type: "custom"):
```json
{
  "type": "custom",
  "raw": "MIXER 1-1 FILL 0.0 0.0 0.5 0.5"
}
```

**Client Commands** (type: "client"):
```json
{
  "type": "client",
  "action": "togglePlaylistMode",
  "target": [1, 1]
}
```

#### 6.3 Macro Execution
**Requirements**:
- Drag macro from list to playlist
- Appears as red/orange item with gear icon
- When playlist reaches macro:
  1. Wait for `delay` milliseconds
  2. Execute commands in sequence
  3. Wait for each command to complete
  4. If Playlist Mode active: Wait for `duration`, then next item
  5. If Playlist Mode inactive: Stop at macro
- Logging: Log each command execution to console
- Error handling: Log errors, continue sequence

#### 6.4 Macro Management
**Requirements**:
- List all saved macros in Macros tab
- Click macro: Open editor (edit mode)
- Delete button: Remove macro
- Drag macro: Add to playlist
- Search: Filter macros by name
- Import/Export: JSON file format

### 7. Live Preview

#### 7.1 Channel Preview Display
**Requirements**:
- Preview area: 420x240px (16:9 aspect ratio)
- Background: Dark gradient
- Placeholder: TV icon when not streaming
- Video element when streaming:
  - Covers full area
  - Maintains aspect ratio (letterbox if needed)
  - Low latency mode enabled

#### 7.2 Preview Streaming
**Requirements**:
- CasparCG configuration:
  - FFmpeg consumer on each channel
  - H.264 encoding, 1280x720 @ 2Mbps
  - RTMP or HTTP stream output
- Client connection:
  - Connect to stream URL
  - Display in video element
  - Handle reconnection on failure
- Performance:
  - Latency: <500ms target
  - CPU usage: <5% per stream
  - Smooth playback, no stuttering

#### 7.3 Fullscreen Mode
**User Story**: As an operator, I want to view preview in fullscreen for monitoring.

**Requirements**:
- Double-click preview area OR
- Fullscreen button (top-right of preview)
- Behavior:
  - Preview expands to fill screen
  - Controls overlay (hidden, appear on mouse move)
  - Exit: ESC key or click "Exit Fullscreen"
  - Maintain aspect ratio (letterbox)
- Controls overlay:
  - Semi-transparent background
  - Show channel name
  - Show current item name
  - Basic controls: Play, Pause, Next
  - Volume control (if audio enabled)

### 8. Expanded Channel View

#### 8.1 Entering Expanded View
**User Story**: As an operator, I want to focus on one channel with a larger preview.

**Requirements**:
- Expand button in channel header (next to delete)
- Icon: Expand arrows (⤢)
- Click: Transition to expanded view
- Animation: 300ms smooth transition

#### 8.2 Expanded Layout
**Requirements**:
- Full interface width used
- Layout structure:
  ```
  ┌─────────────────────────────────┬─────────────┐
  │                                 │             │
  │         LARGE PREVIEW           │   SIDEBAR   │
  │         (resizable)             │   (media/   │
  │                                 │   macros)   │
  ├─────────────────────────────────┤             │
  │                                 │             │
  │  LAYERS (horizontal, all shown) │             │
  │                                 │             │
  └─────────────────────────────────┴─────────────┘
  ```
- Preview section:
  - Initial height: 50% of viewport
  - Minimum height: 300px
  - Maximum height: 80% of viewport
  - Resize handle at bottom: Drag to adjust
  - Cursor changes on hover (↕)
- Layers section:
  - Horizontal scroll if needed
  - All layers visible at once
  - Same controls as normal view
- Sidebar:
  - Maintains position and width (380px)
  - Media browser and macros still accessible
- Exit button:
  - Top-left: "← Back to All Channels"
  - Returns to multi-channel view
  - Smooth transition

#### 8.3 Resizable Preview
**Requirements**:
- Drag handle between preview and layers
- Visual indicator: Line with grab handle
- Drag behavior:
  - Cursor changes to ↕
  - Preview height adjusts in real-time
  - Smooth, no lag
  - Constrain to min/max bounds
- Save preference: Remember height per session

### 9. Audio Support

#### 9.1 Audio File Playback
**Requirements**:
- Supported formats: MP3, WAV, AAC, OGG, FLAC
- Display in file browser with audio icon
- Drag to playlist like video
- Playback:
  - Same controls as video
  - No video preview (show audio waveform)
  - Show duration and current time
  - Support in/out points
- Metadata:
  - Artist, Album, Title (from ID3 tags)
  - Duration
  - Bitrate
  - Sample rate

#### 9.2 Audio Visualization
**Requirements**:
- Real-time level meters during playback:
  - Left/Right channel meters
  - Peak hold indicators
  - Clipping warning (red)
- Displayed in preview area for audio-only items

---

## User Interface Requirements

### Design Principles
1. **Dark First**: Optimized for dark control room environments
2. **Clarity**: High contrast, clear typography, no ambiguity
3. **Efficiency**: Minimize clicks, support keyboard shortcuts
4. **Feedback**: Immediate visual response to all actions
5. **Professional**: Broadcast-grade appearance and behavior
6. **Glassmorphism**: Depth and contrast between foreground and background elements

### Color Palette
- **Background**: Dark gradient (#0a0a0f to #1a1a2e)
- **Primary Accent**: Teal (#00aa88 to #00ff88)
- **Cards/Panels**: Semi-transparent overlays (rgba)
- **Text**: White (#ffffff) with varying opacity
- **Error/Destructive**: Red (#ff4444 to #ff8888)
- **Warning**: Orange (#ffaa44 to #ffcc88)
- **Success**: Green (same as accent teal)

### Typography
- **Primary Font**: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto
- **Monospace Font**: 'Courier New', monospace (for timecode)
- **Sizes**:
  - Headers: 15-20px, 600 weight
  - Body: 13px, 400-500 weight
  - Small: 11-12px, 400 weight
  - Timecode: 11px monospace

### Spacing System
- **Base Unit**: 4px
- **Common Spacings**: 8px, 12px, 16px, 20px, 24px
- **Gaps**: 6-12px between related elements
- **Padding**: 10-20px for containers
- **Margins**: 15-20px for major sections

### Interactive Elements
- **Buttons**:
  - Height: 36px (icon-only), 40px (text)
  - Radius: 8-10px
  - Hover: Lift 1-2px, brighten/glow
  - Active: Scale 0.98, glow intensifies
  - Transition: 200-300ms ease
- **Inputs**:
  - Height: 40px
  - Radius: 8px
  - Border: 1px rgba(255,255,255,0.1)
  - Focus: Border teal, shadow glow
- **Cards**:
  - Radius: 12-16px
  - Background: Semi-transparent overlays
  - Border: 1px rgba(255,255,255,0.1)
  - Shadow: Subtle depth

### Animations
- **Duration**: 200-300ms standard, 500ms for major transitions
- **Easing**: ease, ease-in-out
- **Hover**: Scale 1.05-1.1, translateY -2px
- **State Changes**: Fade, slide, or scale
- **Loading**: Pulsing, spinning, or skeleton screens

### Accessibility
- **Contrast Ratios**: WCAG AA minimum (4.5:1)
- **Focus Indicators**: Visible outlines on keyboard focus
- **Keyboard Navigation**: All actions accessible via keyboard
- **Screen Reader**: Proper ARIA labels on interactive elements
- **Error Messages**: Clear, actionable feedback

---

## Data Management

### Application State
**Storage**: In-memory with periodic saves to disk

**State Structure**:
```javascript
{
  connection: {
    host: "127.0.0.1",
    port: 5250,
    oscPort: 6250,
    status: "connected" | "disconnected" | "connecting",
    serverInfo: { version, channels }
  },
  
  channels: [
    {
      id: 1,
      name: "Channel 1",
      layers: [
        {
          id: 1,
          playlist: [
            {
              id: "uuid",
              type: "media" | "macro",
              name: "video.mp4",
              path: "/path/to/video.mp4",
              duration: 1000, // frames
              resolution: "1920x1080",
              inPoint: null | number,
              outPoint: null | number,
              selected: boolean,
              playing: boolean
            }
          ],
          currentIndex: number,
          playlistMode: boolean,
          loopMode: boolean,
          loopItem: boolean,
          currentTime: number, // frames
          totalTime: number // frames
        }
      ],
      expanded: boolean
    }
  ],
  
  media: {
    rootPath: "/path/to/media",
    tree: [
      {
        name: "Folder",
        type: "folder",
        path: "/path",
        expanded: boolean,
        children: []
      },
      {
        name: "file.mp4",
        type: "file",
        path: "/path/file.mp4",
        metadata: {
          duration: 1000,
          resolution: "1920x1080",
          codec: "h264",
          size: 1024000,
          thumbnail: "base64..."
        }
      }
    ],
    selectedFile: null | object
  },
  
  macros: [
    {
      id: "uuid",
      name: "Toggle Playlist",
      description: "Toggle playlist mode on channel 1 layer 1",
      delay: 0,
      duration: 1000,
      commands: []
    }
  ],
  
  ui: {
    currentView: "multi" | "expanded",
    expandedChannel: null | number,
    sidebarTab: "files" | "macros",
    previewSize: number // height in pixels
  }
}
```

### Persistence
**Configuration File**: `~/.casparcg-client/config.json`
- Connection settings
- Window size/position
- Last media folder
- UI preferences

**Workspace Files**: `~/.casparcg-client/workspaces/*.json`
- Channel configurations
- Playlists
- Can be loaded/saved by user

**Macro Files**: `~/.casparcg-client/macros/*.json`
- One file per macro
- Exported/imported individually

**Thumbnail Cache**: `~/.casparcg-client/cache/thumbnails/`
- Keyed by file path hash
- Auto-cleanup of old files

### Data Validation
- **File Paths**: Validate existence before adding to playlist
- **Timecode**: Ensure in/out points within file duration
- **Commands**: Validate JSON structure for macros
- **Connection**: Verify host/port format
- **Permissions**: Check read/write access for config files

---

## Performance Requirements

### Application Performance Targets
- **Startup Time**: <2 seconds to main window
- **Connection Time**: <1 second to CasparCG server
- **UI Responsiveness**: 60fps, <16ms frame time
- **Command Execution**: <50ms from click to server
- **Playlist Updates**: <100ms to reflect changes
- **Media Scan**: 1000 files in <5 seconds

### Resource Usage Targets
- **Memory**: <500MB idle, <1GB with 10 channels
- **CPU**: <5% idle, <20% during playback
- **Disk**: <100MB application, thumbnails variable
- **Network**: <10Mbps per preview stream

### Scalability Targets
- **Channels**: Support 10+ simultaneously
- **Layers**: 10+ per channel
- **Playlist Items**: 1000+ per layer
- **Media Files**: 10,000+ in library
- **Concurrent Previews**: 4+ streams

### Optimization Strategies
- **Lazy Loading**: Load thumbnails on-demand
- **Virtual Scrolling**: Render only visible playlist items
- **Debouncing**: Reduce redundant operations
- **Caching**: Store thumbnails, metadata
- **Worker Threads**: Background processing for media scanning
- **Code Splitting**: Load modules as needed

---

## Security & Reliability

### Error Handling
**Connection Errors**:
- Auto-reconnect with exponential backoff
- Display connection status prominently
- Allow manual reconnect
- Log errors to file for debugging

**Playback Errors**:
- Catch and display CasparCG error responses
- Highlight failed items in playlist
- Provide retry option
- Continue to next item in playlist mode

**File System Errors**:
- Handle missing files gracefully
- Remove invalid items from playlist
- Show warning for inaccessible folders
- Don't crash on permission errors

**Macro Errors**:
- Validate command syntax before execution
- Catch execution errors
- Log to console
- Show notification to user
- Continue macro sequence if possible

### Data Integrity
- **Autosave**: Save state every 30 seconds
- **Crash Recovery**: Restore last saved state
- **Backup**: Keep last 5 workspace backups
- **Validation**: Verify data structure on load
- **Migration**: Handle old config formats

### Application Stability
- **Memory Leaks**: Regular cleanup of event listeners
- **Resource Cleanup**: Proper OSC/connection disposal on close
- **Graceful Shutdown**: Wait for pending operations
- **Error Boundaries**: Prevent crashes from rendering errors
- **Logging**: Comprehensive logs for troubleshooting

### Security Considerations
- **Network**: Only connect to user-specified servers
- **File System**: Respect OS permissions
- **Credentials**: Never store passwords
- **Updates**: Code signing for distributed builds
- **Privacy**: No telemetry or tracking

---

## Future Enhancements

### Phase 2 Features
1. **Multi-Server Support**
   - Connect to multiple CasparCG servers
   - Manage all from one interface
   - Server groups and switching

2. **Template Graphics**
   - CasparCG template (.ft) support
   - Data field editing
   - Template preview
   - Update template data during playback

3. **Recording & Capture**
   - Record channel output
   - Screenshot/frame grab
   - Export clips from playlist

4. **Advanced Scheduling**
   - Schedule playlists by date/time
   - Recurring schedules
   - Pre-roll warnings
   - Auto-start playlists

5. **NDI Support**
   - NDI sources as media
   - Output channels as NDI
   - NDI preview

6. **Remote Control API**
   - HTTP/WebSocket API
   - Control from other applications
   - Web-based remote control
   - Mobile app companion

### Phase 3 Features
1. **Multi-User Collaboration**
   - Share playlists across network
   - User permissions
   - Change tracking
   - Conflict resolution

2. **Advanced Automation**
   - Conditional macros (if/then)
   - Variables and expressions
   - Triggers (time, cue, GPI)
   - Scripting language

3. **Media Management**
   - Import/export media
   - Transcoding integration
   - Media validation
   - Duplicate detection
   - Archive management

4. **Analytics & Reporting**
   - Playback logs
   - Usage statistics
   - Error reports
   - Performance metrics

5. **Cloud Integration**
   - Cloud storage for media
   - Sync workspaces across devices
   - Backup to cloud
   - Team collaboration features

---

## Future Enhancements

### Phase 2 Features
1. **Multi-Server Support**
   - Connect to multiple CasparCG servers
   - Manage all from one interface
   - Server groups and switching

2. **Template Graphics**
   - CasparCG template (.ft) support
   - Data field editing
   - Template preview
   - Update template data during playback

3. **Recording & Capture**
   - Record channel output
   - Screenshot/frame grab
   - Export clips from playlist

4. **Advanced Scheduling**
   - Schedule playlists by date/time
   - Recurring schedules
   - Pre-roll warnings
   - Auto-start playlists

5. **NDI Support**
   - NDI sources as media
   - Output channels as NDI
   - NDI preview

6. **Remote Control API**
   - HTTP/WebSocket API
   - Control from other applications
   - Web-based remote control
   - Mobile app companion

### Phase 3 Features
1. **Multi-User Collaboration**
   - Share playlists across network
   - User permissions
   - Change tracking
   - Conflict resolution

2. **Advanced Automation**
   - Conditional macros (if/then)
   - Variables and expressions
   - Triggers (time, cue, GPI)
   - Scripting language

3. **Media Management**
   - Import/export media
   - Transcoding integration
   - Media validation
   - Duplicate detection
   - Archive management

4. **Analytics & Reporting**
   - Playback logs
   - Usage statistics
   - Error reports
   - Performance metrics

5. **Cloud Integration**
   - Cloud storage for media
   - Sync workspaces across devices
   - Backup to cloud
   - Team collaboration features

---

## Technical Specifications

### System Requirements

### CasparCG Server Requirements
- Version: 2.3.0 or later
- OSC enabled in configuration
- FFmpeg consumer configured for preview
- Media folder accessible to client
- AMCP port open (default: 5250)
- OSC port open (default: 6250)

---

## Testing Strategy

### Unit Tests
- State management functions
- Time formatting utilities
- Command builders
- Data validators
- File scanners

### Integration Tests
- CasparCG connection
- OSC communication
- Playlist operations
- Macro execution
- Media scanning

### End-to-End Tests
- Complete workflows
- Multi-channel operations
- Error scenarios
- Performance benchmarks

### Manual Testing
- UI/UX validation
- Visual regression
- Accessibility
- Cross-platform compatibility
- Real-world usage scenarios

---

## Appendix

### Glossary
- **AMCP**: Advanced Media Control Protocol (CasparCG's control protocol)
- **OSC**: Open Sound Control (used for real-time feedback)
- **Layer**: Video layer in CasparCG (foreground/background/key)
- **Playlist**: Ordered list of media items to play sequentially
- **Macro**: Automated command sequence
- **In/Out Points**: Start and end markers within a media file
- **Timecode**: Frame-accurate time representation (HH:MM:SS:FF)

### References
- [CasparCG Documentation](https://github.com/CasparCG/help)
- [AMCP Protocol Reference](https://github.com/CasparCG/help/wiki/AMCP-Protocol)
- [Electron Documentation](https://www.electronjs.org/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

---

**Document Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Active Development  
**Next Review**: February 2026
-