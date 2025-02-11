import { AST } from "../ast";
import { XNode } from "../node";

export type RefDef<T extends XNode = XNode> = {
    definitions: Map<string, AST.ASTNode[]>,
    references: Map<string, T[]>
}

export function traverseASTByLevel(currentNode: AST.ASTNode, callback: (node: AST.ASTNode) => void){
    if(currentNode.children){
        for(const child of currentNode.children){
            if(child.value !== "Fun"){
                callback(child);
            }
        }
    }
}

export function traverseASTFull(currentNode: AST.ASTNode, callback: (node: AST.ASTNode) => void){
    if(currentNode.children){
        for(const child of currentNode.children){
            callback(child);  
        }
    }
}

export function addToDefinitions(map: Map<string, AST.ASTNode[]>, name: string, node: AST.ASTNode){
    addToASTMap(map, name, node);
}

export function addToXNode(map: Map<string, XNode[]>, name: string, node: XNode){
    if(map.has(name)){
        map.set(name, [...map.get(name)!, node]);
    } else {
        map.set(name, [node]);
    }
}

export function createScopeNode(currentScope: AST.ASTNode, defNode: AST.ASTNode): AST.ASTNode {
    let scope = {
        type: currentScope.type,
        value: currentScope.value,
        range: {
            start: defNode.range.start,
            end: currentScope.range.end
        },
        parent: currentScope.parent,
        children: currentScope.children
    } as AST.ASTNode;
    return scope;
}

export function createScopeNodeForDef(currentScope: AST.ASTNode, varNode: AST.ASTNode): AST.ASTNode{
    let scope = {
        type: currentScope.type,
        value: currentScope.value,
        range: {
            start: varNode.range.start,
            end: currentScope.range.end
        },
        parent: currentScope.parent,
        children: currentScope.children
    } as AST.ASTNode;
    return scope;
}

export function ExtractExactDefinition(DefinitionNodes: AST.ASTNode[], CurrentScope: AST.ASTNode, XNode: AST.ASTNode): AST.ASTNode | null{
    let defNode: AST.ASTNode | null = null;
    for(const node of DefinitionNodes){
        if(
            AST.isInRange(node.range, CurrentScope.range) && 
            AST.isBefore(node.range, XNode.range)){
            defNode = node;
            break;
        }
    }
    return defNode;
}

function addToASTMap(map: Map<string, AST.ASTNode[]>, name: string, node: AST.ASTNode){
    if(map.has(name)){
        map.set(name, [...map.get(name)!, node]);
    } else {
        map.set(name, [node]);
    }
}



