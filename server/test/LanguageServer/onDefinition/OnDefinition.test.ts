import * as assert from 'assert';
import {Position, Range} from 'vscode-languageserver';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import path from 'path';
import { LanguageServer } from '../../../src/extension';
import { OCamlClient } from '../../../src/common/ocaml/ocamlclient';
import { AST } from '../../../src/common/ast/ast';
import { window } from 'vscode';
import { setupLanguageServerTests, tearDownLanguageServerTests } from '../SetupLanguageServerTests';
import { RunOnDefinitionTest } from './OnDefinitionTestSetup';


describe("OnDefinition: Function tests", ()=> {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './onDefinitionTests/');
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

    it("Should return correct location for function defined at root",  async() => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '1.links', 
            Position.create(10, 22)
        );
        const expected = Range.create(4,4,4,4);
        assert.deepStrictEqual(result, expected);
    });

    it('Should return correct location for functions used in Iterators', async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '3.links', 
            Position.create(13, 16)
        );
        const expected = Range.create(1, 4, 1, 4);
        assert.deepStrictEqual(result, expected);
    });

    it('Should return correct location for function definition if nested', async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '4.links', 
            Position.create(8, 7)
        );
        const expected = Range.create(2, 8, 2, 8);
        assert.deepStrictEqual(result, expected);
    });
});

describe("OnDefinition: Variable tests", async () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './onDefinitionTests/');
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

    it("Should return correct location for variables in the parameter of a function", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '1.links', 
            Position.create(10, 33)
        );
        const expected = Range.create(8, 20, 8, 21);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return correct location for a variable defined inside a function", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '1.links', 
            Position.create(10, 30)
        );
        const expected = Range.create(9, 8, 9, 11);
        assert.deepStrictEqual(result, expected);
    });

    it('Should return correct location for variables defined in Iterators', async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '2.links', 
            Position.create(7, 4)
        );
        const expected = Range.create(6, 13, 6, 18);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a variable defined in a parent scope called in a nested scope", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '5.links', 
            Position.create(6, 21)
        );
        const expected = Range.create(1, 8, 1, 9);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct locations for a parameter variable inside nested scopes", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '6.links', 
            Position.create(8, 43)
        );
        const expected = Range.create(1, 12, 1, 13);
        assert.deepStrictEqual(result, expected);
    });



});
