import { Diagnostic, DiagnosticSeverity, Position } from "vscode-languageserver";
import { AST } from "../ast";
import { RangeReplacer } from "../namespaces/range";
import { Function } from "../namespaces/function";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef } from "../node";
import { LinksParserConstants } from "../../constants";

type DiagnosticInfo = {
    node: AST.ASTNode,
    firstMessage: string,
    secondMessage: string
};

function CreateUndefinedVariableDiagnostics(
    variableReferences: Map<string, VariableNode[]>,
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>
): DiagnosticInfo[] {
    let UndefinedVariableDiagnostic: DiagnosticInfo[] = [];
    for(const key of variableReferences.keys()){
        let refs = variableReferences.get(key);
        if(refs){
            for(const ref of refs){
                let defOfRef = variableRefToDef.get(ref.variable);
                if(defOfRef === undefined && !LinksParserConstants.LINKS_VARS.has(key)){
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
    // console.log(`[LinksNode] UndefinedVariableDiagnostic: "${JSON.stringify(UndefinedVariableDiagnostic, AST.removeParentAndChildren, 2)}"`);
    return UndefinedVariableDiagnostic;
}

function GetVarsDefinedInSameScope(Definitions: VariableNodeDef[], map: Map<Position, AST.ASTNode[]>, key: string): void {
    for(const def of Definitions){
        console.log(`[LinksNode] def: "${JSON.stringify(def, AST.removeParentAndChildren, 2)}"`);
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

function DetermineDuplicateVarsInScope(map: Map<Position, AST.ASTNode[]>, key: string, DiagInfo: DiagnosticInfo[]){
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

function CreateMultipleVariableDefinitionsDiagnostic(
    variableDefinitions: Map<string, VariableNodeDef[]>
): DiagnosticInfo[] {
    let MultipleVariableDefinitionsDiagnostic: DiagnosticInfo[] = [];
    for(const key of variableDefinitions.keys()){
        let Definitions = variableDefinitions.get(key);
        let DefinitionsInSameScope: Map<Position, AST.ASTNode[]> = new Map();
        if(Definitions) {
            GetVarsDefinedInSameScope(Definitions, DefinitionsInSameScope, key);
        }
        DetermineDuplicateVarsInScope(
            DefinitionsInSameScope, 
            key, 
            MultipleVariableDefinitionsDiagnostic
        );
    }
    // console.log(`[LinksNode] MultipleVariableDefinitionsDiagnostic: "${JSON.stringify(MultipleVariableDefinitionsDiagnostic, AST.removeParentAndChildren, 2)}"`);

    return MultipleVariableDefinitionsDiagnostic;
}
function CreateUndefinedFunctionDiagnostic(
    functionReferences: Map<string, FunctionNode[]>,
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    functionDefinitions: Map<string, FunctionNodeDef[]>
): DiagnosticInfo[] {
    let UndefinedFunctionDiagnostic: DiagnosticInfo[] = [];
    for(const key of functionReferences.keys()){
        let refs = functionReferences.get(key);
        let defs = functionDefinitions.get(key);
        if(refs){
            for(const ref of refs){
                let defOfRef = functionRefToDef.get(ref.function.children![0]);
                if(defOfRef === undefined && !LinksParserConstants.LINKS_FUNCS.has(key)){
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
function CreateFunctionCallsAndParametersDiagnostic(
    functionReferences: Map<string, FunctionNode[]>,
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>
): DiagnosticInfo[] {
    let FunctionCallsAndParametersDiagnostic: DiagnosticInfo[] = [];

    for(const key of functionReferences.keys()){
        let refs = functionReferences.get(key);
        if(refs){
            for(const ref of refs) {
                let def = functionRefToDef.get(ref.function.children![0]);
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
    // console.log(`[LinksNode] FunctionCallsAndParametersDiagnostic: "${JSON.stringify(FunctionCallsAndParametersDiagnostic, AST.removeParentAndChildren, 2)}"`);
    return FunctionCallsAndParametersDiagnostic;
}

function AdjustDiagnosticInfoRanges(Diagnostics: DiagnosticInfo[]): DiagnosticInfo[] {
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
function CreateBaseDiagnostic(diagnostic: DiagnosticInfo): Diagnostic {
    return {
        severity: DiagnosticSeverity.Error,
        range: diagnostic.node.range,
        message: diagnostic.firstMessage,
        source: 'LinksLSP'
    } as Diagnostic;
}
function AddExtraDiagnosticInfo(diagnosticInfo: DiagnosticInfo, diagnostic: Diagnostic, uri: string): void {
    diagnostic.relatedInformation = [
        {
            location: {
                uri: uri,
                range: Object.assign({}, diagnostic.range)
            },
            message: diagnosticInfo.secondMessage
        }
    ];
}

// Removed uninitialized variables since Links variables are immutable anyway
function ProcessDiagnosticInfo(Diagnostics: DiagnosticInfo[], extraInfo: boolean, uri: string): Diagnostic[] {
    let ProcessedDiagnostics: Diagnostic[] = [];
    for(const diagnostic of Diagnostics) {
        let currDiagnostic = CreateBaseDiagnostic(diagnostic);
        if(extraInfo){
            AddExtraDiagnosticInfo(diagnostic, currDiagnostic, uri);
        }
        ProcessedDiagnostics.push(currDiagnostic);
    }
    return ProcessedDiagnostics;
}

export function Diagnostics(
    extraInfo: boolean,
    uri: string,
    functionReferences: Map<string, FunctionNode[]>,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    variableReferences:Map<string, VariableNode[]>,
    variableDefinition: Map<string, VariableNodeDef[]>



): Diagnostic[]{
    let Diagnostics: DiagnosticInfo[] = [];
    let UndefinedVariableDiagnostic = CreateUndefinedVariableDiagnostics(variableReferences, variableRefToDef);
    let MultipleVariableDefinitionsDiagnostic = CreateMultipleVariableDefinitionsDiagnostic(variableDefinition);
    let UndefinedFunctionDiagnostic = CreateUndefinedFunctionDiagnostic(functionReferences, functionRefToDef, functionDefinitions);
    let FunctionCallsAndParametersDiagnostic = CreateFunctionCallsAndParametersDiagnostic(functionReferences, functionRefToDef);
    
    Diagnostics = [
        ...UndefinedVariableDiagnostic, 
        ...MultipleVariableDefinitionsDiagnostic, 
        ...UndefinedFunctionDiagnostic, 
        ...FunctionCallsAndParametersDiagnostic, 
    ];

    const RangeAdjustedDiagnostics = AdjustDiagnosticInfoRanges(Diagnostics);
    let ProcessedDiagnostics: Diagnostic[] = ProcessDiagnosticInfo(RangeAdjustedDiagnostics, extraInfo, uri);

    return ProcessedDiagnostics;
}