import { Location } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef } from "../node";
import { IsOnDefinitionVariable } from "../conditions";
import { Variable } from "../namespaces/variable";
import { Function } from "../namespaces/function";

function GetValidVarReferences(
    VarRefs: VariableNode[], 
    VarDefs: VariableNodeDef[], 
    References: Location[],
    uri: string): void {
    for(const ref of VarRefs){
        for(const def of VarDefs){
            if(AST.isInRange(ref.variable.range, def.scope.range)){
                References.push(Location.create(
                    uri,
                    ref.variable.range
                ));
            }
        }
    }
}

function GetValidFunReferences(
    node: AST.ASTNode, 
    FunRefs: FunctionNode[], 
    FunDefs: FunctionNodeDef[], 
    References: Location[],
    uri: string): void {
    for(const ref of FunRefs){
        for(const def of FunDefs){
            if
            (
                AST.isInRange(node.range, def.scope.range) && 
                AST.isInRange(ref.function.range, def.scope.range)
            )
                {
                    References.push(Location.create(
                        uri,
                        ref.function.range
                    ));
                }
        }
    }
}


export function References(
    node: AST.ASTNode,
    uri: string,
    variableDefinitions: Map<string, VariableNodeDef[]>,
    variableReferences: Map<string, VariableNode[]>,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    functionReferences: Map<string, FunctionNode[]>
): Location[] {
    let References: Location[] = [];
    if(IsOnDefinitionVariable(node)){
        let varName = Variable.getName(node);
        let VariableDefinitions = variableDefinitions.get(varName);
        let VariableReferences = variableReferences.get(varName);

        if(VariableReferences && VariableDefinitions){
            GetValidVarReferences(VariableReferences, VariableDefinitions, References, uri);
        }

        References.push(Location.create(
            uri,
            node.range
        ));
    } else {
        let funName = Function.getNameFromFun(node.parent!);
        let FunctionDefinitions = functionDefinitions.get(funName);
        let FunctionReferences = functionReferences.get(funName);

        if(FunctionReferences && FunctionDefinitions){
            GetValidFunReferences(node, FunctionReferences, FunctionDefinitions, References, uri);
        }
        References.push(Location.create(
            uri,
            node.range
        ));
    }
    return References;
}