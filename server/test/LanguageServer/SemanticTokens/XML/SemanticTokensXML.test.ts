import * as assert from 'assert';
import path from "path";
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import { LanguageServer } from '../../../../src/extension';
import { OCamlClient } from '../../../../src/common/ocaml/ocamlclient';
import { setupLanguageServerTests, tearDownLanguageServerTests } from '../../SetupLanguageServerTests';
import { RunSemanticTest } from '../SemanticTokenTestSetup';


describe("SemanticTokens: XML tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './XMLTests/');
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

    it("Should semantically highlight basic HTML tags (One tag per line)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '1.links');
        const expected = [
            1,4,7,27,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,16,1,24,0,0,1,3,23,0,0,3,1,24,0,1,16,2,24,0,0,2,3,23,0,0,3,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0];
        assert.deepStrictEqual(result, expected);      
    });

    it("Should semantically highlight basic HTML tags with a single typical HTML attributes (One tag per line)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '2.links');
        const expected = [
            1,4,7,28,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,-13,19,0,0,0,4,23,0,0,5,5,25,0,0,17,1,24,0,1,9,-9,19,0,0,7,1,24,0,0,1,3,23,0,0,4,2,25,0,0,13,1,24,0,1,16,2,24,0,0,2,3,23,0,0,3,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);      
    });

    it("Should semantically highlight basic HTML tags with typical HTML attributes defined across multiple lines (One tag per line)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '3.links');
        const expected = [
            1,4,7,28,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,-13,19,0,0,0,4,23,0,0,5,5,25,0,0,17,1,24,0,1,16,1,24,0,0,1,3,23,0,1,16,2,25,0,0,4,-20,19,0,1,16,5,25,0,0,7,-23,19,0,0,10,1,24,0,1,16,2,24,0,0,2,3,23,0,0,3,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);      
    });

    it("Should semantically highlight basic HTML tags (multiple tags per line)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '4.links');
        const expected = [
            1,4,7,28,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,0,1,1,24,0,0,1,4,23,0,0,4,1,24,0,0,1,1,24,0,0,1,3,23,0,0,3,1,24,0,0,1,2,24,0,0,2,3,23,0,0,3,1,24,0,0,1,2,24,0,0,2,4,23,0,0,4,1,24,0,0,1,2,24,0,0,2,4,23,0,0,4,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);      
    });
    it("Should semantically highlight basic HTML tags (One tag per line) with multiple typical HTML attributes on the same line", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '5.links');
        const expected = [
            1,4,7,28,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,9,-9,19,0,0,0,-9,19,0,0,7,1,24,0,0,1,3,23,0,0,4,2,25,0,0,14,5,25,0,0,23,1,24,0,1,16,2,24,0,0,2,3,23,0,0,3,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);      
    });

    it("Should semantically highlight basic HTML tags (One tag per line) with atypical attributes on multiple lines", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '6.links');
        const expected = [
            1,4,7,28,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,16,1,24,0,0,1,3,23,0,1,16,8,25,0,0,10,-26,19,0,1,16,9,25,0,0,11,-27,19,0,0,16,1,24,0,1,16,2,24,0,0,2,3,23,0,0,3,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);      
    });
    it("Should semantically highlight basic HTML tags (multiple tags per line) with atypical attributes on multiple lines", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '7.links');
        const expected:number[] = [1,4,7,28,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,0,1,1,24,0,0,1,3,23,0,1,12,8,25,0,0,10,-22,19,0,1,12,9,25,0,0,11,-23,19,0,0,16,1,24,0,0,1,2,24,0,0,2,3,23,0,0,3,1,24,0,0,1,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(expected,result);
    });
    it("Should semantically highlight ANY XML tags (One tag per line)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '8.links');
        const expected:number[] = [
            1,4,7,28,0,2,8,1,24,0,0,1,3,23,0,0,3,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,16,1,24,0,0,1,7,23,0,0,7,1,24,0,1,16,2,24,0,0,2,7,23,0,0,7,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,3,23,0,0,3,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);
    });
    it("Should semantically highlight ANY XML tags (Multiple tags per line)", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '9.links');
        const expected:number[] = [
            1,4,7,28,0,2,8,1,24,0,0,1,3,23,0,0,3,1,24,0,0,1,1,24,0,0,1,4,23,0,0,4,1,24,0,0,1,1,24,0,0,1,7,23,0,0,7,1,24,0,0,1,2,24,0,0,2,7,23,0,0,7,1,24,0,0,1,2,24,0,0,2,4,23,0,0,4,1,24,0,0,1,2,24,0,0,2,3,23,0,0,3,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);
    });
    it("Should semantically highlight ANY XML tags (One tag per line) with atypical attributes on multiple lines", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '10.links');
        const expected = [
            1,4,7,28,0,2,8,1,24,0,0,1,3,23,0,0,3,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,16,1,24,0,0,1,7,23,0,1,16,8,25,0,0,10,-26,19,0,1,16,4,25,0,0,6,-22,19,0,0,4,1,24,0,1,16,2,24,0,0,2,7,23,0,0,7,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,3,23,0,0,3,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result, expected);      
    });
    it("Should semantically highlight ANY XML tags (One tag per line) with multiple atypical attributes on the same line and closing tag same line", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '11.links');
        const expected:number[] = [
            1,4,7,28,0,2,8,1,24,0,0,1,3,23,0,0,3,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,8,-8,19,0,0,8,1,24,0,0,1,7,23,0,0,2,-19,19,0,0,6,8,25,0,0,21,4,25,0,0,10,1,24,0,1,16,2,24,0,0,2,7,23,0,0,7,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,3,23,0,0,3,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result,expected);     
    });
    it("Should semantically highlight ANY XML tags (multiple tags per line) with atypical attributes on multiple lines", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '12.links');
        const expected:number[] = [
            1,4,7,28,0,2,8,1,24,0,0,1,3,23,0,0,3,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,0,1,1,24,0,0,1,7,23,0,1,12,8,25,0,0,10,-22,19,0,1,12,4,25,0,0,6,-18,19,0,0,4,1,24,0,1,16,2,24,0,0,2,7,23,0,0,7,1,24,0,1,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,3,23,0,0,3,1,24,0,3,0,7,29,0];
        assert.deepStrictEqual(result,expected);
    });
    it("Should NOT semantically highlight forest literals: <#> and </#> as comments", async () => {
        const result = await RunSemanticTest(baseUri, tempFilePath, server, testOcamlClient, '13.links');
        const expected:number[] = [
            0,4,9,27,0,1,8,2,8,0,0,5,1,20,0,1,8,4,8,0,0,7,1,20,0,1,8,4,8,0,0,7,2,8,0,0,3,4,8,0,1,4,4,8,0,4,4,3,27,0,2,8,1,24,0,0,1,4,23,0,0,4,1,24,0,1,12,1,24,0,0,1,4,23,0,0,4,1,24,0,1,16,1,24,0,0,1,3,23,0,1,16,2,25,0,0,4,-20,19,0,1,16,5,25,0,0,7,-23,19,0,1,16,1,24,0,1,7,-7,19,0,0,13,1,24,0,0,1,1,23,0,0,2,2,25,0,0,9,1,24,0,0,5,2,24,0,0,2,1,23,0,0,1,1,24,0,1,20,1,24,0,0,1,1,23,0,0,1,1,24,0,0,5,2,24,0,0,2,1,23,0,0,1,1,24,0,1,20,1,24,0,0,1,1,23,0,0,1,1,24,0,0,5,2,24,0,0,2,1,23,0,0,1,1,24,0,1,20,1,24,0,0,1,1,23,0,0,1,2,24,0,0,1,1,24,0,1,16,2,24,0,0,2,3,23,0,0,3,1,24,0,2,12,2,24,0,0,2,4,23,0,0,4,1,24,0,1,8,2,24,0,0,2,4,23,0,0,4,1,24,0];
        assert.deepStrictEqual(result,expected);
    });


});