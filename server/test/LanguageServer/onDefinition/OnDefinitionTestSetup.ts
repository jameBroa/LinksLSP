import { Location, Position, Range } from "vscode-languageserver";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { LanguageServer } from "../../../src/extension";
import path from "path";
import * as fs from 'fs/promises';
import * as sinon from 'sinon';
import { AST } from "../../../src/common/ast/ast";

export async function RunOnDefinitionTest(
    baseUri: string,
    tempFilePath: string,
    server: LanguageServer,
    testOcamlClient: OCamlClient,
    file: string,
    position: Position
): Promise<Range | null>{
    const fileUri = path.join(baseUri, file);
    const fileContent = await fs.readFile(fileUri, 'utf8');
    let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
    await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
    console.log(`temp file path: ${tempFilePath}`);
    sinon.stub(server, 'getAST').returns(
        Promise.resolve((
            AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
        ))
    );

    const result = await server.onDefinition(
        {
            textDocument: {
                uri: fileUri.toString()
            },
            position: position
        }
    );
    return result ? result.range : null;
}