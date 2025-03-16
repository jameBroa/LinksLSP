import path from "path";
import { LanguageServer } from "../../../src/extension";
import { OCamlClient } from "../../../src/common/ocaml/ocamlclient";
import { setupLanguageServerTests, tearDownLanguageServerTests } from "../SetupLanguageServerTests";
import { RunDocumentSymbolsTest } from "./DocumentSymbolsTestSetup";
import * as assert from 'assert';

describe("DocumentSymbols: All tests", () => {
    let server: LanguageServer;
    let baseUri = path.resolve(__dirname, './DocumentSymbolsTests/');
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

    it("Should return document symbols for three variables at root from a file with three variables", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '1.links');
        const expected: any = [
            {
              "name": "x",
              "kind": 13,
              "range": {
                "start": {
                  "line": 0,
                  "character": 4
                },
                "end": {
                  "line": 0,
                  "character": 5
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 4
                },
                "end": {
                  "line": 0,
                  "character": 5
                }
              }
            },
            {
              "name": "y",
              "kind": 13,
              "range": {
                "start": {
                  "line": 1,
                  "character": 4
                },
                "end": {
                  "line": 1,
                  "character": 5
                }
              },
              "selectionRange": {
                "start": {
                  "line": 1,
                  "character": 4
                },
                "end": {
                  "line": 1,
                  "character": 5
                }
              }
            },
            {
              "name": "z",
              "kind": 13,
              "range": {
                "start": {
                  "line": 2,
                  "character": 4
                },
                "end": {
                  "line": 2,
                  "character": 5
                }
              },
              "selectionRange": {
                "start": {
                  "line": 2,
                  "character": 4
                },
                "end": {
                  "line": 2,
                  "character": 5
                }
              }
            }
          ];
        assert.deepStrictEqual(result, expected);
    });
    it("Should return document symbols of a file with variables inside one function", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '2.links');
        const expected: any = [
            {
              "name": "test",
              "kind": 12,
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 5,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 5,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 1,
                      "character": 8
                    },
                    "end": {
                      "line": 1,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 1,
                      "character": 8
                    },
                    "end": {
                      "line": 1,
                      "character": 9
                    }
                  }
                },
                {
                  "name": "y",
                  "kind": 13,
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
                  "selectionRange": {
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
                  "name": "z",
                  "kind": 13,
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
                  "selectionRange": {
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
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    });
    it("Should return different document symbols for a file with two variables of the same name in different scopes", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '3.links');
        const expected: any = [
            {
              "name": "firstScope",
              "kind": 12,
              "range": {
                "start": {
                  "line": 2,
                  "character": 0
                },
                "end": {
                  "line": 5,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 2,
                  "character": 0
                },
                "end": {
                  "line": 5,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
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
                  "selectionRange": {
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
              ]
            },
            {
              "name": "secondScope",
              "kind": 12,
              "range": {
                "start": {
                  "line": 7,
                  "character": 0
                },
                "end": {
                  "line": 10,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 7,
                  "character": 0
                },
                "end": {
                  "line": 10,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 8,
                      "character": 8
                    },
                    "end": {
                      "line": 8,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 8,
                      "character": 8
                    },
                    "end": {
                      "line": 8,
                      "character": 9
                    }
                  }
                }
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    });
    it("Should return different document symbols for functions with nested functions of the same name in a different scope", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '4.links');
        const expected: any = [
            {
              "name": "outter",
              "kind": 12,
              "range": {
                "start": {
                  "line": 3,
                  "character": 0
                },
                "end": {
                  "line": 14,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 3,
                  "character": 0
                },
                "end": {
                  "line": 14,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 4,
                      "character": 8
                    },
                    "end": {
                      "line": 4,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 4,
                      "character": 8
                    },
                    "end": {
                      "line": 4,
                      "character": 9
                    }
                  }
                },
                {
                  "name": "inner",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 5,
                      "character": 4
                    },
                    "end": {
                      "line": 12,
                      "character": 5
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 5,
                      "character": 4
                    },
                    "end": {
                      "line": 12,
                      "character": 5
                    }
                  },
                  "children": [
                    {
                      "name": "y",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 6,
                          "character": 12
                        },
                        "end": {
                          "line": 6,
                          "character": 13
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 6,
                          "character": 12
                        },
                        "end": {
                          "line": 6,
                          "character": 13
                        }
                      }
                    },
                    {
                      "name": "inner_inner",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 7,
                          "character": 8
                        },
                        "end": {
                          "line": 10,
                          "character": 9
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 7,
                          "character": 8
                        },
                        "end": {
                          "line": 10,
                          "character": 9
                        }
                      },
                      "children": [
                        {
                          "name": "z",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 8,
                              "character": 16
                            },
                            "end": {
                              "line": 8,
                              "character": 17
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 8,
                              "character": 16
                            },
                            "end": {
                              "line": 8,
                              "character": 17
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "name": "test",
              "kind": 12,
              "range": {
                "start": {
                  "line": 16,
                  "character": 0
                },
                "end": {
                  "line": 27,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 16,
                  "character": 0
                },
                "end": {
                  "line": 27,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 17,
                      "character": 8
                    },
                    "end": {
                      "line": 17,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 17,
                      "character": 8
                    },
                    "end": {
                      "line": 17,
                      "character": 9
                    }
                  }
                },
                {
                  "name": "something",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 18,
                      "character": 4
                    },
                    "end": {
                      "line": 25,
                      "character": 5
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 18,
                      "character": 4
                    },
                    "end": {
                      "line": 25,
                      "character": 5
                    }
                  },
                  "children": [
                    {
                      "name": "y",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 19,
                          "character": 12
                        },
                        "end": {
                          "line": 19,
                          "character": 13
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 19,
                          "character": 12
                        },
                        "end": {
                          "line": 19,
                          "character": 13
                        }
                      }
                    },
                    {
                      "name": "new",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 20,
                          "character": 8
                        },
                        "end": {
                          "line": 23,
                          "character": 9
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 20,
                          "character": 8
                        },
                        "end": {
                          "line": 23,
                          "character": 9
                        }
                      },
                      "children": [
                        {
                          "name": "z",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 21,
                              "character": 16
                            },
                            "end": {
                              "line": 21,
                              "character": 17
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 21,
                              "character": 16
                            },
                            "end": {
                              "line": 21,
                              "character": 17
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "name": "test_two",
              "kind": 12,
              "range": {
                "start": {
                  "line": 29,
                  "character": 0
                },
                "end": {
                  "line": 38,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 29,
                  "character": 0
                },
                "end": {
                  "line": 38,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "something",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 30,
                      "character": 4
                    },
                    "end": {
                      "line": 33,
                      "character": 5
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 30,
                      "character": 4
                    },
                    "end": {
                      "line": 33,
                      "character": 5
                    }
                  },
                  "children": [
                    {
                      "name": "temp",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 31,
                          "character": 12
                        },
                        "end": {
                          "line": 31,
                          "character": 16
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 31,
                          "character": 12
                        },
                        "end": {
                          "line": 31,
                          "character": 16
                        }
                      }
                    }
                  ]
                },
                {
                  "name": "banana",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 34,
                      "character": 4
                    },
                    "end": {
                      "line": 36,
                      "character": 5
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 34,
                      "character": 4
                    },
                    "end": {
                      "line": 36,
                      "character": 5
                    }
                  },
                  "children": []
                }
              ]
            },
            {
              "name": "apple",
              "kind": 13,
              "range": {
                "start": {
                  "line": 1,
                  "character": 4
                },
                "end": {
                  "line": 1,
                  "character": 9
                }
              },
              "selectionRange": {
                "start": {
                  "line": 1,
                  "character": 4
                },
                "end": {
                  "line": 1,
                  "character": 9
                }
              }
            },
            {
              "name": "pear",
              "kind": 13,
              "range": {
                "start": {
                  "line": 39,
                  "character": 4
                },
                "end": {
                  "line": 39,
                  "character": 8
                }
              },
              "selectionRange": {
                "start": {
                  "line": 39,
                  "character": 4
                },
                "end": {
                  "line": 39,
                  "character": 8
                }
              }
            }
          ];
        assert.deepStrictEqual(result, expected);
    });
    it("Should return different document symbols for variables in an outter scope", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '5.links');
        const expected:any = [
            {
              "name": "test",
              "kind": 12,
              "range": {
                "start": {
                  "line": 2,
                  "character": 0
                },
                "end": {
                  "line": 5,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 2,
                  "character": 0
                },
                "end": {
                  "line": 5,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 3,
                      "character": 6
                    },
                    "end": {
                      "line": 3,
                      "character": 7
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 3,
                      "character": 6
                    },
                    "end": {
                      "line": 3,
                      "character": 7
                    }
                  }
                }
              ]
            },
            {
              "name": "x",
              "kind": 13,
              "range": {
                "start": {
                  "line": 1,
                  "character": 4
                },
                "end": {
                  "line": 1,
                  "character": 5
                }
              },
              "selectionRange": {
                "start": {
                  "line": 1,
                  "character": 4
                },
                "end": {
                  "line": 1,
                  "character": 5
                }
              }
            }
          ];
        assert.deepStrictEqual(result, expected);
    });


    it("Should return document symbols of variables defined as parameters in a function", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '6.links');
        const expected: any = [
            {
              "name": "withArgs",
              "kind": 12,
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 2,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 2,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 0,
                      "character": 13
                    },
                    "end": {
                      "line": 0,
                      "character": 14
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 0,
                      "character": 13
                    },
                    "end": {
                      "line": 0,
                      "character": 14
                    }
                  }
                },
                {
                  "name": "y",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 0,
                      "character": 16
                    },
                    "end": {
                      "line": 0,
                      "character": 17
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 0,
                      "character": 16
                    },
                    "end": {
                      "line": 0,
                      "character": 17
                    }
                  }
                },
                {
                  "name": "z",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 0,
                      "character": 19
                    },
                    "end": {
                      "line": 0,
                      "character": 20
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 0,
                      "character": 19
                    },
                    "end": {
                      "line": 0,
                      "character": 20
                    }
                  }
                }
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return document symbols of variables and functions defined in XML", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '7.links');
        const expected: any = [
            {
              "name": "test",
              "kind": 12,
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 15,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 15,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "height_in_cm",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 6,
                      "character": 20
                    },
                    "end": {
                      "line": 6,
                      "character": 32
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 6,
                      "character": 20
                    },
                    "end": {
                      "line": 6,
                      "character": 32
                    }
                  }
                },
                {
                  "name": "convert_to_inches",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 7,
                      "character": 16
                    },
                    "end": {
                      "line": 9,
                      "character": 17
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 7,
                      "character": 16
                    },
                    "end": {
                      "line": 9,
                      "character": 17
                    }
                  },
                  "children": [
                    {
                      "name": "input_height",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 7,
                          "character": 38
                        },
                        "end": {
                          "line": 7,
                          "character": 50
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 7,
                          "character": 38
                        },
                        "end": {
                          "line": 7,
                          "character": 50
                        }
                      }
                    }
                  ]
                }
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return document symbols of variables and functions defined in XML with nested functions", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '8.links');
        const expected: any = [
            {
              "name": "test",
              "kind": 12,
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 18,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 18,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "height_in_cm",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 6,
                      "character": 20
                    },
                    "end": {
                      "line": 6,
                      "character": 32
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 6,
                      "character": 20
                    },
                    "end": {
                      "line": 6,
                      "character": 32
                    }
                  }
                },
                {
                  "name": "convert_to_inches",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 7,
                      "character": 16
                    },
                    "end": {
                      "line": 12,
                      "character": 17
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 7,
                      "character": 16
                    },
                    "end": {
                      "line": 12,
                      "character": 17
                    }
                  },
                  "children": [
                    {
                      "name": "input_height",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 7,
                          "character": 38
                        },
                        "end": {
                          "line": 7,
                          "character": 50
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 7,
                          "character": 38
                        },
                        "end": {
                          "line": 7,
                          "character": 50
                        }
                      }
                    },
                    {
                      "name": "convert_result_to_XML",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 8,
                          "character": 20
                        },
                        "end": {
                          "line": 10,
                          "character": 21
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 8,
                          "character": 20
                        },
                        "end": {
                          "line": 10,
                          "character": 21
                        }
                      },
                      "children": [
                        {
                          "name": "input_height_in_inches",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 8,
                              "character": 46
                            },
                            "end": {
                              "line": 8,
                              "character": 68
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 8,
                              "character": 46
                            },
                            "end": {
                              "line": 8,
                              "character": 68
                            }
                          }
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    it("Should return document symbols of variables and functions if we have many functions in a file", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '9.links');
        const expected: any = [
            {
              "name": "fun1",
              "kind": 12,
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 2,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 2,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 0,
                      "character": 9
                    },
                    "end": {
                      "line": 0,
                      "character": 10
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 0,
                      "character": 9
                    },
                    "end": {
                      "line": 0,
                      "character": 10
                    }
                  }
                }
              ]
            },
            {
              "name": "fun2",
              "kind": 12,
              "range": {
                "start": {
                  "line": 4,
                  "character": 0
                },
                "end": {
                  "line": 7,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 4,
                  "character": 0
                },
                "end": {
                  "line": 7,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 5,
                      "character": 8
                    },
                    "end": {
                      "line": 5,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 5,
                      "character": 8
                    },
                    "end": {
                      "line": 5,
                      "character": 9
                    }
                  }
                }
              ]
            },
            {
              "name": "fun3",
              "kind": 12,
              "range": {
                "start": {
                  "line": 9,
                  "character": 0
                },
                "end": {
                  "line": 12,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 9,
                  "character": 0
                },
                "end": {
                  "line": 12,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 10,
                      "character": 8
                    },
                    "end": {
                      "line": 10,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 10,
                      "character": 8
                    },
                    "end": {
                      "line": 10,
                      "character": 9
                    }
                  }
                }
              ]
            },
            {
              "name": "fun4",
              "kind": 12,
              "range": {
                "start": {
                  "line": 14,
                  "character": 0
                },
                "end": {
                  "line": 17,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 14,
                  "character": 0
                },
                "end": {
                  "line": 17,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun5",
              "kind": 12,
              "range": {
                "start": {
                  "line": 20,
                  "character": 0
                },
                "end": {
                  "line": 23,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 20,
                  "character": 0
                },
                "end": {
                  "line": 23,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun6",
              "kind": 12,
              "range": {
                "start": {
                  "line": 25,
                  "character": 0
                },
                "end": {
                  "line": 28,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 25,
                  "character": 0
                },
                "end": {
                  "line": 28,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun7",
              "kind": 12,
              "range": {
                "start": {
                  "line": 30,
                  "character": 0
                },
                "end": {
                  "line": 33,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 30,
                  "character": 0
                },
                "end": {
                  "line": 33,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun8",
              "kind": 12,
              "range": {
                "start": {
                  "line": 35,
                  "character": 0
                },
                "end": {
                  "line": 38,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 35,
                  "character": 0
                },
                "end": {
                  "line": 38,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun9",
              "kind": 12,
              "range": {
                "start": {
                  "line": 40,
                  "character": 0
                },
                "end": {
                  "line": 43,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 40,
                  "character": 0
                },
                "end": {
                  "line": 43,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun10",
              "kind": 12,
              "range": {
                "start": {
                  "line": 45,
                  "character": 0
                },
                "end": {
                  "line": 48,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 45,
                  "character": 0
                },
                "end": {
                  "line": 48,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun11",
              "kind": 12,
              "range": {
                "start": {
                  "line": 50,
                  "character": 0
                },
                "end": {
                  "line": 53,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 50,
                  "character": 0
                },
                "end": {
                  "line": 53,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun12",
              "kind": 12,
              "range": {
                "start": {
                  "line": 55,
                  "character": 0
                },
                "end": {
                  "line": 58,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 55,
                  "character": 0
                },
                "end": {
                  "line": 58,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun13",
              "kind": 12,
              "range": {
                "start": {
                  "line": 60,
                  "character": 0
                },
                "end": {
                  "line": 63,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 60,
                  "character": 0
                },
                "end": {
                  "line": 63,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun14",
              "kind": 12,
              "range": {
                "start": {
                  "line": 65,
                  "character": 0
                },
                "end": {
                  "line": 68,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 65,
                  "character": 0
                },
                "end": {
                  "line": 68,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun15",
              "kind": 12,
              "range": {
                "start": {
                  "line": 70,
                  "character": 0
                },
                "end": {
                  "line": 73,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 70,
                  "character": 0
                },
                "end": {
                  "line": 73,
                  "character": 1
                }
              },
              "children": []
            },
            {
              "name": "fun16",
              "kind": 12,
              "range": {
                "start": {
                  "line": 75,
                  "character": 0
                },
                "end": {
                  "line": 79,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 75,
                  "character": 0
                },
                "end": {
                  "line": 79,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "x",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 77,
                      "character": 8
                    },
                    "end": {
                      "line": 77,
                      "character": 9
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 77,
                      "character": 8
                    },
                    "end": {
                      "line": 77,
                      "character": 9
                    }
                  }
                }
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    
    });

    it("Should return document symbols of a complex file with many nested functions and variables", async () => {
        const result = await RunDocumentSymbolsTest(baseUri, tempFilePath, server, testOcamlClient, '10.links');
        const expected: any = [
            {
              "name": "topLevel1",
              "kind": 12,
              "range": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 34,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 0,
                  "character": 0
                },
                "end": {
                  "line": 34,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "level1A",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 1,
                      "character": 2
                    },
                    "end": {
                      "line": 20,
                      "character": 3
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 1,
                      "character": 2
                    },
                    "end": {
                      "line": 20,
                      "character": 3
                    }
                  },
                  "children": [
                    {
                      "name": "level2A",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 2,
                          "character": 4
                        },
                        "end": {
                          "line": 6,
                          "character": 5
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 2,
                          "character": 4
                        },
                        "end": {
                          "line": 6,
                          "character": 5
                        }
                      },
                      "children": [
                        {
                          "name": "level3A",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 3,
                              "character": 6
                            },
                            "end": {
                              "line": 3,
                              "character": 26
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 3,
                              "character": 6
                            },
                            "end": {
                              "line": 3,
                              "character": 26
                            }
                          },
                          "children": []
                        },
                        {
                          "name": "level3B",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 4,
                              "character": 6
                            },
                            "end": {
                              "line": 4,
                              "character": 38
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 4,
                              "character": 6
                            },
                            "end": {
                              "line": 4,
                              "character": 38
                            }
                          },
                          "children": [
                            {
                              "name": "x",
                              "kind": 13,
                              "range": {
                                "start": {
                                  "line": 4,
                                  "character": 18
                                },
                                "end": {
                                  "line": 4,
                                  "character": 19
                                }
                              },
                              "selectionRange": {
                                "start": {
                                  "line": 4,
                                  "character": 18
                                },
                                "end": {
                                  "line": 4,
                                  "character": 19
                                }
                              }
                            }
                          ]
                        }
                      ]
                    },
                    {
                      "name": "level2B",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 8,
                          "character": 4
                        },
                        "end": {
                          "line": 17,
                          "character": 5
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 8,
                          "character": 4
                        },
                        "end": {
                          "line": 17,
                          "character": 5
                        }
                      },
                      "children": [
                        {
                          "name": "y",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 8,
                              "character": 16
                            },
                            "end": {
                              "line": 8,
                              "character": 17
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 8,
                              "character": 16
                            },
                            "end": {
                              "line": 8,
                              "character": 17
                            }
                          }
                        },
                        {
                          "name": "level3C",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 9,
                              "character": 6
                            },
                            "end": {
                              "line": 9,
                              "character": 30
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 9,
                              "character": 6
                            },
                            "end": {
                              "line": 9,
                              "character": 30
                            }
                          },
                          "children": [
                            {
                              "name": "z",
                              "kind": 13,
                              "range": {
                                "start": {
                                  "line": 9,
                                  "character": 18
                                },
                                "end": {
                                  "line": 9,
                                  "character": 19
                                }
                              },
                              "selectionRange": {
                                "start": {
                                  "line": 9,
                                  "character": 18
                                },
                                "end": {
                                  "line": 9,
                                  "character": 19
                                }
                              }
                            }
                          ]
                        },
                        {
                          "name": "level3D",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 10,
                              "character": 6
                            },
                            "end": {
                              "line": 15,
                              "character": 7
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 10,
                              "character": 6
                            },
                            "end": {
                              "line": 15,
                              "character": 7
                            }
                          },
                          "children": [
                            {
                              "name": "level4A",
                              "kind": 12,
                              "range": {
                                "start": {
                                  "line": 11,
                                  "character": 8
                                },
                                "end": {
                                  "line": 13,
                                  "character": 9
                                }
                              },
                              "selectionRange": {
                                "start": {
                                  "line": 11,
                                  "character": 8
                                },
                                "end": {
                                  "line": 13,
                                  "character": 9
                                }
                              },
                              "children": []
                            }
                          ]
                        }
                      ]
                    }
                  ]
                },
                {
                  "name": "level1B",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 22,
                      "character": 2
                    },
                    "end": {
                      "line": 31,
                      "character": 3
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 22,
                      "character": 2
                    },
                    "end": {
                      "line": 31,
                      "character": 3
                    }
                  },
                  "children": [
                    {
                      "name": "functionVar",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 23,
                          "character": 4
                        },
                        "end": {
                          "line": 28,
                          "character": 5
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 23,
                          "character": 4
                        },
                        "end": {
                          "line": 28,
                          "character": 5
                        }
                      },
                      "children": [
                        {
                          "name": "a",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 23,
                              "character": 20
                            },
                            "end": {
                              "line": 23,
                              "character": 21
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 23,
                              "character": 20
                            },
                            "end": {
                              "line": 23,
                              "character": 21
                            }
                          }
                        },
                        {
                          "name": "insideAnon",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 24,
                              "character": 6
                            },
                            "end": {
                              "line": 26,
                              "character": 7
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 24,
                              "character": 6
                            },
                            "end": {
                              "line": 26,
                              "character": 7
                            }
                          },
                          "children": [
                            {
                              "name": "b",
                              "kind": 13,
                              "range": {
                                "start": {
                                  "line": 24,
                                  "character": 21
                                },
                                "end": {
                                  "line": 24,
                                  "character": 22
                                }
                              },
                              "selectionRange": {
                                "start": {
                                  "line": 24,
                                  "character": 21
                                },
                                "end": {
                                  "line": 24,
                                  "character": 22
                                }
                              }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "name": "topLevel2",
              "kind": 12,
              "range": {
                "start": {
                  "line": 36,
                  "character": 0
                },
                "end": {
                  "line": 60,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 36,
                  "character": 0
                },
                "end": {
                  "line": 60,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "param",
                  "kind": 13,
                  "range": {
                    "start": {
                      "line": 36,
                      "character": 14
                    },
                    "end": {
                      "line": 36,
                      "character": 19
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 36,
                      "character": 14
                    },
                    "end": {
                      "line": 36,
                      "character": 19
                    }
                  }
                },
                {
                  "name": "recursive",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 37,
                      "character": 2
                    },
                    "end": {
                      "line": 40,
                      "character": 3
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 37,
                      "character": 2
                    },
                    "end": {
                      "line": 40,
                      "character": 3
                    }
                  },
                  "children": [
                    {
                      "name": "n",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 37,
                          "character": 16
                        },
                        "end": {
                          "line": 37,
                          "character": 17
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 37,
                          "character": 16
                        },
                        "end": {
                          "line": 37,
                          "character": 17
                        }
                      }
                    }
                  ]
                },
                {
                  "name": "returnsFunction",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 42,
                      "character": 2
                    },
                    "end": {
                      "line": 47,
                      "character": 3
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 42,
                      "character": 2
                    },
                    "end": {
                      "line": 47,
                      "character": 3
                    }
                  },
                  "children": [
                    {
                      "name": "x",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 42,
                          "character": 22
                        },
                        "end": {
                          "line": 42,
                          "character": 23
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 42,
                          "character": 22
                        },
                        "end": {
                          "line": 42,
                          "character": 23
                        }
                      }
                    },
                    {
                      "name": "returned",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 43,
                          "character": 4
                        },
                        "end": {
                          "line": 45,
                          "character": 5
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 43,
                          "character": 4
                        },
                        "end": {
                          "line": 45,
                          "character": 5
                        }
                      },
                      "children": [
                        {
                          "name": "y",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 43,
                              "character": 17
                            },
                            "end": {
                              "line": 43,
                              "character": 18
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 43,
                              "character": 17
                            },
                            "end": {
                              "line": 43,
                              "character": 18
                            }
                          }
                        }
                      ]
                    }
                  ]
                },
                {
                  "name": "multipleParams",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 49,
                      "character": 2
                    },
                    "end": {
                      "line": 57,
                      "character": 3
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 49,
                      "character": 2
                    },
                    "end": {
                      "line": 57,
                      "character": 3
                    }
                  },
                  "children": [
                    {
                      "name": "a",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 49,
                          "character": 21
                        },
                        "end": {
                          "line": 49,
                          "character": 22
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 49,
                          "character": 21
                        },
                        "end": {
                          "line": 49,
                          "character": 22
                        }
                      }
                    },
                    {
                      "name": "b",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 49,
                          "character": 24
                        },
                        "end": {
                          "line": 49,
                          "character": 25
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 49,
                          "character": 24
                        },
                        "end": {
                          "line": 49,
                          "character": 25
                        }
                      }
                    },
                    {
                      "name": "c",
                      "kind": 13,
                      "range": {
                        "start": {
                          "line": 49,
                          "character": 27
                        },
                        "end": {
                          "line": 49,
                          "character": 28
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 49,
                          "character": 27
                        },
                        "end": {
                          "line": 49,
                          "character": 28
                        }
                      }
                    },
                    {
                      "name": "innerMulti",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 50,
                          "character": 4
                        },
                        "end": {
                          "line": 55,
                          "character": 5
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 50,
                          "character": 4
                        },
                        "end": {
                          "line": 55,
                          "character": 5
                        }
                      },
                      "children": [
                        {
                          "name": "d",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 50,
                              "character": 19
                            },
                            "end": {
                              "line": 50,
                              "character": 20
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 50,
                              "character": 19
                            },
                            "end": {
                              "line": 50,
                              "character": 20
                            }
                          }
                        },
                        {
                          "name": "e",
                          "kind": 13,
                          "range": {
                            "start": {
                              "line": 50,
                              "character": 22
                            },
                            "end": {
                              "line": 50,
                              "character": 23
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 50,
                              "character": 22
                            },
                            "end": {
                              "line": 50,
                              "character": 23
                            }
                          }
                        },
                        {
                          "name": "deepestMulti",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 51,
                              "character": 6
                            },
                            "end": {
                              "line": 53,
                              "character": 7
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 51,
                              "character": 6
                            },
                            "end": {
                              "line": 53,
                              "character": 7
                            }
                          },
                          "children": [
                            {
                              "name": "f",
                              "kind": 13,
                              "range": {
                                "start": {
                                  "line": 51,
                                  "character": 23
                                },
                                "end": {
                                  "line": 51,
                                  "character": 24
                                }
                              },
                              "selectionRange": {
                                "start": {
                                  "line": 51,
                                  "character": 23
                                },
                                "end": {
                                  "line": 51,
                                  "character": 24
                                }
                              }
                            }
                          ]
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              "name": "topLevel3",
              "kind": 12,
              "range": {
                "start": {
                  "line": 62,
                  "character": 0
                },
                "end": {
                  "line": 79,
                  "character": 1
                }
              },
              "selectionRange": {
                "start": {
                  "line": 62,
                  "character": 0
                },
                "end": {
                  "line": 79,
                  "character": 1
                }
              },
              "children": [
                {
                  "name": "siblingA",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 63,
                      "character": 2
                    },
                    "end": {
                      "line": 63,
                      "character": 22
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 63,
                      "character": 2
                    },
                    "end": {
                      "line": 63,
                      "character": 22
                    }
                  },
                  "children": []
                },
                {
                  "name": "siblingB",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 64,
                      "character": 2
                    },
                    "end": {
                      "line": 64,
                      "character": 22
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 64,
                      "character": 2
                    },
                    "end": {
                      "line": 64,
                      "character": 22
                    }
                  },
                  "children": []
                },
                {
                  "name": "siblingC",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 65,
                      "character": 2
                    },
                    "end": {
                      "line": 65,
                      "character": 22
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 65,
                      "character": 2
                    },
                    "end": {
                      "line": 65,
                      "character": 22
                    }
                  },
                  "children": []
                },
                {
                  "name": "container",
                  "kind": 12,
                  "range": {
                    "start": {
                      "line": 67,
                      "character": 2
                    },
                    "end": {
                      "line": 76,
                      "character": 3
                    }
                  },
                  "selectionRange": {
                    "start": {
                      "line": 67,
                      "character": 2
                    },
                    "end": {
                      "line": 76,
                      "character": 3
                    }
                  },
                  "children": [
                    {
                      "name": "nestedSiblingA",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 68,
                          "character": 4
                        },
                        "end": {
                          "line": 68,
                          "character": 30
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 68,
                          "character": 4
                        },
                        "end": {
                          "line": 68,
                          "character": 30
                        }
                      },
                      "children": []
                    },
                    {
                      "name": "nestedSiblingB",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 69,
                          "character": 4
                        },
                        "end": {
                          "line": 69,
                          "character": 30
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 69,
                          "character": 4
                        },
                        "end": {
                          "line": 69,
                          "character": 30
                        }
                      },
                      "children": []
                    },
                    {
                      "name": "nestedSiblingC",
                      "kind": 12,
                      "range": {
                        "start": {
                          "line": 70,
                          "character": 4
                        },
                        "end": {
                          "line": 74,
                          "character": 5
                        }
                      },
                      "selectionRange": {
                        "start": {
                          "line": 70,
                          "character": 4
                        },
                        "end": {
                          "line": 74,
                          "character": 5
                        }
                      },
                      "children": [
                        {
                          "name": "deepNested1",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 71,
                              "character": 6
                            },
                            "end": {
                              "line": 71,
                              "character": 29
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 71,
                              "character": 6
                            },
                            "end": {
                              "line": 71,
                              "character": 29
                            }
                          },
                          "children": []
                        },
                        {
                          "name": "deepNested2",
                          "kind": 12,
                          "range": {
                            "start": {
                              "line": 72,
                              "character": 6
                            },
                            "end": {
                              "line": 72,
                              "character": 29
                            }
                          },
                          "selectionRange": {
                            "start": {
                              "line": 72,
                              "character": 6
                            },
                            "end": {
                              "line": 72,
                              "character": 29
                            }
                          },
                          "children": []
                        }
                      ]
                    }
                  ]
                }
              ]
            }
          ];
        assert.deepStrictEqual(result, expected);
    });

    
});