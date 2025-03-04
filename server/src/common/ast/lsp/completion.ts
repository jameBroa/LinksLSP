import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver";
import { FunctionNodeDef, VariableNodeDef } from "../node";
import { TableCompletionProvider } from "../../../completion/TableCompletionProvider";

// function CalculateCurrentToken(pos: Position, documentText: string): string{
//     const documentByLine = documentText.split('\n');
//     // Handle edge case if position is beyond document
//     if (pos.line - 2 < 0 || pos.line - 2 >= documentByLine.length) {
//         return '';
//     }
    
//     const currentLine = documentByLine[pos.line - 2];
//     // Handle edge case if position is beyond line
//     if (pos.character - 1 < 0 || pos.character - 1 > currentLine.length) {
//         return '';
//     }
    
//     // Find the start of the current word/token (scanning backwards)
//     let startIdx = pos.character - 1;
//     while (startIdx >= 0) {
//         // If we hit a character that's not valid in a variable/function name, stop
//         if (!/[a-zA-Z0-9_]/.test(currentLine[startIdx])) {
//             startIdx++;
//             break;
//         }
//         startIdx--;
//     }
    
//     // If we went all the way to the beginning
//     if (startIdx < 0) {
//         startIdx = 0;
//     }
    
//     // Extract the token prefix (from found beginning to cursor position)
//     const currentToken = currentLine.substring(startIdx, pos.character);
    
//     console.log(`Current token prefix: "${currentToken}" at position ${pos.line-2}:${pos.character}`);
//     return currentToken;
// }

function CalculateTokenContext(pos: Position, documentText: string): { currentToken: string, previousToken: string } {
    const documentByLine = documentText.split('\n');
    const lineIndex = pos.line - 2;
    
    // Handle edge case if position is beyond document
    if (lineIndex < 0 || lineIndex >= documentByLine.length) {
        return { 
            currentToken: '', 
            previousToken: '',
        };
    }
    
    const currentLine = documentByLine[lineIndex];
    const charPos = pos.character;
    
    // Handle edge case if position is beyond line
    if (charPos < 0 || charPos > currentLine.length) {
        return { 
            currentToken: '', 
            previousToken: '',
        };
    }
    
    // Find the start of the current token (scanning backwards)
    let currentStartIdx = charPos;
    while (currentStartIdx > 0) {
        // If we hit a character that's not valid in a variable/function name, stop
        if (!/[a-zA-Z0-9_]/.test(currentLine[currentStartIdx - 1])) {
            break;
        }
        currentStartIdx--;
    }
    
    // Extract the current token
    const currentToken = currentLine.substring(currentStartIdx, charPos);
    
    // Find the previous token
    let prevEndIdx = currentStartIdx - 1;
    // Skip whitespace and separators
    while (prevEndIdx >= 0 && /[\s\t,;(){}[\]=+\-*/%<>!&|^~]/.test(currentLine[prevEndIdx])) {
        prevEndIdx--;
    }
    
    // If we found a non-separator character
    let previousToken = '';
    if (prevEndIdx >= 0) {
        // Find the start of this previous token
        let prevStartIdx = prevEndIdx;
        while (prevStartIdx > 0) {
            // If we hit a character that's not valid in a token, stop
            if (/[\s\t,;(){}[\]=+\-*/%<>!&|^~]/.test(currentLine[prevStartIdx - 1])) {
                break;
            }
            prevStartIdx--;
        }
        previousToken = currentLine.substring(prevStartIdx, prevEndIdx + 1);
    }
    
    console.log(`Current token: "${currentToken}", Previous token: "${previousToken}"`);
    
    return {
        currentToken,
        previousToken
    };
}

function addVariableCompletion(currentToken: string, variableDefinition: Map<string, VariableNodeDef[]>, ret: CompletionItem[]): void{
    for(const key of variableDefinition.keys()){
        if(key.startsWith(currentToken)){
            ret.push({
                label: key,
                kind: CompletionItemKind.Variable
            });
        }
    }
}

function addFunctionCompletion(currentToken: string, functionDefinition: Map<string, FunctionNodeDef[]>, ret: CompletionItem[]): void{
    for(const key of functionDefinition.keys()){
        if(key !== "dummy_wrapper"){
            if(key.startsWith(currentToken)){
                ret.push({
                    label: key,
                    kind: CompletionItemKind.Function
                });
            }
        }
    }
}

async function addTableCompletion(
    db_tables: string[] | undefined, 
    db_schemas: Map<string, {columnName: string, dataType: string}[]> | undefined, 
    ret: CompletionItem[],
    documentText: string,
    cursorPos: Position
): Promise<void>
    {
        if(db_schemas && db_tables){
            const tableProvider = new TableCompletionProvider(db_tables, db_schemas);
            let readjustedCursorPos = Position.create(cursorPos.line-2, cursorPos.character);
            let items = await tableProvider.provideCompletions(documentText, readjustedCursorPos);
            console.log(`[TableCompletionProvider] items: ${JSON.stringify(items, null, 2)}`);
            ret.push(...items);
        }
}



export async function OnCompletion(
    cursorPos: Position,
    documentText: string, 
    variableDefinitions: Map<string, VariableNodeDef[]>, 
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    db_tables: string[] | undefined,
    db_schemas: Map<string, {columnName: string, dataType: string}[]> | undefined
): Promise<CompletionItem[]>{

    let ret: CompletionItem[] = [];

    // let currentToken = CalculateCurrentToken(cursorPos, documentText);
    let { currentToken, previousToken } = CalculateTokenContext(cursorPos, documentText);
    
    // specific completion scenarios
    switch(previousToken){
        case "table":
            addTableCompletion(db_tables, db_schemas, ret, documentText, cursorPos);
            break;
        default:
            // skip
            break;
    }

    addVariableCompletion(currentToken, variableDefinitions, ret);
    addFunctionCompletion(currentToken, functionDefinitions, ret);
    return ret;
}