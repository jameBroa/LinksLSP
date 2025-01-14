import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    Range,
    TextEdit,
    Connection
  } from 'vscode-languageserver/node';
  import { CustomRequests } from './shared/types';
import {TableColumn } from '../extension';


 


  export class TableCompletionProvider {
    private tableNames: string[];
    private tableSchemas: Map<string, TableColumn[]>;
    
    constructor(tables: string[], schemas: Map<string, TableColumn[]>) {
        this.tableNames = tables;
        this.tableSchemas = schemas;
    }


    // private findDatabaseVariableName(documentText: string, currentLine: number): string {
    //     // Split the document into lines and look at lines before the current position
    //     const lines = documentText.split('\n').slice(0, currentLine + 1);
        
    //     // Regular expression to match database variable declarations
    //     // This will match patterns like: var anyname = database "whatever";
    //     const dbDeclPattern = /var\s+(\w+)\s*=\s*database\s*["'][^"']*["']/;
        
    //     // Look through lines in reverse order to find the most recent database declaration
    //     for (let i = lines.length - 1; i >= 0; i--) {
    //       const match = lines[i].match(dbDeclPattern);
    //       if (match) {
    //         return match[1]; // Return the captured variable name
    //       }
    //     }
        
    //     return 'db'; // Default fallback if no database variable is found
    //   }

    private findDatabaseVariableName(documentText: string): string {
        // Regular expression to match database variable declarations
        const dbDeclPattern = /var\s+(\w+)\s*=\s*database\s*["'][^"']*["']/g;
        
        // Store all matches with their positions
        const matches: { name: string, index: number }[] = [];
        
        let match;
        while ((match = dbDeclPattern.exec(documentText)) !== null) {
          matches.push({
            name: match[1],
            index: match.index
          });
        }
        
        if (matches.length === 0) {
          return 'db'; // Default fallback if no database variable is found
        }
        
        // If there's only one database declaration, use it
        if (matches.length === 1) {
          return matches[0].name;
        }
        
        // If there are multiple, try to determine the most relevant one
        // We could enhance this logic based on scope/context if needed
        return matches[matches.length - 1].name; // Currently using the last declared one
      }


      
    // ASSUMES database variable is called db!
    private generate_table_links_code(
        table_name: string, 
        table_schema: {columnName: string; dataType: string;}[],
        db_name: string
    ) {
      const sql_to_links = new Map<string, string>([
        ["integer", "Int"],
        ["text", "String"],
        ["double precision", "Float"],
        ["boolean", "Bool"],
        ["xml", "XML"]
      ]);
  
      let ret_str = `"${table_name}" with (`;
      
      table_schema.map((elem) => {
        let links_data_type = sql_to_links.get(elem.dataType);
        ret_str += `${elem.columnName}: ${links_data_type}, `;
      });
  
      ret_str = ret_str.slice(0, -2);
      ret_str += `) from ${db_name};`;
  
      return ret_str;
    }
    
    public async provideCompletions(
        document: { getText: () => string },
        position: Position
      ): Promise<CompletionItem[]> {
        const text = document.getText();
        const currentLine = text.split('\n')[position.line];
        const linePrefix = currentLine.slice(0, position.character);
        

        let db_name = this.findDatabaseVariableName(text);

        // Check if we just typed 'table'
        if (!linePrefix.trimEnd().endsWith('table')) {
          return [];
        }
    
        // GlobalLogger.log("Starting to provide completions");
    
        // Create completion items for all tables since we don't have a partial match yet
        const completionPromises = this.tableNames.map(async tableName => {
          const schema = this.tableSchemas.get(tableName);
          if (!schema) { return null; }
    
          const completionItem: CompletionItem = {
            label: tableName,
            kind: CompletionItemKind.Struct,
            detail: `Table: ${tableName}`,
            documentation: {
              kind: 'markdown',
              value: `Columns:\n${schema.map(col => `- ${col.columnName}: ${col.dataType}`).join('\n')}`
            },
            insertTextFormat: InsertTextFormat.Snippet,
            // Start inserting right after 'table'
            textEdit: TextEdit.replace(
              Range.create(
                position.line,
                position.character,
                position.line,
                position.character
              ),
                this.generate_table_links_code(tableName, schema, db_name)
            )
          };
    
          return completionItem;
        });
    
        const completions = await Promise.all(completionPromises);
        return completions.filter((item): item is CompletionItem => item !== null);
      }



    private isTableDeclarationContext(text: string, position: Position): boolean {
      const linePrefix = text.split('\n')[position.line].slice(0, position.character);
      return /var\s+\w+\s*=\s*table\s*["'][\w]*$/.test(linePrefix);
    }
  }