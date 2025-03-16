import { Position } from "vscode-languageserver";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import path from "path";
import * as fs from 'fs/promises';
import { AST } from "../../../src/common/ast/ast";
import * as sinon from 'sinon';
import { LanguageServer } from "../../../src/extension";

export async function RunHoverTipsTest(
    baseUri: string,
    tempFilePath: string,
    server: LanguageServer,
    testOcamlClient: OCamlClient,
    file: string,
    position: Position) {

        const fileUri = path.join(baseUri, file);
        const fileContent = await fs.readFile(fileUri, 'utf8');
        let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n()\n}`;
        await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
        const temp = await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`)
        sinon.stub(server, 'HandleASTAndDocumentText').resolves(
            {
                ast: AST.fromJSON(temp, ""),
                documentText: newDocumentText
            }
        );

        const result = await server.onHover({
            textDocument: {
                uri: tempFilePath
            },
            position: position
        });

        return result;
}
        
