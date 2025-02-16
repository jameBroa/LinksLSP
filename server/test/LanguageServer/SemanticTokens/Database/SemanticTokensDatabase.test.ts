import * as assert from 'assert';
import path from "path";
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import { LanguageServer } from '../../../../src/extension';
import { OCamlClient } from '../../../../src/common/ocaml/ocamlclient';
import { setupLanguageServerTests, tearDownLanguageServerTests } from '../../SetupLanguageServerTests';
import { RunSemanticTest } from '../SemanticTokenTestSetup';



describe("SemanticTokens: Database tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './DatabaseTests/');
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

    it("Should semantically highlight iterator variables inside query expressions as 'used'", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '1.links');
        const expected = [1,4,2,8,0,0,14,7,19,0,2,4,8,8,0,0,17,10,19,0,0,68,2,8,0,2,4,16,9,0,0,36,8,8,0,0,11,1,9,0];
        assert.deepStrictEqual(result, expected);        
    });

    it("Should semantically highlight projections and highlight variables as 'used' during update DB operation", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '2.links');
        const expected = [
            1,4,2,8,0,0,14,7,19,0,2,4,8,8,0,0,17
            ,10,19,0,0,68,2,8,0,2,8,3,8,0,0,8,8,
            8,0,1,15,3,8,0,0,4,2,26,0,0,6,1,20,0,
            1,16,1,20,0,0,15,9,19,0,0,19,4,20,0
        ];
        assert.deepStrictEqual(result, expected);        
    });

    it("Should semantically highlight projections and highlight variables as 'used' during delete DB operation", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '3.links');
        const expected = [
            1,4,2,8,0,0,14,7,19,0,2,4,8,8,0,
            0,17,10,19,0,0,68,2,8,0,2,8,3,8,
            0,0,8,8,8,0,1,15,3,8,0,0,4,2,26,
            0,0,4,1,20,0
        ];
        assert.deepStrictEqual(result, expected);        
    });

    it("Should semantically highlight variable references during DB insert operation", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '4.links');
        const expected = [
            1,4,2,8,0,0,14,7,19,0,2,
            4,8,8,0,0,17,10,19,0,0,68,
            2,8,0,2,7,8,8,0,1,12,1,20,
            0,0,17,9,19,0,0,21,5,20,0,
            1,12,1,20,0,0,17,9,19,0,0,
            21,3,20,0,1,12,1,20,0,0,17,
            9,19,0,0,21,4,20,0
        ];
        assert.deepStrictEqual(result, expected);   
    });


});