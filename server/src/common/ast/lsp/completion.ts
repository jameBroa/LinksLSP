import { CompletionItem, CompletionItemKind, Position } from "vscode-languageserver";
import { FunctionNodeDef, VariableNodeDef } from "../node";
import { TableCompletionProvider } from "../../../completion/TableCompletionProvider";
import { LinksParserConstants } from "../../constants";

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
        if (!/[a-zA-Z0-9_<>:]/.test(currentLine[currentStartIdx - 1])) {
            break;
        }
        currentStartIdx--;
    }
    
    // Extract the current token
    const currentToken = currentLine.substring(currentStartIdx, charPos);
    
    // Find the previous token
    let prevEndIdx = currentStartIdx - 1;
    // Skip whitespace and separators
    while (prevEndIdx >= 0 && /[\s\t,;(){}[\]=+\-*/%!&|^~]/.test(currentLine[prevEndIdx])) {
        prevEndIdx--;
    }
    
    // If we found a non-separator character
    let previousToken = '';
    if (prevEndIdx >= 0) {
        // Find the start of this previous token
        let prevStartIdx = prevEndIdx;
        while (prevStartIdx > 0) {
            // If we hit a character that's not valid in a token, stop
            if (/[\s\t,;(){}[\]=+\-*/%!&|^~]/.test(currentLine[prevStartIdx - 1])) {
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

function addBuiltInFunctionCompletion(currentToken: string, ret: CompletionItem[]): void{
    if (currentToken === '') {
        // Limit to a reasonable number of items for performance
        const items = Array.from(LinksParserConstants.LINKS_FUNCS).slice(0, 100);
        for (const item of items) {
            ret.push({
                label: item,
                kind: CompletionItemKind.Function
            });
        }
        return;
    }
    
    // For non-empty token, filter by prefix (case-insensitive)
    const lowerToken = currentToken.toLowerCase();
    
    // For small sets, direct filtering is fine
    if (LinksParserConstants.LINKS_FUNCS.size < 1000) {
        for (const item of LinksParserConstants.LINKS_FUNCS) {
            if (item.toLowerCase().startsWith(lowerToken)) {
                ret.push({
                    label: item,
                    kind: CompletionItemKind.Function
                    
                });
            }
        }
    } else {
        // For larger sets, convert to array first to avoid multiple iterations
        const matches = Array.from(LinksParserConstants.LINKS_FUNCS)
            .filter(item => item.toLowerCase().startsWith(lowerToken))
            .slice(0, 100); // Limit results
            
        for (const item of matches) {
            ret.push({
                label: item,
                kind: CompletionItemKind.Function
            });
        }
    }
}

function addXmlTagCompletion(
    previousToken: string,
    cursorPos: Position,
    documentText: string,
    ret: CompletionItem[]
): void {
    // const lines = documentText.split('\n');
    // const lineIndex = cursorPos.line - 2;
    
    // if (lineIndex < 0 || lineIndex >= lines.length) {return;}
    
    // const currentLine = lines[lineIndex];
    // const textBeforeCursor = currentLine.substring(0, cursorPos.character);
    
    // // Check if cursor is right after a ">"
    // if (!textBeforeCursor.endsWith('>')) {return;}

    let textBeforeCursor = previousToken;

    console.log(`[addXmlTagCompletion] textBeforeCursor: ${textBeforeCursor}`);
    
    // More robust pattern to find the tag, accounting for attributes
    // This looks for the last opening tag that isn't closed and isn't self-closing
    const openTagRegex = /<([a-zA-Z][a-zA-Z0-9_:-]*)(?:[^<>"']*|"[^"]*"|'[^']*')*>$/;
    const selfClosingRegex = /<[^>]*\/>$/;
    const closingTagRegex = /<\/[^>]+>$/;
    
    // If it's a self-closing or closing tag, don't offer completion
    if (selfClosingRegex.test(textBeforeCursor) || closingTagRegex.test(textBeforeCursor)) {
        return;
    }
    
    const match = textBeforeCursor.match(openTagRegex);
    if (match) {
        console.log(`inside match for [addXmlTagCompletion]`);
        const tagName = match[1];
        
        // Check if we're creating a Links XML tag (all Links XML tags start with "l:")        
        ret.push({
            label: `</${tagName}>`,
            kind: CompletionItemKind.Snippet,
            insertText: `$0</${tagName}>`,
            insertTextFormat: 2,
            sortText: "0",
            preselect: true,
            detail: `Close <${tagName}> tag`
            // insertText: isLinksTag ? 
            //     `\n\t$0\n</${tagName}>` : 
            //     `$0</${tagName}>`,
            // insertTextFormat: 2, // InsertTextFormat.Snippet
            // detail: `Auto-close <${tagName}> tag`,
            // preselect: true,
            // textEdit: {
            //     range: {
            //         start: { line: cursorPos.line, character: cursorPos.character },
            //         end: { line: cursorPos.line, character: cursorPos.character }
            //     },
            //     newText: isLinksTag ? 
            //         `\n\t$0\n</${tagName}>` : 
            //         `$0</${tagName}>`
            // }
        });
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
    addXmlTagCompletion(previousToken, cursorPos, documentText, ret);

    // specific completion scenarios
    switch(previousToken){
        case "table":
            addTableCompletion(db_tables, db_schemas, ret, documentText, cursorPos);
            break;
        default:
            // skip
            break;
    }
    addBuiltInFunctionCompletion(currentToken, ret);
    addVariableCompletion(currentToken, variableDefinitions, ret);
    addFunctionCompletion(currentToken, functionDefinitions, ret);
    return ret;
}