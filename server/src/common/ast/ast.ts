import { Range, Position } from "vscode-languageserver";
import { OCamlClient } from "../ocaml/ocamlclient";
import {TextDocument} from "vscode-languageserver-textdocument";
import { start } from "repl";
import { AssertionError } from "assert";
import { create } from "domain";
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

                    if((position.line+1) === child_range.start.line) {
                        if(position.character >= start) {
                            if(position.line+1 < child_range.end.line ) {
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
               referenceNode.range.start.line-1 >= currentNode.range.start.line 
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
                (currentNode.type === "Leaf" && 
                currentNode.value.substring(0, 9) === "Variable:") || 
                (currentNode.type === "Leaf" && 
                 currentNode.value.substring(0, 9) === "Constant:"   
                )
            ) {
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

        return valid_nodes;
    }

    function isBefore(range1: Range, range2: Range): boolean {
        if (range1.end.line < range2.start.line) {
          return true;
        }
        if (range1.end.line === range2.start.line && range1.end.character < range2.start.character) {
          return true;
        }
        return false;
      }
      
      function isAfter(range1: Range, range2: Range): boolean {
        if (range1.start.line > range2.end.line) {
          return true;
        }
        if (range1.start.line === range2.end.line && range1.start.character > range2.end.character) {
          return true;
        }
        return false;
      }

      function isInRange(range: Range, checkRange: Range): boolean {
        if (isBefore(range, checkRange) || isAfter(range, checkRange)) {
          return false;
        }
        return true;
      }

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


        // variableNodes: All nodes with value `Variable: {variable_name}`
        export function extractUnusedVariables(variableNodes: ASTNode[]): ASTNode[]{
            let ret: ASTNode[] = [];

            function getVariableScopeAsASTNode(node: ASTNode): ASTNode {
                let currNode = node;
                while(currNode.value !== "NormalFunlit"){
                    currNode = currNode.parent!;
     
                }
                return currNode;
            }

            for(const node of variableNodes){
                let parentNode: ASTNode = getVariableScopeAsASTNode(node);
                let variableMap: Map<String, number> = new Map();

                function traverse(currentNode: ASTNode) {
                    if(currentNode.type === "Leaf" && 
                        currentNode.value.substring(0, 9) === "Variable:" && 
                        isRealVariable(currentNode)){
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
                    // Range information actually considers THE WHOLE definition of the variable
                    // i.e. if we have val.id, range includes val.id.
                    // we want to extract only the 'id' part
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

        // Returns the ASTNode of where a function is called from (not its definition)
        export function getFunctionCallers(ast: ASTNode): ASTNode[]{
            let ret: ASTNode[] = [];

            function traverse(currentNode: ASTNode){
                if(currentNode.value === "FnAppl") {
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
                if(currentNode.type === "Node" && currentNode.value === "FnAppl"){
                    ret.push(currentNode.children![0].value.split(" ")[1]);
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


    // Functions for getting semantic information related to XML blocks
    export namespace xmlParser {



        // Given a child of an XML node, return the attributes an XML node has
        // i.e. the XML node: <test input="test" id="test" l:onclick="test" banana="test" apple="test"></test>
        // would return ["input", "id", "l:onclick", "banana", "apple"]
        function getAttributes(node: ASTNode): string[] {
            let idx = 1;
            let attributes: string[] = [];
            while(idx < node.parent!.children!.length-1){
            // while(node.parent!.children![idx].value.substring(0,9) !==  "TextNode:"){
                attributes.push(node.parent!.children![idx].value);
                idx++;
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
                let regex = new RegExp(`${attribute}`, 'g');
                map.set(attribute, regex);
            }
            return map;
        }

        export function extractSemantics(xmlNodes: ASTNode[], documentText: string): ASTNode[] {
            let ret: ASTNode[] = [];

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
                    const attributes: Range[] = []; // the attributes like type, id, and l:{handler}
                    let canAddAttributes = false;
                    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                        let line = lines[lineIndex];
                        let match;

                        let openingTagClosingXMLTagMatch; // the > in the opening XML tag <#'>' <--- this one

                    
                        // looks for <{node.value}
                        while ((match = openingPattern.exec(line)) !== null) {
                            nodeMatches.push(Range.create(
                                Position.create(lineIndex+1, match.index+2),
                                Position.create(lineIndex+1, match.index+2 + node.value.length)
                            ));

                            tags.push(Range.create(
                                Position.create(lineIndex+1, match.index+1),
                                Position.create(lineIndex+1, match.index+2)
                            ));


                            
                            
                            canAddAttributes = true;


                        }

                        // Looks for attributes
                        if(canAddAttributes){
                            for(const [attribute, regex] of attributeRegexMap){
                                while((match = regex.exec(line)) !== null){
                                    attributes.push(Range.create(
                                        Position.create(lineIndex+1, match.index+1),
                                        Position.create(lineIndex+1, match.index+1 + attribute.length)
                                    ));
                                }
                            }
                        }
                        // looks for '>'
                        while((openingTagClosingXMLTagMatch = closingTagPattern.exec(line)) !== null){
                            tags.push(Range.create(
                                Position.create(lineIndex+1, openingTagClosingXMLTagMatch.index+1),
                                Position.create(lineIndex+1, openingTagClosingXMLTagMatch.index+2)
                            ));
                            canAddAttributes = false;
                        }

                        // looks for '/>'
                        while((openingTagClosingXMLTagMatch = closingTagPatternAlt.exec(line)) !== null){
                            tags.push(Range.create(
                                Position.create(lineIndex+1, openingTagClosingXMLTagMatch.index+1),
                                Position.create(lineIndex+1, openingTagClosingXMLTagMatch.index+3)
                            ));
                            canAddAttributes = false;
                        }



                       
                        while ((match = closingPattern.exec(line)) !== null) {
                            nodeMatches.push(Range.create(
                                Position.create(lineIndex+1, match.index+3),
                                Position.create(lineIndex+1, match.index + match[0].length)
                            ));
                            
                            tags.push(Range.create(
                                Position.create(lineIndex+1, match.index+1),
                                Position.create(lineIndex+1, match.index+3)
                            ));
                            tags.push(Range.create(
                                Position.create(lineIndex+1, match.index + match[0].length),
                                Position.create(lineIndex+1, match.index + match[0].length+1)
                            ));
                        }
                    }

                    matches.push({ XML: node.value, ranges: nodeMatches });
                    xmlBlocksProcessed.add(node.value);

                    for(const range of nodeMatches){
                        ret.push({
                            type: node.type,
                            value: node.value,
                            range: range,
                            parent: node.parent
                        });
                    }

                    for(const tag of tags){
                        ret.push({
                            type: node.type,
                            value: "xmlTag",
                            range: tag,
                            parent: node.parent
                        });
                    }

                    for(const attribute of attributes){
                        ret.push({
                            type: node.type,
                            value: "xmlAttribute",
                            range: attribute,
                            parent: node.parent
                        });
                    }


                    
                }
            }
            return ret;
        }


        // Old - Can remove
        export function parseXmlRanges(nodes: ASTNode[], document: TextDocument): ASTNode[]{
            let xmlNodesParsed: ASTNode[] = [];
            const documentText = document.getText();
            const lines = documentText.split("\n");

            for(const node of nodes){
                let range = node.range;
                let firstLine = lines[range.start.line-1];

                let lastLine = lines[range.end.line-1];

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
    }
}

