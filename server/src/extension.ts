import {
  createConnection,
  TextDocuments,
  Diagnostic,
  DiagnosticSeverity,
  ProposedFeatures,
  InitializeParams,
  DidChangeConfigurationNotification,
  CompletionItem,
  CompletionItemKind,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  InitializeResult,
  DocumentSelector,
  CompletionRequest,
  Location
} from 'vscode-languageserver/node';
import {
  SemanticTokens, 
  SemanticTokensParams, 
  SemanticTokensBuilder, 
  SemanticTokenModifiers, 
  SemanticTokenTypes 
} from 'vscode-languageserver/node';

import {
  Position,
  Range,
  ReferenceParams,
  Hover,
  MarkupContent,
  Connection,
  TextDocumentChangeEvent,
  DidChangeTextDocumentParams,
  TextDocumentContentChangeEvent,
  SemanticTokensRangeParams,
  RenameParams,
  WorkspaceEdit,
  DocumentSymbol
} from 'vscode-languageserver';

import { AST } from './common/ast/ast';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { TableCompletionProvider } from './completion/TableCompletionProvider';
import { OCamlClient } from './common/ocaml/ocamlclient';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DocumentManipulator } from './common/document/document';
import * as lodash from 'lodash';
import { Mutex } from 'async-mutex';
import { LinksParserConstants } from './common/constants';
import { isConstTypeReference } from 'typescript';
import {LSPFeatureHandler } from './common/ast/node';
import { RangeReplacer } from './common/ast/namespaces/range';

// Problem: How do we implement the GlobalLogger if we can't export it since we need to pass the connection variable
// Solution: n/a
// Solved: No
// Note: Do we need to solve it? console.log works as expected now so there shouldn't be a need for GlobalLogger...

// export const GlobalLogger = new LinksLSPLogger();

enum ENV_MODE{
  FAST  = "FAST",
  SLOW = "SLOW"
}

const env = ENV_MODE.FAST;


interface ExampleSettings {
  maxNumberOfProblems: number;
}

export interface TableColumn {
  columnName: string,
  dataType: string
}

let lastAst: AST.ASTNode | null = null;


export class LanguageServer {
  public connection: Connection;
  private hasConfigurationCapability: boolean;
  private hasWorkspaceFolderCapability: boolean;
  private hasDiagnosticRelatedInformationCapability: boolean;
  public documents: TextDocuments<TextDocument>;
  private documentsMap: Map<string, string>;
  private defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
  private globalSettings: ExampleSettings;
  private documentSettings: Map<string, Thenable<ExampleSettings>>;

  private db_tables: string[] | undefined;
  private db_schemas: Map<string, Array<{columnName:string, dataType: string}>> | undefined;

  private ocamlClient: OCamlClient;
  private mutex: Mutex;
  private debouncedValidation: any;

  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.hasConfigurationCapability = false;
    this.hasWorkspaceFolderCapability = false;
    this.hasDiagnosticRelatedInformationCapability = false;
    this.globalSettings = this.defaultSettings;
    this.documentSettings = new Map();
    this.documentsMap = new Map();
    this.ocamlClient = new OCamlClient("");
    this.mutex = new Mutex();
    this.initializeHandlers();
    this.debouncedValidation = lodash.debounce(
      async (textDocument: TextDocument) => {
        // Only run diagnostics after user stops typing for 500ms
        await this.validateTextDocument(textDocument);
      }, 
      500, 
      {trailing: true}
    );
  }

  private initializeHandlers(): void {
    this.documents.listen(this.connection);

    this.connection.onInitialize(this.onInitialize.bind(this));
    this.connection.onInitialized(this.onInitialized.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onHover(this.onHover.bind(this));
    this.connection.onRenameRequest(this.onRename.bind(this));

    this.connection.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));
    this.connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
    this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
    this.connection.onNotification('custom/updateDatabaseConfig', this.onNotification.bind(this));
    this.connection.onNotification('custom/updateServerPath', this.onUpdateServerPath.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));
    this.connection.onDocumentSymbol(this.onDocumentSymbol.bind(this));

    // this.connection.onRequest("textDocument/semanticTokens/full", 
    //   lodash.debounce(
    //     this.onRequestFull.bind(this), 
    //     100,
    //     {trailing: true}
    //   ));
    this.connection.onRequest("textDocument/semanticTokens/full", this.onRequestFull.bind(this));
    this.connection.onRequest("textDocument/semanticTokens/range", this.onRequestRange.bind(this));
    // this.connection.onRequest("textDocument/semanticTokens/full/delta", this.onRequestFullDelta.bind(this));
    this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
    // workspace.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));
    this.documents.onDidClose(this.onDidClose.bind(this));
    this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
  }
  // Initialize Handler functions
  private onInitialize(params: InitializeParams) {
      let capabilities = params.capabilities;
      this.hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
      );
      this.hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
      );
      this.hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
      );
      const result: InitializeResult = {
        capabilities: {
          definitionProvider: true,
          referencesProvider: true,
          renameProvider: true,
          hoverProvider: true,
          documentSymbolProvider: true,
          textDocumentSync: TextDocumentSyncKind.Incremental,
          semanticTokensProvider: {
            legend: {
              tokenTypes: [
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
                'xmlTag',
                "xmlAttribute",
                "projections",
                "unusedFunction",
                "usedFunction",
                "functionCall",
                "variant",
                "xmlText"
              ],
              tokenModifiers: []
            },
            
            full: true,
            range:true,
          },
          completionProvider: {
            resolveProvider: true,
            triggerCharacters:['e', " "]
          }
        }
      };
      return result;
  }
  private onInitialized(){
    if (this.hasConfigurationCapability) {
      // Register for all configuration changes.
      this.connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }
    if (this.hasWorkspaceFolderCapability) {
      this.connection.workspace.onDidChangeWorkspaceFolders(_event => {
        this.connection.console.log('Workspace folder change event received.');
      });
    }
     
  }

  private async onUpdateServerPath(data: {serverPath: string}) {
    console.log(`[onUpdateServerPath] triggered update!`);
    let parentDir = path.resolve(__dirname, "..", "..");
    const hardCodedPath =path.join(parentDir, 'parser-pipline', 'parser', 'parser.ml');
    await this.ocamlClient.Update_ServerPath(hardCodedPath);
  }

  public async onDocumentSymbol(params: any): Promise<DocumentSymbol[]> {
    console.log(`[onDocumentSymbol] handleASTAndDocumentText`);
    const {ast, documentText} = await this.HandleASTAndDocumentText(params);
    if(ast === null || documentText === "") {
      return [];
    }

    const handler = new LSPFeatureHandler(ast.children![0], params.textDocument.uri);
    return handler.GetDocumentSymbols();


  }

  public async onRename(params: RenameParams): Promise<WorkspaceEdit | null> {
    const {ast, documentText} = await this.HandleASTAndDocumentText(params);
    if(ast === null || documentText === "") {
      return null;
    }
    const newPos = Position.create(params.position.line+2, params.position.character);
    const referenceNode = AST.findNodeAtPositionForRename(ast, newPos);
    if(referenceNode === null) {
      return null;
    }
    const node = new LSPFeatureHandler(ast.children![0], params.textDocument.uri);
    return node.HandleRename(referenceNode, params.newName);
  }

  public async onReferences(params: ReferenceParams): Promise<Location[]> {
    let ast;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
    } else {
      // this is for when the file is first loaded
      ast = await this.getAST(params);
    }
    if(!ast) {
      console.log("[LanguageServer.OnReferences] Could not get AST");
      return [];
    }
    
    // Retrieve ASTNode at the position of the cursor
    // For some reason character position on the first line is 1 behind?
    let position;

    position = Position.create(
      params.position.line+2, params.position.character
    );

    const referenceNode = AST.getClosestNodeFromAST(ast, position);
  
    const node = new LSPFeatureHandler(ast.children![0], params.textDocument.uri);

    if(referenceNode === null){
      return [];
    }

    let LinksNodeReferences = node.GetReferences(referenceNode);
    for(let ref of LinksNodeReferences) {
      ref.range = RangeReplacer.AdjustRangeAsRange(ref.range);
    }
    let valid_references: Location[] = [];
    if(!referenceNode.parent) {
      return [];
    }

    if(env === ENV_MODE.FAST) {
      // node.PrintAllFunVarRefNDef();
      // console.log(`[ast] ${JSON.stringify(ast, AST.removeParentField, 2)}`);

      return LinksNodeReferences;
    }
    
    if(referenceNode.value === "No signature" || referenceNode.value === "Signature") {
      // Do Function reference
      console.log("[LanguageServer] Trying to find function references");
      // Node at cursor for functions isn't actually the function node. This is a quirk with the AST as currently, nodes are
      // found by their range, and the function node's range is the same as FunctionLits range.
      let functionNode = referenceNode.parent;
      while(functionNode === referenceNode.parent || functionNode.value !== "Fun") {
        functionNode = functionNode.parent!;
      }
      const references = AST.getFunctionReferences(referenceNode.parent, ast);

      console.log(`[LanguageServer] references: ${JSON.stringify(references, AST.removeParentField, 2)}, all Function references tree`);

      let filtered_references = references.filter((node) => {
        return (node.range.start.line >= functionNode.range.start.line && node.range.end.line <= functionNode.range.end.line);
      });

      console.log(`[LanguageServer] filtered_references: ${JSON.stringify(filtered_references, AST.removeParentField, 2)}`);
      console.log(`[refernceNode.parent]: ${JSON.stringify(functionNode, AST.removeParentField, 2)}`);

      for(let ref of filtered_references) {
        let ref_pos = ref.range;
        let node_range = Range.create(
          Position.create(ref_pos.start.line, ref_pos.start.character),
          Position.create(ref_pos.end.line, ref_pos.end.character)
        );
        valid_references.push(Location.create(
          params.textDocument.uri,
          node_range
        ));
      }

      let ret: Location[] = [];

      valid_references.map(ref => {
      let new_start = ref.range.start.line;
        let new_end = ref.range.end.line;
        ret.push(
          Location.create(
            params.textDocument.uri,
            (Range.create(
              Position.create(new_start-2, ref.range.start.character-1),
              Position.create(new_end-2, ref.range.end.character-1)
            ))
          )
        );
      });

      console.log(`function references (old): ${JSON.stringify(ret, null, 2)}`);
      console.log(`function references (new): ${JSON.stringify(LinksNodeReferences, null, 2)}`);

      return ret;
    } else {
      // Do Variable reference
      console.log(`[LanguageServer.OnReferences] Trying to look for variable references...`);
      const references = AST.getVariableReferences(referenceNode, ast);

      const reference_node_range = referenceNode.parent.range;
      // console.log(`[LanguageServer] references: ${JSON.stringify(references, removeParentField, 2)}, all Variable reference tree`);
      // console.log(`[LanguageServer] reference_node_range: ${JSON.stringify(reference_node_range, null, 2)}`);

      for(let ref of references) {
        let ref_pos = ref.range;
        let node_range = Range.create(
          Position.create(ref_pos.start.line, ref_pos.start.character),
          Position.create(ref_pos.end.line, ref_pos.end.character)
        );
        // TODO: Move isBefore and isAfter to a different location
        // TODO: This might be broken with how ranges work now, but for now it works
        if(this.isBefore(node_range, reference_node_range) || this.isAfter(node_range, reference_node_range)) {
          continue;
        } 
        valid_references.push(Location.create(
          params.textDocument.uri,
          node_range
        ));
      }

      let ret: Location[] = [];

      
      valid_references.map(ref => {
        let new_start = ref.range.start.line;
        let new_end = ref.range.end.line;
        let new_start_char = ref.range.start.character;
        let new_end_char = ref.range.end.character;

        if(new_start === 1) {
          new_start_char -= 2;
          new_end_char -= 2;
        } else {
          new_start_char -= 1;
          new_end_char -=1;
        }
        ret.push(
          Location.create(
            params.textDocument.uri,
            (Range.create(
              Position.create(new_start-2, new_start_char),
              Position.create(new_end-2, new_end_char)
            ))
          )
        );
      });
      console.log(`[LanguageServer.OnReferences] ret (old): ${JSON.stringify(ret, null, 2)}`);
      console.log(`[LanguageServer.OnReferences] References (new): ${JSON.stringify(LinksNodeReferences, null, 2)}`);

      return ret;
    }
  }

  private isBefore(range1: Range, range2: Range): boolean {
    if (range1.end.line < range2.start.line) {
      return true;
    }
    if (range1.end.line === range2.start.line 
      && range1.end.character < range2.start.character) {
      return true;
    }
    return false;
  }
  
  private isAfter(range1: Range, range2: Range): boolean {
    if (range1.start.line > range2.end.line) {
      return true;
    }
    if (range1.start.line === range2.end.line 
      && range1.start.character > range2.end.character) {
      return true;
    }
    return false;
  }

  private isValidJSON(jsonString: string): boolean {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (e) {
        return false;
    }
}

  public async getAST(uri: TextDocumentPositionParams): Promise<AST.ASTNode | null> {  
    let document = this.documents.get(uri.textDocument.uri);
    
    if (!document) {
        return null;
    }    

    // Wrap with dummy function

    // Get the in-memory content of the document
    const documentContent = document.getText();
    const newDocumentContent = `fun dummy_wrapper(){\n${documentContent}\n}`;
    // Define a path for the temporary file
    const tempFilePath =  path.join(__dirname, 'temporary.links');
    await fs.writeFile(tempFilePath, newDocumentContent, 'utf8');
    // this.documentsMap.set(uri.textDocument.uri, newDocumentContent);

    try {
      await fs.writeFile(tempFilePath, newDocumentContent, 'utf8');

      let AST_as_json: string | null = null;
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
          AST_as_json = await this.ocamlClient.get_AST_as_JSON(`${tempFilePath}\n`);

          if (AST_as_json && this.isValidJSON(AST_as_json)) {
              break;
          }
          console.warn(`[getASTFromText] Invalid or incomplete JSON received. Retrying... (${attempts + 1}/${maxAttempts})`);
          attempts++;
          await lodash.delay(() => {}, 500); // Wait for 500ms before retrying
      }

      if (AST_as_json === null || !this.isValidJSON(AST_as_json)) {
          throw new Error("Failed to get valid AST as JSON");
      }

      // Parse the AST from the JSON
      const ast = AST.fromJSON(AST_as_json, "");
      return ast;
    } catch (error) {
        console.error('Error while generating AST:', error);
        return null;
    } 

  }

  private async getASTFromText(text: string): Promise<AST.ASTNode | null> {

    let documentContent = text;

    const tempFilePath = path.join(__dirname, 'temporary.links');

    try {
        // Write the in-memory content to the temporary file
        await fs.writeFile(tempFilePath, `fun dummy_wrapper(){\n${documentContent}\n()\n}`, 'utf8');
        // console.log(`[LanguageServer.getASTFromText] content to generate ast on: \n"fun dummy_wrapper(){\n${documentContent}\n}"`);
        const tempFileContent = await fs.readFile(tempFilePath, 'utf8');

        // Send the temporary file to the parser
        const AST_as_json: string = await this.ocamlClient.get_AST_as_JSON(`${tempFilePath}\n`);

        // Parse the AST from the JSON
        const ast = AST.fromJSON(AST_as_json, documentContent);
        return ast;
    } catch (error) {
        console.error('Error while generating AST:', error);
        return null;
    } finally {
        // Clean up the temporary file
        try {
            await fs.unlink(tempFilePath);
        } catch (cleanupError) {
            console.warn('Failed to delete temporary file:', cleanupError);
        }
    }

  }

  public async onDefinition(params: TextDocumentPositionParams): Promise<Location | null> {
    let ast;
    if(this.documentsMap.has(params.textDocument.uri)) {
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
    } else {
      ast = await this.getAST(params);
    }

    if (!ast) {
      return null;
    }

    const referenceNode = AST.findNodeAtPosition(
      ast, 
      Position.create(
        params.position.line+2,
        params.position.character
      )
    );

    const node = new LSPFeatureHandler(ast.children![0], params.textDocument.uri);
    // node.PrintAllFunVarRefNDef();
    let definition: Location | null = null;
    if(referenceNode !== null) {
      definition = node.GetDefinition(referenceNode, params.textDocument.uri);
      if(definition === null){
        return null;
      }
      definition = RangeReplacer.AdjustRangeAsLocation(definition);
    } else {
      return null;
    }

    if(env === ENV_MODE.FAST) {
      return definition;
    }
    return null;
  }
  private async onHover(params: TextDocumentPositionParams): Promise<Hover | null> {
    
    const document = this.documents.get(params.textDocument.uri);

    let {ast, documentText} = await this.HandleASTAndDocumentText(params);
    if(ast === null || documentText === "" || !document) {
      return null;
    }

    console.log(`[ast] ${JSON.stringify(ast, AST.removeParentField, 2)}`);
    try{
    const referenceNode = AST.getClosestNodeFromAST(ast, Position.create(params.position.line+2, params.position.character));
    const featureHandler = new LSPFeatureHandler(ast.children![0], params.textDocument.uri);
    console.log(`referenceNode.value: ${referenceNode.value}`);
    let hover: Hover | null = featureHandler.HandleHover(referenceNode.parent!);
    return hover;
    } catch (e){
      console.error(`[onHover] Error: ${e}`);
      return null;
    }
  
  }
  private onDidChangeConfiguration(change: any) {
    //For now, change:any
    // Going to change it to AST later (currently refactoring extension.ts)
    if (this.hasConfigurationCapability) {
          // Reset all cached document settings
          this.documentSettings.clear();
        } else {
          this.globalSettings = <ExampleSettings>(
            (change.settings.languageServerExample || this.defaultSettings)
          );
        }
        // Revalidate all open text documents
        this.documents.all().forEach(this.validateTextDocument.bind(this));
  }
  private getDocumentSettings(resource: string): Thenable<ExampleSettings> {
    if (!this.hasConfigurationCapability) {
          return Promise.resolve(this.globalSettings);
        }
        let result = this.documentSettings.get(resource);
        if (!result) {
          result = this.connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'languageServerExample'
          });
          this.documentSettings.set(resource, result);
        }
        return result;
  }
  public async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    console.log(`[LanguageServer.validateTextDocument] called`);
    let ast: AST.ASTNode | null;
    let documentText;
    if(this.documentsMap.has(textDocument.uri)) {
      // map is only setup when the doc changes
      console.log(`[validateTextDocument] getASTFromText`)
      ast = await this.getASTFromText(this.documentsMap.get(textDocument.uri)!);
      documentText = this.documentsMap.get(textDocument.uri);
    } else {
      // this is for when the file is first loaded
      let payload = {
        textDocument: {
          uri: textDocument.uri
        },
        position: Position.create(
          0, 0
        )
      } as TextDocumentPositionParams;
      let document = this.documents.get(textDocument.uri);
      if(!document || this.documents.get(textDocument.uri) === null) {
        return [];
      }
      documentText = this.documents.get(textDocument.uri)!.getText();

      console.log(`[validateTextDocument] getAST`);
      ast = await this.getAST(payload);
    }
    if(!ast || ast === null || !documentText) {
      return [];
    }

    const node = new LSPFeatureHandler(ast.children![0], textDocument.uri); 
    const LinksNodeDiagnostics = await node.GetDiagnostics(this.hasDiagnosticRelatedInformationCapability, documentText);
    if(env === ENV_MODE.FAST){
      console.log(`[validateTextDocument] LinksNodeDiagnostics: ${JSON.stringify(LinksNodeDiagnostics, null, 2)}`);
      this.connection.sendDiagnostics({
        uri:textDocument.uri, 
        diagnostics: LinksNodeDiagnostics
      });
      return LinksNodeDiagnostics;
    }
    return [];
  }
  private onDidClose(e: any) {
    // For now, e:any
    this.documentSettings.delete(e.document.uri);
  }
  private onDidChangeContent(change: {document: TextDocument}) {
    const document = change.document;
    const documentContent = document.getText();
    // this.validateTextDocument(change.document);
  }
  private logToClient(message: string) {
    this.connection.sendNotification("custom/logMessage", message);
  }
  private async onDidChangeWatchedFiles(_change: any) {
    // For now, _change:any
    this.connection.console.log('We received a file change event');
  }
  private onNotification(config: any){
    // For now, config:any
    let tables: string[] = config.keys;
    let schemas: Map<string, TableColumn[]> = new Map<string, TableColumn[]>(config.allSchemas);
    this.db_tables = tables;
    this.db_schemas = schemas;
  }
  private async onCompletion(params: TextDocumentPositionParams): Promise<CompletionItem[]> {
    if(env === ENV_MODE.FAST) {
      const {ast, documentText} = await this.HandleASTAndDocumentText(params);
      if(ast === null || documentText === "") {
        return [];
      }

      const featureHandler = new LSPFeatureHandler(
        ast.children![0], 
        params.textDocument.uri
      );
      const newpos = RangeReplacer.ConvertParamsPos(params.position);
      let completion = featureHandler.HandleCompletion(
        newpos, 
        documentText,
        this.db_tables,
        this.db_schemas
      );
      return completion; 

    }


    //Todo: Remove log statements + unnecessary code
    if(this.db_tables !== undefined && this.db_schemas !== undefined) {
      const provider = new TableCompletionProvider(this.db_tables, this.db_schemas); // need to pass in tables and schemas
      // const document = this.documents.get(params.textDocument.uri);
      const {ast, documentText} = await this.HandleASTAndDocumentText(params);
      if (!documentText) {
        return [];
      }
      const eg_working = [{"label":"accounts","kind":15,"detail":"Table: accounts","documentation":{"kind":"markdown","value":"Columns:\n- id: integer\n- accounttype: text\n- balance: double precision"},"insertTextFormat":2,"textEdit":{"range":{"start":{"line":7,"character":21},"end":{"line":7,"character":29}},"newText":"\"accounts\" with (id: Int, accounttype: String, balance: Float) from db;"}}];
      // return eg_working as CompletionItem[];
      try{
      const completion = await provider.provideCompletions(documentText, params.position);
      return completion;

      } catch (e){
        console.error(`[onCompletion] Error: ${e}`);
        return [];
      }
      // GlobalLogger.log(`completion from onCompletion: ${JSON.stringify(completion)}`);
      
      // GlobalLogger.log(`${eg_working === completion}`);
      // GlobalLogger.log(`eg_working: ${JSON.stringify(eg_working)}`);
      // return [{"label":"accounts","kind":15,"detail":"Table: accounts","documentation":{"kind":"markdown","value":"Columns:\n- id: integer\n- accounttype: text\n- balance: double precision"},"insertTextFormat":2,"textEdit":{"range":{"start":{"line":7,"character":23},"end":{"line":7,"character":29}},"newText":"\"accounts\" with (id: Int, accounttype: String, balance: Float) from db;"}}];
    } else {
      return [];
    }
  }

  private async onDidChangeTextDocument(params: DidChangeTextDocumentParams){
    let document = params.textDocument;
    let contentChanges: TextDocumentContentChangeEvent[] = params.contentChanges;

    let documentContent;
    if(this.documentsMap.has(document.uri)){
      documentContent = this.documentsMap.get(document.uri);
    } else {
      documentContent = this.documents.get(document.uri)!.getText();
    }

    // Assuming documentContent is never undefined (maybe a bad assumption)
    let newDocumentContent = DocumentManipulator.AdjustDocument(documentContent!, contentChanges);

    this.documentsMap.set(document.uri, newDocumentContent);

    // let newAST: AST.ASTNode | null = await this.getASTFromText(newDocumentContent);

    // What this means is that we should have a new AST for the document whenever the file changes
    // and pass this any time we want semantics done. by saving it as a field of the class, persistance
    // is achieved so the problem described in DocumentManipulator.AdjustDocument is resolved!
    console.log(`[${Date.now()}] Calling onRequestFull from onDidChangeTextDocument`);
    const textDoc = TextDocument.create(document.uri, 'links', document.version, newDocumentContent);
    await this.validateTextDocument(textDoc);
    // this.debouncedValidation(newDocumentContent);
    // await this.onRequestFull(params);
    // this.connection.sendNotification('custom/refreshSemanticTokens', { uri: document.uri });
    // this.connection.sendRequest('workspace/semanticTokens/refresh');

  }
  
public async onRequestFull(params: any) {
  try {
    let ast;
    let documentText;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      console.log(`[onRequestFull] getASTFromText`)
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
      documentText = this.documentsMap.get(params.textDocument.uri);
    } else {
      // this is for when the file is first loaded
      console.log(`[onRequestFull] getAST`)
      ast = await this.getAST(params);
      let temp = this.documents.get(params.textDocument.uri);
      documentText = temp!.getText();
    }
    if(!ast){
      if(lastAst === null){
        console.log(`[onRequestFull] AST is null and returning null`)
        return;
      }
      ast = lastAst;
    } else {
      lastAst = ast;
    }
  

    try {
      const node = new LSPFeatureHandler(ast, params.textDocument.uri);
      let SemanticTokensNew = node.BuildSemanticTokensFull(documentText!);
      if(env === ENV_MODE.FAST) {
        // this.debouncedValidation(documentText);
        // await this.validateTextDocument(params.textDocument);
        return SemanticTokensNew;
      }
    } catch (e: any) {
      console.log("[FAILED TO BUILD SEMANTIC TOKENS]", JSON.stringify(e.message));
    }
  } catch (e) { // Two wrapped try-catch blocks to test alternative implementations
    console.error(`[onRequestFull] Error: ${e}`);
  } finally {
    // await this.validateTextDocument(params.textDocument);
  }
}

  private async onRequestFullDelta(params: any) {
    const semanticTokens = {data: []} as unknown as SemanticTokens;
    return semanticTokens;
  }

  private async HandleASTAndDocumentText(params: any): Promise<{ast: AST.ASTNode | null, documentText: string}> {
    let ast;
    let documentText = "";
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
      documentText = this.documentsMap.get(params.textDocument.uri)!;
    } else {
      // this is for when the file is first loaded
      ast = await this.getAST(params);
      let temp = this.documents.get(params.textDocument.uri);
      if(temp === null){
        return {ast: null, documentText: ""};
      }
      documentText = temp!.getText();
    }

    if(!ast){
      if(lastAst === null){
        return {ast: null, documentText: ""};
      }
      ast = lastAst;
    } else {
      lastAst = ast;
    }
    return {ast, documentText};
  }

  private async onRequestRange(params: SemanticTokensRangeParams): Promise<SemanticTokens | null> {
    let semanticTokens = {data: []} as unknown as SemanticTokens;
    return semanticTokens;
    // let {ast, documentText} = await this.HandleASTAndDocumentText(params);
    // if(ast === null || documentText === ""){
    //   return semanticTokens;
    // }


    // const node = new LSPFeatureHandler(ast, params.textDocument.uri);
    // semanticTokens = node.BuildSemanticTokensRange(documentText, params.range);
    // return await this.onRequestFull (params);
    // return semanticTokens;
  }
  private onCompletionResolve(item: CompletionItem): CompletionItem {
    if (item.data === 1) {
      item.detail = 'TypeScript details';
      item.documentation = 'TypeScript documentation';
    } else if (item.data === 2) {
      item.detail = 'JavaScript details';
      item.documentation = 'JavaScript documentation';
    }
    return item;
  }
  public start():void {
    this.connection.listen();
  }
}

const server = new LanguageServer();
try{
server.start();
} catch (e){
  console.error(`[LanguageServer] Error: ${e}`);
}

