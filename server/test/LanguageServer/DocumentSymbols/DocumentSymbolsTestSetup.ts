import { DocumentSymbol } from "vscode-languageserver";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { LanguageServer } from "../../../src/extension";
import path from "path";
import * as fs from 'fs/promises';
import { AST } from "../../../src/common/ast/ast";
import * as sinon from 'sinon';
import * as lodash from 'lodash';

function isValidJSON(jsonString: string): boolean {
    try {
        JSON.parse(jsonString);
        return true;
    } catch (e) {
        return false;
    }
}


export async function RunDocumentSymbolsTest(
    baseUri: string,
    tempFilePath: string,
    server: LanguageServer,
    testOcamlClient: OCamlClient,
    file: string): Promise<DocumentSymbol[]> {
        const fileUri = path.join(baseUri, file);
        const fileContent = await fs.readFile(fileUri, 'utf8');
        let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n()\n}`;
        await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
        await fs.access(tempFilePath);
        const actualContent = await fs.readFile(tempFilePath, 'utf8');
        console.log(`actual content: ${actualContent}`);
        // const ParserUri = path.join(baseUri, '..', '..', '..', '..', '..', 'LinksParser', 'parser', 'parser.ml');
        // await testOcamlClient.Update_ServerPath(ParserUri);
        // sinon.stub(server, 'getAST').returns(
        //     Promise.resolve((
        //         AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${fileUri.toString()}\n`), "")
        //     ))
        // );

        console.log(`temp file path: "${tempFilePath}"`);
        console.log(`file uri: "${fileUri.toString()}"`);

        sinon.stub(server, 'HandleASTAndDocumentText').resolves(
            {
                ast: AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), ""),
                documentText: newDocumentText
            }
        );

        const result = await server.onDocumentSymbol({
            textDocument: {
                uri: tempFilePath
            }
        });

        console.log(`Document Symbols: ${JSON.stringify(result, null, 2)}`);

        return result;
    }