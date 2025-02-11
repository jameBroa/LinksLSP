import { Diagnostic, DiagnosticSeverity, Location, Position, Range } from "vscode-languageserver";
import { AST } from "./ast";
import { Function } from "./namespaces/function";
import { Variable } from "./namespaces/variable";
import {IsOnDefinitionVariable } from "./conditions";
import { RangeReplacer } from "./namespaces/range";
import { ExtractExactDefinition } from "./namespaces/shared";
import { Definition } from "./lsp/definition";
import { References } from "./lsp/references";
import { Diagnostics } from "./lsp/diagnostics";

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
    // variableDefinitions: Map<string, AST.ASTNode[]>
    variableDefinitions: Map<string, VariableNodeDef[]>
    variableReferences:  Map<string, VariableNode[]>
    functionDefinitions: Map<string, FunctionNodeDef[]>
    // functionDefinitions: Map<string, AST.ASTNode[]>
    functionReferences:  Map<string, FunctionNode[]>
    child: AST.ASTNode
    parent: AST.ASTNode
}

type DiagnosticInfo = {
    node: AST.ASTNode,
    firstMessage: string,
    secondMessage: string
};

export class LinksNode implements NodeInterface{

    // Problem: We actually need Definitions to have 'Scope' as well
    // so that we can check if a reference is in the scope of a definition.
    // To do this, modify variableDefinitions to Map<string, VariableNodeDef[]>

    // Need to do something similar for functions...
    tree: AST.ASTNode;
    uri: string;
    variableDefinitions: Map<string, VariableNodeDef[]>;
    variableReferences:  Map<string, VariableNode[]>;
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>;
    // functionDefinitions: Map<string, AST.ASTNode[]>;
    functionDefinitions: Map<string, FunctionNodeDef[]>;
    functionReferences: Map<string, FunctionNode[]>;
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>;
    child: AST.ASTNode;
    parent: AST.ASTNode;

    // In the constructor we want to 
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
        this.child = ast;
        this.parent = ast;
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
                            console.log(`what we setting in map: ${JSON.stringify(ref.function.children![0], AST.removeParentAndChildren, 2)}`)
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


    public GetDefinition(node: AST.ASTNode, uri: string): Location | null {
        return Definition(node, uri, this.variableRefToDef, this.functionRefToDef);
    }



    // // Updates References in-place
    // private GetValidVarReferences(VarRefs: VariableNode[], VarDefs: VariableNodeDef[], References: Location[]): void{
    //     for(const ref of VarRefs){
    //         for(const def of VarDefs){
    //             if(AST.isInRange(ref.variable.range, def.scope.range)){
    //                 References.push(Location.create(
    //                     this.uri,
    //                     ref.variable.range
    //                 ));
    //             }
    //         }
    //     }
    // }
    // // Updates References in-place
    // private GetValidFunReferences(node: AST.ASTNode, FunRefs: FunctionNode[], FunDefs: FunctionNodeDef[], References: Location[]){
    //     for(const ref of FunRefs){
    //         for(const def of FunDefs){
    //             if
    //             (
    //                 AST.isInRange(node.range, def.scope.range) && 
    //                 AST.isInRange(ref.function.range, def.scope.range)
    //             )
    //                 {
    //                     References.push(Location.create(
    //                         this.uri,
    //                         ref.function.range
    //                     ));
    //                 }
    //         }
    //     }
    // }

    public GetReferences(node: AST.ASTNode): Location[] {
        return References(
            node, 
            this.uri, 
            this.variableDefinitions, 
            this.variableReferences, 
            this.functionDefinitions, 
            this.functionReferences
        );
        // let References: Location[] = [];

        // if(IsOnDefinitionVariable(node)){
        //     let varName = Variable.getName(node);
        //     let VariableDefinitions = this.variableDefinitions.get(varName);
        //     let VariableReferences = this.variableReferences.get(varName);

        //     if(VariableReferences && VariableDefinitions){
        //         this.GetValidVarReferences(VariableReferences, VariableDefinitions, References);
        //     }

        //     References.push(Location.create(
        //         this.uri,
        //         node.range
        //     ));
        // } else {
        //     let funName = Function.getNameFromFun(node.parent!);
        //     let FunctionDefinitions = this.functionDefinitions.get(funName);
        //     let FunctionReferences = this.functionReferences.get(funName);

        //     if(FunctionReferences && FunctionDefinitions){
        //         this.GetValidFunReferences(node, FunctionReferences, FunctionDefinitions, References);
        //     }
        //     References.push(Location.create(
        //         this.uri,
        //         node.range
        //     ));
        // }
        // return References;
    }


    private CreateUndefinedVariableDiagnostics(): DiagnosticInfo[] {
        let UndefinedVariableDiagnostic: DiagnosticInfo[] = [];
        for(const key of this.variableReferences.keys()){
            let refs = this.variableReferences.get(key);
            if(refs){
                for(const ref of refs){
                    let defOfRef = this.variableRefToDef.get(ref.variable);
                    if(defOfRef === undefined){
                        UndefinedVariableDiagnostic.push(
                            {
                                node: ref.variable,
                                firstMessage: `Variable ${key} is not defined`,
                                secondMessage: `Consider defining ${key} before using it`
                            }
                        );
                    }
                }
            }   
        }
        console.log(`[LinksNode] UndefinedVariableDiagnostic: "${JSON.stringify(UndefinedVariableDiagnostic, AST.removeParentAndChildren, 2)}"`);
        return UndefinedVariableDiagnostic;
    }

    private GetVarsDefinedInSameScope(Definitions: VariableNodeDef[], map: Map<Position, AST.ASTNode[]>): void {
        for(const def of Definitions){
            if(map.has(def.scope.range.end)){
                map.set(
                    def.scope.range.end, 
                    [...map.get(def.scope.range.end)!, def.variableDefinition]
                );
            } else {
                map.set(def.scope.range.end, [def.variableDefinition]);
            }
        }
    }

    private DetermineDuplicateVarsInScope(map: Map<Position, AST.ASTNode[]>, key: string, DiagInfo: DiagnosticInfo[]){
        for(const values of map.values()){
            if(values.length > 1){
                for(const value of values){
                    DiagInfo.push(
                        {
                            node: value,
                            firstMessage: `Variable ${key} is defined multiple times`,
                            secondMessage: `Either remove the declaration(s) ${key} or consider renaming them`
                        }
                    );
                }
            }
        }
    }

    private CreateMultipleVariableDefinitionsDiagnostic(): DiagnosticInfo[] {
        let MultipleVariableDefinitionsDiagnostic: DiagnosticInfo[] = [];
        for(const key of this.variableDefinitions.keys()){
            let Definitions = this.variableDefinitions.get(key);
            let DefinitionsInSameScope: Map<Position, AST.ASTNode[]> = new Map();
            if(Definitions) {
                this.GetVarsDefinedInSameScope(Definitions, DefinitionsInSameScope);
            }
            this.DetermineDuplicateVarsInScope(
                DefinitionsInSameScope, 
                key, 
                MultipleVariableDefinitionsDiagnostic
            );
        }
        console.log(`[LinksNode] MultipleVariableDefinitionsDiagnostic: "${JSON.stringify(MultipleVariableDefinitionsDiagnostic, AST.removeParentAndChildren, 2)}"`);

        return MultipleVariableDefinitionsDiagnostic;
    }
    private CreateUndefinedFunctionDiagnostic(): DiagnosticInfo[] {
        let UndefinedFunctionDiagnostic: DiagnosticInfo[] = [];
        for(const key of this.functionReferences.keys()){
            let refs = this.functionReferences.get(key);
            let defs = this.functionDefinitions.get(key);
            if(refs){
                for(const ref of refs){
                    let defOfRef = this.functionRefToDef.get(ref.function.children![0]);
                    if(defOfRef === undefined){
                        UndefinedFunctionDiagnostic.push(
                            {
                                node: ref.function,
                                firstMessage: `Function ${key} is not defined`,
                                secondMessage: `Consider defining ${key} before using it`
                            }
                        );
                    }
                }
            }
        }
        // console.log(`[LinksNode] UndefinedFunctionDiagnostic: "${JSON.stringify(UndefinedFunctionDiagnostic, AST.removeParentAndChildren, 2)}"`);
        return UndefinedFunctionDiagnostic;
    }
    private CreateFunctionCallsAndParametersDiagnostic(): DiagnosticInfo[] {
        let FunctionCallsAndParametersDiagnostic: DiagnosticInfo[] = [];

        for(const key of this.functionReferences.keys()){
            let refs = this.functionReferences.get(key);
            if(refs){
                for(const ref of refs) {
                    let def = this.functionRefToDef.get(ref.function.children![0]);
                    if(def){
                        let NumParamsInCall = Function.ExtractNumParamsFromRef(ref.function);
                        let NumParamsInDef = Function.ExtractNumParamsFromDef(def);
                        if(NumParamsInCall !== NumParamsInDef){
                            FunctionCallsAndParametersDiagnostic.push(
                                {
                                    node: ref.function,
                                    firstMessage: `Incorrect number of arguments.`,
                                    secondMessage: `Expected ${NumParamsInDef} arguments, but got ${NumParamsInCall}.`
                                }
                            );
                        }
                    }
                }
            }
        }
        console.log(`[LinksNode] FunctionCallsAndParametersDiagnostic: "${JSON.stringify(FunctionCallsAndParametersDiagnostic, AST.removeParentAndChildren, 2)}"`);
        return FunctionCallsAndParametersDiagnostic;
    }

    private AdjustDiagnosticInfoRanges(Diagnostics: DiagnosticInfo[]): DiagnosticInfo[] {
        let AdjustedDiagnostics: DiagnosticInfo[] = [];
        for(const diagnostic of Diagnostics){
            let node = diagnostic.node;
            let adjustedNode = RangeReplacer.AdjustRangeAsAST(node);

            let newDiagnostic: DiagnosticInfo = {
                node: adjustedNode,
                firstMessage: diagnostic.firstMessage,
                secondMessage: diagnostic.secondMessage
            };
            AdjustedDiagnostics.push(newDiagnostic);
        }
        return AdjustedDiagnostics;
    }
    private CreateBaseDiagnostic(diagnostic: DiagnosticInfo): Diagnostic {
        return {
            severity: DiagnosticSeverity.Error,
            range: diagnostic.node.range,
            message: diagnostic.firstMessage,
            source: 'LinksLSP'
        } as Diagnostic;
    }
    private AddExtraDiagnosticInfo(diagnosticInfo: DiagnosticInfo, diagnostic: Diagnostic): void {
        diagnostic.relatedInformation = [
            {
                location: {
                    uri: this.uri,
                    range: Object.assign({}, diagnostic.range)
                },
                message: diagnosticInfo.secondMessage
            }
        ];
    }

    // Removed uninitialized variables since Links variables are immutable anyway
    private ProcessDiagnosticInfo(Diagnostics: DiagnosticInfo[], extraInfo: boolean): Diagnostic[] {
        let ProcessedDiagnostics: Diagnostic[] = [];
        for(const diagnostic of Diagnostics) {
            let currDiagnostic = this.CreateBaseDiagnostic(diagnostic);
            if(extraInfo){
                this.AddExtraDiagnosticInfo(diagnostic, currDiagnostic);
            }
            ProcessedDiagnostics.push(currDiagnostic);
        }
        return ProcessedDiagnostics;
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
        // let Diagnostics: DiagnosticInfo[] = [];
        // let UndefinedVariableDiagnostic = this.CreateUndefinedVariableDiagnostics();
        // let MultipleVariableDefinitionsDiagnostic = this.CreateMultipleVariableDefinitionsDiagnostic();
        // let UndefinedFunctionDiagnostic = this.CreateUndefinedFunctionDiagnostic();
        // let FunctionCallsAndParametersDiagnostic = this.CreateFunctionCallsAndParametersDiagnostic();
        
        // Diagnostics = [
        //     ...UndefinedVariableDiagnostic, 
        //     ...MultipleVariableDefinitionsDiagnostic, 
        //     ...UndefinedFunctionDiagnostic, 
        //     ...FunctionCallsAndParametersDiagnostic, 
        // ];

        // const RangeAdjustedDiagnostics = this.AdjustDiagnosticInfoRanges(Diagnostics);
        // let ProcessedDiagnostics: Diagnostic[] = this.ProcessDiagnosticInfo(RangeAdjustedDiagnostics, extraInfo);

        // return ProcessedDiagnostics;
    }

}