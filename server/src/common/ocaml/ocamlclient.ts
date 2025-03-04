import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as vscode from 'vscode';
import { spawn, type ChildProcess } from 'child_process';

export class OCamlClient{
    private ocamlServerPath: string | null = null;
    private connection_url: string;
    private connection_port: number;
    private serverProcess: ChildProcess | null = null;
    private IsServerPathInit: boolean = false;

    constructor(serverPath: string) {
        this.connection_url = '127.0.0.1';
        this.connection_port = 8081;
        this.IsServerPathInit = serverPath !== "";
        this.Start_OCamlServer();
    }
    

    private connect(): Promise<net.Socket> {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            client.connect(this.connection_port, this.connection_url, () => {
                resolve(client);
            });

            client.on('error', (err) => {
                console.error("[OCamlClient] Error connecting to OCaml server: ", err);
                reject(err);
            });
            client.on('close', () => {
                console.log("[OCamlClient] Connection closed");
            });
        });
    }

    private parseInnerJson(data: any): any {
        if (typeof data === 'string') {
          try {
            return JSON.parse(data); // Attempt to parse the string as JSON
          } catch {
            return data; // If parsing fails, return the string as-is
          }
        } else if (Array.isArray(data)) {
          return data.map(this.parseInnerJson); // Recursively parse each item in the array
        } else if (typeof data === 'object' && data !== null) {
          return Object.fromEntries(
            Object.entries(data).map(([key, value]) => [key, this.parseInnerJson(value)])
          );
        }
        return data; // Return other types (e.g., numbers) as-is
      }

    public async get_AST_as_JSON(code: string): Promise<string> {
        const client = await this.connect();
        let full_data = "";
        return new Promise((resolve, reject) => {
            client.write(code, (err) => {
                if(err) {
                    return reject(err);
                }
                console.log("[OCamlClient] in write callback!");
                client.end();
            });

            client.on('data', (data) => {
                console.log("[OCamlClient] Receiving data....");
                full_data += data.toString();
            });

            client.on('end', async() => {
                try{
                    const parsedData = JSON.parse(full_data);
                    // const resolution = await this.parseInnerJson(parsedData);
                    // console.log("[OCamlClient] Received data: ", JSON.stringify(resolution, null, 2), "PLEASE PLEASE");
                    resolve(JSON.stringify(parsedData, null, 2));
                } catch(e){
                    console.error(`[OCamlClient.get_AST_as_JSON] Error at 'end': ${e}`);
                    reject(e);
                }
            });

            client.on('error', (err) => {
                reject(err);
            });

            client.on('close', () => {
                console.log("[OCamlClient] Connection closed");
            });

        });
    }

    private is_comment(line: string): boolean {
        if (line === ''){
            return false;
        }

        let idx = 0;
        while(line[idx] === ' ' || line[idx] === '\n'){
            idx++;
            if(idx >= line.length){
                return false;
            }
        }
        const char = line[idx];
        // console.log(char);
        return char === '#';
    }

    public async Update_ServerPath(serverPath: string): Promise<boolean> {
        this.IsServerPathInit = serverPath !== "";
        if(this.IsServerPathInit){
            // Do other checks like validate files/directories?
            this.ocamlServerPath = serverPath;
            return await this.Start_OCamlServer();
        } else {
            return false;
        }
    }

    public create_payload(code: string): string{
        // (1): Remove any lines with comments
        // (2): Remove whitespace/newlines

        const code_by_line = code.split('\n');
        
        let no_comments_remove = code_by_line.filter((line) => !this.is_comment(line));
        let no_comments_replace = [];

        for(let i = 0; i < code_by_line.length; i++){
            if(!this.is_comment(code_by_line[i])){
                no_comments_replace.push(code_by_line[i]);
            } else {
                no_comments_replace.push('');
            }
        }




        let full_code_no_comments = no_comments_remove.join('\n');
        // console.log(no_comments.length, code_by_line.length, "FULL CODE");
        let res = code.replace(/\s+/g, ' ').trim();

        console.log(res, "NO COMMENTS");
        return res;


    }

    private async Start_OCamlServer(): Promise<boolean> {
        if(!this.IsServerPathInit || this.ocamlServerPath === null){
            return false;
        }

        try{
            this.ocamlServerPath = path.resolve(this.ocamlServerPath);
            // console.log(`dirname: ${__dirname}`);
            // let fp = path.resolve(__dirname, '../../../../parser-pipline/parser/parser.ml');
            // console.log(`resolved path: ${fp}`);
            // this.ocamlServerPath = fp;
            // const parentDir = path.dirname(this.ocamlServerPath);
            // const dirContents = await fs.readdir(parentDir);
            // console.log(`[OCamlClient] Directory contents: ${dirContents}`);

            // const stats = await fs.stat(this.ocamlServerPath);
            // console.log(`[OCamlClient] File exists: ${stats.isFile()}`);



            await fs.access(this.ocamlServerPath);

            const ServerDir = path.dirname(this.ocamlServerPath);
            const executableName = path.basename(this.ocamlServerPath);
            console.log(`[OCamlClient] Starting OCaml server using dune from ${ServerDir}`);

            this.serverProcess = spawn('dune', ['exec', `./parser.exe`], {
                stdio: 'ignore',
                detached: true,
                cwd: ServerDir
            });

            this.serverProcess.unref();

            await new Promise(resolve => setTimeout(resolve, 3000));
            return true;

        } catch (e){
            this.serverProcess = null;
            console.log(`[OCamlClient] Error starting OCaml server: ${e}`);
            return false;
        }
    }

    public async Stop_OCamlServer(): Promise<boolean> {
        if(this.serverProcess){
            this.serverProcess.kill('SIGTERM');
            setTimeout(() => {
                if(this.serverProcess){
                    this.serverProcess.kill('SIGKILL');
                    this.serverProcess = null;
                }
            }, 5000);
            this.serverProcess = null;
            console.log(`[OCamlClient] Stopped sever process`);
            return true;
        } else {
            console.log(`[OCamlClient] No server process to stop`);
            return true;
        }
    }
}