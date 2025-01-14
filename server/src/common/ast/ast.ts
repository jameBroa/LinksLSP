import { Range, Position } from "vscode-languageserver";
import { OCamlClient } from "../ocaml/ocamlclient";

export namespace AST {

    export interface ASTNode {
        type: "Node" | "Leaf";
        value: string;
        range: Range;
        children?: ASTNode[];
        parent: ASTNode | null;
    }

    export function fromJSON(json_str: string, original_code: string): ASTNode {
        const parsed = JSON.parse(json_str);
        // console.log(JSON.stringify(parsed, null, 2), "WHOLE AST");
        const ast: ASTNode = parseAST(parsed, original_code);
        return ast;
    }

    function parseAST(data: any, original_code: string, parent: ASTNode | null = null): ASTNode {
        const [type, value, position, children] = data;
        const curr_range = JSON.parse(position);

        const node: ASTNode = {
            type,
            value,
            range: Range.create(
                Position.create(curr_range.start.line, curr_range.start.col),
                Position.create(curr_range.finish.line, curr_range.finish.col)
            ),
            parent
        };

        if(type === "Node" && children) {
            node.children = children.map((child: any) => parseAST(child, original_code, node));
        }
        return node;
    }

    // General Traversal function
    export function traverse(node: ASTNode) {
        if(node.children) {
            for(const child of node.children) {
                traverse(child);
            }
        }
    }
    
    export function findNodeAtPosition(ast: ASTNode, position: Position): ASTNode | null {
        function isPositionInRange(position: Position, range: {start: Position, end: Position}): boolean {
            if (position.line < range.start.line || (position.line === range.start.line && position.character < range.start.character)) {
                return false;
              }
              if (position.line > range.end.line || (position.line === range.end.line && position.character > range.end.character)) {
                return false;
              }
              return true;
            
        }
        let foundNode: ASTNode | null = null;
        function traverse(node: ASTNode): ASTNode | null {
            if(node.children) {
                for(const child of node.children) {
                    let child_range = child.range;
                    
                    // if(child_range.start.line === child_range.end.line) {
                    let start = child_range.start.character;
                    let end = child_range.end.character;
                    console.log("start", start);
                    console.log("end", end);
                    console.log(position.line === child_range.start.line, "line check");
                    if((position.line+1) === child_range.start.line) {
                        if(position.character >= start) {
                            if(position.line+1 < child_range.end.line ) {
                                console.log("returning");
                                foundNode = child;
                            } else if (position.line+1 === child_range.end.line) {
                                if(position.character <= end) {
                                    foundNode = child;
                                }
                            }   
                            // return child;
                        } else if (position.character === start-1) {
                            foundNode = child;
                        }
                    }
                    // } 
                    traverse(child);
                }
            }
            return null;
        }
        traverse(ast);
        return foundNode; 
    }

    export function getVariableReferences(node: AST.ASTNode, ast: AST.ASTNode): ASTNode[] {
        const references: ASTNode[] = [];
      
        function traverse(currentNode: AST.ASTNode) {
          if (currentNode.type === 'Leaf' && 
              currentNode.value === node.value) {
            references.push(currentNode);
          }
          if (currentNode.children) {
            for (const child of currentNode.children) {
              traverse(child);
            }
          }
        }
        traverse(ast);
        return references;
    }

    export function getFunctionReferences(node: ASTNode, ast: ASTNode): ASTNode[] {
        const references: ASTNode[] = [];
        const functionName = node.children ? node.children[0].value.split(" ")[1] : "";
        function traverse(currentNode: ASTNode) {
          if (currentNode.type === "Node" && 
              currentNode.value === "FnAppl" &&
              currentNode.children &&
              currentNode.children[0].type === "Leaf" &&
              currentNode.children[0].value === `Variable: ${functionName}`
            ) {
            references.push(currentNode);
          }
          // Traversal method
          if (currentNode.children) {
            for (const child of currentNode.children) {
              traverse(child);
            }
          }
        }
        traverse(ast);
        return references;
    }
    // If we need to do more Traversal stuff, will refactor above function to be more general

}

