import { Position } from "vscode-languageserver-types";
// import { GlobalLogger } from "../../extension";

namespace InfoRetriever {

    function isAllSpaces(str: string): boolean {
        return str.trim().length === 0;
    }


    export function getWordAtPosition(lines: string[], positionParams: Position): string {
        const line = lines[positionParams.line];
        // const words = line.split(/\W+/);
        const words = line.split(/\b/);
        let currLength = -1;
        for(const word of words) {
            currLength += word.length;
            if(currLength >= positionParams.character) {
                return word;
                // if (currLength - word.length <= positionParams.character) {
                //     return word.trim(); // Trim to remove any surrounding whitespace
                // }
            }
            currLength++;
        }
        return "";
    }
}

export default InfoRetriever;