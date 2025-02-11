import { Range } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef } from "../node";
import { addToDefinitions, addToXNode, createScopeNode, createScopeNodeForDef, ExtractExactDefinition, RefDef, traverseASTByLevel, traverseASTFull } from "./shared";

export namespace Function{

    namespace FunctionConditions {

        export function isFunctionReference(node: AST.ASTNode): boolean {
            if(node.parent){
                return (
                    node.value === "FnAppl" && 
                    node.children![0].value.substring(0, 9) === "Variable:"
                );
            }
            return false;
        }

        export function isFunctionDefinition(node: AST.ASTNode): boolean {
            return (
                node.type === "Node" &&
                node.value === "Fun"
            );
        }

        export function hasNotReachedParentScope(node: AST.ASTNode): boolean{
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

    export function getNameFromFun(currentNode: AST.ASTNode){
        return currentNode.children![0].value.split(" ")[1];
    }
    
    export function getBinderFromSig(currentNode: AST.ASTNode){
        return currentNode.parent!.children![0];
    }

    function getNameFromFnAppl(currentNode: AST.ASTNode){
        return getNameFromFun(currentNode);
    }

    function getScope(funNode: AST.ASTNode, currentScope: AST.ASTNode){
        let funName = getNameFromFnAppl(funNode);
        console.log(`[Function] Looking for ${funName} in scope ${JSON.stringify(currentScope.range)}`);
        while(FunctionConditions.hasNotReachedParentScope(currentScope)){
            currentScope = currentScope.parent!;
        }
        console.log(`traversed up until: ${JSON.stringify(currentScope.range)}`);

        

        // Avoids recomputation of all local definitions
        let LocalDefinitions = ExtractLocalDefinitions(currentScope);
        console.log(`[Function] Local definitions: ${JSON.stringify(Array.from(LocalDefinitions.keys()))}`);
        if(LocalDefinitions.has(funName)){
            console.log(`[Function] Found local definition for ${funName}!`);
            let localDefNodes = LocalDefinitions.get(funName)!;
            console.log(`[Function] Local definitions: ${JSON.stringify(localDefNodes.map(node => node.range))}`);
            let defNode = ExtractExactDefinition(localDefNodes, currentScope, funNode);
            if(defNode === null){
                console.log(`[Function] Could not find definition for ${funName}!`);
                return funNode; // If there's an error, return funNode
            }
            return createScopeNode(currentScope, defNode);
        } else {
            if(currentScope.parent && !FunctionConditions.isAtRootOfAST(currentScope)){
                return getScope(funNode, currentScope.parent);
            } else {
                return funNode; // If there's an error, return funNode
            }
        }
    }

    function getScopeOfDef(funNode: AST.ASTNode, currentScope: AST.ASTNode) {
            let funName = getNameFromFun(funNode);
            while(FunctionConditions.hasNotReachedParentScope(currentScope)){
                // Can do '.parent!' because hasNotReachedParentScope
                currentScope = currentScope.parent!; 
            }
            let LocalDefinitions = ExtractLocalDefinitions(currentScope);
            if(LocalDefinitions.has(funName)){
                return createScopeNodeForDef(currentScope, funNode);
            } else {
                if(currentScope.parent && !FunctionConditions.isAtRootOfAST(currentScope)){
                    return getScope(funNode, currentScope.parent);
                } else {
                    console.log(`Couldn't find scope for ${funName}!`);
                    return currentScope;
                }
            }
        }

    function ExtractLocalDefinitions(ast: AST.ASTNode): Map<string, AST.ASTNode[]>{
        let definitions = new Map<string, AST.ASTNode[]>();

        function traverse(currentNode: AST.ASTNode){
            if(FunctionConditions.isFunctionDefinition(currentNode)){
                let functionName = getNameFromFun(currentNode);
                addToDefinitions(definitions, functionName, currentNode);
            }
            // traverseASTByLevel(currentNode, traverse);
            traverseASTFull(currentNode, traverse);

        }

        traverse(ast);
        return definitions;
    }

    export function ExtractDefinitions(ast: AST.ASTNode): Map<string, FunctionNodeDef[]>{
        let definitions = new Map<string, FunctionNodeDef[]>();

        function traverse(currentNode: AST.ASTNode){
            if(FunctionConditions.isFunctionDefinition(currentNode)){
                let functionName = getNameFromFun(currentNode);
                let scopeNode = getScopeOfDef(currentNode, currentNode.parent!);
                let functionDefinitionNode = {
                    functionDefinition: currentNode,
                    scope: scopeNode
                } as FunctionNodeDef;
                addToXNode(definitions, functionName, functionDefinitionNode);
                // addToDefinitions(definitions, functionName, currentNode);
            }
            traverseASTFull(currentNode, traverse);
        }

        traverse(ast);
        return definitions;
    }

    export function ExtractReferences(ast: AST.ASTNode): Map<string, FunctionNode[]>{
        let references = new Map<string, FunctionNode[]>();

        function traverse(currentNode: AST.ASTNode){
            let funName;
            let scopeNode;

            if(FunctionConditions.isFunctionReference(currentNode)){
                funName = getNameFromFnAppl(currentNode);
                scopeNode= getScope(currentNode, currentNode);

                let functionNode = {
                    function: currentNode,
                    scope: scopeNode
                } as FunctionNode;

                addToXNode(references, funName, functionNode);

            }
            traverseASTFull(currentNode, traverse);
        }

        traverse(ast);
        return references;
    }

    export function ExtractNumParamsFromRef(node: AST.ASTNode): number {
        // console.log(`[ExtractNumParmsFromRef] node: ${JSON.stringify(node, AST.removeParentField, 2)}`);
        return node.children!.length-1;
    }

    export function ExtractNumParamsFromDef(node: AST.ASTNode): number {
        // console.log(`[ExtractNumParamsFromDef] node: ${JSON.stringify(node, AST.removeParentField, 2)}`);
        return node.children![1].children!.length-1;
    }

}