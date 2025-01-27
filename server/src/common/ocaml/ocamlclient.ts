import * as net from 'net';

export class OCamlClient{
    private connection_url: string;
    private connection_port: number;

    constructor() {
        this.connection_url = '127.0.0.1';
        this.connection_port = 8081;
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
                // console.log(data.toString(), "DATA");
                // console.log(`[OCamlClient] Received data: "${data.toString()}" from OCaml server`);
                // // console.log(JSON.stringify(JSON.parse(data.toString()), null, 2), "literarlly parsed to json");
                // // resolve(data.toString());
                // resolve(JSON.stringify(JSON.parse(data.toString()), null, 2));
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


}