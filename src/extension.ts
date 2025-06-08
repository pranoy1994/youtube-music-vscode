import * as vscode from 'vscode';
/*
//create envConfig.ts that contains the environment variables for the extension.
export interface EnvConfig {
  MUSIC_PLAYER_URL: string;
  [key: string]: any;
}

export function getEnvConfig(): EnvConfig {
  return {
    MUSIC_PLAYER_URL: 'http://localhost:3000' 
  };
} 
*/
import { getEnvConfig } from './envConfig';

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
            localResourceRoots: [this._extensionUri],
            enableCommandUris: true,
            enableForms: true
        };

        try {
            webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        } catch (error) {
            console.error('Failed to load webview HTML:', error);
            webviewView.webview.html = `
                <html>
                <body>
                    <h3>Error loading YouTube Music Player</h3>
                    <p>Failed to load the player interface. Please try refreshing.</p>
                    <button onclick="location.reload()">Refresh</button>
                </body>
                </html>
            `;
        }

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
            try {
                this._view.webview.html = this._getHtmlForWebview(this._view.webview);
            } catch (error) {
                console.error('Failed to refresh webview:', error);
                vscode.window.showErrorMessage('Failed to refresh YouTube Music Player');
            }
        }
    }
    private _getIframeSrc(): { url: string, iframeSrc: string } {
        const URL = getEnvConfig().MUSIC_PLAYER_URL || '';
        return {
            url: URL,
            iframeSrc: `${URL}?_t=${Date.now()}&vscode=true`,
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: vscode-resource:; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; media-src https: data: blob:; connect-src https: wss:; font-src 'self' data: https:; child-src 'none'; frame-src ${this._getIframeSrc().url}">
    <title>YouTube Music Player</title>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
            display: block;
        }
    </style>
</head>
<body>
    <iframe src="${this._getIframeSrc().iframeSrc}" allow="autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen ></iframe>
</body>
</html>`;
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('🎵 YouTube Music Streamer extension is now active!');

    try {
        const provider = new YouTubeMusicViewProvider(context.extensionUri);

        const viewProviderDisposable = vscode.window.registerWebviewViewProvider(
            YouTubeMusicViewProvider.viewType, 
            provider,
            {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            }
        );
        context.subscriptions.push(viewProviderDisposable);

        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = "$(music) YouTube Music";
        statusBarItem.tooltip = "YouTube Music Player in Sidebar";
        statusBarItem.show();

        const refreshCommand = vscode.commands.registerCommand('youtubeMusicStreamer.refreshPlayer', () => {
            provider.refresh();
        });

        const openPlayerCommand = vscode.commands.registerCommand('youtubeMusicStreamer.openPlayer', () => {
            vscode.commands.executeCommand('youtube-music-player.focus');
        });

        context.subscriptions.push(refreshCommand, openPlayerCommand, statusBarItem);

        console.log('✅ YouTube Music Streamer extension activated successfully');
    } catch (error) {
        console.error('❌ Failed to activate YouTube Music Streamer extension:', error);
        vscode.window.showErrorMessage(`Failed to activate YouTube Music Streamer: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
} 