# Change Log

All notable changes to the "YouTube Music in VS Code" extension will be documented in this file.

## [1.0.0] - Initial Release

### Added
- 🎵 Embedded YouTube Music player in VS Code webview
- 🎧 Personalized recommendations using YouTube Data API v3
- ⚙️ Configuration settings for API key and auto-start
- ⌨️ Keyboard shortcut (Ctrl+Shift+M) to open/focus player
- 🎯 Smart panel management with bottom-left docking
- 📱 Responsive sidebar with track thumbnails and controls
- 🔄 Refresh recommendations functionality
- 🛡️ Error handling for invalid/missing API keys
- 📖 Comprehensive documentation and setup guide

### Features
- Command: `youtubeMusic.openPlayer` - Opens or focuses the YouTube Music panel
- Settings: `youtubeMusic.apiKey` - Store your YouTube Data API key
- Settings: `youtubeMusic.autoStart` - Auto-open player on VS Code startup
- Two-way communication between extension and webview
- Click-to-play track recommendations
- Visual status indicators for API key configuration
- Direct access to VS Code settings from webview

### Technical Details
- Built with TypeScript for type safety
- Uses VS Code Webview API for embedded player
- Integrates with YouTube Data API v3 for recommendations
- Follows VS Code extension best practices
- Comprehensive error handling and user feedback 