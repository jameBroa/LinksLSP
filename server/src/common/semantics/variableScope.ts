import { TextDocument } from 'vscode-languageserver-textdocument';
import { SemanticTokensParams, SemanticTokensBuilder } from "vscode-languageserver/node";
import { GlobalLogger } from '../../extension';




export const BuildVarSemantics = (params: SemanticTokensParams, text: string, document:TextDocument, builder: SemanticTokensBuilder) => {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    let match;

    const variables = new Map();

    while((match = varPattern.exec(text)) ) {
        const varName = match[1];
        const pos = document.positionAt(match.index);

        if(['var'].includes(varName)) {
            continue;
        }
        
        if(!variables.has(varName)) {
            variables.set(varName, []);
        } else {
            variables.get(varName).push({
                line:pos.line,
                character:pos.character,
                length: varName.length
            });
        }
    }
    // GlobalLogger.log(JSON.stringify(Array.from(variables.entries())));



    for (const [_, positions] of variables) {
        for (const pos of positions) {
            builder.push(
                pos.line,
                pos.character,
                pos.length,
                2,
                0
            );
        }
    }
    return builder;
};