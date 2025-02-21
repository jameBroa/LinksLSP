import { Range, Position, Diagnostic } from "vscode-languageserver";
import { OCamlClient } from "../ocaml/ocamlclient";
import {TextDocument} from "vscode-languageserver-textdocument";
import { start } from "repl";
import { AssertionError } from "assert";
import { create } from "domain";
import { get, remove } from "lodash";
import { LinksParserConstants } from "../constants";
import { Function } from "./namespaces/function";
export namespace AST {

    export interface ASTNode {
        type: "Node" | "Leaf";
        value: string;
        range: Range;
        children?: ASTNode[];
        parent: ASTNode | null;
    }
    export function removeParentField(key: string, value: any){
        if(key==="parent"){
          return undefined;
        } else{
          return value;
        }
      }
    
    export function removeParentAndChildren(key: string, value:any){
        if(key === "parent" || key === "children"){
            return undefined;
        } else {
            return value;
        }
    }

    export function fromJSON(json_str: string, original_code: string): ASTNode {
        const parsed = JSON.parse(json_str);
        try{
            const ast: ASTNode = parseAST(parsed, original_code);
            return ast;
        } catch (e){
            console.log(e, "E MESSAGE!");
            throw e;
        }
        
    }

    export function parseAST(data: any, original_code: string, parent: ASTNode | null = null): ASTNode {
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

    // One mega function for processing the AST
    // Will be responsible for building Semantic Relations
    // Ensurs only one pass as well
    export function ProcessAST(ast: ASTNode){
        type DiagnosticIncorrParam = {
            node: ASTNode,
            actualNumCount: number,
            expectedNumCount: number,
        };
        let undefinedVariables: ASTNode[] = [];
        let duplicateDeclarations: ASTNode[] = [];
        let uninitializedVariables: ASTNode[] = [];
        let undefinedFunctions: ASTNode[] = [];
        let incorrectParamNumber: Map<Range, DiagnosticIncorrParam> = new Map();





        function processFunction(
              local_ast: AST.ASTNode, 
              parentVariableDefinitions: Map<string, ASTNode[]>) 
              {
              
              const functionName = functionParser.getName(local_ast);
        
              // Right here related to formlet variables and such...
              let localVariableDefinitions: Map<string, ASTNode[]> = variableParser.getVariableDefinitionsFromAST(local_ast);
              let localVariableReferences: ASTNode[] = variableParser.getVariableReferencesFromAST(local_ast);
              let localFunctionalVariableDefinitions: Map<string, [ASTNode[], Range[]]> = variableParser.getFunctionalVariableDefinitionsFromAST(local_ast);
              
        
              let localFunctionReferences: ASTNode[] = functionParser.getFunctionReferencesFromAST(local_ast);

              let allVariableDefinitions: Map<string, ASTNode[]> = new Map([...localVariableDefinitions, ...parentVariableDefinitions]);
        

              function isValid(node: ASTNode, varName: string){
                let res = localFunctionalVariableDefinitions.get(varName)!;
                let results: boolean[] = [];
                if(res){
                  for(let i = 0; i < res[0].length; i++){
                    if(isBefore(res[1][i], node.range)){
                      results.push(false);
                    } else {
                      results.push(true);
                    }
                  }
                 
                return results.includes(true);
                }
              }

              function isFormletFunction(node: ASTNode){
                return node.parent!.value ==="FormBinding";
              }
        
              for(const node of localVariableReferences){
                const variableName = node.value.split(" ")[1];
                
                // Undefined variables
                if (
                  !allVariableDefinitions.has(variableName) &&
                  !isValid(node, variableName) &&
                  !isFormletFunction(node)
                
                ){
                  undefinedVariables.push(node);
                } 
                
        
                // Uninitialized variables
                if(
                  allVariableDefinitions.has(variableName) &&
                  // AST.isBefore(allVariableDefinitions.get(variableName)![0].range, node.range)
                  AST.isBefore(node.range, allVariableDefinitions.get(variableName)![0].range)
                  )
                
                  {
                    uninitializedVariables.push(node);
                }
        
                // Duplicate declarations
                for(const varDef of allVariableDefinitions.keys()){
                  if(allVariableDefinitions.get(varDef)!.length > 1){
                    duplicateDeclarations = [...duplicateDeclarations, ...allVariableDefinitions.get(varDef)!];
                  }
                }
              }
              
              // Undefined functions
              for(const node of localFunctionReferences) {
                
                let currfunctionName;
                
                if(node.value === "FnAppl"){
                    currfunctionName = functionParser.getFunctionNameFromFnAppl(node);
                } else {
                    // Happens when we have formlets
                    currfunctionName = variableParser.getName(node);
                }                
        
                const availableFunctions: Set<string> = functionParser.getAvailableFunctionsToCall(node);
                availableFunctions.add(functionParser.getName(local_ast));
        
                // Undefined functions
                if(!availableFunctions.has(currfunctionName) && !LinksParserConstants.LINKS_FUNCS.has(currfunctionName)){
                  undefinedFunctions.push(node);
                }
              }

        
              // Function call parameter count
              let numParams = functionParser.getFunctionParams(local_ast).length;
              let allFunctionCalls: ASTNode[] = functionParser.getFunctionCallsAsAST(ast!, functionName);
              for(const calls of allFunctionCalls){
                let currParams = calls.children!.slice(1).length;
                if(currParams !== numParams){
                  incorrectParamNumber.set( 
                    calls.children![0].range, 
                    {
                      node: calls.children![0],
                      actualNumCount: currParams,
                      expectedNumCount: numParams
                    }
                ); 
                }
              }
        
              let nestedFunctions: ASTNode[] = functionParser.getNextLevelFunctions(local_ast);

              for(const nestedFunction of nestedFunctions){
                processFunction(nestedFunction, allVariableDefinitions);
              }
            }
        
            // Since we wrap the entire code in a dummy function, the first child of the AST is of value "Fun"
            let startNode = ast!.children![0];
            processFunction(startNode, new Map());
            
            console.log(`[ast.undefinedfunctions] ${JSON.stringify(undefinedFunctions, removeParentAndChildren, 2)}`)


            type DiagnosticInfo = {
                node: AST.ASTNode,
                firstMessage: string,
                secondMessage: string
            };

            let allDiagnostics: DiagnosticInfo[] = [
                  ...undefinedVariables.map(varNode => (
                    {
                      node: varNode, 
                      firstMessage: `Variable ${varNode.value.split(" ")[1]} is not defined`,
                      secondMessage:`Consider defining ${varNode.value.split(" ")[1]} before using it`
                    } as DiagnosticInfo
                  )),
                  ...undefinedFunctions.map(fun => (
                    {
                      node: fun, 
                      firstMessage: `Function ${AST.functionParser.getFunctionNameFromFnAppl(fun)} is not defined`,
                      secondMessage:`Consider defining "${AST.functionParser.getFunctionNameFromFnAppl(fun)}" before using it`
                    } as DiagnosticInfo
                  )),
                  ...duplicateDeclarations.map(dup => (
                    {
                      node: dup,
                      firstMessage: `Variable ${dup.value.split(" ")[1]} is declared twice.`,
                      secondMessage: `Either remove one declaration or reuse the variable.`
                    }
                  )),
                  ...uninitializedVariables.map(uninit => (
                    {
                      node: uninit,
                      firstMessage: `Variable ${uninit.value.split(" ")[1]} is used before being initialized.`,
                      secondMessage: `Consider initializing ${uninit.value.split(" ")[1]} before using it.`
                    }
                  )),
                  ...Array.from(incorrectParamNumber.values()).map(incorr => (
                    {
                      node: incorr.node,
                      firstMessage: `Incorrect number of arguments`,
                      secondMessage: `Expected ${incorr.expectedNumCount} arguments, but got ${incorr.actualNumCount}.`
                    }
                  ))
                ];
            
            return allDiagnostics;
    }

    // Given a position on the VSCode document, return the Node in the AST
    // that corresponds to that position.
    export function findNodeAtPosition(ast: ASTNode, position: Position): ASTNode | null {
        let foundNode: ASTNode | null = null;
        let maxIter = 1;
        let currIter = 0;
        let foundNodes: ASTNode[] = [];
        function traverse(node: ASTNode): ASTNode | null {
            if(node.children) {
                for(const child of node.children) {
                    let child_range = child.range;
                    let start = child_range.start.character;
                    let end = child_range.end.character;
                    
                    if((position.line) === child_range.start.line) {
                        if(position.character >= start) {
                            if(position.line < child_range.end.line ) {
                                foundNode = child;
                                foundNodes.push(child);
                            } else if (position.line === child_range.end.line) {
                                if(position.character <= end) {
                                    foundNode = child;
                                    foundNodes.push(child);

                                }
                            }   
                        } else if (position.character === start-1) {
                            foundNode = child;
                            foundNodes.push(child);

                        }
                    }
                    traverse(child);
                }
            }
            return null;
        }

        traverse(ast);
        // This is to account for Signature's not
        // existing in the AST. However, what is true
        // is that the Siganture always exists
        // one line above the function implementation
        // so we just check the line above the function.
        if(foundNode === null && currIter < maxIter) {
            position = Position.create(
                position.line-1,
                position.character  
            );
            traverse(ast);
        }
        currIter += 1;


        if(foundNodes.length !== 1){
            foundNode = getClosestNode(foundNodes, position);
        }

        return foundNode; 
    }

    export function getClosestNodeFromAST(ast: ASTNode, position: Position): ASTNode {
        let ret: ASTNode = ast;
        let MindistToStartLine = Number.MAX_VALUE;
        let MindistToEndLine = Number.MAX_VALUE;

        let MindistToStartChar = Number.MAX_VALUE;
        let MindistToEndChar = Number.MAX_VALUE;

        let totalDist = Number.MAX_VALUE;
        function traverse(node: ASTNode){

            let distToStartLine = Math.abs(node.range.start.line - position.line);
            let distToEndLine = Math.abs(node.range.end.line - position.line);

            let distToStartChar = Math.abs(node.range.start.character - position.character);
            let distToEndChar = Math.abs(node.range.end.character - position.character);
            
            let currDist = distToStartLine + distToEndLine + distToStartChar + distToEndChar;

            if(
                position.line === node.range.start.line &&
                distToStartLine <= MindistToStartLine &&
                distToEndLine <= MindistToEndLine &&
                distToStartChar <= MindistToStartChar &&
                distToEndChar <= MindistToEndChar 
                && currDist <= totalDist
            ) {
                ret = node;
                totalDist = currDist;
                MindistToStartLine = distToStartLine;
                MindistToEndLine = distToEndLine;
                MindistToStartChar = distToStartChar;
                MindistToEndChar = distToEndChar;
            }

            if(node.children){
                for(const child of node.children){
                    traverse(child);
                }
            }
        }
        traverse(ast);
        if(ret.value === "Block"){
            ret = ret.parent!.parent!.children![ret.parent!.parent!.children!.length-1]; //insane one liner
        }
        return ret;

    }

    function getClosestNode(nodes: ASTNode[], position: Position): ASTNode {
        let ret: ASTNode = nodes[0];

        let MindistToStartLine = Number.MAX_VALUE;
        let MindistToEndLine = Number.MAX_VALUE;

        let MindistToStartChar = Number.MAX_VALUE;
        let MindistToEndChar = Number.MAX_VALUE;

        for(const node of nodes){

            let distToStartLine = Math.abs(node.range.start.line - position.line);
            let distToEndLine = Math.abs(node.range.end.line - position.line);

            let distToStartChar = Math.abs(node.range.start.character - position.character);
            let distToEndChar = Math.abs(node.range.end.character - position.character);

            if(
                distToStartLine <= MindistToStartLine &&
                distToEndLine <= MindistToEndLine &&
                distToStartChar <= MindistToStartChar &&
                distToEndChar <= MindistToEndChar
            ) {
                ret = node;
                MindistToStartLine = distToStartLine;
                MindistToEndLine = distToEndLine;
                MindistToStartChar = distToStartChar;
                MindistToEndChar = distToEndChar;
            }



            // if(lineDiff < minLineDiff){
            //     minLineDiff = lineDiff;
            //     minCharDiff = charDiff;
            //     ret = node;
            // } else if (lineDiff === minLineDiff && charDiff < minCharDiff){
            //     minCharDiff = charDiff;
            //     ret = node;
            // }
        }
        return ret;
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
    export function getFunctionDefinition(functionName: string, ast: ASTNode): ASTNode | null {
        let definition: ASTNode | null = null;

        function traverse(currentNode: ASTNode) {
          if (currentNode.type === "Leaf" && 
              currentNode.value === `Binder: ${functionName}`
            ) {
            definition = currentNode;
          }
          // Traversal method
          if (currentNode.children) {
            for (const child of currentNode.children) {
              traverse(child);
            }
          }
        }
        traverse(ast);
        return definition;
    }

    // Given a Node which is a variable, find the function node that it is a parameter of
    // referenceNode: Node that is a variable
    // ast: AST of the file
    export function findFunctionNodeOfParam(referenceNode: ASTNode, ast: ASTNode): ASTNode | null {
        let functionNode: ASTNode | null = null;


        function traverse(currentNode: ASTNode) {
            if(currentNode.type === "Node" &&
               currentNode.value === "Fun" && 
               referenceNode.range.start.line-2 >= currentNode.range.start.line 
            ) {
                functionNode = currentNode;
            }

            if(currentNode.children) {
                for(const child of currentNode.children) {
                    traverse(child);
                }
            }
        }

        traverse(ast);
        return functionNode;
    }


    // Will be useful to go N levels down the AST assuming we traverse down the
    // first child each time.
    export function setAsNChild(node: ASTNode, n: number): ASTNode | null {
        let ret = node;
        for (let i = 0; i < n; i++) {
            if(ret.children) {
                ret = ret.children[0];
            } else {
                return null;
            }
        }
        return ret;
    }

    // Returns the first reference of a node in an AST.
    // This is useful in finding the first reference/declaration of a variable.
    // This will help the OnDefinition Handler
    export function findFirstReference(node: ASTNode, ast: ASTNode): ASTNode {
        let references: ASTNode[] = [];

        function traverse(currentNode: ASTNode) {

            if(currentNode.type === "Leaf" &&
                currentNode.value === node.value
            ) {
                references.push(currentNode);
            }


            if(currentNode.children){
                for(const child of currentNode.children) {

                    traverse(child);
                }
            }
        }
        traverse(ast);
        return references[0];
    }

    export function isParameterVariable(node: ASTNode, ast: ASTNode) {
        let isParam = false;

        function traverse(currentNode: ASTNode) {
            if(currentNode.type === "Node" &&
                currentNode.value === "Fun" &&
                currentNode.range.start.line === node.range.start.line
            ) {
                isParam = true;
            }

            if(currentNode.children) {
                for(const child of currentNode.children) {
                    traverse(child);
                }
            }
        }
        traverse(ast);
        return isParam;
    }

    // Given a node which has value: "Variable {insert_name}" returns whether its a variable (True)
    // or just a function call (false)
    /**
     * With the setup of the parser, a function call has a ASTNode.value of "Variable" as well
     * a normal variable. The way to distinct the two is by looking at its parent. 
     * 
     * If parent is "Val" or "NormalFunlit" or "InfixAppl"
     * 
     * If parent is "FnAppl", the first child is NOT a variable!!!!
     * otherwise any "Variable" IS a variable I think
    */
    export function isRealVariable(node: ASTNode): boolean {
        if(!node.parent){
            // Not sure here tbh?
            // Intuition says return true
            return true;
        }
        let parentNode = node.parent;
        if (parentNode.children){
            if(parentNode.value === "FnAppl" && 
                parentNode.children[0] === node
            ){
                // First variable of FnAppl is not a "variable"
                return false;
            } else {
                return true;
            }

        } else {
            // Should never be true...
            return false;
        }
    }


    // Return all variables for a given AST
    // Should NOT return Functions
    export function getAllVariables(ast: ASTNode): ASTNode[] {
        let all_nodes_value_variable: ASTNode[] = [];

        function traverse(currentNode: ASTNode): void {
            if(
                ((
                    currentNode.type === "Leaf" && 
                    currentNode.value.substring(0, 9) === "Variable:"
                ) || 
                (
                    currentNode.type === "Leaf" && 
                    currentNode.value.substring(0, 9) === "Constant:"   
                ))
                
            ) {
                console.log("adding variable");
                all_nodes_value_variable.push(currentNode);
            }
            
            if(currentNode.children) {
                for(const child of currentNode.children){
                    traverse(child);
                }
            }
        }

        traverse(ast);

        let valid_nodes = all_nodes_value_variable.filter((elem) => (isRealVariable(elem)));
        valid_nodes = valid_nodes.filter((elem) => {
            return !(elem.parent!.value === "FormBinding" && elem.parent!.children![0] === elem);
        });

        return valid_nodes;
    }
    export function isBefore(range1: Range, range2: Range): boolean {
        if (range1.end.line < range2.start.line) {
            return true;
        }
        if (range1.end.line === range2.start.line && range1.end.character < range2.start.character) {
            return true;
        }
        return false;
    }
    
    export function isAfter(range1: Range, range2: Range): boolean {
        if (range1.start.line > range2.end.line) {
            return true;
        }
        if (range1.start.line === range2.end.line && range1.start.character > range2.end.character) {
            return true;
        }
        return false;
    }
    
    export function isInRange(range: Range, checkRange: Range): boolean {
        if (
            range.start.line < checkRange.start.line ||
            (range.start.line === checkRange.start.line && range.start.character < checkRange.start.character)
        ) {
            return false;
        }
        if (
            range.end.line > checkRange.end.line ||
            (range.end.line === checkRange.end.line && range.end.character > checkRange.end.character)
        ) {
            return false;
        }
        return true;
    }

    // Old one below V. Above ^ is from ChatGPT
    // export function isBefore(range1: Range, range2: Range): boolean {
    //     if (range1.end.line < range2.start.line) {
    //       return true;
    //     }
    //     if (range1.end.line === range2.start.line && range1.end.character < range2.start.character) {
    //       return true;
    //     }
    //     return false;
    //   }
      
    //   export function isAfter(range1: Range, range2: Range): boolean {
    //     if (range1.start.line > range2.end.line) {
    //       return true;
    //     }
    //     if (range1.start.line === range2.end.line && range1.start.character > range2.end.character) {
    //       return true;
    //     }
    //     return false;
    //   }

    //   export function isInRange(range: Range, checkRange: Range): boolean {
    //     if (isBefore(range, checkRange) || isAfter(range, checkRange)) {
    //       return false;
    //     }
    //     return true;
    //   }


     export function rangeReplacer(key: string, value: any) {
    if (value && typeof value === 'object' && 'start' in value && 'end' in value) {
        return {
            start: { line: value.start.line, character: value.start.character },
            end: { line: value.end.line, character: value.end.character }
        };
    }
    return value;
}


    export function createVariableMap(ast: ASTNode): Map<String, number> {
        let map = new Map<String, number>();
        // Have a second map to store the ranges of the variables
        // workflow: If a doesn't exist in map, add it to map, then add its range to map2
        // workflow2: if a new variable of the same name exists but isn't in the range defined in map2, add it to map2 and 
        // increment the counter in map
        let map2 = new Map<String, Range[]>();

        function traverse(currentNode: ASTNode) {
            if(
                currentNode.type === "Leaf" &&
                currentNode.value.substring(0,9) === "Variable:" && 
                isRealVariable(currentNode)){
                    if(map.has(currentNode.value)){
                        // `!` asserts non-null

                        const ranges = map2.get(currentNode.value);

                        for(const range of ranges!){
                            if(isInRange(currentNode.range, range)){
                                continue;
                            } else {
                                map2.set(currentNode.value, [...ranges!, currentNode.range]);
                            }
                        }
                        map.set(currentNode.value, (map.get(currentNode.value)!+1));

                    } else {
                        map.set(currentNode.value, 1);
                        map2.set(currentNode.value, [currentNode.range]);
                    }
            }

            if(currentNode.children) {
                for(const child of currentNode.children) {
                    traverse(child);
                }
            }
        }

        traverse(ast);

        return map;
    }

    //**
    // Given a list of nodes which are variables, return an array of
    // those nodes IF they are used. This is defined if they exist
    // more than once in the whole AST for the document.
    // 
    // Can do this by creating a map between the Node and occurences. 
    // In this case, we don't need a separate function, just apply filter method to the list
    //  */
    export function getUsedVariables(ast: ASTNode) {
        let map = new Map<ASTNode, number>();

        function traverse(currentNode:ASTNode){
            if(currentNode.children){
                for(const child of currentNode.children){
                    traverse(child);
                }
            }
        }

        traverse(ast);
    }

    // export function findUnusedVariables(node: ASTNode): ASTNode[] {
    //     // Stack of scopes, where each scope is a map of variable names to their corresponding ASTNode
    //     const scopeStack: Map<string, { node: ASTNode; used: boolean }>[] = [];
    //     const unusedNodes: ASTNode[] = [];
    
    //     // Helper function to process a node recursively
    //     function processNode(node: ASTNode): void {
    //         if (node.type === "Node") {
    //             // Handle scope introduction (e.g., Function or Block nodes)
    //             if (node.value === "Fun" || node.value === "Block") {
    //                 // Push a new scope
    //                 scopeStack.push(new Map());
    //             }
    
    //             // Process children nodes
    //             if (node.children) {
    //                 for (const child of node.children) {
    //                     processNode(child);
    //                 }
    //             }
    
    //             // Pop scope and collect unused variables when leaving a scope
    //             if (node.value === "Fun" || node.value === "Block") {
    //                 const currentScope = scopeStack.pop();
    //                 if (currentScope) {
    //                     for (const { node: variableNode, used } of currentScope.values()) {
    //                         if (!used) {
    //                             unusedNodes.push(variableNode);
    //                         }
    //                     }
    //                 }
    //             }
    //         } else if (node.type === "Leaf") {
    //             // Handle variable declarations (Binder) and usage (Variable)
    //             const [prefix, variableName] = node.value.split(": ");
    //             if (prefix === "Binder") {
    //                 // Declare a variable in the current scope
    //                 const currentScope = scopeStack[scopeStack.length - 1];
    //                 if (currentScope) {
    //                     currentScope.set(variableName, { node, used: false }); // Mark as unused initially
    //                 }
    //             } else if (prefix === "Variable") {
    //                 // Mark the variable as used in the nearest scope
    //                 for (let i = scopeStack.length - 1; i >= 0; i--) {
    //                     const scope = scopeStack[i];
    //                     if (scope.has(variableName)) {
    //                         const variableEntry = scope.get(variableName);
    //                         if (variableEntry) {
    //                             variableEntry.used = true; // Mark as used
    //                         }
    //                         break;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    
    //     // Start processing the AST from the root node
    //     processNode(node);
    
    //     return unusedNodes;
    // }


    

    export function getXMLNodes(ast: ASTNode): ASTNode[] {
        let xmlNodes: ASTNode[] = [];

        function traverse(currentNode:ASTNode){
            if(currentNode.type === "Leaf" && currentNode.parent?.value === "Xml"){
                xmlNodes.push(currentNode);
            }

            if(currentNode.children){
                for(const child of currentNode.children){
                    traverse(child);
                }
            }
        }

        traverse(ast);
        return xmlNodes;
    }

    // Collection of functions for retrieving semantic information related to variables
    export namespace variableParser {


        // Given an ASTNode with value `Variable: {variable_name}`, return whether it is a parameter
        function isParameter(node: ASTNode): boolean{
            return node.parent!.value === "NormalFunLit";
        }

        export function getName(node: ASTNode): string{
            return node.value.split(" ")[1];
        }


        // Returns a Map of Variable names and a list ASTNodes of the times it's been defined
        // Decided to modify this function which previously only returned a Set of function names
        // Did this to support the 'duplicate declaration' detection
        export function getVariableDefinitionsFromAST(ast: ASTNode): Map<string, ASTNode[]> {
            let ret = new Map<string, ASTNode[]>();

            function traverse(currentNode: ASTNode){
                let varName;
                if(
                    (currentNode.type === "Leaf" && 
                    currentNode.value.substring(0, 9) === "Variable:" && 
                    isRealVariable(currentNode) && 
                    (
                        currentNode.parent!.value === "Val" || 
                        currentNode.parent!.value === "NormalFunlit" || 
                        (
                            currentNode.parent!.value === "FormBinding" &&
                            currentNode.parent!.children![1] === currentNode
                        )
                    )
                    )
                    
                ) {
                    // "Variable: x" therefore V makes sense
                    varName = currentNode.value.split(" ")[1];
                // Commented below out but forgot the reason why it was out...
                // } else if (
                //     (currentNode.type === "Leaf" &&
                //         currentNode.value.substring(0, 9) === "Constant:" &&
                //         currentNode.parent!.parent!.value === "TableLit")
                // ) {
                //     let regex = new RegExp(`CommonTypes\\.Constant\\.String\\s*"([^"]*)"`);
                //     let match = regex.exec(currentNode.value);
                //     varName = match![1];
                } else {
                    varName = "\0";
                }

                
                if(varName !== "\0"){
                    if(ret.has(varName)){
                        ret.set(varName, [...ret.get(varName)!, currentNode]);
                    } else {
                        ret.set(varName, [currentNode]);     
                    }
                }


                if(currentNode.children){
                    for(const child of currentNode.children){
                        if(child.value !== "Fun"){
                            traverse(child);
                        }
                    }
                }
            }
            traverse(ast);
            return ret;
        }

        // Returns the first node of value "Variable: {variable_name}" in the AST
        // from an Iteration Node. This node serves as the 'variable' definition
        // for functional patterns like `{for x <-- accounts [x]}
        function getVariableDefinitionFromIteration(ast: ASTNode): ASTNode | null {
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){
                if(
                    currentNode.type === "Leaf" && 
                    currentNode.value.substring(0, 9) === "Variable:" && 
                    isRealVariable(currentNode)
                ) {
                    ret.push(currentNode);
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }
            traverse(ast);
            if(ret.length === 0){
                return null;
            }
            return ret[0]; // Returns the same node if no variable definition is found
        }

        export function getFunctionalVariableDefinitionsFromAST(ast: ASTNode): Map<string, [ASTNode[], Range[]]> {
            // need to return the range for which the node is valid for asw..........
            // return Tuple of a list of ASTNode's and a list of Range's where the ith element of each list
            // correspond to each other
            let ret: Map<string, [ASTNode[], Range[]]> = new Map();

            function traverse(currentNode: ASTNode){

                if(
                    currentNode.type === "Node" &&
                    (currentNode.value === "DBDelete" || currentNode.value === "DBUpdate")
                ) {
                    let varName = currentNode.children![0].value.split(" ")[1];
                    if(ret.has(varName)) {
                        ret.set(varName, [
                            [...ret.get(varName)![0], currentNode.children![0]],
                            [...ret.get(varName)![1], currentNode.range]
                        ]);
                    } else {
                        ret.set(varName, [[currentNode.children![0]], [currentNode.range]]);
                    }
                } else if (currentNode.type === "Node" && currentNode.value === "Iteration") {
                    if(currentNode.children){
                        for(const child of currentNode.children!) {
                            let varNode = getVariableDefinitionFromIteration(child);
                            if(varNode !== currentNode && varNode !== null){
                                let varName = varNode.value.split(" ")[1];
                                if(ret.has(varName)) {
                                    ret.set(varName, [
                                        [...ret.get(varName)![0], varNode],
                                        [...ret.get(varName)![1], currentNode.range]
                                    ]);
                                } else {
                                    ret.set(varName, [[varNode], [currentNode.range]]);
                                }
                            }
                        }
                    }

                    // let varNode = getVariableDefinitionFromIteration(currentNode);
                    // console.log("varNode", JSON.stringify(varNode, removeParentField, 2));
                    // if(varNode !== currentNode){
                    //     let varName = varNode.value.split(" ")[1];
                    //     console.log("varName", varName);

                    //     // Set the nodes range as the Iteration node's range as that's where
                    //     // the variable is valid
                    //     if(ret.has(varName)) {
                    //         ret.set(varName, [
                    //             [...ret.get(varName)![0], varNode],
                    //             [...ret.get(varName)![1], currentNode.range]
                    //         ]);
                    //     } else {
                    //         ret.set(varName, [[varNode], [currentNode.range]]);
                    //     }

                    // }


                } else if (
                    // For formlets...
                    currentNode.type === "Node" && 
                    currentNode.parent!.value === "FormBinding" && 
                    currentNode.parent!.children![0] === currentNode
                ){
                    let varName = currentNode.children![0].value.split(" ")[1];
                    let parentNode = currentNode;
                    while(parentNode.value !== "Formlet"){
                        parentNode = parentNode.parent!;
                    }

                    console.log("found formlet variable definition for", varName);

                    if(ret.has(varName)) {
                        

                        ret.set(varName, [
                            [...ret.get(varName)![0], currentNode],
                            [...ret.get(varName)![1], parentNode.range]
                        ]);
                    } else {
                        ret.set(varName, [[currentNode.children![0]], [parentNode.range]]);

                    } 
                }   


                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }

            traverse(ast);
            return ret;
        }
        
        export function getVariableReferencesFromAST(ast: ASTNode): ASTNode[] {
            let ret: ASTNode[] = [];
            // console.log(ast.children![0].value.split(" ")[1], "function name");

            function traverse(currentNode: ASTNode){
                if(
                    currentNode.type === "Leaf" && 
                    currentNode.value.substring(0, 9) === "Variable:" && 
                    isRealVariable(currentNode) && 
                    !isParameter(currentNode) && 
                    currentNode.parent!.value !== "Variable"
                ) {
                    // "Variable: x" therefore V makes sense
                    ret.push(currentNode);     
                }


                if(currentNode.children){
                    for(const child of currentNode.children){
                        // Ensures that it doesn't get variable references from nested functions
                        // The processFunction recursive call should account for variable refernces
                        // inside nested functions anyway
                        if(child.value !== "Fun"){
                            traverse(child);
                        }
                    }
                }
            }
            traverse(ast);
            // console.log(`variables: ${JSON.stringify(ret, removeParentField, 2)}`);
            return ret;
        }


        // Returns whether the current ASTNode contains the definition of a variable
        // Should only accept ASTNode's of value 'Fun'
        export function containsVarDefinition(node: ASTNode, name: string): boolean{
            let ret = false;

            function traverse(currentNode: ASTNode){

                if(
                    currentNode.type === "Leaf" && 
                    currentNode.value === `Variable: ${name}` && 
                    isRealVariable(currentNode) &&
                    currentNode.parent &&
                    (currentNode.parent.value === "Val" || currentNode.parent.value === "NormalFunlit")
                ) {
                    ret = true;
                } else if
                (
                    currentNode.value === "FormBinding" &&
                    currentNode.children![1].value === `Variable: ${name}`
                )
                {
                    ret = true;
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        // Stop traversing if there's a nested function 
                        if(child.value !== "Fun"){
                            traverse(child);
                        }
                    }
                }
            }
            traverse(node);
            return ret || variableParser.getFunctionalVariableDefinitionsFromAST(node).has(name); 
        }

        // Given a variable node (node with value 'Variable: {variable_name}'), return 
        // the node which describes its definition.
        // Doesn't work for variables:
        // (1) Defined in iterators
        export function extractVariableDefinition(varNode: ASTNode): ASTNode | null{

            let ScopeNode = getVariableScopeAsASTNode(varNode, varNode);

            let ret: ASTNode | null = null;

            function traverse(currentNode: ASTNode){
                if(
                    currentNode.type === "Leaf" &&
                    currentNode.value === `Variable: ${getName(varNode)}` &&
                    (
                        currentNode.parent!.value === "Val" || 
                        currentNode.parent!.value ==="NormalFunlit" || 
                        (currentNode.parent && currentNode.parent.parent && currentNode.parent.parent.value === "Iteration") ||
                        currentNode.parent!.value === "FormBinding"
                    )
                ) {
                    ret = currentNode;
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        // Already determined scope of variable so no need to traverse further
                        if(child.value !== "Fun"){
                            traverse(child);
                        }
                    }
                }
            }

            traverse(ScopeNode);
            return ret;
        }

        // Checks if a node is under the formlet
        // This is important because some variables are defined in the formlet
        // Instead of returning true and false, just return the node itself since we need it
        // and if the output node is the same as input we know it's not under a formlet
        function isUnderFormlet(node: ASTNode){
            let currNode = node;
            while(currNode.value !== "Formlet" && (currNode.value !== "No Signature" && currNode.value !== "Fun" && currNode.value !== "Signature")){
                currNode = currNode.parent!;
            }

            if(currNode.value === "Formlet"){
                return currNode;
            } else {
                return node;
            }

        }

        function getVariableScopeAsASTNode(varNode: ASTNode, traversalNode: ASTNode): ASTNode {
            console.log(`traversal node: ${JSON.stringify(traversalNode, removeParentAndChildren, 2)}`);
            
            let currNode = traversalNode;
            let varName = variableParser.getName(varNode);

            let formletNode = isUnderFormlet(varNode);
            // Scope of variable defined in FormBinding is the FormBinding itself
            // if(varNode.parent!.value === "FormBinding"){
            //     console.log("Found scope for FormBinding");
            //     return currNode.parent!;
            // } 
            // if(formletNode !== varNode){
            //     console.log("Found scope for Formlet");
            //     return formletNode;
            // }

            while
            (
                currNode.value !== "No Signature" && 
                currNode.value !== "Fun" && 
                currNode.value !== "Signature"   
            ){
                currNode = currNode.parent!;
            }

            if(containsVarDefinition(currNode, varName)){
                return currNode;
            } else {
                return getVariableScopeAsASTNode(varNode, currNode.parent!);
            }
        }
    
        // variableNodes: All nodes with value `Variable: {variable_name}`
        export function extractUnusedVariables(variableNodes: ASTNode[]): ASTNode[]{
            let ret: ASTNode[] = [];

            for(const node of variableNodes){
                console.log(`Finding scope for ${variableParser.getName(node)}`);
                console.log(`AST: ${JSON.stringify(node, removeParentAndChildren, 2)}`);
                let parentNode: ASTNode = getVariableScopeAsASTNode(node, node);
                console.log("found scope of variable!");
                console.log(`scope: ${JSON.stringify(parentNode.range, null, 2)}`);
                let variableMap: Map<String, number> = new Map();

                function traverse(currentNode: ASTNode) {
                    if
                    (
                        currentNode.type === "Leaf" && 
                        currentNode.value.substring(0, 9) === "Variable:" && 
                        isRealVariable(currentNode)
                    )
                        {
                            if(variableMap.has(currentNode.value)){
                                variableMap.set(currentNode.value, variableMap.get(currentNode.value)!+1);
                            } else {
                                variableMap.set(currentNode.value, 1);
                            }
                        }
                    if(currentNode.children){
                        for(const child of currentNode.children){
                            traverse(child);
                        }
                    }
                }
                traverse(parentNode);

                if(variableMap.get(node.value) === 1){
                    ret.push(node);
                }

            }
            
            return ret;
        }

        export function extractProjectionsFromAST(ast: ASTNode): ASTNode[]{
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){

                if(currentNode.type === "Node" && currentNode.value === "Projection"){
                    ret.push({
                        type: currentNode.type,
                        value: currentNode.children![1].value,
                        range: Range.create(
                            Position.create(currentNode.range.start.line, currentNode.children![1].range.end.character - currentNode.children![1].value.length),
                            Position.create(currentNode.range.end.line, currentNode.children![1].range.end.character)
                        ),
                        parent: currentNode.parent,
                        children: currentNode.children
                    });

                    // ret.push(currentNode.children![1]);
                }
                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }

            traverse(ast);
            return ret;
        }
    }

    export namespace functionParser {

        // Returns a Map of Function names and a list ASTNodes of the times it's been defined
        // Decided to follow implementation of VariableDefinitionsFromAST which returns all
        // instances of a functions definition so that that diagnostic can be implemented too.
        export function getFunctionDefinitionsFromAST(ast: ASTNode): Map<string, ASTNode[]>{
            let ret: Map<string, ASTNode[]> = new Map<string, ASTNode[]>();

            function traverse(currentNode: ASTNode) {

                if(
                    currentNode.type === "Node" &&
                    currentNode.value === "Fun"
                ) {
                    const functionName = getName(currentNode);
                    if(ret.has(functionName)) {
                        ret.set(functionName, [...ret.get(functionName)!, currentNode]);
                    } else {
                        ret.set(functionName, [currentNode]);
                    }
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        if(child.value !== "Fun"){
                            traverse(child);
                        }
                    }
                }
            }

            traverse(ast);
            return ret;
        }

        export function getFunctionReferencesFromAST(ast: ASTNode): ASTNode[] {
            let ret: ASTNode[] = [];
            function traverse(currentNode: ASTNode) {
                if(
                    (currentNode.type === "Node" && 
                    currentNode.value === "FnAppl") ||
                    (
                        currentNode.type === "Leaf" && 
                        currentNode.value.substring(0, 9) === "Variable:" &&
                        currentNode.parent!.value === "FormBinding" &&
                        currentNode.parent!.children![0] === currentNode
                    )
                
                ) {
                    ret.push(currentNode);
                }
                if(currentNode.children){
                    for(const child of currentNode.children){
                        if(child.value !== "Fun" ){
                            traverse(child);
                        }
                    }
                }
            }
            traverse(ast);
            return ret;
        }

        // Given an ASTNode of value "FnAppl" return the function name
        export function getFunctionNameFromFnAppl(node: ASTNode): string {

            console.log(`name: ${JSON.stringify(node, removeParentAndChildren, 2)}`);
            let currNode = node.children![0];
            const operatorNameRegex = new RegExp(`Operators\\.Section\\.Name\\s*"([^"]*)"`);
            const operatorMatch = operatorNameRegex.exec(currNode.value);
            if(currNode.value.substring(0,9) === "Variable:"){    
                // console.log("Returning (1)")        
                return currNode.value.split(" ")[1];      
            } else if (operatorMatch){
                    // Calling an Operator function like +, -, +. etc
                    const operatorName = operatorMatch![1];
                    // console.log("Returning (2)")
                    return operatorName;
            } else {
                // console.log("Returning (3)")
                return LinksParserConstants.OPERATOR_FLOAT_NAME_TO_SYMBOL.get(currNode.value)!;
            }

        }

        export function createFunctionToNumCallsMap(functionCalls: string[]): Map<string, number> {
            let ret = new Map<string, number>();

            for(const node of functionCalls){
                if(ret.has(node)) {
                    ret.set(node, ret.get(node)!+1);
                } else {
                    ret.set(node, 1);
                }
            }
            return ret;
        }

        // Returns the names of all functions accessible from a given ASTNode
        // normally passses in a "FnAppl" node.
        export function getAvailableFunctionsToCall(ast: ASTNode) : Set<string> {
            let ret = new Set<string>();

            function traverseDown(currentNode: ASTNode){

                if(currentNode.type === "Node" && currentNode.value === "Fun"){
                    if(currentNode.children && 
                        isBefore(currentNode.children[0].range, ast.range) && 
                            currentNode !== ast
                        )

                    {
                        ret.add(currentNode.children[0].value.split(" ")[1]);
                    }
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }

            function traverseUp(currentNode: ASTNode) {
                if(currentNode.children){
                    for(const child of currentNode.children){
                        if(child.value === "Fun" && 
                            isBefore(currentNode.children[0].range, ast.range) && 
                            currentNode !== ast){
                            ret.add(child.children![0].value.split(" ")[1]);
                        } else {
                            traverseDown(child);
                        }
                    }
                }

                if(currentNode.parent){
                    traverseUp(currentNode.parent);
                }
            }
            traverseDown(ast);
            traverseUp(ast);
            return ret;
        }

        // Given an ASTNode, return all the function calls
        // at this level.
        // (Mainly used for the root level)
        export function getTopLevelFunctions(ast: ASTNode): ASTNode[]{
            let ret: ASTNode[] = [];

            if(ast.children){
                for(const child of ast.children){
                    if(child.type === "Node" && child.value === "Fun"){
                        ret.push(child);
                    }
                }
            }
            return ret;

        }

        // Returns a list of ASTNode's of the function definition
        // Needed to get the scope of a function
        // i.e. Value === "Fun"
        export function getFunctionFromAST(ast: ASTNode): ASTNode[] {

            let ret: ASTNode[] = [];

            function traverse(currentNode:ASTNode){

                // Don't want the same node being added
                if(currentNode.type === "Node" && 
                    currentNode.value === "Fun" && 
                    currentNode !== ast){
                    ret.push(currentNode);
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        // Stop traversing when we reach the next Fun
                        traverse(child);
                        
                    }
                }
            }

            traverse(ast);

            return ret;
        }



        // Given a node of value "Fun", return all the nodes of value "Fun" that are
        // children of the given node
        export function getNextLevelFunctions(ast: ASTNode): ASTNode[] {
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){
                if(currentNode.type === "Node" &&
                    currentNode.value === "Fun" &&
                    currentNode !== ast
                ) {
                    ret.push(currentNode);
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        if(child.value === "Fun"){
                            ret.push(child);
                        } else {
                            traverse(child);
                        }
                    }
                }

            }
            traverse(ast);

            return ret;
        }

        // export function getFunctionReferencesFromAST(ast: ASTNode): ASTNode[] {
        //     let ret: ASTNode[] = [];

        //     function traverse(currentNode: ASTNode){
        //         if(currentNode.type === "Node" && currentNode.value === "FnAppl"){
        //             ret.push(currentNode.children![0]);
        //         }

        //         if(currentNode.children){
        //             for(const child of currentNode.children){
        //                 traverse(child);
        //             }
        //         }
        //     }

        //     traverse(ast);
        //     return ret;
        // }

        // Given an ASTNode of value: "Fun", return the params of the function
        export function getFunctionParams(ast: ASTNode): ASTNode[]{
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){

                if(currentNode.type === "Leaf" &&
                    currentNode.value.substring(0,9) ==="Variable:" &&
                    currentNode.parent!.value === "NormalFunlit"
                ){
                    ret.push(currentNode);
                }



                if(currentNode.children){
                    for(const child of currentNode.children){
                        // Stop exploring when we reach the next Fun
                        // ProcessFunction will handle the next Fun recursively
                        if(child.value !== "Fun") {
                            traverse(child);
                        }
                    }
                }
            }
            traverse(ast);

            return ret;
        }

        // Return the
        export function getFunctionCallsAsAST(ast: ASTNode, functionName: string): ASTNode[]{
            let ret: ASTNode[] = [];
            function traverse(currentNode: ASTNode){

                if(currentNode.type === "Node" && 
                    currentNode.value === "FnAppl" &&
                    currentNode.children![0].value.split(" ")[1] === functionName
                ) {
                    ret.push(currentNode);
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }

            }

            traverse(ast);
            return ret;
        }


        // Returns the ASTNode of where a function is called from (not its definition, but literarlly where its called)

        export function getFunctionCallers(ast: ASTNode): ASTNode[]{
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){
                if(currentNode.value === "FnAppl") {
                    ret.push(currentNode.children![0]);
                } else if 
                (
                    currentNode.value === "FormBinding"
                ){
                    ret.push(currentNode.children![0]);
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }

            traverse(ast);
            return ret;

        }


        export function extractFunctionDefinitions(ast: ASTNode): ASTNode[] {
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){
                if(currentNode.type === "Node" && currentNode.value === "Fun"){
                    if(currentNode.children){
                        if(currentNode.children[0].range.start.line === 1){
                            ret.push(
                                {
                                    type: currentNode.type,
                                    value: currentNode.children[0].value,
                                    range: Range.create(
                                        Position.create(currentNode.children[0].range.start.line, currentNode.children[0].range.start.character+3),
                                        Position.create(currentNode.children[0].range.start.line, currentNode.children[0].range.start.character+3 + currentNode.children[0].value.split(" ")[1].length+1)
                                    ),
                                    parent: currentNode,
                                    children: currentNode.children[0].children
                                }
                            );
                        } else {
                            ret.push(
                                {
                                    type: currentNode.type,
                                    value: currentNode.children[0].value,
                                    range: Range.create(
                                        Position.create(currentNode.children[0].range.start.line, currentNode.children[0].range.start.character+4),
                                        Position.create(currentNode.children[0].range.start.line, currentNode.children[0].range.start.character+4 + currentNode.children[0].value.split(" ")[1].length)
                                    ),
                                    parent: currentNode,
                                    children: currentNode.children[0].children
                                }
                            );
                        }
                    }
                    
                    // ret.push(currentNode);
                }

                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }

            traverse(ast);
            return ret;
        }

        export function extractFunctionCalls(ast: ASTNode): string[] {
            let ret: string[] = [];

            function traverse(currentNode: ASTNode){

                console.log(`currentNode: ${JSON.stringify(currentNode, removeParentAndChildren, 2)}`);


                if
                (
                    currentNode.type === "Node" && 
                    currentNode.value === "FnAppl"  
                )
                {
                    ret.push(currentNode.children![0].value.split(" ")[1]);
                } else if
                    (
                        currentNode.parent &&
                        currentNode.parent.children &&
                        currentNode.parent.value ==="FormBinding" && 
                        currentNode.parent.children[0] === currentNode
                    )
                {
                    ret.push(variableParser.getName(currentNode));
                }
                

                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }

            traverse(ast);
            return ret;
        }

        // Given an ASTNode of value: "Fun", return the params of the function
        export function hasSignature(node: ASTNode){
            if(node.value !== "Fun"){
                return false; // If not function return False
            }
            return node.children![2].value === "Signature";
        }

        // Given an ASTNode of value: "Fun", return the functions name
        export function getName(node: ASTNode): string{
            if(node.value !== "Fun"){
                return "";
            }
            return node.children![0].value.split(" ")[1];
        }


    }


    // Functions for getting semantic information related to XML blocks
    export namespace xmlParser {



        // Given a child of an XML node, return the attributes an XML node has
        // i.e. the XML node: <test input="test" id="test" l:onclick="test" banana="test" apple="test"></test>
        // would return ["input", "id", "l:onclick", "banana", "apple"]
        function getAttributes(node: ASTNode): string[] {
            let idx = 1;
            let attributes: string[] = [];

            if(node.parent!.children![node.parent!.children!.length-1].value.substring(0, 9) === "TextNode:"){
                while(idx < node.parent!.children!.length-1){
                    // while(node.parent!.children![idx].value.substring(0,9) !==  "TextNode:"){
                    attributes.push(node.parent!.children![idx].value);
                    idx++;
                }
            } else {
                while(idx < node.parent!.children!.length){
                    // while(node.parent!.children![idx].value.substring(0,9) !==  "TextNode:"){
                    attributes.push(node.parent!.children![idx].value);
                    idx++;
                }
            }


            return attributes;
            // for(const nd of node.parent!.children!){
            //     if(nd.value === "type"){
            //         hasType = true;
            //     } else if(nd.value === "id"){
            //         hasId = true;
            //     } else if(allHandlers.has(nd.value)){
            //         hasHandler = true;
            //     }
            // }

            // return [hasType, hasId, hasHandler];
        }

        function createAttributeRegexMap(attributes: string[]): Map<string, RegExp> {
            let map = new Map<string, RegExp>();
            for(const attribute of attributes){
                let regex = new RegExp(`${attribute}=`, 'g');
                map.set(attribute, regex);
            }
            return map;
        }

        export function extractSemantics(xmlNodes: ASTNode[], documentText: string): ASTNode[] {
            // let ret: ASTNode[] = [];

            let ret: Map<string, ASTNode> = new Map();

            let xmlNames: string[] = [];
            let xmlBlocksProcessed: Set<string> = new Set();
            // const documentText = document.getText();
            const lines = documentText.split('\n');

            const matches: { XML: string, ranges: Range[] }[] = [];
            // ignore the node range information, just look at the ranges part f
            for (const node of xmlNodes) {
                if (!xmlBlocksProcessed.has(node.value)) {
                    xmlNames.push(node.value);

                    let nodeAttributes: string[] = getAttributes(node);
                    let attributeRegexMap = createAttributeRegexMap(nodeAttributes);
                    
                    const openingPatternFull = new RegExp(`<${node.value}[^>]*>`, 'g');
                    // const openingPatternFull = new RegExp(`<${node.value}.*>`, 'g');
                    // const openingPattern = new RegExp(`<${node.value}\\b`, 'g'); // Apparantly doesn't consider <# since it is a special character
                    // const openingPattern = new RegExp(`<${node.value}\\b`, 'g');
                    let openingPattern;

                    if(node.value === "#"){
                        openingPattern = new RegExp(`<#(\\s|>|/|$)`, 'g');
                    } else {
                        openingPattern = new RegExp(`<${node.value}\\b`, 'g');

                    }
                    

                    const closingTagPattern = new RegExp(`>`, 'g');
                    const closingTagPatternAlt = new RegExp(`/>`, 'g');
                    const closingPattern = new RegExp(`</${node.value}>`, 'g');


                    const nodeMatches: Range[] = []; // XML Block i.e. inside the <>'s
                    const tags: Range[] = []; // the tags themselves i.e. < and >
                    // const attributes: Set<Range> = new Set(); // the attributes like type, id, and l:{handler}
                    const attributes: Map<string, Range> = new Map();
                    
                    let canAddAttributes = false;
                    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                        let line = lines[lineIndex];
                        let match;

                        let openingTagClosingXMLTagMatch; // the > in the opening XML tag <#'>' <--- this one

                    
                        // looks for <{node.value}
                        while ((match = openingPattern.exec(line)) !== null) {
                            nodeMatches.push(Range.create(
                                Position.create(lineIndex+2, match.index+2),
                                Position.create(lineIndex+2, match.index+2 + node.value.length)
                            ));

                            tags.push(Range.create(
                                Position.create(lineIndex+2, match.index+1),
                                Position.create(lineIndex+2, match.index+2)
                            ));
                            canAddAttributes = true;
                        }

                        // Looks for attributes
                        if(canAddAttributes){
                            for(let i = node.range.start.line-2; i < node.range.end.line; i++) {
                                for(const [attribute, regex] of attributeRegexMap){
                                    while((match = regex.exec(lines[i])) !== null){
                                        let range =  Range.create(
                                            Position.create(i+2, match.index+1),
                                            Position.create(i+2, match.index+1 + attribute.length)
                                        );
                                        attributes.set(JSON.stringify(range), range);
                                    }
                                }
                            }
                        }

                        // looks for '>'
                        while((openingTagClosingXMLTagMatch = closingTagPattern.exec(line)) !== null){
                            tags.push(Range.create(
                                Position.create(lineIndex+2, openingTagClosingXMLTagMatch.index+1),
                                Position.create(lineIndex+2, openingTagClosingXMLTagMatch.index+2)
                            ));
                            canAddAttributes = false;
                        }

                        // looks for '/>'
                        while((openingTagClosingXMLTagMatch = closingTagPatternAlt.exec(line)) !== null){
                            tags.push(Range.create(
                                Position.create(lineIndex+2, openingTagClosingXMLTagMatch.index+1),
                                Position.create(lineIndex+2, openingTagClosingXMLTagMatch.index+3)
                            ));
                            canAddAttributes = false;
                        }



                       
                        while ((match = closingPattern.exec(line)) !== null) {
                            nodeMatches.push(Range.create(
                                Position.create(lineIndex+2, match.index+3),
                                Position.create(lineIndex+2, match.index + match[0].length)
                            ));
                            
                            tags.push(Range.create(
                                Position.create(lineIndex+2, match.index+1),
                                Position.create(lineIndex+2, match.index+3)
                            ));
                            tags.push(Range.create(
                                Position.create(lineIndex+2, match.index + match[0].length),
                                Position.create(lineIndex+2, match.index + match[0].length+1)
                            ));
                        }
                    }

                    matches.push({ XML: node.value, ranges: nodeMatches });
                    xmlBlocksProcessed.add(node.value);

                    for(const range of nodeMatches){
                        let newNode = 
                        {
                            type: node.type,
                            value: node.value,
                            range: range,
                            parent: node.parent
                        } as ASTNode;

                        ret.set(JSON.stringify(newNode, removeParentField), newNode);
                        // ret.push({
                        //     type: node.type,
                        //     value: node.value,
                        //     range: range,
                        //     parent: node.parent
                        // });
                    }

                    for(const tag of tags){
                        let newNode = {
                            type: node.type,
                            value: "xmlTag",
                            range: tag,
                            parent: node.parent
                        } as ASTNode;
                        ret.set(JSON.stringify(newNode, removeParentField), newNode);
                        // ret.push({
                        //     type: node.type,
                        //     value: "xmlTag",
                        //     range: tag,
                        //     parent: node.parent
                        // });
                    }

                    for(const attribute of attributes.values()){
                        let newNode = {
                            type: node.type,
                            value: "xmlAttribute",
                            range: attribute,
                            parent: node.parent
                        } as ASTNode;
                        ret.set(JSON.stringify(newNode, removeParentField), newNode);
                        // ret.push({
                        //     type: node.type,
                        //     value: "xmlAttribute",
                        //     range: attribute,
                        //     parent: node.parent
                        // });
                    }

                    // console.log(`[XML] attributes: ${JSON.stringify(Array.from(attributes), removeParentField, 2)}`);
                }
            }
            return Array.from(ret.values());
        }


        // Old - Can remove
        export function parseXmlRanges(nodes: ASTNode[], document: TextDocument): ASTNode[]{
            let xmlNodesParsed: ASTNode[] = [];
            const documentText = document.getText();
            const lines = documentText.split("\n");

            for(const node of nodes){
                let range = node.range;
                let firstLine = lines[range.start.line-2];

                let lastLine = lines[range.end.line-2];

                // The best scenario
                // This handles the case where the opening and closing tags are on separate lines
                // For example:
                // <#>
                //      <p>
                //          {some conent}
                //      </p>
                // </#>
                if(firstLine !== lastLine){
                    let startChar = firstLine.indexOf("<");
                    let endChar = firstLine.indexOf(">");
                    
                    let lstartChar = lastLine.indexOf("<");
                    let lendChar = lastLine.indexOf(">");


                    // only the tag name
                    let firstNode = {
                        type: node.type,
                        value: node.value,
                        range: Range.create(
                            Position.create(node.range.start.line, startChar+2),
                            Position.create(node.range.start.line, endChar+1)
                        ),
                        parent: node.parent
                    } as ASTNode;
                    // only the tag name
                    let lastNode = {
                        type: node.type,
                        value: node.value,
                        range: Range.create(
                            Position.create(node.range.end.line, lstartChar+3),
                            Position.create(node.range.end.line, lendChar+1)
                        ),
                        parent: node.parent
                    } as ASTNode;


                    let openingTagFirstLine = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(node.range.start.line, startChar+1),
                            Position.create(node.range.start.line, startChar+2)
                        ),
                        parent: node.parent
                    } as ASTNode;

                    let closingTagFirstLine = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(node.range.start.line, endChar+1),
                            Position.create(node.range.start.line, endChar+2)
                        ),
                        parent: node.parent
                    } as ASTNode;


                    let openingTagLastLine = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(node.range.end.line, lstartChar+1),
                            Position.create(node.range.end.line, lstartChar+3)
                        ),
                        parent: node.parent
                    } as ASTNode;

                    let closingTagLastLine = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(node.range.end.line, lendChar+1),
                            Position.create(node.range.end.line, lendChar+2)
                        ),
                        parent: node.parent
                    } as ASTNode;


                    // names of XML block
                    xmlNodesParsed.push(firstNode);
                    xmlNodesParsed.push(lastNode);

                    // Opening and closing tag of opening XML block
                    // i.e. the '<' and '>' in <#>
                    xmlNodesParsed.push(openingTagFirstLine);
                    xmlNodesParsed.push(closingTagFirstLine);
                    // Opening and closing tag of closing XML block
                    // i.e. the '<' and '>' in </#>
                    xmlNodesParsed.push(openingTagLastLine);
                    xmlNodesParsed.push(closingTagLastLine);
                } else {
                    let startChar = firstLine.indexOf("<");
                    let endChar = firstLine.indexOf(">");

                    let reverseLine = firstLine.split("").reverse().join("");
                    let rstartChar = reverseLine.indexOf(">");
                    let rendChar = reverseLine.indexOf("<");

                    let lendChar = firstLine.length - rstartChar - 1;
                    let lstartChar = firstLine.length - rendChar - 1;

                    let firstNode = {
                        type: node.type,
                        value: node.value,
                        range: Range.create(
                            Position.create(node.range.start.line, startChar+2),
                            Position.create(node.range.start.line, endChar+1)
                        ),
                        parent: node.parent
                    } as ASTNode;

                    let lastNode = {
                        type: node.type,
                        value: node.value,
                        range: Range.create(
                            Position.create(node.range.start.line, lstartChar+3),
                            Position.create(node.range.start.line, lendChar+1)
                        ),
                        parent: node.parent
                    } as ASTNode;

                    let openingTagFirstXml = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(range.start.line, startChar+1),
                            Position.create(range.start.line, startChar+2)
                        ),
                        parent: node.parent
                    };
                    let closingTagFirstXml = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(range.start.line, endChar+1),
                            Position.create(range.start.line, endChar+2)
                        ),
                        parent: node.parent
                    };

                    let openingTagSecondXml = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(range.start.line, lstartChar+1),
                            Position.create(range.start.line, lstartChar+3)
                        ),
                        parent: node.parent
                    };
                    let closingTagSecondXml = {
                        type: node.type,
                        value: "xmlTag",
                        range: Range.create(
                            Position.create(range.start.line, lendChar+1),
                            Position.create(range.start.line, lendChar+2)
                        ),
                        parent: node.parent
                    };

                    // XML component
                    // i.e. <#> and </#>
                    // This ensures styling of the # inside the XML block
                    xmlNodesParsed.push(firstNode);
                    xmlNodesParsed.push(lastNode);

                    // Opening and closing tag of opening XML block
                    // i.e. the '<' and '>' in <#>
                    xmlNodesParsed.push(openingTagFirstXml);
                    xmlNodesParsed.push(closingTagFirstXml);
                    // Opening and closing tag of closing XML block
                    // i.e. the '<' and '>' in </#>
                    xmlNodesParsed.push(openingTagSecondXml);
                    xmlNodesParsed.push(closingTagSecondXml);
                }
            }
            return xmlNodesParsed;
        }

        // Was going to be used to style the contents of an XML Block
        // i.e. the test in <p>test</p>
        // Would've worked by extracting text from a `TextNode` node in the AST
        // Decided it wasn't worth styling since even in the HTML lsp, its left as white
        // so will leave it as is. 
        function extractTextNode(content: string): string {
            // Check if "TextNode:" is in the string
            if (content.includes("TextNode:")) {
                // Extract and trim any text after "TextNode:"
                const result = content.split("TextNode:")[1].trim();
                return result ? result : ""; // Return "" if the result is empty
            }
            return ""; // Return "" if "TextNode:" is not present
        }
        export function extractXMLRanges(ast: ASTNode): Range[] {
            let ret: Range[] = [];
    
            function traverse(currentNode: ASTNode){
                if(currentNode.type === "Node" && currentNode.value === "Xml"){
                    ret.push(currentNode.range);
                }
    
                if(currentNode.children){
                    for(const child of currentNode.children){
                        traverse(child);
                    }
                }
            }
    
            traverse(ast);
            return ret;
        }

        export function adjustRanges(node: ASTNode, documentContent:string, tokenType: number): Range{
            const lines = documentContent.split("\n");
            console.log(`[adjustRanges] in here for tokentype: ${tokenType}`);
            let lineIndex = node.range.start.line-2;
            console.log(`lineIndex: ${lineIndex}`);

            switch(tokenType){
                case 8:
                    let usedVarName = variableParser.getName(node);
                    let regex = new RegExp(`${usedVarName}`, 'g');
                    let usedVarMatch = regex.exec(lines[lineIndex]);

                    let newRange =  Range.create(
                        Position.create(node.range.start.line, usedVarMatch!.index+1),
                        Position.create(node.range.start.line, usedVarMatch!.index+1 + usedVarName.length)
                    );
                    console.log(`[XML] Adjusted range for ${usedVarName}: ${JSON.stringify(newRange)}`);
                    return newRange;
                case 9:
                    let unusedVarName = variableParser.getName(node);
                    let unusedVarregex = new RegExp(`${unusedVarName}`, 'g');
                    let unusedVarMatch = unusedVarregex.exec(lines[lineIndex]);

                    let newRangeUnusedVar =  Range.create(
                        Position.create(node.range.start.line, unusedVarMatch!.index+1),
                        Position.create(node.range.start.line, unusedVarMatch!.index+1 + unusedVarName.length)
                    );
                    console.log(`[XML] Adjusted range for ${unusedVarName}: ${JSON.stringify(newRangeUnusedVar)}`);
                    return newRangeUnusedVar;
                case 19:
                    // Constant strings
                    console.log("INSIDE STRING CONSTANTS!!!!!!!");
                    let str_regex = new RegExp(`CommonTypes\\.Constant\\.String\\s*"([^"]*)"`);
                    let str_match = str_regex.exec(node.value);
                    let str_contents = `\"${str_match![1]}\"`;
                    let escaped_str_contents = str_contents.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    
                    let str_contents_regex = new RegExp(escaped_str_contents);
                    let str_contents_match = str_contents_regex.exec(lines[lineIndex]);
                    let new_str_pos = Range.create(
                        Position.create(node.range.start.line, str_contents_match!.index+1),                        
                        Position.create(node.range.start.line, str_contents_match!.index+1+str_contents.length),
                    );
                    return new_str_pos;
                case 27:
                    let unusedFunName = variableParser.getName(node);
                    let unfunRegex = new RegExp(`${unusedFunName}`, 'g');
                    let unusedFunMatch = unfunRegex.exec(lines[lineIndex]);
                    let unnewRangeUsedFun =  Range.create(
                        Position.create(node.range.start.line, unusedFunMatch!.index+1),
                        Position.create(node.range.start.line, unusedFunMatch!.index+1 + unusedFunName.length)
                    );
                    console.log(`[XML] Adjusted range for ${unusedFunName}: ${JSON.stringify(unnewRangeUsedFun)}`);
                    return unnewRangeUsedFun;
                case 28:
                    let usedFunName = variableParser.getName(node);
                    let funRegex = new RegExp(`${usedFunName}`, 'g');
                    let usedFunMatch = funRegex.exec(lines[lineIndex]);
                    let newRangeUsedFun =  Range.create(
                        Position.create(node.range.start.line, usedFunMatch!.index+1),
                        Position.create(node.range.start.line, usedFunMatch!.index+1 + usedFunName.length)
                    );
                    console.log(`[XML] Adjusted range for ${usedFunName}: ${JSON.stringify(newRangeUsedFun)}`);
                    return newRangeUsedFun;
                case 29:
                    let functionCallName = Function.getNameFromFun(node);
                    let funcallRegex = new RegExp(`${functionCallName}`, 'g');
                    let FunCallMatch = funcallRegex.exec(lines[lineIndex]);
                    let newRangeFunCall =  Range.create(
                        Position.create(node.range.start.line, FunCallMatch!.index+1),
                        Position.create(node.range.start.line, FunCallMatch!.index+1 + functionCallName.length)
                    );
                    console.log(`[XML] Adjusted range for ${functionCallName}: ${JSON.stringify(newRangeFunCall)}`);
                    return newRangeFunCall;
            }

            // Return null for now.
            return Range.create(Position.create(0,0), Position.create(0,0));

        }

    } // End of xmlParser

    // Create function which maps ASTNode range to actual range bc we know for a FACT that
    // any node which is a child of an XML node is always wrong

    // Should also have another function which checks if we are in the range of an XML node
    // just traverse upwards until we hit root or an XML node



    // Given the document as a String, a Range, AND a regex, return the EXACT position
    // that the Regex ocurrs. 
    // Should only be used if the AST doesn't provide precise enough positional informaiton
    // Will only return the first ocurrence of the match.
    export function extractRegexPosition(documentText: string, nodeRange: Range, regex: RegExp): Range {
        // console.log(`[extractRegexPosition] Extracting regex position for ${regex} in range ${JSON.stringify(nodeRange)}`);
        const documentByLine = documentText.split("\n");
        const startLine = nodeRange.start.line;
        const endLine = nodeRange.end.line;
        for(let i = startLine; i < endLine; i++) {
            const line = documentByLine[i];
            const match = regex.exec(line);
            if(match){
                return Range.create(
                    Position.create(i+2, match.index+1),
                    Position.create(i+2, match.index+1 + match[0].length)
                );
            }
        }

        // Returns the original range if no match is found
        return nodeRange;
    }








}

