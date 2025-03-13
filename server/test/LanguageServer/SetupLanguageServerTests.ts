import { OCamlClient } from "../../src/common/ocaml/ocamlclient";
import { LanguageServer } from "../../src/extension";
import * as path from 'path';
import * as fs from 'fs/promises';
import sinon from 'sinon';

export function setupLanguageServerTests(baseDir: string){
    const server = new LanguageServer();
    const testOcamlClient = new OCamlClient("");
    server.start();
    const tempFilePath = path.join(baseDir, 'temporary.links');
    return { server, testOcamlClient, tempFilePath };
}

export function tearDownLanguageServerTests(server: LanguageServer, tempFilePath: string){
    try {
        fs.unlink(tempFilePath);
        sinon.restore();
    } catch (error: any) {
        console.error(`Error deleting temporary file: ${error.message}`);
    }
    server.connection.dispose();
}

