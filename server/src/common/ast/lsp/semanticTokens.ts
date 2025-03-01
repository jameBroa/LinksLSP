import { SemanticTokens, SemanticTokensBuilder } from "vscode-languageserver";
import { FunctionNode, FunctionNodeDef, VariableNode, VariableNodeDef } from "../node";
import { AST } from "../ast";
import {ExtractConstantsAndProjectionsAndXML, ExtractNumConstants, ExtractProjections, ExtractStringConstants, ExtractUnusedFunctions, ExtractUnusedVariables, ExtractUsedFunctions, ExtractUsedVariables, ExtractXML } from "../namespaces/shared";
import { RangeReplacer } from "../namespaces/range";

function SortTokens(
    unused_variables: AST.ASTNode[],
    used_variables: AST.ASTNode[],
    string_constants: AST.ASTNode[],
    num_constants: AST.ASTNode[],
    projections: AST.ASTNode[],
    unused_functions: AST.ASTNode[],
    used_functions: AST.ASTNode[],
    function_calls: AST.ASTNode[],
    xml_declarations: AST.ASTNode[], 
    xml_tags: AST.ASTNode[],
    xml_attributes: AST.ASTNode[],
    variants: AST.ASTNode[]
){
    return [
        ...used_variables.map(node => ({node, type: 8})),
        ...unused_variables.map(node => ({node, type: 9})),
        ...string_constants.map(node => ({node, type: 19})),
        ...num_constants.map(node => ({node, type: 20})),
        ...projections.map(node => ({node, type: 26})),
        ...unused_functions.map(node => ({node, type: 27})),
        ...used_functions.map(node => ({node, type: 28})),
        ...function_calls.map(node => ({node, type: 29})),
        ...xml_declarations.map(node => ({node, type: 23})),
        ...xml_tags.map(node => ({node, type: 24})),
        ...xml_attributes.map(node => ({node, type: 25})),
        ...variants.map(node => ({node, type: 30}))
    ].sort((a, b) => {
        if (!a.node.range || !b.node.range) {
          return 0;
        }
        if (a.node.range.start.line !== b.node.range.start.line) {
          return a.node.range.start.line - b.node.range.start.line;
        }
        return a.node.range.start.character - b.node.range.start.character;
    });
}

function CreateBuilder(all_tokens: {node: AST.ASTNode, type:number}[], builder: SemanticTokensBuilder, documentText: string){
    for(const {node, type} of all_tokens){
        console.log(`[semanticTokens] node: ${JSON.stringify(node, AST.removeParentAndChildren, 2)}`);
        console.log(`for type: ${type}`);
        let AdjustedNode: AST.ASTNode = RangeReplacer.AdjustRangeAsAST(node);
        let AdjustedNodes: AST.ASTNode[] = RangeReplacer.AdjustByTypeByAST(AdjustedNode, type, documentText);
        console.log(`[semanticTokens] AdjustedNodes: ${JSON.stringify(AdjustedNodes, AST.removeParentAndChildren, 2)}`);
        for(const node of AdjustedNodes){
            builder.push(
                node.range.start.line,
                node.range.start.character,
                (node.range.end.character - node.range.start.character),
                type,
                0
            );
        }
    }
}


export function ParseSemanticTokensFull(
    variableDefinitions: Map<string, VariableNodeDef[]>,
    variableReferences: Map<string, VariableNode[]>,
    variableRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    functionDefinitions: Map<string, FunctionNodeDef[]>,
    functionReferences: Map<string, FunctionNode[]>,
    functionRefToDef: Map<AST.ASTNode, AST.ASTNode>,
    ast: AST.ASTNode,
    documentText: string
): SemanticTokens{
    console.log("starting extraction...");
    
    const unused_variables = ExtractUnusedVariables(variableReferences, variableDefinitions, variableRefToDef);
    const used_variables = ExtractUsedVariables(variableReferences, variableDefinitions, variableRefToDef);
    const {all_constants, projections, xml, variants} = ExtractConstantsAndProjectionsAndXML(ast);
    const string_constants = ExtractStringConstants(all_constants);
    // const string_constants:AST.ASTNode[] = [];
    const num_constants = ExtractNumConstants(all_constants);    
    const unused_functions = ExtractUnusedFunctions(functionReferences, functionDefinitions);
    const {used_functions, function_calls} = ExtractUsedFunctions(functionReferences, functionDefinitions, unused_functions);
    const {xml_declarations, xml_tags, xml_attributes} = ExtractXML(xml, documentText);
    let all_tokens = SortTokens(
        unused_variables,
        used_variables,
        string_constants,
        num_constants,
        projections,
        unused_functions,
        used_functions,
        function_calls, 
        xml_declarations, 
        xml_tags, 
        xml_attributes,
        variants
    );

    // // optimisation for later, take xml from earlier, take is ranges, and pass that in AdjustRangesInsideXML
    // try{
    //     all_tokens = RangeReplacer.AdjustRangesInsideXML(all_tokens, documentText, ast);
    // } catch (e){
    //     console.log("[error]", e);
    // }

    // // Call it again since RangeReplacer will have changed the ranges
    // all_tokens = SortTokens(
    //     unused_variables,
    //     used_variables,
    //     string_constants,
    //     num_constants,
    //     projections,
    //     unused_functions,
    //     used_functions,
    //     function_calls, 
    //     xml_declarations, 
    //     xml_tags, 
    //     xml_attributes
    // );


    console.log(`[semanticTokens] all_tokens: ${JSON.stringify(all_tokens, AST.removeParentAndChildren, 2)}`);

    let builder = new SemanticTokensBuilder();
    CreateBuilder(all_tokens, builder, documentText);
    return builder.build();
}