import * as vscode from 'vscode';
import * as path from 'path';

let statusBarItem: vscode.StatusBarItem | undefined = undefined;

class YouTubeMusicViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'youtube-music-player';
    private _view?: vscode.WebviewView;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
        message => {
            switch (message.type) {
                case 'info':
                    // vscode.window.showInformationMessage(message.text);
                    break;
                case 'error':
                    // vscode.window.showErrorMessage(message.text);
                    break;
                case 'warning':
                    // vscode.window.showWarningMessage(message.text);
                    break;
                case 'nowPlaying':
                    if (statusBarItem) {
                        statusBarItem.text = `$(music) ${message.title}`;
                        statusBarItem.tooltip = `Now Playing: ${message.title}`;
                    }
                    break;
                case 'stopped':
                    if (statusBarItem) {
                            statusBarItem.text = "$(music) YouTube Music";
                            statusBarItem.tooltip = "YouTube Music Player";
                    }
                    break;
                case 'getConfig':
                    // Send configuration to webview
                    const currentConfig = vscode.workspace.getConfiguration('youtubeMusicStreamer');
                        webviewView.webview.postMessage({
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
            }
        );
    }

    public refresh() {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'unsafe-inline'; style-src 'unsafe-inline'; media-src http: https: data:; connect-src https: http:;">
    <title>YouTube Music Player</title>
    <style>
        body {
            margin: 0;
            padding: 8px;
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-sideBar-background);
            color: var(--vscode-sideBar-foreground);
            font-size: 11px;
            line-height: 1.4;
            padding:16px;
        }

        .container {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        /* Compact seek bar */
        .seek-bar-container {
            height: 6px;
            background: var(--vscode-scrollbarSlider-background);
            position: relative;
            cursor: pointer;
            display: none;
            margin-bottom: 8px;
            border-radius: 3px;
            overflow: hidden;
        }

        .seek-bar-container.active {
            display: block;
        }

        .seek-bar-progress {
            height: 100%;
            background: var(--vscode-progressBar-background);
            width: 0%;
            transition: width 0.1s;
            border-radius: 3px;
        }

        /* Compact mini player */
        .mini-player {
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 6px;
            padding: 8px;
            display: none;
            margin-bottom: 8px;
            box-shadow: 0 2px 8px var(--vscode-widget-shadow);
        }

        .mini-player.active {
            display: block;
        }

        .mini-player-content {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 10px;
        }

        .mini-player-thumbnail {
            width: 28px;
            height: 21px;
            border-radius: 3px;
            object-fit: cover;
            flex-shrink: 0;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-widget-border);
        }

        .mini-player-info {
            flex: 1;
            min-width: 0;
        }

        .mini-player-title {
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 11px;
            margin-bottom: 2px;
            color: var(--vscode-editor-foreground);
        }

        .mini-player-artist {
            color: var(--vscode-descriptionForeground);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 9px;
        }

        .mini-player-controls {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .control-btn {
            padding: 4px 8px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
            min-width: 24px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .control-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .control-btn:active {
            background: var(--vscode-button-background);
            transform: scale(0.95);
        }

        .time-display {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            min-width: 60px;
            text-align: center;
            font-family: var(--vscode-editor-font-family);
            margin-top: 4px;
        }

        /* Next song info */
        .next-song-info {
            margin-top: 8px;
            padding: 8px;
            background: var(--vscode-list-hoverBackground);
            border-radius: 4px;
            border-left: 3px solid var(--vscode-focusBorder);
            display: none;
            font-size: 10px;
        }

        .next-song-info.active {
            display: block;
        }

        .next-song-label {
            font-size: 9px;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 4px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .next-song-details {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .next-song-thumb {
            width: 24px;
            height: 18px;
            border-radius: 2px;
            object-fit: cover;
            flex-shrink: 0;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-widget-border);
        }

        .next-song-text {
            flex: 1;
            min-width: 0;
        }

        .next-song-title {
            font-size: 10px;
            font-weight: 500;
            color: var(--vscode-editor-foreground);
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
            padding: 4px 6px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 9px;
            transition: all 0.2s;
            flex-shrink: 0;
            font-weight: 500;
        }

        .autoplay-toggle:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .autoplay-toggle.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        /* Compact tabs */
        .tabs {
            display: flex;
            gap: 4px;
            margin-bottom: 12px;
            flex-wrap: wrap;
        }

        .tab {
            padding: 6px 12px;
            background: var(--vscode-tab-inactiveBackground);
            border: 1px solid var(--vscode-tab-border);
            border-radius: 4px;
            color: var(--vscode-tab-inactiveForeground);
            cursor: pointer;
            font-size: 10px;
            flex: 1;
            min-width: 0;
            text-align: center;
            font-weight: 500;
            transition: all 0.2s;
        }

        .tab:hover {
            background: var(--vscode-tab-hoverBackground);
            color: var(--vscode-tab-hoverForeground);
        }

        .tab.active {
            background: var(--vscode-tab-activeBackground);
            color: var(--vscode-tab-activeForeground);
            border-color: var(--vscode-focusBorder);
        }

        .content {
            flex: 1;
            overflow-y: auto;
        }

        .api-warning {
            background: var(--vscode-inputValidation-warningBackground);
            color: var(--vscode-inputValidation-warningForeground);
            border: 1px solid var(--vscode-inputValidation-warningBorder);
            padding: 8px;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 10px;
        }

        .api-warning button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            margin-top: 6px;
            font-size: 9px;
            font-weight: 500;
        }

        .api-warning button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .search-container {
            margin-bottom: 12px;
        }

        .search-input {
            width: 100%;
            padding: 6px 8px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-size: 11px;
            box-sizing: border-box;
            font-family: inherit;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .search-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        .search-button {
            margin-top: 6px;
            padding: 6px 12px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
            width: 100%;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .search-button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .song-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .song-item {
            display: flex;
            align-items: center;
            padding: 8px;
            background: var(--vscode-list-inactiveSelectionBackground);
            border: 1px solid transparent;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .song-item:hover {
            background: var(--vscode-list-hoverBackground);
            border-color: var(--vscode-list-hoverForeground);
        }

        .song-item:active {
            background: var(--vscode-list-activeSelectionBackground);
        }

        .song-thumbnail {
            width: 36px;
            height: 27px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-widget-border);
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
            font-weight: 600;
            margin-bottom: 2px;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: var(--vscode-list-activeSelectionForeground);
        }

        .song-artist {
            color: var(--vscode-descriptionForeground);
            font-size: 9px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
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
            font-weight: 500;
            transition: all 0.2s;
        }

        .play-button:hover {
            background: var(--vscode-button-hoverBackground);
            transform: scale(1.05);
        }

        .section-title {
            font-size: 12px;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--vscode-editor-foreground);
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-widget-border);
        }

        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
        }

        .error {
            text-align: center;
            padding: 20px;
            color: var(--vscode-errorForeground);
            font-size: 10px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 4px;
        }

        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid var(--vscode-progressBar-background);
            border-radius: 50%;
            border-top-color: var(--vscode-progressBar-background);
            animation: spin 1s ease-in-out infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        /* Scrollbar styling */
        ::-webkit-scrollbar {
            width: 8px;
        }

        ::-webkit-scrollbar-track {
            background: var(--vscode-scrollbar-shadow);
        }

        ::-webkit-scrollbar-thumb {
            background: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
            background: var(--vscode-scrollbarSlider-hoverBackground);
        }

        /* Better focus states */
        button:focus, input:focus {
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 1px;
        }

        /* Ensure all elements respect theme */
        * {
            box-sizing: border-box;
        }

        /* Hide audio element */
        #audioPlayer, #preloadAudio {
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
                        <button class="control-btn" id="playPauseBtn" onclick="togglePlayPause()">▶</button>
                        <button class="control-btn" id="nextBtn" onclick="playNext()" title="Next Song">⏭</button>
                    <button class="autoplay-toggle active" onclick="toggleAutoplay()" title="Toggle Autoplay" id="autoplayBtn">
                        <span id="autoplayIcon">🔄</span>
                    </button>
                    <button class="control-btn" onclick="closePlayer()">✕</button>
                </div>
            </div>
            <div class="time-display" id="timeDisplay">0:00 / 0:00</div>
            
            <!-- Next Song Info -->
            <div class="next-song-info" id="nextSongInfo">
                <div class="next-song-label">Up Next:</div>
                <div class="next-song-details">
                    <img class="next-song-thumb" id="nextSongThumb" src="" alt="Next song">
                    <div class="next-song-text">
                        <div class="next-song-title" id="nextSongTitle"></div>
                        <div class="next-song-artist" id="nextSongArtist"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Seek Bar -->
        <div class="seek-bar-container" id="seekBarContainer" onclick="seekTo(event)">
            <div class="seek-bar-progress" id="seekBarProgress"></div>
        </div>

        <!-- Hidden Audio Elements -->
        <audio id="audioPlayer"></audio>
        <audio id="preloadAudio"></audio>

        <!-- Tabs -->
            <div class="tabs">
                <button class="tab active" data-tab="trending">🔥 Trending</button>
                <button class="tab" data-tab="search">🔍 Search</button>
                <button class="tab" data-tab="regional">🌍 Regional</button>
        </div>

        <div class="content">
            <div id="apiWarning" class="api-warning" style="display: none;">
                <strong>⚠️ API Key Required</strong><br>
                Configure your YouTube Data API v3 key in settings.
                <br><button onclick="openSettings()">Settings</button>
            </div>

            <!-- Trending Tab -->
            <div id="trending" class="tab-content active">
                <div class="section-title">🔥 Trending Music</div>
                    <div class="loading">
                        <div class="spinner"></div>
                </div>
            </div>

            <!-- Search Tab -->
            <div id="search" class="tab-content" style="display: none;">
                <div class="search-container">
                    <input type="text" class="search-input" placeholder="Search music..." id="searchInput">
                    <button class="search-button" onclick="searchMusic()" id="searchButton">Search</button>
                </div>
                <div id="searchResults"></div>
            </div>

            <!-- Regional Tab -->
            <div id="regional" class="tab-content" style="display: none;">
                <div class="section-title">🇮🇳 India</div>
                    <div id="indiaResults" class="song-list">
                        <div class="loading">
                            <div class="spinner"></div>
                        </div>
                    </div>
                <div class="section-title" style="margin-top: 12px;">🇬🇧 UK</div>
                    <div id="ukResults" class="song-list">
                        <div class="loading">
                            <div class="spinner"></div>
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
        let isPlaying = false;

        // Autoplay and queue management
        let currentSong = null;
        let nextSong = null;
        let isAutoplayEnabled = true;
        let songQueue = [];

        const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
        const audioPlayer = document.getElementById('audioPlayer');
        const preloadAudio = document.getElementById('preloadAudio');

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

        // Audio event listeners
        audioPlayer.addEventListener('loadedmetadata', updateTimeDisplay);
        audioPlayer.addEventListener('timeupdate', () => {
                updateSeekBar();
                updateTimeDisplay();
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

        function togglePlayPause() {
            if (audioPlayer.src) {
                if (isPlaying) {
                    audioPlayer.pause();
                } else {
                    audioPlayer.play().catch(error => {
                        // vscode.postMessage({
                        //     type: 'error',
                        //     text: \`Error playing audio: \${error.message}\`
                        // });
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
                // vscode.postMessage({
                //     type: 'info',
                //     text: 'No next song available'
                // });
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

        function seekTo(event) {
            if (!audioPlayer.duration) return;
            const rect = event.target.getBoundingClientRect();
            const percent = (event.clientX - rect.left) / rect.width;
            audioPlayer.currentTime = percent * audioPlayer.duration;
        }

        function formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return \`\${mins}:\${secs.toString().padStart(2, '0')}\`;
        }

        function toggleAutoplay() {
            isAutoplayEnabled = !isAutoplayEnabled;
            const autoplayBtn = document.getElementById('autoplayBtn');
            const autoplayIcon = document.getElementById('autoplayIcon');
            
            if (isAutoplayEnabled) {
                autoplayBtn.classList.add('active');
                autoplayIcon.textContent = '🔄';
                autoplayBtn.title = 'Autoplay On';
            } else {
                autoplayBtn.classList.remove('active');
                autoplayIcon.textContent = '⏸️';
                autoplayBtn.title = 'Autoplay Off';
            }
        }

        async function handleSongEnded() {
            console.log('🎵 Song ended');
            
            if (!isAutoplayEnabled) {
                console.log('⏸️ Autoplay disabled, stopping');
                isPlaying = false;
                updatePlayPauseButton();
                vscode.postMessage({ type: 'stopped' });
                return;
            }

            if (nextSong && nextSong.preloadElement) {
                console.log(\`▶️ Auto-playing next song: \${nextSong.title}\`);
                
                // Switch to the preloaded audio
                const preloadedAudio = nextSong.preloadElement;
                
                // Copy the preloaded audio to the main player
                audioPlayer.src = preloadedAudio.src;
                audioPlayer.currentTime = 0;
                
                // Update UI
                const miniPlayerTitle = document.getElementById('miniPlayerTitle');
                const miniPlayerArtist = document.getElementById('miniPlayerArtist');
                const miniPlayerThumbnail = document.getElementById('miniPlayerThumbnail');
                
                miniPlayerTitle.textContent = nextSong.title;
                miniPlayerArtist.textContent = nextSong.artist;
                if (nextSong.thumbnail) {
                    miniPlayerThumbnail.src = nextSong.thumbnail;
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
                audioPlayer.play().catch(error => {
                    console.error('Error auto-playing next song:', error);
                    // vscode.postMessage({
                    //     type: 'error',
                    //     text: \`Error auto-playing next song: \${error.message}\`
                    // });
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
                isPlaying = false;
                updatePlayPauseButton();
                vscode.postMessage({ type: 'stopped' });
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
                const streamUrl = \`https://stream.sharecodelive.com/stream/\${song.id}\`;
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
            const nextSongInfo = document.getElementById('nextSongInfo');
            const nextSongThumb = document.getElementById('nextSongThumb');
            const nextSongTitle = document.getElementById('nextSongTitle');
            const nextSongArtist = document.getElementById('nextSongArtist');
            
            if (song) {
                nextSongThumb.src = song.thumbnail;
                nextSongTitle.textContent = song.title;
                nextSongArtist.textContent = song.artist;
                nextSongInfo.classList.add('active');
            } else {
                nextSongInfo.classList.remove('active');
            }
        }

        function closePlayer() {
            const miniPlayer = document.getElementById('miniPlayer');
            const nextSongInfo = document.getElementById('nextSongInfo');
            const seekBarContainer = document.getElementById('seekBarContainer');

            // Stop and clean up main audio
            audioPlayer.pause();
            audioPlayer.src = '';
            
            // Clean up preloaded audio
                preloadAudio.pause();
                preloadAudio.src = '';
            
            // Hide player and seek bar
            miniPlayer.classList.remove('active');
            seekBarContainer.classList.remove('active');
            nextSongInfo.classList.remove('active');

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
            vscode.postMessage({ type: 'stopped' });
        }

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
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');

            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            document.getElementById(tabName).style.display = 'block';

            currentTab = tabName;

            if (tabName === 'trending' && !trendingLoaded && config.apiKey) {
                loadTrending();
            } else if (tabName === 'regional' && !regionalLoaded.IN && config.apiKey) {
                loadRegional('IN');
                loadRegional('GB');
            }
        }

        async function loadTrending() {
            if (!config.apiKey) return;

            trendingLoaded = false;
            const container = document.getElementById('trending');
            container.innerHTML = '<div class="section-title">🔥 Trending Music</div><div class="loading"><div class="spinner"></div></div>';

            try {
                const response = await fetch(
                    \`\${YOUTUBE_API_BASE}/videos?part=snippet,statistics&chart=mostPopular&videoCategoryId=10&maxResults=\${config.maxResults}&regionCode=\${config.region}&key=\${config.apiKey}\`
                );

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                container.innerHTML = '<div class="section-title">🔥 Trending Music</div><div class="song-list"></div>';
                const songList = container.querySelector('.song-list');
                
                data.items.forEach(video => {
                    songList.appendChild(createSongItem({
                        id: video.id,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url
                    }));
                });

                trendingLoaded = true;
                // vscode.postMessage({ type: 'info', text: \`Loaded \${data.items.length} trending songs\` });

            } catch (error) {
                container.innerHTML = '<div class="section-title">🔥 Trending Music</div><div class="error">Failed to load trending music</div>';
                // vscode.postMessage({ type: 'error', text: \`Failed to load trending: \${error.message}\` });
            }
        }

        async function loadRegional(regionCode) {
            if (!config.apiKey) return;

            const containerId = regionCode === 'IN' ? 'indiaResults' : 'ukResults';
            const container = document.getElementById(containerId);
            container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

            try {
                const response = await fetch(
                    \`\${YOUTUBE_API_BASE}/videos?part=snippet&chart=mostPopular&videoCategoryId=10&maxResults=15&regionCode=\${regionCode}&key=\${config.apiKey}\`
                );

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                container.innerHTML = '';
                data.items.forEach(video => {
                    container.appendChild(createSongItem({
                        id: video.id,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url
                    }));
                });

                regionalLoaded[regionCode] = true;

            } catch (error) {
                container.innerHTML = '<div class="error">Failed to load</div>';
            }
        }

        async function searchMusic() {
            const searchInput = document.getElementById('searchInput');
            const query = searchInput.value.trim();
            
            if (!query || !config.apiKey) return;

            const resultsContainer = document.getElementById('searchResults');
            resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

            try {
                const response = await fetch(
                    \`\${YOUTUBE_API_BASE}/search?part=snippet&maxResults=\${config.maxResults}&q=\${encodeURIComponent(query)}&type=video&videoCategoryId=10&key=\${config.apiKey}\`
                );

                const data = await response.json();
                if (data.error) throw new Error(data.error.message);

                resultsContainer.innerHTML = '<div class="song-list"></div>';
                const songList = resultsContainer.querySelector('.song-list');
                
                data.items.forEach(video => {
                    songList.appendChild(createSongItem({
                        id: video.id.videoId,
                        title: video.snippet.title,
                        artist: video.snippet.channelTitle,
                        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default.url
                    }));
                });

                // vscode.postMessage({ type: 'info', text: \`Found \${data.items.length} results\` });

            } catch (error) {
                resultsContainer.innerHTML = '<div class="error">Search failed</div>';
                // vscode.postMessage({ type: 'error', text: \`Search failed: \${error.message}\` });
            }
        }

        function createSongItem(song) {
            const item = document.createElement('div');
            item.className = 'song-item';
            
            item.innerHTML = \`
                <img src="\${song.thumbnail}" alt="\${song.title}" class="song-thumbnail" onerror="this.style.display='none'">
                <div class="song-info">
                    <div class="song-title">\${song.title}</div>
                    <div class="song-artist">\${song.artist}</div>
                </div>
                <button class="play-button" onclick="playSong('\${song.id}', '\${song.title.replace(/'/g, "\\'")}', '\${song.artist.replace(/'/g, "\\'")}', '\${song.thumbnail}')">▶</button>
            \`;
            return item;
        }

        function playSong(videoId, title, artist, thumbnail = '') {
            const streamUrl = \`https://stream.sharecodelive.com/stream/\${videoId}\`;
            const miniPlayer = document.getElementById('miniPlayer');
            const miniPlayerTitle = document.getElementById('miniPlayerTitle');
            const miniPlayerArtist = document.getElementById('miniPlayerArtist');
            const miniPlayerThumbnail = document.getElementById('miniPlayerThumbnail');
            const seekBarContainer = document.getElementById('seekBarContainer');

            // Store current song info
            currentSong = { id: videoId, title, artist, thumbnail };

            audioPlayer.src = streamUrl;
            miniPlayerTitle.textContent = title;
            miniPlayerArtist.textContent = artist;
            if (thumbnail) {
                miniPlayerThumbnail.src = thumbnail;
            }
            
            miniPlayer.classList.add('active');
            seekBarContainer.classList.add('active');

            // Reset seek bar
            document.getElementById('seekBarProgress').style.width = '0%';
            document.getElementById('timeDisplay').textContent = '0:00 / 0:00';

            vscode.postMessage({
                type: 'nowPlaying',
                title: title,
                artist: artist,
                videoId: videoId
            });

            audioPlayer.play().catch(error => {
                // vscode.postMessage({
                //     type: 'error',
                //     text: \`Error playing audio: \${error.message}\`
                // });
            });

            // Find and preload similar songs for autoplay
            if (isAutoplayEnabled) {
                findAndPreloadNext(title, artist, videoId);
            }
        }

        // Handle Enter key in search
        document.getElementById('searchInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchMusic();
            }
        });
    </script>
</body>
</html>`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('🎵 YouTube Music Streamer extension is now active!');

    // Create webview view provider
    const provider = new YouTubeMusicViewProvider(context.extensionUri);

    // Register webview view provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(YouTubeMusicViewProvider.viewType, provider)
    );

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(music) YouTube Music";
    statusBarItem.tooltip = "YouTube Music Player in Sidebar";
    statusBarItem.show();

    // Register refresh command
    const refreshCommand = vscode.commands.registerCommand('youtubeMusicStreamer.refreshPlayer', () => {
        provider.refresh();
        // vscode.window.showInformationMessage('🔄 Music Player refreshed!');
    });

    context.subscriptions.push(refreshCommand, statusBarItem);
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
} 