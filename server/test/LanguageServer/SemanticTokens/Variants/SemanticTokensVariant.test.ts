import path from "path";
import { LanguageServer } from "../../../../src/extension";
import { OCamlClient } from "../../../../src/common/ocaml/ocamlclient";
import { setupLanguageServerTests, tearDownLanguageServerTests } from "../../SetupLanguageServerTests";
import * as assert from 'assert';
import { RunSemanticTest } from "../SemanticTokenTestSetup";

describe("SemanticTokens: Variant tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './VariantTests/');
    let testOcamlClient: OCamlClient;
    let tempFilePath: string;

    beforeEach(async () => {
        let setup = setupLanguageServerTests(baseUri);
        server = setup.server;
        testOcamlClient = setup.testOcamlClient;
        tempFilePath = setup.tempFilePath;
    });

    afterEach(async() => {
        tearDownLanguageServerTests(server, tempFilePath);
    });

    after(async () => {
        server.connection.dispose();
    });

    it("Should correctly tokenize `Variants' from switch statements", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '1.links');
        const expected:any = [1,4,9,28,0,0,0,9,28,0,0,0,9,28,0,0,10,1,8,0,0,0,1,9,0,1,4,1,8,0,3,4,16,28,0,2,13,7,30,0,0,8,1,8,0,0,0,1,9,0,0,6,9,29,0,0,10,1,8,0,1,13,6,30,0,0,7,3,8,0,1,10,9,29,0,0,10,3,8,0,0,7,9,29,0,0,10,3,8,0,4,4,4,28,0,1,8,3,8,0,0,13,16,29,0,1,4,3,8,0,3,0,4,29,0];
        assert.deepStrictEqual(result, expected);  
    });

    it("Should correctly tokenize 'Variants' even if inside nested XML", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '2.links');
        const expected:any =[1,4,9,28,0,0,0,9,28,0,0,0,9,28,0,0,0,9,28,0,0,0,9,28,0,0,10,1,8,0,0,0,1,9,0,1,4,1,8,0,3,4,16,28,0,2,13,7,30,0,0,8,1,8,0,0,0,1,9,0,0,6,9,29,0,0,10,1,8,0,1,13,6,30,0,0,7,3,8,0,0,0,3,9,0,1,10,9,29,0,0,10,3,8,0,0,7,9,29,0,0,10,3,8,0,4,4,2,27,0,2,4,1,24,0,0,1,4,23,0,0,4,1,24,0,0,1,0,31,0,1,6,1,31,0,0,2,1,24,0,0,0,1,24,0,0,0,1,24,0,0,1,4,23,0,0,4,1,24,0,0,0,1,24,0,0,0,1,24,0,0,1,1,31,0,1,6,1,31,0,2,21,7,30,0,0,8,1,8,0,0,0,1,9,0,0,4,1,24,0,0,0,1,24,0,0,0,1,24,0,0,0,1,24,0,0,2,9,29,0,0,10,1,8,0,1,21,6,30,0,0,7,3,8,0,0,0,3,9,0,0,6,1,24,0,0,0,1,24,0,0,0,1,24,0,0,0,1,24,0,0,2,9,29,0,0,10,3,8,0,2,9,0,31,0,1,6,1,31,0,0,2,2,24,0,0,0,2,24,0,0,0,2,24,0,0,2,4,23,0,0,4,1,24,0,0,0,1,24,0,0,0,1,24,0,0,1,0,31,0,1,2,1,31,0,0,2,2,24,0,0,2,4,23,0,0,4,1,24,0,5,4,4,28,0,1,8,3,8,0,0,13,16,29,0,1,4,3,8,0,3,0,4,29,0];
        assert.deepStrictEqual(result, expected);
    });


});