import * as vscode from 'vscode';

/**
 * Example snippet showing how to read YouTube Music configuration
 * This demonstrates the usage requested by the user.
 */

// Get the YouTube Music configuration section
const config = vscode.workspace.getConfiguration('youtubeMusic');

// Read specific configuration values
const apiKey = config.get<string>('apiKey', ''); // Default to empty string if not set
const autoStart = config.get<boolean>('autoStart', false); // Default to false if not set

// Alternative: Get all configuration as an object
const allConfig = config.get('youtubeMusic');

// Example function to safely get API key with validation
export function getYouTubeMusicApiKey(): string | null {
    const config = vscode.workspace.getConfiguration('youtubeMusic');
    const apiKey = config.get<string>('apiKey', '');
    
    if (!apiKey || apiKey.trim() === '') {
        vscode.window.showWarningMessage('YouTube Music: Please configure your API key in settings');
        return null;
    }
    
    return apiKey;
}

// Example function to update configuration programmatically
export async function updateApiKey(newApiKey: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('youtubeMusic');
    
    try {
        // Update the setting globally (can also use ConfigurationTarget.Workspace)
        await config.update('apiKey', newApiKey, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('YouTube Music: API key updated successfully');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update API key: ${error}`);
    }
}

// Example: Listen for configuration changes
export function watchConfigurationChanges(context: vscode.ExtensionContext): void {
    const disposable = vscode.workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration('youtubeMusic')) {
            console.log('YouTube Music configuration changed');
            
            // Check which specific setting changed
            if (event.affectsConfiguration('youtubeMusic.apiKey')) {
                console.log('API key configuration changed');
                // Handle API key change
            }
            
            if (event.affectsConfiguration('youtubeMusic.autoStart')) {
                console.log('Auto-start configuration changed');
                // Handle auto-start change
            }
        }
    });
    
    context.subscriptions.push(disposable);
}

// Example: Validate API key format (basic validation)
export function validateApiKey(apiKey: string): boolean {
    // Basic validation - YouTube API keys are typically 39 characters
    // This is a simple check, actual validation would require an API call
    return apiKey.length >= 30 && /^[A-Za-z0-9_-]+$/.test(apiKey);
} 