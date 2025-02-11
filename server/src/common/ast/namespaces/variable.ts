import { Position, Range } from "vscode-languageserver";
import { AST } from "../ast";
import { LinksNode, VariableNode, VariableNodeDef } from "../node";
import { addToDefinitions, addToXNode, createScopeNode, createScopeNodeForDef, ExtractExactDefinition, RefDef, traverseASTByLevel, traverseASTFull } from "./shared";


export namespace Variable {

    export namespace VariableConditions {
        
        function isFnAppl(node: AST.ASTNode): boolean{
            if(node.parent){
                return (
                    node.parent.value === "FnAppl"
                );
            } else {
                return false;
            }
        }

        function isFunReference(node: AST.ASTNode): boolean {
            if(node.parent){
                if(node.parent.value === "FnAppl"){
                    if(node.parent.children![0] === node){
                        return true;
                    }
                    return false;
                } else {
                    return false;
                }

            } else {
                return false;
            }
        }

        function isParameter(node: AST.ASTNode): boolean {
            if(node.parent){
                return node.parent.value === "NormalFunLit";
            } else {
                return false;
            }
        }

        function isLeafAndVariable(node: AST.ASTNode): boolean {
            return (
                node.type === "Leaf" && 
                node.value.substring(0, 9) === "Variable:"
            );
        }

        function hasValidParent(node: AST.ASTNode): boolean {
            if(node.parent){
                return (
                    node.parent.value === "Val" ||
                    node.parent.value === "NormalFunlit" ||
                    (
                        node.parent.value === "FormBinding" &&
                        node.parent.children![1] === node
                    ) 
                );
            }
            return false;
        }

        function isFormlet(node: AST.ASTNode): boolean {
            if(node.parent){
                return (
                    node.type === "Node" &&
                    node.parent.value === "FormBinding" &&
                    node.parent.children![0] === node
                );
            } else {
                return false;
            }
        }


        export function isVariableReference(node: AST.ASTNode): boolean {
            return (
                isLeafAndVariable(node) &&
                !isFunReference(node) &&
                // !isFnAppl(node) &&
                !isParameter(node) 
                // && isFormlet(node)
            );
        }

        export function isIteration(node: AST.ASTNode): boolean {
            if(
                node.parent && 
                node.parent.parent && 
                node.parent.parent.value === "Iteration"
                ){
                if(node.parent.children![0] === node){
                    return true;
                }
            }
            return false;
        }

        export function isVariableDefinition(node: AST.ASTNode): boolean {
            return (
                (
                    isLeafAndVariable(node) && 
                    !isFnAppl(node) &&
                    hasValidParent(node)
                ) ||
                isIteration(node)
            );
        }

        export function hasNotReachedParentScope(node: AST.ASTNode): boolean {
            return (
                node.value !== "Fun" &&
                node.value !== "No Signature" &&
                node.value !== "Signature" &&
                node.parent !== null
            );
        }

        export function isAtRootOfAST(node: AST.ASTNode){
            return (
                node.value === "Fun" && 
                node.children![0].value.split(" ")[1] === "dummy_wrapper"
            );
        }
    }

    export function getName(node: AST.ASTNode){
        return node.value.split(" ")[1];
    }

    function getScope(varNode: AST.ASTNode, currentScope: AST.ASTNode) {
        let varName = getName(varNode);
        console.log("\n\n Getting scope for variable: " + varName);

        console.log(`currentScope (before) ${JSON.stringify(currentScope.range)}`);
        while(VariableConditions.hasNotReachedParentScope(currentScope)){
            // Can do '.parent!' because hasNotReachedParentScope
            currentScope = currentScope.parent!; 
        }
        console.log(`currentScope (after) ${JSON.stringify(currentScope.range)}`);

        let LocalDefinitions = ExtractLocalDefinitions(currentScope);

        if(LocalDefinitions.has(varName)){
            let localDefNodes = LocalDefinitions.get(varName)!;
            let defNode = ExtractExactDefinition(localDefNodes, currentScope, varNode);
            
            if(defNode === null){
                return varNode; // If there's an error, return varNode;
            }
            return createScopeNode(currentScope, defNode);
        } else {
            if(currentScope.parent && !VariableConditions.isAtRootOfAST(currentScope)){
                return getScope(varNode, currentScope.parent);
            } else {
                console.log(`Couldn't find scope for ${varName}!`);
                return currentScope;
            }
        }
    }

    function getScopeOfDef(varNode: AST.ASTNode, currentScope: AST.ASTNode) {
        let varName = getName(varNode);
        while(VariableConditions.hasNotReachedParentScope(currentScope)){
            // Can do '.parent!' because hasNotReachedParentScope
            currentScope = currentScope.parent!; 
        }
        let LocalDefinitions = ExtractLocalDefinitions(currentScope);
        if(LocalDefinitions.has(varName)){
            return createScopeNodeForDef(currentScope, varNode);
        } else {
            if(currentScope.parent && !VariableConditions.isAtRootOfAST(currentScope)){
                return getScope(varNode, currentScope.parent);
            } else {
                console.log(`Couldn't find scope for ${varName}!`);
                return currentScope;
            }
        }
    }

    function ExtractLocalDefinitions(ast: AST.ASTNode): Map<string, AST.ASTNode[]> {
        let definitions = new Map<string, AST.ASTNode[]>();

        function traverse(currentNode: AST.ASTNode){
            let varName;
            if(VariableConditions.isVariableDefinition(currentNode)){
                varName = getName(currentNode);
                addToDefinitions(definitions, varName, currentNode);
            }
            traverseASTByLevel(currentNode, traverse);
        }

        traverse(ast);

        return definitions;
    }

    function getScopeOfIteration(node: AST.ASTNode): AST.ASTNode{
        let IterationScope = {
            type: node.type,
            value: node.value,
            range: {
                start: node.range.start,
                end: node.parent!.parent!.range.end
            }
        } as AST.ASTNode;
        return IterationScope;
    }

    export function ExtractDefinitions(ast: AST.ASTNode): Map<string, VariableNodeDef[]> {
        let definitions = new Map<string, VariableNodeDef[]>();

        function traverse(currentNode: AST.ASTNode){
            let varName;
            if(VariableConditions.isVariableDefinition(currentNode)) {
                varName = getName(currentNode);
                let scopeNode: AST.ASTNode;
                if(VariableConditions.isIteration(currentNode)){
                    scopeNode = getScopeOfIteration(currentNode);
                } else {
                    scopeNode = getScopeOfDef(currentNode, currentNode);
                }
                let varDefNode = {
                    variableDefinition: currentNode,
                    scope: scopeNode
                } as VariableNodeDef;

                addToXNode(definitions, varName, varDefNode);
                // addToDefinitions(definitions, varName, currentNode);
            }
            traverseASTFull(currentNode, traverse);
        }

        traverse(ast);

        return definitions;
    }

    export function ExtractReferences(ast: AST.ASTNode): Map<string, VariableNode[]> {
        let references = new Map<string, VariableNode[]>();

        function traverse(currentNode: AST.ASTNode){
            let varName;
            let scopeNode;
            if(VariableConditions.isVariableReference(currentNode)){
                varName = getName(currentNode);
                scopeNode = getScope(currentNode, currentNode);

                if(scopeNode !== currentNode){
                    let variableNode = {
                        variable: currentNode,
                        scope: scopeNode
                    } as VariableNode;

                    addToXNode(references, varName, variableNode);
                }
            }
            traverseASTFull(currentNode, traverse);
        }

        traverse(ast);

        return references;
    }
}