import path from "path";
import { LanguageServer } from "../../../src/extension";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { setupLanguageServerTests, tearDownLanguageServerTests } from "../SetupLanguageServerTests";
import { RunCodeCompletionTest } from "./CodeCompletionTestSetup";
import { Position } from "vscode-languageserver";
import * as assert from 'assert';

describe("Code completion: Custom Variables", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './CustomVariables/');
    let testOcamlClient: OCamlClient;
    let tempFilePath: string;

    beforeEach(async () => {
        let setup = setupLanguageServerTests(baseUri);
        server = setup.server;
        testOcamlClient = setup.testOcamlClient;
        tempFilePath = setup.tempFilePath;
    });

    afterEach(async () => {
        tearDownLanguageServerTests(server, tempFilePath);
    });

    after(async () => {
        server.connection.dispose();
    });

    it("Should return a list of suggestions which includes a custom defined variable inside a function", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '1.links', Position.create(2,10));
        const expected: any = [
            {
              "label": "customVar",
              "kind": 6
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return a list of suggestions which includes a custom defined variable inside a list comprehension", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '2.links', Position.create(2,38));
        const expected: any = [
            {
              "label": "customVar",
              "kind": 6
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return a list of suggestions which includes a custom defined variable inside an XML block", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '3.links', Position.create(6,33));
        const expected: any = [
            {
              "label": "customVar",
              "kind": 6
            }
          ];
        assert.deepStrictEqual(result, expected);
    });
    it("should return a list of two suggestions which includes two custom functions which are possible suggestions of what the user wrote", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '4.links', Position.create(4,10));
        const expected: any = [
            {
              "label": "exampleVar",
              "kind": 6
            },
            {
              "label": "exampleVarTwo",
              "kind": 6
            }
          ];
        assert.deepStrictEqual(result, expected);
    });


});

describe("Code completion: Custom Functions", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './CustomFunctions/');
    let testOcamlClient: OCamlClient;
    let tempFilePath: string;

    beforeEach(async () => {
        let setup = setupLanguageServerTests(baseUri);
        server = setup.server;
        testOcamlClient = setup.testOcamlClient;
        tempFilePath = setup.tempFilePath;
    });

    afterEach(async () => {
        tearDownLanguageServerTests(server, tempFilePath);
    });

    after(async () => {
        server.connection.dispose();
    });

    it("Should return a suggestion which includes a custom function from inside a function", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '1.links', Position.create(6,11));
        const expected: any = [
            {
              "label": "customFunction",
              "kind": 3
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return a suggestion which includes a custom function from inside a list comprehension", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '2.links', Position.create(6,30));
        const expected: any = [
            {
              "label": "customFunction",
              "kind": 3
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return a suggestion which includes a custom function from inside an XML block", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '3.links', Position.create(9,35));
        const expected: any = [
            {
              "label": "customFunction",
              "kind": 3
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return a list of two suggestions which includes two custom functions which are possible suggestions of what the user wrote", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '4.links', Position.create(13,8));
        const expected: any = [
            {
              "label": "exampleFunction",
              "kind": 3
            },
            {
              "label": "exampleFunctionTwo",
              "kind": 3
            }
          ];
        assert.deepStrictEqual(result, expected);
    });




});

describe("Code completion: Built-in functions", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './BuiltinFunctions/');
    let testOcamlClient: OCamlClient;
    let tempFilePath: string;

    beforeEach(async () => {
        let setup = setupLanguageServerTests(baseUri);
        server = setup.server;
        testOcamlClient = setup.testOcamlClient;
        tempFilePath = setup.tempFilePath;
    });

    afterEach(async () => {
        tearDownLanguageServerTests(server, tempFilePath);
    });

    after(async () => {
        server.connection.dispose();
    });

    it("should return a list of suggestions for built-in functions which start with \"h\"", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '1.links', Position.create(2,5));
        const expected: any = [
          {
            "label": "hasAttribute",
            "kind": 3
          },
          {
            "label": "haveMail",
            "kind": 3
          },
          {
            "label": "hd",
            "kind": 3
          },
          {
            "label": "here",
            "kind": 3
          }
        ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return a list of suggestions for built-in functions which start with \"int\" ", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '2.links', Position.create(2,7));
        const expected: any = [
            {
              "label": "intToDate",
              "kind": 3
            },
            {
              "label": "intToFloat",
              "kind": 3
            },
            {
              "label": "intToString",
              "kind": 3
            },
            {
              "label": "intToXml",
              "kind": 3
            }
          ];
        assert.deepStrictEqual(result, expected);
    });
    it("Should return a list of suggestions of built-in functions and custom functions for the prefix \"su\"", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '3.links', Position.create(7,6));
        const expected: any = [
          {
            "label": "Sum",
            "kind": 3
          },
          {
            "label": "sum_int",
            "kind": 3
          }
        ];
        assert.deepStrictEqual(result, expected);
    });
    it("Should return a list of suggestions of built-in functions, custom functions, and custom variables for the prefiex \"re\"", async () => {
        const result = await RunCodeCompletionTest(baseUri, tempFilePath, server, testOcamlClient, '4.links', Position.create(8,6));
        console.log(`result: ${JSON.stringify(result)}`);
        const expected: any = [{"label":"readFromSocket","kind":3},{"label":"receive","kind":3},{"label":"recv","kind":3},{"label":"redirect","kind":3},{"label":"registerEventHandlers","kind":3},{"label":"removeNode","kind":3},{"label":"replaceDocument","kind":3},{"label":"replaceNode","kind":3},{"label":"request","kind":3},{"label":"ready","kind":6},{"label":"readNum","kind":3}];
        assert.deepStrictEqual(result, expected);
    });
});