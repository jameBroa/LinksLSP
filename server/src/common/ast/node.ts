import { Diagnostic, DiagnosticSeverity, Hover as VSCodeHover, Location, Position, Range, SemanticTokens, WorkspaceEdit, CompletionItem } from "vscode-languageserver";
import { AST } from "./ast";
import { Function } from "./namespaces/function";
import { Variable } from "./namespaces/variable";
import {IsOnDefinitionVariable } from "./conditions";
import { RangeReplacer } from "./namespaces/range";
import { ExtractExactDefinition } from "./namespaces/shared";
import { Definition } from "./lsp/definition";
import { References } from "./lsp/references";
import { Diagnostics } from "./lsp/diagnostics";
import { ParseSemanticTokens } from "./lsp/semanticTokens";
import { Hover } from "./lsp/hover";
import { Rename } from "./lsp/rename";
import { OnCompletion } from "./lsp/completion";

export interface XNode {
    scope: AST.ASTNode
}

export interface FunctionNode extends XNode {
    function: AST.ASTNode
}

export interface FunctionNodeDef extends XNode{
    functionDefinition: AST.ASTNode
}

export interface VariableNode extends XNode {
    variable: AST.ASTNode
}

export interface VariableNodeDef extends XNode {
    variableDefinition: AST.ASTNode
}

interface NodeInterface {
    tree: AST.ASTNode
    variableDefinitions: Map<string, VariableNodeDef[]>
    variableReferences:  Map<string, VariableNode[]>
    functionDefinitions: Map<string, FunctionNodeDef[]>
    functionReferences:  Map<string, FunctionNode[]>
}

export class LSPFeatureHandler implements NodeInterface {
    tree: AST.ASTNode;
    uri: string;
    variableDefinitions: Map<string, VariableNodeDef[]>;
    variableReferences:  Map<string, VariableNode[]>;
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>;
    functionDefinitions: Map<string, FunctionNodeDef[]>;
    functionReferences: Map<string, FunctionNode[]>;
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>;
    functionNodeToDefMap: Map<FunctionNode, FunctionNodeDef>;

    constructor(ast: AST.ASTNode, uri: string) {
        this.tree = ast;
        this.uri = uri;
        this.variableDefinitions = Variable.ExtractDefinitions(ast);
        this.variableReferences = Variable.ExtractReferences(ast);
        this.variableRefToDef = this.CreateVarRefToDefMap(
        this.variableReferences, 
        this.variableDefinitions
        );
        this.functionDefinitions = Function.ExtractDefinitions(ast);
        this.functionReferences = Function.ExtractReferences(ast);
        this.functionRefToDef = this.CreateFunRefToDefMap(
            this.functionReferences, 
            this.functionDefinitions
        );
        this.functionNodeToDefMap = this.CreateFunctionNodeDefMap();
    }

    private CreateVarRefToDefMap
    (
        variableReferences: Map<string, VariableNode[]>, 
        variableDefinitions: Map<string, VariableNodeDef[]>
    ): Map<AST.ASTNode, AST.ASTNode>
        {
            let variableRefToDef = new Map<AST.ASTNode, AST.ASTNode>();

            for(const key of variableReferences.keys()){
                let refs = variableReferences.get(key);
                let defs = variableDefinitions.get(key);
                let definitionSet = new Set(variableDefinitions.get(key));
                if(refs && defs){

                    for(const def of defs){
                        variableRefToDef.set(def.variableDefinition, def.variableDefinition);
                    }

                    for(const ref of refs){
                        // Sets definition of the definition to itself
                        for(const def of defs){
                            if(AST.isInRange(ref.variable.range, def.scope.range)){
                                variableRefToDef.set(ref.variable, def.variableDefinition);
                            }
                        }
                                    
                    }
                }
            }
        return variableRefToDef;
    }

    private CreateFunRefToDefMap(
        functionReferences: Map<string, FunctionNode[]>, 
        functionDefinitions: Map<string, FunctionNodeDef[]>
    ): Map<AST.ASTNode, AST.ASTNode>
    {
        let functionRefToDef = new Map<AST.ASTNode, AST.ASTNode>();

        for(const key of functionReferences.keys()){
            let refs = functionReferences.get(key);
            let defs = functionDefinitions.get(key);
            let definitionSet = new Set(functionDefinitions.get(key));
            if(refs && defs){
                for(const def of defs){
                    let lastChild = def.functionDefinition.children![def.functionDefinition.children!.length - 1];
                    functionRefToDef.set(lastChild, def.functionDefinition);
                }
                for(const ref of refs){
                    for(const def of defs){
                        let scopeOfVar = ref.scope;
                        if(AST.isInRange(ref.function.range, def.scope.range)){
                            functionRefToDef.set(ref.function.children![0], def.functionDefinition);
                        }
                    }
                    
                }
            }
        }
        return functionRefToDef;
    }

    


    
    public PrintAllFunVarRefNDef(): void{
        console.log(`[LinksNode] <----------->`);
        console.log("All functions with definition:", Array.from(this.functionDefinitions.keys()));
        for(const key of this.functionDefinitions.keys()){
            console.log(`function ${key}`);
            console.log(`function definitions: ${JSON.stringify(this.functionDefinitions.get(key), AST.removeParentAndChildren, 2)}`);
            let refs = this.functionReferences.get(key);
            if(refs){
                for(const ref of refs){
                    console.log(`Function reference: ${JSON.stringify(ref.function.range, AST.removeParentAndChildren, 2)}`);
                    console.log(`Scope function is valid: ${JSON.stringify(ref.scope.range, AST.removeParentAndChildren, 2)}`);
                }
            }
        }
        console.log("variableDefinitions", Array.from(this.variableDefinitions.keys()));
        console.log("variableReferences", Array.from(this.variableReferences.keys()));

        for(const key of this.variableReferences.keys()){
            console.log(`variable ${key}`);
            console.log(`variable definitions: ${JSON.stringify(this.variableDefinitions.get(key), AST.removeParentAndChildren, 2)}`);
            let refs = this.variableReferences.get(key);

            if(refs){
                for(const ref of refs){
                    console.log(`Variable node: ${JSON.stringify(ref.variable.range, AST.removeParentAndChildren, 2)}`);
                    console.log(`Scope node: ${JSON.stringify(ref.scope.range, AST.removeParentAndChildren, 2)}`);
                }
            }
            
        }
        console.log(`[LinksNode] EOE <----------->`);

    }


    private CreateFunctionNodeDefMap(): Map<FunctionNode, FunctionNodeDef> {
        let functionNodeDefMap = new Map<FunctionNode, FunctionNodeDef>();
        for(const key of this.functionReferences.keys()){
            let refs = this.functionReferences.get(key);
            if(refs){
                for(const ref of refs){
                    let refScope: Range = ref.scope.range;
                    let defs = this.functionDefinitions.get(key);
                    if(defs){
                        for(const def of defs){
                            let defScope: Range = def.scope.range;
                            if(AST.isInRange(refScope, defScope)){
                                functionNodeDefMap.set(ref, def);
                            }
                        }
                    } else {
                        // No definitions found
                        continue;
                    }
                }
            }
        }
        return functionNodeDefMap;
    }


    public GetDefinition(node: AST.ASTNode, uri: string): Location | null {
        return Definition(node, uri, this.variableRefToDef, this.functionRefToDef);
    }

    public GetReferences(node: AST.ASTNode): Location[] {
        return References(
            node, 
            this.uri, 
            this.variableDefinitions, 
            this.variableReferences, 
            this.functionDefinitions, 
            this.functionReferences
        );

    }
    
    public GetDiagnostics(extraInfo: boolean): Diagnostic[] {
        return Diagnostics(
            extraInfo, 
            this.uri, 
            this.functionReferences,
            this.functionDefinitions, 
            this.functionRefToDef, 
            this.variableRefToDef, 
            this.variableReferences, 
            this.variableDefinitions
        );
    }

    public BuildSemanticTokensFull(documentText:string): SemanticTokens{
        return ParseSemanticTokens(
            this.variableDefinitions,
            this.variableReferences,
            this.variableRefToDef,
            this.functionDefinitions,
            this.functionReferences,
            this.functionRefToDef,
            this.tree,
            documentText
        );
    }

    public BuildSemanticTokensRange(documentText: string, range: Range): SemanticTokens {
       return ParseSemanticTokens(
            this.variableDefinitions,
            this.variableReferences,
            this.variableRefToDef,
            this.functionDefinitions,
            this.functionReferences,
            this.functionRefToDef,
            this.tree,
            documentText,
            range
        );
    }

    public HandleHover(hoverNode: AST.ASTNode): VSCodeHover | null{
        return Hover(
            hoverNode, 
            this.functionReferences,
            this.functionNodeToDefMap
        );
    }

    public HandleRename(renameNode: AST.ASTNode, newName: string): WorkspaceEdit | null {
        return Rename(
            renameNode, 
            newName,
            this.variableDefinitions,
            this.variableReferences,
            this.functionDefinitions,
            this.functionReferences,
            this.uri
        );
    }

    public async HandleCompletion(
        Position: Position, 
        documentText: string,
        db_tables: string[] | undefined,
        db_schemas: Map<string, {columnName:string, dataType: string}[]> | undefined
    
    ): Promise<CompletionItem[]>{
        return OnCompletion(
            Position,
            documentText,
            this.variableDefinitions,
            this.functionDefinitions,
            db_tables,
            db_schemas
        );
    }

}