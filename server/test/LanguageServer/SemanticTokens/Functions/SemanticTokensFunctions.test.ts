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


describe("SemanticTokens: Used function tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './FunctionsTests/');
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

    it("Should semantically highlight the function declaration and reference as 'used' (No signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '1.links');
        const expected = [
            1,4,5,28,0,0,0,
            -4,28,0,1,4,1,20,
            0,3,0,4,28,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the function declaration and reference as 'used' (Signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '2.links');
        const expected = [1,4,6,28,0,1,4,5,28,0,0,5,1,8,0,1,4,1,8,0,3,0,4,28,0,0,5,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the function declaration and reference as 'used' even in nested functions (No signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '3.links');
        const expected = [
            1,4,7,28,0,0,0,-4,28,0,0,7,1,8,0,1,8,
            6,28,0,0,0,-4,28,0,0,6,1,8,0,1,8,1,8,
            0,0,2,1,8,0,2,4,5,28,0,0,6,1,8,0,3,0,
            6,28,0,0,7,1,20,0];
        assert.deepStrictEqual(result, expected);
    });
    it("Should semantically highlight the function declaration and reference as 'used' even in nested functions (Signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '4.links');
        const expected = [
            0,4,8,28,0,1,4,7,28,0,0,7,
            1,8,0,1,8,7,28,0,1,8,6,28,
            0,0,6,1,8,0,1,8,1,8,0,0,2,
            1,8,0,2,4,5,28,0,0,6,1,8,0,
            3,0,6,28,0,0,7,1,20,0
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight built-in functions as 'used'", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '9.links');
        const expected = [1,4,7,28,0,0,0,-4,28,0,0,7,1,8,0,1,4,3,28,0,0,4,1,8,0,0,3,1,20,0,0,6,1,20,0,3,0,6,28,0,0,7,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight recursive functions as 'used' (Signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '10.links');
        const expected = [1,4,11,28,0,1,4,10,28,0,0,10,1,8,0,1,7,1,8,0,0,4,1,20,0,1,8,1,20,0,2,8,9,28,0,0,10,1,8,0,0,2,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight recursive functions as 'used' (No signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '11.links');
        const expected = [1,4,10,28,0,0,0,-4,28,0,0,10,1,8,0,1,7,1,8,0,0,4,1,20,0,1,8,1,20,0,2,8,9,28,0,0,10,1,8,0,0,2,1,20,0];
        assert.deepStrictEqual(result, expected);
    });
});

describe("SemanticTokens: Unused function tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './FunctionsTests/');
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

    it("Should semantically highlight the function declaration as 'unused' (No signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '5.links');
        const expected = [1,4,4,27,0,0,0,-4,27,0,1,4,1,20,0,3,0,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the function declaration as 'unused' (Signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '6.links');
        const expected = [1,4,5,27,0,1,4,4,27,0,1,4,1,20,0,3,0,1,20,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the function declaration as 'unused' if nested (No signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '7.links');
        const expected = [1,4,4,28,0,0,0,-4,28,0,1,8,4,27,0,0,0,-4,27,0,1,8,1,20,0,2,4,1,20,0,3,0,3,28,0];
        assert.deepStrictEqual(result, expected);
    });

    it("Should semantically highlight the function declaration as 'unused' if nested (Signature)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '8.links');
        const expected = [1,4,5,28,0,1,4,4,28,0,1,8,5,27,0,1,8,4,27,0,1,8,1,20,0,2,4,1,20,0,3,0,3,28,0];
        assert.deepStrictEqual(result, expected);
    });









});
