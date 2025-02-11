import * as assert from 'assert';
import {Diagnostic, Location, Position, Range, ReferenceParams} from 'vscode-languageserver';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import path from 'path';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { AST } from '../../../src/common/ast/ast';
import { LanguageServer } from '../../../src/extension';
import { OCamlClient } from '../../../src/common/ocaml/ocamlclient';
import { setupLanguageServerTests, tearDownLanguageServerTests } from '../SetupLanguageServerTests';
import { RunOnReferencesTest } from './OnReferencesTestSetup';
import exp from 'constants';

describe("onReferences: variable references", () => {
  let server: LanguageServer;
  let baseUri = path.resolve(__dirname, './onReferencesTests/');
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


    it("Should return the references of a parameter variable inside a function if the parameter variable is one char long", async () => {
        const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '1.links', Position.create(1, 13));
        let expectedUri = path.join(baseUri, '1.links');
        const expected = [
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 3,
                "character": 14
              },
              "end": {
                "line": 3,
                "character": 15
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 5,
                "character": 20
              },
              "end": {
                "line": 5,
                "character": 21
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 1,
                "character": 12
              },
              "end": {
                "line": 1,
                "character": 13
              }
            }
          }
        ] as Location[];
        assert.deepEqual(result, expected);
    });

    it("Should return the references of a parameter variable inside a function if the parameter variable is more than one char long", async () => {
        const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '1.links', Position.create(10, 12));
        let expectedUri = path.join(baseUri, '1.links');
        
        const expected = [
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 11,
                "character": 12
              },
              "end": {
                "line": 11,
                "character": 17
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 11,
                "character": 18
              },
              "end": {
                "line": 11,
                "character": 23
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 12,
                "character": 12
              },
              "end": {
                "line": 12,
                "character": 17
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 12,
                "character": 18
              },
              "end": {
                "line": 12,
                "character": 23
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 13,
                "character": 4
              },
              "end": {
                "line": 13,
                "character": 9
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 13,
                "character": 11
              },
              "end": {
                "line": 13,
                "character": 16
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 13,
                "character": 20
              },
              "end": {
                "line": 13,
                "character": 25
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 10,
                "character": 9
              },
              "end": {
                "line": 10,
                "character": 14
              }
            }
          }
        ] as Location[];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the reference of the same variable if a parameter variable is unused in a function", async() => {
        const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '2.links', Position.create(1, 15));
        let expectedUri = path.join(baseUri, '2.links');
        const expected = [
            {
              "uri": expectedUri,
              "range": {
                "start": {
                  "line": 1,
                  "character": 14
                },
                "end": {
                  "line": 1,
                  "character": 15
                }
              }
            }
          ] as Location[];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return the references of a parameter variable inside a function if the parameter variable is used in a nested function", async() => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '6.links', Position.create(1, 15));
        let expectedUri = path.join(baseUri, '6.links');
        const expected = [
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 6,
                "character": 20
              },
              "end": {
                "line": 6,
                "character": 21
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 8,
                "character": 42
              },
              "end": {
                "line": 8,
                "character": 43
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 10,
                "character": 32
              },
              "end": {
                "line": 10,
                "character": 33
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 12,
                "character": 22
              },
              "end": {
                "line": 12,
                "character": 23
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 14,
                "character": 12
              },
              "end": {
                "line": 14,
                "character": 13
              }
            }
          },
          {
            "uri": expectedUri,
            "range": {
              "start": {
                "line": 1,
                "character": 12
              },
              "end": {
                "line": 1,
                "character": 13
              }
            }
          }
        ] as Location[];
        assert.deepStrictEqual(result, expected);
    });

});

describe("onReferences: function references", () => {
  let server: LanguageServer;
  let baseUri = path.resolve(__dirname, './onReferencesTests/');
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

  it("Should return multiple references to a function if called multiple times ", async () => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '3.links', Position.create(0, 6));
      let expectedUri = path.join(baseUri, '3.links');
      const expected = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 5,
              "character": 12
            },
            "end": {
              "line": 5,
              "character": 19
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 10,
              "character": 12
            },
            "end": {
              "line": 10,
              "character": 19
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 77,
              "character": 12
            },
            "end": {
              "line": 77,
              "character": 19
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 0,
              "character": 0
            },
            "end": {
              "line": 2,
              "character": 1
            }
          }
        }
      ]as Location[];
      assert.deepStrictEqual(result, expected);
  });

  it("Should only return the reference of a function within its callable scope", async () => {{
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '4.links', Position.create(2, 10));
      let expectedUri = path.join(baseUri, '4.links');
      const expected = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 5,
              "character": 4
            },
            "end": {
              "line": 5,
              "character": 11
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 2,
              "character": 4
            },
            "end": {
              "line": 4,
              "character": 5
            }
          }
        }
      ] as Location[];
      assert.deepStrictEqual(result, expected);
  }});

  it("Should return the reference of a nested function only within its scope and not outside", async () => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '5.links', Position.create(3, 17));
      let expectedUri = path.join(baseUri, '5.links');
      const expected = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 6,
              "character": 20
            },
            "end": {
              "line": 6,
              "character": 33
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 8,
              "character": 12
            },
            "end": {
              "line": 8,
              "character": 25
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 3,
              "character": 8
            },
            "end": {
              "line": 5,
              "character": 9
            }
          }
        }
      ] as Location[];
      assert.deepStrictEqual(result, expected);
  });
  it("Should not return reference a function if it is outside its scope", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '7.links', Position.create(3, 13));
    let expectedUri = path.join(baseUri, '7.links');
    const expected = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 7,
            "character": 12
          },
          "end": {
            "line": 7,
            "character": 17
          }
        }
      },
      {
        "uri":expectedUri,
        "range": {
          "start": {
            "line": 3,
            "character": 8
          },
          "end": {
            "line": 5,
            "character": 9
          }
        }
      }
    ] as Location[];
    assert.deepStrictEqual(result, expected);
});
});