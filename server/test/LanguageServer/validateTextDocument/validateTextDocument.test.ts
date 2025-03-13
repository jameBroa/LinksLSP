import * as assert from 'assert';
import {Diagnostic, Position, Range} from 'vscode-languageserver';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import path from 'path';

import { window } from 'vscode';
import { LanguageServer } from '../../../src/extension';
import { OCamlClient } from '../../../src/common/ocaml/ocamlclient';
import { AST } from '../../../src/common/ast/ast';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { inRange } from 'lodash';

describe("validateTextDocument: Undefined variable tests", ()=> {
  let server: LanguageServer;
  let baseUri = path.resolve(__dirname, './validateTextDocumentTests/undefinedVariables/');
  let testOcamlClient: OCamlClient;
  let tempFilePath: string;
  beforeEach(async ()  => {
      server = new LanguageServer();
      testOcamlClient = new OCamlClient("");
      server.start();
      tempFilePath = path.join(__dirname, 'temporary.links');

  });

  afterEach(async() => {
      try {
          await fs.unlink(tempFilePath);
          sinon.restore();
      } catch (error: any) {
          console.error(`Error deleting temporary file: ${error.message}`);
          
      }
      server.connection.dispose();
  });

  it("Should throw an 'undefined variable' diagnostic if a variable is only defined in a nested function",  async() => {
      const fileUri = path.join(baseUri, '1.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      
      let expected = [
          {
            "severity": 1,
            "range": {
              "start": {
                "line": 6,
                "character": 4
              },
              "end": {
                "line": 6,
                "character": 5
              }
            },
            "message": "Variable x is not defined",
            "source": "LinksLSP",
          }
      ] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should throw an 'undefined variable' diagnostic if one or more variables are not defined in a function", async() => {
      const fileUri = path.join(baseUri, '2.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      
      let expected = [
      {
        "severity": 1,
        "range": {
          "start": {
            "line": 2,
            "character": 14
          },
          "end": {
            "line": 2,
            "character": 15
          }
        },
        "message": "Variable j is not defined",
        "source": "LinksLSP",
      },
      {
        "severity": 1,
        "range": {
          "start": {
            "line": 4,
            "character": 10
          },
          "end": {
            "line": 4,
            "character": 11
          }
        },
        "message": "Variable a is not defined",
        "source": "LinksLSP",
      }
    ] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should throw an 'undefined variable' diagnostic if a variable is not defined for a list comprehension", async () => {
      const fileUri = path.join(baseUri, '3.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      
      let expected = [
          {
            "severity": 1,
            "range": {
              "start": {
                "line": 3,
                "character": 28
              },
              "end": {
                "line": 3,
                "character": 29
              }
            },
            "message": "Variable a is not defined",
            "source": "LinksLSP",
          }
      ]as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should throw an 'undefined variable' diagnostic if a variable is defined for a list comprehension but not accessed inside it", async () => {
      const fileUri = path.join(baseUri, '4.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      
      let expected = [
          {
            "severity": 1,
            "range": {
              "start": {
                "line": 4,
                "character": 6
              },
              "end": {
                "line": 4,
                "character": 7
              }
            },
            "message": "Variable y is not defined",
            "source": "LinksLSP"
          }
        ] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

});

describe("validateTextDocument: Multiple variable definitions tests", ()=> {
  let server: LanguageServer;
  let baseUri = path.resolve(__dirname, './validateTextDocumentTests/multipleDefinedVariables/');
  let testOcamlClient: OCamlClient;
  let tempFilePath: string;
  beforeEach(async ()  => {
    server = new LanguageServer();
    testOcamlClient = new OCamlClient("");
    server.start();
    tempFilePath = path.join(__dirname, 'temporary.links');

  });

  afterEach(async() => {
      try {
          await fs.unlink(tempFilePath);
          sinon.restore();
      } catch (error: any) {
          console.error(`Error deleting temporary file: ${error.message}`);
          
      }
      server.connection.dispose();
  });

  it("Should throw a 'variable is defined many times' diagnostic if a variable is defined twice in a function",  async() => {
      const fileUri = path.join(baseUri, '1.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [
          {
            "severity": 1,
            "range": {
              "start": {
                "line": 2,
                "character": 8
              },
              "end": {
                "line": 2,
                "character": 9
              }
            },
            "message": "Variable x is defined multiple times",
            "source": "LinksLSP"
          },
          {
            "severity": 1,
            "range": {
              "start": {
                "line": 3,
                "character": 8
              },
              "end": {
                "line": 3,
                "character": 9
              }
            },
            "message": "Variable x is defined multiple times",
            "source": "LinksLSP"
          }
        ] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });
});

describe("validateTextDocument: Undefined functions tests", ()=> {
  let server: LanguageServer;
  let baseUri = path.resolve(__dirname, './validateTextDocumentTests/undefinedFunctions/');
  let testOcamlClient: OCamlClient;
  let tempFilePath: string;
  beforeEach(async ()  => {
    server = new LanguageServer();
    testOcamlClient = new OCamlClient("");
    server.start();
    tempFilePath = path.join(__dirname, 'temporary.links');
  });

  afterEach(async() => {
      try {
          await fs.unlink(tempFilePath);
          sinon.restore();
      } catch (error: any) {
          console.error(`Error deleting temporary file: ${error.message}`);
          
      }
      server.connection.dispose();
  });


  it("Should throw a 'function is undefined' diagnostic if a function which isn't defined is called",  async() => {
      const fileUri = path.join(baseUri, '1.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [
        {
          "severity": 1,
          "range": {
            "start": {
              "line": 2,
              "character": 6
            },
            "end": {
              "line": 2,
              "character": 11
            }
          },
          "message": "Function bar is not defined",
          "source": "LinksLSP"
        }
      ]  as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should throw a 'function is undefined' diagnostic if a nested function is called out of scope",  async() => {
    const fileUri = path.join(baseUri, '2.links');
    const fileContent = await fs.readFile(fileUri, 'utf8');
    let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
    await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
    
    sinon.stub(server, 'getAST').returns(
        Promise.resolve((
            AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
        ))
    );

    let params = TextDocument.create(
      fileUri.toString(),
        "links",
        1,
        newDocumentText
    );

    const result = await server.validateTextDocument(params);

    let expected = [
      {
        "severity": 1,
        "range": {
          "start": {
            "line": 12,
            "character": 0
          },
          "end": {
            "line": 12,
            "character": 7
          }
        },
        "message": "Function inner is not defined",
        "source": "LinksLSP"
      }
    ]  as Diagnostic[];

    assert.deepStrictEqual(result, expected);
  });

  it("Should throw a 'function is undefined' diagnostic if a function is called before it is defined",  async() => {
    const fileUri = path.join(baseUri, '3.links');
    const fileContent = await fs.readFile(fileUri, 'utf8');
    let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
    await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
    
    sinon.stub(server, 'getAST').returns(
        Promise.resolve((
            AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
        ))
    );

    let params = TextDocument.create(
      fileUri.toString(),
        "links",
        1,
        newDocumentText
    );

    const result = await server.validateTextDocument(params);

    let expected = [
    {
      "severity": 1,
      "range": {
        "start": {
          "line": 5,
          "character": 10
        },
        "end": {
          "line": 5,
          "character": 16
        }
      },
      "message": "Function test is not defined",
      "source": "LinksLSP"
    }
  ]  as Diagnostic[];

    assert.deepStrictEqual(result, expected);
  });
  it("Should NOT throw a 'function is undefined' diagnostic on recursive functions",  async() => {
      const fileUri = path.join(baseUri, '4.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });
});

describe("validateTextDocument: Function calls and parameters tests", () => {
  let server: LanguageServer;
  let baseUri = path.resolve(__dirname, './validateTextDocumentTests/numParameters/');
  let testOcamlClient: OCamlClient;
  let tempFilePath: string;
  beforeEach(async ()  => {
    server = new LanguageServer();
    testOcamlClient = new OCamlClient("");
    server.start();
    tempFilePath = path.join(__dirname, 'temporary.links');

  });

  afterEach(async() => {
    try {
        await fs.unlink(tempFilePath);
        sinon.restore();
    } catch (error: any) {
        console.error(`Error deleting temporary file: ${error.message}`);
        
    }
    server.connection.dispose();
  });

  after(async () => {
    server.connection.dispose();
  });

  it("Should throw a 'function call with wrong number of arguments' diagnostic if a function with 3 arguments is called with 2", async () => {
    const fileUri = path.join(baseUri, '1.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [
        {
          "severity": 1,
          "range": {
            "start": {
              "line": 6,
              "character": 4
            },
            "end": {
              "line": 6,
              "character": 12
            }
          },
          "message": "Incorrect number of arguments.",
          "source": "LinksLSP"
        }
      ] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should throw a 'function call with wrong number of arguments' diagnostic if a function with 2 arguments is called with 1", async () => {
    const fileUri = path.join(baseUri, '2.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [
        {
          "severity": 1,
          "range": {
            "start": {
              "line": 6,
              "character": 4
            },
            "end": {
              "line": 6,
              "character": 10
            }
          },
          "message": "Incorrect number of arguments.",
          "source": "LinksLSP"
        }
      ] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should NOT throw a 'function call with wrong number of arguments' diagnostic if a function with 2 arguments is called with 2", async () => {
    const fileUri = path.join(baseUri, '3.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });

  it("Should NOT throw a 'function call with wrong number of arguments' diagnostic if a function with 0 arguments is called with 0 args", async () => {
    const fileUri = path.join(baseUri, '4.links');
      const fileContent = await fs.readFile(fileUri, 'utf8');
      let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
      await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
      sinon.stub(server, 'getAST').returns(
          Promise.resolve((
              AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
          ))
      );

      let params = TextDocument.create(
        fileUri.toString(),
          "links",
          1,
          newDocumentText
      );

      const result = await server.validateTextDocument(params);

      let expected = [] as Diagnostic[];

      assert.deepStrictEqual(result, expected);
  });
});

// describe("validateTextDocument: Uninitialized variables tests", () => {
//   let server: LanguageServer;
//   let baseUri = path.resolve(__dirname, './validateTextDocumentTests/uninitializedVariables/');
//   let testOcamlClient: OCamlClient;
//   let tempFilePath: string;
//   beforeEach(async ()  => {
//     server = new LanguageServer();
//     testOcamlClient = new OCamlClient();
//     server.start();
//     tempFilePath = path.join(__dirname, 'temporary.links');

//   });

//   afterEach(async() => {
//     try {
//         await fs.unlink(tempFilePath);
//         sinon.restore();
//     } catch (error: any) {
//         console.error(`Error deleting temporary file: ${error.message}`);
        
//     }
//     server.connection.dispose();
//   });

//   after(async () => {
//     server.connection.dispose();
//   });

//   it("Should throw an 'uninitialized variable' diagnostic if a variable is referenced but not yet initialized", async () => {
//     const fileUri = path.join(baseUri, '1.links');
//       const fileContent = await fs.readFile(fileUri, 'utf8');
//       let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
//       await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
//       sinon.stub(server, 'getAST').returns(
//           Promise.resolve((
//               AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
//           ))
//       );

//       let params = TextDocument.create(
//         fileUri.toString(),
//           "links",
//           1,
//           newDocumentText
//       );

//       const result = await server.validateTextDocument(params);

//       let expected = [
//         {
//           "severity": 1,
//           "range": {
//             "start": {
//               "line": 2,
//               "character": 14
//             },
//             "end": {
//               "line": 2,
//               "character": 15
//             }
//           },
//           "message": "Variable x is used before being initialized.",
//           "source": "LinksLSP"
//         }
//       ] as Diagnostic[];

//       assert.deepStrictEqual(result, expected);

//   });

//   it("Should throw an 'uninitialized variable' diagnostic if multiple variables are referenced but not yet initialized", async () => {
//     const fileUri = path.join(baseUri, '2.links');
//       const fileContent = await fs.readFile(fileUri, 'utf8');
//       let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
//       await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
//       sinon.stub(server, 'getAST').returns(
//           Promise.resolve((
//               AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
//           ))
//       );

//       let params = TextDocument.create(
//         fileUri.toString(),
//           "links",
//           1,
//           newDocumentText
//       );

//       const result = await server.validateTextDocument(params);

//       let expected = [
//         {
//           "severity": 1,
//           "range": {
//             "start": {
//               "line": 1,
//               "character": 16
//             },
//             "end": {
//               "line": 1,
//               "character": 17
//             }
//           },
//           "message": "Variable x is used before being initialized.",
//           "source": "LinksLSP"
//         },
//         {
//           "severity": 1,
//           "range": {
//             "start": {
//               "line": 1,
//               "character": 20
//             },
//             "end": {
//               "line": 1,
//               "character": 21
//             }
//           },
//           "message": "Variable y is used before being initialized.",
//           "source": "LinksLSP"
//         }
//       ] as Diagnostic[];

//       assert.deepStrictEqual(result, expected);
//   });

//   it("Should NOT throw an 'uninitialized variable' diagnostic if a variable is initialized before being referenced", async () => {
//     const fileUri = path.join(baseUri, '3.links');
//       const fileContent = await fs.readFile(fileUri, 'utf8');
//       let newDocumentText = `fun dummy_wrapper(){\n${fileContent}\n}`;
//       await fs.writeFile(tempFilePath, newDocumentText, 'utf8');
      
//       sinon.stub(server, 'getAST').returns(
//           Promise.resolve((
//               AST.fromJSON(await testOcamlClient.get_AST_as_JSON(`${tempFilePath}\n`), "")
//           ))
//       );

//       let params = TextDocument.create(
//         fileUri.toString(),
//           "links",
//           1,
//           newDocumentText
//       );

//       const result = await server.validateTextDocument(params);

//       let expected = [] as Diagnostic[];

//       assert.deepStrictEqual(result, expected);
//   });

// });