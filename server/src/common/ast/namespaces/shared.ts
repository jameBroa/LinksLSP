import { Position, Range } from "vscode-languageserver";
import { AST } from "../ast";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef, XNode } from "../node";
import { Function } from "./function";
import { Variable } from "./variable";
import { split } from "lodash";

export type RefDef<T extends XNode = XNode> = {
    definitions: Map<string, AST.ASTNode[]>,
    references: Map<string, T[]>
}

export function ExtractStringFromStrConstant(input: string): string{
    let regex = new RegExp(`CommonTypes\\.Constant\\.String\\s*"([^"]*)"`);
    let match = regex.exec(input);
    if(match){
        return match![1];
    }
    return "";
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

export function ExtractConstantsAndProjectionsAndXML(ast: AST.ASTNode): {all_constants: AST.ASTNode[], projections: AST.ASTNode[], xml: AST.ASTNode[], variants: AST.ASTNode[]} {
    let AllConstants: AST.ASTNode[] = [];
    let Projections: AST.ASTNode[] = [];
    let XMLNodes: AST.ASTNode[] = [];
    let Variants: AST.ASTNode[] = [];
    function traverse(currentNode: AST.ASTNode){

        if(currentNode.type === "Leaf" && currentNode.value.substring(0,9) === "Constant:"){
            AllConstants.push(currentNode);
        }

        if(currentNode.type === "Node" && currentNode.value === "Projection"){
            Projections.push(currentNode.children![1]);
        }
        if(currentNode.parent && currentNode.parent.value === "Xml"){
            XMLNodes.push(currentNode);
        }

        if(currentNode.value === "Variant"){
            let child = currentNode.children![0];
            let adjustedVariant = {
                type: child.type,
                value: child.value,
                range: Range.create(
                    child.range.start,
                    Position.create(child.range.start.line, child.range.start.character+child.value.length)
                ),
                parent: currentNode.parent,
                children: currentNode.children

            } as AST.ASTNode;
            Variants.push(adjustedVariant);
        }

        traverseASTFull(currentNode, traverse);
    }
    traverse(ast);
    return {"all_constants": AllConstants, "projections": Projections, "xml": XMLNodes, "variants": Variants};
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

function IsOpenAndCloseXMLTag(node: AST.ASTNode, documentText: string): boolean {
    let split_by_line = documentText.split("\n");
    let str = split_by_line[node.range.end.line-2];
    let lower = node.range.end.character-4;
    let upper = node.range.end.character-3;
    return str.substring(lower, upper) === "/";
}

function CreateTags(isSelfClosing: boolean, node: AST.ASTNode, desired_sibling: AST.ASTNode, xml_tags: AST.ASTNode[]){
    // Means it is defined by <X>{contents}</X>

    if(isSelfClosing === false){
        let opening_tag_end: AST.ASTNode | null = null;
        if(desired_sibling.value.substring(0,9)==="TextNode:" || desired_sibling.value === "Block"){
            opening_tag_end = {
                type: "Node",
                value: "Opening tag: >",
                range: Range.create(
                    Position.create(desired_sibling.range.start.line, desired_sibling.range.start.character-1),
                    Position.create(desired_sibling.range.start.line, desired_sibling.range.start.character)
                ),
                parent: node.parent,
                children: node.children
            } as AST.ASTNode;
        } else {
            opening_tag_end = {
                type: "Node",
                value: "Opening tag: >",
                range: Range.create(
                    Position.create(desired_sibling.range.end.line, desired_sibling.range.end.character-6),
                    Position.create(desired_sibling.range.end.line, desired_sibling.range.end.character-5)
                ),
                parent: node.parent,
                children: node.children
            } as AST.ASTNode;
        }

        let closing_tag_start = {
            type: node.type,
            value: "Closing tag: </",
            range: Range.create(
                Position.create(node.range.end.line, node.range.end.character-node.value.length-3),
                Position.create(node.range.end.line, node.range.end.character-node.value.length-1)
            ),
            parent: node.parent,
            children: node.children
        } as AST.ASTNode;

        let closing_tag_end = {
            type: node.type,
            value: "Closing tag: >",
            range: Range.create(
                Position.create(node.range.end.line, node.range.end.character-1),
                Position.create(node.range.end.line, node.range.end.character)
            ),
            parent: node.parent,
            children: node.children
        } as AST.ASTNode;

        xml_tags.push(... [opening_tag_end, closing_tag_start, closing_tag_end]);
    } else {
        let opening_tag_end = {
            type: "Node",
            value: "/>",
            range: Range.create(
                Position.create(desired_sibling.range.end.line, desired_sibling.range.end.character-2),
                Position.create(desired_sibling.range.end.line, desired_sibling.range.end.character)
            ),
            parent: node.parent,
            children: node.children
        } as AST.ASTNode;
        xml_tags.push(opening_tag_end);
    }
}

export function ExtractXML(all_xml: AST.ASTNode[], documentText: string): {xml_declarations: AST.ASTNode[], xml_tags:AST.ASTNode[], xml_attributes: AST.ASTNode[] } {
    let xml_declarations: AST.ASTNode[] = [];
    let xml_tags: AST.ASTNode[] = [];
    let xml_attributes: AST.ASTNode[] = [];
    let xml_text: AST.ASTNode[] = [];
    let new_xml_declarations: AST.ASTNode[] = [];
    let new_xml_attributes: AST.ASTNode[] = [];

    let split_by_line = documentText.split("\n");

    console.log(`[ExtractXML] all_xml: ${JSON.stringify(all_xml, AST.removeParentAndChildren, 2)}`);

    xml_text = all_xml.filter((node) => {
        return node.value.substring(0, 9) === "TextNode:";
    });

    console.log(`[ExtractXML] xml_text: ${JSON.stringify(xml_text, AST.removeParentAndChildren, 2)}`);


    let declarations = all_xml.filter((node) => {
        if(node.parent && node.parent.value === "Xml" && node.parent!.children![0] === node){
            return node;
        } 
    });

    console.log(`[ExtractXML] declarations: ${JSON.stringify(declarations, AST.removeParentField, 2)}`);




    for(const node of declarations){

        let opening_tag_start = {
            type: node.type,
            value: "Opening tag: <",
            range: Range.create(
                Position.create(node.range.start.line, node.range.start.character),
                Position.create(node.range.start.line, node.range.start.character+1)
            ),
            parent: node.parent,
            children: node.children
        } as AST.ASTNode;
        xml_tags.push(opening_tag_start);



        let siblings = node.parent!.children!;

        let remove_attr_siblings = siblings.filter((node) => {
            return node.value.substring(0,9) !== "Attribute" && node.value !== "Xml";
        });

        console.log(`all siblings w/o attr and xml ${node.value}, ${JSON.stringify(remove_attr_siblings, AST.removeParentAndChildren, 2)}`);


        // Basically xml that's not declared like this: <test/>
        if(remove_attr_siblings.length > 1){
            let desired_sibling = remove_attr_siblings[1];
            console.log(`desired_sibling ${node.value}, ${JSON.stringify(desired_sibling, AST.removeParentAndChildren, 2)}`);
            let self_closing = IsOpenAndCloseXMLTag(desired_sibling, documentText);
            console.log(`self_closing ${self_closing}`);
            CreateTags(self_closing, node, desired_sibling, xml_tags);

        } else {
            console.log(`[remove_attr_siblings] ${node.value}: ${JSON.stringify(remove_attr_siblings, AST.removeParentAndChildren, 2)}`);
            let desired_sibling = remove_attr_siblings[0];
            let self_closing = IsOpenAndCloseXMLTag(desired_sibling, documentText);
            CreateTags(self_closing, node, desired_sibling, xml_tags);
        }

        
    }

    // to solve tag problem, just do regex on text to find everything w/ '>'

    for(const node of declarations){
        let siblings = node.parent!.children!;

        let remove_attr_siblings = siblings.filter((node) => {
            return node.value.substring(0,9) !== "Attribute" && node.value !== "Xml";
        });
        let desired_sibling: AST.ASTNode | null = null;

        if(remove_attr_siblings.length > 1){
            desired_sibling = remove_attr_siblings[1];
        } else {
            desired_sibling = remove_attr_siblings[0];
        }
        let self_closing = IsOpenAndCloseXMLTag(desired_sibling, documentText);
        console.log(`for the actual xml node for ${node.value} is self_closing: ${self_closing}`);
        let str = split_by_line[node.range.end.line-2];
        let open_and_close = str.substring(str.length-2, str.length-1) === "/";
        let opening_node = {
            type: node.type,
            value: `Opening: ${node.value}`,
            range: Range.create(
                Position.create(node.range.start.line, node.range.start.character+1),
                Position.create(node.range.start.line, node.range.start.character+1+node.value.length)
            ),
            parent: node.parent,
            children: node.children
        } as AST.ASTNode;

        if(!self_closing){
            let closing_node = {
                type: node.type,
                value: `Closing: ${node.value}`,
                range: Range.create(
                    Position.create(node.range.end.line, node.range.end.character-1-node.value.length),
                    Position.create(node.range.end.line, node.range.end.character-1)
                ),
                parent: node.parent,
                children: node.children
            } as AST.ASTNode;
            new_xml_declarations.push(closing_node);
        } 
        new_xml_declarations.push(opening_node);
    }

    console.log(`[ExtractXML] new_xml_declarations: ${JSON.stringify(new_xml_declarations, AST.removeParentAndChildren, 2)}`);

    new_xml_attributes = all_xml.filter((node) => {
        return node.value.substring(0,9) === "Attribute";
    });

    console.log(`[ExtractXML] new_xml_attributes: ${JSON.stringify(new_xml_attributes, AST.removeParentAndChildren, 2)}`);


    let xml_semantics = AST.xmlParser.extractSemantics(all_xml, documentText);

    xml_declarations = xml_semantics.filter((node) => {
        return node.value !== "xmlTag" && node.value !== "xmlAttribute";
    });
  
    // xml_tags = xml_semantics.filter((node) => {
    //     return node.value === "xmlTag";
    // });

    xml_attributes = xml_semantics.filter((node) => {
        return node.value === "xmlAttribute";
    });

    console.log(`[ExtractXML] xml_tags: ${JSON.stringify(xml_tags, AST.removeParentAndChildren, 2)}`);

    return {xml_declarations:new_xml_declarations, xml_tags, xml_attributes:new_xml_attributes};
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