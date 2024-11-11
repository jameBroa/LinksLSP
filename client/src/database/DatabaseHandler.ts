import { LanguageClient } from "vscode-languageclient/node";
import * as vscode from 'vscode';
import DatabaseConfig from "./utils/DatabaseConfig";
import {CustomRequests} from "./shared/types";


export class DatabaseHandler {
    constructor(
      private client: LanguageClient,
      private dbConfig: DatabaseConfig,
      private outputChannel: vscode.OutputChannel
    ) {
      this.registerCustomHandlers();
    }
  
    private registerCustomHandlers() {
      // Handler for fetching all tables
      this.client.onRequest(CustomRequests.FetchTables, async () => {
        try {
          return await this.dbConfig.getTables(this.outputChannel);
        } catch (error) {
          this.outputChannel.appendLine(`Error fetching tables: ${error}`);
          return [];
        }
      });
  
      // Handler for fetching specific table schema
      this.client.onRequest(CustomRequests.FetchTableSchema, async (tableName: string) => {
        try {
          return await this.dbConfig.getSchema(tableName);
        } catch (error) {
          this.outputChannel.appendLine(`Error fetching schema for ${tableName}: ${error}`);
          return null;
        }
      });
    }
  }