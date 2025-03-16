import { DocumentSymbol, SymbolKind } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNodeDef, VariableNodeDef } from "../node";
import { RangeReplacer } from "../namespaces/range";
import { Function } from "../namespaces/function";
import { Variable } from "../namespaces/variable";

// function ExtractNestedSymbols(
//     node: AST.ASTNode,
//     variableDefinitions: Map<string, VariableNodeDef[]>,
//     functionDefinitions: Map<string, FunctionNodeDef[]>
// ): DocumentSymbol[] {
//     const symbols: DocumentSymbol[] = [];
    
//     // Extract local variables
//     for (const [varName, defs] of variableDefinitions.entries()) {
//         // Find vars defined within this node
//         const localVars = defs.filter(def => 
//             AST.isInRange(def.variableDefinition.range, node.range) && 
//             def.variableDefinition !== node && def.scope !== node
//         );
        
//         for (const def of localVars) {
//             const varNode = def.variableDefinition;
//             const name = varName.startsWith("Variable:") ? varName.substring(9).trim() : varName;
            
//             const range = RangeReplacer.AdjustRangeAsRange(varNode.range);
            
//             symbols.push({
//                 name: name,
//                 kind: SymbolKind.Variable,
//                 range: range,
//                 selectionRange: range
//             });
//         }
//     }

//     for(const [funName, defs] of functionDefinitions.entries()){
//         const localFuns = defs.filter(def =>
//             AST.isInRange(def.functionDefinition.range, node.range) &&
//             def.functionDefinition !== node
//         );

//         for(const def of localFuns){
//             const funNode = def.functionDefinition;
//             const range = RangeReplacer.AdjustRangeAsRange(funNode.range);
            
//             symbols.push({
//                 name: funName,
//                 kind: SymbolKind.Function,
//                 range: range,
//                 selectionRange: range
//             });
//         }
//     }
    
//     return symbols;
// }


// export function ExtractDocumentSymbols(node: AST.ASTNode, variableDefinitions: Map<string,VariableNodeDef[]>, functionDefinitions: Map<string, FunctionNodeDef[]>){
//     const symbols: DocumentSymbol[] = [];
//     let dummyWrapperNode: AST.ASTNode | null = null;
//     // Add function symbols
//     for (const [funcName, defs] of functionDefinitions.entries()) {
//         if (funcName === "dummy_wrapper") {
//             dummyWrapperNode = defs[0].functionDefinition;
//             continue;
//         };
        
//         for (const def of defs) {
//             const funcNode = def.functionDefinition;
//             const range = RangeReplacer.AdjustRangeAsRange(funcNode.range);
            
//             // Get selection range (just the function name)
//             const selectionRange = {
//                 start: range.start,
//                 end: {
//                     line: range.start.line,
//                     character: range.start.character + funcName.length
//                 }
//             };
            
//             // Create function symbol
//             const funcSymbol: DocumentSymbol = {
//                 name: funcName,
//                 kind: SymbolKind.Function,
//                 range: range,
//                 selectionRange: selectionRange,
//                 children: []
//             };
            
//             // Add nested symbols (function parameters, local vars)
//             const nestedSymbols = ExtractNestedSymbols(funcNode, variableDefinitions, functionDefinitions);
//             if (nestedSymbols.length > 0) {
//                 funcSymbol.children = nestedSymbols;
//             }
            
//             symbols.push(funcSymbol);
//         }
//     }
    
//     // Add top-level variable symbols
//     for (const [varName, defs] of variableDefinitions.entries()) {
//         // Skip variables that aren't top-level
//         const topLevelVars = defs.filter(def => 
//             def.scope.value === "Program" || def.scope.parent?.value === "Program"
//         );

//         console.log(`topLevelVars: ${JSON.stringify(topLevelVars, AST.removeParentAndChildren, 2)}`);

//         const dummyWrapperVars = dummyWrapperNode ? defs.filter(def =>
//             dummyWrapperNode && AST.isInRange(def.variableDefinition.range, dummyWrapperNode.range) &&
//             def.variableDefinition !== dummyWrapperNode
//         ) : [];

//         const all_vars = [...topLevelVars, ...dummyWrapperVars];
//         console.log(`defs: ${JSON.stringify(defs, AST.removeParentAndChildren, 2)}`);
//         // console.log(`dummyWrapperVars: ${JSON.stringify(dummyWrapperVars, AST.removeParentAndChildren, 2)}`);
//         for (const def of defs) {
            
//             const varNode = def.variableDefinition;
//             const name = varName.startsWith("Variable:") ? varName.substring(9).trim() : varName;
            
//             const range = RangeReplacer.AdjustRangeAsRange(varNode.range);

//             if(def.scope.parent!.value === "root"){
//                 symbols.push({
//                     name: name,
//                     kind: SymbolKind.Variable,
//                     range: range,
//                     selectionRange: range
//                 });
//             }
//         }
//     }
    
//     return symbols;
// }



function ExtractLocalVariables(
    functionNode: AST.ASTNode, 
    variableDefinitions: Map<string, VariableNodeDef[]>,
){
    let symbols: DocumentSymbol[] = [];
    for(const [varName, defs] of variableDefinitions.entries()){
        console.log(`varName: ${varName}`);
        let inRangeVars = defs.filter(def => {
            return AST.isInRange(def.variableDefinition.range, functionNode.range);
        });

        let validVars = inRangeVars.filter(node => {
            return node.scope.range.end === functionNode.range.end;
        });

        for(const def of validVars){
            const varNode = def.variableDefinition;
            symbols.push({
                name: varName,
                kind: SymbolKind.Variable,
                range: RangeReplacer.AdjustRangeAsRange(varNode.range),
                selectionRange: RangeReplacer.AdjustRangeAsRange(varNode.range)
            });
        }

    }
    return symbols;   
}


let visited = new Set<string>();

function ExtractLocalFunctions(
    functionNode: AST.ASTNode,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    variableDefinitions: Map<string, VariableNodeDef[]>
) {
    const currentFunctionName = Function.getNameFromFun(functionNode);
    const symbols: DocumentSymbol[] = [];
    let visitedLocally = new Set<string>();
    let localFuns: FunctionNodeDef[] = [];

    for (const [funName, defs] of functionDefinitions.entries()) {
        for(const def of defs){
            if(
            AST.isInRange(def.functionDefinition.range, functionNode.range) && 
            def.functionDefinition !== functionNode &&
            def.scope.range.end === functionNode.range.end){
                localFuns.push(def);
            }
        }
    }

    
    for (const def of localFuns) {
        const funName = Function.getNameFromFun(def.functionDefinition);
        const funNode = def.functionDefinition;
        const range = RangeReplacer.AdjustRangeAsRange(funNode.range);
        const localVariables = ExtractLocalVariables(funNode, variableDefinitions);
        const localFunctions = ExtractLocalFunctions(def.functionDefinition, functionDefinitions, variableDefinitions);
        const localSymbols = [...localVariables, ...localFunctions];
        const uniqueKey = `${funNode.parent!.range.start.line}-${funNode.parent!.range.end.line}-${funName}-${funNode.range.start.line}-${funNode.range.start.character}-${funNode.range.end.line}-${funNode.range.end.character}-${def.scope.range.start.line}-${def.scope.range.end.line}-${def.scope.range.end.character}`;
        if(!visited.has(uniqueKey)){
            console.log(`adding unique key ${uniqueKey} for ${funName}`);
            console.log(`funNode: ${JSON.stringify(funNode, AST.removeParentAndChildren, 2)}`);


            symbols.push({
                name: funName,
                kind: SymbolKind.Function,
                range: range,
                selectionRange: range,
                children: localSymbols
            });
            visited.add(uniqueKey);
        } else {
            console.log(`already visited: ${uniqueKey}`);
        }

    }
    return symbols;
}


export function ExtractDocumentSymbols(ast: AST.ASTNode, variableDefinitions: Map<string,VariableNodeDef[]>, functionDefinitions: Map<string, FunctionNodeDef[]>){
    visited = new Set<string>();
    const topLevelVars = ExtractLocalVariables(ast, variableDefinitions);
    const symbols = ExtractLocalFunctions(ast, functionDefinitions, variableDefinitions);
    return [...symbols, ...topLevelVars];
}
