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
            font-size: 12px;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        /* Improved Seek Bar at Top */
        .seek-bar-container {
            height: 6px;
            background: var(--vscode-scrollbarSlider-background);
            position: relative;
            cursor: pointer;
            display: none;
            padding: 2px 0;
            box-sizing: border-box;
        }

        .seek-bar-container.active {
            display: block;
        }

        .seek-bar-track {
            height: 2px;
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 1px;
            position: relative;
            top: 50%;
            transform: translateY(-50%);
        }

        .seek-bar-progress {
            height: 2px;
            background: var(--vscode-progressBar-foreground);
            width: 0%;
            transition: width 0.1s;
            position: relative;
            border-radius: 1px;
        }

        .seek-bar-handle {
            position: absolute;
            right: -6px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            background: var(--vscode-progressBar-foreground);
            border-radius: 50%;
            cursor: grab;
            opacity: 0.8;
            transition: opacity 0.2s, transform 0.2s;
            border: 2px solid var(--vscode-editor-background);
            background-color: gray;
        }

        .seek-bar-container:hover .seek-bar-handle {
            opacity: 1;
            transform: translateY(-50%) scale(1.2);
        }

        .seek-bar-handle:active {
            cursor: grabbing;
            transform: translateY(-50%) scale(1.3);
        }

        .seek-bar-container:hover .seek-bar-track {
            height: 3px;
        }

        .seek-bar-container:hover .seek-bar-progress {
            height: 3px;
        }

        .header {
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-panel-background);
        }

        .mini-player {
            background: var(--vscode-panel-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 8px 12px;
            display: none;
            min-height: 40px;
        }

        .mini-player.active {
            display: block;
        }

        .mini-player-content {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
        }

        .mini-player-thumbnail {
            width: 32px;
            height: 24px;
            border-radius: 3px;
            object-fit: cover;
            background: var(--vscode-input-background);
        }

        .mini-player-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }

        .mini-player-title {
            font-weight: 500;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
        }

        .mini-player-artist {
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 10px;
        }

        .mini-player-controls {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .custom-audio-controls {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .control-btn {
            padding: 6px 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            min-width: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .control-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .control-btn:disabled {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
        }

        .time-display {
            font-size: 10px;
            color: var(--vscode-descriptionForeground);
            min-width: 60px;
            text-align: center;
        }

        .mini-control-btn {
            padding: 4px 6px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            min-width: 20px;
        }

        .mini-control-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .tabs {
            display: flex;
            gap: 6px;
            align-items: center;
        }

        .tab {
            padding: 6px 12px;
            background: var(--vscode-button-secondaryBackground);
            border: none;
            border-radius: 3px;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 11px;
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
            padding: 4px 8px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
        }

        .settings-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .content {
            flex: 1;
            padding: 12px;
            overflow-y: auto;
        }

        .api-warning {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 8px;
            border-radius: 3px;
            margin-bottom: 12px;
            font-size: 11px;
        }

        .api-warning button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 6px;
            font-size: 10px;
        }

        .search-container {
            margin-bottom: 12px;
        }

        .search-input {
            width: 100%;
            padding: 6px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 3px;
            font-size: 11px;
            box-sizing: border-box;
        }

        .search-button {
            margin-top: 6px;
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
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
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .song-item {
            display: flex;
            align-items: center;
            padding: 8px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            cursor: pointer;
            transition: background 0.2s;
        }

        .song-item:hover {
            background: var(--vscode-list-activeSelectionBackground);
        }

        .song-thumbnail {
            width: 40px;
            height: 30px;
            background: var(--vscode-input-background);
            border-radius: 3px;
            margin-right: 8px;
            object-fit: cover;
            flex-shrink: 0;
        }

        .song-info {
            flex: 1;
            min-width: 0;
        }

        .song-title {
            font-weight: 500;
            margin-bottom: 2px;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .song-artist {
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .song-duration {
            color: var(--vscode-descriptionForeground);
            font-size: 9px;
            margin-top: 2px;
        }

        .play-button {
            padding: 4px 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
            flex-shrink: 0;
        }

        .play-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .section {
            margin-bottom: 20px;
        }

        .section-title {
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--vscode-foreground);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .refresh-button {
            padding: 3px 6px;
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 9px;
        }

        .refresh-button:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
        }

        .error {
            text-align: center;
            padding: 20px;
            color: var(--vscode-errorForeground);
            font-size: 11px;
        }

        .spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            border-top-color: var(--vscode-progressBar-foreground);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .next-song-info {
            margin-top: 6px;
            padding: 6px 8px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 3px;
            border-left: 2px solid var(--vscode-button-background);
            display: none;
            font-size: 10px;
        }

        .next-song-label {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 3px;
            font-weight: 500;
        }

        .next-song-details {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .next-song-thumb {
            width: 24px;
            height: 18px;
            border-radius: 2px;
            object-fit: cover;
        }

        .next-song-text {
            flex: 1;
            min-width: 0;
        }

        .next-song-title {
            font-size: 10px;
            font-weight: 500;
            color: var(--vscode-foreground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .next-song-artist {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .autoplay-toggle {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: none;
            padding: 3px 6px;
            border-radius: 2px;
            cursor: pointer;
            font-size: 10px;
            transition: background 0.2s;
        }

        .autoplay-toggle:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        /* Compact mode adjustments for very small windows */
        @media (max-height: 400px) {
            .content {
                padding: 8px;
            }
            
            .song-item {
                padding: 6px;
            }
            
            .section {
                margin-bottom: 12px;
            }
        }

        /* Hide the audio element completely */
        #audioPlayer {
            display: none;
        }
    </style>
</head>
<body>
    <div class="container">

        <!-- Compact Mini Player -->
        <div class="mini-player" id="miniPlayer">
            <div class="mini-player-content">
                <img class="mini-player-thumbnail" id="miniPlayerThumbnail" src="" alt="Now playing">
                <div class="mini-player-info">
                    <div class="mini-player-title" id="miniPlayerTitle">No song selected</div>
                    <div class="mini-player-artist" id="miniPlayerArtist"></div>
                </div>
                <div class="mini-player-controls">
                    <div class="custom-audio-controls">
                        <button class="control-btn" id="playPauseBtn" onclick="togglePlayPause()">▶</button>
                        <button class="control-btn" id="nextBtn" onclick="playNext()" title="Next Song">⏭</button>
                        <div class="time-display" id="timeDisplay">0:00 / 0:00</div>
                    </div>
                    <button class="mini-control-btn autoplay-toggle" onclick="toggleAutoplay()" title="Toggle Autoplay">
                        <span id="autoplayIcon">🔄</span>
                    </button>
                    <button class="mini-control-btn" onclick="closePlayer()" title="Close">✕</button>
                </div>
            </div>
            <div class="next-song-info" id="nextSongInfo">
                <div class="next-song-label">Up Next:</div>
                <div class="next-song-details">
                    <img class="next-song-thumb" src="" alt="Next song">
                    <div class="next-song-text">
                        <div class="next-song-title"></div>
                        <div class="next-song-artist"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Hidden Audio Element -->
        <audio id="audioPlayer"></audio>

        <!-- Improved Custom Seek Bar at Top -->
        <div class="seek-bar-container" id="seekBarContainer">
            <div class="seek-bar-track">
                <div class="seek-bar-progress" id="seekBarProgress">
                    <div class="seek-bar-handle" id="seekBarHandle"></div>
                </div>
            </div>
        </div>

        <div class="header">
            <div class="tabs">
                <button class="tab active" data-tab="trending">🔥 Trending</button>
                <button class="tab" data-tab="search">🔍 Search</button>
                <button class="tab" data-tab="regional">🌍 Regional</button>
                <button class="settings-button" onclick="openSettings()">⚙️</button>
            </div>
        </div>


        <div class="content">
            <div id="apiWarning" class="api-warning" style="display: none;">
                <strong>⚠️ YouTube API Key Required</strong><br>
                Configure your YouTube Data API v3 key in settings.
                <br><button onclick="openSettings()">Open Settings</button>
            </div>

            <!-- Trending Tab -->
            <div id="trending" class="tab-content active">
                <div class="section">
                    <div class="section-title">
                        🔥 Trending Music
                        <button class="refresh-button" onclick="loadTrending()">↻</button>
                    </div>
                    <div class="loading">
                        <div class="spinner"></div>
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
                        🇮🇳 India
                        <button class="refresh-button" onclick="loadRegional('IN')">↻</button>
                    </div>
                    <div id="indiaResults" class="song-list">
                        <div class="loading">
                            <div class="spinner"></div>
                          
                        </div>
                    </div>
                </div>
                <div class="section">
                    <div class="section-title">
                        🇬🇧 UK
                        <button class="refresh-button" onclick="loadRegional('GB')">↻</button>
                    </div>
                    <div id="ukResults" class="song-list">
                        <div class="loading">
                            <div class="spinner"></div>
                           
                        </div>
                    </div>
                </div>
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
        let isPlaying = false;
        let isDragging = false;

        // YouTube API configuration
        const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

        // Get audio element
        const audioPlayer = document.getElementById('audioPlayer');

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

        // Initialize audio event listeners
        audioPlayer.addEventListener('loadedmetadata', () => {
            updateTimeDisplay();
        });

        audioPlayer.addEventListener('timeupdate', () => {
            if (!isDragging) {
                updateSeekBar();
                updateTimeDisplay();
            }
        });

        audioPlayer.addEventListener('ended', handleSongEnded);
        audioPlayer.addEventListener('play', () => {
            isPlaying = true;
            updatePlayPauseButton();
        });

        audioPlayer.addEventListener('pause', () => {
            isPlaying = false;
            updatePlayPauseButton();
        });

        // Custom Controls Functions
        function togglePlayPause() {
            if (audioPlayer.src) {
                if (isPlaying) {
                    audioPlayer.pause();
                } else {
                    audioPlayer.play().catch(error => {
                        vscode.postMessage({
                            type: 'error',
                            text: \`Error playing audio: \${error.message}\`
                        });
                    });
                }
            }
        }

        function playNext() {
            if (nextSong && nextSong.preloadElement) {
                // Play the preloaded next song
                handleSongEnded();
            } else if (songQueue.length > 0) {
                // Play first song in queue
                const nextInQueue = songQueue[0];
                playSong(nextInQueue.id, nextInQueue.title, nextInQueue.artist, nextInQueue.thumbnail);
            } else {
                vscode.postMessage({
                    type: 'info',
                    text: 'No next song available'
                });
            }
        }

        function updatePlayPauseButton() {
            const playPauseBtn = document.getElementById('playPauseBtn');
            playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
        }

        function updateTimeDisplay() {
            const timeDisplay = document.getElementById('timeDisplay');
            const current = formatTime(audioPlayer.currentTime || 0);
            const duration = formatTime(audioPlayer.duration || 0);
            timeDisplay.textContent = \`\${current} / \${duration}\`;
        }

        function updateSeekBar() {
            if (audioPlayer.duration) {
                const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
                document.getElementById('seekBarProgress').style.width = progress + '%';
            }
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
        }

        // Improved Seek Bar Functionality
        const seekBarContainer = document.getElementById('seekBarContainer');
        const seekBarProgress = document.getElementById('seekBarProgress');
        const seekBarHandle = document.getElementById('seekBarHandle');

        seekBarContainer.addEventListener('click', (e) => {
            if (!audioPlayer.duration || isDragging) return;
            
            const rect = seekBarContainer.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            const newTime = percent * audioPlayer.duration;
            audioPlayer.currentTime = Math.max(0, Math.min(newTime, audioPlayer.duration));
            updateSeekBar();
            updateTimeDisplay();
        });

        seekBarHandle.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && audioPlayer.duration) {
                const rect = seekBarContainer.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                seekBarProgress.style.width = (percent * 100) + '%';
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (isDragging && audioPlayer.duration) {
                const rect = seekBarContainer.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                audioPlayer.currentTime = percent * audioPlayer.duration;
                updateTimeDisplay();
            }
            isDragging = false;
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

            trendingLoaded = false;
            let container = document.querySelector('#trending .section');
            if (!container) {
                container = document.getElementById('trending');
                container.innerHTML = '<div class="section"></div>';
                container = container.querySelector('.section');
            }
            
            container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

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
                        <button class="refresh-button" onclick="loadTrending()">↻</button>
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
            container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

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
            resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
            
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
                <button class="play-button" onclick="playSong('\${song.id}', '\${song.title.replace(/'/g, "\\'")}', '\${song.artist.replace(/'/g, "\\'")}', '\${song.thumbnail}')">▶</button>
            \`;
            return item;
        }

        function playSong(videoId, title, artist, thumbnail = '') {
            const streamUrl = \`http://localhost:3000/stream/\${videoId}\`;
            const miniPlayer = document.getElementById('miniPlayer');
            const miniPlayerTitle = document.getElementById('miniPlayerTitle');
            const miniPlayerArtist = document.getElementById('miniPlayerArtist');
            const miniPlayerThumbnail = document.getElementById('miniPlayerThumbnail');
            const seekBarContainer = document.getElementById('seekBarContainer');

            // Store current song info
            currentSong = { id: videoId, title, artist, thumbnail };

            // Update mini player UI
            audioPlayer.src = streamUrl;
            miniPlayerTitle.textContent = title;
            miniPlayerArtist.textContent = artist;
            if (thumbnail) {
                miniPlayerThumbnail.src = thumbnail;
                miniPlayerThumbnail.style.display = 'block';
            } else {
                miniPlayerThumbnail.style.display = 'none';
            }
            
            miniPlayer.classList.add('active');
            seekBarContainer.classList.add('active');

            // Reset seek bar
            document.getElementById('seekBarProgress').style.width = '0%';
            document.getElementById('timeDisplay').textContent = '0:00 / 0:00';

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

        async function findAndPreloadNext(currentTitle, currentArtist, currentVideoId) {
            try {
                console.log(\`🔍 Finding similar songs for: \${currentTitle} by \${currentArtist}\`);
                
                const similarSongs = await findSimilarSongs(currentTitle, currentArtist, currentVideoId);
                
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
                const miniPlayerTitle = document.getElementById('miniPlayerTitle');
                const miniPlayerArtist = document.getElementById('miniPlayerArtist');
                const miniPlayerThumbnail = document.getElementById('miniPlayerThumbnail');
                
                miniPlayerTitle.textContent = nextSong.title;
                miniPlayerArtist.textContent = nextSong.artist;
                if (nextSong.thumbnail) {
                    miniPlayerThumbnail.src = nextSong.thumbnail;
                    miniPlayerThumbnail.style.display = 'block';
                }
                
                // Update current song
                currentSong = {
                    id: nextSong.id,
                    title: nextSong.title,
                    artist: nextSong.artist,
                    thumbnail: nextSong.thumbnail
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
            const nextSongElement = document.getElementById('nextSongInfo');
            if (nextSongElement && song) {
                nextSongElement.querySelector('.next-song-thumb').src = song.thumbnail;
                nextSongElement.querySelector('.next-song-title').textContent = song.title;
                nextSongElement.querySelector('.next-song-artist').textContent = song.artist;
                nextSongElement.style.display = 'block';
            }
        }

        function closePlayer() {
            const miniPlayer = document.getElementById('miniPlayer');
            const nextSongElement = document.getElementById('nextSongInfo');
            const preloadAudio = document.getElementById('preloadAudio');
            const seekBarContainer = document.getElementById('seekBarContainer');

            // Stop and clean up main audio
            audioPlayer.pause();
            audioPlayer.src = '';
            
            // Clean up preloaded audio
            if (preloadAudio) {
                preloadAudio.pause();
                preloadAudio.src = '';
            }
            
            // Hide player and seek bar
            miniPlayer.classList.remove('active');
            seekBarContainer.classList.remove('active');
            if (nextSongElement) {
                nextSongElement.style.display = 'none';
            }

            // Reset UI
            document.getElementById('seekBarProgress').style.width = '0%';
            document.getElementById('timeDisplay').textContent = '0:00 / 0:00';
            updatePlayPauseButton();

            // Reset autoplay state
            currentSong = null;
            nextSong = null;
            songQueue = [];
            isPlaying = false;

            // Notify extension that playback stopped
            vscode.postMessage({
                type: 'stopped'
            });
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