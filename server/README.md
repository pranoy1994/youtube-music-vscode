# YouTube Music Streaming Server

A Node.js server that provides audio streaming endpoints for the YouTube Music Streamer VS Code extension.

## Features

- 🎵 Stream YouTube audio directly from video IDs
- 🔄 CORS enabled for VS Code webview integration
- 📊 Health check endpoint
- 🛡️ Error handling and validation
- 📱 Range request support for audio seeking
- 📋 Video metadata endpoint

## Quick Start

### Installation

```bash
cd server
npm install
```

### Start the Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

The server will start on `http://localhost:3000`

## API Endpoints

### Health Check
```http
GET /health
```

Returns server status and timestamp.

**Response:**
```json
{
  "status": "OK",
  "message": "YouTube Music Streaming Server is running",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### Stream Audio
```http
GET /stream/:videoId
```

Streams audio from a YouTube video.

**Parameters:**
- `videoId` (string): 11-character YouTube video ID

**Example:**
```bash
curl http://localhost:3000/stream/dQw4w9WgXcQ
```

**Response:**
- **200**: Audio stream (audio/mpeg)
- **400**: Invalid video ID format
- **404**: Video not found or no audio available
- **500**: Streaming error

### Get Video Info
```http
GET /info/:videoId
```

Returns metadata for a YouTube video.

**Response:**
```json
{
  "title": "Video Title",
  "author": "Channel Name",
  "lengthSeconds": "180",
  "viewCount": "1000000",
  "description": "Video description...",
  "thumbnails": [...]
}
```

## Usage with VS Code Extension

The server is designed to work with the YouTube Music Streamer VS Code extension. The extension sends requests to:

```
http://localhost:3000/stream/<youtube_video_id>
```

## Configuration

### Environment Variables

- `PORT` (default: 3000): Server port number

### CORS Configuration

The server is configured to accept requests from:
- `vscode-webview://*` (VS Code webviews)
- `http://localhost:*` (Local development)

## Error Handling

The server includes comprehensive error handling for:

- Invalid video IDs
- Unavailable videos
- Network errors
- Stream interruptions
- Client disconnections

## Dependencies

- **express**: Web server framework
- **cors**: Cross-Origin Resource Sharing
- **ytdl-core**: YouTube video downloader
- **nodemon**: Development auto-reload (dev dependency)

## Troubleshooting

### Common Issues

1. **"Video not found"**
   - Check if the video ID is correct (11 characters)
   - Verify the video exists and is publicly available
   - Some videos may have geographic restrictions

2. **"No audio format available"**
   - The video may not have downloadable audio streams
   - Try a different video

3. **CORS errors**
   - Ensure the server is running on localhost:3000
   - Check VS Code webview security policies

4. **Stream interruptions**
   - Network connectivity issues
   - YouTube rate limiting
   - Video availability changes

### Debug Mode

Start the server with debug logging:

```bash
DEBUG=* npm start
```

### Testing

Test the server endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Stream test (replace with actual video ID)
curl -I http://localhost:3000/stream/dQw4w9WgXcQ

# Info test
curl http://localhost:3000/info/dQw4w9WgXcQ
```

## Security Considerations

- The server only streams publicly available YouTube content
- No authentication or user data storage
- CORS is configured for VS Code webviews only
- Video IDs are validated for format and safety

## Legal Notice

This server is for educational and personal use only. Ensure you comply with:
- YouTube's Terms of Service
- Copyright laws in your jurisdiction
- Any applicable streaming regulations

The server does not store or redistribute content, it only provides streaming access to publicly available YouTube audio.

## License

MIT License - see LICENSE file for details. 