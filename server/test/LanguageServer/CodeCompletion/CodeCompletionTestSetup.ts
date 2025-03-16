import path from "path";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { LanguageServer } from "../../../src/extension";
import * as fs from 'fs/promises';
import { AST } from "../../../src/common/ast/ast";
import * as sinon from 'sinon';
import { CompletionItem, Position } from "vscode-languageserver";

export async function RunCodeCompletionTest(
    baseUri: string,
    tempFilePath: string,
    server: LanguageServer,
    testOcamlClient: OCamlClient,
    file: string,
    position: Position): Promise<CompletionItem[]>
 {
    const fileUri = path.join(baseUri, file);
    const fileContent = await fs.readFile(fileUri, 'utf8');
    let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n()\n}`;
    await fs.writeFile(tempFilePath, newDocumentText, 'utf8');

    sinon.stub(server, 'HandleASTAndDocumentText').resolves(
        {
            ast: AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), ""),
            documentText: newDocumentText
        }
    );

    const result = await server.onCompletion({
        textDocument: {
            uri: tempFilePath
        },
        position: position
    });
    return result;

}