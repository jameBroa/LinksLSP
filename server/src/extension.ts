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
  TextDocumentContentChangeEvent
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

// Problem: How do we implement the GlobalLogger if we can't export it since we need to pass the connection variable
// Solution: n/a
// Solved: No
// Note: Do we need to solve it? console.log works as expected now so there shouldn't be a need for GlobalLogger...

// export const GlobalLogger = new LinksLSPLogger();
interface ExampleSettings {
  maxNumberOfProblems: number;
}

export interface TableColumn {
  columnName: string,
  dataType: string
}


class LanguageServer {
  private connection: Connection;
  private hasConfigurationCapability: boolean;
  private hasWorkspaceFolderCapability: boolean;
  private hasDiagnosticRelatedInformationCapability: boolean;
  private documents: TextDocuments<TextDocument>;
  private documentsMap: Map<string, string>;
  private defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
  private globalSettings: ExampleSettings;
  private documentSettings: Map<string, Thenable<ExampleSettings>>;

  private db_tables: string[] | undefined;
  private db_schemas: Map<string, Array<{columnName:string, dataType: string}>> | undefined;

  private ocamlClient: OCamlClient;
  private mutex: Mutex;


  constructor() {
    this.connection = createConnection(ProposedFeatures.all);
    this.documents = new TextDocuments(TextDocument);
    this.hasConfigurationCapability = false;
    this.hasWorkspaceFolderCapability = false;
    this.hasDiagnosticRelatedInformationCapability = false;
    this.globalSettings = this.defaultSettings;
    this.documentSettings = new Map();
    this.documentsMap = new Map();
    this.ocamlClient = new OCamlClient();
    this.mutex = new Mutex();
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    this.documents.listen(this.connection);

    this.connection.onInitialize(this.onInitialize.bind(this));
    this.connection.onInitialized(this.onInitialized.bind(this));
    this.connection.onReferences(this.onReferences.bind(this));
    this.connection.onDefinition(this.onDefinition.bind(this));
    this.connection.onHover(this.onHover.bind(this));

    this.connection.onDidChangeTextDocument(this.onDidChangeTextDocument.bind(this));
    this.connection.onDidChangeConfiguration(this.onDidChangeConfiguration.bind(this));
    this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));
    this.connection.onNotification('custom/updateDatabaseConfig', this.onNotification.bind(this));
    this.connection.onCompletion(this.onCompletion.bind(this));

    this.connection.onRequest("textDocument/semanticTokens/full", 
      lodash.debounce(
        this.onRequestFull, 
        300,
        {trailing: true}
      ).bind(this));
    // this.connection.onRequest("textDocument/semanticTokens/full", this.onRequestFull.bind(this));

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
          hoverProvider: true,
          textDocumentSync: TextDocumentSyncKind.Incremental,
          semanticTokensProvider: {
            legend: {
              // tokenTypes: ["signature", "function", "variable", "comment"],
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
                "usedFunction"
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
  private async onReferences(params: ReferenceParams): Promise<Location[]> {

    let ast;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      console.log("Getting AST from map");
      console.log(`======= Document state:\n"${this.documentsMap.get(params.textDocument.uri)}"\n\n\n =====`);
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
    } else {
      // this is for when the file is first loaded
      console.log("Getting AST from file itself");
      ast = await this.getAST(params);
    }
    // const ast = await this.getAST(params);

    if(!ast) {
      console.log("[LanguageServer.OnReferences] Could not get AST");
      return [];
    }

    function removeParentField(key: string, value: any){
      if(key==="parent"){
        return undefined;
      } else{
        return value;
      }
    }
    
    // Retrieve ASTNode at the position of the cursor

    // For some reason character position on the first line is 1 (or line 0?) behind?
    let position;
    if(params.position.line === 0) {
      position = Position.create(
        params.position.line, params.position.character+1
      );
    } else {
      position = params.position;
    }


    const referenceNode = AST.findNodeAtPosition(ast, position);
    if(!referenceNode){
      console.log("[LanguageServer.OnReferences] Could not find node at cursor position");
      return [];
    }

    // console.log(`[LanguageServer.OnReferences] referenceNode: ${JSON.stringify(referenceNode, removeParentField, 2)}`);
    let valid_references: Location[] = [];
    if(!referenceNode.parent) {
      return [];
    }
    
    console.log(`[LanguageServer] Node Type: ${referenceNode.value}`);
    if(referenceNode.value === "NormalFunlit") {
      // Do Function reference
      console.log("[LanguageServer] Trying to find function references");
      // console.log(`[LanguageServer] Actual referenceNode: ${JSON.stringify(referenceNode.parent, removeParentField, 2)}`);
      // Node at cursor for functions isn't actually the function node. This is a quirk with the AST as currently, nodes are
      // found by their range, and the function node's range is the same as FunctionLits range.
      const functionNode = referenceNode.parent;
      const references = AST.getFunctionReferences(functionNode, ast);
      // console.log(`[LanguageServer] references: ${JSON.stringify(references, removeParentField, 2)}, all Function references tree`);

      for(let ref of references) {
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
              Position.create(new_start-1, ref.range.start.character-1),
              Position.create(new_end-1, ref.range.end.character-1)
            ))
          )
        );
      });
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
              Position.create(new_start-1, new_start_char),
              Position.create(new_end-1, new_end_char)
            ))
          )
        );
      });
      return ret;
    }
  }

  private isBefore(range1: Range, range2: Range): boolean {
    if (range1.end.line < range2.start.line) {
      return true;
    }
    if (range1.end.line === range2.start.line && range1.end.character < range2.start.character) {
      return true;
    }
    return false;
  }
  
  private isAfter(range1: Range, range2: Range): boolean {
    if (range1.start.line > range2.end.line) {
      return true;
    }
    if (range1.start.line === range2.end.line && range1.start.character > range2.end.character) {
      return true;
    }
    return false;
  }

  private async getAST(uri: TextDocumentPositionParams): Promise<AST.ASTNode | null> {
    let document = this.documents.get(uri.textDocument.uri);
    if (!document) {
        return null;
    }

    // Get the in-memory content of the document
    const documentContent = document.getText();

    // Define a path for the temporary file
    // const tempFilePath = path.join(__dirname, 'temporary.links');

    // await fs.writeFile(tempFilePath, documentContent, 'utf8');

    try {
        // Write the in-memory content to the temporary file
        // Send the temporary file to the parser
        const AST_as_json: string = await this.ocamlClient.get_AST_as_JSON(`${uri.textDocument.uri.replace("file://", "")}\n`);
        // Parse the AST from the JSON
        const ast = await AST.fromJSON(AST_as_json, documentContent);
        return ast;
    } catch (error) {
        console.error('Error while generating AST:', error);
        return null;
    } 
    // finally {
    //     // Clean up the temporary file
    //     try {
    //         await fs.unlink(tempFilePath);
    //     } catch (cleanupError) {
    //         console.warn('Failed to delete temporary file:', cleanupError);
    //     }
    // }
    // const document = this.documents.get(uri.textDocument.uri);
    // if (!document) {
    //   return null;
    // }
    // const fileLocation = document.uri.substring(7, document.uri.length);
    // const AST_as_json: string = await this.ocamlClient.get_AST_as_JSON(`${fileLocation}\n`);
    // const ast = AST.fromJSON(AST_as_json, document.getText());
    // return ast;
  }

  private async getASTFromText(text: string): Promise<AST.ASTNode | null> {

    let documentContent = text;

    const tempFilePath = path.join(__dirname, 'temporary.links');

    try {
        // Write the in-memory content to the temporary file
        await fs.writeFile(tempFilePath, documentContent, 'utf8');
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

  private async onDefinition(params: TextDocumentPositionParams): Promise<Location | null> {
    // Can do for variables and functions

    let ast;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      console.log("Getting AST from map");
      console.log(`======= Document state:\n"${this.documentsMap.get(params.textDocument.uri)}"\n\n\n =====`);
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
    } else {
      // this is for when the file is first loaded
      console.log("Getting AST from file itself");
      ast = await this.getAST(params);
    }





    // const ast = await this.getAST(params);
    if (!ast) {
      return null;
    }

    const referenceNode = AST.findNodeAtPosition(ast, params.position);

    if (!referenceNode) {
      console.log("[LanguageServer.onDefinition] Could not find node at cursor position");
      return null;
    }

    // console.log(`[LanguageServer.onDefinition] referenceNode: ${JSON.stringify(referenceNode, AST.removeParentField, 2)}`);
    // console.log(`[LangaugeServer.onDefinition] whole AST: ${JSON.stringify(ast, AST.removeParentField, 2)}`);
    if(referenceNode.parent && 
      referenceNode.parent.value==="FnAppl" && 
      referenceNode.parent.children &&
      referenceNode.parent.children[0] === referenceNode
    ){
      // OnDefinition for function
      console.log(`[LanguageServer.onDefinition] looking for function definition`);
      const functionName = referenceNode.value.split(" ")[1];
      const functionDefinition = AST.getFunctionDefinition(functionName, ast);

      if(!functionDefinition) {
        console.log(`[LangaugeServer.onDefinition] Could not find function definition for ${functionName}`);
        return null;
      }
      let ret;
      // For some reason, if the function is on the first line, the character is off by 1. Not sure why
      // console.log(`[LanguageServer.onDefinition] functionDefinition.range.start.line: ${functionDefinition.range.start.line}`);
      if(functionDefinition.range.start.line === 1) {
        ret =  Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(functionDefinition.range.start.line-1, functionDefinition.range.start.character+2),
            Position.create(functionDefinition.range.start.line-1, functionDefinition.range.start.character+2)
          )
        );
      } else {
        ret =  Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(functionDefinition.range.start.line-1, functionDefinition.range.start.character+3),
            Position.create(functionDefinition.range.start.line-1, functionDefinition.range.start.character+3)
          )
        );
      } 
      // console.log(`[LanguageServer.onDefinition] functionDefinition: ${JSON.stringify(ret, null, 2)}`);
      return ret;
    } else {
      // OnDefinition for variable
      console.log(`[LanguageServer.OnDefinition] Looking for variables...`);
      if(AST.isParameterVariable(referenceNode, ast)) {
        console.log(`[LanguageServer.OnDefinition] referenceNode is a parameter so returning same position...`);
        let ret;
        ret = Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(referenceNode.range.start.line-1, referenceNode.range.start.character-1),
            Position.create(referenceNode.range.end.line-1, referenceNode.range.end.character-1)
          )
        );
        // console.log(`[LanguageServer.OnDefinition] ret: ${JSON.stringify(ret, null, 2)}`);
        return ret;
      }
      // console.log(`[LanguageServer.OnDefinition] referenceNode: ${JSON.stringify(referenceNode, AST.removeParentField, 2)}`);

      let functionNode = AST.findFunctionNodeOfParam(referenceNode, ast);

      if(!functionNode) {
        console.log(`[LanguageServer.OnDefinition] Could not find function node for variable`);
        // console.log(`[LanguageServer.OnDefinition] referenceNode: ${JSON.stringify(referenceNode, AST.removeParentField, 2)}`);
        return null;
      } else if (!functionNode.children) {
        console.log(`[LanguageServer.OnDefiniton] Function node has no children`);
        return null;
      }
      // console.log(`[LanguageServer.OnDefinition] functionNode: ${JSON.stringify(functionNode, AST.removeParentField, 2)}`);

      // Sets the node to the the NormalFunLit node (this is where the parameters are defined semantically)
      functionNode = functionNode.children[1];
      if(!functionNode || !functionNode.children) {
        return null;
      }

      let varNode: AST.ASTNode | null = null;

      for(const child of functionNode.children){
        if(child.type === "Leaf" && 
          child.value === referenceNode.value
        ) {
          varNode = child;
        }
      }

      if(!varNode) {
        console.log(`[LanguageServer.OnDefinition] Could not find paramNode, must be scopeDefined`);
        // If can't find variable as parameter, it MUST be a scope defined variable.
        varNode = AST.findFirstReference(referenceNode, functionNode);
      }

      // console.log(`[LanguageServer.OnDefinition] varNode: ${JSON.stringify(varNode, AST.removeParentField, 2)}`);

      if(varNode.range.start.line === 1) {
        return Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(varNode.range.start.line-1, varNode.range.start.character-2),
            Position.create(varNode.range.start.line-1, varNode.range.end.character-2)
          )
        );
      } else {
        return Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(varNode.range.start.line-1, varNode.range.start.character-1),
            Position.create(varNode.range.start.line-1, varNode.range.end.character-1)
          )
        );
      }
    }
    // Old code which will be implemented via ASTs 

    // const lines = text.split(/\r?\n/g);
    // const word = InfoRetriever.getWordAtPosition(lines, params.position);
    // // GlobalLogger.log(`word: ${word}`);
    // for(let i = 0; i < lines.length; i++){
    //   const line = lines[i];
    //   const match = new RegExp(`fun\\s+${word}\\s*\\(`).exec(line);
    //   if(match){
    //     return Location.create(
    //       params.textDocument.uri, 
    //       Range.create(
    //         Position.create(i, match.index), 
    //         Position.create(i, match.index + match[0].length)
    //       )
    //     );
    //   }
    // }
    // return null;
  }
  private async onHover(params: TextDocumentPositionParams): Promise<Hover | null> {
    const document = this.documents.get(params.textDocument.uri);
    if(!document) {
      return null;
    }
    
    return null;
  
    // Previous implementation
    // // GlobalLogger.log(`text (HERE): ${text}`);
    // console.log(`text (HERE): ${text}`);
    // let text_to_send = text;
    // text_to_send = text_to_send.replace(/\s+/g, ' ').trim();
  
    // // const client = new net.Socket();
    // // client.connect(8081, '127.0.0.1', () => {
    // //   client.write(`${text_to_send}\n`);
    // // });
  
    // // client.on('data', (data) => {
    // //   console.log(`Received (1): ${JSON.stringify(JSON.parse(data.toString()), null, 2)}`);
    // //   console.log(`Received (2): ${data.toString()}`);
    // //   let data_str = data.toString();
    // //   console.log(text_to_send.substring(175, 220));
    // //   client.destroy();
    // // });
  
    // const lines = text.split(/\r?\n/g);
    // const word = InfoRetriever.getWordAtPosition(lines, params.position);
    // const functionRegex = new RegExp(`fun\\s+${word}\\s*\\(([^)]*)\\)\\s*{`);
  
    // for (let i = 0; i < lines.length; i++) {
    //   const line = lines[i];
    //   const match = functionRegex.exec(line);
    //   if (match) {
    //     const hoverContent: MarkupContent = {
    //       kind: 'markdown',
    //       value: `\`\`\`plaintext\n${match[0]}\n\`\`\``
    //     };
    //     return {
    //       contents: hoverContent,
    //       range: Range.create(
    //         Position.create(i, match.index),
    //         Position.create(i, match.index + match[0].length)
    //       )
    //     };
    //   }
    // }
    // return null;
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
  private async validateTextDocument(textDocument: TextDocument): Promise<void> {
     // In this simple example we get the settings for every validate run.
    let settings = await this.getDocumentSettings(textDocument.uri);
    // The validator creates diagnostics for all uppercase words length 2 and more
    let text = textDocument.getText();
    let pattern = /\b[A-Z]{2,}\b/g;
    let m: RegExpExecArray | null;

    let problems = 0;
    let diagnostics: Diagnostic[] = [];
    

    while ((m = pattern.exec(text)) && problems < 1000) { //hardcoded for now
      problems++;
      let diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(m.index),
          end: textDocument.positionAt(m.index + m[0].length)
        },
        message: `${m[0]} is all uppercase.`,
        source: 'ex'
      };
      if (this.hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnostic.range)
            },
            message: 'Spelling matters'
          },
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnostic.range)
            },
            message: 'Particularly for names'
          }
        ];
      }
      diagnostics.push(diagnostic);
  }
  this.connection.sendDiagnostics({uri:textDocument.uri, diagnostics});
  }
  private onDidClose(e: any) {
    // For now, e:any
    this.documentSettings.delete(e.document.uri);
  }
  private onDidChangeContent(change: {document: TextDocument}) {
    const document = change.document;
    const documentContent = document.getText();
    // console.log("apples");
    // console.log("content: ", documentContent, "doc changed");

    // this.validateTextDocument(change.document);
  }
  private logToClient(message: string) {
    this.connection.sendNotification("custom/logMessage", message);
  }
  private async onDidChangeWatchedFiles(_change: any) {
    // For now, _change:any
    console.log("file change!");
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
    //Todo: Remove log statements + unnecessary code
    if(this.db_tables !== undefined && this.db_schemas !== undefined) {
      const provider = new TableCompletionProvider(this.db_tables, this.db_schemas); // need to pass in tables and schemas
      const document = this.documents.get(params.textDocument.uri);
      if (!document) {
        return [];
      }
      const eg_working = [{"label":"accounts","kind":15,"detail":"Table: accounts","documentation":{"kind":"markdown","value":"Columns:\n- id: integer\n- accounttype: text\n- balance: double precision"},"insertTextFormat":2,"textEdit":{"range":{"start":{"line":7,"character":21},"end":{"line":7,"character":29}},"newText":"\"accounts\" with (id: Int, accounttype: String, balance: Float) from db;"}}];
      // return eg_working as CompletionItem[];
      const completion = await provider.provideCompletions(document, params.position);
      // GlobalLogger.log(`completion from onCompletion: ${JSON.stringify(completion)}`);
      
      // GlobalLogger.log(`${eg_working === completion}`);
      // GlobalLogger.log(`eg_working: ${JSON.stringify(eg_working)}`);
      // return [{"label":"accounts","kind":15,"detail":"Table: accounts","documentation":{"kind":"markdown","value":"Columns:\n- id: integer\n- accounttype: text\n- balance: double precision"},"insertTextFormat":2,"textEdit":{"range":{"start":{"line":7,"character":23},"end":{"line":7,"character":29}},"newText":"\"accounts\" with (id: Int, accounttype: String, balance: Float) from db;"}}];
      return completion;
    } else {
      return [];
    }
  }

  // documentsMap: Map<string, string>
  // key is supposedly uri
  // value is the string representation of the document

  private debounce(func: (...args: any[]) => void, wait: number) {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }


  private debouncedOnDidChangeTextDocument = this.debounce(async (params: DidChangeTextDocumentParams) => {
    let document = params.textDocument;
    let contentChanges: TextDocumentContentChangeEvent[] = params.contentChanges;
  
    let documentContent;
    if (this.documentsMap.has(document.uri)) {
      documentContent = this.documentsMap.get(document.uri);
    } else {
      documentContent = this.documents.get(document.uri)!.getText();
    }
  
    // Assuming documentContent is never undefined (maybe a bad assumption)
    let newDocumentContent = DocumentManipulator.AdjustDocument(documentContent!, contentChanges);
  
    this.documentsMap.set(document.uri, newDocumentContent);
  
    await this.onRequestFull(params);
    this.connection.sendNotification('custom/refreshSemanticTokens', { uri: document.uri });
  }, 300); // Adjust the debounce delay as needed

  private async onDidChangeTextDocument(params: DidChangeTextDocumentParams){
    console.log(`[onDidChangeTextDocument] called`);
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

    await this.onRequestFull(params);
    this.connection.sendNotification('custom/refreshSemanticTokens', { uri: document.uri });
    // this.connection.sendRequest('workspace/semanticTokens/refresh');

  }
  
  


  private async onRequestFull(params: any) {
    const release = await this.mutex.acquire();
    try {
    console.log(`[onRequestFull] called`);
    console.log(`[onRequestFull] document version: ${params.version}`);
    let ast;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      console.log("[onRequestFull] Getting AST from map");
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
    } else {
      // this is for when the file is first loaded
      console.log("[onRequestFull] Getting AST from file itself");
      ast = await this.getAST(params);
    }

    if(!ast){
      return;
    }

    // console.log(`DOING SEMANTIC BUILDING!!!!!`);

    let builder = new SemanticTokensBuilder();

    // ##################### VARIABLES #####################
    const all_vars: AST.ASTNode[] = AST.getAllVariables(ast);

    let all_vars_no_cons = all_vars.filter((node) => {
      return node.value.substring(0,35) !== "Constant: (CommonTypes.Constant.Int" 
      && node.value.substring(0, 37) !== "Constant: (CommonTypes.Constant.Float" &&
      node.value.substring(0, 38) !== "Constant: (CommonTypes.Constant.String";
    });

    let unused_variables = AST.variableParser.extractUnusedVariables(all_vars_no_cons);

    let unused_variables_set = new Set(unused_variables);

    let used_variables = all_vars_no_cons.filter((node) => {
      return !unused_variables_set.has(node);
    });

    let constants = all_vars.filter((node) => {
      return node.value.substring(0,35) === "Constant: (CommonTypes.Constant.Int" || 
      node.value.substring(0, 37) === "Constant: (CommonTypes.Constant.Float";
    });

    let string_constants = all_vars.filter((node) => {
      return node.value.substring(0, 38) === "Constant: (CommonTypes.Constant.String";
    });

    let projections = AST.variableParser.extractProjectionsFromAST(ast);
    // ##################### ######### #####################


    let all_xml = AST.getXMLNodes(ast);

    let xml = all_xml.filter((node) => {
      return node.value.substring(0,9) !== "TextNode:";
    });

    // ##################### FUNCTIONS #####################


    // TODO: Modify all the following functions below into ONE

    let functionDefinitions = AST.functionParser.extractFunctionDefinitions(ast);

    // functionCalls: an array of strings which are just the function calls in a doc.
    let functionCalls = AST.functionParser.extractFunctionCalls(ast);

    // functionCallsMap is just a Map between function name and the number of times it is called
    let functionCallsMap = AST.functionParser.createFunctionToNumCallsMap(functionCalls);
    let functionCallers = AST.functionParser.getFunctionCallers(ast);


    let unusedFunctions: AST.ASTNode[] = [];
    if(functionDefinitions){
        unusedFunctions = functionDefinitions.filter((node) => {
          return !functionCallsMap.has(node.value.split(" ")[1]) || functionCallsMap.get(node.value.split(" ")[1]) === 0;
    
        });
    }
    

    let usedFunctions: AST.ASTNode[] = [];

    if(functionDefinitions){
      usedFunctions = functionDefinitions.filter((node) => {
        return functionCallsMap.has(node.value.split(" ")[1]);
      });
    }
    
    // ##################### ######### #####################

 
    const document = this.documents.get(params.textDocument.uri);
    if(!document){
      return null;
    } 


    // ##################### XML #####################

    let xml_semantics;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      xml_semantics = AST.xmlParser.extractSemantics(xml, this.documentsMap.get(params.textDocument.uri)!);
     
    } else {
      // this is for when the file is first loaded
      xml_semantics = AST.xmlParser.extractSemantics(xml, document.getText());
    }

    // let xml_semantics = AST.xmlParser.extractSemantics(xml, document);

    let xml_declaration = xml_semantics.filter((node) => {
      return node.value !== "xmlTag" && node.value !== "xmlAttribute";
    });

    let xml_tags = xml_semantics.filter((node) => {
      return node.value === "xmlTag";
    });

    let xml_attributes = xml_semantics.filter((node) => {
      return node.value === "xmlAttribute";
    });
    // ##################### ######### #####################


  const all_tokens = [
      ...used_variables.map(node => ({node, type: 8})),
      ...unused_variables.map(node => ({node, type: 9})),
      ...string_constants.map(node => ({node, type: 19})),
      ...constants.map(node => ({node, type: 20})),
      ...xml_declaration.map(node => ({node, type: 23})),
      ...xml_tags.map(node => (({node, type: 24}))),
      ...xml_attributes.map(node => (({node, type: 25}))),
      ...projections.map(node => (({node, type: 26}))),
      ...unusedFunctions.map(node => (({node, type: 27}))),
      ...usedFunctions.map(node => ({node, type: 28})),
      ...functionCallers.map(node => ({node, type: 28})),

  ].sort((a, b) => {
      if (!a.node.range || !b.node.range) {
        return 0;
      }
      if (a.node.range.start.line !== b.node.range.start.line) {
        return a.node.range.start.line - b.node.range.start.line;
      }
      return a.node.range.start.character - b.node.range.start.character;
  });

  // Add to builder in sorted order
  for (const {node, type} of all_tokens) {
      if(node.range.start.line === 1) {
          builder.push(
              node.range.start.line-1,
              node.range.start.character-2,
              (node.range.end.character - node.range.start.character),
              type,
              0
          );
      } else {
          builder.push(
              node.range.start.line-1,
              node.range.start.character-1,
              (node.range.end.character - node.range.start.character),
              type,
              0
          );
      }
  }

  let tokens = builder.build();
  // console.log("[onRequestFull] Generated Tokens:");
  // console.log("=================================");
  // tokens.data.forEach((token, index) => {
  //   if (index % 5 === 0) {
  //     console.log(`Token ${Math.floor(index / 5) + 1}:`);
  //   }
  //   console.log(`  ${["deltaLine", "deltaStart", "length", "tokenType", "tokenModifiers"][index % 5]}: ${token}`);
  // });
  // console.log("=================================");

    
  // this.connection.sendNotification('custom/refreshSemanticTokens', { uri: document.uri });
  return tokens;
  } catch (e) {
    console.error(`[onRequestFull] Error: ${e}`);
  } finally {
    release();
    
  }
}

  private async onRequestFullDelta(params: any) {
    const semanticTokens = {data: []} as unknown as SemanticTokens;
    return semanticTokens;
  }



  private async onRequestRange(params: any) {
    const semanticTokens = {data: []} as unknown as SemanticTokens;
    console.log(`[onRequestRange] called`);
    // return await this.onRequestFull (params);
    return semanticTokens;
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
server.start();

