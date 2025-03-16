import { Position, Range } from "vscode-languageserver";
import { AST } from "../ast";
import { LSPFeatureHandler, VariableNode, VariableNodeDef } from "../node";
import { addToDefinitions, addToXNode, createScopeNode, createScopeNodeForDef, ExtractExactDefinition, ExtractStringFromConstant, ExtractStringFromStrConstant, RefDef, traverseASTByLevel, traverseASTFull } from "./shared";
import { Function } from "./function";


export namespace Variable {

    export namespace VariableConditions {
        
        export function isFnAppl(node: AST.ASTNode): boolean{
            if(node.parent){
                return (
                    node.parent.value === "FnAppl"
                );
            } else {
                return false;
            }
        }

        export function isFunReference(node: AST.ASTNode): boolean {
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

        export function isParameter(node: AST.ASTNode): boolean {
            if(node.parent){
                return node.parent.value === "NormalFunLit";
            } else {
                return false;
            }
        }

        export function isLeafAndVariable(node: AST.ASTNode): boolean {
            return (
                node.type === "Leaf" && 
                node.value.substring(0, 9) === "Variable:"
            );
        }

        export function hasValidParent(node: AST.ASTNode): boolean {
            if(node.parent){
                return (
                    (node.parent.value === "Val" && node.parent.children![0] === node) ||
                    node.parent.value === "NormalFunlit" || 
                    (
                        node.parent.value === "Tuple" &&
                        node.parent.parent && 
                        node.parent.parent.value === "NormalFunlit"
                    ) ||
                    (
                        node.parent.value === "FormBinding" &&
                        node.parent.children![1] === node
                    ) 
                );
            }
            return false;
        }

        export function isFormlet(node: AST.ASTNode): boolean {
            if(node.parent){
                return (
                    node.type === "Leaf" &&
                    node.value.substring(0,9) === "Variable:" &&
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
                && !isFormlet(node)
                && !Function.FunctionConditions.isFormletPlacement(node)

            );
        }

        export function isIteration(node: AST.ASTNode): boolean {
            if(
                node.parent && 
                node.parent.parent && 
                node.parent.parent.value === "Iteration" &&
                node.value.substring(0,9) === "Variable:" // Added this line 
                && (node.parent.value !== "TupleLit" && node.parent.value !== "ListLit")
                ){
                if(node.parent.children![0] === node){
                    return true;
                }
            }
            return false;
        }

        export function isIterationTuple(node: AST.ASTNode): boolean{
            if(
                node.parent &&
                node.parent.parent &&
                node.parent.parent.parent &&
                node.parent.value === "Tuple" &&
                node.parent.parent.value === "List" &&
                node.parent.parent.parent.value === "Iteration"
            ) {
                return true;
            }
            return false;
        }

        export function isDatabase(node: AST.ASTNode): boolean {
            if (
                node.type === "Leaf" &&
                node.parent &&
                (node.parent.value === "DBDelete" || node.parent.value === "DBUpdate")) {
                    if(node.parent.children![0] === node){
                        return true;
                    }
                }
                return false;
        }

        export function isRecord(node: AST.ASTNode): boolean {
            return (node.type === "Leaf" && 
                node.value.substring(0, 9) === "Variable:" && 
                node.parent !== null && 
                node.parent.value === "Record");
        }

        function isVariant(node: AST.ASTNode): boolean {
            return (node.parent !== null &&
                node.parent.parent !== null &&
                node.parent.value === "Variant" &&
                node.parent.parent.value === "Case" &&
                node.parent.children![1] === node
            );
        }


        // Checks only if Variant has one variable, i.e. no tuple
        export function isInCase(node: AST.ASTNode): boolean {
            return(node.type === "Leaf" &&
                isVariant(node)
                // node.parent !== null &&
                // node.parent.parent !== null &&
                // node.parent.value === "Variant" && 
                // node.parent.parent.value === "Case" && // was previously "Case statement"
                // node.parent.children![1] === node
            );
        }

        export function isInCaseForTuple(node: AST.ASTNode): boolean {
            return(node.type === "Leaf" &&
                node.parent !== null &&
                node.parent.value === "Tuple" &&
                isVariant(node.parent)
            );
        }

        export function isLName(node: AST.ASTNode): boolean {
            return (node.type === "Leaf" &&
                node.parent !== null &&
                node.parent.value === "Attribute: l:name"
            );
        }

        export function isSwitchListDestructering(node: AST.ASTNode): boolean {
            return (isLeafAndVariable(node) &&
                node.parent !== null &&
                node.parent.value === "Cons" 
                || (node.parent !== null && node.parent.value === "Case" && node.parent.children![0] === node)
            );
        }

        export function isVariableDefinition(node: AST.ASTNode): boolean {
            return (
                (
                    isLeafAndVariable(node) && 
                    !isFnAppl(node) &&
                    hasValidParent(node) 
                    
                ) 
                || isIteration(node) 
                || isDatabase(node)
                || isRecord(node)
                || isInCase(node)
                || isInCaseForTuple(node)
                || isLName(node)
                || isSwitchListDestructering(node)
                || isIterationTuple(node)
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
        
        // backward propagation until we reach the parent Input node
        export function hasReachedParentForm(node: AST.ASTNode): boolean{
            return (
                node.parent !== null &&
                node.parent.value === "Xml" &&
                node.parent.children![0].value === "form"
            );
        }

        export function isAtRootOfAST(node: AST.ASTNode){
            return (
                node.value === "Fun" && 
                node.children![0].value.split(" ")[1] === "dummy_wrapper"
            );
        }

        export function hasNotReachedCaseNode(node: AST.ASTNode): boolean {
            return (
                node.value !== "Case" &&
                node.parent !== null
            );
        }
    }

    export function getName(node: AST.ASTNode){
        return node.value.split(" ")[1];
    }

    function getScope(varNode: AST.ASTNode, currentScope: AST.ASTNode) {
        let varName = getName(varNode);

        while(VariableConditions.hasNotReachedParentScope(currentScope)){
            // Can do '.parent!' because hasNotReachedParentScope
            currentScope = currentScope.parent!; 
        }

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
                return currentScope;
            }
        }
    }

    function getScopeForLName(varNode: AST.ASTNode, currentScope: AST.ASTNode) {
        let inputCurrScope = currentScope;

        currentScope = currentScope.parent!;
        while(!VariableConditions.hasReachedParentForm(currentScope)){

            currentScope = currentScope.parent!;
        }

        currentScope = currentScope.parent!.children![0];

        if(currentScope.value === "form"){
            return currentScope;
        } else {
            // Return input scope if we can't find the input scope
            return inputCurrScope;
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

    function getScopeOfDatabase(node: AST.ASTNode): AST.ASTNode {
        return node.parent!;
    }

    function getScopeOfCase(node: AST.ASTNode): AST.ASTNode {
        let caseNode = node.parent!.parent!;
        let block = caseNode.children![1];
        let newScope = {
            type: block.type,
            value: block.value,
            range: {
                start: caseNode.range.start,
                end: block.range.end
            },
            children: block.children,
            parent: block.parent
        } as AST.ASTNode;
        return newScope;
        // return caseNode.children![1];
    }

    function getScopeOfCaseDestructing(node: AST.ASTNode, currentScope: AST.ASTNode): AST.ASTNode {
        let inputScope = currentScope;
        while(VariableConditions.hasNotReachedCaseNode(currentScope)){
            currentScope = currentScope.parent!;
        }

        if(currentScope !== null && currentScope !== inputScope && !VariableConditions.isAtRootOfAST(currentScope)){
            return currentScope.children![1];
        } else{
            return inputScope;
        }

        // Go up until we hit "Case" node
        // Return 2nd child of "Case" node since its a Block
    }

    export function ExtractDefinitions(ast: AST.ASTNode): Map<string, VariableNodeDef[]> {
        let definitions = new Map<string, VariableNodeDef[]>();

        function traverse(currentNode: AST.ASTNode){
            let varName;
            if(VariableConditions.isVariableDefinition(currentNode)) {

                varName = getName(currentNode);
                let scopeNode: AST.ASTNode | null = null;


                // Change to switch case eventually
                if(VariableConditions.isIteration(currentNode)){
                    scopeNode = getScopeOfIteration(currentNode);
                } else if (VariableConditions.isDatabase(currentNode)) {
                    scopeNode = getScopeOfDatabase(currentNode);
                } else if (VariableConditions.isInCase(currentNode)) {
                    scopeNode = getScopeOfCase(currentNode);
                
                } else if (VariableConditions.isInCaseForTuple(currentNode)) {
                    scopeNode = getScopeOfCase(currentNode.parent!);
                } else if (VariableConditions.isLName(currentNode)) {
                    varName = ExtractStringFromConstant(currentNode.value);
                    let tempScopeNode = getScopeForLName(currentNode, currentNode);
                    if(tempScopeNode !== currentNode){
                        scopeNode = tempScopeNode;
                    }
                    currentNode.range = Range.create(
                        Position.create(currentNode.range.start.line, currentNode.range.start.character+1),
                        Position.create(currentNode.range.start.line, currentNode.range.start.character+1 + varName.length)
                    );

                } else if (VariableConditions.isSwitchListDestructering(currentNode)) {
                    varName = getName(currentNode);
                    scopeNode = getScopeOfCaseDestructing(currentNode, currentNode);

                }else if (VariableConditions.isIterationTuple(currentNode)){
                    scopeNode = getScopeOfIteration(currentNode.parent!);
                    varName = getName(currentNode);


                }else {
                    scopeNode = getScopeOfDef(currentNode, currentNode);
                }


                if(scopeNode && varName){
                    let varDefNode = {
                        variableDefinition: currentNode,
                        scope: scopeNode
                    } as VariableNodeDef;

                    addToXNode(definitions, varName, varDefNode);
                }
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