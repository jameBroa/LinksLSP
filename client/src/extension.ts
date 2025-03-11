/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as path from 'path';
import { workspace, ExtensionContext } from 'vscode';
import * as vscode from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind
} from 'vscode-languageclient/node';
import { IsLinxWebPage } from './common/linx-exec';
import DatabasePlugin, { DatabaseConfigProvider } from './database/LinksSidebar';
import { DatabaseHandler } from './database/DatabaseHandler';

let client: LanguageClient;

export function activate(context: ExtensionContext) {
	const legend = new vscode.SemanticTokensLegend([
		'namespace',
		'type',
		'class',
		'enum',
		'interface',
		'struct',
		'typeParameter',
		'parameter',
		'variable',
		'variableUnused',
		'property',
		'enumMember',
		'event',
		'function',
		'method',
		'macro',
		'keyword',
		'modifier',
		'comment',
		'string',
		'number',
		'regexp',
		'operator',
		'xml',
		'xmlTag'
	  ], []);

	const config = vscode.workspace.getConfiguration('links');
	const serverPath = config.get<string>('ocamlServerPath');
	// client.sendNotification('custom/updateServerPath', serverPath);


	const provider: vscode.DocumentSemanticTokensProvider = {
	provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
		return client.sendRequest('textDocument/semanticTokens/full', {textDocument: {uri: document.uri.toString()}});
	}
	};
	
	context.subscriptions.push(
	vscode.languages.registerDocumentSemanticTokensProvider({ language: 'links' }, provider, legend)
	);


	const outputChannel = vscode.window.createOutputChannel("LinksLSP");
	outputChannel.show();

	// Prevents new terminal creation every time execute command is ran
	let terminal: vscode.Terminal | undefined;

	// Logic for execute button
	let executeCommand = vscode.commands.registerCommand('extension.executeFile', () =>{
		
		const editor = vscode.window.activeTextEditor;
		if(!editor) {
			vscode.window.showErrorMessage("No file is open");
			return;
		}
		const fp = editor.document.fileName;

		if(!terminal) {
			terminal = vscode.window.createTerminal(`Links`);
		}
	
		terminal.show();
		// Add support for custom ports?
		terminal.sendText(`clear`);
		if(IsLinxWebPage(editor.document)){
			const greenText = '\x1b[32m';
			const resetText = '\x1b[0m';
			// terminal.sendText(`echo -e "${greenText} Please visit web here: http://localhost:8080${resetText}"`);
			
			terminal.sendText(`echo "Please access your webserver here: http://localhost:8080"`);
		}
		terminal.sendText(`linx ${fp}`);
	});


	// Execute links code from button
	context.subscriptions.push(executeCommand);

	// Sidebar view mode
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider('linksDatabaseView', new DatabasePlugin(context.extensionUri))
	);

	interface TableColumn {
		columnName: string,
		dataType: string
	  }

	// Communication between client and LSP regarding table code completion
	context.subscriptions.push(
		DatabaseConfigProvider.onConfigChange(async config => {
			outputChannel.appendLine("Getting tables from Database!");
			let tables: string[] = await config.getTables(outputChannel);
			outputChannel.appendLine("Successfully got tables from database!");
			
			let all_schemas: Map<string, TableColumn[]> = new Map();


			await Promise.all(tables.map(async (table) => {
				let curr_schema: TableColumn[] = await config.getSchema(table);
				
				all_schemas.set(table, curr_schema);
			}));
			outputChannel.appendLine("Schema map!");
			outputChannel.appendLine(JSON.stringify([...all_schemas.entries()]));

			client.sendNotification('custom/updateDatabaseConfig', {
				keys: tables,
				allSchemas: Array.from(all_schemas.entries()),
			});
		})	
	);

	

	

	// The server is implemented in node
	const serverModule = context.asAbsolutePath(
		path.join('dist', 'server', 'src', 'extension.js')
	);

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	const serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
		}
	};

	// Options to control the language client
	const clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'links' }],
		synchronize: {
			// Notify the server about file changes to '.links files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.links')
		},
		initializationOptions:{
			completion: {
				snippetSupport:true
			}
		}
	};

	// Create the language client and start the client.
	client = new LanguageClient(
		'languageServerExample',
		'Language Server Example',
		serverOptions,
		clientOptions
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(event => {
			if(event.affectsConfiguration('links.ocamlServerPath')){
				const newConfig = vscode.workspace.getConfiguration('links');
				const newServerPath = newConfig.get<string>('ocamlServerPath');
				console.log("New server path: ", newServerPath);
				// client.sendNotification('custom/updateServerPath', {serverPath: newServerPath});
			}
		})
	);

	// const dbHandler = new DatabaseHandler(client, outputChannel);

	// Start the client. This will also launch the server
	client.start().then(() => {
		outputChannel.appendLine("Client active and language server starting");
		client.onNotification("custom/logMessage", (message: string) => {
			outputChannel.appendLine(message);
		});
		client.onNotification("custom/refreshSemanticTokens", async (args) => {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.uri.toString() === args.uri) {
				outputChannel.appendLine("Calling provideDocumentSemanticTokens");
				await vscode.commands.executeCommand('vscode.provideDocumentSemanticTokens', editor.document);
			}
		});
		client.sendNotification('custom/updateServerPath', {serverPath: serverPath});

	});
	const selector = {language: 'links', scheme: 'file'};
	vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend);
	

}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}