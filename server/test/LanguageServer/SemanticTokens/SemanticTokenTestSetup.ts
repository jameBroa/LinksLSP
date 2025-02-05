import path from "path";
import * as fs from 'fs/promises';
import * as sinon from 'sinon';

import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { LanguageServer } from "../../../src/extension";
import { AST } from "../../../src/common/ast/ast";
import { TextDocument } from "vscode-languageserver-textdocument";


export async function RunSemanticTest(
    baseUri: string,
    tempFilePath: string,
    server: LanguageServer,
    testOcamlClient: OCamlClient,
    file: string,
): Promise<number[]> {
    const fileUri = path.join(baseUri, file);
    const fileContent = await fs.readFile(fileUri, 'utf8');
    let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
    await fs.writeFile(tempFilePath, newDocumentText, 'utf8');

    sinon.stub(server, 'getAST').returns(
        Promise.resolve((
            AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
        ))
    );
    sinon.stub(server.documents, 'get').returns({
        uri: tempFilePath,
        getText: () => fileContent  
    } as TextDocument);

    let params = {
        textDocument: {
            uri: tempFilePath
        }
    } as any;

    const result = await server.onRequestFull(params);
    let tokenData = result!.data;
    return tokenData;
}