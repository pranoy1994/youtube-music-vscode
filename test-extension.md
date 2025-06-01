# Testing the YouTube Music Streamer Extension

This guide will help you test the YouTube Music Streamer VS Code extension with real YouTube API integration.

## Prerequisites

1. **VS Code** (version 1.60.0 or higher)
2. **Node.js** (version 16 or higher)
3. **YouTube Data API v3 Key** (required for real data)
4. **Extension compiled** and ready

## Step 1: Get YouTube API Key

### Create API Key
1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create a new project** or select existing
3. **Enable YouTube Data API v3**:
   - APIs & Services > Library
   - Search "YouTube Data API v3"
   - Click Enable
4. **Create credentials**:
   - APIs & Services > Credentials
   - Create Credentials > API Key
   - Copy the key

### Test API Key
```bash
# Test your API key
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&q=music&type=video&key=YOUR_API_KEY"

# Should return JSON with video results
```

## Step 2: Start the Streaming Server

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start the server
npm start
```

You should see:
```
🎵 ==========================================
🎵 YouTube Music Streaming Server Started
🎵 ==========================================
🌐 Server running at: http://localhost:3000
💡 Health check: http://localhost:3000/health
🎧 Stream example: http://localhost:3000/stream/dQw4w9WgXcQ
🎵 ==========================================
```

## Step 3: Configure the Extension

### Open Extension Development Host

1. **Open** the extension project in VS Code
2. **Press F5** to launch Extension Development Host
3. **Wait** for the new VS Code window to open

### Configure API Key

1. **Open Settings**: `Ctrl+,` (or `Cmd+,` on Mac)
2. **Search**: "YouTube Music Streamer"
3. **Set API Key**: Paste your YouTube API key
4. **Optional Settings**:
   - Max Results: 25 (recommended)
   - Region: US, IN, GB, etc.
   - Auto Start: false (recommended for testing)

## Step 4: Test Extension Activation

### Test Command Activation

1. **Press Ctrl+Shift+P** (or Cmd+Shift+P on Mac)
2. **Type**: "Open YouTube Music Player"
3. **Press Enter**

**Expected Result**: 
- Webview panel opens with three tabs: Trending, Search, Regional
- Status bar shows music icon
- No API warning if key is configured

### Test Status Bar Integration

1. **Look** at the bottom status bar
2. **Find** the music icon (🎵 Music)
3. **Click** the music icon

**Expected Result**: Should toggle the music player on/off

### Test Keyboard Shortcut

1. **Press Ctrl+Shift+Y** (or Cmd+Shift+Y on Mac)

**Expected Result**: Should open/close the music player

### Test Settings Button

1. **Click** the ⚙️ Settings button in the header
2. **Should open** VS Code settings for the extension

## Step 5: Test Real YouTube Data

### Test Trending Tab

1. **Open** the music player
2. **Ensure** "Trending" tab is selected
3. **Wait** for data to load

**Expected Results**:
- Shows loading spinner initially
- Loads real trending music videos
- Displays titles, artists, thumbnails, view counts
- Shows "Refresh" button
- Info message: "Loaded X trending music videos"

### Test Search Functionality

1. **Click** the "Search" tab
2. **Type** a search query (e.g., "Adele")
3. **Click** "Search" or press Enter

**Expected Results**:
- Shows "Searching..." with spinner
- Button becomes disabled during search
- Displays real YouTube search results
- Shows titles, artists, thumbnails
- Info message: "Found X results for 'query'"

### Test Regional Tab

1. **Click** the "Regional" tab

**Expected Results**:
- Shows "Popular in India" section
- Shows "Popular in UK" section  
- Loads real regional trending data
- Each section has refresh button
- Different content based on region

### Test Refresh Functionality

1. **Click** any "Refresh" button
2. **Observe** loading behavior

**Expected Results**:
- Shows loading spinner
- Fetches fresh data from YouTube
- Updates content with new results

## Step 6: Test Music Playback

### Test Audio Streaming

1. **Click** any "Play" button
2. **Observe** playback behavior

**Expected Results**:
- Audio player appears at bottom
- Status bar updates: "🎵 [Song Title]"
- Music starts playing from localhost:3000
- HTML5 controls work (play, pause, seek)

### Test Player Controls

1. **Use** HTML5 audio controls
2. **Test** volume, seeking, pause/play
3. **Click** "Close" button

**Expected Results**:
- All controls work properly
- Close button stops playback
- Status bar resets to "🎵 Music"
- Player disappears

## Step 7: Test Error Handling

### Test Without API Key

1. **Clear** API key in settings
2. **Reload** extension (`Ctrl+R` in Extension Development Host)
3. **Try** to load any tab

**Expected Results**:
- Shows API warning message
- "Open Settings" button works
- Graceful degradation

### Test Invalid API Key

1. **Set** invalid API key (e.g., "invalid123")
2. **Try** to search or load trending

**Expected Results**:
- Shows API error message
- Error displayed in tab content
- Proper error handling

### Test Without Server

1. **Stop** streaming server (Ctrl+C)
2. **Try** to play any song

**Expected Results**:
- Shows error about server connection
- Graceful error handling

### Test Rate Limiting

1. **Make many rapid requests** (search multiple times quickly)
2. **Observe** behavior

**Expected Results**:
- Should handle rate limits gracefully
- Show appropriate error messages

## Step 8: Test Real-World Scenarios

### Test Various Search Terms

Try searching for:
- **Popular artists**: "Taylor Swift", "Ed Sheeran"
- **Genres**: "jazz music", "rock songs"
- **Languages**: "bollywood songs", "k-pop"
- **Specific songs**: "Shape of You", "Blinding Lights"

**Expected Results**:
- Relevant results for each search
- Proper thumbnails and metadata
- Playable video IDs

### Test Different Regions

1. **Change region** in settings (IN, GB, CA, etc.)
2. **Refresh** trending and regional tabs

**Expected Results**:
- Content changes based on region
- Regional preferences reflected
- Different trending videos

### Test Edge Cases

- **Empty search** queries
- **Very long** search queries
- **Special characters** in search
- **Network interruptions**

## Step 9: Performance Testing

### Test Loading Times

1. **Measure** time for trending to load
2. **Measure** search response time
3. **Test** with different maxResults settings

**Expected Performance**:
- Trending: < 3 seconds
- Search: < 2 seconds  
- Regional: < 3 seconds

### Test Memory Usage

1. **Open** VS Code Task Manager (`Ctrl+Shift+P` → "Task Manager")
2. **Monitor** extension memory usage
3. **Test** extended usage

**Expected Behavior**:
- Reasonable memory usage
- No significant memory leaks
- Stable performance over time

### Test API Quota Usage

1. **Monitor** API usage in Google Cloud Console
2. **Track** requests per action
3. **Estimate** daily usage

**Expected Usage**:
- ~2-3 requests per trending load
- ~1 request per search
- ~2-4 requests per regional load

## Success Criteria

✅ **Extension loads without errors**  
✅ **API key configuration works**  
✅ **Real YouTube data loads**  
✅ **Search returns relevant results**  
✅ **Regional content loads properly**  
✅ **Audio streaming works**  
✅ **Error handling works gracefully**  
✅ **Settings integration works**  
✅ **Status bar updates correctly**  
✅ **Performance is acceptable**  
✅ **API quota usage is reasonable**  

## Troubleshooting Test Issues

### API Related Issues

**Problem**: "API Error: 403"
- **Solution**: Check API key validity, ensure YouTube Data API v3 is enabled

**Problem**: "API Error: 429"  
- **Solution**: Rate limit reached, wait or reduce maxResults

**Problem**: No results returned
- **Solution**: Try different search terms, check region settings

### Extension Issues

**Problem**: Extension not loading
- **Solution**: Run `npm run compile`, check for TypeScript errors

**Problem**: Settings not saving
- **Solution**: Check VS Code settings scope (user vs workspace)

**Problem**: Webview not updating
- **Solution**: Check message passing, reload extension

### Server Issues

**Problem**: Audio not streaming
- **Solution**: Verify server running, check CORS configuration

**Problem**: Stream interruptions
- **Solution**: Check ytdl-core version, test with different videos

## Next Steps After Testing

1. **Package extension**: `vsce package`
2. **Test .vsix installation**
3. **Document any issues** found
4. **Optimize API usage** based on testing
5. **Consider additional features** from roadmap

## API Usage Monitoring

After testing, monitor your usage:

1. **Go to Google Cloud Console**
2. **Check APIs & Services > Quotas**
3. **Monitor daily usage**
4. **Set up alerts** if needed

**Recommended Daily Limits**:
- Development: 1,000 requests
- Testing: 2,000 requests  
- Production: 5,000+ requests

---

**Happy Testing! 🎵🧪** 