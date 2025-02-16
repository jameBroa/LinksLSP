import * as assert from 'assert';
import path from "path";
import { LanguageServer } from "../../../../src/extension";
import { OCamlClient } from "../../../../src/common/ocaml/ocamlclient";
import { setupLanguageServerTests, tearDownLanguageServerTests } from "../../SetupLanguageServerTests";
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import { AST } from "../../../../src/common/ast/ast";
import { TextDocument } from 'vscode-languageserver-textdocument';
import { RunSemanticTest } from '../SemanticTokenTestSetup';

describe("SemanticTokens: Used variable tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './VariablesTests/');
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

    it("Should semantically highlight the variable declaration and reference as 'used'", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '1.links');
        const expected = [
            1,4,3,28,0,1,8,1,8,0,0,4,1,20,0,1,4,1,8,0,3,0,3,29,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the variable declaration (as a parameter) and reference as 'used'", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '2.links');
        const expected = [1,4,3,28,0,0,4,1,8,0,1,4,1,8,0,3,0,3,29,0,0,4,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the variable declaration and its reference in a list comprehension as 'used", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '3.links');
        const expected = [
            2,4,6,8,0,0,10,7,19,0,0,9,8,19,0,0,10,8,19,0,1,4,4,8,0,0,8,1,20,0,0,3,1,20,0,1,4,4,8,0,0,8,1,20,0,0,3,1,20,0,2,4,1,8,0,0,9,5,8,0,0,9,6,8,0,0,8,3,8,0,0,7,4,8,0,0,6,3,8,0,0,7,4,8,0,1,2,5,8,0,0,7,3,8,0,0,5,3,8,0,2,0,1,8,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    // The test below doesn't work because 
    // 1) Projections don't work
    // 2) variable declaration inside iterators isn't working

    
    it("Should semantically highlight the variable declaration and its reference in Database Update with projections", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '4.links');
        const expected = [1,4,2,8,0,0,14,7,19,
            0,2,4,8,8,0,0,17,10,19,0,0,68,2,8,0,2,
            8,3,8,0,0,8,8,8,0,1,15,3,8,0,0,4,2,26,
            0,0,6,1,20,0,1,16,1,20,0,0,15,9,19,0,0,19,4,20,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the variable declaration and its reference in a nested function as 'used'", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '5.links');
        const expected = [
            1,4,3,28,0,1,8,1,8,
            0,0,4,1,20,0,1,8,1,
            8,0,0,4,1,8,0,0,2,1
            ,20,0,1,8,3,28,0,1,
            12,3,28,0,1,16,1,8,
            0,0,4,2,20,0,1,16,3,
            28,0,1,16,1,8,0,0,2,
            1,8,0,2,12,1,8,0,0,
            2,3,29,0,2,8,1,8,0,
            0,2,1,20,0,0,2,3,29,
            0,2,4,1,8,0,0,2,3,29
            ,0,3,0,3,29,0];

        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the variable declaration and its reference in a nested function as 'used' if the declaration is in the parameters of a function", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '6.links');
        const expected = [
            1,4,3,28,0,0,4,1,8,0,1,8,1,8,0,0,4,1,20,0,1,8,1,8,0,0,4,1,8,0,0,2,1,20,0,1,8,3,28,0,1,8,1,8,0,0,2,1,20,0,0,2,1,8,0,2,4,1,8,0,0,2,3,29,0,3,0,3,29,0,0,4,1,20,0];

        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the parameter variable as 'used' if it is only used inside a nested function", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '12.links');
        const expected = [
            0,4,5,27,0,0,6,5,8,0,1,8,5,28,0,1,8,5,8,0,2,4,5,29,0,3,4,4,27,0,0,5,5,8,0,1,4,5,8,0
        ];

        assert.deepStrictEqual(result, expected);
    });

});

describe("SemanticTokens: Unused variable tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './VariablesTests/');
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
    
    it("Should highlight the variable declaration as 'unused' if it is declared as a parameter but not referenced", async () => {

        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '7.links');
        const expected = [
            1,4,3,28,0,0,4,1,8,0,0,3,1,9,0,1,4,1,8,0,3,0,3,29,0,0,4,1,20,0,0,3,1,20,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should highlight the variable declaration as 'unused' if it is declared in the body of a function but not referenced", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '8.links');
        const expected = [1,4,3,28,0,0,4,1,8,0,1,8,1,9,0,0,4,2,20,0,1,4,1,8,0,3,0,3,29,0,0,4,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should highlight the variable declaration as 'unused' if it is declared in the root of the file but not referenced", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '9.links');
        const expected = [1,4,1,9,0,0,4,2,20,0,1,4,1,8,0,0,4,1,20,0,2,0,1,8,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should highlight the variable declaration as 'unused' if it is declared in a list comprehension and not referenced", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '10.links');
        const expected = [
            1,4,9,28,0,1,8,1,8,0,0,4,1,20,0,1,8,1,8,0,0,9,1,9,0,0,5,1,8,0,0,4,1,8,0,0,2,1,20,0,1,4,1,8,0,3,0,9,29,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should highlight a parameter as 'unused' if it is not referenced, even if a variable with the same name is declared and referenced in a different function", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '11.links');
        const expected = [
            0,4,3,27,0,0,4,4,8,0,0,6,6,9,0,1,4,4,8,0,3,4,4,27,0,0,5,5,8,0,1,8,6,9,0,0,9,1,20,0,1,4,5,8,0];
        assert.deepStrictEqual(result, expected);
    });



});