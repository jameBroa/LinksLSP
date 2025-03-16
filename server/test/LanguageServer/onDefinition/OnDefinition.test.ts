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
        const expected = Range.create(4,0,6,1);
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
        const expected = Range.create(1, 0, 10, 1);
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
        const expected = Range.create(2, 4, 7, 5);
        assert.deepStrictEqual(result, expected);
    });

    it('Should return the same location for a function that is not yet defined', async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '8.links', 
            Position.create(3, 10)
        );
        const expected = Range.create(3, 8, 3, 11);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the same location (leading to references) if definition called on the function definition", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '9.links', 
            Position.create(2, 10)
        );
        const expected = Range.create(2, 4, 4, 5);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a function defined in an XML block", async () => {
        const result = await RunOnDefinitionTest(
            baseUri,
            tempFilePath,
            server,
            testOcamlClient,
            '17.links',
            Position.create(11, 16)
        );
        const expected = Range.create(5, 10, 9, 11);
        assert.deepStrictEqual(result, expected);
    });
    it("Should return the correct location for a function defined in an XML attribute", async () => {
        const result = await RunOnDefinitionTest(
            baseUri,
            tempFilePath,
            server,
            testOcamlClient,
            '18.links',
            Position.create(9, 17)
        );
        const expected = Range.create(5, 10, 7, 11);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a function even if another function of the same name exists, but in a different scope", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '19.links', 
            Position.create(21, 4)
        );
        const expected = Range.create(18, 2, 20, 3);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for the second function defined in a mutual block of two functions", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '21.links', 
            Position.create(2, 9)
        );
        const expected = Range.create(4, 4, 6, 5);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a recursive function", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '20.links', 
            Position.create(7, 6)
        );
        const expected = Range.create(0, 0, 6, 1);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a function called inside the block of list comprehensions", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '22.links', 
            Position.create(6, 27)
        );
        const expected = Range.create(1, 0, 3, 1);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a function called inside pattern matching for lists", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '23.links', 
            Position.create(7, 28)
        );
        const expected = Range.create(1, 0, 3, 1);
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

    it("Should return a null location for a variable thats not yet defined", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '7.links', 
            Position.create(3, 9)
        );
        assert.deepStrictEqual(result, null);
    });

    it("Should return the same position if definition called on the variable definition", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '10.links', 
            Position.create(2, 9)
        );
        const expected = Range.create(2,8,2,9);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the same position if definition called on the variable definition", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '11.links', 
            Position.create(6, 4)
        );
        assert.deepStrictEqual(result, null);
    });

    it("Should return the definition of a variable defined as a tuple as part of an iterator", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '13.links', 
            Position.create(2, 44)
        );
        const expected = Range.create(2,8,2,12);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the definition of a variable defined as a tuple as part of an iterator inside an XML block", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '14.links', 
            Position.create(6, 50)
        );
        const expected = Range.create(6,14,6,18);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a variable defined in a parent scope and in the current scope if we call the variable in the current scope", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '15.links', 
            Position.create(5, 4)
        );
        const expected = Range.create(4, 8, 4, 9);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a variable defined in a parent scope and in the current scope if we call the variable in the parent scope", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '15.links', 
            Position.create(8, 2)
        );
        const expected = Range.create(1, 6, 1, 7);
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the correct location for a variable definition even if another variable is defined using said definition", async () => {
        const result = await RunOnDefinitionTest(
            baseUri, 
            tempFilePath, 
            server, 
            testOcamlClient, 
            '16.links', 
            Position.create(3, 8)
        );
        const expected = Range.create(1, 6, 1, 14);
        assert.deepStrictEqual(result, expected);
    });



});
