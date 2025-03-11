import { Location } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef } from "../node";
import { IsOnDefinitionVariable } from "../conditions";
import { Variable } from "../namespaces/variable";
import { Function } from "../namespaces/function";

function GetValidVarReferences(
    node: AST.ASTNode,
    VarRefs: VariableNode[], 
    VarDefs: VariableNodeDef[], 
    References: Location[],
    uri: string): void {
    for(const ref of VarRefs){
        for(const def of VarDefs){
            console.log(`node.range: ${JSON.stringify(node.range)}`);
            console.log(`def.scope.range: ${JSON.stringify(def.scope.range)}`);
            console.log(`ref.variable.range: ${JSON.stringify(ref.variable.range)}`);
            
            if(
                AST.isInRange(node.range, def.scope.range) &&
                AST.isInRange(ref.variable.range, def.scope.range)
            ){
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
    // console.log(`[References] node: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
    if(IsOnDefinitionVariable(node)){
        let varName = Variable.getName(node);

        // console.log(`getting references for ${varName}`);


        let VariableDefinitions = variableDefinitions.get(varName);
        let VariableReferences = variableReferences.get(varName);

        if(VariableReferences && VariableDefinitions){
            GetValidVarReferences(node, VariableReferences, VariableDefinitions, References, uri);
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