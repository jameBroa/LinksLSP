import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef, XNode } from "../node";
import { Function } from "./function";
import { Variable } from "./variable";

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

function ExtractVariablesByUsage(
    used: boolean,
    variableReferences: Map<string, VariableNode[]>,
    variableDefinitions: Map<string, VariableNodeDef[]>,
): AST.ASTNode[] {
    let variables: AST.ASTNode[] = [];
    for(const key of variableDefinitions.keys()){
        let refs = variableReferences.get(key);
        let defs = variableDefinitions.get(key);
        if(defs){
            for(let i = 0; i < defs.length; i++) {
                let def = defs[i];
                let scopeOfVarDef = def.scope.range;
                if(refs){
                    for(const ref of refs){
                        let varPos = ref.variable.range;
                        if(used === false){
                            if(!AST.isInRange(varPos, scopeOfVarDef)){
                                variables.push(def.variableDefinition);
                                break;
                            }
                        } else {
                            if(AST.isInRange(varPos, scopeOfVarDef)){
                                console.log(`found used variable ${key}`);  
                                variables.push(def.variableDefinition);
                                // variables.push(ref.variable);
                                break;
                            }
                        }
                    }
                } else if(!refs && used === false){
                    variables.push(def.variableDefinition);
                } else {
                    // variables.push(def.variableDefinition);
                }
            }
        }
    }

    if(used){
        for(const key of variableReferences.keys()){
            let refs = variableReferences.get(key);
            if(refs){
                for(const ref of refs){
                    variables.push(ref.variable);
                }
            }
        }
    }

    return variables;
}


export function ExtractUnusedVariables(
    variableReferences: Map<string, VariableNode[]>,
    variableDefinitions: Map<string, VariableNodeDef[]>,
    varRefToDef: Map<AST.ASTNode, AST.ASTNode>
): AST.ASTNode[] {
    let UnusedVariables = ExtractVariablesByUsage(false, variableReferences, variableDefinitions);
    // console.log("[Shared.ExtractUnusedVariables] res:", JSON.stringify(UnusedVariables, AST.removeParentAndChildren, 2));
    return UnusedVariables;
}

export function ExtractUsedVariables(
    variableReferences: Map<string, VariableNode[]>,
    variableDefinitions: Map<string, VariableNodeDef[]>,
    varRefToDef: Map<AST.ASTNode, AST.ASTNode>
): AST.ASTNode[] {

    let UsedVariables = ExtractVariablesByUsage(true, variableReferences, variableDefinitions);
    // console.log("[Shared.ExtractUsedVariables] res:", JSON.stringify(UsedVariables, AST.removeParentAndChildren, 2));

    return UsedVariables;
}

export function ExtractStringConstants(AllConstants: AST.ASTNode[]): AST.ASTNode[]{
    let StringConstants: AST.ASTNode[] = AllConstants.filter((node) => {
        return node.value.substring(0,35) !== "Constant: (CommonTypes.Constant.Int" 
      && node.value.substring(0, 37) !== "Constant: (CommonTypes.Constant.Float";
    });

    return StringConstants;
}

export function ExtractNumConstants(AllConstants: AST.ASTNode[]): AST.ASTNode[]{
    let NumConstants: AST.ASTNode[] = AllConstants.filter((node) => {
        return node.value.substring(0,35) === "Constant: (CommonTypes.Constant.Int" 
      || node.value.substring(0, 37) === "Constant: (CommonTypes.Constant.Float";
    });
    return NumConstants;
}

export function ExtractProjections(): AST.ASTNode[]{
    let Projections: AST.ASTNode[] = [];

    return Projections;
}

export function ExtractConstantsAndProjectionsAndXML(ast: AST.ASTNode): {all_constants: AST.ASTNode[], projections: AST.ASTNode[], xml: AST.ASTNode[]} {
    let AllConstants: AST.ASTNode[] = [];
    let Projections: AST.ASTNode[] = [];
    let XMLNodes: AST.ASTNode[] = [];
    function traverse(currentNode: AST.ASTNode){

        if(currentNode.type === "Leaf" && currentNode.value.substring(0,9) === "Constant:"){
            AllConstants.push(currentNode);
        }

        if(currentNode.type === "Node" && currentNode.value === "Projection"){
            Projections.push(currentNode.children![1]);
        }
        if(currentNode.type === "Leaf" && currentNode.parent && currentNode.parent.value === "Xml"){
            XMLNodes.push(currentNode);
        }

        traverseASTFull(currentNode, traverse);
    }
    traverse(ast);
    return {"all_constants": AllConstants, "projections": Projections, "xml": XMLNodes};
}



function ExtractFunctionsByUsage(
    used: boolean,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    functionReferences: Map<string, FunctionNode[]>
): AST.ASTNode[] {
    if(used === true){
        // console.log(`Extracting used functions...`);
    } else {
        // console.log(`Extracting unused functions...`);
    }
    let functions: AST.ASTNode[] = [];
    for(const key of functionDefinitions.keys()){
        let refs = functionReferences.get(key);
        let defs = functionDefinitions.get(key);
        if(defs){
            for(let i = 0; i < defs.length; i++) {
                let def = defs[i];
                let scopeOfVarDef = def.scope.range;
                if(refs){
                    for(const ref of refs){
                        let funPos = ref.function.range;

                        if(!used){
                            if(!AST.isInRange(funPos, scopeOfVarDef)){
                                functions.push(def.functionDefinition);
                                break;
                            }
                        } else {
                            if(AST.isInRange(funPos, scopeOfVarDef)){
                                functions.push(def.functionDefinition);
                                break;
                            }
                        }
                    }
                } else if (!refs && used === false && Function.getNameFromFun(def.functionDefinition) !== "dummy_wrapper") {
                    functions.push(def.functionDefinition);
                } else {
                    //
                }
            }
        }
    }

    if(used){
        for(const key of functionReferences.keys()){
            let refs = functionReferences.get(key);
            if(refs){
                for(const ref of refs){
                    functions.push(ref.function);
                }
            }
        }
    }
    return functions;
}

export function ExtractXML(all_xml: AST.ASTNode[], documentText: string): {xml_declarations: AST.ASTNode[], xml_tags:AST.ASTNode[], xml_attributes: AST.ASTNode[] } {
    let xml_declarations: AST.ASTNode[] = [];
    let xml_tags: AST.ASTNode[] = [];
    let xml_attributes: AST.ASTNode[] = [];
    let xml_text: AST.ASTNode[] = [];

    xml_text = all_xml.filter((node) => {
        return node.value.substring(0, 9) === "TextNode:";
    });

    let xml_semantics = AST.xmlParser.extractSemantics(all_xml, documentText);

    xml_declarations = xml_semantics.filter((node) => {
        return node.value !== "xmlTag" && node.value !== "xmlAttribute";
    });
  
    xml_tags = xml_semantics.filter((node) => {
        return node.value === "xmlTag";
    });

    xml_attributes = xml_semantics.filter((node) => {
        return node.value === "xmlAttribute";
    });

    return {xml_declarations, xml_tags, xml_attributes};
}


export function ExtractUsedFunctions(
    functionReferences: Map<string, FunctionNode[]>,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    UnusedFunctions: AST.ASTNode[],
): {used_functions: AST.ASTNode[], function_calls: AST.ASTNode[]}{
    let UsedFunctions: AST.ASTNode[] = ExtractFunctionsByUsage(true, functionDefinitions, functionReferences);
    let used_functions = UsedFunctions.filter((node) => {
        return node.value !== "FnAppl";
    });

    let function_calls = UsedFunctions.filter((node) => {
        return node.value === "FnAppl";
    });
    console.log(`[Shared.ExtractUsedFunctions] res: ${JSON.stringify(used_functions, AST.removeParentAndChildren, 2)}`);

    return {used_functions, function_calls};
}

export function ExtractUnusedFunctions(
    functionReferences: Map<string, FunctionNode[]>,
    functionDefinitions: Map<string, FunctionNodeDef[]>
): AST.ASTNode[]{
    let UnusedFunctions: AST.ASTNode[] = ExtractFunctionsByUsage(false, functionDefinitions, functionReferences);
    console.log(`[Shared.ExtractUnusedFunctions] res: ${JSON.stringify(UnusedFunctions, AST.removeParentAndChildren, 2)}`);
    return UnusedFunctions;
}