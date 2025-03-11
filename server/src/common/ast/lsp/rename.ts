import { Position, Range, TextEdit, WorkspaceEdit } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef } from "../node";
import { Variable } from "../namespaces/variable";
import { Function } from "../namespaces/function";

function findExactVarDefinition(node: AST.ASTNode, variableDefinitions: Map<string, VariableNodeDef[]>): VariableNodeDef | null {
    let varName = Variable.getName(node);
    let varNodeDefs = variableDefinitions.get(varName);
    if(varNodeDefs){
        for(const varNodeDef of varNodeDefs){
            if(varNodeDef.variableDefinition.range.start.line === node.range.start.line){
                return varNodeDef;
            }
        }
    }
    return null;
}

function findAllVarReferencesToDef(varNodeDef: VariableNodeDef, variableReferences: Map<string, VariableNode[]>): VariableNode[] {
    let varName = Variable.getName(varNodeDef.variableDefinition);
    let varRefs = variableReferences.get(varName);
    let ret: VariableNode[] = [];
    if(varRefs){
        for(const ref of varRefs){
            if(AST.isInRange(ref.variable.range, varNodeDef.scope.range)){
                ret.push(ref);
            }
        }
    }
    return ret;
}

function findAllFunReferencesToDef(funNodeDef: FunctionNodeDef, functionReferences: Map<string, FunctionNode[]>): FunctionNode[] {
    let funName = Function.getNameFromFun(funNodeDef.functionDefinition);
    let funRefs = functionReferences.get(funName);
    let ret: FunctionNode[] = [];
    if(funRefs){
        for(const ref of funRefs){
            if(AST.isInRange(ref.function.range, funNodeDef.scope.range)){
                ret.push(ref);
            }
        }
    }
    return ret;
}

function adjustRangeBackwards(inputRange: Range, newName: string): Range{
    return Range.create(
        Position.create(inputRange.start.line-2, inputRange.start.character-2),
        Position.create(inputRange.end.line-2, inputRange.end.character-2)
    );
}

function findExactFunDefinition(node: AST.ASTNode, functionDefinitions: Map<string, FunctionNodeDef[]>): FunctionNodeDef | null {
    let funName = Function.getNameFromFun(node);
    let funNodeDefs = functionDefinitions.get(funName);
    if(funNodeDefs){
        for(const funNodeDef of funNodeDefs){
            if(funNodeDef.functionDefinition.range.start.line === node.range.start.line){
                return funNodeDef;
            }
        }
    }
    return null;
}

function addChangeToFunDef(changes: {[uri: string]: TextEdit[]}, funNodeDef: FunctionNodeDef, newName: string, uri: string): void{
    let oldFunName = Function.getNameFromFun(funNodeDef.functionDefinition);
    let newRange = Range.create(
        Position.create(funNodeDef.functionDefinition.range.start.line-2, funNodeDef.functionDefinition.range.start.character-2+4),
        Position.create(funNodeDef.functionDefinition.range.start.line-2, funNodeDef.functionDefinition.range.start.character-2+4+oldFunName.length)
    );
    changes[uri] = [TextEdit.replace(newRange, newName)];
}

// function addChangeToFnAppl(changes: {[uri: string]: TextEdit[]}, funNode: FunctionNode, uri: string): void{
//     let newRange = Range.create(
//         Position.create(funNode.function.range.start.line-2, funNode.function.range.start.character-2),
//         Position.create(funNode.function.range.start.line-2, funNode.function.range.start.character-2+4)
//     );
//     changes[uri].push(TextEdit.replace(newRange, newName));
// }

export function Rename(
    node: AST.ASTNode, 
    newName: string,
    variableDefinitions: Map<string, VariableNodeDef[]>,
    variableReferences: Map<string, VariableNode[]>,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    functionReferences: Map<string, FunctionNode[]>,
    uri: string

): WorkspaceEdit | null {

    console.log(`[Rename] node: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
    if(node.value.startsWith("Variable:") && node.parent!.value === "Val"){
        let varNodeDef = findExactVarDefinition(node, variableDefinitions);
        if(varNodeDef){
            let allReferencesToDef = findAllVarReferencesToDef(varNodeDef, variableReferences);

            const changes: {[uri: string]: TextEdit[]} = {};
            changes[uri] = [];
            changes[uri].push(TextEdit.replace(adjustRangeBackwards(varNodeDef.variableDefinition.range, newName), newName));
            for(const ref of allReferencesToDef){
                changes[uri].push(TextEdit.replace(adjustRangeBackwards(ref.variable.range, newName), newName));
            }
            return {changes};
        }
    } else if(node.value === "Val" && node.children![0].value.startsWith("Variable:")){
        let varNodeDef = findExactVarDefinition(node.children![0], variableDefinitions);
        if(varNodeDef){
            let allReferencesToDef = findAllVarReferencesToDef(varNodeDef, variableReferences);

            const changes: {[uri: string]: TextEdit[]} = {};
            changes[uri] = [];
            changes[uri].push(TextEdit.replace(adjustRangeBackwards(varNodeDef.variableDefinition.range, newName), newName));
            for(const ref of allReferencesToDef){
                changes[uri].push(TextEdit.replace(adjustRangeBackwards(ref.variable.range, newName), newName));
            }
            return {changes};
        }



    } else if(node.value === "Fun"){
        console.log(`node: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
        let funNodeDef = findExactFunDefinition(node, functionDefinitions);
        if(funNodeDef){
            let allReferencesToDef = findAllFunReferencesToDef(funNodeDef, functionReferences);
            if(allReferencesToDef){
                const changes: {[uri: string]: TextEdit[]} = {};
                changes[uri] = [];

                addChangeToFunDef(changes, funNodeDef, newName, uri);

                // changes[uri].push(TextEdit.replace(adjustRangeBackwards(funNodeDef.functionDefinition.range, newName), newName));
                for(const ref of allReferencesToDef){
                    console.log(`[ref]: ${JSON.stringify(ref, AST.removeParentAndChildren, 2)}`);


                    


                    changes[uri].push(TextEdit.replace(adjustRangeBackwards(ref.function.children![0].range, newName), newName));
                }
                return {changes};
            }
        }
    }
    
    return null;
}