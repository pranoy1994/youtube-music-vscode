import * as vscode from 'vscode';
import * as path from 'path';

let youtubeMusicPanel: vscode.WebviewPanel | undefined = undefined;
let statusBarItem: vscode.StatusBarItem | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('YouTube Music Streamer extension is now active!');

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(music) Music";
    statusBarItem.tooltip = "Open YouTube Music Streamer";
    statusBarItem.command = 'youtubeMusicStreamer.togglePlayer';
    statusBarItem.show();

    // Register commands
    const openPlayerCommand = vscode.commands.registerCommand('youtubeMusicStreamer.openPlayer', () => {
        createOrShowYoutubeMusicPanel(context);
    });

    const togglePlayerCommand = vscode.commands.registerCommand('youtubeMusicStreamer.togglePlayer', () => {
        if (youtubeMusicPanel) {
            youtubeMusicPanel.dispose();
        } else {
            createOrShowYoutubeMusicPanel(context);
        }
    });

    context.subscriptions.push(openPlayerCommand, togglePlayerCommand, statusBarItem);

    // Auto-start if enabled
    const config = vscode.workspace.getConfiguration('youtubeMusicStreamer');
    if (config.get('autoStart', false)) {
        createOrShowYoutubeMusicPanel(context);
    }
}

function createOrShowYoutubeMusicPanel(context: vscode.ExtensionContext) {
    if (youtubeMusicPanel) {
        youtubeMusicPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    // Check API key configuration
    const config = vscode.workspace.getConfiguration('youtubeMusicStreamer');
    const apiKey = config.get<string>('apiKey', '');
    
    if (!apiKey) {
        vscode.window.showWarningMessage(
            'YouTube API key not configured. Please set your API key in settings.',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'youtubeMusicStreamer.apiKey');
            }
        });
        // Continue anyway to allow testing
    }

    // Create new panel
    youtubeMusicPanel = vscode.window.createWebviewPanel(
        'youtubeMusicStreamer',
        'YouTube Music Streamer',
        {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true
        },
        {
            enableScripts: true,
            retainContextWhenHidden: true,
            localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
        }
    );

    // Update status bar when panel is visible
    if (statusBarItem) {
        statusBarItem.text = "$(music) Playing";
        statusBarItem.tooltip = "Close YouTube Music Streamer";
    }

    // Set the webview's initial HTML content
    youtubeMusicPanel.webview.html = getWebviewContent(youtubeMusicPanel.webview, context.extensionUri);

    // Handle messages from the webview
    youtubeMusicPanel.webview.onDidReceiveMessage(
        message => {
            switch (message.type) {
                case 'info':
                    vscode.window.showInformationMessage(message.text);
                    break;
                case 'error':
                    vscode.window.showErrorMessage(message.text);
                    break;
                case 'warning':
                    vscode.window.showWarningMessage(message.text);
                    break;
                case 'nowPlaying':
                    if (statusBarItem) {
                        statusBarItem.text = `$(music) ${message.title}`;
                        statusBarItem.tooltip = `Now Playing: ${message.title}`;
                    }
                    break;
                case 'stopped':
                    if (statusBarItem) {
                        statusBarItem.text = "$(music) Music";
                        statusBarItem.tooltip = "Open YouTube Music Streamer";
                    }
                    break;
                case 'getConfig':
                    // Send configuration to webview
                    const currentConfig = vscode.workspace.getConfiguration('youtubeMusicStreamer');
                    youtubeMusicPanel?.webview.postMessage({
                        type: 'config',
                        config: {
                            apiKey: currentConfig.get<string>('apiKey', ''),
                            maxResults: currentConfig.get<number>('maxResults', 25),
                            region: currentConfig.get<string>('region', 'US')
                        }
                    });
                    break;
                case 'openSettings':
                    vscode.commands.executeCommand('workbench.action.openSettings', 'youtubeMusicStreamer');
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    // Clean up when the panel is closed
    youtubeMusicPanel.onDidDispose(
        () => {
            youtubeMusicPanel = undefined;
            if (statusBarItem) {
                statusBarItem.text = "$(music) Music";
                statusBarItem.tooltip = "Open YouTube Music Streamer";
            }
        },
        null,
        context.subscriptions
    );
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src http: https: data:; connect-src https: http:;">
    <title>YouTube Music Streamer</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            height: 100vh;
            overflow: hidden;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        .header {
            padding: 10px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-panel-background);
        }

        .tabs {
            display: flex;
            gap: 10px;
            align-items: center;
        }

        .tab {
            padding: 8px 16px;
            background: var(--vscode-button-secondaryBackground);
            border: none;
            border-radius: 4px;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 13px;
            transition: all 0.2s;
        }

        .tab:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .tab.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .settings-button {
            margin-left: auto;
            padding: 6px 12px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .settings-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .content {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
        }

        .api-warning {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
        }

        .api-warning button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 8px;
        }

        .search-container {
            margin-bottom: 20px;
        }

        .search-input {
            width: 100%;
            padding: 10px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 14px;
        }

        .search-button {
            margin-top: 10px;
            padding: 8px 16px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }

        .search-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .search-button:disabled {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }

        .song-list {
            display: grid;
            gap: 15px;
        }

        .song-item {
            display: flex;
            align-items: center;
            padding: 12px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 6px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .song-item:hover {
            background: var(--vscode-list-activeSelectionBackground);
        }

        .song-thumbnail {
            width: 60px;
            height: 45px;
            background: var(--vscode-input-background);
            border-radius: 4px;
            margin-right: 12px;
            object-fit: cover;
        }

        .song-info {
            flex: 1;
        }

        .song-title {
            font-weight: 500;
            margin-bottom: 4px;
            font-size: 14px;
        }

        .song-artist {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .song-duration {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
            margin-top: 2px;
        }

        .play-button {
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .play-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .player {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: var(--vscode-panel-background);
            border-top: 1px solid var(--vscode-panel-border);
            padding: 15px;
            display: none;
        }

        .player.active {
            display: block;
        }

        .player-controls {
            display: flex;
            align-items: center;
            gap: 15px;
        }

        .now-playing {
            flex: 1;
            font-size: 14px;
            font-weight: 500;
        }

        audio {
            flex: 1;
            max-width: 300px;
        }

        .section {
            margin-bottom: 30px;
        }

        .section-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 15px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .refresh-button {
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 11px;
        }

        .refresh-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .error {
            text-align: center;
            padding: 40px;
            color: var(--vscode-errorForeground);
        }

        .spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            border-top-color: var(--vscode-progressBar-foreground);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .next-song-info {
            margin-top: 10px;
            padding: 8px 12px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-button-background);
            display: none;
        }

        .next-song-label {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            font-weight: 500;
        }

        .next-song-details {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .next-song-thumb {
            width: 32px;
            height: 24px;
            border-radius: 2px;
            object-fit: cover;
        }

        .next-song-text {
            flex: 1;
            min-width: 0;
        }

        .next-song-title {
            font-size: 12px;
            font-weight: 500;
            color: var(--vscode-foreground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .next-song-artist {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .autoplay-toggle {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            transition: background 0.2s;
        }

        .autoplay-toggle:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="tabs">
                <button class="tab active" data-tab="trending">Trending</button>
                <button class="tab" data-tab="search">Search</button>
                <button class="tab" data-tab="regional">Regional</button>
                <button class="settings-button" onclick="openSettings()">⚙️ Settings</button>
            </div>
        </div>

        <div class="content">
            <div id="apiWarning" class="api-warning" style="display: none;">
                <strong>⚠️ YouTube API Key Required</strong><br>
                To fetch real YouTube data, please configure your YouTube Data API v3 key in the extension settings.
                <br><button onclick="openSettings()">Open Settings</button>
            </div>

            <!-- Trending Tab -->
            <div id="trending" class="tab-content active">
                <div class="section">
                    <div class="section-title">
                        🔥 Trending Music
                        <button class="refresh-button" onclick="loadTrending()">Refresh</button>
                    </div>
                    <div class="loading">
                        <div class="spinner"></div>
                        Loading trending music...
                    </div>
                </div>
            </div>

            <!-- Search Tab -->
            <div id="search" class="tab-content" style="display: none;">
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Search for music..." id="searchInput">
                    <button class="search-button" onclick="searchMusic()" id="searchButton">Search</button>
                </div>
                <div id="searchResults"></div>
            </div>

            <!-- Regional Tab -->
            <div id="regional" class="tab-content" style="display: none;">
                <div class="section">
                    <div class="section-title">
                        🇮🇳 Popular in India
                        <button class="refresh-button" onclick="loadRegional('IN')">Refresh</button>
                    </div>
                    <div id="indiaResults" class="song-list">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading popular music in India...
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">
                        🇬🇧 Popular in UK
                        <button class="refresh-button" onclick="loadRegional('GB')">Refresh</button>
                    </div>
                    <div id="ukResults" class="song-list">
                        <div class="loading">
                            <div class="spinner"></div>
                            Loading popular music in UK...
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="player" id="player">
            <div class="player-controls">
                <div class="now-playing" id="nowPlaying">No song selected</div>
                <audio controls id="audioPlayer">
                    Your browser does not support the audio element.
                </audio>
                <button class="play-button" onclick="closePlayer()">Close</button>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTab = 'trending';
        let config = { apiKey: '', maxResults: 25, region: 'US' };
        let trendingLoaded = false;
        let regionalLoaded = { IN: false, GB: false };

        // Autoplay and queue management
        let currentSong = null;
        let nextSong = null;
        let isAutoplayEnabled = true;
        let songQueue = [];

        // YouTube API configuration
        const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

        // Request configuration on load
        vscode.postMessage({ type: 'getConfig' });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'config':
                    config = message.config;
                    checkApiKey();
                    if (currentTab === 'trending' && !trendingLoaded) {
                        loadTrending();
                    }
                    break;
            }
        });

        function checkApiKey() {
            const warning = document.getElementById('apiWarning');
            if (!config.apiKey) {
                warning.style.display = 'block';
            } else {
                warning.style.display = 'none';
            }
        }

        function openSettings() {
            vscode.postMessage({ type: 'openSettings' });
        }

        // Tab switching
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;
                switchTab(targetTab);
            });
        });

        function switchTab(tabName) {
            // Update tab buttons
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(tabName).style.display = 'block';

            currentTab = tabName;

            // Load content if needed
            if (tabName === 'trending' && !trendingLoaded && config.apiKey) {
                loadTrending();
            } else if (tabName === 'regional' && !regionalLoaded.IN && config.apiKey) {
                loadRegional('IN');
                loadRegional('GB');
            }
        }

        async function loadTrending() {
            if (!config.apiKey) {
                showError('trending', 'YouTube API key not configured. Please set your API key in settings.');
                return;
            }

            // Reset the loaded flag to allow refresh
            trendingLoaded = false;

            // Find the trending container more reliably
            let container = document.querySelector('#trending .section');
            if (!container) {
                container = document.getElementById('trending');
                container.innerHTML = '<div class="section"></div>';
                container = container.querySelector('.section');
            }
            
            container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading trending music...</div>';

            try {
                const response = await fetch(
                    \`\${YOUTUBE_API_BASE}/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&maxResults=\${config.maxResults}&regionCode=\${config.region}&key=\${config.apiKey}\`
                );

                if (!response.ok) {
                    throw new Error(\`API Error: \${response.status} - \${response.statusText}\`);
                }

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error.message);
                }

                container.innerHTML = \`
                    <div class="section-title">
                        🔥 Trending Music
                        <button class="refresh-button" onclick="loadTrending()">Refresh</button>
                    </div>
                    <div class="song-list"></div>
                \`;

                const songList = container.querySelector('.song-list');
                
                data.items.forEach(video => {
                    songList.appendChild(createSongItem({
                        id: video.id,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
                        duration: formatDuration(video.contentDetails?.duration),
                        viewCount: video.statistics.viewCount
                    }));
                });

                trendingLoaded = true;
                vscode.postMessage({
                    type: 'info',
                    text: \`Loaded \${data.items.length} trending music videos\`
                });

            } catch (error) {
                console.error('Error loading trending:', error);
                showError('trending', \`Failed to load trending music: \${error.message}\`);
                vscode.postMessage({
                    type: 'error',
                    text: \`Failed to load trending music: \${error.message}\`
                });
            }
        }

        async function loadRegional(regionCode) {
            if (!config.apiKey) {
                return;
            }

            const containerId = regionCode === 'IN' ? 'indiaResults' : 'ukResults';
            const container = document.getElementById(containerId);
            container.innerHTML = '<div class="loading"><div class="spinner"></div>Loading...</div>';

            try {
                const response = await fetch(
                    \`\${YOUTUBE_API_BASE}/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&maxResults=20&regionCode=\${regionCode}&key=\${config.apiKey}\`
                );

                if (!response.ok) {
                    throw new Error(\`API Error: \${response.status}\`);
                }

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error.message);
                }

                container.innerHTML = '';
                
                data.items.forEach(video => {
                    container.appendChild(createSongItem({
                        id: video.id,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
                        duration: formatDuration(video.contentDetails?.duration),
                        viewCount: video.statistics.viewCount
                    }));
                });

                regionalLoaded[regionCode] = true;

            } catch (error) {
                console.error(\`Error loading regional (\${regionCode}):\`, error);
                container.innerHTML = \`<div class="error">Failed to load: \${error.message}</div>\`;
            }
        }

        async function searchMusic() {
            const searchInput = document.getElementById('searchInput');
            const searchButton = document.getElementById('searchButton');
            const query = searchInput.value.trim();
            
            if (!query) {
                return;
            }

            if (!config.apiKey) {
                vscode.postMessage({
                    type: 'warning',
                    text: 'YouTube API key not configured. Please set your API key in settings.'
                });
                return;
            }

            const resultsContainer = document.getElementById('searchResults');
            resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div>Searching...</div>';
            
            searchButton.disabled = true;
            searchButton.textContent = 'Searching...';

            try {
                const response = await fetch(
                    \`\${YOUTUBE_API_BASE}/search?part=snippet&maxResults=\${config.maxResults}&q=\${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=\${config.apiKey}\`
                );

                if (!response.ok) {
                    throw new Error(\`API Error: \${response.status} - \${response.statusText}\`);
                }

                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error.message);
                }

                resultsContainer.innerHTML = '<div class="song-list"></div>';
                const songList = resultsContainer.querySelector('.song-list');
                
                data.items.forEach(video => {
                    songList.appendChild(createSongItem({
                        id: video.id.videoId,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
                        publishedAt: video.snippet.publishedAt
                    }));
                });

                vscode.postMessage({
                    type: 'info',
                    text: \`Found \${data.items.length} results for "\${query}"\`
                });

            } catch (error) {
                console.error('Search error:', error);
                resultsContainer.innerHTML = \`<div class="error">Search failed: \${error.message}</div>\`;
                vscode.postMessage({
                    type: 'error',
                    text: \`Search failed: \${error.message}\`
                });
            } finally {
                searchButton.disabled = false;
                searchButton.textContent = 'Search';
            }
        }

        function showError(tabId, message) {
            let container;
            if (tabId === 'trending') {
                container = document.querySelector('#trending .section');
                if (!container) {
                    container = document.getElementById('trending');
                    container.innerHTML = '<div class="section"></div>';
                    container = container.querySelector('.section');
                }
            } else {
                container = document.querySelector(\`#\${tabId} .section .loading\`)?.parentElement;
            }
            
            if (container) {
                container.innerHTML = \`
                    <div class="section-title">
                        Error
                        <button class="refresh-button" onclick="loadTrending()">Retry</button>
                    </div>
                    <div class="error">\${message}</div>
                \`;
            }
        }

        function createSongItem(song) {
            const item = document.createElement('div');
            item.className = 'song-item';
            
            const duration = song.duration ? \`<div class="song-duration">\${song.duration}</div>\` : '';
            const viewCount = song.viewCount ? \`<div class="song-duration">\${formatNumber(song.viewCount)} views</div>\` : '';
            
            item.innerHTML = \`
                <img src="\${song.thumbnail}" alt="\${song.title}" class="song-thumbnail" onerror="this.style.display='none'">
                <div class="song-info">
                    <div class="song-title">\${song.title}</div>
                    <div class="song-artist">\${song.artist}</div>
                    \${duration}
                    \${viewCount}
                </div>
                <button class="play-button" onclick="playSong('\${song.id}', '\${song.title.replace(/'/g, "\\'")}', '\${song.artist.replace(/'/g, "\\'")}')">Play</button>
            \`;
            return item;
        }

        function playSong(videoId, title, artist) {
            const streamUrl = \`http://localhost:3000/stream/\${videoId}\`;
            const audioPlayer = document.getElementById('audioPlayer');
            const player = document.getElementById('player');
            const nowPlaying = document.getElementById('nowPlaying');

            // Store current song info
            currentSong = { id: videoId, title, artist };

            audioPlayer.src = streamUrl;
            nowPlaying.textContent = \`\${title} - \${artist}\`;
            player.classList.add('active');

            // Remove any existing event listeners to avoid duplicates
            audioPlayer.removeEventListener('ended', handleSongEnded);
            audioPlayer.removeEventListener('loadstart', handleSongLoadStart);

            // Add event listeners for autoplay
            audioPlayer.addEventListener('ended', handleSongEnded);
            audioPlayer.addEventListener('loadstart', handleSongLoadStart);

            // Notify extension about now playing
            vscode.postMessage({
                type: 'nowPlaying',
                title: title,
                artist: artist,
                videoId: videoId
            });

            audioPlayer.play().catch(error => {
                vscode.postMessage({
                    type: 'error',
                    text: \`Error playing audio: \${error.message}. Make sure the streaming server is running at localhost:3000\`
                });
            });

            // Find and preload similar songs for autoplay
            if (isAutoplayEnabled) {
                findAndPreloadNext(title, artist, videoId);
            }
        }

        async function findAndPreloadNext(title, artist, videoId) {
            try {
                console.log(\`🔍 Finding similar songs for: \${title} by \${artist}\`);
                
                const similarSongs = await findSimilarSongs(title, artist, videoId);
                
                if (similarSongs.length > 0) {
                    // Add to queue and preload the first one
                    songQueue = similarSongs;
                    await preloadNextSong(similarSongs[0]);
                } else {
                    console.log('No similar songs found');
                }
            } catch (error) {
                console.error('Error finding and preloading next song:', error);
            }
        }

        async function handleSongEnded() {
            console.log('🎵 Song ended');
            
            if (!isAutoplayEnabled) {
                console.log('⏸️ Autoplay disabled, stopping');
                return;
            }

            if (nextSong && nextSong.preloadElement) {
                console.log(\`▶️ Auto-playing next song: \${nextSong.title}\`);
                
                // Switch to the preloaded audio
                const currentAudioPlayer = document.getElementById('audioPlayer');
                const preloadedAudio = nextSong.preloadElement;
                
                // Copy the preloaded audio to the main player
                currentAudioPlayer.src = preloadedAudio.src;
                currentAudioPlayer.currentTime = 0;
                
                // Update UI
                const nowPlaying = document.getElementById('nowPlaying');
                nowPlaying.textContent = \`\${nextSong.title} - \${nextSong.artist}\`;
                
                // Update current song
                currentSong = {
                    id: nextSong.id,
                    title: nextSong.title,
                    artist: nextSong.artist
                };

                // Notify extension
                vscode.postMessage({
                    type: 'nowPlaying',
                    title: nextSong.title,
                    artist: nextSong.artist,
                    videoId: nextSong.id
                });

                // Remove the current next song from queue
                songQueue.shift();
                
                // Start playing
                currentAudioPlayer.play().catch(error => {
                    console.error('Error auto-playing next song:', error);
                    vscode.postMessage({
                        type: 'error',
                        text: \`Error auto-playing next song: \${error.message}\`
                    });
                });

                // Preload the next song in queue
                if (songQueue.length > 0) {
                    await preloadNextSong(songQueue[0]);
                } else {
                    // Find more similar songs
                    await findAndPreloadNext(nextSong.title, nextSong.artist, nextSong.id);
                }
            } else {
                console.log('No next song available for autoplay');
                // Try to find similar songs if none are queued
                if (currentSong) {
                    await findAndPreloadNext(currentSong.title, currentSong.artist, currentSong.id);
                }
            }
        }

        function handleSongLoadStart() {
            console.log('🎵 Song loading started');
        }

        function closePlayer() {
            const audioPlayer = document.getElementById('audioPlayer');
            const player = document.getElementById('player');
            const nextSongElement = document.getElementById('nextSongInfo');
            const preloadAudio = document.getElementById('preloadAudio');

            // Stop and clean up main audio
            audioPlayer.pause();
            audioPlayer.src = '';
            
            // Clean up preloaded audio
            if (preloadAudio) {
                preloadAudio.pause();
                preloadAudio.src = '';
            }
            
            // Hide player and next song info
            player.classList.remove('active');
            if (nextSongElement) {
                nextSongElement.style.display = 'none';
            }

            // Reset autoplay state
            currentSong = null;
            nextSong = null;
            songQueue = [];

            // Remove event listeners
            audioPlayer.removeEventListener('ended', handleSongEnded);
            audioPlayer.removeEventListener('loadstart', handleSongLoadStart);

            // Notify extension that playback stopped
            vscode.postMessage({
                type: 'stopped'
            });
        }

        function formatDuration(duration) {
            if (!duration) return '';
            
            // Parse ISO 8601 duration (PT4M13S)
            const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
            if (!match) return '';
            
            const hours = (match[1] || '').replace('H', '');
            const minutes = (match[2] || '').replace('M', '');
            const seconds = (match[3] || '').replace('S', '');
            
            if (hours) {
                return \`\${hours}:\${minutes.padStart(2, '0')}:\${seconds.padStart(2, '0')}\`;
            } else {
                return \`\${minutes || '0'}:\${seconds.padStart(2, '0')}\`;
            }
        }

        function formatNumber(num) {
            if (num >= 1000000) {
                return (num / 1000000).toFixed(1) + 'M';
            } else if (num >= 1000) {
                return (num / 1000).toFixed(1) + 'K';
            }
            return num;
        }

        // Handle Enter key in search input
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchMusic();
            }
        });

        // Show info about streaming server
        vscode.postMessage({
            type: 'info',
            text: 'YouTube Music Streamer loaded! Configure your API key in settings to fetch real YouTube data.'
        });

        async function findSimilarSongs(currentTitle, currentArtist, currentVideoId) {
            if (!config.apiKey) {
                return [];
            }

            try {
                // Create search queries for similar content
                const searchQueries = [
                    \`\${currentArtist} songs\`,
                    \`similar to \${currentTitle}\`,
                    \`\${currentArtist} music\`,
                    \`like \${currentTitle}\`
                ];

                const allResults = [];
                
                // Try each search query to get diverse similar songs
                for (let i = 0; i < Math.min(2, searchQueries.length); i++) {
                    const query = searchQueries[i];
                    
                    try {
                        const response = await fetch(
                            \`\${YOUTUBE_API_BASE}/search?part=snippet&maxResults=10&q=\${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=\${config.apiKey}\`
                        );

                        if (response.ok) {
                            const data = await response.json();
                            if (data.items) {
                                allResults.push(...data.items);
                            }
                        }
                    } catch (error) {
                        console.warn('Error in similar song search:', error);
                    }
                }

                // Filter and process results
                const similarSongs = allResults
                    .filter(video => video.id.videoId !== currentVideoId) // Exclude current song
                    .map(video => ({
                        id: video.id.videoId,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url,
                        publishedAt: video.snippet.publishedAt
                    }))
                    .slice(0, 5); // Limit to 5 similar songs

                return similarSongs;

            } catch (error) {
                console.error('Error finding similar songs:', error);
                return [];
            }
        }

        async function preloadNextSong(song) {
            if (!song) return;

            try {
                // Create a hidden audio element for preloading
                let preloadAudio = document.getElementById('preloadAudio');
                if (!preloadAudio) {
                    preloadAudio = document.createElement('audio');
                    preloadAudio.id = 'preloadAudio';
                    preloadAudio.style.display = 'none';
                    preloadAudio.preload = 'auto';
                    document.body.appendChild(preloadAudio);
                }

                const streamUrl = \`http://localhost:3000/stream/\${song.id}\`;
                preloadAudio.src = streamUrl;
                
                console.log(\`🔄 Preloading next song: \${song.title}\`);
                
                // Start preloading
                preloadAudio.load();
                
                nextSong = { ...song, preloadElement: preloadAudio };
                
                // Update UI to show next song
                updateNextSongUI(song);

            } catch (error) {
                console.warn('Error preloading next song:', error);
            }
        }

        function updateNextSongUI(song) {
            let nextSongElement = document.getElementById('nextSongInfo');
            if (!nextSongElement) {
                // Create next song info element
                const player = document.getElementById('player');
                if (player) {
                    nextSongElement = document.createElement('div');
                    nextSongElement.id = 'nextSongInfo';
                    nextSongElement.className = 'next-song-info';
                    nextSongElement.innerHTML = \`
                        <div class="next-song-label">Up Next:</div>
                        <div class="next-song-details">
                            <img class="next-song-thumb" src="" alt="Next song">
                            <div class="next-song-text">
                                <div class="next-song-title"></div>
                                <div class="next-song-artist"></div>
                            </div>
                            <button class="autoplay-toggle" onclick="toggleAutoplay()" title="Toggle Autoplay">
                                <span id="autoplayIcon">🔄</span>
                            </button>
                        </div>
                    \`;
                    player.appendChild(nextSongElement);
                }
            }

            if (nextSongElement && song) {
                nextSongElement.querySelector('.next-song-thumb').src = song.thumbnail;
                nextSongElement.querySelector('.next-song-title').textContent = song.title;
                nextSongElement.querySelector('.next-song-artist').textContent = song.artist;
                nextSongElement.style.display = 'block';
            }
        }

        function toggleAutoplay() {
            isAutoplayEnabled = !isAutoplayEnabled;
            const icon = document.getElementById('autoplayIcon');
            if (icon) {
                icon.textContent = isAutoplayEnabled ? '🔄' : '⏸️';
                icon.parentElement.title = isAutoplayEnabled ? 'Autoplay On' : 'Autoplay Off';
            }
            
            vscode.postMessage({
                type: 'info',
                text: \`Autoplay \${isAutoplayEnabled ? 'enabled' : 'disabled'}\`
            });
        }
    </script>
</body>
</html>`;
}

export function deactivate() {
    if (youtubeMusicPanel) {
        youtubeMusicPanel.dispose();
    }
    if (statusBarItem) {
        statusBarItem.dispose();
    }
} 