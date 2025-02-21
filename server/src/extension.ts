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

    // this.connection.onRequest("textDocument/semanticTokens/full", 
    //   lodash.debounce(
    //     this.onRequestFull, 
    //     300,
    //     {trailing: true}
    //   ).bind(this));
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
                "usedFunction",
                "functionCall"
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
  public async onReferences(params: ReferenceParams): Promise<Location[]> {
    console.log(`[onReferences] called!`);
    let ast;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
    } else {
      // this is for when the file is first loaded
      ast = await this.getAST(params);
    }
    console.log("[onReferences] got AST!");
    if(!ast) {
      console.log("[LanguageServer.OnReferences] Could not get AST");
      return [];
    }
    
    // Retrieve ASTNode at the position of the cursor
    // For some reason character position on the first line is 1 behind?
    let position;
    console.log(`[LanguageServer.OnReferences] position (before adjusting): ${JSON.stringify(params.position, null, 2)}`);

    position = Position.create(
      params.position.line+2, params.position.character
    );

    const referenceNode = AST.getClosestNodeFromAST(ast, position);
  
    const node = new LSPFeatureHandler(ast.children![0], params.textDocument.uri);

    if(referenceNode === null){
      console.log("[LanguageServer.OnReferences] Could not find node at cursor position");
      return [];
    }

    let LinksNodeReferences = node.GetReferences(referenceNode);
    for(let ref of LinksNodeReferences) {
      ref.range = RangeReplacer.AdjustRangeAsRange(ref.range);
    }
    console.log(`[LanguageServer.OnReferences] referenceNode: ${JSON.stringify(referenceNode, AST.removeParentField, 2)}`);
    let valid_references: Location[] = [];
    if(!referenceNode.parent) {
      return [];
    }

    if(env === ENV_MODE.FAST) {
      console.log(`[LanguageServer.OnReferences] Fast mode`);
      console.log(`[Fast Result]: ${JSON.stringify(LinksNodeReferences, AST.removeParentAndChildren, 2)}`);
      // node.PrintAllFunVarRefNDef();

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
        await fs.writeFile(tempFilePath, `fun dummy_wrapper(){\n${documentContent}\n}`, 'utf8');
        console.log(`[LanguageServer.getASTFromText] content to generate ast on: \n"fun dummy_wrapper(){\n${documentContent}\n}"`);
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

    console.log(`user position: ${JSON.stringify(params.position, null, 2)}`);
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

      console.log(`referenceNode: ${JSON.stringify(referenceNode, AST.removeParentAndChildren, 2)}`);


      definition = node.GetDefinition(referenceNode, params.textDocument.uri);
      if(definition === null){
        return null;
      }
      definition = RangeReplacer.AdjustRangeAsLocation(definition);
    } else {
      return null;
    }

    if(env === ENV_MODE.FAST) {
      console.log(`[Returning FAST OnDefinition!]`);
      console.log(`[Fast Result]: ${JSON.stringify(definition, AST.removeParentAndChildren, 2)}`);
      return definition;
    }

    if(
      referenceNode.parent && 
      referenceNode.parent.value==="FnAppl" && 
      referenceNode.parent.children &&
      referenceNode.parent.children[0] === referenceNode
      // referenceNode.value === "FnAppl"
    ){
      // OnDefinition for function
      // console.log(`[LanguageServer.onDefinition] looking for function definition`);
      const functionName = referenceNode.value.split(" ")[1];
      const functionDefinition = AST.getFunctionDefinition(functionName, ast);

      if(!functionDefinition) {
        console.log(`[LangaugeServer.onDefinition] Could not find function definition for ${functionName}`);
        return null;
      }
      let ret;
      if(functionDefinition.range.start.line === 1) {
        ret =  Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(functionDefinition.range.start.line-2, functionDefinition.range.start.character+2),
            Position.create(functionDefinition.range.start.line-2, functionDefinition.range.start.character+2)
          )
        );
      } else {
        ret =  Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(functionDefinition.range.start.line-2, functionDefinition.range.start.character+3),
            Position.create(functionDefinition.range.start.line-2, functionDefinition.range.start.character+3)
          )
        );
      } 
      console.log(`[LanguageServer.onDefinition] result (old): ${JSON.stringify(ret, null, 2)}`);
      console.log(`[LanguageServer.onDefinition] result (new): ${JSON.stringify(definition, null, 2)}`);

      return ret;
    } else {
      // OnDefinition for variable
      console.log(`[LanguageServer.OnDefinition] Looking for variables...`);
      if(AST.isParameterVariable(referenceNode, ast)) {
        // console.log(`[LanguageServer.OnDefinition] referenceNode is a parameter so returning same position...`);
        let ret;
        ret = Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(referenceNode.range.start.line-2, referenceNode.range.start.character-1),
            Position.create(referenceNode.range.end.line-2, referenceNode.range.end.character-1)
          )
        );
        return ret;
      }
      let definitionNode = AST.variableParser.extractVariableDefinition(referenceNode);

      if(!definitionNode) {
        return null;
      } else {
        let ret = Location.create(
          params.textDocument.uri,
          Range.create(
            Position.create(definitionNode.range.start.line-2, definitionNode.range.start.character-1),
            Position.create(definitionNode.range.end.line-2, definitionNode.range.end.character-1)
          )
        );
        console.log("[OnDefinition old]", JSON.stringify(ret, null, 2));
        console.log("[OnDefinition new] ", JSON.stringify(definition, null, 2));
        return ret;
      }

      // Everything below commented out for above!
      // let functionNode = AST.findFunctionNodeOfParam(referenceNode, ast);

      // if(!functionNode) {
      //   console.log(`[LanguageServer.OnDefinition] Could not find function node for variable`);
      //   // console.log(`[LanguageServer.OnDefinition] referenceNode: ${JSON.stringify(referenceNode, AST.removeParentField, 2)}`);
      //   return null;
      // } else if (!functionNode.children) {
      //   console.log(`[LanguageServer.OnDefiniton] Function node has no children`);
      //   return null;
      // }
      // console.log(`[LanguageServer.OnDefinition] functionNode: ${JSON.stringify(functionNode, AST.removeParentField, 2)}`);

      // // Sets the node to the the NormalFunLit node (this is where the parameters are defined semantically)
      // functionNode = functionNode.children[1];
      // if(!functionNode || !functionNode.children) {
      //   console.log(`[LanguageServer.OnDefinition] functionNode has no children`);
      //   return null;
      // }

      // let varNode: AST.ASTNode | null = null;

      // for(const child of functionNode.children){
      //   if(child.type === "Leaf" && 
      //     child.value === referenceNode.value
      //   ) {
      //     varNode = child;
      //   }
      // }

      // if(!varNode) {
      //   // console.log(`[LanguageServer.OnDefinition] Could not find paramNode, must be scopeDefined`);
      //   // If can't find variable as parameter, it MUST be a scope defined variable.
      //   varNode = AST.findFirstReference(referenceNode, functionNode);
      // }

      // // console.log(`[LanguageServer.OnDefinition] varNode: ${JSON.stringify(varNode, AST.removeParentField, 2)}`);

      // if(varNode.range.start.line === 1) {
      //   return Location.create(
      //     params.textDocument.uri,
      //     Range.create(
      //       Position.create(varNode.range.start.line-2, varNode.range.start.character-2),
      //       Position.create(varNode.range.start.line-2, varNode.range.end.character-2)
      //     )
      //   );
      // } else {
      //   let ret = Location.create(
      //     params.textDocument.uri,
      //     Range.create(
      //       Position.create(varNode.range.start.line-2, varNode.range.start.character-1),
      //       Position.create(varNode.range.start.line-2, varNode.range.end.character-1)
      //     )
      //   );
      //   console.log(`[OnDefinition] return: ${JSON.stringify(ret, null, 2)}`);
      //   return ret;
      // }
    }

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
  public async validateTextDocument(textDocument: TextDocument): Promise<Diagnostic[]> {
    let ast: AST.ASTNode | null;
    if(this.documentsMap.has(textDocument.uri)) {
      // map is only setup when the doc changes
      ast = await this.getASTFromText(this.documentsMap.get(textDocument.uri)!);
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
      ast = await this.getAST(payload);
    }

    if(!ast || ast === null) {
      return [];
    }

    const node = new LSPFeatureHandler(ast.children![0], textDocument.uri); 
    const LinksNodeDiagnostics = node.GetDiagnostics(this.hasDiagnosticRelatedInformationCapability);
    // node.PrintAllFunVarRefNDef();
    if(env === ENV_MODE.FAST){
      console.log(`[ValidateTextDocument] Finishing FAST!`);
      this.connection.sendDiagnostics({
        uri:textDocument.uri, 
        diagnostics: LinksNodeDiagnostics
      });
      console.log(`All diagnostics: ${JSON.stringify(LinksNodeDiagnostics, AST.removeParentAndChildren, 2)}`);
      return LinksNodeDiagnostics;
    }

    let diagnostics: Diagnostic[] = [];

    let allDiagnostics = AST.ProcessAST(ast);

    for(const currDiagnostic of allDiagnostics){
      let adjustedRange;
      let currNode = currDiagnostic.node;

      if(currNode.range.start.line === 1){
        adjustedRange = Range.create(
          Position.create(currNode.range.start.line-2, currNode.range.start.character-1),
          Position.create(currNode.range.end.line-2, currNode.range.end.character-1)
        );
      } else {
        adjustedRange = Range.create(
          Position.create(currNode.range.start.line-2, currNode.range.start.character-1),
          Position.create(currNode.range.end.line-2, currNode.range.end.character-1)
        );
      }

      let diagnostic: Diagnostic = {
        severity: DiagnosticSeverity.Error,
        range: adjustedRange,
        message: currDiagnostic.firstMessage,
        source: 'LinksLSP'
      };

      if (this.hasDiagnosticRelatedInformationCapability) {
        diagnostic.relatedInformation = [
          {
            location: {
              uri: textDocument.uri,
              range: Object.assign({}, diagnostic.range)
            },
            message: currDiagnostic.secondMessage
          }
        ];
      }
      diagnostics.push(diagnostic);
    }
    this.connection.sendDiagnostics({uri:textDocument.uri, diagnostics:LinksNodeDiagnostics});
    console.log(`Diagnostics (old): ${JSON.stringify(diagnostics, AST.removeParentAndChildren, 2)}`);
    console.log(`Diagnostics (new): ${JSON.stringify(LinksNodeDiagnostics, AST.removeParentAndChildren, 2)}`);

    return LinksNodeDiagnostics;
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
  

  public async onRequestFull(params: any) {
    const release = await this.mutex.acquire();
    try {
    console.log(`[onRequestFull] called`);
    let ast;
    let documentText;
    if(this.documentsMap.has(params.textDocument.uri)) {
      // map is only setup when the doc changes
      console.log("[onRequestFull] Getting AST from map");
      ast = await this.getASTFromText(this.documentsMap.get(params.textDocument.uri)!);
      documentText = this.documentsMap.get(params.textDocument.uri);
    } else {
      // this is for when the file is first loaded
      console.log("[onRequestFull] Getting AST from file itself");
      ast = await this.getAST(params);
      let temp = this.documents.get(params.textDocument.uri);
      documentText = temp!.getText();
    }


    if(!ast){
      console.log("[OnRequestFull] Couldn't get AST");
      return;
    }
    console.log(`[ast] ${JSON.stringify(ast, AST.removeParentField, 2)}`);

    try{
    const node = new LSPFeatureHandler(ast, params.textDocument.uri);
    let SemanticTokensNew = node.BuildSemanticTokensFull(documentText!);
    node.PrintAllFunVarRefNDef();
    

    if(env === ENV_MODE.FAST) {
      console.log(`[onRequestFull] Fast mode results: ${Array.from(SemanticTokensNew!.data)}`);

      return SemanticTokensNew;
    }
  } catch (e){
    console.log("[FAILED TO BUILD SEMANTIC TOKENS]", e);
  }
    let builder = new SemanticTokensBuilder();

    // ##################### VARIABLES #####################
    const all_vars: AST.ASTNode[] = AST.getAllVariables(ast);
    console.log(`[onRequestFull] all_vars: ${JSON.stringify(all_vars, AST.removeParentField, 2)}`);
    let all_vars_no_cons = all_vars.filter((node) => {
      return node.value.substring(0,35) !== "Constant: (CommonTypes.Constant.Int" 
      && node.value.substring(0, 37) !== "Constant: (CommonTypes.Constant.Float" &&
      node.value.substring(0, 38) !== "Constant: (CommonTypes.Constant.String";
    });
    
    let unused_variables = AST.variableParser.extractUnusedVariables(all_vars_no_cons);
    console.log(`[unused variables]: ${JSON.stringify(unused_variables, AST.removeParentField, 2)}`);
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

    // IF STUCK WORKING TICKET 1 HERE
    // let functionDefinitions = AST.functionParser.extractFunctionDefinitions(ast);
    // functionDefinitions: ASTNodes of type "Fun"
    let funNodes: AST.ASTNode[] = AST.functionParser.getFunctionFromAST(ast);


    let functionDefinitions: AST.ASTNode[] = [];


    try{
    for(const node of funNodes) {
      const funName = AST.functionParser.getName(node);
      const regexForFun = new RegExp(`fun\\s+${funName}\\s*\\(`);
      const regexForSig = new RegExp(`sig\\s+${funName}:\\s*\\(`);
      const RangeForFun = AST.extractRegexPosition(documentText!, node.range, regexForFun);
      const RangeForSig = AST.extractRegexPosition(documentText!, node.range, regexForSig);
      // Contains location of the 'fun {funName}'
      functionDefinitions.push({
        type: node.type,
        value: node.value,
        range: Range.create(
          Position.create(RangeForFun.start.line, RangeForFun.start.character+4),
          RangeForFun.end
        ),
        children: node.children,
        parent: node.parent
      } as AST.ASTNode);
      functionDefinitions.push({
        type: node.type,
        value: node.value,
        range: Range.create(
          Position.create(RangeForSig.start.line, RangeForSig.start.character+4),
          Position.create(RangeForSig.end.line, RangeForSig.end.character-1)
        ),
        children: node.children,
        parent: node.parent
      } as AST.ASTNode);
    }
  } catch(e){
    console.log("failed to adjust functionDefinitions", e);
  }
     
    // functionCalls: an array of strings which are just the function calls in a doc.
    let functionCalls: string[] = AST.functionParser.extractFunctionCalls(ast);
    console.log(`functionCalls: ${JSON.stringify(functionCalls, null, 2)}`);
    // functionCallsMap is just a Map between function name and the number of times it is called
    let functionCallsMap: Map<string, number> = AST.functionParser.createFunctionToNumCallsMap(functionCalls);
    // functionCallers: the actual ASTNodes of the function calls (not FnAppl but the "Variable: {funName}")
    let functionCallers: AST.ASTNode[] = AST.functionParser.getFunctionCallers(ast);

    let unusedFunctions: AST.ASTNode[] = [];
    if(functionDefinitions){
        unusedFunctions = functionDefinitions.filter((node) => {
          const funName = AST.functionParser.getName(node);
          return funName !== "dummy_wrapper" && !functionCallsMap.has(funName) || functionCallsMap.get(funName) === 0;
          // return node.value !== "Binder: dummy_wrapper" && !functionCallsMap.has(node.value.split(" ")[1]) || functionCallsMap.get(node.value.split(" ")[1]) === 0;
        });
    }
    

    let usedFunctions: AST.ASTNode[] = [];

    if(functionDefinitions){
      usedFunctions = functionDefinitions.filter((node) => {
        const funName = AST.functionParser.getName(node);
        return functionCallsMap.has(funName);
      });
    }


    // console.log("unusedFunctions", JSON.stringify(unusedFunctions, AST.removeParentField, 2));
    // console.log("usedFunctions", JSON.stringify(usedFunctions, AST.removeParentField, 2));
    
    // ##################### ######### #####################


    const document = this.documents.get(params.textDocument.uri);
    if(!document){
      return null;
    } 

    console.log("starting xml");
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

    console.log(`used variables: ${JSON.stringify(used_variables, AST.removeParentAndChildren, 2)}`);
    console.log(`!!!!!!unused functions: ${JSON.stringify(unusedFunctions, AST.removeParentAndChildren, 2)}`);


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

  // (1) identify all XML ranges
  // (2) For each XML range, perform Regex to make sure token ranges are correct
  const XMLRanges = AST.xmlParser.extractXMLRanges(ast);

  for(let node of all_tokens){
    let is_inside_xml = false;
    for(const range of XMLRanges){
      if(AST.isInRange(node.node.range, range)){
        is_inside_xml = true;
        break;
      }
    }
    if(
      is_inside_xml === true && 
      node.type !== 23 &&
      node.type !== 24 &&
      node.type !== 25
    ){
      console.log("Is inside XML, so calling adjust Ranges!");
      console.log(`node: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
      node.node.range = AST.xmlParser.adjustRanges(node.node, documentText!, node.type);

    } else {
      continue;
    }
  }




  // Add to builder in sorted order
  for (const {node, type} of all_tokens) {
      if(node.range.start.line === 1) {
          builder.push(
              node.range.start.line-2,
              node.range.start.character-2,
              (node.range.end.character - node.range.start.character),
              type,
              0
          );
      } else {
          builder.push(
              node.range.start.line-2,
              node.range.start.character-1,
              (node.range.end.character - node.range.start.character),
              type,
              0
          );
      }
  }

  let tokens = builder.build();
  // this.connection.sendNotification('custom/refreshSemanticTokens', { uri: document.uri });
  console.log(`[onRequestFull] tokens: ${JSON.stringify(tokens.data)}`);
  return tokens;
  } catch (e) {
    console.error(`[onRequestFull] Error: ${e}`);
  } finally {
    release();
    await this.validateTextDocument(params.textDocument);
    
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

// Fun position: {"start": {"line": 2, "col": 1}, "finish": {"line": 4, "col": 2}}
// Val position: {"start": {"line": 2, "col": 1}, "finish": {"line": 2, "col": 10}}
// Variable position: {"start": {"line": 2, "col": 1}, "finish": {"line": 2, "col": 10}}
