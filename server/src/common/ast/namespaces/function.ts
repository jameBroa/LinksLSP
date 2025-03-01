import { Position, Range } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef } from "../node";
import { addToDefinitions, addToXNode, createScopeNode, createScopeNodeForDef, ExtractExactDefinition, RefDef, traverseASTByLevel, traverseASTFull } from "./shared";
import { Variable } from "./variable";

export namespace Function{

    export namespace FunctionConditions {

        export function isFunctionReferenceInFormBinding(node: AST.ASTNode): boolean {
            return (node.type === "Leaf" &&
                node.parent !== null &&
                node.parent.value === "FormBinding" &&
                node.parent.children![0] === node
            );
        }

        export function isFormletPlacement(node: AST.ASTNode): boolean {
            return (node.type === "Leaf" &&
                node.parent !== null &&
                node.parent.value === "FormletPlacement" &&
                node.parent.children![1] === node
            );
        }

        export function isInCase(node: AST.ASTNode): boolean {
            return (node.type === "Leaf" &&
                node.parent !== null &&
                node.parent.parent !== null &&
                node.parent.value === "Variant" && 
                node.parent.parent.value === "Case statement" &&
                node.parent.children![0] === node
            );
        }


        export function isFunctionReference(node: AST.ASTNode): boolean {
            if(node.parent){
                return (
                    (
                        node.value === "FnAppl" && 
                        node.children![0].value.substring(0, 9) === "Variable:"
                    ) || isFunctionReferenceInFormBinding(node)
                    || isFormletPlacement(node)
                    // || isInCase(node)
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

        export function isInMutual(node: AST.ASTNode){
            return (node.parent!.value === "Funs");
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
        // console.log(`[Function] Looking for ${funName} in scope ${JSON.stringify(currentScope.range)}`);
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
            // console.log(`[Function] Local definitions: ${JSON.stringify(localDefNodes.map(node => node.range))}`);
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
                    // console.log(`Couldn't find scope for ${funName}!`);
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
                let scopeNode: AST.ASTNode;
                let functionDefinitionNode: FunctionNodeDef;
                if(FunctionConditions.isInMutual(currentNode)){
                    let FunsNode = currentNode.parent!;
                    let suggestedScope = getScopeOfDef(currentNode, currentNode.parent!);
                    // scopeNode = getScopeOfDef(currentNode.parent!, currentNode.parent!);
                    let newScopeNode = {
                        type: suggestedScope.type,
                        value: suggestedScope.value,
                        range: Range.create(
                            FunsNode.range.start,
                            suggestedScope.range.end
                        ),
                        parent: currentNode.parent,
                        children: currentNode.parent?.children
                    };

                    functionDefinitionNode = {
                        functionDefinition: currentNode,
                        scope: newScopeNode
                    } as FunctionNodeDef;

                } else {
                    scopeNode = getScopeOfDef(currentNode, currentNode.parent!);
                    functionDefinitionNode = {
                        functionDefinition: currentNode,
                        scope: scopeNode
                    } as FunctionNodeDef;
                }
                addToXNode(definitions, functionName, functionDefinitionNode);
                // addToDefinitions(definitions, functionName, currentNode);
            }
            traverseASTFull(currentNode, traverse);
        }

        traverse(ast);
        return definitions;
    }

    function CreateFnApplNode(node: AST.ASTNode, range: Range, parent: AST.ASTNode){
        return {
            type: "Node",
            value: "FnAppl",
            range: range,
            parent: parent,
            children: [node]
        } as AST.ASTNode;
    }

    export function ExtractReferences(ast: AST.ASTNode): Map<string, FunctionNode[]>{
        let references = new Map<string, FunctionNode[]>();

        function traverse(currentNode: AST.ASTNode){
            let funName;
            let scopeNode;

            if(FunctionConditions.isFunctionReference(currentNode)){
                let funNode: AST.ASTNode = currentNode;

                if(FunctionConditions.isFunctionReferenceInFormBinding(currentNode)){
                    console.log(`inside form binding`);
                    funName = Variable.getName(currentNode);
                    scopeNode = currentNode.parent!;
                    let newRange = Range.create(
                        Position.create(currentNode.range.start.line, currentNode.range.start.character),
                        scopeNode.range.end
                    );
                    funNode = CreateFnApplNode(currentNode, newRange, scopeNode);
                    // let astNode = {
                    //     type: "Node",
                    //     value: "FnAppl",
                    //     range: Range.create(
                    //         Position.create(currentNode.range.start.line, currentNode.range.start.character),
                    //         scopeNode.range.end
                    //     ),
                    //     parent: currentNode.parent,
                    //     children: [currentNode]
                    // } as AST.ASTNode;
                    // let functionNode = {
                    //     function: astNode,
                    //     scope: scopeNode
                    // } as FunctionNode;
                    // addToXNode(references, funName, functionNode);
                } else if (FunctionConditions.isFormletPlacement(currentNode)) {
                    console.log(`inside formlet placement`);
                    funName = Variable.getName(currentNode);
                    console.log(`looking scope for ${funName}`);
                    scopeNode = currentNode.parent!;

                    // scopeNode = getScope(currentNode, currentNode);
                    let newRange = Range.create(
                        Position.create(currentNode.range.start.line, currentNode.range.start.character),
                        scopeNode.range.end
                    );
                    funNode = CreateFnApplNode(currentNode, newRange, scopeNode);
                } 
                // else if (FunctionConditions.isInCase(currentNode)) {
                //     console.log(`[fun.isincase: ] ${JSON.stringify(currentNode, AST.removeParentAndChildren, 2)}`);
                //     console.log(currentNode.value);
                //     funName = currentNode.value;
                //     scopeNode = currentNode.parent!;
                //     // let newRange = Range.create(
                //     //     currentNode.range.start,
                //     //     Position.create(currentNode.range.start.line, currentNode.range.start.character+funName.length),
                //     // );
                //     let newNode = {
                //         type: currentNode.type,
                //         value: `Variable: ${funName}`,
                //         range: currentNode.range,
                //         parent: currentNode.parent,
                //         children: currentNode.children
                //     } as AST.ASTNode;
                //     console.log(`[Fun.isInCase] funName: ${funName}`);
                //     // console.log(`[Fun.isInCase] newRange: ${JSON.stringify(newRange)}`);
                //     funNode = CreateFnApplNode(newNode, scopeNode.range, scopeNode);

                // }
                else {
                    funName = getNameFromFnAppl(currentNode);
                    scopeNode= getScope(currentNode, currentNode);
                    funNode = currentNode;
                    // let functionNode = {
                    //     function: currentNode,
                    //     scope: scopeNode
                    // } as FunctionNode;
                    // addToXNode(references, funName, functionNode);
                }

                if(scopeNode && funNode){
                    console.log(`scope for ${funName}`)
                    console.log(`found scope: ${JSON.stringify(scopeNode.range)}`)
                    let functionNode = {
                        function: funNode,
                        scope: scopeNode
                    } as FunctionNode;
                    addToXNode(references, funName, functionNode);
                }


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

    export function hasSignature(node: AST.ASTNode){
        return node.children![node.children!.length-1].value === "Signature";
    }

}