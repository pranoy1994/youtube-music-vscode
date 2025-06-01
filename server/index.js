const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Cache for video info to prevent double fetching
const videoInfoCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function isValidVideoId(videoId) {
    return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

// Helper function to get cached video info or fetch new
async function getCachedVideoInfo(url) {
    const cacheKey = url;
    const cached = videoInfoCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log(`📦 Using cached video info`);
        return cached.info;
    }
    
    console.log(`🔄 Fetching fresh video info`);
    const info = await ytdl.getInfo(url);
    videoInfoCache.set(cacheKey, {
        info,
        timestamp: Date.now()
    });
    
    return info;
}

// Handle OPTIONS requests for CORS
app.options('*', (req, res) => {
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'range, content-type, accept',
        'Access-Control-Max-Age': '86400'
    });
    res.sendStatus(200);
});

// Route: Stream audio with proper chunking and range support
app.get('/stream/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        console.log(`\n=== STREAM REQUEST ===`);
        console.log(`Video ID: ${videoId}`);
        console.log(`Method: ${req.method}`);
        console.log(`Range: ${req.headers.range || 'None'}`);
        
        // Validate video ID
        if (!isValidVideoId(videoId)) {
            console.log(`❌ Invalid video ID: ${videoId}`);
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Validate URL first
        if (!ytdl.validateURL(url)) {
            console.log(`❌ Invalid YouTube URL: ${url}`);
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get cached video info to prevent double fetching
        const info = await getCachedVideoInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        console.log(`📊 Found ${audioFormats.length} audio formats (from cache: ${videoInfoCache.has(url)})`);
        
        if (audioFormats.length === 0) {
            console.log(`❌ No audio formats available`);
            return res.status(404).json({ error: 'No audio formats available for this video' });
        }

        // Choose the best audio format - avoid tiny quality
        let bestAudio;
        try {
            // First try to get high quality audio
            bestAudio = ytdl.chooseFormat(audioFormats, { quality: 'highestaudio' });
            
            // If the selected format is "tiny", try to find a better one
            if (bestAudio.quality === 'tiny' || bestAudio.qualityLabel === 'tiny') {
                console.log(`⚠️ Selected format is tiny quality, looking for better options...`);
                
                // Find formats that are not tiny
                const betterFormats = audioFormats.filter(f => 
                    f.quality !== 'tiny' && 
                    f.qualityLabel !== 'tiny' && 
                    (f.audioBitrate >= 128 || !f.audioBitrate)
                );
                
                if (betterFormats.length > 0) {
                    bestAudio = ytdl.chooseFormat(betterFormats, { quality: 'highestaudio' });
                    console.log(`✅ Found better format: ${bestAudio.container} - ${bestAudio.qualityLabel || bestAudio.quality}`);
                }
            }
        } catch (formatError) {
            console.log(`⚠️ Error choosing format, using first available: ${formatError.message}`);
            bestAudio = audioFormats[0];
        }
        
        console.log(`🎯 Selected format: ${bestAudio.container} - ${bestAudio.qualityLabel || bestAudio.quality} - ${bestAudio.audioBitrate || 'unknown'}kbps`);

        // Set appropriate headers based on the audio format
        const contentType = bestAudio.container === 'webm' ? 'audio/webm' : 
                           bestAudio.container === 'mp4' ? 'audio/mp4' : 
                           bestAudio.container === 'm4a' ? 'audio/mp4' : 'audio/webm';

        // Get content length if available
        const contentLength = bestAudio.contentLength ? parseInt(bestAudio.contentLength) : null;

        // Handle range requests for chunked streaming
        const range = req.headers.range;
        let start = 0;
        let end = contentLength ? contentLength - 1 : null;
        
        if (range && contentLength) {
            const parts = range.replace(/bytes=/, "").split("-");
            start = parseInt(parts[0], 10);
            end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
            
            console.log(`📍 Range request: ${start}-${end} (${Math.round((end - start) / 1024)}KB chunk)`);
            
            res.status(206); // Partial Content
            res.set({
                'Content-Range': `bytes ${start}-${end}/${contentLength}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': (end - start + 1).toString()
            });
        } else {
            console.log(`📍 Full content request`);
            res.set({
                'Accept-Ranges': 'bytes'
            });
            if (contentLength) {
                res.set('Content-Length', contentLength.toString());
            }
        }

        // Set streaming headers
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': 'range, content-type, accept',
            'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
            'Content-Disposition': `inline; filename="${info.videoDetails.title.replace(/[^a-zA-Z0-9]/g, '_')}.${bestAudio.container}"`,
        });

        console.log(`🚀 Starting chunked stream...`);

        // Create audio stream with range support
        const streamOptions = {
            format: bestAudio,
            highWaterMark: 1024 * 512, // 512KB chunks for better streaming
        };

        // Add range options if this is a range request
        if (range && start !== undefined && end !== undefined) {
            streamOptions.range = { start, end };
        }

        const audioStream = ytdl(url, streamOptions);

        let bytesStreamed = 0;
        let lastLogTime = Date.now();

        // Handle stream data with progress tracking
        audioStream.on('data', (chunk) => {
            bytesStreamed += chunk.length;
            const now = Date.now();
            
            // Log progress every 500KB or every 3 seconds
            if (bytesStreamed % (512 * 1024) === 0 || now - lastLogTime > 3000) {
                const mbStreamed = Math.round(bytesStreamed / (1024 * 1024) * 100) / 100;
                const totalMB = contentLength ? Math.round(contentLength / (1024 * 1024) * 100) / 100 : '?';
                console.log(`📊 Chunk streamed: ${mbStreamed}MB / ${totalMB}MB`);
                lastLogTime = now;
            }
        });

        // Handle stream errors
        audioStream.on('error', (error) => {
            console.error('❌ Stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream audio', details: error.message });
            } else {
                res.end();
            }
        });

        // Handle stream end
        audioStream.on('end', () => {
            const mbStreamed = Math.round(bytesStreamed / (1024 * 1024) * 100) / 100;
            console.log(`✅ Stream chunk completed: ${mbStreamed}MB`);
        });

        // Pipe the audio stream to response
        audioStream.pipe(res);

        // Handle client disconnect
        req.on('close', () => {
            const mbStreamed = Math.round(bytesStreamed / (1024 * 1024) * 100) / 100;
            if (bytesStreamed > 0) {
                console.log(`👋 Client disconnected after ${mbStreamed}MB`);
            } else {
                console.log(`⚠️ Client disconnected immediately`);
            }
            audioStream.destroy();
        });

        // Handle response errors
        res.on('error', (error) => {
            console.error('❌ Response error:', error.message);
            audioStream.destroy();
        });

    } catch (error) {
        console.error('❌ Error streaming audio:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream audio', details: error.message });
        }
    }
});

// Route: Get video information using ytdl-core
app.get('/info/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!isValidVideoId(videoId)) {
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        // Validate URL first
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log(`📋 Getting info for: ${videoId}`);
        
        // Use cached video info to prevent double fetching
        const info = await getCachedVideoInfo(url);
        const videoDetails = info.videoDetails;
        
        // Return formatted info
        res.json({
            id: videoDetails.videoId,
            title: videoDetails.title,
            author: videoDetails.author.name,
            duration: parseInt(videoDetails.lengthSeconds),
            uploaded: videoDetails.uploadDate,
            description: videoDetails.description,
            url: videoDetails.video_url,
            thumbnail: videoDetails.thumbnails && videoDetails.thumbnails.length > 0 
                ? videoDetails.thumbnails[videoDetails.thumbnails.length - 1].url 
                : null,
            viewCount: parseInt(videoDetails.viewCount),
            likes: videoDetails.likes || null,
            category: videoDetails.category || null
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information', details: error.message });
    }
});

// Route: Search YouTube videos (placeholder - requires additional package)
app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q) {
            return res.status(400).json({ error: 'Search query is required' });
        }

        console.log(`Search requested for: ${q}`);
        
        // Note: ytdl-core doesn't have built-in search functionality
        res.json({
            message: 'Search functionality requires YouTube Data API v3 or additional packages',
            suggestion: 'Use YouTube Data API v3, youtube-search package, or provide direct YouTube URLs',
            query: q,
            examples: [
                'Try using a direct YouTube URL instead',
                'Example: /info/dQw4w9WgXcQ for Rick Astley - Never Gonna Give You Up'
            ]
        });

    } catch (error) {
        console.error('Error with search:', error);
        res.status(500).json({ error: 'Search functionality not available', details: error.message });
    }
});

// Route: Validate YouTube URL
app.get('/validate/:videoId', (req, res) => {
    try {
        const { videoId } = req.params;
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        const isValidId = isValidVideoId(videoId);
        const isValidUrl = ytdl.validateURL(url);
        
        res.json({
            videoId,
            isValidId,
            isValidUrl,
            extractedId: isValidId ? videoId : null,
            fullUrl: isValidUrl ? url : null
        });

    } catch (error) {
        res.json({
            videoId: req.params.videoId,
            isValidId: false,
            isValidUrl: false,
            error: error.message
        });
    }
});

// Route: Check if video is available for streaming
app.get('/check/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!isValidVideoId(videoId)) {
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.json({
                videoId,
                available: false,
                reason: 'Invalid YouTube URL'
            });
        }

        // Check if video info can be fetched (indicates availability)
        try {
            const info = await getCachedVideoInfo(url);
            const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
            const hasAudio = audioFormats.length > 0;
            
            res.json({
                videoId,
                available: true,
                title: info.videoDetails.title,
                duration: parseInt(info.videoDetails.lengthSeconds),
                hasAudio,
                audioFormats: audioFormats.length,
                isLive: info.videoDetails.isLiveContent
            });
        } catch (infoError) {
            res.json({
                videoId,
                available: false,
                reason: infoError.message
            });
        }

    } catch (error) {
        console.error('Error checking video availability:', error);
        res.status(500).json({ error: 'Failed to check video availability', details: error.message });
    }
});

// Route: Get available formats for a video
app.get('/formats/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!isValidVideoId(videoId)) {
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        const info = await getCachedVideoInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        const formattedFormats = audioFormats.map(format => ({
            itag: format.itag,
            container: format.container,
            quality: format.qualityLabel || format.quality,
            audioCodec: format.audioCodec,
            bitrate: format.audioBitrate,
            sampleRate: format.audioSampleRate,
            channels: format.audioChannels,
            contentLength: format.contentLength
        }));

        res.json({
            videoId,
            title: info.videoDetails.title,
            audioFormats: formattedFormats,
            totalFormats: formattedFormats.length
        });

    } catch (error) {
        console.error('Error fetching formats:', error);
        res.status(500).json({ error: 'Failed to fetch video formats', details: error.message });
    }
});

// Route: Get direct stream URL
app.get('/stream-url/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!isValidVideoId(videoId)) {
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        const info = await getCachedVideoInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        if (audioFormats.length === 0) {
            return res.status(404).json({ error: 'No audio formats available for this video' });
        }

        // Get the highest quality audio format
        const bestAudio = ytdl.chooseFormat(audioFormats, { quality: 'highestaudio' });
        
        res.json({
            videoId,
            title: info.videoDetails.title,
            streamUrl: bestAudio.url,
            format: {
                itag: bestAudio.itag,
                container: bestAudio.container,
                quality: bestAudio.qualityLabel || bestAudio.quality,
                audioCodec: bestAudio.audioCodec,
                bitrate: bestAudio.audioBitrate,
                contentLength: bestAudio.contentLength
            }
        });

    } catch (error) {
        console.error('Error getting stream URL:', error);
        res.status(500).json({ error: 'Failed to get stream URL', details: error.message });
    }
});

// Route: Test endpoint for debugging streaming issues
app.get('/test/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        if (!isValidVideoId(videoId)) {
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        console.log(`🧪 Testing video: ${videoId}`);
        
        const info = await getCachedVideoInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        const bestAudio = ytdl.chooseFormat(audioFormats, { quality: 'highestaudio' });
        
        res.json({
            video: {
                title: info.videoDetails.title,
                author: info.videoDetails.author.name,
                duration: parseInt(info.videoDetails.lengthSeconds),
                lengthSeconds: info.videoDetails.lengthSeconds
            },
            selectedFormat: {
                itag: bestAudio.itag,
                container: bestAudio.container,
                quality: bestAudio.qualityLabel || bestAudio.quality,
                audioCodec: bestAudio.audioCodec,
                bitrate: bestAudio.audioBitrate,
                sampleRate: bestAudio.audioSampleRate,
                url: bestAudio.url,
                contentLength: bestAudio.contentLength
            },
            allAudioFormats: audioFormats.map(format => ({
                itag: format.itag,
                container: format.container,
                quality: format.qualityLabel || format.quality,
                audioCodec: format.audioCodec,
                bitrate: format.audioBitrate,
                contentLength: format.contentLength
            })),
            streamUrls: {
                server: `/stream/${videoId}`,
                direct: `/stream-url/${videoId}`
            },
            cacheInfo: {
                cached: videoInfoCache.has(url),
                cacheSize: videoInfoCache.size
            }
        });

    } catch (error) {
        console.error('Error testing video:', error);
        res.status(500).json({ error: 'Failed to test video', details: error.message });
    }
});

// Route: Simple HTML test page for browser debugging
app.get('/test-page/:videoId', (req, res) => {
    const { videoId } = req.params;
    
    const html = `<!DOCTYPE html>
<html>
<head>
    <title>YouTube Audio Stream Test</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .container { max-width: 800px; margin: 0 auto; }
        .test-section { margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 5px; }
        button { padding: 10px 20px; margin: 5px; cursor: pointer; }
        audio { width: 100%; margin: 10px 0; }
        .log { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 3px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎵 YouTube Audio Stream Test</h1>
        <p><strong>Video ID:</strong> ${videoId}</p>
        
        <div class="test-section">
            <h3>🎧 Audio Player Test</h3>
            <audio controls id="audioPlayer">
                <source src="/stream/${videoId}" type="audio/webm">
                <source src="/stream/${videoId}" type="audio/mp4">
                Your browser does not support the audio element.
            </audio>
            <br>
            <button onclick="loadStream()">🔄 Reload Stream</button>
            <button onclick="testFormats()">📋 Test Formats</button>
        </div>
        
        <div class="test-section">
            <h3>🔗 Direct Links</h3>
            <p><a href="/stream/${videoId}" target="_blank">Direct Stream Link</a></p>
            <p><a href="/stream-url/${videoId}" target="_blank">Get Stream URL</a></p>
            <p><a href="/info/${videoId}" target="_blank">Video Info</a></p>
            <p><a href="/test/${videoId}" target="_blank">Debug Info</a></p>
        </div>
        
        <div class="test-section">
            <h3>📊 Browser Info</h3>
            <div id="browserInfo"></div>
        </div>
        
        <div class="test-section">
            <h3>📝 Debug Log</h3>
            <div id="debugLog" class="log">Loading...</div>
        </div>
    </div>

    <script>
        const debugLog = document.getElementById('debugLog');
        const audioPlayer = document.getElementById('audioPlayer');
        
        function log(message) {
            const timestamp = new Date().toLocaleTimeString();
            debugLog.innerHTML += timestamp + ': ' + message + '\\n';
            debugLog.scrollTop = debugLog.scrollHeight;
            console.log(message);
        }
        
        function loadStream() {
            log('🔄 Reloading audio stream...');
            audioPlayer.load();
        }
        
        async function testFormats() {
            try {
                log('📋 Fetching available formats...');
                const response = await fetch('/test/${videoId}');
                const data = await response.json();
                log('✅ Available formats: ' + data.allAudioFormats.length);
                log('🎯 Selected: ' + data.selectedFormat.container + ' - ' + data.selectedFormat.quality);
            } catch (error) {
                log('❌ Error fetching formats: ' + error.message);
            }
        }
        
        // Audio player event listeners
        audioPlayer.addEventListener('loadstart', () => log('🎵 Audio: Load started'));
        audioPlayer.addEventListener('loadeddata', () => log('✅ Audio: Data loaded'));
        audioPlayer.addEventListener('canplay', () => log('✅ Audio: Can play'));
        audioPlayer.addEventListener('playing', () => log('▶️ Audio: Playing'));
        audioPlayer.addEventListener('pause', () => log('⏸️ Audio: Paused'));
        audioPlayer.addEventListener('ended', () => log('🏁 Audio: Ended'));
        audioPlayer.addEventListener('error', (e) => {
            log('❌ Audio Error: ' + (e.target.error ? e.target.error.message : 'Unknown error'));
        });
        
        // Display browser info
        document.getElementById('browserInfo').innerHTML = 
            '<strong>User Agent:</strong> ' + navigator.userAgent + '<br>' +
            '<strong>Audio Support:</strong> ' + (audioPlayer.canPlayType ? 'Yes' : 'No') + '<br>' +
            '<strong>WebM Support:</strong> ' + audioPlayer.canPlayType('audio/webm') + '<br>' +
            '<strong>MP4 Support:</strong> ' + audioPlayer.canPlayType('audio/mp4') + '<br>' +
            '<strong>OGG Support:</strong> ' + audioPlayer.canPlayType('audio/ogg');
        
        log('🚀 Test page loaded');
        log('🌐 Browser: ' + navigator.userAgent.split(' ').slice(-1)[0]);
    </script>
</body>
</html>`;
    
    res.set('Content-Type', 'text/html');
    res.send(html);
});

// Route: Alternative streaming endpoint optimized for browser compatibility
app.get('/stream-compat/:videoId', async (req, res) => {
    try {
        const { videoId } = req.params;
        
        console.log(`\n=== COMPATIBILITY STREAM REQUEST ===`);
        console.log(`Video ID: ${videoId}`);
        
        if (!isValidVideoId(videoId)) {
            return res.status(400).json({ error: 'Invalid YouTube video ID' });
        }

        const url = `https://www.youtube.com/watch?v=${videoId}`;
        
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log(`✅ Fetching video info for compatibility mode...`);

        const info = await getCachedVideoInfo(url);
        const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
        
        // Prefer MP4/M4A formats for better browser compatibility
        const mp4Formats = audioFormats.filter(f => 
            (f.container === 'mp4' || f.container === 'm4a') && 
            f.quality !== 'tiny' &&
            f.qualityLabel !== 'tiny'
        );
        
        const webmFormats = audioFormats.filter(f => 
            f.container === 'webm' && 
            f.quality !== 'tiny' &&
            f.qualityLabel !== 'tiny'
        );
        
        let selectedFormat;
        if (mp4Formats.length > 0) {
            selectedFormat = ytdl.chooseFormat(mp4Formats, { quality: 'highestaudio' });
            console.log(`🎯 Using MP4 format for compatibility: ${selectedFormat.qualityLabel || selectedFormat.quality}`);
        } else if (webmFormats.length > 0) {
            selectedFormat = ytdl.chooseFormat(webmFormats, { quality: 'highestaudio' });
            console.log(`🎯 Using WebM format: ${selectedFormat.qualityLabel || selectedFormat.quality}`);
        } else {
            selectedFormat = audioFormats[0];
            console.log(`⚠️ Using fallback format: ${selectedFormat.container}`);
        }

        const contentType = selectedFormat.container === 'mp4' || selectedFormat.container === 'm4a' ? 'audio/mp4' : 'audio/webm';

        // Simplified headers for maximum compatibility
        res.set({
            'Content-Type': contentType,
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Accept-Ranges': 'none', // Disable range requests
            'Content-Disposition': 'inline'
        });

        console.log(`🚀 Starting compatibility stream...`);

        const audioStream = ytdl(url, {
            format: selectedFormat,
            highWaterMark: 512 * 1024, // Smaller buffer for compatibility
        });

        let bytesStreamed = 0;

        audioStream.on('data', (chunk) => {
            bytesStreamed += chunk.length;
        });

        audioStream.on('error', (error) => {
            console.error('❌ Compatibility stream error:', error.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Streaming failed' });
            }
        });

        audioStream.on('end', () => {
            console.log(`✅ Compatibility stream completed: ${Math.round(bytesStreamed / (1024 * 1024) * 100) / 100}MB`);
        });

        audioStream.pipe(res);

        req.on('close', () => {
            const mbStreamed = Math.round(bytesStreamed / (1024 * 1024) * 100) / 100;
            console.log(`👋 Compatibility stream disconnected: ${mbStreamed}MB`);
            audioStream.destroy();
        });

    } catch (error) {
        console.error('❌ Compatibility streaming error:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to stream audio' });
        }
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        service: 'YouTube Audio Streaming Server',
        version: '3.0.0',
        dependencies: {
            '@distube/ytdl-core': 'Available',
            ffmpeg: 'Not required for this implementation'
        }
    });
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
    res.json({
        message: 'YouTube Audio Streaming Server',
        version: '3.0.0',
        description: 'Stream YouTube audio using @distube/ytdl-core package',
        features: [
            'Direct audio streaming without ffmpeg dependency',
            'Multiple audio quality options',
            'Real-time video information',
            'Format detection and validation'
        ],
        endpoints: {
            'GET /': 'This documentation',
            'GET /health': 'Health check and dependency status',
            'GET /stream/:videoId': 'Stream audio from YouTube video',
            'GET /info/:videoId': 'Get detailed video information',
            'GET /search?q=query': 'Search functionality (placeholder)',
            'GET /validate/:videoId': 'Validate YouTube video ID',
            'GET /check/:videoId': 'Check if video is available for streaming',
            'GET /formats/:videoId': 'Get available audio formats for video',
            'GET /stream-url/:videoId': 'Get direct stream URL for client-side streaming',
            'GET /test/:videoId': 'Test endpoint for debugging streaming issues',
            'GET /test-page/:videoId': 'Simple HTML test page for browser debugging'
        },
        examples: {
            stream: '/stream/dQw4w9WgXcQ',
            info: '/info/dQw4w9WgXcQ',
            validate: '/validate/dQw4w9WgXcQ',
            check: '/check/dQw4w9WgXcQ',
            formats: '/formats/dQw4w9WgXcQ',
            streamUrl: '/stream-url/dQw4w9WgXcQ',
            test: '/test/dQw4w9WgXcQ',
            testPage: '/test-page/dQw4w9WgXcQ'
        },
        notes: [
            'Video IDs must be exactly 11 characters (YouTube standard)',
            'Uses @distube/ytdl-core for enhanced reliability',
            'No ffmpeg dependency required for basic audio streaming',
            'Supports WebM audio format natively'
        ]
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Endpoint not found',
        message: `${req.method} ${req.path} is not a valid endpoint`,
        availableEndpoints: ['/', '/health', '/stream/:videoId', '/info/:videoId', '/validate/:videoId', '/check/:videoId', '/formats/:videoId', '/stream-url/:videoId', '/test/:videoId', '/test-page/:videoId']
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🎵 YouTube Audio Streaming Server v3.0.0 running on port ${PORT}`);
    console.log(`📖 API Documentation: http://localhost:${PORT}/`);
    console.log(`🔍 Video info example: http://localhost:${PORT}/info/dQw4w9WgXcQ`);
    console.log(`🎧 Stream example: http://localhost:${PORT}/stream/dQw4w9WgXcQ`);
    console.log(`🧪 Test endpoint: http://localhost:${PORT}/test/dQw4w9WgXcQ`);
    console.log(`✅ Ready to serve YouTube audio streams!`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully');
    process.exit(0);
});

module.exports = app;