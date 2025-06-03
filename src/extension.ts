import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview.html');
        return fs.readFileSync(htmlPath, 'utf8');
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