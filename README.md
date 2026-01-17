# CasparCG Advanced Client

A professional broadcast playout application for controlling CasparCG Server instances.

## Phase 1: Foundation Complete ✓

This is the initial foundation of the application. The following features are implemented:

### ✅ Implemented Features

1. **Application Structure**
   - Electron app with React frontend
   - Modern dark-themed UI with glassmorphism effects
   - Modular component architecture
   - Centralized state management with Context API

2. **Connection Management**
   - Connection dialog for CasparCG server
   - Connect/disconnect functionality
   - Connection status indicator
   - Configuration persistence

3. **Channel Management**
   - Add unlimited channels
   - Delete channels with confirmation dialog
   - Dynamic channel width based on layer count
   - Expand channel view (placeholder)

4. **Layer Management**
   - Add unlimited layers per channel
   - Horizontal layer layout
   - Dynamic add layer button

5. **UI Components**
   - Header with app branding and connection status
   - Sidebar with tabs (Files & Macros)
   - Multi-channel grid view
   - Expanded channel view (basic)
   - Responsive layout

6. **Configuration & Persistence**
   - Save/load connection settings
   - Workspace management (structure in place)
   - Macro file management (structure in place)
   - Auto-save every 30 seconds

### 🚧 Coming in Next Phases

- Layer playlist system
- Media file browser with folder scanning
- Playback controls
- Time display and progress bars
- Macro editor and execution
- Live preview streaming
- OSC feedback integration
- Drag-and-drop functionality

## Installation

### Prerequisites

- Node.js 18+ and npm
- CasparCG Server 2.3.0+ running locally or on network

### Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Build the webpack bundle:**

```bash
npm run webpack
```

3. **Run the application:**

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## Project Structure

```
casparcg-advanced-client/
├── src/
│   ├── main/
│   │   └── main.js              # Electron main process
│   └── renderer/
│       ├── components/          # React components
│       │   ├── Header.jsx
│       │   ├── Header.css
│       │   ├── Sidebar.jsx
│       │   ├── Sidebar.css
│       │   ├── ConnectionDialog.jsx
│       │   ├── ConnectionDialog.css
│       │   ├── ChannelsContainer.jsx
│       │   ├── ChannelsContainer.css
│       │   ├── Channel.jsx
│       │   ├── Channel.css
│       │   ├── ExpandedChannel.jsx
│       │   ├── ExpandedChannel.css
│       │   ├── FileBrowser.jsx
│       │   ├── FileBrowser.css
│       │   ├── MacroList.jsx
│       │   └── MacroList.css
│       ├── context/
│       │   └── AppContext.jsx   # Global state management
│       ├── styles/
│       │   └── App.css          # Global styles
│       ├── App.jsx              # Main app component
│       └── index.js             # Renderer entry point
├── public/
│   ├── index.html               # App HTML template
│   └── bundle.js                # Webpack output (generated)
├── package.json
├── webpack.config.js
└── README.md
```

## Configuration

On first launch, the app will prompt you to connect to a CasparCG server.

Default settings:
- Host: `127.0.0.1`
- AMCP Port: `5250`
- OSC Port: `6250`

Configuration is saved to: `~/.casparcg-client/config.json`

## Building for Distribution

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

Built applications will be in the `dist/` folder.

## Development Status

**Phase 1 Complete** - Foundation & Basic Structure

The foundation is now in place with a clean, modular architecture ready for incremental feature development.

### Next Steps (Phase 2)

1. Implement Layer component with playlist UI
2. Add media file browser with folder scanning
3. Implement basic playback controls
4. Add CasparCG command execution

## Tech Stack

- **Framework:** Electron 28+
- **UI:** React 18
- **Build:** Webpack 5
- **CasparCG:** casparcg-connection 5.1+
- **OSC:** node-osc 9.1+
- **Styling:** CSS with modern features

## License

MIT

## Support

For issues or questions, please refer to the project repository.