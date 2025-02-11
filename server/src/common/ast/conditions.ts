import { AST } from "./ast";



export function IsOnDefinitionVariable(node: AST.ASTNode): boolean {
    if(node.parent){
        return (
            node.value.substring(0,9) === "Variable:" 
            && !(node.parent.value === "FnAppl" && node.parent.children![0] === node)
        );
    } else {
        return false;
    }
}