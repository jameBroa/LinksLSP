import { DocumentSymbol, SymbolKind } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNodeDef, VariableNodeDef } from "../node";
import { RangeReplacer } from "../namespaces/range";

function ExtractNestedSymbols(
    node: AST.ASTNode,
    variableDefinitions: Map<string, VariableNodeDef[]>
): DocumentSymbol[] {
    const symbols: DocumentSymbol[] = [];
    
    // Extract local variables
    for (const [varName, defs] of variableDefinitions.entries()) {
        // Find vars defined within this node
        const localVars = defs.filter(def => 
            AST.isInRange(def.variableDefinition.range, node.range) && 
            def.variableDefinition !== node
        );
        
        for (const def of localVars) {
            const varNode = def.variableDefinition;
            const name = varName.startsWith("Variable:") ? varName.substring(9).trim() : varName;
            
            const range = RangeReplacer.AdjustRangeAsRange(varNode.range);
            
            symbols.push({
                name: name,
                kind: SymbolKind.Variable,
                range: range,
                selectionRange: range
            });
        }
    }
    
    return symbols;
}


export function ExtractDocumentSymbols(node: AST.ASTNode, variableDefinitions: Map<string,VariableNodeDef[]>, functionDefinitions: Map<string, FunctionNodeDef[]>){
    const symbols: DocumentSymbol[] = [];
    
    // Add function symbols
    for (const [funcName, defs] of functionDefinitions.entries()) {
        if (funcName === "dummy_wrapper") {continue};
        
        for (const def of defs) {
            const funcNode = def.functionDefinition;
            const range = RangeReplacer.AdjustRangeAsRange(funcNode.range);
            
            // Get selection range (just the function name)
            const selectionRange = {
                start: range.start,
                end: {
                    line: range.start.line,
                    character: range.start.character + funcName.length
                }
            };
            
            // Create function symbol
            const funcSymbol: DocumentSymbol = {
                name: funcName,
                kind: SymbolKind.Function,
                range: range,
                selectionRange: selectionRange,
                children: []
            };
            
            // Add nested symbols (function parameters, local vars)
            const nestedSymbols = ExtractNestedSymbols(funcNode, variableDefinitions);
            if (nestedSymbols.length > 0) {
                funcSymbol.children = nestedSymbols;
            }
            
            symbols.push(funcSymbol);
        }
    }
    
    // Add top-level variable symbols
    for (const [varName, defs] of variableDefinitions.entries()) {
        // Skip variables that aren't top-level
        const topLevelVars = defs.filter(def => 
            def.scope.value === "Program" || def.scope.parent?.value === "Program"
        );
        
        for (const def of topLevelVars) {
            const varNode = def.variableDefinition;
            const name = varName.startsWith("Variable:") ? varName.substring(9).trim() : varName;
            
            const range = RangeReplacer.AdjustRangeAsRange(varNode.range);
            
            symbols.push({
                name: name,
                kind: SymbolKind.Variable,
                range: range,
                selectionRange: range
            });
        }
    }
    
    return symbols;
}