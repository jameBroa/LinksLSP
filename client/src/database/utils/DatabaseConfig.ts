import { Client } from "pg";
import DatabaseType from "./EnumDatabaseDriver";
import * as vscode from 'vscode';

class DatabaseConfig {

    host: string;
    port: number;
    username: string;
    password: string;
    driver: DatabaseType;
    pg_client: Client | undefined;

    tables: string[];

    constructor(host: string, port: number, username: string, password:string, driver:DatabaseType) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.driver = driver;
        this.pg_client = undefined;
        this.tables = [];
    }

    //FOR NOW LINKS IS HARD CODED AS THE DATABASE

    // Will return True if successful, False if not
    private async connect(): Promise<boolean>{
        if(this.pg_client === undefined) {
            // (1): Check if object is valid to make a connection
            if (this.isInValid()){
                return false;
            }
            // (2): Create PG_Client
            this.pg_client = new Client({
                host:this.host,
                port: this.port,
                user: this.username,
                password: this.password,
                database: "links"
            });
            // (3): Connect to service
            await this.pg_client.connect();
        }
        return true;
    }

    // Will return True if disconnection is successful
    private async disconnect(): Promise<boolean> {
        if(this.pg_client === undefined) {
            
            return false;
        } else {
            this.pg_client.end();
            this.pg_client = undefined;
            return true;
        }

    }

    // so far works, database -> postgres
    async getTables(outputChannel: vscode.OutputChannel): Promise<string[]>{
        if(this.pg_client === undefined) {
            const succeed = await this.connect();
            if(succeed === false) {
                outputChannel.appendLine("Failed to connect to Database client");
                return [];
            } else if (this.pg_client === undefined) {    
                outputChannel.appendLine("Can't connect to Database client. Have you submitted all relevant information?");
                return [];
            }
        }
        try {
            switch(this.driver){
                case DatabaseType.postgres:
                    
                    // Try a more verbose table query
                    const res = await this.pg_client.query(`
                        SELECT table_schema, table_name 
                        FROM information_schema.tables 
                        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                        AND table_type = 'BASE TABLE';
                    `);
                    outputChannel.appendLine(`Query result: ${JSON.stringify(res.rows)}`);

                    let tables: string[] = [];
                    res.rows.map((row) => {
                        tables.push(`${row.table_name}`);
                        outputChannel.appendLine(`Found table: ${row.table_name}`);
                    });
                    this.tables = tables;

                    return tables;
                  
                default:
                    return [];
            }
            

        } catch (error) {
            outputChannel.appendLine(`ERROR: ${error}`);

            return [];
        }

    }

     // so far works, database -> postgres
    async getDatabases(outputChannel: vscode.OutputChannel | undefined){


        if(this.pg_client === undefined) {
            const succeed = await this.connect();
            if (succeed === false) {
                if(outputChannel !== undefined) {
                    outputChannel.appendLine("Can't connect to Database client");
                }
                return [];
            } else if(this.pg_client === undefined){
                if(outputChannel !== undefined) {
                    outputChannel.appendLine("Can't connect to Database client. Have you submitted all relevant information?");
                }
                return [];
            }
        } 

        try {
            const res = await this.pg_client.query('SELECT datname FROM pg_database WHERE datistemplate=false;');
            let databases: string[] = [];

            res.rows.map((row) => {
                databases.push(row.datname);
            });

            return databases;


        } catch (error) {
            return [];
        } finally {
            // await this.pg_client.end();
        }
    }


    // Ensures that we have sufficient credentials
    isInValid() {
        if (this.host === "" || 
            this.port === -1 || 
            this.username === "" || 
            this.password === "" || 
            this.driver === DatabaseType.None){
            return true;
        }
        return false;
    }

    private async validateConfig() {
        if(this.pg_client === undefined) {
            const succeed = await this.connect();
            if (succeed === false) {
                return false;
            } else if(this.pg_client === undefined){
                return false;
            }
        } 
        return true;
    }

    async getSchema(table_name: string) {
        if(this.pg_client === undefined) {
            const succeed = await this.connect();
            if (succeed === false) {
                return [];
            } else if(this.pg_client === undefined){
                return [];
            }
        } 

        const res = await this.pg_client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_schema = 'public'  -- Adjust schema if necessary
            AND table_name = '${table_name}';
        `);

        const schema_details = res.rows.map((row: {column_name:string, data_type: string}) => ({
            columnName: row.column_name,
            dataType: row.data_type
        }));

        return schema_details;
    }


}

export default DatabaseConfig;