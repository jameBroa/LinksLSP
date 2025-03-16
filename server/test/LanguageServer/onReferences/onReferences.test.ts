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

    it("Should return the references of a variable inside a function if the variable is used in SEVERAL nested functions", async () => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '8.links', Position.create(2, 8));
      let expectedUri = path.join(baseUri, '8.links');
      const expected: any = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 13,
              "character": 44
            },
            "end": {
              "line": 13,
              "character": 48
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 15,
              "character": 93
            },
            "end": {
              "line": 15,
              "character": 97
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 17,
              "character": 84
            },
            "end": {
              "line": 17,
              "character": 88
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 19,
              "character": 75
            },
            "end": {
              "line": 19,
              "character": 79
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 25,
              "character": 48
            },
            "end": {
              "line": 25,
              "character": 52
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 2,
              "character": 8
            },
            "end": {
              "line": 2,
              "character": 12
            }
          }
        }
      ];
      assert.deepStrictEqual(result, expected);
    });

    it("Should return the references of a variable defined and used within list comprehension", async () => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '9.links', Position.create(3, 8));
      let expectedUri = path.join(baseUri, '9.links');
      const expected: any = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 3,
              "character": 21
            },
            "end": {
              "line": 3,
              "character": 22
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
              "line": 3,
              "character": 9
            }
          }
        }
      ];
      assert.deepStrictEqual(result, expected);
    });

    it("Should return the references of a variable used within XML", async () => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '10.links', Position.create(1, 9));
      let expectedUri = path.join(baseUri, '10.links');
      const expected: any = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 11,
              "character": 36
            },
            "end": {
              "line": 11,
              "character": 40
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 1,
              "character": 8
            },
            "end": {
              "line": 1,
              "character": 12
            }
          }
        }
      ];
      assert.deepStrictEqual(result, expected);
    });
    it("Should return the references of a variable used and declared within a switch statement with a Variant", async () => {
      const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '11.links', Position.create(8, 21));
      let expectedUri = path.join(baseUri, '11.links');
      const expected: any = [
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 9,
              "character": 20
            },
            "end": {
              "line": 9,
              "character": 23
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 9,
              "character": 37
            },
            "end": {
              "line": 9,
              "character": 40
            }
          }
        },
        {
          "uri": expectedUri,
          "range": {
            "start": {
              "line": 8,
              "character": 20
            },
            "end": {
              "line": 8,
              "character": 23
            }
          }
        }
      ];
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
  it("Should return multiple references to a function called multiple times inside nested XML blocks", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '12.links', Position.create(0, 6));
    let expectedUri = path.join(baseUri, '12.links');
    const expected:any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 8,
            "character": 9
          },
          "end": {
            "line": 8,
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 9,
            "character": 9
          },
          "end": {
            "line": 9,
            "character": 18
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
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 11,
            "character": 9
          },
          "end": {
            "line": 11,
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 12,
            "character": 9
          },
          "end": {
            "line": 12,
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 13,
            "character": 9
          },
          "end": {
            "line": 13,
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 14,
            "character": 9
          },
          "end": {
            "line": 14,
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 15,
            "character": 9
          },
          "end": {
            "line": 15,
            "character": 18
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 16,
            "character": 9
          },
          "end": {
            "line": 16,
            "character": 18
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
    ];
    assert.deepStrictEqual(result, expected);
  });

  it("Should return multiple references to a function called multiple times inside nested XML block in an attribute", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '13.links', Position.create(0, 6));
    let expectedUri = path.join(baseUri, '13.links');
    const expected: any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 7,
            "character": 12
          },
          "end": {
            "line": 7,
            "character": 21
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
            "character": 21
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 9,
            "character": 12
          },
          "end": {
            "line": 9,
            "character": 21
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
            "character": 21
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 11,
            "character": 12
          },
          "end": {
            "line": 11,
            "character": 21
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
            "character": 21
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 13,
            "character": 12
          },
          "end": {
            "line": 13,
            "character": 21
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
            "character": 21
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 15,
            "character": 12
          },
          "end": {
            "line": 15,
            "character": 21
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 16,
            "character": 12
          },
          "end": {
            "line": 16,
            "character": 21
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 17,
            "character": 12
          },
          "end": {
            "line": 17,
            "character": 21
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
    ];
    assert.deepStrictEqual(result, expected);
  });
  it("Should return the reference to a function if called inside a list comprehension", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '14.links', Position.create(1, 5));
    let expectedUri = path.join(baseUri, '14.links');
    const expected: any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 7,
            "character": 18
          },
          "end": {
            "line": 7,
            "character": 32
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 1,
            "character": 0
          },
          "end": {
            "line": 3,
            "character": 1
          }
        }
      }
    ];
    assert.deepStrictEqual(result, expected);
  });

  it("Should return the references to a function if called inside a switch statement with a Variant", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '11.links', Position.create(1, 8));
    let expectedUri = path.join(baseUri, '11.links');
    const expected: any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 7,
            "character": 27
          },
          "end": {
            "line": 7,
            "character": 39
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 9,
            "character": 10
          },
          "end": {
            "line": 9,
            "character": 24
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 9,
            "character": 27
          },
          "end": {
            "line": 9,
            "character": 41
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 1,
            "character": 0
          },
          "end": {
            "line": 3,
            "character": 1
          }
        }
      }
    ];
    assert.deepStrictEqual(result, expected);
  });
  it("Should return refernces to a function called in pattern matching", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '15.links', Position.create(1, 9));
    let expectedUri = path.join(baseUri, '15.links');
    const expected: any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 7,
            "character": 22
          },
          "end": {
            "line": 7,
            "character": 34
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 8,
            "character": 19
          },
          "end": {
            "line": 8,
            "character": 31
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 1,
            "character": 0
          },
          "end": {
            "line": 3,
            "character": 1
          }
        }
      }
    ];
    assert.deepStrictEqual(result, expected);
  });

  it("Should return references to a recursive functions", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '16.links', Position.create(0,10));
    let expectedUri = path.join(baseUri, '16.links');
    const expected: any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 1,
            "character": 7
          },
          "end": {
            "line": 1,
            "character": 8
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 2,
            "character": 8
          },
          "end": {
            "line": 2,
            "character": 9
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 4,
            "character": 18
          },
          "end": {
            "line": 4,
            "character": 19
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 4,
            "character": 35
          },
          "end": {
            "line": 4,
            "character": 36
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 0,
            "character": 14
          },
          "end": {
            "line": 0,
            "character": 15
          }
        }
      }
    ];
    assert.deepStrictEqual(result, expected);
  });
  it("Should return the references to a function defined and called within a mutual block", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '17.links', Position.create(2,10));
    let expectedUri = path.join(baseUri, '17.links');
    const expected :any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 6,
            "character": 8
          },
          "end": {
            "line": 6,
            "character": 11
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 9,
            "character": 8
          },
          "end": {
            "line": 9,
            "character": 11
          }
        }
      },
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 12,
            "character": 8
          },
          "end": {
            "line": 12,
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
    ];
    assert.deepStrictEqual(expected, result);
  });
  it("Should return the same location for references called on an undefined function", async () => {
    const result = await RunOnReferencesTest(baseUri, tempFilePath, server, testOcamlClient, '18.links', Position.create(1,6));
    let expectedUri = path.join(baseUri, '18.links');
    const expected: any = [
      {
        "uri": expectedUri,
        "range": {
          "start": {
            "line": 1,
            "character": 4
          },
          "end": {
            "line": 1,
            "character": 8
          }
        }
      }
    ];
    assert.deepStrictEqual(result, expected);
  });


});