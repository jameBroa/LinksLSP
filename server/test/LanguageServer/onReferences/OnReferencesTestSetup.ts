import { Position, ReferenceParams } from "vscode-languageserver";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { LanguageServer } from "../../../src/extension";
import path from "path";
import * as fs from 'fs/promises';
import * as sinon from 'sinon';
import { AST } from "../../../src/common/ast/ast";



export async function RunOnReferencesTest
(
    baseUri: string,
    tempFilePath: string,
    server: LanguageServer,
    testOcamlClient: OCamlClient,
    file: string,
    position: Position
) {
    const fileUri = path.join(baseUri, file);
    const fileContent = await fs.readFile(fileUri, 'utf8');
    let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
    await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
    
    sinon.stub(server, 'getAST').returns(
        Promise.resolve((
            AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
        ))
    );

    const result = await server.onReferences(
        {
            textDocument: {
                uri: fileUri.toString()
            },
            position: position
        } as ReferenceParams
    );
    return result ? result : null;

}