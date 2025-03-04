import { TextDocumentContentChangeEvent } from "vscode-languageserver";

export namespace DocumentManipulator{

    export function AdjustDocument(OriginalDocument: string, ContentChanges: TextDocumentContentChangeEvent[]): string{
        let DocumentByLine = OriginalDocument.split("\n");

        // TextDcoumentContentChangeEvent can take two forms
        // 1. With range information about what is changed (as expected)
        // 2. Just the text which replaces it
        // The latter is when the whole document is replaced so range information is forsaken
        
        for(const change of ContentChanges){
            if("range" in change){
                const range = change.range;
                const startLine  = range.start.line;
                const endLine = range.end.line;
                if(startLine === endLine) {
                    // Base case: Changes happen on one line

                    let currentLineContent = DocumentByLine[startLine];
                    let insertionIdx = range.start.character;
                    let newLineContent;
                    if(change.text !== ""){
                        newLineContent = currentLineContent.slice(0, insertionIdx) + 
                        change.text + currentLineContent.slice(range.end.character);
                    } else {
                        newLineContent = currentLineContent.slice(0, insertionIdx) + currentLineContent.slice(range.end.character);
                    }
                    
                    DocumentByLine[startLine] = newLineContent;

                } else {
                    // Changes happen over multiple lines
                    // Extract the starting and ending line content
                    let startLineContent = DocumentByLine[startLine];
                    let endLineContent = DocumentByLine[endLine];
                    
                    // Compute the new start line content by slicing up to the start character
                    let newStartLineContent = startLineContent.slice(0, range.start.character) + change.text;
                    
                    // Compute the new end line content by slicing from the end character
                    let remainingEndLineContent = endLineContent.slice(range.end.character);

                    // Replace the affected lines
                    DocumentByLine.splice(
                        startLine, 
                        endLine - startLine + 1, // Number of lines to remove
                        newStartLineContent + remainingEndLineContent // Combine modified start and end content
                    );
                }
            } else {
                // pass
            }
            

        }
        // console.log(`[DocumentManipulator] AdjustedDocument: ${DocumentByLine.join("\n")}`);
        return DocumentByLine.join("\n");
    }
    function foo(){
        let test_str: string = "string";
        let test_num: number = 10;
        return test_str + test_num; 
    }
}