import * as vscode from 'vscode';
import * as fs from 'fs';
import DatabaseConfig from './utils/DatabaseConfig';
import DatabaseType from './utils/EnumDatabaseDriver';
import { generate_table_links_code } from './utils/CodeGenerator';
import { table } from 'console';


// export const DatabaseConfigProvider = new class {
//     private static instance: DatabaseConfig | undefined;
//     private static _onConfigChange = new vscode.EventEmitter<DatabaseConfig>();

//     static get onConfigChange() {
//         return this._onConfigChange.event;
//     }

//     static setConfig(config: DatabaseConfig) {
//         this.instance = config;
//         this._onConfigChange.fire(config);
//     }

//     static getConfig() {
//         return this.instance;
//     }
// }();

class DatabaseConfigProvider {
    private static instance: DatabaseConfig | undefined;
    private static _onConfigChange = new vscode.EventEmitter<DatabaseConfig>();

    static get onConfigChange() {
        return this._onConfigChange.event;
    }

    static setConfig(config: DatabaseConfig) {
        this.instance = config;
        this._onConfigChange.fire(config);
    }
    static getConfig() {
        return this.instance;
    }
}

export {DatabaseConfigProvider};



class DatabasePlugin implements vscode.WebviewViewProvider {

    // For logging under 'LinksLSP: Database'
    private outputChannel: vscode.OutputChannel;

    driver: DatabaseType; // Maybe deprecate since in Databaseconfig
    config: DatabaseConfig | undefined;
    constructor(private readonly extensionUri: vscode.Uri) {
        this.driver = DatabaseType.None;
        this.config = undefined;
        this.outputChannel = vscode.window.createOutputChannel("LinksLSP: Database");
        this.outputChannel.appendLine("LinksLSP - Database: Logging initialized");
    }

    private updateConfig(){
        if(this.config !== undefined){
            DatabaseConfigProvider.setConfig(this.config);
        }
    }


    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        webviewView.webview.options = {
            enableScripts:true,
            localResourceRoots: [this.extensionUri]
        };
        webviewView.webview.html = this.getHtmlForWebView(webviewView.webview);

        
        // Interfaces with the HTML block to interact with DB Drivers
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch(message.command){
                case 'driverChanged':
                    switch(message.driver){
                        case 'postgres':
                            this.driver = DatabaseType.postgres;
                            if(this.config === undefined) {
                                this.config = new DatabaseConfig("", -1, "", "", DatabaseType.postgres);
                            } else {
                                this.config.driver = DatabaseType.postgres;
                            }

                            this.outputChannel.appendLine(`Driver updated!`);
                            this.outputChannel.appendLine(`Driver: ${this.driver.toString()}`);

                            break;
                        case 'MySQL':
                            this.driver = DatabaseType.MySQL;
                            break;
                        case 'SQlite':
                            this.driver = DatabaseType.SQlite;
                            break;
                        default:
                            this.driver = DatabaseType.None;
                            break;
                    }
                    break;
                case 'driverInfoSubmit':
                    const host = message.host;
                    const port = message.port;
                    const data = {
                        host,
                        port
                    };

                    // Flow: set credentials info
                    // Considerations: Check if config is null
                    // if not null, replace only host and port
                    // if null, create new obejct

                    if(this.config === undefined){
                        this.config = new DatabaseConfig(host, port, "", "", DatabaseType.None);
                    } else {
                        this.config.host = host;
                        this.config.port = port;
                    }
                    
                    this.outputChannel.appendLine(`Driver Info Updated!`);
                    this.outputChannel.appendLine(`Host: ${host}`);
                    this.outputChannel.appendLine(`Port: ${port}`);
                    

                    // Injects info to HTML file (not necessary for now)
                    webviewView.webview.postMessage({
                        "command":"confirmDriverInfo",
                        data
                    });
                    break;
                case 'driverCredSubmit':
                    const username = message.username;
                    const password = message.password;
                    const userData = {
                        username,
                        password
                    };

                    if(this.config === undefined) {
                        this.config = new DatabaseConfig("", -1, username, password, DatabaseType.None);
                    } else {
                        this.config.username = username;
                        this.config.password = password;
                    }

                    webviewView.webview.postMessage({
                        command:'confirmUserCreds',
                        userData
                    });

                    this.outputChannel.appendLine(`Driver credentials updated!`);
                    this.outputChannel.appendLine(`User: ${username}`);
                    this.outputChannel.appendLine(`Pass: ${password}`);
                    break;
                case 'getDatabases':    
                    if(this.config === undefined || this.config.isInValid()){
                        // Plugin config not setup
                    } else {
                        //Plugin config setup appropriately

                        const databases: string[] = await this.config.getDatabases(this.outputChannel);
                        
                        this.outputChannel.appendLine("Databases:");
                        databases.forEach((name, index) => {
                            this.outputChannel.appendLine(`(${index}): ${name}`);
                        });
                        
                        webviewView.webview.postMessage({
                            "command":"allDatabases",
                            databases
                        });
                    }
                    break;
                case 'databaseSelect':
                    if(this.config === undefined || this.config.isInValid()) {
                        //plugin not set up
                        // i.e. no host, no port, no user, no pass, no driver
                    } else {
                        const tables: string[] = await this.config.getTables(this.outputChannel);
                        this.outputChannel.appendLine("Tables: ");
                        tables.map((table, index) => {
                            this.outputChannel.appendLine(`(${index}): ${table} `);
                        });

                        webviewView.webview.postMessage({
                            "command":"allTables",
                            tables
                        });
                        this.updateConfig();
                    }
                    break;
                case 'generateCodeTable':
                    this.outputChannel.appendLine("TABLE NAME CHOSEN!");
                    this.outputChannel.appendLine(message.table);
                    const table_name = message.table;
                    

                    if(this.config){
                        const table_schema = await this.config.getSchema(table_name);
                        
                        const generatedCode = generate_table_links_code(table_name, table_schema);
                        // const generatedCode = `var ${table_name} = table "${table_name}" with () from db`;
    
                        const activeEditor = vscode.window.activeTextEditor;
    
                        if(activeEditor){
                            activeEditor.edit(editBuilder => {
                                editBuilder.insert(activeEditor.selection.active, generatedCode);
                            }).then(success => {
                                if(success) {
                                    this.outputChannel.appendLine("Successfully generated code!")
                                } else {
                                    this.outputChannel.appendLine("Failed to generate code!");
                                }
                            });
                        } else {
                            this.outputChannel.appendLine("No active editor found - Please open a file to insert code");
                        }
                    }
                    
                    break;
            }

        });
    }

    // Calls external HTML file for view
    private getHtmlForWebView(webview: vscode.Webview): string {
        const htmlPath = vscode.Uri.joinPath(this.extensionUri, 'client/src/database/media', 'view.html');
        const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf-8');
        return htmlContent.replace(/{{cspSource}}/g, webview.cspSource);
    }

}

export default DatabasePlugin;