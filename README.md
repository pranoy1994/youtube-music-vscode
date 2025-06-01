# YouTube Music Streamer - VS Code Extension

A feature-rich VS Code extension that lets you stream YouTube music directly inside your editor using the YouTube Data API v3 and a custom audio backend.

![YouTube Music Streamer](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0-green.svg)

## ✨ Features

- **🔥 Real YouTube Data**: Fetches trending, search results, and regional content using YouTube API v3
- **🎵 Three Music Tabs**: Trending, Search, and Regional (India/UK)
- **🎮 Status Bar Integration**: Music player status and controls in VS Code status bar
- **🔍 YouTube Search**: Search for any music directly within VS Code with real results
- **📻 Audio Streaming**: Stream audio from `localhost:3000/stream/<youtube_id>`
- **🔄 Smart Autoplay**: Automatically finds and plays similar songs when current song ends
- **⚡ Preloading**: Next song is preloaded for seamless playback transitions
- **🎨 Dark Mode Friendly**: Matches VS Code theme automatically
- **⌨️ Keyboard Shortcuts**: Quick access with `Ctrl+Shift+Y` (or `Cmd+Shift+Y` on Mac)
- **📱 Responsive UI**: Clean, modern interface with VS Code native styling
- **⚙️ Configurable**: API key, max results, region settings

## 🚀 Quick Start

### Prerequisites

1. **VS Code** (version 1.60.0 or higher)
2. **Node.js** (version 16 or higher)
3. **YouTube Data API v3 Key** (see [API Setup](#youtube-api-setup))
4. **Streaming Server** running on `localhost:3000` (see [Backend Setup](#backend-setup))

### Installation

1. **Clone or Download** this repository
2. **Open** the project folder in VS Code
3. **Install Dependencies**:
   ```bash
   npm install
   ```
4. **Compile TypeScript**:
   ```bash
   npm run compile
   ```
5. **Configure API Key** (see [YouTube API Setup](#youtube-api-setup))
6. **Press F5** to launch a new Extension Development Host window
7. **Test the extension** in the new VS Code window

### Alternative Installation

1. **Package the extension**:
   ```bash
   npm install -g vsce
   vsce package
   ```
2. **Install the `.vsix` file** in VS Code:
   - `Ctrl+Shift+P` → "Extensions: Install from VSIX..."
   - Select the generated `.vsix` file

## 🔑 YouTube API Setup

### 1. Get Your API Key

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select an existing one
3. **Enable the YouTube Data API v3**:
   - Go to "APIs & Services" > "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"
4. **Create API credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the generated API key

### 2. Configure in VS Code

1. **Open VS Code Settings**: `Ctrl+,` (or `Cmd+,` on Mac)
2. **Search for**: "YouTube Music Streamer"
3. **Set your API key** in `youtubeMusicStreamer.apiKey`
4. **Optional**: Configure other settings:
   - `maxResults`: Number of results per request (5-50, default: 25)
   - `region`: Region code for content (US, IN, GB, etc.)
   - `autoStart`: Auto-open player when VS Code starts

### 3. API Usage & Limits

- **Free Quota**: 10,000 requests per day
- **Extension Usage**: ~2-5 requests per action
- **Estimated Daily Usage**: 2000+ searches/loads per day
- **No Authentication Required**: Only API key needed

## 🎯 Usage

### Opening the Music Player

1. **Command Palette**: `Ctrl+Shift+P` → "Open YouTube Music Player"
2. **Keyboard Shortcut**: `Ctrl+Shift+Y` (or `Cmd+Shift+Y` on Mac)
3. **Status Bar**: Click the music icon in the status bar

### Navigation

- **Trending Tab**: Real-time trending music videos from YouTube
- **Search Tab**: Search YouTube for any music with live results
- **Regional Tab**: Popular music in different regions (India/UK)

### Playing Music

1. **Click** any "Play" button next to a song
2. **Audio player** appears at the bottom
3. **Status bar** shows currently playing song
4. **Use HTML5 controls** for playback control
5. **Click "Close"** to stop playback

### Smart Autoplay Feature

The extension includes an intelligent autoplay system:

1. **Automatic Discovery**: When you play a song, the extension automatically searches for similar songs
2. **Preloading**: The next song is preloaded in the background for seamless transitions
3. **Auto-Advance**: When the current song ends, the next similar song automatically starts playing
4. **Queue Management**: Maintains a queue of similar songs for continuous playback
5. **Toggle Control**: Click the autoplay button (🔄) in the player to enable/disable autoplay

**Next Song Display**: The player shows "Up Next" information with:
- Thumbnail of the next song
- Song title and artist
- Autoplay toggle button

**How Similar Songs Are Found**:
- Searches for songs by the same artist
- Looks for music similar to the current song
- Uses YouTube's music categorization
- Filters out duplicates and inappropriate content

### Refreshing Content

- **Click "Refresh"** buttons to get latest data
- **Data updates** automatically when switching tabs
- **Search** provides real-time results

## 🔧 Backend Setup

The extension requires a streaming server running on `localhost:3000`. Here's a simple Node.js server example:

### Simple Streaming Server

Create a new directory for your backend:

```bash
mkdir youtube-music-server
cd youtube-music-server
npm init -y
npm install express cors ytdl-core
```

Create `server.js`:

```javascript
const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const PORT = 3000;

app.use(cors());

app.get('/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const videoURL = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Get video info
    const info = await ytdl.getInfo(videoURL);
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    
    if (audioFormats.length === 0) {
      return res.status(404).json({ error: 'No audio format found' });
    }
    
    // Set headers for audio streaming
    res.set({
      'Content-Type': 'audio/mpeg',
      'Accept-Ranges': 'bytes',
    });
    
    // Stream the audio
    const audioStream = ytdl(videoURL, {
      quality: 'lowestaudio',
      filter: 'audioonly',
    });
    
    audioStream.pipe(res);
    
    audioStream.on('error', (err) => {
      console.error('Streaming error:', err);
      res.status(500).json({ error: 'Streaming failed' });
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🎵 YouTube Music Server running on http://localhost:${PORT}`);
});
```

Run the server:

```bash
node server.js
```

## 📋 Commands & Settings

### Commands

| Command | Description | Keyboard Shortcut |
|---------|-------------|-------------------|
| `youtubeMusicStreamer.openPlayer` | Open the music player | `Ctrl+Shift+Y` |
| `youtubeMusicStreamer.togglePlayer` | Toggle player visibility | - |

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `youtubeMusicStreamer.apiKey` | string | "" | YouTube Data API v3 key |
| `youtubeMusicStreamer.maxResults` | number | 25 | Max results per request (5-50) |
| `youtubeMusicStreamer.region` | string | "US" | Region code (US, IN, GB, etc.) |
| `youtubeMusicStreamer.autoStart` | boolean | false | Auto-open on VS Code start |

## 🎨 Advanced Configuration

### Custom Region Codes

You can set any valid YouTube region code:

- **US**: United States
- **IN**: India  
- **GB**: United Kingdom
- **CA**: Canada
- **AU**: Australia
- **DE**: Germany
- **JP**: Japan
- **KR**: South Korea

### API Optimization

To optimize API usage:

1. **Set reasonable maxResults** (10-25 recommended)
2. **Use specific search terms** to get better results
3. **Avoid frequent refreshing** to save quota
4. **Monitor usage** in Google Cloud Console

### Error Handling

The extension includes comprehensive error handling:

- **API key validation**
- **Network error recovery** 
- **Rate limit handling**
- **Invalid video ID detection**
- **Server connection issues**

## 🛠️ Development

### Build Scripts

```bash
# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Lint code
npm run lint

# Run tests
npm run test

# Package extension
npm run vscode:prepublish
```

### Project Structure

```
youtube-music-streamer/
├── src/
│   └── extension.ts          # Main extension logic with API integration
├── server/
│   ├── package.json         # Server dependencies
│   ├── server.js           # Audio streaming server
│   └── README.md           # Server documentation
├── package.json             # Extension manifest with settings
├── tsconfig.json           # TypeScript configuration
├── README.md               # This file
└── out/                    # Compiled JavaScript
```

### Extension API Usage

- **WebviewPanel**: Creates the music player interface
- **StatusBarItem**: Shows playback status
- **Commands**: Registers extension commands
- **Configuration**: Manages API key and settings
- **Message Passing**: Communication between webview and extension

## 🐛 Troubleshooting

### Common Issues

1. **"YouTube API key not configured"**
   - Set your API key in VS Code settings
   - Verify the key is valid in Google Cloud Console
   - Check API is enabled and has quota

2. **"API Error: 403"**
   - API key might be invalid or restricted
   - Check YouTube Data API v3 is enabled
   - Verify API key permissions

3. **"API Error: 429"**
   - Rate limit exceeded
   - Wait a few minutes before trying again
   - Consider reducing maxResults setting

4. **"Audio not playing"**
   - Verify streaming server is running on `localhost:3000`
   - Check browser/VS Code audio permissions
   - Test server endpoint manually

5. **"No results found"**
   - Try different search terms
   - Check your region setting
   - Verify API key has quota remaining

### Debug Mode

1. **Open VS Code Developer Tools**: `Help > Toggle Developer Tools`
2. **Check Console** for API responses and errors
3. **Monitor Network** tab for API calls
4. **Set breakpoints** in `src/extension.ts`

### API Debugging

Test your API key manually:

```bash
# Test API key
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=music&type=video&key=YOUR_API_KEY"

# Check quota usage
# Go to Google Cloud Console > APIs & Services > Quotas
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/awesome-feature`
3. **Commit** changes: `git commit -am 'Add awesome feature'`
4. **Push** to branch: `git push origin feature/awesome-feature`
5. **Create** a Pull Request

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-username/youtube-music-streamer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-username/youtube-music-streamer/discussions)

## 🔮 Roadmap

- [x] ~~Real YouTube API integration~~
- [ ] Playlist support
- [ ] Download functionality
- [ ] Lyrics display
- [ ] Queue management
- [ ] Keyboard media controls
- [ ] Cross-device synchronization
- [ ] Multiple region support
- [ ] Custom playlists
- [ ] Favorites system

## ⚖️ Legal & Privacy

- **YouTube Terms**: This extension complies with YouTube's Terms of Service
- **API Usage**: Only accesses publicly available data
- **No Data Storage**: Extension doesn't store personal data
- **Privacy**: Only API key is stored locally in VS Code settings

---

**Happy Coding with Music! 🎵🚀** 