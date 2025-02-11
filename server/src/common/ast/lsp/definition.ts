import { Location } from "vscode-languageserver";
import { AST } from "../ast";
import { IsOnDefinitionVariable } from "../conditions";

export function Definition(
    node: AST.ASTNode, 
    uri: string, 
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>) : Location | null {
        let DefinitionLocation: Location | null = null;
        if(IsOnDefinitionVariable(node)){
            if(variableRefToDef.has(node)){
                DefinitionLocation = Location.create(
                    uri,
                    variableRefToDef.get(node)!.range
                );
            } else {
                console.log(`[Definition] Could not find variable mapping for ASTNode`);
                return null;
            }
        } else {
            if(functionRefToDef.has(node)){
                DefinitionLocation = Location.create(
                    uri,
                    functionRefToDef.get(node)!.range
                );
            } else {
                console.log(`[Definition] Could not find function mapping for ASTNode`);
            }
        }
        return DefinitionLocation;
    }