import path from "path";
import { LanguageServer } from "../../../src/extension";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { setupLanguageServerTests, tearDownLanguageServerTests } from "../SetupLanguageServerTests";
import { Position } from "vscode-languageserver";
import assert from "assert";
import { RunHoverTipsTest } from "./HoverTipsTestSetup";

describe("HoverTips: All tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './HoverTipTests/');
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

    it("Should return the hover tips for a function with no arguments", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '1.links', 
            Position.create(1,5)
        );
        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "```links\nfun example() {"
            },
            "range": {
              "start": {
                "line": 1,
                "character": 0
              },
              "end": {
                "line": 1,
                "character": 9
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the hover tips for a function with one argument", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '2.links', 
            Position.create(1,5)
        );
        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "```links\nfun example(one_argument) {"
            },
            "range": {
              "start": {
                "line": 1,
                "character": 0
              },
              "end": {
                "line": 1,
                "character": 10
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the hover tips for a function with many arguments", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '3.links', 
            Position.create(1,5)
        );
        const expected: any ={
            "contents": {
              "kind": "markdown",
              "value": "```links\nfun example(a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z) {"
            },
            "range": {
              "start": {
                "line": 1,
                "character": 0
              },
              "end": {
                "line": 1,
                "character": 60
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the input type as a hover tip for a built-in function", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '4.links', 
            Position.create(1,7)
        );
        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "### Built in Links function: intToXml\n**Type:** (Int) -> Xml\n```links\nfun intToXml() {\n"
            },
            "range": {
              "start": {
                "line": 1,
                "character": 0
              },
              "end": {
                "line": 1,
                "character": 11
              }
            }
          };
        
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the input type as a hover tip for another built-in function", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '5.links', 
            Position.create(1,8)
        );
        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "### Built in Links function: getAttribute\n**Type:** (Xml, String) ~> String\n```links\nfun getAttribute() {\n"
            },
            "range": {
              "start": {
                "line": 1,
                "character": 0
              },
              "end": {
                "line": 1,
                "character": 41
              }
            }
          };
        
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the input type as a hover tip when hovering over a built-in function nested inside XML", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '6.links', 
            Position.create(7,32)
        );
        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "### Built in Links function: stringToXml\n**Type:** (String) -> Xml\n```links\nfun stringToXml() {\n"
            },
            "range": {
              "start": {
                "line": 7,
                "character": 24
              },
              "end": {
                "line": 7,
                "character": 46
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the hover tips for a function when hovering over it despite being inside several nested functions", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '7.links', 
            Position.create(10,24)
        );

        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "```links\nfun example(num1, num2) {"
            },
            "range": {
              "start": {
                "line": 10,
                "character": 20
              },
              "end": {
                "line": 10,
                "character": 39
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });
    it("Should return the hover tips for a function when hovering over it despite being inside several nested XML blocks and functions", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '8.links', 
            Position.create(13,46)
        );

        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "```links\nfun createString(input) {"
            },
            "range": {
              "start": {
                "line": 13,
                "character": 36
              },
              "end": {
                "line": 13,
                "character": 57
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the hover tips for a function when hovering over it despite being inside a nested XML inside an XML attribute", async () => {
        const result = await RunHoverTipsTest(
            baseUri, 
            tempFilePath, 
            server,
            testOcamlClient, 
            '9.links', 
            Position.create(9,31)
        );

        const expected: any = {
            "contents": {
              "kind": "markdown",
              "value": "### Built in Links function: floatToString\n**Type:** (Float) -> String\n```links\nfun floatToString() {\n"
            },
            "range": {
              "start": {
                "line": 9,
                "character": 24
              },
              "end": {
                "line": 9,
                "character": 61
              }
            }
          };
        assert.deepStrictEqual(result, expected);
    });
    

    



});