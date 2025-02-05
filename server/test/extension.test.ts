import * as assert from 'assert';
import {LanguageServer} from '../src/extension';
import {DocumentUri, Position, Range, TextDocumentPositionParams} from 'vscode-languageserver';
import * as URI from 'vscode-uri';
// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
// import * as lsp from 'vscode-languageserver';
import {
	createConnection,
	TextDocuments,
	ProposedFeatures,
  } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AnyRecordWithTtl } from 'dns';
import path from 'path';
import { AST } from '../src/common/ast/ast';
import { OCamlClient } from '../src/common/ocaml/ocamlclient';


// describe("OnDefinition LSP Tests", ()=> {
// 	let server: LanguageServer;
// 	let baseUri = path.resolve(__dirname, './onDefinitionTests/');
// 	let testOcamlClient: OCamlClient;
// 	let tempFilePath: string;
// 	before(async ()  => {
// 		server = new LanguageServer();
// 		testOcamlClient = new OCamlClient();
// 		server.start();
// 		tempFilePath = path.join(__dirname, 'temporary.links');

// 	});

// 	afterEach(async() => {
// 		try {
//             await fs.unlink(tempFilePath);
// 			sinon.restore();
//         } catch (error: any) {
//             console.error(`Error deleting temporary file: ${error.message}`);
            
//         }
// 	});

// 	it("Should return correct location for function defined at root",  async() => {
// 		const fileUri = path.join(baseUri, '1.links');
// 		const fileContent = await fs.readFile(fileUri, 'utf8');
// 		let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
// 		await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
		
// 		const position = Position.create(10, 22);

// 		sinon.stub(server, 'getAST').returns(
// 			Promise.resolve((
// 				AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
// 			))
// 		);

// 		const result = await server.onDefinition(
// 			{
// 				textDocument: {
// 					uri: fileUri.toString()
// 				},
// 				position: position
// 			}
// 		);

// 		const expected = {
// 			uri: fileUri.toString(),
// 			range: Range.create(4, 4, 4, 4)
// 		};

// 		assert.deepStrictEqual(result, expected);
// 	});


// 	it("Should return correct location for variables in the parameter of a function", async () => {
// 		const fileUri = path.join(baseUri, '1.links');
// 		const fileContent = await fs.readFile(fileUri, 'utf8');
// 		let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
// 		await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
// 		const position = Position.create(10, 33);
// 		sinon.stub(server, 'getAST').returns(
// 			Promise.resolve((
// 				AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
// 			))
// 		);
// 		const result = await server.onDefinition(
// 			{
// 				textDocument: {
// 					uri: fileUri.toString()
// 				},
// 				position: position
// 			}
// 		);
// 		const expected = {
// 			uri: fileUri.toString(),
// 			range: Range.create(8, 20, 8, 21)
// 		};
// 		assert.deepStrictEqual(result, expected);
// 	});

// 	it("Should return correct location for a variable defined inside a function", async () => {
// 		const fileUri = path.join(baseUri, '1.links');
// 		const fileContent = await fs.readFile(fileUri, 'utf8');
// 		let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
// 		await fs.writeFile(tempFilePath, newDocumentText, 'utf8');		
// 		const position = Position.create(10, 30);
// 		sinon.stub(server, 'getAST').returns(
// 			Promise.resolve((
// 				AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
// 			))
// 		);
// 		const result = await server.onDefinition(
// 			{
// 				textDocument: {
// 					uri: fileUri.toString()
// 				},
// 				position: position
// 			}
// 		);
// 		const expected = {
// 			uri: fileUri.toString(),
// 			range: Range.create(9, 8, 9, 11)
// 		};
// 		assert.deepStrictEqual(result, expected);
// 	});


// 	it('Should return correct location for variables defined in Iterators', async () => {
// 		const fileUriTwo = path.join(baseUri, '2.links');
// 		let fileContentTwo = await fs.readFile(fileUriTwo, 'utf8');
// 		let newDocumentText = `fun dummy_wrapper(){\n${fileContentTwo}\n}`;
// 		await fs.writeFile(tempFilePath, newDocumentText, 'utf8');		
// 		const position = Position.create(7, 4);
// 		sinon.stub(server, 'getAST').returns(
// 			Promise.resolve((
// 				AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
// 			))
// 		);

// 		let resultTwo = await server.onDefinition(
// 			{
// 				textDocument: {
// 					uri: fileUriTwo.toString()
// 				},
// 				position: position
// 			}
// 		);
// 		const expected = {
// 			uri: fileUriTwo.toString(),
// 			range: Range.create(6, 13, 6, 18)
// 		};
// 		assert.deepStrictEqual(resultTwo, expected);
// 	});









// });









// const connection = createConnection(ProposedFeatures.all);
// const documents = new TextDocuments(TextDocument);

// suite('LinksLSP Test Suite', () => {
// 	// vscode.window.showInformationMessage('Starting all LinksLSP test.');

// 	let server: LanguageServer = new LanguageServer();
// 	// let createConnectionStub: sinon.SinonStub;



// 	// setup(() => {
// 	// 	createConnectionStub = sinon.stub(lsp, 'createConnection').returns({
// 	// 			onInitialize: () => {},
// 	// 			onInitialized: () => {},
// 	// 			onDefinition: () => {},
// 	// 			onHover: () => {},
// 	// 			onCompletion: () => {},
// 	// 			onCompletionResolve: () => {},
// 	// 			onDocumentHighlight: () => {},
// 	// 			onDocumentSymbol: () => {},
// 	// 			onWorkspaceSymbol: () => {},
// 	// 			onSignatureHelp: () => {},
// 	// 			onReferences: () => {},
// 	// 			onCodeAction: () => {},
// 	// 			onCodeLens: () => {},
// 	// 			onCodeLensResolve: () => {},
// 	// 			onDocumentLink: () => {},
// 	// 			onDocumentLinkResolve: () => {},
// 	// 			onDocumentFormatting: () => {},
// 	// 			onDocumentRangeFormatting: () => {},
// 	// 			onDocumentOnTypeFormatting: () => {},
// 	// 			onRenameRequest: () => {},
// 	// 			onPrepareRename: () => {},
// 	// 			onExecuteCommand: () => {},
// 	// 			onDidChangeConfiguration: () => {},
// 	// 			onDidChangeWatchedFiles: () => {},
// 	// 			onDidChangeWorkspaceFolders: () => {},
// 	// 			onShutdown: () => {},
// 	// 			onExit: () => {},
// 	// 			sendRequest: () => {},
// 	// 			sendNotification: () => {},
// 	// 			on: () => {},
// 	// 			dispose: () => {}
// 	// 		} as any
// 	// 	);
// 	// 	server = new LanguageServer();
// 	// });

// 	// teardown(() => {
// 	// 	createConnectionStub.restore();
// 	// });


// 	// suite('onDefinition Test Suite', () => {

// 	// 	const baseUri = vscode.Uri.file('./onDefinition/');
// 	// 	const server = new LanguageServer();
// 	// 	const onDefinition = (server as any).onDefinition.bind(server);
		
// 	// 	// 1.links
// 	// 	test('Should return correct location for function defined at root', async () => {
// 	// 		const fileUri = `${baseUri}1.links`;
// 	// 		const position = new vscode.Position(10, 22);

// 	// 		const result = await onDefinition(
// 	// 			{
// 	// 				textDocument: {
// 	// 					uri: fileUri.toString()
// 	// 				},
// 	// 				position: position
// 	// 			}
// 	// 		);

// 	// 		const expected = {
// 	// 			uri: fileUri.toString(),
// 	// 			range: new vscode.Range(4, 4, 4, 4)
// 	// 		};

// 	// 		assert.deepStrictEqual(result, expected);
// 	// 	});

// 	// 	// // 1.links
// 	// 	// test("Should return correct location for variables in the parameter of a function", async () => {

// 	// 	// });

// 	// 	// // 1.links
// 	// 	// test("Should return correct location for a variable defined inside a function", async () => {

// 	// 	// });

// 	// 	// // 2.links
// 	// 	// test('Should return correct location for variables defined in Iterators', async () => {

// 	// 	// });

// 	// 	// // 3.links
// 	// 	// test('Should return correct location for functions used in Iterators', async () => {
		
// 	// 	// });

// 	// 	// // 4.links
// 	// 	// test('Should return correct location for function definition if nested', async () => {

// 	// 	// });




// 	// });
// });



