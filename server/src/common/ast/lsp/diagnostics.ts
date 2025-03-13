import {Diagnostic, DiagnosticSeverity, Position, Range} from "vscode-languageserver";
import { AST } from "../ast";
import { RangeReplacer } from "../namespaces/range";
import { Function } from "../namespaces/function";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef } from "../node";
import { LinksParserConstants } from "../../constants";
import * as os from "os";
import path from "path";
import * as fs from "fs";
import * as childProcess from "child_process";
import extractRegexPosition = AST.extractRegexPosition;
import extractRegexPositionFromFullDoc = AST.extractRegexPositionFromFullDoc;


type DiagnosticInfo = {
    node: AST.ASTNode,
    firstMessage: string,
    secondMessage: string
};

function CreateUndefinedVariableDiagnostics(
    variableReferences: Map<string, VariableNode[]>,
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    functionDefinitions: Map<string, FunctionNodeDef[]>  // Add this parameter
): DiagnosticInfo[] {
    let UndefinedVariableDiagnostic: DiagnosticInfo[] = [];
    for(const key of variableReferences.keys()){
        let refs = variableReferences.get(key);
        if(refs){
            for(const ref of refs){
                let defOfRef = variableRefToDef.get(ref.variable);
                // Check if it's undefined as a variable AND not a built-in AND not a function
                if(defOfRef === undefined && 
                   !LinksParserConstants.LINKS_VARS.has(key) &&
                   !LinksParserConstants.LINKS_FUNCS.has(key) &&
                   !functionDefinitions.has(key)) {  // Add this check
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
    return UndefinedVariableDiagnostic;
}

// function CreateUndefinedVariableDiagnostics(
//     variableReferences: Map<string, VariableNode[]>,
//     variableRefToDef: Map<AST.ASTNode, AST.ASTNode>
// ): DiagnosticInfo[] {
//     let UndefinedVariableDiagnostic: DiagnosticInfo[] = [];
//     for(const key of variableReferences.keys()){
//         let refs = variableReferences.get(key);
//         if(refs){
//             for(const ref of refs){
//                 let defOfRef = variableRefToDef.get(ref.variable);
//                 if(defOfRef === undefined && !LinksParserConstants.LINKS_VARS.has(key)){
//                     UndefinedVariableDiagnostic.push(
//                         {
//                             node: ref.variable,
//                             firstMessage: `Variable ${key} is not defined`,
//                             secondMessage: `Consider defining ${key} before using it`
//                         }
//                     );
//                 }
//             }
//         }   
//     }
//     // console.log(`[LinksNode] UndefinedVariableDiagnostic: "${JSON.stringify(UndefinedVariableDiagnostic, AST.removeParentAndChildren, 2)}"`);
//     return UndefinedVariableDiagnostic;
// }

function GetVarsDefinedInSameScope(Definitions: VariableNodeDef[], map: Map<Position, AST.ASTNode[]>, key: string): void {
    for(const def of Definitions){
        // console.log(`[LinksNode] def: "${JSON.stringify(def, AST.removeParentAndChildren, 2)}"`);
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
                    if(NumParamsInCall !== NumParamsInDef && ref.function.parent!.value !== "FormletPlacement"){ // Added formlet placement for { f => g}
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

function CreateWarningDiagnostic(diagnostic: DiagnosticInfo): Diagnostic {
    return {
        severity: DiagnosticSeverity.Warning,
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
        let currDiagnostic: Diagnostic | null = null;
        if(diagnostic.secondMessage.startsWith('Either remove the declaration(s)')) {
            // Duplicate variables create warning, not error
            currDiagnostic = CreateWarningDiagnostic(diagnostic);
        } else {
            currDiagnostic = CreateBaseDiagnostic(diagnostic);
        }
        if(extraInfo){
            AddExtraDiagnosticInfo(diagnostic, currDiagnostic, uri);
        }
        ProcessedDiagnostics.push(currDiagnostic);
    }
    return ProcessedDiagnostics;
}


async function ExecuteLinksCode(
    linksCode: string, 
    linksExecutablePath: string = "links"
): Promise<{success: boolean, errorMessage: string}> {
    try {
        // Create a temporary file to store the code
        const tempDir = os.tmpdir();
        const tempFilePath = path.join(tempDir, `links_temp_${Date.now()}.links`);
        
        // Write the code to the temporary file
        await new Promise((resolve, reject) => {
            fs.writeFile(tempFilePath, linksCode, (err) => {
                if (err) {reject(err);}
                resolve(null);
            });
        });
        
        // Execute the code using links
        try {
            const output = childProcess.execSync(`linx ${tempFilePath}`, {
                timeout: 2000, // 2 second timeout
                stdio: 'pipe'  // Capture output
            });
            const output_str = output.toString();
            if(output_str.includes("In expression")) {
                return {success: false, errorMessage: `No error`};
            } else {
                return {success: false, errorMessage: `No error`};
            }
        } catch (execError: any) {
            const t = execError.message.split(" ");
            let tt = t.slice(4, -1).join(" ");

            return { success: true, errorMessage: tt};
        } finally {
            // Clean up temporary file
            fs.unlink(tempFilePath, (err) => {
                console.log("inside callback");
            });
        }
    } catch (error: any) {
        console.log(`failed: ${error}`);
        return { success: false, errorMessage: `Failed to execute code: ${error.message}` };
    }
}

function ExtractPositionOfRunTimeError(errorMsg: string, textDocument:string): Range | null{
    if(!errorMsg){
        return null;
    }
    let by_line = errorMsg.split("\n");
    let idx = by_line.length-1;
    while(idx !== 0){
        let curr_line = by_line[idx];
        if(curr_line.includes("In expression")){
            break;
        }
        idx -= 1;
    }

    let t = by_line[idx].split(" ").slice(2, -1);
    let tt = by_line[idx].substring(15, by_line[idx].length-1);
    let ttt = extractRegexPositionFromFullDoc(textDocument, tt);
    return ttt;

}


async function getRuntimeDiagnostics(documentText: string): Promise<Diagnostic | null>{
    let result = await ExecuteLinksCode(documentText);


    if(result.success){
        let posOfError = ExtractPositionOfRunTimeError(result.errorMessage, documentText);
        if(!posOfError || result.errorMessage.includes("Unknown variable")){
            return null;
        }
        return {
            severity: DiagnosticSeverity.Error,
            range: posOfError,
            message: `Runtime error: ${result.errorMessage}`,
            source: 'LinksLSP-Runtime'
        };
    } else {
        return null;
    }
}

export async function Diagnostics(
    extraInfo: boolean,
    uri: string,
    functionReferences: Map<string, FunctionNode[]>,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    variableReferences:Map<string, VariableNode[]>,
    variableDefinition: Map<string, VariableNodeDef[]>,
    documentText: string
): Promise<Diagnostic[]>{
    let Diagnostics: DiagnosticInfo[] = [];
    let UndefinedVariableDiagnostic = CreateUndefinedVariableDiagnostics(variableReferences, variableRefToDef, functionDefinitions);
    let MultipleVariableDefinitionsDiagnostic = CreateMultipleVariableDefinitionsDiagnostic(variableDefinition);
    let UndefinedFunctionDiagnostic = CreateUndefinedFunctionDiagnostic(functionReferences, functionRefToDef, functionDefinitions);
    let FunctionCallsAndParametersDiagnostic = CreateFunctionCallsAndParametersDiagnostic(functionReferences, functionRefToDef);
    let RuntimeDiagnostics = await getRuntimeDiagnostics(documentText);
    Diagnostics = [
        ...UndefinedVariableDiagnostic, 
        ...MultipleVariableDefinitionsDiagnostic, 
        ...UndefinedFunctionDiagnostic, 
        ...FunctionCallsAndParametersDiagnostic,
    ];

    const RangeAdjustedDiagnostics = AdjustDiagnosticInfoRanges(Diagnostics);
    let ProcessedDiagnostics: Diagnostic[] = ProcessDiagnosticInfo(RangeAdjustedDiagnostics, extraInfo, uri);
    if(RuntimeDiagnostics){
        ProcessedDiagnostics = [...ProcessedDiagnostics, RuntimeDiagnostics];
    }
    return ProcessedDiagnostics;
}